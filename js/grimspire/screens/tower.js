// A tower floor (GRIMSPIRE.md 3.6, 3.8, 3.9). gsTower(ctx, n, { hunt, resumed }) -> 'camp'|'defeat'|'cleared'|'final'
// A cross-section of the floor: the rooms on their path (stage-pixel x,y from floors[n].map), an icon per kind,
// the fork between the elite and the rest, and the party's ember token that walks to the room you tap. Cleared
// rooms stay cleared; the branch not taken at a fork is closed off. "Back to camp" in the HUD and on the map.
// Hunting again: a cleared floor's rooms refill with battles from floors[n].huntAgain (rest rooms stay rests).
import { h, tap, wait } from '../../ui/dom.js';
import { L } from '../../core/i18n.js';
import { icon, sfx, say } from '../hud.js';
import { runRoom, runSteps, autoPotions } from './room.js';

const STR = L({
  en: {
    floor: (n) => `Floor ${n}`, hunting: 'Hunting again', kinds: { battle: 'Battle', elite: 'Elite', event: 'Event', rest: 'Rest', boss: 'Boss', chest: 'Chest' },
    fork: 'Choose your path: a hard fight for better loot, or a rest', pick: 'Tap the next room', back: 'Back to camp', cleared: 'Cleared',
    eliteHint: 'Harder, better loot', restHint: 'Heal half your Health',
  },
  da: {
    floor: (n) => `Etage ${n}`, hunting: 'På jagt igen', kinds: { battle: 'Kamp', elite: 'Elite', event: 'Hændelse', rest: 'Hvil', boss: 'Boss', chest: 'Kiste' },
    fork: 'Vælg vej: en hård kamp for bedre bytte, eller et hvil', pick: 'Tryk på det næste rum', back: 'Tilbage til lejren', cleared: 'Ryddet',
    eliteHint: 'Sværere, bedre bytte', restHint: 'Få halvt Liv tilbage',
  },
});
const KIND_ICON = { battle: 'battle', elite: 'elite', event: 'event', rest: 'rest', boss: 'boss', chest: 'chest' };

function preds(rooms, id) { return rooms.filter((r) => (r.next || []).includes(id)); }

function available(ctx, n, rooms) {
  const fs = ctx.state.floor(n);
  const st = fs.rooms || {};
  return rooms.filter((r) => {
    if (st[r.id]) return false;
    const p = preds(rooms, r.id);
    return !p.length || p.some((x) => st[x.id] === 'cleared');
  });
}

function huntPlan(ctx, n, f) {
  const fs = ctx.state.floor(n);
  if (fs.huntMap) return fs.huntMap;
  const pool = (f.huntAgain || []).filter((id) => ctx.content.encounters?.[id]);
  const map = {};
  let i = ctx.rng.int(0, Math.max(0, pool.length - 1));
  for (const r of f.map?.rooms || []) {
    if (r.kind === 'rest') continue;
    map[r.id] = pool.length ? pool[i++ % pool.length] : r.encounter || null;
  }
  fs.huntMap = map;
  return map;
}

