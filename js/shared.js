/* Brave Life OBS Overlays — shared defaults + state helpers.
   Both overlay.html and control.html load this file. */

window.BL = (function () {
  const DEFAULTS = {
    v: 0,
    schema: 2,
    live:     { show: true },
    logo:     { show: true },
    episode:  { show: true, name: 'BRAVE LIFE PODCAST', ep: 'EP. 01' },
    countdown:{ show: true, label: 'LIVE IN', minutes: 5, running: false, endAt: 0, remainingMs: 5 * 60000, doneText: '' },
    people: [
      { first: 'TROY',  last: 'BRAVENBOER', role: 'LEAD PASTOR • BRAVE LIFE', tag: 'HOST' },
      { first: 'SARAH', last: 'BRAVENBOER', role: 'LEAD PASTOR • BRAVE LIFE', tag: 'HOST' },
      { first: 'GUEST', last: 'NAME',       role: 'GUEST TITLE • CHURCH',     tag: 'GUEST' }
    ],
    // Troy is the main speaker → his name tag is ON by default and stays on (Hide button still works)
    lower:    { show: true, person: 0, shownAt: 0, autoHide: 0 },
    tags:     { left: { show: true, person: 0 }, right: { show: true, person: 2 } },
    topic:    { show: true, label: 'NOW DISCUSSING', text: 'Topic goes here',
                list: ['Topic goes here', 'Common goal, trust, honor', 'Q&A from the chat'] },
    cta:      { show: false, label: 'WATCH MORE', value: 'youtube.com/@bravelife' },
    give:     { url: 'https://bravelifenow.com/give' }
  };

  // deep merge saved state over defaults (so new fields always exist)
  function merge(base, over) {
    if (Array.isArray(base)) return Array.isArray(over) ? over : base;
    if (base && typeof base === 'object') {
      const out = {};
      for (const k of Object.keys(base)) out[k] = merge(base[k], over ? over[k] : undefined);
      if (over && typeof over === 'object') for (const k of Object.keys(over)) if (!(k in out)) out[k] = over[k];
      return out;
    }
    return over === undefined ? base : over;
  }

  /* Two ways to share the live state:
     - 'server': this laptop's tiny local server (http://localhost:7777) → state.json
     - 'local' : the online version (e.g. GitHub Pages). The Control dock and the scenes run inside
                 the same OBS, so they share browser storage: localStorage + BroadcastChannel. No install. */
  const served = location.protocol.startsWith('http');
  const mode = served && /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && location.port === '7777' ? 'server' : 'local';
  const KEY = 'bravelife-obs-state';
  let chan = null;
  try { chan = new BroadcastChannel(KEY); } catch (e) {}
  const listeners = [];
  if (chan) chan.onmessage = e => listeners.forEach(fn => fn(e.data));
  window.addEventListener('storage', e => { if (e.key === KEY && e.newValue) { try { const s = JSON.parse(e.newValue); listeners.forEach(fn => fn(s)); } catch (x) {} } });
  function onChange(fn) { listeners.push(fn); }

  function readLocal() {
    try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : {}; } catch (e) { return {}; }
  }

  // older saved settings (schema 1) had the name tag auto-hiding; switch them to "always show" once
  function upgrade(saved) {
    if (saved && (saved.schema || 1) < 2) {
      saved.lower = Object.assign({}, saved.lower, { show: true, autoHide: 0 });
      saved.schema = 2;
    }
    return saved;
  }

  async function load() {
    if (mode === 'local') return merge(DEFAULTS, upgrade(readLocal()));
    try {
      const r = await fetch('/state?t=' + Date.now(), { cache: 'no-store' });
      return merge(DEFAULTS, upgrade(await r.json()));
    } catch (e) { return null; }
  }

  async function save(state) {
    state.v = Date.now();
    if (mode === 'local') {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
      try { chan && chan.postMessage(state); } catch (e) {}
      return true;
    }
    try {
      await fetch('/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state) });
      return true;
    } catch (e) { return false; }
  }

  // countdown helpers (time is computed from endAt so every overlay stays in sync)
  function remainingMs(c, now = Date.now()) {
    if (c.running) return Math.max(0, c.endAt - now);
    return Math.max(0, c.remainingMs);
  }
  function fmt(ms) {
    const total = Math.ceil(ms / 1000);
    const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
    const mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0');
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }
  function lowerVisible(l, now = Date.now()) {
    if (!l.show) return false;
    if (!l.autoHide) return true;
    return now < l.shownAt + l.autoHide * 1000;
  }
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  return { DEFAULTS, merge, load, save, served, mode, onChange, remainingMs, fmt, lowerVisible, esc };
})();
