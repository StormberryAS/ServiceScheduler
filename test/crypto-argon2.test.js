import { test } from 'node:test';
import assert from 'node:assert/strict';
import { argon2id } from 'hash-wasm';
globalThis.hashwasm = { argon2id };           // browser global shim for Node
import '../src/crypto.js';
import '../src/crypto-argon2.js';
const { encrypt, decrypt } = globalThis.SB.crypto;

test('argon2id round-trip and header', async () => {
  const env = await encrypt({ x: 1 }, 'pw');
  assert.equal(env.kdf.algo, 'argon2id');
  assert.deepEqual(await decrypt(env, 'pw'), { x: 1 });
});
test('old pbkdf2 envelope still opens', async () => {
  globalThis.SB.crypto.useArgon2 = false;
  const env = await encrypt({ y: 2 }, 'pw');
  globalThis.SB.crypto.useArgon2 = true;
  assert.equal(env.kdf.algo, 'pbkdf2');
  assert.deepEqual(await decrypt(env, 'pw'), { y: 2 });
});
