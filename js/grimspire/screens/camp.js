// The Last Hearth, the camp hub (GRIMSPIRE.md 3.5), and the defeat beat (3.10).
// gsCamp(ctx, { welcome: 'first'|'back'|'return'|'cleared'|'defeat' }) -> { go: 'floor', floor, hunt }
//   Five glowing spots over the camp art: the Tower Gate (floor picker), the Forge (gs-gear's 'gs.forge'),
//   the Armoury ('gs.armoury'), Varg's Fire (free full heal and the next fire-side talk) and the Trophy Wall
//   ('gs.trophy'). A small banner bottom left changes the difficulty.
// gsDefeat(ctx) -> void   "Varg drags you back to the fire": full health, keep loot and XP, lose a fifth of the gold.
import { h, tap, wait } from '../../ui/dom.js';
import { L } from '../../core/i18n.js';
import { icon, sfx, say, STRC } from '../hud.js';
import { gsDifficulty } from './difficulty.js';
import { runSteps, autoEquip } from './room.js';

const STR = L({
  en: {
    title: 'The Last Hearth', sub: 'Camp at the foot of Grimspire',
    gate: 'Tower Gate', gateSub: 'Climb a floor', forge: 'The Forge', forgeSub: 'Hilda: buy, sell, upgrade',
    armoury: 'Armoury', armourySub: 'Gear up your hunters', fire: "Varg's Fire", fireSub: 'Rest and listen', fireHealed: 'Everyone is fully healed',
    trophy: 'Trophy Wall', trophySub: 'Bosses and monsters met',
    diff: 'Difficulty', diffs: { squire: 'Squire', knight: 'Knight', legend: 'Legend' },
    gateTitle: 'The Tower Gate', gateKicker: 'Choose a floor', floorN: (n) => `Floor ${n}`, climb: 'Climb', resume: 'Keep climbing', hunt: 'Hunt again', locked: 'Locked', cleared: 'Cleared',
    rooms: (a, b) => `${a} of ${b} rooms`, huntHint: 'Fresh monsters, more loot and XP', close: 'Stay at camp',
    downTitle: 'Knocked down', downSub: 'Varg drags you back to the fire', lost: (n) => `You dropped ${n} gold on the way down`, keep: 'You keep all your loot and XP. The room is still there.', wake: 'Get up',
  },
  da: {
    title: 'Det Sidste Bål', sub: 'Lejren ved foden af Grumspir',
    gate: 'Tårnporten', gateSub: 'Klatr op ad en etage', forge: 'Smedjen', forgeSub: 'Hilda: køb, sælg, forbedr',
    armoury: 'Våbenkammer', armourySub: 'Udstyr dine jægere', fire: 'Vargs bål', fireSub: 'Hvil og lyt', fireHealed: 'Alle har fuldt Liv igen',
    trophy: 'Trofævæg', trophySub: 'Bosser og mødte monstre',
    diff: 'Sværhed', diffs: { squire: 'Væbner', knight: 'Ridder', legend: 'Legende' },
    gateTitle: 'Tårnporten', gateKicker: 'Vælg en etage', floorN: (n) => `Etage ${n}`, climb: 'Klatr', resume: 'Klatr videre', hunt: 'Jag igen', locked: 'Låst', cleared: 'Ryddet',
    rooms: (a, b) => `${a} af ${b} rum`, huntHint: 'Nye monstre, mere bytte og XP', close: 'Bliv i lejren',
    downTitle: 'Slået ned', downSub: 'Varg slæber jer tilbage til bålet', lost: (n) => `I tabte ${n} guld på vejen ned`, keep: 'I beholder alt jeres bytte og al XP. Rummet er der stadig.', wake: 'Rejs jer',
  },
});

const SPOTS = [
  { id: 'gate', icon: 'gate', x: 640, y: 250 },
  { id: 'forge', icon: 'forge', x: 240, y: 420 },
  { id: 'armoury', icon: 'armoury', x: 420, y: 330 },
  { id: 'fire', icon: 'fire', x: 650, y: 440 },
  { id: 'trophy', icon: 'trophy', x: 1040, y: 400 },
];

const floorsOf = (ctx) => Object.values(ctx.content.floors || {}).sort((a, b) => a.n - b.n);
const roomCount = (f) => (f.map?.rooms || []).filter((r) => !/b$/.test(r.id) || r.kind !== 'rest').length;

