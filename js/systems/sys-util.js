// Shared helpers for the [screens-B] systems (shop, puzzles, challenge, GM screen).
// ensureCss() -> Promise         loads css/systems.css once (index.html does not link it)
// speed()                        window.__LF_SPEED (autoplay/fast scales every wait and animation)
// anim(el, frames, ms, opts)     WAAPI animation scaled by speed; returns the Animation (never awaited directly)
// voiceLine(ctx, text, as, mood) -> Promise   plays a voiced line (no narrator panel); resolves at the end, max 9 s
// motes(host, ctx) -> { level(n), burst(x, y, color, n), stop() }   rising glow motes on a stage-sized canvas
// itemEffect(item) -> plain-words effect line; canUseOutside(ctx, item) -> { ok, why }; useOutside(ctx, itemId, heroId)
import { voiceId } from '../core/voiceid.js';
import { L } from '../core/i18n.js';
import * as R from '../core/rules.js';

const statName = (k) => R.STAT_NAMES?.[k] || k[0].toUpperCase() + k.slice(1);

const STR = L({
  en: {
    wornStat: (v, k) => `Worn: +${v} ${statName(k)}`,
    wornGuard: (n) => `Worn: +${n} Guard`,
    wornHearts: (n) => `Worn: +${n} max hearts`,
    wornCrit: (n) => `Worn: ${n}s count as 20s`,
    wornBy: 'Worn by one hero',
    healAll: (n) => `Heals everyone ${n} hearts`,
    heal: (n) => `Heals ${n} hearts`,
    sparks: (n) => `+${n} Sparks in battle`,
    blindAll: 'Blinds every foe in battle',
    star: (n) => `+${n} Star`,
    useOnce: 'Use it once',
    quest: 'A quest treasure',
    battleOnly: 'Only in battle',
    starsFull: 'Stars are full',
  },
  da: {
    wornStat: (v, k) => `Båret: +${v} ${statName(k)}`,
    wornGuard: (n) => `Båret: +${n} Værn`,
    wornHearts: (n) => `Båret: +${n} ${n === 1 ? 'hjerte' : 'hjerter'} mere`,
    wornCrit: (n) => `Båret: ${n} tæller som 20`,
    wornBy: 'Bæres af én helt',
    healAll: (n) => `Giver alle ${n} ${n === 1 ? 'hjerte' : 'hjerter'}`,
    heal: (n) => `Giver ${n} ${n === 1 ? 'hjerte' : 'hjerter'}`,
    sparks: (n) => `+${n} ${n === 1 ? 'Gnist' : 'Gnister'} i kamp`,
    blindAll: 'Blænder alle fjender i kamp',
    star: (n) => `+${n} ${n === 1 ? 'Stjerne' : 'Stjerner'}`,
    useOnce: 'Brug den én gang',
    quest: 'En skat til opgaven',
    battleOnly: 'Kun i kamp',
    starsFull: 'Stjernerne er fulde',
  },
});

let cssPromise = null;
export function ensureCss() {
  if (cssPromise) return cssPromise;
  const href = new URL('../../css/systems.css', import.meta.url).href;
  const existing = [...document.querySelectorAll('link[rel="stylesheet"]')].find((l) => l.href === href);
  if (existing) { cssPromise = Promise.resolve(); return cssPromise; }
  cssPromise = new Promise((res) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = href; link.id = 'css-systems';
    link.onload = () => res(); link.onerror = () => res();
    document.head.appendChild(link);
    setTimeout(res, 1500);
  });
  return cssPromise;
}

export const speed = () => window.__LF_SPEED || 1;

