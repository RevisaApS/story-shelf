// Grimspire content (GRIMSPIRE.md 5.4, 5.5). Owner: gs-content-b.
// Default export: { id, heroes, foes, encounters, floors, boons, items, events, lines, npcs, shops, story,
//   startScene: null, textFields }. `textFields` sits on the content object too, so core's walkText / localize
//   find it when they are called without options (cloneDeep copies the function by reference).
// Named exports: textFields(content, visit), voiceLines(content), POOL_VOICE.
//
// Every file is loaded with a clear error naming it, so a missing or broken file says which one.
//
// ---------------------------------------------------------------------------------------------------------
// WHO SPEAKS WHAT, WITH WHICH MOOD (voice ids hash speaker | mood | text, so these must match the callers).
// Agreed by message on 2026-11-11 with gs-battle (battle), gs-meta (rooms, camp, rewards, steps) and gs-gear
// (loot, armoury, forge).
//   Steps (story, events, floors intro / cleared): screens/scene.js rules: a plain string is ('gm', 'warm');
//     { say, as, mood } is (as || 'gm', mood || 'warm').
//   Line arrays on heroes, foes, encounters: a plain string is Varg ('gm') with the mood below; an object
//     { say, as, mood? } is spoken by `as` (gs_boneking, gs_crown) with mood || 'cold'.
//   heroes[arch].intro                     gm grand  (party screen)
//   heroes strike.lines.perfect / good     gm fierce;  strike.lines.weak  gm dry
//   heroes skills[].lines.use              gm fierce
//   foes lines.enter, phases[].lines       ominous;  lines.defeat, lines.weakHint, moves[].lines.intent  fierce
//   encounters intro                       ominous;  encounters win  excited
//   pools in lines.js: POOL_VOICE below. Hilda's forge.* pools are speaker gs_hilda, mood warm.
//   shops.sod greeting / bye               gs_sod funny
//   title.* pools are UI text on the Hunt Record (not spoken).
// Moods in use: warm hush excited ominous funny sad grand fierce cold dry (tools/voice-build.mjs MOODS).
// ---------------------------------------------------------------------------------------------------------

async function load(file) {
  try {
    const m = await import(file);
    if (!m || m.default == null) throw new Error('it has no default export');
    return m;
  } catch (e) {
    throw new Error(`Grimspire content: ${file.replace('./', 'game/js/grimspire/content/')} failed to load: ${e && e.message}`);
  }
}

const [heroesM, foesM, encountersM, floorsM, boonsM, itemsM, eventsM, linesM, npcsM, storyM] = await Promise.all([
  load('./heroes.js'), load('./foes.js'), load('./encounters.js'), load('./floors.js'), load('./boons.js'),
  load('./items.js'), load('./events.js'), load('./lines.js'), load('./npcs.js'), load('./story.js'),
]);

