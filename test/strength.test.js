import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/strength.js';
const { passwordStrength } = globalThis.SB.strength;

test('five states', () => {
  assert.equal(passwordStrength(''), 'unprotected');
  assert.equal(passwordStrength('abcdefgh'), 'weak');             // 8 chars, 1 class
  assert.equal(passwordStrength('abcd1234'), 'medium');           // 8 chars, 2 classes
  assert.equal(passwordStrength('Abcd1234efgh'), 'strong');       // 12 chars, 3 classes
  assert.equal(passwordStrength('Abcd1234efgh!@#$'), 'super-strong'); // 16 chars, 4 classes
});
