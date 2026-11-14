// Pure game rules (SPEC section 5). No DOM, no state mutation. These numbers are the game.
//
// Constants: STATS, STAT_COLORS, STAT_NAMES, DC, ARCH (level-1 heroes), FOES, TRINKETS, CONSUMABLES,
//   SPARKS, STARS_MAX, LULLABY, RUNES, STATUSES
// Functions:
//   dcTarget(dc) -> number                       'easy'|'medium'|'hard'|'heroic'|number
//   statValue(hero, stat) -> number              base stat + trinket + perks
//   checkBonus(hero, { stat, talent }) -> { stat, talent, total }
//   needOnDie(target, bonus) -> number           what the die must show (clamped 2..20)
//   outcome({ die, bonus, target, hasPartial, critOn? }) -> 'crit'|'success'|'partial'|'fail'|'fumble'
//   isPass(outcome) -> bool
//   maxHp(hero), guard(hero), critOn(hero)
//   makeHero(arch, heroContent?, name?) -> party member at level 1
//   levelUpHero(hero, level, perk?) -> new hero object
//   foeHp(baseHp, partySize) -> number
//   parseDice('2d6+1') -> { count, sides, mod }

import { L } from './i18n.js';

export const STATS = ['might', 'agility', 'wits', 'heart'];
// Player-facing names read the current language (core/i18n.js L): STAT_NAMES, DEFAULT_NAMES, TALENT_NAMES.
export const STAT_NAMES = L({
  en: { might: 'Might', agility: 'Agility', wits: 'Wits', heart: 'Heart' },
  da: { might: 'Styrke', agility: 'Smidighed', wits: 'Kløgt', heart: 'Hjerte' },
});
export const STAT_COLORS = { might: '#f2743a', agility: '#5fcf7a', wits: '#6aa8ff', heart: '#ff6f9c' };
export const DC = { easy: 8, medium: 11, hard: 14, heroic: 17 };
export const STARS_MAX = 3;   // ROUND2 4: Stars are rare and earned
export const STARS_START = 1;
export const SPARKS = { start: 2, perTurn: 1, max: 4, power: 2, great: 3, guardBonus: 1 };
export const TALENT_BONUS = 3;
export const PARTIAL_MARGIN = 2;
export const MERCY_DC_DROP = 2;

export const ARCH = {
  knight:    { stats: { might: 3, agility: 0, wits: 1, heart: 2 }, hp: 14, guard: 13, attackStat: 'might',   strike: { name: 'Sword Swing', die: '1d8' }, talent: 'stand_firm' },
  wizard:    { stats: { might: 0, agility: 1, wits: 3, heart: 2 }, hp: 9,  guard: 10, attackStat: 'wits',    strike: { name: 'Spark', die: '1d6' }, talent: 'read_runes' },
  ranger:    { stats: { might: 1, agility: 3, wits: 1, heart: 1 }, hp: 11, guard: 12, attackStat: 'agility', strike: { name: 'Bow Shot', die: '1d8' }, talent: 'animal_friend' },
  trickster: { stats: { might: 1, agility: 3, wits: 2, heart: 0 }, hp: 10, guard: 12, attackStat: 'agility', strike: { name: 'Quick Jab', die: '1d6' }, talent: 'nimble_fingers' },
  bard:      { stats: { might: 0, agility: 1, wits: 2, heart: 3 }, hp: 10, guard: 11, attackStat: 'heart',   strike: { name: 'Sharp Note', die: '1d6' }, talent: 'silver_tongue' },
  mender:    { stats: { might: 2, agility: 0, wits: 2, heart: 2 }, hp: 13, guard: 11, attackStat: 'might',   strike: { name: 'Staff Thump', die: '1d6' }, talent: 'herb_lore' },
};
export const ARCH_ORDER = ['knight', 'wizard', 'ranger', 'trickster', 'bard', 'mender'];
export const DEFAULT_NAMES = L({
  en: {
    knight: 'Rowan Shieldheart', wizard: 'Nim Starcaller', ranger: 'Fenn Wildstrider',
    trickster: 'Zia Quickfingers', bard: 'Lark Songweaver', mender: 'Moss Greenmender',
  },
  da: {
    knight: 'Rowan Skjoldhjerte', wizard: 'Nim Stjernekalder', ranger: 'Fenn Vildvandrer',
    trickster: 'Zia Kvikfinger', bard: 'Lærke Sangvæver', mender: 'Mos Grønheler',
  },
});
// Fallback only: screens prefer the hero content's own talent.name (translated by the dictionary).
export const TALENT_NAMES = L({
  en: {
    stand_firm: 'Stand Firm', read_runes: 'Read Runes', animal_friend: 'Animal Friend',
    nimble_fingers: 'Nimble Fingers', silver_tongue: 'Silver Tongue', herb_lore: 'Herb Lore',
  },
  da: {
    stand_firm: 'Stå fast', read_runes: 'Læs runer', animal_friend: 'Dyreven',
    nimble_fingers: 'Kvikke fingre', silver_tongue: 'Sølvtunge', herb_lore: 'Urtekyndig',
  },
});

export const FOES = {
  thornling:      { hp: 7,  guard: 10, toHit: 2, resolve: 6,  dc: 9,  likes: ['song'], weak: ['light'] },
  gloop:          { hp: 10, guard: 9,  toHit: 2, resolve: 8,  dc: 11, likes: ['honeycake'], weak: ['light'] },
  rattlewing:     { hp: 9,  guard: 12, toHit: 4, resolve: null, dc: null, likes: [], weak: ['vines'] },
  flutterfang:    { hp: 6,  guard: 13, toHit: 3, resolve: 5,  dc: 10, likes: ['song'], weak: ['song'] },
  bouldergrin:    { hp: 30, guard: 13, toHit: 4, resolve: 12, dc: 13, likes: ['marsh_lily'], weak: [] },
  clatterclaw:    { hp: 42, guard: 12, toHit: 4, resolve: null, dc: null, likes: [], weak: ['vines'], boss: true },
  nightmare_wisp: { hp: 8,  guard: 11, toHit: 3, resolve: 6,  dc: 10, likes: ['song'], weak: ['light'] },
};

