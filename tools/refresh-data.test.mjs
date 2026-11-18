// Run with `node --test tools/`. The daily job runs these first, so a change in what GitHub, Letterboxd,
// Ergast or the README send fails loudly instead of writing a wrong number onto the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bakeFallbacks, parseF1Result, parseLearning, parseLetterboxdLatest, parseWeek } from './refresh-data.mjs';

const NOW = new Date('2026-11-17T12:00:00Z');
const push = (repo, created_at, extra = {}) => ({ type: 'PushEvent', public: true, repo: { name: repo }, actor: { login: 'justAbdulaziz10' }, created_at, ...extra });

test('parseWeek counts public pushes per repo and leaves out the bot, private repos and empty counts', () => {
  const events = [
    push('justAbdulaziz10/Rassah', '2026-11-16T10:00:00Z'),
    push('justAbdulaziz10/Rassah', '2026-11-17T09:00:00Z'),
    push('justAbdulaziz10/Abdulaziz', '2026-11-17T08:00:00Z', { actor: { login: 'github-actions[bot]' } }),
    push('justAbdulaziz10/secret', '2026-11-17T08:00:00Z', { public: false }),
    push('justAbdulaziz10/faqqa', '2026-11-15T08:00:00Z'),
  ];
  const counts = { 'justAbdulaziz10/Rassah': 3, 'justAbdulaziz10/faqqa': 0, 'justAbdulaziz10/Abdulaziz': 1, 'justAbdulaziz10/secret': 2 };
  const { items } = parseWeek(events, {}, NOW, counts);
  assert.deepEqual(items.map(i => i.label), ['3 commits to Rassah']);
  assert.equal(items[0].date, '2026-11-17T09:00:00Z', 'the newest push dates the repo');
  assert.equal(items[0].url, 'https://github.com/justAbdulaziz10/Rassah');
});

test('parseWeek keeps only the last seven days, newest first, at most six items', () => {
  const events = [
    push('justAbdulaziz10/old', '2026-11-01T00:00:00Z'),
    { type: 'CreateEvent', public: true, repo: { name: 'justAbdulaziz10/faqqa' }, payload: { ref_type: 'repository' }, created_at: '2026-11-12T00:00:00Z' },
    { type: 'ReleaseEvent', public: true, repo: { name: 'justAbdulaziz10/Rassah' }, payload: { release: { tag_name: 'v1.2', html_url: 'https://github.com/justAbdulaziz10/Rassah/releases/tag/v1.2' } }, created_at: '2026-11-14T00:00:00Z' },
    ...Array.from({ length: 6 }, (_, i) => push(`justAbdulaziz10/r${i}`, `2026-11-1${i}T00:00:00Z`)),
  ];
  const counts = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`justAbdulaziz10/r${i}`, 1]));
  counts['justAbdulaziz10/old'] = 5;
  const { items } = parseWeek(events, {}, NOW, counts);
  assert.equal(items.length, 6);
  assert.ok(!items.some(i => i.repo === 'justAbdulaziz10/old'));
  const times = items.map(i => Date.parse(i.date));
  assert.deepEqual(times, [...times].sort((a, b) => b - a));
  assert.ok(items.some(i => i.label === 'Rassah v1.2'));
});

test('parseWeek lists an App Store release made this week', () => {
  const apps = { echo: { version: '1.46', currentVersionReleaseDate: '2026-11-16T13:00:00Z', url: 'https://apps.apple.com/sa/app/id6775021634' } };
  const { items } = parseWeek([], apps, NOW, {});
  assert.deepEqual(items.map(i => [i.kind, i.label]), [['app', 'Echo 1.46 on the App Store']]);
  assert.deepEqual(parseWeek([], { echo: { ...apps.echo, currentVersionReleaseDate: '2026-10-01T00:00:00Z' } }, NOW, {}).items, []);
});

const diaryItem = ({ title = 'Rear Window', year = '1954', watched = '2026-11-10', rating = '5.0', link = 'https://letterboxd.com/notabdulaziz/film/rear-window/' } = {}) => `<item>
  <link>${link}</link>
  <letterboxd:watchedDate>${watched}</letterboxd:watchedDate>
  <letterboxd:filmTitle>${title}</letterboxd:filmTitle>
  <letterboxd:filmYear>${year}</letterboxd:filmYear>
  <letterboxd:memberRating>${rating}</letterboxd:memberRating>
</item>`;

test('parseLetterboxdLatest picks the most recently watched film and decodes entities', () => {
  const rss = `<rss><channel>${diaryItem({ title: 'Am&#233;lie', watched: '2026-11-12', rating: '4.5' })}${diaryItem()}</channel></rss>`;
  assert.deepEqual(parseLetterboxdLatest(rss), { title: 'Amélie', year: '1954', watched: '2026-11-12', rating: 4.5, url: 'https://letterboxd.com/notabdulaziz/film/rear-window/' });
});

test('parseLetterboxdLatest skips malformed entries and throws on an empty diary', () => {
  const rss = `<rss>${diaryItem({ rating: '7' })}${diaryItem({ link: 'https://example.com/x' })}${diaryItem({ watched: 'yesterday' })}</rss>`;
  assert.throws(() => parseLetterboxdLatest(rss), /no diary entry/);
});

