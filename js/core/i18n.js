// Languages (ROUND2 2.1). English is the source; Danish is a full translation. Works in the browser and in Node.
//
//   LANGS                         ['en', 'da']
//   getLang() / setLang(lang)     module-level language. In the browser it starts as detectLang() (so modules that
//                                 are evaluated before boot already read the right language); main.js sets it once.
//   detectLang(settings?)         ?lang= , else settings.lang (or the saved settings), else 'da' when the browser
//                                 language starts with da, else 'en'
//   L({ en: {...}, da: {...} })   an object whose keys read table[lang][k] ?? table.en[k] at access time (lazy, so the
//                                 language can be set after the module is evaluated). Values may be functions.
//                                 Nested plain objects fall back key by key too.
//   tr({ en, da }) -> string      pick one value for the current language (pack titles, labels)
//   walkText(content, visit, { textFields }?)
//                                 calls visit(text, info) for EVERY player-facing string in a Lanternfall-schema
//                                 content object; when visit returns a string it replaces the text in place.
//                                 info = { kind: 'spoken'|'ui', where, field, speaker?, mood?, pool?, tts? }
//                                   where   'scenes.village_square' | 'heroes.knight' | 'gmLines.roll.crit' | ...
//                                   field   what the string is: 'line', 'say', 'option.label', 'check.label', ...
//                                   speaker, mood   (spoken) exactly what the game passes to voiceId()
//                                   pool    (spoken pool lines) the key tools/voice-build.mjs picks a TTS mood by,
//                                           e.g. 'roll.crit', 'hero.knight.hit', 'enemy.gloop.enter'
//                                   tts     (a few fixed kinds) the TTS performance mood voice-build uses
//                                 A pack with its own schema passes its content module's textFields(content, visit)
//                                 as opts.textFields (or sets content.textFields); walkText then calls that instead.
//                                 Never touches ids, flags, stats, art ids, npc.voice, ttsVoice or befriend.verb.
//   localize(content, dict, opts?) -> deep copy of content with every text replaced by dict[normText(text)] when
//                                 that entry is a non-empty string (functions are copied by reference)
//   normText(text)                whitespace collapsed and trimmed (the dictionary key; same as voiceid.js)
import { normText } from './voiceid.js';

export { normText };
export const LANGS = ['en', 'da'];
export const SETTINGS_KEY = 'lanternfall.settings.v1';

const valid = (l) => (LANGS.includes(l) ? l : null);

export function detectLang(settings = null) {
  if (typeof window === 'undefined') return 'en';
  try {
    const q = valid(new URLSearchParams(window.location.search).get('lang'));
    if (q) return q;
  } catch { /* ignore */ }
  let s = settings;
  if (!s) { try { s = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || '{}'); } catch { s = null; } }
  if (valid(s?.lang)) return s.lang;
  try { if (/^da\b/i.test(navigator.language || '')) return 'da'; } catch { /* ignore */ }
  return 'en';
}

let lang = detectLang();

export function getLang() { return lang; }
export function setLang(l) {
  lang = valid(l) || 'en';
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  return lang;
}

const isPlain = (v) => v != null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

export function L(table = {}) {
  const en = table.en || {};
  const out = {};
  const keys = new Set();
  for (const l of LANGS) for (const k of Object.keys(table[l] || {})) keys.add(k);
  const nested = new Map();
  for (const k of keys) {
    Object.defineProperty(out, k, {
      enumerable: true,
      get() {
        const cur = table[lang] || {};
        const v = cur[k];
        const fb = en[k];
        if (isPlain(v) || isPlain(fb)) {
          if (!nested.has(k)) {
            const t = {};
            for (const l of LANGS) t[l] = isPlain(table[l]?.[k]) ? table[l][k] : {};
            nested.set(k, L(t));
          }
          return nested.get(k);
        }
        return v ?? fb;
      },
    });
  }
  return out;
}

export function tr(v) {
  if (v == null || typeof v !== 'object') return v;
  return v[lang] ?? v.en ?? Object.values(v)[0];
}

// ------------------------------------------------------------------------------------------------ walkText

