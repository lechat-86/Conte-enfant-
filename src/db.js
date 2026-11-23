import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { hashPassword, slugify } from './util.js';

export const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'shop.db'));
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer',
  first_name TEXT DEFAULT '', last_name TEXT DEFAULT '', phone TEXT DEFAULT '',
  address1 TEXT DEFAULT '', address2 TEXT DEFAULT '', postal_code TEXT DEFAULT '', city TEXT DEFAULT '', country TEXT DEFAULT 'France',
  reset_token TEXT, reset_expires INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  csrf TEXT NOT NULL, cart TEXT NOT NULL DEFAULT '{}', flash TEXT,
  created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  description TEXT DEFAULT '', position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  brand TEXT DEFAULT '', size TEXT DEFAULT '', sku TEXT DEFAULT '', supplier TEXT DEFAULT '',
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  short_desc TEXT DEFAULT '', description TEXT DEFAULT '',
  price_cents INTEGER NOT NULL, compare_cents INTEGER, cost_cents INTEGER NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0, low_stock INTEGER NOT NULL DEFAULT 3,
  images TEXT NOT NULL DEFAULT '[]', featured INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, deleted INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS stock_moves (
  id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL REFERENCES products(id),
  delta INTEGER NOT NULL, balance INTEGER NOT NULL, reason TEXT NOT NULL,
  order_id INTEGER, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT, number TEXT UNIQUE, token TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  email TEXT NOT NULL, first_name TEXT, last_name TEXT, phone TEXT,
  address1 TEXT, address2 TEXT, postal_code TEXT, city TEXT, country TEXT,
  subtotal_cents INTEGER NOT NULL, shipping_cents INTEGER NOT NULL, total_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  stripe_session_id TEXT, payment_intent TEXT,
  carrier TEXT DEFAULT '', tracking TEXT DEFAULT '', admin_note TEXT DEFAULT '',
  created_at INTEGER NOT NULL, paid_at INTEGER, shipped_at INTEGER
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id), name TEXT NOT NULL,
  unit_cents INTEGER NOT NULL, cost_cents INTEGER NOT NULL DEFAULT 0, qty INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, subject TEXT, body TEXT,
  handled INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_products_cat ON products(category_id);
