/* Live numbers from assets/data/live.json, refreshed daily by tools/refresh-data.mjs.
   The page ships with the same values written in, so a failed fetch changes nothing. */
const $ = (s, r = document) => r.querySelector(s);
const dig = (o, path) => path.split('.').reduce((v, k) => (v == null ? v : v[k]), o);
const nf = new Intl.NumberFormat('en-US');
const df = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const format = (v, fmt) => {
  if (fmt === 'date') return df.format(new Date(`${v}T00:00:00Z`));
  return typeof v === 'number' ? nf.format(v) : String(v);
};

function fill(data) {
  document.querySelectorAll('[data-live]').forEach(el => {
    const v = dig(data, el.dataset.live);
    if (v == null || v === '') return;
    el.textContent = format(v, el.dataset.fmt);
    if ('count' in el.dataset && typeof v === 'number') el.dataset.count = v;
  });
}

function race(f1) {
  const box = $('[data-race]');
  if (!box || !f1?.start || !f1.raceName) return;
  const start = Date.parse(f1.start);
  if (!Number.isFinite(start)) return;
  const RACE_MS = 2.5 * 3600e3;
  $('.race__name', box).textContent = `${f1.raceName}, ${f1.locality}`;
  const clock = $('.race__clock', box);
  const follow = $('.race__follow', box);
  let timer;
  const tick = () => {
    const ms = start - Date.now();
    if (ms < -RACE_MS) { box.hidden = true; clearInterval(timer); return; } // over; tomorrow's refresh brings the next one
    box.hidden = false;
    if (ms <= 0) {
      $('.race__label', box).textContent = 'Racing now';
      clock.textContent = 'Live';
      clock.dateTime = new Date(start).toISOString();
      if (follow) follow.hidden = false;
      box.classList.add('is-live');
      return;
    }
    if (follow) follow.hidden = true;
    const m = Math.floor(ms / 60e3), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
    clock.textContent = d ? `in ${d}d ${String(h).padStart(2, '0')}h` : h ? `in ${h}h ${String(mm).padStart(2, '0')}m` : `in ${mm}m`;
    clock.dateTime = new Date(start).toISOString();
  };
  tick();
  timer = setInterval(tick, 30e3);
}