function floorProgress(ctx, f) {
  const rooms = ctx.state.floor(f.n).rooms || {};
  const done = Object.values(rooms).filter((v) => v === 'cleared').length;
  const total = new Set((f.map?.rooms || []).map((r) => r.id.replace(/[ab]$/, ''))).size;
  return { done: Math.min(done, total), total };
}

async function gatePicker(ctx) {
  const st = ctx.state;
  const floors = floorsOf(ctx);
  return new Promise((resolve) => {
    const rows = floors.slice().reverse().map((f) => {
      const fs = st.floor(f.n);
      const prog = floorProgress(ctx, f);
      const open = fs.unlocked;
      const inProgress = open && !fs.cleared && prog.done > 0;
      const btns = [];
      if (open && !fs.cleared) btns.push(ctx.ui.button(inProgress ? STR.resume : STR.climb, { kind: 'primary', sfx: 'ui.confirm', onClick: () => close({ go: 'floor', floor: f.n, hunt: false }) }));
      if (fs.cleared) btns.push(ctx.ui.button(STR.hunt, { kind: 'gold', sfx: 'ui.confirm', onClick: () => close({ go: 'floor', floor: f.n, hunt: true }) }));
      return h('div.gs-gate-floor', { class: [open ? 'is-open' : 'is-locked', fs.cleared ? 'is-cleared' : null].filter(Boolean).join(' '), dataset: { n: f.n } },
        h('div.gs-gate-n', h('small', STR.floorN(f.n).split(' ')[0]), h('b', String(f.n))),
        h('div.gs-gate-info', h('div.gs-gate-name', f.name), h('div.gs-gate-sub', fs.cleared ? STR.huntHint : open ? (prog.done ? STR.rooms(prog.done, prog.total) : f.sub || '') : STR.locked)),
        fs.cleared ? h('div.gs-gate-badge', icon('check'), STR.cleared) : !open ? h('div.gs-gate-badge.is-lock', icon('lock')) : null,
        h('div.gs-gate-btns', btns));
    });
    const closeBtn = ctx.ui.button(STR.close, { kind: 'ghost', onClick: () => close(null) });
    const box = h('div.gs-gate.gs-panel', h('div.gs-kicker', STR.gateKicker), h('h2.gs-title', STR.gateTitle), h('div.gs-gate-tower', rows), h('div.gs-gate-foot', closeBtn));
    const wrap = h('div.gs-gate-wrap', { 'data-no-advance': '' }, box);
    let done = false;
    function close(v) { if (done) return; done = true; sfx(ctx, v ? 'gs.bell' : 'ui.close'); wrap.classList.remove('is-in'); setTimeout(() => wrap.remove(), 350); resolve(v); }
    ctx.stage.layers.overlay.appendChild(wrap);
    sfx(ctx, 'ui.open');
    requestAnimationFrame(() => wrap.classList.add('is-in'));
    if (ctx.auto) {
      ctx.sleep(500).then(() => {
        const open = floors.filter((f) => st.floor(f.n).unlocked && !st.floor(f.n).cleared);
        const cleared = floors.filter((f) => st.floor(f.n).cleared);
        if (ctx.gsGrind > 0 && cleared.length) { ctx.gsGrind--; return close({ go: 'floor', floor: cleared[cleared.length - 1].n, hunt: true }); }
        if (open.length) return close({ go: 'floor', floor: open[open.length - 1].n, hunt: false });
        const cl = floors.filter((f) => st.floor(f.n).cleared);
        close(cl.length ? { go: 'floor', floor: cl[cl.length - 1].n, hunt: true } : null);
      });
    }
  });
}

async function vargsFire(ctx, spotEl) {
  const st = ctx.state;
  spotEl?.classList.add('is-burning');
  sfx(ctx, 'gs.fire'); sfx(ctx, 'heal', { volume: 0.6 });
  const hurt = st.party.some((x) => x.hp < x.maxHp);
  st.fullHeal();
  if (hurt) ctx.ui.toast(STR.fireHealed, { kind: 'info', ms: 2200 });
  const talks = ctx.content.story?.camp?.fire || [];
  const i = st.count('gs.fire');
  st.addCounter('gs.fire', 1);
  if (i < talks.length) await runSteps(ctx, `gs.fire.${i}`, talks[i], { bg: 'gs_camp' });
  else await say(ctx, 'camp.rest', 'hush');
  spotEl?.classList.remove('is-burning');
  ctx.gm.hide();
}

