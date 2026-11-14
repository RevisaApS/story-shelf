// Grimspire title (GRIMSPIRE.md 3.1). gsTitle(ctx, { autoPick? }) -> 'new' | 'continue'
// Key art under a storm drawn on one canvas: slanting rain, rolling cloud shadow, ghost-green embers rising from
// the tower top, and lightning (a forked bolt with a glow, a full-stage flash and a thunder sfx) every few seconds.
// The steel-and-ember title cuts in letter by letter, the pack's three label lines sit under it, then
// New Hunt / Continue (only with a save) / Settings / Change story.
import { h, tap, wait } from '../../ui/dom.js';
import { L, tr } from '../../core/i18n.js';
import { icon, sfx } from '../hud.js';

const STR = L({
  en: { title: 'GRIMSPIRE', sub: 'Crown of the Bone King', newHunt: 'New Hunt', cont: 'Continue the hunt', settings: 'Settings', change: 'Change story', saved: (lv, f) => `Level ${lv}, floor ${f}` },
  da: { title: 'GRUMSPIR', sub: 'Benkongens krone', newHunt: 'Ny jagt', cont: 'Fortsæt jagten', settings: 'Indstillinger', change: 'Skift historie', saved: (lv, f) => `Niveau ${lv}, etage ${f}` },
});

