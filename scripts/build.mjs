import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const content = JSON.parse(await readFile(path.join(root, 'content/content.json'), 'utf8'));
const contributions = JSON.parse(await readFile(path.join(root, 'content/contributions.json'), 'utf8'));
const manifest = JSON.parse(await readFile(path.join(root, 'assets/manifest.json'), 'utf8'));
const template = await readFile(path.join(root, 'src/template.html'), 'utf8');
const assetInfo = new Map(manifest.map((entry) => [entry.file, entry]));
const usedAssets = new Set();
const fileExists = async (file) => access(path.join(root, file)).then(() => true, () => false);

const english = (value) => (typeof value === 'string' ? value : value?.en ?? '');
const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');
const local = (file) => './' + file;
const external = (url) => ' target="_blank" rel="noopener noreferrer"';
const safeUrl = (url) => escapeHtml(url);
const stackIcons = {
  'Swift': 'swift', 'SwiftUI': 'swift', 'Flutter': 'flutter', 'Dart': 'dart', 'Xcode': 'xcode',
  'TypeScript': 'typescript', 'Next.js': 'nextdotjs', 'React': 'react', 'Node.js': 'nodedotjs', 'Tailwind CSS': 'tailwindcss',
  'Python': 'python', 'FastAPI': 'fastapi', 'PostgreSQL': 'postgresql', 'Firebase': 'firebase', 'Supabase': 'supabase', 'Docker': 'docker',
  'PyTorch': 'pytorch', 'TensorFlow': 'tensorflow', 'Claude': 'anthropic', 'Gemini': 'googlegemini',
  'GitHub Actions': 'githubactions', 'GitLab CI': 'gitlab', 'Vercel': 'vercel', 'Cloudflare': 'cloudflare', 'Sentry': 'sentry', 'PostHog': 'posthog', 'RevenueCat': 'revenuecat'
};

const image = (file, alt, options = {}) => {
  usedAssets.add(file);
  const info = assetInfo.get(file) ?? {};
  const width = options.width ?? info.width;
  const height = options.height ?? info.height;
  const loading = options.loading ?? 'lazy';
  const decoding = options.decoding ?? 'async';
  const fetchpriority = options.fetchpriority ? ' fetchpriority="' + options.fetchpriority + '"' : '';
  const dimensions = width && height ? ' width="' + width + '" height="' + height + '"' : '';
  return '<img src="' + local(escapeHtml(file)) + '" alt="' + escapeHtml(alt) + '"' + dimensions + ' loading="' + loading + '" decoding="' + decoding + '"' + fetchpriority + '>';
};

const internalLinks = content.person.links.filter((link) => link.id !== 'mara');
const navLinks = content.ui.nav.map((item) => '<a href="#' + escapeHtml(item.id) + '">' + escapeHtml(english(item)) + '</a>').join('');
const mobileNavLinks = content.ui.nav.map((item) => '<a href="#' + escapeHtml(item.id) + '">' + escapeHtml(english(item)) + '</a>').join('');
const facts = content.about.facts.map((fact) => '<div class="fact"><dt>' + escapeHtml(english(fact.k)) + '</dt><dd>' + escapeHtml(english(fact.v)) + '</dd></div>').join('');
const aboutBody = content.about.body.en.map((paragraph) => '<p>' + escapeHtml(paragraph) + '</p>').join('');

const appAssets = {
  mara: ['assets/img/mara/mara-home-en-light.webp', 'assets/img/mara/mara-chat-en-light.webp'],
  echo: ['assets/img/apps/echo-screen-03.webp', 'assets/img/apps/echo-screen-04.webp'],
  docmara: ['assets/img/apps/docmara-screen-01.webp'],
  aghoo: ['assets/img/mara/mara-product-ribbon.webp']
};
const appIcons = {
  mara: 'assets/img/mara/mara-app-icon.webp',
  echo: 'assets/img/mara/echo-app-icon-192.webp',
  docmara: 'assets/img/mara/docmara-app-icon-site.webp',
  aghoo: 'assets/img/mara/aghoo-app-icon-256.webp'
};

const phone = (file, alt, secondary = false) => '<div class="phone' + (secondary ? ' phone--secondary' : '') + '" aria-label="' + escapeHtml(alt) + '"><div class="phone-screen">' + image(file, alt) + '<span class="dynamic-island" aria-hidden="true"></span></div></div>';

