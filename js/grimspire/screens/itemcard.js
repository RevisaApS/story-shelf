// Grimspire gear: the one way an item is drawn, and the gear helpers every screen shares. [gs-gear]
//
//   await loadGear(ctx)                      loads css/gs-gear.css and the rules module once (call before drawing)
//   itemIcon(ctx, idOrInst, size=96)         icon: assets/item/<id>.webp, or a painted-look SVG stand-in in the rarity colour
//   itemCard(ctx, idOrInst, { size:'lg'|'md'|'sm', compare: heroId?, price?, kicker? }) -> <div.gsg-card>
//   itemTile(ctx, idOrInst, { heroId?, count?, selected? }) -> <button.gsg-tile> (bag grid square)
//   compareBlock(ctx, heroId, idOrInst) -> <div.gsg-compare>   current item in that slot, five stats before -> after with arrows
//   statPanel(ctx, heroId, { preview: inst|null }) -> <div.gsg-stats>   the five stats, with the change while an item is selected
//   gearDelta(ctx, heroId, idOrInst) -> { ok, why, slot, cur, before, after, gain }
//   bestHeroFor(ctx, idOrInst) -> { heroId, gain } | null          the hunter who gains most (gain > 0) or null
//   equipBest(ctx, heroId) -> n                                    equips the best bag gear in every slot, returns swaps made
//   deriveHero(ctx, hero, gearOverride?) -> { hp, atk, def, spd, luck, weapon }
//   itemStatLines(ctx, item, plus) -> [{ k, label, text }]         plain words; traitText(t), useLines(item)
//   canEquip(ctx, hero, item) -> { ok, why }, slotOf(item), familyOf(ctx, hero)
//   heroPortrait(ctx, hero, size), elementChip(el), rarityName(r), kindName(item), STAT_KEYS, STAT_NAME
//   refOf(ctx, idOrInst) -> { item, inst, id, plus }
//   speak(ctx, text, { as, mood, bubble }) -> Promise             a voiced line without the narration panel
//   linePool(ctx, key) -> [lines]; pickLine(ctx, key) -> line|null
import { h, tap } from '../../ui/dom.js';
import { L } from '../../core/i18n.js';
import { voiceId } from '../../core/voiceid.js';
import { RARITY_COLOR, RARITY_RANK, GEAR_KINDS } from '../loot.js';

export { RARITY_COLOR, RARITY_RANK };
export const fill = (el, ...kids) => { el.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false && k !== true)); return el; };
export const STAT_KEYS = ['hp', 'atk', 'def', 'spd', 'luck'];
export const SLOTS = ['weapon', 'armour', 'helm', 'charm'];
const FAMILY = { dragonknight: 'sword', shadow: 'daggers', stormmage: 'staff', hunter: 'bow', berserker: 'axes', gravewarden: 'scythe' };
const BASE = {
  dragonknight: { hp: 46, hpPer: 9, atk: 5, def: 4, spd: 3, luck: 1 }, shadow: { hp: 32, hpPer: 6, atk: 6, def: 1, spd: 7, luck: 4 },
  stormmage: { hp: 28, hpPer: 5, atk: 7, def: 1, spd: 4, luck: 2 }, hunter: { hp: 34, hpPer: 6, atk: 6, def: 2, spd: 6, luck: 3 },
  berserker: { hp: 42, hpPer: 8, atk: 7, def: 2, spd: 4, luck: 1 }, gravewarden: { hp: 36, hpPer: 7, atk: 4, def: 3, spd: 5, luck: 2 },
};

