// Grimspire loot (GRIMSPIRE.md 4.7, 5.3). Pure: no DOM, importable from Node.
//
//   rollDrops({ content, encounter, floor, difficulty, rng, luck, owned, families })
//       -> { gold, shards, items: [ids], roll: { bonus } | null }
//       encounter: id or object (kind 'battle'|'elite'|'boss'|'chest'). `roll` is set for bosses and chests:
//       the caller shows gs.lootreveal with { items, roll: { luck, bonus } }, which throws the d20 and adds
//       the rolled item (rollPick below). `items` never contains that rolled item.
//   lootRoll({ die, luck, bonus }) -> rarity              the table from 3.7: total 1-9 common, 10-15 rare, 16-19 epic, 20+ legendary
//   lootRollDetail({ die, luck, bonus }) -> { die, luck, bonus, total, rarity }
//   rollPick({ content, floor, rng, luck, bonus, owned, families, die? }) -> { die, luck, bonus, total, rarity, id }
//   pickItem({ content, floor, rarity, rng, owned, families, kinds? }) -> id | null
//       a gear item of that rarity for the floor; prefers weapon families the party can use; never a legendary
//       already owned; steps down a rarity (then up) when none is left.
//   rarityWeights(floor, content?, { elite }) -> { common, rare, epic, legendary }
//   rarityFromTotal(total), RARITIES, RARITY_COLOR, RARITY_RANK, LUCK_CAP, GEAR_KINDS
//
// rng: the game's seeded rng (int, float, chance, pick) or any () => [0,1) function. Defaults to Math.random.

export const RARITIES = ['common', 'rare', 'epic', 'legendary'];
export const RARITY_RANK = { common: 0, rare: 1, epic: 2, legendary: 3 };
export const RARITY_COLOR = { common: '#b8c0cc', rare: '#4aa3ff', epic: '#b06bff', legendary: '#ffb02e' };
export const GEAR_KINDS = ['weapon', 'armour', 'helm', 'charm'];
export const LUCK_CAP = 5;          // Luck added to a loot roll is the luckiest hunter's, at most +5
export const BOSS_BONUS = 6;

// Floor tables (used when floors[n].loot.rarityWeights is missing). 1-2 common and rare, 3-4 rare and epic, 5 epic and legendary.
const FLOOR_WEIGHTS = {
  1: { common: 70, rare: 28, epic: 2, legendary: 0 },
  2: { common: 50, rare: 42, epic: 8, legendary: 0 },
  3: { common: 14, rare: 52, epic: 32, legendary: 2 },
  4: { common: 4, rare: 40, epic: 48, legendary: 8 },
  5: { common: 0, rare: 12, epic: 62, legendary: 26 },
};

// gold per battle kind when foes carry no gold range
const BASE_GOLD = { battle: [6, 10], elite: [16, 24], boss: [40, 60], chest: [10, 18] };
const DIFF_GOLD = { squire: 1, knight: 1, legend: 1.25 };

function mkRng(rng) {
  if (rng && typeof rng.float === 'function') return rng;
  const f = typeof rng === 'function' ? rng : Math.random;
  return {
    float: f,
    int: (a, b) => a + Math.floor(f() * (b - a + 1)),
    chance: (p) => f() < p,
    pick: (arr) => (arr && arr.length ? arr[Math.floor(f() * arr.length)] : undefined),
  };
}

const itemsOf = (content) => {
  const it = content?.items || {};
  return Array.isArray(it) ? it : Object.values(it);
};
const ownedSet = (owned) => (owned instanceof Set ? owned : new Set(owned || []));

export function rarityFromTotal(total) {
  if (total >= 20) return 'legendary';
  if (total >= 16) return 'epic';
  if (total >= 10) return 'rare';
  return 'common';
}

export function lootRollDetail({ die, luck = 0, bonus = 0 } = {}) {
  const d = Math.max(1, Math.min(20, Math.round(Number(die) || 1)));
  const l = Math.max(0, Math.min(LUCK_CAP, Math.round(Number(luck) || 0)));
  const b = Math.round(Number(bonus) || 0);
  const total = d + l + b;
  // a natural 20 is always legendary
  return { die: d, luck: l, bonus: b, total, rarity: d === 20 ? 'legendary' : rarityFromTotal(total) };
}