const apps = content.mara.apps.map((app) => {
  const iconFile = appIcons[app.id];
  const icon = image(iconFile, '', { loading: 'lazy' });
  let visual;
  if (app.id === 'aghoo') {
    visual = '<div class="app-visual app-visual--brand"><div class="aghoo-image">' + image(appAssets.aghoo[0], 'Mara product ribbon imagery', { loading: 'lazy' }) + '</div><div class="aghoo-icon">' + icon + '</div></div>';
  } else {
    const files = appAssets[app.id];
    visual = '<div class="phone-pair">' + phone(files[0], app.name.en + ' app screen') + (files[1] ? phone(files[1], app.name.en + ' app screen', true) : '') + '</div>';
  }
  const stack = app.stack.map((name) => '<li>' + escapeHtml(name) + '</li>').join('');
  return '<article class="app-scene" id="app-' + escapeHtml(app.id) + '" data-app-scene><div class="app-copy"><div class="app-heading"><span class="app-icon">' + icon + '</span><div><h3>' + escapeHtml(english(app.name)) + '</h3><p class="app-kind">' + escapeHtml(english(app.kind)) + '</p></div></div><p class="app-status">' + escapeHtml(english(app.status)) + '</p><p class="app-body">' + escapeHtml(english(app.body)) + '</p><ul class="app-stack" aria-label="' + escapeHtml(english(app.name)) + '">' + stack + '</ul><a class="text-link" href="' + safeUrl(app.url) + '"' + external(app.url) + '>' + escapeHtml(english(content.ui.visit)) + ' ' + escapeHtml(english(app.name)) + '</a></div><div class="app-visual">' + visual + '</div></article>';
}).join('');

const openSource = content.mara.openSource.items.map((item) => '<li><a href="' + safeUrl(item.url) + '"' + external(item.url) + '><span class="open-source-name">' + escapeHtml(item.name) + '</span><span class="open-source-description">' + escapeHtml(item.en) + '</span></a></li>').join('');
const appDots = content.mara.apps.map((app, index) => '<button class="scene-dot' + (index === 0 ? ' is-current' : '') + '" type="button" aria-label="' + escapeHtml(english(app.name)) + '" aria-current="' + (index === 0 ? 'true' : 'false') + '" data-scene-index="' + index + '"><span></span></button>').join('');

const projectFeature = (project) => {
  const desktopFile = 'assets/img/projects/' + project.id + '-live-desktop.webp';
  const mobileFile = 'assets/img/projects/' + project.id + '-live-mobile.' + (project.id === 'rassah' ? 'png' : 'webp');
  const media = '<div class="feature-media"><figure class="browser-frame"><div class="browser-chrome" aria-hidden="true"><span></span><span></span><span></span></div>' + image(desktopFile, project.name.en + ' live site on desktop') + '</figure><figure class="feature-phone" aria-label="' + escapeHtml(project.name.en) + ' mobile site">' + image(mobileFile, project.name.en + ' live site on mobile') + '</figure></div>';
  return '<article class="work-feature work-feature--' + escapeHtml(project.id) + '" id="work-' + escapeHtml(project.id) + '">' + media + '<div class="feature-copy"><p class="work-year">' + escapeHtml(project.year) + '</p><h3>' + escapeHtml(english(project.name)) + '</h3><p class="work-kind">' + escapeHtml(english(project.kind)) + '</p><p class="work-body">' + escapeHtml(english(project.body)) + '</p><ul class="work-stack">' + project.stack.map((item) => '<li>' + escapeHtml(item) + '</li>').join('') + '</ul><div class="work-links">' + (project.live ? '<a class="text-link" href="' + safeUrl(project.live) + '"' + external(project.live) + '>' + escapeHtml(english(content.ui.liveSite)) + '</a>' : '') + (project.repo ? '<a class="text-link" href="' + safeUrl(project.repo) + '"' + external(project.repo) + '>GitHub</a>' : '') + '</div></div></article>';
};
const featureProjects = content.work.items.filter((project) => ['rassah', 'pitlane'].includes(project.id));
const plainProjects = content.work.items.filter((project) => !['rassah', 'pitlane'].includes(project.id));
const plainWork = plainProjects.map((project) => '<article class="work-index-item"><p class="work-index-year"><span>' + escapeHtml(project.year) + '</span></p><div class="work-index-main"><button class="work-toggle" type="button" aria-expanded="true" aria-controls="work-detail-' + escapeHtml(project.id) + '"><span class="work-index-name">' + escapeHtml(english(project.name)) + '</span><span class="work-index-kind">' + escapeHtml(english(project.kind)) + '</span></button><div class="work-detail" id="work-detail-' + escapeHtml(project.id) + '"><p>' + escapeHtml(english(project.body)) + '</p><ul class="work-stack">' + project.stack.map((item) => '<li>' + escapeHtml(item) + '</li>').join('') + '</ul>' + (project.repo ? '<a class="text-link" href="' + safeUrl(project.repo) + '"' + external(project.repo) + '>GitHub</a>' : '') + '</div></div></article>').join('');