export const STR = L({
  en: {
    stat: { hp: 'Health', atk: 'Attack', def: 'Defence', spd: 'Speed', luck: 'Luck', dmg: 'Damage' },
    statShort: { hp: 'HP', atk: 'ATK', def: 'DEF', spd: 'SPD', luck: 'LCK', dmg: 'DMG' },
    rarity: { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' },
    kind: { weapon: 'Weapon', armour: 'Armour', helm: 'Helm', charm: 'Charm', consumable: 'Potion', bomb: 'Bomb', feather: 'Feather', material: 'Material', trophy: 'Trophy' },
    family: { sword: 'Greatsword', daggers: 'Twin daggers', staff: 'Staff', bow: 'Bow', axes: 'Twin axes', scythe: 'Scythe-staff' },
    element: { fire: 'Fire', frost: 'Frost', storm: 'Storm', shadow: 'Shadow', spirit: 'Spirit' },
    elementHits: (e) => `Strikes with ${e}`,
    wearsNow: 'Wears now',
    nothing: 'Nothing',
    emptySlot: 'Empty',
    onlyFor: (fam, who) => `Only for ${fam}${who ? ` (${who})` : ''}`,
    cantWear: 'Cannot be worn',
    better: 'Better',
    worse: 'Worse',
    same: 'About the same',
    upgrade: (n) => `+${n}`,
    heal: (n) => (n >= 100 ? 'Heals to full Health' : `Heals ${n}% Health`),
    fury: (n) => `+${n} Fury`,
    cleanse: 'Clears poison, burn, chill and curses',
    revive: (n) => `Stands a knocked-down hunter up with ${n}% Health`,
    bomb: (m, e) => `Hits every foe${e ? ` with ${e}` : ''} (x${m})`,
    smoke: 'The next attack on each hunter misses',
    battleOnly: 'In battle',
    shards: 'Used at the Forge to upgrade gear',
    trophy: 'A trophy for the wall',
    dmgLine: (d) => `${d} damage`,
    count: (n) => `x${n}`,
    trait: {
      crit: 'More critical hits', lifesteal: 'Heals you a little with every hit', furyOnKill: '+1 Fury when a foe falls',
      pierce: 'Ignores some Defence', splash: 'Hits spill onto nearby foes', extraHit: 'Sometimes strikes twice', chain: 'Hits jump to another foe',
      volley: 'Fires extra arrows', lowHpPower: 'Hits harder when you are hurt', healOnPerfect: 'Perfect strikes heal you', healOnKill: 'Heals you when a foe falls',
      thorns: 'Foes that hit you get hurt back', resist: 'Takes less from one element', regen: 'Heals a little every turn', startShield: 'Starts each battle with a shield',
      blockWindow: 'Blocks are easier to time', strikeWindow: 'Strikes are easier to time', furyStart: 'Starts battles with extra Fury', furyOnPerfect: 'Extra Fury on Perfect strikes',
      furyOnBlock: 'Fury on a Perfect block', goldFind: 'Finds more gold', shardFind: 'Finds more Bone Shards', lastStand: 'Once per battle, stays up at 1 Health',
      dodge: 'Sometimes dodges an attack', immune: 'Cannot be poisoned or burned', statusOn: 'Perfect strikes add a status',
    },
  },
  da: {
    stat: { hp: 'Liv', atk: 'Angreb', def: 'Forsvar', spd: 'Fart', luck: 'Held', dmg: 'Skade' },
    statShort: { hp: 'LIV', atk: 'ANG', def: 'FOR', spd: 'FART', luck: 'HELD', dmg: 'SKADE' },
    rarity: { common: 'Almindelig', rare: 'Sjælden', epic: 'Episk', legendary: 'Legendarisk' },
    kind: { weapon: 'Våben', armour: 'Rustning', helm: 'Hjelm', charm: 'Amulet', consumable: 'Drik', bomb: 'Bombe', feather: 'Fjer', material: 'Materiale', trophy: 'Trofæ' },
    family: { sword: 'Tohåndssværd', daggers: 'Tvillingedolke', staff: 'Stav', bow: 'Bue', axes: 'Tvillingeøkser', scythe: 'Leestav' },
    element: { fire: 'Ild', frost: 'Frost', storm: 'Storm', shadow: 'Skygge', spirit: 'Ånd' },
    elementHits: (e) => `Rammer med ${e.toLowerCase()}`,
    wearsNow: 'Har på nu',
    nothing: 'Intet',
    emptySlot: 'Tom',
    onlyFor: (fam, who) => `Kun til ${fam.toLowerCase()}${who ? ` (${who})` : ''}`,
    cantWear: 'Kan ikke bæres',
    better: 'Bedre',
    worse: 'Dårligere',
    same: 'Næsten det samme',
    upgrade: (n) => `+${n}`,
    heal: (n) => (n >= 100 ? 'Giver fuldt Liv' : `Giver ${n}% Liv`),
    fury: (n) => `+${n} Raseri`,
    cleanse: 'Fjerner gift, brand, kulde og forbandelser',
    revive: (n) => `Rejser en slået jæger op med ${n}% Liv`,
    bomb: (m, e) => `Rammer alle fjender${e ? ` med ${e.toLowerCase()}` : ''} (x${m})`,
    smoke: 'Det næste angreb på hver jæger rammer forbi',
    battleOnly: 'I kamp',
    shards: 'Bruges i Smedjen til at forbedre udstyr',
    trophy: 'Et trofæ til væggen',
    dmgLine: (d) => `${d} skade`,
    count: (n) => `x${n}`,
    trait: {
      crit: 'Flere kritiske slag', lifesteal: 'Helbreder dig lidt for hvert slag', furyOnKill: '+1 Raseri, når en fjende falder',
      pierce: 'Går igennem noget Forsvar', splash: 'Slagene spreder sig til fjender tæt på', extraHit: 'Slår nogle gange to gange', chain: 'Slaget springer videre til en anden fjende',
      volley: 'Skyder ekstra pile', lowHpPower: 'Slår hårdere, når du er såret', healOnPerfect: 'Perfekte slag helbreder dig', healOnKill: 'Helbreder dig, når en fjende falder',
      thorns: 'Fjender, der rammer dig, får igen', resist: 'Tager mindre fra ét element', regen: 'Helbreder lidt hver tur', startShield: 'Starter hver kamp med et skjold',
      blockWindow: 'Lettere at time en blokering', strikeWindow: 'Lettere at time et slag', furyStart: 'Starter kampe med ekstra Raseri', furyOnPerfect: 'Ekstra Raseri for perfekte slag',
      furyOnBlock: 'Raseri for en perfekt blokering', goldFind: 'Finder mere guld', shardFind: 'Finder flere Benskår', lastStand: 'Én gang per kamp bliver du stående med 1 Liv',
      dodge: 'Undviger nogle gange et angreb', immune: 'Kan ikke blive forgiftet eller brændt', statusOn: 'Perfekte slag giver en tilstand',
    },
  },
});

export const STAT_NAME = (k) => STR.stat[k] || k;
export const rarityName = (r) => STR.rarity[r] || r;
export const kindName = (item) => {
  if (item?.kind === 'weapon' && item.family) return STR.family[item.family] || STR.kind.weapon;
  if (item?.kind === 'consumable') return item.use?.dmg || item.use?.smoke ? STR.kind.bomb : item.use?.revive ? STR.kind.feather : STR.kind.consumable;
  return STR.kind[item?.kind] || '';
};

// ------------------------------------------------------------------------------------------------ loading

let cssP = null, rulesP = null, rulesMod = null;
export function ensureGearCss() {
  if (cssP) return cssP;
  const href = new URL('../../../css/gs-gear.css', import.meta.url).href;
  if ([...document.querySelectorAll('link[rel="stylesheet"]')].some((l) => l.href === href)) { cssP = Promise.resolve(); return cssP; }
  cssP = new Promise((res) => {
    const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href, id: 'css-gs-gear' });
    link.onload = () => res(); link.onerror = () => res();
    document.head.appendChild(link);
    setTimeout(res, 1500);
  });
  return cssP;
}
export async function loadGear(ctx) {
  if (!rulesP) rulesP = import('../rules.js').then((m) => { rulesMod = m; }).catch(() => { rulesMod = null; });
  await Promise.all([ensureGearCss(), rulesP]);
  return getRules(ctx);
}
export const getRules = (ctx) => (ctx?.gsRules?.derive ? ctx.gsRules : rulesMod?.derive ? rulesMod : null);

