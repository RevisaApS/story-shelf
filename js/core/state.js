// Game state (SPEC section 4). ctx.state is a plain object holding the data fields plus helper methods.
// JSON.stringify(ctx.state) gives the save (methods are skipped). Every mutation emits 'state:changed'.
//
// Data: v, seed, startedAt, playMs, party, gold, stars, inventory, flags, counters, quests, journal, scene, tally
// Helpers: hero(id), heroes(), hasTalent(t)->hero|null, hasArch(a), flag(name), setFlag(name, v=true),
//   addCounter(name, n=1), count(name), has(itemId), give(itemId, qty=1), take(itemId, qty=1), addGold(n),
//   addStar(n=1, why), spendStar()->bool, damage(heroId, n, { floor })->hp, heal(heroId|'all', n|'full'),
//   test(cond)->bool, addHero(arch, name), setParty([arch..]), quest({id,title,text}), questDone(id),
//   addJournal(text), equip(heroId, itemId), tallyAdd(key, n=1), reset(seed), load(data), data()
import * as R from './rules.js';

const fresh = (seed) => ({
  v: 1, seed, startedAt: Date.now(), playMs: 0,
  party: [], gold: 0, stars: R.STARS_START, inventory: {},
  flags: {}, counters: {}, quests: [], journal: [],
  scene: null,
  tally: { nat20: 0, nat1: 0, checks: 0, passed: 0, befriended: 0, defeated: 0, starsEarned: 0, starsSpent: 0, tableMoments: 0, songMistakes: 0 },
});

