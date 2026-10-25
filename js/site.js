document.documentElement.classList.add('has-js');

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const menu = document.querySelector('#menu-sheet');
const menuTrigger = document.querySelector('.menu-trigger');
const menuClose = document.querySelector('.menu-close');
const credits = document.querySelector('#credits-dialog');
const creditsOpen = document.querySelector('[data-credits-open]');
const creditsClose = document.querySelector('[data-credits-close]');
const scrollLock = { y: 0 };
let lenis = null;
let horizontalTimeline = null;
let activeScene = 0;

function lockDocument() {
  scrollLock.y = window.scrollY;
  document.body.classList.add('menu-open');
  document.body.style.position = 'fixed';
  document.body.style.insetBlockStart = '-' + scrollLock.y + 'px';
  document.body.style.inlineSize = '100%';
  if (lenis) lenis.stop();
}

function unlockDocument() {
  document.body.classList.remove('menu-open');
  document.body.style.position = '';
  document.body.style.insetBlockStart = '';
  document.body.style.inlineSize = '';
  window.scrollTo(0, scrollLock.y);
  if (lenis) lenis.start();
}

function trapDialogFocus(dialog, event) {
  if (event.key !== 'Tab') return;
  const focusable = Array.from(dialog.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'))
    .filter((element) => element.offsetWidth || element.offsetHeight || element.getClientRects().length);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

if (menu && menuTrigger && typeof menu.showModal === 'function') {
  menuTrigger.addEventListener('click', () => {
    menu.showModal();
    lockDocument();
    menuClose?.focus();
  });
  menuClose?.addEventListener('click', () => menu.close());
  menu.addEventListener('keydown', (event) => trapDialogFocus(menu, event));
  menu.addEventListener('cancel', (event) => {
    event.preventDefault();
    menu.close();
  });
  menu.addEventListener('close', () => {
    unlockDocument();
    menuTrigger.focus();
  });
  menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => menu.close()));
}

if (credits && creditsOpen && typeof credits.showModal === 'function') {
  creditsOpen.addEventListener('click', () => {
    credits.showModal();
    lockDocument();
    creditsClose?.focus();
  });
  creditsClose?.addEventListener('click', () => credits.close());
  credits.addEventListener('keydown', (event) => trapDialogFocus(credits, event));
  credits.addEventListener('close', () => {
    unlockDocument();
    creditsOpen.focus();
  });
}

function updateRiyadhClock() {
  const clock = document.querySelector('[data-riyadh-clock]');
  if (!clock) return;
  const now = new Date();
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', hour12: false
  }).format(now);
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);
  clock.textContent = time;
  clock.dateTime = date + 'T' + time + ':00+03:00';
}
updateRiyadhClock();
window.setInterval(updateRiyadhClock, 30000);

const workItems = Array.from(document.querySelectorAll('.work-index-item'));
for (const item of workItems) {
  const button = item.querySelector('.work-toggle');
  const detail = button ? document.getElementById(button.getAttribute('aria-controls')) : null;
  if (!button || !detail) continue;
  let pinned = false;
  const setExpanded = (expanded) => {
    button.setAttribute('aria-expanded', String(expanded));
    detail.hidden = !expanded;
  };
  setExpanded(false);
  item.addEventListener('pointerenter', () => setExpanded(true));
  item.addEventListener('pointerleave', () => {
    if (!pinned && !item.contains(document.activeElement)) setExpanded(false);
  });
  item.addEventListener('focusin', () => setExpanded(true));
  item.addEventListener('focusout', (event) => {
    if (!pinned && !item.contains(event.relatedTarget)) setExpanded(false);
  });
  button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') === 'true';
    pinned = !pinned;
    setExpanded(pinned ? true : !expanded);
  });
}

const showcase = document.querySelector('[data-showcase-stage]');
const viewport = document.querySelector('[data-showcase-viewport]');
const track = document.querySelector('[data-showcase-track]');
const scenes = Array.from(document.querySelectorAll('[data-app-scene]'));
const dots = Array.from(document.querySelectorAll('[data-scene-index]'));
const currentScene = document.querySelector('[data-scene-current]');

function setActiveScene(index) {
  if (!scenes.length) return;
  activeScene = Math.max(0, Math.min(scenes.length - 1, index));
  dots.forEach((dot, dotIndex) => {
    const current = dotIndex === activeScene;
    dot.classList.toggle('is-current', current);
    dot.setAttribute('aria-current', String(current));
  });
  if (currentScene) currentScene.textContent = String(activeScene + 1).padStart(2, '0');
}