export function lootRoll(opts) { return lootRollDetail(opts).rarity; }

export function rarityWeights(floor = 1, content = null, { elite = false } = {}) {
  const f = Math.max(1, Math.min(5, Math.round(Number(floor) || 1)));
  const floors = content?.floors;
  const fromContent = floors && (Array.isArray(floors) ? floors.find((x) => x?.n === f) : floors[f])?.loot?.rarityWeights;
  const w = { common: 0, rare: 0, epic: 0, legendary: 0, ...(fromContent || FLOOR_WEIGHTS[f]) };
  if (elite) {
    // an elite always drops rare or better: the common share moves up to rare
    w.rare += w.common; w.common = 0;
  }
  return w;
}

function weighted(rng, weights) {
  const entries = Object.entries(weights).filter(([, v]) => v > 0);
  const sum = entries.reduce((a, [, v]) => a + v, 0);
  if (!sum) return entries[0]?.[0] || 'common';
  let x = rng.float() * sum;
  for (const [k, v] of entries) { x -= v; if (x < 0) return k; }
  return entries[entries.length - 1][0];
}

export function pickItem({ content, floor = 1, rarity = 'common', rng, owned = [], families = null, kinds = GEAR_KINDS } = {}) {
  const r = mkRng(rng);
  const own = ownedSet(owned);
  const fams = families && families.length ? new Set(families) : null;
  const all = itemsOf(content).filter((it) => it && kinds.includes(it.kind));
  const order = [rarity, ...RARITIES.slice(0, RARITY_RANK[rarity] ?? 0).reverse(), ...RARITIES.slice((RARITY_RANK[rarity] ?? 0) + 1)];
  for (const rar of order) {
    let pool = all.filter((it) => (it.rarity || 'common') === rar && !(rar === 'legendary' && own.has(it.id)));
    // items made for this floor or below; fall back to any floor so a table is never empty
    const near = pool.filter((it) => it.floor == null || it.floor <= floor + 1);
    if (near.length) pool = near;
    if (!pool.length) continue;
    const ws = pool.map((it) => {
      let w = 1;
      if (it.kind === 'weapon') {
        if (fams) w *= fams.has(it.family) ? 3 : 0.25;
        else w *= 1.2;
      }
      if (it.floor != null && it.floor === floor) w *= 1.6;
      if (own.has(it.id)) w *= 0.45;              // fewer repeats of what the party already carries
      return w;
    });
    const sum = ws.reduce((a, b) => a + b, 0);
    let x = r.float() * sum;
    for (let i = 0; i < pool.length; i++) { x -= ws[i]; if (x < 0) return pool[i].id; }
    return pool[pool.length - 1].id;
  }
  return null;
}

function pickConsumable(content, floor, rng) {
  const pool = itemsOf(content).filter((it) => it?.kind === 'consumable' && (it.floor == null || it.floor <= floor));
  if (!pool.length) return null;
  // cheap potions more often than rare bombs and feathers
  const ws = pool.map((it) => 1 / Math.max(1, (it.price || 10) / 12));
  const sum = ws.reduce((a, b) => a + b, 0);
  let x = rng.float() * sum;
  for (let i = 0; i < pool.length; i++) { x -= ws[i]; if (x < 0) return pool[i].id; }
  return pool[0].id;
}

function trophyFor(content, foeIds) {
  const list = itemsOf(content).filter((it) => it?.kind === 'trophy');
  for (const fid of foeIds) {
    const short = String(fid).replace(/^gs_/, '');
    const t = list.find((it) => it.boss === fid || it.foe === fid) || list.find((it) => String(it.id).includes(short));
    if (t) return t.id;
  }
  return null;
}

