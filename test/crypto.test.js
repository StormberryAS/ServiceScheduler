import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/crypto.js';
const { encrypt, decrypt } = globalThis.SB.crypto;

const payload = { meta:{ appVersion:1 }, engineers:[{ id:'e1', name:'Ada' }] };

test('round-trip restores payload', async () => {
  const env = await encrypt(payload, 'correct horse battery staple');
  assert.equal(env.format, 'stormberry-scheduler');
  assert.equal(env.kdf.algo, 'pbkdf2');
  const out = await decrypt(env, 'correct horse battery staple');
  assert.deepEqual(out, payload);
});
test('wrong password throws friendly error', async () => {
  const env = await encrypt(payload, 'right');
  await assert.rejects(() => decrypt(env, 'wrong'), /wrong password or corrupted file/);
});
test('tampered ciphertext throws', async () => {
  const env = await encrypt(payload, 'pw');
  env.ciphertextB64 = 'AAAA' + env.ciphertextB64.slice(4);
  await assert.rejects(() => decrypt(env, 'pw'), /wrong password or corrupted file/);
});
test('empty password still encrypts and decrypts', async () => {
  const env = await encrypt(payload, '');
  assert.deepEqual(await decrypt(env, ''), payload);
});
