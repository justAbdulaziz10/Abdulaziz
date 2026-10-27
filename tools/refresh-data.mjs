// Refreshes the site's live numbers: GitHub year, Letterboxd, F1, App Store, RevenueCat data and the latest posts on X.
// Run daily by .github/workflows/refresh-data.yml. Each source is independent: if one fails, its last good
// value is kept, so the page never shows an empty or broken number.
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('../', import.meta.url);
const LIVE = new URL('assets/data/live.json', ROOT);
const WEEKS = new URL('assets/data/weeks.json', ROOT);
const F1LAP = new URL('assets/data/f1lap.json', ROOT);
const GITLAB = new URL('assets/data/gitlab.json', ROOT);
const PAGE = new URL('index.html', ROOT);
const UA = { 'user-agent': 'Mozilla/5.0 (portfolio data refresh; github.com/justAbdulaziz10/Abdulaziz)' };

const get = async (url, type = 'text', headers = {}) => {
  const r = await fetch(url, { headers: { ...UA, ...headers }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  if (type === 'json') return r.json();
  return r.text();
};
const num = s => Number(String(s).replace(/[^\d.]/g, ''));
const decodeXml = s => String(s).replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (all, code) => {
  if (code[0] === '#') {
    const value = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return Number.isFinite(value) ? String.fromCodePoint(value) : all;
  }
  return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[code.toLowerCase()] ?? all;
});

const xmlTag = (item, tag) => {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const value = item.match(new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, 'i'))?.[1];
  return value == null ? null : decodeXml(value.trim());
};

