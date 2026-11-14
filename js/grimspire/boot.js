// Grimspire boot (GRIMSPIRE.md 3, 5.1, 5.2, 5.10). Default export: async (ctx) => ({ run(ctx) }).
// main.js builds the shared ctx and hands over. This file:
//   - swaps ctx.state for the Grimspire state and ctx.save for one on the pack's save key
//   - loads the other Grimspire modules with guarded imports (rules, loot, battle, gear screens) and keeps a
//     working stand-in for each one that is missing: ctx.gsMods = { rules, loot, battle } (null when missing)
//   - fills any missing content table with a small stand-in so the loop always runs
//   - registers the screens and the two step hooks ('shop' for { loot } and { shop }, 'combat' for { ambush })
//   - runs the loop: title -> difficulty -> hunters -> intro -> camp <-> tower floors -> the top -> Hunt Record
// URL (5.10): ?game=grimspire&auto=1&fast=1&seed=N&party=a,b,c&difficulty=knight&floor=3&level=5&nosave=1
import { createGsState, DEV } from './state.js';
import { createGsHud, ensureGsCss } from './hud.js';
import { gsTitle } from './screens/title.js';
import { gsDifficulty } from './screens/difficulty.js';
import { gsParty } from './screens/party.js';
import { gsIntro } from './screens/intro.js';
import { gsCamp, gsDefeat } from './screens/camp.js';
import { gsTower } from './screens/tower.js';
import { gsEnding, gsRecord } from './screens/record.js';
import { registerStepHooks, eventLoot, autoEquip } from './screens/room.js';
import { standInGear } from './screens/rewards.js';

const ARCHS = ['dragonknight', 'shadow', 'stormmage', 'hunter', 'berserker', 'gravewarden'];

