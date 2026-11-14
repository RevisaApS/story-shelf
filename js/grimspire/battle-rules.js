// Grimspire battle engine (GRIMSPIRE.md 4 and 5.3). Pure: no DOM, no ctx. battle.js plays the events back;
// tools/gs-sim.mjs runs it headless. The presentation never computes numbers.
//
// ============================== PROTOCOL ==============================
// createBattle({ content, encounterId, party, level, boons, bag, difficulty, rng, foes? }) -> b
//   party: [{ id, arch, name, hp, gear }] as in state (hp null/undefined = full; hp 0 = enters knocked down)
//   bag:   [{ uid, id, plus } | { uid, id, qty }] (only consumables matter); b.bag is a copy, used ones go to b.used
//   foes:  optional [{ type, min }] to override the encounter's list (hunt-again refills)
// unit(b, uid) -> unit;  b.heroes, b.foes (summons are appended to b.foes)
//   unit = { uid, side:'hero'|'foe', id, arch?, type?, name, art, hp, maxHp, fury, furyMax, shield, st, ko, boss,
//            atk, def, spd, traits?, weak?, resist? }
//   st = { [status]: { turns, n?, stacks?, hard? } }   (statusList(u) -> [{ status, turns, stacks, n }] for icons)
//
// The round loop (battle.js and gs-sim do exactly this):
//   events = beginRound(b)                         round number, Vex's page
//   for uid of turnOrder(b):                       recomputed each round; summons join next round
//     if (outcome(b)) break
//     events = beginTurn(b, uid)                    Fury, burn and poison ticks, heat, stealth, stun/cocoon/stone
//     drainPending()                                 (a burn tick can pop an exploding foe)
//     if (canAct(b, uid)):
//       hero: heroActions -> pick -> targetsFor -> commands -> resolveHeroAction(b, uid, actionId, targets, { grades })
//       foe:  intent = chooseFoeIntent(b, uid) -> block command -> resolveFoeIntent(b, uid, intent, { block })
//       drainPending()
//     events = endTurn(b, uid)                      durations tick down, stoneform flips
//   drainPending(): for (const p of takePending(b)) { ask a block; resolveFoeIntent(b, p.uid, p.intent, { block }) }
//   finish(b) -> { result, rounds, heroes:[{ uid, id, arch, hp, ko }], used:[itemUids], tally }
//
// heroActions(b, uid) -> [{ id, kind:'strike'|'skill'|'defend'|'item', name, text, cost, enabled, why?, level?,
//                          command: family|null, hits, target:'foe'|'allFoes'|'ally'|'allAllies'|'self'|'fallen',
//                          window, ultimate?, itemId?, qty? }]        (locked skills are listed, enabled:false, why 'Level N')
//   item action ids are 'item:<itemId>'; strike is 'strike'; defend is 'defend'; skills use their content id.
// targetsFor(b, uid, actionId) -> [uid]   (strike also lists cocooned allies: striking one frees them)
// commandWindowFor(b, uid, targetUid) -> window multiplier (1 = Knight normal; Speed over the target and charms widen)
// resolveHeroAction(b, uid, actionId, targetUids, { grades:['perfect'|'good'|'weak', ...] }) -> events
//   one grade per command (action.hits); missing grades reuse the last; Squire turns Weak into Good here, so every
//   damage event carries the effective grade (and rawGrade).
// chooseFoeIntent(b, uid) -> intent = { uid, moveId, name, targets:[uid], telegraph:'normal'|'big', element, block,
//                          window, windup, reason:'turn'|'explode'|'counter', lines }      null when it cannot act
// resolveFoeIntent(b, uid, intent, { block:'perfect'|'good'|'miss' }) -> events
// takePending(b) -> [{ uid, intent }]   foe attacks that must be blocked and resolved now (explode, counter)
// outcome(b) -> 'win' | 'lose' | null;   chooseAI(b, uid) -> { actionId, targetUids }
//
// ============================== EVENTS ==============================
// Every event is a plain object with t. Units are named by uid. Numbers are final; show them as given.
//  round     { n }                                   a new round starts
//  cap       { n }                                   the round cap was hit (a bug guard: the battle counts as lost)
//  turn      { uid }                                 a unit's turn starts
//  skip      { uid, why:'stun'|'cocoon'|'stone'|'down' }   the unit loses this turn
//  act       { uid, actionId, kind, name, targets, fx, cost }   a hunter's action starts (before its hits)
//  foeAct    { uid, moveId, name, targets, telegraph, element, reason }   a foe move lands now (after the block)
//  damage    { uid, n, hp, maxHp, by, source, grade, rawGrade, block, crit, weak, resist, element, absorbed, big }
//              source: 'strike'|'skill'|'foe'|'burn'|'poison'|'explode'|'counter'|'trap'|'item'|'thorns'|'cost'|'splash'|'chain'|'volley'
//              weak = "WEAK POINT!" (Trophy Wall learns foes[type].weak); absorbed = taken by a shield (n is what hit Health)
//  miss      { uid, by, why:'evasive'|'vanish'|'smoke'|'dodge'|'nobody' }   uid = who was missed
//  heal      { uid, n, hp, maxHp, by, revive }       revive true = the hunter stands up again
//  shield    { uid, n, total }                       a shield was added (total = shield now); total 0 = shield gone
//  fury      { uid, n, total }                       Fury changed by n
//  status    { uid, status, on, turns, stacks, n }   a status went on (on:true) or off (on:false)
//              status: burn poison chill stun mark curse rally taunt vanish webbed silenced cocoon smoke
//                      defend reckless guardBroken stone hidden
//  immune    { uid, status }                         the status did not take (a charm)
//  guardBreak{ uid }                                 a Perfect strike broke a guarded foe's guard (2 turns)
//  ko        { uid, side }                           a hunter is knocked down / a foe crumbles to dust
//  laststand { uid, hp }                             a charm kept a hunter standing
//  free      { uid, by }                             an ally struck the cocoon open
//  summon    { uid, type, by, name, art, hp, maxHp } a helper arrives (it acts from the next round)
//  phase     { uid, index, at, lines }               a boss passed a Health mark (Varg speaks the lines)
//  form      { uid, from, to, name, art, hp, maxHp } the foe becomes another (fresh Health bar), e.g. Bone King -> Hollow Crown
//  heat      { uid, heat, reset }                    Brann's heat (+15% Attack per round); reset true = frost or a Perfect block cooled him
//  page      { uid, element, weakTo }                Vex shows a page: his next attack is element; this round he is weak to weakTo
//  opening   { uid }                                 a Perfect block on a big attack: the boss is stunned for a turn
//  stagger   { uid }                                 a stunned boss shrugs it off but its next attack is halved
//  explode   { uid }                                 a foe bursts on defeat; an intent follows in takePending
//  counter   { uid, target }                         a counter foe answers a Weak strike; an intent follows in takePending
//  trap      { uid, on, target? }                    Snare Trap set (on:true) or sprung on target (on:false)
//  item      { uid, itemId, itemUid }                a hunter used a bag item (b.used lists the uids; call state.useItem)
//  defend    { uid }                                 a hunter braces (halved damage until their next turn)
//  say       { pool, uid? }                          a Varg line pool to speak: strike.perfect strike.good strike.weak strike.crit
//              strike.weakpoint strike.resisted block.perfect block.good block.miss foe.big hero.down hero.lowHp fury.full
// ======================================================================
import * as R from './rules.js';
import { L } from '../core/i18n.js';

const STR = L({
  en: {
    strike: 'Strike', strikeText: 'Hit one foe. Time the command.',
    defend: 'Defend', defendText: 'Halve the damage you take until your next turn. +1 Fury.',
    item: 'Item', needFury: (n) => `Needs ${n} Fury`, level: (n) => `Level ${n}`,
    webbed: 'Webbed: cannot strike', silenced: 'Silenced: no skills', noTarget: 'Nobody to use it on',
    hpLow: 'Not enough Health', explode: 'Burst', counter: 'Counter',
  },
  da: {
    strike: 'Slag', strikeText: 'Ram én fjende. Ram kommandoen.',
    defend: 'Forsvar dig', defendText: 'Tag halv skade indtil din næste tur. +1 Raseri.',
    item: 'Ting', needFury: (n) => `Kræver ${n} Raseri`, level: (n) => `Niveau ${n}`,
    webbed: 'Spundet ind: kan ikke slå', silenced: 'Tavs: ingen evner', noTarget: 'Ingen at bruge den på',
    hpLow: 'For lidt Liv', explode: 'Eksplosion', counter: 'Modangreb',
  },
});

