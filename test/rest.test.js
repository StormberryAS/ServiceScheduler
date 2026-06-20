import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/dates.js';
import '../src/rest.js';
const { parseISO } = globalThis.SB.dates;
const { restDays, restCompleteDate, restDaysBank, availabilityScore } = globalThis.SB.rest;

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
test('availabilityScore is signed: negative resting, 0 available, positive idle, 999 no-history', () => {
  // trip ended 2026-06-01, 21 days rest -> complete 2026-06-22
  const e = eng({ end:'2026-06-01', durationDays:21 });
  assert.equal(availabilityScore(e, parseISO('2026-06-14')), -8);  // 8 rest days left
  assert.equal(availabilityScore(e, parseISO('2026-06-22')), 0);   // available today
  assert.equal(availabilityScore(e, parseISO('2026-06-30')), 8);   // idle 8 days
  assert.equal(availabilityScore(eng(null), parseISO('2026-06-22')), 999); // no offshore history
});
test('restMultiplier scales rest days and minRestDays provides a floor', () => {
  // Trip of 10 days with multiplier 1.5 -> Math.round(10 * 1.5) = 15 rest days.
  const e10 = eng({ end:'2026-06-01', durationDays:10 });
  assert.equal(restDays(e10, { restMultiplier: 1.5 }), 15);
  // Default multiplier (1.0) on same trip -> 10 rest days.
  assert.equal(restDays(e10, {}), 10);
  // minRestDays floor: short trip 2 days, multiplier 1, minRestDays 7 -> 7.
  const e2 = eng({ end:'2026-06-01', durationDays:2 });
  assert.equal(restDays(e2, { restMultiplier: 1, minRestDays: 7 }), 7);
  // restDaysOverride still wins over any settings.
  const eOvr = eng({ end:'2026-06-01', durationDays:21 }, 5);
  assert.equal(restDays(eOvr, { restMultiplier: 2, minRestDays: 30 }), 5);
});
