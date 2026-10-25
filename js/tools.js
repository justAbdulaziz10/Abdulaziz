const notes = document.querySelector('.notes__groups');
const sleeve = document.querySelector('.sleeve');

if (notes && sleeve) {
  const tools = [...notes.querySelectorAll('.tool[data-tracks]')];
  const buttons = [...notes.querySelectorAll('.tool__name')];
  const tracks = [...sleeve.querySelectorAll('.track[data-track]')];
  const trackLists = [...sleeve.querySelectorAll('.more__list.tracks')];
  const coarsePointer = matchMedia('(pointer: coarse)');
  let hovered = null;
  let focused = null;
  let pinned = null;

  const codesFor = item => item.matches('.track')
    ? [item.dataset.track]
    : item.dataset.tracks.trim().split(/\s+/);

  function paint() {
    const active = focused || hovered || pinned;
    const activeCodes = new Set(active ? codesFor(active.el) : []);
    const toolMode = active?.kind === 'tool';
    const trackMode = active?.kind === 'track';

    for (const track of tracks) {
      track.classList.toggle('is-lit', toolMode && activeCodes.has(track.dataset.track));
    }
    for (const list of trackLists) list.classList.toggle('is-dim', toolMode);

    notes.classList.toggle('is-dim', trackMode);
    for (const tool of tools) {
      const matches = trackMode && codesFor(tool).includes(active.el.dataset.track);
      tool.classList.toggle('is-lit', matches);
    }
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(pinned?.el === button.closest('.tool')));
    }
  }

  function watchPointer(element, kind) {
    element.addEventListener('pointerenter', event => {
      if (event.pointerType === 'touch') return;
      hovered = { kind, el: element };
      paint();
    });
    element.addEventListener('pointerleave', event => {
      if (event.pointerType === 'touch' || hovered?.el !== element) return;
      hovered = null;
      paint();
    });
  }

  for (const tool of tools) watchPointer(tool, 'tool');
  for (const track of tracks) watchPointer(track, 'track');

  notes.addEventListener('focusin', event => {
    const tool = event.target.closest('.tool');
    if (!tool || !notes.contains(tool)) return;
    focused = { kind: 'tool', el: tool };
    paint();
  });
  notes.addEventListener('focusout', event => {
    if (notes.contains(event.relatedTarget)) return;
    if (focused?.kind === 'tool') focused = null;
    paint();
  });
  sleeve.addEventListener('focusin', event => {
    const track = event.target.closest('.track');
    if (!track || !sleeve.contains(track)) return;
    focused = { kind: 'track', el: track };
    paint();
  });
  sleeve.addEventListener('focusout', event => {
    if (sleeve.contains(event.relatedTarget)) return;
    if (focused?.kind === 'track') focused = null;
    paint();
  });

  for (const button of buttons) {
    button.disabled = false;
    button.addEventListener('click', event => {
      const tool = button.closest('.tool');
      pinned = pinned?.el === tool ? null : { kind: 'tool', el: tool };
      if (event.pointerType === 'touch' || coarsePointer.matches) button.blur();
      paint();
    });
  }
}
