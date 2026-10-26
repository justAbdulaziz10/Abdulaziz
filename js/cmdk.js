import { showToast, toggleNightMode } from './eggs.js';

const EMAIL = 'abdulazizalkhlaiwe@gmail.com';
const trigger = document.querySelector('[data-cmdk-open]');
const keyHint = trigger?.querySelector('[data-cmdk-key]');
const platform = navigator.userAgentData?.platform || navigator.platform || navigator.userAgent;
const isApple = /Mac|iPhone|iPad|iPod/i.test(platform);

if (trigger && keyHint) keyHint.textContent = isApple ? '⌘K' : 'Ctrl K';

const dialog = document.createElement('dialog');
dialog.className = 'cmdk';
dialog.dataset.cmdk = '';
dialog.setAttribute('aria-label', 'Command menu');

const panel = document.createElement('div');
panel.className = 'cmdk__panel';

const searchWrap = document.createElement('div');
searchWrap.className = 'cmdk__search-wrap';

const input = document.createElement('input');
input.className = 'cmdk__input';
input.type = 'search';
input.id = 'cmdk-search';
input.placeholder = 'Type a command or search';
input.autocomplete = 'off';
input.spellcheck = false;
input.setAttribute('role', 'combobox');
input.setAttribute('aria-label', 'Type a command or search');
input.setAttribute('aria-expanded', 'true');
input.setAttribute('aria-controls', 'cmdk-listbox');
input.setAttribute('aria-autocomplete', 'list');

const listbox = document.createElement('div');
listbox.className = 'cmdk__list';
listbox.id = 'cmdk-listbox';
listbox.setAttribute('role', 'listbox');
listbox.setAttribute('aria-label', 'Commands');

const emptyState = document.createElement('p');
emptyState.className = 'cmdk__empty';
emptyState.setAttribute('role', 'status');
emptyState.setAttribute('aria-live', 'polite');
emptyState.hidden = true;

searchWrap.append(input);
panel.append(searchWrap, listbox, emptyState);
dialog.append(panel);
document.body.append(dialog);

const groupDefinitions = [
  { key: 'goTo', title: 'Go to' },
  { key: 'projects', title: 'Projects' },
  { key: 'actions', title: 'Actions' },
  { key: 'links', title: 'Links' },
];

const projectKeywords = {
  echo: 'photo app ios',
  rassah: 'packing gemini',
  pitlane: 'f1 formula racing',
  mara: 'health wellness',
  daleelk: 'travel gulf',
};

const linkItems = [
  { label: 'LinkedIn', url: 'https://www.linkedin.com/in/abdulaziz-alkhlaiwe' },
  { label: 'GitHub', url: 'https://github.com/justAbdulaziz10' },
  { label: 'GitLab', url: 'https://gitlab.com/abdulaziz.alkhlaiwe' },
  { label: 'X', url: 'https://x.com/AlkhlaiweA' },
  { label: 'Letterboxd', url: 'https://letterboxd.com/notabdulaziz/' },
  { label: 'Learning roadmap', url: 'https://github.com/justAbdulaziz10/To-infinity-and-AI' },
  { label: "This site's source", url: 'https://github.com/justAbdulaziz10/Abdulaziz' },
];

const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const textOf = element => element?.textContent?.trim().replace(/\s+/g, ' ') || '';

function headingFor(target) {
  if (!target) return null;
  if (target.matches('h1, h2, h3, h4, h5, h6')) return target;
  return target.querySelector('h1:not([hidden]), h2:not([hidden]), h3:not([hidden]), h4:not([hidden]), h5:not([hidden]), h6:not([hidden])');
}

function makeNavigationItem(label, target, { keywords = '', hashTarget = target } = {}) {
  if (!target) return null;
  const heading = headingFor(target);
  const anchor = hashTarget?.id ? hashTarget : target;
  if (!anchor.id && target.matches('section[aria-label="Films"]')) anchor.id = 'films';
  return {
    id: `cmdk-${slug(`go-to-${label}`)}`,
    kind: 'navigate',
    label,
    hint: '',
    keywords,
    target,
    heading: heading || target,
    hashTarget: anchor,
  };
}