export function createState(bus, getContent = () => null) {
  const s = fresh(0);
  const changed = (evt, data) => { if (evt) bus.emit(evt, data); bus.emit('state:changed', { evt, data }); };
  const def = (name, fn) => Object.defineProperty(s, name, { value: fn, enumerable: false, writable: true });

  def('data', () => JSON.parse(JSON.stringify(s)));
  def('reset', (seed = Date.now()) => {
    for (const k of Object.keys(s)) delete s[k];
    Object.assign(s, fresh(seed));
    changed('state:reset');
  });
  def('load', (data) => {
    for (const k of Object.keys(s)) delete s[k];
    Object.assign(s, fresh(data?.seed ?? 0), data || {});
    s.tally = { ...fresh(0).tally, ...(data?.tally || {}) };
    s.stars = Math.max(0, Math.min(R.STARS_MAX, Number(s.stars) || 0)); // saves from before STARS_MAX 3
    changed('state:loaded');
  });

  def('hero', (id) => s.party.find((h) => h.id === id || h.arch === id) || null);
  def('heroes', () => s.party);
  def('living', () => s.party.filter((h) => h.hp > 0));
  def('hasTalent', (t) => s.party.find((h) => h.talent === t) || null);
  def('hasArch', (a) => s.party.find((h) => h.arch === a) || null);

  def('addHero', (arch, name) => {
    const content = getContent();
    const h = R.makeHero(arch, content?.heroes?.[arch], name);
    s.party.push(h);
    changed('party:changed', { party: s.party });
    return h;
  });
  def('setParty', (list) => {
    s.party = [];
    for (const item of list) {
      const arch = typeof item === 'string' ? item : item.arch;
      const name = typeof item === 'string' ? null : item.name;
      if (R.ARCH[arch] && !s.party.find((h) => h.arch === arch)) s.addHero(arch, name);
    }
    changed('party:changed', { party: s.party });
  });
  def('replaceHero', (hero) => {
    const i = s.party.findIndex((h) => h.id === hero.id);
    if (i >= 0) s.party[i] = hero;
    changed('party:hp', { id: hero.id, hp: hero.hp, maxHp: hero.maxHp });
  });

  def('flag', (name) => !!s.flags[name]);
  def('setFlag', (name, v = true) => { s.flags[name] = v; changed('flag:changed', { name, v }); });
  def('addCounter', (name, n = 1) => { s.counters[name] = (s.counters[name] || 0) + n; changed('counter:changed', { name, v: s.counters[name] }); });
  def('count', (name) => s.counters[name] || 0);
  def('tallyAdd', (key, n = 1) => { s.tally[key] = (s.tally[key] || 0) + n; });

  def('has', (itemId) => (s.inventory[itemId] || 0) > 0 || s.party.some((h) => h.trinket === itemId));
  def('give', (itemId, qty = 1) => {
    s.inventory[itemId] = (s.inventory[itemId] || 0) + qty;
    changed('item:gained', { id: itemId, qty });
  });
  def('take', (itemId, qty = 1) => {
    const had = s.inventory[itemId] || 0;
    if (had <= 0) {
      const h = s.party.find((x) => x.trinket === itemId);
      if (h) { h.trinket = null; delete h.trinketPassive; changed('item:lost', { id: itemId, qty: 1 }); return true; }
      return false;
    }
    s.inventory[itemId] = Math.max(0, had - qty);
    if (!s.inventory[itemId]) delete s.inventory[itemId];
    changed('item:lost', { id: itemId, qty });
    return true;
  });
  def('equip', (heroId, itemId) => {
    const h = s.hero(heroId);
    if (!h) return false;
    const before = R.maxHp(h);
    if (h.trinket) s.inventory[h.trinket] = (s.inventory[h.trinket] || 0) + 1;
    if (itemId) {
      if (!s.inventory[itemId]) return false;
      s.inventory[itemId]--; if (!s.inventory[itemId]) delete s.inventory[itemId];
    }
    h.trinket = itemId || null;
    const passive = itemId ? getContent()?.items?.[itemId]?.passive : null;
    if (passive) h.trinketPassive = passive; else delete h.trinketPassive;
    h.maxHp = R.maxHp(h); h.guard = R.guard(h);
    h.hp = Math.max(1, Math.min(h.maxHp, h.hp + (h.maxHp - before)));
    changed('party:hp', { id: h.id, hp: h.hp, maxHp: h.maxHp });
    return true;
  });

  def('addGold', (n) => { s.gold = Math.max(0, s.gold + n); changed('gold:changed', { gold: s.gold, delta: n }); });
  def('addStar', (n = 1, why = '') => {
    const before = s.stars;
    s.stars = Math.max(0, Math.min(R.STARS_MAX, s.stars + n));
    const delta = s.stars - before;
    if (delta > 0) s.tally.starsEarned += delta;
    changed('stars:changed', { stars: s.stars, delta, why, wanted: n });
    return delta;
  });
  def('spendStar', () => {
    if (s.stars <= 0) return false;
    s.stars--; s.tally.starsSpent++;
    changed('stars:changed', { stars: s.stars, delta: -1, why: 'spent' });
    return true;
  });

  def('damage', (heroId, n, { floor = 0 } = {}) => {
    const h = s.hero(heroId);
    if (!h) return 0;
    h.hp = Math.max(floor, h.hp - n);
    changed('party:hp', { id: h.id, hp: h.hp, maxHp: h.maxHp, delta: -n });
    return h.hp;
  });
  def('heal', (who = 'all', n = 'full') => {
    const list = who === 'all' ? s.party : [s.hero(who)].filter(Boolean);
    for (const h of list) {
      const before = h.hp;
      h.hp = n === 'full' ? h.maxHp : Math.min(h.maxHp, h.hp + n);
      changed('party:hp', { id: h.id, hp: h.hp, maxHp: h.maxHp, delta: h.hp - before });
    }
  });

  def('quest', ({ id, title, text }) => {
    const q = s.quests.find((x) => x.id === id);
    if (q) Object.assign(q, { title: title ?? q.title, text: text ?? q.text });
    else s.quests.push({ id, title, text, done: false });
    changed('quest:updated', { id, done: false, title });
  });
  def('questDone', (id) => {
    const q = s.quests.find((x) => x.id === id);
    if (q) q.done = true; else s.quests.push({ id, title: id, text: '', done: true });
    changed('quest:updated', { id, done: true, title: q?.title });
  });
  def('addJournal', (text) => { s.journal.push({ scene: s.scene, text, t: Date.now() }); changed('journal:added', { text }); });

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
    if ('talent' in c) return !!s.hasTalent(c.talent);
    if ('stars' in c) return s.stars >= c.stars;
    if ('gold' in c) return s.gold >= c.gold;
    if ('count' in c) return (s.counters[c.count[0]] || 0) >= c.count[1];
    if ('party' in c) return s.party.length >= c.party;
    if ('flag' in c) return !!s.flags[c.flag];
    console.warn('[state] unknown condition', c);
    return false;
  });

  return s;
}