const UNTIL_NEXT_TURN = ['defend', 'reckless'];
const NO_TICK = ['stone', 'hidden', 'smoke', ...UNTIL_NEXT_TURN];
const PREVENTED_BY_PERFECT = ['webbed', 'silenced', 'cocoon'];
const pctOf = (x) => (x == null ? 0 : x > 1 ? x / 100 : x);

// ---------- lookups ----------
export const unit = (b, uid) => b.heroes.find((u) => u.uid === uid) || b.foes.find((u) => u.uid === uid) || null;
export const livingHeroes = (b) => b.heroes.filter((u) => !u.ko);
export const livingFoes = (b) => b.foes.filter((u) => !u.ko);
export const fallenHeroes = (b) => b.heroes.filter((u) => u.ko);
const hasTrait = (u, t) => (u.traits || []).includes(t);
const isBad = (u) => R.BAD_STATUSES.some((s) => u.st[s]);
const targetableFoes = (b) => {
  const all = livingFoes(b);
  const vis = all.filter((f) => !f.st.hidden || f.st.mark);
  return vis.length ? vis : all;
};
export function statusList(u) {
  return Object.entries(u.st).map(([status, v]) => ({ status, turns: v.turns, stacks: v.stacks, n: v.n }));
}

// ---------- create ----------
function makeHero(b, p, i) {
  const src = b.content.heroes?.[p.arch] || {};
  const d = R.derive(p, { level: b.level, boons: b.boons, content: b.content, difficulty: b.difficulty });
  const hp = p.hp == null ? d.hp : Math.max(0, Math.min(d.hp, p.hp));
  const u = {
    uid: 'h' + i, side: 'hero', id: p.id || p.arch, arch: p.arch, name: p.name || src.name || p.arch,
    art: src.art || 'gs_' + p.arch, family: d.family, src,
    hp, maxHp: d.hp, atk: b.partySize === 1 ? Math.round(d.atk * R.SOLO_HERO_ATK * 10) / 10 : d.atk, def: d.def, spd: d.spd, luck: d.luck, weapon: d.weapon, sum: d.sum, effects: d.effects,
    fury: Math.min(R.FURY.max, R.FURY.start + (d.sum.furyStart || 0)), furyMax: R.FURY.max,
    shield: 0, shieldTurns: null, st: {}, ko: hp <= 0, boss: false, turns: 0, lastStandUsed: false, lowSaid: false,
    immune: d.effects.filter((e) => e.id === 'immune').flatMap((e) => e.statuses || []),
    resists: d.effects.filter((e) => e.id === 'resist'),
  };
  if (!u.ko && d.sum.startShield) u.shield = Math.round(u.maxHp * pctOf(d.sum.startShield));
  return u;
}

function makeFoe(b, type, summoned = false) {
  const src = b.content.foes?.[type];
  if (!src) throw new Error('Unknown foe ' + type);
  const s = R.scaleFoe(src, b.partySize, b.difficulty);
  return {
    uid: 'f' + b.nextFoe++, side: 'foe', id: type, type, name: src.name || type, art: src.art || type, src,
    boss: !!src.boss, hp: s.hp, maxHp: s.hp, atk: s.atk, def: s.def, spd: s.spd,
    weak: src.weak || [], resist: src.resist || [], traits: src.traits || [], moves: src.moves || [], phases: src.phases || [],
    phaseDone: [], st: {}, ko: false, shield: 0, fury: 0, furyMax: 0, turns: 0, heat: 0, page: null, sinceBig: 1,
    halfNext: false, summoned,
  };
}

export function createBattle({ content, encounterId, party, level = 1, boons = [], bag = [], difficulty = 'knight', rng, foes = null,
  foeHp = null, furyBonus = 0, shieldPct = 0 }) {
  const enc = content.encounters?.[encounterId];
  if (!enc && !foes) throw new Error('Unknown encounter ' + encounterId);
  const b = {
    content, enc: enc || { id: encounterId, kind: 'battle', foes }, rng, difficulty, level, boons,
    partySize: Math.max(1, Math.min(4, party.length)), heroes: [], foes: [], nextFoe: 0,
    bag: bag.map((x) => ({ ...x })), used: [], round: 0, current: null, pending: [], trap: null, capHit: false,
    tally: { perfects: 0, goods: 0, weaks: 0, perfectBlocks: 0, blocks: 0, bestHit: 0, crits: 0, kills: 0 },
  };
  b.heroes = party.map((p, i) => makeHero(b, p, i));
  for (const slot of foes || enc.foes) if (b.partySize >= (slot.min || 1)) b.foes.push(makeFoe(b, slot.type));
  // room modifiers from events (gs-meta via battle.js)
  if (foeHp != null) for (const f of b.foes) f.hp = Math.max(1, Math.round(f.maxHp * foeHp));
  for (const h of livingHeroes(b)) {
    if (furyBonus) h.fury = Math.min(h.furyMax, h.fury + furyBonus);
    if (shieldPct) h.shield += Math.round(h.maxHp * pctOf(shieldPct));
  }
  b.partyLastStand = b.heroes[0]?.sum.partyLastStand || 0;
  return b;
}

// ---------- statuses ----------
function setStatus(b, u, status, { turns, n, hard, by } = {}, out) {
  if (u.ko) return;
  if (u.side === 'hero' && u.immune.includes(status)) { out.push({ t: 'immune', uid: u.uid, status }); return; }
  const t = turns ?? R.STATUS_DEFAULTS[status] ?? 1;
  const cur = u.st[status];
  const v = { turns: t, fresh: b.current === u.uid };
  if (n != null) v.n = n;
  if (hard) v.hard = true;
  if (by) v.by = by;
  if (status === 'poison') v.stacks = Math.min(R.MAX_POISON, (cur?.stacks || 0) + 1);
  if (status === 'smoke') v.round = b.round;
  if (cur && status === 'burn') v.n = Math.max(cur.n || 0, n || 0);
  u.st[status] = v;
  out.push({ t: 'status', uid: u.uid, status, on: true, turns: t, stacks: v.stacks, n: v.n });
}
function clearStatus(u, status, out) {
  if (!u.st[status]) return;
  delete u.st[status];
  out.push({ t: 'status', uid: u.uid, status, on: false });
}

function addFury(u, n, out) {
  if (u.side !== 'hero' || u.ko) return;
  const before = u.fury;
  u.fury = Math.max(0, Math.min(u.furyMax, u.fury + n));
  if (u.fury !== before) {
    out.push({ t: 'fury', uid: u.uid, n: u.fury - before, total: u.fury });
    if (u.fury === u.furyMax && before < u.furyMax) out.push({ t: 'say', pool: 'fury.full', uid: u.uid });
  }
}

function addShield(b, u, n, turns, out) {
  if (u.ko || n <= 0) return;
  u.shield += n;
  u.shieldTurns = turns ?? null;
  u.shieldFresh = turns != null && b.current === u.uid;
  out.push({ t: 'shield', uid: u.uid, n, total: u.shield });
}

function heal(b, u, n, out, { by, revive = false } = {}) {
  if (u.ko && !revive) return;
  n = Math.max(0, Math.round(n));
  const was = u.ko;
  if (was) { u.ko = false; u.hp = 0; u.st = {}; }
  const before = u.hp;
  u.hp = Math.min(u.maxHp, u.hp + Math.max(n, was ? 1 : 0));
  if (u.hp === before && !was) return;
  if (u.hp / u.maxHp >= 0.3) u.lowSaid = false;
  out.push({ t: 'heal', uid: u.uid, n: u.hp - before, hp: u.hp, maxHp: u.maxHp, by, revive: was });
}