function buildItems() {
  const goTo = [];
  const work = makeNavigationItem('Work', document.querySelector('#work'), { keywords: 'projects selected work' });
  if (work) goTo.push(work);

  document.querySelectorAll('main section.project').forEach(section => {
    const heading = section.querySelector('h2');
    const item = makeNavigationItem(textOf(heading), section, { keywords: projectKeywords[section.id] || '' });
    if (item) goTo.push(item);
  });

  const record = document.querySelector('#more');
  const recordItem = makeNavigationItem('The full record', record, { keywords: 'projects portfolio record' });
  if (recordItem) goTo.push(recordItem);

  const notesHeading = document.querySelector('#tools-title');
  const notesRegion = notesHeading?.closest('[role="region"]');
  const notesItem = makeNavigationItem(textOf(notesHeading), notesRegion, { keywords: 'tools skills technologies', hashTarget: notesHeading });
  if (notesItem) goTo.push(notesItem);

  const experience = document.querySelector('#experience');
  const experienceItem = makeNavigationItem('Experience', experience, { keywords: 'education career' });
  if (experienceItem) goTo.push(experienceItem);

  const offClock = document.querySelector('#offclock');
  const offClockItem = makeNavigationItem(textOf(headingFor(offClock)), offClock, { keywords: 'music leisure' });
  if (offClockItem) goTo.push(offClockItem);

  const films = document.querySelector('section[aria-label="Films"]');
  const filmsItem = makeNavigationItem('Films', films, { keywords: 'film movies letterboxd' });
  if (filmsItem) goTo.push(filmsItem);

  const contact = document.querySelector('#contact');
  const contactItem = makeNavigationItem('Contact', contact, { keywords: 'email get in touch' });
  if (contactItem) goTo.push(contactItem);

  const projects = [...document.querySelectorAll('#more .sleeve .track[href]')]
    .filter(link => {
      try { return new URL(link.href, location.href).origin !== location.origin; }
      catch { return false; }
    })
    .map(link => {
      const name = link.querySelector('.track__name');
      const label = textOf(name);
      return {
        id: `cmdk-project-${slug(label)}`,
        kind: 'external',
        label,
        hint: 'Opens in a new tab',
        keywords: textOf(link.querySelector('.track__desc')),
        url: link.href,
      };
    });

  const productWorkIsOn = document.documentElement.classList.contains('is-pm');
  const nightModeIsOn = document.documentElement.classList.contains('is-night');
  const actions = [
    { id: 'cmdk-action-copy-email', kind: 'copy-email', label: 'Copy email', hint: EMAIL, keywords: 'mail contact address' },
    { id: 'cmdk-action-email', kind: 'email', label: 'Email me', hint: EMAIL, keywords: 'mailto contact message' },
    {
      id: 'cmdk-action-product-work',
      kind: 'product-work',
      label: productWorkIsOn ? 'Hide product work' : 'Show product work',
      hint: '',
      keywords: 'product work pm',
    },
    { id: 'cmdk-action-print', kind: 'print', label: 'Print a one-page CV', hint: '', keywords: 'cv resume pdf download' },
    {
      id: 'cmdk-action-night-mode',
      kind: 'night-mode',
      label: nightModeIsOn ? 'Turn night mode off' : 'Turn night mode on',
      hint: '',
      keywords: 'night dark theme',
    },
  ];

  const links = linkItems.map(item => ({
    id: `cmdk-link-${slug(item.label)}`,
    kind: 'external',
    label: item.label,
    hint: 'Opens in a new tab',
    keywords: '',
    url: item.url,
  }));

  return { goTo, projects, actions, links };
}

let itemsByGroup = { goTo: [], projects: [], actions: [], links: [] };
let activeId = null;
let previousFocus = null;
let pendingNavigation = null;
let renderedItems = new Map();

function setActive(id) {
  activeId = id;
  const options = listbox.querySelectorAll('[role="option"]');
  let activeOption = null;
  options.forEach(option => {
    const selected = option.id === id;
    option.setAttribute('aria-selected', String(selected));
    if (selected) activeOption = option;
  });
  if (activeOption) {
    input.setAttribute('aria-activedescendant', activeId);
    activeOption.scrollIntoView({ block: 'nearest' });
  } else {
    input.removeAttribute('aria-activedescendant');
  }
}

function matchesQuery(item, words) {
  const searchable = `${item.label} ${item.keywords || ''}`.toLowerCase();
  return words.every(word => searchable.includes(word));
}

function renderResults() {
  const query = input.value.trim();
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const queryPrefix = words[0] || '';
  renderedItems = new Map();
  listbox.replaceChildren();

  const visibleGroups = groupDefinitions.map((group, index) => {
    const allItems = itemsByGroup[group.key] || [];
    const items = allItems.filter(item => matchesQuery(item, words));
    items.sort((a, b) => {
      const aPrefix = queryPrefix && a.label.toLowerCase().startsWith(queryPrefix) ? 0 : 1;
      const bPrefix = queryPrefix && b.label.toLowerCase().startsWith(queryPrefix) ? 0 : 1;
      return aPrefix - bPrefix || allItems.indexOf(a) - allItems.indexOf(b);
    });
    return { group, items, index, hasPrefix: items.some(item => queryPrefix && item.label.toLowerCase().startsWith(queryPrefix)) };
  }).filter(result => result.items.length);

  visibleGroups.sort((a, b) => Number(b.hasPrefix) - Number(a.hasPrefix) || a.index - b.index);

  visibleGroups.forEach(({ group, items }) => {
    const groupElement = document.createElement('div');
    groupElement.className = 'cmdk__group';
    groupElement.setAttribute('role', 'group');
    const heading = document.createElement('h2');
    heading.className = 'cmdk__group-title';
    heading.id = `cmdk-group-${group.key}`;
    heading.textContent = group.title;
    groupElement.setAttribute('aria-labelledby', heading.id);
    groupElement.append(heading);

    items.forEach(item => {
      const option = document.createElement('div');
      option.className = 'cmdk__option';
      option.id = item.id;
      option.dataset.cmdkId = item.id;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');

      const label = document.createElement('span');
      label.className = 'cmdk__label';
      label.textContent = item.label;
      const hint = document.createElement('span');
      hint.className = 'cmdk__hint';
      hint.textContent = item.hint || '';
      hint.hidden = !item.hint;
      option.append(label, hint);
      groupElement.append(option);
      renderedItems.set(item.id, item);
    });

    listbox.append(groupElement);
  });

  emptyState.hidden = visibleGroups.length > 0;
  emptyState.textContent = visibleGroups.length ? '' : (query ? `No matches for “${query}”.` : 'No commands available.');

  const firstOption = listbox.querySelector('[role="option"]');
  setActive(firstOption?.id || null);
}