// ------------------------------------------------------------------------------------------------ data helpers

const items = (ctx) => ctx.content?.items || {};
export function refOf(ctx, ref) {
  if (!ref) return { item: null, inst: null, id: null, plus: 0 };
  const inst = typeof ref === 'object' ? ref : null;
  const id = inst ? inst.id : ref;
  const item = items(ctx)[id] || null;
  return { item, inst, id, plus: inst?.plus || 0 };
}
export const slotOf = (item) => (item && SLOTS.includes(item.kind) ? item.kind : null);
export const familyOf = (ctx, hero) => ctx.content?.heroes?.[hero?.arch]?.family || FAMILY[hero?.arch] || null;
const firstName = (hero) => String(hero?.name || '').split(' ')[0];
export const heroesOf = (ctx) => (ctx.state?.heroes?.() || ctx.state?.party || []);

export function canEquip(ctx, hero, item) {
  if (!item || !SLOTS.includes(item.kind)) return { ok: false, why: STR.cantWear };
  if (item.kind === 'weapon' && item.family && item.family !== familyOf(ctx, hero)) {
    const owner = heroesOf(ctx).find((x) => familyOf(ctx, x) === item.family);
    return { ok: false, why: STR.onlyFor(STR.family[item.family] || item.family, owner ? firstName(owner) : '') };
  }
  return { ok: true, why: '' };
}

export function parseDice(d) {
  if (d == null) return null;
  if (typeof d === 'object') return { n: d.n || 1, s: d.s || d.sides || 6, mod: d.mod || 0 };
  const m = String(d).replace(/\s/g, '').match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!m) return null;
  return { n: Number(m[1] || 1), s: Number(m[2]), mod: Number(m[3] || 0) };
}
export const diceText = (p) => (p ? `${p.n}d${p.s}${p.mod ? (p.mod > 0 ? '+' : '') + p.mod : ''}` : '');
export const diceAvg = (p) => (p ? p.n * (p.s + 1) / 2 + p.mod : 0);

// item stats at a plus level. rules.itemStats wins when gs-rules exports it.
export function itemStats(ctx, item, plus = 0) {
  const R = getRules(ctx);
  if (R?.itemStats) { try { return R.itemStats(item, plus); } catch { /* fall through */ } }
  const s = { ...(item?.stats || {}) };
  for (const k of STAT_KEYS.concat(['atk'])) {
    const v = Number(s[k]);
    if (v > 0 && plus > 0) s[k] = v + Math.max(plus, Math.round(v * 0.1 * plus));
  }
  if (s.dice) { const p = parseDice(s.dice); if (p) { p.mod += plus; s.dice = diceText(p); } }
  return s;
}

