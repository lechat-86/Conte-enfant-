import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

// Chargement minimal d'un fichier .env (sans dépendance)
try {
  for (const line of fs.readFileSync(path.resolve('.env'), 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const { handle } = await import('./src/core.js');
const { notFound, errorPage, forbidden } = await import('./src/pages.js'); // enregistre aussi toutes les routes
await import('./src/account.js');
await import('./src/checkout.js');
await import('./src/admin.js');

const port = Number(process.env.PORT || 3000);
const server = http.createServer((req, res) => handle(req, res, { notFound, errorPage, forbidden }));
server.listen(port, () => console.log(`SHAÏ & GLOW prêt sur http://localhost:${port}`));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