`);

// Migration : bases créées avant l'ajout des « coups de cœur »
if (!db.prepare('PRAGMA table_info(products)').all().some((c) => c.name === 'featured')) {
  db.exec('ALTER TABLE products ADD COLUMN featured INTEGER NOT NULL DEFAULT 0');
}

export function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const r = fn(); db.exec('COMMIT'); return r; }
  catch (e) { try { db.exec('ROLLBACK'); } catch {} throw e; }
}

/* ---------- Réglages de la boutique (modifiables dans l'admin) ---------- */
export const SETTING_DEFAULTS = {
  shop_name: 'SHAÏ & GLOW',
  logo: '',
  announcement: 'Paiement 100 % sécurisé',
  contact_email: '', phone: '', instagram: '', tiktok: '',
  company_name: '', legal_form: '', siret: '', company_address: '', publication_director: '',
  vat_mode: 'franchise', vat_number: '',
  mediator: '',
  shipping_flat_cents: '490', free_shipping_cents: '4000', shipping_countries: 'France',
  carrier_name: '', prep_delay: '', delivery_delay: '',
  return_days: '14', return_address: '',
  hosting_info: '',
};
let cache = null;
export function settings() {
  if (!cache) {
    cache = { ...SETTING_DEFAULTS };
    for (const r of db.prepare('SELECT key, value FROM settings').all()) cache[r.key] = r.value;
  }
  return cache;
}
export function saveSettings(obj) {
  const st = db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  tx(() => { for (const [k, v] of Object.entries(obj)) if (k in SETTING_DEFAULTS) st.run(k, String(v ?? '')); });
  cache = null;
}

/* ---------- Stock (à appeler dans une transaction) ---------- */
export function adjustStock(productId, delta, reason, orderId = null) {
  const p = db.prepare('SELECT stock FROM products WHERE id=?').get(productId);
  if (!p) return null;
  const balance = p.stock + delta;
  db.prepare('UPDATE products SET stock=?, updated_at=? WHERE id=?').run(balance, Date.now(), productId);
  db.prepare('INSERT INTO stock_moves(product_id,delta,balance,reason,order_id,created_at) VALUES(?,?,?,?,?,?)')
    .run(productId, delta, balance, reason, orderId, Date.now());
  return balance;
}

/* ---------- Catégories officielles (appliquées une seule fois, ensuite modifiables dans l'admin) ---------- */
const OFFICIAL_CATEGORIES = [
  ['parfums', 'Parfums', 'Parfums et eaux de parfum.'],
  ['brumes', 'Brumes', 'Brumes pour le corps et les cheveux.'],
  ['parfums-de-maison', 'Parfums de maison', 'Parfumez votre intérieur.'],
  ['maquillage', 'Maquillage', 'Teint, yeux, lèvres : le maquillage du quotidien.'],
];
function ensureCategories() {
  if (db.prepare("SELECT 1 FROM settings WHERE key='categories_v2'").get()) return;
  tx(() => {
    // Ancienne catégorie « Brumes & Parfums » → « Brumes » (ses produits sont conservés)
    db.prepare("UPDATE categories SET slug='brumes' WHERE slug='brumes-parfums' AND NOT EXISTS (SELECT 1 FROM categories WHERE slug='brumes')").run();
    // Suppression de Soins visage / Soins corps (leurs produits éventuels passent « sans catégorie »)
    db.prepare("DELETE FROM categories WHERE slug IN ('soins-visage','soins-corps')").run();
    OFFICIAL_CATEGORIES.forEach(([slug, name, description], i) => {
      if (db.prepare('SELECT 1 FROM categories WHERE slug=?').get(slug)) db.prepare('UPDATE categories SET name=?, description=?, position=? WHERE slug=?').run(name, description, i, slug);
      else db.prepare('INSERT INTO categories(slug,name,description,position) VALUES(?,?,?,?)').run(slug, name, description, i);
    });
    db.prepare("INSERT INTO settings(key,value) VALUES('categories_v2','1')").run();
  });
}

/* ---------- Données de départ (une seule fois) ---------- */
function seed() {
  const now = Date.now();
  ensureCategories();
  if (!db.prepare('SELECT 1 FROM products LIMIT 1').get()) {
    const cat = db.prepare('SELECT id FROM categories WHERE slug=?').get('brumes');
    tx(() => {
      const r = db.prepare(`INSERT INTO products(slug,name,brand,size,category_id,short_desc,description,price_cents,cost_cents,stock,low_stock,featured,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,1,?,?)`).run(
        'brume-corps-et-cheveux-prady-monoi-tiare-250-ml',
        'Brume corps et cheveux Monoï Tiaré',
        'Prady', '250 ml', cat.id,
        'Brume parfumée pour le corps et les cheveux, senteur Monoï Tiaré.',
        'Brume parfumée pour le corps et les cheveux de la marque Prady, senteur Monoï Tiaré, en flacon de 250 ml.\n\nComposition, précautions d’emploi et allergènes : se reporter à l’emballage du produit.',
        490, 195, 0, 3, now, now);
      adjustStock(r.lastInsertRowid, 12, 'Stock initial (lot de 12 prévu — à ajuster à la réception)');
    });
  }
  // Compte administrateur
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const pw = process.env.ADMIN_PASSWORD || '';
  if (email && pw) {
    const u = db.prepare('SELECT id FROM users WHERE email=?').get(email);
    if (u) db.prepare("UPDATE users SET password_hash=?, role='admin' WHERE id=?").run(hashPassword(pw), u.id);
    else db.prepare("INSERT INTO users(email,password_hash,role,created_at) VALUES(?,?, 'admin', ?)").run(email, hashPassword(pw), now);
  } else if (!db.prepare("SELECT 1 FROM users WHERE role='admin'").get()) {
    const generated = Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8);
    db.prepare("INSERT INTO users(email,password_hash,role,created_at) VALUES(?,?, 'admin', ?)").run('admin@shai-glow.local', hashPassword(generated), now);
    console.log('\n⚠️  Aucun ADMIN_EMAIL / ADMIN_PASSWORD défini. Compte temporaire créé :');
    console.log(`    e-mail : admin@shai-glow.local   mot de passe : ${generated}`);
    console.log('    Définissez ADMIN_EMAIL et ADMIN_PASSWORD pour le remplacer.\n');
  }
}
seed();
