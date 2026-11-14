// Grimspire rules (GRIMSPIRE.md 4 and 5.3). Pure: no DOM, no ctx. Works in Node and the browser.
// battle-rules.js runs battles with these; tools/gs-sim.mjs tunes the numbers.
//
// derive(hero, { level, boons, content, difficulty? }) -> { hp, atk, def, spd, luck, weapon:{ dice, element, family, traits },
//                      effects:[{ id, ...params, source }], sum:{ ...numeric totals by trait id } }
//   hero = { arch, gear:{ weapon, armour, helm, charm } }; a slot holds { uid, id, plus } or an item id string or null.
// itemStats(item, plus) -> { dice, atk, def, hp, spd, luck }   the numbers the item card, Forge and derive all show
// xpForLevel(n) -> total XP needed to reach level n (xpForLevel(1) = 0);  levelForXp(xp) -> level
// xpFor(content, encounterId, partySize) -> XP for the party: sum of foes[type].xp over every slot (same for any size)
// DIFFICULTY[id] = { id, name, hp, atk, window, blockWindow, weakAsGood }
// GRADES, BLOCKS, FURY, ELEMENTS, OPPOSITE, STATUS_DEFAULTS
// scaleFoe(foeDef, partySize, difficulty) -> { hp, atk, def, spd }
// lootRarity(total) -> 'common'|'rare'|'epic'|'legendary'
// autoGrade(rng, mix?, kind:'strike'|'block') -> 'perfect'|'good'|'weak' (strike) or 'perfect'|'good'|'miss' (block)
// MIXES: auto (the seeded Knight mix), perfect, weak, kid (the seven-year-old)
// commandWindow / blockWindow: multipliers on the base window (1 = Knight normal)
// KIT, kitFor({ floor, level?, kind?, party, content }) -> a plausible kit for a floor (autoplay &floor=N and the sim)

export const ELEMENTS = ['fire', 'frost', 'storm', 'shadow', 'spirit'];
// Vex's pages: the round he shows a page of element X he is weak to OPPOSITE[X]
export const OPPOSITE = { fire: 'frost', frost: 'fire', storm: 'shadow', shadow: 'spirit', spirit: 'shadow' };

export const GRADES = {
  perfect: { mult: 1.5, fury: 1 },
  good: { mult: 1.0, fury: 0 },
  weak: { mult: 0.5, fury: 0 },
};
export const BLOCKS = { perfect: 0.3, good: 0.6, miss: 1.0 };
export const FURY = { max: 5, start: 1, perTurn: 1, perfect: 1, hit: 1, defend: 1 };
export const CRIT_PER_LUCK = 0.03;
export const ROUND_CAP = 40;

// default turns for statuses (a skill, move or trait may pass its own)
export const STATUS_DEFAULTS = {
  burn: 3, poison: 3, chill: 2, stun: 1, mark: 3, curse: 3, rally: 3, shield: 2, taunt: 2, vanish: 1,
  webbed: 1, silenced: 1, cocoon: 2, smoke: 1,
};
export const BAD_STATUSES = ['burn', 'poison', 'chill', 'stun', 'mark', 'curse', 'webbed', 'silenced', 'cocoon'];
export const MAX_POISON = 3;

export const DIFFICULTY = {
  squire: { id: 'squire', name: { en: 'Squire', da: 'Væbner' }, hp: 0.8, atk: 0.75, window: 1.4, blockWindow: 1.4, weakAsGood: true },
  knight: { id: 'knight', name: { en: 'Knight', da: 'Ridder' }, hp: 1, atk: 1, window: 1, blockWindow: 1, weakAsGood: false },
  legend: { id: 'legend', name: { en: 'Legend', da: 'Legende' }, hp: 1.2, atk: 1.2, window: 0.7, blockWindow: 0.7, weakAsGood: false },
};
const diff = (d) => DIFFICULTY[d] || DIFFICULTY.knight;

// foes scale with party size (4.8). atk: a small party also faces softer hits (tuned with gs-sim).
export const PARTY_SCALE = {
  1: { hp: 0.45, atk: 0.8 },
  2: { hp: 0.75, atk: 0.9 },
  3: { hp: 1, atk: 1 },
  4: { hp: 1.25, atk: 1 },
};

// bosses hit everyone with their big attack, so a small party also gets a softer boss (tuned with gs-sim)
export const BOSS_PARTY_ATK = { 1: 1, 2: 1, 3: 1, 4: 0.9 };
// a lone hunter hits harder (else a solo healer drags a boss past ten minutes)
export const SOLO_HERO_ATK = 1.3;