// ---------- damage ----------
// Takes n off a unit (shield first), then handles knock-downs, phases, forms, explosions. Returns the Health lost.
function dealDamage(b, u, n, info, out) {
  if (u.ko) return 0;
  n = Math.max(0, Math.round(n));
  let absorbed = 0;
  if (u.shield > 0 && n > 0) {
    absorbed = Math.min(u.shield, n);
    u.shield -= absorbed; n -= absorbed;
  }
  u.hp = Math.max(0, u.hp - n);
  const ev = { t: 'damage', uid: u.uid, n, hp: u.hp, maxHp: u.maxHp, absorbed, ...info };
  out.push(ev);
  if (absorbed && u.shield <= 0) { u.shield = 0; out.push({ t: 'shield', uid: u.uid, n: -absorbed, total: 0 }); }
  if (u.side === 'hero') {
    if (u.hp <= 0 && b.partyLastStand && !b.partyLastStandUsed) {
      b.partyLastStandUsed = true;
      u.hp = Math.max(1, Math.round(u.maxHp * pctOf(b.partyLastStand)));
      out.push({ t: 'laststand', uid: u.uid, hp: u.hp });
    }
    if (u.hp <= 0 && u.sum.lastStand && !u.lastStandUsed) {
      u.lastStandUsed = true;
      u.hp = Math.max(1, Math.round(u.maxHp * pctOf(u.sum.lastStand)));
      out.push({ t: 'laststand', uid: u.uid, hp: u.hp });
    }
    if (u.hp <= 0) {
      u.ko = true; u.st = {}; u.shield = 0; u.fury = Math.min(u.fury, 1);
      if (b.trap?.owner === u.uid) b.trap = null;
      out.push({ t: 'ko', uid: u.uid, side: 'hero' });
      out.push({ t: 'say', pool: 'hero.down', uid: u.uid });
    } else if (!u.lowSaid && u.hp / u.maxHp < 0.3) {
      u.lowSaid = true;
      out.push({ t: 'say', pool: 'hero.lowHp', uid: u.uid });
    }
  } else {
    if (info.by && n + absorbed > b.tally.bestHit && unit(b, info.by)?.side === 'hero') b.tally.bestHit = n + absorbed;
    if (info.element === 'frost' && u.heat > 0) { u.heat = 0; out.push({ t: 'heat', uid: u.uid, heat: 0, reset: true }); }
    const formed = checkPhases(b, u, out);
    if (!formed && u.hp <= 0) foeDown(b, u, info, out);
  }
  return n;
}

function foeDown(b, f, info, out) {
  f.ko = true; f.st = {}; f.shield = 0;
  b.tally.kills++;
  out.push({ t: 'ko', uid: f.uid, side: 'foe' });
  const killer = info.by ? unit(b, info.by) : null;
  if (killer?.side === 'hero' && !killer.ko) {
    const fk = killer.sum.furyOnKill || 0;
    if (fk) addFury(killer, fk, out);
    for (const tr of killer.weapon.traits || []) {
      if (tr.id === 'healOnKill') for (const a of livingHeroes(b)) heal(b, a, a.maxHp * pctOf(tr.pct), out, { by: killer.uid });
    }
  }
  if (hasTrait(f, 'explodes') && livingHeroes(b).length) {
    out.push({ t: 'explode', uid: f.uid });
    const mv = f.moves.find((m) => m.id === 'explode') || {};
    b.pending.push({ uid: f.uid, intent: {
      uid: f.uid, moveId: 'explode', name: mv.name || STR.explode, targets: livingHeroes(b).map((h) => h.uid), telegraph: 'normal',
      element: mv.element || f.moves.find((m) => m.element)?.element || 'fire', block: true, reason: 'explode',
      mult: mv.mult ?? 1.2, window: R.blockWindow({ difficulty: b.difficulty }), windup: 700, lines: mv.lines?.intent || [],
    } });
  }
}

// phases: [{ at, lines, form?, summon?, moves? }] in order of their mark; returns true when a form change kept it alive
function checkPhases(b, f, out) {
  const list = (f.phases || []).map((p, i) => ({ p, i })).sort((x, y) => y.p.at - x.p.at);
  for (const { p, i } of list) {
    if (f.phaseDone.includes(i)) continue;
    const ratio = f.hp / f.maxHp;
    if (p.at > 0 ? ratio > p.at : f.hp > 0) continue;
    f.phaseDone.push(i);
    out.push({ t: 'phase', uid: f.uid, index: i, at: p.at, lines: p.lines || [] });
    if (p.moves) f.moves = p.moves;
    if (p.summon) summon(b, f, p.summon, out);
    if (p.form) { transform(b, f, p.form, out); return true; }
  }
  return false;
}

function transform(b, f, form, out) {
  const src = b.content.foes?.[form];
  if (!src) return;
  const from = f.type;
  const s = R.scaleFoe(src, b.partySize, b.difficulty);
  Object.assign(f, {
    id: form, type: form, src, name: src.name || form, art: src.art || form, boss: true,
    hp: s.hp, maxHp: s.hp, atk: s.atk, def: s.def, spd: s.spd, weak: src.weak || [], resist: src.resist || [],
    traits: src.traits || [], moves: src.moves || [], phases: src.phases || [], phaseDone: [], st: {}, shield: 0,
    heat: 0, page: null, sinceBig: 1, halfNext: false, ko: false,
  });
  b.capBase = b.round;
  out.push({ t: 'form', uid: f.uid, from, to: form, name: f.name, art: f.art, hp: f.hp, maxHp: f.maxHp });
}

function summon(b, by, list, out) {
  const cap = Math.min(6, b.partySize + 2);
  for (const { type, n = 1 } of list) {
    // helpers scale with the party: none for one hunter, one for two, the full number for three or more
    const count = b.partySize === 1 ? 0 : b.partySize === 2 ? Math.min(1, n) : n;
    for (let k = 0; k < count; k++) {
      if (livingFoes(b).length >= cap) return;
      if (!b.content.foes?.[type]) return;
      const f = makeFoe(b, type, true);
      b.foes.push(f);
      out.push({ t: 'summon', uid: f.uid, type, by: by.uid, name: f.name, art: f.art, hp: f.hp, maxHp: f.maxHp });
    }
  }
}

// ---------- hunter hits ----------
function elementMult(f, el) {
  if (!el) return { m: 1, weak: false, resist: false };
  const weak = f.weak.includes(el) || (f.page && R.OPPOSITE[f.page] === el);
  const resist = f.resist.includes(el);
  return { m: (weak ? 1.5 : 1) * (resist ? 0.5 : 1), weak: !!weak, resist };
}
const heroAtk = (h) => h.atk * (h.st.rally ? 1.25 : 1) * (h.st.curse ? 0.8 : 1);
function foeDefence(f) {
  const guarded = hasTrait(f, 'guarded') && !f.st.guardBroken;
  return f.def * (guarded ? 3 : 1) * (f.st.curse ? 0.7 : 1);
}
function lowHpFactor(h, dmg) {
  const miss = 1 - h.hp / h.maxHp;
  let m = 1;
  if (dmg?.bonus === 'lowHp') { const mx = dmg.max ?? dmg.mult * 4 / 3; m *= 1 + (mx / dmg.mult - 1) * miss; }
  for (const t of h.weapon.traits || []) if (t.id === 'lowHpPower') m *= 1 + (t.max || 0) * miss;
  return m;
}

// one hunter hit on a foe: computes, applies, and runs the on-hit extras. opts: { mult, element, grade, rawGrade, pierce,
// forceCrit, source, dmg (skill dmg spec), primary (a strike: weapon extras may fire) }
function heroHit(b, h, f, opts, out) {
  if (f.ko) return null;
  const { grade } = opts;
  if (grade === 'weak' && hasTrait(f, 'evasive')) {
    out.push({ t: 'miss', uid: f.uid, by: h.uid, why: 'evasive' });
    return { miss: true, f, grade };
  }
  if (grade === 'perfect' && hasTrait(f, 'guarded') && !f.st.guardBroken) {
    setStatus(b, f, 'guardBroken', { turns: 2 }, out);
    out.push({ t: 'guardBreak', uid: f.uid });
  }
  const el = opts.element ?? h.weapon.element ?? null;
  const critChance = h.luck * R.CRIT_PER_LUCK + (h.sum.crit || 0);
  const crit = !!opts.forceCrit || b.rng.chance(critChance);
  const dice = R.rollDice(b.rng, h.weapon.dice, crit).total;
  const em = elementMult(f, el);
  let raw = (dice + heroAtk(h)) * opts.mult * R.GRADES[grade].mult * em.m;
  if (hasTrait(f, 'armored') && !el) raw *= 0.5;
  if (f.st.mark) raw *= 1.25;
  if (h.st.vanish) raw *= 2;
  if (f.boss && h.sum.bossDmgPct) raw *= 1 + h.sum.bossDmgPct;
  raw *= lowHpFactor(h, opts.dmg);
  let dfn = foeDefence(f);
  if (opts.pierce) dfn = 0;
  else if (h.sum.pierce) dfn *= Math.max(0, 1 - h.sum.pierce);
  let n = Math.max(1, Math.round(raw) - Math.round(dfn));
  if (f.st.stone) n = Math.max(1, Math.round(n * 0.25));
  if (crit) b.tally.crits++;
  const dealt = dealDamage(b, f, n, {
    by: h.uid, source: opts.source || 'strike', grade, rawGrade: opts.rawGrade || grade, crit, weak: em.weak, resist: em.resist, element: el,
  }, out);
  if (crit) out.push({ t: 'say', pool: 'strike.crit', uid: h.uid });
  if (em.weak) out.push({ t: 'say', pool: 'strike.weakpoint', uid: f.uid });
  else if (em.resist) out.push({ t: 'say', pool: 'strike.resisted', uid: f.uid });
  // lifesteal on any hit
  if (h.sum.lifesteal && dealt > 0) heal(b, h, dealt * pctOf(h.sum.lifesteal), out, { by: h.uid });
  // weapon traits (only on the hunter's own swings, not on the extra hits they make)
  if (opts.primary !== false && opts.source !== 'splash' && opts.source !== 'chain' && opts.source !== 'volley') {
    for (const t of h.weapon.traits || []) {
      if (t.id === 'statusOn' && (t.on === 'hit' || grade === 'perfect') && !f.ko && b.rng.chance(t.chance ?? 1)) {
        applyStatusFrom(b, h, f, t.status, t.turns, out);
      }
      if (t.id === 'healOnPerfect' && grade === 'perfect') {
        const a = livingHeroes(b).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0];
        if (a) heal(b, a, a.maxHp * pctOf(t.pct), out, { by: h.uid });
      }
    }
  }
  return { miss: false, f, n: dealt, grade, crit };
}

