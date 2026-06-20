import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/dates.js';
import '../src/rest.js';
import '../src/eligibility.js';
import '../src/engine.js';
const { nextPick } = globalThis.SB.engine;

const settings = { passportInvalidMonths:6, passportBufferMonths:12 };
const job = { equipment:'winch system', repairType:'corrective (breakdown) repair', country:'Norway',
  offshore:true, startDate:'2026-08-01', durationDays:7, requiredCerts:['offshore safety course'] };
const mk = (id, lastOffshore) => ({
  id, name:id, nationalities:['Norway'], passports:[{country:'Norway',number:id,expiry:'2030-01-01'}],
  visas:[], certs:[{type:'offshore safety course',expiry:'2027-01-01'}],
  competence:[{equipment:'winch system',repairType:'corrective (breakdown) repair',level:2}],
  availability:{ lastOffshore, restDaysOverride:null, vacations:[] },
});

test('rested engineers rank above resting ones, exclusions captured', () => {
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
});
