// Stamps the page's stylesheet and entry-script links with a hash of each file (css/site.css?v=1a2b3c4d),
// so a browser holding an older copy (Pages lets it keep files for 10 minutes) never pairs new HTML with
// old CSS. Run before every publish. eggs.js stays unstamped: cmdk.js imports it by its plain URL, and two
// URLs for one module would run it twice.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const ROOT = new URL('../', import.meta.url);
const PAGE = new URL('index.html', ROOT);
const html = await readFile(PAGE, 'utf8');
let out = html;
for (const m of html.matchAll(/(href|src)="((?:css|js)\/[\w-]+\.(?:css|js))(?:\?v=[\da-f]+)?"/g)) {
  const [all, attr, file] = m;
  if (file === 'js/eggs.js') continue;
  const hash = createHash('sha1').update(await readFile(new URL(file, ROOT))).digest('hex').slice(0, 8);
  out = out.replace(all, `${attr}="${file}?v=${hash}"`);
}
if (out !== html) await writeFile(PAGE, out);
console.log(out !== html ? 'stamped' : 'stamps current');
