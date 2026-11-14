// Play log: what happened during a real play, sent to the Supabase table public.shelf_events
// (schema and rules: lanternfall/supabase/001_shelf_events.sql). The page can only add rows.
//
//   createPlaylog(ctx) -> { log(kind, data), flush(), on }   ctx.playlog
//   one row: { id, device, session, game, lang, kind, happened_at, ms (since page load), game_version, test, data }
//
// What is never sent: hunter or player names, spoken or typed text, anything from the save file but
// level, difficulty, hero types and place. `device` is a random id kept in this browser's storage, so
// two visits from one tablet can be told from two tablets; it says nothing about who is playing.
//
// On only when the page carries window.LF_SYNC = { url, key } (publish.py writes it into the published
// page). Off for robot runs (&auto=1, &fast=1) and with ?nolog=1. Rows from localhost, or with &test=1,
// are marked test = true. Events are batched and sent at most every 3 s; a batch that fails is sent
// again with the next one, and whatever is left when the page closes is sent with keepalive.
// A watchdog logs a 'stall' when the game has done nothing for 30 s (no event, nothing new on screen)
// while somebody tapped at least three times, so a freeze leaves a trace with the last thing before it.

const TABLE = 'shelf_events';
const MAX_QUEUE = 400;
const MAX_ERRORS = 8;
const SKIP_KEY = /name|text|label|title|said|line/i;

function uuid() {
  try { if (crypto?.randomUUID) return crypto.randomUUID(); } catch { /* fall through */ }
  const b = new Uint8Array(16);
  try { crypto.getRandomValues(b); } catch { for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256); }
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function deviceId() {
  try {
    let id = localStorage.getItem('lf.device');
    if (!id || id.length < 8 || id.length > 40) { id = uuid(); localStorage.setItem('lf.device', id); }
    return id;
  } catch { return `tmp-${uuid().slice(0, 13)}`; }
}

// Numbers, booleans and short ids only: no names, no sentences, nothing deep.
export function slim(v, depth = 0) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.length <= 40 && !/\s/.test(v) ? v : undefined;
  if (depth >= 2) return undefined;
  if (Array.isArray(v)) return v.slice(0, 12).map((x) => slim(x, depth + 1)).filter((x) => x !== undefined);
  if (typeof v === 'object') {
    const out = {};
    let n = 0;
    for (const [k, x] of Object.entries(v)) {
      if (SKIP_KEY.test(k) || n >= 24) continue;
      const s = slim(x, depth + 1);
      if (s !== undefined && s !== null) { out[k] = s; n++; }
    }
    return out;
  }
  return undefined;
}

