// Battle effects on one canvas (SPEC 12). Every fx id from SPEC 5 (and the strike fx ids) has its own short effect.
// createFx(canvas, { pixelRatio, reduce }) -> {
//   play(id, { from, to, targets, color }) -> Promise   resolves at the moment of impact (time scaled by __LF_SPEED)
//   exit(kind, at)        flee / befriend / cogs puffs        hit(at, { color, big })   impact flash + sparks
//   foe(id, { from, to, targets })                          foe move effects (claw, steam, rumble, screech, ...)
//   text-free; positions are stage pixels. resize(), dispose()
// }
// Promises use setTimeout, never rAF or animationend, so a hidden tab or a cut animation can never hang a battle.

const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => 1 - Math.pow(1 - k, 3);
const easeIn = (k) => k * k;
const clamp = (k) => (k < 0 ? 0 : k > 1 ? 1 : k);
const speed = () => (typeof window !== 'undefined' && window.__LF_SPEED > 0 ? window.__LF_SPEED : 1);

const COL = {
  gold: '#ffd77a', white: '#fff6e0', silver: '#cfe6ff', blue: '#7fb6ff', green: '#86e08f', leaf: '#5fae4f',
  pink: '#ff8fb8', red: '#ff5a4a', purple: '#b48cff', orange: '#ff9a3a', grey: '#b9b4c8', brown: '#8a6a44',
  brass: '#e0b25a', mud: '#7a5a34', ice: '#bfe8ff', smoke: '#5a5470',
};