// Which hands are playing: <html data-input="touch|key">. Key hints (Space, arrow keys, 1 to 5) show only
// after a keyboard or mouse; any touch hides them (CSS: :root[data-input="touch"] .lf-keyhint). Starts as
// touch on a touch-first device (a tablet), else keys.
let inputTracked = false;
export function trackInput() {
  if (inputTracked || typeof window === 'undefined') return;
  inputTracked = true;
  const root = document.documentElement;
  const set = (m) => { if (root.dataset.input !== m) root.dataset.input = m; };
  const coarse = !!window.matchMedia?.('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && !window.matchMedia?.('(hover: hover)').matches);
  if (!root.dataset.input) set(coarse ? 'touch' : 'key');
  window.addEventListener('pointerdown', (e) => set(e.pointerType === 'mouse' ? 'key' : 'touch'), true);
  window.addEventListener('touchstart', () => set('touch'), { capture: true, passive: true });
  window.addEventListener('keydown', (e) => { if (!e.isComposing) set('key'); }, true);
}
export const inputIsTouch = () => { trackInput(); return document.documentElement.dataset.input === 'touch'; };

// reduced motion: the OS setting or the game's own switch (html.lf-reduce) cuts every animation to a quick blink
export const reduced = () => document.documentElement.classList.contains('lf-reduce') || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function anim(el, frames, ms, opts = {}) {
  if (!el?.animate) return null;
  const dur = reduced() ? Math.min(ms, 90) : ms;
  try { return el.animate(frames, { duration: Math.max(1, dur / speed()), easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both', ...opts }); }
  catch { return null; }
}

export async function voiceLine(ctx, text, as = 'gm', mood = 'warm') {
  if (!text) return;
  ctx.bus.emit('gm:line', { text, as, mood });
  const minMs = Math.min(6000, 900 + String(text).length * 38);
  const voiceOn = ctx.settings?.voiceOn !== false && !ctx.fast;
  const id = voiceId(as, mood, text);
  const dur = voiceOn ? (ctx.audio.voiceDuration?.(id) || 0) : 0;
  const p = voiceOn ? Promise.resolve(ctx.audio.voice(id)).catch(() => {}) : Promise.resolve();
  await Promise.race([Promise.all([p, ctx.sleep(dur ? 200 : minMs)]), ctx.sleep(9000)]);
}

// ---------- motes ----------
export function motes(host, ctx, { rate = 6 } = {}) {
  const cvs = document.createElement('canvas');
  cvs.className = 'lfs-motes';
  host.appendChild(cvs);
  const W = 1280, H = 800;
  const pr = Math.min(2, ctx.stage?.pixelRatio?.() || 1);
  cvs.width = W * pr; cvs.height = H * pr;
  const g = cvs.getContext('2d');
  g.scale(pr, pr);
  const reduce = ctx.settings?.reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const parts = [];
  let lvl = 0, alive = true, last = performance.now(), acc = 0;
  const colors = ['#ffe7a3', '#a9d4ff', '#ffc6e0', '#bfffe8'];
  const spawn = (x, y, color, vy = -(20 + Math.random() * 40), life = 3 + Math.random() * 3, size = 1 + Math.random() * 2.6) => {
    if (parts.length > 420) return;
    parts.push({ x, y, vx: (Math.random() - 0.5) * 14, vy, life, t: 0, size, color, ph: Math.random() * 6.28 });
  };
  const tick = (now) => {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000) * speed();
    last = now;
    acc += dt * (rate + lvl * 10) * (reduce ? 0.2 : 1);
    while (acc > 1) { acc--; spawn(Math.random() * W, H + 10, colors[(Math.random() * colors.length) | 0]); }
    g.clearRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.t += dt;
      if (p.t > p.life) { parts.splice(i, 1); continue; }
      p.x += (p.vx + Math.sin(p.t * 1.7 + p.ph) * 8) * dt;
      p.y += p.vy * dt;
      const a = Math.sin(Math.PI * (p.t / p.life));
      const r = p.size * 4;
      const grd = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      grd.addColorStop(0, p.color);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = a * 0.9;
      g.fillStyle = grd;
      g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return {
    el: cvs,
    level(n) { lvl = n; },
    burst(x, y, color, n = 24) {
      for (let i = 0; i < n * (reduce ? 0.3 : 1); i++) {
        const a = Math.random() * Math.PI * 2, s = 30 + Math.random() * 90;
        parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: 1.2 + Math.random() * 1.6, t: 0, size: 1.2 + Math.random() * 2.4, color, ph: Math.random() * 6 });
      }
    },
    stop() { alive = false; cvs.remove(); },
  };
}

// ---------- items ----------
export function itemEffect(item) {
  if (!item) return '';
  const u = item.use || {}, p = item.passive || {};
  if (item.kind === 'trinket') {
    if (p.stat) { const [k, v] = Object.entries(p.stat)[0]; return STR.wornStat(v, k); }
    if (p.guard) return STR.wornGuard(p.guard);
    if (p.maxHp) return STR.wornHearts(p.maxHp);
    if (p.critOn) return STR.wornCrit(p.critOn);
    return STR.wornBy;
  }
  if (item.kind === 'consumable') {
    if (u.heal && u.who === 'all') return STR.healAll(u.heal);
    if (u.heal) return STR.heal(u.heal);
    if (u.sparks) return STR.sparks(u.sparks);
    if (u.blindAll) return STR.blindAll;
    if (u.star) return STR.star(u.star);
    return STR.useOnce;
  }
  return STR.quest;
}

export function canUseOutside(ctx, item) {
  const u = item?.use;
  if (!item || item.kind !== 'consumable' || !u) return { ok: false, why: '' };
  if (u.battleOnly) return { ok: false, why: STR.battleOnly };
  if (u.star && ctx.state.stars >= ctx.rules.STARS_MAX) return { ok: false, why: STR.starsFull };
  return { ok: true, why: '' };
}

export function useOutside(ctx, itemId, heroId) {
  const item = ctx.content.items?.[itemId];
  const u = item?.use || {};
  if (!ctx.state.take(itemId, 1)) return false;
  if (u.heal) ctx.state.heal(u.who === 'all' ? 'all' : heroId, u.heal);
  if (u.star) { ctx.state.addStar(u.star, item.name); ctx.audio.sfx('star.gain'); }
  if (u.heal) ctx.audio.sfx('heal');
  return true;
}