// [speaker, mood, ttsMood?] per pool key. ttsMood only steers the performance (never the id).
export const POOL_VOICE = {
  // battle (gs-battle)
  'battle.start': ['gm', 'fierce'], 'battle.boss': ['gm', 'fierce'],
  'strike.perfect': ['gm', 'fierce'], 'strike.good': ['gm', 'fierce'], 'strike.weak': ['gm', 'dry'],
  'strike.crit': ['gm', 'fierce'], 'strike.weakpoint': ['gm', 'fierce'], 'strike.resisted': ['gm', 'fierce'],
  'strike.dodged': ['gm', 'fierce'], 'guard.broken': ['gm', 'fierce'],
  'block.perfect': ['gm', 'fierce'], 'block.good': ['gm', 'fierce'], 'block.miss': ['gm', 'dry'],
  'foe.big': ['gm', 'ominous'], 'hero.down': ['gm', 'fierce'], 'hero.lowHp': ['gm', 'fierce'], 'fury.full': ['gm', 'fierce'],
  'battle.win': ['gm', 'excited'], 'battle.lose': ['gm', 'warm'],
  'teach.strike': ['gm', 'warm'], 'teach.block': ['gm', 'warm'], 'teach.fury': ['gm', 'warm'], 'teach.weak': ['gm', 'warm'],
  // loot, armoury, forge (gs-gear)
  'loot.common': ['gm', 'fierce'], 'loot.rare': ['gm', 'fierce'], 'loot.epic': ['gm', 'fierce'], 'loot.legendary': ['gm', 'fierce'],
  'equip.better': ['gm', 'warm'], 'forge.upgrade': ['gm', 'excited'], 'teach.gear': ['gm', 'warm'],
  'forge.greet': ['gs_hilda', 'warm'], 'forge.buy': ['gs_hilda', 'warm'], 'forge.sell': ['gs_hilda', 'warm'],
  'forge.upgrade.hilda': ['gs_hilda', 'warm'], 'forge.short': ['gs_hilda', 'warm'], 'forge.bye': ['gs_hilda', 'warm'],
  // camp, rooms, rewards (gs-meta)
  'levelup': ['gm', 'excited'], 'camp.rest': ['gm', 'hush'], 'floor.cleared': ['gm', 'excited'], 'hunt.again': ['gm', 'fierce'],
  'record.intro': ['gm', 'grand'], 'camp.welcome': ['gm', 'warm'], 'camp.gate': ['gm', 'ominous'], 'rest.room': ['gm', 'hush'],
  'defeat.dragged': ['gm', 'warm'], 'welcome.back': ['gm', 'warm'], 'difficulty.pick': ['gm', 'warm'], 'party.ask': ['gm', 'warm'],
  'party.ready': ['gm', 'fierce'], 'boon.pick': ['gm', 'warm'], 'tower.back': ['gm', 'warm'],
  // shared engine (systems/check.js, the skill mini-games, gm/director.js): gm.react / gm.aside default ('gm','warm')
  'roll.ask': ['gm', 'warm', 'excited'], 'roll.crit': ['gm', 'warm', 'excited'], 'roll.success': ['gm', 'warm', 'excited'],
  'roll.partial': ['gm', 'warm'], 'roll.fail': ['gm', 'warm', 'funny'], 'roll.fumble': ['gm', 'warm', 'funny'],
  'reroll.offer': ['gm', 'warm'], 'mercy.check': ['gm', 'warm'], 'mercy.battle': ['gm', 'warm'], 'teach.check': ['gm', 'warm'],
  'idle.nudge': ['gm', 'warm', 'hush'], 'rest.intro': ['gm', 'warm', 'hush'], 'levelup.intro': ['gm', 'warm', 'excited'],
};
export const UI_POOLS = /^title\./;

const content = {
  id: 'grimspire',
  heroes: heroesM.default, foes: foesM.default, encounters: encountersM.default, floors: floorsM.default,
  boons: boonsM.default, items: itemsM.default, events: eventsM.default, lines: linesM.default,
  npcs: npcsM.default, shops: npcsM.shops || {}, story: storyM.default,
  startScene: null,
};

// ---------------------------------------------------------------------------------------------- textFields
// visit(text, info) for every player-facing string; a returned string replaces it (ROUND2 2.1 walkText contract).
// info = { kind: 'spoken'|'ui', where, field, speaker?, mood?, pool?, tts? }

