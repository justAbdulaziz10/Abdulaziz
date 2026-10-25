(function () {
  const root = document.documentElement;
  const motion = root.classList.contains('motion');
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const desktop = matchMedia('(min-width: 900px)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- Fit display lines to the frame width ---------- */
  function fitLine(el, width, finalSpacingEm, maxFs) {
    // Measure the glyph boxes at a known size, with the final tracking applied, then scale.
    el.style.fontSize = '100px';
    const spans = [...el.children];
    spans.forEach((s) => { s.style.transition = 'none'; s.style.letterSpacing = finalSpacingEm + 'em'; s.style.transform = 'none'; });
    const first = spans[0].getBoundingClientRect(), last = spans[spans.length - 1].getBoundingClientRect();
    const natural = last.right - first.left + finalSpacingEm * -100;
    spans.forEach((s) => { s.style.letterSpacing = ''; s.style.transform = ''; });
    void el.offsetWidth;
    spans.forEach((s) => { s.style.transition = ''; });
    const fs = Math.min(width / natural * 100, maxFs);
    el.style.fontSize = '';
    el.style.setProperty('--fs', fs.toFixed(2) + 'px');
  }
  function fitAll() {
    const frame = document.querySelector('.hero__frame');
    if (frame) {
      const cs = getComputedStyle(frame);
      const w = frame.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const maxFs = innerHeight * (desktop.matches ? 0.25 : 0.2);
      document.querySelectorAll('.name__line').forEach((l) => fitLine(l, w * 1.01, -0.02, maxFs));
    }
    const title = document.querySelector('.contact__title');
    if (title) {
      const box = title.parentElement;
      const cs = getComputedStyle(box);
      const w = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      title.style.fontSize = '100px';
      const fs = w / title.scrollWidth * 100;
      title.style.fontSize = '';
      title.style.setProperty('--fs', fs.toFixed(2) + 'px');
    }
  }

  /* ---------- Opening sequence ---------- */
  const fontsReady = document.fonts ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 900))]) : Promise.resolve();
  fontsReady.then(() => {
    fitAll();
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('is-open')));
  });
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { fitAll(); measure(); }, 120); });

  /* ---------- Mobile menu ---------- */
  const btn = document.getElementById('menu-btn');
  const menu = document.getElementById('menu');
  let lenis = null;
  function setMenu(open) {
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? 'Close' : 'Menu';
    menu.hidden = !open;
    document.body.style.overflow = open ? 'hidden' : '';
    if (lenis) open ? lenis.stop() : lenis.start();
    if (open) menu.querySelector('a').focus();
  }
  if (btn && menu) {
    btn.addEventListener('click', () => setMenu(btn.getAttribute('aria-expanded') !== 'true'));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); btn.focus(); } });
  }

  /* ---------- Smooth scroll ---------- */
  if (motion && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true, anchors: { offset: 0 } });
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }

  /* ---------- Contribution grid ---------- */
  const grid = document.getElementById('contrib');
  if (grid && window.CONTRIB) {
    const { start, counts } = window.CONTRIB;
    const offset = new Date(start + 'T12:00:00Z').getUTCDay();
    const frag = document.createDocumentFragment();
    for (let i = 0; i < offset; i++) { const c = document.createElement('i'); c.className = 'empty'; frag.appendChild(c); }
    counts.forEach((n) => {
      const c = document.createElement('i');
      c.dataset.l = n === 0 ? 0 : n < 4 ? 1 : n < 10 ? 2 : n < 25 ? 3 : 4;
      frag.appendChild(c);
    });
    grid.appendChild(frag);
  }

  /* ---------- Masked headings ---------- */
  const masks = document.querySelectorAll('.mask');
  if (motion && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
    }), { rootMargin: '0px 0px -12% 0px' });
    masks.forEach((m) => io.observe(m));
  } else masks.forEach((m) => m.classList.add('is-in'));

  /* ---------- Elements driven by the scroll ---------- */
  const bar = document.getElementById('bar');
  const hero = document.querySelector('.hero');
  const floats = [...document.querySelectorAll('.float')];
  const depths = [1, 0.7, 0.45, 0.35, 0.25];

  const stats = document.getElementById('stats');
  const counters = [...document.querySelectorAll('.count')].map((el) => ({ el, to: +el.dataset.to, last: -1 }));
  const fmt = new Intl.NumberFormat('en-US');

  const show = document.getElementById('show');
  const p3 = document.getElementById('p3');
  const p3body = p3 && p3.querySelector('.p3__body');
  const screens = p3 ? [...p3.querySelectorAll('.p3__screen')] : [];
  const icons = p3 ? [...p3.querySelectorAll('.p3__icon')] : [];
  const glare = p3 && p3.querySelector('.p3__glare');
  const floor = document.querySelector('.p3__floor');
  const phoneSets = [...document.querySelectorAll('.chapter__phones')];

  const rassah = document.getElementById('rassah-media');

  const reel = document.querySelector('.reel');
  const track = document.getElementById('reel-track');
  const reelBar = document.getElementById('reel-bar');
  const reelNow = document.getElementById('reel-now');
  const stills = track ? [...track.children] : [];
  const navLinks = [...document.querySelectorAll('.bar__nav a')];
  const sections = navLinks.map((a) => document.querySelector(a.getAttribute('href')));

  let pinned = false, travel = 0;
  function measure() {
    if (!reel || !track) return;
    pinned = motion && desktop.matches;
    reel.classList.toggle('reel--pinned', pinned);
    if (pinned) {
      travel = Math.max(0, track.scrollWidth - innerWidth);
      reel.style.height = (travel + innerHeight) + 'px';
    } else {
      reel.style.height = '';
      track.style.transform = '';
    }
  }
  measure();
  addEventListener('load', measure);

  // Keyboard users: bring a focused frame of the pinned reel into view.
  if (track) track.addEventListener('focusin', (e) => {
    if (!pinned) return;
    const still = e.target.closest('.still');
    if (!still) return;
    const p = clamp((still.offsetLeft - parseFloat(getComputedStyle(track).paddingLeft)) / Math.max(1, travel));
    const top = reel.getBoundingClientRect().top + scrollY + p * (reel.offsetHeight - innerHeight);
    if (lenis) lenis.scrollTo(top, { immediate: true }); else scrollTo(0, top);
  });

  const pointer = [0, 0], pSmooth = [0, 0];
  if (motion) addEventListener('pointermove', (e) => { pointer[0] = e.clientX / innerWidth - 0.5; pointer[1] = e.clientY / innerHeight - 0.5; }, { passive: true });

  // Phone choreography across the Mara and Echo chapters.
  // 0 to .4: Mara, home then assistant. .4 to .6: a full turn, the back shows the next app.
  // .6 to 1: Echo, three screens.
  function phoneAt(p) {
    let ry;
    if (p < 0.4) ry = lerp(-24, 14, p / 0.4);
    else if (p < 0.6) ry = lerp(14, 336, easeIO((p - 0.4) / 0.2));
    else ry = lerp(336, 374, (p - 0.6) / 0.4);
    const ops = [0, 0, 0, 0, 0];
    const fade = (a, b) => clamp((p - a) / (b - a));
    if (p < 0.5) { const f = fade(0.17, 0.25); ops[0] = 1 - f; ops[1] = f; }
    else {
      const f1 = fade(0.72, 0.78), f2 = fade(0.86, 0.92);
      ops[2] = 1 - f1; ops[3] = f1 * (1 - f2); ops[4] = f2;
    }
    return { ry, ops, app: p < 0.45 ? 0 : 1 };
  }

  function progress(el, start, span) {
    const r = el.getBoundingClientRect();
    return { r, p: clamp((start - r.top) / span) };
  }

  let lastY = -1, lastPX = 9, lastPY = 9;
  function frame() {
    const y = scrollY, vh = innerHeight;
    pSmooth[0] += (pointer[0] - pSmooth[0]) * 0.07;
    pSmooth[1] += (pointer[1] - pSmooth[1]) * 0.07;
    const pointerMoved = Math.abs(pSmooth[0] - lastPX) > 0.0005 || Math.abs(pSmooth[1] - lastPY) > 0.0005;
    const scrolled = y !== lastY;

    if (bar && scrolled) {
      bar.classList.toggle('is-scrolled', y > 40);
      if (lastY >= 0) {
        if (y > lastY + 2 && y > vh * 0.6) bar.classList.add('is-hidden');
        else if (y < lastY - 2) bar.classList.remove('is-hidden');
      }
    }

    if (motion && hero && y < vh * 1.2) {
      const t = performance.now() / 1000;
      floats.forEach((f, i) => {
        const d = depths[i];
        const x = -pSmooth[0] * 60 * d + Math.sin(t * 0.3 + i * 1.7) * 6 * d;
        const yy = -y * 0.35 * d - pSmooth[1] * 40 * d + Math.cos(t * 0.25 + i) * 8 * d;
        f.style.setProperty('--x', x.toFixed(1) + 'px');
        f.style.setProperty('--y', yy.toFixed(1) + 'px');
      });
    }

    if (motion && (scrolled || pointerMoved)) {
      // Proof numbers count with the scroll, and the year of contributions draws in.
      if (stats) {
        const { r, p } = progress(stats, vh * 0.92, vh * 0.5);
        if (r.top < vh && r.bottom > 0) {
          const e = ease(p);
          counters.forEach((c) => {
            const v = Math.round(c.to * e);
            if (v !== c.last) { c.el.textContent = fmt.format(v); c.last = v; }
          });
          if (grid) grid.style.setProperty('--c', ease(clamp((p - 0.15) / 0.85)).toFixed(4));
        }
      }

      // Desktop: the sticky phone.
      if (show && p3 && desktop.matches) {
        const r = show.getBoundingClientRect();
        if (r.top < vh && r.bottom > 0) {
          const p = clamp(-r.top / Math.max(1, r.height - vh));
          const s = phoneAt(p);
          const ry = s.ry + pSmooth[0] * 14;
          const rx = 4 - pSmooth[1] * 10;
          p3body.style.transform = `translate3d(0,${(Math.sin(p * Math.PI * 2) * 10).toFixed(1)}px,0) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
          screens.forEach((sc, i) => sc.style.setProperty('--o', s.ops[i].toFixed(3)));
          icons.forEach((ic, i) => { ic.style.opacity = i === s.app ? 1 : 0; });
          const rad = (ry * Math.PI) / 180;
          if (glare) glare.style.setProperty('--gx', (50 + Math.sin(rad) * 60).toFixed(1) + '%');
          if (floor) floor.style.setProperty('--fs', (0.62 + Math.abs(Math.cos(rad)) * 0.38).toFixed(3));
        }
      }

      // Mobile: each pair of phones turns as it passes.
      if (!desktop.matches) phoneSets.forEach((set) => {
        const r = set.getBoundingClientRect();
        if (r.top < vh && r.bottom > 0) {
          const t = clamp(((r.top + r.height / 2) - vh / 2) / (vh / 2 + r.height / 2), -1, 1);
          set.querySelectorAll('.flatphone').forEach((f) => f.style.setProperty('--t', t.toFixed(3)));
        }
      });

      // Rassah: layers separate with the scroll and follow the pointer.
      if (rassah) {
        const r = rassah.getBoundingClientRect();
        if (r.top < vh && r.bottom > 0) {
          const sy = ((r.top + r.height / 2) - vh / 2) / vh;
          rassah.style.setProperty('--sy', (sy * 2).toFixed(3));
          if (finePointer) {
            rassah.style.setProperty('--px', (-pSmooth[0] * 1.6).toFixed(3));
            rassah.style.setProperty('--py', (-pSmooth[1] * 1.6).toFixed(3));
          }
        }
      }
    }

    if (reel && track && (scrolled || !pinned)) {
      let p;
      if (pinned) {
        const r = reel.getBoundingClientRect();
        p = clamp(-r.top / Math.max(1, r.height - vh));
        track.style.transform = `translate3d(${(-p * travel).toFixed(1)}px,0,0)`;
      } else {
        const max = track.scrollWidth - track.clientWidth;
        p = max > 0 ? track.scrollLeft / max : 0;
      }
      if (reelBar) reelBar.style.setProperty('--p', p.toFixed(4));
      if (reelNow) reelNow.textContent = String(Math.min(stills.length, 1 + Math.round(p * (stills.length - 1))));
    }

    if (scrolled) {
      let active = -1;
      sections.forEach((s, i) => { if (s && s.getBoundingClientRect().top < vh * 0.45) active = i; });
      navLinks.forEach((a, i) => a.classList.toggle('is-active', i === active));
    }

    lastY = y; lastPX = pSmooth[0]; lastPY = pSmooth[1];
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---------- Shared-element expand ---------- */
  const box = document.getElementById('lightbox');
  const closeBtn = document.getElementById('lightbox-close');
  let open = null;
  function targetRect(w, h) {
    const m = innerWidth < 900 ? 16 : 72;
    const top = innerWidth < 900 ? 80 : 84;
    const aw = innerWidth - m * 2, ah = innerHeight - top - m;
    const s = Math.min(aw / w, ah / h, 1600 / w);
    const W = w * s, H = h * s;
    return { left: (innerWidth - W) / 2, top: top + (ah - H) / 2, width: W, height: H };
  }
  function flip(img, from, to, reverse) {
    const dx = from.left - to.left, dy = from.top - to.top;
    const sx = from.width / to.width, sy = from.height / to.height;
    const a = `translate(${dx}px,${dy}px) scale(${sx},${sy})`;
    const frames = reverse ? [{ transform: 'none' }, { transform: a }] : [{ transform: a }, { transform: 'none' }];
    return img.animate(frames, { duration: motion ? 640 : 0, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' });
  }
  function openExpand(trigger) {
    const thumb = trigger.querySelector('img');
    const from = thumb.getBoundingClientRect();
    const to = targetRect(from.width, from.height);
    const img = new Image();
    img.className = 'lightbox__img';
    img.alt = thumb.alt;
    img.src = thumb.currentSrc || thumb.src;
    Object.assign(img.style, { left: to.left + 'px', top: to.top + 'px', width: to.width + 'px', height: to.height + 'px' });
    box.appendChild(img);
    box.hidden = false;
    root.classList.add('lightbox-open');
    if (lenis) lenis.stop();
    thumb.style.visibility = 'hidden';
    if (motion) box.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, easing: 'ease-out' });
    flip(img, from, to, false);
    const hi = new Image();
    hi.onload = () => { img.src = hi.src; };
    hi.src = trigger.dataset.full;
    img.addEventListener('click', closeExpand);
    open = { trigger, thumb, img };
    closeBtn.focus();
  }
  function closeExpand() {
    if (!open) return;
    const { trigger, thumb, img } = open;
    open = null;
    const to = img.getBoundingClientRect();
    const from = thumb.getBoundingClientRect();
    const anim = flip(img, from, to, true);
    if (motion) box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 520, easing: 'ease-in', fill: 'forwards' });
    anim.finished.then(() => {
      thumb.style.visibility = '';
      img.remove();
      box.hidden = true;
      box.getAnimations().forEach((a) => a.cancel());
      root.classList.remove('lightbox-open');
      if (lenis) lenis.start();
      trigger.focus({ preventScroll: true });
    });
  }
  if (box) {
    document.querySelectorAll('.expand').forEach((b) => b.addEventListener('click', () => openExpand(b)));
    closeBtn.addEventListener('click', closeExpand);
    box.addEventListener('click', (e) => { if (e.target === box) closeExpand(); });
    addEventListener('keydown', (e) => {
      if (!open) return;
      if (e.key === 'Escape') closeExpand();
      if (e.key === 'Tab') { e.preventDefault(); closeBtn.focus(); }
    });
  }

  /* ---------- Copy email ---------- */
  const copy = document.getElementById('copy');
  const copyStatus = document.getElementById('copy-status');
  if (copy && copyStatus) copy.addEventListener('click', async () => {
    const email = copy.dataset.email;
    try {
      await navigator.clipboard.writeText(email);
      copy.textContent = 'Copied';
      copyStatus.textContent = 'Address copied to the clipboard.';
    } catch (e) {
      copyStatus.textContent = 'Copy failed. The address is ' + email;
    }
    clearTimeout(copy._t);
    copy._t = setTimeout(() => { copy.textContent = 'Copy address'; copyStatus.textContent = email; }, 2400);
  });

  /* ---------- Cursor ---------- */
  const cursor = document.getElementById('cursor');
  if (cursor && motion && finePointer) {
    root.classList.add('has-cursor');
    const pos = [-200, -200], cur = [-200, -200];
    cursor.style.transform = 'translate3d(-200px,-200px,0)';
    addEventListener('pointermove', (e) => {
      pos[0] = e.clientX; pos[1] = e.clientY;
      const media = e.target.closest('[data-cursor="media"]');
      const link = !media && e.target.closest('a, button');
      cursor.classList.toggle('is-media', !!media);
      cursor.classList.toggle('is-link', !!link);
    }, { passive: true });
    addEventListener('pointerdown', () => cursor.classList.add('is-down'));
    addEventListener('pointerup', () => cursor.classList.remove('is-down'));
    document.addEventListener('pointerleave', () => { pos[0] = pos[1] = -200; });
    (function loop() {
      if (Math.abs(pos[0] - cur[0]) > 0.1 || Math.abs(pos[1] - cur[1]) > 0.1) {
        cur[0] += (pos[0] - cur[0]) * 0.2; cur[1] += (pos[1] - cur[1]) * 0.2;
        cursor.style.transform = `translate3d(${cur[0].toFixed(1)}px,${cur[1].toFixed(1)}px,0)`;
      }
      requestAnimationFrame(loop);
    })();
  }
})();
