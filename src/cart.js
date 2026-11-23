import { db, settings } from './db.js';

export const parseImages = (p) => { try { return JSON.parse(p.images || '[]'); } catch { return []; } };

export function shippingFor(subtotal) {
  const s = settings();
  if (subtotal <= 0) return 0;
  const free = parseInt(s.free_shipping_cents, 10) || 0;
  if (free > 0 && subtotal >= free) return 0;
  return parseInt(s.shipping_flat_cents, 10) || 0;
}

/* Relit le panier de la session en vérifiant produits, prix et stocks côté serveur. */
export function cartInfo(ctx) {
  const cart = ctx.session.cart; const lines = []; const notices = []; let changed = false;
  for (const [idStr, qtyRaw] of Object.entries(cart)) {
    const p = db.prepare('SELECT * FROM products WHERE id=? AND active=1 AND deleted=0').get(Number(idStr));
    if (!p || p.stock <= 0) {
      delete cart[idStr]; changed = true;
      notices.push(p ? `« ${p.name} » n’est plus disponible.` : 'Un article n’est plus en vente.');
      continue;
    }
    let qty = Math.max(1, parseInt(qtyRaw, 10) || 1);
    if (qty > p.stock) { qty = p.stock; cart[idStr] = qty; changed = true; notices.push(`Stock limité pour « ${p.name} » : ${p.stock} disponible(s).`); }
    lines.push({ p, qty, total: p.price_cents * qty });
  }
  if (changed) ctx.touch();
  const subtotal = lines.reduce((a, l) => a + l.total, 0);
  const shipping = shippingFor(subtotal);
  const count = lines.reduce((a, l) => a + l.qty, 0);
  return { lines, subtotal, shipping, total: subtotal + shipping, count, notices };
}
export const cartCount = (ctx) => Object.values(ctx.session?.cart || {}).reduce((a, q) => a + (parseInt(q, 10) || 0), 0);
