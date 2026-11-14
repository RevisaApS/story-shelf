// Lanternfall battle rules (SPEC 5, Combat to Items). Pure: no DOM, no ctx. combat.js plays the results;
// tools/combat-sim.mjs runs them headless.
//
// createBattle({ content, encounterId, party, rng, flags?, inventory?, hp75? }) -> battle
// heroActions(b, unit) -> [{ id, name, text, cost, target, enabled, why, great?, item? }]
// targetsFor(b, unit, action) -> [unit]           who may be picked for an action
// beginHeroTurn(b, unit) -> effects               +1 Spark, Guard and Vow wear off
// resolveHeroAction(b, unit, actionId, targetUids) -> [result]  (Twin Arrows gives two)
// beginFoeTurn(b, foe) -> { skip: null|'stunned'|'asleep', effects }
// chooseFoeIntent(b, foe) -> { move, targets:[uid], pending }
// resolveFoeIntent(b, foe, intent) -> result
// maybeAnnounce(b, foe) -> { move, target } | null  pick the next move ahead when it is marked announce
// endTurn(b, unit)                                statuses tick down
// mercyHalf(b) -> effects|null                    half the party dazed: foes -2 to hit and one second wind
// outcome(b) -> null|'win'|'befriend'|'wipe'
// rewind(b), fleeAll(b) -> effects, finish(b) -> { befriended, defeated }
// buildQueue(b) -> [uid]                          heroes and foes alternate, heroes first, party order
// chooseAI(b, unit, { mode:'attack'|'sensible', kind }) -> { action, targets }
//
// A result: { actor, action, name, fx, kind:'attack'|'check'|'auto'|'befriend'|'guard'|'item'|'foe',
//   roll?: { dice, dropped, die, bonus, total, crit, fumble, vs:[{ uid, need, hit }] }, outcome:'hit'|'miss'|'crit'|'fumble'|'use',
//   effects:[ { t, target, ... } ] }
// Effect kinds: dmg {n, hp, weak, protectFor?} heal {n, hp, revive} status {s} unstatus {s} calm {n, calm, liked}
//   out {how:'fled'|'befriended'} daze phase sparks {n, sparks} coins {n} star {n} useItem {id} wake extra clear
import * as R from '../core/rules.js';
import { L } from '../core/i18n.js';

// Unspoken action text a player reads in the battle bar (content names come through the content dictionary).
const STR = L({
  en: {
    strike: 'Strike', strikeText: (die, stat) => `A free attack (${die} + ${stat}).`, stat: 'stat',
    needsSparks: (n) => `Needs ${n} Sparks`, noTarget: 'Nobody to use it on',
    befriend: 'Befriend', soothe: 'Soothe',
    befriendText: 'Win a foe over with Heart. Fill its calm and it goes home happy.',
    sootheText: 'Calm a bad dream with Heart. Fill its calm and it fades away happy.',
    noneToBefriend: 'Nobody left to befriend',
    guard: 'Guard', guardText: 'Brace yourself: attacks on you roll twice and take the lower. +1 Spark.',
    item: 'Item', itemText: 'Use something from the pack.', packEmpty: 'The pack is empty.', noItems: 'No items',
  },
  da: {
    strike: 'Angreb', strikeText: (die, stat) => `Et gratis angreb (${die} + ${stat}).`, stat: 'evne',
    needsSparks: (n) => `Kræver ${n} Gnister`, noTarget: 'Ingen at bruge den på',
    befriend: 'Bliv venner', soothe: 'Berolig',
    befriendText: 'Gør en fjende til din ven med Hjerte. Fyld dens ro, så går den glad hjem.',
    sootheText: 'Berolig en ond drøm med Hjerte. Fyld dens ro, så svæver den glad væk.',
    noneToBefriend: 'Ingen tilbage at blive venner med',
    guard: 'Værn', guardText: 'Gør dig klar: angreb på dig slår to gange og tager det laveste. +1 Gnist.',
    item: 'Ting', itemText: 'Brug noget fra tasken.', packEmpty: 'Tasken er tom.', noItems: 'Ingen ting',
  },
});
// content's befriend.verb is 'Befriend' or 'Soothe' (compared raw); this is the name a player sees
const verbName = (v) => (v === 'Soothe' ? STR.soothe : !v || v === 'Befriend' ? STR.befriend : v);

export const BAD_HERO = ['shaken', 'worried'];
export const BAD_FOE = ['stunned', 'asleep', 'tangled', 'marked', 'blinded', 'drowsy'];
export const FLYERS = ['rattlewing', 'flutterfang', 'nightmare_wisp'];
const NO_SPARK_COST = ['strike', 'befriend', 'guard'];

const perkSum = (h, key) => (h.perks || []).reduce((s, p) => s + (p?.effect?.[key] || 0), 0);
const perkVal = (h, key) => { let v = null; for (const p of h.perks || []) if (p?.effect?.[key]) v = p.effect[key]; return v; };