export function createPlaylog(ctx) {
  const P = ctx.params || {};
  const cfg = (typeof window !== 'undefined' && window.LF_SYNC) || null;
  const okCfg = !!(cfg && /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(cfg.url || '') && /^sb_publishable_[A-Za-z0-9_-]+$/.test(cfg.key || ''));
  const q = new URLSearchParams(location.search);
  const off = !okCfg || !!(P.auto || P.fast) || q.get('nolog') === '1' || typeof fetch !== 'function';
  const none = { log() {}, flush() {}, on: false };
  if (off) return none;

  const test = q.get('test') === '1' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const device = deviceId();
  const session = uuid().slice(0, 13);
  let queue = [];
  let sending = false;
  let pending = null;
  let closedAt = -1e9;
  let dead = false;
  let timer = null;
  let taps = 0;
  let tapsSent = 0;
  let lastTap = 0;
  let last = { kind: 'start', what: null };
  let progressAt = performance.now(); // the last time the game did something
  let deadTaps = 0;                   // taps since then
  let stalled = false;
  let errors = 0;

  // A little of where the players are, from whichever state the game uses. Never names.
  const where = () => {
    const s = ctx.state;
    if (!s) return {};
    const out = {};
    if (typeof s.level === 'number') out.level = s.level;
    if (typeof s.difficulty === 'string') out.difficulty = s.difficulty;
    if (Array.isArray(s.party)) out.party = s.party.slice(0, 6).map((h) => h?.arch || null).filter(Boolean);
    if (typeof s.where === 'string') out.at = s.where;
    if (typeof s.playMs === 'number') out.playMin = Math.round(s.playMs / 6000) / 10;
    if (s.floors && typeof s.floors === 'object') {
      out.topFloor = Math.max(1, ...Object.entries(s.floors).filter(([, f]) => f?.unlocked).map(([n]) => Number(n) || 1));
    }
    return slim(out) || {};
  };

  const send = (rows, keepalive) => fetch(`${cfg.url}/rest/v1/${TABLE}`, {
    method: 'POST', keepalive: !!keepalive,
    headers: { 'Content-Type': 'application/json', apikey: cfg.key, Prefer: 'return=minimal' },
    body: JSON.stringify(rows),
  });

  // A batch keeps its exact rows until the server answers, so a second try is the same request and a
  // 409 (these ids are already there) can only mean the first try landed after all.
  function post(rows, keepalive) {
    return send(rows, keepalive).then((r) => {
      if (r.ok || r.status === 409) return 'done';
      if (r.status === 401 || r.status === 403 || r.status === 404) return 'dead';
      return r.status >= 400 && r.status < 500 ? 'drop' : 'retry';
    }).catch(() => 'retry'); // offline
  }

  function flush(closing = false) {
    clearTimeout(timer); timer = null;
    if (dead) return;
    if (closing) {
      // the page is going away: one keepalive request with the newest rows that fit (64 KB cap in Chrome)
      const rows = queue.splice(-60);
      queue = [];
      // the batch on its way (or waiting for a second try) goes again with keepalive, same ids: whichever
      // copy lands second gets a 409 and nothing is doubled
      if (pending) post(pending, true);
      if (rows.length) post(rows, true).then((res) => { if (res === 'retry') queue = rows.concat(queue).slice(-MAX_QUEUE); });
      return;
    }
    if (sending) return;
    if (!pending) pending = queue.splice(0, 80);
    if (!pending.length) { pending = null; return; }
    sending = true;
    post(pending, false).then((res) => {
      sending = false;
      if (res === 'dead') { dead = true; queue = []; pending = null; return; }
      if (res !== 'retry') pending = null;
      if ((pending || queue.length) && !timer) timer = setTimeout(flush, res === 'retry' ? 15000 : 3000);
    });
  }

  // `data` is slimmed (no names, no sentences); `plain` is for the few fields this file fills in itself.
  function log(kind, data = {}, plain = null) {
    if (dead) return;
    const clean = { ...(slim(data) || {}), ...(plain || {}) };
    queue.push({
      id: uuid(), device, session, game: ctx.pack?.id || null, lang: ctx.lang || null,
      kind: String(kind).slice(0, 40), happened_at: new Date().toISOString(), ms: Math.round(performance.now()),
      game_version: ctx.version || null, test, data: clean,
    });
    if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
    if (kind !== 'stall' && kind !== 'tick' && kind !== 'close' && kind !== 'error') last = { kind, what: clean.id || clean.encId || clean.screen || null };
    if (!timer) timer = setTimeout(flush, 3000);
  }

  // ---- what the game tells us ----
  const bus = ctx.bus;
  const on = (ev, fn) => bus?.on?.(ev, (p) => { try { fn(p || {}); } catch { /* the log never breaks the game */ } });
  on('screen:enter', ({ name }) => log('screen', { screen: name }));
  on('scene:entered', ({ id, firstVisit, resumed }) => log('scene', { id, firstVisit, resumed }));
  on('hub:spot', ({ id, spot }) => log('hub_spot', { id, spot }));
  on('combat:start', ({ id, attempt }) => log('combat_start', { id, attempt }));
  on('combat:end', (p) => log('combat_end', { ...p, ...where() }));
  let battle = {}; // the floor and room of the battle going on, so its end row carries them too
  on('gs:battle:start', ({ encId, floor, roomId, kind, huntAgain }) => { battle = { floor, roomId, kind, huntAgain }; log('battle_start', { encId, ...battle, ...where() }); });
  on('gs:battle:end', ({ encId, result, rounds, turns, fled }) => { log('battle_end', { encId, result, rounds, turns, fled, ...battle, ...where() }); battle = {}; });
  on('skill:result', ({ outcome, score, kind, target, heroId }) => log('skill', { outcome, score, kind, target, heroId }));
  on('check:result', ({ outcome, total, dc, stat }) => log('check', { outcome, total, dc, stat }));
  on('star:spent', ({ why }) => log('star_spent', { why }));
  // Lanternfall's ending screen says game:ended, Grimspire's record screen says adventure:done: one row per visit
  let doneLogged = false;
  const done = ({ tally }) => { if (doneLogged) return; doneLogged = true; log('done', { tally, ...where() }); };
  on('game:ended', done);
  on('adventure:done', done);
  // The game did something: any event on the bus, or anything added to or taken off the screen.
  const progress = () => { progressAt = performance.now(); deadTaps = 0; stalled = false; };
  bus?.on?.('*', progress);
  try { new MutationObserver(progress).observe(document.getElementById('app') || document.body, { childList: true, subtree: true, characterData: true }); } catch { /* bus events alone */ }

  // ---- what the page tells us ----
  window.addEventListener('pointerup', () => { taps++; deadTaps++; lastTap = performance.now(); }, true);
  window.addEventListener('error', (e) => {
    if (errors++ >= MAX_ERRORS) return;
    log('error', { row: e.lineno, col: e.colno, after: last.kind }, { msg: String(e.message || '').slice(0, 160), file: String(e.filename || '').split('/').slice(-2).join('/').slice(0, 80) });
  });
  window.addEventListener('unhandledrejection', (e) => {
    if (errors++ >= MAX_ERRORS) return;
    log('error', { promise: true, after: last.kind }, { msg: String(e.reason?.message || e.reason || '').slice(0, 160) });
  });
  setInterval(() => {
    if (document.hidden) return;
    const now = performance.now();
    const idle = now - progressAt;
    if (!stalled && idle > 30000 && deadTaps >= 3 && now - lastTap < 60000) { stalled = true; log('stall', { idleMs: Math.round(idle), deadTaps, after: last.kind, what: last.what }); }
  }, 5000);
  // one row a minute while somebody is playing: how long a visit really lasted, even if the close row is lost
  setInterval(() => {
    if (document.hidden || taps === tapsSent) return;
    log('tick', { taps: taps - tapsSent, ...where() });
    tapsSent = taps;
  }, 60000);
  const closing = () => {
    const now = performance.now();
    if (now - closedAt < 2000) return; // pagehide right after the tab was hidden: one close row is enough
    closedAt = now;
    log('close', { taps: taps - tapsSent, ...where() });
    tapsSent = taps;
    flush(true);
  };
  window.addEventListener('pagehide', closing);
  document.addEventListener('visibilitychange', () => { if (document.hidden) closing(); });

  return { log, flush, on: true };
}
