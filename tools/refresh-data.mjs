// Refreshes the site's live numbers: GitHub year, Letterboxd, the next F1 race and App Store ratings.
// Run daily by .github/workflows/refresh-data.yml. Each source is independent: if one fails, its last good
// value is kept, so the page never shows an empty or broken number.
import { readFile, writeFile } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const LIVE = new URL('assets/data/live.json', ROOT);
const WEEKS = new URL('assets/data/weeks.json', ROOT);
const UA = { 'user-agent': 'Mozilla/5.0 (portfolio data refresh; github.com/justAbdulaziz10/Abdulaziz)' };

const get = async (url, type = 'text') => {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return type === 'json' ? r.json() : r.text();
};
const num = s => Number(String(s).replace(/[^\d.]/g, ''));

async function github() {
  // The public calendar leaves out private work, so only the owner's token gives the real year.
  // Without GH_CONTRIB_TOKEN this source is skipped and the last good numbers stay.
  const token = process.env.GH_CONTRIB_TOKEN;
  if (!token) throw new Error('GH_CONTRIB_TOKEN not set');
  const r = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { ...UA, authorization: `bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query: 'query{user(login:"justAbdulaziz10"){contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{date contributionCount}}}}}}' }),
    signal: AbortSignal.timeout(20000),
  });
  const j = await r.json();
  const cal = j.data?.user?.contributionsCollection?.contributionCalendar;
  if (!cal) throw new Error(`graphql: ${JSON.stringify(j.errors ?? r.status)}`);
  const days = cal.weeks.flatMap(w => w.contributionDays.map(d => [d.date, d.contributionCount]));
  if (days.length < 300) throw new Error(`only ${days.length} days`);
  days.sort((a, b) => a[0].localeCompare(b[0]));
  const total = cal.totalContributions;
  const active = days.filter(d => d[1] > 0).length;
  let run = 0, longest = 0;
  for (const [, c] of days) { run = c ? run + 1 : 0; longest = Math.max(longest, run); }
  // a streak is still "current" if today is empty but yesterday counted (today may not have started)
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) { if (days[i][1]) streak++; else if (i === days.length - 1) continue; else break; }
  const busiest = days.reduce((b, d) => (d[1] > b[1] ? d : b));
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    const chunk = days.slice(i, i + 7);
    weeks.push([chunk[0][0], chunk.reduce((s, d) => s + d[1], 0)]);
  }
  await writeFile(WEEKS, JSON.stringify({ total, from: days[0][0], to: days.at(-1)[0], weeks }));
  return { total, activeDays: active, streak, longestStreak: longest, busiest: { date: busiest[0], count: busiest[1] }, from: days[0][0], to: days.at(-1)[0] };
}

async function letterboxd() {
  const [profile, rss] = await Promise.all([get('https://letterboxd.com/notabdulaziz/'), get('https://letterboxd.com/notabdulaziz/rss/')]);
  const stat = label => {
    const m = profile.match(new RegExp(`<span class="value">([\\d,]+)</span><span class="definition[^"]*">${label}`, 'i'));
    return m ? num(m[1]) : null;
  };
  const films = stat('Films');
  if (!films) throw new Error('film count not found');
  const item = rss.split('<item>').slice(1).find(it => it.includes('<letterboxd:filmTitle>'));
  const tag = (t) => item?.match(new RegExp(`<${t}>([^<]*)</${t}>`))?.[1] ?? null;
  const latest = item ? {
    title: tag('letterboxd:filmTitle'),
    year: tag('letterboxd:filmYear'),
    watched: tag('letterboxd:watchedDate'),
    rating: tag('letterboxd:memberRating') ? Number(tag('letterboxd:memberRating')) : null,
    url: tag('link'),
  } : null;
  return { films, thisYear: stat('This year'), latest };
}

async function f1() {
  const j = await get('https://api.jolpi.ca/ergast/f1/current/next.json', 'json');
  const r = j.MRData.RaceTable.Races[0];
  if (!r) return { season: j.MRData.RaceTable.season, race: null };
  return {
    season: r.season, round: Number(r.round), raceName: r.raceName, circuit: r.Circuit.circuitName,
    locality: r.Circuit.Location.locality, country: r.Circuit.Location.country,
    start: `${r.date}T${r.time ?? '00:00:00Z'}`,
  };
}

async function apps() {
  const ids = { echo: '6775021634', docmara: '6780952627' };
  const out = {};
  for (const [k, id] of Object.entries(ids)) {
    const j = await get(`https://itunes.apple.com/lookup?id=${id}&country=sa`, 'json');
    const a = j.results?.[0];
    if (!a) throw new Error(`${k} not found`);
    out[k] = { rating: Math.round(a.averageUserRating * 10) / 10, ratings: a.userRatingCount, version: a.version, languages: a.languageCodesISO2A?.length ?? null };
  }
  return out;
}

const prev = JSON.parse(await readFile(LIVE, 'utf8').catch(() => '{}'));
const next = { ...prev };
let changed = false;
for (const [key, fn] of Object.entries({ github, letterboxd, f1, apps })) {
  try {
    next[key] = await fn();
    changed = true;
    console.log(`ok   ${key}`);
  } catch (e) {
    console.warn(`keep ${key}: ${e.message}`);
  }
}
// only stamp and write when a number actually moved, so the daily job doesn't commit noise
const strip = ({ updated, ...rest }) => JSON.stringify(rest);
if (changed && strip(next) !== strip(prev)) {
  next.updated = new Date().toISOString();
  await writeFile(LIVE, JSON.stringify(next, null, 1) + '\n');
}