export function scaleFoe(foe, partySize = 3, difficulty = 'knight') {
  const n = Math.max(1, Math.min(4, partySize));
  const p = foe.boss ? { hp: PARTY_SCALE[n].hp, atk: PARTY_SCALE[n].atk * BOSS_PARTY_ATK[n] } : PARTY_SCALE[n];
  const d = diff(difficulty);
  const base = foe.base || foe;
  return {
    hp: Math.max(1, Math.round((base.hp || 10) * p.hp * d.hp)),
    atk: Math.max(1, (base.atk || 3) * p.atk * d.atk),
    def: base.def || 0,
    spd: base.spd || 3,
  };
}

// ---------- dice ----------
export function parseDice(expr) {
  const m = /^\s*(\d*)d(\d+)\s*([+-]\s*\d+)?\s*$/i.exec(String(expr || '1d6'));
  if (!m) { const n = parseInt(expr, 10) || 0; return { count: 0, sides: 0, mod: n }; }
  return { count: parseInt(m[1] || '1', 10), sides: parseInt(m[2], 10), mod: m[3] ? parseInt(m[3].replace(/\s/g, ''), 10) : 0 };
}
export const avgDice = (expr) => { const p = parseDice(expr); return p.count * (p.sides + 1) / 2 + p.mod; };
export function diceStr(p) { return `${p.count}d${p.sides}${p.mod ? (p.mod > 0 ? '+' : '') + p.mod : ''}`; }
export function rollDice(rng, expr, twice = false) {
  const p = parseDice(expr);
  const count = p.count * (twice ? 2 : 1);
  const dice = Array.from({ length: count }, () => rng.int(1, Math.max(1, p.sides)));
  return { dice, total: dice.reduce((s, x) => s + x, 0) + p.mod };
}

// ---------- items ----------
const STAT_KEYS = ['atk', 'def', 'hp', 'spd', 'luck'];
export function itemStats(item, plus = 0) {
  const s = item?.stats || {};
  const out = {};
  for (const k of STAT_KEYS) {
    const v = s[k] || 0;
    out[k] = v > 0 ? v + (plus ? Math.max(plus, Math.round(v * 0.1 * plus)) : 0) : v;
  }
  if (s.dice) { const p = parseDice(s.dice); p.mod += plus || 0; out.dice = diceStr(p); }
  return out;
}

const instOf = (slot) => (slot == null ? null : typeof slot === 'string' ? { id: slot, plus: 0 } : slot);

// ---------- derive ----------
// boon.effect keys are trait ids with a number: { hpPct: 0.1 } (+10% Health), { furyStart: 1 }, { atkPct }, { defPct },
// { spdPct }, { luck: n }, or any gear trait id with its params ({ regen: { pct } } or { regen: 0.05 }).
export function derive(hero, { level = 1, boons = [], content = {}, difficulty } = {}) {
  const def = content.heroes?.[hero.arch] || {};
  const b = def.base || { hp: 30, hpPer: 6, atk: 5, def: 2, spd: 4, luck: 2 };
  const L = Math.max(1, level) - 1;
  let hp = b.hp + (b.hpPer || 0) * L;
  let atk = b.atk + 1.5 * L;
  let dfn = b.def + 0.5 * L;
  let spd = b.spd;
  let luck = b.luck || 0;
  const effects = [];
  let weapon = { dice: '1d4', element: null, family: def.family || null, traits: [], id: null };
  for (const slot of ['weapon', 'armour', 'helm', 'charm']) {
    const inst = instOf(hero.gear?.[slot]);
    if (!inst) continue;
    const it = content.items?.[inst.id];
    if (!it) continue;
    const st = itemStats(it, inst.plus || 0);
    hp += st.hp; atk += st.atk; dfn += st.def; spd += st.spd; luck += st.luck;
    if (slot === 'weapon') weapon = { id: it.id, dice: st.dice || '1d6', element: it.element || null, family: it.family || def.family || null, traits: it.traits || [] };
    for (const t of it.traits || []) effects.push({ ...t, source: it.id, slot });
  }
  if (weapon.id == null && def.startGear?.weapon) {
    // no weapon equipped: fall back to the hunter's start weapon so a fresh sheet still swings
    const it = content.items?.[def.startGear.weapon];
    if (it) { const st = itemStats(it, 0); weapon = { id: it.id, dice: st.dice || '1d6', element: it.element || null, family: it.family || def.family, traits: it.traits || [] }; }
  }
  for (const bo of boons || []) {
    const boon = typeof bo === 'string' ? content.boons?.[bo] : bo;
    if (!boon?.effect) continue;
    for (let [k, v] of Object.entries(boon.effect)) {
      k = BOON_ALIAS[k] || k;
      effects.push(v && typeof v === 'object' ? { id: k, ...v, source: boon.id } : { id: k, n: v, pct: v, source: boon.id });
    }
  }
  const sum = sumEffects(effects);
  hp *= 1 + (sum.hpPct || 0);
  atk *= 1 + (sum.atkPct || 0);
  dfn *= 1 + (sum.defPct || 0);
  spd = (spd + (sum.spdFlat || 0)) * (1 + (sum.spdPct || 0));
  luck += sum.luck || 0;
  return {
    hp: Math.round(hp), atk: Math.round(atk * 10) / 10, def: Math.round(dfn * 10) / 10, spd: Math.round(spd * 10) / 10,
    luck: Math.round(luck), weapon, effects, sum, family: def.family || weapon.family, difficulty: difficulty || null,
  };
}

