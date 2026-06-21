import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/dates.js';
import '../src/rest.js';
import '../src/eligibility.js';
import '../src/engine.js';
import '../src/demo.js';
const { settings, engineers } = globalThis.SB.demo;

test('exactly 18 synthetic engineers with required edge cases', () => {
  const es = engineers();
  assert.equal(es.length, 18);
  // a dual-national exists
  assert.ok(es.some((e) => e.nationalities.length >= 2));
  // someone holds more than one passport
  assert.ok(es.some((e) => e.passports.length >= 2));
  // at least one is currently resting (has offshore history)
  assert.ok(es.some((e) => e.availability.lastOffshore));
  // at least one has a vacation booked
  assert.ok(es.some((e) => (e.availability.vacations || []).length > 0));
  // at least one engineer has an assignment (double-booking coverage)
  assert.ok(es.some((e) => (e.assignments || []).length > 0));
  // settings includes offshoreRequiredCerts
  assert.ok(Array.isArray(settings().offshoreRequiredCerts));
  assert.ok(settings().offshoreRequiredCerts.includes('offshore medical certificate'));
});
test('a representative job yields both shortlist and exclusions', () => {
  const job = { title:'Crane service Aberdeen', equipment:'offshore crane',
    repairType:'preventive (scheduled) service', country:'United Kingdom', offshore:true,
    startDate:'2026-08-01', durationDays:10, requiredCerts:['offshore safety course'] };
  const r = globalThis.SB.engine.nextPick(job, engineers(), settings());
  assert.ok(r.shortlist.length >= 1);
  assert.ok(r.excluded.length >= 1);
});