export function createBattle({ content, encounterId, party, rng, flags = {}, inventory = {} }) {
  const enc = content.encounters[encounterId];
  if (!enc) throw new Error('Unknown encounter ' + encounterId);
  const n = party.length;
  const heroes = party.map((h, i) => ({
    uid: 'h' + i, side: 'hero', id: h.id, arch: h.arch, name: h.name, hero: h, def: content.heroes?.[h.arch] || {},
    hp: Math.max(0, Math.min(h.hp, h.maxHp)), maxHp: h.maxHp, level: h.level || 1,
    sparks: Math.min(R.SPARKS.max, R.SPARKS.start + perkSum(h, 'sparks')),
    st: {}, dazed: h.hp <= 0, everDazed: h.hp <= 0,
  }));
  const foes = enc.foes.filter((f) => n >= (f.min || 1)).map((f, i) => {
    const def = content.enemies[f.type];
    // SPEC 5, party size: a lone hero meets foes with -25% hearts, bosses -50%
    const hp = n <= 1 ? Math.max(1, Math.round(def.hp * (def.boss ? 0.5 : 0.75))) : def.hp;
    return {
      uid: 'f' + i, side: 'foe', type: f.type, def, name: f.name || def.name, hp, maxHp: hp, st: {},
      calm: 0, resolve: def.resolve || 0,
      canCalm: !!def.befriend && enc.canBefriend !== false && (def.resolve || 0) > 0,
      boss: !!def.boss, gone: null, phase2: false, pending: null, stunPen: 0,
    };
  });
  return {
    enc, content, heroes, foes, rng, flags, inventory: { ...inventory },
    round: 0, current: null, foeHitMod: 0, halfMercy: false, wipes: 0,
    stats: { nat20: 0, nat1: 0, rolls: 0 }, partySize: n,
  };
}

// ---------- lookups ----------
export const unit = (b, uid) => b.heroes.find((u) => u.uid === uid) || b.foes.find((u) => u.uid === uid) || null;
export const livingHeroes = (b) => b.heroes.filter((u) => !u.dazed);
export const activeFoes = (b) => b.foes.filter((u) => !u.gone);
export const stat = (u, s) => R.statValue(u.hero, s);
export const heroGuard = (u) => R.guard(u.hero);
export function foeGuard(b, f) {
  let g = f.phase2 && f.def.phase?.atHalf?.guard != null ? f.def.phase.atHalf.guard : f.def.guard;
  if (f.st.tangled) g -= 2;
  if (f.st.drowsy) g -= 2;
  return g;
}
const hasTag = (tags, list) => (tags || []).some((t) => (list || []).includes(t));
const powerOf = (u, id) => (u.def.powers || []).find((p) => p.id === id) || null;

function setStatus(b, u, s, n = 1, extra = {}) {
  u.st[s] = { n, fresh: b.current === u.uid, ...extra };
  return { t: 'status', target: u.uid, s };
}

function rollDice(b, expr, crit = false) {
  const p = R.parseDice(expr || '1d4');
  const count = p.count * (crit ? 2 : 1);
  const dice = Array.from({ length: count }, () => b.rng.d(p.sides || 4));
  return { dice, sides: p.sides, total: dice.reduce((s, x) => s + x, 0) + p.mod };
}

// One d20 for a hero: inspired +2, shaken -1, worried = worse of two. Both are used up by the roll.
function heroD20(b, u, bonus, { critOn = 20 } = {}) {
  const worst = !!u.st.worried;
  const mods = (u.st.inspired ? 2 : 0) - (u.st.shaken ? 1 : 0);
  delete u.st.worried; delete u.st.shaken;
  const a = b.rng.d(20);
  let dice = [a], die = a, dropped = null;
  if (worst) { const c = b.rng.d(20); dice = [a, c]; die = Math.min(a, c); dropped = a <= c ? 1 : 0; }
  // a Star reroll (SPEC 5): roll again and keep the better die
  if (b.keepBetter != null) { const k = b.keepBetter; b.keepBetter = null; dice = [k, die]; dropped = k >= die ? 1 : 0; die = Math.max(k, die); }
  const co = Math.min(critOn, R.critOn(u.hero));
  const crit = die >= co;
  const fumble = !crit && die === 1;
  b.stats.rolls++;
  if (die === 20) b.stats.nat20++;
  if (die === 1) b.stats.nat1++;
  return { dice, dropped, die, bonus: bonus + mods, total: die + bonus + mods, crit, fumble, worried: worst, inspired: !!u.st.inspired };
}

function attackRoll(b, u, targets, { stat: s, critOn = 20 }) {
  const r = heroD20(b, u, stat(u, s), { critOn });
  r.vs = targets.map((t) => {
    const g = foeGuard(b, t) - (t.st.marked ? 2 : 0);
    return { uid: t.uid, need: g, hit: r.crit || (!r.fumble && r.total >= g) };
  });
  return r;
}

function checkRoll(b, u, s, dc) {
  const r = heroD20(b, u, stat(u, s));
  r.vs = [{ need: dc, hit: r.crit || (!r.fumble && r.total >= dc) }];
  return r;
}

// ---------- damage, healing, calm ----------
function hurtFoe(b, f, n, out, { weak = false, crit = false } = {}) {
  if (f.gone) return;
  f.hp = Math.max(0, f.hp - n);
  out.push({ t: 'dmg', target: f.uid, n, hp: f.hp, weak, crit });
  if (f.st.asleep) { delete f.st.asleep; out.push({ t: 'wake', target: f.uid }); }
  const ph = f.def.phase?.atHalf;
  if (ph && !f.phase2 && f.hp > 0 && f.hp <= f.maxHp / 2) {
    f.phase2 = true;
    out.push({ t: 'phase', target: f.uid, guard: ph.guard, acts: ph.actsPerRound || 1 });
  }
  if (f.hp <= 0) { f.gone = 'fled'; f.st = {}; f.pending = null; out.push({ t: 'out', target: f.uid, how: 'fled' }); }
}

