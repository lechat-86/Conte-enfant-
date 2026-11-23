import { db, tx, adjustStock } from './db.js';
import { mailOrderConfirmation, mailOwnerNewOrder } from './mail.js';

export const STATUS = {
  pending: ['En attente de paiement', 'st-pending'], paid: ['Payée — à préparer', 'st-paid'], shipped: ['Expédiée', 'st-shipped'],
  delivered: ['Livrée', 'st-delivered'], cancelled: ['Annulée', 'st-cancelled'], refunded: ['Remboursée', 'st-refunded'],
};
export const orderItems = (id) => db.prepare('SELECT * FROM order_items WHERE order_id=?').all(id);

/* Paiement confirmé (webhook Stripe OU page de retour) — idempotent. */
export function markPaid(orderId, paymentIntent, siteUrl) {
  const result = tx(() => {
    const o = db.prepare('SELECT * FROM orders WHERE id=?').get(orderId);
    if (!o || o.status === 'paid' || o.status === 'shipped' || o.status === 'delivered' || o.status === 'refunded') return null;
    let note = o.admin_note || '';
    if (o.status === 'cancelled') { // paiement arrivé après l'expiration : on re-prélève le stock
      for (const it of orderItems(o.id)) {
        if (!it.product_id) continue;
        const bal = adjustStock(it.product_id, -it.qty, `Commande ${o.number} (paiement tardif)`, o.id);
        if (bal !== null && bal < 0) note += `\n⚠ Stock insuffisant pour « ${it.name} » (solde ${bal}). Vérifiez ou remboursez.`;
      }
    }
    db.prepare("UPDATE orders SET status='paid', paid_at=?, payment_intent=COALESCE(?,payment_intent), admin_note=? WHERE id=?").run(Date.now(), paymentIntent || null, note.trim(), o.id);
    return db.prepare('SELECT * FROM orders WHERE id=?').get(o.id);
  });
  if (result) {
    const items = orderItems(result.id);
    mailOrderConfirmation(result, items, siteUrl); mailOwnerNewOrder(result, items, siteUrl);
  }
  return result;
}

/* Annule une commande non payée et remet le stock réservé. */
export function cancelPending(orderId, reason = 'Paiement non abouti') {
  return tx(() => {
    const o = db.prepare("SELECT * FROM orders WHERE id=? AND status='pending'").get(orderId);
    if (!o) return false;
    for (const it of orderItems(o.id)) if (it.product_id) adjustStock(it.product_id, it.qty, `Commande ${o.number} annulée (${reason})`, o.id);
    db.prepare("UPDATE orders SET status='cancelled' WHERE id=?").run(o.id);
    return true;
  });
}

/* Libère les réservations des paiements jamais finalisés (> 45 min). */
export function expireStaleOrders() {
  const old = db.prepare("SELECT id FROM orders WHERE status='pending' AND created_at < ?").all(Date.now() - 45 * 60e3);
  old.forEach((o) => cancelPending(o.id, 'expirée'));
}