// strike extras from the weapon (sword splash, dagger extra hit, staff chain, bow volley)
function weaponExtras(b, h, f, grade, n, out) {
  for (const t of h.weapon.traits || []) {
    if (t.id === 'splash' && grade === 'perfect') {
      for (const o of livingFoes(b)) if (o !== f) dealDamage(b, o, Math.max(1, Math.round(n * pctOf(t.pct))), { by: h.uid, source: 'splash', grade }, out);
    }
    if (t.id === 'extraHit' && grade === 'perfect') {
      const tg = f.ko ? targetableFoes(b)[0] : f;
      if (tg) heroHit(b, h, tg, { mult: t.mult ?? 1, grade, source: 'strike', primary: false }, out);
    }
    if (t.id === 'chain' && grade !== 'weak') {
      const others = targetableFoes(b).filter((o) => o !== f).slice(0, t.jumps ?? 2);
      for (const o of others) heroHit(b, h, o, { mult: t.mult ?? 0.5, grade, source: 'chain', primary: false }, out);
    }
    if (t.id === 'volley' && grade === 'perfect') {
      for (let k = 0; k < (t.arrows ?? 2); k++) {
        const o = b.rng.pick(targetableFoes(b));
        if (o) heroHit(b, h, o, { mult: t.mult ?? 0.6, grade, source: 'volley', primary: false }, out);
      }
    }
  }
}

function dotN(src, status) {
  const a = src.side === 'hero' ? heroAtk(src) : src.atk;
  if (status === 'burn') return Math.max(2, Math.round(a * (src.side === 'hero' ? 0.5 : 0.3)));
  if (status === 'poison') return Math.max(1, Math.round(a * (src.side === 'hero' ? 0.35 : 0.2)));
  return undefined;
}
function applyStatusFrom(b, src, u, status, turns, out) {
  if (u.ko) return;
  setStatus(b, u, status, { turns, n: dotN(src, status), by: src.uid }, out);
}

// ---------- hunter actions ----------
function consumables(b) {
  const map = new Map();
  for (const inst of b.bag) {
    const it = b.content.items?.[inst.id];
    if (!it || it.kind !== 'consumable' || !it.use) continue;
    const q = inst.qty ?? 1;
    if (q <= 0) continue;
    map.set(it.id, { it, qty: (map.get(it.id)?.qty || 0) + q });
  }
  return [...map.values()];
}
function itemTarget(use) {
  if (use.revive) return 'fallen';
  if (use.dmg || (use.apply || []).some((a) => a.to === 'foes')) return 'allFoes';
  if (use.smoke) return 'allAllies';
  return 'ally';
}
function skillTarget(s) {
  if (s.target) return s.target;
  const e = s.effect || {};
  if (e.dmg) return e.dmg.target === 'all' ? 'allFoes' : 'foe';
  if (e.heal?.to === 'allies' || e.shield?.to === 'allies' || e.revive) return 'allAllies';
  if (e.heal || e.shield) return 'ally';
  return 'self';
}

export function commandWindowFor(b, uid, targetUid) {
  const h = unit(b, uid);
  const f = targetUid ? unit(b, targetUid) : null;
  const foeSpd = f && f.side === 'foe' ? effSpeed(f) : Math.max(0, ...livingFoes(b).map(effSpeed));
  return R.commandWindow({ difficulty: b.difficulty, heroSpd: effSpeed(h), foeSpd, bonus: pctOf(h.sum.strikeWindow || 0) });
}

export function heroActions(b, uid) {
  const h = unit(b, uid);
  if (!h || h.ko) return [];
  const fam = h.family;
  const win = commandWindowFor(b, uid, null);
  const acts = [];
  const strikeOk = !h.st.webbed;
  acts.push({ id: 'strike', kind: 'strike', name: h.src.strike?.name || STR.strike, text: h.src.strike?.text || STR.strikeText, cost: 0,
    enabled: strikeOk, why: strikeOk ? null : STR.webbed, command: fam, hits: 1, target: 'foe', window: win });
  for (const s of h.src.skills || []) {
    const cost = s.cost ?? (s.ultimate ? 5 : 2);
    const lvl = s.level || 1;
    const target = skillTarget(s);
    const a = { id: s.id, kind: 'skill', name: s.name, text: s.text, cost, level: lvl, ultimate: !!s.ultimate,
      command: s.command ? fam : null, hits: s.command ? (s.hits || 1) : 0, target, window: win, fx: s.fx };
    let why = null;
    if (b.level < lvl) why = STR.level(lvl);
    else if (h.st.silenced) why = STR.silenced;
    else if (h.fury < cost) why = STR.needFury(cost);
    else if (s.effect?.hpCost && h.hp <= h.maxHp * pctOf(s.effect.hpCost)) why = STR.hpLow;
    else if (!skillUseful(b, h, s, target)) why = STR.noTarget;
    a.enabled = !why; a.why = why;
    acts.push(a);
  }
  acts.push({ id: 'defend', kind: 'defend', name: STR.defend, text: STR.defendText, cost: 0, enabled: true, command: null, hits: 0, target: 'self' });
  for (const { it, qty } of consumables(b)) {
    const target = itemTarget(it.use);
    const ok = target === 'fallen' ? fallenHeroes(b).length > 0 : true;
    acts.push({ id: 'item:' + it.id, kind: 'item', itemId: it.id, name: it.name, text: it.text, qty, cost: 0,
      enabled: ok, why: ok ? null : STR.noTarget, command: null, hits: 0, target });
  }
  return acts;
}

function skillUseful(b, h, s, target) {
  const e = s.effect || {};
  if (target === 'fallen') return fallenHeroes(b).length > 0;
  if (e.revive && !e.heal && !e.dmg) return fallenHeroes(b).length > 0;
  if (target === 'foe' || target === 'allFoes') return livingFoes(b).length > 0;
  return true;
}

export function targetsFor(b, uid, actionId) {
  const h = unit(b, uid);
  const a = heroActions(b, uid).find((x) => x.id === actionId);
  if (!h || !a) return [];
  switch (a.target) {
    case 'foe': {
      const fs = targetableFoes(b).map((f) => f.uid);
      if (a.kind === 'strike') for (const x of livingHeroes(b)) if (x !== h && x.st.cocoon) fs.push(x.uid);
      return fs;
    }
    case 'allFoes': return targetableFoes(b).map((f) => f.uid);
    case 'ally': return livingHeroes(b).map((x) => x.uid);
    case 'allAllies': return livingHeroes(b).map((x) => x.uid);
    case 'fallen': return fallenHeroes(b).map((x) => x.uid);
    case 'self': return [h.uid];
    default: return [];
  }
}

