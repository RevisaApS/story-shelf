// Map travel (SPEC 11): travel(nodeId, ctx) -> void
// The parchment map unrolls, visited places are inked in, the party token (first hero's portrait in a
// gold ring) walks the dotted path to the node, leaving inked footsteps, and the place name lands on a ribbon.
// About 3.5 seconds; a tap anywhere skips to the end.
import { h, wait } from '../ui/dom.js';
import { L } from '../core/i18n.js';

const STR = L({
  en: { kicker: 'Onward to', tap: 'Tap to continue' },
  da: { kicker: 'Videre mod', tap: 'Tryk for at fortsætte' },
});
const SVGNS = 'http://www.w3.org/2000/svg';
const sv = (tag, attrs = {}) => { const e = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };

// A gently bent curve between two points (alternating bend so the trail wanders).
function segD(a, b, i) {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const bend = Math.min(60, len * 0.18) * (i % 2 ? 1 : -1);
  return `M${a.x},${a.y} Q${mx - (dy / len) * bend},${my + (dx / len) * bend} ${b.x},${b.y}`;
}

export async function travel(nodeId, ctx) {
  const map = ctx.content?.map || { nodes: [], path: [] };
  const nodes = new Map((map.nodes || []).map((n) => [n.id, n]));
  const path = (map.path || []).filter((id) => nodes.has(id));
  const target = nodes.get(nodeId);
  if (!target) { console.warn('[map] unknown node', nodeId); return; }
  const ti = path.indexOf(nodeId);
  const fromId = ti > 0 ? path[ti - 1] : null;
  const from = fromId ? nodes.get(fromId) : null;
  const layer = ctx.stage.layers.screen;
  const gmWasBusy = ctx.gm?.isBusy?.();
  if (!gmWasBusy) ctx.gm?.hide?.();

  // --- build ---
  const svg = sv('svg', { class: 'sa-map-svg', viewBox: '0 0 1280 800' });
  const gAll = sv('g', { class: 'sa-map-trail' });
  const gInk = sv('g', { class: 'sa-map-ink' });
  const gSteps = sv('g', { class: 'sa-map-steps' });
  const gNodes = sv('g', { class: 'sa-map-nodes' });
  svg.append(gAll, gInk, gSteps, gNodes);
  let walkSeg = null;
  for (let i = 0; i < path.length - 1; i++) {
    const a = nodes.get(path[i]), b = nodes.get(path[i + 1]);
    const d = segD(a, b, i);
    gAll.appendChild(sv('path', { d }));
    if (i + 1 < ti) gInk.appendChild(sv('path', { d }));
    if (i + 1 === ti) walkSeg = sv('path', { d, class: 'sa-map-walkseg' });
  }
  if (walkSeg) gAll.appendChild(walkSeg);
  const nodeEls = new Map();
  for (const [i, id] of path.entries()) {
    const n = nodes.get(id);
    const state = id === nodeId ? 'target' : i < ti || ctx.state.flag(`seen.${id}`) ? 'visited' : 'unknown';
    const g = sv('g', { class: `sa-map-node is-${state}`, transform: `translate(${n.x},${n.y})` });
    g.append(sv('circle', { class: 'sa-map-node-glow', r: 26 }), sv('circle', { class: 'sa-map-node-ring', r: 12 }), sv('circle', { class: 'sa-map-node-dot', r: 6 }));
    gNodes.appendChild(g);
    nodeEls.set(id, g);
  }

  const lead = ctx.state.party?.[0];
  const token = h('div.sa-map-token', lead ? ctx.ui.portrait(lead.id, 'sm') : ctx.ui.portrait('gm', 'sm'), h('div.sa-map-token-shadow'));
  const start = from || target;
  token.style.transform = `translate(${start.x}px, ${start.y}px)`;
  const ribbon = h('div.sa-map-ribbon', h('div.sa-map-ribbon-k', STR.kicker), h('div.sa-map-ribbon-t', target.label || nodeId.replace(/_/g, ' ')));
  // The pin label sits under the node (above it near the bottom edge); it is left out when the node is
  // right under the title ribbon, which already names the place.
  const pinCls = target.y < 190 && Math.abs(target.x - 640) < 420 ? 'is-hidden' : target.y > 640 ? 'is-above' : null;
  const pin = h('div.sa-map-pinlabel', { class: pinCls, style: { left: `${Math.max(120, Math.min(1160, target.x))}px`, top: `${target.y}px` } }, target.label || '');
  const mapImg = h('div.sa-map-img');
  const mapSrc = ctx.assets.bg('world_map');
  if (ctx.assets.has(mapSrc) !== false) mapImg.style.backgroundImage = `url("${mapSrc}")`;
  else mapImg.classList.add('is-ph');
  const root = h('div.sa-map', h('div.sa-map-sheet', mapImg, h('div.sa-map-burn'), svg, pin, token), ribbon);
  layer.appendChild(root);

  let skipped = false;
  let resolveSkip;
  const skipP = new Promise((r) => { resolveSkip = r; });
  const onTap = () => { if (!skipped) { skipped = true; resolveSkip(); } };
  root.addEventListener('pointerdown', onTap);

  ctx.audio.sfx('ui.open');
  ctx.audio.sfx('whoosh', { volume: 0.5 });
  await wait(30);
  root.classList.add('is-in');
  await Promise.race([ctx.sleep(550), skipP]);

  // --- walk ---
  const speed = window.__LF_SPEED || 1;
  if (walkSeg && !skipped) {
    const L = walkSeg.getTotalLength();
    const dur = Math.max(300, Math.min(1700, L * 5)) / speed;
    const t0 = performance.now();
    let lastStep = -1;
    let stepSide = 1;
    root.classList.add('is-walking');
    ctx.audio.sfx('footsteps');
    await new Promise((res) => {
      const frame = (now) => {
        const k = skipped ? 1 : Math.min(1, (now - t0) / dur);
        const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        const p = walkSeg.getPointAtLength(e * L);
        const hop = Math.abs(Math.sin(e * L / 9)) * 6;
        token.style.transform = `translate(${p.x}px, ${p.y - hop}px)`;
        const stepIdx = Math.floor((e * L) / 16);
        while (lastStep < stepIdx) {
          lastStep++;
          const sp = walkSeg.getPointAtLength(Math.min(L, lastStep * 16));
          const q = walkSeg.getPointAtLength(Math.min(L, lastStep * 16 + 1));
          const ang = Math.atan2(q.y - sp.y, q.x - sp.x);
          stepSide = -stepSide;
          const ox = Math.cos(ang + Math.PI / 2) * 3.5 * stepSide, oy = Math.sin(ang + Math.PI / 2) * 3.5 * stepSide;
          gSteps.appendChild(sv('ellipse', { cx: sp.x + ox, cy: sp.y + oy, rx: 2.6, ry: 1.6, transform: `rotate(${(ang * 180) / Math.PI} ${sp.x + ox} ${sp.y + oy})` }));
        }
        if (k < 1) requestAnimationFrame(frame); else res();
      };
      requestAnimationFrame(frame);
    });
    root.classList.remove('is-walking');
  } else {
    token.style.transform = `translate(${target.x}px, ${target.y}px)`;
  }

  // --- arrive ---
  nodeEls.get(nodeId)?.classList.add('is-arrived');
  root.classList.add('is-arrived');
  ctx.audio.sfx('ui.confirm');
  const line = ctx.gm?.line?.('travel.go');
  if (line && !gmWasBusy && !skipped) ctx.gm.aside(line);
  await Promise.race([ctx.sleep(skipped ? 500 : 1250), skipP.then(() => ctx.sleep(400))]);
  root.removeEventListener('pointerdown', onTap);
  root.classList.add('is-leaving');
  await ctx.sleep(600);
  root.remove();
}
