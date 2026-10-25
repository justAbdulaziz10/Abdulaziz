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
  const RACE_MS = 2.5 * 3600e3;
  $('.race__name', box).textContent = `${f1.raceName}, ${f1.locality}`;
  const clock = $('.race__clock', box);
  let timer;
  const tick = () => {
    const ms = start - Date.now();
    if (ms < -RACE_MS) { box.hidden = true; clearInterval(timer); return; } // over; tomorrow's refresh brings the next one
    box.hidden = false;
    if (ms <= 0) { $('.race__label', box).textContent = 'Racing now'; clock.textContent = 'Live'; box.classList.add('is-live'); return; }
    const m = Math.floor(ms / 60e3), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
    clock.textContent = d ? `in ${d}d ${String(h).padStart(2, '0')}h` : h ? `in ${h}h ${String(mm).padStart(2, '0')}m` : `in ${mm}m`;
    clock.dateTime = new Date(start).toISOString();
  };
  tick();
  timer = setInterval(tick, 30e3);
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

fetch(new URL('../assets/data/live.json', import.meta.url), { cache: 'no-cache' })
  .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
  .then(data => {
    fill(data); race(data.f1); film(data.letterboxd);
    dispatchEvent(new Event('resize')); // new lines moved the text, so the thread re-routes around it
  })
  .catch(() => {});
