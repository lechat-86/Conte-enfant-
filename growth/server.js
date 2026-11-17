// READYFILE GROWTH — serveur local INTERNE (distinct du serveur de READYFILE AI).
// - Écoute uniquement sur 127.0.0.1, port distinct (défaut 5174) → origine et stockage navigateur séparés.
// - Contrôle de l'en-tête Host (anti « DNS rebinding ») ; GET/HEAD uniquement.
// - Sert growth/public + une LISTE BLANCHE de 4 fichiers de présentation de READYFILE AI (/shared/…).
// - CSP : aucune connexion sortante possible (connect-src 'none'), aucun formulaire (form-action 'none').
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(HERE, 'public');
const MAIN_PUBLIC = resolve(HERE, '../public');
export const PORT = Number(process.env.GROWTH_PORT || 5174);
const HOST = '127.0.0.1';

// Fichiers du produit réutilisés pour la cohérence visuelle (lecture seule, liste blanche stricte).
export const SHARED = {
  '/shared/assets/styles.css': 'assets/styles.css',
  '/shared/assets/favicon.svg': 'assets/favicon.svg',
  '/shared/js/core/html.js': 'js/core/html.js',
  '/shared/js/ui/icons.js': 'js/ui/icons.js',
};

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8' };

const HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
};

export function hostAllowed(hostHeader, localPort) {
  return hostHeader === `127.0.0.1:${localPort}` || hostHeader === `localhost:${localPort}`;
}

export function createGrowthServer() {
  return http.createServer(async (req, res) => {
    const deny = (code, msg) => res.writeHead(code, HEADERS).end(msg);
    try {
      if (!hostAllowed(req.headers.host, req.socket.localPort)) return deny(403, 'Forbidden host');
      if (req.method !== 'GET' && req.method !== 'HEAD') return deny(405, 'Method not allowed');
      const url = new URL(req.url, `http://${HOST}`);
      let rel = decodeURIComponent(url.pathname);
      let file;
      if (rel.startsWith('/shared/')) {
        if (!(rel in SHARED)) return deny(404, 'Not found');
        file = join(MAIN_PUBLIC, SHARED[rel]);
      } else {
        if (rel.endsWith('/')) rel += 'index.html';
        file = normalize(join(ROOT, rel));
        if (!file.startsWith(ROOT)) return deny(403, 'Forbidden');
      }
      const body = await readFile(file);
      res.writeHead(200, { ...HEADERS, 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      deny(404, 'Not found');
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createGrowthServer().listen(PORT, HOST, () => {
    console.log(`READYFILE GROWTH (outil INTERNE, confidentiel) → http://${HOST}:${PORT}`);
    console.log('Local uniquement · aucun envoi · aucune connexion sortante. Ctrl+C pour arrêter.');
  });
}
