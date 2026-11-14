// Grimspire state (GRIMSPIRE.md 5.2). createGsState(ctx) -> state, a plain object of data fields plus helper
// methods (non-enumerable), so JSON.stringify(state) is the save.
//
// THE BAG. Every item is an instance { uid, id, plus } (plus 0..3, the Forge's upgrades). Consumables do NOT stack:
// each potion or bomb is its own instance (plus 0). consumables() groups them for display: [{ id, qty, uids:[..] }].
// Equipped gear lives in hero.gear[slot] (an instance or null) and is not in the bag.
//
// Data: v, seed, playMs, difficulty, party, level, xp, boons, gold, shards, bag, floors, where, flags, counters,
//   journal, seenFoes, trophies, tally, plus `scene` (always set, so the shared save loader accepts it), `stars`
//   (always 0: Grimspire has no Stars) and `quests` (the shared step interpreter may write to it).
// Hero: { id (= arch), arch, name, hp, maxHp (kept in sync with derived().hp), gear:{weapon,armour,helm,charm},
//   stats:{might,agility,wits,heart} (the knacks, for skill and check steps), acts }
//
// Helpers (all emit 'state:changed' plus a specific event):
//   hero(id) heroes() living() derived(heroId) refreshHero(heroId) setParty([{arch,name}|arch..])
//   equip(heroId, uid)->bool  unequip(heroId, slot)->instance|null  canEquip(heroId, itemId)->bool  slotOf(itemId)
//   addItem(id, { plus })->instance  removeItem(uid)->instance|null  findItem(uid)->{ inst, where:'bag'|heroId }
//   useItem(uid, { heroId, applied })->bool   (applied:true only removes; otherwise applies heal/revive/cleanse here)
//   consumables()  addGold(n)  addShards(n)  addXp(n)->{ levels:[n..] }  xpInfo()->{ level, into, need, pct, max }
//   damage(heroId, n, { floor })  heal(heroId|'all', n|'full'|{ pct })  standUp()  fullHeal()
//   flag setFlag addCounter count test tallyAdd tallyMax has give take addJournal seeFoe(id, weakKnown) addTrophy(id)
//   floor(n) unlockFloor(n) clearRoom(floor, roomId) roomCleared(floor, roomId) clearFloor(n) resetFloorRooms(n)
//   addBoon(id)  reset(seed)  load(data)  data()  hasTalent()->null  hasArch(a)  addStar()->0  spendStar()->false
//   quest() questDone()

export const SLOTS = ['weapon', 'armour', 'helm', 'charm'];
export const MAX_LEVEL = 8;
const KNACKS = { might: 0, agility: 0, wits: 0, heart: 0 };

const freshTally = () => ({ battles: 0, wins: 0, defeats: 0, perfects: 0, goods: 0, weaks: 0, perfectBlocks: 0, blocks: 0, bestHit: 0, legendaries: 0, skills: 0, skillsPassed: 0, chests: 0, potions: 0, gold: 0 });
const fresh = (seed) => ({
  v: 1, pack: 'grimspire', seed, startedAt: Date.now(), playMs: 0, difficulty: 'knight',
  party: [], level: 1, xp: 0, boons: [], gold: 0, shards: 0, bag: [],
  floors: { 1: { unlocked: true, cleared: false, rooms: {} }, 2: { unlocked: false, cleared: false, rooms: {} }, 3: { unlocked: false, cleared: false, rooms: {} }, 4: { unlocked: false, cleared: false, rooms: {} }, 5: { unlocked: false, cleared: false, rooms: {} } },
  where: 'camp', flags: {}, counters: {}, journal: [], seenFoes: {}, trophies: [], quests: [],
  scene: 'grimspire', stars: 0, nextUid: 1, ending: null, finishedMs: 0,
  tally: freshTally(),
});

