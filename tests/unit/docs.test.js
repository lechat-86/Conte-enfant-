import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const BILINGUAL = ['POSITIONING', 'SALES_DEMO', 'CUSTOMER_INTERVIEW', 'OBJECTIONS', 'COMPETITORS', 'VALIDATION_SCORECARD', 'PRICING_TEST'];

for (const name of BILINGUAL) {
  test(`docs/${name}.md existe, en français ET en anglais`, () => {
    const f = `docs/${name}.md`;
    assert.ok(existsSync(f), `${f} manquant`);
    const s = readFileSync(f, 'utf8');
    assert.match(s, /^## 🇫🇷 Français/m);
    assert.match(s, /^## 🇬🇧 English/m);
    assert.ok(s.indexOf('## 🇫🇷') < s.indexOf('## 🇬🇧'));
    assert.ok(s.length > 2500, 'document trop court');
  });
}

test('documents commerciaux : aucun faux témoignage, client ou résultat chiffré revendiqué', () => {
  for (const name of [...BILINGUAL, 'AUDIT']) {
    const s = readFileSync(`docs/${name}.md`, 'utf8');
    // ces expressions ne peuvent apparaître que dans une règle « à ne pas dire »
    for (const re of [/ils nous font confiance/i, /trusted by/i, /nos clients (disent|témoignent)/i, /our customers say/i]) {
      for (const line of s.split('\n').filter((l) => re.test(l))) assert.match(line, /ne (pas|jamais)|not|never|❌|Avoid|Éviter/i, `${name}: ${line}`);
    }
  }
});

test('l\'audit documente les constats et les corrections', () => {
  const s = readFileSync('docs/AUDIT.md', 'utf8');
  for (const id of ['A1', 'A2', 'A3', 'A4']) assert.match(s, new RegExp(`\\| ${id} \\|`));
  assert.match(s, /Corrigé/);
});
