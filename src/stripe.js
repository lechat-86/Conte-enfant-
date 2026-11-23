import crypto from 'node:crypto';
import { safeEqual } from './util.js';

const base = () => process.env.STRIPE_API_BASE || 'https://api.stripe.com';
export const stripeEnabled = () => !!process.env.STRIPE_SECRET_KEY;

function flatten(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => (typeof x === 'object' ? flatten(x, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(x))));
    else if (typeof v === 'object') flatten(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

export async function stripeApi(method, path, params) {
  if (!stripeEnabled()) throw new Error('Stripe non configuré');
  const res = await fetch(base() + path, {
    method,
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: params ? flatten(params).toString() : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${data?.error?.message || 'erreur'}`);
  return data;
}

/* Vérifie l'en-tête Stripe-Signature (HMAC-SHA256 du corps brut, tolérance 5 minutes). */
export function verifyWebhook(rawBody, header, secret, tolerance = 300) {
  if (!secret || !header) return false;
  const parts = String(header).split(',').map((p) => p.trim().split('='));
  const t = parts.find(([k]) => k === 't')?.[1];
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - Number(t)) > tolerance) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${rawBody.toString('utf8')}`).digest('hex');
  return sigs.some((s) => safeEqual(s, expected));
}
