// Stamps the page's stylesheet and entry-script links with a hash of each file (css/site.css?v=1a2b3c4d),
// so a browser holding an older copy (Pages lets it keep files for 10 minutes) never pairs new HTML with
// old CSS. Run before every publish. eggs.js stays unstamped: cmdk.js imports it by its plain URL, and two
// URLs for one module would run it twice.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const ROOT = new URL('../', import.meta.url);
let stamped = false;
for (const name of ['index.html', '404.html']) { // the 404 page shares site.css, so it needs the same stamp
  const page = new URL(name, ROOT);
  const html = await readFile(page, 'utf8');
  let out = html;
  for (const m of html.matchAll(/(href|src)="((?:css|js)\/[\w-]+\.(?:css|js))(?:\?v=[\da-f]+)?"/g)) {
    const [all, attr, file] = m;
    if (file === 'js/eggs.js') continue;
    const hash = createHash('sha1').update(await readFile(new URL(file, ROOT))).digest('hex').slice(0, 8);
    out = out.replace(all, `${attr}="${file}?v=${hash}"`);
  }
  if (out !== html) { await writeFile(page, out); stamped = true; }
}
console.log(stamped ? 'stamped' : 'stamps current');
