// Grimspire action commands (GRIMSPIRE 4.2): the quick skill moments behind every strike and every block.
//
//   runCommand(kind, opts, ctx) -> Promise<{ grade, grades, kind, ms }>
//     kind   a weapon family ('sword' 'daggers' 'staff' 'bow' 'axes' 'scythe'), a command id
//            ('sweep' 'double' 'charge' 'aim' 'taps' 'pulse'), or 'block'
//     grade  strikes: 'perfect' | 'good' | 'weak'      block: 'perfect' | 'good' | 'miss'
//     grades the per-beat grades (two for Double strike and Pulse, one otherwise)
//   opts = {
//     at: { x, y }        stage point the command is drawn on (the target's chest, or the hunter's for a block)
//     host                element to draw in (default ctx.stage.layers.screen); the whole stage takes the input
//     window = 1          window multiplier from the rules (difficulty, Speed, charms, chill); 1 = Knight
//     difficulty          'squire' | 'knight' | 'legend' (used for the window when `window` is not given, and the auto mix)
//     big                 block only: a telegraphed big attack (longer wind-up, smaller window)
//     color               the element colour of the swing (default ember)
//     hint = true         show the one-line "how" under the command
//     auto                force the seeded auto grade (default: ctx.auto); rng: a seeded rng with .next() or .chance()
//     mix                 auto mix { perfect, good } probabilities (default: Knight 25 / 50 / 25)
//   }
//   COMMAND_OF[family] -> command id;  autoGrade(rng, mix, block) -> grade;  windowFor(difficulty) -> multiplier
//   BASE = the Knight windows in ms (or px for Aim, taps for Fury taps), so the bench can print them.
//
// How a grade is decided (Knight, window 1; every window scales with opts.window):
//   Sweep      one tap; error from the moment the blade crosses the mark: <= 55 ms Perfect, <= 125 ms Good, else Weak
//   Double     two rings; each tap graded like Sweep against its own ring; the result is the worse of the two
//   Charge     hold, release: error from the centre of the bright band (78% full): <= 55 ms Perfect, <= 125 ms Good;
//              past 100% it fizzles (Weak); never pressed is Weak
//   Aim        one tap; distance from the reticle to the weak point: <= 22 px Perfect, <= 50 px Good
//   Fury taps  taps in 1.5 s (starts on the first tap): >= 10 Perfect, >= 6 Good (targets divide by sqrt(window))
//   Pulse      two pulses in rhythm, each graded like Sweep; both Perfect = Perfect, total score 2 or 3 = Good, else Weak
//   Block      one tap as the ring closes: <= 60 ms Perfect, <= 140 ms Good; big attacks use x0.7 windows.
//              A tap earlier than the Good window locks in a miss (no mashing), as does no tap.
// Every beat is one tap: a tap far too early spends the beat. Time is game time (scaled by window.__LF_SPEED) and
// read from the input event's own timeStamp, so frame drops never move the grade. Nothing waits on animationend.
import { L } from '../core/i18n.js';
import { keyHint } from './input-mode.js';

export const COMMAND_OF = { sword: 'sweep', daggers: 'double', staff: 'charge', bow: 'aim', axes: 'taps', scythe: 'pulse' };
export const BASE = { P: 55, G: 125, blockP: 60, blockG: 140, bigK: 0.7, aimP: 22, aimG: 50, tapsP: 10, tapsG: 6, tapsMs: 1500 };
const DIFF_WINDOW = { squire: 1.6, knight: 1, legend: 0.7 };
export const windowFor = (d) => DIFF_WINDOW[d] || 1;
// every command gives a child time to look: the first beat's Good window opens no sooner than this after it shows,
// on every difficulty (wider windows open earlier, so their lead-in grows to match)
export const LEAD_MS = 600;
const DEFAULT_MIX = { perfect: 0.25, good: 0.5 };

const STR = L({
  en: {
    perfect: 'PERFECT!', good: 'GOOD', weak: 'WEAK', fizzle: 'FIZZLE!', early: 'TOO EARLY', late: 'TOO LATE',
    bPerfect: 'PERFECT BLOCK!', bGood: 'BLOCKED', bMiss: 'MISSED',
    sweep: 'Tap as the blade crosses the mark', double: 'Tap as each ring meets its mark', charge: 'Hold, then let go in the bright band',
    aim: 'Tap when the sight is on the weak point', taps: 'Tap as fast as you can!', pulse: 'Tap as each pulse meets the ring. Twice!',
    block: 'Tap as the ring meets the mark', bigBlock: 'Big attack! Tap right on the mark',
    key: 'Space', hold: 'HOLD', tap: 'TAP!', go: 'GO!',
  },
  da: {
    perfect: 'PERFEKT!', good: 'GODT', weak: 'SVAGT', fizzle: 'FUSEDE!', early: 'FOR TIDLIGT', late: 'FOR SENT',
    bPerfect: 'PERFEKT BLOKERING!', bGood: 'BLOKERET', bMiss: 'FORBI',
    sweep: 'Tryk, når klingen rammer mærket', double: 'Tryk, når hver ring rammer sit mærke', charge: 'Hold nede, og slip i det lyse felt',
    aim: 'Tryk, når sigtet er over det svage punkt', taps: 'Tryk så hurtigt du kan!', pulse: 'Tryk, når pulsen rammer ringen. To gange!',
    block: 'Tryk, når ringen rammer mærket', bigBlock: 'Stort angreb! Tryk lige på mærket',
    key: 'Mellemrum', hold: 'HOLD', tap: 'TRYK!', go: 'NU!',
  },
});