const recipients = (b, h, to, chosen, hit) => {
  switch (to) {
    case 'self': return [h];
    case 'allies': return livingHeroes(b);
    case 'foes': return livingFoes(b);
    case 'ally': case 'target': default: return (hit && hit.length ? hit : chosen).filter((u) => !u.ko);
  }
};

export function resolveHeroAction(b, uid, actionId, targetUids = [], { grades = [] } = {}) {
  const h = unit(b, uid);
  b.current = uid;
  const out = [];
  if (!h || h.ko) return out;
  const acts = heroActions(b, uid);
  const a = acts.find((x) => x.id === actionId);
  if (!a) throw new Error('Unknown action ' + actionId);
  const chosen = targetUids.map((id) => unit(b, id)).filter(Boolean);
  out.push({ t: 'act', uid, actionId, kind: a.kind, name: a.name, targets: targetUids, fx: a.fx || null, cost: a.cost });

  // grades: one per command; Squire upgrades Weak to Good
  const raw = a.hits ? Array.from({ length: a.hits }, (_, i) => grades[i] ?? grades[grades.length - 1] ?? 'good') : [];
  const eff = raw.map((g) => (g === 'weak' && R.DIFFICULTY[b.difficulty]?.weakAsGood ? 'good' : g));
  // a skill pays its Fury first, so Perfect-command Fury earned during it is not lost to the cap
  if (a.kind === 'skill' && a.cost) {
    h.fury = Math.max(0, h.fury - a.cost);
    out.push({ t: 'fury', uid, n: -a.cost, total: h.fury });
  }
  for (const g of eff) {
    b.tally[g === 'perfect' ? 'perfects' : g === 'good' ? 'goods' : 'weaks']++;
    if (g === 'perfect') addFury(h, R.FURY.perfect + (h.sum.furyOnPerfect || 0), out);
  }
  const gAt = (i) => eff[Math.min(i, eff.length - 1)] || 'good';
  const rAt = (i) => raw[Math.min(i, raw.length - 1)] || 'good';
  if (a.kind === 'strike' || (a.kind === 'skill' && a.command)) out.push({ t: 'say', pool: 'strike.' + gAt(0), uid });

  const hits = [];
  let dealtDamage = false;

  if (a.kind === 'defend') {
    setStatus(b, h, 'defend', { turns: 1 }, out);
    out.push({ t: 'defend', uid });
    addFury(h, R.FURY.defend, out);
  } else if (a.kind === 'strike') {
    let t = chosen[0] || targetableFoes(b)[0];
    if (t && t.side === 'hero') {
      if (t.st.cocoon) { clearStatus(t, 'cocoon', out); out.push({ t: 'free', uid: t.uid, by: uid }); }
    } else {
      if (!t || t.ko) t = targetableFoes(b)[0];
      if (t) {
        const r = heroHit(b, h, t, { mult: 1, grade: gAt(0), rawGrade: rAt(0), source: 'strike' }, out);
        if (r) { hits.push(r); dealtDamage = true; if (!r.miss) weaponExtras(b, h, t, r.grade, r.n, out); }
      }
    }
  } else if (a.kind === 'item') {
    useItem(b, h, a.itemId, chosen, out);
  } else {
    const s = h.src.skills.find((x) => x.id === actionId);
    const e = s.effect || {};
    if (e.hpCost) {
      const c = Math.min(h.hp - 1, Math.round(h.maxHp * pctOf(e.hpCost)));
      if (c > 0) { h.hp -= c; out.push({ t: 'damage', uid, n: c, hp: h.hp, maxHp: h.maxHp, by: uid, source: 'cost', absorbed: 0 }); }
    }
    if (e.dmg) { dealtDamage = true; skillDamage(b, h, e.dmg, chosen, gAt, rAt, hits, out); }
    const hitFoes = hits.filter((r) => !r.miss).map((r) => r.f);
    const missedAll = e.dmg && hits.length > 0 && hitFoes.length === 0;
    for (const ap of e.apply || []) {
      if (missedAll && (ap.to || 'target') === 'target') continue;
      const list = recipients(b, h, ap.to || 'target', chosen, e.dmg ? hitFoes : null);
      // a one-turn self mark (Reckless Swing) is the dedicated 'reckless' status: +25% damage taken until this
      // hunter's next turn starts, and it never replaces a Mark a foe put on them
      const selfMark = ap.status === 'mark' && (ap.to === 'self') && (ap.turns ?? 1) <= 1;
      for (const u of [...new Set(list)]) {
        if (ap.chance != null && !b.rng.chance(ap.chance)) continue;
        if (selfMark && u === h) setStatus(b, h, 'reckless', { turns: 1 }, out);
        else applyStatusFrom(b, h, u, ap.status, ap.turns, out);
      }
    }
    if (e.revive) {
      const list = e.revive.to === 'target' ? chosen.filter((u) => u.ko) : fallenHeroes(b);
      for (const u of list) heal(b, u, u.maxHp * pctOf(e.revive.pct), out, { by: uid, revive: true });
    }
    if (e.heal) for (const u of recipients(b, h, e.heal.to || 'target', chosen.length ? chosen : [h], null)) heal(b, u, u.maxHp * pctOf(e.heal.pct), out, { by: uid });
    if (e.shield) for (const u of recipients(b, h, e.shield.to || 'self', chosen.length ? chosen : [h], null)) addShield(b, u, Math.round(u.maxHp * pctOf(e.shield.pct)), e.shield.turns ?? 2, out);
    if (e.fury) addFury(h, e.fury, out);
    if (e.taunt) setStatus(b, h, 'taunt', { turns: e.taunt }, out);
    if (e.vanish) setStatus(b, h, 'vanish', { turns: e.vanish }, out);
    if (e.trap) { b.trap = { owner: uid, mult: e.trap.mult ?? 1 }; out.push({ t: 'trap', uid, on: true }); }
  }

  if (dealtDamage && h.st.vanish && a.kind !== 'skill') clearStatus(h, 'vanish', out);
  else if (dealtDamage && h.st.vanish && !(h.src.skills.find((x) => x.id === actionId)?.effect?.vanish)) clearStatus(h, 'vanish', out);

  // counter: a Weak swing at a counter foe that still stands
  const weakHit = hits.find((r) => r.grade === 'weak' && !r.f.ko && hasTrait(r.f, 'counter'));
  if (weakHit && !h.ko && livingFoes(b).length) {
    const f = weakHit.f;
    out.push({ t: 'counter', uid: f.uid, target: uid });
    const mv = f.moves.find((m) => m.id === 'counter') || {};
    b.pending.push({ uid: f.uid, intent: {
      uid: f.uid, moveId: 'counter', name: mv.name || STR.counter, targets: [uid], telegraph: 'normal', element: mv.element || null,
      block: true, reason: 'counter', mult: mv.mult ?? 0.8, window: R.blockWindow({ difficulty: b.difficulty }), windup: 500, lines: [],
    } });
  }
  return out;
}

function skillDamage(b, h, dmg, chosen, gAt, rAt, hits, out) {
  const n = dmg.hits || 1;
  const base = { element: dmg.element ?? h.weapon.element ?? null, pierce: !!dmg.pierce, source: 'skill', dmg, primary: true };
  const one = (f, i, mult = dmg.mult ?? 1) => {
    const r = heroHit(b, h, f, { ...base, mult, grade: gAt(i), rawGrade: rAt(i), forceCrit: dmg.bonus === 'ifStatus' && isBad(f) }, out);
    if (r) hits.push(r);
    return r;
  };
  const pickFoe = (pref) => (pref && !pref.ko ? pref : b.rng.pick(targetableFoes(b)));
  switch (dmg.target) {
    case 'all':
      for (let i = 0; i < n; i++) for (const f of targetableFoes(b)) one(f, i);
      break;
    case 'random':
      for (let i = 0; i < n; i++) { const f = pickFoe(null); if (!f) break; one(f, i); }
      break;
    case 'chain': {
      const first = pickFoe(chosen.find((u) => u.side === 'foe'));
      if (!first) break;
      one(first, 0);
      const others = targetableFoes(b).filter((f) => f !== first).slice(0, dmg.jumps ?? 2);
      for (const f of others) one(f, 0, (dmg.jumpMult ?? 0.6));
      break;
    }
    case 'one': default: {
      let f = chosen.find((u) => u.side === 'foe');
      for (let i = 0; i < n; i++) { f = pickFoe(f); if (!f) break; one(f, i); }
    }
  }
}