function goToScene(index) {
  const target = scenes[index];
  if (!target) return;
  setActiveScene(index);
  if (horizontalTimeline?.scrollTrigger) {
    const trigger = horizontalTimeline.scrollTrigger;
    const fraction = scenes.length > 1 ? index / (scenes.length - 1) : 0;
    trigger.scroll(trigger.start + ((trigger.end - trigger.start) * fraction));
    return;
  }
  const left = target.getBoundingClientRect().left - viewport.getBoundingClientRect().left + viewport.scrollLeft;
  viewport.scrollTo({ left, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
}

dots.forEach((dot) => dot.addEventListener('click', () => goToScene(Number(dot.dataset.sceneIndex))));
if (viewport && scenes.length) {
  let scrollFrame = 0;
  viewport.addEventListener('scroll', () => {
    if (scrollFrame) return;
    scrollFrame = window.requestAnimationFrame(() => {
      scrollFrame = 0;
      if (!horizontalTimeline) {
        const range = viewport.scrollWidth - viewport.clientWidth;
        setActiveScene(range > 0 ? Math.round((viewport.scrollLeft / range) * (scenes.length - 1)) : 0);
      }
    });
  }, { passive: true });
}

function setupMotion() {
  if (reducedMotion.matches) return;
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  if (!gsap) return;
  if (ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  const heroTimeline = gsap.timeline({ defaults: { ease: 'power3.out' } });
  heroTimeline
    .fromTo('.hero-photo img', { scale: 1.06 }, { scale: 1, duration: 1.2, ease: 'power2.out' }, 0)
    .fromTo('.hero-name-ar', { yPercent: 105, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: .62 }, 0)
    .fromTo('.hero-name-latin', { yPercent: 105, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: .62 }, .74)
    .fromTo('.hero-role', { autoAlpha: 0 }, { autoAlpha: 1, duration: .28 }, 1)
    .fromTo('.hero-tagline, .riyadh-clock', { autoAlpha: 0 }, { autoAlpha: 1, duration: .32, stagger: .05 }, 1.04);

  if (!ScrollTrigger) return;
  gsap.to('.hero-photo img', {
    yPercent: 10,
    ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
  });

  if (showcase && track && scenes.length && window.matchMedia('(min-width: 1024px)').matches) {
    showcase.classList.add('is-horizontal');
    requestAnimationFrame(() => {
      const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
      horizontalTimeline = gsap.timeline({
        scrollTrigger: {
          trigger: showcase,
          start: 'top top',
          end: () => '+=' + distance(),
          pin: true,
          scrub: .7,
          invalidateOnRefresh: true,
          onUpdate: (self) => setActiveScene(Math.round(self.progress * (scenes.length - 1)))
        }
      });
      horizontalTimeline.to(track, { x: () => -distance(), ease: 'none', duration: 1 }, 0);
      scenes.forEach((scene, index) => {
        const devices = scene.querySelectorAll('.phone');
        if (devices.length) {
          horizontalTimeline.fromTo(devices, { rotationY: 12 }, { rotationY: 0, duration: .16, ease: 'power2.out' }, Math.min(.84, index / scenes.length));
        }
      });
      ScrollTrigger.refresh();
    });
  }

  const timelineLine = document.querySelector('.path-line');
  if (timelineLine) {
    gsap.fromTo(timelineLine, { scaleY: 0 }, {
      scaleY: 1,
      ease: 'none',
      scrollTrigger: { trigger: '.path-list', start: 'top 72%', end: 'bottom 76%', scrub: true }
    });
  }

  const contributionCells = document.querySelectorAll('.contribution-cell');
  if (contributionCells.length) {
    gsap.fromTo(contributionCells, { opacity: .12 }, {
      opacity: 1,
      duration: .22,
      stagger: .0035,
      ease: 'none',
      scrollTrigger: { trigger: '.contribution-grid', start: 'top 82%', once: true }
    });
  }

  if (window.matchMedia('(pointer: fine)').matches && window.Lenis) {
    const ScrollTriggerConstructor = window.ScrollTrigger;
    lenis = new window.Lenis({ autoRaf: false, smoothWheel: true, syncTouch: false });
    if (ScrollTriggerConstructor) lenis.on('scroll', ScrollTriggerConstructor.update);
    const updateLenis = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(updateLenis);
    gsap.ticker.lagSmoothing(0);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupMotion, { once: true });
else setupMotion();

reducedMotion.addEventListener?.('change', (event) => {
  if (event.matches) {
    if (horizontalTimeline) horizontalTimeline.scrollTrigger?.kill(true);
    horizontalTimeline?.kill();
    horizontalTimeline = null;
    if (lenis) {
      lenis.destroy();
      lenis = null;
    }
    document.querySelectorAll('.contribution-cell').forEach((cell) => { cell.style.opacity = '1'; });
    const line = document.querySelector('.path-line');
    if (line) line.style.transform = 'scaleY(1)';
    showcase?.classList.remove('is-horizontal');
  }
});
