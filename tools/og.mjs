import { createHash } from 'node:crypto';
import { access, copyFile, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const ASSETS = join(ROOT, 'assets');
const LIVE = join(ASSETS, 'data/live.json');
const OG_STATE = join(ASSETS, 'data/og.json');
const OG_PNG = join(ASSETS, 'og.png');
const PAGE = join(ROOT, 'index.html');
const FIGURE_WIDTH = 790;
const PUBLIC_OG_URL = 'https://justabdulaziz10.github.io/Abdulaziz/assets/og.png';

const htmlEscape = value => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

function localAsset(assetBase, path) {
  const base = assetBase.endsWith('/') ? assetBase : `${assetBase}/`;
  return new URL(path, base).href;
}

function updatedLabel(data) {
  const date = new Date(data?.updated);
  if (!Number.isFinite(date.getTime())) return 'Updated date unavailable';
  const formatted = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(date);
  return `Updated ${formatted}`;
}

export function ogHtml(data, assetBase) {
  const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
  const specs = [
    { value: data?.github?.total, label: 'contributions<br>in the last year' },
    { value: data?.revenuecat?.echo?.activeUsers, label: 'active Echo users<br>in the last 28 days' },
    { value: data?.apps?.echo?.rating, label: 'App Store rating<br>for Echo' },
  ];
  const figures = specs.filter(figure => typeof figure.value === 'number' && Number.isFinite(figure.value));
  const figureMarkup = figures.map((figure, index) => {
    const center = ((index + 0.5) * FIGURE_WIDTH / figures.length).toFixed(2);
    return `
    <div class="figure" style="left:${center}px">
      <div class="number">${number.format(figure.value)}</div>
      <div class="dot" aria-hidden="true"></div>
      <div class="label">${figure.label}</div>
    </div>`;
  }).join('');

  const mona = htmlEscape(localAsset(assetBase, 'fonts/mona-sans.woff2'));
  const mono = htmlEscape(localAsset(assetBase, 'fonts/martian-mono.woff2'));
  const icons = [
    ['icon-mara.webp', 812],
    ['icon-echo.webp', 890],
    ['icon-docmara.webp', 968],
  ].map(([file, x]) => `<img class="icon" src="${htmlEscape(localAsset(assetBase, `assets/img/${file}`))}" style="left:${x}px" alt="">`).join('\n    ');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  @font-face {
    font-family: "Mona Sans";
    src: url("${mona}") format("woff2-variations");
    font-weight: 200 900;
    font-stretch: 75% 125%;
    font-style: normal;
    font-display: swap;
  }
  @font-face {
    font-family: "Martian Mono";
    src: url("${mono}") format("woff2-variations");
    font-weight: 100 800;
    font-stretch: 75% 112.5%;
    font-display: swap;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; background: #f2f3ee; color: #121417; font-family: "Mona Sans", sans-serif; }
  .card { position: relative; width: 1200px; height: 630px; padding: 64px 72px; }
  .role { color: #4a4f57; font-size: 34px; font-weight: 600; font-stretch: 110%; }
  h1 { margin: 14px 0 0 -4px; font-size: 132px; line-height: .86; font-weight: 800; font-stretch: 125%; letter-spacing: -.035em; }
  .updated { position: absolute; top: 72px; right: 72px; color: #4a4f57; font: 500 14px "Martian Mono", monospace; }
  .bottom { position: absolute; left: 72px; right: 72px; bottom: 48px; height: 160px; }
  .track { position: absolute; left: 8px; top: 98px; width: 782px; height: 3px; border-radius: 2px; background: #121417; }
  .figure { position: absolute; top: 0; width: 240px; height: 160px; transform: translateX(-50%); text-align: center; }
  .number { position: absolute; top: 28px; left: 50%; transform: translateX(-50%); white-space: nowrap; font-size: 56px; line-height: .95; font-weight: 800; letter-spacing: -.035em; }
  .dot { position: absolute; z-index: 1; top: 99.5px; left: 50%; width: 14px; height: 14px; transform: translate(-50%, -50%); border: 3px solid #121417; border-radius: 50%; background: #f2f3ee; }
  .label { position: absolute; top: 117px; left: 50%; width: 240px; transform: translateX(-50%); font-size: 21px; line-height: 1.12; font-weight: 600; font-stretch: 104%; }
  .icon { position: absolute; top: 68px; width: 64px; height: 64px; border-radius: 14px; object-fit: cover; }
</style>
</head>
<body>
<main class="card">
  <div class="role">AI Product &amp; Systems</div>
  <h1>Abdulaziz<br>Alkhlaiwe</h1>
  <div class="updated">${htmlEscape(updatedLabel(data))}</div>
  <section class="bottom" aria-label="Live figures">
    <div class="track" aria-hidden="true"></div>${figureMarkup}
    ${icons}
  </section>
</main>
</body>
</html>
`;
}

function metaTagPattern(attribute, value) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`<meta\\b(?=[^>]*\\b${attribute}\\s*=\\s*(["'])${escaped}\\1)[^>]*>`, 'i');
}

function replaceMetaContent(html, pattern, content) {
  const matches = [...html.matchAll(new RegExp(pattern.source, 'gi'))];
  if (matches.length !== 1) throw new Error(`Expected one matching metadata tag, found ${matches.length}`);
  let replaced = false;
  const next = html.replace(pattern, tag => tag.replace(/(\bcontent\s*=\s*)(["'])[^"']*\2/i, (_all, prefix, quote) => {
    replaced = true;
    return `${prefix}${quote}${htmlEscape(content)}${quote}`;
  }));
  if (!replaced) throw new Error('Metadata tag has no content attribute');
  return next;
}

function updateSocialImage(html, url) {
  const ogImage = metaTagPattern('property', 'og:image');
  const twitterCard = metaTagPattern('name', 'twitter:card');
  const twitterImage = metaTagPattern('name', 'twitter:image');
  html = replaceMetaContent(html, ogImage, url);

  const card = twitterCard.exec(html);
  if (!card) throw new Error('Could not find twitter:card metadata tag');
  const cardEnd = card.index + card[0].length;
  const afterCard = html.slice(cardEnd);
  const whitespace = afterCard.match(/^(?:\r?\n[ \t]*)/);
  const immediateTag = whitespace ? twitterImage.exec(afterCard.slice(whitespace[0].length)) : null;
  if (immediateTag?.index === 0) return replaceMetaContent(html, twitterImage, url);

  const existingImage = twitterImage.exec(html);
  if (existingImage) html = html.slice(0, existingImage.index) + html.slice(existingImage.index + existingImage[0].length);
  const refreshedCard = twitterCard.exec(html);
  const insertion = refreshedCard.index + refreshedCard[0].length;
  const imageTag = `<meta name="twitter:image" content="${htmlEscape(url)}">`;
  return html.slice(0, insertion) + `\n${imageTag}` + html.slice(insertion);
}

async function executable(file) {
  try {
    const info = await stat(file);
    if (!info.isFile()) return false;
    await access(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function nonemptyFile(file) {
  try {
    const info = await stat(file);
    return info.isFile() && info.size > 0;
  } catch {
    return false;
  }
}

async function findChrome() {
  const pathEntries = (process.env.PATH ?? '').split(delimiter).filter(Boolean);
  const names = [
    ...(process.env.CHROME_PATH ? [process.env.CHROME_PATH] : []),
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
  ];
  const candidates = [];
  for (const name of names) {
    if (name.includes(sep) || name.startsWith('.')) candidates.push(resolve(name));
    else candidates.push(...pathEntries.map(directory => join(directory, name)));
  }
  candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  for (const candidate of candidates) if (await executable(candidate)) return candidate;
  return null;
}

async function main() {
  const data = JSON.parse(await readFile(LIVE, 'utf8'));
  const assetBase = pathToFileURL(ROOT.endsWith(sep) ? ROOT : `${ROOT}${sep}`).href;
  const displayData = data?.updated && Number.isFinite(new Date(data.updated).getTime())
    ? data
    : { ...data, updated: new Date().toISOString() };
  const html = ogHtml(displayData, assetBase);
  // hash the card with a placeholder asset base, so a Mac and the CI runner agree on the same content
  const hash = createHash('sha256').update(ogHtml(displayData, 'file:///site/')).digest('hex');
  const previous = await readFile(OG_STATE, 'utf8').then(JSON.parse).catch(() => null);
  if (previous?.hash === hash) {
    console.log(`OG image unchanged (${hash.slice(0, 8)}); skipping render.`);
    return;
  }

  const chrome = await findChrome();
  if (!chrome) {
    console.warn('Skipping OG image: Chrome/Chromium not found (set CHROME_PATH); assets/og.png left untouched.');
    return;
  }

  const nextUrl = `${PUBLIC_OG_URL}?v=${hash.slice(0, 8)}`;
  const page = await readFile(PAGE, 'utf8');
  const updatedPage = updateSocialImage(page, nextUrl);
  const tempDir = await mkdtemp(join(tmpdir(), 'site-og-'));
  const tempHtml = join(tempDir, 'card.html');
  const tempPng = join(tempDir, 'og.png');
  const stagedPng = join(ASSETS, `.og-${process.pid}-${Date.now()}.png`);
  try {
    await writeFile(tempHtml, html);
    const result = spawnSync(chrome, [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--window-size=1200,630',
      '--virtual-time-budget=4000',
      `--screenshot=${tempPng}`,
      pathToFileURL(tempHtml).href,
    ], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'], timeout: 60000 });
    // some Chrome builds write the screenshot and then exit non-zero on teardown; the file is what counts
    if (result.error || !(await nonemptyFile(tempPng))) {
      console.warn(`Skipping OG image: Chrome/Chromium screenshot failed${result.error ? ` (${result.error.message})` : ''}; assets/og.png and OG metadata left untouched.`);
      return;
    }

    await copyFile(tempPng, stagedPng);
    await rename(stagedPng, OG_PNG);
    await writeFile(PAGE, updatedPage);
    await writeFile(OG_STATE, `${JSON.stringify({ hash, updated: new Date().toISOString().slice(0, 10) }, null, 2)}\n`);
    console.log(`Rendered assets/og.png (${hash.slice(0, 8)}).`);
  } finally {
    await rm(stagedPng, { force: true }).catch(() => {});
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    console.warn(`Skipping OG image: ${error.message}; the data refresh can continue.`);
  });
}
