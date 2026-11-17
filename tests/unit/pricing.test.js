import test from 'node:test';
import assert from 'node:assert/strict';
import { PLANS, toUsd, mrr, customersNeeded, TARGET_MRR_EUR } from '../../public/js/domain/pricing.js';

test('grille hypothétique : 49 / 99 / 199 €', () => {
  assert.deepEqual(PLANS.map((p) => [p.id, p.eur]), [['starter', 49], ['pro', 99], ['business', 199]]);
});
test('prix en dollars indicatifs', () => {
  assert.deepEqual(PLANS.map((p) => toUsd(p.eur)), [53, 107, 215]);
});
test('calculateur de revenus récurrents', () => {
  assert.equal(mrr({ starter: 45, pro: 50, business: 15 }), 45 * 49 + 50 * 99 + 15 * 199);
  assert.equal(mrr({ starter: -3, pro: 'abc', business: 1.9 }), 199);
  assert.equal(customersNeeded('pro'), 102);
  assert.equal(customersNeeded('business'), 51);
  assert.equal(TARGET_MRR_EUR, 10000);
});
