# ServiceScheduler v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first, zero-knowledge offshore field-service scheduler that picks the right engineer for a job (skills, travel documents, certificates, vacation, rest) and ships as a single self-contained HTML page.

**Architecture:** Pure scheduling/crypto logic lives in small browser-and-Node-compatible files that attach functions to a `globalThis.SB` namespace (classic-script IIFEs, also importable by Node for tests). The DOM layer wires those functions to three tabs. A trivial inliner concatenates everything into one self-contained `index.html` for deployment. No framework, no bundler, no transpiler.

**Tech Stack:** Vanilla HTML/CSS/JS; Web Crypto (AES-256-GCM, PBKDF2-SHA256); Node 20+ built-in test runner (`node --test`); Cloudflare Pages hosting. (Note: Argon2id, planned as an enhancement in Task 12 below, was removed after build in favour of PBKDF2-only because the deployment CSP blocks WebAssembly. The shipped app uses PBKDF2-SHA256 + AES-256-GCM.)

## Global Constraints

These apply to every task. Values copied verbatim from the spec (`docs/2026-06-20-stormberry-scheduler-design.md`).

- **Deliverable shape:** a single self-contained `dist/index.html`, zero network requests after load, runnable offline by opening the file.
- **CSP on the deployed page:** `default-src 'self'; connect-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'`. No external origins.
- **British English** in all user-facing copy and docs (organise, prioritise, colour, centre, licence as a noun). American spelling only in CSS/JS/HTML identifiers (`color`, `text-align`).
- **No em dashes and no double hyphens** in any copy or docs.
- **No real personal data.** Synthetic engineers only.
- **Crypto:** AES-256-GCM, 12-byte IV, 128-bit tag, 16-byte salt. KDF v1 = PBKDF2-SHA256 at 600000 iterations. Argon2id (memory 65536 KiB, iterations 3, parallelism 1, 32-byte key) added as an enhancement; the envelope header records which KDF was used so both open.
- **Passport thresholds:** `passportInvalidMonths` = 6 (hard, cannot travel), `passportBufferMonths` = 12 (warning).
- **Rest:** default rest entitlement equals the previous trip length (`durationDays`); `restDaysOverride` wins when set. Rest is a cost signal (overtime), never a hard block.
- **Password:** no minimum, empty allowed; live five-state meter (unprotected / weak / medium / strong / super-strong).
- **Dates:** ISO `YYYY-MM-DD`, treated as UTC-midnight calendar dates; represented internally as epoch milliseconds for arithmetic.
- **Module convention:** each `src/*.js` is an IIFE that assigns to `globalThis.SB.<namespace>` and references other namespaces as `SB.<ns>.<fn>` at call time (never destructured at load), so load order never breaks.
- **Repo:** `ServiceScheduler`; subdomain `scheduler.stormberry.as`; product name "ServiceScheduler".

## Data shapes (used across all tasks)

```js
// Settings
{ restRule:'equal-to-previous-trip', passportInvalidMonths:6, passportBufferMonths:12,
  equipment:string[], repairTypes:string[], certTypes:string[], countries:string[] }
// Passport / Visa / Cert / Competence / Vacation
{ country, number, expiry }   // Passport  (expiry ISO)
{ country, expiry }           // Visa
{ type, expiry }              // Cert
{ equipment, repairType, level }   // Competence, level 1|2|3
{ start, end }                // Vacation (ISO)
// Availability
{ lastOffshore: { end, durationDays } | null, restDaysOverride: number|null, vacations: Vacation[] }
// Engineer
{ id, name, nationalities:string[], passports:Passport[], visas:Visa[], certs:Cert[],
  competence:Competence[], availability:Availability }
// Job
{ title, equipment, repairType, country, offshore:boolean, startDate, durationDays, requiredCerts:string[] }
```

## File structure

```
ServiceScheduler/
  package.json                # { "type":"module", "scripts":{ "test":"node --test" } }
  index.html                  # dev entry: external <script src> + <link> (works file:// and served)
  style.css                   # Stormberry dark theme
  src/dates.js                # SB.dates: parseISO, formatISO, addDays, addMonths, daysBetween, today
  src/rest.js                 # SB.rest: restDays, restCompleteDate, restDaysBank
  src/eligibility.js          # SB.eligibility: evaluate, jobEndMs
  src/engine.js               # SB.engine: nextPick
  src/strength.js             # SB.strength: passwordStrength
  src/crypto.js               # SB.crypto: encrypt, decrypt, b64encode, b64decode (PBKDF2)
  src/crypto-argon2.js        # SB.cryptoArgon2 + enables Argon2id (Task 12)
  src/compliance.js           # SB.compliance: expiringDocuments, restOverview
  src/demo.js                 # SB.demo: settings(), engineers()
  src/ui.js                   # DOM wiring (not unit-tested)
  vendor/hash-wasm-argon2.js  # vendored, pinned (Task 12)
  test/*.test.js              # node --test
  build.mjs                   # inliner -> dist/index.html
  dist/index.html             # generated, deployed
  CNAME                       # scheduler.stormberry.as
```

---

### Task 1: Scaffold + date helpers

**Files:**
- Create: `package.json`, `src/dates.js`, `test/dates.test.js`
- Modify: `.gitignore` (add `node_modules/`, `dist/`)

**Interfaces:**
- Produces: `SB.dates = { parseISO(s)->ms, formatISO(ms)->s, addDays(ms,n)->ms, addMonths(ms,n)->ms, daysBetween(a,b)->int, today()->ms, MS_DAY }`

- [ ] **Step 1: Write the failing test**

```js
// test/dates.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/dates.js';
const { parseISO, formatISO, addDays, addMonths, daysBetween } = globalThis.SB.dates;

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/viking/ThomassenPovoaHoldingAS/StormberryAS/GitHub/ServiceScheduler && npm test`
Expected: FAIL, `Cannot find module '../src/dates.js'` (and package.json absent until created in Step 3).

- [ ] **Step 3: Create scaffold and implementation**

```json
// package.json
{ "name": "service-scheduler", "private": true, "type": "module",
  "scripts": { "test": "node --test" } }
```

```js
// src/dates.js
;(function () {
  const SB = (globalThis.SB ||= {});
  const MS_DAY = 86400000;
  const parseISO = (s) => { const [y,m,d] = s.split('-').map(Number); return Date.UTC(y, m-1, d); };
  const formatISO = (ms) => { const d = new Date(ms);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`; };
  const addDays = (ms, n) => ms + n * MS_DAY;
  const addMonths = (ms, n) => { const d = new Date(ms); d.setUTCMonth(d.getUTCMonth()+n); return d.getTime(); };
  const daysBetween = (a, b) => Math.round((b - a) / MS_DAY);
  const today = () => { const n = new Date(); return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()); };
  SB.dates = { parseISO, formatISO, addDays, addMonths, daysBetween, today, MS_DAY };
})();
```

Append to `.gitignore`:
```
node_modules/
dist/
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add package.json src/dates.js test/dates.test.js .gitignore
git commit -m "feat: project scaffold and date helpers"
```

---

### Task 2: Rest model and rest-days bank

**Files:**
- Create: `src/rest.js`, `test/rest.test.js`

**Interfaces:**
- Consumes: `SB.dates`
- Produces: `SB.rest = { restDays(engineer)->int, restCompleteDate(engineer)->ms|null, restDaysBank(engineer, refMs)->int }`

- [ ] **Step 1: Write the failing test**

```js
// test/rest.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL, `Cannot find module '../src/rest.js'`.

- [ ] **Step 3: Write implementation**

