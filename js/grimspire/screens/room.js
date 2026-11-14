// The room runner (GRIMSPIRE.md 3.6, 3.7, 3.10) and the bridge to the shared step interpreter.
//
// runSteps(ctx, key, steps, { bg, music, ambience, weather, title, sub }) -> 'end' | 'defeat'
//   Runs SPEC 8.2 steps through screens/scene.js by registering a synthetic scene (id = key). The two
//   Grimspire steps are rewritten so scene.js runs them unchanged:
//     { loot: { roll, bonus } | { item } }  ->  { shop: { __gs: 'loot', spec } }   ('shop' is registered here)
//     { ambush: encounterId }               ->  { combat: id, win: [], lose: [{ goto: '__gs_defeat' }] }
//   ('combat' is registered here and runs the battle with rewards). A lost ambush ends the steps with 'defeat'.
// registerStepHooks(ctx)   registers 'shop' and 'combat'
// fight(ctx, encounterId, { floor, roomId, kind, huntAgain }) -> 'win' | 'lose'   battle + rewards + level up
// runRoom(ctx, floor, room, { hunt }) -> 'win' | 'lose'
// eventLoot(ctx, spec), autoEquip(ctx), autoPotions(ctx), heroScore(d)
import { h, wait } from '../../ui/dom.js';
import { L } from '../../core/i18n.js';
import { gsRewards } from './rewards.js';
import { gsLevelUp } from './levelup.js';
import { say, sfx, firstName, STRC } from '../hud.js';

const STR = L({
  en: {
    battleSoon: 'Battle', win: 'Win', lose: 'Lose', standin: 'The battle screen is still being forged. Decide how it went:',
    foes: 'Foes', rested: 'Rested: half Health back', ambush: 'Ambush!',
  },
  da: {
    battleSoon: 'Kamp', win: 'Vind', lose: 'Tab', standin: 'Kampskærmen bliver stadig smedet. Bestem selv, hvordan det gik:',
    foes: 'Fjender', rested: 'Hvilet: halvt Liv tilbage', ambush: 'Baghold!',
  },
});

// ---------- steps ----------
function tx(step) {
  if (step == null || typeof step !== 'object') return step;
  if (Array.isArray(step)) return step.map(tx);
  if ('loot' in step) return { shop: { __gs: 'loot', spec: step.loot } };
  if ('ambush' in step) return { combat: step.ambush, win: [], lose: [{ goto: '__gs_defeat' }] };
  const out = {};
  for (const [k, v] of Object.entries(step)) out[k] = (v && typeof v === 'object') ? tx(v) : v;
  return out;
}

export async function runSteps(ctx, key, steps, opts = {}) {
  if (!steps || !steps.length) return 'end';
  const id = String(key);
  ctx.content.scenes[id] = {
    id, title: opts.title || null, subtitle: opts.sub || null,
    bg: opts.bg || ctx.stage.bgId || null, music: opts.music || null, ambience: opts.ambience || null, weather: opts.weather || null,
    steps: [...tx(steps), { end: true }],
  };
  ctx.gsStepCtx = { floor: opts.floor || null, roomId: opts.roomId || null };
  const keepScene = ctx.state.scene;
  let res;
  try { res = await ctx.screens.go('scene', id, { resumed: false }); }
  catch (e) { console.error('[grimspire] steps failed', id, e); res = 'end'; }
  ctx.state.scene = keepScene || 'grimspire';
  ctx.gm.setActor(null);
  ctx.gm.hide();
  ctx.hud?.sceneTitle?.(null);
  return res === '__gs_defeat' ? 'defeat' : 'end';
}

export function registerStepHooks(ctx) {
  ctx.screens.register('shop', async (spec, c = ctx) => {
    if (spec && typeof spec === 'object' && spec.__gs === 'loot') return eventLoot(c, spec.spec || {});
    return c.screens.go('gs.forge', { shop: spec });
  });
  ctx.screens.register('combat', async (encId, _opts, c = ctx) => {
    if (_opts && !c.gm && _opts.gm) c = _opts; // called as (id, ctx)
    const where = c.gsStepCtx || {};
    c.gm.hide();
    await c.ui.banner(STR.ambush, { kind: 'fail', hold: 700 });
    const r = await fight(c, encId, { floor: where.floor || c.state.where?.floor || 1, roomId: where.roomId, kind: c.content.encounters?.[encId]?.kind || 'battle' });
    return { result: r, befriended: [], defeated: [] };
  });
}