const TAU = Math.PI * 2;
const speed = () => (typeof window !== 'undefined' && window.__LF_SPEED > 0 ? window.__LF_SPEED : 1);
const clamp01 = (k) => (k < 0 ? 0 : k > 1 ? 1 : k);
const easeOut = (k) => 1 - Math.pow(1 - clamp01(k), 3);
const RANK = { weak: 0, miss: 0, good: 1, perfect: 2 };
const worse = (a, b) => (RANK[a] <= RANK[b] ? a : b);

function rnd(rng) {
  if (rng?.next) return rng.next();
  if (rng?.float) return rng.float();
  if (rng?.int) return rng.int(0, 9999) / 10000;
  return Math.random();
}

export function autoGrade(rng, mix = DEFAULT_MIX, block = false) {
  const r = rnd(rng);
  const g = r < mix.perfect ? 'perfect' : r < mix.perfect + mix.good ? 'good' : 'weak';
  return block && g === 'weak' ? 'miss' : g;
}

const gradeErr = (err, P, G) => { const a = Math.abs(err); return a <= P ? 'perfect' : a <= G ? 'good' : 'weak'; };

// ---------- drawing helpers ----------
function ring(g, x, y, r, color, w = 4, a = 1, blur = 14) {
  g.save(); g.globalAlpha = a; g.strokeStyle = color; g.lineWidth = w; g.shadowColor = color; g.shadowBlur = blur;
  g.beginPath(); g.arc(x, y, Math.max(0.5, r), 0, TAU); g.stroke(); g.restore();
}
function arc(g, x, y, r, a0, a1, color, w, a = 1, blur = 12) {
  g.save(); g.globalAlpha = a; g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'round'; g.shadowColor = color; g.shadowBlur = blur;
  g.beginPath(); g.arc(x, y, r, a0, a1, a1 < a0); g.stroke(); g.restore();
}
function dot(g, x, y, r, color, a = 1, blur = 18) {
  g.save(); g.globalAlpha = a; g.fillStyle = color; g.shadowColor = color; g.shadowBlur = blur;
  g.beginPath(); g.arc(x, y, Math.max(0.5, r), 0, TAU); g.fill(); g.restore();
}
function diamond(g, x, y, s, color, a = 1, fill = true) {
  g.save(); g.globalAlpha = a; g.translate(x, y); g.rotate(Math.PI / 4);
  g.shadowColor = color; g.shadowBlur = 16;
  if (fill) { g.fillStyle = color; g.fillRect(-s / 2, -s / 2, s, s); } else { g.strokeStyle = color; g.lineWidth = 3; g.strokeRect(-s / 2, -s / 2, s, s); }
  g.restore();
}
function disc(g, x, y, r, a = 0.55) {
  const gr = g.createRadialGradient(x, y, r * 0.2, x, y, r);
  gr.addColorStop(0, `rgba(4,6,12,${a})`); gr.addColorStop(1, 'rgba(4,6,12,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}

const WHITE = '#fff8ec', GHOST = '#6dffb0', EMBER = '#ff7a2e', STEEL = '#c9d3e0', RED = '#ff4a3d', GOLD = '#ffd36b';

// ---------- the command definitions ----------
// each returns { total, beats?, draw(g, t, s), press(t), release?(t), done(t) -> grade|null, result(), ghost(grade) -> [{ at, kind }] }
function makeSweep(o) {
  const win = o.win, P = BASE.P * win, G = BASE.G * win;
  const dir = o.rng01() < 0.5 ? 1 : -1;
  const dur = 640 + o.rng01() * 120, markK = 0.62 + o.rng01() * 0.16;
  const pre = Math.max(320, LEAD_MS + G - dur * markK);
  const R = 132, a0 = dir > 0 ? -Math.PI * 0.95 : -Math.PI * 0.05, span = Math.PI * 0.9 * dir;
  const tMark = pre + dur * markK;
  let tap = null, grade = null;
  const angAt = (t) => a0 + span * clamp01((t - pre) / dur);
  const markA = a0 + span * markK;
  return {
    total: pre + dur + 260, hint: 'sweep', beats: 1,
    press(t) { if (tap != null) return null; tap = t; grade = t < tMark - G ? 'weak' : gradeErr(t - tMark, P, G); return { grade, early: t < tMark - G, at: o.at }; },
    done(t) { if (grade) return grade; if (t > tMark + G + 40) { grade = 'weak'; return grade; } return null; },
    ghost(gr) { return [{ at: tMark + (gr === 'perfect' ? 8 : gr === 'good' ? (P + G) / 2 : G + 50) }]; },
    grades() { return [grade || 'weak']; },
    draw(g, t, s) {
      const { x, y } = o.at;
      const fade = easeOut(t / 220) * (1 - clamp01((t - (s.endT ?? 1e9)) / 220));
      disc(g, x, y, R + 80, 0.7 * fade);
      // the arc track: a steel groove, the Good zone in the element colour, the Perfect core white, the mark a bright notch
      arc(g, x, y, R, a0, a0 + span, 'rgba(8,10,16,0.85)', 20, fade, 0);
      arc(g, x, y, R, a0, a0 + span, 'rgba(201,211,224,0.55)', 12, fade, 0);
      const gA = (G / dur) * Math.abs(span), pA = (P / dur) * Math.abs(span);
      arc(g, x, y, R, markA - gA, markA + gA, o.color, 14, 0.9 * fade, 14);
      arc(g, x, y, R, markA - pA, markA + pA, WHITE, 16, fade, 22);
      const cx = Math.cos(markA), cy = Math.sin(markA);
      g.save(); g.globalAlpha = fade; g.strokeStyle = WHITE; g.lineWidth = 5; g.lineCap = 'round'; g.shadowColor = o.color; g.shadowBlur = 20;
      g.beginPath(); g.moveTo(x + cx * (R - 26), y + cy * (R - 26)); g.lineTo(x + cx * (R + 26), y + cy * (R + 26)); g.stroke(); g.restore();
      diamond(g, x + cx * (R + 44), y + cy * (R + 44), 16, WHITE, fade);
      // anticipation: the blade gathers light at the start, then sweeps with a trail
      const ang = angAt(tap ?? t);
      if (t < pre) {
        const k = t / pre;
        const sx = x + Math.cos(a0) * R, sy = y + Math.sin(a0) * R;
        dot(g, sx, sy, 6 + k * 10, o.color, 0.5 + k * 0.5, 10 + k * 30);
        for (let i = 0; i < 5; i++) { const aa = i / 5 * TAU + k * 4; dot(g, sx + Math.cos(aa) * (40 - k * 36), sy + Math.sin(aa) * (40 - k * 36), 2.5, WHITE, k); }
      } else {
        const trail = 0.5 * Math.sign(span);
        for (let i = 8; i >= 0; i--) {
          const aa = ang - trail * (i / 8);
          if ((span > 0 && aa < a0) || (span < 0 && aa > a0)) continue;
          blade(g, x, y, aa, R, o.color, (1 - i / 9) * 0.5 * fade, 6);
        }
        blade(g, x, y, ang, R, WHITE, fade, 4);
      }
    },
  };
}
function blade(g, x, y, ang, R, color, a, w) {
  g.save(); g.globalAlpha = a; g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'round'; g.shadowColor = color; g.shadowBlur = 22;
  g.beginPath(); g.moveTo(x + Math.cos(ang) * (R - 46), y + Math.sin(ang) * (R - 46)); g.lineTo(x + Math.cos(ang) * (R + 26), y + Math.sin(ang) * (R + 26)); g.stroke(); g.restore();
}

// two (or more) closing rings, tapped one after the other; used by Double strike and, with one ring, by Block
function makeRings(o, { n = 2, block = false, big = false } = {}) {
  const win = o.win * (block && big ? BASE.bigK : 1);
  const P = (block ? BASE.blockP : BASE.P) * win, G = (block ? BASE.blockG : BASE.G) * win;
  const close = block ? (big ? 1150 : 660) : 540;
  const pre = Math.max(block ? 60 + o.rng01() * 180 : 140, LEAD_MS + G - close);
  const gap = 360 + o.rng01() * 120;
  const R0 = block ? (big ? 190 : 150) : 112, R1 = block ? 54 : 30;
  const spots = block ? [{ dx: 0, dy: 0 }] : [{ dx: -46, dy: -26 }, { dx: 44, dy: 30 }];
  const beats = Array.from({ length: n }, (_, i) => ({ tMark: pre + close + i * gap, t0: pre + i * gap, grade: null, tap: null, spot: spots[i % spots.length] }));
  let cur = 0;
  const failGrade = block ? 'miss' : 'weak';
  return {
    total: beats[n - 1].tMark + G + 300, hint: block ? (big ? 'bigBlock' : 'block') : 'double', beats: n,
    press(t) {
      if (cur >= n) return null;
      const b = beats[cur];
      b.tap = t;
      const early = t < b.tMark - G;
      b.grade = early ? failGrade : gradeErr(t - b.tMark, P, G);
      if (block && b.grade === 'weak') b.grade = 'miss';
      cur++;
      return { grade: b.grade, early, at: { x: o.at.x + b.spot.dx, y: o.at.y + b.spot.dy } };
    },
    done(t) {
      while (cur < n && t > beats[cur].tMark + G + 30) { beats[cur].grade = failGrade; beats[cur].late = true; cur++; }
      return cur >= n ? beats.map((b) => b.grade).reduce(worse) : null;
    },
    ghost(gr) {
      const errFor = (g2) => (g2 === 'perfect' ? 6 : g2 === 'good' ? (P + G) / 2 : G + 60);
      const per = n === 1 ? [gr] : gr === 'perfect' ? ['perfect', 'perfect'] : gr === 'good' ? ['perfect', 'good'] : ['good', 'weak'];
      return beats.map((b, i) => ({ at: b.tMark + errFor(per[i] === 'miss' ? 'weak' : per[i]) }));
    },
    grades() { return beats.map((b) => b.grade || failGrade); },
    lateBeat() { return beats.find((b) => b.late); },
    draw(g, t, s) {
      const fade = easeOut(t / 200) * (1 - clamp01((t - (s.endT ?? 1e9)) / 220));
      const main = block ? (big ? RED : '#ff8a5a') : o.color;
      disc(g, o.at.x, o.at.y, R0 + 50, (block ? 0.4 : 0.5) * fade);
      beats.forEach((b, i) => {
        const x = o.at.x + b.spot.dx, y = o.at.y + b.spot.dy;
        const show = clamp01((t - b.t0 + 160) / 160) * fade;
        if (show <= 0) return;
        const done = b.grade != null;
        // the mark: a solid ring with its good band
        const band = ((G / close) * (R0 - R1));
        ring(g, x, y, R1, done ? (b.grade === 'perfect' ? WHITE : b.grade === 'good' ? main : '#7a7f8c') : WHITE, 4, show);
        ring(g, x, y, R1 + band, main, 2, 0.35 * show, 0);
        ring(g, x, y, Math.max(2, R1 - band), main, 2, 0.35 * show, 0);
        if (!done) {
          const k = clamp01((t - b.t0) / close);
          const r = R0 - (R0 - R1) * k;
          const near = 1 - Math.min(1, Math.abs(r - R1) / 40);
          ring(g, x, y, r, main, 5 + near * 3, show * (0.55 + 0.45 * k), 16 + near * 20);
          if (block) for (let q = 0; q < 4; q++) { const aa = q * TAU / 4 + t / 400; const rx = x + Math.cos(aa) * r, ry = y + Math.sin(aa) * r; diamond(g, rx, ry, 10, main, show); }
          if (!block) dot(g, x, y, 5 + near * 4, WHITE, show * (0.4 + near * 0.6));
          if (n > 1) label(g, x, y + R1 + 26, String(i + 1), show * 0.9);
        }
      });
    },
  };
}
function label(g, x, y, text, a, size = 22, color = WHITE) {
  g.save(); g.globalAlpha = a; g.fillStyle = color; g.font = `700 ${size}px Cinzel, Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,0.9)'; g.shadowBlur = 6; g.fillText(text, x, y); g.restore();
}

function makeCharge(o) {
  const win = o.win, P = BASE.P * win, G = BASE.G * win;
  const fill = 1000, centre = 780, over = 1120, waitMax = 1400;
  const R = 92;
  let pressT = null, relT = null, grade = null, fizzle = false;
  const level = (t) => (pressT == null ? 0 : ((relT ?? t) - pressT) / fill);
  return {
    total: waitMax + over + 300, hint: 'charge', beats: 1, hold: true,
    press(t) { if (pressT != null || grade) return null; pressT = t; return { held: true }; },
    release(t) {
      if (pressT == null || relT != null) return null;
      relT = t;
      const held = t - pressT;
      grade = held < centre - G ? 'weak' : gradeErr(held - centre, P, G);
      return { grade, early: held < centre - G, at: o.at };
    },
    done(t) {
      if (grade) return grade;
      if (pressT == null && t > waitMax) { grade = 'weak'; return grade; }
      if (pressT != null && relT == null && t - pressT > over) { relT = t; fizzle = true; grade = 'weak'; return grade; }
      return null;
    },
    fizzled: () => fizzle,
    ghost(gr) { const s0 = 160; const err = gr === 'perfect' ? 10 : gr === 'good' ? (P + G) / 2 : -(G + 80); return [{ at: s0, kind: 'down' }, { at: s0 + centre + err, kind: 'up' }]; },
    grades() { return [grade || 'weak']; },
    draw(g, t, s) {
      const { x, y } = o.at;
      const fade = easeOut(t / 200) * (1 - clamp01((t - (s.endT ?? 1e9)) / 240));
      disc(g, x, y, R + 70, 0.55 * fade);
      const top = -Math.PI / 2;
      const aOf = (k) => top + TAU * k;
      // track, the bright band (Good) and its white core (Perfect)
      arc(g, x, y, R, 0, TAU, 'rgba(201,211,224,0.25)', 14, fade, 0);
      arc(g, x, y, R, aOf((centre - G) / fill), aOf((centre + G) / fill), o.color, 16, 0.75 * fade, 14);
      arc(g, x, y, R, aOf((centre - P) / fill), aOf((centre + P) / fill), WHITE, 18, fade, 20);
      const k = Math.min(level(t), over / fill);
      const inBand = Math.abs(k * fill - centre) <= G;
      if (k > 0) {
        arc(g, x, y, R, top, aOf(Math.min(1, k)), k > 1 ? '#9aa3b4' : inBand ? WHITE : o.color, 10, fade, inBand ? 26 : 12);
        // crackle that grows with the charge
        const n = Math.floor(3 + k * 9);
        for (let i = 0; i < n; i++) {
          const aa = Math.random() * TAU, r1 = R * (0.2 + Math.random() * 0.5);
          g.save(); g.globalAlpha = fade * (0.3 + k * 0.6); g.strokeStyle = i % 3 ? o.color : WHITE; g.lineWidth = 2; g.shadowColor = o.color; g.shadowBlur = 10;
          g.beginPath(); g.moveTo(x, y);
          g.lineTo(x + Math.cos(aa) * r1 * 0.5 + (Math.random() - 0.5) * 14, y + Math.sin(aa) * r1 * 0.5 + (Math.random() - 0.5) * 14);
          g.lineTo(x + Math.cos(aa) * r1, y + Math.sin(aa) * r1); g.stroke(); g.restore();
        }
      }
      const orb = 14 + Math.min(1, k) * 26;
      dot(g, x, y, orb, fizzle ? '#7a7f8c' : o.color, fade * 0.85, 30 + k * 30);
      dot(g, x, y, orb * 0.45, WHITE, fade);
      if (pressT == null && !grade) label(g, x, y + R + 36, STR.hold, fade * (0.6 + 0.4 * Math.sin(t / 110)), 24, GOLD);
    },
  };
}

function makeAim(o) {
  const win = o.win, P = BASE.aimP * win, G = BASE.aimG * win;
  const period = 1650 + o.rng01() * 250;
  const A = 104, B = 26, phase = o.rng01() < 0.5 ? 0 : Math.PI;
  // the sight first crosses the weak point a quarter period in; G (px) at its speed there is the time window
  const pre = Math.max(260, LEAD_MS + G / (A * TAU / period) - period / 4), total = pre + period * 1.18;
  const wp = { x: o.at.x + (o.rng01() - 0.5) * 30, y: o.at.y - 10 + (o.rng01() - 0.5) * 30 };
  const w = TAU / period;
  const pos = (t) => { const a = w * Math.max(0, t - pre) + phase + Math.PI / 2; return { x: wp.x + A * Math.sin(a), y: wp.y + B * Math.sin(2 * a) }; };
  let tap = null, grade = null, dist = null;
  return {
    total: total + 260, hint: 'aim', beats: 1,
    press(t) {
      if (tap != null) return null;
      tap = t;
      const p = pos(t); dist = Math.hypot(p.x - wp.x, p.y - wp.y);
      grade = dist <= P ? 'perfect' : dist <= G ? 'good' : 'weak';
      return { grade, at: p };
    },
    done(t) { if (grade) return grade; if (t > total) { grade = 'weak'; return grade; } return null; },
    ghost(gr) {
      // the first crossing: a(t) = pi (mod pi) -> t = pre + (pi/2 - phase mod) / w; offset by distance / speed
      let a = Math.PI - (phase + Math.PI / 2); while (a < 0.2) a += Math.PI;
      const tc = pre + a / w;
      const v = A * w;
      const d = gr === 'perfect' ? P * 0.3 : gr === 'good' ? (P + G) / 2 : G + 30;
      return [{ at: tc + d / v }];
    },
    grades() { return [grade || 'weak']; },
    draw(g, t, s) {
      const fade = easeOut(t / 220) * (1 - clamp01((t - (s.endT ?? 1e9)) / 220));
      disc(g, wp.x, wp.y, 190, 0.4 * fade);
      // the weak point: a hot diamond with the Perfect and Good rings
      const pulse = 0.5 + 0.5 * Math.sin(t / 90);
      ring(g, wp.x, wp.y, G, '#ffb347', 2, 0.35 * fade, 0);
      ring(g, wp.x, wp.y, P, WHITE, 2.5, (0.5 + pulse * 0.3) * fade, 10);
      diamond(g, wp.x, wp.y, 12 + pulse * 3, '#ff9a3a', fade);
      // the reticle (it zooms in as the anticipation beat)
      const p = pos(tap ?? t);
      const zoom = 1 + 1.4 * (1 - easeOut(t / pre));
      const near = Math.hypot(p.x - wp.x, p.y - wp.y) <= G;
      const col = near ? WHITE : STEEL;
      g.save(); g.translate(p.x, p.y); g.scale(zoom, zoom);
      g.globalAlpha = fade; g.strokeStyle = col; g.lineWidth = 3; g.shadowColor = near ? '#ffb347' : '#8fb7ff'; g.shadowBlur = near ? 20 : 8;
      g.beginPath(); g.arc(0, 0, 30, 0, TAU); g.stroke();
      g.beginPath(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { g.moveTo(dx * 16, dy * 16); g.lineTo(dx * 44, dy * 44); } g.stroke();
      g.fillStyle = col; g.beginPath(); g.arc(0, 0, 3, 0, TAU); g.fill();
      g.restore();
    },
  };
}

function makeTaps(o) {
  const k = Math.sqrt(o.win);
  const needP = Math.max(4, Math.round(BASE.tapsP / k)), needG = Math.max(2, Math.round(BASE.tapsG / k));
  const dur = BASE.tapsMs, waitMax = 750;
  let t0 = null, count = 0, grade = null;
  const taps = [];
  const H = 190, W = 34;
  return {
    total: waitMax + dur + 300, hint: 'taps', beats: 1, multi: true,
    press(t) {
      if (grade) return null;
      if (t0 == null) t0 = t;
      if (t - t0 > dur) return null;
      count++; taps.push(t);
      return { tick: true, n: count, hot: count >= needP, at: o.at };
    },
    done(t) {
      if (grade) return grade;
      if (t0 == null && t > waitMax) t0 = waitMax;
      if (t0 != null && t - t0 > dur) { grade = count >= needP ? 'perfect' : count >= needG ? 'good' : 'weak'; return grade; }
      return null;
    },
    ghost(gr) {
      const n = gr === 'perfect' ? needP + 1 : gr === 'good' ? needG + 1 : Math.max(1, needG - 2);
      return Array.from({ length: n }, (_, i) => ({ at: 120 + i * ((dur - 120) / (n + 0.5)) }));
    },
    grades() { return [grade || 'weak']; },
    count: () => count,
    draw(g, t, s) {
      const fade = easeOut(t / 200) * (1 - clamp01((t - (s.endT ?? 1e9)) / 220));
      const x = o.at.x + 150, y = o.at.y + 20;
      disc(g, o.at.x + 70, o.at.y, 230, 0.45 * fade);
      const fillK = Math.min(1, count / (needP + 1));
      // the meter: dark tube, Good and Perfect marks, a fill that heats from ember to white
      g.save(); g.globalAlpha = fade;
      g.fillStyle = 'rgba(10,12,20,0.85)'; g.strokeStyle = 'rgba(201,211,224,0.7)'; g.lineWidth = 2;
      roundRect(g, x - W / 2, y - H / 2, W, H, 12); g.fill(); g.stroke();
      const fy = y + H / 2 - H * fillK;
      const gr = g.createLinearGradient(0, y + H / 2, 0, y - H / 2);
      gr.addColorStop(0, '#ff5a1e'); gr.addColorStop(0.6, '#ffb03a'); gr.addColorStop(1, WHITE);
      g.fillStyle = gr; g.shadowColor = count >= needP ? WHITE : EMBER; g.shadowBlur = 10 + fillK * 26;
      roundRect(g, x - W / 2 + 5, fy, W - 10, Math.max(0, y + H / 2 - fy - 5), 8); g.fill();
      g.shadowBlur = 0;
      for (const [need, col] of [[needG, EMBER], [needP, WHITE]]) {
        const my = y + H / 2 - H * (need / (needP + 1));
        g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.moveTo(x - W / 2 - 8, my); g.lineTo(x + W / 2 + 8, my); g.stroke();
      }
      g.restore();
      // the time ring around the axe glyph
      const left = t0 == null ? 1 : 1 - clamp01((t - t0) / dur);
      arc(g, o.at.x, o.at.y, 70, -Math.PI / 2, -Math.PI / 2 + TAU * left, count >= needP ? WHITE : EMBER, 8, fade, 14);
      ring(g, o.at.x, o.at.y, 70, 'rgba(201,211,224,0.2)', 8, fade, 0);
      label(g, o.at.x, o.at.y + 2, String(count), fade, 46, count >= needP ? WHITE : GOLD);
      if (t0 == null) label(g, o.at.x, o.at.y + 104, STR.tap, fade * (0.6 + 0.4 * Math.sin(t / 80)), 26, GOLD);
      // sparks from recent taps
      for (const tt of taps) {
        const age = t - tt; if (age > 260) continue;
        const kk = age / 260;
        for (let i = 0; i < 4; i++) { const aa = (tt * 7 + i * 1.7) % TAU; dot(g, o.at.x + Math.cos(aa) * (40 + kk * 60), o.at.y + Math.sin(aa) * (40 + kk * 60), 3 * (1 - kk), i % 2 ? WHITE : EMBER, fade * (1 - kk)); }
      }
    },
  };
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

function makePulse(o) {
  const win = o.win, P = BASE.P * win, G = BASE.G * win;
  const R = 96, grow = 620, gap = 460 + o.rng01() * 80;
  const pre = Math.max(400, LEAD_MS + G - grow);
  const beats = [0, 1].map((i) => ({ t0: pre + i * gap, tMark: pre + grow + i * gap, grade: null }));
  let cur = 0;
  return {
    total: beats[1].tMark + G + 320, hint: 'pulse', beats: 2,
    press(t) {
      if (cur >= 2) return null;
      const b = beats[cur];
      b.grade = t < b.tMark - G ? 'weak' : gradeErr(t - b.tMark, P, G);
      cur++;
      return { grade: b.grade, early: t < b.tMark - G, at: o.at };
    },
    done(t) {
      while (cur < 2 && t > beats[cur].tMark + G + 30) { beats[cur].grade = 'weak'; cur++; }
      if (cur < 2) return null;
      const sc = beats.reduce((n, b) => n + RANK[b.grade], 0);
      return sc === 4 ? 'perfect' : sc >= 2 ? 'good' : 'weak';
    },
    ghost(gr) {
      const per = gr === 'perfect' ? ['perfect', 'perfect'] : gr === 'good' ? ['good', 'perfect'] : ['weak', 'good'];
      return beats.map((b, i) => ({ at: b.tMark + (per[i] === 'perfect' ? 6 : per[i] === 'good' ? (P + G) / 2 : G + 60) }));
    },
    grades() { return beats.map((b) => b.grade || 'weak'); },
    draw(g, t, s) {
      const { x, y } = o.at;
      const fade = easeOut(t / 200) * (1 - clamp01((t - (s.endT ?? 1e9)) / 220));
      disc(g, x, y, R + 70, 0.5 * fade);
      const band = (G / grow) * R;
      ring(g, x, y, R, WHITE, 4, fade);
      ring(g, x, y, R + band, GHOST, 2, 0.3 * fade, 0); ring(g, x, y, R - band, GHOST, 2, 0.3 * fade, 0);
      // the lantern
      const lit = beats.filter((b) => b.grade && b.grade !== 'weak').length;
      dot(g, x, y, 16 + lit * 4, GHOST, fade, 34);
      dot(g, x, y, 7, WHITE, fade);
      beats.forEach((b, i) => {
        if (b.grade) return;
        const k = (t - b.t0) / grow;
        if (k < 0) {
          // the next beat's tick on the ring, so the rhythm reads
          const pre2 = clamp01(1 + k * 2);
          diamond(g, x, y - R - 22, 10, GHOST, pre2 * fade * 0.7, false);
          return;
        }
        const r = R * k;
        const near = 1 - Math.min(1, Math.abs(r - R) / 34);
        g.save(); g.globalAlpha = fade * Math.max(0, 1 - Math.max(0, k - 1) * 4) * 0.25;
        const grd = g.createRadialGradient(x, y, 0, x, y, Math.max(1, r)); grd.addColorStop(0, 'rgba(109,255,176,0)'); grd.addColorStop(1, 'rgba(109,255,176,0.9)');
        g.fillStyle = grd; g.beginPath(); g.arc(x, y, Math.max(1, r), 0, TAU); g.fill(); g.restore();
        ring(g, x, y, r, near > 0.6 ? WHITE : GHOST, 4 + near * 4, fade * Math.max(0, 1 - Math.max(0, k - 1) * 4), 14 + near * 22);
        label(g, x, y + R + 30, String(i + 1), fade * 0.8, 20, GHOST);
      });
    },
  };
}

const MAKERS = { sweep: makeSweep, double: (o) => makeRings(o, { n: 2 }), charge: makeCharge, aim: makeAim, taps: makeTaps, pulse: makePulse };

// ---------- the runner ----------
let cssDone = false;
function ensureCss() {
  if (cssDone || typeof document === 'undefined') return;
  cssDone = true;
  const href = new URL('../../css/gs-battle.css', import.meta.url).href;
  if (document.querySelector('link[data-gs-battle-css]') || [...document.querySelectorAll('link[rel="stylesheet"]')].some((l) => l.href === href)) return;
  const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href });
  link.dataset.gsBattleCss = '1';
  document.head.appendChild(link);
}

export async function runCommand(kind, opts = {}, ctx) {
  ensureCss();
  const block = kind === 'block';
  const id = block ? 'block' : (COMMAND_OF[kind] || kind);
  if (!block && !MAKERS[id]) throw new Error('Unknown command ' + kind);
  const sleep = (ms) => (ctx?.sleep ? ctx.sleep(ms) : new Promise((r) => setTimeout(r, ms / speed())));
  const sfx = (n, o) => { try { ctx?.audio?.sfx(n, o); } catch { /* silent */ } };
  const win = Math.max(0.35, Math.min(2.6, opts.window ?? windowFor(opts.difficulty)));
  const rng = opts.rng || ctx?.auto?.rng || ctx?.rng;
  const auto = opts.auto ?? !!ctx?.auto;
  const rng01 = () => rnd(opts.visualRng || null);
  const o = { at: opts.at || { x: 900, y: 380 }, win, color: opts.color || EMBER, rng01 };
  const cmd = block ? makeRings(o, { n: 1, block: true, big: !!opts.big }) : MAKERS[id](o);
  // opts.grade: a grade decided by the caller (the battle passes the rules' seeded autoGrade in autoplay)
  const forced = opts.grade || (auto ? autoGrade(rng, opts.mix || DEFAULT_MIX, block) : null);

  // DOM: a stage-sized layer that owns all input while the command runs
  const host = opts.host || ctx?.stage?.layers?.screen || document.body;
  const root = document.createElement('div');
  root.className = `gsc-root gsc-${id}${block ? (opts.big ? ' is-big' : '') : ''}`;
  root.dataset.noAdvance = '1';
  const cvs = document.createElement('canvas');
  cvs.className = 'gsc-canvas';
  root.appendChild(cvs);
  const hint = document.createElement('div');
  hint.className = 'gsc-hint';
  if (opts.hint !== false) {
    hint.innerHTML = '';
    hint.append(document.createTextNode(STR[cmd.hint]));
    const kh = keyHint(STR.key); if (kh) hint.append(kh); // no key name after a touch
    root.appendChild(hint);
  }
  host.appendChild(root);
  const pr = Math.min(2, ctx?.stage?.pixelRatio?.() || window.devicePixelRatio || 1);
  cvs.width = 1280 * pr; cvs.height = 800 * pr;
  const g = cvs.getContext('2d');
  g.setTransform(pr, 0, 0, pr, 0, 0);

  // clock in game ms
  const tStart = performance.now();
  let frozenAt = null, frozenFor = 0;
  // opts.still (ms): hold the command at that game time (bench screenshots); it ends after opts.stillMs real ms
  const still = opts.still ?? null;
  const gameT = (stamp = performance.now()) => (still != null ? still : ((frozenAt != null ? frozenAt : stamp) - tStart - frozenFor) * speed());
  const s = { endT: null };
  window.__GSC = { id, cmd, tStart, win }; // test handle: cmd.ghost(grade) gives the press times for a grade
  let finished = null;
  let resolveDone;
  const doneP = new Promise((r) => { resolveDone = r; });

  const popText = (text, at, cls) => {
    const el = document.createElement('div');
    el.className = `gsc-pop ${cls}`;
    el.textContent = text;
    el.style.left = Math.round(at.x) + 'px'; el.style.top = Math.round(at.y) + 'px';
    root.appendChild(el);
    const w = el.offsetWidth || 0;
    if (w) el.style.left = Math.round(Math.max(w / 2 + 10, Math.min(1270 - w / 2, at.x))) + 'px';
    setTimeout(() => el.remove(), 900 / speed());
  };
  const beatFx = (r) => {
    if (!r) return;
    if (r.held) { sfx('gs.charge'); root.classList.add('is-holding'); return; }
    if (r.tick) { sfx('gs.hit', { volume: 0.35 + Math.min(0.4, r.n * 0.03), rate: 0.9 + Math.min(0.6, r.n * 0.05) }); root.classList.remove('is-tick'); void root.offsetWidth; root.classList.add('is-tick'); return; }
    const gr = r.grade;
    if (cmd.beats > 1) {
      sfx(gr === 'perfect' ? 'gs.perfect' : gr === 'good' ? 'gs.good' : 'gs.weak', { volume: 0.55 });
      popText(r.early ? STR.early : (block ? { perfect: STR.bPerfect, good: STR.bGood, miss: STR.bMiss } : STR)[gr], r.at, `is-${gr} is-small`);
    }
    if (id === 'sweep') sfx('gs.swing');
    if (id === 'charge') sfx('gs.release');
  };

  const onPress = (stamp) => {
    if (finished || forced) return;
    const t = gameT(stamp);
    beatFx(cmd.press(t));
    check();
  };
  const onRelease = (stamp) => {
    if (finished || forced || !cmd.release) return;
    root.classList.remove('is-holding');
    beatFx(cmd.release(gameT(stamp)));
    check();
  };
  const pd = (e) => { e.preventDefault(); e.stopPropagation(); onPress(e.timeStamp || performance.now()); };
  const pu = (e) => { e.preventDefault(); e.stopPropagation(); onRelease(e.timeStamp || performance.now()); };
  const stopClick = (e) => { e.stopPropagation(); };
  const kd = (e) => {
    if (e.key !== ' ' && e.key !== 'Enter' && e.code !== 'Space') return;
    e.preventDefault(); e.stopPropagation();
    if (e.repeat) return;
    onPress(e.timeStamp || performance.now());
  };
  const ku = (e) => { if (e.key !== ' ' && e.key !== 'Enter' && e.code !== 'Space') return; e.preventDefault(); e.stopPropagation(); onRelease(e.timeStamp || performance.now()); };
  root.addEventListener('pointerdown', pd);
  root.addEventListener('pointerup', pu);
  root.addEventListener('pointercancel', pu);
  root.addEventListener('click', stopClick);
  window.addEventListener('keydown', kd, true);
  window.addEventListener('keyup', ku, true);

  if (still != null && opts.stillPress) {
    opts.stillPress.forEach((t, i) => { if (cmd.hold && i % 2 === 1) cmd.release(t); else beatFx(cmd.press(t)); });
  }
  // autoplay: the command plays itself with ghost presses that land on the seeded grade
  const ghostTimers = [];
  if (forced && still == null) {
    for (const gp of cmd.ghost(forced)) {
      ghostTimers.push(setTimeout(() => {
        if (finished) return;
        const t = gp.at;
        if (gp.kind === 'up') { root.classList.remove('is-holding'); beatFx(cmd.release?.(t)); }
        else beatFx(cmd.press(t));
        check();
      }, Math.max(0, gp.at) / speed()));
    }
  }

  function check() {
    if (finished || still != null) return;
    const t = gameT();
    let gr = cmd.done(t);
    if (!gr) return;
    if (forced) gr = forced;
    finished = gr;
    s.endT = t + (gr === 'perfect' ? 120 : 40);
    finale(gr);
  }

  async function finale(gr) {
    const at = o.at;
    const late = cmd.lateBeat?.();
    let text = block ? { perfect: STR.bPerfect, good: STR.bGood, miss: STR.bMiss }[gr] : STR[gr];
    if (!block && cmd.fizzled?.()) text = STR.fizzle;
    if (block && gr === 'miss' && late) text = STR.late;
    root.classList.add(`is-done`, `is-${gr}`);
    if (gr === 'perfect') {
      // hit-stop: the clock freezes for a beat, the stage flashes, then everything snaps on
      frozenAt = performance.now();
      sfx(block ? 'gs.block.perfect' : 'gs.perfect');
      root.classList.add('is-flash');
      await new Promise((r) => setTimeout(r, 90 / speed()));
      frozenFor += performance.now() - frozenAt; frozenAt = null;
    } else if (gr === 'good') sfx(block ? 'gs.block' : 'gs.good');
    else sfx(block ? 'gs.hit' : 'gs.weak');
    popText(text, { x: at.x, y: at.y + (id === 'taps' ? -110 : 0) }, `is-${gr}`);
    await new Promise((r) => setTimeout(r, (gr === 'perfect' ? 300 : 200) / speed()));
    resolveDone();
  }

  // frame loop (drawing only; the logic also runs from a timer so a hidden tab can never hang)
  let alive = true;
  const frame = () => {
    if (!alive) return;
    const t = gameT();
    g.clearRect(0, 0, 1280, 800);
    g.globalCompositeOperation = 'lighter';
    g.globalCompositeOperation = 'source-over';
    cmd.draw(g, t, s);
    check();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  const guard = setInterval(check, 50);
  const hardStop = setTimeout(() => { if (!finished) { finished = forced || (block ? 'miss' : 'weak'); resolveDone(); } }, still != null ? (opts.stillMs || 8000) : (cmd.total + 1500) / speed());

  try {
    await Promise.race([doneP, still != null ? new Promise((r) => setTimeout(r, (opts.stillMs || 8000) + 100)) : sleep(cmd.total + 2500)]);
  } finally {
    alive = false;
    if (window.__GSC?.cmd === cmd) delete window.__GSC;
    clearInterval(guard); clearTimeout(hardStop); ghostTimers.forEach(clearTimeout);
    window.removeEventListener('keydown', kd, true);
    window.removeEventListener('keyup', ku, true);
    root.classList.add('is-out');
    setTimeout(() => root.remove(), 260 / speed());
  }
  const grade = finished || (block ? 'miss' : 'weak');
  let grades = cmd.grades();
  if (forced) grades = grades.map(() => forced);
  return { grade, grades, kind: id, ms: Math.round(gameT()) };
}
