// Skill challenges (ROUND2 3): a challenge the player's own hands decide, in the same place as a check.
//
// runSkill(spec, ctx) -> { outcome: 'crit'|'success'|'partial'|'fail', heroId, score, kind, target }
//   spec = { kind, stat, dc, label, talent?, who?, actor?, hasPartial?, heroId?, compact?, feel? }
//   kind: timing | aim | mash | memory | balance | sneak
//   feel: 'calm' (ctx.pack.theme 'lf', the default) or 'bold' ('gs'); spec.feel overrides (the bench uses it).
//
// Flow (like the check moment): dim, the card rises (label, stat), the hero picker, one plain line with a
// small looping demo of the game, "Ready?", the game, a banner, the Star retry offer, Quill's pool line.
// compact: no dim, no picker, no Quill, no Star offer, a smaller card, closes about 1.5 s after the result.
//
// Difficulty: hardness x = (target - bonus - 5) / 13 clamped to 0..1 (easy 8 = .23, medium .46, hard .69,
// heroic .92 with no bonus), mapped per kind in PARAMS. The hero's bonus (stat + 3 for a talent) lowers x,
// and the game shows it: a wider gold zone, a bigger slower target, a shorter row of lights, a calmer
// lantern, a longer warning, and a dashed "without the bonus" outline where it can be drawn.
//
// Autoplay (ctx.auto): no input; the demo plays briefly and a seeded roll decides (ROUND2 3.2).
// All waits go through ctx.sleep; the game loop is requestAnimationFrame, scaled by window.__LF_SPEED.
// Loads its own css/skill.css (index.html needs no change).
import { h, tap, fmt } from '../ui/dom.js';
import * as R from '../core/rules.js';
import { L, getLang } from '../core/i18n.js';
import { speed, reduced, trackInput, inputIsTouch } from './sys-util.js';

const KINDS = ['timing', 'aim', 'mash', 'memory', 'balance', 'sneak'];
const DEFAULT_STAT = { timing: 'agility', aim: 'agility', mash: 'might', memory: 'wits', balance: 'agility', sneak: 'agility' };
const RANK = { fail: 0, partial: 1, success: 2, crit: 3 };

const daPos = (n) => (/[sxz]$/i.test(n) ? `${n}'` : `${n}s`);
const STR = L({
  en: {
    kicker: (s) => `A test of ${s}`,
    choose: 'Who will try?',
    spot: 'Your turn to shine',
    talent: 'Talent',
    mercy: 'The Storykeeper smiles: a little easier this time',
    ready: 'Ready?',
    go: 'GO!',
    keys: { act: 'Space or Enter', two: 'Arrow keys or hold a side', aim: 'Arrow keys aim, Space shoots', mem: 'Keys 1 to 5' },
    how: {
      timing: 'Tap when the light is on the gold',
      aim: 'Tap the middle of the target',
      mash: 'Tap, tap, tap! Fill it to the top',
      memory: 'Watch the lights, then tap them in the same order',
      balance: 'Hold left or right to keep the lantern in the gold',
      sneak: 'Hold to sneak while the eye sleeps. Let go when it twitches!',
    },
    help: {
      timing: 'makes the gold wider',
      aim: 'makes the target bigger and slower',
      mash: 'makes every push stronger',
      memory: 'makes the row of lights shorter',
      balance: 'makes the lantern steadier',
      sneak: 'gives more warning before the eye opens',
    },
    whose: (name, stat, tal) => (stat && tal ? `${name}'s ${stat} and talent` : stat ? `${name}'s ${stat}` : `${name}'s talent`),
    noBonus: 'No bonus here: this one is all you!',
    banner: { crit: 'PERFECT!', success: 'GOT IT', partial: 'SO CLOSE', fail: 'MISSED' },
    sub: { crit: 'Spot on!', success: 'Well done!', partial: 'Almost!', fail: 'Not this time' },
    reroll: 'Spend a Star to try again?',
    spend: 'Spend a Star',
    keep: 'Keep it',
    practice: 'Practice try! Now for real.',
    watch: 'Watch...',
    yourTurn: 'Your turn!',
    again: 'Watch once more...',
    replay: 'Show me again',
    tapBtn: 'TAP!',
    holdBtn: 'HOLD',
    seen: 'Seen!',
    caught: 'Caught!',
    timeUp: 'Time!',
    seenSub: (n) => (n === 0 ? 'Not seen once!' : n === 1 ? 'Seen once' : 'Seen twice'),
    inGold: (p) => `${p}% in the gold`,
    fullIn: (s) => `Full in ${s.toFixed(1)} seconds`,
    full: (p) => `${p}% full`,
    slips: (n) => (n === 0 ? 'Right on the second look' : 'One slip'),
  },
  da: {
    kicker: (s) => `En prøve i ${s}`,
    choose: 'Hvem vil prøve?',
    spot: 'Din tur til at stråle',
    talent: 'Talent',
    mercy: 'Sagnvogteren smiler: lidt lettere denne gang',
    ready: 'Klar?',
    go: 'NU!',
    keys: { act: 'Mellemrum eller Enter', two: 'Piletasterne eller hold en side', aim: 'Piletasterne sigter, mellemrum skyder', mem: 'Tasterne 1 til 5' },
    how: {
      timing: 'Tryk, når lyset er på det gyldne',
      aim: 'Ram midt i skiven',
      mash: 'Tryk, tryk, tryk! Fyld den helt op',
      memory: 'Se lysene, og tryk på dem i samme rækkefølge',
      balance: 'Hold til venstre eller højre, så lygten bliver i det gyldne',
      sneak: 'Hold for at snige, mens øjet sover. Slip, når det sitrer!',
    },
    help: {
      timing: 'gør det gyldne bredere',
      aim: 'gør skiven større og langsommere',
      mash: 'gør hvert skub stærkere',
      memory: 'gør rækken af lys kortere',
      balance: 'gør lygten roligere',
      sneak: 'giver mere varsel, før øjet åbner',
    },
    whose: (name, stat, tal) => (stat && tal ? `${daPos(name)} ${stat} og talent` : stat ? `${daPos(name)} ${stat}` : `${daPos(name)} talent`),
    noBonus: 'Ingen bonus her: det hele er op til dig!',
    banner: { crit: 'PERFEKT!', success: 'DER VAR DEN', partial: 'LIGE VED', fail: 'FORBI' },
    sub: { crit: 'Lige i plet!', success: 'Godt klaret!', partial: 'Næsten!', fail: 'Ikke denne gang' },
    reroll: 'Brug en Stjerne og prøv igen?',
    spend: 'Brug en Stjerne',
    keep: 'Behold det',
    practice: 'Det var en prøve! Nu gælder det.',
    watch: 'Se godt efter...',
    yourTurn: 'Din tur!',
    again: 'Se en gang til...',
    replay: 'Vis mig igen',
    tapBtn: 'TRYK!',
    holdBtn: 'HOLD',
    seen: 'Set!',
    caught: 'Fanget!',
    timeUp: 'Tiden er gået!',
    seenSub: (n) => (n === 0 ? 'Ikke set en eneste gang!' : n === 1 ? 'Set én gang' : 'Set to gange'),
    inGold: (p) => `${p} % i det gyldne`,
    fullIn: (s) => `Fuld på ${s.toFixed(1).replace('.', ',')} sekunder`,
    full: (p) => `${p} % fuld`,
    slips: (n) => (n === 0 ? 'Rigtigt ved andet blik' : 'Én fejl'),
  },
});

// ---------------------------------------------------------------- css
let cssPromise = null;
function ensureCss() {
  if (cssPromise || typeof document === 'undefined') return cssPromise;
  const href = new URL('../../css/skill.css', import.meta.url).href;
  if ([...document.querySelectorAll('link[rel="stylesheet"]')].some((l) => l.href === href)) { cssPromise = Promise.resolve(); return cssPromise; }
  cssPromise = new Promise((res) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = href; link.id = 'css-skill';
    link.onload = () => res(); link.onerror = () => res();
    document.head.appendChild(link);
    setTimeout(res, 1500);
  });
  return cssPromise;
}

// ---------------------------------------------------------------- maths
const TAU = Math.PI * 2, D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function hardness(target, bonus = 0) { return clamp((target - bonus - 5) / 13, 0, 1); }

// Per-kind parameters from hardness x (0 easiest .. 1 hardest). bold = the Grimspire feel.
export const PARAMS = {
  timing(x, bold) {
    const speed = bold ? lerp(92, 150, x) : lerp(62, 100, x);       // degrees of arc per second
    const win = bold ? lerp(125, 22, x) : lerp(150, 26, x);          // ms of slack either side of the zone centre
    const hw = speed * win / 1000;                                    // gold half-width, degrees
    return { speed, hw, heart: Math.max(1.3, hw * 0.3), rim: hw * 0.6 + 1.5, sweeps: 4 };
  },
  aim(x, bold) {   // R = target radius px, speed = drift px/s, fuse = seconds for the one shot
    return { R: bold ? lerp(50, 26, x) : lerp(56, 30, x), speed: bold ? lerp(120, 330, x) : lerp(90, 310, x), fuse: bold ? 3 : 4 };
  },
  mash(x, bold) {   // rate = even taps per second that fill the meter in exactly `time`
    return { rate: bold ? lerp(3.3, 6.0, x) : lerp(2.5, 5.2, x), time: 5, early: bold ? 3.5 : 3.7, d0: bold ? 0.16 : 0.12 };
  },
  memory(x, bold) {   // n = lights in the row (3 to 7), on/gap = ms each light shows / pauses
    return {
      n: clamp(Math.round((bold ? 2.4 : 1.67) + 5.8 * x), 3, 7),
      // calm: each light holds steady for at least 0.8 s up to medium, then a clear dark gap; hard and heroic speed up again
      on: bold ? lerp(470, 300, x) : (x <= 0.5 ? 800 : lerp(800, 430, Math.min(1, (x - 0.5) / 0.35))),
      gap: bold ? lerp(220, 140, x) : (x <= 0.5 ? 380 : lerp(380, 220, Math.min(1, (x - 0.5) / 0.35))),
      replay: !bold && x <= 0.55,   // calm, easy to medium: one free "show me again"
    };
  },
  balance(x, bold) {   // bw = gold band half-width (deg), gust = wind strength, k = how fast a lean grows
    return { bw: bold ? lerp(21, 11, x) : lerp(25, 13, x), gust: bold ? lerp(100, 165, x) : lerp(88, 142, x), k: bold ? lerp(1.8, 3.0, x) : lerp(1.4, 2.5, x), push: 200, time: 6 };
  },
  sneak(x, bold) {   // flutter = seconds of warning before the eye opens, c = closed time, grace = time to let go
    return {
      flutter: bold ? lerp(0.46, 0.17, x) : lerp(0.56, 0.22, x),
      cMin: bold ? lerp(1.5, 0.9, x) : lerp(1.8, 1.0, x), cMax: bold ? lerp(2.2, 1.3, x) : lerp(2.5, 1.5, x),
      oMin: 1.0, oMax: 1.7, v: bold ? 1 / 3.6 : 1 / 4.2, grace: 0.1, time: 12,
    };
  },
};
export function skillParams(kind, x, bold) { return (PARAMS[kind] || PARAMS.timing)(x, bold); }

// ---------------------------------------------------------------- themes
const THEMES = {
  calm: {
    zone: '#f7c95c', zoneHi: '#fff1c4', heart: '#ff8fb8', heartHi: '#ffffff', rim: '#a9d4ff', track: '#241d3b',
    hair: 'rgba(255,231,163,.55)', light: '#fff1c4', glow: '#ffcf6a', bad: '#ff7a8a', good: '#7bd88f', accent: '#a9d4ff',
    bg0: '#2a2147', bg1: '#0c0a16', speck: '#ffe7a3', ink: '#f8ecd2',
    liquid: ['#fff1c4', '#f7c95c', '#c58a2a'], wood: ['#c79a5a', '#7a5228'], target: ['#fbf3de', '#d9c08a'], bull: '#ff7a8a',
    gems: ['#ffd35c', '#8fc2ff', '#7bd88f', '#ff9a4a', '#ff7aa8'],
  },
  bold: {
    zone: '#ff9a3c', zoneHi: '#ffe0b0', heart: '#ff3b2f', heartHi: '#fff4e0', rim: '#c3cde0', track: '#191c24',
    hair: 'rgba(205,215,235,.55)', light: '#ffffff', glow: '#ff8a3a', bad: '#ff4d4d', good: '#8fe08a', accent: '#c3cde0',
    bg0: '#2b2f3a', bg1: '#08090c', speck: '#ff9a4a', ink: '#eef2f8',
    liquid: ['#ffe0a0', '#ff8a2a', '#a8320c'], wood: ['#aab4c6', '#4a5262'], target: ['#d8d2c4', '#7a6a52'], bull: '#e0322a',
    gems: ['#ffcf3f', '#7fb0ff', '#5fd07a', '#ff6a2a', '#ff4d6d'],
  },
};

