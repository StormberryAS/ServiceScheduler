import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/dates.js';
import '../src/rest.js';
const { parseISO } = globalThis.SB.dates;
const { restDays, restCompleteDate, restDaysBank } = globalThis.SB.rest;

const eng = (lastOffshore, override=null) => ({ availability: { lastOffshore, restDaysOverride: override, vacations: [] } });

test('rest defaults to previous trip length', () => {
  assert.equal(restDays(eng({ end:'2026-06-01', durationDays:21 })), 21);
});
test('override wins', () => {
  assert.equal(restDays(eng({ end:'2026-06-01', durationDays:21 }, 14)), 14);
});
test('no offshore history means zero rest', () => {
  assert.equal(restDays(eng(null)), 0);
});
test('bank counts remaining rest days at reference date', () => {
  // trip ended 2026-06-01, 21 days rest -> complete 2026-06-22
  const e = eng({ end:'2026-06-01', durationDays:21 });
  assert.equal(restDaysBank(e, parseISO('2026-06-20')), 2);  // 2 days still owed
  assert.equal(restDaysBank(e, parseISO('2026-06-22')), 0);  // fully rested
  assert.equal(restDaysBank(e, parseISO('2026-07-01')), 0);  // never negative
});
