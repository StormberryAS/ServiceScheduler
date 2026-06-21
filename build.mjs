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
let html = await read('index.html');
// remove external link + script tags, inject inline style + one inline script + CSP meta
html = html.replace('<link rel="stylesheet" href="style.css">',
  `<meta http-equiv="Content-Security-Policy" content="${csp}">\n  <style>\n${css}\n  </style>`);
html = html.replace(/\n\s*<script src="[^"]+"><\/script>/g, '');
html = html.replace('</body>', `  <script>\n${scripts}\n  </script>\n</body>`);

await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('dist/index.html', root), html);
await writeFile(new URL('dist/_headers', root), await read('_headers'));
await writeFile(new URL('dist/favicon.svg', root), await read('favicon.svg'));

// guard: code must be inlined (no external <script src> or stylesheet <link>). External
// images and anchor links are allowed (e.g. the Stormberry app-switcher carousel and footer links).
if (/<script\b[^>]*\bsrc=/i.test(html)) throw new Error('external <script src> left in dist');
if (/<link\b[^>]*rel=["']?stylesheet/i.test(html)) throw new Error('external stylesheet link left in dist');
console.log('dist/index.html written, bytes:', html.length);