// The newest diary entry in the feed; rewatches and reviews can repeat a film, so the watched date decides.
export function parseLetterboxdLatest(rss) {
  const films = [...rss.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(([, item]) => {
    const title = xmlTag(item, 'letterboxd:filmTitle');
    const year = xmlTag(item, 'letterboxd:filmYear');
    const watched = xmlTag(item, 'letterboxd:watchedDate');
    const url = xmlTag(item, 'link');
    const ratingText = xmlTag(item, 'letterboxd:memberRating');
    const rating = ratingText == null || ratingText === '' ? null : Number(ratingText);
    if (!title || !year || !/^\d{4}-\d{2}-\d{2}$/.test(watched ?? '') || !url?.startsWith('https://letterboxd.com/')) return null;
    if (rating !== null && (!Number.isFinite(rating) || rating < 0 || rating > 5)) return null;
    return { title, year, watched, rating, url };
  }).filter(Boolean);
  if (!films.length) throw new Error('no diary entry in the feed');
  return films.reduce((a, b) => (b.watched > a.watched ? b : a));
}

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

// Letterboxd blocks GitHub's runners on the profile page some days, so the feed (latest film) and the profile
// (film counts) are fetched separately; whichever fails keeps its last good value.
export async function letterboxd(prev = {}, { request = get } = {}) {
  const [profile, rss] = await Promise.allSettled([request('https://letterboxd.com/notabdulaziz/'), request('https://letterboxd.com/notabdulaziz/rss/')]);
  if (profile.status === 'rejected' && rss.status === 'rejected') throw new Error(`${profile.reason.message}; ${rss.reason.message}`);
  const out = { ...prev };
  delete out.recent;
  if (profile.status === 'fulfilled') {
    const stat = label => {
      const m = profile.value.match(new RegExp(`<span class="value">([\\d,]+)</span><span class="definition[^"]*">${label}`, 'i'));
      return m ? num(m[1]) : null;
    };
    const films = stat('Films');
    if (films) Object.assign(out, { films, thisYear: stat('This year') });
    else console.warn('keep letterboxd counts: film count not found');
  } else console.warn(`keep letterboxd counts: ${profile.reason.message}`);
  if (rss.status === 'fulfilled') {
    try {
      out.latest = parseLetterboxdLatest(rss.value);
    } catch (e) {
      console.warn(`keep letterboxd latest: ${e.message}`);
    }
  } else console.warn(`keep letterboxd latest: ${rss.reason.message}`);
  return out;
}

const asMillis = value => {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : NaN;
};

function resampleLocation(records, start, count, step, driverNumber) {
  const points = records.map(row => ({ t: asMillis(row.date), x: Number(row.x), y: Number(row.y) }))
    .filter(p => Number.isFinite(p.t) && Number.isFinite(p.x) && Number.isFinite(p.y))
    .sort((a, b) => a.t - b.t)
    .filter((p, i, all) => !i || p.t !== all[i - 1].t);
  if (points.length < 2 || points[0].t > start + 500 || points.at(-1).t < start + (count - 1) * step - 500) {
    throw new Error(`location coverage is incomplete for driver ${driverNumber}`);
  }
  const frames = [];
  let hi = 1;
  for (let i = 0; i < count; i++) {
    const t = start + i * step;
    while (hi < points.length - 1 && points[hi].t < t) hi++;
    const a = points[Math.max(0, hi - 1)], b = points[hi];
    let x, y;
    if (t < points[0].t) { x = points[0].x; y = points[0].y; }
    else if (t > points.at(-1).t) { x = points.at(-1).x; y = points.at(-1).y; }
    else {
      const mix = (t - a.t) / (b.t - a.t || 1);
      x = a.x + (b.x - a.x) * mix;
      y = a.y + (b.y - a.y) * mix;
    }
    // OpenF1 positions are quantised to 10-unit (about 10 m) integers to keep the JSON compact.
    frames.push(Math.round(x / 10), Math.round(y / 10));
  }
  return frames;
}

export function simplifyTrack(points, tolerance = 5) {
  if (points.length <= 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const dx = points[b][0] - points[a][0], dy = points[b][1] - points[a][1];
    const length = Math.hypot(dx, dy) || 1;
    let best = tolerance, index = -1;
    for (let i = a + 1; i < b; i++) {
      const distance = Math.abs(dx * (points[i][1] - points[a][1]) - dy * (points[i][0] - points[a][0])) / length;
      if (distance > best) { best = distance; index = i; }
    }
    if (index >= 0) { keep[index] = 1; stack.push([a, index], [index, b]); }
  }
  return points.filter((_, i) => keep[i]);
}

export function buildF1LapData({ session, meeting, drivers, results, laps, locations, start, end, step = 250 }) {
  const raceName = meeting?.meeting_name ?? session?.meeting_name;
  if (!raceName || !session?.circuit_short_name || !session?.date_start || !session?.session_key) {
    throw new Error('OpenF1 race details are incomplete');
  }
  const classified = results.filter(result => Number.isInteger(Number(result.position))
    && Number(result.position) > 0 && !result.dnf && !result.dns && !result.dsq)
    .sort((a, b) => Number(a.position) - Number(b.position));
  const winner = classified.find(result => Number(result.position) === 1);
  if (!winner) throw new Error('OpenF1 winner was not found');
  const winnerNumber = Number(winner.driver_number);
  const winnerLaps = laps.filter(lap => Number(lap.driver_number) === winnerNumber);
  const winnerLap = winnerLaps.find(lap => Number(lap.lap_number) === Number(winner.number_of_laps))
    ?? winnerLaps.sort((a, b) => Number(b.lap_number) - Number(a.lap_number))[0];
  const lapStart = asMillis(winnerLap?.date_start);
  const duration = Number(winnerLap?.lap_duration);
  if (!Number.isFinite(lapStart) || !Number.isFinite(duration) || duration <= 0) throw new Error('winner final lap is incomplete');
  const raceEnd = Math.min(end, lapStart + duration * 1000 + 30000, lapStart + 150000);
  const frameCount = Math.floor((raceEnd - lapStart) / step) + 1;
  if (!Number.isFinite(start) || start !== lapStart || !Number.isFinite(end) || end !== raceEnd || frameCount < 2) {
    throw new Error('OpenF1 replay timeline is invalid');
  }
  const driverByNumber = new Map(drivers.map(driver => [Number(driver.driver_number), driver]));
  const winnerFinish = lapStart + duration * 1000;
  const cars = classified.map(result => {
    const number = Number(result.driver_number);
    const driver = driverByNumber.get(number);
    const colour = String(driver?.team_colour ?? '').replace(/^#/, '');
    if (!driver?.name_acronym || !/^[\da-f]{6}$/i.test(colour)) throw new Error(`OpenF1 driver details are incomplete for ${number}`);
    const rows = locations.get(number);
    if (!Array.isArray(rows)) throw new Error(`OpenF1 location data is missing for driver ${number}`);
    const gap = Number(result.position) === 1 ? 0 : Number.isFinite(result.gap_to_leader) ? result.gap_to_leader : null;
    const finishTime = gap == null ? null : winnerFinish + gap * 1000;
    const finishFrame = finishTime == null ? null : Math.round((finishTime - lapStart) / step);
    return {
      number,
      acronym: driver.name_acronym,
      color: `#${colour}`,
      position: Number(result.position),
      finish_frame: Number.isInteger(finishFrame) && finishFrame >= 0 && finishFrame < frameCount ? finishFrame : null,
      frames: resampleLocation(rows, lapStart, frameCount, step, number),
    };
  });
  const winnerRows = locations.get(winnerNumber).map(row => ({ t: asMillis(row.date), x: Number(row.x), y: Number(row.y) }))
    .filter(point => point.t >= lapStart && point.t <= lapStart + duration * 1000 && Number.isFinite(point.x) && Number.isFinite(point.y))
    .sort((a, b) => a.t - b.t);
  if (winnerRows.length < 3) throw new Error('winner final-lap track points are incomplete');
  const track = simplifyTrack(winnerRows.map(point => [Math.round(point.x / 10), Math.round(point.y / 10)]), 1);
  return {
    raceName,
    circuit: session.circuit_short_name,
    date: session.date_start.slice(0, 10),
    session_key: session.session_key,
    lap: Number(winnerLap.lap_number),
    coordinate_unit: 10,
    timeline: { start: 0, step, count: frameCount },
    track,
    cars,
  };
}

export async function refreshF1Lap({ now = new Date(), fetcher = (...args) => fetch(...args), sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), lapFile = F1LAP, read = readFile, write = writeFile } = {}) {
  let previous = null;
  try { previous = JSON.parse(await read(lapFile, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  let lastRequestAt = 0;
  const openF1 = async url => {
    const wait = lastRequestAt ? Math.max(0, 1100 - (Date.now() - lastRequestAt)) : 0;
    if (wait) await sleep(wait);
    const options = { headers: UA, signal: AbortSignal.timeout(20000) };
    let response = await fetcher(url, options);
    lastRequestAt = Date.now();
    if (response.status === 429) {
      await sleep(1100);
      response = await fetcher(url, options);
      lastRequestAt = Date.now();
    }
    if (!response.ok) throw new Error(`${url} → ${response.status}`);
    return response.json();
  };
  const latestRace = sessions => sessions.filter(session => session.session_type === 'Race'
    && !session.is_cancelled && asMillis(session.date_end) < now.getTime())
    .sort((a, b) => asMillis(b.date_end) - asMillis(a.date_end))[0];
  let session = latestRace(await openF1(`https://api.openf1.org/v1/sessions?session_type=Race&year=${now.getUTCFullYear()}`));
  if (!session) session = latestRace(await openF1(`https://api.openf1.org/v1/sessions?session_type=Race&year=${now.getUTCFullYear() - 1}`));
  if (!session) throw new Error('no finished OpenF1 Race session found');
  if (String(previous?.session_key) === String(session.session_key)) return { updated: false, data: previous };

  const meetingRows = await openF1(`https://api.openf1.org/v1/meetings?meeting_key=${session.meeting_key}`);
  const meeting = meetingRows.find(row => Number(row.meeting_key) === Number(session.meeting_key));
  const sessionKey = session.session_key;
  const drivers = await openF1(`https://api.openf1.org/v1/drivers?session_key=${sessionKey}`);
  const results = await openF1(`https://api.openf1.org/v1/session_result?session_key=${sessionKey}`);
  const winner = results.find(result => Number(result.position) === 1 && !result.dnf && !result.dns && !result.dsq);
  if (!winner) throw new Error('OpenF1 winner was not found');
  const laps = await openF1(`https://api.openf1.org/v1/laps?session_key=${sessionKey}&driver_number=${winner.driver_number}`);
  const winnerLaps = laps.filter(lap => Number(lap.driver_number) === Number(winner.driver_number));
  const winnerLap = winnerLaps.find(lap => Number(lap.lap_number) === Number(winner.number_of_laps))
    ?? winnerLaps.sort((a, b) => Number(b.lap_number) - Number(a.lap_number))[0];
  const start = asMillis(winnerLap?.date_start);
  const duration = Number(winnerLap?.lap_duration);
  if (!Number.isFinite(start) || !Number.isFinite(duration) || duration <= 0) throw new Error('winner final lap is incomplete');
  const end = Math.min(start + duration * 1000 + 30000, start + 150000);
  const classified = results.filter(result => Number.isInteger(Number(result.position))
    && Number(result.position) > 0 && !result.dnf && !result.dns && !result.dsq);
  const locations = new Map();
  for (const result of classified) {
    // OpenF1 wants the comparison operators raw: an encoded `date%3E%3D` is a 404
    const url = `https://api.openf1.org/v1/location?session_key=${sessionKey}&driver_number=${result.driver_number}`
      + `&date>=${new Date(start).toISOString()}&date<=${new Date(end).toISOString()}`;
    locations.set(Number(result.driver_number), await openF1(url));
  }
  const data = buildF1LapData({ session, meeting, drivers, results, laps, locations, start, end });
  await write(lapFile, JSON.stringify(data) + '\n');
  return { updated: true, data };
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

// Apple's lookup API can lag a release by days, so a version never moves backwards.
const newer = (a, b) => {
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
};

async function apps(prev = {}) {
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
    const was = prev[k];
    if (was?.version && newer(was.version, out[k].version)) {
      out[k].version = was.version;
      out[k].currentVersionReleaseDate = was.currentVersionReleaseDate;
    }
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
// share links carry tracking (YouTube's si=); the page links to the plain address
const cleanUrl = href => {
  if (!href) return null;
  const u = new URL(href);
  u.searchParams.delete('si');
  return u.href;
};

const progressRow = line => {
  if (!line.trim().startsWith('|')) return null;
  const cells = line.split('|').slice(1, -1).map(c => c.trim());
  // 🟨 n / m is in progress; ⏳ n / m is in progress at a slower pace
  const st = cells.map(c => c.match(/(?:🟨|⏳)\s*(\d+)\s*\/\s*(\d+)/)).find(Boolean);
  if (!st || !cells[0]) return null;
  const links = [...line.matchAll(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g)];
  return { name: cells[0], by: cells[1] && !cells[1].includes('](') ? cells[1] : '', done: Number(st[1]), total: Number(st[2]), linkText: links[0]?.[1] ?? '', url: cleanUrl(links[0]?.[2]) };
};

const courseTitle = row => {
  const code = /\b[A-Z]{2,}\s?\d{2,}\b/;
  const title = (!code.test(row.name) && code.test(row.linkText) ? row.linkText : row.name).replace(/\s*\(.*?\)\s*$/, '');
  const by = row.by.replace(/\s*\(.*\)$/, '');
  return by && !title.toLowerCase().includes(by.toLowerCase()) ? `${title}, ${by}` : title;
};

// Every course in progress, the ones most recently touched in the README's history first.
export function parseLearning(readme, patches = []) {
  const rows = readme.split('\n').map(progressRow).filter(Boolean);
  const touched = [];
  for (const patch of patches) {
    for (const line of patch.split('\n')) {
      const r = line.startsWith('+') ? progressRow(line.slice(1)) : null;
      const row = r && rows.find(x => x.name === r.name);
      if (row && !touched.includes(row)) touched.push(row);
    }
  }
  // a course with nothing watched yet is on the list, not in progress
  const courses = [...touched, ...rows.filter(r => !touched.includes(r))]
    .filter(r => r.done > 0)
    .map(r => ({ course: courseTitle(r), done: r.done, total: r.total, url: r.url }));
  if (!courses.length) throw new Error('no course in progress');
  return { ...courses[0], courses };
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

// Shipping at Mara, counted where the code lives. Mara's repos are private, so each count needs a token that can
// see them (WORK_GITHUB_TOKEN, WORK_GITLAB_TOKEN); without one it keeps its last good number. Only totals leave here.
async function work(prev = {}) {
  const out = { ...prev };
  let fresh = 0;
  const ghToken = process.env.WORK_GITHUB_TOKEN;
  if (ghToken) {
    try {
      const q = encodeURIComponent('author:justAbdulaziz10 type:pr is:merged org:mara-org');
      const j = await get(`https://api.github.com/search/issues?q=${q}&per_page=1`, 'json', { authorization: `bearer ${ghToken}` });
      if (!Number.isInteger(j.total_count) || j.incomplete_results) throw new Error('incomplete search');
      out.githubPrs = j.total_count;
      fresh++;
    } catch (e) {
      console.warn(`keep work.githubPrs: ${e.message}`);
    }
  }
  const glToken = process.env.WORK_GITLAB_TOKEN;
  if (glToken) {
    try {
      const r = await fetch('https://gitlab.com/api/v4/merge_requests?scope=created_by_me&state=merged&per_page=1', { headers: { ...UA, authorization: `Bearer ${glToken}` }, signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const total = Number(r.headers.get('x-total'));
      if (!Number.isInteger(total)) throw new Error('x-total missing');
      out.gitlabMrs = total;
      fresh++;
    } catch (e) {
      console.warn(`keep work.gitlabMrs: ${e.message}`);
    }
  }
  if (!fresh) throw new Error('no work token set or every call failed');
  return out;
}

// GitLab, where Mara's builds run: pushes per day over the same year as the GitHub chart. Only dates and counts
// leave here, never project names. Kept apart from the GitHub total, since much of it is the same code.
export async function gitlab() {
  const token = process.env.WORK_GITLAB_TOKEN;
  if (!token) throw new Error('no WORK_GITLAB_TOKEN');
  const { from } = JSON.parse(await readFile(WEEKS, 'utf8'));
  const after = new Date(Date.parse(from) - 864e5).toISOString().slice(0, 10);
  const day = ts => new Date(ts).toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
  const counts = new Map();
  for (let page = 1; ; page++) {
    if (page > 100) throw new Error('too many pages');
    const events = await get(`https://gitlab.com/api/v4/users/41425146/events?action=pushed&after=${after}&per_page=100&page=${page}`, 'json', { authorization: `Bearer ${token}` });
    if (!Array.isArray(events)) throw new Error('unexpected response');
    for (const e of events) {
      const d = day(e.created_at);
      if (d >= from) counts.set(d, (counts.get(d) ?? 0) + 1);
    }
    if (events.length < 100) break;
  }
  if (!counts.size) throw new Error('no pushes found');
  const days = [...counts].sort((a, b) => a[0].localeCompare(b[0]));
  await writeFile(GITLAB, JSON.stringify({ from, to: day(Date.now()), days }));
  return { pushes: days.reduce((s, d) => s + d[1], 0), activeDays: days.length, first: days[0][0] };
}

// The latest three posts on X, without replies or reposts. With X_BEARER_TOKEN set they come from the official
// API (paid per post read, so the hourly job only asks for posts newer than the last one, which costs nothing
// when there are none); without it, from the public timeline X serves its embed widget, which is X's own
// selection rather than the latest posts. Photos and the avatar are saved next to the page.
const X_USER = 'AlkhlaiweA';
const X_ID = '1573757763754369027';
const X_IMG = new URL('assets/img/x/', ROOT);
// X answers Node's fetch with 429 but curl with the page, so the widget request goes through curl.
const curl = async url => {
  const { execFile } = await import('node:child_process');
  return new Promise((resolve, reject) => execFile('curl', ['-sS', '--fail-with-body', '--max-time', '20', '-A', 'Mozilla/5.0', url], { maxBuffer: 8e6 }, (err, out, stderr) => err ? reject(new Error(`${url} → ${String(stderr || err.message).trim().split('\n')[0]}`)) : resolve(out)));
};
// Post text as X shows it: media links dropped, t.co links shown as their real address and kept for linking.
const xText = (text, urls = []) => {
  const links = [];
  for (const u of urls) {
    const shown = u.media_key || /\/(photo|video)\/\d+$/.test(u.expanded_url ?? '') ? '' : u.display_url ?? u.expanded_url ?? '';
    text = text.split(u.url).join(shown);
    if (shown && u.expanded_url) links.push({ text: shown, href: u.expanded_url });
  }
  return { text: decodeXml(text).trim(), links };
};
const saveImage = async (src, file) => {
  try {
    await readFile(new URL(file, X_IMG));
    return true;
  } catch {}
  const r = await fetch(src, { headers: UA, signal: AbortSignal.timeout(20000) });
  if (!r.ok) return false;
  await writeFile(new URL(file, X_IMG), Buffer.from(await r.arrayBuffer()));
  return true;
};

async function xFromApi(token, prev) {
  const api = path => get(`https://api.x.com/2/${path}`, 'json', { authorization: `Bearer ${token}` });
  const newest = prev?.source === 'api' ? prev.posts?.[0]?.id : null;
  if (newest && process.env.X_ONLY_NEW) {
    const check = await api(`users/${X_ID}/tweets?max_results=5&exclude=replies,retweets&since_id=${newest}`);
    if (!check?.meta?.result_count) return null;
  }
  const q = new URLSearchParams({
    max_results: '5', exclude: 'replies,retweets',
    'tweet.fields': 'created_at,lang,entities,note_tweet,public_metrics,possibly_sensitive,referenced_tweets,attachments,author_id',
    expansions: 'attachments.media_keys,referenced_tweets.id,referenced_tweets.id.author_id',
    'media.fields': 'type,url,preview_image_url,width,height,alt_text',
    'user.fields': 'name,username',
  });
  const r = await api(`users/${X_ID}/tweets?${q}`);
  if (!Array.isArray(r?.data)) throw new Error(r?.errors?.[0]?.detail ?? 'no posts returned');
  const media = new Map((r.includes?.media ?? []).map(m => [m.media_key, m]));
  const tweets = new Map((r.includes?.tweets ?? []).map(t => [t.id, t]));
  const users = new Map((r.includes?.users ?? []).map(u => [u.id, u]));
  const body = t => xText(t.note_tweet?.text ?? t.text ?? '', (t.note_tweet ?? t).entities?.urls);
  return r.data.filter(t => !t.possibly_sensitive).slice(0, 3).map(t => {
    const quoted = tweets.get(t.referenced_tweets?.find(ref => ref.type === 'quoted')?.id);
    const author = quoted && users.get(quoted.author_id);
    return {
      id: t.id, date: new Date(t.created_at).toISOString(), ...body(t), lang: t.lang,
      replies: t.public_metrics?.reply_count ?? 0, reposts: t.public_metrics?.retweet_count ?? 0, likes: t.public_metrics?.like_count ?? 0,
      media: (t.attachments?.media_keys ?? []).map(k => media.get(k)).filter(Boolean).map(m => ({ remote: m.url ?? m.preview_image_url, w: m.width, h: m.height, type: m.type, alt: m.alt_text ?? '' })),
      quote: author ? { id: quoted.id, name: author.name, handle: author.username, lang: quoted.lang, text: body(quoted).text } : undefined,
    };
  });
}

async function xFromWidget(request) {
  const html = await request(`https://syndication.twitter.com/srv/timeline-profile/screen-name/${X_USER}`);
  const data = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
  if (!data) throw new Error('timeline data not found');
  const entries = JSON.parse(data).props?.pageProps?.timeline?.entries;
  if (!Array.isArray(entries)) throw new Error('unexpected timeline');
  const tweets = entries.map(e => e?.content?.tweet).filter(t => t?.id_str && t.user?.screen_name === X_USER
    && !t.in_reply_to_status_id_str && !t.retweeted_status && !/^RT @/.test(t.full_text ?? '') && !t.possibly_sensitive)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 3);
  const urls = t => [...(t.entities?.urls ?? []), ...(t.entities?.media ?? []).map(m => ({ ...m, media_key: m.media_key ?? 'media' }))];
  const posts = tweets.map(t => {
    const q = t.quoted_status;
    return {
      id: t.id_str, date: new Date(t.created_at).toISOString(), ...xText(t.full_text ?? '', urls(t)), lang: t.lang,
      replies: t.reply_count ?? 0, reposts: t.retweet_count ?? 0, likes: t.favorite_count ?? 0,
      media: (t.extended_entities?.media ?? t.entities?.media ?? []).map(m => ({ remote: m.media_url_https, w: m.original_info?.width, h: m.original_info?.height, type: m.type, alt: m.ext_alt_text ?? '' })),
      quote: q?.id_str && q.user?.screen_name ? { id: q.id_str, name: q.user.name, handle: q.user.screen_name, lang: q.lang, text: xText(q.full_text ?? '', urls(q)).text } : undefined,
    };
  });
  return { posts, avatar: tweets[0]?.user?.profile_image_url_https };
}

export async function x(prev = {}, { request = curl } = {}) {
  const token = process.env.X_BEARER_TOKEN;
  let posts, avatarUrl;
  if (token) {
    posts = await xFromApi(token, prev);
    if (!posts) return prev; // nothing new since the last run
  } else ({ posts, avatar: avatarUrl } = await xFromWidget(request));
  if (!posts.length) throw new Error('no posts found');
  const { mkdir, readdir, unlink } = await import('node:fs/promises');
  await mkdir(X_IMG, { recursive: true });
  const keep = new Set();
  // the API run doesn't pay for a profile lookup, so it keeps the avatar the widget run saved
  let avatar = prev?.avatar ?? null;
  const picId = avatarUrl?.match(/profile_images\/(\d+)\//)?.[1];
  if (picId && await saveImage(avatarUrl.replace('_normal', '_200x200'), `avatar-${picId}.jpg`)) avatar = `assets/img/x/avatar-${picId}.jpg`;
  if (avatar) keep.add(avatar.split('/').pop());
  for (const post of posts) {
    const list = post.media.slice(0, 4);
    post.media = [];
    for (const [i, m] of list.entries()) {
      // one photo shows large, a grid of two to four shows each one small
      const file = `${post.id}-${i + 1}.jpg`;
      if (!m.remote || !(m.w > 0) || !(m.h > 0) || !await saveImage(`${m.remote}?format=jpg&name=${list.length === 1 ? 'medium' : 'small'}`, file)) continue;
      keep.add(file);
      post.media.push({ src: `assets/img/x/${file}`, w: m.w, h: m.h, type: m.type, alt: m.alt });
    }
    if (!post.quote) delete post.quote;
  }
  for (const f of await readdir(X_IMG)) if (!keep.has(f)) await unlink(new URL(f, X_IMG));
  // the display name on X is in Arabic; the site uses the English one
  return { user: X_USER, name: 'Abdulaziz Alkhlaiwe', avatar, source: token ? 'api' : 'widget', posts };
}

// The page ships with the numbers written in, for crawlers, link previews, print and visitors without
// JavaScript. Rewrite those copies from the data so they never disagree with what live.js fills in.
const nfmt = new Intl.NumberFormat('en-US');
const dfmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function bakeFallbacks(html, data) {
  const dig = path => path.split('.').reduce((v, k) => (v == null ? v : v[k]), data);
  html = html.replace(/(<(\w+)\b([^>]*?)\sdata-live="([^"]+)"([^>]*)>)([^<]*)(<\/\2>)/g, (all, open, tag, a, key, b, text, close) => {
    const v = dig(key);
    if (v == null || v === '') return all;
    const fmt = /data-fmt="date"/.test(open) ? 'date' : '';
    const out = fmt ? dfmt.format(new Date(`${v}T00:00:00Z`)) : typeof v === 'number' ? nfmt.format(v) : String(v);
    const opened = typeof v === 'number' ? open.replace(/data-count="[^"]*"/, `data-count="${v}"`) : open;
    return opened + esc(out) + close;
  });
  // The F1 boxes stay hidden until live.js checks the dates, but their text is written in too.
  const f1 = data.f1, iso = d => String(d).slice(0, 10);
  if (f1?.raceName && f1.start && Number.isFinite(Date.parse(f1.start))) {
    html = html.replace(/(<span class="race__name">)[^<]*(<\/span>)/, `$1${esc(f1.locality ? `${f1.raceName}, ${f1.locality}` : f1.raceName)}$2`)
      .replace(/<time class="race__clock"[^>]*>[^<]*<\/time>/, `<time class="race__clock" datetime="${esc(f1.start)}">${dfmt.format(new Date(`${iso(f1.start)}T00:00:00Z`))}</time>`);
  }
  const last = data.f1Result, podium = Array.isArray(last?.podium) ? last.podium.slice(0, 3).filter(d => d?.driver && d.team && d.time) : [];
  if (last?.raceName && /^\d{4}-\d{2}-\d{2}/.test(String(last.date)) && podium.length === 3) {
    const row = (d, i) => {
      const pos = String(d.pos ?? i + 1);
      return `\n              <li class="last-race__row"><span class="last-race__position${i === 0 ? ' is-p1' : ''}">${esc(pos.startsWith('P') ? pos : `P${pos}`)}</span><span class="last-race__driver"><span class="last-race__name">${esc(d.driver)}</span>${d.code ? `<span class="last-race__code">${esc(d.code)}</span>` : ''}<span class="last-race__team">${esc(d.team)}</span></span><span class="last-race__time">${esc(d.time)}</span></li>`;
    };
    html = html.replace(/(<span data-last-race-name>)[^<]*(<\/span>)/, `$1${esc(last.raceName)}$2`)
      .replace(/<time data-last-race-date[^>]*>[^<]*<\/time>/, `<time data-last-race-date datetime="${iso(last.date)}">${dfmt.format(new Date(`${iso(last.date)}T00:00:00Z`))}</time>`)
      .replace(/(<ol class="last-race__podium" data-last-race-podium aria-label="Podium">)[\s\S]*?(<\/ol>)/, (all, open, close) => open + podium.map(row).join('') + '\n            ' + close);
    const fl = last.fastestLap;
    if (fl?.driver && fl.time) {
      html = html.replace(/(<p class="last-race__fastest" data-last-race-fastest[^>]*>)[\s\S]*?(<\/p>)/, `$1<span class="last-race__fastest-label">Fastest lap</span><span class="last-race__fastest-value">${esc(fl.driver)}, <span class="last-race__time">${esc(fl.time)}</span></span>$2`);
    }
  }
  const xd = data.x, posts = Array.isArray(xd?.posts) ? xd.posts.filter(p => /^\d+$/.test(p?.id) && Number.isFinite(Date.parse(p.date))) : [];
  if (posts.length && /^\w{1,15}$/.test(xd.user)) {
    const attr = t => esc(t).replace(/"/g, '&quot;');
    const out = 'target="_blank" rel="noopener noreferrer"';
    const clock = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Riyadh' });
    const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Riyadh' });
    const count = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
    const lang = l => (/^[a-z]{2}$/.test(l ?? '') ? ` lang="${l}"` : '');
    // links, mentions and hashtags in X's blue; links are swapped for placeholders first so their text isn't touched
    const rich = (text, links = []) => {
      const slots = [];
      let h = esc(text);
      for (const l of links) h = h.split(esc(l.text)).join(`\u0000${slots.push(`<a class="tweet__ent" href="${attr(l.href)}" ${out}>${esc(l.text)}</a>`) - 1}\u0000`);
      h = h.replace(/(^|[^\w&])@(\w{1,15})/g, (m, pre, u) => `${pre}<a class="tweet__ent" href="https://x.com/${u}" ${out}>@${u}</a>`)
        .replace(/(^|\s)#([\p{L}\p{N}_]+)/gu, (m, pre, tag) => `${pre}<a class="tweet__ent" href="https://x.com/hashtag/${encodeURIComponent(tag)}" ${out}>#${tag}</a>`);
      return h.replace(/\u0000(\d+)\u0000/g, (m, i) => slots[+i]);
    };
    const icon = (id, n, label) => `<span class="tweet__stat"><svg width="19" height="19" aria-hidden="true"><use href="#tw-${id}"/></svg>${n ? count.format(n) : ''}<span class="sr-only"> ${n} ${label}</span></span>`;
    const media = list => {
      const items = (list ?? []).filter(m => m?.src && m.w > 0 && m.h > 0);
      if (!items.length) return '';
      const one = items.length === 1 ? ` style="aspect-ratio: ${Math.max(items[0].w / items[0].h, 0.8).toFixed(3)}"` : '';
      return `<div class="tweet__media tweet__media--${items.length}"${one}>` + items.map(m => `<span class="tweet__m"><img src="${attr(m.src)}" alt="${attr(m.alt ?? '')}" width="${+m.w}" height="${+m.h}" loading="lazy" decoding="async">${m.type === 'video' || m.type === 'animated_gif' ? `<span class="tweet__play" aria-hidden="true">${m.type === 'video' ? '<svg width="26" height="26"><use href="#tw-play"/></svg>' : 'GIF'}</span>` : ''}</span>`).join('') + '</div>';
    };
    const who = xd.avatar ? `<img class="tweet__avatar" src="${attr(xd.avatar)}" alt="" width="48" height="48">` : `<span class="tweet__avatar" aria-hidden="true"></span>`;
    html = html.replace(/(<ol class="posts__list" data-x-posts>)[\s\S]*?(\n\s*<\/ol>)/, (all, open, close) => open + posts.map(p => {
      const d = new Date(p.date), q = p.quote;
      return `\n          <li class="post"><article class="tweet">`
        + `<header class="tweet__head">${who}<span class="tweet__who"><span class="tweet__name">${esc(xd.name ?? xd.user)}</span><span class="tweet__handle">@${xd.user}</span></span><svg class="tweet__logo" width="23" height="23" aria-hidden="true"><use href="#tw-x"/></svg></header>`
        + (p.text ? `<p class="tweet__text"${lang(p.lang)} dir="auto">${rich(p.text, p.links)}</p>` : '')
        + media(p.media)
        + (q && /^\d+$/.test(q.id) && /^\w{1,15}$/.test(q.handle) ? `<a class="tweet__quote" href="https://x.com/${q.handle}/status/${q.id}" ${out}><span class="tweet__qwho">${q.handle === xd.user && xd.avatar ? `<img class="tweet__qavatar" src="${attr(xd.avatar)}" alt="" width="20" height="20">` : ''}<span class="tweet__name" dir="auto">${esc(q.handle === xd.user ? xd.name ?? q.handle : q.name ?? q.handle)}</span> <span class="tweet__handle">@${q.handle}</span></span><span class="tweet__qtext"${lang(q.lang)} dir="auto">${esc(q.text ?? '')}</span></a>` : '')
        + `<a class="tweet__time" href="https://x.com/${xd.user}/status/${p.id}" ${out}><time datetime="${d.toISOString()}">${clock.format(d)} · ${day.format(d)}</time><span class="sr-only">, open this post on X</span></a>`
        + `<footer class="tweet__stats">${icon('reply', p.replies ?? 0, 'replies')}${icon('repost', p.reposts ?? 0, 'reposts')}${icon('like', p.likes ?? 0, 'likes')}</footer>`
        + `</article></li>`;
    }).join('') + close);
  }
  const courses = Array.isArray(data.learning?.courses) ? data.learning.courses.filter(c => c?.course && c.total > 0).slice(0, 5) : [];
  if (courses.length) {
    html = html.replace(/(<ul class="progress">)[\s\S]*?(\n\s*<\/ul>)/, (all, open, close) => open + courses.map(c =>
      `\n            <li style="--v:${Math.min(c.done / c.total, 1).toFixed(3)}"><span class="progress__name">${esc(c.course)}</span><span class="progress__val">${c.done} / ${c.total}</span><span class="progress__bar" aria-hidden="true"></span></li>`).join('') + close);
  }
  return html;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const prev = JSON.parse(await readFile(LIVE, 'utf8').catch(() => '{}'));
  const next = { ...prev };
  let changed = false;
  // `node tools/refresh-data.mjs x` refreshes only the named sources (the X job runs hourly; X often refuses GitHub's shared runners, and a refused run keeps the last posts)
  const only = process.argv.slice(2);
  if (!only.length) {
    try {
      await refreshF1Lap();
      console.log('ok   f1lap');
    } catch (e) {
      console.warn(`keep f1lap: ${e.message}`);
    }
  }
  const sources = { github: () => github(next.github), letterboxd: () => letterboxd(next.letterboxd), f1, apps: () => apps(next.apps), f1Result, week: () => week(next.apps), learning, revenuecat: () => revenuecat(next.revenuecat), work: () => work(next.work), gitlab, x: () => x(next.x) };
  for (const [key, fn] of Object.entries(sources).filter(([key]) => !only.length || only.includes(key))) {
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
  const page = await readFile(PAGE, 'utf8');
  const baked = bakeFallbacks(page, next);
  if (baked !== page) await writeFile(PAGE, baked);
}