export async function eventLoot(ctx, spec = {}) {
  ctx.gm.hide();
  const floor = ctx.gsStepCtx?.floor || ctx.state.where?.floor || 1;
  if (spec.item) {
    await ctx.screens.go('gs.lootreveal', { items: [spec.item] });
  } else {
    ctx.state.tallyAdd('chests');
    sfx(ctx, 'gs.chest');
    await ctx.screens.go('gs.lootreveal', { items: [], roll: { luck: partyLuck(ctx), bonus: spec.bonus || 0, floor } });
  }
  if (ctx.auto) autoEquip(ctx);
}

export function partyLuck(ctx) {
  let best = 0;
  for (const hero of ctx.state.party) best = Math.max(best, ctx.state.derived(hero.id)?.luck || 0);
  return Math.min(5, best);
}

// ---------- autoplay helpers ----------
export const heroScore = (d) => (d ? d.atk * 3 + d.def * 2.5 + d.hp / 4 + d.spd * 0.8 + d.luck * 0.8 + diceAvg(d.weapon?.dice) * 2 : 0);
function diceAvg(s) {
  const m = /^(\d+)d(\d+)(?:\+(\d+))?$/.exec(String(s || ''));
  return m ? (Number(m[1]) * (Number(m[2]) + 1)) / 2 + Number(m[3] || 0) : 0;
}
export function autoEquip(ctx) {
  const st = ctx.state;
  for (let pass = 0; pass < 2; pass++) {
    for (const hero of st.party) {
      for (const inst of [...st.bag]) {
        if (!st.slotOf(inst.id) || !st.canEquip(hero.id, inst.id)) continue;
        const slot = st.slotOf(inst.id);
        const before = heroScore(st.derived(hero.id));
        const prev = hero.gear[slot];
        if (!st.equip(hero.id, inst.uid)) continue;
        const after = heroScore(st.derived(hero.id));
        if (after <= before + 0.01) { if (prev) st.equip(hero.id, prev.uid); else st.unequip(hero.id, slot); }
      }
    }
  }
}
export function autoPotions(ctx, below = 0.4) {
  const st = ctx.state;
  const items = ctx.content.items || {};
  for (const hero of st.party) {
    if (hero.hp > 0 && hero.hp / hero.maxHp >= below) continue;
    const want = hero.hp <= 0 ? 'revive' : 'heal';
    const inst = st.bag.find((x) => items[x.id]?.kind === 'consumable' && items[x.id]?.use?.[want]);
    if (inst) st.useItem(inst.uid, { heroId: hero.id });
  }
}

// ---------- battle stand-in (until gs-battle's battle.js lands) ----------
async function battleStandIn(ctx, encId) {
  const enc = ctx.content.encounters?.[encId] || { foes: [] };
  const n = ctx.state.party.length;
  const names = (enc.foes || []).filter((f) => (f.min || 1) <= n).map((f) => ctx.content.foes?.[f.type]?.name || f.type);
  const winP = enc.kind === 'boss' ? 0.75 : 0.92;
  const id = await ctx.ui.modal({
    kicker: STR.battleSoon, title: names.join(', ') || encId,
    body: h('p.gs-standin-note', STR.standin),
    buttons: [{ id: 'win', label: STR.win, kind: 'primary', auto: true }, { id: 'lose', label: STR.lose, kind: 'ghost' }],
    cls: 'gs-standin',
  });
  const won = ctx.auto ? ctx.rng.chance(winP) : id === 'win';
  for (const hero of ctx.state.party) {
    if (won) ctx.state.damage(hero.id, Math.round(hero.maxHp * (0.1 + ctx.rng.float?.() * 0.35 || 0.25)), { floor: 0 });
    else ctx.state.damage(hero.id, hero.hp);
  }
  if (won && !ctx.state.living().length) ctx.state.heal(ctx.state.party[0].id, 1);
  ctx.state.tallyAdd('battles'); ctx.state.tallyAdd(won ? 'wins' : 'defeats');
  for (const f of enc.foes || []) ctx.state.seeFoe(f.type, false);
  return { result: won ? 'win' : 'lose', turns: 4, seconds: 60, perfects: 0, goods: 0, weaks: 0, perfectBlocks: 0, blocks: 0, bestHit: 0 };
}