export function walkText(content, visit, opts = {}) {
  if (!content || typeof visit !== 'function') return;
  const custom = opts.textFields || (typeof content.textFields === 'function' ? content.textFields : null);
  if (custom) { custom(content, visit); return; }

  // one string field of an object
  const f = (obj, key, info) => {
    if (!obj || typeof obj[key] !== 'string' || !obj[key].trim()) return;
    const r = visit(obj[key], info);
    if (typeof r === 'string') obj[key] = r;
  };
  // a list of spoken lines (strings, or { say | text } objects)
  const lines = (obj, key, info) => {
    if (!obj) return;
    const v = obj[key];
    if (typeof v === 'string') { f(obj, key, info); return; }
    if (!Array.isArray(v)) return;
    v.forEach((l, i) => {
      if (typeof l === 'string') f(v, i, info);
      else if (l && typeof l === 'object') {
        if (typeof l.say === 'string') f(l, 'say', info);
        else f(l, 'text', info);
      }
    });
  };
  const spoken = (where, field, speaker = 'gm', mood = 'warm', extra = {}) => ({ kind: 'spoken', where, field, speaker, mood, ...extra });
  const ui = (where, field) => ({ kind: 'ui', where, field });

  // a branch: a step list, a single step, or a single spoken string, held at parent[key]
  const branch = (parent, key, where) => {
    const v = parent?.[key];
    if (v == null) return;
    if (typeof v === 'string') { f(parent, key, spoken(where, 'line')); return; }
    if (Array.isArray(v)) { stepList(v, where); return; }
    if (typeof v === 'object') step(v, where);
  };
  const stepList = (list, where) => {
    list.forEach((st, i) => {
      if (typeof st === 'string') f(list, i, spoken(where, 'line'));
      else if (Array.isArray(st)) stepList(st, where);
      else if (st && typeof st === 'object') step(st, where);
    });
  };
  const OUTCOMES = ['success', 'fail', 'crit', 'fumble', 'partial'];

  function step(st, where) {
    if ('say' in st) f(st, 'say', spoken(where, 'say', st.as || 'gm', st.mood || 'warm'));
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
      const c = st[kind];
      if (!c || typeof c !== 'object') continue;
      f(c, 'label', ui(where, `${kind}.label`));
      for (const k of OUTCOMES) branch(c, k, where);
    }
    if (st.challenge && typeof st.challenge === 'object') {
      const c = st.challenge;
      f(c, 'title', ui(where, 'challenge.title'));
      lines(c, 'intro', spoken(where, 'challenge.intro'));
      for (const t of c.turns || []) {
        if (!t) continue;
        f(t, 'label', ui(where, 'challenge.turn'));
        f(t, 'win', spoken(where, 'challenge.win', 'gm', 'excited'));
        f(t, 'lose', spoken(where, 'challenge.lose', 'gm', 'funny'));
      }
      branch(c, 'success', where); branch(c, 'fail', where);
    }
    if ('combat' in st) { branch(st, 'win', where); branch(st, 'befriend', where); branch(st, 'lose', where); }
    if ('puzzle' in st) { branch(st, 'success', where); branch(st, 'fail', where); }
    if (st.hub && typeof st.hub === 'object') {
      const hb = st.hub;
      f(hb, 'prompt', ui(where, 'hub.prompt'));
      for (const s of hb.spots || []) { if (!s) continue; f(s, 'label', ui(where, 'hub.spot')); branch(s, 'steps', where); }
      if (hb.leave) {
        f(hb.leave, 'label', ui(where, 'hub.leave'));
        f(hb.leave, 'lockedHint', spoken(where, 'hub.lockedHint'));
        branch(hb.leave, 'steps', where);
      }
    }
    if ('if' in st) { branch(st, 'then', where); branch(st, 'else', where); }
    if ('star' in st) f(st, 'why', ui(where, 'star.why'));
    if (st.quest && typeof st.quest === 'object') { f(st.quest, 'title', ui(where, 'quest.title')); f(st.quest, 'text', ui(where, 'quest.text')); }
    if ('journal' in st) f(st, 'journal', ui(where, 'journal'));
    if (st.table && typeof st.table === 'object') {
      f(st.table, 'text', spoken(where, 'table.text', 'gm', 'excited'));
      f(st.table, 'done', ui(where, 'table.done'));
    }
  }

  // ---- scenes (story order is the object's order)
  for (const [id, sc] of Object.entries(content.scenes || {})) {
    if (!sc) continue;
    const where = `scenes.${id}`;
    f(sc, 'title', ui(where, 'scene.title'));
    f(sc, 'subtitle', ui(where, 'scene.subtitle'));
    if (Array.isArray(sc.steps)) stepList(sc.steps, where);
  }

  // ---- heroes
  for (const [arch, h] of Object.entries(content.heroes || {})) {
    if (!h) continue;
    const where = `heroes.${arch}`;
    f(h, 'name', ui(where, 'hero.name'));
    f(h, 'calling', ui(where, 'hero.calling'));
    f(h, 'blurb', ui(where, 'hero.blurb'));
    if (h.talent) { f(h.talent, 'name', ui(where, 'talent.name')); f(h.talent, 'text', ui(where, 'talent.text')); }
    lines(h, 'intro', spoken(where, 'hero.intro', 'gm', 'warm', { pool: `hero.${arch}.intro`, tts: 'grand' }));
    if (h.strike) {
      f(h.strike, 'name', ui(where, 'strike.name'));
      f(h.strike, 'text', ui(where, 'strike.text'));
      for (const k of Object.keys(h.strike.lines || {})) lines(h.strike.lines, k, spoken(where, `strike.${k}`, 'gm', 'warm', { pool: `hero.${arch}.${k}` }));
    }
    for (const p of h.powers || []) {
      if (!p) continue;
      f(p, 'name', ui(where, 'power.name'));
      f(p, 'text', ui(where, 'power.text'));
      for (const k of Object.keys(p.lines || {})) lines(p.lines, k, spoken(where, `power.${k}`, 'gm', 'warm', { pool: `hero.${arch}.${k}` }));
    }
    for (const lvl of Object.keys(h.perks || {})) {
      for (const pk of [].concat(h.perks[lvl] || [])) { if (!pk) continue; f(pk, 'name', ui(where, 'perk.name')); f(pk, 'text', ui(where, 'perk.text')); }
    }
  }

  // ---- enemies
  for (const [eid, e] of Object.entries(content.enemies || {})) {
    if (!e) continue;
    const where = `enemies.${eid}`;
    f(e, 'name', ui(where, 'enemy.name'));
    f(e, 'plural', ui(where, 'enemy.plural'));
    for (const m of e.moves || []) {
      if (!m) continue;
      f(m, 'name', ui(where, 'move.name'));
      for (const k of Object.keys(m.lines || {})) lines(m.lines, k, spoken(where, `move.${k}`, 'gm', 'warm', { pool: `enemy.${eid}.${k}` }));
    }
    for (const k of Object.keys(e.lines || {})) lines(e.lines, k, spoken(where, `enemy.${k}`, 'gm', 'warm', { pool: `enemy.${eid}.${k}` }));
  }

  // ---- encounters
  for (const [cid, c] of Object.entries(content.encounters || {})) {
    if (!c) continue;
    const where = `encounters.${cid}`;
    f(c, 'title', ui(where, 'encounter.title'));
    for (const foe of c.foes || []) if (foe) f(foe, 'name', ui(where, 'foe.name'));
    lines(c, 'intro', spoken(where, 'encounter.intro', 'gm', 'warm', { pool: `encounter.${cid}`, tts: 'ominous' }));
    if (c.twist) lines(c.twist, 'lines', spoken(where, 'encounter.twist', 'gm', 'warm', { pool: `encounter.${cid}`, tts: 'excited' }));
  }

  // ---- items, shops, npcs, map
  for (const [iid, it] of Object.entries(content.items || {})) {
    if (!it) continue;
    f(it, 'name', ui(`items.${iid}`, 'item.name'));
    f(it, 'text', ui(`items.${iid}`, 'item.text'));
  }
  for (const [sid, s] of Object.entries(content.shops || {})) {
    if (!s) continue;
    const info = spoken(`shops.${sid}`, 'shop.line', s.keeper || 'gm', 'warm', { pool: `shop.${sid}` });
    lines(s, 'greeting', info);
    lines(s, 'bye', info);
  }
  for (const [nid, n] of Object.entries(content.npcs || {})) {
    if (!n) continue;
    f(n, 'name', ui(`npcs.${nid}`, 'npc.name'));
    f(n, 'title', ui(`npcs.${nid}`, 'npc.title'));
  }
  for (const node of content.map?.nodes || []) if (node) f(node, 'label', ui('map', 'map.label'));

  // ---- prologue: a line's own mood, else 'hush' on the last panel and 'warm' before it (screens/prologue.js)
  const panels = content.prologue?.panels || [];
  panels.forEach((p, i) => {
    const def = i === panels.length - 1 ? 'hush' : 'warm';
    (p?.lines || []).forEach((l, j) => {
      if (typeof l === 'string') f(p.lines, j, spoken('prologue', 'prologue', 'gm', def, { tts: def }));
      else if (l && typeof l === 'object') f(l, 'say', spoken('prologue', 'prologue', 'gm', l.mood || def, { tts: l.mood || def }));
    });
  });

  // ---- Old Quill's pools
  for (const key of Object.keys(content.gmLines || {})) {
    lines(content.gmLines, key, spoken(`gmLines.${key}`, 'pool', 'gm', 'warm', { pool: key }));
  }
}

// ------------------------------------------------------------------------------------------------ localize

function cloneDeep(v) {
  if (Array.isArray(v)) return v.map(cloneDeep);
  if (isPlain(v)) {
    const o = {};
    for (const k of Object.keys(v)) o[k] = cloneDeep(v[k]);
    return o;
  }
  return v; // primitives, functions and class instances by reference
}

export function localize(content, dict, opts = {}) {
  const copy = cloneDeep(content);
  if (!dict || typeof dict !== 'object') return copy;
  walkText(copy, (text) => {
    const d = dict[normText(text)];
    return typeof d === 'string' && d.trim() ? d : undefined;
  }, opts);
  return copy;
}