function fallbackDerive(ctx, hero) {
  const lvl = ctx.state?.level || 1;
  const b = ctx.content?.heroes?.[hero.arch]?.base || BASE[hero.arch] || BASE.dragonknight;
  const out = { hp: b.hp + (b.hpPer || 0) * (lvl - 1), atk: b.atk + 1.5 * (lvl - 1), def: b.def + 0.5 * (lvl - 1), spd: b.spd, luck: b.luck, weapon: { dice: '1d4', family: familyOf(ctx, hero), element: null, traits: [] } };
  for (const slot of SLOTS) {
    const inst = hero.gear?.[slot];
    const it = inst && items(ctx)[inst.id];
    if (!it) continue;
    const st = itemStats(ctx, it, inst.plus || 0);
    for (const k of STAT_KEYS) out[k] += Number(st[k]) || 0;
    if (slot === 'weapon') out.weapon = { dice: st.dice || '1d6', family: it.family, element: it.element || null, traits: it.traits || [] };
  }
  return out;
}

export function deriveHero(ctx, hero, gear = null) {
  if (!hero) return null;
  const h2 = gear ? { ...hero, gear: { ...hero.gear, ...gear } } : hero;
  const R = getRules(ctx);
  let d = null;
  if (R?.derive) {
    try { d = R.derive(h2, { level: ctx.state?.level || 1, boons: ctx.state?.boons || [], content: ctx.content, difficulty: ctx.state?.difficulty }); }
    catch (e) { console.warn('[gs-gear] rules.derive threw, using the stand-in', e); }
  }
  if (!d) d = fallbackDerive(ctx, h2);
  return { hp: Math.round(d.hp ?? d.maxHp ?? 0), atk: Math.round(d.atk ?? 0), def: Math.round(d.def ?? 0), spd: Math.round(d.spd ?? 0), luck: Math.round(d.luck ?? 0), weapon: d.weapon || null, effects: d.effects || [] };
}

const dmgAvg = (ctx, d) => diceAvg(parseDice(d?.weapon?.dice)) + (d?.atk || 0);
function score(ctx, d, gear) {
  let s = d.hp * 0.3 + d.atk * 2.2 + d.def * 2 + d.spd * 0.9 + d.luck * 0.7 + diceAvg(parseDice(d.weapon?.dice)) * 2.2;
  for (const inst of Object.values(gear || {})) {
    const it = inst && items(ctx)[inst.id];
    if (it) s += (it.traits?.length || 0) * 1.6 + (it.element ? 1 : 0) + (RARITY_RANK[it.rarity] || 0) * 0.5;
  }
  return s;
}

export function gearDelta(ctx, heroId, ref) {
  const hero = typeof heroId === 'object' ? heroId : ctx.state?.hero?.(heroId) || heroesOf(ctx).find((x) => x.id === heroId);
  const { item, inst, id, plus } = refOf(ctx, ref);
  const slot = slotOf(item);
  const can = canEquip(ctx, hero, item);
  if (!hero || !slot) return { ok: false, why: can.why, slot, cur: null, before: null, after: null, gain: 0 };
  const cur = hero.gear?.[slot] || null;
  const before = deriveHero(ctx, hero);
  const wearing = cur && inst && cur.uid === inst.uid;
  const after = can.ok && !wearing ? deriveHero(ctx, hero, { [slot]: inst || { uid: '_preview', id, plus } }) : before;
  const gain = can.ok && !wearing ? score(ctx, after, { ...hero.gear, [slot]: inst || { id, plus } }) - score(ctx, before, hero.gear) : 0;
  return { ok: can.ok, why: can.why, slot, cur, before, after, gain, wearing: !!wearing };
}

export function bestHeroFor(ctx, ref) {
  let best = null;
  for (const hero of heroesOf(ctx)) {
    const d = gearDelta(ctx, hero, ref);
    if (d.ok && d.gain > 0.25 && (!best || d.gain > best.gain)) best = { heroId: hero.id, gain: d.gain };
  }
  return best;
}

export function equipBest(ctx, heroId) {
  const s = ctx.state;
  const hero = s.hero(heroId);
  if (!hero) return 0;
  let n = 0;
  for (const slot of SLOTS) {
    let best = null;
    for (const inst of s.bag) {
      const it = items(ctx)[inst.id];
      if (slotOf(it) !== slot) continue;
      const d = gearDelta(ctx, hero, inst);
      if (d.ok && d.gain > 0.25 && (!best || d.gain > best.gain)) best = { inst, gain: d.gain };
    }
    if (best && s.equip(hero.id, best.inst.uid)) n++;
  }
  return n;
}

// ------------------------------------------------------------------------------------------------ words

export function traitText(t) {
  if (!t) return '';
  if (typeof t === 'string') return STR.trait[t] || t;
  if (t.text) return t.text;
  if (t.id === 'statusOn' && t.status) return `${STR.trait.statusOn} (${t.status})`;
  return STR.trait[t.id] || String(t.id || '').replace(/([A-Z])/g, ' $1').toLowerCase();
}