function battleOpts(ctx, base) {
  const st = ctx.state;
  const o = { ...base };
  if (st.flag('gs.nextBattleEasy')) { o.foeHp = 0.75; st.setFlag('gs.nextBattleEasy', false); }
  const bl = st.flags['gs.blessing'];
  if (bl === 'fury') o.furyBonus = 2;
  if (bl === 'shield') o.shieldPct = 0.2;
  if (bl) st.setFlag('gs.blessing', false);
  return o;
}

// One battle with its rewards. 'win' | 'lose'
export async function fight(ctx, encId, { floor = 1, roomId = null, kind = 'battle', huntAgain = false } = {}) {
  const enc = ctx.content.encounters?.[encId] || { id: encId, kind };
  ctx.gm.hide();
  ctx.hud.hide();
  ctx.hud.setBack(null);
  const layer = ctx.stage.layers.screen;
  [...layer.children].forEach((c) => c.classList.add('gs-under-battle'));
  const opts = battleOpts(ctx, { floor, roomId, kind: enc.kind || kind, huntAgain, bg: enc.bg || ctx.content.floors?.[floor]?.bg || null });
  let res = null;
  const runBattle = ctx.gsMods.battle?.runBattle;
  ctx.bus.emit('gs:battle:start', { encId, ...opts });
  if (runBattle) {
    try { res = await runBattle(encId, opts, ctx); }
    catch (e) { console.error('[grimspire] runBattle threw; using the stand-in', e); res = null; }
  }
  if (!res) res = await battleStandIn(ctx, encId);
  ctx.bus.emit('gs:battle:end', { encId, ...res });
  [...layer.children].forEach((c) => c.classList.remove('gs-under-battle'));
  if (res.result !== 'win') return 'lose';
  ctx.state.standUp();
  const r = await gsRewards(ctx, { encId, encounter: enc, floor, kind: enc.kind || kind, battle: res, huntAgain });
  if (r?.levels?.length) await gsLevelUp(ctx, r.levels);
  if (ctx.auto) autoEquip(ctx);
  ctx.hud.show();
  return 'win';
}

// ---------- rooms ----------
export async function runRoom(ctx, floor, room, { hunt = false, encounter = null } = {}) {
  const st = ctx.state;
  const kind = room.kind;
  if (encounter || ['battle', 'elite', 'boss'].includes(kind)) {
    const encId = encounter || room.encounter || (room.pool ? ctx.rng.pick(room.pool) : null);
    if (!encId) { console.warn('[grimspire] room without encounter', room); return 'win'; }
    return fight(ctx, encId, { floor, roomId: room.id, kind: hunt ? 'battle' : kind, huntAgain: hunt });
  }
  if (kind === 'event') {
    const ev = ctx.content.events?.[room.event];
    if (!ev) { console.warn('[grimspire] missing event', room.event); return 'win'; }
    const fl = ctx.content.floors?.[floor];
    const r = await runSteps(ctx, `${floor}:${room.id}`, ev.steps, { bg: fl?.bg, title: ev.title, floor, roomId: room.id });
    if (r === 'defeat') return 'lose';
    for (const hero of st.party) if (hero.hp <= 0) st.heal(hero.id, 1);
    return 'win';
  }
  if (kind === 'rest') {
    await restRoom(ctx);
    return 'win';
  }
  console.warn('[grimspire] unknown room kind', kind);
  return 'win';
}

async function restRoom(ctx) {
  const layer = ctx.stage.layers.screen;
  const glow = h('div.gs-rest-glow', h('div.gs-rest-fire'), h('div.gs-rest-text', STR.rested));
  layer.appendChild(glow);
  await wait(20);
  glow.classList.add('is-in');
  sfx(ctx, 'heal');
  sfx(ctx, 'gs.fire', { volume: 0.5 });
  for (const hero of ctx.state.party) {
    if (hero.hp <= 0) ctx.state.heal(hero.id, Math.round(hero.maxHp * 0.5));
    else ctx.state.heal(hero.id, { pct: 0.5 });
  }
  await say(ctx, 'rest.room', 'hush');
  await ctx.sleep(900);
  glow.classList.remove('is-in');
  await ctx.sleep(500);
  glow.remove();
  ctx.gm.hide();
}

export { firstName, STRC };
