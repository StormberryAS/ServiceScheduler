import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/dates.js';
import '../src/rest.js';
import '../src/compliance.js';
const { parseISO } = globalThis.SB.dates;
const { expiringDocuments, restOverview } = globalThis.SB.compliance;

const asOf = parseISO('2026-06-22');
const eng = {
  id:'e1', name:'Ada', passports:[{country:'Norway',number:'N1',expiry:'2026-07-10'}], // ~18 days
  visas:[{country:'UK',expiry:'2026-08-15'}], // ~54 days
  certs:[{type:'first aid',expiry:'2026-09-15'}], // ~85 days
  availability:{ lastOffshore:{ end:'2026-06-20', durationDays:10 }, restDaysOverride:null, vacations:[] },
};

test('documents bucket by 30/60/90 days', () => {
  const b = expiringDocuments([eng], asOf);
  assert.equal(b.d30[0].kind, 'Passport');
  assert.equal(b.d60[0].kind, 'Visa');
  assert.equal(b.d90[0].kind, 'Certificate');
});
test('rest overview lists only resting engineers', () => {
  const r = restOverview([eng], asOf);
  assert.equal(r.length, 1);
  assert.ok(r[0].restDaysBank > 0);
});