function lastRace(result) {
  const box = $('[data-last-race]');
  if (!box || !result?.raceName || !result.date || !Array.isArray(result.podium) || result.podium.length < 3) return;

  $('[data-last-race-name]', box).textContent = result.raceName;
  const date = $('time[data-last-race-date]', box);
  const raceDate = new Date(`${String(result.date).slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(raceDate.getTime())) return;
  date.dateTime = String(result.date).slice(0, 10);
  date.textContent = df.format(raceDate);

  const podium = $('[data-last-race-podium]', box);
  podium.replaceChildren();
  result.podium.slice(0, 3).forEach((driver, index) => {
    if (!driver?.driver || !driver.team || !driver.time) return;
    const row = document.createElement('li');
    row.className = 'last-race__row';

    const position = document.createElement('span');
    position.className = `last-race__position${index === 0 ? ' is-p1' : ''}`;
    const pos = String(driver.pos ?? index + 1);
    position.textContent = pos.startsWith('P') ? pos : `P${pos}`;

    const info = document.createElement('span');
    info.className = 'last-race__driver';
    const name = document.createElement('span');
    name.className = 'last-race__name';
    name.textContent = driver.driver;
    info.append(name);
    if (driver.code) {
      const code = document.createElement('span');
      code.className = 'last-race__code';
      code.textContent = driver.code;
      info.append(code);
    }
    const team = document.createElement('span');
    team.className = 'last-race__team';
    team.textContent = driver.team;
    info.append(team);

    const time = document.createElement('span');
    time.className = 'last-race__time';
    time.textContent = driver.time;
    row.append(position, info, time);
    podium.append(row);
  });
  if (podium.children.length !== 3) return;

  const fastestLine = $('[data-last-race-fastest]', box);
  fastestLine.replaceChildren();
  if (result.fastestLap?.driver && result.fastestLap.time) {
    const label = document.createElement('span');
    label.className = 'last-race__fastest-label';
    label.textContent = 'Fastest lap';
    const time = document.createElement('span');
    time.className = 'last-race__time';
    time.textContent = result.fastestLap.time;
    const value = document.createElement('span');
    value.className = 'last-race__fastest-value';
    value.append(document.createTextNode(`${result.fastestLap.driver}, `), time);
    fastestLine.append(label, value);
    fastestLine.hidden = false;
  } else {
    fastestLine.hidden = true;
  }
  box.hidden = false;
}

function week(data) {
  const box = $('[data-week]');
  const items = Array.isArray(data?.items) ? data.items.slice(0, 6) : [];
  const list = $('[data-week-items]');
  if (!box || !list || !items.length) return;

  list.replaceChildren();
  let rendered = 0;
  for (const item of items) {
    if (!item?.url?.startsWith('https://')) continue;
    const push = item.kind === 'push' && typeof item.count === 'number' && Number.isFinite(item.count) && item.repo;
    const label = push
      ? `${item.count} ${item.count === 1 ? 'commit' : 'commits'} to ${item.repo.split('/').at(-1)}`
      : item.label;
    if (!label) continue;

    if (rendered) list.append(document.createTextNode(', '));
    const link = document.createElement('a');
    link.className = 'link year__week-link';
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    if (push) {
      const count = document.createElement('span');
      count.className = 'year__week-count';
      count.textContent = nf.format(item.count);
      link.append(count, document.createTextNode(` ${item.count === 1 ? 'commit' : 'commits'} to ${item.repo.split('/').at(-1)}`));
    } else {
      link.textContent = label;
    }
    list.append(link);
    rendered++;
  }
  box.hidden = rendered === 0;
}

function film(lb) {
  const box = $('[data-latest]');
  const f = lb?.latest;
  if (!box || !f?.title) return;
  const a = $('a', box);
  a.textContent = f.year ? `${f.title} (${f.year})` : f.title;
  if (f.url?.startsWith('https://letterboxd.com/')) a.href = f.url;
  const stars = $('.off__stars', box);
  if (f.rating) {
    stars.textContent = ' ' + '★'.repeat(Math.floor(f.rating)) + (f.rating % 1 ? '½' : '');
    stars.setAttribute('aria-label', `, rated ${f.rating} out of 5`);
    stars.setAttribute('role', 'img');
  }
  box.hidden = false;
}

// "Now": what shipped or got the most work in the last 7 days, the course in progress, and a film from the last
// two weeks. A part with nothing recent is left out; with no part at all, the written-in line stays.
function now(data) {
  const box = $('[data-now]'), out = $('[data-now-items]');
  if (!box || !out) return;
  const parts = [];
  const link = (text, href) => {
    const a = document.createElement('a');
    a.className = 'link'; a.textContent = text;
    if (href?.startsWith('https://')) { a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    return a;
  };
  const items = Array.isArray(data.week?.items) ? data.week.items : [];
  const shipped = items.find(i => i.kind === 'app' || i.kind === 'release');
  const busiest = items.filter(i => i.kind === 'push' && i.repo && i.repo !== 'justAbdulaziz10/Abdulaziz').sort((a, b) => b.count - a.count)[0];
  if (shipped) {
    const name = shipped.kind === 'app' && data.apps?.[shipped.app]?.version
      ? `${{ echo: 'Echo', docmara: 'DocMara' }[shipped.app]} ${data.apps[shipped.app].version}` : shipped.label;
    parts.push(['shipped ', link(name, shipped.url)]);
  } else if (busiest) {
    parts.push(['building ', link(busiest.repo.split('/').at(-1).replace(/[_-]/g, ' '), busiest.url)]);
  }
  const l = data.learning;
  if (l?.course) parts.push(['learning ', link(l.course, l.url), l.total ? ` (${l.done} of ${l.total})` : '']);
  const f = data.letterboxd?.latest;
  if (f?.title && Date.now() - Date.parse(`${f.watched}T00:00:00Z`) < 14 * 864e5) parts.push(['watched ', link(f.title, f.url)]);
  if (!parts.length) return;
  out.replaceChildren();
  parts.forEach((p, i) => { if (i) out.append(', '); out.append(...p); });
  out.append('.');
}

fetch(new URL('../assets/data/live.json', import.meta.url), { cache: 'no-cache' })
  .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
  .then(data => {
    fill(data); race(data.f1); lastRace(data.f1Result); week(data.week); film(data.letterboxd); now(data);
    dispatchEvent(new Event('resize')); // new lines moved the text, so the thread re-routes around it
  })
  .catch(() => {});