function useItem(b, h, itemId, chosen, out) {
  const it = b.content.items[itemId];
  const idx = b.bag.findIndex((x) => x.id === itemId && (x.qty ?? 1) > 0);
  if (idx < 0) return;
  const inst = b.bag[idx];
  if (inst.qty != null && inst.qty > 1) inst.qty--; else b.bag.splice(idx, 1);
  b.used.push(inst.uid);
  out.push({ t: 'item', uid: h.uid, itemId, itemUid: inst.uid });
  const use = it.use || {};
  const target = chosen[0] || h;
  if (use.revive) { const u = chosen.find((x) => x.ko) || fallenHeroes(b)[0]; if (u) heal(b, u, u.maxHp * pctOf(use.revive), out, { by: h.uid, revive: true }); }
  if (use.cleanse && !target.ko) for (const s of R.BAD_STATUSES) clearStatus(target, s, out);
  if (use.heal && !target.ko) heal(b, target, target.maxHp * pctOf(use.heal), out, { by: h.uid });
  if (use.fury) addFury(target.ko ? h : target, use.fury, out);
  if (use.dmg) {
    for (const f of targetableFoes(b)) {
      const el = use.dmg.element || null;
      const em = elementMult(f, el);
      let raw = heroAtk(h) * 2 * (use.dmg.mult ?? 1) * em.m;
      if (hasTrait(f, 'armored') && !el) raw *= 0.5;
      if (f.st.mark) raw *= 1.25;
      let n = Math.max(1, Math.round(raw) - Math.round(foeDefence(f)));
      if (f.st.stone) n = Math.max(1, Math.round(n * 0.25));
      dealDamage(b, f, n, { by: h.uid, source: 'item', grade: null, crit: false, weak: em.weak, resist: em.resist, element: el }, out);
    }
  }
  for (const ap of use.apply || []) {
    const list = ap.to === 'foes' ? livingFoes(b) : ap.to === 'allies' ? livingHeroes(b) : ap.to === 'self' ? [h] : [target];
    for (const u of list) if (ap.chance == null || b.rng.chance(ap.chance)) applyStatusFrom(b, h, u, ap.status, ap.turns, out);
  }
  if (use.smoke) for (const u of livingHeroes(b)) setStatus(b, u, 'smoke', { turns: 1 }, out);
}

// ---------- turn order and turns ----------
const effSpeed = (u) => (u.spd || 0) * (u.st.chill ? 0.5 : 1);
export function turnOrder(b) {
  const units = [...livingHeroes(b), ...livingFoes(b)];
  const idx = (u) => (u.side === 'hero' ? b.heroes.indexOf(u) : 100 + b.foes.indexOf(u));
  return units.sort((x, y) => effSpeed(y) - effSpeed(x) || (x.side === y.side ? idx(x) - idx(y) : x.side === 'hero' ? -1 : 1)).map((u) => u.uid);
}

export function beginRound(b) {
  const out = [];
  b.round++;
  // the cap counts from the last form change, so a two-form final boss gets the cap for each form
  if (b.round - (b.capBase || 0) > R.ROUND_CAP) { b.capHit = true; out.push({ t: 'cap', n: b.round }); return out; }
  out.push({ t: 'round', n: b.round });
  for (const h of b.heroes) if (h.st.smoke && b.round > h.st.smoke.round + 1) clearStatus(h, 'smoke', out);
  for (const f of livingFoes(b)) {
    if (!hasTrait(f, 'pagecast')) continue;
    const els = [...new Set(f.moves.map((m) => m.element).filter(Boolean))];
    f.page = b.rng.pick(els.length ? els : R.ELEMENTS);
    out.push({ t: 'page', uid: f.uid, element: f.page, weakTo: R.OPPOSITE[f.page] });
  }
  return out;
}

export function canAct(b, uid) { const u = unit(b, uid); return !!u && !u.ko && !u.skip && !b.capHit; }

export function beginTurn(b, uid) {
  const u = unit(b, uid);
  const out = [];
  if (!u) return out;
  b.current = uid;
  u.skip = null;
  u.turns++;
  out.push({ t: 'turn', uid });
  if (u.ko) { u.skip = 'down'; out.push({ t: 'skip', uid, why: 'down' }); return out; }
  if (u.side === 'hero') {
    for (const s of UNTIL_NEXT_TURN) clearStatus(u, s, out);
    addFury(u, R.FURY.perTurn, out);
    if (u.sum.regen) heal(b, u, u.maxHp * pctOf(u.sum.regen), out, { by: uid });
  } else {
    if (hasTrait(u, 'heat') && u.turns > 1) { u.heat = Math.round((u.heat + 0.15) * 100) / 100; out.push({ t: 'heat', uid, heat: u.heat, reset: false }); }
    if (hasTrait(u, 'stealth')) {
      if (u.st.hidden) clearStatus(u, 'hidden', out);
      else if (u.turns % 2 === 1) setStatus(b, u, 'hidden', { turns: 99 }, out);
    }
  }
  // damage over time (no Defence)
  for (const s of ['burn', 'poison']) {
    const v = u.st[s];
    if (!v || u.ko) continue;
    const n = (v.n || 2) * (s === 'poison' ? v.stacks || 1 : 1);
    dealDamage(b, u, n, { by: v.by || null, source: s, grade: null, crit: false, weak: false, resist: false, element: s === 'burn' ? 'fire' : null }, out);
  }
  if (u.ko) { u.skip = 'down'; out.push({ t: 'skip', uid, why: 'down' }); return out; }
  if (u.st.stone) { u.skip = 'stone'; out.push({ t: 'skip', uid, why: 'stone' }); return out; }
  if (u.st.stun) {
    const hard = u.st.stun.hard;
    clearStatus(u, 'stun', out);
    if (u.side === 'foe' && u.boss && !hard) { u.halfNext = true; out.push({ t: 'stagger', uid }); }
    else { u.skip = 'stun'; out.push({ t: 'skip', uid, why: 'stun' }); return out; }
  }
  if (u.st.cocoon) { u.skip = 'cocoon'; out.push({ t: 'skip', uid, why: 'cocoon' }); return out; }
  return out;
}

export function endTurn(b, uid) {
  const u = unit(b, uid);
  const out = [];
  if (!u) return out;
  if (u.side === 'foe' && !u.ko && hasTrait(u, 'stoneform')) {
    if (u.st.stone) clearStatus(u, 'stone', out);
    else if (!u.skip) setStatus(b, u, 'stone', { turns: 99 }, out);
  }
  for (const [s, v] of Object.entries(u.st)) {
    if (NO_TICK.includes(s)) continue;
    if (v.fresh) { v.fresh = false; continue; }
    v.turns--;
    if (v.turns <= 0) clearStatus(u, s, out);
  }
  if (u.shieldFresh) u.shieldFresh = false;
  else if (u.shieldTurns != null && u.shield > 0) {
    u.shieldTurns--;
    if (u.shieldTurns <= 0) { u.shield = 0; u.shieldTurns = null; out.push({ t: 'shield', uid, n: 0, total: 0 }); }
  }
  u.skip = null;
  b.current = null;
  return out;
}

// ---------- foes ----------
function weighted(b, moves) {
  const total = moves.reduce((s, m) => s + (m.weight ?? 1), 0);
  let x = b.rng.float() * total;
  for (const m of moves) { x -= m.weight ?? 1; if (x < 0) return m; }
  return moves[moves.length - 1];
}
const isCocoonMove = (m) => (m.effect?.apply || []).some((a) => a.status === 'cocoon');

function pickHeroTargets(b, move) {
  let hs = livingHeroes(b).filter((h) => !h.st.vanish);
  if (isCocoonMove(move)) hs = hs.filter((h) => !h.st.cocoon);
  if (!hs.length) return [];
  if (move.target === 'all') return hs.map((h) => h.uid);
  const taunt = hs.find((h) => h.st.taunt);
  if (taunt) return [taunt.uid];
  switch (move.target) {
    case 'weakest': return [hs.slice().sort((x, y) => x.hp - y.hp)[0].uid];
    case 'strongest': return [hs.slice().sort((x, y) => y.hp - x.hp)[0].uid];
    default: return [b.rng.pick(hs).uid];
  }
}