// ---------- guarded module loading ----------
let listing = null;
async function grimFiles() {
  if (listing) return listing;
  listing = (async () => {
    const set = new Set();
    let dev = false;
    try { const r = await fetch('js/main.js', { method: 'HEAD', cache: 'no-store' }); dev = r.ok && r.headers.get('x-lanternfall-listings') === '1'; } catch { dev = false; }
    if (!dev) return null;
    for (const dir of ['js/grimspire/', 'js/grimspire/screens/', 'js/grimspire/content/']) {
      try {
        const r = await fetch(dir, { cache: 'no-store' });
        if (!r.ok) continue;
        const html = await r.text();
        for (const m of html.matchAll(/href="([^"?#]+)"/g)) set.add(dir + decodeURIComponent(m[1]));
      } catch { /* ignore */ }
    }
    return set;
  })();
  return listing;
}
export async function gsImport(path) {
  const files = await grimFiles();
  if (files && !files.has('js/grimspire/' + path)) return null;
  try { return await import('./' + path); } catch (e) { console.error(`[grimspire] ${path} failed to load`, e); return null; }
}

// ---------- stand-in content (only for tables the real content does not have yet) ----------
const FLOOR_NAMES = {
  1: ['The Bone Gate', 'Knogleporten'], 2: ['The Spider Vaults', 'Edderkoppehvælvet'], 3: ['The Molten Forge', 'Smeltesmedjen'],
  4: ['The Frozen Library', 'Det Frosne Bibliotek'], 5: ['The Throne of Bones', 'Bentronen'],
};
const FLOOR_FOES = {
  1: [['gs_bonegrunt', 'Bone Grunt'], ['gs_gravebat', 'Grave Bat'], ['gs_boneshield', 'Shield Skeleton'], ['gs_rattlejaw', 'Rattlejaw the Gatekeeper']],
  2: [['gs_webspinner', 'Webspinner'], ['gs_venomling', 'Venomlings'], ['gs_husk', 'Cocoon Husk'], ['gs_silkfang', 'Queen Silkfang']],
  3: [['gs_cinderimp', 'Cinder Imp'], ['gs_magmahound', 'Magma Hound'], ['gs_ironsentry', 'Iron Sentry'], ['gs_brann', 'Forgemaster Brann']],
  4: [['gs_frostwraith', 'Frost Wraith'], ['gs_cursedtome', 'Cursed Tome'], ['gs_icegargoyle', 'Ice Gargoyle'], ['gs_vex', 'Archivist Vex']],
  5: [['gs_boneknight', 'Bone Knight'], ['gs_shadowstalker', 'Shadow Stalker'], ['gs_crownguard', 'Crown Guard'], ['gs_boneking', 'The Bone King']],
};
function standInContent() {
  const foes = {}, encounters = {}, floors = {}, events = {};
  for (let n = 1; n <= 5; n++) {
    const list = FLOOR_FOES[n];
    list.forEach(([id, name], i) => {
      const boss = i === 3;
      foes[id] = { id, name, art: id, floor: n, boss, base: { hp: boss ? 120 * n : 22 * n, atk: 4 + 2 * n, def: n, spd: 3 + i }, weak: [], resist: [], traits: [], xp: boss ? 60 * n : 12 * n, gold: boss ? [30, 50] : [4, 8], moves: [], lines: {} };
    });
    const [a, b, c, boss] = list.map((x) => x[0]);
    encounters[`f${n}_b1`] = { id: `f${n}_b1`, floor: n, kind: 'battle', bg: `gs_floor${n}`, foes: [{ type: a, min: 1 }, { type: a, min: 3 }] };
    encounters[`f${n}_b2`] = { id: `f${n}_b2`, floor: n, kind: 'battle', bg: `gs_floor${n}`, foes: [{ type: b, min: 1 }, { type: c, min: 2 }] };
    encounters[`f${n}_b3`] = { id: `f${n}_b3`, floor: n, kind: 'battle', bg: `gs_floor${n}`, foes: [{ type: c, min: 1 }, { type: a, min: 2 }, { type: b, min: 4 }] };
    encounters[`f${n}_elite`] = { id: `f${n}_elite`, floor: n, kind: 'elite', bg: `gs_floor${n}`, foes: [{ type: c, min: 1 }, { type: c, min: 2 }, { type: b, min: 3 }] };
    encounters[`f${n}_boss`] = { id: `f${n}_boss`, floor: n, kind: 'boss', bg: `gs_floor${n}`, foes: [{ type: boss, min: 1 }] };
    events[`f${n}_e1`] = { id: `f${n}_e1`, title: 'A cold draught', steps: [
      { say: 'Something moves behind the wall. A loose stone, a gap, and a glint of metal.', mood: 'ominous' },
      { choice: { prompt: 'What do you do?', options: [
        { label: 'Reach in and grab it', steps: [{ loot: { roll: true, bonus: 0 } }] },
        { label: 'Leave it and move on', steps: [{ say: 'Wise, maybe. We will never know.', mood: 'dry' }] },
      ] } }] };
    events[`f${n}_e2`] = { id: `f${n}_e2`, title: 'Bones on the floor', steps: [
      { say: 'A heap of old bones. One of them twitches.', mood: 'ominous' },
      { ambush: `f${n}_b1` },
      { gold: 10 }] };
    const R = (id, kind, x, y, next, extra = {}) => ({ id, kind, x, y, next, ...extra });
    floors[n] = {
      n, name: FLOOR_NAMES[n][0], sub: `Floor ${n}`, bg: `gs_floor${n}`, music: n <= 2 ? 'gs_explore_a' : n <= 4 ? 'gs_explore_b' : 'gs_explore_c',
      map: { rooms: [
        R('r1', 'battle', 150, 560, ['r2'], { encounter: `f${n}_b1` }),
        R('r2', 'event', 330, 470, ['r3'], { event: `f${n}_e1` }),
        R('r3', 'battle', 510, 560, ['r4a', 'r4b'], { encounter: `f${n}_b2` }),
        R('r4a', 'elite', 690, 420, ['r5'], { encounter: `f${n}_elite` }),
        R('r4b', 'rest', 690, 640, ['r5']),
        R('r5', 'event', 880, 530, ['r6'], { event: `f${n}_e2` }),
        R('r6', 'boss', 1090, 470, [], { encounter: `f${n}_boss` }),
      ] },
      intro: [{ say: 'Another floor. Keep your blades up and your eyes open.', mood: 'ominous' }],
      cleared: [{ say: 'The floor is yours. Back to the fire for now.', mood: 'excited' }],
      huntAgain: [`f${n}_b1`, `f${n}_b2`, `f${n}_b3`], loot: {},
    };
  }
  const boons = {
    gs_boon_hp: { id: 'gs_boon_hp', name: 'Iron Hide', text: '+10% Health for every hunter.', effect: { hpPct: 10 } },
    gs_boon_fury: { id: 'gs_boon_fury', name: 'Battle Hunger', text: 'Every hunter starts battles with +1 Fury.', effect: { furyStart: 1 } },
    gs_boon_atk: { id: 'gs_boon_atk', name: 'Whetstone', text: '+2 Attack for every hunter.', effect: { atk: 2 } },
    gs_boon_def: { id: 'gs_boon_def', name: 'Shield Wall', text: '+2 Defence for every hunter.', effect: { def: 2 } },
  };
  const story = {
    intro: [
      { say: 'Sit. Sharpen something. Tonight we climb.', mood: 'fierce' },
      { say: 'Up on the cliff stands Grimspire. At the top sits the Bone King, and on his skull a crown that will not let the dead rest.', mood: 'ominous' },
      { bg: 'gs_camp' },
      { say: 'This is the Last Hearth. Hilda forges, Sod steals, and I tell you what is coming. Five floors. One crown.', mood: 'warm' },
    ],
    camp: { firstVisit: [], fire: [[{ say: 'Rest. The tower is not going anywhere. Sadly.', mood: 'dry' }]] },
    ending: { smash: [{ say: 'The crown shatters into green sparks. The tower falls silent.', mood: 'grand' }], forge: [{ say: 'Hilda melts it down. It screams a little. Then it is only iron.', mood: 'grand' }] },
  };
  return { foes, encounters, floors, events, boons, story, lines: {}, npcs: {}, shops: {} };
}

function fillContent(ctx) {
  const c = ctx.content || (ctx.content = {});
  const si = standInContent();
  const missing = [];
  for (const k of ['foes', 'encounters', 'floors', 'events', 'boons', 'story', 'lines', 'npcs', 'shops']) {
    const empty = !c[k] || (typeof c[k] === 'object' && !Object.keys(c[k]).length);
    if (empty) { c[k] = si[k]; if (!['lines', 'npcs', 'shops'].includes(k)) missing.push(k); }
  }
  if (!c.heroes || !Object.keys(c.heroes).length) {
    missing.push('heroes');
    c.heroes = {};
    const B = { dragonknight: [46, 9, 5, 4, 3, 1, 'sword', 'Kaelen Ashblade'], shadow: [32, 6, 6, 1, 7, 4, 'daggers', 'Nyx Nightstep'], stormmage: [28, 5, 7, 1, 4, 2, 'staff', 'Zarek Stormcaller'],
      hunter: [34, 6, 6, 2, 6, 3, 'bow', 'Brynja Wolfbow'], berserker: [42, 8, 7, 2, 4, 1, 'axes', 'Torvald Twin-Axe'], gravewarden: [36, 7, 4, 3, 5, 2, 'scythe', 'Morwen Gravewarden'] };
    for (const [arch, [hp, hpPer, atk, def, spd, luck, family, name]] of Object.entries(B)) {
      c.heroes[arch] = { arch, name, role: '', blurb: '', family, base: { hp, hpPer, atk, def, spd, luck }, knacks: { might: 1, agility: 1, wits: 1, heart: 1 }, skills: [], intro: '', startGear: {} };
    }
  }
  if (!c.items) c.items = {};
  if (!c.npcs.gm) c.npcs.gm = { id: 'gm', name: 'Varg', title: 'the Battle-Skald' };
  if (!c.gmLines) c.gmLines = c.lines; // the narrator's pools (gm.react / gm.line)
  if (!c.scenes) c.scenes = {};        // synthetic scenes for the shared step interpreter (room.js runSteps)
  if (missing.length) console.info('[grimspire] stand-in content for:', missing.join(', '));
  return missing;
}

// ---------- save on the pack's key ----------
function createGsSave(ctx) {
  const key = ctx.pack?.saveKey || 'grimspire.save.v1';
  const disabled = !!ctx.params?.nosave;
  const store = (() => { try { localStorage.setItem('__gs_probe', '1'); localStorage.removeItem('__gs_probe'); return localStorage; } catch { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; } })();
  return {
    key,
    write(state) {
      if (disabled) return;
      try { const d = typeof state?.data === 'function' ? state.data() : state; store.setItem(key, JSON.stringify(d)); } catch (e) { console.warn('[gs-save] write failed', e); }
    },
    load() {
      try { const raw = store.getItem(key); if (!raw) return null; const d = JSON.parse(raw); return d && d.v === 1 && d.pack === 'grimspire' && d.party?.length ? d : null; } catch { return null; }
    },
    clear() { if (disabled) return; try { store.removeItem(key); } catch { /* ignore */ } },
    exists() { return !!this.load(); },
  };
}

// ---------- quick start: &party= &difficulty= &floor= &level= ----------
function quickParty(ctx) {
  const want = String(ctx.params?.party || new URLSearchParams(location.search).get('party') || '').split(',').map((s) => s.trim()).filter((a) => ctx.content.heroes[a]);
  return want.length ? want.slice(0, 4) : ['dragonknight', 'shadow', 'gravewarden'];
}
export function applyKit(ctx, floor, level) {
  const st = ctx.state;
  const R = ctx.gsMods.rules;
  let kit = null;
  if (R?.kitFor) { try { kit = R.kitFor({ floor, level, party: st.party.map((h) => h.arch), content: ctx.content }); } catch (e) { console.error('[grimspire] kitFor threw', e); } }
  if (!kit) kit = { level: level || [1, 1, 3, 4, 6, 7][floor] || 1, gold: 40 * floor, shards: 4 * floor, gear: {}, plus: {}, bag: [], boons: [] };
  const lv = Math.max(1, Math.min(8, kit.level || level || 1));
  st.level = lv;
  st.xp = st.xpFor(lv);
  st.gold = kit.gold || 0;
  st.shards = kit.shards || 0;
  for (const b of kit.boons || []) if (!st.boons.includes(b)) st.boons.push(b);
  for (const h of st.party) {
    const g = kit.gear?.[h.arch] || {};
    for (const slot of ['weapon', 'armour', 'helm', 'charm']) {
      const id = g[slot];
      if (!id || !ctx.content.items[id]) continue;
      const inst = st.addItem(id, { plus: kit.plus?.[h.arch]?.[slot] || 0 });
      st.equip(h.id, inst.uid);
    }
  }
  for (const id of kit.bag || []) if (ctx.content.items[id]) st.addItem(id);
  for (let n = 1; n < floor; n++) { st.floor(n).unlocked = true; st.floor(n).cleared = true; }
  st.floor(floor).unlocked = true;
  for (const h of st.party) st.refreshHero(h.id);
  st.fullHeal();
}

// ---------- stand-in screens until gs-gear's land ----------
function registerStandIns(ctx) {
  const g = standInGear(ctx);
  for (const [name, fn] of Object.entries(g)) ctx.screens.register(name, fn);
}

export default async function bootGrimspire(ctx) {
  await ensureGsCss();
  document.documentElement.classList.add('theme-gs');
  document.documentElement.dataset.pack = 'grimspire';
  try { document.title = 'Grimspire: Crown of the Bone King'; } catch { /* ignore */ }

  const [rules, loot, battle, armoury] = await Promise.all([gsImport('rules.js'), gsImport('loot.js'), gsImport('battle.js'), gsImport('screens/armoury.js')]);
  ctx.gsRules = rules || null;
  ctx.gsMods = { rules: rules || null, loot: loot || null, battle: battle || null, gear: !!armoury?.registerGear };
  const missingContent = fillContent(ctx);
  ctx.gsMissing = { content: missingContent, rules: !rules, loot: !loot, battle: !battle, gear: !armoury?.registerGear };

  ctx.state = createGsState(ctx);
  if (window.__LF) window.__LF.state = ctx.state;
  ctx.save = createGsSave(ctx);
  ctx.gsDev = DEV;

  // the old HUD (if main.js made one) steps aside; Grimspire brings its own
  try { ctx.hud?.el?.remove?.(); } catch { /* ignore */ }
  ctx.hud = createGsHud(ctx);

  registerStandIns(ctx);
  if (armoury?.registerGear) { try { armoury.registerGear(ctx); } catch (e) { console.error('[grimspire] registerGear threw; keeping stand-ins', e); } }
  registerStepHooks(ctx);
  ctx.gsEventLoot = eventLoot;

  return { run };
}

function savePoint(ctx) { ctx.save.write(ctx.state); }

async function run(ctx) {
  const P = new URLSearchParams(location.search);
  const auto = !!ctx.auto;
  const floorParam = Number(P.get('floor')) || 0;
  const levelParam = Number(P.get('level')) || 0;
  const diffParam = ['squire', 'knight', 'legend'].includes(P.get('difficulty')) ? P.get('difficulty') : null;

  for (;;) {
    let resumed = false;
    if (auto || floorParam) {
      ctx.state.reset(ctx.rng.seed);
      if (auto) { await gsTitle(ctx, { autoPick: 'new' }); }
      ctx.state.difficulty = diffParam || 'knight';
      ctx.state.setParty(quickParty(ctx));
      if (floorParam || levelParam) applyKit(ctx, Math.max(1, Math.min(5, floorParam || 1)), levelParam);
      autoEquip(ctx);
    } else {
      const choice = await gsTitle(ctx);
      const data = choice === 'continue' ? ctx.save.load() : null;
      if (data) { ctx.state.load(data); resumed = true; }
      else {
        ctx.state.reset(ctx.rng.seed);
        ctx.state.difficulty = await gsDifficulty(ctx, { current: diffParam || 'knight' });
        await gsParty(ctx);
        if (!ctx.state.party.length) ctx.state.setParty(['dragonknight']);
        await gsIntro(ctx);
      }
    }
    savePoint(ctx);

    // camp <-> tower until the crown falls
    let welcome = resumed ? 'back' : 'first';
    if (resumed && ctx.state.where && ctx.state.where !== 'camp' && ctx.state.where.floor) {
      const r = await gsTower(ctx, ctx.state.where.floor, { resumed: true });
      welcome = r === 'defeat' ? 'defeat' : 'return';
      if (r === 'final') { await finish(ctx); if (auto) return; continue; }
      if (r === 'defeat') await gsDefeat(ctx);
    }
    let final = false;
    for (let guard = 0; guard < 400 && !final; guard++) {
      ctx.state.where = 'camp';
      savePoint(ctx);
      const go = await gsCamp(ctx, { welcome });
      if (go?.go === 'title') break;
      if (go?.go !== 'floor') { welcome = 'return'; continue; }
      const r = await gsTower(ctx, go.floor, { hunt: !!go.hunt });
      if (r === 'final') final = true;
      else if (r === 'defeat') { await gsDefeat(ctx); welcome = 'defeat'; if (ctx.auto) ctx.gsGrind = (ctx.gsGrind || 0) + 1; }
      else welcome = r === 'cleared' ? 'cleared' : 'return';
    }
    if (!final) { if (auto) { console.error('[grimspire] autoplay gave up before the top'); return; } continue; }
    await finish(ctx);
    if (auto) return;
  }
}

async function finish(ctx) {
  await gsEnding(ctx);
  ctx.state.finishedMs = ctx.state.playMs || 1;
  ctx.save.clear();
  await gsRecord(ctx);
}

export { ARCHS };