function calmFoe(b, f, n, out, liked = false) {
  if (f.gone || !f.canCalm) return;
  f.calm = Math.min(f.resolve, f.calm + n);
  out.push({ t: 'calm', target: f.uid, n, calm: f.calm, resolve: f.resolve, liked });
  if (f.calm >= f.resolve) { f.gone = 'befriended'; f.st = {}; f.pending = null; out.push({ t: 'out', target: f.uid, how: 'befriended' }); }
}

function healHero(b, u, n, out, { revive = false } = {}) {
  if (u.dazed && !revive) return;
  const was = u.dazed;
  u.hp = Math.min(u.maxHp, u.hp + n);
  if (u.hp > 0) u.dazed = false;
  out.push({ t: 'heal', target: u.uid, n, hp: u.hp, revive: was && !u.dazed });
}

function hurtHero(b, u, n, out, extra = {}) {
  if (u.dazed) return;
  u.hp = Math.max(0, u.hp - n);
  out.push({ t: 'dmg', target: u.uid, n, hp: u.hp, ...extra });
  if (u.hp <= 0) {
    u.dazed = true; u.everDazed = true; u.st = {};
    for (const o of b.heroes) if (o.st.protected?.by === u.uid) delete o.st.protected;
    out.push({ t: 'daze', target: u.uid });
  }
}

function addSparks(u, n, out) {
  const before = u.sparks;
  u.sparks = Math.max(0, Math.min(R.SPARKS.max, u.sparks + n));
  if (u.sparks !== before) out.push({ t: 'sparks', target: u.uid, n: u.sparks - before, sparks: u.sparks });
}

function clearBad(u, out) {
  const list = u.side === 'hero' ? BAD_HERO : BAD_FOE;
  if (list.some((s) => u.st[s])) { for (const s of list) delete u.st[s]; out.push({ t: 'clear', target: u.uid }); }
}

// ---------- hero actions ----------
const consumables = (b) => Object.entries(b.inventory)
  .filter(([id, q]) => q > 0 && b.content.items?.[id]?.kind === 'consumable' && b.content.items[id].use)
  .map(([id]) => b.content.items[id])
  .filter((it) => itemUseful(b, it));

function itemUseful(b, it) {
  const u = it.use;
  return !!(u.heal || u.sparks || u.blindAll || u.star || u.clear);
}

function itemTarget(it) {
  const u = it.use;
  if (u.blindAll) return 'allFoes';
  if (u.who === 'all') return 'allAllies';
  if (u.heal) return 'ally';
  return 'self';
}

export function likedBy(b, u, f) {
  const likes = f.def.likes || [];
  if (!likes.length) return null;
  const tagPower = (u.def.powers || []).find((p) => hasTag(p.tags, likes));
  if (tagPower) return { kind: 'tag', tag: likes.find((l) => (tagPower.tags || []).includes(l)) };
  const item = likes.find((l) => (b.inventory[l] || 0) > 0);
  if (item) return { kind: 'item', id: item };
  return null;
}

export function heroActions(b, u) {
  const d = u.def;
  const acts = [];
  const strikeDie = perkVal(u.hero, 'strikeDie') || d.strike?.die || '1d6';
  acts.push({ id: 'strike', name: d.strike?.name || STR.strike, text: STR.strikeText(strikeDie, R.STAT_NAMES[d.attackStat] || STR.stat), cost: 0, target: 'foe', fx: d.strike?.fx, enabled: true, kind: 'strike' });
  for (const p of d.powers || []) {
    if (p.great && u.level < 3) continue;
    const cost = p.cost ?? (p.great ? R.SPARKS.great : R.SPARKS.power);
    const okSparks = u.sparks >= cost;
    const tg = p.target === 'ally' && ['guardians_vow', 'encore'].includes(p.id) ? 'allyOther' : p.target === 'ally' && p.id === 'mending_light' ? 'allyAny' : p.target;
    const targetsOk = targetsFor(b, u, { target: tg }).length > 0 || ['allFoes', 'allAllies', 'self'].includes(tg);
    acts.push({ id: p.id, name: p.name, text: p.text, cost, great: !!p.great, target: tg, fx: p.fx, tags: p.tags || [], kind: 'power',
      enabled: okSparks && targetsOk, why: !okSparks ? STR.needsSparks(cost) : !targetsOk ? STR.noTarget : null });
  }
  const calmable = activeFoes(b).filter((f) => f.canCalm);
  if (b.enc.canBefriend !== false && b.foes.some((f) => f.canCalm)) {
    const verb = b.foes.find((f) => f.canCalm)?.def.befriend?.verb || 'Befriend';
    acts.push({ id: 'befriend', name: verbName(verb), text: verb === 'Soothe' ? STR.sootheText : STR.befriendText,
      cost: 0, target: 'calmFoe', enabled: calmable.length > 0, why: calmable.length ? null : STR.noneToBefriend, kind: 'befriend' });
  }
  acts.push({ id: 'guard', name: STR.guard, text: STR.guardText, cost: 0, target: 'self', enabled: true, kind: 'guard' });
  const items = consumables(b);
  acts.push({ id: 'item', name: STR.item, text: items.length ? STR.itemText : STR.packEmpty, cost: 0, target: 'item', enabled: items.length > 0, why: items.length ? null : STR.noItems, kind: 'item',
    items: items.map((it) => ({ id: 'item:' + it.id, itemId: it.id, name: it.name, text: it.text, qty: b.inventory[it.id], target: itemTarget(it), enabled: true })) });
  return acts;
}

