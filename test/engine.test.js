import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/dates.js';
import '../src/rest.js';
import '../src/eligibility.js';
import '../src/engine.js';
const { nextPick, filterKnownCerts } = globalThis.SB.engine;

const settings = { passportInvalidMonths:6, passportBufferMonths:12 };
const job = { equipment:'winch system', repairType:'corrective (breakdown) repair', country:'Norway',
  offshore:true, startDate:'2026-08-01', durationDays:7, requiredCerts:['offshore safety course'] };
const mk = (id, lastOffshore, level = 2) => ({
  id, name:id, nationalities:['Norway'], passports:[{country:'Norway',number:id,expiry:'2030-01-01'}],
  visas:[], certs:[{type:'offshore safety course',expiry:'2027-01-01'}],
  competence:[{equipment:'winch system',repairType:'corrective (breakdown) repair',level}],
  availability:{ lastOffshore, restDaysOverride:null, vacations:[] },
  assignments: [],
});

test('rested engineers rank above resting ones, exclusions captured, level present', () => {
  const rested = mk('rested', { end:'2026-06-01', durationDays:10 });     // complete well before job
  const resting = mk('resting', { end:'2026-07-28', durationDays:10 });   // complete 2026-08-07, after start
  const noskill = mk('noskill', null); noskill.competence = [];
  const r = nextPick(job, [resting, rested, noskill], settings);
  assert.deepEqual(r.shortlist.map((x) => x.id), ['rested', 'resting']);
  assert.equal(r.shortlist[0].overtime, false);
  assert.equal(r.shortlist[1].overtime, true);
  assert.ok(r.shortlist[0].availability >= 0);
  assert.ok(r.shortlist[1].availability < 0);
  assert.deepEqual(r.excluded, [{ id:'noskill', name:'noskill', failedRule:'no-competence' }]);
  // level field must be present on every shortlist row.
  assert.ok(r.shortlist.every((x) => typeof x.level === 'number'));
});
test('filterKnownCerts drops the phantom Offshore "on" value and unknown certs, dedupes', () => {
  const certTypes = ['offshore safety course', 'offshore medical certificate', 'BOSIET (OPITO)'];
  // The next-pick form collects checkbox values; the Offshore checkbox has no value attribute,
  // so the browser reports "on". It must not become a required certificate.
  assert.deepEqual(
    filterKnownCerts(['on', 'offshore safety course'], certTypes),
    ['offshore safety course'],
  );
  // No certificates ticked -> empty required list (so the job filters on nothing).
  assert.deepEqual(filterKnownCerts(['on'], certTypes), []);
  assert.deepEqual(filterKnownCerts([], certTypes), []);
  // Duplicates collapse to one.
  assert.deepEqual(filterKnownCerts(['BOSIET (OPITO)', 'BOSIET (OPITO)'], certTypes), ['BOSIET (OPITO)']);
});
test('higher competence level ranks first even when the other engineer is more available', () => {
  // 'junior' has no offshore history (availability 999) but level 1.
  // 'expert' just returned from a trip (availability < 999) but level 3.
  const junior = mk('junior', null, 1);
  const expert = mk('expert', { end:'2026-06-01', durationDays:10 }, 3);  // availability = positive, but < 999
  const r = nextPick(job, [junior, expert], settings);
  assert.deepEqual(r.shortlist.map((x) => x.id), ['expert', 'junior']);
  assert.equal(r.shortlist[0].level, 3);
  assert.equal(r.shortlist[1].level, 1);
});