export function stormSky(canvas, ctx, { onBolt } = {}) {
  const g = canvas.getContext('2d');
  const W = 1280, H = 800;
  let pr = 1, raf = 0, last = performance.now(), alive = true;
  const fit = () => { pr = Math.min(2, ctx.stage?.pixelRatio?.() || 1); canvas.width = Math.round(W * pr); canvas.height = Math.round(H * pr); };
  fit();
  const off = ctx.stage?.onResize?.(fit);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const reduce = () => !!ctx.settings?.reduceMotion || document.documentElement.classList.contains('lf-reduce');
  const rain = Array.from({ length: 260 }, () => ({ x: rnd(-200, W), y: rnd(-H, H), l: rnd(14, 34), v: rnd(900, 1500), a: rnd(0.12, 0.38), z: rnd(0.4, 1) }));
  const embers = Array.from({ length: 46 }, () => ({ x: rnd(560, 760), y: rnd(80, 520), vy: rnd(10, 32), vx: rnd(-8, 8), r: rnd(0.8, 2.4), age: rnd(0, 6), life: rnd(4, 9) }));
  const clouds = Array.from({ length: 7 }, (_, i) => ({ x: rnd(-300, W), y: rnd(-40, 210), r: rnd(180, 360), v: rnd(6, 18) * (i % 2 ? 1 : 0.7), a: rnd(0.25, 0.5) }));
  let bolt = null, flash = 0, nextBolt = performance.now() + 1600;
  const makeBolt = () => {
    const x0 = rnd(140, W - 140);
    const pts = [[x0, -10]];
    let x = x0, y = -10;
    const endY = rnd(H * 0.45, H * 0.75);
    while (y < endY) { y += rnd(26, 58); x += rnd(-48, 48); pts.push([x, y]); }
    const forks = [];
    for (let i = 2; i < pts.length - 1; i++) {
      if (Math.random() < 0.35) {
        const f = [[...pts[i]]]; let fx = pts[i][0], fy = pts[i][1]; const dir = Math.random() < 0.5 ? -1 : 1;
        for (let k = 0; k < 4; k++) { fy += rnd(20, 40); fx += dir * rnd(10, 40); f.push([fx, fy]); }
        forks.push(f);
      }
    }
    return { pts, forks, t: 0, life: 0.42 };
  };
  const path = (pts) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); };

  const frame = (now) => {
    if (!alive) return;
    const sp = window.__LF_SPEED || 1;
    const dt = Math.min(0.05, (now - last) / 1000) * (reduce() ? 0.3 : 1); last = now;
    g.setTransform(pr, 0, 0, pr, 0, 0);
    g.clearRect(0, 0, W, H);

    // cloud shadow rolling across the top
    for (const c of clouds) {
      c.x += c.v * dt; if (c.x - c.r > W) { c.x = -c.r; c.y = rnd(-40, 210); }
      const rg = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
      rg.addColorStop(0, `rgba(6,8,16,${c.a})`); rg.addColorStop(1, 'rgba(6,8,16,0)');
      g.fillStyle = rg; g.fillRect(c.x - c.r, c.y - c.r, c.r * 2, c.r * 2);
    }

    // ghost-green embers from the tower top
    g.globalCompositeOperation = 'lighter';
    for (const e of embers) {
      e.age += dt; e.y -= e.vy * dt; e.x += (e.vx + Math.sin(now / 900 + e.y * 0.03) * 10) * dt;
      if (e.age > e.life) Object.assign(e, { x: rnd(590, 720), y: rnd(150, 300), age: 0 });
      const a = Math.sin(Math.PI * (e.age / e.life));
      g.globalAlpha = a * 0.85; g.fillStyle = e.r > 1.8 ? '#b9ffd9' : '#6dffb0';
      g.beginPath(); g.arc(e.x, e.y, e.r, 0, 6.283); g.fill();
    }

    // rain
    g.globalCompositeOperation = 'source-over';
    g.lineCap = 'round';
    for (const r of rain) {
      r.y += r.v * dt * r.z; r.x += r.v * 0.22 * dt * r.z;
      if (r.y > H + 40) { r.y = rnd(-120, -10); r.x = rnd(-220, W); }
      g.globalAlpha = r.a * (0.6 + flash * 0.8);
      g.strokeStyle = flash > 0.2 ? '#e6f0ff' : '#9fb4d8';
      g.lineWidth = r.z * 1.2;
      g.beginPath(); g.moveTo(r.x, r.y); g.lineTo(r.x + r.l * 0.22, r.y + r.l); g.stroke();
    }

    // lightning
    if (!reduce() && now > nextBolt) {
      bolt = makeBolt(); flash = 1; nextBolt = now + rnd(3200, 7200) / sp;
      onBolt?.();
    }
    if (bolt) {
      bolt.t += dt;
      const k = Math.max(0, 1 - bolt.t / bolt.life);
      const flick = k * (0.6 + 0.4 * Math.sin(bolt.t * 90));
      g.globalCompositeOperation = 'lighter';
      for (const [w, c, a] of [[16, '120,170,255', 0.18], [6, '190,220,255', 0.5], [2.2, '255,255,255', 1]]) {
        g.globalAlpha = a * flick; g.strokeStyle = `rgb(${c})`; g.lineWidth = w; g.lineJoin = 'round';
        path(bolt.pts); g.stroke();
        for (const f of bolt.forks) { g.lineWidth = w * 0.55; path(f); g.stroke(); }
      }
      if (bolt.t > bolt.life) bolt = null;
    }
    if (flash > 0) {
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = flash * 0.22; g.fillStyle = '#b8ccff'; g.fillRect(0, 0, W, H);
      flash = Math.max(0, flash - dt * 2.6);
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return { stop() { alive = false; cancelAnimationFrame(raf); off?.(); } };
}

function changeStory() {
  const u = new URL(location.href);
  for (const k of ['game', 'auto', 'fast', 'floor', 'level', 'party', 'difficulty', 'scene']) u.searchParams.delete(k);
  u.searchParams.set('shelf', '1');
  location.href = u.toString();
}

export async function gsTitle(ctx, { autoPick = null } = {}) {
  const layer = ctx.stage.layers.screen;
  const saved = ctx.save?.load?.();
  const hasSave = !!saved && !autoPick;
  ctx.gm?.hide?.();
  ctx.hud?.hide?.();
  ctx.hud?.setBack?.(null);
  ctx.weather?.set?.('none');
  ctx.stage.hideActor?.('all');

  const canvas = h('canvas.gs-title-sky');
  const word = String(STR.title);
  const letters = h('h1.gs-title-word', { 'aria-label': word }, [...word].map((c, i) => h('span.gs-title-l', { style: { '--i': i } }, c)));
  const pack = ctx.pack || {};
  const label = pack.label || {};
  const lines = ['ages', 'tone', 'play'].map((k) => label[k] ? h('div.gs-title-label', { class: `is-${k}` }, tr(label[k])) : null);

  const btnNew = ctx.ui.button(STR.newHunt, { kind: 'primary', size: 'lg', cls: 'gs-title-btn', sfx: 'ui.confirm' });
  const btnCont = hasSave ? ctx.ui.button(STR.cont, { kind: 'gold', size: 'lg', cls: 'gs-title-btn is-cont', sfx: 'ui.confirm' }) : null;
  if (btnCont && saved) btnCont.appendChild(h('small.gs-title-saved', STR.saved(saved.level || 1, (saved.where && saved.where.floor) || Math.max(1, ...Object.entries(saved.floors || {}).filter(([, f]) => f.unlocked).map(([n]) => Number(n))))));
  const btnSet = ctx.ui.button(STR.settings, { kind: 'ghost', cls: 'gs-title-small', sfx: 'ui.open' });
  btnSet.prepend(icon('gear'));
  const btnShelf = ctx.ui.button(STR.change, { kind: 'ghost', cls: 'gs-title-small', sfx: 'ui.tap' });
  btnShelf.prepend(icon('book'));

  const root = h('div.gs-ts',
    h('div.gs-title-shade'), canvas, h('div.gs-title-vignette'), h('div.gs-title-flash'),
    h('div.gs-title-head',
      h('div.gs-title-glow'), letters,
      h('div.gs-title-rule', h('i'), h('b'), h('i')),
      h('div.gs-title-sub', tr(pack.sub) || STR.sub),
      h('div.gs-title-labels', lines)),
    h('div.gs-title-foot', h('div.gs-title-btns', hasSave ? [btnCont, btnNew] : [btnNew]), h('div.gs-title-smalls', btnSet, btnShelf)),
    h('div.gs-title-black'));
  layer.appendChild(root);

  const flashEl = root.querySelector('.gs-title-flash');
  const sky = stormSky(canvas, ctx, { onBolt: () => {
    flashEl.classList.remove('is-on'); void flashEl.offsetWidth; flashEl.classList.add('is-on');
    sfx(ctx, 'gs.storm', { volume: 0.55 });
  } });
  const bgP = ctx.stage.setBg('gs_title', { fade: 0.1 });
  ctx.audio.music('gs_title');
  const unlock = () => { try { ctx.audio.unlock(); } catch { /* ignore */ } ctx.audio.music('gs_title'); };
  root.addEventListener('pointerdown', unlock, { capture: true, once: true });

  await Promise.race([bgP, ctx.sleep(1500)]);
  await wait(30);
  root.classList.add('is-in');
  sfx(ctx, 'gs.bell', { volume: 0.7 });

  let resolve;
  const p = new Promise((r) => { resolve = r; });
  let settingsOpen = false;
  tap(btnNew, () => resolve('new'));
  if (btnCont) tap(btnCont, () => resolve('continue'));
  tap(btnSet, async () => { if (settingsOpen) return; settingsOpen = true; try { await ctx.screens.go('settings'); } finally { settingsOpen = false; } });
  tap(btnShelf, () => (ctx.toShelf ? ctx.toShelf() : changeStory()));
  const onKey = (e) => {
    if (ctx.stage.layers.overlay.childElementCount) return;
    if (e.target?.closest?.('button, a, input, select, textarea')) return;
    if (e.key === 'Enter') resolve(hasSave ? 'continue' : 'new');
  };
  window.addEventListener('keydown', onKey);
  if (ctx.auto || autoPick) ctx.sleep(1500).then(() => resolve(autoPick || 'new'));

  const choice = await p;
  window.removeEventListener('keydown', onKey);
  sfx(ctx, 'gs.bell');
  sfx(ctx, 'gs.roar', { volume: 0.4 });
  root.classList.add('is-leaving');
  await ctx.sleep(1000);
  sky.stop();
  root.remove();
  return choice;
}