const contributionValues = contributions.days.map((day) => day[1]).filter((value) => value > 0).sort((a, b) => a - b);
const thresholds = [0.2, 0.4, 0.6, 0.8].map((quantile) => contributionValues[Math.min(contributionValues.length - 1, Math.floor(contributionValues.length * quantile))]);
const levelFor = (value) => value === 0 ? 0 : 1 + thresholds.findIndex((threshold) => value <= threshold);
const contributionSquares = contributions.days.map(([date, count], index) => {
  const column = Math.floor(index / 7);
  const row = index % 7;
  return '<rect class="contribution-cell level-' + levelFor(count) + '" x="' + (column * 14) + '" y="' + (row * 14) + '" width="10" height="10" rx="1" data-date="' + escapeHtml(date) + '" data-count="' + count + '" />';
}).join('');
const contributionSvg = '<div class="contribution-scroll" tabindex="0" aria-label="GitHub contribution history"><svg class="contribution-grid" viewBox="0 0 738 94" role="img" aria-labelledby="contribution-title"><title id="contribution-title">' + escapeHtml(english(content.record.body)) + '</title><g>' + contributionSquares + '</g></svg></div>';

const monthName = (month) => new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(new Date('2026-' + month + '-01T00:00:00Z'));
const pathItems = content.path.items.map((item) => {
  const [year, month] = item.date.split('-');
  return '<li class="path-entry"><time class="path-date" datetime="' + escapeHtml(item.date) + '"><span class="path-year">' + escapeHtml(year) + '</span><span class="path-month">' + escapeHtml(monthName(month)) + '</span></time><svg class="path-mark" viewBox="0 0 36 12" aria-hidden="true"><path d="M1 11 6 2l5 9Zm10 0 5-9 5 9Zm10 0 5-9 5 9Z" fill="currentColor" /></svg><p>' + escapeHtml(item.en) + '</p></li>';
}).join('');

const completedLearning = content.learning.done.map((course) => '<li><span class="course-name">' + escapeHtml(course.course) + '</span><span class="course-provider">' + escapeHtml(course.by) + '</span></li>').join('');
const currentLearning = content.learning.current.map((course) => {
  const parts = course.progress.split('/').map((part) => Number(part.trim()));
  const percentage = Math.round((parts[0] / parts[1]) * 100);
  const notes = course.notes ? '<a class="text-link" href="' + safeUrl(course.notes) + '"' + external(course.notes) + '>' + escapeHtml(english(content.ui.notes)) + '</a>' : '';
  return '<li class="current-course"><div class="course-row"><span class="course-name">' + escapeHtml(course.course) + '</span><span class="course-progress">' + escapeHtml(course.progress) + '</span></div><span class="course-provider">' + escapeHtml(course.by) + '</span><div class="progress-track" role="img" aria-label="' + escapeHtml(course.progress) + '"><span style="width:' + percentage + '%"></span></div>' + notes + '</li>';
}).join('');

const stackGroups = content.stack.groups.map((group) => '<div class="stack-group"><h3>' + escapeHtml(english(group.label)) + '</h3><ul>' + group.items.map((name) => {
  const icon = stackIcons[name];
  const iconMarkup = icon ? '<img src="' + local('assets/logos/tech/' + icon + '.svg') + '" alt="" loading="lazy" decoding="async">' : '';
  return '<li>' + iconMarkup + '<span>' + escapeHtml(name) + '</span></li>';
}).join('') + '</ul></div>').join('');

