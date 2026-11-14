// Rewards after a won battle (GRIMSPIRE.md 3.7, 4.7). gsRewards(ctx, { encId, encounter, floor, kind, battle, huntAgain })
//   -> { levels: [n..], gold, shards, xp }
// The XP bar fills (rolling over level marks), gold and Bone Shards count up, then the drops are revealed by
// gs-gear's 'gs.lootreveal' (which adds them to the bag and offers "Equip?"). Drops come from gs-gear's loot.js.
// Also: standInGear(ctx) -> { 'gs.armoury', 'gs.forge', 'gs.trophy', 'gs.lootreveal' } plain working stand-ins,
// registered by boot.js and replaced by gs-gear's registerGear(ctx) when that module is present.
import { h, wait } from '../../ui/dom.js';
import { L } from '../../core/i18n.js';
import { icon, countUp, sfx, pop, STRC } from '../hud.js';
import { autoEquip, heroScore } from './room.js';

const STR = L({
  en: {
    victory: 'Victory', bossDown: 'Boss defeated', eliteDown: 'Elite defeated', spoils: 'Claim the spoils', onward: 'Onward',
    xp: 'XP', gold: 'Gold', shards: 'Bone Shards', drops: (n) => (n === 1 ? 'Something dropped!' : `${n} things dropped!`),
    roll: 'A loot roll!', nothing: 'No drops this time', levelUp: 'Level up!', time: (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`,
    perfects: 'Perfect strikes', best: 'Best hit', battleTime: 'Battle time',
    // stand-ins
    found: 'You found', keep: 'Keep', bagTitle: 'The Armoury', bestAll: 'Equip the best', close: 'Close', empty: '(empty)',
    forgeTitle: "Hilda's Forge", buy: (p) => `Buy, ${p} gold`, trophyTitle: 'The Trophy Wall', met: 'Monsters met', weak: 'weak to', none: 'Nothing yet.',
    sodShop: "Sod's stall", poor: 'Not enough gold',
  },
  da: {
    victory: 'Sejr', bossDown: 'Bossen er slået', eliteDown: 'Eliten er slået', spoils: 'Tag byttet', onward: 'Videre',
    xp: 'XP', gold: 'Guld', shards: 'Benskår', drops: (n) => (n === 1 ? 'Noget faldt!' : `${n} ting faldt!`),
    roll: 'Et byttekast!', nothing: 'Intet bytte denne gang', levelUp: 'Nyt niveau!', time: (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`,
    perfects: 'Perfekte slag', best: 'Bedste slag', battleTime: 'Kamptid',
    found: 'Du fandt', keep: 'Behold', bagTitle: 'Våbenkammeret', bestAll: 'Tag det bedste på', close: 'Luk', empty: '(tom)',
    forgeTitle: 'Hildas smedje', buy: (p) => `Køb, ${p} guld`, trophyTitle: 'Trofævæggen', met: 'Mødte monstre', weak: 'svag mod', none: 'Intet endnu.',
    sodShop: 'Sods bod', poor: 'Ikke nok guld',
  },
});

const RARITY_COLOR = { common: '#b8c0cc', rare: '#4aa3ff', epic: '#b06bff', legendary: '#ffb02e' };

function ownedIds(st) {
  const ids = new Set(st.bag.map((x) => x.id));
  for (const hero of st.party) for (const slot of ['weapon', 'armour', 'helm', 'charm']) if (hero.gear[slot]) ids.add(hero.gear[slot].id);
  return [...ids];
}
const families = (ctx) => ctx.state.party.map((x) => ctx.content.heroes?.[x.arch]?.family).filter(Boolean);

function partyLuck(ctx) {
  let best = 0;
  for (const hero of ctx.state.party) best = Math.max(best, ctx.state.derived(hero.id)?.luck || 0);
  return Math.min(5, best);
}

function computeDrops(ctx, { encId, encounter, floor, kind }) {
  const st = ctx.state;
  const loot = ctx.gsMods.loot;
  const enc = { ...encounter, id: encId, kind: encounter.kind || kind };
  if (loot?.rollDrops) {
    try {
      let mods = {};
      try { mods = loot.findMods?.(ctx.content, st.party.map((x) => ({ ...x, derived: st.derived(x.id) }))) || {}; } catch { mods = {}; }
      const r = loot.rollDrops({ content: ctx.content, encounter: enc, floor, difficulty: st.difficulty, rng: ctx.rng, luck: partyLuck(ctx), owned: ownedIds(st), families: families(ctx), ...mods });
      return { gold: r.gold || 0, shards: r.shards || 0, items: r.items || [], roll: r.roll || null };
    } catch (e) { console.error('[grimspire] rollDrops threw; stand-in drops', e); }
  }
  // stand-in drops
  const foes = (encounter.foes || []).filter((f) => (f.min || 1) <= st.party.length);
  let gold = 0;
  for (const f of foes) { const g = ctx.content.foes?.[f.type]?.gold || [4, 8]; gold += ctx.rng.int(g[0], g[1]); }
  const items = [];
  const pool = Object.values(ctx.content.items || {}).filter((it) => ['weapon', 'armour', 'helm', 'charm'].includes(it.kind) && (!it.floor || it.floor <= floor + 1));
  if (pool.length && (kind === 'elite' || ctx.rng.chance(0.34))) items.push(ctx.rng.pick(pool).id);
  return { gold, shards: kind === 'boss' ? 6 : ctx.rng.chance(0.4) ? ctx.rng.int(1, 3) : 0, items, roll: kind === 'boss' ? { bonus: 6 } : null };
}

function computeXp(ctx, encId, encounter) {
  const R = ctx.gsMods.rules;
  const n = ctx.state.party.length;
  if (R?.xpFor) { try { const v = R.xpFor(ctx.content, encId, n); if (Number.isFinite(v)) return v; } catch (e) { console.warn('[grimspire] xpFor threw', e); } }
  let xp = 0;
  for (const f of encounter.foes || []) if ((f.min || 1) <= n) xp += ctx.content.foes?.[f.type]?.xp || 10;
  return xp;
}

export async function gsRewards(ctx, { encId, encounter = {}, floor = 1, kind = 'battle', battle = {}, huntAgain = false } = {}) {
  const st = ctx.state;
  const layer = ctx.stage.layers.screen;
  const drops = computeDrops(ctx, { encId, encounter, floor, kind });
  const xp = Math.round(computeXp(ctx, encId, encounter) * (huntAgain ? 0.8 : 1));
  const g0 = st.gold, s0 = st.shards;
  const lv0 = st.level;
  const before = st.xpInfo();

  ctx.gm.hide();
  ctx.hud.show();
  sfx(ctx, 'gs.victory');
  ctx.audio.music?.('gs_victory');

  const xpFill = h('i'), xpGhost = h('b');
  const xpBar = h('div.gs-rw-xpbar', xpGhost, xpFill);
  const xpNum = h('span', '0');
  const lvText = h('span.gs-rw-lv', `${STRC.level} ${lv0}`);
  const goldNum = h('b', '0'), shardNum = h('b', '0');
  const goldRow = h('div.gs-rw-coin.is-gold', icon('coin'), h('span', STR.gold), h('em', '+', goldNum));
  const shardRow = h('div.gs-rw-coin.is-shard', icon('shard'), h('span', STR.shards), h('em', '+', shardNum));
  const dropLine = h('div.gs-rw-drops');
  const btn = ctx.ui.button(STR.onward, { kind: 'primary', size: 'lg', sfx: 'ui.confirm', cls: 'gs-rw-btn' });
  btn.disabled = true;
  const stats = [];
  if (battle.perfects != null) stats.push([STR.perfects, battle.perfects]);
  if (battle.bestHit) stats.push([STR.best, battle.bestHit]);
  if (battle.seconds) stats.push([STR.battleTime, STR.time(battle.seconds)]);
  const kicker = kind === 'boss' ? STR.bossDown : kind === 'elite' ? STR.eliteDown : null;
  const box = h('div.gs-rw.gs-panel', { class: `is-${kind}` },
    h('div.gs-rw-rays'),
    kicker ? h('div.gs-kicker', kicker) : null,
    h('h1.gs-title.gs-rw-title', STR.victory),
    h('div.gs-rw-xp', h('div.gs-rw-xphead', lvText, h('span.gs-rw-xpgain', '+', xpNum, ' ', STR.xp)), xpBar),
    h('div.gs-rw-coins', goldRow, shardRow),
    stats.length ? h('div.gs-rw-stats', stats.map(([k, v]) => h('div', h('small', k), h('b', String(v))))) : null,
    dropLine,
    h('div.gs-rw-foot', btn));
  const root = h('div.gs-rw-wrap', { 'data-no-advance': '' }, box);
  layer.appendChild(root);
  await wait(20);
  root.classList.add('is-in');
  await ctx.sleep(450);

  // XP: fill to the end of each level crossed, then the remainder
  xpFill.style.setProperty('--v', before.pct);
  xpGhost.style.setProperty('--v', before.pct);
  const res = st.addXp(xp);
  countUp(xpNum, 0, xp, 900, ctx);
  sfx(ctx, 'gs.fury', { volume: 0.4 });
  for (const lv of res.levels) {
    xpGhost.style.setProperty('--v', 1);
    xpFill.style.setProperty('--v', 1);
    await ctx.sleep(650);
    sfx(ctx, 'gs.levelup');
    lvText.textContent = `${STRC.level} ${lv}`;
    pop(lvText);
    box.classList.add('is-leveled');
    xpFill.classList.add('no-anim'); xpGhost.classList.add('no-anim');
    xpFill.style.setProperty('--v', 0); xpGhost.style.setProperty('--v', 0);
    await wait(30);
    xpFill.classList.remove('no-anim'); xpGhost.classList.remove('no-anim');
  }
  const after = st.xpInfo();
  xpGhost.style.setProperty('--v', after.pct);
  xpFill.style.setProperty('--v', after.pct);
  await ctx.sleep(500);

  // gold and shards
  if (drops.gold) { st.addGold(drops.gold); sfx(ctx, 'gs.coin'); }
  if (drops.shards) st.addShards(drops.shards);
  await Promise.all([countUp(goldNum, 0, st.gold - g0, 800, ctx), countUp(shardNum, 0, st.shards - s0, 800, ctx)]);
  if (drops.shards) sfx(ctx, 'gs.bone', { volume: 0.6 });

  const nItems = drops.items.length + (drops.roll ? 1 : 0);
  dropLine.replaceChildren(nItems ? h('span.has', icon('chest'), drops.roll ? STR.roll : STR.drops(nItems)) : h('span', STR.nothing));
  if (nItems) {
    btn.querySelector('span').textContent = STR.spoils;
    btn.classList.add('is-loot');
  }
  btn.disabled = false;
  pop(btn);

  let done;
  const doneP = new Promise((r) => { done = r; });
  btn.addEventListener('click', () => done(), { once: true });
  if (ctx.auto) ctx.sleep(700).then(() => done());
  await doneP;
  btn.disabled = true;

  if (nItems) {
    root.classList.add('is-dim');
    const roll = drops.roll ? { luck: partyLuck(ctx), bonus: drops.roll.bonus ?? (kind === 'boss' ? 6 : 0), floor } : undefined;
    if (drops.roll) st.tallyAdd('chests');
    try { await ctx.screens.go('gs.lootreveal', { items: drops.items, roll, floor, title: kicker || STR.victory }); }
    catch (e) { console.error('[grimspire] lootreveal failed', e); for (const id of drops.items) st.addItem(id); }
    if (ctx.auto) autoEquip(ctx);
  }
  root.classList.remove('is-in');
  root.classList.add('is-out');
  await ctx.sleep(380);
  root.remove();
  return { levels: res.levels, gold: drops.gold, shards: drops.shards, xp };
}

// ---------------------------------------------------------------------------------------------------------
// Stand-ins for gs-gear's screens. Plain, but they work, so the loop never stalls on a missing module.
function nameOf(ctx, id) { return ctx.content.items?.[id]?.name || String(id).replace(/^gs_/, '').replace(/_/g, ' '); }
function rarityChip(ctx, id) {
  const r = ctx.content.items?.[id]?.rarity || 'common';
  return h('span.gs-si-item', { style: { '--rc': RARITY_COLOR[r] } }, nameOf(ctx, id), h('small', STRC.rarity[r] || r));
}

export function standInGear(ctx0) {
  return {
    async 'gs.lootreveal'(params = {}, ctx = ctx0) {
      const st = ctx.state;
      const ids = (params.items || []).map((x) => (typeof x === 'string' ? x : x.id));
      let rolled = null;
      if (params.roll) {
        const loot = ctx.gsMods.loot;
        if (loot?.rollPick) {
          try { rolled = loot.rollPick({ content: ctx.content, floor: params.roll.floor || 1, rng: ctx.rng, luck: params.roll.luck || 0, bonus: params.roll.bonus || 0, owned: ownedIds(st), families: families(ctx) }); } catch (e) { console.warn(e); }
        }
        if (!rolled) {
          const die = ctx.rng.d(20);
          rolled = { die, total: die + (params.roll.luck || 0) + (params.roll.bonus || 0), id: null };
          const pool = Object.values(ctx.content.items || {}).filter((it) => ['weapon', 'armour', 'helm', 'charm'].includes(it.kind));
          rolled.id = pool.length ? ctx.rng.pick(pool).id : null;
        }
        if (rolled?.id) ids.push(rolled.id);
      }
      const added = ids.filter(Boolean).map((id) => st.addItem(id));
      if (!added.length) return { items: [] };
      await ctx.ui.modal({
        kicker: STR.found, title: rolled ? `d20: ${rolled.die} = ${rolled.total}` : (params.title || STR.found),
        body: h('div.gs-si-list', added.map((x) => rarityChip(ctx, x.id))),
        buttons: [{ id: 'ok', label: STR.keep, kind: 'primary' }], cls: 'gs-standin',
      });
      return { items: added, rarity: rolled ? ctx.content.items?.[rolled.id]?.rarity : undefined, total: rolled?.total };
    },
    async 'gs.armoury'(_p = {}, ctx = ctx0) {
      const st = ctx.state;
      const body = () => h('div.gs-si-arm', st.party.map((hero) => h('div.gs-si-hero',
        h('b', hero.name), h('small', ` ${STRC.lv} ${st.level} · ${Math.round(heroScore(st.derived(hero.id)))}`),
        h('div.gs-si-list', ['weapon', 'armour', 'helm', 'charm'].map((slot) => hero.gear[slot] ? rarityChip(ctx, hero.gear[slot].id) : h('span.gs-si-item.is-empty', STR.empty))))),
      h('div.gs-si-bag', st.bag.map((x) => rarityChip(ctx, x.id))));
      for (;;) {
        const id = await ctx.ui.modal({ title: STR.bagTitle, body: body(), wide: true, cls: 'gs-standin',
          buttons: [{ id: 'best', label: STR.bestAll, kind: 'primary' }, { id: 'close', label: STR.close, kind: 'ghost', auto: true }] });
        if (id !== 'best') return;
        autoEquip(ctx);
        sfx(ctx, 'gs.equip');
      }
    },
    async 'gs.forge'(p = {}, ctx = ctx0) {
      const st = ctx.state;
      const shop = p?.shop ? ctx.content.shops?.[p.shop] : null;
      const stock = shop?.stock?.length ? shop.stock.map((s) => ({ id: s.item, price: s.price }))
        : Object.values(ctx.content.items || {}).filter((it) => it.kind === 'consumable' && it.price).map((it) => ({ id: it.id, price: it.price }));
      for (;;) {
        const buttons = stock.slice(0, 6).map((s) => ({ id: s.id, label: `${nameOf(ctx, s.id)}: ${STR.buy(s.price)}`, kind: st.gold >= s.price ? 'gold' : 'ghost' }));
        buttons.push({ id: 'close', label: STR.close, kind: 'ghost', auto: true });
        const id = await ctx.ui.modal({ title: shop ? STR.sodShop : STR.forgeTitle, body: h('p', `${st.gold} ${STRC.gold}`), buttons, wide: true, cls: 'gs-standin' });
        if (id === 'close' || !id) return;
        const s = stock.find((x) => x.id === id);
        if (s && st.gold >= s.price) { st.addGold(-s.price); st.addItem(s.id); sfx(ctx, 'gs.coin'); } else ctx.ui.toast(STR.poor, { kind: 'hurt' });
      }
    },
    async 'gs.trophy'(_p = {}, ctx = ctx0) {
      const st = ctx.state;
      const met = Object.entries(st.seenFoes);
      await ctx.ui.modal({ title: STR.trophyTitle, wide: true, cls: 'gs-standin',
        body: h('div.gs-si-list', met.length ? met.map(([id, v]) => {
          const f = ctx.content.foes?.[id];
          return h('span.gs-si-item', f?.name || id, v.weakKnown && f?.weak?.length ? h('small', `${STR.weak} ${f.weak.join(', ')}`) : null);
        }) : h('p', STR.none)),
        buttons: [{ id: 'ok', label: STR.close, kind: 'primary' }] });
    },
  };
}