export async function gsTower(ctx, n, { hunt = false, resumed = false } = {}) {
  const st = ctx.state;
  const f = ctx.content.floors?.[n];
  if (!f) { console.error('[grimspire] no floor', n); return 'camp'; }
  const fs = st.floor(n);
  const rooms = f.map?.rooms || [];
  if (hunt && !fs.hunting) { fs.rooms = {}; fs.hunting = true; fs.huntMap = null; fs.at = null; }
  if (!hunt && !resumed && fs.hunting) hunt = true;
  hunt = !!fs.hunting;
  const plan = hunt ? huntPlan(ctx, n, f) : null;
  st.where = { floor: n, room: fs.at || null };
  ctx.save.write(st);

  ctx.gm.hide();
  ctx.stage.hideActor?.('all');
  ctx.audio.music(f.music || 'gs_explore_a');
  ctx.audio.ambience?.(f.ambience || null);
  await ctx.stage.setBg(f.bg || `gs_floor${n}`, { fade: 1 });
  ctx.hud.show();

  // intro, once per floor (not when hunting again)
  if (!hunt && !st.flag(`gs.floorIntro.${n}`)) {
    st.setFlag(`gs.floorIntro.${n}`, true);
    ctx.hud.sceneTitle(f.name, f.sub);
    await runSteps(ctx, `gs.floor.${n}.intro`, f.intro || [], { bg: f.bg, floor: n });
  } else if (hunt && !Object.keys(fs.rooms).length) {
    ctx.hud.sceneTitle(f.name, STR.hunting);
    await say(ctx, 'hunt.again', 'fierce');
    ctx.gm.hide();
  } else ctx.hud.sceneTitle(f.name, f.sub);

  // ---------- the map ----------
  const layer = ctx.stage.layers.screen;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 1280 800');
  svg.setAttribute('class', 'gs-map-paths');
  const roomEls = {};
  const token = h('div.gs-pawn', h('i'), h('b'));
  const forkHint = h('div.gs-map-hint');
  const backBtn = h('button.gs-map-back', { type: 'button' }, icon('back'), h('span', STR.back));
  const root = h('div.gs-map', { 'data-no-advance': '', class: hunt ? 'is-hunt' : null },
    h('div.gs-map-shade'), h('div.gs-map-frame', h('i.tl'), h('i.tr'), h('i.bl'), h('i.br')),
    h('div.gs-map-head', h('div.gs-kicker', hunt ? STR.hunting : STR.floor(n)), h('div.gs-map-name', f.name)),
    svg, forkHint, token);
  const entry = rooms[0] ? { x: rooms[0].x > 640 ? rooms[0].x + 120 : rooms[0].x - 120, y: Math.min(770, rooms[0].y + 40) } : { x: 640, y: 760 };

  for (const r of rooms) {
    for (const nx of r.next || []) {
      const t = rooms.find((x) => x.id === nx);
      if (!t) continue;
      const mx = (r.x + t.x) / 2 + (t.y - r.y) * 0.12, my = (r.y + t.y) / 2 - (t.x - r.x) * 0.12;
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', `M${r.x} ${r.y} Q${mx} ${my} ${t.x} ${t.y}`);
      p.dataset.from = r.id; p.dataset.to = nx;
      svg.appendChild(p);
    }
    const encId = plan ? plan[r.id] : r.encounter;
    const kind = hunt && r.kind !== 'rest' ? 'battle' : r.kind;
    const bossName = r.kind === 'boss' && !hunt ? (ctx.content.encounters?.[r.encounter]?.foes || []).map((x) => ctx.content.foes?.[x.type]?.name).filter(Boolean)[0] : null;
    const el = h('button.gs-room', { type: 'button', class: `is-${kind}`, dataset: { room: r.id, kind }, style: { left: `${r.x}px`, top: `${r.y}px` } },
      h('span.gs-room-ring'), h('span.gs-room-core', icon(KIND_ICON[kind] || 'battle')), h('span.gs-room-check', icon('check')),
      h('span.gs-room-label', bossName || STR.kinds[kind] || kind, kind === 'elite' ? h('small', STR.eliteHint) : kind === 'rest' ? h('small', STR.restHint) : null));
    el.dataset.enc = encId || '';
    roomEls[r.id] = el;
    root.appendChild(el);
  }
  // entry path
  if (rooms[0]) {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', `M${entry.x} ${entry.y} L${rooms[0].x} ${rooms[0].y}`);
    p.dataset.from = 'entry'; p.dataset.to = rooms[0].id;
    svg.appendChild(p);
  }
  layer.appendChild(root);

  const placeToken = (pos, instant = false) => {
    if (instant) token.classList.add('no-anim');
    token.style.left = `${pos.x}px`; token.style.top = `${pos.y}px`;
    if (instant) { void token.offsetWidth; token.classList.remove('no-anim'); }
  };
  const posOf = (id) => { const r = rooms.find((x) => x.id === id); return r ? { x: r.x, y: r.y } : entry; };
  placeToken(fs.at ? posOf(fs.at) : entry, true);

  const paint = () => {
    const avail = new Set(available(ctx, n, rooms).map((r) => r.id));
    for (const r of rooms) {
      const v = fs.rooms[r.id];
      const el = roomEls[r.id];
      el.classList.toggle('is-cleared', v === 'cleared');
      el.classList.toggle('is-skipped', v === 'skipped');
      el.classList.toggle('is-open', avail.has(r.id));
      el.disabled = !avail.has(r.id);
    }
    for (const p of svg.querySelectorAll('path')) {
      const from = p.dataset.from, to = p.dataset.to;
      const walked = (from === 'entry' || fs.rooms[from] === 'cleared') && fs.rooms[to] === 'cleared';
      const next = (from === 'entry' ? !fs.at : fs.rooms[from] === 'cleared') && avail.has(to);
      p.setAttribute('class', walked ? 'is-walked' : next ? 'is-next' : fs.rooms[to] === 'skipped' ? 'is-dead' : '');
    }
    forkHint.textContent = avail.size > 1 ? STR.fork : avail.size ? STR.pick : '';
    forkHint.classList.toggle('is-fork', avail.size > 1);
    return avail;
  };
  paint();
  await wait(20);
  root.classList.add('is-in');

  let result = null;
  let resolveAll;
  const allP = new Promise((r) => { resolveAll = r; });
  const leave = (v) => { if (result) return; result = v; resolveAll(v); };
  const back = () => { if (!busy) { sfx(ctx, 'ui.close'); leave('camp'); } };
  ctx.hud.setBack(back);
  tap(backBtn, back, ctx, { sfx: 'ui.confirm' });

  let busy = false;
  const enter = async (r) => {
    if (busy || result) return;
    busy = true;
    ctx.hud.setLocked(true);
    ctx.hud.setBack(null);
    backBtn.disabled = true;
    const el = roomEls[r.id];
    el.classList.add('is-going');
    sfx(ctx, 'ui.confirm'); sfx(ctx, 'gs.swing', { volume: 0.4 });
    placeToken({ x: r.x, y: r.y });
    await ctx.sleep(750);
    root.classList.add('is-away');
    const kind = hunt && r.kind !== 'rest' ? 'battle' : r.kind;
    if (ctx.auto) autoPotions(ctx);
    st.where = { floor: n, room: fs.at || null };
    ctx.save.write(st);
    if (r.kind !== 'event') window.__LF?.path?.push(`${n}:${r.id}`); // event rooms enter the path as their scene id
    if (window.__LF) window.__LF.progress = (window.__LF.progress || 0) + 1;
    const out = await runRoom(ctx, n, { ...r, kind }, { hunt, encounter: hunt && kind !== 'rest' ? plan[r.id] : null });
    root.classList.remove('is-away');
    el.classList.remove('is-going');
    ctx.hud.show();
    if (out === 'lose') { placeToken(fs.at ? posOf(fs.at) : entry); await ctx.sleep(300); busy = false; leave('defeat'); return; }
    st.clearRoom(n, r.id);
    for (const p of preds(rooms, r.id)) for (const sib of p.next || []) if (sib !== r.id && !fs.rooms[sib]) fs.rooms[sib] = 'skipped';
    fs.at = r.id;
    st.where = { floor: n, room: r.id };
    ctx.save.write(st);
    paint();
    el.classList.add('is-justdone');
    sfx(ctx, 'gs.perfect', { volume: 0.5 });
    if (r.kind === 'boss') for (const fo of ctx.content.encounters?.[r.encounter]?.foes || []) if (!hunt && ctx.content.foes?.[fo.type]?.boss) st.addTrophy(fo.type);
    if (r.kind === 'boss' && !(r.next || []).length) { busy = false; leave(hunt ? 'huntdone' : 'boss'); return; }
    ctx.hud.setLocked(false);
    ctx.hud.setBack(back);
    backBtn.disabled = false;
    busy = false;
    if (ctx.auto) autoStep();
  };
  for (const r of rooms) tap(roomEls[r.id], () => enter(r), ctx, { sfx: null });

  const autoStep = () => {
    ctx.sleep(450).then(() => {
      if (result || busy) return;
      const avail = available(ctx, n, rooms);
      if (!avail.length) return leave('camp');
      // a sensible player walks back to Varg's free fire when the party is worn down or a boss is next
      const hp = st.party.reduce((a, x) => a + Math.max(0, x.hp) / x.maxHp, 0) / st.party.length;
      const potions = st.bag.filter((x) => ctx.content.items?.[x.id]?.use?.heal).length;
      const bossNext = avail.some((x) => x.kind === 'boss');
      if ((bossNext && hp < 0.85) || hp < 0.4 || (st.living().length < st.party.length && !potions)) return leave('camp');
      let pick = avail[0];
      if (avail.length > 1) {
        const healthy = st.living().length === st.party.length && st.party.every((x) => x.hp / x.maxHp > 0.6);
        pick = avail.find((x) => x.kind === (healthy ? 'elite' : 'rest')) || avail[0];
      }
      enter(pick);
    });
  };
  if (ctx.auto) autoStep();

  const res = await allP;
  ctx.hud.setBack(null);
  ctx.hud.setLocked(false);
  root.classList.add('is-leaving');
  await ctx.sleep(400);
  root.remove();
  ctx.audio.ambience?.(null);

  if (res === 'boss') {
    const last = n >= Math.max(...Object.keys(ctx.content.floors).map(Number));
    if (last) { if (ctx.content.foes?.gs_hollowcrown) st.addTrophy('gs_hollowcrown'); st.clearFloor(n); return 'final'; }
    sfx(ctx, 'gs.victory');
    await ctx.ui.banner(STR.cleared, { kind: 'crit', sub: f.name, hold: 1300 });
    await runSteps(ctx, `gs.floor.${n}.cleared`, f.cleared || [], { bg: f.bg, floor: n });
    st.clearFloor(n);
    fs.at = null;
    st.where = 'camp';
    ctx.save.write(st);
    return 'cleared';
  }
  if (res === 'huntdone') {
    fs.hunting = false; fs.huntMap = null; fs.at = null;
    for (const r of rooms) fs.rooms[r.id] = 'cleared';
    st.where = 'camp';
    await say(ctx, 'floor.cleared', 'excited');
    ctx.gm.hide();
    return 'cleared';
  }
  if (res === 'camp') { await say(ctx, 'tower.back', 'warm'); ctx.gm.hide(); }
  return res;
}
