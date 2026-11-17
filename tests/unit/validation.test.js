import test from 'node:test';
import assert from 'node:assert/strict';
import { validateClient, validateDossier, validateSettings } from '../../public/js/domain/validation.js';

const good = { company: 'Test SARL', contact: 'Ada Test', email: 'ada@test.example', country: 'FR', language: 'fr' };

test('client valide', () => {
  const r = validateClient({ ...good, company: '  Test SARL  ' });
  assert.ok(r.ok);
  assert.equal(r.value.company, 'Test SARL');
});

test('client invalide : champs requis, email, longueur, langue', () => {
  const r = validateClient({ company: 'A', contact: '', email: 'pas-un-email', country: '', language: 'de' });
  assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r.errors).sort(), ['company', 'contact', 'country', 'email', 'language']);
  assert.equal(validateClient({ ...good, email: '' }).errors.email, 'err.required');
  assert.equal(validateClient({ ...good, email: 'a@b' }).errors.email, 'err.email');
  assert.equal(validateClient({ ...good, company: 'x'.repeat(81) }).errors.company, 'err.too_long');
});

test('dossier : client existant, modèle, période', () => {
  const clients = [{ id: 'CLI-001' }];
  assert.ok(validateDossier({ clientId: 'CLI-001', template: 'onboarding', period: '2026-10' }, clients).ok);
  assert.equal(validateDossier({ clientId: '', template: 'onboarding', period: '2026-10' }, clients).errors.clientId, 'err.required');
  assert.equal(validateDossier({ clientId: 'CLI-999', template: 'onboarding', period: '2026-10' }, clients).errors.clientId, 'err.invalid');
  assert.equal(validateDossier({ clientId: 'CLI-001', template: 'zzz', period: '2026-10' }, clients).errors.template, 'err.required');
  assert.equal(validateDossier({ clientId: 'CLI-001', template: 'onboarding', period: '2026-13' }, clients).errors.period, 'err.period');
  assert.equal(validateDossier({ clientId: 'CLI-001', template: 'onboarding', period: '' }, clients).errors.period, 'err.required');
});

test('paramètres : conservation entre 30 et 3650 jours', () => {
  assert.ok(validateSettings({ firmName: 'Cabinet', retentionDays: '365' }).ok);
  for (const bad of ['29', '3651', 'abc', '12.5', '']) assert.equal(validateSettings({ firmName: 'Cabinet', retentionDays: bad }).errors.retentionDays, 'err.retention');
  assert.equal(validateSettings({ firmName: '', retentionDays: 90 }).errors.firmName, 'err.required_min2');
});
