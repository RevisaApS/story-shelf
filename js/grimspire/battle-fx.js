// Grimspire battle effects on one stage-sized canvas (GRIMSPIRE 5.7). Element-coloured, punchy, short.
//
// createGsFx(canvas, { pixelRatio, reduce }) -> {
//   play(fxId, { from, to, targets:[{x,y}], element, big }) -> Promise   resolves at the moment of impact
//   impact(at, { element, big, perfect })       the hit itself: flash ring, sparks and element particles
//   foe(kind, { from, to, targets, element, big }) -> Promise    foe moves: claw, bite, slam, breath, bolt, swarm, web
//   crumble(at, { w, h, element })              a beaten monster falls apart into dust, bones or smoke
//   summon(at), phase(at, { element }), shock(at, { color, r }), heal(at), shield(at), status(at, status)
//   freeze(ms)  hit-stop: every effect holds still for ms
//   resize(), dispose()
// }
// fx ids (heroes.js vocabulary): strike_sword strike_daggers strike_staff strike_bow strike_axes strike_scythe,
//   slash_arc fire_burst shield_glow smoke poison lightning_chain frost_lance thunder tempest arrow wolf_bite trap
//   arrow_rain heavy_slash war_cry rune_glow heal hex ward dawn blade_flurry; unknown ids fall back by element.
// Every promise uses setTimeout scaled by window.__LF_SPEED, never rAF or animationend.

const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (k) => (k < 0 ? 0 : k > 1 ? 1 : k);
const ease = (k) => 1 - Math.pow(1 - clamp(k), 3);
const easeIn = (k) => clamp(k) * clamp(k);
const speed = () => (typeof window !== 'undefined' && window.__LF_SPEED > 0 ? window.__LF_SPEED : 1);

export const ELEMENT_COLOR = {
  fire: '#ff7a2e', frost: '#8fdcff', storm: '#c9b8ff', shadow: '#a066ff', spirit: '#6dffb0', bone: '#eadfc4', none: '#fff1d6', poison: '#9dff5a',
};
const ALT = { fire: '#ffd36b', frost: '#ffffff', storm: '#ffffff', shadow: '#3a1d66', spirit: '#d8fff0', bone: '#9e927a', none: '#ffb86b', poison: '#3fbf4a' };
export const colorOf = (el) => ELEMENT_COLOR[el] || ELEMENT_COLOR.none;

