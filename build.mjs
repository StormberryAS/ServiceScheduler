// build.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const root = new URL('./', import.meta.url);
const read = (p) => readFile(new URL(p, root), 'utf8');

const order = [
  'src/dates.js', 'src/rest.js', 'src/eligibility.js',
  'src/engine.js', 'src/strength.js', 'src/crypto.js',
  'src/compliance.js', 'src/demo.js', 'src/countries.js', 'src/jobs.js', 'src/ui.js',
];

const css = await read('style.css');
let scripts = '';
for (const f of order) scripts += `\n/* ${f} */\n` + await read(f);

const csp = "default-src 'self'; connect-src 'none'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'";
let html = await read('index.dev.html');
// strip the dev entry's own CSP meta first, so the inlined build carries exactly one
// (the dev meta forbids inline code, which would otherwise block the inlined script/style)
html = html.replace(/[ \t]*<meta http-equiv=["']Content-Security-Policy["'][^>]*>\s*\n?/gi, '');
// inline every SVG favicon as a data URI so the deployed page fetches zero external subresources
const dataURI = (buf) => 'data:image/svg+xml;base64,' + Buffer.from(buf).toString('base64');
const localFav = dataURI(await readFile(new URL('favicon.svg', root)));
html = html.replaceAll('href="favicon.svg"', `href="${localFav}"`).replaceAll('src="favicon.svg"', `src="${localFav}"`);
const siblingFavicons = {
  'https://stormberry.as/labs-favicon.svg': 'favicons/labs.svg',
  'https://sun.stormberry.as/favicon.svg': 'favicons/sun.svg',
  'https://moon.stormberry.as/favicon.svg': 'favicons/moon.svg',
  'https://photo.stormberry.as/favicon.svg': 'favicons/photo.svg',
  'https://garden.stormberry.as/favicon.svg': 'favicons/garden.svg',
  'https://planet.stormberry.as/favicon.svg': 'favicons/planet.svg',
  'https://astro.stormberry.as/favicon.svg': 'favicons/astro.svg',
  'https://star.stormberry.as/favicon.svg': 'favicons/star.svg',
};
for (const [url, path] of Object.entries(siblingFavicons)) html = html.replaceAll(url, dataURI(await readFile(new URL(path, root))));
// remove external link + script tags, inject inline style + one inline script + CSP meta
html = html.replace('<link rel="stylesheet" href="style.css">',
  `<meta http-equiv="Content-Security-Policy" content="${csp}">\n  <style>\n${css}\n  </style>`);
html = html.replace(/\n\s*<script src="[^"]+"><\/script>/g, '');
html = html.replace('</body>', `  <script>\n${scripts}\n  </script>\n</body>`);

await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('dist/index.html', root), html);
await writeFile(new URL('dist/_headers', root), await read('_headers'));
await writeFile(new URL('dist/favicon.svg', root), await read('favicon.svg'));
// GitHub Pages serves the repo root; the served index.html IS the self-contained build,
// so the live site is one auditable file with no external code requests.
await writeFile(new URL('index.html', root), html);

// guard: code must be inlined (no external <script src> or stylesheet <link>). External
// images and anchor links are allowed (e.g. the Stormberry app-switcher carousel and footer links).
if (/<script\b[^>]*\bsrc=/i.test(html)) throw new Error('external <script src> left in dist');
if (/<link\b[^>]*rel=["']?stylesheet/i.test(html)) throw new Error('external stylesheet link left in dist');
if (/\bsrc=["']https?:/i.test(html)) throw new Error('external subresource src left in dist (favicon not inlined?)');
console.log('dist/index.html written, bytes:', html.length);