// autoplay: spend gold and shards on upgrades like a sensible player (weapons first, then armour, helm, charm),
// keeping enough gold for a few draughts. Uses gs-gear's upgradeCost when its forge module is present.
async function autoUpgrade(ctx) {
  const st = ctx.state;
  let cost = null;
  try { cost = (await import('./forge.js')).upgradeCost; } catch { cost = null; }
  if (!cost) cost = (item, plus = 0) => ({ gold: Math.max(10, Math.round((item?.price || 60) * 0.15 * (plus + 1))), shards: plus + 1 });
  const reserve = 20 * st.party.length;
  for (let pass = 0; pass < 3; pass++) {
    for (const slot of ['weapon', 'armour', 'helm', 'charm']) {
      for (const hero of st.party) {
        const inst = hero.gear[slot];
        if (!inst || (inst.plus || 0) >= 3) continue;
        const c = cost(ctx.content.items?.[inst.id], inst.plus || 0);
        if (st.gold - c.gold < reserve || st.shards < c.shards) continue;
        st.addGold(-c.gold); st.addShards(-c.shards);
        inst.plus = (inst.plus || 0) + 1;
        st.refreshHero(hero.id);
      }
    }
  }
}

function autoShop(ctx) {
  const st = ctx.state;
  const items = Object.values(ctx.content.items || {});
  const heal = items.filter((it) => it.kind === 'consumable' && it.use?.heal && it.price).sort((a, b) => a.price - b.price)[0];
  const feather = items.find((it) => it.kind === 'consumable' && it.use?.revive && it.price);
  const have = (id) => st.bag.filter((x) => x.id === id).length;
  if (feather && have(feather.id) < 1 && st.gold >= feather.price * 2) { st.addGold(-feather.price); st.addItem(feather.id); }
  while (heal && have(heal.id) < st.party.length + 1 && st.gold >= heal.price * 1.5) { st.addGold(-heal.price); st.addItem(heal.id); }
}