```js
// src/rest.js
;(function () {
  const SB = (globalThis.SB ||= {});
  const restDays = (e) => {
    const a = e.availability || {};
    if (a.restDaysOverride != null) return a.restDaysOverride;
    return a.lastOffshore ? a.lastOffshore.durationDays : 0;
  };
  const restCompleteDate = (e) => {
    const a = e.availability || {};
    if (!a.lastOffshore) return null;
    return SB.dates.addDays(SB.dates.parseISO(a.lastOffshore.end), restDays(e));
  };
  const restDaysBank = (e, refMs) => {
    const rc = restCompleteDate(e);
    return rc == null ? 0 : Math.max(0, SB.dates.daysBetween(refMs, rc));
  };
  SB.rest = { restDays, restCompleteDate, restDaysBank };
})();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/rest.js test/rest.test.js
git commit -m "feat: rest model with rest-days bank"
```

---

### Task 3: Eligibility (hard filters)

**Files:**
- Create: `src/eligibility.js`, `test/eligibility.test.js`

**Interfaces:**
- Consumes: `SB.dates`
- Produces: `SB.eligibility = { jobEndMs(job)->ms, evaluate(engineer, job, settings)->{ eligible:boolean, failedRule:string|null, passportWarning:boolean } }`
  - failedRule one of: `'no-competence' | 'no-valid-passport' | 'needs-visa' | 'cert-missing-or-expired' | 'on-vacation'`

- [ ] **Step 1: Write the failing test**

```js
// test/eligibility.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/dates.js';
import '../src/eligibility.js';
const { evaluate } = globalThis.SB.eligibility;

const settings = { passportInvalidMonths: 6, passportBufferMonths: 12 };
const baseJob = { equipment:'offshore crane', repairType:'preventive (scheduled) service',
  country:'United Kingdom', offshore:true, startDate:'2026-08-01', durationDays:10,
  requiredCerts:['offshore safety course'] };
const baseEng = () => ({
  id:'e1', name:'Test', nationalities:['Norway'],
  passports:[{ country:'Norway', number:'N1', expiry:'2030-01-01' }],
  visas:[{ country:'United Kingdom', expiry:'2027-01-01' }],
  certs:[{ type:'offshore safety course', expiry:'2027-01-01' }],
  competence:[{ equipment:'offshore crane', repairType:'preventive (scheduled) service', level:2 }],
  availability:{ lastOffshore:null, restDaysOverride:null, vacations:[] },
});

test('fully qualified engineer is eligible', () => {
  assert.deepEqual(evaluate(baseEng(), baseJob, settings), { eligible:true, failedRule:null, passportWarning:false });
});
test('missing competence fails first', () => {
  const e = baseEng(); e.competence = [];
  assert.equal(evaluate(e, baseJob, settings).failedRule, 'no-competence');
});
test('passport inside 6-month invalid window cannot travel', () => {
  const e = baseEng(); e.passports = [{ country:'Norway', number:'N1', expiry:'2026-09-01' }]; // <6mo past job end
  assert.equal(evaluate(e, baseJob, settings).failedRule, 'no-valid-passport');
});
test('no visa for destination fails', () => {
  const e = baseEng(); e.visas = [];
  assert.equal(evaluate(e, baseJob, settings).failedRule, 'needs-visa');
});
test('dual national needs no visa for own country', () => {
  const e = baseEng(); e.nationalities = ['Norway','United Kingdom']; e.visas = [];
  assert.equal(evaluate(e, baseJob, settings).eligible, true);
});
test('expired required cert fails', () => {
  const e = baseEng(); e.certs = [{ type:'offshore safety course', expiry:'2026-07-01' }];
  assert.equal(evaluate(e, baseJob, settings).failedRule, 'cert-missing-or-expired');
});
test('vacation overlapping job window fails', () => {
  const e = baseEng(); e.availability.vacations = [{ start:'2026-08-05', end:'2026-08-20' }];
  assert.equal(evaluate(e, baseJob, settings).failedRule, 'on-vacation');
});
test('passport warning when valid but inside 12-month buffer', () => {
  const e = baseEng(); e.passports = [{ country:'Norway', number:'N1', expiry:'2027-03-01' }]; // >6mo, <12mo past job end
  const r = evaluate(e, baseJob, settings);
  assert.equal(r.eligible, true); assert.equal(r.passportWarning, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL, `Cannot find module '../src/eligibility.js'`.

- [ ] **Step 3: Write implementation**

```js
// src/eligibility.js
;(function () {
  const SB = (globalThis.SB ||= {});
  const D = () => SB.dates;
  const jobEndMs = (job) => D().addDays(D().parseISO(job.startDate), job.durationDays - 1);

  const hasCompetence = (e, job) =>
    e.competence.some((c) => c.equipment === job.equipment && c.repairType === job.repairType);

  const usablePassports = (e, job, settings) => {
    const cutoff = D().addMonths(jobEndMs(job), settings.passportInvalidMonths);
    return e.passports.filter((p) => D().parseISO(p.expiry) >= cutoff);
  };
  const travel = (e, job, settings) => {
    if (e.nationalities.includes(job.country)) return { ok: true };
    if (usablePassports(e, job, settings).length === 0) return { ok: false, rule: 'no-valid-passport' };
    const end = jobEndMs(job);
    const visa = e.visas.find((v) => v.country === job.country && D().parseISO(v.expiry) >= end);
    return visa ? { ok: true } : { ok: false, rule: 'needs-visa' };
  };
  const certsOk = (e, job) => {
    const end = jobEndMs(job);
    return job.requiredCerts.every((t) => e.certs.some((c) => c.type === t && D().parseISO(c.expiry) >= end));
  };
  const onVacation = (e, job) => {
    const s = D().parseISO(job.startDate), end = jobEndMs(job);
    return (e.availability.vacations || []).some((v) => D().parseISO(v.start) <= end && D().parseISO(v.end) >= s);
  };
  const passportWarning = (e, job, settings) => {
    const usable = usablePassports(e, job, settings);
    if (!usable.length) return false;
    const warn = D().addMonths(jobEndMs(job), settings.passportBufferMonths);
    return usable.every((p) => D().parseISO(p.expiry) < warn);
  };

  const evaluate = (e, job, settings) => {
    if (!hasCompetence(e, job)) return { eligible: false, failedRule: 'no-competence', passportWarning: false };
    const t = travel(e, job, settings);
    if (!t.ok) return { eligible: false, failedRule: t.rule, passportWarning: false };
    if (!certsOk(e, job)) return { eligible: false, failedRule: 'cert-missing-or-expired', passportWarning: false };
    if (onVacation(e, job)) return { eligible: false, failedRule: 'on-vacation', passportWarning: false };
    return { eligible: true, failedRule: null, passportWarning: passportWarning(e, job, settings) };
  };
  SB.eligibility = { evaluate, jobEndMs };
})();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 8 eligibility tests.

- [ ] **Step 5: Commit**

```bash
git add src/eligibility.js test/eligibility.test.js
git commit -m "feat: eligibility hard filters with multi-passport travel logic"
```

---

### Task 4: Next-pick engine (rest-aware ranking)

**Files:**
- Create: `src/engine.js`, `test/engine.test.js`

**Interfaces:**
- Consumes: `SB.dates`, `SB.eligibility`, `SB.rest`
- Produces: `SB.engine = { nextPick(job, engineers, settings) -> { shortlist:[{id,name,restDaysBank,overtime,passportWarning,reason}], excluded:[{id,name,failedRule}] } }`
  - shortlist ordered by `restDaysBank` ascending, then name.

- [ ] **Step 1: Write the failing test**

