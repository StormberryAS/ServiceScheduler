;(function () {
  const SB = (globalThis.SB ||= {});
  const subtle = globalThis.crypto.subtle;
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64encode = (buf) => { const u = new Uint8Array(buf); let s = '';
    for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); };
  const b64decode = (str) => { const s = atob(str); const u = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
  const rnd = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

  const deriveKeyPBKDF2 = async (password, salt, iterations) => {
    const base = await subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    return subtle.deriveKey({ name:'PBKDF2', salt, iterations, hash:'SHA-256' }, base,
      { name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']);
  };

  const encrypt = async (payload, password) => {
    const salt = rnd(16), iv = rnd(12);
    const iterations = 600000;
    const key = await deriveKeyPBKDF2(password, salt, iterations);
    const ct = await subtle.encrypt({ name:'AES-GCM', iv }, key, enc.encode(JSON.stringify(payload)));
    return { format:'service-scheduler', version:1,
      kdf:{ algo:'pbkdf2', hash:'SHA-256', iterations, saltB64:b64encode(salt) },
      cipher:'AES-256-GCM', ivB64:b64encode(iv), ciphertextB64:b64encode(ct) };
  };

  const decrypt = async (env, password) => {
    try {
      if (env.kdf.algo !== 'pbkdf2') throw new Error('unsupported kdf');
      const key = await deriveKeyPBKDF2(password, b64decode(env.kdf.saltB64), env.kdf.iterations);
      const pt = await subtle.decrypt({ name:'AES-GCM', iv:b64decode(env.ivB64) }, key, b64decode(env.ciphertextB64));
      return JSON.parse(dec.decode(pt));
    } catch (e) {
      throw new Error('Unable to unlock: wrong password or corrupted file');
    }
  };

  SB.crypto = { encrypt, decrypt, b64encode, b64decode };
})();