export function targetsFor(b, u, a) {
  switch (a.target) {
    case 'foe': return activeFoes(b);
    case 'calmFoe': return activeFoes(b).filter((f) => f.canCalm);
    case 'ally': return livingHeroes(b);
    case 'allyAny': return b.heroes.filter((x) => x.dazed || x.hp < x.maxHp).length ? b.heroes.filter((x) => x.dazed || x.hp < x.maxHp) : livingHeroes(b);
    case 'allyOther': return livingHeroes(b).filter((x) => x !== u);
    case 'allFoes': return activeFoes(b);
    case 'allAllies': return livingHeroes(b);
    case 'self': return [u];
    default: return [];
  }
}

export function beginHeroTurn(b, u) {
  b.current = u.uid;
  const out = [];
  if (u.st.guarded) { delete u.st.guarded; out.push({ t: 'unstatus', target: u.uid, s: 'guarded' }); }
  for (const o of b.heroes) if (o.st.protected?.by === u.uid) { delete o.st.protected; out.push({ t: 'unstatus', target: o.uid, s: 'protected' }); }
  addSparks(u, R.SPARKS.perTurn, out);
  return out;
}

function dmgStat(u, s) { return stat(u, s); }

export function resolveHeroAction(b, u, actionId, targetUids = []) {
  b.current = u.uid;
  const tgs = targetUids.map((id) => unit(b, id)).filter(Boolean);
  const res = (extra) => ({ actor: u.uid, action: actionId, effects: [], ...extra });

  if (actionId === 'guard') {
    const r = res({ kind: 'guard', name: STR.guard, fx: 'guard', outcome: 'use' });
    r.effects.push(setStatus(b, u, 'guarded', 1));
    addSparks(u, R.SPARKS.guardBonus, r.effects);
    return [r];
  }

  if (actionId.startsWith('item:')) {
    const id = actionId.slice(5);
    const it = b.content.items[id];
    const r = res({ kind: 'item', name: it.name, fx: 'item', item: id, outcome: 'use' });
    b.inventory[id] = Math.max(0, (b.inventory[id] || 0) - 1);
    r.effects.push({ t: 'useItem', id });
    const use = it.use || {};
    const allies = use.who === 'all' ? livingHeroes(b) : [tgs[0] || u];
    if (use.heal) for (const a of allies) healHero(b, a, use.heal, r.effects);
    if (use.clear) for (const a of allies) clearBad(a, r.effects);
    if (use.sparks) addSparks(tgs[0] || u, use.sparks, r.effects);
    if (use.star) r.effects.push({ t: 'star', n: use.star });
    if (use.blindAll) {
      for (const f of activeFoes(b)) {
        r.effects.push(setStatus(b, f, 'blinded', 1));
        if (use.stunIfWeak && (f.def.weak || []).includes(use.stunIfWeak)) r.effects.push(setStatus(b, f, 'stunned', 1));
      }
    }
    return [r];
  }

  if (actionId === 'befriend') {
    const f = tgs[0] || activeFoes(b).find((x) => x.canCalm);
    const r = res({ kind: 'befriend', name: verbName(f?.def.befriend?.verb), fx: 'befriend', targets: f ? [f.uid] : [] });
    if (!f) { r.outcome = 'miss'; return [r]; }
    const liked = likedBy(b, u, f);
    r.liked = liked;
    r.roll = checkRoll(b, u, 'heart', f.def.befriend?.dc ?? 10);
    r.roll.vs[0].uid = f.uid;
    const ok = r.roll.vs[0].hit;
    r.outcome = r.roll.crit ? 'crit' : r.roll.fumble ? 'fumble' : ok ? 'hit' : 'miss';
    if (ok) {
      if (liked?.kind === 'item' && b.content.items?.[liked.id]?.kind === 'consumable') {
        b.inventory[liked.id] = Math.max(0, (b.inventory[liked.id] || 0) - 1);
        r.effects.push({ t: 'useItem', id: liked.id, gift: true, target: f.uid });
      }
      const d = rollDice(b, '1d6', r.roll.crit);
      calmFoe(b, f, d.total + stat(u, 'heart') + (liked ? 3 : 0), r.effects, !!liked);
    }
    return [r];
  }

  if (actionId === 'strike') {
    const d = u.def.strike || {};
    const f = tgs[0] || activeFoes(b)[0];
    const r = res({ kind: 'attack', name: d.name || STR.strike, fx: d.fx || 'slash', targets: [f.uid], strike: true });
    r.roll = attackRoll(b, u, [f], { stat: u.def.attackStat || 'might' });
    r.outcome = r.roll.crit ? 'crit' : r.roll.fumble ? 'fumble' : r.roll.vs[0].hit ? 'hit' : 'miss';
    if (r.roll.vs[0].hit) {
      const die = perkVal(u.hero, 'strikeDie') || d.die || '1d6';
      let dmg = rollDice(b, die, r.roll.crit).total + dmgStat(u, u.def.attackStat);
      if (d.bonusDie && (d.bonusWhen || []).some((s) => f.st[s])) { dmg += rollDice(b, d.bonusDie, r.roll.crit).total; r.bonusDie = true; }
      hurtFoe(b, f, dmg, r.effects, { crit: r.roll.crit });
    }
    return [r];
  }

  const p = powerOf(u, actionId);
  if (!p) throw new Error('Unknown action ' + actionId);
  const cost = p.cost ?? (p.great ? R.SPARKS.great : R.SPARKS.power);
  u.sparks = Math.max(0, u.sparks - cost);
  const base = { kind: 'attack', name: p.name, fx: p.fx, power: p.id, cost, sparks: u.sparks };
  const weakOf = (f) => hasTag(p.tags, f.def.weak);
  const attackStatOf = { shield_bash: 'might', lionheart_charge: 'might', star_bolt: 'wits', comet_shower: 'wits', twin_arrows: 'agility', rain_of_arrows: 'agility', sneak_strike: 'agility', pocket_tricks: 'agility', dazzling_chord: 'heart', tangle_vines: 'wits' };

  const single = (f, onHit) => {
    const r = res({ ...base, targets: [f.uid] });
    r.roll = attackRoll(b, u, [f], { stat: attackStatOf[p.id], critOn: p.critOn || 20 });
    const hit = r.roll.vs[0].hit;
    r.outcome = r.roll.crit ? 'crit' : r.roll.fumble ? 'fumble' : hit ? 'hit' : 'miss';
    if (hit) {
      const w = weakOf(f);
      const dmg = rollDice(b, p.damage || '1d6', r.roll.crit).total + dmgStat(u, attackStatOf[p.id]) + (w ? 3 : 0);
      if (onHit) onHit(f, r, dmg, w); else hurtFoe(b, f, dmg, r.effects, { weak: w, crit: r.roll.crit });
    }
    return r;
  };

  const area = (onHit) => {
    const fs = activeFoes(b);
    const r = res({ ...base, targets: fs.map((f) => f.uid) });
    r.roll = attackRoll(b, u, fs, { stat: attackStatOf[p.id] });
    const any = r.roll.vs.some((v) => v.hit);
    r.outcome = r.roll.crit ? 'crit' : r.roll.fumble ? 'fumble' : any ? 'hit' : 'miss';
    fs.forEach((f, i) => {
      if (!r.roll.vs[i].hit) return;
      const w = weakOf(f);
      const dmg = rollDice(b, p.damage || '1d6', r.roll.crit).total + dmgStat(u, attackStatOf[p.id]) + (w ? 3 : 0);
      hurtFoe(b, f, dmg, r.effects, { weak: w, crit: r.roll.crit });
      if (onHit && !f.gone) onHit(f, r);
    });
    return r;
  };

  switch (p.id) {
    case 'shield_bash':
      return [single(tgs[0], (f, r, dmg, w) => { hurtFoe(b, f, dmg, r.effects, { weak: w, crit: r.roll.crit }); if (!f.gone) r.effects.push(setStatus(b, f, 'stunned', 1)); })];
    case 'guardians_vow': {
      const a = tgs[0];
      const r = res({ ...base, kind: 'auto', targets: [a.uid], outcome: 'use' });
      r.effects.push(setStatus(b, a, 'protected', 1, { by: u.uid }));
      return [r];
    }
    case 'lionheart_charge': case 'comet_shower':
      return [area()];
    case 'rain_of_arrows':
      return [area((f, r) => r.effects.push(setStatus(b, f, 'marked', 2, { worst: true })))];
    case 'star_bolt': case 'sneak_strike':
      return [single(tgs[0])];
    case 'tangle_vines':
      return [single(tgs[0], (f, r, dmg, w) => { hurtFoe(b, f, dmg, r.effects, { weak: w, crit: r.roll.crit }); if (!f.gone) r.effects.push(setStatus(b, f, 'tangled', 2)); })];
    case 'pocket_tricks':
      return [single(tgs[0], (f, r, dmg, w) => {
        hurtFoe(b, f, dmg, r.effects, { weak: w, crit: r.roll.crit });
        if (!f.gone) r.effects.push(setStatus(b, f, 'stunned', 1));
        r.effects.push({ t: 'coins', n: rollDice(b, p.coins || '1d6+2').total });
      })];
    case 'sleepy_dust': {
      const f = tgs[0];
      const r = res({ ...base, kind: 'check', targets: [f.uid] });
      r.roll = checkRoll(b, u, 'wits', f.def.befriend?.dc ?? 12);
      r.roll.vs[0].uid = f.uid;
      const ok = r.roll.vs[0].hit;
      r.outcome = r.roll.crit ? 'crit' : r.roll.fumble ? 'fumble' : ok ? 'hit' : 'miss';
      if (ok) r.effects.push(f.boss ? setStatus(b, f, 'drowsy', 2) : setStatus(b, f, 'asleep', 2));
      return [r];
    }
    case 'twin_arrows': {
      const out = [];
      for (let i = 0; i < (p.shots || 2); i++) {
        let f = tgs[i] || tgs[0];
        if (!f || f.gone) f = activeFoes(b).sort((x, y) => x.hp - y.hp)[0];
        if (!f) break;
        const r = single(f);
        r.shot = i + 1;
        out.push(r);
      }
      return out;
    }
    case 'biscuit_go': {
      const f = tgs[0];
      const r = res({ ...base, kind: 'auto', targets: [f.uid], outcome: 'hit' });
      hurtFoe(b, f, rollDice(b, '1d4').total, r.effects);
      if (!f.gone) r.effects.push(setStatus(b, f, 'marked', 2, { worst: true }));
      return [r];
    }
    case 'smoke_puff': {
      const fs = activeFoes(b);
      const r = res({ ...base, kind: 'auto', targets: fs.map((f) => f.uid), outcome: 'hit' });
      for (const f of fs) r.effects.push(setStatus(b, f, 'blinded', 1));
      return [r];
    }
    case 'rousing_tune': {
      const as = livingHeroes(b);
      const r = res({ ...base, kind: 'auto', targets: as.map((a) => a.uid), outcome: 'hit' });
      for (const a of as) { r.effects.push(setStatus(b, a, 'inspired', 2)); addSparks(a, 1, r.effects); }
      return [r];
    }
    case 'dazzling_chord':
      return [single(tgs[0], (f, r, dmg, w) => {
        if (f.canCalm) {
          const liked = hasTag(p.tags, f.def.likes);
          calmFoe(b, f, dmg - (w ? 3 : 0) + (liked ? 3 : 0), r.effects, liked);
        }
        if (!f.gone) hurtFoe(b, f, dmg, r.effects, { weak: w, crit: r.roll.crit });
      })];
    case 'encore': {
      const a = tgs[0];
      const r = res({ ...base, kind: 'auto', targets: [a.uid], outcome: 'hit' });
      r.effects.push({ t: 'extra', target: a.uid });
      return [r];
    }
    case 'mending_light': {
      const a = tgs[0];
      const r = res({ ...base, kind: 'auto', targets: [a.uid], outcome: 'hit' });
      healHero(b, a, rollDice(b, p.heal || '1d8').total + stat(u, 'heart') + u.level, r.effects, { revive: true });
      return [r];
    }
    case 'spring_bloom': {
      const as = livingHeroes(b);
      const r = res({ ...base, kind: 'auto', targets: as.map((a) => a.uid), outcome: 'hit' });
      for (const a of as) { healHero(b, a, rollDice(b, p.heal || '1d6').total + stat(u, 'heart'), r.effects); clearBad(a, r.effects); }
      return [r];
    }
    default:
      return [single(tgs[0] || activeFoes(b)[0])];
  }
}

