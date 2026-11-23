/* Connexion à Shopify (Storefront API, GraphQL) — MODE OPTIONNEL.
   Actif uniquement si SHOPIFY_STORE_DOMAIN et SHOPIFY_STOREFRONT_TOKEN sont définis.
   Sans ces variables, la boutique fonctionne exactement comme avant (base locale + Stripe). */
import { db } from './db.js';

export const shopifyOn = () => !!(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_STOREFRONT_TOKEN);
export const shopifyAdminUrl = () => `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin`;
const version = () => process.env.SHOPIFY_API_VERSION || '2025-07';
const endpoint = () => `${process.env.SHOPIFY_API_BASE || 'https://' + process.env.SHOPIFY_STORE_DOMAIN}/api/${version()}/graphql.json`;

export async function gql(query, variables = {}) {
  const res = await fetch(endpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': process.env.SHOPIFY_STOREFRONT_TOKEN },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Shopify ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error('Shopify : ' + json.errors.map((e) => e.message).join(' ; '));
  return json.data;
}

/* ---------- Cache court (si Shopify est indisponible, on sert la dernière version connue) ---------- */
const cache = new Map();
const ttl = () => (process.env.SHOPIFY_CACHE_SECONDS !== undefined ? Number(process.env.SHOPIFY_CACHE_SECONDS) : 30) * 1000;
async function cached(key, fn) {
  const c = cache.get(key);
  if (c && Date.now() - c.t < ttl()) return c.v;
  try { const v = await fn(); cache.set(key, { t: Date.now(), v }); return v; }
  catch (e) { if (c) { console.error('Shopify indisponible, cache utilisé :', e.message); return c.v; } throw e; }
}

/* ---------- Catalogue ---------- */
const INVENTORY = () => process.env.SHOPIFY_INVENTORY === '1'; // exige l'autorisation « lire l'inventaire » sur le jeton
const PRODUCTS_QUERY = () => `query Catalog($after:String){ products(first:100, after:$after){ pageInfo{hasNextPage endCursor} nodes{
  id handle title vendor description createdAt availableForSale
  images(first:6){nodes{url}}
  collections(first:10){nodes{handle}}
  variants(first:50){nodes{id title availableForSale ${INVENTORY() ? 'quantityAvailable' : ''} price{amount} compareAtPrice{amount}}}
}}}`;
const cents = (a) => Math.round(parseFloat(a) * 100);

function mapProduct(n) {
  const vs = n.variants.nodes;
  const first = vs.find((v) => v.availableForSale) || vs[0];
  if (!first) return null;
  const prices = vs.map((v) => cents(v.price.amount));
  const price = Math.min(...prices);
  const cmp = first.compareAtPrice ? cents(first.compareAtPrice.amount) : null;
  const colls = n.collections.nodes.map((c) => c.handle);
  const catSlugs = new Set(db.prepare('SELECT slug FROM categories').all().map((c) => c.slug));
  const catSlug = colls.find((h) => catSlugs.has(h)) || null;
  const cat = catSlug ? db.prepare('SELECT name FROM categories WHERE slug=?').get(catSlug) : null;
  const single = vs.length === 1;
  const stock = !n.availableForSale ? 0 : INVENTORY() && vs.every((v) => typeof v.quantityAvailable === 'number')
    ? vs.reduce((a, v) => a + (v.availableForSale ? Math.max(0, v.quantityAvailable) : 0), 0) : 999;
  const desc = String(n.description || '').trim();
  return {
    id: first.id, // identifiant de variante : sert à ajouter au panier Shopify
    slug: n.handle, name: n.title, brand: n.vendor || '', size: single && first.title !== 'Default Title' ? first.title : '',
    short_desc: desc.split(/\n/)[0].slice(0, 200), description: desc,
    price_cents: price, compare_cents: cmp && cmp > price ? cmp : null,
    stock, low_stock: 3, images: JSON.stringify(n.images.nodes.map((i) => i.url)), featured: colls.includes('coups-de-coeur') ? 1 : 0,
    created_at: Date.parse(n.createdAt) || 0, cat_slug: catSlug, cat_name: cat?.name || null, collections: colls,
    variants: single ? [] : vs.map((v) => ({ id: v.id, title: v.title, available: v.availableForSale, price_cents: cents(v.price.amount) })),
  };
}

export const allShopifyProducts = () => cached('products', async () => {
  const out = []; let after = null;
  for (let page = 0; page < 5; page++) { // jusqu'à 500 produits
    const d = await gql(PRODUCTS_QUERY(), { after });
    out.push(...d.products.nodes.map(mapProduct).filter(Boolean));
    if (!d.products.pageInfo.hasNextPage) break; after = d.products.pageInfo.endCursor;
  }
  return out;
});

/* ---------- Panier Shopify (l'identifiant du panier est gardé dans notre session) ---------- */
const CART = `id checkoutUrl totalQuantity cost{subtotalAmount{amount}} lines(first:100){nodes{id quantity cost{totalAmount{amount}} merchandise{... on ProductVariant{id title price{amount} image{url} product{handle title vendor featuredImage{url}}}}}}`;
const MUT = {
  create: `mutation CartCreate($lines:[CartLineInput!]){ cartCreate(input:{lines:$lines}){ cart{${CART}} userErrors{message} } }`,
  add: `mutation CartLinesAdd($cartId:ID!,$lines:[CartLineInput!]!){ cartLinesAdd(cartId:$cartId,lines:$lines){ cart{${CART}} userErrors{message} } }`,
  update: `mutation CartLinesUpdate($cartId:ID!,$lines:[CartLineUpdateInput!]!){ cartLinesUpdate(cartId:$cartId,lines:$lines){ cart{${CART}} userErrors{message} } }`,
  remove: `mutation CartLinesRemove($cartId:ID!,$lineIds:[ID!]!){ cartLinesRemove(cartId:$cartId,lineIds:$lineIds){ cart{${CART}} userErrors{message} } }`,
};
const getCartId = (ctx) => ctx.session.cart._shopify || null;
function remember(ctx, cart) {
  ctx.session.cart = cart ? { _shopify: cart.id, _count: cart.totalQuantity } : {}; ctx.touch();
}

export async function fetchCart(ctx) {
  const id = getCartId(ctx); if (!id) return null;
  const d = await gql(`query GetCart($id:ID!){ cart(id:$id){${CART}} }`, { id });
  remember(ctx, d.cart); // cart = null une fois la commande payée → on repart d'un panier vide
  return d.cart;
}
async function mutate(ctx, kind, vars) {
  const d = await gql(MUT[kind], vars); const r = Object.values(d)[0];
  if (r.userErrors?.length) throw Object.assign(new Error(r.userErrors[0].message), { user: true });
  remember(ctx, r.cart); return r.cart;
}
export async function cartAdd(ctx, variantId, quantity) {
  const lines = [{ merchandiseId: variantId, quantity }]; const id = getCartId(ctx);
  if (id) { try { return await mutate(ctx, 'add', { cartId: id, lines }); } catch (e) { if (e.user) throw e; } }
  return mutate(ctx, 'create', { lines });
}
export const cartSetQty = (ctx, lineId, quantity) => quantity > 0
  ? mutate(ctx, 'update', { cartId: getCartId(ctx), lines: [{ id: lineId, quantity }] })
  : mutate(ctx, 'remove', { cartId: getCartId(ctx), lineIds: [lineId] });

/* Convertit un panier Shopify au format attendu par nos pages (mêmes gabarits, même design). */
export function cartView(cart) {
  const lines = (cart?.lines.nodes || []).map((l) => {
    const m = l.merchandise; const img = m.image?.url || m.product.featuredImage?.url;
    return { qty: l.quantity, total: cents(l.cost.totalAmount.amount), p: {
      id: l.id, slug: m.product.handle, brand: m.product.vendor, name: m.product.title, size: m.title !== 'Default Title' ? m.title : '',
      price_cents: cents(m.price.amount), stock: 99, images: JSON.stringify(img ? [img] : []) } };
  });
  const subtotal = cents(cart?.cost.subtotalAmount.amount || '0');
  return { lines, subtotal, shipping: null, total: subtotal, count: cart?.totalQuantity || 0, notices: [], checkoutUrl: cart?.checkoutUrl || null, shopify: true };
}