export function createGsState(ctx) {
  const s = fresh(ctx.rng?.seed ?? 0);
  const bus = ctx.bus;
  const changed = (evt, data) => { if (evt) bus.emit(evt, data); bus.emit('state:changed', { evt, data }); };
  const def = (name, fn) => Object.defineProperty(s, name, { value: fn, enumerable: false, writable: true, configurable: true });
  const content = () => ctx.content || {};
  const rules = () => ctx.gsRules || null;
  const items = () => content().items || {};

  def('data', () => JSON.parse(JSON.stringify(s)));
  def('reset', (seed = Date.now() % 1e9) => {
    for (const k of Object.keys(s)) delete s[k];
    Object.assign(s, fresh(seed));
    changed('state:reset');
  });
  def('load', (data) => {
    for (const k of Object.keys(s)) delete s[k];
    const f = fresh(data?.seed ?? 0);
    Object.assign(s, f, data || {});
    s.tally = { ...freshTally(), ...(data?.tally || {}) };
    s.floors = { ...f.floors, ...(data?.floors || {}) };
    for (const h of s.party) { h.gear = { weapon: null, armour: null, helm: null, charm: null, ...(h.gear || {}) }; h.stats = { ...KNACKS, ...(h.stats || {}) }; }
    s.party.forEach((h) => s.refreshHero(h.id, { keepHp: true }));
    changed('state:loaded');
  });

  const uid = () => `i${s.nextUid++}`;

  // ---------- party ----------
  def('hero', (id) => s.party.find((h) => h.id === id || h.arch === id) || null);
  def('heroes', () => s.party);
  def('living', () => s.party.filter((h) => h.hp > 0));
  def('hasTalent', () => null);
  def('hasArch', (a) => s.party.find((h) => h.arch === a) || null);

  def('derived', (heroId) => {
    const h = s.hero(heroId);
    if (!h) return null;
    const R = rules();
    if (R?.derive) {
      try { return R.derive(h, { level: s.level, boons: s.boons, content: content(), difficulty: s.difficulty }); }
      catch (e) { console.error('[gs-state] rules.derive threw; using the stand-in', e); }
    }
    return DEV.derive(h, { level: s.level, boons: s.boons, content: content() });
  });
  def('refreshHero', (heroId, { keepHp = false } = {}) => {
    const h = s.hero(heroId);
    if (!h) return;
    const before = h.maxHp || 0;
    const d = s.derived(h.id);
    h.maxHp = Math.max(1, Math.round(d?.hp || 1));
    if (!keepHp && before && h.hp > 0) h.hp = Math.max(1, h.hp + (h.maxHp - before));
    h.hp = Math.max(0, Math.min(h.maxHp, h.hp ?? h.maxHp));
    changed('party:hp', { id: h.id, hp: h.hp, maxHp: h.maxHp });
  });
  const refreshAll = (opts) => s.party.forEach((h) => s.refreshHero(h.id, opts));

  def('setParty', (list) => {
    s.party = [];
    for (const item of list || []) {
      const arch = typeof item === 'string' ? item : item.arch;
      const hc = content().heroes?.[arch];
      if (!hc || s.party.find((h) => h.arch === arch)) continue;
      const name = (typeof item === 'object' && item.name) || hc.name || arch;
      const hero = { id: arch, arch, name, hp: 1, maxHp: 1, gear: { weapon: null, armour: null, helm: null, charm: null }, stats: { ...KNACKS, ...(hc.knacks || {}) }, acts: 0 };
      s.party.push(hero);
      const sg = hc.startGear || {};
      for (const slot of SLOTS) {
        const id = sg[slot];
        if (id && items()[id]) hero.gear[slot] = { uid: uid(), id, plus: 0 };
      }
      s.refreshHero(hero.id);
      hero.hp = hero.maxHp;
    }
    changed('party:changed', { party: s.party });
  });

  // ---------- items ----------
  def('slotOf', (itemId) => { const k = items()[itemId]?.kind; return SLOTS.includes(k) ? k : null; });
  def('canEquip', (heroId, itemId) => {
    const h = s.hero(heroId), it = items()[itemId];
    if (!h || !it || !SLOTS.includes(it.kind)) return false;
    if (it.kind === 'weapon') {
      const fam = content().heroes?.[h.arch]?.family;
      return !it.family || it.family === fam;
    }
    return true;
  });
  def('findItem', (u) => {
    const b = s.bag.find((x) => x.uid === u);
    if (b) return { inst: b, where: 'bag' };
    for (const h of s.party) for (const slot of SLOTS) if (h.gear[slot]?.uid === u) return { inst: h.gear[slot], where: h.id, slot };
    return null;
  });
  def('addItem', (id, { plus = 0 } = {}) => {
    const inst = { uid: uid(), id, plus: Math.max(0, Math.min(3, plus | 0)) };
    s.bag.push(inst);
    if (items()[id]?.rarity === 'legendary') s.tally.legendaries = (s.tally.legendaries || 0) + 1;
    changed('item:gained', { id, qty: 1, uid: inst.uid });
    bus.emit('gs:bag', { add: inst });
    return inst;
  });
  def('removeItem', (u) => {
    const i = s.bag.findIndex((x) => x.uid === u);
    if (i >= 0) { const [inst] = s.bag.splice(i, 1); changed('item:lost', { id: inst.id, qty: 1, uid: u }); bus.emit('gs:bag', { remove: inst }); return inst; }
    for (const h of s.party) for (const slot of SLOTS) {
      if (h.gear[slot]?.uid === u) { const inst = h.gear[slot]; h.gear[slot] = null; s.refreshHero(h.id); changed('item:lost', { id: inst.id, qty: 1, uid: u }); return inst; }
    }
    return null;
  });
  def('equip', (heroId, u) => {
    const h = s.hero(heroId);
    const found = s.findItem(u);
    if (!h || !found) return false;
    const { inst } = found;
    const slot = s.slotOf(inst.id);
    if (!slot || !s.canEquip(h.id, inst.id)) return false;
    // take it from wherever it is
    if (found.where === 'bag') s.bag.splice(s.bag.indexOf(inst), 1);
    else { const other = s.hero(found.where); other.gear[found.slot] = null; s.refreshHero(other.id); }
    if (h.gear[slot]) s.bag.push(h.gear[slot]);
    h.gear[slot] = inst;
    s.refreshHero(h.id);
    changed('gs:equip', { heroId: h.id, slot, uid: u });
    bus.emit('gs:bag', {});
    return true;
  });
  def('unequip', (heroId, slot) => {
    const h = s.hero(heroId);
    if (!h || !h.gear[slot]) return null;
    const inst = h.gear[slot];
    h.gear[slot] = null;
    s.bag.push(inst);
    s.refreshHero(h.id);
    changed('gs:equip', { heroId: h.id, slot, uid: null });
    bus.emit('gs:bag', {});
    return inst;
  });
  def('consumables', () => {
    const map = new Map();
    for (const inst of s.bag) {
      if (items()[inst.id]?.kind !== 'consumable') continue;
      if (!map.has(inst.id)) map.set(inst.id, { id: inst.id, qty: 0, uids: [] });
      const e = map.get(inst.id); e.qty++; e.uids.push(inst.uid);
    }
    return [...map.values()];
  });
  def('useItem', (u, { heroId = null, applied = false } = {}) => {
    const inst = s.bag.find((x) => x.uid === u);
    if (!inst) return false;
    const it = items()[inst.id];
    if (!applied && it?.use) {
      const use = it.use;
      const targets = heroId ? [s.hero(heroId)].filter(Boolean) : s.party;
      if (use.revive) for (const h of targets) { if (h.hp <= 0) { h.hp = Math.max(1, Math.round(h.maxHp * use.revive / 100)); changed('party:hp', { id: h.id, hp: h.hp, maxHp: h.maxHp, delta: h.hp }); } }
      if (use.heal) {
        const who = heroId ? targets : s.living();
        for (const h of who) if (h.hp > 0) s.heal(h.id, { pct: use.heal });
      }
    }
    s.bag.splice(s.bag.indexOf(inst), 1);
    s.tally.potions = (s.tally.potions || 0) + 1;
    changed('item:used', { id: inst.id, uid: u });
    bus.emit('gs:bag', { remove: inst });
    return true;
  });
  // by item id (the shared step interpreter's give/take/has)
  def('has', (itemId) => s.bag.some((x) => x.id === itemId) || s.party.some((h) => SLOTS.some((sl) => h.gear[sl]?.id === itemId)) || s.trophies.includes(itemId));
  def('give', (itemId, qty = 1) => {
    if (itemId === 'gs_bone_shards' || itemId === 'gs_shards' || itemId === 'shards') { s.addShards(qty); return; }
    for (let i = 0; i < qty; i++) s.addItem(itemId);
  });
  def('take', (itemId, qty = 1) => {
    let n = 0;
    for (let i = 0; i < qty; i++) { const inst = s.bag.find((x) => x.id === itemId); if (!inst) break; s.removeItem(inst.uid); n++; }
    return n > 0;
  });

  // ---------- money ----------
  def('addGold', (n) => { n = Math.round(n); s.gold = Math.max(0, s.gold + n); if (n > 0) s.tally.gold = (s.tally.gold || 0) + n; changed('gold:changed', { gold: s.gold, delta: n }); });
  def('addShards', (n) => { n = Math.round(n); s.shards = Math.max(0, s.shards + n); changed('gs:shards', { shards: s.shards, delta: n }); });

  // ---------- XP ----------
  const xpFor = (lvl) => {
    const R = rules();
    if (R?.xpForLevel) { try { const v = R.xpForLevel(lvl); if (Number.isFinite(v)) return v; } catch { /* stand-in */ } }
    return DEV.xpForLevel(lvl);
  };
  def('xpFor', xpFor);
  def('xpInfo', () => {
    if (s.level >= MAX_LEVEL) return { level: s.level, into: 1, need: 1, pct: 1, max: true };
    const a = xpFor(s.level), b = xpFor(s.level + 1);
    const into = Math.max(0, s.xp - a), need = Math.max(1, b - a);
    return { level: s.level, into, need, pct: Math.min(1, into / need), max: false };
  });
  def('addXp', (n) => {
    const levels = [];
    s.xp += Math.max(0, Math.round(n));
    while (s.level < MAX_LEVEL && s.xp >= xpFor(s.level + 1)) { s.level++; levels.push(s.level); }
    if (levels.length) { refreshAll(); s.fullHeal(); }
    changed('gs:xp', { xp: s.xp, level: s.level, levels });
    return { levels };
  });
  def('addBoon', (id) => { if (!s.boons.includes(id)) s.boons.push(id); refreshAll(); changed('gs:boon', { id }); });

  // ---------- health ----------
  def('damage', (heroId, n, { floor = 0 } = {}) => {
    const h = s.hero(heroId);
    if (!h) return 0;
    h.hp = Math.max(floor, h.hp - Math.round(n));
    changed('party:hp', { id: h.id, hp: h.hp, maxHp: h.maxHp, delta: -n });
    return h.hp;
  });
  def('heal', (who = 'all', n = 'full') => {
    const list = who === 'all' ? s.party : [s.hero(who)].filter(Boolean);
    for (const h of list) {
      const before = h.hp;
      const add = n === 'full' ? h.maxHp : typeof n === 'object' && n ? Math.round(h.maxHp * (n.pct > 1 ? n.pct / 100 : n.pct)) : Number(n) || 0;
      if (h.hp <= 0 && n !== 'full' && who === 'all') continue; // a knocked-down hunter needs a feather or the fire
      h.hp = Math.min(h.maxHp, Math.max(0, h.hp) + add);
      changed('party:hp', { id: h.id, hp: h.hp, maxHp: h.maxHp, delta: h.hp - before });
    }
  });
  def('fullHeal', () => { for (const h of s.party) { const b = h.hp; h.hp = h.maxHp; changed('party:hp', { id: h.id, hp: h.hp, maxHp: h.maxHp, delta: h.hp - b }); } });
  def('standUp', () => { for (const h of s.party) if (h.hp <= 0) { h.hp = 1; changed('party:hp', { id: h.id, hp: 1, maxHp: h.maxHp, delta: 1 }); } });

  // ---------- floors ----------
  def('floor', (n) => { if (!s.floors[n]) s.floors[n] = { unlocked: false, cleared: false, rooms: {} }; return s.floors[n]; });
  def('unlockFloor', (n) => { s.floor(n).unlocked = true; changed('gs:floor', { n }); });
  def('clearRoom', (n, roomId) => { s.floor(n).rooms[roomId] = 'cleared'; changed('gs:room', { n, roomId }); });
  def('roomCleared', (n, roomId) => s.floor(n).rooms?.[roomId] === 'cleared');
  def('clearFloor', (n) => { s.floor(n).cleared = true; if (s.floors[n + 1]) s.unlockFloor(n + 1); changed('gs:floor', { n, cleared: true }); });
  def('resetFloorRooms', (n) => { s.floor(n).rooms = {}; changed('gs:floor', { n }); });

  // ---------- flags, conditions, tally ----------
  def('flag', (name) => !!s.flags[name]);
  def('setFlag', (name, v = true) => { s.flags[name] = v; changed('flag:changed', { name, v }); });
  def('addCounter', (name, n = 1) => { s.counters[name] = (s.counters[name] || 0) + n; changed('counter:changed', { name, v: s.counters[name] }); });
  def('count', (name) => s.counters[name] || 0);
  def('tallyAdd', (key, n = 1) => { s.tally[key] = (s.tally[key] || 0) + n; });
  def('tallyMax', (key, n) => { s.tally[key] = Math.max(s.tally[key] || 0, n || 0); });
  def('seeFoe', (id, weakKnown = false) => {
    const e = s.seenFoes[id] || { weakKnown: false };
    e.weakKnown = e.weakKnown || !!weakKnown;
    s.seenFoes[id] = e;
    changed('gs:foe', { id, weakKnown: e.weakKnown });
  });
  def('addTrophy', (id) => { if (!s.trophies.includes(id)) s.trophies.push(id); changed('gs:trophy', { id }); });
  def('addJournal', (text) => { s.journal.push({ where: s.where, text, t: Date.now() }); changed('journal:added', { text }); });
  def('quest', ({ id, title, text }) => { if (!s.quests.find((q) => q.id === id)) s.quests.push({ id, title, text, done: false }); changed('quest:updated', { id }); });
  def('questDone', (id) => { const q = s.quests.find((x) => x.id === id); if (q) q.done = true; changed('quest:updated', { id, done: true }); });
  def('addStar', () => 0);
  def('spendStar', () => false);
  def('replaceHero', (hero) => { const i = s.party.findIndex((x) => x.id === hero.id); if (i >= 0) s.party[i] = hero; changed('party:hp', { id: hero.id }); });

  def('test', (c) => {
    if (c == null || c === true) return true;
    if (c === false) return false;
    if (typeof c === 'string') return !!s.flags[c];
    if (Array.isArray(c)) return c.every((x) => s.test(x));
    if ('not' in c) return !s.test(c.not);
    if ('all' in c) return c.all.every((x) => s.test(x));
    if ('any' in c) return c.any.some((x) => s.test(x));
    if ('has' in c) return s.has(c.has);
    if ('hero' in c) return !!s.hasArch(c.hero);
    if ('talent' in c) return false;
    if ('stars' in c) return false;
    if ('gold' in c) return s.gold >= c.gold;
    if ('shards' in c) return s.shards >= c.shards;
    if ('level' in c) return s.level >= c.level;
    if ('count' in c) return (s.counters[c.count[0]] || 0) >= c.count[1];
    if ('party' in c) return s.party.length >= c.party;
    if ('flag' in c) return !!s.flags[c.flag];
    if ('difficulty' in c) return s.difficulty === c.difficulty;
    if ('cleared' in c) return !!s.floors[c.cleared]?.cleared;
    console.warn('[gs-state] unknown condition', c);
    return false;
  });

  return s;
}