// ---------- foe turns ----------
export function beginFoeTurn(b, f) {
  b.current = f.uid;
  const out = [];
  if (f.st.stunned) {
    delete f.st.stunned;
    out.push({ t: 'unstatus', target: f.uid, s: 'stunned' });
    if (f.boss) { f.stunPen = 4; return { skip: null, dizzy: true, effects: out }; }
    return { skip: 'stunned', effects: out };
  }
  if (f.st.asleep) {
    f.st.asleep.n--;
    if (f.st.asleep.n <= 0) { delete f.st.asleep; out.push({ t: 'unstatus', target: f.uid, s: 'asleep' }); }
    return { skip: 'asleep', effects: out };
  }
  return { skip: null, effects: out };
}

function pickTargets(b, move) {
  const hs = livingHeroes(b);
  if (!hs.length) return [];
  switch (move.target) {
    case 'all': return hs.map((h) => h.uid);
    case 'weakest': return [hs.slice().sort((x, y) => x.hp - y.hp)[0].uid];
    case 'strongest': return [hs.slice().sort((x, y) => y.hp - x.hp)[0].uid];
    default: return [b.rng.pick(hs).uid];
  }
}

function weighted(b, moves) {
  const total = moves.reduce((s, m) => s + (m.weight || 1), 0);
  let x = b.rng.float() * total;
  for (const m of moves) { x -= m.weight || 1; if (x < 0) return m; }
  return moves[moves.length - 1];
}