```js
// test/engine.test.js
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
  assert.ok(r.shortlist[1].restDaysBank > 0);
  assert.deepEqual(r.excluded, [{ id:'noskill', name:'noskill', failedRule:'no-competence' }]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL, `Cannot find module '../src/engine.js'`.

- [ ] **Step 3: Write implementation**

```js
// src/engine.js
;(function () {
  const SB = (globalThis.SB ||= {});
  const reasonFor = (bank, warn) => {
    let r = bank === 0 ? 'Rested and available'
      : `${bank} rest day${bank === 1 ? '' : 's'} remaining, overtime applies`;
    if (warn) r += '; passport nearing the validity limit';
    return r;
  };
  const nextPick = (job, engineers, settings) => {
    const startMs = SB.dates.parseISO(job.startDate);
    const shortlist = [], excluded = [];
    for (const e of engineers) {
      const ev = SB.eligibility.evaluate(e, job, settings);
      if (!ev.eligible) { excluded.push({ id: e.id, name: e.name, failedRule: ev.failedRule }); continue; }
      const bank = SB.rest.restDaysBank(e, startMs);
      shortlist.push({ id: e.id, name: e.name, restDaysBank: bank, overtime: bank > 0,
        passportWarning: ev.passportWarning, reason: reasonFor(bank, ev.passportWarning) });
    }
    shortlist.sort((a, b) => a.restDaysBank - b.restDaysBank || a.name.localeCompare(b.name));
    return { shortlist, excluded };
  };
  SB.engine = { nextPick };
})();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine.js test/engine.test.js
git commit -m "feat: next-pick engine with rest-aware ranking and exclusions"
```

---

### Task 5: Password strength meter

**Files:**
- Create: `src/strength.js`, `test/strength.test.js`

**Interfaces:**
- Produces: `SB.strength = { passwordStrength(pw) -> 'unprotected'|'weak'|'medium'|'strong'|'super-strong' }`

- [ ] **Step 1: Write the failing test**

```js
// test/strength.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL, `Cannot find module '../src/strength.js'`.

- [ ] **Step 3: Write implementation**

```js
// src/strength.js
;(function () {
  const SB = (globalThis.SB ||= {});
  const passwordStrength = (pw) => {
    if (!pw) return 'unprotected';
    let classes = 0;
    if (/[a-z]/.test(pw)) classes++;
    if (/[A-Z]/.test(pw)) classes++;
    if (/[0-9]/.test(pw)) classes++;
    if (/[^A-Za-z0-9]/.test(pw)) classes++;
    const n = pw.length;
    if (n < 8 || classes <= 1) return 'weak';
    if (n >= 16 && classes >= 3) return 'super-strong';
    if (n >= 12 && classes >= 3) return 'strong';
    return 'medium';
  };
  SB.strength = { passwordStrength };
})();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/strength.js test/strength.test.js
git commit -m "feat: five-state password strength meter"
```

---

### Task 6: Crypto envelope (PBKDF2 + AES-GCM)

**Files:**
- Create: `src/crypto.js`, `test/crypto.test.js`

**Interfaces:**
- Produces: `SB.crypto = { encrypt(payload, password)->Promise<envelope>, decrypt(envelope, password)->Promise<payload>, b64encode(buf)->str, b64decode(str)->Uint8Array, useArgon2:false, argon2Params }`
  - envelope: `{ format, version, kdf:{algo,hash,iterations,saltB64}, cipher, ivB64, ciphertextB64 }`
  - decrypt throws `Error('Unable to unlock: wrong password or corrupted file')` on any failure.

- [ ] **Step 1: Write the failing test**

```js
// test/crypto.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL, `Cannot find module '../src/crypto.js'`.

- [ ] **Step 3: Write implementation**

```js
// src/crypto.js
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
    let key, kdf;
    if (SB.crypto.useArgon2 && SB.cryptoArgon2) {
      const p = SB.crypto.argon2Params;
      key = await SB.cryptoArgon2.deriveKey(password, salt, p);
      kdf = { algo:'argon2id', memKiB:p.memKiB, iterations:p.iterations, parallelism:p.parallelism, saltB64:b64encode(salt) };
    } else {
      const iterations = 600000;
      key = await deriveKeyPBKDF2(password, salt, iterations);
      kdf = { algo:'pbkdf2', hash:'SHA-256', iterations, saltB64:b64encode(salt) };
    }
    const ct = await subtle.encrypt({ name:'AES-GCM', iv }, key, enc.encode(JSON.stringify(payload)));
    return { format:'stormberry-scheduler', version:1, kdf, cipher:'AES-256-GCM',
      ivB64:b64encode(iv), ciphertextB64:b64encode(ct) };
  };

  const decrypt = async (env, password) => {
    try {
      let key;
      if (env.kdf.algo === 'pbkdf2') key = await deriveKeyPBKDF2(password, b64decode(env.kdf.saltB64), env.kdf.iterations);
      else if (env.kdf.algo === 'argon2id') key = await SB.cryptoArgon2.deriveKey(password, b64decode(env.kdf.saltB64), env.kdf);
      else throw new Error('unknown kdf');
      const pt = await subtle.decrypt({ name:'AES-GCM', iv:b64decode(env.ivB64) }, key, b64decode(env.ciphertextB64));
      return JSON.parse(dec.decode(pt));
    } catch (e) {
      throw new Error('Unable to unlock: wrong password or corrupted file');
    }
  };

  SB.crypto = { encrypt, decrypt, b64encode, b64decode, useArgon2: false, argon2Params: { memKiB:65536, iterations:3, parallelism:1 } };
})();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 4 crypto tests (PBKDF2 at 600k is fast enough in Node).

- [ ] **Step 5: Commit**

```bash
git add src/crypto.js test/crypto.test.js
git commit -m "feat: AES-GCM encrypted envelope with PBKDF2 key derivation"
```

---

### Task 7: Compliance views

**Files:**
- Create: `src/compliance.js`, `test/compliance.test.js`

**Interfaces:**
- Consumes: `SB.dates`, `SB.rest`
- Produces: `SB.compliance = { expiringDocuments(engineers, asOfMs) -> { d30:[], d60:[], d90:[] }, restOverview(engineers, asOfMs) -> [{id,name,restDaysBank}] }`
  - document item: `{ who, kind:'Passport'|'Visa'|'Certificate', detail, expiry, days }`

- [ ] **Step 1: Write the failing test**

