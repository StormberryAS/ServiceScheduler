# ServiceScheduler, design spec

Date: 2026-06-20
Status: draft for review (revised after first review pass)
Working name: ServiceScheduler (repo folder `ServiceScheduler`, subdomain `scheduler.stormberry.as`).

## 1. Purpose

A local-first, zero-knowledge scheduling tool for offshore field-service teams. It answers one operational question: given a job that needs a specific piece of equipment repaired in a specific country on a specific date, who is the right engineer to send, accounting for skills, travel documents, safety certificates, vacation, and mandatory rest after offshore work.

Purpose: a vendor-neutral example of Stormberry's "functioning prototype to start an idea" approach, and of privacy-by-design done properly. The equipment taxonomy is generic on purpose so the demo doubles as a portfolio piece, and it demonstrates the Service Manager domain end to end: workforce scheduling, certificate compliance, dispatch logic, and the cost of disturbing mandatory rest.

## 2. Goals and success criteria

- A service manager can load an encrypted roster file, unlock it with a password, and immediately get a defensible answer to "who do I send for this job".
- The sensitive workforce data never leaves the operator's device. This is provable live: dev-tools network tab shows zero data traffic, and the tool keeps working with the network off.
- The dispatch logic is transparent on screen (why each engineer is eligible, the rest-day cost of choosing them, and why others were excluded).
- A compliance view surfaces expiring passports, visas, and certificates, and the current rest-day position of the team, before any of them causes a failed or expensive mobilisation.
- v1 is clean and demo-ready quickly. v2 and v3 exist as a roadmap and as post-launch build targets.

## 3. Non-goals for v1 (YAGNI)

- No backend, no database, no accounts, no cloud storage of data.
- No passport images or document scans. Passport information only.
- No team picking (lead plus assistant), no calendar/Gantt view, no full bookings/overlap model. These are v2.
- No multi-user concurrency, no sync, no audit log. These are v3.
- No real personal data. Synthetic engineers only.

## 4. Security and privacy model (the heart of this app)

**Assets protected:** workforce personal data, names, nationalities, passport numbers, visa records, certificate records. Even without images this is personal data and warrants real protection.

**Adversaries considered:**
- An honest-but-curious or compromised host (Stormberry, Cloudflare). The server only ever serves static code; it never receives the data file or the password. There is nothing on the server to steal.
- A network eavesdropper. No data is transmitted at any point. TLS protects the delivery of the code itself.
- A thief who obtains the encrypted file. They face PBKDF2-SHA256 (600,000 iterations) plus AES-256-GCM; security then reduces to the strength of the operator's password.

**Guarantees:**
- Zero-knowledge: decryption, all editing, the scheduling logic, and re-encryption happen entirely in the browser. Ciphertext is produced client-side and saved to the operator's disk; it is never uploaded.
- Authenticated encryption: a wrong password or a tampered file fails cleanly rather than returning garbage.
- No external calls after load. The build is self-contained (see Architecture); a strict Content-Security-Policy forbids outbound connections.