export function chooseFoeIntent(b, f) {
  b.current = f.uid;
  if (f.pending) {
    const move = f.def.moves.find((m) => m.id === f.pending.move);
    let targets = [f.pending.target].filter((id) => { const h = unit(b, id); return h && !h.dazed; });
    if (!targets.length) targets = pickTargets(b, move);
    f.pending = null;
    if (!f.st.tangled || !move.special) return { move, targets, pending: true };
  }
  const pool = f.def.moves.filter((m) => !m.announce && !(m.special && f.st.tangled));
  const move = weighted(b, pool.length ? pool : f.def.moves.filter((m) => !m.special));
  return { move, targets: pickTargets(b, move), pending: false };
}

export function resolveFoeIntent(b, f, intent) {
  const { move } = intent;
  const r = { actor: f.uid, kind: 'foe', move: move.id, name: move.name, effects: [], targets: intent.targets };
  const heroes = intent.targets.map((id) => unit(b, id)).filter((h) => h && !h.dazed);
  const toHit = (f.def.toHit || 0) + b.foeHitMod - (f.stunPen || 0) - (b.partySize <= 1 ? 2 : 0);
  f.stunPen = 0;
  const foeWorst = !!f.st.blinded || !!f.st.marked?.worst;
  if (f.st.marked?.worst) f.st.marked.worst = false;
  const anyGuarded = heroes.some((h) => h.st.guarded);
  const a = b.rng.d(20);
  const second = foeWorst || anyGuarded ? b.rng.d(20) : null;
  const low = second == null ? a : Math.min(a, second);
  const showTwo = second != null && (foeWorst || heroes.length === 1);
  r.roll = { dice: showTwo ? [a, second] : [a], dropped: showTwo ? (a <= second ? 1 : 0) : null, die: showTwo ? low : a, bonus: toHit };
  r.roll.vs = heroes.map((h) => {
    const die = foeWorst || h.st.guarded ? low : a;
    const g = heroGuard(h);
    return { uid: h.uid, need: g, die, total: die + toHit, hit: die === 20 || (die !== 1 && die + toHit >= g), guarded: !!h.st.guarded };
  });
  r.roll.total = r.roll.die + toHit;
  r.roll.crit = r.roll.die === 20; r.roll.fumble = r.roll.die === 1;
  const hits = r.roll.vs.filter((v) => v.hit).map((v) => unit(b, v.uid));
  r.outcome = hits.length ? 'hit' : 'miss';
  if (!hits.length) return r;
  const dmg = move.damage ? rollDice(b, move.damage).total : 0;
  for (const h of hits) {
    if (dmg > 0) {
      const prot = h.st.protected ? unit(b, h.st.protected.by) : null;
      if (prot && !prot.dazed && prot !== h) hurtHero(b, prot, Math.ceil(dmg / 2), r.effects, { protectFor: h.uid });
      else hurtHero(b, h, dmg, r.effects);
    }
    if (h.dazed) continue;
    const e = move.effect || {};
    if (e.sparks) addSparks(h, e.sparks, r.effects);
    if (e.nextRoll) r.effects.push(setStatus(b, h, 'shaken', 1));
    if (e.nextRollWorst) r.effects.push(setStatus(b, h, 'worried', 1));
  }
  return r;
}

