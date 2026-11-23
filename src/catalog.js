/* Accès au catalogue : base locale (par défaut) OU Shopify (si configuré). Mêmes données, même design. */
import { db } from './db.js';
import { shopifyOn, allShopifyProducts } from './shopify.js';

const SORTS = {
  nouveautes: (a, b) => b.created_at - a.created_at,
  'prix-asc': (a, b) => a.price_cents - b.price_cents,
  'prix-desc': (a, b) => b.price_cents - a.price_cents,
};
const SQL_SORT = { nouveautes: 'created_at DESC', 'prix-asc': 'price_cents ASC', 'prix-desc': 'price_cents DESC' };

/* { cat: slug de catégorie, featured: bool, q: texte, sort, page, perPage } → { items, total } */
export async function listProducts({ cat = '', featured = false, q = '', sort = 'nouveautes', page = 1, perPage = 12 } = {}) {
  if (shopifyOn()) {
    let items = await allShopifyProducts();
    if (cat) items = items.filter((p) => p.collections.includes(cat));
    if (featured) items = items.filter((p) => p.featured);
    if (q) { const n = q.toLowerCase(); items = items.filter((p) => `${p.name} ${p.brand} ${p.short_desc}`.toLowerCase().includes(n)); }
    items = [...items].sort((a, b) => (b.stock > 0) - (a.stock > 0) || (SORTS[sort] || SORTS.nouveautes)(a, b));
    return { total: items.length, items: items.slice((page - 1) * perPage, page * perPage) };
  }
  const where = ['active=1', 'deleted=0']; const params = [];
  if (cat) { where.push('category_id=(SELECT id FROM categories WHERE slug=?)'); params.push(cat); }
  if (featured) where.push('featured=1');
  if (q) { const like = `%${q.replace(/[%_\\]/g, '\\$&')}%`; where.push(`(name LIKE ? ESCAPE '\\' OR brand LIKE ? ESCAPE '\\' OR short_desc LIKE ? ESCAPE '\\')`); params.push(like, like, like); }
  const base = `FROM products WHERE ${where.join(' AND ')}`;
  const total = db.prepare(`SELECT COUNT(*) c ${base}`).get(...params).c;
  const items = db.prepare(`SELECT * ${base} ORDER BY (stock>0) DESC, ${SQL_SORT[sort] || SQL_SORT.nouveautes} LIMIT ? OFFSET ?`).all(...params, perPage, (page - 1) * perPage);
  return { total, items };
}

export async function getProduct(slug) {
  if (shopifyOn()) return (await allShopifyProducts()).find((p) => p.slug === slug) || null;
  return db.prepare('SELECT p.*, c.name cat_name, c.slug cat_slug FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.slug=? AND p.active=1 AND p.deleted=0').get(slug) || null;
}

export async function relatedProducts(p) {
  if (!p.cat_slug) return [];
  const { items } = await listProducts({ cat: p.cat_slug, perPage: 8 });
  return items.filter((r) => r.slug !== p.slug && r.stock > 0).slice(0, 4);
}

export async function allProductSlugs() { return (await listProducts({ perPage: 1000 })).items.map((p) => p.slug); }