export const TRINKETS = {
  brass_compass: { stat: { wits: 1 } }, fox_charm: { stat: { agility: 1 } }, troll_tooth: { stat: { might: 1 } },
  glow_pendant: { stat: { heart: 1 } }, moth_silk_cloak: { guard: 1 }, sturdy_boots: { maxHp: 3 }, goblin_goggles: { critOn: 19 },
};
export const CONSUMABLES = {
  honeycake: { heal: 6 }, sparkberry: { sparks: 2, battleOnly: true }, moonpetal_tea: { healAll: 3, clear: true },
  flash_lantern: { blindAll: true, stunWeak: 'light' }, lucky_acorn: { stars: 1 }, blackberry_pie: { heal: 10, gift: true },
};
export const STATUSES = ['stunned', 'asleep', 'tangled', 'marked', 'inspired', 'guarded', 'protected', 'blinded'];
export const LULLABY = { notes: ['C5', 'D5', 'E5', 'G5', 'A5'], phrases: { 1: [2, 3, 4], 2: [3, 2, 1], 3: [0, 1, 0] } };
export const RUNES = { tiles: ['lantern', 'river', 'song', 'star', 'dragon', 'stone'], answer: ['lantern', 'song', 'dragon'] };

export function dcTarget(dc) {
  if (typeof dc === 'number') return dc;
  if (dc == null) return DC.medium;
  const n = Number(dc);
  if (!Number.isNaN(n)) return n;
  return DC[String(dc).toLowerCase()] ?? DC.medium;
}

function trinketPassive(hero) {
  if (!hero?.trinket) return null;
  return hero.trinketPassive || TRINKETS[hero.trinket] || null;
}

function perkEffects(hero) {
  return (hero?.perks || []).map((p) => (typeof p === 'object' ? p.effect : null)).filter(Boolean);
}

export function statValue(hero, stat) {
  if (!hero) return 0;
  let v = hero.stats?.[stat] ?? 0;
  const t = trinketPassive(hero);
  if (t?.stat?.[stat]) v += t.stat[stat];
  for (const e of perkEffects(hero)) if (e.stat?.[stat]) v += e.stat[stat];
  return v;
}

export function maxHp(hero) {
  const base = ARCH[hero.arch]?.hp ?? hero.maxHp ?? 10;
  let v = base + 3 * Math.max(0, (hero.level || 1) - 1);
  const t = trinketPassive(hero);
  if (t?.maxHp) v += t.maxHp;
  for (const e of perkEffects(hero)) if (e.maxHp) v += e.maxHp;
  return v;
}

export function guard(hero) {
  let v = ARCH[hero.arch]?.guard ?? hero.guard ?? 10;
  const t = trinketPassive(hero);
  if (t?.guard) v += t.guard;
  for (const e of perkEffects(hero)) if (e.guard) v += e.guard;
  return v;
}

export function critOn(hero) {
  const t = trinketPassive(hero);
  return t?.critOn ?? 20;
}

export function checkBonus(hero, { stat, talent } = {}) {
  const s = stat ? statValue(hero, stat) : 0;
  const tal = talent && hero?.talent === talent ? TALENT_BONUS : 0;
  return { stat: s, talent: tal, total: s + tal };
}

export function needOnDie(target, bonus) {
  return Math.max(2, Math.min(20, target - bonus));
}

export function outcome({ die, bonus = 0, target, hasPartial = false, critOn: co = 20 }) {
  if (die >= co) return 'crit';
  if (die === 1) return 'fumble';
  const total = die + bonus;
  if (total >= target) return 'success';
  if (hasPartial && total >= target - PARTIAL_MARGIN) return 'partial';
  return 'fail';
}

export const isPass = (o) => o === 'crit' || o === 'success';

export function parseDice(expr) {
  const m = /^\s*(\d*)d(\d+)\s*([+-]\s*\d+)?\s*$/i.exec(String(expr));
  if (!m) return { count: 0, sides: 0, mod: parseInt(expr, 10) || 0 };
  return { count: parseInt(m[1] || '1', 10), sides: parseInt(m[2], 10), mod: m[3] ? parseInt(m[3].replace(/\s/g, ''), 10) : 0 };
}

export function foeHp(baseHp, partySize) {
  return partySize <= 1 ? Math.max(1, Math.round(baseHp * 0.75)) : baseHp;
}

export function makeHero(arch, heroContent = null, name = null) {
  const a = ARCH[arch];
  if (!a) throw new Error('Unknown hero arch: ' + arch);
  const stats = { ...(heroContent?.stats || a.stats) };
  const hp = heroContent?.hp ?? a.hp;
  return {
    id: arch, arch,
    name: name || heroContent?.name || DEFAULT_NAMES[arch],
    talent: heroContent?.talent?.id || a.talent,
    level: 1, hp, maxHp: hp, guard: heroContent?.guard ?? a.guard,
    stats, perks: [], trinket: null, acts: 0,
  };
}

export function levelUpHero(hero, level, perk = null) {
  const h = { ...hero, level, perks: [...(hero.perks || [])] };
  if (perk) h.perks.push(perk);
  const before = hero.maxHp;
  h.maxHp = maxHp(h);
  h.guard = guard(h);
  h.hp = Math.min(h.maxHp, hero.hp + (h.maxHp - before));
  return h;
}