export function maybeAnnounce(b, f) {
  if (f.gone || f.pending || f.st.tangled) return null;
  const ann = f.def.moves.filter((m) => m.announce);
  if (!ann.length || !livingHeroes(b).length) return null;
  const m = weighted(b, f.def.moves);
  if (!m.announce) return null;
  const target = pickTargets(b, m)[0];
  f.pending = { move: m.id, target };
  return { move: m, target };
}

export function endTurn(b, u) {
  for (const [s, v] of Object.entries(u.st)) {
    if (['guarded', 'protected', 'stunned', 'asleep', 'shaken', 'worried'].includes(s)) continue;
    if (v.fresh) { v.fresh = false; continue; }
    v.n--;
    if (v.n <= 0) delete u.st[s];
  }
  b.current = null;
}

// ---------- Star reroll: undo one resolved action ----------
// snapshot(b) before resolveHeroAction, restore(b, snap) to take it back (the dice rng is not rewound).
const UNIT_KEYS = ['hp', 'sparks', 'dazed', 'everDazed', 'calm', 'gone', 'phase2', 'pending', 'stunPen'];
export function snapshot(b) {
  const units = [...b.heroes, ...b.foes].map((u) => {
    const o = { st: JSON.parse(JSON.stringify(u.st)) };
    for (const k of UNIT_KEYS) if (k in u) o[k] = u[k] && typeof u[k] === 'object' ? { ...u[k] } : u[k];
    return o;
  });
  return { units, inventory: { ...b.inventory }, stats: { ...b.stats }, halfMercy: b.halfMercy, foeHitMod: b.foeHitMod };
}
export function restore(b, snap) {
  [...b.heroes, ...b.foes].forEach((u, i) => Object.assign(u, snap.units[i]));
  b.inventory = { ...snap.inventory }; b.stats = { ...snap.stats }; b.halfMercy = snap.halfMercy; b.foeHitMod = snap.foeHitMod;
}
// a failed single hero roll the party may spend a Star on: an attack that hit nobody, or a Befriend that did not land
export function canReroll(results) {
  if (!results || results.length !== 1) return false;
  const r = results[0];
  return !!r.roll && (r.roll.vs || []).length > 0 && !r.roll.vs.some((v) => v.hit) && ['attack', 'befriend', 'check'].includes(r.kind);
}

// ---------- round flow ----------
export function buildQueue(b) {
  // living heroes only, so a dazed first hero never lets a foe act before any living hero
  const hs = livingHeroes(b).map((h) => h.uid);
  const fs = activeFoes(b).map((f) => f.uid);
  const q = [];
  for (let i = 0; i < Math.max(hs.length, fs.length); i++) {
    if (hs[i]) q.push(hs[i]);
    if (fs[i]) q.push(fs[i]);
  }
  for (const f of activeFoes(b)) {
    const acts = f.phase2 ? (f.def.phase?.atHalf?.actsPerRound || 1) : 1;
    for (let k = 1; k < acts; k++) q.push(f.uid);
  }
  return q;
}

export function outcome(b) {
  if (!activeFoes(b).length) return b.foes.every((f) => f.gone === 'befriended') ? 'befriend' : 'win';
  if (!livingHeroes(b).length) return 'wipe';
  return null;
}

export function mercyHalf(b) {
  const n = b.heroes.length;
  const dazed = b.heroes.filter((h) => h.dazed).length;
  if (b.halfMercy || n < 2 || dazed * 2 < n || dazed >= n) return null;
  b.halfMercy = true;
  b.foeHitMod = -2;
  const out = [];
  for (const h of livingHeroes(b)) healHero(b, h, 4, out);
  return out;
}

export function rewind(b) {
  b.wipes++;
  b.round = 0;
  for (const h of b.heroes) { h.hp = h.maxHp; h.dazed = false; h.st = {}; h.sparks = Math.min(R.SPARKS.max, R.SPARKS.start + perkSum(h.hero, 'sparks')); }
  for (const f of b.foes) {
    if (f.gone === 'befriended') continue;
    f.gone = null; f.hp = Math.max(1, Math.ceil(f.maxHp * 0.75)); f.st = {}; f.calm = 0; f.pending = null; f.phase2 = false; f.stunPen = 0;
    const ph = f.def.phase?.atHalf;
    if (ph && f.hp <= f.maxHp / 2) f.phase2 = true;
  }
}