**Password policy (operator's choice, by design):**
- No minimum. A password can be weak, or empty (no password at all). The tool never blocks a save.
- While the operator types, a live meter shows the strength as one of five states: **Unprotected** (empty), **Weak**, **Medium**, **Strong**, **Super strong**.
- An empty password still runs the same encryption pipeline, so the file format is uniform, but it offers no real protection; the meter and a clear note say so plainly. This is a deliberate sovereignty stance: the operator decides their own risk.

**Residual risks, stated honestly (and useful talking points):**
- Weak or empty password equals weak or no protection. The meter informs; it does not coerce.
- No password recovery when a password is set, by design. Lose it and the data is gone. This is the cost of genuine zero-knowledge.
- A compromised operator device (malware, keylogger) is out of scope; no browser app can defend against that.
- The operator owns file storage, backup, and secure deletion. Dated save files accumulate; old versions still contain sensitive ciphertext.
- Supply chain: the crypto library is vendored and pinned, never loaded from a CDN.

## 5. Architecture

A **single self-contained static HTML application**. The CSS and JavaScript are inlined, so the app loads no external code. After load it makes no data requests and works fully offline; the only optional external fetches are the sibling-app favicon images in the footer carousel. Consequences:

- It runs by simply opening the file. Offline operation is the default, not a feature bolted on.
- It is trivially auditable: one file, no build artefacts to reason about, no bundler opacity.
- The sovereignty claim is demonstrable: open dev-tools, use the whole app, observe no requests; then disconnect the network and continue working.

The server's only job is to deliver this file over HTTPS at `scheduler.stormberry.as`. It is a content-delivery endpoint, not an application backend.

## 6. Data model

**Engineer**
- `name`
- `nationalities`: list of countries (a person can hold more than one)
- `passports`: list of `{ country, number, expiry }` (a person can hold more than one passport; this is a real advantage for travel access)
- `visas`: list of `{ country, expiry }`
- `certs`: list of `{ type, expiry }` where `type` is drawn from the settings cert list
- `competence`: list of `{ equipment, repairType, level }` where `level` is 1 to 3
- `availability`:
  - `lastOffshore`: `{ end, durationDays }` (when the last offshore trip ended and how long it was)
  - `restDaysOverride`: optional, overrides the default rest entitlement
  - `vacations`: list of `{ start, end }` (planned time off)

**Rest model (the important metric).** By default, the rest entitlement after a trip equals the length of that trip (`restDays = lastOffshore.durationDays`, unless `restDaysOverride` is set). From it:
- `restCompleteDate = lastOffshore.end + restDays`
- **RestDaysBank** = `max(0, restCompleteDate - referenceDate)`, the number of rest days the person still has owed to them as of a reference date. In the roster the reference date is today; in the next-pick screen it is the job start date, which yields the rest days that would be burned if this person is sent.
- In Norway, sending someone on a job before their rest is complete triggers extra/overtime pay. The tool therefore never hides a still-resting engineer; it surfaces their RestDaysBank as a cost signal so the manager makes the trade-off knowingly.

**Job**
- `title`
- `equipment` (from settings)
- `repairType` (from settings)
- `country` (destination)
- `offshore` (boolean)
- `startDate`, `durationDays`
- `requiredCerts`: list of cert types

**Settings**
- `restRule`: default "equal to previous trip length" (per-engineer override allowed)
- `passportInvalidMonths`: 6 (a passport with less than this much validity beyond job end cannot be used for international travel; hard rule)
- `passportBufferMonths`: 12 (a passport with less than this much validity is still usable but flagged as approaching the limit; warning)
- master lists: `equipment`, `repairTypes`, `certTypes`, `countries`

**v1 equipment list (generic offshore):** offshore crane, winch system, Launch and Recovery System (LARS), lifeboat/davit system, hydraulic power unit (HPU) / control system.

**v1 repair types:** preventive (scheduled) service, corrective (breakdown) repair, overhaul and recertification (including load test).

**v1 cert types:** offshore safety course (BOSIET-equivalent), sea survival, H2S awareness, working-at-height, first aid. (Generic names; the real taxonomy is a v2 talking point.)

## 7. Encrypted file format

A text JSON envelope so it is portable and inspectable:

```
{
  "format": "service-scheduler",
  "version": 1,
  "kdf": { "algo": "pbkdf2", "hash": "SHA-256", "iterations": 600000, "saltB64": "..." },
  "cipher": "AES-256-GCM",
  "ivB64": "...",
  "ciphertextB64": "..."
}
```

- `ciphertextB64` is AES-256-GCM over the (optionally gzip-compressed) JSON payload. GCM tag appended.
- Key derivation: PBKDF2-SHA256 at 600,000 iterations with a 16-byte random salt, deriving a 256-bit AES-GCM key. An empty password runs the same derivation (offering no real protection, by design).
- AES-GCM: 12-byte random IV, 128-bit tag, native WebCrypto.
- Compression: native `CompressionStream` (gzip) when available; skipped otherwise (payload is text and small).
- Save produces a fresh dated file: `scheduler-roster-YYYY-MM-DD.sbs`. Each save is a new version; the operator keeps whatever history they want.

**Payload**
```
{
  "meta": { "createdAt", "updatedAt", "appVersion" },
  "settings": { ... },
  "engineers": [ ... ],
  "jobs": [ ... ]
}
```

## 8. The next-pick engine

Two stages, both transparent on screen.

**Hard filters (an engineer must pass all to be eligible):**
1. Competence: has the required `equipment` plus `repairType` capability at any level.
2. Travel documents (international job, where `job.country` is not one of the engineer's nationalities):
   - holds a valid visa for `job.country` valid through job end, carried on a passport that is itself valid for at least `passportInvalidMonths` (6) beyond job end; or
   - holds a passport of `job.country` valid for at least `passportInvalidMonths` beyond job end.
   For a domestic job (`job.country` is one of their nationalities), no visa is needed and the validity buffer does not apply.
3. Certificates: holds every cert in `job.requiredCerts`, each valid through job end; if `job.offshore`, the offshore safety course must be valid.
4. Vacation: not on vacation overlapping the job window `[startDate, endDate]`.

Rest is deliberately **not** a hard filter. A still-resting engineer remains eligible; their cost is surfaced instead.

**Ranking (v1, rest-aware):**
1. Fully-rested engineers first (RestDaysBank at job start is 0, no overtime).
2. Then still-resting engineers, ordered by fewest rest days remaining first (cheapest overtime), each flagged "N rest days remaining at start, overtime applies".

Richer soft-ranking (competence-level weighting, proximity, cost optimisation) is v2.

**Output:** a ranked shortlist, each row carrying a short reason and its RestDaysBank/overtime flag, plus a separate "excluded because..." list naming the first failed hard rule per excluded engineer (no competence, passport invalid within 6 months, needs a visa, certificate expired, on vacation). The excluded list makes the logic auditable on screen and signals operational seriousness.

## 9. UI and screens

All copy in British English (see section 12).

- **Lock screen:** open an existing `.sbs` file plus password, or start a new roster (blank or seeded demo set). The password field carries the live five-state strength meter.
- **Roster tab:** list of all engineers; selecting one shows the full detail (all passports with country/number/expiry, nationalities, visas, certificates, competence matrix, vacation, and current RestDaysBank).
- **Find next pick tab:** a short form to define a job (equipment, repair type, destination country, offshore toggle, start date, duration, required certs), then the ranked result (with each candidate's rest/overtime position) and the excluded list.
- **Compliance tab:** passports, visas, and certificates expiring within 30 / 60 / 90 days (and passports already inside the 6-month invalid window), plus a rest overview showing who is currently resting and their RestDaysBank.
- **Save:** re-encrypts and downloads the dated file. A clear unsaved-changes indicator.

Visual language reuses the Stormberry design system already used by the other demo apps (fonts, palette, dark cinematic styling).

## 10. Tech stack and dependencies

- Vanilla HTML, CSS, JavaScript. No framework, no build step for v1. Rationale: trivial offline operation, full auditability, nothing to break before Monday.
- Crypto: native WebCrypto only (AES-256-GCM with PBKDF2-SHA256 key derivation). No WebAssembly, no CDN. (Argon2id was originally planned but removed because the deployment CSP blocks WebAssembly.)
- Everything inlined into one self-contained `index.html` for the zero-post-load-request property.
- Strict CSP (`default-src 'self'`, no external origins; ideally `connect-src 'none'`).

## 11. Hosting and deployment

- Cloudflare Pages project serving the single HTML at `scheduler.stormberry.as` (CNAME, same pattern as the other Stormberry demo apps), HTTPS enforced.
- Also fully runnable offline: opening the file works; turning the network off mid-use changes nothing.
- New git repository in `GitHub/ServiceScheduler/`, mirroring the structure of the existing app repos.

## 12. British English and branding (binding)

- All user-facing text and all documentation in British English (organise, prioritise, colour, centre, licence as a noun, etc.).
- CSS properties, JS identifiers, and HTML attributes keep their American spelling (`color`, `text-align`); that is language syntax, not prose.
- No em dashes and no double hyphens in any copy or docs.
- Stormberry visual identity throughout.

## 13. Demo data

15 synthetic engineers spanning several nationalities, with realistic variety in passports (some dual-passport), visas, certificates, vacation, and rest position. Deliberate edge cases so the views have something to show:
- one with a passport inside the 6-month invalid window for a given destination,
- one still inside post-trip mandatory rest (non-zero RestDaysBank), to show the overtime flag,
- one on vacation across the job window,
- one who matches the equipment but is missing a required certificate,
- one dual-national who needs no visa where a single-national would,
- one who is the obvious clean, fully-rested pick.
Passport information only, no scans. No real people.

## 14. Roadmap

**v1 (Monday, must ship):** encrypted local file (load/unlock/edit/save dated file) with the five-state password meter and no-password option; 15 synthetic engineers with multiple passports/nationalities; Roster / Find next pick / Compliance tabs; the rest-days-bank metric and overtime-aware ranking; hard-filter engine with reasons and exclusions; vacation handling; Stormberry branding; live at `scheduler.stormberry.as` and offline-capable.

**v2 (credibility depth, build if time allows; otherwise spoken roadmap):** offshore medical certificate dimension; richer rest/rotation rules (max consecutive days, travel days); competence tiers and full soft-ranking (proximity, cost optimisation); two-person team picks (lead plus assistant); realistic OPITO/GWO/Norwegian certificate taxonomy; in-app add and edit of engineers and jobs; bookings model with schedule view and double-booking detection.

**v3 (product vision, talking points):** encrypted change/audit log inside the file; optional end-to-end-encrypted sync between an operator's own devices (the server still cannot read it); CSV/Excel import from what teams keep today; utilisation and certificate-expiry forecasting and training planning; printable dispatch/job-pack export; Norwegian and English; role-based read-only sharing.

## 15. Decisions log

- Scope: full ambition, staged v1/v2/v3; ship v1 by Monday. (Marcos, 2026-06-20)
- Passports: information only, no images; multiple passports per person, each `{country, number, expiry}`; multiple nationalities per person. (Marcos, 2026-06-20)
- Equipment taxonomy: generic offshore, vendor-neutral, so it doubles as a Stormberry showcase. (Marcos, 2026-06-20)
- Run mode for Monday: live at `scheduler.stormberry.as` plus fully offline. (Marcos, 2026-06-20)
- Language: British English everywhere. (Marcos, 2026-06-20)
- Repo folder: `ServiceScheduler`; product name stays "ServiceScheduler". (Marcos, 2026-06-20)
- Availability includes vacation. (Marcos, 2026-06-20)
- Rest default equals previous trip length; expose a RestDaysBank; rest is a cost signal (overtime), not a hard block. (Marcos, 2026-06-20)
- Passport thresholds: `passportInvalidMonths` 6 (hard), `passportBufferMonths` 12 (warning). (Marcos, 2026-06-20)
- Password: no minimum, empty allowed; live five-state meter (Unprotected / Weak / Medium / Strong / Super strong). (Marcos, 2026-06-20)
- Soft-ranking refinements: v2. (Marcos, 2026-06-20)

## 16. Open questions

- Overtime is surfaced as rest days burned, not as a currency amount, in v1. A configurable overtime pay rate (kr/day) could turn the bank into a cost figure; candidate for v2.
