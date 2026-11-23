// Sauvegarde complète des données : copie cohérente de la base + photos → backups/sauvegarde-AAAA-MM-JJ-HHMM.tar.gz
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

const data = path.resolve(process.env.DATA_DIR || './data');
if (!fs.existsSync(path.join(data, 'shop.db'))) { console.error('Aucune base trouvée dans', data); process.exit(1); }
const stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
const out = path.resolve('backups'); const tmp = path.join(out, `tmp-${stamp}`);
fs.mkdirSync(path.join(tmp, 'data'), { recursive: true });
const db = new DatabaseSync(path.join(data, 'shop.db'));
db.exec(`VACUUM INTO '${path.join(tmp, 'data', 'shop.db').replace(/'/g, "''")}'`); db.close();
if (fs.existsSync(path.join(data, 'uploads'))) fs.cpSync(path.join(data, 'uploads'), path.join(tmp, 'data', 'uploads'), { recursive: true });
const file = path.join(out, `sauvegarde-${stamp}.tar.gz`);
execFileSync('tar', ['-czf', file, '-C', tmp, 'data']);
fs.rmSync(tmp, { recursive: true, force: true });
console.log('Sauvegarde créée :', file);
