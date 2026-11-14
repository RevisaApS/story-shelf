// The fixed 1280 x 800 stage (SPEC 2), scaled to fit and centred, with a blurred backdrop for the bars.
// createStage(root, ctx) -> stage:
//   stage.el, stage.layers.{bg, actor, weather, screen, hud, gm, overlay, dice, fx, toast}, stage.W, stage.H
//   stage.scale, stage.pixelRatio()             devicePixelRatio x scale, for crisp canvases
//   stage.toStage(clientX, clientY) -> {x, y}   window -> stage pixels
//   stage.setBg(id|null, { fade=1.2, url? }) -> Promise   crossfade to assets/bg/<id>.webp (styled placeholder if missing)
//   stage.bgId                                    current background id
//   stage.showActor(npcId, { at='right', kind='char' }) -> Promise, stage.hideActor(npcId|'all') -> Promise
//   stage.fx('shake'|'flash'|'rumble'|'dim'|'undim'|'blur'|'unblur') -> Promise
//   stage.onResize(fn) -> off
import { h, wait } from './dom.js';

export const W = 1280, H = 800;
const LAYERS = ['bg', 'actor', 'weather', 'screen', 'hud', 'gm', 'overlay', 'dice', 'fx', 'toast'];

export function createStage(root, ctx) {
  const backdrop = h('div#backdrop', h('div.lf-backdrop-img'));
  const el = h('div#stage', { role: 'application', 'aria-label': 'Lanternfall' });
  const layers = {};
  for (const name of LAYERS) {
    layers[name] = h(`div#${name}-layer.lf-layer`);
    el.appendChild(layers[name]);
    if (name === 'weather') el.appendChild(h('div#dim-veil.lf-layer'));
  }
  root.append(backdrop, el);

  const resizeFns = new Set();
  const stage = { el, layers, W, H, scale: 1, bgId: null };
  const fit = () => {
    const vw = window.innerWidth, vh = window.innerHeight;
    stage.scale = Math.min(vw / W, vh / H);
    el.style.transform = `translate(-50%, -50%) scale(${stage.scale})`;
    document.documentElement.style.setProperty('--stage-scale', stage.scale);
    for (const fn of resizeFns) { try { fn(stage.scale); } catch (e) { console.error(e); } }
  };
  window.addEventListener('resize', fit);
  fit();

  stage.onResize = (fn) => { resizeFns.add(fn); return () => resizeFns.delete(fn); };
  stage.pixelRatio = () => Math.min(3, (window.devicePixelRatio || 1) * stage.scale);
  stage.toStage = (cx, cy) => {
    const r = el.getBoundingClientRect();
    return { x: ((cx - r.left) / r.width) * W, y: ((cy - r.top) / r.height) * H };
  };

  // Backgrounds
  let bgToken = 0;
  stage.setBg = async (id, { fade = 1.2, url = null } = {}) => {
    if (id === stage.bgId && !url) return;
    const token = ++bgToken;
    stage.bgId = id;
    const src = url || (id ? ctx.assets.bg(id) : null);
    const known = src ? ctx.assets.has(src) : false;
    const slide = h('div.lf-bg-slide', { style: { opacity: 0, transitionDuration: `${fade}s` } });
    let ok = false;
    if (src && known !== false) {
      ok = await new Promise((res) => {
        const img = new Image();
        img.onload = () => res(true); img.onerror = () => res(false);
        img.src = src;
        setTimeout(() => res(img.complete && img.naturalWidth > 0), 4000);
      });
    }
    if (token !== bgToken) return;
    if (ok) slide.appendChild(h('div.lf-bg-img', { style: { backgroundImage: `url("${src}")` } }));
    else slide.appendChild(h('div.lf-bg-placeholder', { dataset: { id: id || '' } }, h('span', id ? id.replace(/_/g, ' ') : '')));
    layers.bg.appendChild(slide);
    const bimg = backdrop.firstChild;
    bimg.style.backgroundImage = ok ? `url("${src}")` : 'none';
    await wait(20);
    slide.style.opacity = 1;
    await wait(fade * 1000 + 50);
    if (token !== bgToken) return;
    [...layers.bg.children].forEach((c) => { if (c !== slide) c.remove(); });
  };

  // Actors (NPC cutouts)
  const actors = new Map();
  const AT = { left: 250, center: 640, right: 1010, farleft: 140, farright: 1140 };
  // Per-character staging from npcs[id].stage (see js/content/npcs.js): size, feet height, facing, edge, fx.
  const place = (wrap, st, at) => {
    const edge = st.edge === 'right';
    wrap.classList.toggle('is-edge-right', edge);
    wrap.style.bottom = `${st.bottom ?? 30}px`;
    let x = edge ? W : (AT[at] ?? AT.right);
    if (edge) { wrap.style.left = ''; wrap.style.width = `${st.w || 800}px`; wrap.style.height = 'auto'; }
    else {
      const ht = st.h || 600;
      wrap.style.height = `${ht}px`; wrap.style.width = '';
      // keep the whole cutout on the stage (wide characters at left or right)
      const half = wrap._aspect ? (ht * wrap._aspect) / 2 : 0;
      if (half) x = Math.max(half + 8, Math.min(W - half - 8, x));
      wrap.style.left = `${Math.round(x)}px`;
    }
    // Cutouts look into the scene: mirror one that faces the near edge.
    const flip = st.face === 'left' ? x < W / 2 - 40 : st.face === 'right' ? x > W / 2 + 40 : false;
    wrap.classList.toggle('is-flipped', flip);
    wrap.dataset.at = at;
  };
  const dragonFx = () => h('div.lf-dragon-fx',
    h('i.lf-dragon-eye'), h('i.lf-dragon-smoke.s1'), h('i.lf-dragon-smoke.s2'), h('i.lf-dragon-smoke.s3'));
  stage.showActor = async (id, { at = 'right', kind = 'char' } = {}) => {
    const npc = ctx.content?.npcs?.[id] || ctx.content?.enemies?.[id];
    const st = npc?.stage || {};
    if (actors.has(id)) { place(actors.get(id), st, at); return; }
    const src = kind === 'char' ? ctx.assets.char(id) : ctx.assets.url(kind, id);
    const wrap = h('div.lf-actor', { dataset: { id, at }, class: [st.hover ? 'is-hover' : null, st.fx ? `fx-${st.fx}` : null].filter(Boolean).join(' ') || null });
    place(wrap, st, at);
    actors.set(id, wrap);
    const known = ctx.assets.has(src);
    const placeholder = () => {
      wrap.replaceChildren(h('div.lf-actor-ph', h('div.lf-actor-ph-body'), h('span', npc?.name || id.replace(/_/g, ' '))));
    };
    if (known === false) placeholder();
    else {
      const img = h('img.lf-actor-img', { alt: npc?.name || id, draggable: 'false' });
      img.onerror = placeholder;
      img.src = src;
      wrap.appendChild(h('div.lf-actor-body', img, st.fx === 'dragon' ? dragonFx() : null));
      // know the cutout's shape before it enters, so it can be kept fully on stage
      await Promise.race([img.decode().catch(() => {}), wait(1200)]);
      if (actors.get(id) !== wrap) return; // hidden again while loading
      if (img.naturalWidth) { wrap._aspect = img.naturalWidth / img.naturalHeight; place(wrap, st, at); }
    }
    layers.actor.appendChild(wrap);
    await wait(20);
    wrap.classList.add('is-in');
    await ctx.sleep(500);
  };
  stage.hideActor = async (id) => {
    const ids = id === 'all' ? [...actors.keys()] : [id];
    for (const k of ids) {
      const a = actors.get(k);
      if (!a) continue;
      actors.delete(k);
      a.classList.remove('is-in');
      a.classList.add('is-out');
      setTimeout(() => a.remove(), 700);
    }
    if (ids.length) await ctx.sleep(400);
  };
  stage.actors = () => [...actors.keys()];

  // Effects
  const veil = el.querySelector('#dim-veil');
  stage.fx = async (name) => {
    const reduce = ctx.settings?.reduceMotion;
    switch (name) {
      case 'shake': case 'rumble': {
        if (reduce) return;
        const cls = name === 'shake' ? 'lf-shake' : 'lf-rumble';
        el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
        await ctx.sleep(name === 'shake' ? 450 : 1100);
        el.classList.remove(cls);
        return;
      }
      case 'flash': {
        const f = h('div.lf-flash');
        layers.fx.appendChild(f);
        setTimeout(() => f.remove(), 900);
        await ctx.sleep(300);
        return;
      }
      case 'dim': veil.classList.add('is-on'); await ctx.sleep(500); return;
      case 'undim': veil.classList.remove('is-on'); await ctx.sleep(400); return;
      case 'blur': el.classList.add('lf-blurred'); return;
      case 'unblur': el.classList.remove('lf-blurred'); return;
      default: console.warn('[stage] unknown fx', name);
    }
  };

  return stage;
}