const driver = (position, givenName, familyName, code, team, time, fastestRank) => ({
  position: String(position), Driver: { givenName, familyName, code }, Constructor: { name: team },
  Time: time ? { time } : undefined, status: time ? 'Finished' : '+1 Lap',
  FastestLap: fastestRank ? { rank: String(fastestRank), Time: { time: '1:31.234' } } : undefined,
});

test('parseF1Result orders the podium and finds the fastest lap', () => {
  const j = { MRData: { RaceTable: { Races: [{ raceName: 'Las Vegas Grand Prix', round: '22', date: '2026-11-15', Circuit: { circuitName: 'Las Vegas Strip Circuit' }, Results: [
    driver(3, 'Lando', 'Norris', 'NOR', 'McLaren', '+5.1'),
    driver(1, 'Max', 'Verstappen', 'VER', 'Red Bull', '1:22:05.969'),
    driver(2, 'George', 'Russell', 'RUS', 'Mercedes', '+2.0', 1),
  ] }] } } };
  const r = parseF1Result(j);
  assert.deepEqual(r.podium.map(p => [p.pos, p.code]), [[1, 'VER'], [2, 'RUS'], [3, 'NOR']]);
  assert.deepEqual(r.fastestLap, { driver: 'George Russell', time: '1:31.234' });
  assert.equal(r.round, 22);
});

test('parseF1Result refuses an incomplete result', () => {
  assert.throws(() => parseF1Result({ MRData: { RaceTable: { Races: [] } } }), /not found/);
  const short = { MRData: { RaceTable: { Races: [{ raceName: 'X', date: '2026-11-15', Circuit: { circuitName: 'Y' }, Results: [driver(1, 'A', 'B', 'AB', 'T', '1:00')] }] } } };
  assert.throws(() => parseF1Result(short), /podium is incomplete/);
});

test('parseLearning puts the course touched most recently first and skips unstarted ones', () => {
  const readme = [
    '| Course | By | Progress | Link |',
    '|---|---|---|---|',
    '| Linear Algebra Lectures | MIT | 🟨 9 / 34 | [Playlist](https://www.youtube.com/playlist?list=A&si=track) |',
    '| Probability for Computer Scientists | | ⏳ 3 / 29 | [Stanford CS109](https://youtube.com/playlist?list=B) |',
    '| Calculus | Khan Academy | 🟨 0 / 199 | [Playlist](https://www.youtube.com/playlist?list=C) |',
  ].join('\n');
  const patch = '+| Probability for Computer Scientists | | ⏳ 3 / 29 | [Stanford CS109](https://youtube.com/playlist?list=B) |';
  const r = parseLearning(readme, [patch]);
  assert.equal(r.course, 'Stanford CS109');
  assert.deepEqual([r.done, r.total], [3, 29]);
  assert.deepEqual(r.courses.map(c => c.course), ['Stanford CS109', 'Linear Algebra Lectures, MIT']);
  assert.equal(r.courses[1].url, 'https://www.youtube.com/playlist?list=A', 'tracking parameters are dropped');
  assert.throws(() => parseLearning('| A | | 🟨 0 / 4 | |'), /no course in progress/);
});

test('bakeFallbacks writes live numbers, dates and text into the page, escaped', () => {
  const html = '<p><span class="num" data-count="1" data-live="github.total">1</span> on <span data-live="github.to" data-fmt="date">x</span>, '
    + 'Echo <span data-live="apps.echo.version">1.45</span>, <b data-live="missing.key">kept</b>, <i data-live="note">old</i></p>';
  const out = bakeFallbacks(html, { github: { total: 7293, to: '2026-11-17' }, apps: { echo: { version: '1.46' } }, note: '<b>&' });
  assert.match(out, /data-count="7293" data-live="github.total">7,293</);
  assert.match(out, />17 November 2026</);
  assert.match(out, /Echo <span data-live="apps.echo.version">1.46</);
  assert.match(out, />kept</, 'a value missing from the data leaves the written one');
  assert.match(out, />&lt;b&gt;&amp;</);
});

test('bakeFallbacks renders X posts with lazy avatars and no script from the post text', () => {
  const html = '<ol class="posts__list" data-x-posts>\n          <li>old</li>\n        </ol>';
  const data = { x: { user: 'AlkhlaiweA', name: 'Abdulaziz', avatar: 'assets/img/x/avatar-1.jpg', posts: [
    { id: '123', date: '2026-11-10T10:00:00Z', text: 'shipped <script>alert(1)</script> #Echo', lang: 'en', replies: 1, reposts: 2, likes: 3 },
  ] } };
  const out = bakeFallbacks(html, data);
  assert.match(out, /<img class="tweet__avatar" src="assets\/img\/x\/avatar-1\.jpg" alt="" width="48" height="48" loading="lazy" decoding="async">/);
  assert.ok(!out.includes('<script>'));
  assert.match(out, /href="https:\/\/x\.com\/hashtag\/Echo"/);
  assert.match(out, /href="https:\/\/x\.com\/AlkhlaiweA\/status\/123"/);
  assert.ok(!out.includes('<li>old</li>'));
});
