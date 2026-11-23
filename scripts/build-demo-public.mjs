// Construit la DÉMO PUBLIQUE : un site 100 % statique (aucun serveur Node requis), prêt pour Cloudflare Pages.
//   node scripts/build-demo-public.mjs            → DEMO-PUBLIC/ + LIVRAISON-DEMO/readyfile-demo-public.zip
// Principe : on copie UNIQUEMENT public/ (l'application) ; tout le reste du dépôt (growth/, tests/, docs/, scripts/,
// server.js, package.json, sauvegardes, notes…) n'est jamais copié. L'édition publique est activée par un attribut
// <html data-edition="public-demo"> (voir public/js/core/edition.js). Aucun réseau, aucune dépendance.
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SECURITY_HEADERS } from '../server.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FIXED_DATE = new Date('2026-01-01T00:00:00Z'); // dates fixes → build et ZIP reproductibles

/** En-têtes Cloudflare Pages (_headers) : mêmes règles de sécurité que le serveur local + durcissement + non-indexation. */
export function headersFile() {
  const csp = SECURITY_HEADERS['Content-Security-Policy'];
  return [
    '/*',
    `  Content-Security-Policy: ${csp}`,
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: no-referrer',
    '  X-Frame-Options: DENY',
    '  X-Robots-Tag: noindex, nofollow',
    '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    '  Cross-Origin-Opener-Policy: same-origin',
    '',
  ].join('\n');
}

export function publicIndexHtml(source) {
  const swaps = [
    ['<html lang="fr">', '<html lang="fr" data-edition="public-demo">'],
    ['<title>READYFILE AI — Prototype de démonstration</title>', '<title>READYFILE AI — Démonstration</title>'],
    [/<meta name="description" content="[^"]*">/, '<meta name="description" content="Démonstration publique de READYFILE AI (données fictives, analyse documentaire simulée) : suivi des pièces clients pour cabinets comptables.">\n  <meta name="robots" content="noindex, nofollow">'],
  ];
  let out = source;
  for (const [a, b] of swaps) {
    if (typeof a === 'string' ? !out.includes(a) : !a.test(out)) throw new Error(`index.html : motif introuvable (${a})`);
    out = out.replace(a, b);
  }
  return out;
}

function listFiles(dir, base = dir) {
  return readdirSync(dir).sort().flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? listFiles(p, base) : [p.slice(base.length + 1)];
  });
}

export function buildDemoPublic({ outDir = join(ROOT, 'DEMO-PUBLIC'), zipPath = null } = {}) {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  cpSync(join(ROOT, 'public', 'assets'), join(outDir, 'assets'), { recursive: true });
  cpSync(join(ROOT, 'public', 'js'), join(outDir, 'js'), { recursive: true });
  writeFileSync(join(outDir, 'index.html'), publicIndexHtml(readFileSync(join(ROOT, 'public', 'index.html'), 'utf8')));
  writeFileSync(join(outDir, '_headers'), headersFile());
  writeFileSync(join(outDir, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  const files = listFiles(outDir);
  for (const f of files) utimesSync(join(outDir, f), FIXED_DATE, FIXED_DATE);
  if (zipPath) {
    mkdirSync(dirname(zipPath), { recursive: true });
    rmSync(zipPath, { force: true });
    // les fichiers sont à la RACINE du ZIP (index.html à la racine), ordre trié → ZIP reproductible
    execFileSync('sh', ['-c', `cd "${outDir}" && find . -type f | LC_ALL=C sort | zip -X -q "${zipPath}" -@`], { env: { ...process.env, TZ: 'UTC' } });
  }
  return files;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const zip = join(ROOT, 'LIVRAISON-DEMO', 'readyfile-demo-public.zip');
  const files = buildDemoPublic({ zipPath: zip });
  console.log(`DEMO-PUBLIC : ${files.length} fichiers\nZIP : ${zip}`);
}