// boon keys (content/boons.js) -> trait ids. lastStand from a boon is once per battle for the whole party.
const BOON_ALIAS = { startFury: 'furyStart', perfectBlockFury: 'furyOnBlock', spd: 'spdFlat', lastStand: 'partyLastStand' };

// numeric totals per trait id, so the battle can ask sum.thorns, sum.regen, sum.crit ...
export function sumEffects(effects) {
  const s = {};
  const add = (k, v) => { s[k] = (s[k] || 0) + v; };
  for (const e of effects) {
    switch (e.id) {
      case 'crit': case 'lifesteal': case 'thorns': case 'regen': case 'startShield': case 'blockWindow': case 'strikeWindow':
      case 'goldFind': case 'shardFind': case 'dodge': case 'pierce': case 'hpPct': case 'atkPct': case 'defPct': case 'spdPct':
      case 'bossDmgPct': case 'healAfterWin': case 'partyLastStand':
        add(e.id, e.pct ?? e.n ?? 0); break;
      case 'lastStand': s.lastStand = Math.max(s.lastStand || 0, e.pct ?? e.n ?? 0.2); break;
      case 'furyStart': case 'furyOnKill': case 'furyOnPerfect': case 'furyOnBlock': case 'luck': case 'spdFlat':
        add(e.id, e.n ?? e.pct ?? 0); break;
      default: break;
    }
  }
  return s;
}

// ---------- XP ----------
// total XP to reach level 1..8, fitted to the content's foe XP (full encounters, see xpFor):
// floor 1 cleared = level 2 (rest at the fork) or 3 (elite), floor 2 = 4, floor 3 = 5 or 6, floor 4 = 7, floor 5 before the king = 8
const XP_TABLE = [0, 0, 100, 190, 450, 850, 1250, 1800, 2700];
export const MAX_LEVEL = 8;
export const xpForLevel = (n) => XP_TABLE[Math.max(1, Math.min(MAX_LEVEL, n))];
export function levelForXp(xp) { let l = 1; while (l < MAX_LEVEL && xp >= XP_TABLE[l + 1]) l++; return l; }
// the same for every party size: a solo hunter meets fewer foes but levels at the same pace
export function xpFor(content, encounterId, partySize = 3) {
  const enc = content.encounters?.[encounterId];
  if (!enc) return 0;
  return enc.foes.reduce((t, s) => t + (content.foes?.[s.type]?.xp || 0), 0);
}

// ---------- loot ----------
export function lootRarity(total) {
  if (total >= 20) return 'legendary';
  if (total >= 16) return 'epic';
  if (total >= 10) return 'rare';
  return 'common';
}

// ---------- grades ----------
export const MIXES = {
  auto: { strike: { perfect: 0.25, good: 0.5, weak: 0.25 }, block: { perfect: 0.25, good: 0.5, miss: 0.25 } },
  perfect: { strike: { perfect: 1, good: 0, weak: 0 }, block: { perfect: 1, good: 0, miss: 0 } },
  weak: { strike: { perfect: 0, good: 0, weak: 1 }, block: { perfect: 0, good: 0, miss: 1 } },
  kid: { strike: { perfect: 0.1, good: 0.5, weak: 0.4 }, block: { perfect: 0.1, good: 0.4, miss: 0.5 } },
};
export function autoGrade(rng, mix = MIXES.auto, kind = 'strike') {
  const m = (typeof mix === 'string' ? MIXES[mix] : mix)?.[kind] || MIXES.auto[kind];
  const x = rng.float();
  const keys = kind === 'block' ? ['perfect', 'good', 'miss'] : ['perfect', 'good', 'weak'];
  let acc = 0;
  for (const k of keys) { acc += m[k] || 0; if (x < acc) return k; }
  return keys[keys.length - 1];
}

