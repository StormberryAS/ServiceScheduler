import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/dates.js';
import '../src/rest.js';
import '../src/compliance.js';
const { parseISO } = globalThis.SB.dates;
const { expiringDocuments, availabilityOverview, expiryAlerts } = globalThis.SB.compliance;

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
test('availability overview lists only resting engineers (negative availability)', () => {
  const r = availabilityOverview([eng], asOf);
  assert.equal(r.length, 1);
  assert.ok(r[0].availability < 0);
});
test('expiryAlerts: document expiring 2027-10-31 yields alertDate 2026-10-31 with correct who and kind', () => {
  const engineer = {
    id: 'e2', name: 'Ingrid Solheim',
    passports: [{ country: 'Norway', number: 'NP999', expiry: '2027-10-31' }],
    visas: [], certs: [],
    availability: { lastOffshore: null, restDaysOverride: null, vacations: [] },
  };
  const alerts = expiryAlerts([engineer]);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].alertDate, '2026-10-31');
  assert.equal(alerts[0].who, 'Ingrid Solheim');
  assert.equal(alerts[0].kind, 'Passport');
});