export function chooseFoeIntent(b, uid) {
  const f = unit(b, uid);
  if (!f || f.ko || f.skip) return null;
  let moves = f.moves.filter((m) => m.id !== 'explode' && m.id !== 'counter');
  // never cocoon the last free hunter
  const free = livingHeroes(b).filter((h) => !h.st.cocoon).length;
  if (free <= 1) moves = moves.filter((m) => !isCocoonMove(m));
  if (!moves.length) moves = [{ id: 'hit', name: f.name, mult: 1, target: 'one' }];
  const big = moves.filter((m) => m.telegraph === 'big');
  let move;
  if (big.length && f.sinceBig >= 3) move = weighted(b, big);
  else move = weighted(b, f.sinceBig < 1 ? moves.filter((m) => m.telegraph !== 'big').concat(big.length === moves.length ? big : []) : moves);
  if (move.telegraph === 'big') f.sinceBig = 0; else f.sinceBig++;
  const targets = pickHeroTargets(b, move);
  const element = hasTrait(f, 'pagecast') && f.page ? f.page : move.element || null;
  const isBig = move.telegraph === 'big';
  const tgs = targets.map((id) => unit(b, id));
  const bonus = Math.max(0, ...tgs.map((h) => pctOf(h.sum.blockWindow || 0)));
  return {
    uid, moveId: move.id, name: move.name, targets, telegraph: isBig ? 'big' : 'normal', element,
    block: (move.mult ?? 1) > 0 && targets.length > 0, reason: 'turn', mult: move.mult ?? 1,
    window: R.blockWindow({ difficulty: b.difficulty, big: isBig, chilled: !!f.st.chill, bonus }),
    windup: isBig ? 1600 : 900, lines: move.lines?.intent || [],
  };
}

function foeAtk(b, f) {
  const aura = livingFoes(b).some((o) => o !== f && hasTrait(o, 'aura')) ? 1.25 : 1;
  return f.atk * (1 + (f.heat || 0)) * aura * (f.st.rally ? 1.25 : 1) * (f.st.curse ? 0.8 : 1) * (f.halfNext ? 0.5 : 1);
}

export function resolveFoeIntent(b, uid, intent, { block = 'miss' } = {}) {
  const f = unit(b, uid);
  const out = [];
  if (!f || !intent) return out;
  const pendingKind = intent.reason === 'explode' || intent.reason === 'counter';
  if (f.ko && intent.reason !== 'explode') return out;
  if (intent.reason === 'turn') b.current = uid;
  if (block === 'weak') block = 'miss';
  if (!R.BLOCKS[block]) block = 'miss';
  const move = f.moves.find((m) => m.id === intent.moveId) || { id: intent.moveId, name: intent.name, mult: intent.mult ?? 1, element: intent.element };
  const isBig = intent.telegraph === 'big';
  if (isBig && !pendingKind) out.push({ t: 'say', pool: 'foe.big', uid });

  // Snare Trap: the next foe to attack springs it, is stunned and takes the hit; its attack is spent
  if (b.trap && !pendingKind && !f.ko) {
    const owner = unit(b, b.trap.owner);
    const mult = b.trap.mult;
    b.trap = null;
    out.push({ t: 'trap', uid: owner?.uid || null, on: false, target: uid });
    if (owner && !owner.ko) heroHit(b, owner, f, { mult, grade: 'good', source: 'trap', primary: false }, out);
    if (!f.ko) setStatus(b, f, 'stun', { turns: 1 }, out);
    return out;
  }

  let targets = intent.targets.map((id) => unit(b, id)).filter((h) => h && !h.ko);
  if (!targets.length && intent.targets.length && !isCocoonMove(move)) targets = pickHeroTargets(b, move).map((id) => unit(b, id));
  out.push({ t: 'foeAct', uid, moveId: move.id, name: move.name || intent.name, targets: targets.map((h) => h.uid), telegraph: intent.telegraph, element: intent.element, reason: intent.reason });
  if (!targets.length) { out.push({ t: 'miss', uid: null, by: uid, why: 'nobody' }); f.halfNext = false; return out; }

  if (intent.block) {
    b.tally.blocks++;
    if (block === 'perfect') b.tally.perfectBlocks++;
    out.push({ t: 'say', pool: 'block.' + block, uid });
  }
  if (block === 'perfect' && intent.block) {
    if (f.heat > 0) { f.heat = 0; out.push({ t: 'heat', uid, heat: 0, reset: true }); }
    for (const h of targets) if (h.sum.furyOnBlock) addFury(h, h.sum.furyOnBlock, out);
  }
  const bm = intent.block ? R.BLOCKS[block] : 1;
  const mult = move.mult ?? 1;
  const atk = foeAtk(b, f);
  const landed = [];
  for (const h of targets) {
    if (h.ko) continue;
    if (mult > 0) {
      if (h.st.vanish) { out.push({ t: 'miss', uid: h.uid, by: uid, why: 'vanish' }); continue; }
      if (h.st.smoke) { clearStatus(h, 'smoke', out); out.push({ t: 'miss', uid: h.uid, by: uid, why: 'smoke' }); continue; }
      if (h.sum.dodge && b.rng.chance(pctOf(h.sum.dodge))) { out.push({ t: 'miss', uid: h.uid, by: uid, why: 'dodge' }); continue; }
      const hdef = h.def * (h.st.curse ? 0.7 : 1);
      let n = Math.max(1, atk * mult * bm - hdef);
      for (const r of h.resists) if (intent.element && (r.elements || []).includes(intent.element)) n *= r.mult ?? 0.5;
      if (h.st.defend) n *= 0.5;
      if (h.st.reckless) n *= 1.25;
      if (h.st.mark) n *= 1.25;
      n = Math.max(1, Math.round(n));
      // the last foe's dying blast cannot knock anyone down: the party has won, hunters stand at 1 Health at worst
      if (intent.reason === 'explode' && !livingFoes(b).length) n = Math.min(n, Math.max(0, h.hp + h.shield - 1));
      const dealt = dealDamage(b, h, n, { by: uid, source: intent.reason === 'turn' ? 'foe' : intent.reason, block: intent.block ? block : null, element: intent.element, big: isBig, crit: false, weak: false, resist: false }, out);
      if (h.sum.thorns && !f.ko && dealt > 0) dealDamage(b, f, Math.max(1, Math.round(dealt * pctOf(h.sum.thorns))), { by: h.uid, source: 'thorns' }, out);
      if (!h.ko) addFury(h, R.FURY.hit, out);
    }
    if (!h.ko) landed.push(h);
  }
  f.halfNext = false;
  // the big attack's opening: a Perfect block stuns the boss for a turn (even a boss)
  if (isBig && block === 'perfect' && intent.block && !f.ko) {
    setStatus(b, f, 'stun', { turns: 1, hard: true }, out);
    out.push({ t: 'opening', uid });
  }
  const e = move.effect || {};
  for (const ap of e.apply || []) {
    const to = ap.to || 'target';
    let list = to === 'self' ? [f] : to === 'allies' ? livingFoes(b) : to === 'foes' ? livingHeroes(b) : landed;
    if ((to === 'target' || to === 'foes') && block === 'perfect' && intent.block && PREVENTED_BY_PERFECT.includes(ap.status)) list = [];
    if (ap.status === 'cocoon') list = list.filter((h) => livingHeroes(b).filter((x) => !x.st.cocoon && x !== h).length > 0);
    for (const u of list) if (!u.ko && (ap.chance == null || b.rng.chance(ap.chance))) applyStatusFrom(b, f, u, ap.status, ap.turns, out);
  }
  if (e.heal && !f.ko) for (const u of e.heal.to === 'allies' ? livingFoes(b) : [f]) heal(b, u, u.maxHp * pctOf(e.heal.pct), out, { by: uid });
  if (e.shield && !f.ko) for (const u of e.shield.to === 'allies' ? livingFoes(b) : [f]) addShield(b, u, Math.round(u.maxHp * pctOf(e.shield.pct)), e.shield.turns ?? 2, out);
  if (e.summon && !f.ko) summon(b, f, e.summon, out);
  return out;
}

export function takePending(b) {
  const p = b.pending;
  b.pending = [];
  if (!livingHeroes(b).length) return [];
  return p;
}

// pending explosions and counters are settled (with their block) before a result is declared
export function outcome(b) {
  if (b.capHit) return 'lose';
  if (b.pending.length && livingHeroes(b).length) return null;
  if (!livingFoes(b).length) return 'win';
  if (!livingHeroes(b).length) return 'lose';
  return null;
}

export function finish(b) {
  return {
    result: outcome(b) || 'lose', rounds: b.round, capHit: b.capHit,
    heroes: b.heroes.map((h) => ({ uid: h.uid, id: h.id, arch: h.arch, hp: h.hp, ko: h.ko })),
    used: [...b.used], tally: { ...b.tally },
  };
}

