// Refreshes the site's live numbers: GitHub year, Letterboxd, F1, App Store and RevenueCat data.
// Run daily by .github/workflows/refresh-data.yml. Each source is independent: if one fails, its last good
// value is kept, so the page never shows an empty or broken number.
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('../', import.meta.url);
const LIVE = new URL('assets/data/live.json', ROOT);
const WEEKS = new URL('assets/data/weeks.json', ROOT);
const UA = { 'user-agent': 'Mozilla/5.0 (portfolio data refresh; github.com/justAbdulaziz10/Abdulaziz)' };

const get = async (url, type = 'text', headers = {}) => {
  const r = await fetch(url, { headers: { ...UA, ...headers }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return type === 'json' ? r.json() : r.text();
};
const num = s => Number(String(s).replace(/[^\d.]/g, ''));

async function github(prev = {}) {
  // The public calendar already counts private contributions (the profile shows them), so the headline numbers
  // need no token. It caps busy days at "100+", so exact daily counts (busiest day, the weekly graph) come from
  // GraphQL, which works with the workflow's own token; if that fails those two keep their last good values.
  const html = await get('https://github.com/users/justAbdulaziz10/contributions');
  const stated = html.replace(/\s+/g, ' ').match(/([\d,]+) contributions? in the last year/);
  if (!stated) throw new Error('yearly total not found');
  const total = num(stated[1]);
  const ids = new Map([...html.matchAll(/data-date="(\d{4}-\d{2}-\d{2})" id="([^"]+)"/g)].map(m => [m[2], m[1]]));
  const days = [...html.matchAll(/<tool-tip[^>]*for="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)]
    .filter(m => ids.has(m[1]))
    .map(m => [ids.get(m[1]), /^No contributions/.test(m[2]) ? 0 : num(m[2].split(' ')[0])]);
  if (days.length < 300) throw new Error(`only ${days.length} days`);
  days.sort((a, b) => a[0].localeCompare(b[0]));
  const active = days.filter(d => d[1] > 0).length;
  let run = 0, longest = 0;
  for (const [, c] of days) { run = c ? run + 1 : 0; longest = Math.max(longest, run); }
  // a streak is still "current" if today is empty but yesterday counted (today may not have started)
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) { if (days[i][1]) streak++; else if (i === days.length - 1) continue; else break; }
  const out = { total, activeDays: active, streak, longestStreak: longest, busiest: prev.busiest, from: days[0][0], to: days.at(-1)[0] };

  const token = process.env.GH_CONTRIB_TOKEN || process.env.GITHUB_TOKEN;
  try {
    if (!token) throw new Error('no token');
    const r = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { ...UA, authorization: `bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'query{user(login:"justAbdulaziz10"){contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{date contributionCount}}}}}}' }),
      signal: AbortSignal.timeout(20000),
    });
    const cal = (await r.json()).data?.user?.contributionsCollection?.contributionCalendar;
    if (!cal) throw new Error(`graphql ${r.status}`);
    const exact = cal.weeks.flatMap(w => w.contributionDays.map(d => [d.date, d.contributionCount])).sort((a, b) => a[0].localeCompare(b[0]));
    // GraphQL's year starts at this exact moment, the page's at midnight, so the totals differ by a few; a big gap
    // means the token can't see private work, and then the graph would be wrong
    if (Math.abs(cal.totalContributions - total) > total * 0.02) throw new Error(`graphql total ${cal.totalContributions} vs page ${total}`);
    const busiest = exact.reduce((b, d) => (d[1] > b[1] ? d : b));
    out.busiest = { date: busiest[0], count: busiest[1] };
    const weeks = [];
    for (let i = 0; i < exact.length; i += 7) {
      const chunk = exact.slice(i, i + 7);
      weeks.push([chunk[0][0], chunk.reduce((s, d) => s + d[1], 0)]);
    }
    await writeFile(WEEKS, JSON.stringify({ total, from: exact[0][0], to: exact.at(-1)[0], weeks }));
  } catch (e) {
    console.warn(`keep github.busiest and the weekly graph: ${e.message}`);
  }
  return out;
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

export function parseF1Result(j) {
  const r = j.MRData?.RaceTable?.Races?.[0];
  if (!r) throw new Error('last race result not found');
  if (!r.raceName || !r.date || !r.Circuit?.circuitName) throw new Error('last race details are incomplete');
  const results = Array.isArray(r.Results) ? r.Results : [];
  const podium = results.slice().sort((a, b) => Number(a.position) - Number(b.position)).slice(0, 3).map((result, index) => {
    const driver = result.Driver;
    const fullName = [driver?.givenName, driver?.familyName].filter(Boolean).join(' ');
    const time = result.Time?.time ?? result.status ?? '';
    if (!fullName || !result.Constructor?.name || !time) throw new Error('last race podium is incomplete');
    return {
      pos: Number(result.position) || index + 1,
      driver: fullName,
      code: driver.code ?? '',
      team: result.Constructor.name,
      time,
    };
  });
  if (podium.length !== 3) throw new Error('last race podium is incomplete');
  const fastest = results.find(result => String(result.FastestLap?.rank) === '1' && result.FastestLap?.Time?.time)
    ?? results.find(result => result.FastestLap?.Time?.time);
  const fastestName = [fastest?.Driver?.givenName, fastest?.Driver?.familyName].filter(Boolean).join(' ');
  return {
    raceName: r.raceName,
    round: Number(r.round),
    date: r.date,
    circuit: r.Circuit?.circuitName ?? '',
    podium,
    fastestLap: fastestName && fastest?.FastestLap?.Time?.time
      ? { driver: fastestName, time: fastest.FastestLap.Time.time }
      : null,
  };
}

async function f1Result() {
  return parseF1Result(await get('https://api.jolpi.ca/ergast/f1/current/last/results.json', 'json'));
}

async function apps() {
  const ids = { echo: '6775021634', docmara: '6780952627' };
  const out = {};
  for (const [k, id] of Object.entries(ids)) {
    const j = await get(`https://itunes.apple.com/lookup?id=${id}&country=sa`, 'json');
    const a = j.results?.[0];
    if (!a) throw new Error(`${k} not found`);
    out[k] = {
      rating: Math.round(a.averageUserRating * 10) / 10,
      ratings: a.userRatingCount,
      version: a.version,
      languages: a.languageCodesISO2A?.length ?? null,
      currentVersionReleaseDate: a.currentVersionReleaseDate ?? null,
      url: a.trackViewUrl ?? `https://apps.apple.com/sa/app/id${id}`,
    };
  }
  return out;
}

// GitHub's events feed no longer carries commit counts, so pushes are counted separately per repo (counts).
export function parseWeek(events, apps, now = new Date(), counts = {}) {
  const to = new Date(now);
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  const pushes = new Map();
  const items = [];
  const displayName = repo => repo.split('/').at(-1);
  const inWindow = date => {
    const time = Date.parse(date);
    return Number.isFinite(time) && time >= from.getTime() && time <= to.getTime();
  };

  for (const event of events) {
    if (event.public !== true) continue;
    const repo = event.repo?.name;
    if (!repo || !inWindow(event.created_at)) continue;
    const url = `https://github.com/${repo}`;

    if (event.type === 'PushEvent') {
      if (event.actor?.login === 'github-actions[bot]') continue; // the daily "Refresh live data" commit
      const count = Number(counts[repo]);
      if (!Number.isFinite(count) || count < 1) continue;
      const current = pushes.get(repo) ?? { repo, count, date: event.created_at, url };
      if (Date.parse(event.created_at) > Date.parse(current.date)) current.date = event.created_at;
      pushes.set(repo, current);
    } else if (event.type === 'ReleaseEvent') {
      const release = event.payload?.release;
      const releaseName = release?.name || release?.tag_name;
      if (!releaseName) continue;
      const name = displayName(repo);
      items.push({
        kind: 'release',
        repo,
        label: releaseName.toLowerCase().includes(name.toLowerCase()) ? releaseName : `${name} ${releaseName}`,
        date: event.created_at,
        url: release.html_url?.startsWith('https://github.com/')
          ? release.html_url
          : release.tag_name ? `${url}/releases/tag/${encodeURIComponent(release.tag_name)}` : `${url}/releases`,
      });
    } else if (event.type === 'CreateEvent' && event.payload?.ref_type === 'repository') {
      items.push({ kind: 'repo', repo, label: `Created ${displayName(repo)}`, date: event.created_at, url });
    }
  }

  for (const push of pushes.values()) {
    const name = displayName(push.repo);
    items.push({
      kind: 'push',
      repo: push.repo,
      label: `${push.count} ${push.count === 1 ? 'commit' : 'commits'} to ${name}`,
      count: push.count,
      date: push.date,
      url: push.url,
    });
  }

  const appNames = { echo: 'Echo', docmara: 'DocMara' };
  const appIds = { echo: '6775021634', docmara: '6780952627' };
  for (const [app, name] of Object.entries(appNames)) {
    const release = apps?.[app];
    if (!release?.version || !release.currentVersionReleaseDate || !inWindow(release.currentVersionReleaseDate)) continue;
    items.push({
      kind: 'app',
      app,
      label: `${name} ${release.version} on the App Store`,
      date: release.currentVersionReleaseDate,
      url: release.url ?? `https://apps.apple.com/sa/app/id${appIds[app]}`,
    });
  }

  items.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return { items: items.slice(0, 6) }; // no window stamps, so an unchanged week doesn't rewrite the file
}

async function week(apps) {
  const gh = url => get(url, 'json', process.env.GITHUB_TOKEN ? { authorization: `bearer ${process.env.GITHUB_TOKEN}` } : {});
  const events = await gh('https://api.github.com/users/justAbdulaziz10/events/public?per_page=100');
  const now = new Date();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const repos = new Set(events.filter(e => e.type === 'PushEvent' && e.public === true && e.actor?.login !== 'github-actions[bot]').map(e => e.repo?.name).filter(Boolean));
  const counts = {};
  for (const repo of repos) {
    let n = 0;
    for (let page = 1; page <= 10; page++) {
      const commits = await gh(`https://api.github.com/repos/${repo}/commits?author=justAbdulaziz10&since=${since}&per_page=100&page=${page}`).catch(() => []);
      n += Array.isArray(commits) ? commits.length : 0;
      if (!Array.isArray(commits) || commits.length < 100) break;
    }
    counts[repo] = n;
  }
  return parseWeek(events, apps, now, counts);
}

// What he is learning: the course tables in his To-infinity-and-AI README. A row in progress reads "🟨 8 / 40".
// The course shown is the in-progress row his latest README edits touched; with no such edit, the first one.
const LEARN_REPO = 'justAbdulaziz10/To-infinity-and-AI';
const progressRow = line => {
  if (!line.trim().startsWith('|')) return null;
  const cells = line.split('|').slice(1, -1).map(c => c.trim());
  const st = cells.map(c => c.match(/🟨\s*(\d+)\s*\/\s*(\d+)/)).find(Boolean);
  if (!st || !cells[0]) return null;
  const links = [...line.matchAll(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g)];
  return { name: cells[0], by: cells[1] && !cells[1].includes('](') ? cells[1] : '', done: Number(st[1]), total: Number(st[2]), linkText: links[0]?.[1] ?? '', url: links[0]?.[2] ?? null };
};

export function parseLearning(readme, patches = []) {
  const rows = readme.split('\n').map(progressRow).filter(Boolean);
  if (!rows.length) throw new Error('no course in progress');
  let pick = null;
  for (const patch of patches) {
    for (const line of patch.split('\n')) {
      const r = line.startsWith('+') ? progressRow(line.slice(1)) : null;
      if (r) pick = rows.find(x => x.name === r.name);
      if (pick) break;
    }
    if (pick) break;
  }
  pick ??= rows[0];
  const code = /\b[A-Z]{2,}\s?\d{2,}\b/;
  const title = !code.test(pick.name) && code.test(pick.linkText) ? pick.linkText : pick.name;
  const by = pick.by.replace(/\s*\(.*\)$/, '');
  return {
    course: by && !title.toLowerCase().includes(by.toLowerCase()) ? `${title}, ${by}` : title,
    done: pick.done, total: pick.total, url: pick.url,
  };
}

async function learning() {
  const gh = url => get(url, 'json', process.env.GITHUB_TOKEN ? { authorization: `bearer ${process.env.GITHUB_TOKEN}` } : {});
  const readme = Buffer.from((await gh(`https://api.github.com/repos/${LEARN_REPO}/readme`)).content, 'base64').toString('utf8');
  const commits = await gh(`https://api.github.com/repos/${LEARN_REPO}/commits?path=README.md&per_page=10`).catch(() => []);
  const patches = [];
  for (const c of commits) {
    const full = await gh(`https://api.github.com/repos/${LEARN_REPO}/commits/${c.sha}`).catch(() => null);
    const patch = full?.files?.find(f => f.filename === 'README.md')?.patch;
    if (patch) patches.push(patch);
  }
  return parseLearning(readme, patches);
}

// Active users come from each app's RevenueCat project. RevenueCat secret keys are per project, so each app
// has its own key; an app without a key (or a failed call) keeps its last good number.
async function revenuecat(prev = {}) {
  const projects = { echo: ['projc81dcc82', 'REVENUECAT_ECHO_KEY'], docmara: ['proj2525f3e6', 'REVENUECAT_DOCMARA_KEY'] };
  const out = { ...prev };
  let fresh = 0;
  for (const [app, [id, env]] of Object.entries(projects)) {
    const key = process.env[env];
    if (!key) continue;
    try {
      const j = await get(`https://api.revenuecat.com/v2/projects/${id}/metrics/overview`, 'json', { authorization: `Bearer ${key}` });
      const m = Object.fromEntries((j.metrics ?? []).map(x => [x.id, x]));
      const users = m.active_users?.value;
      if (!Number.isFinite(users)) throw new Error('active_users missing');
      out[app] = { activeUsers: users, period: m.active_users.period ?? 'P28D' };
      fresh++;
    } catch (e) {
      console.warn(`keep revenuecat.${app}: ${e.message}`);
    }
  }
  if (!fresh) throw new Error('no RevenueCat key set or every call failed');
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const prev = JSON.parse(await readFile(LIVE, 'utf8').catch(() => '{}'));
  const next = { ...prev };
  let changed = false;
  for (const [key, fn] of Object.entries({ github: () => github(next.github), letterboxd, f1, apps, f1Result, week: () => week(next.apps), learning, revenuecat: () => revenuecat(next.revenuecat) })) {
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
}