const offClock = content.offClock.items.map((item) => '<p>' + escapeHtml(item.en) + '</p>').join('');
const contactLinks = internalLinks.map((link) => '<li><a href="' + safeUrl(link.url) + '"' + external(link.url) + '><span>' + escapeHtml(link.label) + '</span><span class="contact-handle">' + escapeHtml(link.handle) + '</span></a></li>').join('');

for (const file of ['assets/img/places/riyadh-skyline-dusk-01.webp', 'assets/img/places/riyadh-kafd-night-03.webp', 'assets/img/places/riyadh-kingdom-tower-moody-05.webp', 'assets/img/places/diriyah-at-turaif-01.webp', 'assets/img/mara/mara-brand-icon-white.webp']) usedAssets.add(file);
const credits = manifest.filter((entry) => usedAssets.has(entry.file) && entry.credit && entry.license && entry.source_url).map((entry) => '<li><h3>' + escapeHtml(entry.subject) + '</h3><p>' + escapeHtml(entry.credit) + '</p><p>' + escapeHtml(entry.license) + '</p><a href="' + safeUrl(entry.source_url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(entry.source_url) + '</a></li>').join('');

const timeFormat = new Intl.DateTimeFormat('en-GB', { timeZone: content.person.timezone, hour: '2-digit', minute: '2-digit', hour12: false });
// Deterministic output: the live time is filled in by js/site.js.
const riyadhTime = 'GMT+3';
const riyadhDate = new Intl.DateTimeFormat('en-CA', { timeZone: content.person.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const sameAs = content.person.links.filter((link) => ['github', 'linkedin', 'x', 'gitlab'].includes(link.id)).map((link) => link.url);
const fontFiles = [
  'fonts/alexandria-latin.woff2', 'fonts/alexandria-arabic.woff2',
  'fonts/ibm-plex-sans-arabic-latin-400.woff2', 'fonts/ibm-plex-sans-arabic-arabic-400.woff2',
  'fonts/ibm-plex-sans-arabic-latin-500.woff2', 'fonts/ibm-plex-sans-arabic-arabic-500.woff2',
  'fonts/ibm-plex-sans-arabic-latin-600.woff2', 'fonts/ibm-plex-sans-arabic-arabic-600.woff2'
];
const vendorFiles = ['vendor/gsap/gsap.min.js', 'vendor/gsap/ScrollTrigger.min.js', 'vendor/lenis/lenis.min.js'];
const fontsAvailable = (await Promise.all(fontFiles.map(fileExists))).every(Boolean);
const vendorAvailable = (await Promise.all(vendorFiles.map(fileExists))).every(Boolean);
const fontFaces = fontsAvailable ? [
  '@font-face{font-family:Alexandria;src:url("../fonts/alexandria-latin.woff2") format("woff2");font-weight:100 900;font-display:swap}',
  '@font-face{font-family:Alexandria;src:url("../fonts/alexandria-arabic.woff2") format("woff2");font-weight:100 900;font-display:swap}',
  ...[400, 500, 600].flatMap((weight) => [
    '@font-face{font-family:"IBM Plex Sans Arabic";src:url("../fonts/ibm-plex-sans-arabic-latin-' + weight + '.woff2") format("woff2");font-weight:' + weight + ';font-display:swap}',
    '@font-face{font-family:"IBM Plex Sans Arabic";src:url("../fonts/ibm-plex-sans-arabic-arabic-' + weight + '.woff2") format("woff2");font-weight:' + weight + ';font-display:swap}'
  ])
].join('') : '';
const fontPreloads = fontsAvailable ? [
  '<link rel="preload" href="./fonts/alexandria-latin.woff2" as="font" type="font/woff2" crossorigin>',
  '<link rel="preload" href="./fonts/alexandria-arabic.woff2" as="font" type="font/woff2" crossorigin>',
  '<link rel="preload" href="./fonts/ibm-plex-sans-arabic-latin-400.woff2" as="font" type="font/woff2" crossorigin>'
].join('') : '';
const vendorScripts = vendorAvailable ? [
  '<script src="./vendor/gsap/gsap.min.js" defer></script>',
  '<script src="./vendor/gsap/ScrollTrigger.min.js" defer></script>',
  '<script src="./vendor/lenis/lenis.min.js" defer></script>'
].join('') : '';
const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: content.person.name.en,
  alternateName: content.person.name.ar,
  jobTitle: 'Founder & CEO',
  url: 'https://justabdulaziz10.github.io/Abdulaziz/',
  email: content.person.email,
  worksFor: { '@type': 'Organization', name: 'Mara', legalName: content.mara.legal.en, url: content.mara.url },
  sameAs,
  alumniOf: { '@type': 'CollegeOrUniversity', name: 'King Saud University' },
  affiliation: { '@type': 'CollegeOrUniversity', name: 'King Saud University' }
};

const values = {
  title: escapeHtml(content.person.name.en + ' — Founder & CEO of Mara'),
  description: escapeHtml(content.person.tagline.en),
  canonical: 'https://justabdulaziz10.github.io/Abdulaziz/',
  personName: escapeHtml(content.person.name.en),
  personShort: escapeHtml(content.person.short.en),
  personArabic: escapeHtml(content.person.name.ar),
  monogram: escapeHtml(content.person.monogram),
  role: escapeHtml(content.person.role.en),
  tagline: escapeHtml(content.person.tagline.en),
  localTimeLabel: escapeHtml(english(content.ui.localTime)),
  riyadhTime: escapeHtml(riyadhTime),
  riyadhDatetime: '+03:00',
  skip: escapeHtml(english(content.ui.skip)),
  navLinks,
  mobileNavLinks,
  aboutHeading: escapeHtml(english(content.about.heading)),
  aboutFacts: facts,
  aboutBody,
  maraHeading: escapeHtml(english(content.mara.heading)),
  maraIntro: escapeHtml(english(content.mara.intro)),
  maraLogo: image('assets/img/mara/mara-brand-icon-white.webp', 'Mara'),
  visitLabel: escapeHtml(english(content.ui.visit)),
  apps,
  openSourceHeading: escapeHtml(english(content.mara.openSource.heading)),
  openSourceItems: openSource,
  appDots,
  workHeading: escapeHtml(english(content.work.heading)),
  workFeatures: featureProjects.map(projectFeature).join(''),
  plainWork,
  recordHeading: escapeHtml(english(content.record.heading)),
  recordBody: escapeHtml(english(content.record.body)),
  recordStats: content.record.stats.map((stat) => '<span class="record-stat"><strong>' + escapeHtml(stat.value) + '</strong><span>' + escapeHtml(english(stat.label)) + '</span></span>').join(''),
  contributionGrid: contributionSvg,
  pathHeading: escapeHtml(english(content.path.heading)),
  pathItems,
  pathPhoto: image('assets/img/places/diriyah-at-turaif-01.webp', 'At-Turaif, Diriyah'),
  learningHeading: escapeHtml(english(content.learning.heading)),
  learningIntro: escapeHtml(english(content.learning.intro)),
  learningUrl: safeUrl(content.learning.url),
  completedLabel: escapeHtml(english(content.ui.completed)),
  progressLabel: escapeHtml(english(content.ui.inProgress)),
  completedLearning,
  currentLearning,
  stackHeading: escapeHtml(english(content.stack.heading)),
  stackGroups,
  offClockHeading: escapeHtml(english(content.offClock.heading)),
  offClock,
  contactHeading: escapeHtml(english(content.contact.heading)),
  contactBody: escapeHtml(english(content.contact.body)),
  contactCta: escapeHtml(english(content.contact.cta)),
  email: safeUrl('mailto:' + content.person.email),
  contactLinks,
  photoCredits: escapeHtml(english(content.ui.credits)),
  creditsList: credits,
  legalName: escapeHtml(content.mara.legal.en),
  copyrightName: escapeHtml(english(content.ui.copyright)),
  currentYear: String(new Date().getFullYear()),
  jsonld: JSON.stringify(structuredData).replaceAll('<', '\\u003c'),
  mobileIcon: local('assets/img/mara/mara-apple-touch-icon.png'),
  heroImage: local('assets/img/places/riyadh-skyline-dusk-01-2400.webp'),
  heroImageSet: local('assets/img/places/riyadh-skyline-dusk-01-1200.webp') + ' 1200w, ' + local('assets/img/places/riyadh-skyline-dusk-01-2400.webp') + ' 2400w',
  fontFaces,
  fontPreloads,
  vendorScripts
};

let output = template;
for (const [key, value] of Object.entries(values)) output = output.replaceAll('{{' + key + '}}', String(value));
if (output.includes('{{')) throw new Error('Unreplaced template token found.');
await writeFile(path.join(root, 'index.html'), output);
console.log('Built index.html from src/template.html and verified content inputs.');
