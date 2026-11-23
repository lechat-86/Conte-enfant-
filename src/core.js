import fs from 'node:fs';
import path from 'node:path';
import { db, UPLOAD_DIR } from './db.js';
import { parseCookies, serializeCookie, randomToken, sha256, safeEqual, rateLimited } from './util.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const PUBLIC_DIR = path.join(ROOT, 'public');

/* ---------- Routeur minimal ---------- */
export const routes = [];
export function route(method, pattern, handler, opts = {}) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:([a-z_]+)/gi, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  routes.push({ method, re, keys, handler, ...opts });
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json',
};

export function siteUrl(ctx) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, '');
  const proto = ctx.req.headers['x-forwarded-proto'] || 'http';
  return `${proto}://${ctx.req.headers.host}`;
}
const isSecure = (req) => (req.headers['x-forwarded-proto'] || '') === 'https' || /^https:/.test(process.env.SITE_URL || '');
export const clientIp = (req) => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

/* ---------- Fichiers statiques ---------- */
function serveStatic(ctx, base, rel, { cache, upload } = {}) {
  const file = path.resolve(base, '.' + path.sep + rel);
  if (!file.startsWith(base + path.sep)) return false;
  let st; try { st = fs.statSync(file); } catch { return false; }
  if (!st.isFile()) return false;
  const headers = {
    'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Content-Length': st.size, 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff',
  };
  if (upload) headers['Content-Security-Policy'] = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
  ctx.res.writeHead(200, headers);
  if (ctx.req.method === 'HEAD') return ctx.res.end(), true;
  fs.createReadStream(file).pipe(ctx.res);
  return true;
}

/* ---------- Session (panier, jeton CSRF, connexion) ---------- */
function loadSession(ctx) {
  const sid = parseCookies(ctx.req.headers.cookie).sg_sid;
  let row = sid && db.prepare('SELECT * FROM sessions WHERE id=?').get(sha256(sid));
  const now = Date.now();
  if (row && now - row.last_seen > 30 * 864e5) { db.prepare('DELETE FROM sessions WHERE id=?').run(row.id); row = null; }
  ctx.newSid = null;
  if (!row) {
    ctx.newSid = randomToken(32);
    row = { id: sha256(ctx.newSid), user_id: null, csrf: randomToken(16), cart: '{}', flash: null, created_at: now, last_seen: now, fresh: true };
  }
  ctx.session = {
    id: row.id, userId: row.user_id, csrf: row.csrf, fresh: !!row.fresh,
    cart: JSON.parse(row.cart || '{}'), flash: row.flash ? JSON.parse(row.flash) : null, dirty: !!row.fresh,
  };
  ctx.user = ctx.session.userId ? db.prepare('SELECT * FROM users WHERE id=?').get(ctx.session.userId) : null;
  if (ctx.session.userId && !ctx.user) ctx.session.userId = null;
}
function persistSession(ctx) {
  const s = ctx.session; if (!s) return;
  if (s.fresh && !s.dirty) return; // pas de cookie pour les robots qui ne touchent à rien
  const now = Date.now();
  if (s.fresh) {
    db.prepare('INSERT INTO sessions(id,user_id,csrf,cart,flash,created_at,last_seen) VALUES(?,?,?,?,?,?,?)')
      .run(s.id, s.userId, s.csrf, JSON.stringify(s.cart), s.flash ? JSON.stringify(s.flash) : null, now, now);
    s.fresh = false;
  } else {
    db.prepare('UPDATE sessions SET user_id=?, cart=?, flash=?, last_seen=? WHERE id=?')
      .run(s.userId, JSON.stringify(s.cart), s.flash ? JSON.stringify(s.flash) : null, now, s.id);
  }
}
export function login(ctx, user) {
  // nouvelle session à chaque connexion (anti fixation) en conservant le panier
  db.prepare('DELETE FROM sessions WHERE id=?').run(ctx.session.id);
  ctx.newSid = randomToken(32);
  ctx.session.id = sha256(ctx.newSid); ctx.session.fresh = true; ctx.session.dirty = true;
  ctx.session.csrf = randomToken(16); ctx.session.userId = user.id; ctx.user = user;
}
export function logout(ctx) {
  db.prepare('DELETE FROM sessions WHERE id=?').run(ctx.session.id);
  ctx.newSid = randomToken(32);
  Object.assign(ctx.session, { id: sha256(ctx.newSid), fresh: true, dirty: true, userId: null, csrf: randomToken(16), cart: {}, flash: null });
  ctx.user = null;
}