// ---------- command windows (1 = Knight normal) ----------
export function commandWindow({ difficulty, heroSpd = 0, foeSpd = 0, bonus = 0 }) {
  const over = Math.max(0, heroSpd - foeSpd);
  return round2(diff(difficulty).window * Math.min(1.4, 1 + 0.04 * over) * (1 + bonus));
}
export function blockWindow({ difficulty, big = false, chilled = false, bonus = 0 }) {
  return round2(diff(difficulty).blockWindow * (big ? 0.7 : 1) * (chilled ? 1.3 : 1) * (1 + bonus));
}
const round2 = (x) => Math.round(x * 100) / 100;

// ---------- kit by floor (autoplay &floor=N and tools/gs-sim.mjs) ----------
// level: battles / boss; gear: rarity and plus per slot (null = empty); bag: consumable ids; gold, shards: purse
export const KIT = {
  1: { level: 1, bossLevel: 2, weapon: ['common', 0], armour: ['common', 0], helm: null, charm: null,
    bag: ['gs_draught', 'gs_draught'], gold: 20, shards: 0 },
  2: { level: 3, bossLevel: 3, weapon: ['rare', 0], armour: ['common', 1], helm: ['common', 0], charm: null,
    bag: ['gs_draught', 'gs_draught', 'gs_fire_bomb'], gold: 80, shards: 4 },
  3: { level: 4, bossLevel: 5, weapon: ['rare', 2], armour: ['rare', 0], helm: ['rare', 0], charm: ['common', 0],
    bag: ['gs_draught', 'gs_draught', 'gs_greater_draught', 'gs_frost_bomb', 'gs_ember_feather'], gold: 160, shards: 10 },
  4: { level: 6, bossLevel: 6, weapon: ['epic', 1], armour: ['epic', 0], helm: ['rare', 1], charm: ['rare', 0],
    bag: ['gs_draught', 'gs_draught', 'gs_greater_draught', 'gs_fury_tonic', 'gs_fire_bomb', 'gs_ember_feather'], gold: 260, shards: 18 },
  5: { level: 7, bossLevel: 8, weapon: ['epic', 2], armour: ['epic', 1], helm: ['epic', 0], charm: ['epic', 0],
    bag: ['gs_draught', 'gs_draught', 'gs_greater_draught', 'gs_greater_draught', 'gs_fury_tonic', 'gs_ember_feather'], gold: 380, shards: 26 },
};
const BOON_LEVELS = [3, 5, 7, 8];

export function pickGear(content, kind, rarity, family = null) {
  const list = Object.values(content.items || {}).filter((it) => it.kind === kind && it.rarity === rarity && (!family || it.family === family));
  if (!list.length && kind === 'weapon' && family) return null;
  // charms: prefer one that does something in battle
  if (kind === 'charm') {
    const useful = list.find((it) => (it.traits || []).some((t) => !['goldFind', 'shardFind'].includes(t.id)));
    if (useful) return useful.id;
  }
  return list[0]?.id || null;
}

export function kitFor({ floor = 1, level = null, kind = 'battle', party = [], content = {} }) {
  const k = KIT[Math.max(1, Math.min(5, floor))];
  const lvl = level ?? (kind === 'boss' ? k.bossLevel : kind === 'elite' ? Math.max(k.level, k.bossLevel) : k.level);
  const gear = {}, plus = {};
  for (const arch of party) {
    const fam = content.heroes?.[arch]?.family || null;
    gear[arch] = {}; plus[arch] = {};
    for (const slot of ['weapon', 'armour', 'helm', 'charm']) {
      const spec = k[slot];
      if (!spec) { gear[arch][slot] = null; continue; }
      const id = pickGear(content, slot, spec[0], slot === 'weapon' ? fam : null) || (slot === 'weapon' ? content.heroes?.[arch]?.startGear?.weapon || null : null);
      gear[arch][slot] = id;
      plus[arch][slot] = id ? spec[1] : 0;
    }
  }
  const boonIds = Object.keys(content.boons || {});
  const boons = BOON_LEVELS.filter((l) => l <= lvl).map((_, i) => boonIds[i * 2]).filter(Boolean);
  const bag = k.bag.filter((id) => !content.items || content.items[id]);
  return { floor, level: lvl, gold: k.gold, shards: k.shards, gear, plus, bag, boons };
}
