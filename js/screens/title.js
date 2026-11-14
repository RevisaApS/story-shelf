// Title screen (SPEC 11): titleScreen(ctx) -> 'new' | 'continue'
// The key art breathes (stage push-in), lanterns drift up and embers rise on a canvas, the gold title
// writes itself in, then Begin / Continue (only with a save) / Settings.
import { h, tap, wait } from '../ui/dom.js';
import { L, tr } from '../core/i18n.js';

// The title and subtitle come from the pack (packs.js) when there is one; the tagline is the pack's label line.
const STR = L({
  en: {
    title: 'LANTERNFALL', sub: 'The Sleepless Dragon', tag: 'A calm tale for ages 4 to 8',
    begin: 'Begin', cont: 'Continue', settings: 'Settings', shelf: 'Change story',
    hint: 'A tale for the whole table',
  },
  da: {
    title: 'LYGTEFALD', sub: 'Den søvnløse drage', tag: 'En rolig fortælling for de 4-8-årige',
    begin: 'Begynd', cont: 'Fortsæt', settings: 'Indstillinger', shelf: 'Skift historie',
    hint: 'En fortælling for hele bordet',
  },
});

// Lanterns and embers on one canvas. Returns { stop() }.
export function lanternSky(canvas, ctx, { lanterns = 26, embers = 60, area = null } = {}) {
  const g = canvas.getContext('2d');
  const W = 1280, H = 800;
  let pr = 1, raf = 0, last = performance.now(), alive = true;
  const fit = () => {
    pr = ctx.stage?.pixelRatio?.() || 1;
    canvas.width = Math.round(W * pr); canvas.height = Math.round(H * pr);
  };
  fit();
  const off = ctx.stage?.onResize?.(fit);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const reduce = () => !!ctx.settings?.reduceMotion;
  const box = area || { x0: 0, x1: W, y0: 0, y1: H };
  const mkL = (init) => {
    const depth = rnd(0.35, 1);
    return { x: rnd(box.x0, box.x1), y: init ? rnd(box.y0, box.y1) : box.y1 + rnd(10, 80), r: 3 + depth * depth * 9, depth,
      vy: 6 + depth * 12, sway: rnd(0.4, 1.2), ph: rnd(0, 6.28), flick: rnd(2, 5) };
  };
  const mkE = (init) => ({ x: rnd(box.x0, box.x1), y: init ? rnd(H * 0.3, box.y1) : box.y1 + 10, vy: rnd(14, 40), vx: rnd(-6, 6), life: rnd(3, 8), age: init ? rnd(0, 6) : 0, r: rnd(0.8, 2.1) });
  const L = Array.from({ length: lanterns }, () => mkL(true));
  const E = Array.from({ length: embers }, () => mkE(true));
  // Prebaked glow sprite
  const spr = document.createElement('canvas'); spr.width = spr.height = 128;
  const sg = spr.getContext('2d');
  const rg = sg.createRadialGradient(64, 64, 0, 64, 64, 64);
  rg.addColorStop(0, 'rgba(255,244,210,1)'); rg.addColorStop(0.14, 'rgba(255,214,130,0.95)');
  rg.addColorStop(0.32, 'rgba(255,160,70,0.35)'); rg.addColorStop(1, 'rgba(255,120,40,0)');
  sg.fillStyle = rg; sg.fillRect(0, 0, 128, 128);

  const frame = (now) => {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000) * (reduce() ? 0.25 : 1); last = now;
    const t = now / 1000;
    g.setTransform(pr, 0, 0, pr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (const l of L) {
      l.y -= l.vy * dt; l.x += Math.sin(t * l.sway + l.ph) * 6 * dt;
      if (l.y < box.y0 - 30) Object.assign(l, mkL(false));
      const fl = 0.82 + 0.18 * Math.sin(t * l.flick + l.ph);
      const fade = Math.min(1, (l.y - box.y0) / 120) * Math.min(1, (box.y1 + 60 - l.y) / 120);
      const s = l.r * 7;
      g.globalAlpha = Math.max(0, 0.75 * fl * fade * (0.5 + l.depth * 0.5));
      g.drawImage(spr, l.x - s / 2, l.y - s / 2, s, s);
      // Paper lantern body: a little rounded box, deep orange at the top, bright where the flame is.
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = Math.max(0, fade * (0.55 + l.depth * 0.45));
      const bw = l.r * 0.95, bh = l.r * 1.25, tilt = Math.sin(t * l.sway + l.ph) * 0.12;
      g.save(); g.translate(l.x, l.y); g.rotate(tilt);
      const lg = g.createLinearGradient(0, -bh, 0, bh);
      lg.addColorStop(0, '#c4561c'); lg.addColorStop(0.45, '#ffb04a'); lg.addColorStop(1, '#fff1b8');
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(-bw * 0.8, -bh); g.lineTo(bw * 0.8, -bh);
      g.quadraticCurveTo(bw * 1.15, 0, bw * 0.7, bh); g.lineTo(-bw * 0.7, bh);
      g.quadraticCurveTo(-bw * 1.15, 0, -bw * 0.8, -bh); g.fill();
      g.restore();
      g.globalCompositeOperation = 'lighter';
    }
    for (const e of E) {
      e.age += dt; e.y -= e.vy * dt; e.x += (e.vx + Math.sin(t * 2 + e.y * 0.02) * 8) * dt;
      if (e.age > e.life || e.y < -10) Object.assign(e, mkE(false));
      const a = Math.sin(Math.PI * (e.age / e.life));
      g.globalAlpha = Math.max(0, a * 0.9);
      g.fillStyle = e.r > 1.6 ? '#ffd27a' : '#ff9a4a';
      g.beginPath(); g.arc(e.x, e.y, e.r, 0, 6.283); g.fill();
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return { stop() { alive = false; cancelAnimationFrame(raf); off?.(); } };
}

export async function titleScreen(ctx) {
  const layer = ctx.stage.layers.screen;
  const hasSave = !!ctx.save?.exists?.();
  ctx.gm?.hide?.();
  ctx.hud?.hide?.();
  ctx.weather?.set?.('none');
  ctx.stage.hideActor?.('all');

  const pack = ctx.pack || null;
  const word = (pack ? tr(pack.title) : STR.title).toLocaleUpperCase();
  const subText = pack ? tr(pack.sub) : STR.sub;
  const tagText = pack?.tagline ? tr(pack.tagline) : STR.tag;
  const canvas = h('canvas.sa-title-sky');
  const letters = h('h1.sa-title-word', { 'aria-label': word },
    [...word].map((c, i) => h('span.sa-title-l', { style: { '--i': i } }, c)));
  const btnShelf = ctx.toShelf ? ctx.ui.button(STR.shelf, { kind: 'ghost', cls: 'sa-title-shelf', icon: 'book' }) : null;
  const btnBegin = ctx.ui.button(STR.begin, { kind: 'primary', size: 'lg', cls: 'sa-title-btn', sfx: 'ui.confirm' });
  const btnCont = hasSave ? ctx.ui.button(STR.cont, { kind: 'gold', size: 'lg', cls: 'sa-title-btn', sfx: 'ui.confirm' }) : null;
  const btnSet = ctx.ui.button(STR.settings, { kind: 'ghost', cls: 'sa-title-btn sa-title-set', icon: 'gear' });
  const root = h('div.sa-title',
    h('div.sa-title-shade'),
    canvas,
    h('div.sa-title-vignette'),
    h('div.sa-title-head',
      h('div.sa-title-glow'),
      letters,
      h('div.sa-title-rule', h('i'), h('b'), h('i')),
      h('div.sa-title-sub', subText),
      h('div.sa-title-tag', tagText)),
    btnShelf,
    h('div.sa-title-foot',
      h('div.sa-title-btns', hasSave ? [btnCont, btnBegin] : [btnBegin], btnSet),
      h('div.sa-title-hint', STR.hint)),
    h('div.sa-title-black'));
  layer.appendChild(root);

  const sky = lanternSky(canvas, ctx, { lanterns: 30, embers: 70 });
  const bgP = ctx.stage.setBg('title', { fade: 0.1 });
  ctx.audio.music('title');

  let unlocked = false;
  const unlock = () => {
    if (unlocked) return; unlocked = true;
    try { ctx.audio.unlock(); } catch { /* ignore */ }
    ctx.audio.music('title');
  };
  root.addEventListener('pointerdown', unlock, { capture: true });
  const keyUnlock = () => unlock();
  window.addEventListener('keydown', keyUnlock, { once: true });

  await Promise.race([bgP, ctx.sleep(1500)]);
  await wait(30);
  root.classList.add('is-in');

  let resolveChoice;
  const choiceP = new Promise((r) => { resolveChoice = r; });
  let settingsOpen = false;
  tap(btnBegin, () => { unlock(); resolveChoice('new'); });
  if (btnCont) tap(btnCont, () => { unlock(); resolveChoice('continue'); });
  if (btnShelf) tap(btnShelf, () => { unlock(); resolveChoice('shelf'); });
  tap(btnSet, async () => {
    unlock();
    if (settingsOpen) return;
    settingsOpen = true;
    try { await ctx.screens.go('settings'); } finally { settingsOpen = false; }
  });
  const onKey = (e) => {
    if (ctx.stage.layers.overlay.childElementCount) return;
    // a focused button handles its own Enter (Settings must not start the game)
    if (e.target?.closest?.('button, a, input, select, textarea, [role="button"]')) return;
    if (e.key === 'Enter') { unlock(); resolveChoice(hasSave ? 'continue' : 'new'); }
  };
  window.addEventListener('keydown', onKey);

  if (ctx.auto) ctx.sleep(1800).then(() => resolveChoice('new'));

  const choice = await choiceP;
  window.removeEventListener('keydown', onKey);
  window.removeEventListener('keydown', keyUnlock);
  ctx.audio.sfx(choice === 'continue' || choice === 'shelf' ? 'ui.confirm' : 'sting.wonder');
  root.classList.add('is-leaving');
  await ctx.sleep(1100);
  if (choice === 'shelf') { ctx.toShelf(); await new Promise(() => {}); }
  sky.stop();
  root.remove();
  return choice;
}