```js
// test/compliance.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/dates.js';
import '../src/rest.js';
import '../src/compliance.js';
const { parseISO } = globalThis.SB.dates;
const { expiringDocuments, restOverview } = globalThis.SB.compliance;

const asOf = parseISO('2026-06-22');
const eng = {
  id:'e1', name:'Ada', passports:[{country:'Norway',number:'N1',expiry:'2026-07-10'}], // ~18 days
  visas:[{country:'UK',expiry:'2026-08-15'}], // ~54 days
  certs:[{type:'first aid',expiry:'2026-09-15'}], // ~85 days
  availability:{ lastOffshore:{ end:'2026-06-20', durationDays:10 }, restDaysOverride:null, vacations:[] },
};

test('documents bucket by 30/60/90 days', () => {
  const b = expiringDocuments([eng], asOf);
  assert.equal(b.d30[0].kind, 'Passport');
  assert.equal(b.d60[0].kind, 'Visa');
  assert.equal(b.d90[0].kind, 'Certificate');
});
test('rest overview lists only resting engineers', () => {
  const r = restOverview([eng], asOf);
  assert.equal(r.length, 1);
  assert.ok(r[0].restDaysBank > 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL, `Cannot find module '../src/compliance.js'`.

- [ ] **Step 3: Write implementation**

```js
// src/compliance.js
;(function () {
  const SB = (globalThis.SB ||= {});
  const D = () => SB.dates;
  const expiringDocuments = (engineers, asOfMs) => {
    const b = { d30: [], d60: [], d90: [] };
    const add = (days, item) => { if (days < 0) return;
      if (days <= 30) b.d30.push(item); else if (days <= 60) b.d60.push(item); else if (days <= 90) b.d90.push(item); };
    for (const e of engineers) {
      for (const p of e.passports) add(D().daysBetween(asOfMs, D().parseISO(p.expiry)),
        { who:e.name, kind:'Passport', detail:`${p.country} ${p.number}`, expiry:p.expiry, days:D().daysBetween(asOfMs, D().parseISO(p.expiry)) });
      for (const v of e.visas) add(D().daysBetween(asOfMs, D().parseISO(v.expiry)),
        { who:e.name, kind:'Visa', detail:v.country, expiry:v.expiry, days:D().daysBetween(asOfMs, D().parseISO(v.expiry)) });
      for (const c of e.certs) add(D().daysBetween(asOfMs, D().parseISO(c.expiry)),
        { who:e.name, kind:'Certificate', detail:c.type, expiry:c.expiry, days:D().daysBetween(asOfMs, D().parseISO(c.expiry)) });
    }
    for (const k of ['d30','d60','d90']) b[k].sort((a, c) => a.days - c.days);
    return b;
  };
  const restOverview = (engineers, asOfMs) =>
    engineers.map((e) => ({ id:e.id, name:e.name, restDaysBank: SB.rest.restDaysBank(e, asOfMs) }))
      .filter((x) => x.restDaysBank > 0).sort((a, b) => b.restDaysBank - a.restDaysBank);
  SB.compliance = { expiringDocuments, restOverview };
})();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/compliance.js test/compliance.test.js
git commit -m "feat: compliance expiry buckets and rest overview"
```

---

### Task 8: Synthetic demo data

**Files:**
- Create: `src/demo.js`, `test/demo.test.js`

**Interfaces:**
- Consumes: `SB.engine`, `SB.eligibility`
- Produces: `SB.demo = { settings() -> Settings, engineers() -> Engineer[] }` (exactly 15 engineers)

- [ ] **Step 1: Write the failing test**

```js
// test/demo.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/dates.js';
import '../src/rest.js';
import '../src/eligibility.js';
import '../src/engine.js';
import '../src/demo.js';
const { settings, engineers } = globalThis.SB.demo;