function pop(el) {
  if (!el?.animate || reduced()) return;
  try { el.animate([{ transform: 'scale(.94)', opacity: 0.4 }, { transform: 'scale(1.03)', opacity: 1 }, { transform: 'none', opacity: 1 }], { duration: 380 / speed(), easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }); } catch { /* ignore */ }
}

// ---------------------------------------------------------------- canvas helpers
function glow(g, x, y, r, hex, a = 1) {
  if (r <= 0) return;
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, rgba(hex, a));
  gr.addColorStop(1, rgba(hex, 0));
  g.fillStyle = gr;
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}
function rrect(g, x, y, w, hh, r) {
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, hh, r);
  else { g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + hh, r); g.arcTo(x + w, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
}
function heartPath(g, x, y, s) {
  g.beginPath();
  g.moveTo(x, y + s * 0.9);
  g.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.7, y - s * 1.1, x, y - s * 0.4);
  g.bezierCurveTo(x + s * 0.7, y - s * 1.1, x + s * 1.4, y - s * 0.1, x, y + s * 0.9);
  g.closePath();
}
function starPath(g, x, y, r1, r2, n = 5, rot = -Math.PI / 2) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) { const r = i % 2 ? r2 : r1, a = rot + (i * Math.PI) / n; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  g.closePath();
}
function symbolPath(g, i, x, y, s) {
  g.beginPath();
  if (i === 0) starPath(g, x, y, s, s * 0.45);
  else if (i === 1) { g.arc(x, y, s, 0.35 * Math.PI, 1.65 * Math.PI, false); g.arc(x + s * 0.45, y - s * 0.12, s * 0.8, 1.6 * Math.PI, 0.42 * Math.PI, true); g.closePath(); }
  else if (i === 2) { g.moveTo(x, y + s); g.bezierCurveTo(x - s * 1.25, y + s * 0.2, x - s * 0.6, y - s * 0.9, x + s * 0.2, y - s); g.bezierCurveTo(x + s * 1.1, y - s * 0.4, x + s * 0.7, y + s * 0.6, x, y + s); g.closePath(); }
  else if (i === 3) { g.moveTo(x, y - s); g.bezierCurveTo(x + s * 0.35, y - s * 0.4, x + s * 0.95, y - s * 0.1, x + s * 0.75, y + s * 0.45); g.bezierCurveTo(x + s * 0.55, y + s, x - s * 0.55, y + s, x - s * 0.75, y + s * 0.45); g.bezierCurveTo(x - s * 0.9, y, x - s * 0.3, y - s * 0.3, x, y - s); g.closePath(); }
  else heartPath(g, x, y + s * 0.05, s * 0.82);
}

// particles: soft motes (calm) or sparks (bold), rings and floating words
function makeFx(feel, reduce) {
  const ps = [];
  const cut = reduce ? 0.3 : 1;
  return {
    burst(x, y, hex, n = 20, { sp = 170, life = 0.8, size = 3, up = 30 } = {}) {
      for (let i = 0; i < n * cut; i++) {
        const a = Math.random() * TAU, s = sp * (0.35 + Math.random() * 0.75);
        ps.push({ k: feel === 'bold' ? 'spark' : 'mote', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - up, t: 0, life: life * (0.6 + Math.random() * 0.6), size: size * (0.6 + Math.random() * 0.8), hex });
      }
    },
    ring(x, y, hex, r0 = 10, r1 = 70, life = 0.5, w = 4) { ps.push({ k: 'ring', x, y, r0, r1, t: 0, life, w, hex }); },
    text(x, y, str, hex, size = 34, life = 1.1) { ps.push({ k: 'text', x, y, str, hex, size, t: 0, life }); },
    mote(x, y, hex, vy = -20, life = 3, size = 2) { ps.push({ k: 'mote', x, y, vx: (Math.random() - 0.5) * 10, vy, t: 0, life, size, hex, soft: true }); },
    get count() { return ps.length; },
    update(dt) {
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.t += dt;
        if (p.t >= p.life) { ps.splice(i, 1); continue; }
        if (p.k === 'mote' || p.k === 'spark') { p.x += p.vx * dt; p.y += p.vy * dt; const drag = p.soft ? 1 : Math.pow(0.12, dt); p.vx *= drag; p.vy = p.vy * drag + (p.k === 'spark' ? 260 : 40) * dt * (p.soft ? 0 : 1); }
        if (p.k === 'text') p.y -= 26 * dt;
      }
    },
    draw(g) {
      g.save();
      for (const p of ps) {
        const q = p.t / p.life;
        if (p.k === 'ring') {
          g.globalCompositeOperation = 'lighter';
          g.strokeStyle = rgba(p.hex, (1 - q) * 0.9); g.lineWidth = p.w * (1 - q * 0.6);
          g.beginPath(); g.arc(p.x, p.y, lerp(p.r0, p.r1, ease(q)), 0, TAU); g.stroke();
        } else if (p.k === 'text') {
          g.globalCompositeOperation = 'source-over';
          const a = q < 0.15 ? q / 0.15 : 1 - Math.max(0, (q - 0.6) / 0.4);
          const sc = q < 0.15 ? lerp(1.5, 1, q / 0.15) : 1;
          g.globalAlpha = clamp(a, 0, 1);
          g.font = `900 ${Math.round(p.size * sc)}px Cinzel, Georgia, serif`;
          g.textAlign = 'center'; g.textBaseline = 'middle';
          g.lineWidth = 6; g.strokeStyle = 'rgba(8,6,14,.85)'; g.strokeText(p.str, p.x, p.y);
          g.fillStyle = p.hex; g.fillText(p.str, p.x, p.y);
          g.globalAlpha = 1;
        } else if (p.k === 'spark') {
          g.globalCompositeOperation = 'lighter';
          g.strokeStyle = rgba(p.hex, 1 - q); g.lineWidth = p.size * 0.7; g.lineCap = 'round';
          g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); g.stroke();
        } else {
          g.globalCompositeOperation = 'lighter';
          const a = p.soft ? Math.sin(Math.PI * q) * 0.7 : 1 - q;
          glow(g, p.x, p.y, p.size * 3.2, p.hex, a);
        }
      }
      g.restore();
    },
  };
}

// The tutorial touch: a glowing ring that dips and ripples when it "taps".
function drawHand(g, x, y, press, hold = false) {
  const k = ease(press);
  g.save();
  g.globalCompositeOperation = 'lighter';
  glow(g, x, y, 46, '#ffffff', 0.18 + 0.25 * k);
  g.strokeStyle = `rgba(255,255,255,${0.75 + 0.2 * k})`; g.lineWidth = 3;
  g.beginPath(); g.arc(x, y, 24 - 6 * k, 0, TAU); g.stroke();
  if (press > 0.05) { g.strokeStyle = `rgba(255,255,255,${0.6 * (1 - k)})`; g.beginPath(); g.arc(x, y, 24 + 26 * (1 - k), 0, TAU); g.stroke(); }
  g.fillStyle = `rgba(255,255,255,${0.85})`; g.beginPath(); g.arc(x, y, hold ? 11 : 7, 0, TAU); g.fill();
  g.restore();
}

// Shared result flourish at the point of the action.
function judgeFx(env, o, x, y) {
  const { fx, th } = env;
  if (o === 'crit') {
    fx.burst(x, y, th.heartHi, 40, { sp: 280, life: 1 }); fx.burst(x, y, th.zone, 30, { sp: 200 });
    fx.ring(x, y, th.heartHi, 8, 110, 0.7, 5); fx.ring(x, y, th.zone, 8, 70, 0.5, 3);
    env.sfx('spell.star', { volume: 0.7 }); env.sfx('rune.right');
  } else if (o === 'success') {
    fx.burst(x, y, th.zone, 30, { sp: 200 }); fx.ring(x, y, th.zoneHi, 8, 80, 0.55, 4);
    env.sfx('rune.right');
  } else if (o === 'partial') {
    fx.burst(x, y, th.rim, 16, { sp: 120 }); fx.ring(x, y, th.rim, 6, 50, 0.45, 3);
    env.sfx('rune.click');
  } else {
    fx.burst(x, y, '#9a93ad', 12, { sp: 90, up: 0 });
    env.sfx('miss', { volume: 0.8 });
  }
  env.shake?.(o === 'crit' ? 7 : o === 'fail' ? 4 : 3);
}

// ================================================================ the six games
// Each game: update(dt), draw(g), down(x, y), up(), move(x, y), key(name, isDown), info(), done, result.
// env: { W, H, P, P0, th, fx, bold, demo, practice, rnd, sfx, chime, say, shake, onDone, S, hero }
// The games never touch the DOM, so tools/ can drive them headless with a kid model.

function core(env) {
  const st = { t: 0, done: false, result: null };
  st.finish = (outcome, score, sub = null) => {
    if (st.done) return;
    st.done = true;
    st.result = { outcome, score: Math.round(clamp(score, 0, 1) * 100) / 100, sub };
    env.onDone?.(st.result);
  };
  return st;
}