/* ---------- Lecture du corps de requête ---------- */
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(Object.assign(new Error('Corps trop volumineux'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://checkout.stripe.com",
};

function makeCtx(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const ctx = { req, res, url, path: url.pathname, query: Object.fromEntries(url.searchParams), method: req.method, params: {}, body: {}, rawBody: null };
  const send = (status, type, body, extra = {}) => {
    if (ctx.sent) return; ctx.sent = true;
    persistSession(ctx);
    const headers = { ...SECURITY_HEADERS, 'Content-Type': type, 'Cache-Control': 'no-store', ...extra };
    if (ctx.newSid) headers['Set-Cookie'] = serializeCookie('sg_sid', ctx.newSid, { maxAge: 30 * 86400, secure: isSecure(req) });
    res.writeHead(status, headers);
    res.end(req.method === 'HEAD' ? undefined : body);
  };
  ctx.html = (body, status = 200) => send(status, 'text/html; charset=utf-8', String(body));
  ctx.json = (obj, status = 200) => send(status, 'application/json; charset=utf-8', JSON.stringify(obj));
  ctx.text = (s, status = 200, type = 'text/plain; charset=utf-8') => send(status, type, s);
  ctx.redirect = (to, status = 303) => send(status, 'text/plain', '', { Location: to });
  ctx.flash = (type, msg) => { ctx.session.flash = { type, msg }; ctx.session.dirty = true; };
  ctx.touch = () => { ctx.session.dirty = true; };
  ctx.form = (key) => String(ctx.body[key] ?? '').trim();
  return ctx;
}

export async function handle(req, res, { notFound, errorPage, forbidden }) {
  const ctx = makeCtx(req, res);
  try {
    if (req.method === 'GET' || req.method === 'HEAD') {
      if (ctx.path.startsWith('/uploads/')) { if (serveStatic(ctx, UPLOAD_DIR, decodeURIComponent(ctx.path.slice(9)), { cache: 'public, max-age=31536000, immutable', upload: true })) return; }
      else if (ctx.path !== '/' && serveStatic(ctx, PUBLIC_DIR, decodeURIComponent(ctx.path.slice(1)), { cache: ctx.query.v ? 'public, max-age=31536000, immutable' : 'public, max-age=3600' })) return;
    }
    let match = null; let methodMismatch = false;
    for (const r of routes) {
      const m = r.re.exec(ctx.path);
      if (!m) continue;
      if (r.method !== req.method && !(r.method === 'GET' && req.method === 'HEAD')) { methodMismatch = true; continue; }
      match = { r, m }; break;
    }
    if (!match) { loadSession(ctx); return methodMismatch ? ctx.text('Méthode non autorisée', 405) : notFound(ctx); }
    const { r, m } = match;
    r.keys.forEach((k, i) => { ctx.params[k] = decodeURIComponent(m[i + 1]); });
    if (req.method === 'POST') {
      const buf = await readBody(req, r.limit || 256 * 1024);
      ctx.rawBody = buf;
      const ct = String(req.headers['content-type'] || '');
      if (ct.includes('application/json')) { try { ctx.body = JSON.parse(buf.toString('utf8') || '{}'); } catch { ctx.body = {}; } }
      else if (ct.includes('application/x-www-form-urlencoded')) ctx.body = Object.fromEntries(new URLSearchParams(buf.toString('utf8')));
    }
    loadSession(ctx);
    if (req.method === 'POST' && !r.noCsrf) {
      const token = ctx.body._csrf || req.headers['x-csrf-token'] || '';
      if (!safeEqual(token, ctx.session.csrf)) return forbidden(ctx);
    }
    await r.handler(ctx);
    if (!ctx.sent) notFound(ctx);
  } catch (e) {
    if (e.status === 413) return ctx.text('Fichier trop volumineux', 413);
    console.error(e);
    if (!ctx.sent) { try { if (!ctx.session) loadSession(ctx); } catch {} errorPage(ctx); }
  }
}

export const tooMany = (ctx, key, max = 10, windowMs = 10 * 60e3) => rateLimited(`${key}:${clientIp(ctx.req)}`, max, windowMs);
