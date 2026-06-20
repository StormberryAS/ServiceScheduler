import { test } from 'node:test';
import assert from 'node:assert/strict';
import { argon2id } from 'hash-wasm';
globalThis.hashwasm = { argon2id };
import '../src/crypto-argon2.js';   // production order: argon2 first
import '../src/crypto.js';
const { encrypt } = globalThis.SB.crypto;

test('production load order: encrypt uses argon2id', async () => {
  const env = await encrypt({ x: 1 }, 'pw');
  assert.equal(env.kdf.algo, 'argon2id');
});