export function createGsFx(canvas, { pixelRatio = () => 1, reduce = () => false } = {}) {
  const g = canvas.getContext('2d');
  const W = 1280, H = 800;
  let parts = [], anims = [], running = false, last = 0, clock = 0, disposed = false, frozenUntil = 0;
  const sprites = new Map();

  function resize() {
    const pr = Math.min(2, pixelRatio());
    canvas.width = Math.round(W * pr); canvas.height = Math.round(H * pr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    g.setTransform(pr, 0, 0, pr, 0, 0);
  }
  resize();

  function glow(color) {
    if (sprites.has(color)) return sprites.get(color);
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, color); gr.addColorStop(0.55, color + '55'); gr.addColorStop(1, color + '00');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    sprites.set(color, c);
    return c;
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms) / speed()));
  const cap = () => (reduce() ? 0.35 : 1);

  function start() { if (running || disposed) return; running = true; last = performance.now(); requestAnimationFrame(tick); }
  function tick(now) {
    if (disposed) return;
    const dt = now < frozenUntil ? 0 : Math.min(50, now - last) * speed(); last = now; clock += dt;
    g.clearRect(0, 0, W, H);
    // custom drawers
    for (let i = anims.length - 1; i >= 0; i--) {
      const a = anims[i];
      const k = (clock - a.t0) / a.dur;
      if (k >= 1) { anims.splice(i, 1); continue; }
      if (k >= 0) { g.save(); a.draw(clamp(k), g); g.restore(); }
    }
    // particles
    g.globalCompositeOperation = 'lighter';
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.t += dt;
      if (p.t >= p.life) { parts.splice(i, 1); continue; }
      const s = dt / 1000;
      p.vx *= Math.pow(p.drag, s * 60); p.vy = p.vy * Math.pow(p.drag, s * 60) + p.grav * s;
      p.x += p.vx * s; p.y += p.vy * s; p.rot += p.spin * s;
      const k = p.t / p.life, a = p.fade ? (1 - k) : Math.sin(Math.PI * k);
      const size = p.size * (p.grow ? lerp(0.6, 1.6, k) : lerp(1, 0.4, k));
      if (p.shape === 'glow') { g.globalAlpha = a; const sp = glow(p.color); g.drawImage(sp, p.x - size * 2, p.y - size * 2, size * 4, size * 4); }
      else {
        g.globalCompositeOperation = p.solid ? 'source-over' : 'lighter';
        g.globalAlpha = a; g.fillStyle = p.color; g.strokeStyle = p.color;
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
        if (p.shape === 'shard') { g.beginPath(); g.moveTo(0, -size * 1.6); g.lineTo(size * 0.5, 0); g.lineTo(0, size * 1.6); g.lineTo(-size * 0.5, 0); g.closePath(); g.fill(); }
        else if (p.shape === 'bone') { g.fillRect(-size * 1.4, -size * 0.32, size * 2.8, size * 0.64); g.beginPath(); g.arc(-size * 1.4, 0, size * 0.5, 0, TAU); g.arc(size * 1.4, 0, size * 0.5, 0, TAU); g.fill(); }
        else if (p.shape === 'line') { g.lineWidth = Math.max(1, size * 0.4); g.beginPath(); g.moveTo(-p.vx * 0.03, -p.vy * 0.03); g.lineTo(0, 0); g.stroke(); }
        else if (p.shape === 'smoke') { g.globalCompositeOperation = 'source-over'; g.globalAlpha = a * 0.55; const gr = g.createRadialGradient(0, 0, 0, 0, 0, size); gr.addColorStop(0, p.color); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, size, 0, TAU); g.fill(); }
        else { g.beginPath(); g.arc(0, 0, size, 0, TAU); g.fill(); }
        g.restore();
        g.globalCompositeOperation = 'lighter';
      }
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    if (parts.length || anims.length) requestAnimationFrame(tick); else { running = false; g.clearRect(0, 0, W, H); }
  }
  const P = (o) => { if (parts.length > 900) return; parts.push({ vx: 0, vy: 0, size: 3, life: 600, t: 0, drag: 0.94, grav: 0, rot: 0, spin: 0, shape: 'glow', fade: false, ...o }); start(); };
  const A = (dur, draw, delay = 0) => { anims.push({ t0: clock + delay, dur, draw }); start(); };

  // ---------- building blocks ----------
  function burst(at, color, n = 20, { spd = [120, 420], size = [2, 5], life = [300, 700], shape = 'glow', grav = 0, drag = 0.9, up = 0 } = {}) {
    n = Math.round(n * cap());
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = rnd(spd[0], spd[1]);
      P({ x: at.x, y: at.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - up, size: rnd(size[0], size[1]), life: rnd(life[0], life[1]), color, shape, grav, drag, spin: rnd(-10, 10), rot: a, fade: true });
    }
  }
  function ringWave(at, color, { r0 = 10, r1 = 120, w = 8, dur = 380, delay = 0 } = {}) {
    A(dur, (k, x) => {
      x.globalCompositeOperation = 'lighter'; x.globalAlpha = 1 - k; x.strokeStyle = color; x.lineWidth = w * (1 - k) + 1; x.shadowColor = color; x.shadowBlur = 20;
      x.beginPath(); x.arc(at.x, at.y, lerp(r0, r1, ease(k)), 0, TAU); x.stroke();
    }, delay);
  }
  function flash(at, color, r = 110, dur = 200) {
    A(dur, (k, x) => { x.globalCompositeOperation = 'lighter'; x.globalAlpha = (1 - k) * 0.9; const sp = glow(color); const s = r * (1 + k * 0.6); x.drawImage(sp, at.x - s, at.y - s, s * 2, s * 2); });
  }
  function slashLine(at, ang, len, color, { w = 14, dur = 240, delay = 0, curve = 0.25 } = {}) {
    const dx = Math.cos(ang) * len / 2, dy = Math.sin(ang) * len / 2;
    const nx = -dy * curve, ny = dx * curve;
    A(dur, (k, x) => {
      const head = ease(Math.min(1, k * 1.8)), tail = easeIn(Math.max(0, k * 1.6 - 0.5));
      const pt = (q) => { const qq = q * 2 - 1; return { x: at.x + dx * qq + nx * (1 - qq * qq), y: at.y + dy * qq + ny * (1 - qq * qq) }; };
      x.globalCompositeOperation = 'lighter'; x.lineCap = 'round'; x.shadowColor = color; x.shadowBlur = 26;
      for (const [lw, col, al] of [[w, color, 0.85], [w * 0.38, '#ffffff', 1]]) {
        x.globalAlpha = al * (1 - k * 0.6); x.strokeStyle = col; x.lineWidth = lw * (1 - k * 0.5);
        x.beginPath(); const steps = 14; let first = true;
        for (let i = 0; i <= steps; i++) { const q = lerp(tail, head, i / steps); const p = pt(q); if (first) { x.moveTo(p.x, p.y); first = false; } else x.lineTo(p.x, p.y); }
        x.stroke();
      }
    }, delay);
  }
  function bolt(from, to, color, { w = 4, dur = 220, delay = 0, jag = 22, forks = 2 } = {}) {
    const pts = [];
    const n = 9;
    for (let i = 0; i <= n; i++) { const k = i / n; pts.push({ x: lerp(from.x, to.x, k) + (i && i < n ? rnd(-jag, jag) : 0), y: lerp(from.y, to.y, k) + (i && i < n ? rnd(-jag, jag) : 0) }); }
    const fk = Array.from({ length: forks }, () => { const i = 2 + Math.floor(Math.random() * (n - 3)); const p = pts[i]; return [p, { x: p.x + rnd(-60, 60), y: p.y + rnd(10, 70) }]; });
    A(dur, (k, x) => {
      x.globalCompositeOperation = 'lighter'; x.lineJoin = 'round'; x.shadowColor = color; x.shadowBlur = 24;
      const a = k < 0.15 ? 1 : 1 - (k - 0.15) / 0.85;
      for (const [lw, col] of [[w * 2.4, color], [w * 0.8, '#ffffff']]) {
        x.globalAlpha = a; x.strokeStyle = col; x.lineWidth = lw;
        x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y))); x.stroke();
        for (const [p, q] of fk) { x.beginPath(); x.moveTo(p.x, p.y); x.lineTo((p.x + q.x) / 2 + rnd(-8, 8), (p.y + q.y) / 2); x.lineTo(q.x, q.y); x.stroke(); }
      }
    }, delay);
  }
  async function projectile(from, to, color, { ms = 260, size = 10, trail = true, shape = 'glow', arcH = 0 } = {}) {
    const t0 = clock, dur = ms;
    A(dur, (k, x) => {
      const e = easeIn(k * 0.6 + k * 0.4);
      const px = lerp(from.x, to.x, e), py = lerp(from.y, to.y, e) - Math.sin(Math.PI * e) * arcH;
      x.globalCompositeOperation = 'lighter';
      if (shape === 'arrow') {
        const ang = Math.atan2(to.y - from.y - (arcH ? Math.cos(Math.PI * e) * -arcH * 3 : 0), to.x - from.x);
        x.translate(px, py); x.rotate(ang); x.strokeStyle = '#ffffff'; x.lineWidth = 3; x.shadowColor = color; x.shadowBlur = 18;
        x.beginPath(); x.moveTo(-46, 0); x.lineTo(8, 0); x.stroke(); x.fillStyle = color; x.beginPath(); x.moveTo(14, 0); x.lineTo(2, -6); x.lineTo(2, 6); x.fill();
      } else { const sp = glow(color); x.drawImage(sp, px - size * 3, py - size * 3, size * 6, size * 6); }
    });
    if (trail) {
      const n = Math.round(10 * cap());
      for (let i = 0; i < n; i++) setTimeout(() => {
        const e = i / n; P({ x: lerp(from.x, to.x, e), y: lerp(from.y, to.y, e) - Math.sin(Math.PI * e) * arcH, size: size * 0.5, life: 260, color, vx: rnd(-30, 30), vy: rnd(-30, 30) });
      }, (dur * i / n) / speed());
    }
    void t0;
    await wait(dur);
  }

  // element particles for an impact
  function elementBurst(at, element, big = false) {
    const c = colorOf(element), alt = ALT[element] || '#fff';
    const m = big ? 1.6 : 1;
    switch (element) {
      case 'fire':
        burst(at, c, 26 * m, { spd: [80, 360], size: [3, 7], life: [400, 900], grav: -260, drag: 0.92 });
        burst(at, alt, 12 * m, { spd: [60, 220], size: [2, 4], life: [500, 1000], grav: -420, shape: 'circle' });
        for (let i = 0; i < 6 * m * cap(); i++) P({ x: at.x + rnd(-30, 30), y: at.y + rnd(-10, 20), size: rnd(18, 34), life: rnd(500, 900), color: 'rgba(60,30,20,0.7)', shape: 'smoke', solid: true, vy: rnd(-90, -40), grow: true, fade: true });
        break;
      case 'frost':
        burst(at, c, 18 * m, { spd: [140, 420], size: [3, 6], life: [400, 800], shape: 'shard', drag: 0.88, grav: 260 });
        burst(at, '#ffffff', 14 * m, { spd: [30, 120], size: [1.5, 3], life: [700, 1200], drag: 0.96, grav: 40 });
        ringWave(at, c, { r1: 90 * m, w: 5 });
        break;
      case 'storm':
        for (let i = 0; i < (big ? 5 : 3); i++) { const a = rnd(0, TAU); bolt(at, { x: at.x + Math.cos(a) * rnd(60, 130), y: at.y + Math.sin(a) * rnd(60, 130) }, c, { w: 2.5, dur: 200, jag: 12, forks: 0, delay: i * 40 }); }
        burst(at, '#ffffff', 16 * m, { spd: [200, 520], size: [1.5, 3], life: [200, 420], shape: 'line', drag: 0.86 });
        break;
      case 'shadow':
        for (let i = 0; i < 12 * m * cap(); i++) P({ x: at.x + rnd(-24, 24), y: at.y + rnd(-24, 24), size: rnd(22, 42), life: rnd(600, 1100), color: 'rgba(40,14,70,0.85)', shape: 'smoke', solid: true, vx: rnd(-90, 90), vy: rnd(-90, 40), grow: true, fade: true });
        burst(at, c, 16 * m, { spd: [60, 260], size: [2, 5], life: [500, 900], drag: 0.9 });
        break;
      case 'spirit':
        burst(at, c, 22 * m, { spd: [40, 200], size: [3, 6], life: [700, 1300], grav: -140, drag: 0.95 });
        ringWave(at, c, { r1: 110 * m, w: 4, dur: 520 });
        ringWave(at, '#ffffff', { r1: 70 * m, w: 3, dur: 400, delay: 80 });
        break;
      case 'bone':
        burst(at, c, 12 * m, { spd: [160, 380], size: [3, 5], life: [600, 1000], shape: 'bone', grav: 900, drag: 0.97 });
        burst(at, '#ffffff', 10 * m, { spd: [100, 300], size: [1.5, 3], life: [200, 400], drag: 0.88 });
        break;
      case 'poison':
        burst(at, c, 18 * m, { spd: [40, 180], size: [3, 6], life: [600, 1100], grav: 160, drag: 0.93, shape: 'circle' });
        for (let i = 0; i < 6 * cap(); i++) P({ x: at.x + rnd(-24, 24), y: at.y, size: rnd(16, 30), life: rnd(600, 1000), color: 'rgba(60,140,40,0.6)', shape: 'smoke', solid: true, vy: rnd(-60, -20), grow: true, fade: true });
        break;
      default:
        burst(at, c, 14 * m, { spd: [200, 520], size: [1.5, 3.5], life: [200, 420], shape: 'line', drag: 0.86 });
        burst(at, '#ffb86b', 8 * m, { spd: [80, 240], size: [2, 4], life: [300, 600], drag: 0.9 });
    }
  }

  function impact(at, { element = 'none', big = false, perfect = false } = {}) {
    const c = colorOf(element);
    flash(at, perfect ? '#ffffff' : c, big || perfect ? 150 : 100, perfect ? 260 : 180);
    ringWave(at, perfect ? '#ffffff' : c, { r1: perfect ? 170 : big ? 140 : 100, w: perfect ? 10 : 7, dur: perfect ? 420 : 320 });
    if (perfect) ringWave(at, c, { r1: 230, w: 4, dur: 520, delay: 60 });
    elementBurst(at, element, big || perfect);
  }

  // ---------- hero fx ----------
  const targetsOf = (o) => (o.targets && o.targets.length ? o.targets : [o.to || { x: 950, y: 380 }]);
  async function play(id, o = {}) {
    const el = o.element || 'none';
    const c = colorOf(el);
    const to = o.to || targetsOf(o)[0];
    const from = o.from || { x: 330, y: 400 };
    switch (id) {
      case 'strike_sword': case 'heavy_slash':
        slashLine(to, -0.7 + rnd(-0.15, 0.15), id === 'heavy_slash' ? 300 : 240, el === 'none' ? '#ffd9a8' : c, { w: id === 'heavy_slash' ? 22 : 16 });
        await wait(110); return;
      case 'slash_arc': {
        for (const [i, t] of targetsOf(o).entries()) slashLine(t, -0.4, 260, el === 'none' ? '#ffd9a8' : c, { w: 18, delay: i * 50 });
        await wait(130); return;
      }
      case 'strike_daggers': case 'blade_flurry': {
        const n = id === 'blade_flurry' ? 5 : 2;
        for (let i = 0; i < n; i++) slashLine({ x: to.x + rnd(-20, 20), y: to.y + rnd(-30, 30) }, (i % 2 ? 0.8 : -0.8) + rnd(-0.2, 0.2), 170, i % 2 ? '#c9a0ff' : '#ffffff', { w: 10, dur: 200, delay: i * 70 });
        await wait(90); return;
      }
      case 'strike_axes': case 'rune_glow_axes':
        slashLine({ x: to.x - 16, y: to.y }, -1.1, 230, el === 'none' ? '#9fd8ff' : c, { w: 18 });
        slashLine({ x: to.x + 16, y: to.y }, 1.1 + Math.PI, 230, el === 'none' ? '#9fd8ff' : c, { w: 18, delay: 90 });
        await wait(150); return;
      case 'strike_scythe':
        slashLine(to, 0.2, 300, el === 'none' ? '#6dffb0' : c, { w: 14, curve: 0.5, dur: 300 });
        await wait(140); return;
      case 'strike_staff':
        await projectile(from, to, el === 'none' ? '#c9b8ff' : c, { ms: 260, size: 12 }); return;
      case 'strike_bow': case 'arrow':
        await projectile(from, to, el === 'none' ? '#ffe2a8' : c, { ms: 200, shape: 'arrow', arcH: 18 }); return;
      case 'fire_burst':
        await projectile(from, to, colorOf('fire'), { ms: 240, size: 16 });
        for (let i = 0; i < 3; i++) ringWave(to, colorOf('fire'), { r1: 120 + i * 30, w: 8, delay: i * 60 });
        return;
      case 'frost_lance':
        await projectile(from, to, colorOf('frost'), { ms: 200, size: 9 });
        return;
      case 'lightning_chain': {
        const ts = targetsOf(o); let prev = from;
        for (const t of ts) { bolt(prev, t, colorOf('storm'), { w: 4, dur: 260 }); prev = t; await wait(80); }
        return;
      }
      case 'thunder': case 'tempest': {
        const ts = targetsOf(o);
        for (const [i, t] of ts.entries()) bolt({ x: t.x + rnd(-40, 40), y: -20 }, t, colorOf('storm'), { w: id === 'tempest' ? 6 : 4, dur: 300, delay: i * 70, jag: 30 });
        if (id === 'tempest') for (const t of ts) bolt({ x: t.x + rnd(-120, 120), y: -20 }, { x: t.x + rnd(-40, 40), y: t.y + 40 }, '#ffffff', { w: 3, dur: 260, delay: 160 });
        await wait(120); return;
      }
      case 'arrow_rain': {
        const ts = targetsOf(o);
        for (let i = 0; i < 6; i++) { const t = ts[i % ts.length]; setTimeout(() => projectile({ x: t.x - 160 + rnd(-30, 30), y: -40 }, { x: t.x + rnd(-30, 30), y: t.y + rnd(-20, 30) }, '#ffe2a8', { ms: 220, shape: 'arrow' }), (i * 70) / speed()); }
        await wait(260); return;
      }
      case 'wolf_bite':
        for (let i = 0; i < 3; i++) slashLine({ x: to.x - 24 + i * 24, y: to.y }, 1.25, 150, '#d6e6ff', { w: 8, dur: 200, delay: 40 + i * 30, curve: 0.1 });
        await wait(120); return;
      case 'smoke':
        for (let i = 0; i < 18 * cap(); i++) P({ x: from.x + rnd(-40, 40), y: from.y + rnd(-60, 60), size: rnd(30, 60), life: rnd(700, 1200), color: 'rgba(50,40,70,0.8)', shape: 'smoke', solid: true, vx: rnd(-60, 60), vy: rnd(-60, 10), grow: true, fade: true });
        await wait(200); return;
      case 'poison':
        await projectile(from, to, colorOf('poison'), { ms: 220, size: 10 }); return;
      case 'trap':
        ringWave({ x: to.x, y: to.y + 120 }, '#ffb86b', { r1: 80, w: 6 });
        await wait(160); return;
      case 'hex':
        await projectile(from, to, colorOf('shadow'), { ms: 260, size: 12 });
        for (let i = 0; i < 3; i++) ringWave(to, colorOf('shadow'), { r0: 140 - i * 20, r1: 20, w: 5, dur: 380, delay: i * 70 });
        return;
      case 'war_cry': case 'rune_glow': case 'ward': case 'shield_glow': case 'dawn': case 'heal': {
        const ts = targetsOf(o);
        const col = id === 'war_cry' ? '#ff7a2e' : id === 'rune_glow' ? '#5fb8ff' : id === 'dawn' ? '#ffe7a3' : id === 'heal' ? '#6dffb0' : '#8fdcff';
        ringWave(from, col, { r1: 160, w: 8, dur: 480 });
        for (const t of ts) { if (id === 'heal' || id === 'dawn') healFx(t, col); else shieldFx(t, col); }
        await wait(200); return;
      }
      default:
        if (o.ranged) await projectile(from, to, c, { ms: 240, size: 11 });
        else slashLine(to, -0.7, 240, el === 'none' ? '#ffd9a8' : c, { w: 16 });
        await wait(110);
    }
  }

  function healFx(at, col = '#6dffb0') {
    for (let i = 0; i < 22 * cap(); i++) P({ x: at.x + rnd(-50, 50), y: at.y + rnd(0, 90), vy: rnd(-160, -60), vx: rnd(-10, 10), size: rnd(2.5, 5), life: rnd(700, 1200), color: col, drag: 0.97 });
    ringWave({ x: at.x, y: at.y + 100 }, col, { r1: 90, w: 5, dur: 520 });
  }
  function shieldFx(at, col = '#8fdcff') {
    A(700, (k, x) => {
      x.globalCompositeOperation = 'lighter'; x.globalAlpha = Math.sin(Math.PI * k) * 0.8; x.strokeStyle = col; x.lineWidth = 4; x.shadowColor = col; x.shadowBlur = 24;
      x.beginPath(); x.ellipse(at.x, at.y + 10, 90 + k * 10, 130 + k * 10, 0, 0, TAU); x.stroke();
      x.globalAlpha *= 0.18; x.fillStyle = col; x.fill();
    });
  }

  // ---------- foe fx ----------
  async function foe(kind, o = {}) {
    const el = o.element || 'none';
    const c = el === 'none' ? '#ff5a4a' : colorOf(el);
    const ts = targetsOf(o);
    const to = ts[0], from = o.from || { x: 950, y: 380 };
    switch (kind) {
      case 'breath': case 'bolt': case 'ranged': {
        if (ts.length > 1) {
          A(420, (k, x) => {
            x.globalCompositeOperation = 'lighter';
            for (const t of ts) { x.globalAlpha = (1 - k) * 0.7; const sp = glow(c); const p = { x: lerp(from.x, t.x, ease(k)), y: lerp(from.y, t.y, ease(k)) }; x.drawImage(sp, p.x - 60, p.y - 60, 120, 120); }
          });
          await wait(360); return;
        }
        await projectile(from, to, c, { ms: 260, size: 14 }); return;
      }
      case 'slam': case 'quake':
        for (const t of ts) ringWave({ x: t.x, y: t.y + 120 }, c, { r1: 150, w: 10, dur: 420 });
        await wait(120); return;
      default:
        for (const [i, t] of ts.entries()) {
          slashLine({ x: t.x - 10, y: t.y }, 2.2, 200, c, { w: 10, dur: 220, delay: i * 40, curve: 0.15 });
          slashLine({ x: t.x + 14, y: t.y + 10 }, 2.2, 190, c, { w: 9, dur: 220, delay: i * 40 + 40, curve: 0.15 });
        }
        await wait(110);
    }
  }

  // ---------- big moments ----------
  function crumble(at, { w = 160, h = 300, element = 'bone' } = {}) {
    const col = element === 'shadow' ? 'rgba(40,20,60,0.85)' : element === 'fire' ? 'rgba(70,40,30,0.8)' : element === 'frost' ? 'rgba(170,210,235,0.7)' : 'rgba(210,200,180,0.75)';
    const n = Math.round(70 * cap());
    for (let i = 0; i < n; i++) {
      const x = at.x + rnd(-w / 2, w / 2), y = at.y - rnd(0, h);
      P({ x, y, size: rnd(3, 7), life: rnd(700, 1500), color: col, shape: 'smoke', solid: true, vx: rnd(-40, 70), vy: rnd(-80, 10), grow: true, fade: true, drag: 0.96 });
      if (i % 3 === 0) P({ x, y, size: rnd(1.5, 3), life: rnd(600, 1200), color: element === 'bone' ? '#eadfc4' : colorOf(element), vx: rnd(-60, 90), vy: rnd(-120, -20), drag: 0.96, grav: -30 });
      if (element === 'bone' && i % 6 === 0) P({ x, y, size: rnd(3, 5), life: rnd(700, 1100), color: '#eadfc4', shape: 'bone', vx: rnd(-140, 140), vy: rnd(-260, -80), grav: 1100, drag: 0.98, spin: rnd(-12, 12), solid: true, fade: true });
    }
  }
  function summon(at) {
    for (let i = 0; i < 26 * cap(); i++) P({ x: at.x + rnd(-60, 60), y: at.y + rnd(-20, 60), size: rnd(26, 50), life: rnd(600, 1100), color: 'rgba(40,120,80,0.6)', shape: 'smoke', solid: true, vx: rnd(-60, 60), vy: rnd(-90, -20), grow: true, fade: true });
    burst(at, colorOf('spirit'), 24, { spd: [60, 260], size: [2, 5], life: [500, 1000], grav: -120 });
    ringWave({ x: at.x, y: at.y + 80 }, colorOf('spirit'), { r1: 140, w: 6, dur: 520 });
  }
  function phase(at, { element = 'spirit' } = {}) {
    const c = colorOf(element);
    for (let i = 0; i < 4; i++) ringWave(at, i % 2 ? '#ffffff' : c, { r1: 260 + i * 80, w: 12, dur: 700, delay: i * 110 });
    A(1200, (k, x) => {
      x.globalCompositeOperation = 'lighter'; x.globalAlpha = Math.sin(Math.PI * k) * 0.55;
      const gr = x.createLinearGradient(at.x - 120, 0, at.x + 120, 0);
      gr.addColorStop(0, c + '00'); gr.addColorStop(0.5, c); gr.addColorStop(1, c + '00');
      x.fillStyle = gr; x.fillRect(at.x - 120, 0, 240, at.y + 220);
    });
    burst(at, c, 60, { spd: [100, 500], size: [3, 7], life: [700, 1400], grav: -200, drag: 0.93 });
  }
  const shock = (at, { color = '#ffffff', r = 200 } = {}) => ringWave(at, color, { r1: r, w: 10, dur: 460 });
  const heal = (at) => healFx(at);
  const shield = (at) => shieldFx(at);
  function status(at, s) {
    const col = { burn: colorOf('fire'), poison: colorOf('poison'), chill: colorOf('frost'), stun: '#ffe7a3', mark: '#ff5a4a', curse: colorOf('shadow'), rally: '#ff7a2e', vanish: colorOf('shadow'), webbed: '#e8e8f0', silenced: '#c9b8ff', cocoon: '#e8e8f0' }[s] || '#ffffff';
    burst(at, col, 14, { spd: [40, 160], size: [2, 4], life: [500, 900], grav: -80 });
  }

  function dispose() { disposed = true; parts = []; anims = []; }
  return { freeze(ms) { frozenUntil = performance.now() + ms / speed(); }, play, impact, foe, crumble, summon, phase, shock, heal, shield, status, resize, dispose, flash: (at, c) => flash(at, c || '#ffffff', 160, 220) };
}