// ---- timing: a light swings along an arc past a gold zone with a bright heart
function gTiming(env) {
  const { W, H, P, P0, th, fx } = env;
  const st = core(env);
  const R = Math.min(W * 0.38, H * 0.95), cx = W / 2, cy = H * 0.13 + R;
  const A0 = -150, SPAN = 120, BAND = Math.min(56, H * 0.17);
  const zDeg = A0 + SPAN * (0.24 + env.rnd() * 0.52);
  let a = A0, prevA = A0, dir = 1, sweeps = 0, pause = 0, practice = env.practice ? 1 : 0, stopped = false, stopAt = null, flash = 0, hand = 0;
  const trail = [];
  const pt = (d, r = R) => [cx + r * Math.cos(d * D2R), cy + r * Math.sin(d * D2R)];
  const judge = (d) => (d <= P.heart ? 'crit' : d <= P.hw ? 'success' : d <= P.hw + P.rim ? 'partial' : 'fail');
  const press = () => {
    if (stopped || st.done || pause > 0) return;
    hand = 1;
    const d = Math.abs(a - zDeg), o = judge(d);
    const [x, y] = pt(a);
    if (o === 'fail' && practice > 0) {
      practice--; pause = 0.9;
      env.say(env.S.practice); env.sfx('ui.deny', { volume: 0.6 });
      fx.ring(x, y, th.bad, 8, 46, 0.5, 3);
      return;
    }
    stopped = true; stopAt = a; flash = 1;
    judgeFx(env, o, x, y);
    st.finish(o, 1 - d / (P.hw + P.rim));
  };
  const arcS = (g, d0, d1, r, w, style, cap = 'butt') => { g.beginPath(); g.arc(cx, cy, r, d0 * D2R, d1 * D2R); g.lineWidth = w; g.strokeStyle = style; g.lineCap = cap; g.stroke(); };
  return {
    get done() { return st.done; }, get result() { return st.result; },
    info: () => ({ a, dir, speed: P.speed, zDeg, live: !stopped && pause <= 0 && !st.done }),
    update(dt) {
      st.t += dt; flash = Math.max(0, flash - dt * 1.6); hand = Math.max(0, hand - dt * 3);
      if (stopped || st.done) return;
      if (pause > 0) { pause -= dt; return; }
      prevA = a;
      a += dir * P.speed * dt;
      if (a >= A0 + SPAN) { a = 2 * (A0 + SPAN) - a; dir = -1; sweeps++; env.sfx('ui.tap', { volume: 0.12, rate: 0.7 }); }
      else if (a <= A0) { a = 2 * A0 - a; dir = 1; sweeps++; env.sfx('ui.tap', { volume: 0.12, rate: 0.7 }); }
      trail.push(a); if (trail.length > 16) trail.shift();
      if (env.demo && st.t > 0.4 && (prevA - zDeg) * (a - zDeg) <= 0) press();
      if (!stopped && sweeps >= P.sweeps) { stopped = true; env.sfx('miss'); env.say(env.S.timeUp, th.bad); st.finish('fail', 0, 'timeout'); }
    },
    down: press, up() {}, move() {},
    key(k, d) { if (d && k === 'act') press(); },
    draw(g) {
      const pulse = 0.5 + 0.5 * Math.sin(st.t * 4);
      g.save();
      arcS(g, A0 - 1, A0 + SPAN + 1, R, BAND + 14, 'rgba(4,3,9,.7)', 'round');
      arcS(g, A0, A0 + SPAN, R, BAND, th.track, 'round');
      arcS(g, A0, A0 + SPAN, R - BAND * 0.22, BAND * 0.35, 'rgba(255,255,255,.035)');
      g.setLineDash([]);
      arcS(g, A0, A0 + SPAN, R + BAND / 2, 1.5, th.hair);
      arcS(g, A0, A0 + SPAN, R - BAND / 2, 1.5, th.hair);
      g.strokeStyle = th.hair; g.lineWidth = 1.5;
      for (let d = A0 + 5; d < A0 + SPAN; d += 10) { const [x1, y1] = pt(d, R + BAND / 2 + 3), [x2, y2] = pt(d, R + BAND / 2 + 10); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
      // close rim, gold zone, ghost of the zone without the bonus
      arcS(g, zDeg - P.hw - P.rim, zDeg + P.hw + P.rim, R, BAND - 10, rgba(th.rim, 0.34));
      g.save();
      g.shadowColor = th.zone; g.shadowBlur = 14 + 12 * pulse + flash * 30;
      arcS(g, zDeg - P.hw, zDeg + P.hw, R, BAND - 6, rgba(th.zone, 0.85 + 0.15 * flash));
      g.restore();
      arcS(g, zDeg - P.hw, zDeg + P.hw, R + BAND * 0.12, BAND * 0.22, rgba(th.zoneHi, 0.55));
      if (P0 && P0.hw < P.hw - 0.4) {
        g.save(); g.setLineDash([5, 5]); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2;
        for (const d of [zDeg - P0.hw, zDeg + P0.hw]) { const [x1, y1] = pt(d, R - BAND / 2 + 3), [x2, y2] = pt(d, R + BAND / 2 - 3); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
        g.restore();
      }
      const [hx, hy] = pt(zDeg);
      const hs = Math.max(8, Math.min(16, P.heart * D2R * R * 0.9));
      glow(g, hx, hy, hs * 3.2, th.heart, 0.55 + 0.25 * pulse);
      heartPath(g, hx, hy, hs); g.fillStyle = th.heartHi; g.fill();
      heartPath(g, hx, hy, hs * 0.62); g.fillStyle = th.heart; g.fill();
      // the light
      g.globalCompositeOperation = 'lighter';
      trail.forEach((d, i) => { const [x, y] = pt(d); glow(g, x, y, 10 + i * 1.3, th.glow, (i / trail.length) * 0.28); });
      const [lx, ly] = pt(stopped ? stopAt : a);
      glow(g, lx, ly, 52 + flash * 30, th.glow, 0.55);
      glow(g, lx, ly, 22, th.light, 0.95);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#fff'; g.beginPath(); g.arc(lx, ly, 8, 0, TAU); g.fill();
      if (stopped) { g.strokeStyle = rgba(th.zoneHi, 0.6 + 0.4 * flash); g.lineWidth = 3; const [x1, y1] = pt(stopAt, R - BAND / 2 - 8), [x2, y2] = pt(stopAt, R + BAND / 2 + 8); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
      g.restore();
      if (env.demo) drawHand(g, cx, H * 0.86, hand);
    },
  };
}

// ---- aim: a target drifts and bobs; tap where it is. One shot, a burning fuse.
function gAim(env) {
  const { W, H, P, P0, th, fx } = env;
  const st = core(env);
  const Ax = W * 0.3, Ay = H * 0.19, c0x = W / 2, c0y = H * 0.5;
  const w1 = (P.speed / Ax) * 0.62, w2 = w1 * 1.63, p1 = env.rnd() * TAU, p2 = env.rnd() * TAU;
  let tt = 0, fuse = P.fuse, frozen = false, shot = null, stuck = null, practice = env.practice ? 1 : 0, gone = 0;
  const ch = { x: W / 2, y: H * 0.5, on: false };
  const keys = { left: false, right: false, up: false, down: false };
  const tpos = (m) => [c0x + Ax * Math.sin(w1 * m + p1), c0y + Ay * Math.sin(w2 * m + p2)];
  let bot = env.demo ? { x: W * 0.5, y: H * 0.85, press: 0 } : null;
  const shoot = (x, y) => {
    if (st.done || shot || fuse <= 0) return;
    const [tx, ty] = tpos(tt);
    const d = Math.hypot(x - tx, y - ty) / P.R;
    const o = d <= 0.24 ? 'crit' : d <= 0.58 ? 'success' : d <= 1 ? 'partial' : 'fail';
    frozen = true;
    shot = { x0: W / 2, y0: H + 12, x, y, t: 0, o, d, dx: x - tx, dy: y - ty };
    env.sfx(env.bold ? 'bow' : 'spell.cast', { volume: 0.6 });
  };
  const land = () => {
    const s = shot;
    if (s.o === 'fail' && practice > 0) {
      practice--; shot = null; frozen = false; fuse = P.fuse;
      fx.burst(s.x, s.y, '#9a93ad', 10, { sp: 80 });
      env.say(env.S.practice); env.sfx('ui.deny', { volume: 0.6 });
      return;
    }
    if (s.o !== 'fail') stuck = { dx: s.dx, dy: s.dy };
    else frozen = false;
    judgeFx(env, s.o, s.x, s.y);
    st.finish(s.o, 1 - s.d / 1.6);
  };
  return {
    get done() { return st.done; }, get result() { return st.result; },
    info: () => { const [x, y] = tpos(tt); const [x2, y2] = tpos(tt + 0.01); return { x, y, vx: (x2 - x) * 100, vy: (y2 - y) * 100, R: P.R, live: !shot && !st.done }; },
    update(dt) {
      st.t += dt;
      if (!frozen) tt += dt;
      if (keys.left || keys.right || keys.up || keys.down) {
        ch.on = true;
        ch.x = clamp(ch.x + ((keys.right ? 1 : 0) - (keys.left ? 1 : 0)) * 430 * dt, 20, W - 20);
        ch.y = clamp(ch.y + ((keys.down ? 1 : 0) - (keys.up ? 1 : 0)) * 430 * dt, 30, H - 20);
      }
      if (shot) { shot.t += dt; if (shot.t >= 0.14 && !shot.hit) { shot.hit = true; land(); } }
      else if (!st.done) {
        fuse -= dt;
        if (Math.random() < dt * 30) { const fx0 = lerp(W - 30, 30, 1 - fuse / P.fuse); fx.burst(fx0, 18, th.glow, 1, { sp: 60, life: 0.4, size: 2 }); }
        if (fuse <= 0) { env.sfx('miss'); env.say(env.S.timeUp, th.bad); st.finish('fail', 0, 'timeout'); }
      }
      if (st.done && !stuck) gone += dt;
      if (bot && !shot && !st.done) {
        const [tx, ty] = tpos(tt + 0.12);
        const k = Math.min(1, dt * 4.5);
        bot.x += (tx - bot.x) * k; bot.y += (ty - bot.y) * k;
        if (st.t > 1.5) { bot.press = 1; shoot(tpos(tt)[0], tpos(tt)[1]); }
      }
      if (bot) bot.press = Math.max(0, bot.press - dt * 3);
    },
    down(x, y) { ch.x = x; ch.y = y; ch.on = true; shoot(x, y); },
    move(x, y) { ch.x = x; ch.y = y; ch.on = true; },
    up() {},
    key(k, d) { if (k in keys) keys[k] = d; if (d && k === 'act') shoot(ch.x, ch.y); },
    draw(g) {
      // fuse
      const left = clamp(fuse / P.fuse, 0, 1), fxEnd = lerp(30, W - 30, left);
      g.save();
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 7; g.beginPath(); g.moveTo(30, 18); g.lineTo(W - 30, 18); g.stroke();
      g.strokeStyle = env.bold ? '#8a7a62' : '#c9a66a'; g.lineWidth = 5; g.beginPath(); g.moveTo(30, 18); g.lineTo(fxEnd, 18); g.stroke();
      g.setLineDash([3, 5]); g.strokeStyle = 'rgba(60,40,20,.7)'; g.lineWidth = 5; g.beginPath(); g.moveTo(30, 18); g.lineTo(fxEnd, 18); g.stroke(); g.setLineDash([]);
      if (!st.done && !shot) { g.globalCompositeOperation = 'lighter'; glow(g, fxEnd, 18, 22, th.glow, 0.9); glow(g, fxEnd, 18, 7, '#ffffff', 1); g.globalCompositeOperation = 'source-over'; }
      g.restore();
      // target
      let [tx, ty] = tpos(tt);
      if (gone) { ty -= gone * gone * 260; }
      const Rr = P.R;
      g.save();
      g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(tx, H * 0.95, Rr * 0.9, Rr * 0.18, 0, 0, TAU); g.fill();
      glow(g, tx, ty, Rr * 1.9, th.glow, 0.22);
      const og = g.createRadialGradient(tx - Rr * 0.3, ty - Rr * 0.35, Rr * 0.1, tx, ty, Rr);
      og.addColorStop(0, th.target[0]); og.addColorStop(1, th.target[1]);
      g.fillStyle = og; g.beginPath(); g.arc(tx, ty, Rr, 0, TAU); g.fill();
      g.strokeStyle = env.bold ? '#3a3028' : '#7a5a2a'; g.lineWidth = 3; g.stroke();
      g.strokeStyle = env.bold ? 'rgba(58,48,40,.5)' : 'rgba(122,90,42,.45)'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(tx, ty, Rr * 0.79, 0, TAU); g.stroke();
      const ig = g.createRadialGradient(tx, ty, 0, tx, ty, Rr * 0.58);
      ig.addColorStop(0, th.zoneHi); ig.addColorStop(1, th.zone);
      g.fillStyle = ig; g.beginPath(); g.arc(tx, ty, Rr * 0.58, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(90,60,20,.6)'; g.lineWidth = 2; g.stroke();
      g.fillStyle = th.bull; g.beginPath(); g.arc(tx, ty, Rr * 0.24, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(tx - Rr * 0.07, ty - Rr * 0.07, Rr * 0.07, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2.5; g.beginPath(); g.arc(tx, ty, Rr * 0.92, 1.1 * Math.PI, 1.45 * Math.PI); g.stroke();
      if (P0 && P0.R < P.R - 3) { g.setLineDash([6, 6]); g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2; g.beginPath(); g.arc(tx, ty, P0.R, 0, TAU); g.stroke(); g.setLineDash([]); }
      if (stuck) {
        const sx = tx + stuck.dx, sy = ty + stuck.dy;
        if (env.bold) {
          g.strokeStyle = '#3a2a1a'; g.lineWidth = 4; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + 26, sy + 30); g.stroke();
          g.fillStyle = '#e8e2d4'; g.beginPath(); g.moveTo(sx + 22, sy + 26); g.lineTo(sx + 36, sy + 30); g.lineTo(sx + 26, sy + 40); g.closePath(); g.fill();
        } else {
          g.globalCompositeOperation = 'lighter'; glow(g, sx, sy, 22, th.light, 0.9); g.globalCompositeOperation = 'source-over';
          starPath(g, sx, sy, 10, 4.5); g.fillStyle = '#fff'; g.fill();
        }
      }
      g.restore();
      // the shot in flight
      if (shot && !shot.hit) {
        const q = shot.t / 0.14, x = lerp(shot.x0, shot.x, q), y = lerp(shot.y0, shot.y, q);
        g.save(); g.globalCompositeOperation = 'lighter';
        g.strokeStyle = rgba(th.light, 0.8); g.lineWidth = 4; g.lineCap = 'round';
        g.beginPath(); g.moveTo(lerp(shot.x0, shot.x, Math.max(0, q - 0.35)), lerp(shot.y0, shot.y, Math.max(0, q - 0.35))); g.lineTo(x, y); g.stroke();
        glow(g, x, y, 16, th.glow, 1);
        g.restore();
      }
      // crosshair
      const c = bot || (ch.on ? ch : null);
      if (c && !st.done) {
        g.save(); g.strokeStyle = 'rgba(255,255,255,.92)'; g.lineWidth = 2.5;
        g.beginPath(); g.arc(c.x, c.y, 20, 0, TAU); g.stroke();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { g.beginPath(); g.moveTo(c.x + dx * 12, c.y + dy * 12); g.lineTo(c.x + dx * 28, c.y + dy * 28); g.stroke(); }
        g.fillStyle = th.bull; g.beginPath(); g.arc(c.x, c.y, 3, 0, TAU); g.fill();
        g.restore();
      }
      if (bot) drawHand(g, bot.x + 26, bot.y + 30, bot.press);
    },
  };
}

// ---- mash: tap fast to push a meter to the top against a force pushing back, five seconds
function solveTapStrength(rate, time, drain) {
  let lo = 0.002, hi = 0.6;
  for (let it = 0; it < 28; it++) {
    const a = (lo + hi) / 2, dt = 1 / 120;
    let f = 0, next = 0, ok = false;
    for (let t = 0; t < time; t += dt) {
      if (t >= next) { f += a; next += 1 / rate; }
      if (f >= 1) { ok = true; break; }
      f = Math.max(0, f - drain(f) * dt);
    }
    if (ok) hi = a; else lo = a;
  }
  return hi;
}
function gMash(env) {
  const { W, H, P, P0, th, fx } = env;
  const st = core(env);
  const tw = Math.min(96, W * 0.12), tx = W * 0.34 - tw / 2, top = H * 0.17, bot = H * 0.92, tH = bot - top;
  const padX = W * 0.69, padY = H * 0.53, padR = Math.min(92, H * 0.3);
  const drain = (f) => P.d0 * (0.5 + f);
  const a = solveTapStrength(P.rate, P.time, drain);
  const a0 = P0 ? solveTapStrength(P0.rate, P0.time, drain) : a;
  let f = 0, fd = 0, taps = 0, padK = 0, full = false, botNext = 0.5;
  const bubbles = [];
  const press = () => {
    if (st.done) return;
    f = Math.min(1, f + a); taps++; padK = 1;
    const sy = bot - f * tH;
    fx.burst(tx + tw / 2, sy, th.zoneHi, 5 + Math.round(6 * a / a0), { sp: 90 + 160 * (a / a0 - 1 + 0.5), life: 0.5 });
    fx.ring(padX, padY, th.zoneHi, padR * 0.9, padR * 1.35, 0.35, 3);
    env.sfx(env.bold ? 'hit.light' : 'ui.tap', { volume: env.bold ? 0.35 : 0.5, rate: 0.85 + f * 0.7 });
    if (f >= 1) {
      full = true;
      const o = st.t <= P.early ? 'crit' : 'success';
      judgeFx(env, o, tx + tw / 2, top);
      env.sfx('chime.right', { volume: 0.7 });
      st.finish(o, 1.2 - (st.t / P.time) * 0.4, { time: st.t });
    }
  };
  return {
    get done() { return st.done; }, get result() { return st.result; },
    info: () => ({ f, t: st.t, live: !st.done }),
    update(dt) {
      st.t += dt; padK = Math.max(0, padK - dt * 6);
      fd += (f - fd) * Math.min(1, dt * 16);
      if (Math.random() < dt * (4 + 20 * fd)) bubbles.push({ x: tx + 10 + Math.random() * (tw - 20), y: bot - 6, r: 1.5 + Math.random() * 3, v: 30 + Math.random() * 50 });
      for (let i = bubbles.length - 1; i >= 0; i--) { const b = bubbles[i]; b.y -= b.v * dt; if (b.y < bot - fd * tH + 4) bubbles.splice(i, 1); }
      if (st.done) return;
      f = Math.max(0, f - drain(f) * dt);
      if (env.demo && st.t >= botNext) { press(); botNext = st.t + 1 / 6.5 + (Math.random() - 0.5) * 0.04; }
      if (st.t >= P.time && !st.done) {
        const o = f >= 0.75 ? 'partial' : 'fail';
        env.say(env.S.timeUp, o === 'fail' ? th.bad : th.rim);
        judgeFx(env, o, tx + tw / 2, bot - f * tH);
        st.finish(o, f * 0.8, { fill: f });
      }
    },
    down: press, up() {}, move() {},
    key(k, d) { if (d && k === 'act') press(); },
    draw(g) {
      g.save();
      // tube glass
      rrect(g, tx - 10, top - 10, tw + 20, tH + 20, 26); g.fillStyle = 'rgba(4,3,9,.65)'; g.fill();
      rrect(g, tx, top, tw, tH, 18);
      const gb = g.createLinearGradient(tx, 0, tx + tw, 0);
      gb.addColorStop(0, 'rgba(255,255,255,.05)'); gb.addColorStop(0.5, 'rgba(255,255,255,.02)'); gb.addColorStop(1, 'rgba(255,255,255,.08)');
      g.fillStyle = th.track; g.fill(); g.fillStyle = gb; g.fill();
      // liquid
      g.save(); rrect(g, tx, top, tw, tH, 18); g.clip();
      const sy = bot - fd * tH;
      const lg = g.createLinearGradient(0, sy, 0, bot);
      lg.addColorStop(0, th.liquid[0]); lg.addColorStop(0.25, th.liquid[1]); lg.addColorStop(1, th.liquid[2]);
      g.fillStyle = lg;
      g.beginPath(); g.moveTo(tx, bot + 2);
      for (let x = 0; x <= tw; x += 6) g.lineTo(tx + x, sy + Math.sin(x * 0.12 + st.t * 7) * (2 + 4 * padK));
      g.lineTo(tx + tw, bot + 2); g.closePath(); g.fill();
      g.globalCompositeOperation = 'lighter';
      for (const b of bubbles) glow(g, b.x, b.y, b.r * 2.2, '#ffffff', 0.35);
      glow(g, tx + tw / 2, sy, tw * 0.9, th.glow, 0.35 + 0.3 * padK);
      g.restore();
      rrect(g, tx, top, tw, tH, 18); g.strokeStyle = th.hair; g.lineWidth = 2; g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(tx + 14, top + 20); g.lineTo(tx + 14, bot - 20); g.stroke();
      // three-quarter mark
      const qy = bot - 0.75 * tH;
      g.strokeStyle = rgba(th.rim, 0.85); g.lineWidth = 2;
      g.beginPath(); g.moveTo(tx - 16, qy); g.lineTo(tx - 4, qy); g.moveTo(tx + tw + 4, qy); g.lineTo(tx + tw + 16, qy); g.stroke();
      // the lantern on top lights as it fills
      const lx = tx + tw / 2, ly = top - 6, lit = full ? 1 : Math.pow(fd, 3);
      g.globalCompositeOperation = 'lighter'; glow(g, lx, ly - 22, 70 * (0.4 + lit), th.glow, 0.15 + 0.75 * lit); g.globalCompositeOperation = 'source-over';
      g.fillStyle = env.bold ? '#3a3f4a' : '#5e3f10';
      rrect(g, lx - 18, ly - 46, 36, 8, 3); g.fill(); rrect(g, lx - 14, ly - 6, 28, 8, 3); g.fill();
      rrect(g, lx - 14, ly - 40, 28, 36, 8);
      const lgg = g.createRadialGradient(lx, ly - 22, 2, lx, ly - 22, 22);
      lgg.addColorStop(0, lit > 0.05 ? '#fffbe8' : '#4a3d6e'); lgg.addColorStop(1, lit > 0.05 ? th.zone : '#231c38');
      g.globalAlpha = 0.45 + 0.55 * lit; g.fillStyle = lgg; g.fill(); g.globalAlpha = 1;
      g.strokeStyle = th.hair; g.lineWidth = 1.5; g.stroke();
      // push-back chevrons
      const cxv = tx + tw + 38;
      for (let i = 0; i < 3; i++) {
        const y = top + 30 + ((st.t * 60 + i * 50) % (tH - 40));
        g.strokeStyle = rgba(th.bad, 0.18 + 0.35 * fd); g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(cxv - 10, y - 6); g.lineTo(cxv, y + 4); g.lineTo(cxv + 10, y - 6); g.stroke();
      }
      // the big pad with its timer ring
      const k = 1 - padK * 0.08, left = st.done ? 0 : clamp(1 - st.t / P.time, 0, 1);
      g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 10; g.beginPath(); g.arc(padX, padY, padR + 16, 0, TAU); g.stroke();
      g.strokeStyle = left < 0.3 ? th.bad : th.zoneHi; g.lineWidth = 7; g.lineCap = 'round';
      g.beginPath(); g.arc(padX, padY, padR + 16, -Math.PI / 2, -Math.PI / 2 + TAU * left); g.stroke();
      g.globalCompositeOperation = 'lighter'; glow(g, padX, padY, padR * 1.6, th.glow, 0.2 + 0.4 * padK); g.globalCompositeOperation = 'source-over';
      const pg = g.createRadialGradient(padX - padR * 0.3, padY - padR * 0.4, padR * 0.1, padX, padY, padR * k);
      pg.addColorStop(0, th.zoneHi); pg.addColorStop(0.6, th.zone); pg.addColorStop(1, env.bold ? '#7a2a0c' : '#9a6a1c');
      g.fillStyle = pg; g.beginPath(); g.arc(padX, padY, padR * k, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2; g.stroke();
      g.font = `900 ${Math.round(padR * 0.42)}px Cinzel, Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = env.bold ? '#2a0e04' : '#3a2408'; g.fillText(env.S.tapBtn, padX, padY + 2);
      g.restore();
      if (env.demo) drawHand(g, padX + 18, padY + 22, padK);
    },
  };
}

// ---- memory: symbols glow in order; tap them back
function gMemory(env) {
  const { W, H, P, P0, th, fx } = env;
  const st = core(env);
  const size = Math.min(108, W / 6.8, H * 0.34), gap = W / 5.5, gy = H * 0.64;
  const gx = (i) => W / 2 + (i - 2) * gap;
  const n = env.demo ? 3 : P.n;
  const seq = [];
  for (let k = 0; k < n; k++) { let i; do { i = Math.floor(env.rnd() * 5); } while (k && i === seq[k - 1]); seq.push(i); }
  const lit = [0, 0, 0, 0, 0], shake = [0, 0, 0, 0, 0], press = [0, 0, 0, 0, 0], hold = [0, 0, 0, 0, 0];
  const pips = seq.map(() => 0); // 0 empty, 1 ok, -1 slip
  // calm: a light holds full for `on`, then snaps dark so two lights never blur into one; bold keeps its quick fade
  const crisp = !env.bold;
  let phase = 'pre', pt = 0, k = -1, attempt = 1, pos = 0, slips = 0, idle = 0, on = P.on / 1000, gp = P.gap / 1000, status = env.S.watch, focus = -1;
  let replays = P.replay && !env.demo ? 1 : 0;
  let bot = env.demo ? { x: W / 2, y: H * 1.05, press: 0, next: 0, i: 0 } : null;
  if (env.demo) { on *= 0.75; gp *= 0.75; }
  const light = (i, amt = 1, hs = 0.12) => { lit[i] = amt; hold[i] = crisp ? hs : 0; env.chime(i); };
  const complete = () => {
    const o = attempt === 1 ? 'crit' : slips === 0 ? 'success' : 'partial';
    status = '';
    for (let i = 0; i < 5; i++) { lit[i] = 0.7; hold[i] = crisp ? 0.5 : 0; }
    judgeFx(env, o, W / 2, H * 0.16);
    env.sfx('chime.right', { volume: 0.7 });
    st.finish(o, o === 'crit' ? 1 : o === 'success' ? 0.75 : 0.45, o === 'crit' ? null : slips);
  };
  const wrong = (i) => {
    env.sfx('chime.wrong'); env.shake?.(3);
    if (i >= 0) shake[i] = 1;
    if (attempt === 1) {
      attempt = 2; pos = 0; pips.fill(0); phase = 'wait'; pt = 1.1; status = env.S.again; on *= 1.15; gp *= 1.1;
      return;
    }
    slips++; pips[pos] = -1; lit[seq[pos]] = 0.75; hold[seq[pos]] = crisp ? 0.45 : 0; pos++;
    if (slips >= 2) { status = ''; judgeFx(env, 'fail', W / 2, H * 0.16); st.finish('fail', 0.1, 2); return; }
    if (pos >= n) complete();
  };
  const tapGem = (i) => {
    if (phase !== 'input' || st.done) return;
    idle = 0; press[i] = 1; light(i, 1);
    if (seq[pos] === i) {
      pips[pos] = 1; pos++;
      fx.burst(gx(i), gy, th.gems[i], 12, { sp: 120, life: 0.6 });
      if (pos >= n) complete();
    } else wrong(i);
  };
  return {
    get done() { return st.done; }, get result() { return st.result; },
    info: () => ({ seq, pos, attempt, phase, n, replays }),
    // one free replay of the pattern (calm, easy to medium); the player starts the row again
    get canReplay() { return replays > 0 && phase === 'input' && !st.done; },
    replay() {
      if (!(replays > 0 && phase === 'input' && !st.done)) return false;
      replays = 0; pos = 0; pips.fill(0); idle = 0; phase = 'wait'; pt = 0.45; status = env.S.again;
      return true;
    },
    update(dt) {
      st.t += dt;
      for (let i = 0; i < 5; i++) {
        if (hold[i] > 0) hold[i] -= dt;
        else lit[i] = Math.max(0, lit[i] - dt / (crisp ? 0.09 : on * 1.1));
        shake[i] = Math.max(0, shake[i] - dt * 2); press[i] = Math.max(0, press[i] - dt * 5); }
      if (st.done) return;
      pt -= dt;
      if (phase === 'pre' || phase === 'wait') { if (pt <= 0) { phase = 'show'; k = 0; pt = on + gp; light(seq[0], 1, on); status = attempt === 1 ? env.S.watch : env.S.again; } }
      else if (phase === 'show') {
        if (pt <= 0) { k++; if (k >= n) { phase = 'input'; status = env.S.yourTurn; idle = 0; k = -1; env.sfx('ui.page', { volume: 0.4 }); } else { pt = on + gp; light(seq[k], 1, on); } }
      } else if (phase === 'input') {
        idle += dt;
        if (!env.demo && idle > 6) { idle = 0; wrong(-1); }
      }
      if (bot) {
        bot.press = Math.max(0, bot.press - dt * 4);
        if (phase === 'input') {
          const tx = gx(seq[pos] ?? 0), ty = gy + 26;
          bot.x += (tx - bot.x) * Math.min(1, dt * 7); bot.y += (ty - bot.y) * Math.min(1, dt * 7);
          bot.next += dt;
          if (bot.next > 0.55 && Math.hypot(tx - bot.x, ty - bot.y) < 8) { bot.next = 0; bot.press = 1; tapGem(seq[pos]); }
        }
      }
    },
    down(x, y) {
      let best = -1, bd = size * 0.7;
      for (let i = 0; i < 5; i++) { const d = Math.hypot(x - gx(i), y - gy); if (d < bd) { bd = d; best = i; } }
      if (best >= 0) tapGem(best);
    },
    up() {}, move() {},
    key(kk, d) {
      if (!d) return;
      if (/^[1-5]$/.test(kk)) tapGem(Number(kk) - 1);
      else if (kk === 'left' || kk === 'right') focus = focus < 0 ? 2 : clamp(focus + (kk === 'left' ? -1 : 1), 0, 4);
      else if (kk === 'act' && focus >= 0) tapGem(focus);
    },
    draw(g) {
      g.save();
      // status line and the row of pips
      if (status) {
        g.font = `700 ${Math.round(Math.min(30, H * 0.09))}px Cinzel, Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = phase === 'input' ? th.zoneHi : th.ink; g.globalAlpha = 0.95;
        g.fillText(status, W / 2, H * 0.3); g.globalAlpha = 1;
      }
      const ghosts = P0 && !env.demo ? Math.max(0, P0.n - n) : 0, total = n + ghosts, pr = 11, ps = 34;
      for (let j = 0; j < total; j++) {
        const x = W / 2 + (j - (total - 1) / 2) * ps, y = H * 0.13;
        if (j >= n) {
          g.strokeStyle = 'rgba(255,255,255,.45)'; g.setLineDash([3, 3]); g.lineWidth = 2; g.beginPath(); g.arc(x, y, pr, 0, TAU); g.stroke(); g.setLineDash([]);
          g.strokeStyle = th.zoneHi; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x - pr, y + pr); g.lineTo(x + pr, y - pr); g.stroke();
          continue;
        }
        const showing = phase === 'show' && j === k;
        const c = pips[j] === 1 ? th.gems[seq[j]] : pips[j] === -1 ? th.bad : null;
        g.fillStyle = 'rgba(4,3,9,.6)'; g.beginPath(); g.arc(x, y, pr + 3, 0, TAU); g.fill();
        if (showing || c) { g.globalCompositeOperation = 'lighter'; glow(g, x, y, pr * 2.6, c || th.gems[seq[j]], 0.7); g.globalCompositeOperation = 'source-over'; }
        g.fillStyle = c || (showing ? th.gems[seq[j]] : th.track); g.beginPath(); g.arc(x, y, pr, 0, TAU); g.fill();
        g.strokeStyle = th.hair; g.lineWidth = 1.5; g.stroke();
        if (pips[j] === -1) { g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x - 5, y - 5); g.lineTo(x + 5, y + 5); g.moveTo(x + 5, y - 5); g.lineTo(x - 5, y + 5); g.stroke(); }
      }
      // gems
      for (let i = 0; i < 5; i++) {
        const sx = Math.sin(st.t * 60) * 7 * shake[i];
        const x = gx(i) + sx, y = gy, L1 = lit[i], s = size * (1 + 0.12 * L1 - 0.06 * press[i]);
        g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(x, y + size * 0.58, size * 0.42, size * 0.1, 0, 0, TAU); g.fill();
        if (L1 > 0) { g.globalCompositeOperation = 'lighter'; glow(g, x, y, s * 1.05, th.gems[i], 0.75 * L1); g.globalCompositeOperation = 'source-over'; }
        const sg = g.createRadialGradient(x, y - s * 0.2, s * 0.05, x, y, s * 0.52);
        sg.addColorStop(0, '#3a2f58'); sg.addColorStop(1, env.bold ? '#0d0f14' : '#120e20');
        g.fillStyle = sg; g.beginPath(); g.arc(x, y, s * 0.5, 0, TAU); g.fill();
        g.strokeStyle = focus === i ? '#ffffff' : th.hair; g.lineWidth = focus === i ? 4 : 2; g.stroke();
        const cg = g.createRadialGradient(x - s * 0.1, y - s * 0.14, 1, x, y, s * 0.32);
        cg.addColorStop(0, L1 > 0.2 ? '#ffffff' : rgba(th.gems[i], 1)); cg.addColorStop(1, th.gems[i]);
        g.globalAlpha = 0.6 + 0.4 * Math.max(L1, press[i]);
        symbolPath(g, i, x, y, s * 0.3); g.fillStyle = cg; g.fill();
        g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1.5; g.stroke();
        g.globalAlpha = 1;
        if (!env.compact && env.keyHints?.() !== false) { g.font = '700 18px Cinzel, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(248,236,210,.45)'; g.fillText(String(i + 1), x, y + s * 0.5 + 18); }
      }
      g.restore();
      if (bot && phase === 'input') drawHand(g, bot.x, bot.y, bot.press);
    },
  };
}

// ---- balance: a lantern on a pole wobbles; hold left or right to keep it in the middle band
function gBalance(env) {
  const { W, H, P, P0, th, fx } = env;
  const st = core(env);
  const px = W / 2, py = H * 0.96, Lp = H * 0.7;
  const padR = Math.min(56, H * 0.18), padY = H * 0.6, padLx = W * 0.1, padRx = W * 0.9;
  let ang = (env.rnd() < 0.5 ? -1 : 1) * 3, om = 0, inT = 0, inside = true, pL = false, pR = false, kL = false, kR = false, bump = 0;
  const ph = [env.rnd() * TAU, env.rnd() * TAU, env.rnd() * TAU];
  const lamps = [0, 0, 0, 0, 0, 0];
  const gust = (t) => P.gust * (0.62 * Math.sin(0.9 * t + ph[0]) + 0.42 * Math.sin(2.1 * t + ph[1]) + 0.26 * Math.sin(3.9 * t + ph[2])) / 1.3;
  let botU = 0, botT = 0;
  return {
    get done() { return st.done; }, get result() { return st.result; },
    info: () => ({ ang, om, bw: P.bw, t: st.t, live: !st.done }),
    update(dt) {
      st.t += dt; bump = Math.max(0, bump - dt * 3);
      if (st.done) return;
      if (env.demo) { botT -= dt; if (botT <= 0) { botT = 0.12; const pred = ang + om * 0.35; botU = Math.abs(pred) < P.bw * 0.3 ? 0 : pred > 0 ? -1 : 1; } }
      const u = env.demo ? botU : (pR || kR ? 1 : 0) - (pL || kL ? 1 : 0);
      const ramp = clamp((st.t - 0.4) / 1.2, 0, 1);
      const g0 = gust(st.t) * ramp;
      om += (P.k * ang + g0 + u * P.push - 1.7 * om) * dt;
      ang += om * dt;
      if (Math.abs(ang) > 72) { ang = Math.sign(ang) * 72; om = 0; bump = 1; }
      const now = Math.abs(ang) <= P.bw;
      if (now !== inside && !now) env.sfx('ui.hover', { volume: 0.25, rate: 0.7 });
      inside = now;
      if (now) { inT += dt; const s = Math.min(5, Math.floor(st.t)); const before = lamps[s]; lamps[s] = Math.min(1, lamps[s] + dt); if (before < 0.7 && lamps[s] >= 0.7) env.sfx('rune.click', { volume: 0.5, rate: 0.9 + s * 0.08 }); }
      if (Math.random() < dt * Math.abs(g0) / 6) fx.mote(g0 > 0 ? -10 : W + 10, H * (0.15 + Math.random() * 0.55), th.accent, 0, 1.4, 1.6);
      if (st.t >= P.time) {
        const s = inT / P.time;
        const o = s >= 0.93 ? 'crit' : s >= 0.72 ? 'success' : s >= 0.5 ? 'partial' : 'fail';
        const tip = [px + Math.cos((ang - 90) * D2R) * Lp, py + Math.sin((ang - 90) * D2R) * Lp];
        judgeFx(env, o, tip[0], tip[1]);
        st.finish(o, s, Math.round(s * 100));
      }
    },
    down(x) { if (x < W / 2) pL = true; else pR = true; },
    up() { pL = pR = false; },
    move() {},
    key(k, d) { if (k === 'left') kL = d; if (k === 'right') kR = d; },
    draw(g) {
      g.save();
      const r = Lp * 0.86, a0 = -90 - 75, a1 = -90 + 75;
      const arcS = (d0, d1, rr, w, style) => { g.beginPath(); g.arc(px, py, rr, d0 * D2R, d1 * D2R); g.lineWidth = w; g.strokeStyle = style; g.stroke(); };
      arcS(a0, a1, r, 48, 'rgba(4,3,9,.7)');
      arcS(a0, a1, r, 38, th.track);
      g.save(); g.shadowColor = th.zone; g.shadowBlur = inside ? 24 : 8;
      arcS(-90 - P.bw, -90 + P.bw, r, 34, rgba(th.zone, inside ? 0.9 : 0.6));
      g.restore();
      arcS(-90 - P.bw, -90 + P.bw, r + 8, 8, rgba(th.zoneHi, 0.5));
      if (P0 && P0.bw < P.bw - 0.5) {
        g.setLineDash([5, 5]); g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2;
        for (const d of [-90 - P0.bw, -90 + P0.bw]) { const c = Math.cos(d * D2R), s = Math.sin(d * D2R); g.beginPath(); g.moveTo(px + c * (r - 18), py + s * (r - 18)); g.lineTo(px + c * (r + 18), py + s * (r + 18)); g.stroke(); }
        g.setLineDash([]);
      }
      // the six lamps (one per second)
      for (let i = 0; i < 6; i++) {
        const x = W / 2 + (i - 2.5) * 40, y = H * 0.1, v = lamps[i], cur = !st.done && Math.floor(st.t) === i;
        if (v > 0) { g.globalCompositeOperation = 'lighter'; glow(g, x, y, 24, th.glow, 0.6 * v); g.globalCompositeOperation = 'source-over'; }
        g.fillStyle = 'rgba(4,3,9,.6)'; g.beginPath(); g.arc(x, y, 13, 0, TAU); g.fill();
        g.fillStyle = v >= 0.7 ? th.zone : rgba(th.zone, 0.15 + v * 0.6); g.beginPath(); g.arc(x, y, 10, 0, TAU); g.fill();
        g.strokeStyle = cur ? '#ffffff' : th.hair; g.lineWidth = cur ? 2.5 : 1.5; g.beginPath(); g.arc(x, y, 13, 0, TAU); g.stroke();
      }
      // the pole and its lantern
      const ca = Math.cos((ang - 90) * D2R), sa = Math.sin((ang - 90) * D2R);
      const tx = px + ca * Lp, ty = py + sa * Lp;
      const pg = g.createLinearGradient(px, py, tx, ty); pg.addColorStop(0, th.wood[1]); pg.addColorStop(1, th.wood[0]);
      g.strokeStyle = pg; g.lineCap = 'round'; g.lineWidth = 11; g.beginPath(); g.moveTo(px, py); g.lineTo(tx, ty); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 3; g.beginPath(); g.moveTo(px - 2, py); g.lineTo(tx - 2, ty); g.stroke();
      const wob = Math.sin(st.t * 12) * (inside ? 0 : 2);
      g.globalCompositeOperation = 'lighter';
      glow(g, tx, ty, inside ? 74 : 40, inside ? th.glow : th.bad, inside ? 0.7 : 0.35 + 0.2 * Math.abs(Math.sin(st.t * 9)));
      g.globalCompositeOperation = 'source-over';
      g.save(); g.translate(tx, ty); g.rotate(ang * D2R * 0.4 + wob * 0.02);
      g.fillStyle = env.bold ? '#3a3f4a' : '#5e3f10'; rrect(g, -17, -30, 34, 8, 3); g.fill(); rrect(g, -13, 14, 26, 7, 3); g.fill();
      rrect(g, -14, -24, 28, 40, 9);
      const lg = g.createRadialGradient(0, -4, 2, 0, -4, 24); lg.addColorStop(0, '#fffbe8'); lg.addColorStop(1, inside ? th.zone : '#8a5a5a');
      g.fillStyle = lg; g.fill(); g.strokeStyle = th.hair; g.lineWidth = 1.5; g.stroke();
      g.restore();
      // pivot
      const bg = g.createRadialGradient(px - 4, py - 6, 2, px, py, 22); bg.addColorStop(0, th.zoneHi); bg.addColorStop(1, env.bold ? '#3a3f4a' : '#9a6a1c');
      g.fillStyle = bg; g.beginPath(); g.arc(px, py, 20, 0, TAU); g.fill();
      // the two side pads
      const u = env.demo ? botU : (pR || kR ? 1 : 0) - (pL || kL ? 1 : 0);
      for (const [x, side] of [[padLx, -1], [padRx, 1]]) {
        const on = u === side;
        if (on) { g.globalCompositeOperation = 'lighter'; glow(g, x, padY, padR * 1.8, th.glow, 0.5); g.globalCompositeOperation = 'source-over'; }
        const gg = g.createRadialGradient(x - padR * 0.3, padY - padR * 0.35, 2, x, padY, padR);
        gg.addColorStop(0, on ? th.zoneHi : '#4a3d6e'); gg.addColorStop(1, on ? th.zone : env.bold ? '#1d2129' : '#231c38');
        g.fillStyle = gg; g.beginPath(); g.arc(x, padY, padR * (on ? 0.94 : 1), 0, TAU); g.fill();
        g.strokeStyle = th.hair; g.lineWidth = 2; g.stroke();
        g.strokeStyle = on ? '#2a1a06' : th.zoneHi; g.lineWidth = 6; g.lineCap = 'round'; g.lineJoin = 'round';
        for (const o of [-9, 9]) { g.beginPath(); g.moveTo(x - side * 10 + o, padY - 16); g.lineTo(x + side * 10 + o, padY); g.lineTo(x - side * 10 + o, padY + 16); g.stroke(); }
      }
      g.restore();
      if (env.demo && u) drawHand(g, (u < 0 ? padLx : padRx) + 14, padY + 20, 0.6, true);
    },
  };
}

// ---- sneak: hold to creep toward the goal while the watcher's eye is shut; let go when it flutters
function gSneak(env) {
  const { W, H, P, th, fx } = env;
  const st = core(env);
  const x0 = W * 0.1, x1 = W * 0.86, py = H * 0.8, ex = W * 0.5, ey = H * 0.31;
  const padX = W * 0.11, padY = H * 0.4, padR = Math.min(50, H * 0.16);
  let p = 0, held = false, keyHeld = false, seen = 0, freeze = 0, stepT = 0, glare = 0, open = 0;
  let phase = 'closed', pt = 0, dur = env.demo ? 1.3 : 2.4, zT = 0;
  const rnd = (a, b) => a + env.rnd() * (b - a);
  const next = () => {
    pt = 0;
    if (phase === 'closed') { phase = 'flutter'; dur = P.flutter; env.sfx('wing', { volume: 0.35, rate: 1.4 }); }
    else if (phase === 'flutter') { phase = 'open'; dur = rnd(P.oMin, P.oMax); env.sfx('whoosh', { volume: 0.4 }); }
    else { phase = 'closed'; dur = env.demo ? 1.2 : rnd(P.cMin, P.cMax); }
  };
  const moving = () => (held || keyHeld) && freeze <= 0 && !st.done;
  let botHold = false;
  return {
    get done() { return st.done; }, get result() { return st.result; },
    info: () => ({ phase, pt, dur, p, seen, live: !st.done }),
    update(dt) {
      st.t += dt; glare = Math.max(0, glare - dt * 1.2);
      const target = phase === 'closed' ? 0 : phase === 'flutter' ? 0.12 + 0.16 * Math.abs(Math.sin(st.t * 26)) : 1;
      open += (target - open) * Math.min(1, dt * (phase === 'open' || phase === 'glare' ? 14 : 20));
      if (phase === 'closed' && !env.bold) { zT += dt; if (zT > 0.9) { zT = 0; fx.text(ex + 70, ey - 20, 'z', th.accent, 22, 1.6); } }
      if (st.done) return;
      if (env.demo) { botHold = phase === 'closed' && pt > 0.25; held = botHold; }
      pt += dt;
      if (pt >= dur) next();
      if (freeze > 0) freeze -= dt;
      if (moving()) {
        p = Math.min(1, p + P.v * dt);
        stepT += dt; if (stepT > 0.33) { stepT = 0; env.sfx('footsteps', { volume: 0.22 }); }
        if (phase === 'open' && pt > P.grace) {
          seen++; glare = 1; freeze = 1.0; p = Math.max(0, p - 0.12);
          phase = 'glare'; pt = 0; dur = 0.9;
          env.sfx('sting.danger', { volume: 0.55 }); env.shake?.(5);
          const hx = lerp(x0, x1, p);
          fx.text(hx, py - 86, env.S.seen, th.bad, 34, 1.1); fx.ring(hx, py - 34, th.bad, 20, 70, 0.5, 4);
          if (seen >= 3) { env.say(env.S.caught, th.bad); st.finish('fail', p * 0.5, 3); return; }
        }
      }
      if (p >= 1) {
        const o = seen === 0 ? 'crit' : seen === 1 ? 'success' : 'partial';
        judgeFx(env, o, x1, py - 40); env.sfx('item.get', { volume: 0.6 });
        st.finish(o, 1 - seen * 0.25, seen);
      } else if (st.t >= P.time) {
        const o = p >= 0.8 ? 'partial' : 'fail';
        env.say(env.S.timeUp, th.bad); st.finish(o, p * 0.6, 'timeout');
      }
    },
    down() { held = true; }, up() { held = false; }, move() {},
    key(k, d) { if (k === 'act') keyHeld = d; },
    draw(g) {
      g.save();
      // the path
      const pg = g.createLinearGradient(0, py - 20, 0, py + 30);
      pg.addColorStop(0, env.bold ? 'rgba(80,84,96,.55)' : 'rgba(96,74,52,.55)'); pg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = pg; g.beginPath(); g.ellipse((x0 + x1) / 2, py + 6, (x1 - x0) / 2 + 40, 26, 0, 0, TAU); g.fill();
      for (let i = 0; i <= 14; i++) {
        const x = lerp(x0, x1, i / 14), passed = i / 14 <= p;
        g.fillStyle = passed ? rgba(th.zone, 0.75) : 'rgba(255,255,255,.16)';
        g.beginPath(); g.ellipse(x, py + 4, 7, 3.5, 0, 0, TAU); g.fill();
      }
      // grass tufts
      g.strokeStyle = env.bold ? 'rgba(90,100,90,.6)' : 'rgba(90,150,90,.55)'; g.lineWidth = 2; g.lineCap = 'round';
      for (let i = 0; i < 9; i++) { const x = lerp(x0 - 20, x1 + 20, (i + 0.5) / 9), y = py + 20 + (i % 2) * 6; for (const s of [-1, 0, 1]) { g.beginPath(); g.moveTo(x + s * 4, y); g.quadraticCurveTo(x + s * 6, y - 10, x + s * 10, y - 16 - (s === 0 ? 4 : 0)); g.stroke(); } }
      // the goal
      g.globalCompositeOperation = 'lighter'; glow(g, x1, py - 40, 80, th.glow, 0.35 + 0.1 * Math.sin(st.t * 3)); g.globalCompositeOperation = 'source-over';
      if (env.bold) {
        g.fillStyle = '#4a2c14'; rrect(g, x1 - 30, py - 50, 60, 40, 6); g.fill();
        g.fillStyle = '#6a3e1c'; rrect(g, x1 - 30, py - 62, 60, 18, 8); g.fill();
        g.strokeStyle = '#d9a640'; g.lineWidth = 3; g.strokeRect(x1 - 30, py - 50, 60, 40); g.fillStyle = '#ffd35c'; g.fillRect(x1 - 5, py - 46, 10, 12);
      } else {
        g.strokeStyle = '#7a5228'; g.lineWidth = 5; g.beginPath(); g.moveTo(x1, py); g.lineTo(x1, py - 44); g.stroke();
        g.fillStyle = '#5e3f10'; rrect(g, x1 - 16, py - 92, 32, 7, 3); g.fill();
        rrect(g, x1 - 13, py - 86, 26, 36, 8);
        const lg = g.createRadialGradient(x1, py - 68, 2, x1, py - 68, 22); lg.addColorStop(0, '#fffbe8'); lg.addColorStop(1, th.zone);
        g.fillStyle = lg; g.fill(); g.strokeStyle = th.hair; g.stroke();
      }
      // the light cone
      if (open > 0.3) {
        const cg = g.createLinearGradient(0, ey, 0, py + 20);
        const col = glare > 0 ? th.bad : th.zoneHi;
        cg.addColorStop(0, rgba(col, 0.35 * open)); cg.addColorStop(1, rgba(col, 0.05 * open));
        g.fillStyle = cg; g.beginPath(); g.moveTo(ex - 30, ey + 20); g.lineTo(ex + 30, ey + 20); g.lineTo(ex + W * 0.42, py + 24); g.lineTo(ex - W * 0.42, py + 24); g.closePath(); g.fill();
      }
      // the watcher: a big eye in a dark bramble
      const shakeX = phase === 'flutter' ? Math.sin(st.t * 50) * 2 : 0;
      g.fillStyle = env.bold ? '#111318' : '#1a1430';
      for (const [dx, dy, rr] of [[-88, 6, 40], [88, 4, 40], [-50, -26, 46], [50, -28, 46], [0, -34, 52], [0, 24, 40]]) { g.beginPath(); g.arc(ex + dx, ey + dy, rr, 0, TAU); g.fill(); }
      const ew = 92, eh = 46 * Math.max(0.06, open);
      g.save(); g.translate(ex + shakeX, ey);
      g.beginPath(); g.moveTo(-ew, 0); g.quadraticCurveTo(0, -eh * 2, ew, 0); g.quadraticCurveTo(0, eh * 2, -ew, 0); g.closePath();
      g.fillStyle = env.bold ? '#f0e0d0' : '#fff4dc'; g.fill();
      g.save(); g.clip();
      const look = clamp((lerp(x0, x1, p) - ex) / 300, -1, 1) * 30;
      const ig = g.createRadialGradient(look, 0, 2, look, 0, 34);
      ig.addColorStop(0, glare > 0 ? '#ffd0c0' : '#fff3b0'); ig.addColorStop(0.5, glare > 0 ? '#ff3b2f' : env.bold ? '#e0322a' : '#ffb02e'); ig.addColorStop(1, glare > 0 ? '#6a0a0a' : env.bold ? '#4a0a08' : '#b3420c');
      g.fillStyle = ig; g.beginPath(); g.arc(look, 0, 34, 0, TAU); g.fill();
      g.fillStyle = '#120806'; g.beginPath(); g.ellipse(look, 0, 6, 24, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(look - 10, -10, 5, 0, TAU); g.fill();
      g.restore();
      g.strokeStyle = th.zone; g.lineWidth = 3; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-ew, 0); g.quadraticCurveTo(0, -eh * 2, ew, 0); g.stroke();
      g.beginPath(); g.moveTo(-ew, 0); g.quadraticCurveTo(0, eh * 2, ew, 0); g.stroke();
      if (open < 0.5) { for (let i = -3; i <= 3; i++) { const x = i * 24, y = eh * 0.9 + 4 - Math.abs(i) * 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x * 1.12, y + 12); g.stroke(); } }
      g.restore();
      if (phase === 'flutter') { g.globalCompositeOperation = 'lighter'; glow(g, ex, ey, 120, th.bad, 0.18 + 0.12 * Math.abs(Math.sin(st.t * 20))); g.globalCompositeOperation = 'source-over'; }
      // the hero
      const hx = lerp(x0, x1, p), mv = moving();
      const bob = mv ? Math.abs(Math.sin(st.t * 11)) * 5 : 0, hy = py - 34 - bob, hr = 30;
      g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(hx, py + 2, 26, 7, 0, 0, TAU); g.fill();
      g.save();
      if (freeze > 0) g.translate(Math.sin(st.t * 60) * 3, 0);
      g.beginPath(); g.arc(hx, hy, hr, 0, TAU); g.save(); g.clip();
      const img = env.hero?.img;
      if (img && img.complete && img.naturalWidth) g.drawImage(img, hx - hr, hy - hr, hr * 2, hr * 2);
      else {
        g.fillStyle = env.hero?.color || '#4a3d6e'; g.fillRect(hx - hr, hy - hr, hr * 2, hr * 2);
        g.font = '900 26px Cinzel, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(env.hero?.initial || '?', hx, hy + 1);
      }
      if (freeze > 0) { g.fillStyle = rgba(th.bad, 0.35); g.fillRect(hx - hr, hy - hr, hr * 2, hr * 2); }
      g.restore();
      g.strokeStyle = freeze > 0 ? th.bad : th.zone; g.lineWidth = 3; g.beginPath(); g.arc(hx, hy, hr, 0, TAU); g.stroke();
      g.restore();
      // seen pips (top right) and the hold pad (top left)
      for (let i = 0; i < 3; i++) {
        const x = W - 40 - i * 34, y = 30, on = i < seen;
        g.fillStyle = on ? th.bad : 'rgba(255,255,255,.14)';
        g.beginPath(); g.moveTo(x - 13, y); g.quadraticCurveTo(x, y - 12, x + 13, y); g.quadraticCurveTo(x, y + 12, x - 13, y); g.fill();
        g.fillStyle = on ? '#2a0606' : 'rgba(0,0,0,.4)'; g.beginPath(); g.arc(x, y, 4, 0, TAU); g.fill();
      }
      const hk = mv ? 1 : 0;
      if (hk) { g.globalCompositeOperation = 'lighter'; glow(g, padX, padY, padR * 1.8, th.glow, 0.45); g.globalCompositeOperation = 'source-over'; }
      const hg = g.createRadialGradient(padX - padR * 0.3, padY - padR * 0.35, 2, padX, padY, padR);
      hg.addColorStop(0, hk ? th.zoneHi : '#4a3d6e'); hg.addColorStop(1, hk ? th.zone : env.bold ? '#1d2129' : '#231c38');
      g.fillStyle = hg; g.beginPath(); g.arc(padX, padY, padR * (hk ? 0.94 : 1), 0, TAU); g.fill();
      g.strokeStyle = th.hair; g.lineWidth = 2; g.stroke();
      g.font = `900 ${Math.round(padR * 0.42)}px Cinzel, Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = hk ? '#2a1a06' : th.zoneHi; g.fillText(env.S.holdBtn, padX, padY + 1);
      const left = st.done ? 0 : clamp(1 - st.t / P.time, 0, 1);
      g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(W * 0.3, 8, W * 0.4, 5);
      g.fillStyle = left < 0.25 ? th.bad : rgba(th.zoneHi, 0.8); g.fillRect(W * 0.3, 8, W * 0.4 * left, 5);
      g.restore();
      if (env.demo && botHold) drawHand(g, padX + 14, padY + 20, 0.6, true);
    },
  };
}

export const GAMES = { timing: gTiming, aim: gAim, mash: gMash, memory: gMemory, balance: gBalance, sneak: gSneak };

// ================================================================ the moment
function feelOf(ctx, spec) {
  if (spec.feel === 'bold' || spec.feel === 'calm') return spec.feel;
  return ctx.pack?.theme === 'gs' ? 'bold' : 'calm';
}

function autoOutcome(ctx, target, bonus) {
  const r = ctx.auto?.rng || ctx.rng;
  let p = 0.9 - (target - 8) * 0.05 + 0.04 * bonus - (ctx.auto?.mistakes ? 0.25 : 0);
  p = clamp(p, 0.05, 0.98);
  if (r.chance(p)) return r.chance(0.1) ? 'crit' : 'success';
  return r.chance(1 / 3) ? 'partial' : 'fail';
}

function subLine(kind, res) {
  const o = res.outcome, s = res.sub;
  if (kind === 'sneak' && typeof s === 'number' && s < 3 && o !== 'fail') return STR.seenSub(s);
  if (kind === 'balance' && typeof s === 'number') return STR.inGold(s);
  if (kind === 'mash' && s && typeof s === 'object') return s.time != null ? STR.fullIn(s.time) : STR.full(Math.round((s.fill || 0) * 100));
  if (kind === 'memory' && typeof s === 'number' && (o === 'success' || o === 'partial')) return STR.slips(s);
  return STR.sub[o];
}

export async function runSkill(spec = {}, ctx) {
  await ensureCss();
  trackInput();
  const kind = KINDS.includes(spec.kind) ? spec.kind : 'timing';
  const stat = spec.stat || DEFAULT_STAT[kind];
  const talent = spec.talent || null;
  const compact = !!spec.compact;
  const feel = feelOf(ctx, spec), bold = feel === 'bold';
  const th = THEMES[feel];
  const state = ctx.state;
  const dir = compact ? null : ctx.gm?.director;
  const living = state.party.filter((x) => x.hp > 0);
  const pool = living.length ? living : state.party;
  const reduce = reduced() || !!ctx.settings?.reduceMotion;
  let target = R.dcTarget(spec.dc);
  let mercy = false;
  if (dir?.checkTarget) { const m = dir.checkTarget(target); target = m.target; mercy = m.mercy; }
  ctx.bus.emit('skill:start', { ...spec, kind, target });

  // ---- the card
  const color = R.STAT_COLORS[stat] || '#f7c95c';
  const W = compact ? 640 : 820, H = compact ? 260 : 296;
  const pr = Math.min(2, ctx.stage?.pixelRatio?.() || window.devicePixelRatio || 1);
  const heroesRow = h('div.lfk-heroes');
  const badge = h('div.lfk-badge');
  const howEl = h('div.lfk-how', STR.how[kind]);
  const keysEl = h('div.lfk-keys', kind === 'aim' ? STR.keys.aim : kind === 'balance' ? STR.keys.two : kind === 'memory' ? STR.keys.mem : STR.keys.act);
  const canvas = h('canvas.lfk-canvas', { width: Math.round(W * pr), height: Math.round(H * pr), style: { width: `${W}px`, height: `${H}px` } });
  const readyVeil = h('div.lfk-veil');
  // memory, calm: one free "show me again" (a big button in the corner, away from the five lights)
  const replayBtn = kind === 'memory' ? ctx.ui.button(STR.replay, { kind: 'ghost', icon: 'spark', cls: 'lfk-replay', sfx: 'ui.tap', onClick: () => { if (phase === 'play' && game?.replay?.()) replayBtn.classList.remove('is-on'); } }) : null;
  const play = h('div.lfk-play', { style: { width: `${W}px`, height: `${H}px` } }, canvas, readyVeil, keysEl, replayBtn);
  const foot = h('div.lfk-foot');
  const card = h('div.lfk.lf-panel', { class: `feel-${feel} kind-${kind}${compact ? ' is-compact' : ''}`, style: { '--sc': color } },
    h('div.lfk-kicker', h('span.lfk-gem'), STR.kicker(R.STAT_NAMES[stat] || stat),
      talent ? h('span.lf-chip.lfk-talent', ctx.ui.icon('talent'), R.TALENT_NAMES[talent] || STR.talent) : null),
    h('h2.lfk-title', fmt(spec.label || '', {})),
    mercy ? h('div.lfk-mercy', STR.mercy) : null,
    heroesRow,
    h('div.lfk-body', badge, howEl, play),
    foot);
  const wrap = h('div.lfk-wrap', { 'data-no-advance': '', class: compact ? 'is-compact' : null }, card);
  ctx.stage.layers.overlay.appendChild(wrap);
  if (!compact) ctx.stage.fx('dim');
  ctx.audio.sfx('ui.open');
  await ctx.sleep(20);
  wrap.classList.add('is-in');

  // ---- the loop: one current game on the canvas, plus particles and the backdrop
  const g = canvas.getContext('2d');
  const fx = makeFx(feel, reduce);
  const backdrop = makeBackdrop(W, H, pr, th, bold);
  let game = null, alive = true, last = performance.now(), shakeAmt = 0, frames = 0;
  const flashText = (text, hex = th.ink) => fx.text(W / 2, H * 0.42, text, hex, Math.min(40, H * 0.12), 1.4);
  const loop = (now) => {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000) * speed();
    last = now; frames++;
    fx.update(dt);
    if (game) game.update(dt);
    if (replayBtn) replayBtn.classList.toggle('is-on', phase === 'play' && !!game?.canReplay);
    if (!reduce && Math.random() < dt * 3) fx.mote(Math.random() * W, H + 6, th.speck, -(14 + Math.random() * 20), 4, 1.6);
    g.setTransform(pr, 0, 0, pr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.drawImage(backdrop, 0, 0, W, H);
    shakeAmt = Math.max(0, shakeAmt - dt * 30);
    if (shakeAmt > 0 && !reduce) g.translate((Math.random() - 0.5) * shakeAmt, (Math.random() - 0.5) * shakeAmt);
    if (game) game.draw(g);
    fx.draw(g);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // ---- input
  let phase = 'pick'; // pick | demo | play | over
  let readyFn = null;
  const local = (e) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height)]; };
  const onDown = (e) => {
    e.preventDefault();
    if (phase === 'demo' && readyFn) { readyFn(); return; }
    if (phase === 'play' && game) { try { canvas.setPointerCapture?.(e.pointerId); } catch { /* ignore */ } game.down(...local(e)); }
  };
  const onMove = (e) => { if (phase === 'play' && game && e.pointerType === 'mouse') game.move(...local(e)); };
  const onUp = () => { if (phase === 'play' && game) game.up(); };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  const KEYMAP = { ' ': 'act', Enter: 'act', ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' };
  const onKey = (e, isDown) => {
    const k = KEYMAP[e.key] || (/^[1-5]$/.test(e.key) ? e.key : null);
    if (!k || phase === 'pick') return;
    if (phase === 'over' && k === 'act') return; // the reroll buttons handle their own Enter
    e.preventDefault();
    if (isDown && e.repeat) return;
    if (phase === 'demo') { if (isDown && k === 'act' && readyFn) readyFn(); return; }
    if (phase === 'play' && game) game.key(k, isDown);
  };
  const kd = (e) => onKey(e, true), ku = (e) => onKey(e, false);
  window.addEventListener('keydown', kd);
  window.addEventListener('keyup', ku);

  const close = async () => {
    wrap.classList.remove('is-in');
    wrap.classList.add('is-out');
    if (!compact) ctx.stage.fx('undim');
    await ctx.sleep(compact ? 260 : 380);
    alive = false;
    canvas.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    window.removeEventListener('keydown', kd);
    window.removeEventListener('keyup', ku);
    wrap.remove();
  };

  // ---- pick the hero
  const spotId = compact ? null : dir?.spotlight?.(pool) || null;
  const pickHero = () => new Promise((resolve) => {
    if (spec.heroId && state.hero(spec.heroId)) return resolve(spec.heroId);
    if (spec.who === 'actor' || compact) {
      const id = (spec.actor && state.hero(spec.actor)) ? spec.actor : (ctx.gm?.actor && state.hero(ctx.gm.actor) ? ctx.gm.actor : pool[0].id);
      return resolve(id);
    }
    if (pool.length === 1) return resolve(pool[0].id);
    card.classList.add('is-choosing');
    heroesRow.appendChild(h('div.lfk-choose', STR.choose));
    const list = h('div.lfk-herolist');
    heroesRow.appendChild(list);
    let done = false;
    for (const hero of pool) {
      const b = R.checkBonus(hero, { stat, talent });
      const el = h('button.lfk-hero', { type: 'button', dataset: { hero: hero.id } },
        spotId === hero.id ? h('span.lf-spot-mark', ctx.ui.icon('talent'), STR.spot) : null,
        ctx.ui.portrait(hero.id, 'md'),
        h('span.lfk-hero-name', hero.name.split(' ')[0]),
        h('span.lfk-hero-bonus', (b.total >= 0 ? '+' : '') + b.total),
        b.talent ? h('span.lfk-hero-talent', ctx.ui.icon('talent')) : null);
      tap(el, () => { if (done) return; done = true; ctx.audio.sfx('ui.confirm'); el.classList.add('is-sel'); resolve(hero.id); }, ctx);
      list.appendChild(el);
    }
    if (ctx.auto) ctx.sleep(500).then(() => { if (done) return; done = true; resolve(ctx.auto.pickHero(pool, { stat, talent, spot: spotId })); });
  });

  // who: 'each' -> every hero plays in turn (a row of small chips shows who has gone and how it went)
  const each = spec.who === 'each' && !compact && pool.length > 1;
  const chips = new Map();
  if (each) {
    card.classList.add('is-each');
    const row = h('div.lfk-eachrow');
    for (const hr of pool) { const c = h('div.lfk-chip', { dataset: { hero: hr.id } }, ctx.ui.portrait(hr.id, 'sm'), h('span.lfk-chip-res')); chips.set(hr.id, c); row.appendChild(c); }
    play.appendChild(row);
  }

  let hero, bonus, P, P0, first, heroImg = null;
  const setHero = (hr) => {
    hero = hr;
    bonus = R.checkBonus(hero, { stat, talent });
    P = skillParams(kind, hardness(target, bonus.total), bold);
    P0 = bonus.total > 0 ? skillParams(kind, hardness(target, 0), bold) : null;
    first = hero.name.split(' ')[0];
    badge.replaceChildren(...[
      ctx.ui.portrait(hero.id, 'sm'),
      h('span.lfk-badge-name', first),
      bonus.total ? h('span.lfk-badge-bonus', `+${bonus.total}`) : null,
      bonus.talent ? h('span.lfk-badge-talent', ctx.ui.icon('talent')) : null,
      h('span.lfk-badge-help', bonus.total > 0 ? `${STR.whose(first, bonus.stat ? (R.STAT_NAMES[stat] || stat) : null, !!bonus.talent)} ${STR.help[kind]}` : STR.noBonus)].filter(Boolean));
    pop(badge);
    chips.forEach((c, id) => c.classList.toggle('is-sel', id === hero.id));
    ctx.gm?.setActor?.(hero.id);
    heroImg = null;
    if (kind === 'sneak') {
      const src = ctx.assets.portrait(hero.id);
      if (ctx.assets.has(src) !== false) { heroImg = new Image(); heroImg.src = src; }
    }
  };
  if (each) setHero(pool[0]);
  else {
    const heroId = await pickHero();
    card.classList.remove('is-choosing');
    heroesRow.replaceChildren();
    setHero(state.hero(heroId) || pool[0]);
  }
  card.classList.add('is-picked');

  const makeEnv = (demo, onDone) => ({
    W, H, P, P0, th, fx, bold, feel, demo, compact, practice: !bold && !demo, rnd: Math.random, S: STR,
    hero: { img: heroImg, color: ctx.ui.heroColor?.(hero.id) || '#4a3d6e', initial: first[0] },
    sfx: (n, o) => { if (!demo) ctx.audio.sfx(n, o); },
    chime: (i) => { if (!demo) ctx.audio.chime?.(i); },
    say: (t, hex) => flashText(t, hex),
    keyHints: () => !inputIsTouch(),   // the 1 to 5 under the lights are key labels: hidden after a touch
    shake: (n) => { if (!demo) shakeAmt = Math.max(shakeAmt, n); },
    onDone,
  });

  // ---- the demo loops until the players are ready
  let demoTimer = 0;
  const startDemo = () => {
    const env = makeEnv(true, () => { demoTimer = setTimeout(() => { if (phase === 'demo') startDemo(); }, 1100); });
    game = GAMES[kind](env);
  };
  const waitReady = () => new Promise((resolve) => {
    phase = 'demo';
    startDemo();
    readyVeil.classList.add('is-on');
    const btn = ctx.ui.button(STR.ready, { kind: 'gold', size: 'lg', cls: 'lfk-ready', onClick: () => fin(), sfx: 'ui.confirm' });
    foot.replaceChildren(btn);
    foot.classList.add('is-on');
    let done = false;
    const fin = () => {
      if (done) return; done = true; readyFn = null;
      clearTimeout(demoTimer);
      ctx.audio.sfx('ui.confirm');
      foot.classList.remove('is-on');
      readyVeil.classList.remove('is-on');
      resolve();
    };
    readyFn = fin;
    if (ctx.auto) ctx.sleep(compact ? 300 : 700).then(fin);
  });

  // ---- one go at the game
  const playOnce = async () => {
    fx.text(W / 2, H * 0.45, STR.go, th.zoneHi, Math.min(64, H * 0.2), 0.8);
    ctx.audio.sfx('ui.confirm', { volume: 0.6 });
    if (ctx.auto) {
      // autoplay: the demo plays for a moment, then a seeded roll decides
      phase = 'auto';
      game = GAMES[kind](makeEnv(true, null));
      await ctx.sleep(compact ? 500 : 1100);
      const o = autoOutcome(ctx, target, bonus.total);
      judgeFx({ fx, th, sfx: (n, op) => ctx.audio.sfx(n, op), shake: (n) => { shakeAmt = n; } }, o, W / 2, H * 0.4);
      await ctx.sleep(400);
      return { outcome: o, score: { crit: 1, success: 0.75, partial: 0.45, fail: 0.15 }[o], sub: null };
    }
    await ctx.sleep(250);
    phase = 'play';
    const res = await new Promise((resolve) => { game = GAMES[kind](makeEnv(false, resolve)); window.__LF_SKILL_GAME = game; });
    phase = 'over';
    await ctx.sleep(900);
    return res;
  };

  const showBanner = async (res) => {
    const o = res.outcome;
    ctx.audio.sfx(o === 'crit' ? 'check.crit' : R.isPass(o) ? 'check.success' : 'check.fail', { volume: o === 'partial' ? 0.7 : 1 });
    if (o === 'crit' && !reduce) ctx.stage.fx('flash');
    const sub = subLine(kind, res);
    if (compact) {
      fx.text(W / 2, H * 0.42, STR.banner[o], o === 'fail' ? '#d8d0e8' : o === 'partial' ? th.rim : th.zoneHi, 52, 1.4);
      await ctx.sleep(1100);
      return;
    }
    await ctx.ui.banner(STR.banner[o], { kind: o, sub, hold: o === 'crit' ? 1500 : 1100, top: 150 });
  };

  let result;
  try {
    if (each) {
      // every hero in turn; the step passes when at least half pass, and is perfect only if all were
      const runs = [];
      for (let i = 0; i < pool.length; i++) {
        if (i) setHero(pool[i]);
        await waitReady();
        let r = await playOnce();
        // a hero who misses may spend a Star for one more go (the better result counts), as on the check card
        if (!R.isPass(r.outcome) && state.stars > 0) {
          fx.text(W / 2, H * 0.42, STR.banner[r.outcome], r.outcome === 'partial' ? th.rim : '#d8d0e8', 44, 1.2);
          ctx.audio.sfx('check.fail', { volume: 0.6 });
          const offer = ctx.gm.line?.('reroll.offer');
          if (offer) ctx.gm.aside(offer);
          if (await askReroll(ctx, foot) && state.spendStar()) {
            ctx.audio.sfx('star.spend');
            ctx.bus.emit('star:spent', { why: 'skill' });
            await waitReady();
            const again = await playOnce();
            if (RANK[again.outcome] >= RANK[r.outcome]) r = again;
          }
        }
        runs.push({ ...r, heroId: hero.id });
        const c = chips.get(hero.id);
        c.classList.add(R.isPass(r.outcome) ? 'is-pass' : 'is-fail');
        c.querySelector('.lfk-chip-res').replaceChildren(ctx.ui.icon(R.isPass(r.outcome) ? 'check' : 'close'));
        fx.text(W / 2, H * 0.42, STR.banner[r.outcome], r.outcome === 'fail' ? '#d8d0e8' : r.outcome === 'partial' ? th.rim : th.zoneHi, 44, 1.2);
        ctx.audio.sfx(R.isPass(r.outcome) ? 'check.success' : 'check.fail', { volume: 0.6 });
        await ctx.sleep(700);
      }
      const passes = runs.filter((r) => R.isPass(r.outcome)).length;
      const ok = passes >= Math.ceil(runs.length / 2);
      const best = [...runs].sort((a, b) => RANK[b.outcome] - RANK[a.outcome] || b.score - a.score)[0];
      const outcome = ok ? (runs.every((r) => r.outcome === 'crit') ? 'crit' : 'success') : (runs.some((r) => r.outcome === 'partial') && passes + 1 >= Math.ceil(runs.length / 2) ? 'partial' : 'fail');
      const res = { outcome, score: runs.reduce((s, r) => s + r.score, 0) / runs.length, sub: null };
      await showBanner(res);
      result = { outcome, heroId: best.heroId, score: Math.round(res.score * 100) / 100, kind, target, passed: passes, of: runs.length };
    } else {
    await waitReady();
    let res = await playOnce();
    await showBanner(res);
    if (!compact && !R.isPass(res.outcome) && state.stars > 0) {
      const offer = ctx.gm.line?.('reroll.offer');
      if (offer) ctx.gm.aside(offer);
      const spend = await askReroll(ctx, foot);
      if (spend && state.spendStar()) {
        ctx.audio.sfx('star.spend');
        ctx.bus.emit('star:spent', { why: 'skill' });
        const sl = ctx.gm.line?.('star.spend');
        if (sl) ctx.gm.aside(sl);
        await waitReady();
        const again = await playOnce();
        await showBanner(again);
        if (RANK[again.outcome] >= RANK[res.outcome]) res = again;
      }
    }
    result = { outcome: res.outcome, heroId: hero.id, score: res.score, kind, target };
    }
  } finally {
    phase = 'over';
    clearTimeout(demoTimer);
    await close();
  }

  const t = state.tally;
  if (state.tallyAdd) {
    state.tallyAdd('skills');
    if (R.isPass(result.outcome)) state.tallyAdd('skillsPassed');
    if (result.outcome === 'crit') state.tallyAdd('perfects');
  } else if (t) { t.skills = (t.skills || 0) + 1; }
  dir?.onCheckResult?.(result);
  ctx.bus.emit('skill:result', result);
  if (!compact) {
    // skill.* pools when the content has them (no talk of rolls), else the roll.* pools the contract names
    const sk = `skill.${result.outcome}`;
    const poolKey = ctx.content?.gmLines?.[sk]?.length ? sk : `roll.${result.outcome}`;
    await ctx.gm.react(poolKey);
  }
  void frames; void getLang;
  return result;
}

function askReroll(ctx, foot) {
  return new Promise((resolve) => {
    let done = false;
    let q, btns;
    const fin = (v) => { if (done) return; done = true; foot.classList.remove('is-on'); setTimeout(() => { q.remove(); btns.remove(); }, 300); resolve(v); };
    foot.replaceChildren(
      q = h('div.lfk-reroll-q', ctx.ui.icon('star'), STR.reroll),
      btns = h('div.lfk-reroll-btns',
        ctx.ui.button(STR.spend, { kind: 'gold', icon: 'star', onClick: () => fin(true), sfx: 'ui.confirm' }),
        ctx.ui.button(STR.keep, { kind: 'ghost', onClick: () => fin(false) })));
    requestAnimationFrame(() => foot.classList.add('is-on'));
    if (ctx.auto) ctx.sleep(500).then(() => fin(ctx.auto.rng.chance(0.6)));
  });
}

// A painted backdrop for the play window, drawn once: deep glass with a warm pool of light (calm) or
// cold steel with embers (bold), specks and a vignette.
function makeBackdrop(W, H, pr, th, bold) {
  const c = document.createElement('canvas');
  c.width = Math.round(W * pr); c.height = Math.round(H * pr);
  const g = c.getContext('2d');
  g.scale(pr, pr);
  const bg = g.createRadialGradient(W / 2, H * 0.55, 20, W / 2, H * 0.55, W * 0.7);
  bg.addColorStop(0, th.bg0); bg.addColorStop(1, th.bg1);
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  glow(g, W / 2, H * 0.62, W * 0.45, bold ? '#ff6a2a' : '#f7c95c', bold ? 0.08 : 0.1);
  if (bold) {
    g.strokeStyle = 'rgba(255,255,255,.025)'; g.lineWidth = 1;
    for (let i = -H; i < W; i += 14) { g.beginPath(); g.moveTo(i, H); g.lineTo(i + H, 0); g.stroke(); }
  }
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * W, y = Math.random() * H, r = Math.random() * 1.4 + 0.3;
    g.fillStyle = rgba(th.speck, Math.random() * 0.35);
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, W * 0.62);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
  return c;
}
