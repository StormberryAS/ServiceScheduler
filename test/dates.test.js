import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/dates.js';
const { parseISO, formatISO, addDays, addMonths, daysBetween, toDisplay, fromDisplay } = globalThis.SB.dates;

test('parse and format round-trip', () => {
  assert.equal(formatISO(parseISO('2026-06-20')), '2026-06-20');
});
test('addDays crosses month boundary', () => {
  assert.equal(formatISO(addDays(parseISO('2026-06-29'), 5)), '2026-07-04');
});
test('addMonths handles year wrap', () => {
  assert.equal(formatISO(addMonths(parseISO('2026-12-15'), 1)), '2027-01-15');
});
test('daysBetween is signed', () => {
  assert.equal(daysBetween(parseISO('2026-06-20'), parseISO('2026-06-25')), 5);
  assert.equal(daysBetween(parseISO('2026-06-25'), parseISO('2026-06-20')), -5);
});
test('dd/mm/yyyy display helpers round-trip', () => {
  assert.equal(toDisplay('2026-06-20'), '20/06/2026');
  assert.equal(fromDisplay('20/06/2026'), '2026-06-20');
  assert.equal(toDisplay(''), '');
  assert.equal(fromDisplay('not-a-date'), '');
});
