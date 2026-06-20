# ServiceScheduler

Organise your team's schedule. A local-first, zero-knowledge planner for offshore field-service teams: it picks the right service engineer for a job from skills, travel documents, certificates, vacation and post-trip rest, and keeps every record encrypted on your own device.

Live: [scheduler.stormberry.as](https://scheduler.stormberry.as)

## What it does

- **Find next pick.** Describe a job (equipment, repair type, destination country, offshore or not, start date, duration, required certificates) and get a ranked shortlist of eligible engineers, each with the reason they qualify, plus an "excluded because..." list so the logic is visible.
- **Availability-aware ranking.** Rest after offshore work is a signed score: a negative value means rest days are still owed (sending the engineer early triggers overtime), zero means available today, a positive value means idle and ready. The most available engineer is prioritised.
- **Roster.** Every engineer with nationalities, multiple passports, visas, certificates, a competence matrix and current availability. Edit any of it in place, or add a new engineer.
- **Compliance.** A month calendar that flags every passport, visa and certificate one year before it expires, so renewals never surprise a mobilisation.
- **Settings.** Manage the equipment, repair-type, certificate-type and visa-type lists that drive the dropdowns.

## Privacy model

The website is only the tool. It serves code, never data.

- All decryption, editing, scheduling and re-encryption happen in the browser.
- The roster is a single encrypted file you hold. It is never uploaded; nothing is sent anywhere (the page makes no network requests after it loads, and works fully offline).
- Encryption is **AES-256-GCM** with a key derived by **PBKDF2-SHA256** (600,000 iterations). A wrong password or a tampered file fails cleanly. There is no password recovery by design; that is the cost of genuine zero-knowledge.
- You set or change the password when you save. A blank password is allowed and is clearly marked as unprotected.

## Using it

Open the live site (or the single `dist/index.html` file directly, even offline), then either **New roster** to start from demo data, or open an existing `.sbs` file and unlock it with its password. Saving writes a fresh dated file, `service-scheduler-YYYY-MM-DD.sbs`. **Quit** closes the file and returns to the start page.

## Build and test

No framework, no bundler. The logic lives in small files under `src/`, tested with Node's built-in runner; a small inliner concatenates everything into one self-contained `dist/index.html`.

```sh
npm test        # run the unit tests (Node 20+)
node build.mjs  # produce dist/index.html (+ _headers, favicon) for deployment
```

For local development, open `index.html` (it loads the `src/` files directly).

## Licence

Part of the Stormberry ecosystem.