export function useLines(item) {
  const u = item?.use || {};
  const out = [];
  if (u.heal) out.push(STR.heal(u.heal));
  if (u.fury) out.push(STR.fury(u.fury));
  if (u.cleanse) out.push(STR.cleanse);
  if (u.revive) out.push(STR.revive(u.revive));
  if (u.dmg) out.push(STR.bomb(u.dmg.mult ?? 1, u.dmg.element ? STR.element[u.dmg.element] : ''));
  if (u.smoke) out.push(STR.smoke);
  return out;
}

export function itemStatLines(ctx, item, plus = 0) {
  if (!item) return [];
  const out = [];
  if (item.kind === 'consumable') return useLines(item).map((text) => ({ k: 'use', text }));
  if (item.kind === 'material') return [{ k: 'use', text: STR.shards }];
  if (item.kind === 'trophy') return [{ k: 'use', text: STR.trophy }];
  const st = itemStats(ctx, item, plus);
  if (st.dice) out.push({ k: 'dmg', label: STR.stat.dmg, text: st.dice });
  for (const k of ['atk', 'def', 'hp', 'spd', 'luck']) {
    const v = Number(st[k]);
    if (v) out.push({ k, label: STR.stat[k], text: `${v > 0 ? '+' : ''}${v}` });
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ voice

export function linePool(ctx, key) {
  const v = ctx.content?.lines?.[key];
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : [];
}
const lastPick = new Map();
export function pickLine(ctx, key) {
  const pool = linePool(ctx, key);
  if (!pool.length) return null;
  let choice = pool[Math.floor((ctx.rng?.float?.() ?? Math.random()) * pool.length)];
  if (pool.length > 1 && choice === lastPick.get(key)) choice = pool[(pool.indexOf(choice) + 1) % pool.length];
  lastPick.set(key, choice);
  return choice;
}

// a voiced line with the text in a speech bubble element (no narration panel). Resolves after the voice, max 8 s.
export async function speak(ctx, text, { as = 'gm', mood = 'fierce', bubble = null } = {}) {
  if (!text) return;
  if (bubble) {
    bubble.querySelector('.gsg-bubble-text').textContent = text;
    bubble.classList.remove('is-in'); void bubble.offsetWidth; bubble.classList.add('is-in');
  }
  ctx.bus?.emit?.('gm:line', { text, as, mood });
  const voiceOn = ctx.settings?.voiceOn !== false && !ctx.fast;
  const id = voiceId(as, mood, text);
  const dur = voiceOn ? (ctx.audio?.voiceDuration?.(id) || 0) : 0;
  const minMs = Math.min(5200, 900 + String(text).length * 36);
  const p = voiceOn ? Promise.resolve(ctx.audio?.voice?.(id)).catch(() => {}) : Promise.resolve();
  await Promise.race([Promise.all([p, ctx.sleep(dur ? 200 : minMs)]), ctx.sleep(8000)]);
}

export function bubbleEl(cls = '') {
  return h('div.gsg-bubble', { class: cls || null }, h('p.gsg-bubble-text'));
}

// ------------------------------------------------------------------------------------------------ drawing

const svgNS = 'http://www.w3.org/2000/svg';
// silhouettes on a 64 x 64 box; filled with the rarity gradient, steel edge
const GLYPH = {
  sword: '<path d="M44 6l14 0 0 14-26 26-4-4-4 4-6-6 4-4-4-4z" /><path d="M14 40l10 10-4 4-3-3-6 6-4-4 6-6-3-3z"/>',
  daggers: '<path d="M18 4l6 2 2 24-4 4-4-4z"/><path d="M14 32h14v4H14z"/><path d="M19 36h4v12h-4z"/><path d="M46 4l-6 2-2 24 4 4 4-4z"/><path d="M36 32h14v4H36z"/><path d="M41 36h4v12h-4z"/><circle cx="21" cy="52" r="3"/><circle cx="43" cy="52" r="3"/>',
  staff: '<path d="M29 18h6v42h-6z"/><circle cx="32" cy="12" r="9"/><path d="M22 20l-6-8M42 20l6-8" stroke-width="3" stroke-linecap="round"/>',
  bow: '<path d="M18 4c22 8 22 48 0 56l-3-3c17-8 17-42 0-50z"/><path d="M18 6v52" stroke-width="1.6" fill="none"/><path d="M18 31h38l-6-4v8l6-4" />',
  axes: '<path d="M14 12h4v46h-4z"/><path d="M18 10c14 0 18 10 16 18-6-4-12-4-16-2z"/><path d="M46 12h4v46h-4z"/><path d="M46 10c-14 0-18 10-16 18 6-4 12-4 16-2z"/>',
  scythe: '<path d="M30 10h5v50h-5z"/><path d="M34 10c14-4 24 4 26 16-8-8-18-10-26-8z"/><circle cx="18" cy="40" r="7"/><path d="M18 33v-6h12" fill="none" stroke-width="2.4"/>',
  armour: '<path d="M14 10l10-4c2 4 6 6 8 6s6-2 8-6l10 4 8 12-8 4v32H14V26l-8-4z"/>',
  helm: '<path d="M32 6c14 0 22 10 22 24v18l-10 8V36H20v20l-10-8V30C10 16 18 6 32 6z"/><path d="M8 18l-4-12 10 8zM56 18l4-12-10 8z"/>',
  charm: '<path d="M22 4h20l-4 8H26z" /><path d="M32 12l18 20-18 28-18-28z"/>',
  potion: '<path d="M26 4h12v6h-2v10c10 4 14 12 14 20 0 12-8 20-18 20S14 52 14 40c0-8 4-16 14-20V10h-2z"/>',
  bomb: '<circle cx="28" cy="38" r="20"/><path d="M38 20l6-6 6 6-6 6z"/><path d="M46 12c2-4 6-6 10-4" fill="none" stroke-width="2.4" stroke-linecap="round"/>',
  feather: '<path d="M50 6C30 10 16 26 14 48l-6 10 3 2 6-10c22-2 36-16 38-36-6 4-12 6-18 6 6-2 10-6 13-14z"/>',
  shard: '<path d="M32 4l10 18-4 36-6 4-6-4-4-36z"/><path d="M14 26l8-6 2 24-6 4zM50 26l-8-6-2 24 6 4z"/>',
  trophy: '<path d="M18 6h28v14c0 10-6 16-14 16S18 30 18 20z"/><path d="M28 36h8v10h-8z"/><path d="M18 46h28v8H18z"/><path d="M18 10H8c0 10 4 14 10 14M46 10h10c0 10-4 14-10 14" fill="none" stroke-width="3"/>',
};
function glyphFor(item, id) {
  if (!item) return 'charm';
  if (item.kind === 'weapon') return GLYPH[item.family] ? item.family : 'sword';
  if (item.kind === 'consumable') {
    if (item.use?.revive || /feather/.test(id)) return 'feather';
    if (item.use?.dmg || item.use?.smoke || /bomb/.test(id)) return 'bomb';
    return 'potion';
  }
  if (item.kind === 'material') return 'shard';
  return GLYPH[item.kind] ? item.kind : 'charm';
}
const ELEMENT_COLOR = { fire: '#ff7a2e', frost: '#8fd8ff', storm: '#c7b8ff', shadow: '#a46bff', spirit: '#6dffb0' };
let gid = 0;
function glyphSvg(item, id, color) {
  const g = glyphFor(item, id);
  const n = ++gid;
  const el = item?.element ? ELEMENT_COLOR[item.element] : null;
  const s = document.createElementNS(svgNS, 'svg');
  s.setAttribute('viewBox', '0 0 64 64');
  s.setAttribute('class', 'gsg-glyph');
  s.innerHTML = `<defs><linearGradient id="gsgG${n}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".95"/><stop offset=".35" stop-color="${color}"/><stop offset="1" stop-color="#11141c"/></linearGradient>`
    + `<radialGradient id="gsgR${n}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${el || color}" stop-opacity=".55"/><stop offset="1" stop-color="${el || color}" stop-opacity="0"/></radialGradient></defs>`
    + `<circle cx="32" cy="32" r="31" fill="url(#gsgR${n})"/>`
    + `<g fill="url(#gsgG${n})" stroke="#0a0c12" stroke-width="1.6" stroke-linejoin="round">${GLYPH[g]}</g>`;
  return s;
}

export function itemIcon(ctx, ref, size = 96) {
  const { item, id } = refOf(ctx, ref);
  const rarity = item?.rarity || 'common';
  const color = RARITY_COLOR[rarity] || RARITY_COLOR.common;
  const wrap = h('span.gsg-icon', { style: { width: `${size}px`, height: `${size}px`, '--rc': color }, dataset: { rarity } });
  const ph = () => fill(wrap, glyphSvg(item, id || '', color));
  const src = id ? ctx.assets?.item?.(id) : null;
  if (!src || ctx.assets?.has?.(src) === false) ph();
  else { const img = h('img', { alt: item?.name || id, draggable: 'false' }); img.onerror = ph; img.src = src; wrap.appendChild(img); }
  return wrap;
}

const ELEMENT_PATH = {
  fire: '<path d="M12 2c1 4 6 6 6 12a6 6 0 01-12 0c0-3 2-5 3-7 0 2 1 3 2 3 0-3 1-6 1-8z"/>',
  frost: '<path d="M11 2h2v20h-2zM2 11h20v2H2zM4.9 6.3l1.4-1.4 12.8 12.8-1.4 1.4zM17.7 4.9l1.4 1.4L6.3 19.1l-1.4-1.4z"/>',
  storm: '<path d="M13 2L5 13h6l-2 9 9-12h-6l3-8z"/>',
  shadow: '<path d="M14 3a9 9 0 100 18 7 7 0 010-18z"/>',
  spirit: '<path d="M12 3c4 0 7 3 7 8v10l-2.3-2-2.3 2-2.4-2-2.4 2-2.3-2L5 21V11c0-5 3-8 7-8z"/><circle cx="9.5" cy="11" r="1.4" fill="#0a0c12"/><circle cx="14.5" cy="11" r="1.4" fill="#0a0c12"/>',
};
export function elementChip(el, { label = true } = {}) {
  if (!el) return null;
  const s = document.createElementNS(svgNS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.innerHTML = `<g fill="${ELEMENT_COLOR[el] || '#ccc'}">${ELEMENT_PATH[el] || ''}</g>`;
  return h('span.gsg-elem', { dataset: { el }, style: { '--ec': ELEMENT_COLOR[el] || '#ccc' } }, s, label ? h('span', STR.element[el] || el) : null);
}

export function plusMark(plus) {
  return plus > 0 ? h('span.gsg-plus', { dataset: { plus } }, `+${plus}`) : null;
}

export function heroPortrait(ctx, hero, size = 64) {
  const wrap = h('span.gsg-portrait', { style: { width: `${size}px`, height: `${size}px` }, dataset: { arch: hero?.arch || '' } });
  const ph = () => fill(wrap, h('span.gsg-portrait-ph', { style: { fontSize: `${Math.round(size * 0.38)}px` } }, (hero?.name || '?')[0]));
  const id = `gs_${hero?.arch}`;
  const src = ctx.assets?.portrait?.(id);
  if (!src || ctx.assets?.has?.(src) === false) ph();
  else { const img = h('img', { alt: hero?.name || '', draggable: 'false' }); img.onerror = ph; img.src = src; wrap.appendChild(img); }
  return wrap;
}

export function itemCard(ctx, ref, { size = 'lg', compare = null, price = null, kicker = null, extra = null } = {}) {
  const { item, id, plus } = refOf(ctx, ref);
  const rarity = item?.rarity || 'common';
  const name = item?.name || String(id || '').replace(/^gs_/, '').replace(/_/g, ' ');
  const lines = itemStatLines(ctx, item, plus);
  const traits = (item?.traits || []).map(traitText).filter(Boolean);
  const iconSize = size === 'lg' ? 168 : size === 'md' ? 120 : 84;
  const card = h('div.gsg-card', { class: `is-${size}`, dataset: { rarity, kind: item?.kind || '' }, style: { '--rc': RARITY_COLOR[rarity] } },
    h('div.gsg-card-glow'),
    h('div.gsg-card-head',
      h('span.gsg-card-kind', kicker || kindName(item)),
      h('span.gsg-card-rarity', rarityName(rarity))),
    h('div.gsg-card-art', h('div.gsg-card-rays'), itemIcon(ctx, ref, iconSize), plusMark(plus)),
    h('h3.gsg-card-name', name, plus ? h('span.gsg-card-plus', ` +${plus}`) : null),
    lines.length ? h('div.gsg-card-stats', lines.map((l) => h('div.gsg-line', { dataset: { k: l.k } }, l.label ? h('span', l.label) : null, h('b', l.text)))) : null,
    item?.element ? h('div.gsg-card-elem', elementChip(item.element)) : null,
    traits.length ? h('ul.gsg-card-traits', traits.map((t) => h('li', t))) : null,
    size !== 'sm' && item?.text ? h('p.gsg-card-text', item.text) : null,
    price != null ? h('div.gsg-card-price', coinSvg(), h('b', String(price))) : null,
    extra,
    compare ? compareBlock(ctx, compare, ref) : null);
  return card;
}

export function itemTile(ctx, ref, { heroId = null, count = null, selected = false, onTap = null } = {}) {
  const { item, inst, plus } = refOf(ctx, ref);
  const rarity = item?.rarity || 'common';
  let state = null;
  if (heroId && slotOf(item)) {
    const d = gearDelta(ctx, heroId, ref);
    state = !d.ok ? 'no' : d.gain > 0.25 ? 'up' : d.gain < -0.25 ? 'down' : null;
  }
  const el = h('button.gsg-tile', { type: 'button', class: [selected ? 'is-sel' : '', state === 'no' ? 'is-dim' : ''].filter(Boolean).join(' ') || null,
    dataset: { rarity, uid: inst?.uid || '', id: item?.id || '' }, style: { '--rc': RARITY_COLOR[rarity] }, title: item?.name || '' },
    h('span.gsg-tile-bg'),
    itemIcon(ctx, ref, 70),
    plusMark(plus),
    count > 1 ? h('span.gsg-tile-count', STR.count(count)) : null,
    state === 'up' ? h('span.gsg-tile-arrow.is-up', arrowSvg('up')) : state === 'down' ? h('span.gsg-tile-arrow.is-down', arrowSvg('down')) : null,
    state === 'no' ? h('span.gsg-tile-lock', lockSvg()) : null);
  if (onTap) tap(el, onTap, ctx);
  return el;
}

export function arrowSvg(dir = 'up') {
  const s = document.createElementNS(svgNS, 'svg');
  s.setAttribute('viewBox', '0 0 16 16');
  s.innerHTML = dir === 'up' ? '<path d="M8 2l6 7H10v5H6V9H2z" fill="currentColor"/>' : '<path d="M8 14l6-7H10V2H6v5H2z" fill="currentColor"/>';
  return s;
}
export function lockSvg() {
  const s = document.createElementNS(svgNS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.innerHTML = '<rect x="5" y="10.5" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 10.5V8a4 4 0 018 0v2.5" fill="none" stroke="currentColor" stroke-width="2"/>';
  return s;
}
export function coinSvg() {
  const s = document.createElementNS(svgNS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'gsg-coin');
  s.innerHTML = '<defs><linearGradient id="gsgCoin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1c4"/><stop offset=".5" stop-color="#f7c95c"/><stop offset="1" stop-color="#b07a22"/></linearGradient></defs><circle cx="12" cy="12" r="9.5" fill="url(#gsgCoin)" stroke="#5e3f10"/><path d="M12 7.5l1.2 2.8 3 .3-2.3 2 .7 3-2.6-1.6-2.6 1.6.7-3-2.3-2 3-.3z" fill="#8a5a14"/>';
  return s;
}
export function shardSvg() {
  const s = document.createElementNS(svgNS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'gsg-shard');
  s.innerHTML = '<path d="M12 2l4 7-1.5 13-2.5 1-2.5-1L8 9z" fill="#e8e2d0" stroke="#5c574a" stroke-width=".9"/><path d="M5 10l3-2 .8 9-2.3 1.5zM19 10l-3-2-.8 9 2.3 1.5z" fill="#cfc8b4" stroke="#5c574a" stroke-width=".8"/><path d="M12 4v17" stroke="#6dffb0" stroke-width=".8" opacity=".7"/>';
  return s;
}

// the five stats (plus damage) before -> after
function deltaRows(before, after, { compact = false } = {}) {
  const rows = [];
  const dB = diceAvg(parseDice(before?.weapon?.dice)), dA = diceAvg(parseDice(after?.weapon?.dice));
  for (const k of STAT_KEYS) {
    const a = before?.[k] ?? 0, b = after?.[k] ?? a;
    rows.push(statRow(k, a, b, { compact }));
  }
  if (before?.weapon?.dice || after?.weapon?.dice) {
    const row = statRow('dmg', Math.round(dB + (before?.atk || 0)), Math.round(dA + (after?.atk || 0)), { compact });
    const dt = after?.weapon?.dice || before?.weapon?.dice;
    row.querySelector('.gsg-row-label').append(h('small', ` ${dt}`));
    rows.push(row);
  }
  return rows;
}
function statRow(k, a, b, { compact } = {}) {
  const diff = b - a;
  const dir = diff > 0 ? 'up' : diff < 0 ? 'down' : 'same';
  return h('div.gsg-row', { dataset: { k, dir } },
    h('span.gsg-row-label', compact ? STR.statShort[k] : STR.stat[k]),
    h('span.gsg-row-a', String(a)),
    diff ? h('span.gsg-row-arrow', arrowSvg(dir)) : h('span.gsg-row-arrow.is-same', '·'),
    h('b.gsg-row-b', String(b)),
    diff ? h('span.gsg-row-diff', `${diff > 0 ? '+' : ''}${diff}`) : h('span.gsg-row-diff'));
}

export function compareBlock(ctx, heroId, ref) {
  const hero = typeof heroId === 'object' ? heroId : ctx.state?.hero?.(heroId);
  const d = gearDelta(ctx, hero, ref);
  const curItem = d.cur ? items(ctx)[d.cur.id] : null;
  const verdict = !d.ok ? null : d.wearing ? null : d.gain > 0.25 ? 'up' : d.gain < -0.25 ? 'down' : 'same';
  return h('div.gsg-compare', { dataset: { verdict: verdict || (d.ok ? 'same' : 'no') } },
    h('div.gsg-compare-head',
      heroPortrait(ctx, hero, 44),
      h('div.gsg-compare-who', h('b', firstName(hero)), h('small', STR.wearsNow)),
      h('div.gsg-compare-cur', d.cur ? [itemIcon(ctx, d.cur, 36), h('span', { style: { color: RARITY_COLOR[curItem?.rarity || 'common'] } }, curItem?.name || d.cur.id, d.cur.plus ? ` +${d.cur.plus}` : '')] : h('span.is-none', STR.nothing))),
    !d.ok ? h('div.gsg-compare-no', lockSvg(), h('span', d.why)) : h('div.gsg-compare-rows', deltaRows(d.before, d.after, { compact: true })),
    verdict ? h('div.gsg-compare-verdict', { dataset: { v: verdict } }, verdict === 'up' ? STR.better : verdict === 'down' ? STR.worse : STR.same) : null);
}

export function statPanel(ctx, heroId, { preview = null } = {}) {
  const hero = typeof heroId === 'object' ? heroId : ctx.state?.hero?.(heroId);
  const before = deriveHero(ctx, hero);
  let after = before;
  if (preview) {
    const d = gearDelta(ctx, hero, preview);
    if (d.ok) after = d.after;
  }
  return h('div.gsg-stats', deltaRows(before, after));
}
