import { settings } from './db.js';
import { html, esc, eur, fmtDate } from './util.js';

/* Envoi via l'API Resend (https://resend.com). Sans clé, le message est seulement écrit dans les logs. */
export async function sendMail({ to, subject, body }) {
  const key = process.env.RESEND_API_KEY; const from = process.env.MAIL_FROM;
  const doc = String(wrap(subject, body));
  if (!key || !from) { console.log(`[e-mail non configuré] à: ${to} — ${subject}`); return false; }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html: doc }),
    });
    if (!r.ok) { console.error('Erreur e-mail', r.status, await r.text()); return false; }
    return true;
  } catch (e) { console.error('Erreur e-mail', e.message); return false; }
}

function wrap(title, body) {
  const s = settings();
  return html`<!doctype html><html lang="fr"><body style="margin:0;background:#faf3f0;font-family:Arial,Helvetica,sans-serif;color:#3b2b2d">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <p style="text-align:center;font-family:Georgia,serif;font-size:26px;letter-spacing:3px;color:#9c5560;margin:8px 0 20px">${s.shop_name}</p>
    <div style="background:#fff;border-radius:12px;padding:24px;line-height:1.55;font-size:15px">${body}</div>
    <p style="text-align:center;font-size:12px;color:#8a7774;margin-top:16px">${s.shop_name}${s.contact_email ? ' · ' + s.contact_email : ''}</p>
  </div></body></html>`;
}

const itemsTable = (items) => html`<table style="width:100%;border-collapse:collapse;font-size:14px">${items.map((i) =>
  html`<tr><td style="padding:6px 0;border-bottom:1px solid #f0e3df">${i.qty} × ${i.name}</td><td style="padding:6px 0;border-bottom:1px solid #f0e3df;text-align:right">${eur(i.unit_cents * i.qty)}</td></tr>`)}</table>`;

export function mailOrderConfirmation(order, items, siteUrl) {
  return sendMail({
    to: order.email, subject: `Votre commande ${order.number} est confirmée`,
    body: html`<h2 style="font-family:Georgia,serif;font-weight:500;margin-top:0">Merci ${order.first_name} ✨</h2>
      <p>Nous avons bien reçu votre paiement. Votre commande <b>${order.number}</b> va être préparée avec soin.</p>
      ${itemsTable(items)}
      <p style="text-align:right">Livraison : ${eur(order.shipping_cents)}<br><b>Total : ${eur(order.total_cents)}</b></p>
      <p style="font-size:13px;color:#6f5c5a">Livraison à : ${order.first_name} ${order.last_name}, ${order.address1}${order.address2 ? ', ' + order.address2 : ''}, ${order.postal_code} ${order.city}, ${order.country}</p>
      <p>Vous recevrez un e-mail dès l’expédition. <a href="${siteUrl}/compte">Suivre mes commandes</a></p>`,
  });
}
export function mailOwnerNewOrder(order, items, siteUrl) {
  const to = settings().contact_email || process.env.ADMIN_EMAIL;
  if (!to) return false;
  return sendMail({
    to, subject: `Nouvelle commande ${order.number} — ${eur(order.total_cents)}`,
    body: html`<h2 style="font-family:Georgia,serif;font-weight:500;margin-top:0">Nouvelle commande payée 🎉</h2>
      <p><b>${order.number}</b> · ${fmtDate(order.paid_at)}<br>${order.first_name} ${order.last_name} — ${order.email}</p>
      ${itemsTable(items)}<p style="text-align:right"><b>Total : ${eur(order.total_cents)}</b></p>
      <p><a href="${siteUrl}/admin/commandes/${order.id}">Ouvrir la commande à préparer</a></p>`,
  });
}
export function mailShipped(order, siteUrl) {
  return sendMail({
    to: order.email, subject: `Votre commande ${order.number} est expédiée`,
    body: html`<h2 style="font-family:Georgia,serif;font-weight:500;margin-top:0">Votre colis est en route 📦</h2>
      <p>Bonne nouvelle ${order.first_name}, votre commande <b>${order.number}</b> a été expédiée.</p>
      ${order.carrier || order.tracking ? html`<p>Transporteur : <b>${order.carrier || '—'}</b><br>Numéro de suivi : <b>${order.tracking || '—'}</b></p>` : ''}
      <p><a href="${siteUrl}/compte">Voir mes commandes</a></p>`,
  });
}
export function mailReset(user, link) {
  return sendMail({
    to: user.email, subject: 'Réinitialisation de votre mot de passe',
    body: html`<h2 style="font-family:Georgia,serif;font-weight:500;margin-top:0">Nouveau mot de passe</h2>
      <p>Pour choisir un nouveau mot de passe, cliquez ici (lien valable 1 heure) :</p>
      <p><a href="${link}">${link}</a></p><p style="font-size:13px;color:#6f5c5a">Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.</p>`,
  });
}
export function mailContact(msg) {
  const to = settings().contact_email || process.env.ADMIN_EMAIL;
  if (!to) return false;
  return sendMail({
    to, subject: `Message de ${msg.name} : ${msg.subject || 'Contact'}`,
    body: html`<p><b>${msg.name}</b> (${msg.email})</p><p>${raw2(msg.body)}</p>`,
  });
}
const raw2 = (s) => html`${String(s).split(/\r?\n/).map((l) => html`${l}<br>`)}`;
export { esc };