export function textFields(c, visit) {
  if (!c || typeof visit !== 'function') return;
  const f = (obj, key, info) => {
    if (!obj || typeof obj[key] !== 'string' || !obj[key].trim()) return;
    const r = visit(obj[key], info);
    if (typeof r === 'string') obj[key] = r;
  };
  const ui = (where, field) => ({ kind: 'ui', where, field });
  const spoken = (where, field, speaker = 'gm', mood = 'warm', extra = {}) => ({ kind: 'spoken', where, field, speaker, mood, ...extra });

  // A line array on heroes / foes / encounters: strings are Varg with `mood`; { say, as, mood? } objects their own voice.
  const lineList = (arr, where, field, mood, pool) => {
    if (typeof arr === 'string') return; // never expected; arrays only
    if (!Array.isArray(arr)) return;
    arr.forEach((l, i) => {
      if (typeof l === 'string') f(arr, i, spoken(where, field, 'gm', mood, { pool, tts: mood }));
      else if (l && typeof l === 'object' && typeof l.say === 'string') {
        const sp = l.as || 'gm';
        const md = l.mood || (sp === 'gm' ? mood : 'cold');
        f(l, 'say', spoken(where, field, sp, md, { pool, tts: md }));
      }
    });
  };

  // SPEC 8.2 steps (as screens/scene.js speaks them)
  const OUT = ['success', 'fail', 'crit', 'fumble', 'partial'];
  const branch = (parent, key, where) => {
    const v = parent?.[key];
    if (v == null) return;
    if (typeof v === 'string') f(parent, key, spoken(where, 'line'));
    else if (Array.isArray(v)) steps(v, where);
    else if (typeof v === 'object') step(v, where);
  };
  const steps = (list, where) => {
    if (!Array.isArray(list)) return;
    list.forEach((st, i) => {
      if (typeof st === 'string') f(list, i, spoken(where, 'line', 'gm', 'warm'));
      else if (Array.isArray(st)) steps(st, where);
      else if (st && typeof st === 'object') step(st, where);
    });
  };
  function step(st, where) {
    if ('say' in st) f(st, 'say', spoken(where, 'say', st.as || 'gm', st.mood || 'warm', { tts: st.mood || 'warm' }));
    if (st.card && typeof st.card === 'object') { f(st.card, 'kicker', ui(where, 'card.kicker')); f(st.card, 'title', ui(where, 'card.title')); f(st.card, 'sub', ui(where, 'card.sub')); }
    if (st.choice && typeof st.choice === 'object') {
      f(st.choice, 'prompt', ui(where, 'choice.prompt'));
      for (const o of st.choice.options || []) {
        if (!o) continue;
        f(o, 'label', ui(where, 'option.label'));
        f(o, 'hint', ui(where, 'option.hint'));
        branch(o, 'steps', where);
      }
    }
    for (const kind of ['check', 'skill']) {
      const k = st[kind];
      if (!k || typeof k !== 'object') continue;
      f(k, 'label', ui(where, `${kind}.label`));
      for (const o of OUT) branch(k, o, where);
    }
    if ('if' in st) { branch(st, 'then', where); branch(st, 'else', where); }
    if ('journal' in st) f(st, 'journal', ui(where, 'journal'));
    if (st.quest && typeof st.quest === 'object') { f(st.quest, 'title', ui(where, 'quest.title')); f(st.quest, 'text', ui(where, 'quest.text')); }
  }

  // ---- story (in play order)
  const s = c.story || {};
  steps(s.intro, 'story.intro');
  steps(s.camp?.firstVisit, 'story.camp.firstVisit');
  (s.camp?.fire || []).forEach((talk, i) => steps(talk, `story.camp.fire.${i}`));

  // ---- heroes
  for (const [arch, h] of Object.entries(c.heroes || {})) {
    if (!h) continue;
    const where = `heroes.${arch}`;
    f(h, 'name', ui(where, 'hero.name'));
    f(h, 'role', ui(where, 'hero.role'));
    f(h, 'blurb', ui(where, 'hero.blurb'));
    f(h, 'intro', spoken(where, 'hero.intro', 'gm', 'grand', { pool: `hero.${arch}.intro`, tts: 'grand' }));
    if (h.strike) {
      f(h.strike, 'name', ui(where, 'strike.name'));
      f(h.strike, 'text', ui(where, 'strike.text'));
      for (const k of Object.keys(h.strike.lines || {})) lineList(h.strike.lines[k], where, `strike.${k}`, k === 'weak' ? 'dry' : 'fierce', `hero.${arch}.${k}`);
    }
    for (const sk of h.skills || []) {
      if (!sk) continue;
      f(sk, 'name', ui(where, 'skill.name'));
      f(sk, 'text', ui(where, 'skill.text'));
      for (const k of Object.keys(sk.lines || {})) lineList(sk.lines[k], where, `skill.${k}`, 'fierce', `hero.${arch}.${sk.id}.${k}`);
    }
  }

  // ---- foes
  for (const [id, fo] of Object.entries(c.foes || {})) {
    if (!fo) continue;
    const where = `foes.${id}`;
    f(fo, 'name', ui(where, 'foe.name'));
    f(fo, 'plural', ui(where, 'foe.plural'));
    const moveList = (moves, w) => {
      for (const m of moves || []) {
        if (!m) continue;
        f(m, 'name', ui(w, 'move.name'));
        for (const k of Object.keys(m.lines || {})) lineList(m.lines[k], w, `move.${k}`, 'fierce', `foe.${id}.${k}`);
      }
    };
    moveList(fo.moves, where);
    for (const ph of fo.phases || []) {
      if (!ph) continue;
      lineList(ph.lines, where, 'phase', 'ominous', `foe.${id}.phase`);
      moveList(ph.moves, where);
    }
    for (const k of Object.keys(fo.lines || {})) lineList(fo.lines[k], where, `foe.${k}`, k === 'enter' ? 'ominous' : 'fierce', `foe.${id}.${k}`);
  }

  // ---- encounters
  for (const [id, e] of Object.entries(c.encounters || {})) {
    if (!e) continue;
    const where = `encounters.${id}`;
    f(e, 'title', ui(where, 'encounter.title'));
    for (const fo of e.foes || []) if (fo) f(fo, 'name', ui(where, 'foe.name'));
    lineList(e.intro, where, 'encounter.intro', 'ominous', `encounter.${id}.intro`);
    lineList(e.win, where, 'encounter.win', 'excited', `encounter.${id}.win`);
  }

  // ---- floors
  for (const [n, fl] of Object.entries(c.floors || {})) {
    if (!fl) continue;
    const where = `floors.${n}`;
    f(fl, 'name', ui(where, 'floor.name'));
    f(fl, 'sub', ui(where, 'floor.sub'));
    for (const r of fl.map?.rooms || []) if (r) { f(r, 'label', ui(where, 'room.label')); f(r, 'name', ui(where, 'room.name')); }
    steps(fl.intro, `${where}.intro`);
    steps(fl.cleared, `${where}.cleared`);
  }

  // ---- events
  for (const [id, ev] of Object.entries(c.events || {})) {
    if (!ev) continue;
    f(ev, 'title', ui(`events.${id}`, 'event.title'));
    steps(ev.steps, `events.${id}`);
  }

  // ---- boons, items, npcs, shops
  for (const [id, b] of Object.entries(c.boons || {})) {
    if (!b) continue;
    f(b, 'name', ui(`boons.${id}`, 'boon.name'));
    f(b, 'text', ui(`boons.${id}`, 'boon.text'));
  }
  for (const [id, it] of Object.entries(c.items || {})) {
    if (!it) continue;
    f(it, 'name', ui(`items.${id}`, 'item.name'));
    f(it, 'text', ui(`items.${id}`, 'item.text'));
    for (const t of it.traits || []) if (t) f(t, 'text', ui(`items.${id}`, 'trait.text'));
  }
  for (const [id, n] of Object.entries(c.npcs || {})) {
    if (!n) continue;
    f(n, 'name', ui(`npcs.${id}`, 'npc.name'));
    f(n, 'title', ui(`npcs.${id}`, 'npc.title'));
  }
  for (const [id, sh] of Object.entries(c.shops || {})) {
    if (!sh) continue;
    const info = spoken(`shops.${id}`, 'shop.line', sh.keeper || 'gm', 'funny', { pool: `shop.${id}`, tts: 'funny' });
    for (const k of ['greeting', 'bye']) if (Array.isArray(sh[k])) sh[k].forEach((_, i) => f(sh[k], i, info));
  }

  // ---- pools (Varg, Hilda, the shared engine; title.* are UI)
  for (const key of Object.keys(c.lines || {})) {
    const arr = c.lines[key];
    if (!Array.isArray(arr)) continue;
    if (UI_POOLS.test(key)) { arr.forEach((_, i) => f(arr, i, ui(`lines.${key}`, 'title'))); continue; }
    const [speaker, mood, tts] = POOL_VOICE[key] || ['gm', 'warm'];
    arr.forEach((_, i) => f(arr, i, spoken(`lines.${key}`, 'pool', speaker, mood, { pool: key, tts: tts || mood })));
  }

  // ---- endings last (story order)
  steps(s.ending?.smash, 'story.ending.smash');
  steps(s.ending?.forge, 'story.ending.forge');
}

// ---------------------------------------------------------------------------------------------- voiceLines
// Every spoken line once: [ { speaker, mood, ttsMood, text, source } ], deduplicated by speaker | mood | text.
export function voiceLines(c) {
  const out = new Map();
  textFields(c, (text, info) => {
    if (info.kind !== 'spoken') return undefined;
    const t = String(text).replace(/\s+/g, ' ').trim();
    const key = `${info.speaker}|${info.mood}|${t}`;
    if (!out.has(key)) out.set(key, { speaker: info.speaker, mood: info.mood, ttsMood: info.tts || info.mood, text: t, source: info.where });
    return undefined;
  });
  return [...out.values()];
}

content.textFields = textFields;

export default content;