export function createFx(canvas, { pixelRatio = () => 1, reduce = () => false } = {}) {
  const g = canvas.getContext('2d');
  const W = 1280, H = 800;
  let parts = [];     // particles
  let anims = [];     // custom drawers { t0, dur, draw(k, g, age) }
  let running = false;
  let last = 0;
  let clock = 0;      // scaled ms
  let disposed = false;
  const sprites = new Map();

  function resize() {
    const pr = pixelRatio();
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
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, color); gr.addColorStop(0.5, color + '55'); gr.addColorStop(1, color + '00');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    sprites.set(color, c);
    return c;
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms) / speed()));
  function start() {
    if (running || disposed) return;
    running = true; last = performance.now();
    requestAnimationFrame(tick);
  }
  function tick(now) {
    if (disposed) return;
    const dt = Math.min(50, now - last) * speed(); last = now; clock += dt;
    g.clearRect(0, 0, W, H);
    // anims
    anims = anims.filter((a) => {
      const age = clock - a.t0;
      if (age < 0) return true;
      const k = clamp(age / a.dur);
      g.save(); try { a.draw(k, g, age); } catch (e) { /* drawing never breaks a battle */ } g.restore();
      return k < 1;
    });
    // particles
    const s = dt / 1000;
    parts = parts.filter((p) => {
      p.age += dt;
      if (p.age < 0) return true;
      if (p.age > p.life) return false;
      p.vx *= Math.pow(p.drag, s * 60); p.vy *= Math.pow(p.drag, s * 60);
      p.vy += p.grav * s; p.x += p.vx * s; p.y += p.vy * s; p.rot += p.spin * s;
      if (p.floor && p.y > p.floor) { p.y = p.floor; p.vy *= -0.45; p.vx *= 0.7; }
      const k = p.age / p.life;
      const a = p.fade === 'in-out' ? Math.sin(Math.PI * k) : 1 - easeIn(k);
      g.save(); g.globalAlpha = a * (p.alpha ?? 1);
      drawPart(p, k);
      g.restore();
      return true;
    });
    if (anims.length || parts.length) requestAnimationFrame(tick);
    else { running = false; g.clearRect(0, 0, W, H); }
  }

  function drawPart(p, k) {
    const sz = p.size * (p.grow ? lerp(1, p.grow, k) : 1);
    g.translate(p.x, p.y); g.rotate(p.rot);
    switch (p.shape) {
      case 'glow': g.globalCompositeOperation = 'lighter'; g.drawImage(glow(p.color), -sz, -sz, sz * 2, sz * 2); break;
      case 'star': star(g, 0, 0, sz, sz * 0.45, 5, p.color); break;
      case 'leaf': g.fillStyle = p.color; g.beginPath(); g.ellipse(0, 0, sz, sz * 0.42, 0, 0, TAU); g.fill(); g.strokeStyle = 'rgba(30,60,20,.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-sz, 0); g.lineTo(sz, 0); g.stroke(); break;
      case 'heart': heart(g, sz, p.color); break;
      case 'cog': cog(g, sz, p.color); break;
      case 'note': note(g, sz, p.color); break;
      case 'smoke': { const gr = g.createRadialGradient(0, 0, 0, 0, 0, sz); gr.addColorStop(0, p.color + 'cc'); gr.addColorStop(1, p.color + '00'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, sz, 0, TAU); g.fill(); break; }
      case 'shard': g.fillStyle = p.color; g.beginPath(); g.moveTo(0, -sz); g.lineTo(sz * 0.35, 0); g.lineTo(0, sz); g.lineTo(-sz * 0.35, 0); g.closePath(); g.fill(); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(-1, -sz * 0.7, 2, sz * 1.2); break;
      case 'drop': g.fillStyle = p.color; g.beginPath(); g.arc(0, 0, sz, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(-sz * 0.3, -sz * 0.3, sz * 0.35, 0, TAU); g.fill(); break;
      case 'petal': g.fillStyle = p.color; g.beginPath(); g.ellipse(0, 0, sz, sz * 0.6, 0, 0, TAU); g.fill(); break;
      case 'coin': { const w = Math.abs(Math.cos(p.rot * 3)) * sz; g.rotate(-p.rot); g.fillStyle = '#f7c95c'; g.strokeStyle = '#8a5a14'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(0, 0, Math.max(1.5, w), sz, 0, 0, TAU); g.fill(); g.stroke(); break; }
      case 'rock': g.fillStyle = p.color; g.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; const r = sz * (0.75 + ((i * 37) % 5) / 10); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); break;
      case 'line': g.strokeStyle = p.color; g.lineWidth = p.width || 2; g.lineCap = 'round'; g.globalCompositeOperation = 'lighter'; g.beginPath(); g.moveTo(-sz, 0); g.lineTo(sz, 0); g.stroke(); break;
      case 'z': g.fillStyle = p.color; g.font = `700 ${sz * 2}px Cinzel, Georgia, serif`; g.textAlign = 'center'; g.fillText('z', 0, sz * 0.7); break;
      default: g.fillStyle = p.color; g.beginPath(); g.arc(0, 0, sz, 0, TAU); g.fill();
    }
  }

  function emit(n, base) {
    if (reduce()) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      const o = typeof base === 'function' ? base(i) : base;
      const ang = o.ang ?? rnd(0, TAU);
      const sp = o.speed ?? rnd(60, 260);
      parts.push({
        x: o.x, y: o.y, vx: o.vx ?? Math.cos(ang) * sp, vy: o.vy ?? Math.sin(ang) * sp,
        size: o.size ?? rnd(3, 7), color: o.color || COL.gold, shape: o.shape || 'glow', life: (o.life ?? rnd(400, 900)),
        age: -(o.delay || 0), grav: o.grav ?? 0, drag: o.drag ?? 0.96, rot: o.rot ?? rnd(0, TAU), spin: o.spin ?? rnd(-6, 6),
        floor: o.floor, grow: o.grow, fade: o.fade, alpha: o.alpha, width: o.width,
      });
    }
    start();
  }
  function anim(dur, draw, delay = 0) { anims.push({ t0: clock + delay, dur, draw }); start(); }

  // ---------- shape helpers ----------
  function star(c, x, y, r1, r2, n, color) {
    c.fillStyle = color; c.beginPath();
    for (let i = 0; i < n * 2; i++) { const r = i % 2 ? r2 : r1; const a = (i / (n * 2)) * TAU - Math.PI / 2; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    c.closePath(); c.fill();
  }
  function heart(c, s, color) {
    c.fillStyle = color; c.beginPath(); c.moveTo(0, s * 0.9);
    c.bezierCurveTo(-s * 1.3, -s * 0.1, -s * 0.6, -s * 1.1, 0, -s * 0.35);
    c.bezierCurveTo(s * 0.6, -s * 1.1, s * 1.3, -s * 0.1, 0, s * 0.9); c.fill();
    c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.arc(-s * 0.4, -s * 0.35, s * 0.2, 0, TAU); c.fill();
  }
  function cog(c, s, color) {
    c.fillStyle = color; c.beginPath();
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; const r = i % 2 ? s : s * 0.78; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    c.closePath(); c.fill(); c.fillStyle = 'rgba(40,24,8,.8)'; c.beginPath(); c.arc(0, 0, s * 0.3, 0, TAU); c.fill();
  }
  function note(c, s, color) {
    c.fillStyle = color; c.strokeStyle = color; c.lineWidth = s * 0.22;
    c.beginPath(); c.ellipse(-s * 0.3, s * 0.5, s * 0.45, s * 0.32, -0.4, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(s * 0.1, s * 0.45); c.lineTo(s * 0.1, -s * 0.9); c.quadraticCurveTo(s * 0.7, -s * 0.6, s * 0.6, -s * 0.1); c.stroke();
  }
  const ring = (x, y, { color = COL.gold, r0 = 10, r1 = 90, dur = 420, width = 6, delay = 0, squash = 1 } = {}) => anim(dur, (k, c) => {
    c.globalCompositeOperation = 'lighter'; c.strokeStyle = color; c.globalAlpha = 1 - k; c.lineWidth = width * (1 - k) + 1;
    c.beginPath(); c.ellipse(x, y, lerp(r0, r1, ease(k)), lerp(r0, r1, ease(k)) * squash, 0, 0, TAU); c.stroke();
  }, delay);
  const flash = (x, y, { color = COL.white, r = 120, dur = 260, delay = 0 } = {}) => anim(dur, (k, c) => {
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = (1 - k) * 0.9; const s = r * (0.6 + 0.6 * ease(k));
    c.drawImage(glow(color), x - s, y - s, s * 2, s * 2);
  }, delay);
  function emitLinesAligned() { for (const p of parts) if (p.shape === 'line' && p.age <= 0 && p.rot === 0) p.rot = Math.atan2(p.vy, p.vx); }

  // projectile: draws a head with a trail along a (possibly arcing) path; resolves at arrival
  function projectile(from, to, { dur = 380, color = COL.white, size = 10, arc = 0, trail = true, head, wobble = 0 } = {}) {
    const path = (k) => {
      const x = lerp(from.x, to.x, k), y = lerp(from.y, to.y, k) - Math.sin(Math.PI * k) * arc + Math.sin(k * 18) * wobble;
      return { x, y };
    };
    anim(dur, (k, c) => {
      const p = path(ease(k));
      if (trail) {
        c.globalCompositeOperation = 'lighter';
        for (let i = 1; i <= 8; i++) { const q = path(ease(Math.max(0, k - i * 0.025))); c.globalAlpha = 0.5 * (1 - i / 9); const s = size * (1 - i / 10); c.drawImage(glow(color), q.x - s * 1.6, q.y - s * 1.6, s * 3.2, s * 3.2); }
        c.globalAlpha = 1;
      }
      if (head) head(c, p, k, path); else { c.globalCompositeOperation = 'lighter'; c.drawImage(glow(color), p.x - size * 2, p.y - size * 2, size * 4, size * 4); }
    });
    if (trail) emit(Math.round(dur / 30), (i) => { const p = path(ease(i / (dur / 30))); return { x: p.x, y: p.y, color, size: rnd(2, 4), speed: rnd(10, 50), life: rnd(250, 450), delay: i * 30 }; });
    return wait(dur);
  }

  const arrowHead = (color) => (c, p, k, path) => {
    const q = path(ease(Math.max(0, k - 0.04)));
    const a = Math.atan2(p.y - q.y, p.x - q.x);
    c.translate(p.x, p.y); c.rotate(a);
    c.strokeStyle = '#d9c08a'; c.lineWidth = 3; c.beginPath(); c.moveTo(-38, 0); c.lineTo(0, 0); c.stroke();
    c.fillStyle = '#e8eef8'; c.beginPath(); c.moveTo(6, 0); c.lineTo(-6, -5); c.lineTo(-6, 5); c.fill();
    c.fillStyle = color; c.beginPath(); c.moveTo(-38, 0); c.lineTo(-46, -6); c.lineTo(-30, 0); c.lineTo(-46, 6); c.fill();
  };

  // ---------- impact ----------
  function hit(at, { color = COL.white, big = false } = {}) {
    flash(at.x, at.y, { color, r: big ? 210 : 140 });
    flash(at.x, at.y, { color: COL.white, r: big ? 80 : 54, dur: 150 });
    ring(at.x, at.y, { color, r1: big ? 150 : 95, width: big ? 9 : 6 });
    emit(big ? 26 : 14, () => ({ x: at.x, y: at.y, color, size: rnd(3, 6), speed: rnd(120, big ? 420 : 300), life: rnd(300, 600), drag: 0.9 }));
    emit(big ? 14 : 8, () => ({ x: at.x, y: at.y, color: COL.white, shape: 'line', size: rnd(6, 14), width: 3, speed: rnd(200, 460), life: rnd(160, 320), drag: 0.86, spin: 0 }));
    emitLinesAligned();
  }

  function slash(to, color = COL.white, flip = 1) {
    anim(260, (k, c) => {
      c.globalCompositeOperation = 'lighter'; c.translate(to.x, to.y); c.scale(flip, 1); c.rotate(-0.7);
      const a0 = -1.2, a1 = lerp(-1.2, 1.4, ease(Math.min(1, k * 1.6)));
      c.globalAlpha = 1 - easeIn(k);
      for (let i = 0; i < 3; i++) { c.strokeStyle = i ? color : COL.white; c.lineWidth = 14 - i * 4; c.beginPath(); c.arc(0, 0, 70 + i * 6, a0 + (a1 - a0) * 0.25 * i, a1); c.stroke(); }
    });
  }

  // ---------- hero effects ----------
  const FX = {
    async slash({ to }) { slash(to, COL.gold); await wait(110); hit(to, { color: COL.gold }); },
    async jab({ to }) {
      for (let i = 0; i < 3; i++) {
        const p = { x: to.x + rnd(-24, 24), y: to.y + rnd(-30, 30) };
        anim(140, (k, c) => { c.globalCompositeOperation = 'lighter'; c.strokeStyle = COL.white; c.lineWidth = 5 * (1 - k); c.beginPath(); c.moveTo(p.x - 50 * (1 - k) - 20, p.y + 6); c.lineTo(p.x + 10, p.y - 2); c.stroke(); }, i * 70);
        flash(p.x, p.y, { r: 50, delay: i * 70 + 60 });
      }
      await wait(160); hit(to, { color: COL.orange });
    },
    async thump({ to }) {
      anim(300, (k, c) => { c.fillStyle = '#c9a36a'; c.globalAlpha = 1 - k; c.translate(to.x, to.y - 90 + 90 * easeIn(Math.min(1, k * 2))); c.fillRect(-8, -60, 16, 60); });
      await wait(150);
      ring(to.x, to.y + 60, { color: COL.green, r1: 120, squash: 0.3, width: 8 });
      emit(14, () => ({ x: to.x + rnd(-30, 30), y: to.y + 50, color: rnd(0, 1) > 0.5 ? COL.leaf : '#b7d36a', shape: 'leaf', size: rnd(5, 9), vy: rnd(-260, -120), vx: rnd(-160, 160), grav: 600, life: 900 }));
      hit(to, { color: COL.green });
    },
    async spark({ from, to }) { await projectile(from, to, { dur: 360, color: COL.blue, size: 15, arc: 40 }); hit(to, { color: COL.blue }); emit(10, () => ({ x: to.x, y: to.y, color: COL.silver, shape: 'star', size: rnd(4, 7), speed: rnd(80, 220), life: 600 })); },
    async arrow({ from, to }) { await projectile(from, to, { dur: 280, color: COL.white, size: 4, arc: 26, head: arrowHead('#d84a3a') }); hit(to, { color: COL.white }); },
    async arrows({ from, to }) { return FX.arrow({ from, to }); },
    async note({ from, to }) {
      await projectile(from, to, { dur: 460, color: COL.purple, size: 8, wobble: 14, head: (c, p, k) => { c.translate(p.x, p.y); c.rotate(Math.sin(k * 12) * 0.3); note(c, 18, '#e2c6ff'); } });
      ring(to.x, to.y, { color: COL.purple, r1: 100 }); ring(to.x, to.y, { color: COL.pink, r1: 70, delay: 80 }); hit(to, { color: COL.purple });
    },
    async bash({ to }) {
      flash(to.x, to.y, { color: COL.gold, r: 160 });
      hit(to, { color: COL.gold, big: true });
      const head = { x: to.x, y: to.y - 70 };
      anim(900, (k, c) => { for (let i = 0; i < 3; i++) { const a = k * TAU * 1.5 + (i * TAU) / 3; c.globalAlpha = 1 - easeIn(k); star(c, head.x + Math.cos(a) * 38, head.y + Math.sin(a) * 12, 10, 4.5, 5, COL.gold); } });
      await wait(40);
    },
    async shield({ from, to }) {
      anim(380, (k, c) => { c.globalCompositeOperation = 'lighter'; c.strokeStyle = COL.gold; c.lineWidth = 6; c.globalAlpha = 1 - k * 0.5; c.beginPath(); c.moveTo(from.x, from.y); c.lineTo(lerp(from.x, to.x, ease(k)), lerp(from.y, to.y, ease(k))); c.stroke(); });
      await wait(320);
      anim(900, (k, c) => {
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.sin(Math.PI * k) * 0.9;
        const gr = c.createRadialGradient(to.x, to.y, 40, to.x, to.y, 130); gr.addColorStop(0, 'rgba(255,215,122,0)'); gr.addColorStop(0.85, 'rgba(255,215,122,.35)'); gr.addColorStop(1, 'rgba(255,240,190,.9)');
        c.fillStyle = gr; c.beginPath(); c.ellipse(to.x, to.y, 110, 150, 0, 0, TAU); c.fill();
      });
      emit(16, () => ({ x: to.x + rnd(-90, 90), y: to.y + rnd(-120, 120), color: COL.gold, size: rnd(2, 4), speed: 20, life: 800, fade: 'in-out' }));
    },
    async charge({ from, targets }) {
      const ys = targets.map((t) => t.y), y = ys.reduce((s, v) => s + v, 0) / (ys.length || 1);
      const x0 = from.x, x1 = Math.max(...targets.map((t) => t.x)) + 160;
      anim(520, (k, c) => {
        const x = lerp(x0, x1, ease(k));
        c.globalCompositeOperation = 'lighter';
        const gr = c.createLinearGradient(x - 340, 0, x, 0); gr.addColorStop(0, 'rgba(255,215,122,0)'); gr.addColorStop(1, 'rgba(255,240,190,.85)');
        c.fillStyle = gr; c.globalAlpha = 1 - easeIn(k) * 0.6; c.fillRect(x - 340, y - 70, 340, 140);
        c.drawImage(glow(COL.gold), x - 90, y - 90, 180, 180);
      });
      targets.forEach((t) => { const d = ((t.x - x0) / (x1 - x0)) * 520 * 0.6; setTimeout(() => hit(t, { color: COL.gold, big: true }), d / speed()); });
      await wait(300);
    },
    async starbolt({ from, to }) {
      await projectile(from, to, { dur: 520, color: COL.silver, size: 24, arc: 90, head: (c, p, k) => { c.translate(p.x, p.y); c.rotate(k * 10); c.globalCompositeOperation = 'lighter'; c.drawImage(glow(COL.blue), -80, -80, 160, 160); c.drawImage(glow(COL.silver), -50, -50, 100, 100); star(c, 0, 0, 34, 13, 5, '#ffffff'); } });
      ring(to.x, to.y, { color: COL.silver, r1: 200, width: 10, dur: 520 });
      flash(to.x, to.y, { color: COL.silver, r: 220 });
      emit(30, () => ({ x: to.x, y: to.y, color: rnd(0, 1) > 0.4 ? COL.silver : COL.gold, shape: 'star', size: rnd(4, 9), speed: rnd(120, 420), life: rnd(500, 900), drag: 0.92 }));
      hit(to, { color: COL.silver, big: true });
    },
    async dust({ from, to }) {
      emit(46, (i) => ({ x: from.x + rnd(-10, 10), y: from.y + rnd(-10, 10), vx: (to.x - from.x) * rnd(0.8, 1.2), vy: (to.y - from.y) * rnd(0.8, 1.2) + rnd(-40, 40), drag: 0.985, color: i % 3 ? COL.silver : COL.purple, size: rnd(2, 4), life: rnd(900, 1300), delay: i * 8, fade: 'in-out' }));
      await wait(720);
      emit(5, (i) => ({ x: to.x + 30, y: to.y - 60, vx: rnd(10, 40), vy: -60, shape: 'z', color: COL.silver, size: 9 + i * 2, life: 1300, delay: i * 180, spin: 0, rot: 0, drag: 1, fade: 'in-out' }));
    },
    async comets({ targets }) {
      targets.forEach((t, i) => {
        const from = { x: t.x + 360, y: -60 };
        setTimeout(() => projectile(from, t, { dur: 520, color: COL.orange, size: 18 }).then(() => { hit(t, { color: COL.gold, big: true }); emit(10, () => ({ x: t.x, y: t.y + 40, color: COL.orange, size: rnd(3, 5), vy: rnd(-300, -100), vx: rnd(-200, 200), grav: 700, life: 700 })); }), (i * 140) / speed());
      });
      await wait(520 + 140 * (targets.length - 1) * 0.5);
    },
    async fox({ from, to }) {
      const g0 = { x: from.x, y: from.y + 110 }, g1 = { x: to.x - 40, y: to.y + 100 };
      await projectile(g0, g1, { dur: 420, color: COL.orange, size: 8, arc: 30, head: (c, p) => {
        c.translate(p.x, p.y);
        c.fillStyle = '#e0762a'; c.beginPath(); c.ellipse(0, 0, 26, 13, 0, 0, TAU); c.fill();
        c.beginPath(); c.ellipse(-32, -4, 18, 8, -0.4, 0, TAU); c.fill(); c.fillStyle = '#fff3e0'; c.beginPath(); c.ellipse(-46, -9, 7, 5, -0.4, 0, TAU); c.fill();
        c.fillStyle = '#e0762a'; c.beginPath(); c.moveTo(18, -6); c.lineTo(34, -2); c.lineTo(20, 6); c.fill(); c.beginPath(); c.moveTo(16, -10); c.lineTo(22, -22); c.lineTo(26, -8); c.fill();
      } });
      hit(to, { color: COL.orange });
      ring(to.x, to.y, { color: COL.red, r0: 70, r1: 50, width: 4, dur: 600 });
    },
    async rain({ targets }) {
      for (const t of targets) for (let i = 0; i < 9; i++) {
        const x = t.x + rnd(-60, 60);
        const d = rnd(0, 380);
        anim(260, (k, c) => { const y = lerp(t.y - 420, t.y + rnd(-10, 40), easeIn(k)); c.translate(x, y); c.rotate(Math.PI / 2); arrowHead('#d84a3a')(c, { x: 0, y: 0 }, 1, () => ({ x: -1, y: 0 })); }, d);
      }
      await wait(380);
      targets.forEach((t) => hit(t, { color: COL.white }));
    },
    async sneak({ to }) {
      anim(320, (k, c) => {
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1 - easeIn(k); c.strokeStyle = COL.purple; c.lineWidth = 10;
        const s = 80 * ease(Math.min(1, k * 2));
        c.beginPath(); c.moveTo(to.x - s, to.y - s); c.lineTo(to.x + s, to.y + s); c.moveTo(to.x + s, to.y - s); c.lineTo(to.x - s, to.y + s); c.stroke();
      });
      await wait(140); hit(to, { color: COL.purple, big: true });
    },
    async smoke({ targets }) {
      for (const t of targets) emit(16, () => ({ x: t.x + rnd(-50, 50), y: t.y + rnd(-60, 40), color: COL.smoke, shape: 'smoke', size: rnd(40, 70), grow: 1.8, speed: rnd(10, 50), life: rnd(1100, 1600), drag: 0.98, fade: 'in-out', alpha: 0.85 }));
      await wait(380);
    },
    async tricks({ from, to }) {
      const cols = [COL.red, COL.blue, COL.green, COL.gold, COL.purple];
      emit(26, (i) => ({ x: from.x, y: from.y, vx: (to.x - from.x) * rnd(1.2, 1.8), vy: rnd(-520, -280), grav: 900, color: cols[i % 5], shape: i % 4 ? 'drop' : 'star', size: rnd(4, 8), life: 1200, floor: to.y + 110, drag: 0.995 }));
      await wait(520);
      hit(to, { color: COL.gold });
      emit(8, (i) => ({ x: to.x, y: to.y, vx: (from.x - to.x) * rnd(0.8, 1.1), vy: rnd(-520, -380), grav: 900, shape: 'coin', size: 9, life: 1100, delay: 200 + i * 40, spin: 8, drag: 1 }));
    },
    async song({ from, targets }) {
      const cols = [COL.gold, COL.pink, COL.purple];
      targets.forEach((t, j) => emit(7, (i) => ({ x: from.x + rnd(-20, 20), y: from.y, vx: (t.x - from.x) * rnd(0.9, 1.1), vy: (t.y - from.y) - 80, drag: 0.99, shape: 'note', size: rnd(11, 15), color: cols[(i + j) % 3], spin: 0, rot: rnd(-0.3, 0.3), life: 1000, delay: i * 70, fade: 'in-out' })));
      await wait(700);
      targets.forEach((t) => { ring(t.x, t.y, { color: COL.gold, r1: 100 }); emit(10, () => ({ x: t.x + rnd(-40, 40), y: t.y + 60, vy: rnd(-180, -90), vx: rnd(-20, 20), color: COL.gold, size: rnd(2, 4), life: 900, drag: 0.98 })); });
    },
    async chord({ from, to }) {
      for (let i = 0; i < 4; i++) anim(520, (k, c) => {
        const x = lerp(from.x, to.x, ease(k)), y = lerp(from.y, to.y, ease(k));
        c.globalCompositeOperation = 'lighter'; c.strokeStyle = i % 2 ? COL.pink : COL.gold; c.lineWidth = 5; c.globalAlpha = 1 - k * 0.6;
        c.beginPath(); c.arc(x - 30, y, 30 + i * 10, -0.9, 0.9); c.stroke();
      }, i * 70);
      await wait(560);
      flash(to.x, to.y, { color: COL.gold, r: 180 });
      emit(12, () => ({ x: to.x, y: to.y, color: COL.pink, shape: 'heart', size: rnd(7, 11), speed: rnd(60, 200), life: 900, drag: 0.94 }));
      hit(to, { color: COL.pink });
    },
    async encore({ to }) {
      anim(900, (k, c) => {
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.sin(Math.PI * k) * 0.8;
        const gr = c.createLinearGradient(to.x, 0, to.x, to.y + 140); gr.addColorStop(0, 'rgba(255,240,190,.0)'); gr.addColorStop(1, 'rgba(255,240,190,.55)');
        c.fillStyle = gr; c.beginPath(); c.moveTo(to.x - 30, 0); c.lineTo(to.x + 30, 0); c.lineTo(to.x + 120, to.y + 150); c.lineTo(to.x - 120, to.y + 150); c.closePath(); c.fill();
      });
      emit(26, () => ({ x: to.x, y: to.y - 40, color: COL.gold, shape: 'star', size: rnd(5, 10), speed: rnd(140, 360), life: 1000, drag: 0.92 }));
      await wait(300);
    },
    async heal({ to }) {
      anim(900, (k, c) => { c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.sin(Math.PI * k) * 0.7; const gr = c.createLinearGradient(0, to.y - 180, 0, to.y + 150); gr.addColorStop(0, 'rgba(134,224,143,0)'); gr.addColorStop(1, 'rgba(134,224,143,.6)'); c.fillStyle = gr; c.fillRect(to.x - 80, to.y - 180, 160, 330); });
      emit(30, (i) => ({ x: to.x + rnd(-70, 70), y: to.y + rnd(40, 140), vx: rnd(-10, 10), vy: rnd(-200, -90), color: i % 4 ? COL.green : COL.white, size: rnd(2.5, 5), life: rnd(700, 1100), drag: 0.99, delay: i * 18, fade: 'in-out' }));
      emit(4, (i) => ({ x: to.x + rnd(-40, 40), y: to.y + 40, vy: -110, vx: 0, shape: 'heart', color: COL.pink, size: 9, life: 1000, delay: 150 + i * 120, spin: 0, rot: 0, drag: 1, fade: 'in-out' }));
      await wait(350);
    },
    async vines({ to }) {
      const vines = Array.from({ length: 5 }, (_, i) => ({ x0: to.x + (i - 2) * 26, side: i % 2 ? 1 : -1, h: rnd(140, 220) }));
      anim(900, (k, c) => {
        const grow = ease(Math.min(1, k * 1.8));
        c.globalAlpha = k > 0.75 ? (1 - k) * 4 : 1;
        for (const v of vines) {
          c.strokeStyle = '#3d8a3a'; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath();
          const base = to.y + 110;
          for (let s = 0; s <= 20 * grow; s++) { const t = s / 20; c.lineTo(v.x0 + Math.sin(t * 9) * 26 * v.side, base - t * v.h); }
          c.stroke();
          c.strokeStyle = '#86e08f'; c.lineWidth = 2; c.stroke();
          if (grow > 0.6) { c.fillStyle = '#5fae4f'; for (let s = 4; s < 20 * grow; s += 4) { const t = s / 20; c.beginPath(); c.ellipse(v.x0 + Math.sin(t * 9) * 26 * v.side + 8 * v.side, base - t * v.h, 8, 4, v.side * 0.6, 0, TAU); c.fill(); } }
        }
      });
      await wait(360);
      hit(to, { color: COL.green });
    },
    async bloom({ targets }) {
      const cols = ['#ffc0d8', '#fff0f6', '#ffd77a', '#c9f0b0'];
      for (const t of targets) {
        emit(18, (i) => ({ x: t.x + rnd(-80, 80), y: t.y + 120, vy: rnd(-260, -120), vx: rnd(-60, 60), grav: 120, color: cols[i % 4], shape: 'petal', size: rnd(5, 9), life: 1200, drag: 0.98, delay: rnd(0, 300) }));
        ring(t.x, t.y + 110, { color: COL.green, r1: 120, squash: 0.3, width: 6, delay: 100 });
      }
      await wait(380);
      targets.forEach((t) => emit(12, () => ({ x: t.x + rnd(-50, 50), y: t.y + 80, vy: rnd(-160, -60), vx: 0, color: COL.green, size: rnd(2, 4), life: 900, drag: 0.99, fade: 'in-out' })));
    },
    async guard({ to }) {
      ring(to.x, to.y, { color: COL.blue, r0: 140, r1: 100, width: 8, dur: 500 });
      emit(14, () => ({ x: to.x + rnd(-80, 80), y: to.y + rnd(-110, 110), color: COL.silver, size: rnd(2, 4), speed: 15, life: 700, fade: 'in-out' }));
      await wait(200);
    },
    async item({ to }) {
      ring(to.x, to.y, { color: COL.gold, r1: 110 });
      emit(16, () => ({ x: to.x, y: to.y, color: COL.gold, shape: 'star', size: rnd(4, 7), speed: rnd(80, 220), life: 700 }));
      await wait(200);
    },
    async flash_lantern({ targets }) {
      anim(600, (k, c) => { c.globalCompositeOperation = 'lighter'; c.globalAlpha = (1 - k) * 0.9; c.fillStyle = '#fff6d0'; c.fillRect(0, 0, W, H); });
      targets.forEach((t) => flash(t.x, t.y, { color: COL.white, r: 200 }));
      await wait(150);
    },
    async befriend({ from, to }) {
      emit(8, (i) => ({ x: from.x, y: from.y, vx: (to.x - from.x) * rnd(0.9, 1.1), vy: (to.y - from.y) - 60, drag: 0.99, shape: 'heart', size: rnd(8, 12), color: i % 2 ? COL.pink : '#ffb7cf', spin: 0, rot: 0, life: 1000, delay: i * 60, fade: 'in-out' }));
      await wait(800);
    },
  };

  // ---------- foe effects ----------
  const FOE = {
    claw({ to }) { for (let i = 0; i < 3; i++) anim(240, (k, c) => { c.globalCompositeOperation = 'lighter'; c.strokeStyle = COL.red; c.lineWidth = 7 * (1 - k) + 1; c.globalAlpha = 1 - easeIn(k); const s = ease(Math.min(1, k * 2)); c.beginPath(); c.moveTo(to.x + 50 - i * 22, to.y - 60); c.lineTo(to.x + 50 - i * 22 - 90 * s, to.y - 60 + 120 * s); c.stroke(); }, i * 40); return wait(150).then(() => hit(to, { color: COL.red })); },
    bite({ to }) { anim(220, (k, c) => { c.strokeStyle = COL.white; c.lineWidth = 6; c.globalAlpha = 1 - k; const o = 40 * (1 - ease(k)); c.beginPath(); c.arc(to.x, to.y - o, 34, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke(); c.beginPath(); c.arc(to.x, to.y + o, 34, 1.2 * Math.PI, 1.8 * Math.PI); c.stroke(); }); return wait(120).then(() => hit(to, { color: COL.red })); },
    thorns({ from, to }) { for (let i = 0; i < 4; i++) setTimeout(() => projectile(from, { x: to.x + rnd(-20, 20), y: to.y + rnd(-20, 20) }, { dur: 320, color: '#9acb5a', size: 4, arc: 70, head: (c, p) => { c.translate(p.x, p.y); c.rotate(p.x / 20); c.fillStyle = '#6a8a3a'; c.beginPath(); c.moveTo(-9, 0); c.lineTo(0, -4); c.lineTo(9, 0); c.lineTo(0, 4); c.fill(); } }), (i * 60) / speed()); return wait(340).then(() => hit(to, { color: COL.green })); },
    splat({ from, to }) { return projectile(from, to, { dur: 420, color: COL.mud, size: 14, arc: 120, trail: false, head: (c, p) => { c.fillStyle = COL.mud; c.beginPath(); c.arc(p.x, p.y, 18, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.arc(p.x - 6, p.y - 6, 5, 0, TAU); c.fill(); } }).then(() => { emit(18, () => ({ x: to.x, y: to.y, color: COL.mud, shape: 'drop', size: rnd(4, 9), vy: rnd(-380, -120), vx: rnd(-260, 260), grav: 900, life: 800, drag: 0.99 })); hit(to, { color: COL.brown }); }); },
    glomp({ to }) { emit(16, () => ({ x: to.x, y: to.y, color: COL.mud, shape: 'drop', size: rnd(5, 10), vy: rnd(-300, -80), vx: rnd(-220, 220), grav: 900, life: 700 })); hit(to, { color: COL.brown }); return wait(100); },
    peck({ to }) { hit(to, { color: COL.brass }); emit(10, () => ({ x: to.x, y: to.y, color: COL.brass, shape: 'line', size: rnd(4, 8), width: 2, speed: rnd(200, 380), life: 300, spin: 0 })); emitLinesAligned(); return wait(80); },
    dive({ to }) { flash(to.x, to.y, { color: COL.brass, r: 180 }); hit(to, { color: COL.brass, big: true }); emit(10, () => ({ x: to.x, y: to.y + 60, color: COL.brown, shape: 'rock', size: rnd(3, 6), vy: rnd(-300, -100), vx: rnd(-200, 200), grav: 900, life: 700 })); return wait(80); },
    screech({ from, targets }) { for (let i = 0; i < 5; i++) ring(from.x, from.y, { color: COL.ice, r0: 30, r1: 900, width: 6, dur: 900, delay: i * 110 }); return wait(600).then(() => targets.forEach((t) => flash(t.x, t.y, { color: COL.ice, r: 80 }))); },
    slam({ to }) { ring(to.x, to.y + 100, { color: COL.brown, r1: 180, squash: 0.25, width: 10 }); emit(20, () => ({ x: to.x + rnd(-60, 60), y: to.y + 100, color: rnd(0, 1) > 0.5 ? COL.brown : COL.grey, shape: 'rock', size: rnd(4, 9), vy: rnd(-420, -160), vx: rnd(-220, 220), grav: 1000, life: 900 })); hit(to, { color: COL.brown, big: true }); return wait(100); },
    rumble({ targets }) { for (const t of targets) { emit(10, () => ({ x: t.x + rnd(-70, 70), y: t.y - 320 - rnd(0, 160), vy: rnd(150, 300), vx: 0, grav: 900, color: COL.grey, shape: 'rock', size: rnd(5, 11), life: 900, floor: t.y + 110 })); emit(8, () => ({ x: t.x + rnd(-80, 80), y: t.y + 110, color: '#8a7a6a', shape: 'smoke', size: rnd(30, 50), grow: 1.6, speed: 30, life: 1000, alpha: 0.6, fade: 'in-out' })); } return wait(420).then(() => targets.forEach((t) => hit(t, { color: COL.brown }))); },
    steam({ from, targets }) { for (const t of targets) emit(22, (i) => ({ x: from.x - 60, y: from.y - 40, vx: (t.x - from.x) * rnd(1.1, 1.6), vy: (t.y - from.y) * rnd(1, 1.4) + rnd(-80, 80), color: '#e8eef4', shape: 'smoke', size: rnd(26, 44), grow: 2, life: rnd(700, 1000), drag: 0.97, alpha: 0.8, delay: i * 14, fade: 'in-out' })); return wait(450).then(() => targets.forEach((t) => flash(t.x, t.y, { color: COL.white, r: 90 }))); },
    chill({ from, to }) { return projectile(from, to, { dur: 420, color: COL.ice, size: 11, wobble: 10 }).then(() => { emit(14, () => ({ x: to.x, y: to.y, color: COL.ice, shape: 'shard', size: rnd(6, 12), speed: rnd(100, 300), life: 700, drag: 0.92 })); hit(to, { color: COL.ice }); }); },
    whisper({ from, to }) { emit(30, (i) => ({ x: from.x, y: from.y, vx: (to.x - from.x) * rnd(0.9, 1.1), vy: (to.y - from.y) * rnd(0.9, 1.1) + Math.sin(i) * 60, color: '#7a5aa8', shape: 'smoke', size: rnd(14, 26), grow: 1.4, drag: 0.985, life: 1000, delay: i * 14, alpha: 0.7, fade: 'in-out' })); return wait(700).then(() => flash(to.x, to.y, { color: COL.purple, r: 90 })); },
  };

  // ---------- exits ----------
  function exit(kind, at) {
    switch (kind) {
      case 'leaves': emit(30, () => ({ x: at.x + rnd(-40, 40), y: at.y + rnd(-40, 40), color: rnd(0, 1) > 0.4 ? COL.leaf : '#a8c860', shape: 'leaf', size: rnd(5, 10), speed: rnd(80, 300), grav: 200, life: 1300, drag: 0.95 })); break;
      case 'splash': emit(28, () => ({ x: at.x, y: at.y + 40, color: COL.mud, shape: 'drop', size: rnd(4, 10), vy: rnd(-420, -160), vx: rnd(-240, 240), grav: 900, life: 900, drag: 0.99 })); break;
      case 'cogs': emit(26, (i) => ({ x: at.x + rnd(-50, 50), y: at.y + rnd(-50, 30), color: i % 3 ? COL.brass : '#b07a3a', shape: i % 4 ? 'cog' : 'line', size: rnd(6, 14), width: 3, vy: rnd(-520, -180), vx: rnd(-280, 280), grav: 1100, life: 1500, floor: at.y + 120, drag: 0.995, spin: rnd(-10, 10) })); flash(at.x, at.y, { color: COL.brass, r: 150 }); break;
      case 'bigcogs': emit(60, (i) => ({ x: at.x + rnd(-160, 160), y: at.y + rnd(-140, 60), color: i % 3 ? COL.brass : '#b07a3a', shape: i % 5 ? 'cog' : 'rock', size: rnd(8, 22), vy: rnd(-640, -200), vx: rnd(-420, 420), grav: 1100, life: 1900, floor: at.y + 200, drag: 0.995, spin: rnd(-8, 8) })); emit(20, () => ({ x: at.x + rnd(-150, 150), y: at.y + rnd(-60, 120), color: '#e8eef4', shape: 'smoke', size: rnd(40, 70), grow: 2, speed: 40, life: 1600, alpha: 0.7, fade: 'in-out' })); break;
      case 'shards': emit(30, (i) => ({ x: at.x, y: at.y, color: i % 2 ? COL.ice : COL.purple, shape: 'shard', size: rnd(5, 11), speed: rnd(120, 380), life: 1100, drag: 0.94 })); break;
      case 'dust': emit(24, () => ({ x: at.x + rnd(-120, 120), y: at.y + rnd(40, 180), color: '#9a8a78', shape: 'smoke', size: rnd(40, 70), grow: 1.8, speed: 30, life: 1500, alpha: 0.7, fade: 'in-out' })); break;
      case 'sparkles': emit(40, (i) => ({ x: at.x + rnd(-40, 40), y: at.y + rnd(-60, 40), color: i % 3 ? COL.silver : COL.gold, shape: i % 4 ? 'glow' : 'star', size: rnd(3, 8), vy: rnd(-200, -40), vx: rnd(-120, 120), life: rnd(800, 1500), drag: 0.97, fade: 'in-out' })); flash(at.x, at.y, { color: COL.silver, r: 140 }); break;
      case 'hearts': emit(16, (i) => ({ x: at.x + rnd(-50, 50), y: at.y + rnd(-40, 40), vy: rnd(-200, -90), vx: rnd(-50, 50), shape: 'heart', color: i % 2 ? COL.pink : '#ffd0e0', size: rnd(8, 14), life: 1500, spin: 0, rot: 0, drag: 0.99, fade: 'in-out' })); emit(20, () => ({ x: at.x, y: at.y, color: COL.gold, size: rnd(2, 4), speed: rnd(60, 200), life: 900 })); break;
      case 'revive': emit(30, () => ({ x: at.x + rnd(-60, 60), y: at.y + 100, vy: rnd(-300, -120), vx: 0, color: COL.gold, size: rnd(2, 5), life: 1000, drag: 0.98 })); ring(at.x, at.y + 100, { color: COL.gold, r1: 130, squash: 0.3 }); break;
      case 'phase': emit(34, (i) => ({ x: at.x + rnd(-140, 140), y: at.y + rnd(-120, 40), color: i % 2 ? COL.brass : '#9aa0a8', shape: i % 3 ? 'rock' : 'cog', size: rnd(8, 18), vy: rnd(-560, -200), vx: rnd(-380, 380), grav: 1100, life: 1700, floor: at.y + 200, drag: 0.995 })); flash(at.x, at.y, { color: COL.white, r: 260 }); ring(at.x, at.y, { color: COL.brass, r1: 260, width: 10 }); break;
      case 'steamburst': emit(46, (i) => ({ x: at.x + rnd(-150, 150), y: at.y + rnd(-90, 90), vx: rnd(-260, 260), vy: rnd(-320, -80), color: i % 4 ? '#e8eef4' : '#c9d2dc', shape: 'smoke', size: rnd(30, 56), grow: 2.2, life: rnd(1100, 1700), drag: 0.97, alpha: 0.75, delay: i * 18, fade: 'in-out' })); break;
      default: emit(20, () => ({ x: at.x, y: at.y, color: COL.gold, size: rnd(3, 6), speed: rnd(80, 260), life: 800 }));
    }
  }

  return {
    async play(id, o = {}) { const fn = FX[id] || FX.slash; try { await fn(o); } catch (e) { console.warn('[combat-fx]', id, e); } },
    async foe(id, o = {}) { const fn = FOE[id] || (o.targets?.length > 1 ? FOE.rumble : FOE.claw); try { await fn(o); } catch (e) { console.warn('[combat-fx foe]', id, e); } },
    hit, exit, ring, flash, has: (id) => !!FX[id], ids: () => Object.keys(FX),
    resize, dispose() { disposed = true; parts = []; anims = []; },
  };
}