// ---------- AI (autoplay and the simulator) ----------
function expHit(b, h, f, mult, el, { pierce = false, hits = 1 } = {}) {
  if (!f || f.ko) return 0;
  const em = elementMult(f, el);
  let raw = (R.avgDice(h.weapon.dice) + heroAtk(h)) * mult * em.m;
  if (hasTrait(f, 'armored') && !el) raw *= 0.5;
  if (f.st.mark) raw *= 1.25;
  if (h.st.vanish) raw *= 2;
  let n = Math.max(1, raw - (pierce ? 0 : foeDefence(f) * (1 - (h.sum.pierce || 0))));
  if (f.st.stone) n *= 0.25;
  if (hasTrait(f, 'evasive')) n *= 0.85;
  return Math.min(n * hits, f.hp + f.shield) + (n * hits >= f.hp ? 4 : 0);
}

function bestFoeTarget(b, h, mult, el, opts) {
  const fs = targetableFoes(b);
  let best = null, bs = -1;
  for (const f of fs) {
    const s = expHit(b, h, f, mult, el, opts) * (f.boss ? 1.05 : 1) + (hasTrait(f, 'aura') ? 3 : 0) + (f.st.stone ? -5 : 0);
    if (s > bs) { bs = s; best = f; }
  }
  return { f: best, score: bs };
}

export function chooseAI(b, uid) {
  const h = unit(b, uid);
  const acts = heroActions(b, uid);
  const A = Object.fromEntries(acts.map((a) => [a.id, a]));
  const ok = (id) => A[id]?.enabled;
  const skills = (h.src.skills || []).filter((s) => ok(s.id));
  const allies = livingHeroes(b);
  const fallen = fallenHeroes(b);
  const foes = livingFoes(b);
  const hurt = allies.filter((x) => x.hp / x.maxHp < (allies.length === 1 ? 0.35 : 0.45)).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp);
  const bossHere = foes.some((f) => f.boss);
  const ultUnlocked = (h.src.skills || []).some((s) => s.ultimate && b.level >= (s.level || 6));
  const item = (pred) => acts.find((a) => a.kind === 'item' && a.enabled && pred(b.content.items[a.itemId].use || {}));

  // free a cocooned ally
  const cocooned = allies.find((x) => x !== h && x.st.cocoon);
  if (cocooned && ok('strike')) return { actionId: 'strike', targetUids: [cocooned.uid] };

  // stand the fallen up
  for (const s of skills) if (s.effect?.revive && fallen.length) return { actionId: s.id, targetUids: s.target === 'fallen' ? [fallen[0].uid] : [] };
  if (fallen.length && (allies.length <= Math.ceil(b.heroes.length / 2))) {
    const it = item((u) => u.revive);
    if (it) return { actionId: it.id, targetUids: [fallen[0].uid] };
  }
  // heal
  const healSkill = skills.find((s) => s.effect?.heal && !s.effect?.revive && (s.effect.heal.to || 'target') !== 'allies');
  if (healSkill && hurt.length) return { actionId: healSkill.id, targetUids: [hurt[0].uid] };
  const groupShield = skills.find((s) => s.effect?.shield && s.effect.shield.to === 'allies');
  if (groupShield && allies.length >= 2 && allies.filter((x) => x.hp / x.maxHp < 0.7 && !x.shield).length >= Math.min(2, allies.length)) return { actionId: groupShield.id, targetUids: [] };
  if (h.hp / h.maxHp < 0.3) {
    const it = item((u) => u.heal && !u.revive);
    if (it) return { actionId: it.id, targetUids: [h.uid] };
    const vanish = skills.find((s) => s.effect?.vanish);
    if (vanish) return { actionId: vanish.id, targetUids: [] };
  }
  const bad = allies.find((x) => x.st.cocoon == null && (x.st.poison?.stacks >= 2 || x.st.curse));
  if (bad) { const it = item((u) => u.cleanse); if (it && b.rng.chance(0.5)) return { actionId: it.id, targetUids: [bad.uid] }; }

  // utility skills
  for (const s of skills) {
    const e = s.effect || {};
    if (e.dmg) continue;
    if (e.taunt && allies.length >= 2 && h.hp / h.maxHp > 0.55 && !h.st.taunt) return { actionId: s.id, targetUids: [] };
    if (e.trap && !b.trap && (bossHere || foes.length >= 2) && b.round - (h.trapRound ?? -9) >= 4) { h.trapRound = b.round; return { actionId: s.id, targetUids: [] }; }
    if (e.fury && e.hpCost && ultUnlocked && h.fury <= 2 && h.hp / h.maxHp > 0.6) return { actionId: s.id, targetUids: [] };
    const ap = e.apply || [];
    if (ap.some((x) => x.status === 'rally' && x.to === 'allies') && allies.length >= 2 && !allies.some((x) => x.st.rally)) return { actionId: s.id, targetUids: [] };
    if (ap.some((x) => x.status === 'curse')) {
      const t = foes.filter((f) => !f.st.curse).sort((x, y) => (y.boss - x.boss) || (y.hp - x.hp))[0];
      if (t && (t.boss || t.hp > 30)) return { actionId: s.id, targetUids: [t.uid] };
    }
  }
  if (fallen.length === 0 && foes.length >= 3) {
    const it = item((u) => u.dmg);
    if (it && b.rng.chance(0.4)) return { actionId: it.id, targetUids: [] };
  }
  if (h.fury <= 1 && ultUnlocked) { const it = item((u) => u.fury); if (it && bossHere) return { actionId: it.id, targetUids: [h.uid] }; }

  // damage: strike vs damaging skills, by expected damage, paying for Fury (saving it when the ultimate is near)
  const el0 = h.weapon.element;
  const strike = ok('strike') ? bestFoeTarget(b, h, 1, el0) : { f: null, score: -1 };
  let best = { id: 'strike', targets: strike.f ? [strike.f.uid] : [], score: strike.score };
  for (const s of skills) {
    const d = s.effect?.dmg;
    if (!d) continue;
    const el = d.element ?? el0;
    const n = d.hits || 1;
    let score = 0, targets = [];
    if (d.target === 'all') score = targetableFoes(b).reduce((t, f) => t + expHit(b, h, f, d.mult, el, { pierce: d.pierce, hits: n }), 0);
    else if (d.target === 'random') score = (targetableFoes(b).reduce((t, f) => t + expHit(b, h, f, d.mult, el, { pierce: d.pierce }), 0) / Math.max(1, targetableFoes(b).length)) * n;
    else if (d.target === 'chain') {
      const bt = bestFoeTarget(b, h, d.mult, el, { pierce: d.pierce });
      const others = targetableFoes(b).filter((f) => f !== bt.f).slice(0, d.jumps ?? 2);
      score = bt.score + others.reduce((t, f) => t + expHit(b, h, f, d.jumpMult ?? 0.6, el), 0);
      targets = bt.f ? [bt.f.uid] : [];
    } else {
      let mult = d.mult;
      if (d.bonus === 'lowHp') mult *= lowHpFactor(h, d);
      const bt = bestFoeTarget(b, h, mult, el, { pierce: d.pierce, hits: n });
      score = bt.score * (d.bonus === 'ifStatus' && bt.f && isBad(bt.f) ? 1.5 : 1);
      targets = bt.f ? [bt.f.uid] : [];
    }
    for (const ap of s.effect.apply || []) {
      if (['burn', 'poison'].includes(ap.status)) score += dotN(h, ap.status) * 1.5 * (d.target === 'all' ? foes.length : 1);
      if (ap.status === 'stun') score += 4 * (ap.chance ?? 1) * (d.target === 'all' ? foes.length : 1);
      if (ap.status === 'mark' || ap.status === 'chill') score += 3;
    }
    if (s.effect.apply?.some((x) => x.status === 'reckless') && h.hp / h.maxHp < 0.4) score *= 0.5;
    const cost = A[s.id].cost;
    const save = ultUnlocked && !s.ultimate ? 0.25 : 0.12;
    const adj = score - cost * Math.max(3, strike.score) * save;
    if (adj > best.score) best = { id: s.id, targets, score: adj };
  }
  if (best.id === 'strike' && !strike.f) {
    if (h.hp / h.maxHp < 0.5) return { actionId: 'defend', targetUids: [] };
    return { actionId: 'defend', targetUids: [] };
  }
  return { actionId: best.id, targetUids: best.targets };
}