// ---------- stand-in rules (used until gs-rules' rules.js lands, and if it throws) ----------
const DICE = { common: '1d6', rare: '1d8+2', epic: '2d6+4', legendary: '2d8+8' };
const XP_TABLE = [0, 0, 70, 170, 320, 520, 780, 1100, 1500];
export const DEV = {
  xpForLevel: (n) => XP_TABLE[Math.max(0, Math.min(8, n))] ?? 1500 + (n - 8) * 500,
  derive(hero, { level = 1, boons = [], content = {} } = {}) {
    const hc = content.heroes?.[hero.arch] || {};
    const b = hc.base || { hp: 36, hpPer: 7, atk: 5, def: 2, spd: 4, luck: 2 };
    const out = { hp: b.hp + (b.hpPer || 6) * (level - 1), atk: b.atk + 1.5 * (level - 1), def: b.def + 0.5 * (level - 1), spd: b.spd, luck: b.luck,
      weapon: { dice: '1d4', element: null, family: hc.family || null, traits: [] }, effects: [] };
    for (const slot of SLOTS) {
      const inst = hero.gear?.[slot];
      const it = inst && content.items?.[inst.id];
      if (!it) continue;
      const m = 1 + 0.1 * (inst.plus || 0);
      const st = it.stats || {};
      for (const k of ['hp', 'atk', 'def', 'spd', 'luck']) if (st[k]) out[k] += st[k] * m;
      if (slot === 'weapon') out.weapon = { dice: st.dice || DICE[it.rarity] || '1d6', element: it.element || null, family: it.family || out.weapon.family, traits: it.traits || [] };
      else if (it.traits) out.effects.push(...it.traits);
    }
    for (const id of boons) { const e = content.boons?.[id]?.effect || {}; if (e.hpPct) out.hp *= 1 + e.hpPct / 100; if (e.atk) out.atk += e.atk; if (e.def) out.def += e.def; }
    for (const k of ['hp', 'atk', 'def', 'spd', 'luck']) out[k] = Math.round(out[k]);
    return out;
  },
};