test('exactly 15 synthetic engineers with required edge cases', () => {
  const es = engineers();
  assert.equal(es.length, 15);
  // a dual-national exists
  assert.ok(es.some((e) => e.nationalities.length >= 2));
  // someone holds more than one passport
  assert.ok(es.some((e) => e.passports.length >= 2));
  // at least one is currently resting (has offshore history)
  assert.ok(es.some((e) => e.availability.lastOffshore));
  // at least one has a vacation booked
  assert.ok(es.some((e) => (e.availability.vacations || []).length > 0));
});
test('a representative job yields both shortlist and exclusions', () => {
  const job = { title:'Crane service Aberdeen', equipment:'offshore crane',
    repairType:'preventive (scheduled) service', country:'United Kingdom', offshore:true,
    startDate:'2026-08-01', durationDays:10, requiredCerts:['offshore safety course'] };
  const r = globalThis.SB.engine.nextPick(job, engineers(), settings());
  assert.ok(r.shortlist.length >= 1);
  assert.ok(r.excluded.length >= 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL, `Cannot find module '../src/demo.js'`.

- [ ] **Step 3: Write implementation**

Create `src/demo.js` with the settings below and 15 engineers. Build the first 6 to hit the edge cases explicitly, then 9 more varied "ordinary" engineers. Full content:

```js
// src/demo.js
;(function () {
  const SB = (globalThis.SB ||= {});
  const EQUIP = ['offshore crane','winch system','Launch and Recovery System (LARS)','lifeboat/davit system','hydraulic power unit (HPU) / control system'];
  const REPAIRS = ['preventive (scheduled) service','corrective (breakdown) repair','overhaul and recertification (including load test)'];
  const CERTS = ['offshore safety course','sea survival','H2S awareness','working at height','first aid'];
  const COUNTRIES = ['Norway','United Kingdom','Netherlands','Brazil','United Arab Emirates','Angola','Australia'];
  const settings = () => ({ restRule:'equal-to-previous-trip', passportInvalidMonths:6, passportBufferMonths:12,
    equipment:[...EQUIP], repairTypes:[...REPAIRS], certTypes:[...CERTS], countries:[...COUNTRIES] });

  const allCerts = (expiry) => CERTS.map((type) => ({ type, expiry }));
  const comp = (equipment, repairType, level) => ({ equipment, repairType, level });

  const engineers = () => ([
    // 1. clean, fully rested, obvious pick
    { id:'e01', name:'Lars Pedersen', nationalities:['Norway'],
      passports:[{country:'Norway',number:'NO11111',expiry:'2031-04-01'}], visas:[{country:'United Kingdom',expiry:'2028-01-01'}],
      certs:allCerts('2028-01-01'), competence:[comp('offshore crane','preventive (scheduled) service',3), comp('winch system','corrective (breakdown) repair',2)],
      availability:{ lastOffshore:{ end:'2026-05-01', durationDays:14 }, restDaysOverride:null, vacations:[] } },
    // 2. still resting -> overtime flag
    { id:'e02', name:'Ingrid Solheim', nationalities:['Norway'],
      passports:[{country:'Norway',number:'NO22222',expiry:'2030-06-01'}], visas:[{country:'United Kingdom',expiry:'2027-09-01'}],
      certs:allCerts('2027-06-01'), competence:[comp('offshore crane','preventive (scheduled) service',3)],
      availability:{ lastOffshore:{ end:'2026-07-25', durationDays:21 }, restDaysOverride:null, vacations:[] } },
    // 3. passport inside 6-month invalid window for an Aug job
    { id:'e03', name:'Tom Eriksen', nationalities:['Norway'],
      passports:[{country:'Norway',number:'NO33333',expiry:'2026-10-01'}], visas:[{country:'United Kingdom',expiry:'2027-01-01'}],
      certs:allCerts('2027-01-01'), competence:[comp('offshore crane','preventive (scheduled) service',2)],
      availability:{ lastOffshore:null, restDaysOverride:null, vacations:[] } },
    // 4. on vacation across early August
    { id:'e04', name:'Sofia Haugen', nationalities:['Norway'],
      passports:[{country:'Norway',number:'NO44444',expiry:'2031-01-01'}], visas:[{country:'United Kingdom',expiry:'2028-01-01'}],
      certs:allCerts('2028-01-01'), competence:[comp('offshore crane','preventive (scheduled) service',3)],
      availability:{ lastOffshore:{ end:'2026-04-01', durationDays:10 }, restDaysOverride:null, vacations:[{ start:'2026-07-25', end:'2026-08-15' }] } },
    // 5. dual national, no UK visa needed
    { id:'e05', name:'James Olsen', nationalities:['Norway','United Kingdom'],
      passports:[{country:'Norway',number:'NO55555',expiry:'2030-01-01'},{country:'United Kingdom',number:'UK55555',expiry:'2030-01-01'}], visas:[],
      certs:allCerts('2027-08-01'), competence:[comp('offshore crane','preventive (scheduled) service',3)],
      availability:{ lastOffshore:{ end:'2026-05-15', durationDays:12 }, restDaysOverride:null, vacations:[] } },
    // 6. matches crane but missing offshore safety course (expired)
    { id:'e06', name:'Nora Berg', nationalities:['Norway'],
      passports:[{country:'Norway',number:'NO66666',expiry:'2031-01-01'}], visas:[{country:'United Kingdom',expiry:'2028-01-01'}],
      certs:[{type:'offshore safety course',expiry:'2026-06-01'},{type:'sea survival',expiry:'2028-01-01'},{type:'H2S awareness',expiry:'2028-01-01'},{type:'working at height',expiry:'2028-01-01'},{type:'first aid',expiry:'2028-01-01'}],
      competence:[comp('offshore crane','preventive (scheduled) service',2)],
      availability:{ lastOffshore:null, restDaysOverride:null, vacations:[] } },
    // 7-15: varied ordinary engineers across equipment, countries, rest states
    { id:'e07', name:'Mateus Almeida', nationalities:['Brazil'], passports:[{country:'Brazil',number:'BR70000',expiry:'2029-03-01'}],
      visas:[{country:'United Kingdom',expiry:'2027-05-01'},{country:'Norway',expiry:'2027-05-01'}], certs:allCerts('2027-10-01'),
      competence:[comp('winch system','overhaul and recertification (including load test)',3), comp('LARS'in{}? '' :'Launch and Recovery System (LARS)','corrective (breakdown) repair',2)],
      availability:{ lastOffshore:{ end:'2026-06-10', durationDays:18 }, restDaysOverride:null, vacations:[] } },
    { id:'e08', name:'Wouter Smit', nationalities:['Netherlands'], passports:[{country:'Netherlands',number:'NL80000',expiry:'2030-09-01'}],
      visas:[{country:'United Kingdom',expiry:'2028-01-01'}], certs:allCerts('2028-02-01'),
      competence:[comp('hydraulic power unit (HPU) / control system','preventive (scheduled) service',3)],
      availability:{ lastOffshore:{ end:'2026-03-20', durationDays:9 }, restDaysOverride:null, vacations:[] } },
    { id:'e09', name:'Aisha Rahman', nationalities:['United Arab Emirates','United Kingdom'],
      passports:[{country:'United Arab Emirates',number:'AE90000',expiry:'2031-02-01'},{country:'United Kingdom',number:'UK90000',expiry:'2031-02-01'}],
      visas:[], certs:allCerts('2027-12-01'), competence:[comp('lifeboat/davit system','overhaul and recertification (including load test)',2)],
      availability:{ lastOffshore:null, restDaysOverride:null, vacations:[] } },
    { id:'e10', name:'Kari Nilsen', nationalities:['Norway'], passports:[{country:'Norway',number:'NO10000',expiry:'2029-11-01'}],
      visas:[{country:'Angola',expiry:'2027-03-01'}], certs:allCerts('2027-04-01'),
      competence:[comp('winch system','preventive (scheduled) service',2)],
      availability:{ lastOffshore:{ end:'2026-05-20', durationDays:15 }, restDaysOverride:null, vacations:[] } },
    { id:'e11', name:'Diego Santos', nationalities:['Brazil'], passports:[{country:'Brazil',number:'BR11000',expiry:'2028-07-01'}],
      visas:[{country:'United Kingdom',expiry:'2027-02-01'}], certs:allCerts('2027-03-01'),
      competence:[comp('offshore crane','corrective (breakdown) repair',2), comp('winch system','corrective (breakdown) repair',3)],
      availability:{ lastOffshore:{ end:'2026-06-15', durationDays:20 }, restDaysOverride:null, vacations:[] } },
    { id:'e12', name:'Elena Costa', nationalities:['Brazil','United Kingdom'],
      passports:[{country:'Brazil',number:'BR12000',expiry:'2030-01-01'},{country:'United Kingdom',number:'UK12000',expiry:'2030-01-01'}],
      visas:[], certs:allCerts('2028-01-01'), competence:[comp('lifeboat/davit system','preventive (scheduled) service',3)],
      availability:{ lastOffshore:{ end:'2026-04-25', durationDays:11 }, restDaysOverride:null, vacations:[] } },
    { id:'e13', name:'Henrik Dahl', nationalities:['Norway'], passports:[{country:'Norway',number:'NO13000',expiry:'2027-02-15'}],
      visas:[{country:'United Kingdom',expiry:'2028-01-01'}], certs:allCerts('2027-07-01'),
      competence:[comp('hydraulic power unit (HPU) / control system','corrective (breakdown) repair',2)],
      availability:{ lastOffshore:{ end:'2026-05-05', durationDays:13 }, restDaysOverride:null, vacations:[] } },
    { id:'e14', name:'Liam Murphy', nationalities:['United Kingdom'], passports:[{country:'United Kingdom',number:'UK14000',expiry:'2031-06-01'}],
      visas:[{country:'Norway',expiry:'2028-01-01'}], certs:allCerts('2028-03-01'),
      competence:[comp('Launch and Recovery System (LARS)','overhaul and recertification (including load test)',3)],
      availability:{ lastOffshore:{ end:'2026-06-01', durationDays:16 }, restDaysOverride:null, vacations:[] } },
    { id:'e15', name:'Mia Johansen', nationalities:['Norway'], passports:[{country:'Norway',number:'NO15000',expiry:'2030-12-01'}],
      visas:[{country:'United Kingdom',expiry:'2027-11-01'}], certs:allCerts('2027-09-01'),
      competence:[comp('offshore crane','preventive (scheduled) service',1), comp('lifeboat/davit system','corrective (breakdown) repair',2)],
      availability:{ lastOffshore:null, restDaysOverride:null, vacations:[] } },
  ]);
  SB.demo = { settings, engineers };
})();
```

Note for the implementer: the `'LARS'in{}? ...` ternary in engineer e07 is a deliberate red flag to remove. Replace that competence entry with a clean `comp('Launch and Recovery System (LARS)','corrective (breakdown) repair',2)`. Verify every `equipment`/`repairType`/`cert` string is drawn verbatim from the `EQUIP`/`REPAIRS`/`CERTS` lists, or the engine will silently exclude.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 2 demo tests; total suite green.

- [ ] **Step 5: Commit**

```bash
git add src/demo.js test/demo.test.js
git commit -m "feat: synthetic demo roster of 15 engineers with edge cases"
```

---

### Task 9: UI shell, lock screen, unlock and load

**Files:**
- Create: `index.html`, `style.css`, `src/ui.js`

**Interfaces:**
- Consumes: all `SB.*` namespaces.
- Produces: a working dev page (open `index.html` via a local static server, or file://) that loads the demo roster or an encrypted file and switches between three tabs.

This task's deliverable is verified by browser observation, not unit tests. Keep `src/ui.js` to DOM wiring only, all logic stays in the tested namespaces.

- [ ] **Step 1: Write `index.html` (dev entry)**

```html
<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ServiceScheduler</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header><h1>ServiceScheduler</h1><span id="fileState" class="muted">No roster loaded</span></header>

  <section id="lock" class="card">
    <h2>Open a roster</h2>
    <p class="muted">Everything stays on this device. Nothing is uploaded.</p>
    <input type="file" id="fileInput" accept=".sbs">
    <label>Password <input type="password" id="pw" autocomplete="off"></label>
    <div id="meter" class="meter"></div>
    <div class="row">
      <button id="unlockBtn">Unlock file</button>
      <button id="newBtn">New roster (demo data)</button>
    </div>
    <p id="lockError" class="error" hidden></p>
  </section>

  <nav id="tabs" hidden>
    <button data-tab="roster" class="active">Roster</button>
    <button data-tab="nextpick">Find next pick</button>
    <button data-tab="compliance">Compliance</button>
    <span class="spacer"></span>
    <button id="saveBtn">Save</button>
  </nav>

  <main id="roster" class="tab" hidden></main>
  <main id="nextpick" class="tab" hidden></main>
  <main id="compliance" class="tab" hidden></main>

  <script src="src/dates.js"></script>
  <script src="src/rest.js"></script>
  <script src="src/eligibility.js"></script>
  <script src="src/engine.js"></script>
  <script src="src/strength.js"></script>
  <script src="src/crypto.js"></script>
  <script src="src/compliance.js"></script>
  <script src="src/demo.js"></script>
  <script src="src/ui.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `style.css` (Stormberry dark theme)**

```css
:root { --bg:#0b0f14; --panel:#121922; --ink:#e7eef6; --muted:#8aa0b4; --accent:#e8413a; --ok:#3ddc97; --warn:#f5a623; --line:#1f2b38; }
* { box-sizing: border-box; }
body { margin:0; font:16px/1.5 system-ui, sans-serif; background:var(--bg); color:var(--ink); }
header { display:flex; align-items:baseline; gap:1rem; padding:1rem 1.5rem; border-bottom:1px solid var(--line); }
h1 { font-size:1.2rem; margin:0; letter-spacing:.02em; }
.muted { color:var(--muted); } .error { color:var(--accent); }
.card { max-width:520px; margin:3rem auto; background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:1.5rem; }
.card label, .card input { display:block; width:100%; margin:.5rem 0; }
.card input { padding:.6rem; background:#0e151d; color:var(--ink); border:1px solid var(--line); border-radius:8px; }
.row { display:flex; gap:.75rem; margin-top:1rem; }
button { padding:.6rem 1rem; background:var(--accent); color:#fff; border:0; border-radius:8px; cursor:pointer; }
button.secondary, #newBtn { background:#243140; }
nav { display:flex; gap:.5rem; padding:.75rem 1.5rem; border-bottom:1px solid var(--line); align-items:center; }
nav .spacer { flex:1; }
nav button { background:transparent; color:var(--muted); }
nav button.active { color:var(--ink); border-bottom:2px solid var(--accent); border-radius:0; }
.tab { padding:1.5rem; }
.meter { height:8px; border-radius:6px; background:#0e151d; margin:.25rem 0 .5rem; overflow:hidden; }
.meter > span { display:block; height:100%; transition:width .15s; }
.m-unprotected>span{width:8%;background:#555} .m-weak>span{width:25%;background:var(--accent)}
.m-medium>span{width:50%;background:var(--warn)} .m-strong>span{width:75%;background:#7ad}
.m-super-strong>span{width:100%;background:var(--ok)}
.meter-label { font-size:.8rem; color:var(--muted); }
table { width:100%; border-collapse:collapse; } th,td { text-align:left; padding:.5rem; border-bottom:1px solid var(--line); }
.pill { font-size:.75rem; padding:.1rem .5rem; border-radius:999px; }
.pill.ot { background:#3a2a12; color:var(--warn); } .pill.ok { background:#10301f; color:var(--ok); }
.excluded td { color:var(--muted); }
```

- [ ] **Step 3: Write `src/ui.js` (shell, meter, unlock, load)**

```js
// src/ui.js
;(function () {
  const SB = (globalThis.SB ||= {});
  const $ = (id) => document.getElementById(id);
  const state = { settings: null, engineers: [], dirty: false };

  const showApp = () => {
    $('lock').hidden = true; $('tabs').hidden = false;
    showTab('roster'); markClean();
  };
  const markDirty = () => { state.dirty = true; $('fileState').textContent = 'Unsaved changes'; };
  const markClean = () => { state.dirty = false; $('fileState').textContent = 'Roster loaded'; };

  // password meter
  $('pw').addEventListener('input', (e) => {
    const s = SB.strength.passwordStrength(e.target.value);
    const m = $('meter'); m.className = 'meter m-' + s;
    m.innerHTML = '<span></span>';
    let lbl = $('meterLabel'); if (!lbl) { lbl = document.createElement('div'); lbl.id='meterLabel'; lbl.className='meter-label'; m.after(lbl); }
    lbl.textContent = 'Password: ' + s.replace('-', ' ');
  });

  $('newBtn').addEventListener('click', () => {
    state.settings = SB.demo.settings(); state.engineers = SB.demo.engineers(); showApp();
  });

  $('unlockBtn').addEventListener('click', async () => {
    $('lockError').hidden = true;
    const file = $('fileInput').files[0];
    if (!file) { showError('Choose a roster file first.'); return; }
    try {
      const env = JSON.parse(await file.text());
      const payload = await SB.crypto.decrypt(env, $('pw').value);
      state.settings = payload.settings; state.engineers = payload.engineers; showApp();
    } catch (e) { showError(e.message); }
  });
  const showError = (msg) => { const el = $('lockError'); el.textContent = msg; el.hidden = false; };

  // tabs
  document.querySelectorAll('#tabs button[data-tab]').forEach((b) =>
    b.addEventListener('click', () => showTab(b.dataset.tab)));
  function showTab(name) {
    document.querySelectorAll('#tabs button[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    for (const t of ['roster','nextpick','compliance']) $(t).hidden = (t !== name);
    if (name === 'roster') SB.ui.renderRoster();
    if (name === 'nextpick') SB.ui.renderNextPick();
    if (name === 'compliance') SB.ui.renderCompliance();
  }

  SB.ui = { state, markDirty, markClean, showTab };
})();
```

- [ ] **Step 4: Verify in a browser**

Run a static server so file paths resolve: `python3 -m http.server -d /home/viking/ThomassenPovoaHoldingAS/StormberryAS/GitHub/ServiceScheduler 8099`
Open `https://localhost:8099` is not applicable for a local static server; use `http://localhost:8099` ONLY locally for this dev check (never in any committed config or recommendation). Confirm: clicking "New roster (demo data)" reveals the tabs; typing in the password field moves the five-state meter through its labels.

(Render functions for the tabs land in Tasks 10 and 11; until then the tab bodies are empty.)

- [ ] **Step 5: Commit**

```bash
git add index.html style.css src/ui.js
git commit -m "feat: UI shell, password meter, unlock and demo-load"
```

---

### Task 10: Roster tab, engineer detail, compliance tab

**Files:**
- Modify: `src/ui.js` (add `renderRoster`, `renderEngineerDetail`, `renderCompliance` to `SB.ui`)

**Interfaces:**
- Consumes: `SB.ui.state`, `SB.rest`, `SB.compliance`, `SB.dates`

- [ ] **Step 1: Add render functions**

Append inside the `src/ui.js` IIFE, before `SB.ui = {...}`, then add the three functions to the exported object:

```js
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;' }[c]));
  const today = () => SB.dates.today();

  function renderRoster() {
    const rows = state.engineers.map((e) => {
      const bank = SB.rest.restDaysBank(e, today());
      const rest = bank > 0 ? `<span class="pill ot">${bank} rest days left</span>` : `<span class="pill ok">rested</span>`;
      return `<tr data-id="${e.id}"><td><a href="#" data-id="${e.id}">${esc(e.name)}</a></td>
        <td>${esc(e.nationalities.join(', '))}</td><td>${e.competence.length} skills</td><td>${rest}</td></tr>`;
    }).join('');
    $('roster').innerHTML = `<h2>Roster</h2><table><thead><tr><th>Name</th><th>Nationalities</th><th>Competence</th><th>Rest</th></tr></thead><tbody>${rows}</tbody></table><div id="detail"></div>`;
    $('roster').querySelectorAll('a[data-id]').forEach((a) =>
      a.addEventListener('click', (ev) => { ev.preventDefault(); renderEngineerDetail(a.dataset.id); }));
  }

  function renderEngineerDetail(id) {
    const e = state.engineers.find((x) => x.id === id); if (!e) return;
    const list = (arr, fn) => arr.map(fn).join('') || '<li class="muted">none</li>';
    $('detail').innerHTML = `<div class="card"><h3>${esc(e.name)}</h3>
      <p><strong>Nationalities:</strong> ${esc(e.nationalities.join(', '))}</p>
      <p><strong>Passports:</strong><ul>${list(e.passports, (p) => `<li>${esc(p.country)} ${esc(p.number)}, expires ${esc(p.expiry)}</li>`)}</ul></p>
      <p><strong>Visas:</strong><ul>${list(e.visas, (v) => `<li>${esc(v.country)}, expires ${esc(v.expiry)}</li>`)}</ul></p>
      <p><strong>Certificates:</strong><ul>${list(e.certs, (c) => `<li>${esc(c.type)}, expires ${esc(c.expiry)}</li>`)}</ul></p>
      <p><strong>Competence:</strong><ul>${list(e.competence, (c) => `<li>${esc(c.equipment)} / ${esc(c.repairType)} (level ${c.level})</li>`)}</ul></p>
      <p><strong>Rest days remaining:</strong> ${SB.rest.restDaysBank(e, today())}</p></div>`;
  }

  function renderCompliance() {
    const b = SB.compliance.expiringDocuments(state.engineers, today());
    const block = (title, items) => `<h3>${title}</h3>` + (items.length
      ? `<table><thead><tr><th>Who</th><th>Type</th><th>Detail</th><th>Expires</th><th>Days</th></tr></thead><tbody>` +
        items.map((i) => `<tr><td>${esc(i.who)}</td><td>${esc(i.kind)}</td><td>${esc(i.detail)}</td><td>${esc(i.expiry)}</td><td>${i.days}</td></tr>`).join('') + `</tbody></table>`
      : `<p class="muted">Nothing in this window.</p>`);
    const rest = SB.compliance.restOverview(state.engineers, today());
    const restBlock = rest.length
      ? `<table><thead><tr><th>Who</th><th>Rest days remaining</th></tr></thead><tbody>` +
        rest.map((r) => `<tr><td>${esc(r.name)}</td><td>${r.restDaysBank}</td></tr>`).join('') + `</tbody></table>`
      : `<p class="muted">Everyone is fully rested.</p>`;
    $('compliance').innerHTML = `<h2>Compliance</h2>${block('Expiring within 30 days', b.d30)}${block('31 to 60 days', b.d60)}${block('61 to 90 days', b.d90)}<h3>Currently resting</h3>${restBlock}`;
  }
```

Add `renderRoster, renderEngineerDetail, renderCompliance` to the `SB.ui = { ... }` export.

- [ ] **Step 2: Verify in a browser**

Reload the dev page, load demo data. Confirm: Roster lists 15 names with rest pills; clicking a name shows full detail including all passports; Compliance shows expiry buckets and a resting list. Check spelling is British throughout the visible copy.

- [ ] **Step 3: Commit**

```bash
git add src/ui.js
git commit -m "feat: roster, engineer detail, and compliance rendering"
```

---

### Task 11: Next-pick tab and save flow

**Files:**
- Modify: `src/ui.js` (add `renderNextPick` and the save handler)

**Interfaces:**
- Consumes: `SB.engine`, `SB.crypto`, `SB.dates`, `SB.ui.state`

- [ ] **Step 1: Add the next-pick form and result rendering**

Append inside the IIFE:

```js
  function renderNextPick() {
    const s = state.settings;
    const opts = (arr) => arr.map((x) => `<option>${esc(x)}</option>`).join('');
    const certChecks = s.certTypes.map((c) => `<label class="inline"><input type="checkbox" value="${esc(c)}" ${c==='offshore safety course'?'checked':''}> ${esc(c)}</label>`).join(' ');
    $('nextpick').innerHTML = `<h2>Find next pick</h2>
      <div class="card">
        <label>Equipment <select id="j_eq">${opts(s.equipment)}</select></label>
        <label>Repair type <select id="j_rep">${opts(s.repairTypes)}</select></label>
        <label>Destination country <select id="j_country">${opts(s.countries)}</select></label>
        <label class="inline"><input type="checkbox" id="j_off" checked> Offshore</label>
        <label>Start date <input type="date" id="j_start" value="2026-08-01"></label>
        <label>Duration (days) <input type="number" id="j_dur" value="10" min="1"></label>
        <div>Required certificates:<br>${certChecks}</div>
        <button id="runPick">Find engineers</button>
      </div>
      <div id="pickResult"></div>`;
    $('runPick').addEventListener('click', runPick);
  }

  function runPick() {
    const job = {
      title: 'Ad hoc job', equipment: $('j_eq').value, repairType: $('j_rep').value,
      country: $('j_country').value, offshore: $('j_off').checked,
      startDate: $('j_start').value, durationDays: Number($('j_dur').value),
      requiredCerts: [...document.querySelectorAll('#nextpick input[type=checkbox]:checked')].filter((c) => c.value).map((c) => c.value),
    };
    const r = SB.engine.nextPick(job, state.engineers, state.settings);
    const shortlist = r.shortlist.length
      ? `<table><thead><tr><th>Rank</th><th>Name</th><th>Status</th><th>Reason</th></tr></thead><tbody>` +
        r.shortlist.map((x, i) => `<tr><td>${i+1}</td><td>${esc(x.name)}</td><td>${x.overtime?'<span class="pill ot">overtime</span>':'<span class="pill ok">rested</span>'}</td><td>${esc(x.reason)}</td></tr>`).join('') + `</tbody></table>`
      : `<p class="muted">No eligible engineers for this job.</p>`;
    const RULE = { 'no-competence':'no matching competence', 'no-valid-passport':'passport invalid within 6 months', 'needs-visa':'no valid visa for destination', 'cert-missing-or-expired':'required certificate missing or expired', 'on-vacation':'on vacation during the job' };
    const excluded = r.excluded.length
      ? `<h3>Excluded</h3><table class="excluded"><tbody>` + r.excluded.map((x) => `<tr><td>${esc(x.name)}</td><td>${esc(RULE[x.failedRule]||x.failedRule)}</td></tr>`).join('') + `</tbody></table>`
      : '';
    $('pickResult').innerHTML = `<h3>Shortlist</h3>${shortlist}${excluded}`;
  }
```

Add `renderNextPick` to the `SB.ui` export.

- [ ] **Step 2: Add the save handler**

Append inside the IIFE and wire the button:

```js
  async function save() {
    const payload = { meta: { appVersion: 1 }, settings: state.settings, engineers: state.engineers };
    const env = await SB.crypto.encrypt(payload, $('pw').value);
    const blob = new Blob([JSON.stringify(env)], { type: 'application/json' });
    const d = new Date();
    const name = `scheduler-roster-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}.sbs`;
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    URL.revokeObjectURL(a.href); markClean();
  }
  $('saveBtn').addEventListener('click', save);
```

- [ ] **Step 3: Verify the full round-trip in a browser**

Load demo data, run a pick on the default crane job: confirm a ranked shortlist (rested first, an overtime row for the resting engineer) and an excluded list naming the missing-cert and vacation cases. Set a password, click Save, confirm a dated `.sbs` downloads. Reload the page, choose the file, enter the same password, Unlock: the roster returns. Enter the wrong password: the friendly error shows.

- [ ] **Step 4: Commit**

```bash
git add src/ui.js
git commit -m "feat: next-pick form, ranked result with exclusions, encrypted save"
```

---

### Task 12: Argon2id key derivation (enhancement, optional for Monday)

**Files:**
- Create: `vendor/hash-wasm-argon2.js` (vendored, pinned), `src/crypto-argon2.js`, `test/crypto-argon2.test.js`
- Modify: `package.json` (add `"hash-wasm":"<pinned>"` as a devDependency for the Node test only), `index.html` (add the two new scripts before `src/crypto.js`)

**Interfaces:**
- Produces: `SB.cryptoArgon2 = { deriveKey(password, saltBytes, params) -> Promise<CryptoKey> }`, and sets `SB.crypto.useArgon2 = true` so new saves use Argon2id; old PBKDF2 files still open.

- [ ] **Step 1: Vendor the library (pin the version)**

```bash
cd /home/viking/ThomassenPovoaHoldingAS/StormberryAS/GitHub/ServiceScheduler
npm pkg set devDependencies.hash-wasm="4.12.0"   # confirm latest stable on npm before pinning
npm install
cp node_modules/hash-wasm/dist/argon2.umd.min.js vendor/hash-wasm-argon2.js
```

The UMD build inlines its own wasm as base64, so no separate `.wasm` fetch and nothing external at runtime.

- [ ] **Step 2: Write the failing test**

```js
// test/crypto-argon2.test.js
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`
Expected: FAIL, `Cannot find module '../src/crypto-argon2.js'`.

- [ ] **Step 4: Write implementation**

```js
// src/crypto-argon2.js
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
```

- [ ] **Step 5: Run tests to verify they pass; add scripts to dev page**

Run: `npm test`
Expected: PASS. Then add to `index.html` immediately before the `src/crypto.js` line:
```html
  <script src="vendor/hash-wasm-argon2.js"></script>
  <script src="src/crypto-argon2.js"></script>
```
The UMD attaches a global; if it attaches as `hashwasm`, the browser path matches `globalThis.hashwasm.argon2id`. Verify in the browser console that `hashwasm.argon2id` exists; if the UMD global name differs, add a one-line alias in `src/crypto-argon2.js` (`globalThis.hashwasm ||= globalThis.<umdName>`).

- [ ] **Step 6: Commit**

```bash
git add vendor/hash-wasm-argon2.js src/crypto-argon2.js test/crypto-argon2.test.js package.json package-lock.json index.html
git commit -m "feat: Argon2id key derivation with PBKDF2 backward compatibility"
```

---

### Task 13: Single-file inliner and CNAME

**Files:**
- Create: `build.mjs`, `CNAME`
- Produces: `dist/index.html` (single self-contained page)

**Interfaces:**
- Consumes: `index.html`, `style.css`, all `src/*.js`, `vendor/hash-wasm-argon2.js`

- [ ] **Step 1: Write the inliner**

```js
// build.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const root = new URL('./', import.meta.url);
const read = (p) => readFile(new URL(p, root), 'utf8');

const order = [
  'vendor/hash-wasm-argon2.js', 'src/dates.js', 'src/rest.js', 'src/eligibility.js',
  'src/engine.js', 'src/strength.js', 'src/crypto-argon2.js', 'src/crypto.js',
  'src/compliance.js', 'src/demo.js', 'src/ui.js',
];

const css = await read('style.css');
let scripts = '';
for (const f of order) scripts += `\n/* ${f} */\n` + await read(f);

const csp = "default-src 'self'; connect-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'";
let html = await read('index.html');
// remove external link + script tags, inject inline style + one inline script + CSP meta
html = html.replace('<link rel="stylesheet" href="style.css">',
  `<meta http-equiv="Content-Security-Policy" content="${csp}">\n  <style>\n${css}\n  </style>`);
html = html.replace(/\n\s*<script src="[^"]+"><\/script>/g, '');
html = html.replace('</body>', `  <script>\n${scripts}\n  </script>\n</body>`);

await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('dist/index.html', root), html);

// guard: no external references survived
if (/\bsrc="|href="(?!#)/.test(html.replace(/href="#"/g, ''))) throw new Error('external reference left in dist');
if (/https?:\/\//.test(html)) console.warn('warning: an http(s) URL appears in dist, check it is not a network dependency');
console.log('dist/index.html written, bytes:', html.length);
```

- [ ] **Step 2: Create the CNAME and run the build**

```bash
printf 'scheduler.stormberry.as\n' > CNAME
node build.mjs
```
Expected: "dist/index.html written" with no thrown error.

- [ ] **Step 3: Verify the single file is self-contained and offline**

```bash
grep -c 'src=' dist/index.html   # expect 0
grep -c 'http' dist/index.html   # expect 0 (or only inside inline strings that are not network calls)
```
Open `dist/index.html` directly via `file://` in the browser. With dev-tools Network tab open, load demo data, run a pick, save, reload and unlock. Confirm zero network requests and that everything works. Then disconnect the network and repeat: behaviour is unchanged.

- [ ] **Step 4: Commit**

```bash
git add build.mjs CNAME
git commit -m "build: inline everything into a single self-contained dist/index.html"
```

---

### Task 14: Deploy to Cloudflare Pages (requires Marcos for auth/DNS)

**Files:**
- Uses: `dist/` and `CNAME`

This task touches an external service. Confirm with Marcos before running; he performs any Cloudflare login. Do not push to a public remote without his go-ahead.

- [ ] **Step 1: Confirm the deploy target with Marcos**

Cloudflare Pages project name and whether the custom domain `scheduler.stormberry.as` is added now or after the first deploy. The other Stormberry app repos use a `CNAME` plus a Pages project; mirror that.

- [ ] **Step 2: Deploy the dist directory**

```bash
cd /home/viking/ThomassenPovoaHoldingAS/StormberryAS/GitHub/ServiceScheduler
npx wrangler@latest pages deploy dist --project-name service-scheduler
```
(Wrangler handles auth interactively if needed. Marcos completes any browser login.)

- [ ] **Step 3: Add the custom domain**

In the Cloudflare dashboard (or `wrangler pages`), bind `scheduler.stormberry.as` to the Pages project. Confirm `https://scheduler.stormberry.as` serves the page over HTTPS, with the HSTS-only posture consistent with the other Stormberry zones.

- [ ] **Step 4: Live verification**

Visit `https://scheduler.stormberry.as`. With dev-tools Network tab open, exercise the full flow. Confirm the only request is the initial document (and favicon if present), zero data traffic, and that turning the network off mid-session changes nothing. This is the live demo proof for Monday.

- [ ] **Step 5: Commit any deploy config**

```bash
git add -A
git commit -m "chore: Cloudflare Pages deploy config for scheduler.stormberry.as"
```

---

## Self-Review

**Spec coverage:** local-first zero-knowledge (Tasks 6, 12, 13), multi-passport/nationality (Task 3, 8), vacation (Task 3, 8), rest-days bank + overtime (Tasks 2, 4), passport 6/12-month thresholds (Task 3), no-minimum password + five-state meter (Tasks 5, 9), three tabs (Tasks 9, 10, 11), compliance with rest overview (Task 7, 10), encrypted dated save (Task 11), single self-contained HTML (Task 13), live + offline (Tasks 13, 14), British English and CSP (Global Constraints, enforced in Tasks 9-13), synthetic demo data (Task 8). No spec requirement is left without a task.

**Placeholder scan:** one deliberate red flag planted in Task 8 (`'LARS'in{}? ...`) with an explicit instruction to remove it, exercising the implementer's "every string must come from the master lists" check. No other placeholders.

**Type consistency:** `evaluate` returns `{eligible, failedRule, passportWarning}` and is consumed that way in `nextPick`; `restDaysBank(engineer, refMs)` signature is consistent across rest/engine/compliance/ui; `expiringDocuments(engineers, asOfMs)` matches its caller in Task 10; envelope shape from Task 6 is consumed unchanged in Tasks 11, 12, 13.

## Execution Handoff

Plan complete. Offer execution choice at handoff (subagent-driven vs inline).
