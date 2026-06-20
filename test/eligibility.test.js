// test/eligibility.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/dates.js';
import '../src/eligibility.js';
const { evaluate } = globalThis.SB.eligibility;

const settings = { passportInvalidMonths: 6, passportBufferMonths: 12 };
const baseJob = { equipment:'offshore crane', repairType:'preventive (scheduled) service',
  country:'United Kingdom', offshore:true, startDate:'2026-08-01', durationDays:10,
  requiredCerts:['offshore safety course'] };
const baseEng = () => ({
  id:'e1', name:'Test', nationalities:['Norway'],
  passports:[{ country:'Norway', number:'N1', expiry:'2030-01-01' }],
  visas:[{ country:'United Kingdom', expiry:'2027-01-01' }],
  certs:[{ type:'offshore safety course', expiry:'2027-01-01' }],
  competence:[{ equipment:'offshore crane', repairType:'preventive (scheduled) service', level:2 }],
  availability:{ lastOffshore:null, restDaysOverride:null, vacations:[] },
});

test('fully qualified engineer is eligible', () => {
  assert.deepEqual(evaluate(baseEng(), baseJob, settings), { eligible:true, failedRule:null, passportWarning:false });
});
test('missing competence fails first', () => {
  const e = baseEng(); e.competence = [];
  assert.equal(evaluate(e, baseJob, settings).failedRule, 'no-competence');
});
test('passport inside 6-month invalid window cannot travel', () => {
  const e = baseEng(); e.passports = [{ country:'Norway', number:'N1', expiry:'2026-09-01' }]; // <6mo past job end
  assert.equal(evaluate(e, baseJob, settings).failedRule, 'no-valid-passport');
});
test('no visa for destination fails', () => {
  const e = baseEng(); e.visas = [];
  assert.equal(evaluate(e, baseJob, settings).failedRule, 'needs-visa');
});
test('dual national needs no visa for own country', () => {
  const e = baseEng(); e.nationalities = ['Norway','United Kingdom']; e.visas = [];
  assert.equal(evaluate(e, baseJob, settings).eligible, true);
});
test('expired required cert fails', () => {
  const e = baseEng(); e.certs = [{ type:'offshore safety course', expiry:'2026-07-01' }];
  assert.equal(evaluate(e, baseJob, settings).failedRule, 'cert-missing-or-expired');
});
test('vacation overlapping job window fails', () => {
  const e = baseEng(); e.availability.vacations = [{ start:'2026-08-05', end:'2026-08-20' }];
  assert.equal(evaluate(e, baseJob, settings).failedRule, 'on-vacation');
});
test('passport warning when valid but inside 12-month buffer', () => {
  const e = baseEng(); e.passports = [{ country:'Norway', number:'N1', expiry:'2027-03-01' }]; // >6mo, <12mo past job end
  const r = evaluate(e, baseJob, settings);
  assert.equal(r.eligible, true); assert.equal(r.passportWarning, true);
});
test('offshore job without explicit offshore safety course cert fails', () => {
  const job = { ...baseJob, offshore: true, requiredCerts: [] };
  const e = baseEng(); e.certs = []; // no offshore safety course
  assert.deepEqual(evaluate(e, job, settings), { eligible: false, failedRule: 'cert-missing-or-expired', passportWarning: false });
});
test('onshore job without offshore safety course cert passes', () => {
  const job = { ...baseJob, offshore: false, country: 'Norway', requiredCerts: [] };
  const e = baseEng(); e.certs = []; // no offshore safety course, not required onshore
  assert.deepEqual(evaluate(e, job, settings), { eligible: true, failedRule: null, passportWarning: false });
});