// goldFind / shardFind charm traits summed over the worn gear, as fractions (20% -> 0.2)
export function findMods(content, heroes = []) {
  const out = { goldFind: 0, shardFind: 0 };
  for (const hero of heroes || []) {
    for (const inst of Object.values(hero?.gear || {})) {
      const it = inst && content?.items?.[inst.id || inst];
      for (const t of it?.traits || []) {
        if (t.id !== 'goldFind' && t.id !== 'shardFind') continue;
        const v = Number(t.pct ?? t.value ?? t.amount ?? 20);
        out[t.id] += v > 1 ? v / 100 : v;
      }
    }
  }
  return out;
}

export function rollDrops({ content, encounter, floor, difficulty = 'knight', rng, luck = 0, owned = [], families = null, goldFind = 0, shardFind = 0 } = {}) {
  const r = mkRng(rng);
  const enc = typeof encounter === 'string' ? (content?.encounters?.[encounter] || { id: encounter }) : (encounter || {});
  const kind = enc.kind || 'battle';
  const fl = Math.max(1, Math.min(5, Number(floor ?? enc.floor) || 1));
  const lk = Math.max(0, Number(luck) || 0);
  const foeIds = (enc.foes || []).map((f) => (typeof f === 'string' ? f : f.type)).filter(Boolean);
  const own = new Set(ownedSet(owned));

  // gold: the foes' own ranges, else the base for the kind; +3% per Luck, difficulty bonus
  let gold = 0;
  const ranged = foeIds.map((id) => content?.foes?.[id]?.gold).filter((g) => Array.isArray(g));
  if (ranged.length) for (const [a, b] of ranged) gold += r.int(a, b);
  else { const [a, b] = BASE_GOLD[kind] || BASE_GOLD.battle; gold = r.int(a, b) * (1 + (fl - 1) * 0.6); }
  gold = Math.round(gold * (1 + lk * 0.03 + (goldFind || 0)) * (DIFF_GOLD[difficulty] || 1));

  // Bone Shards
  let shards = 0;
  if (kind === 'battle') shards = r.chance(0.35) ? r.int(1, 2) + Math.floor(fl / 3) : 0;
  else if (kind === 'elite') shards = r.int(2, 3) + Math.floor(fl / 2);
  else if (kind === 'boss') shards = r.int(5, 7) + fl;
  else if (kind === 'chest') shards = r.int(1, 3);
  if (shardFind > 0) shards = Math.round(shards * (1 + shardFind)) || (r.chance(shardFind) ? 1 : 0);

  const items = [];
  const push = (id) => { if (id) { items.push(id); own.add(id); } };
  if (kind === 'battle') {
    // about one battle in three drops gear from the floor's table, a little more with Luck
    if (r.chance(Math.min(0.5, 0.33 + lk * 0.015))) push(pickItem({ content, floor: fl, rarity: weighted(r, rarityWeights(fl, content)), rng: r, owned: own, families }));
    if (r.chance(0.2)) push(pickConsumable(content, fl, r));
  } else if (kind === 'elite') {
    push(pickItem({ content, floor: fl, rarity: weighted(r, rarityWeights(fl, content, { elite: true })), rng: r, owned: own, families }));
    if (r.chance(0.5)) push(pickConsumable(content, fl, r));
  } else if (kind === 'boss') {
    push(trophyFor(content, foeIds));
    push(pickConsumable(content, fl, r));
  } else if (kind === 'chest') {
    if (r.chance(0.4)) push(pickConsumable(content, fl, r));
  }
  const roll = kind === 'boss' ? { bonus: BOSS_BONUS } : kind === 'chest' ? { bonus: 0 } : null;
  return { gold, shards, items, roll };
}

// The loot roll and the item it picks, for callers that do not show the reveal (the simulator, autoplay helpers).
export function rollPick({ content, floor = 1, rng, luck = 0, bonus = 0, owned = [], families = null, die = null } = {}) {
  const r = mkRng(rng);
  const d = die ?? r.int(1, 20);
  const res = lootRollDetail({ die: d, luck, bonus });
  return { ...res, id: pickItem({ content, floor, rarity: res.rarity, rng: r, owned, families }) };
}
