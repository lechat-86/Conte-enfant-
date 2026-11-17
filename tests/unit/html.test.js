import test from 'node:test';
import assert from 'node:assert/strict';
import { h, str, raw, esc } from '../../public/js/core/html.js';

test('échappement automatique des valeurs injectées (XSS)', () => {
  const evil = '<img src=x onerror="alert(1)">"\'&';
  const out = str(h`<p title="${evil}">${evil}</p>`);
  assert.ok(!out.includes('<img'));
  assert.ok(!out.includes('onerror="'));
  assert.match(out, /&lt;img/);
});

test('fragments imbriqués et tableaux ne sont pas double-échappés', () => {
  assert.equal(str(h`<ul>${['a', 'b'].map((x) => h`<li>${x}</li>`)}</ul>`), '<ul><li>a</li><li>b</li></ul>');
  assert.equal(str(h`${raw('<b>ok</b>')}`), '<b>ok</b>');
  assert.equal(str(h`${null}${false}${undefined}`), '');
  assert.equal(esc('<&>'), '&lt;&amp;&gt;');
});