export function fleeAll(b) {
  const out = [];
  for (const f of activeFoes(b)) { f.gone = 'fled'; out.push({ t: 'out', target: f.uid, how: 'fled' }); }
  return out;
}

export function finish(b) {
  for (const h of b.heroes) if (h.dazed || h.hp <= 0) { h.dazed = false; h.hp = 1; }
  return {
    befriended: b.foes.filter((f) => f.gone === 'befriended').map((f) => f.type),
    defeated: b.foes.filter((f) => f.gone === 'fled').map((f) => f.type),
  };
}

// ---------- AI ----------
const avgDie = (expr) => { const p = R.parseDice(expr || '1d4'); return p.count * (p.sides + 1) / 2 + p.mod; };

export function chooseAI(b, u, { mode = 'sensible', kind = true } = {}) {
  const foes = activeFoes(b);
  const weakest = foes.slice().sort((x, y) => x.hp - y.hp)[0];
  if (mode === 'attack') return { action: 'strike', targets: [weakest.uid] };
  const acts = Object.fromEntries(heroActions(b, u).map((a) => [a.id, a]));
  const ok = (id) => acts[id]?.enabled;
  const allies = livingHeroes(b);
  const dazed = b.heroes.filter((h) => h.dazed);
  const hurt = allies.filter((h) => h.hp / h.maxHp < 0.5).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp);

  if (ok('mending_light') && (dazed.length || hurt.length)) return { action: 'mending_light', targets: [(dazed[0] || hurt[0]).uid] };
  if (ok('spring_bloom') && allies.filter((h) => h.hp / h.maxHp < 0.6).length >= 2) return { action: 'spring_bloom', targets: [] };
  if (u.hp / u.maxHp < 0.35 && ok('item')) {
    const it = acts.item.items.find((i) => ['honeycake', 'blackberry_pie'].includes(i.itemId));
    if (it) return { action: it.id, targets: [u.uid] };
  }
  const threat = foes.find((f) => f.pending?.target === u.uid);
  if (threat && u.hp <= 8) return { action: 'guard', targets: [u.uid] };

  const calmable = foes.filter((f) => f.canCalm);
  const heart = stat(u, 'heart');
  const befriendFirst = kind && calmable.length && (heart >= 2 || calmable.some((f) => likedBy(b, u, f)));
  const closest = calmable.slice().sort((x, y) => (y.calm / y.resolve) - (x.calm / x.resolve))[0];

  if (ok('rousing_tune') && b.round <= 2 && allies.length >= 3 && !u.st.inspired) return { action: 'rousing_tune', targets: [] };
  if (befriendFirst && ok('dazzling_chord')) return { action: 'dazzling_chord', targets: [closest.uid] };

  for (const g of ['lionheart_charge', 'comet_shower', 'rain_of_arrows']) if (ok(g) && (foes.length >= 2 || foes.some((f) => f.boss))) return { action: g, targets: [] };
  if (ok('spring_bloom') && hurt.length) return { action: 'spring_bloom', targets: [] };
  if (ok('pocket_tricks')) return { action: 'pocket_tricks', targets: [(foes.find((f) => f.boss) || weakest).uid] };
  if (ok('guardians_vow')) {
    const soft = allies.filter((h) => h !== u && h.hp / h.maxHp < 0.4 && !h.st.protected)[0];
    if (soft && u.hp / u.maxHp > 0.5) return { action: 'guardians_vow', targets: [soft.uid] };
  }
  if (befriendFirst) return { action: 'befriend', targets: [closest.uid] };

  // damage powers: prefer a weakness
  const dmgPowers = ['tangle_vines', 'star_bolt', 'sneak_strike', 'twin_arrows', 'shield_bash', 'dazzling_chord'].filter(ok);
  if (ok('sleepy_dust') && foes.length >= 3) {
    const t = foes.filter((f) => !f.boss && !f.st.asleep).sort((x, y) => y.hp - x.hp)[0];
    if (t) return { action: 'sleepy_dust', targets: [t.uid] };
  }
  if (dmgPowers.length) {
    const score = (id) => {
      const p = powerOf(u, id);
      const w = foes.some((f) => hasTag(p.tags, f.def.weak)) ? 3 : 0;
      return avgDie(p.damage) * (p.shots || 1) + w;
    };
    const id = dmgPowers.sort((x, y) => score(y) - score(x))[0];
    const p = powerOf(u, id);
    const weakT = foes.filter((f) => hasTag(p.tags, f.def.weak)).sort((x, y) => x.hp - y.hp)[0];
    const t = id === 'shield_bash' ? (foes.find((f) => f.boss) || foes.slice().sort((x, y) => y.hp - x.hp)[0]) : (weakT || weakest);
    return { action: id, targets: id === 'twin_arrows' ? [t.uid, t.uid] : [t.uid] };
  }
  if (ok('smoke_puff') && foes.length >= 3 && !foes.some((f) => f.st.blinded)) return { action: 'smoke_puff', targets: [] };
  if (ok('biscuit_go') && foes.some((f) => f.boss)) return { action: 'biscuit_go', targets: [foes.find((f) => f.boss).uid] };
  return { action: 'strike', targets: [weakest.uid] };
}

export const isNoCost = (id) => NO_SPARK_COST.includes(id) || id.startsWith('item:');
