;(function () {
  const SB = (globalThis.SB ||= {});
  const deriveKey = async (password, saltBytes, params) => {
    const raw = await globalThis.hashwasm.argon2id({
      password, salt: saltBytes, parallelism: params.parallelism,
      iterations: params.iterations, memorySize: params.memKiB, hashLength: 32, outputType: 'binary',
    });
    return globalThis.crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  };
  SB.cryptoArgon2 = { deriveKey };
  SB.crypto = SB.crypto || {};
  SB.crypto.useArgon2 = true;
  SB.crypto.argon2Params = { memKiB: 65536, iterations: 3, parallelism: 1 };
})();
