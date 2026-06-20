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

const csp = "default-src 'self'; connect-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'";
let html = await read('index.html');
// remove external link + script tags, inject inline style + one inline script + CSP meta
html = html.replace('<link rel="stylesheet" href="style.css">',
  `<meta http-equiv="Content-Security-Policy" content="${csp}">\n  <style>\n${css}\n  </style>`);
html = html.replace(/\n\s*<script src="[^"]+"><\/script>/g, '');
html = html.replace('</body>', `  <script>\n${scripts}\n  </script>\n</body>`);

await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('dist/index.html', root), html);
await writeFile(new URL('dist/_headers', root), await read('_headers'));

// guard: no external references survived
if (/\bsrc="|href="(?!#)/.test(html.replace(/href="#"/g, ''))) throw new Error('external reference left in dist');
if (/https?:\/\//.test(html)) console.warn('warning: an http(s) URL appears in dist, check it is not a network dependency');
console.log('dist/index.html written, bytes:', html.length);