function openMenu() {
  if (dialog.open) return;
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  pendingNavigation = null;
  itemsByGroup = buildItems();
  input.value = '';
  renderResults();
  dialog.showModal();
  input.focus({ preventScroll: true });
}

function navigate(item) {
  if (!item.target?.isConnected) return;
  const anchor = item.hashTarget?.id ? item.hashTarget : item.target;
  const url = new URL(location.href);
  url.hash = anchor.id || '';
  history.replaceState(history.state, '', url);
  item.target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  if (!item.heading.hasAttribute('tabindex')) item.heading.setAttribute('tabindex', '-1');
  item.heading.focus({ preventScroll: true });
}

async function copyEmail() {
  let copied = false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(EMAIL);
      copied = true;
    }
  } catch { /* Try the older copy path below. */ }

  if (!copied) {
    let field;
    try {
      field = document.createElement('textarea');
      field.value = EMAIL;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.append(field);
      field.select();
      copied = document.execCommand('copy');
    } catch { copied = false; }
    finally { field?.remove(); }
  }

  showToast(copied ? 'Email address copied to the clipboard' : 'Copy failed. Please select the email address and copy it.');
}

function runItem(item) {
  if (!item) return;
  if (item.kind === 'navigate') {
    pendingNavigation = item;
    dialog.close();
    return;
  }

  dialog.close();
  switch (item.kind) {
    case 'external':
      window.open(item.url, '_blank', 'noopener');
      break;
    case 'copy-email':
      void copyEmail();
      break;
    case 'email':
      window.location.href = `mailto:${EMAIL}`;
      break;
    case 'product-work':
      document.querySelector('[data-pm-switch]')?.click();
      break;
    case 'print':
      window.print();
      break;
    case 'night-mode':
      toggleNightMode();
      break;
  }
}

function moveActive(delta) {
  const options = [...listbox.querySelectorAll('[role="option"]')];
  if (!options.length) return;
  const current = options.findIndex(option => option.id === activeId);
  const next = current < 0 ? 0 : (current + delta + options.length) % options.length;
  setActive(options[next].id);
}

input.addEventListener('input', renderResults);
input.addEventListener('keydown', event => {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      moveActive(1);
      break;
    case 'ArrowUp':
      event.preventDefault();
      moveActive(-1);
      break;
    case 'Home': {
      const first = listbox.querySelector('[role="option"]');
      if (first) { event.preventDefault(); setActive(first.id); }
      break;
    }
    case 'End': {
      const options = listbox.querySelectorAll('[role="option"]');
      const last = options[options.length - 1];
      if (last) { event.preventDefault(); setActive(last.id); }
      break;
    }
    case 'Escape':
      // the native cancel can be swallowed by Chrome's close-watcher rules; close it ourselves
      event.preventDefault();
      dialog.close();
      break;
    case 'Enter': {
      const item = renderedItems.get(activeId);
      if (item) { event.preventDefault(); runItem(item); }
      break;
    }
  }
});

dialog.addEventListener('pointerover', event => {
  const option = event.target.closest?.('[role="option"]');
  if (option && listbox.contains(option)) setActive(option.id);
});

dialog.addEventListener('click', event => {
  if (event.target === dialog) {
    dialog.close();
    return;
  }
  const option = event.target.closest?.('[role="option"]');
  if (option && listbox.contains(option)) runItem(renderedItems.get(option.dataset.cmdkId));
});

dialog.addEventListener('close', () => {
  if (pendingNavigation) {
    const item = pendingNavigation;
    pendingNavigation = null;
    navigate(item);
  } else if (previousFocus?.isConnected && typeof previousFocus.focus === 'function') {
    previousFocus.focus({ preventScroll: true });
  }
  previousFocus = null;
});

trigger?.addEventListener('click', openMenu);

window.addEventListener('keydown', event => {
  const commandKey = event.metaKey || event.ctrlKey;
  if (!commandKey || event.altKey || event.shiftKey || event.key.toLowerCase() !== 'k') return;
  event.preventDefault();
  if (dialog.open) dialog.close();
  else openMenu();
});