export async function gsCamp(ctx, { welcome = 'return' } = {}) {
  const st = ctx.state;
  const layer = ctx.stage.layers.screen;
  ctx.gm.hide();
  ctx.stage.hideActor?.('all');
  ctx.weather?.set?.('embers');
  ctx.audio.music('gs_camp');
  ctx.audio.ambience?.('campfire');
  await ctx.stage.setBg('gs_camp', { fade: 0.9 });
  ctx.hud.show();
  ctx.hud.setBack(null);
  ctx.hud.sceneTitle(STR.title, STR.sub);

  const diffLabel = h('b', STR.diffs[st.difficulty] || st.difficulty);
  const diffBtn = h('button.gs-camp-diff', { type: 'button' }, icon('shield'), h('span', STR.diff), diffLabel);
  const spotEls = {};
  // no data-no-advance here: while Varg talks, a tap on the open ground advances his line like in a scene
  const root = h('div.gs-camp',
    h('div.gs-camp-shade'),
    SPOTS.map((s, i) => {
      const el = h('button.gs-spot', { type: 'button', class: `is-${s.id}`, dataset: { spot: s.id }, style: { left: `${s.x}px`, top: `${s.y}px`, '--d': `${i * 0.31}s` } },
        h('span.gs-spot-ring'), h('span.gs-spot-ring.r2'),
        h('span.gs-spot-core', icon(s.icon)),
        h('span.gs-spot-label', STR[s.id], h('small', STR[`${s.id}Sub`])));
      spotEls[s.id] = el;
      return el;
    }),
    diffBtn);
  layer.appendChild(root);
  await wait(20);
  root.classList.add('is-in');

  let busy = true;

  let resolve;
  const p = new Promise((r) => { resolve = r; });
  // a tap on a spot while Varg talks moves his line on (and points at the box) instead of doing nothing
  const nudgeTalk = () => {
    if (!ctx.gm.advance?.()) return;
    const panel = document.querySelector('.lf-narration');
    if (panel) { panel.classList.remove('is-nudge'); void panel.offsetWidth; panel.classList.add('is-nudge'); setTimeout(() => panel.classList.remove('is-nudge'), 450); }
  };
  const act = async (id) => {
    if (busy) { nudgeTalk(); return; }
    busy = true;
    ctx.hud.setLocked(true);
    const el = spotEls[id];
    el?.classList.add('is-hit');
    setTimeout(() => el?.classList.remove('is-hit'), 500);
    try {
      if (id === 'gate') {
        await say(ctx, 'camp.gate', 'ominous');
        ctx.gm.hide();
        const r = await gatePicker(ctx);
        if (r) { resolve(r); return; }
      } else if (id === 'forge') await ctx.screens.go('gs.forge', {});
      else if (id === 'armoury') await ctx.screens.go('gs.armoury', {});
      else if (id === 'trophy') await ctx.screens.go('gs.trophy', {});
      else if (id === 'fire') await vargsFire(ctx, el);
    } catch (e) { console.error('[gs-camp]', id, e); }
    ctx.hud.setLocked(false);
    ctx.hud.refresh();
    ctx.gm.hide();
    ctx.save.write(st);
    busy = false;
  };
  for (const s of SPOTS) tap(spotEls[s.id], () => act(s.id), ctx, { sfx: 'ui.confirm' });
  tap(diffBtn, async () => {
    if (busy) { nudgeTalk(); return; }
    busy = true;
    st.difficulty = await gsDifficulty(ctx, { current: st.difficulty, fromCamp: true });
    diffLabel.textContent = STR.diffs[st.difficulty];
    ctx.save.write(st);
    busy = false;
  }, ctx, { sfx: 'ui.open' });

  // the welcome talk runs with the spots already wired, so a tap on one moves Varg's line on
  if (welcome === 'first' && !st.flag('gs.campSeen')) {
    st.setFlag('gs.campSeen', true);
    const fv = ctx.content.story?.camp?.firstVisit || [];
    if (fv.length) await runSteps(ctx, 'gs.camp.first', fv, { bg: 'gs_camp' });
  } else if (welcome === 'back') await say(ctx, 'welcome.back', 'warm');
  else if (welcome === 'return') await say(ctx, 'camp.welcome', 'warm');
  ctx.gm.hide();
  busy = false;

  if (ctx.auto) {
    (async () => {
      await ctx.sleep(300);
      if (st.party.some((x) => x.hp < x.maxHp) || st.count('gs.fire') === 0) await act('fire');
      autoEquip(ctx);
      if (st.gold >= 30) await act('forge');
      autoShop(ctx);
      await autoUpgrade(ctx);
      autoEquip(ctx);
      await act('gate');
    })();
  }

  const go = await p;
  ctx.hud.setLocked(false);
  ctx.hud.sceneTitle(null);
  root.classList.add('is-leaving');
  await ctx.sleep(450);
  root.remove();
  ctx.audio.ambience?.(null);
  ctx.weather?.set?.('none');
  return go;
}

export async function gsDefeat(ctx) {
  const st = ctx.state;
  ctx.gm.hide();
  ctx.hud.hide();
  sfx(ctx, 'gs.defeat');
  ctx.audio.music(null);
  const lost = Math.floor((st.gold || 0) / 5);
  const layer = ctx.stage.layers.overlay;
  const btn = ctx.ui.button(STR.wake, { kind: 'primary', size: 'lg', sfx: 'ui.confirm' });
  btn.hidden = true;
  const root = h('div.gs-defeat', { 'data-no-advance': '' },
    h('div.gs-defeat-black'),
    h('div.gs-defeat-box',
      h('div.gs-defeat-skull', icon('skull')),
      h('h1.gs-title', STR.downTitle), h('div.gs-sub', STR.downSub),
      lost ? h('div.gs-defeat-lost', icon('coin'), STR.lost(lost)) : null,
      h('p.gs-defeat-keep', STR.keep), btn));
  layer.appendChild(root);
  await wait(20);
  root.classList.add('is-in');
  await ctx.sleep(1200);
  await ctx.stage.setBg('gs_camp', { fade: 1.4 });
  if (lost) st.addGold(-lost);
  st.fullHeal();
  st.where = 'camp';
  ctx.save.write(st);
  root.classList.add('is-dawn');
  await say(ctx, 'defeat.dragged', 'warm');
  btn.hidden = false;
  let done;
  const p = new Promise((r) => { done = r; });
  btn.addEventListener('click', () => done(), { once: true });
  if (ctx.auto) ctx.sleep(500).then(() => done());
  await p;
  ctx.gm.hide();
  root.classList.remove('is-in');
  await ctx.sleep(500);
  root.remove();
}

export { STR as CAMP_STR, roomCount, STRC };
