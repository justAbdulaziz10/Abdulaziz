const control = document.querySelector('[data-pm-switch]');
const panels = [...document.querySelectorAll('[data-pm]')];
const html = document.documentElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

let enabled = false;
let revision = 0;

function setUrlState(isEnabled) {
  const url = new URL(location.href);
  if (isEnabled) url.searchParams.set('view', 'product');
  else url.searchParams.delete('view');
  history.replaceState(history.state, '', url);
}

function waitForPanel(panel) {
  return new Promise(resolve => {
    const finish = event => {
      if (event && (event.target !== panel || event.propertyName !== 'grid-template-rows')) return;
      clearTimeout(timer);
      panel.removeEventListener('transitionend', finish);
      resolve();
    };
    const timer = setTimeout(finish, 280);
    panel.addEventListener('transitionend', finish);
  });
}

function setEnabled(isEnabled) {
  if (enabled === isEnabled) return;
  enabled = isEnabled;
  const currentRevision = ++revision;

  html.classList.toggle('is-pm', enabled);
  control.setAttribute('aria-checked', String(enabled));
  setUrlState(enabled);

  if (reduceMotion.matches) {
    panels.forEach(panel => {
      panel.classList.toggle('is-open', enabled);
      panel.hidden = !enabled;
    });
    window.dispatchEvent(new Event('resize'));
    return;
  }

  const settled = panels.map(waitForPanel);
  if (enabled) {
    panels.forEach(panel => { panel.hidden = false; });
    requestAnimationFrame(() => {
      if (currentRevision !== revision) return;
      panels.forEach(panel => panel.classList.add('is-open'));
    });
  } else {
    panels.forEach(panel => panel.classList.remove('is-open'));
  }

  Promise.all(settled).then(() => {
    if (currentRevision !== revision) return;
    if (!enabled) panels.forEach(panel => { panel.hidden = true; });
    window.dispatchEvent(new Event('resize'));
  });
}

control.addEventListener('click', () => setEnabled(!enabled));
setEnabled(new URLSearchParams(location.search).get('view') === 'product');
