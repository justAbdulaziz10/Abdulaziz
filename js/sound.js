// One line — shared, opt-in Web Audio for the small sounds on the page.
const KEY = 'one-sound';
let enabled = readState();
let context = null;
let output = null;
const listeners = new Set();

function readState() {
  try { return localStorage.getItem(KEY) === 'on'; }
  catch { return false; }
}

function notify() {
  for (const fn of listeners) fn(enabled);
}

export function isOn() { return enabled; }

// Called only from a control or pointer gesture. A stored preference never
// creates an AudioContext during page load.
export function activateAudio() {
  if (!enabled) return null;
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return null;
  try {
    if (!context) context = new Audio();
    if (!output) {
      output = context.createGain();
      output.gain.value = 0.22;
      output.connect(context.destination);
    }
    if (context.state === 'suspended') context.resume().catch(() => {});
    return context;
  } catch { return null; }
}

export function getAudioContext() { return enabled ? context : null; }
export function getAudioOutput() { return enabled ? output : null; }

export function setOn(value) {
  const next = Boolean(value);
  if (next === enabled) {
    if (next) activateAudio();
    return enabled;
  }
  enabled = next;
  try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch { /* Sound still works for this page. */ }
  if (enabled) activateAudio();
  else {
    // Disconnect the old bus so already-scheduled sounds cannot resume if the
    // user turns sound back on before they finish.
    output?.disconnect();
    output = null;
  }
  notify();
  return enabled;
}

export function onChange(fn) {
  listeners.add(fn);
  fn(enabled);
  return () => listeners.delete(fn);
}

addEventListener('storage', event => {
  if (event.key !== KEY) return;
  enabled = event.newValue === 'on';
  if (!enabled) {
    output?.disconnect();
    output = null;
  }
  notify();
});
