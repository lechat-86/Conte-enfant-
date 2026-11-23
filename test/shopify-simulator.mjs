// Simulateur minimal de la Storefront API Shopify (catalogue + panier) — pour essayer le mode Shopify SANS boutique réelle.
// Lancer :  node test/shopify-simulator.mjs   (écoute sur le port 3928)
// Les produits « TEST » sont fictifs et n'existent que dans le simulateur.
import http from 'node:http';
import assert from 'node:assert/strict';

export function startSimulator(MOCK = 3928) {
  const money = (n) => ({ amount: n.toFixed(2) });
  const V = (id, title, price, avail = true) => ({ id: `gid://shopify/ProductVariant/${id}`, title, availableForSale: avail, price: money(price), compareAtPrice: null });
  const PRODUCTS = [
    { id: 'gid://shopify/Product/1', handle: 'brume-corps-et-cheveux-prady-monoi-tiare-250-ml', title: 'Brume corps et cheveux Monoï Tiaré', vendor: 'Prady', description: 'Brume parfumée pour le corps et les cheveux.\nFlacon de 250 ml.', createdAt: '2026-11-01T10:00:00Z', availableForSale: true, images: { nodes: [] }, collections: { nodes: [{ handle: 'brumes' }, { handle: 'coups-de-coeur' }] }, variants: { nodes: [V(11, 'Default Title', 4.9)] } },
    { id: 'gid://shopify/Product/2', handle: 'produit-test-maquillage', title: 'Produit TEST maquillage (simulateur)', vendor: 'Test', description: 'Produit de test à plusieurs teintes.', createdAt: '2026-11-10T10:00:00Z', availableForSale: true, images: { nodes: [] }, collections: { nodes: [{ handle: 'maquillage' }] }, variants: { nodes: [V(21, 'Rose', 7.5), V(22, 'Nude', 7.5), V(23, 'Corail', 8.5, false)] } },
    { id: 'gid://shopify/Product/3', handle: 'produit-test-epuise', title: 'Produit TEST épuisé (simulateur)', vendor: 'Test', description: 'Épuisé.', createdAt: '2026-11-12T10:00:00Z', availableForSale: false, images: { nodes: [] }, collections: { nodes: [{ handle: 'parfums' }] }, variants: { nodes: [V(31, 'Default Title', 39, false)] } },
  ];
  const variantsById = Object.fromEntries(PRODUCTS.flatMap((p) => p.variants.nodes.map((v) => [v.id, { v, p }])));
  const carts = {}; let seq = 0;
  const cartOut = (c) => ({ id: c.id, checkoutUrl: `https://mock-shop.test/cart/c/${c.id.split('/').pop()}`, totalQuantity: c.lines.reduce((a, l) => a + l.quantity, 0),
    cost: { subtotalAmount: money(c.lines.reduce((a, l) => a + l.quantity * parseFloat(variantsById[l.vid].v.price.amount), 0)) },
    lines: { nodes: c.lines.map((l) => { const { v, p } = variantsById[l.vid]; return { id: l.id, quantity: l.quantity, cost: { totalAmount: money(l.quantity * parseFloat(v.price.amount)) }, merchandise: { id: v.id, title: v.title, price: v.price, image: null, product: { handle: p.handle, title: p.title, vendor: p.vendor, featuredImage: null } } }; }) } });
  const state = { down: false };
  const mock = http.createServer((req, res) => {
    let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
      if (state.down) { res.statusCode = 503; return res.end('down'); }
      assert.equal(req.headers['x-shopify-storefront-access-token'], 'tok_test'); assert.match(req.url, /^\/api\/2025-07\/graphql\.json$/);
      const { query, variables } = JSON.parse(b); let data;
      const mk = (lines) => lines.map((l) => ({ id: `gid://shopify/CartLine/${++seq}`, vid: l.merchandiseId, quantity: l.quantity }));
      if (/query Catalog/.test(query)) data = { products: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: PRODUCTS } };
      else if (/mutation CartCreate/.test(query)) { const c = { id: `gid://shopify/Cart/c${++seq}`, lines: mk(variables.lines || []) }; carts[c.id] = c; data = { cartCreate: { cart: cartOut(c), userErrors: [] } }; }
      else if (/mutation CartLinesAdd/.test(query)) { const c = carts[variables.cartId]; if (!c) return res.end(JSON.stringify({ data: { cartLinesAdd: { cart: null, userErrors: [{ message: 'cart not found' }] } } })); const l = variables.lines[0]; const ex = c.lines.find((x) => x.vid === l.merchandiseId); if (ex) ex.quantity += l.quantity; else c.lines.push(...mk([l])); data = { cartLinesAdd: { cart: cartOut(c), userErrors: [] } }; }
      else if (/mutation CartLinesUpdate/.test(query)) { const c = carts[variables.cartId]; variables.lines.forEach((u) => { c.lines.find((x) => x.id === u.id).quantity = u.quantity; }); data = { cartLinesUpdate: { cart: cartOut(c), userErrors: [] } }; }
      else if (/mutation CartLinesRemove/.test(query)) { const c = carts[variables.cartId]; c.lines = c.lines.filter((x) => !variables.lineIds.includes(x.id)); data = { cartLinesRemove: { cart: cartOut(c), userErrors: [] } }; }
      else if (/query GetCart/.test(query)) data = { cart: carts[variables.id] ? cartOut(carts[variables.id]) : null };
      else { res.statusCode = 400; return res.end('{"errors":[{"message":"requête inconnue"}]}'); }
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ data }));
    });
  });
    mock.listen(MOCK);
  return { server: mock, state };
}
if (import.meta.url === `file://${process.argv[1]}`) { startSimulator(); console.log('Simulateur Shopify sur http://localhost:3928 (jeton : tok_test)'); }
