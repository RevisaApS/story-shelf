// Lanternfall boot. Builds ctx (SPEC 3), loads optional modules with fallbacks, runs the screen flow.
// Round 2 (ROUND2 1, 2): picks the language and the pack (the shelf), localises the pack's content, then runs the
// default flow or hands over to the pack's own boot.
//
// ctx.pack         the chosen pack from packs.js; ctx.lang 'en'|'da'; ctx.i18n { LANGS, L, tr, localize, walkText, getLang }
// ctx.content      the pack's content, localised when a dictionary for ctx.lang loads (English otherwise)
// ctx.contentSource the English source content (what dictionaries are keyed by)
// ctx.toShelf()    leave for the shelf (reloads without ?game)
//
// ctx.screens.go(name, ...args) -> Promise   runs a registered screen or an SPEC 11 entry point (args, then ctx).
//   Names: title party prologue travel rest levelup shop challenge melody runes gmscreen settings ending combat scene
// ctx.screens.register(name, fn(...args, ctx))  add or override a screen.
// ctx.screens.has(name) -> Promise<bool>        true when the real module (not the fallback) is present.
// URL: ?game=<pack> &lang=en|da ?content=dev &auto=1 &fast=1 &seed=N &policy=first|random|kind &mistakes=1 &scene=<id> &party=a,b &level=2 &nosave=1
import { createBus } from './core/bus.js';
import { createRng } from './core/rng.js';
import * as rules from './core/rules.js';
import { createState } from './core/state.js';
import { createSave, loadSettings } from './core/save.js';
import { createAssets } from './core/assets.js';
import { silentAudio, createDice2D, FALLBACKS } from './core/fallbacks.js';
import { createStage } from './ui/stage.js';
import { createUI } from './ui/widgets.js';
import { createNarrator } from './gm/narrator.js';
import { L, tr, LANGS, setLang, getLang, detectLang, localize, walkText } from './core/i18n.js';
import PACKS from './packs.js';
import { createPlaylog } from './core/playlog.js';
import './core/install.js'; // listens for the browser's install offer from the first moment

const VERSION = '0.1.0';
const params = new URLSearchParams(location.search);
const P = {
  content: params.get('content'), auto: params.get('auto') === '1', fast: params.get('fast') === '1',
  seed: params.has('seed') ? Number(params.get('seed')) || params.get('seed') : null,
  policy: params.get('policy') || 'kind', mistakes: params.get('mistakes') === '1',
  scene: params.get('scene'), party: params.get('party'), level: Number(params.get('level')) || 1,
  nosave: params.get('nosave') === '1',
  game: params.get('game'), lang: params.get('lang'),
};

const STR = L({
  en: { boot: 'The story could not start: ', shelf: 'Lanternfall and friends: pick a story' },
  da: { boot: 'Historien kunne ikke starte: ', shelf: 'Lygtefald og venner: vælg en historie' },
});

window.__LF_SPEED = P.fast ? 20 : 1;
if (P.fast) document.documentElement.classList.add('lf-fast');

// [file, export] for every optional entry point (SPEC 3, 11, 12)
const MODULES = {
  title: ['screens/title.js', 'titleScreen'], party: ['screens/party.js', 'partyScreen'], prologue: ['screens/prologue.js', 'prologueScreen'],
  travel: ['screens/map.js', 'travel'], rest: ['screens/camp.js', 'rest'], gmscreen: ['screens/gmscreen.js', 'openGmScreen'],
  settings: ['screens/settings.js', 'openSettings'], ending: ['screens/ending.js', 'endingScreen'],
  levelup: ['systems/levelup.js', 'levelUp'], shop: ['systems/shop.js', 'openShop'], challenge: ['systems/challenge.js', 'runChallenge'],
  melody: ['systems/puzzle-melody.js', 'runMelody'], runes: ['systems/puzzle-runes.js', 'runRunes'], combat: ['systems/combat.js', 'runCombat'],
  scene: ['screens/scene.js', 'runScene'], skill: ['systems/skill.js', 'runSkill'],
};

async function optionalImport(ctx, path) {
  if (ctx.assets.moduleExists('js/' + path) === false) return null;
  try { return await import('./' + path); }
  catch (e) { console.error(`[lanternfall] module ${path} failed to load`, e); return null; }
}

function createAuto(ctx) {
  const rng = ctx.rng.fork('auto');
  const seen = new Map();
  const KIND = /kind|gentle|help|talk|share|sing|calm|friend|gift|soothe|thank|hug|comfort|listen|venlig|blid|hjælp|snak|tal |del |syng|rolig|ven|gave|berolig|tak|kram|trøst|lyt/i;
  return {
    policy: P.policy, mistakes: P.mistakes, rng,
    choose(opts, { prompt = '' } = {}) {
      if (!opts.length) return null;
      const key = prompt + '|' + opts.map((o) => o.label).join('|');
      const counts = seen.get(key) || {};
      const min = Math.min(...opts.map((o) => counts[o.id] || 0));
      const fresh = opts.filter((o) => (counts[o.id] || 0) === min);
      let pick;
      if (P.policy === 'first') pick = fresh[0];
      else if (P.policy === 'random') pick = rng.pick(fresh);
      else pick = fresh.find((o) => o.hero) || fresh.find((o) => o.stat === 'heart' || KIND.test(o.label)) || rng.pick(fresh);
      counts[pick.id] = (counts[pick.id] || 0) + 1;
      seen.set(key, counts);
      return pick.id;
    },
    pickHero(list, { stat, talent, spot } = {}) {
      if (spot && P.policy !== 'first' && rng.chance(0.4)) return spot;
      let best = list[0], bv = -99;
      for (const h of list) { const v = rules.checkBonus(h, { stat, talent }).total; if (v > bv) { bv = v; best = h; } }
      return best.id;
    },
  };
}

function bootError(e) {
  console.error(e);
  const el = document.getElementById('boot-error') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'boot-error' }));
  el.textContent = STR.boot + (e?.message || e);
}

// ---- packs ----------------------------------------------------------------------------------------------------

// Packs the shelf can offer: every module the pack needs exists, its content imports, and its card art exists.
async function availablePacks(ctx) {
  const list = Object.values(PACKS).sort((a, b) => (a.order || 99) - (b.order || 99));
  const out = [];
  for (const pack of list) {
    if ((pack.needs || []).some((p) => ctx.assets.moduleExists(p) === false)) continue;
    if (pack.art && !(await ctx.assets.exists(pack.art))) continue;
    const mod = await loadPackContent(pack);
    if (mod) out.push(pack);
  }
  return out;
}

const contentCache = new Map();
function loadPackContent(pack) {
  if (!contentCache.has(pack.id)) {
    contentCache.set(pack.id, Promise.resolve().then(() => pack.content())
      .then((m) => (m?.default ? m : null))
      .catch((e) => { console.warn(`[lanternfall] pack ${pack.id} has no content yet:`, e?.message || e); return null; }));
  }
  return contentCache.get(pack.id);
}

async function loadDict(ctx, pack, lang) {
  if (lang === 'en' || !pack.dict?.[lang]) return null;
  const path = pack.dictPath?.[lang];
  if (path && ctx.assets.moduleExists(path) === false) return null;
  try { const m = await pack.dict[lang](); return m?.default && typeof m.default === 'object' ? m.default : null; }
  catch (e) { console.warn(`[lanternfall] no ${lang} dictionary for ${pack.id}:`, e?.message || e); return null; }
}

function urlWith(changes) {
  const q = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(changes)) { if (v == null) q.delete(k); else q.set(k, v); }
  const s = q.toString();
  return location.pathname + (s ? `?${s}` : '');
}

async function boot() {
  const bus = createBus();
  const settings = loadSettings();
  const lang = setLang(detectLang(settings));
  if (settings.reduceMotion) document.documentElement.classList.add('lf-reduce');
  const seed = P.seed ?? (Date.now() % 1e9);
  const rng = createRng(seed);
  const assets = createAssets();
  const ctx = {
    bus, rules, rng, assets, settings, version: VERSION, params: P,
    fast: P.fast, auto: null, content: null, state: null, audio: silentAudio(), dice: null, gm: null, ui: null, screens: null,
    lang, i18n: { LANGS, L, tr, localize, walkText, getLang, setLang }, pack: null, contentSource: null,
    // the shelf shows only without game/scene/auto/content/... : keep nothing but the language override
    toShelf: () => { const l = new URLSearchParams(location.search).get('lang'); location.href = location.pathname + (l ? `?lang=${encodeURIComponent(l)}` : ''); },
    sleep: (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms) / (window.__LF_SPEED || 1))),
  };
  window.__LF = { ctx, state: null, version: VERSION, ticks: 0, progress: 0, path: [] };
  bus.on('*', () => { window.__LF.ticks++; });
  bus.on('scene:entered', ({ id }) => window.__LF.path.push(id));
  ctx.playlog = createPlaylog(ctx);
  ctx.playlog.log('open', { w: innerWidth, h: innerHeight, shelf: !P.game, standalone: matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches });

  ctx.stage = createStage(document.getElementById('app'), ctx);
  await assets.init();
  for (const id of ['css-screens', 'css-combat', 'css-skill', 'css-shelf']) {
    const link = document.getElementById(id);
    if (link && assets.has(link.getAttribute('href')) !== false) link.disabled = false;
  }

  ctx.ui = createUI(ctx);

  // Audio
  const audioMod = await optionalImport(ctx, 'audio/audio.js');
  if (audioMod?.createAudio) {
    try { ctx.audio = await audioMod.createAudio(); } catch (e) { console.error('[lanternfall] audio failed, using silence', e); ctx.audio = silentAudio(); }
  }
  const applyVolume = () => ctx.audio.setVolume?.(P.fast ? { master: 0 } : { master: settings.master, music: settings.music, sfx: settings.sfx, voice: settings.voice });
  applyVolume();
  ctx.applyVolume = applyVolume;
  const unlock = () => { try { ctx.audio.unlock(); } catch { /* ignore */ } window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  // Dice
  const diceMod = await optionalImport(ctx, 'dice/dice3d.js');
  if (diceMod?.createDice) {
    try { ctx.dice = await diceMod.createDice(ctx.stage.layers.dice); ctx.dice.setQuality?.(settings.diceQuality || 'high'); }
    catch (e) { console.warn('[lanternfall] 3D dice unavailable, using 2D dice:', e?.message || e); ctx.dice = null; }
  }
  if (!ctx.dice) ctx.dice = createDice2D(ctx.stage.layers.dice);

  // Pack: ?game= skips the shelf; old URLs (scene, auto, content) mean Lanternfall.
  let packId = P.game && PACKS[P.game] ? P.game : null;
  if (!packId && (P.scene || P.auto || P.content)) packId = 'lanternfall';
  if (!packId) {
    const list = await availablePacks(ctx);
    if (!list.length) list.push(PACKS.lanternfall);
    document.title = STR.shelf;
    const shelf = await optionalImport(ctx, 'screens/shelf.js');
    packId = shelf?.shelfScreen ? await shelf.shelfScreen(ctx, list) : list[0].id;
    if (!PACKS[packId]) packId = list[0].id;
    try { history.replaceState(null, '', urlWith({ game: packId })); } catch { /* ignore */ }
  }
  const pack = PACKS[packId];
  ctx.pack = pack;
  document.documentElement.dataset.pack = pack.id;
  document.documentElement.classList.add(`theme-${pack.theme || pack.id}`);
  document.title = `${tr(pack.title)}: ${tr(pack.sub)}`;

  // Content (English source), then the dictionary for the language
  let mod = null;
  if (!(pack.id === 'lanternfall' && P.content === 'dev')) mod = await loadPackContent(pack);
  let source = mod?.default || null;
  if (!source) {
    if (pack.id !== 'lanternfall') throw new Error(`${tr(pack.title)}: content missing`);
    mod = await import('./content/dev/index.js');
    source = mod.default;
  }
  ctx.contentSource = source;
  const dict = await loadDict(ctx, pack, lang);
  ctx.dict = dict;
  ctx.content = dict ? localize(source, dict, { textFields: mod.textFields }) : source;

  ctx.state = createState(bus, () => ctx.content);
  window.__LF.state = ctx.state;
  ctx.save = createSave({ disabled: P.nosave, key: pack.saveKey });
  if (P.auto) ctx.auto = createAuto(ctx);
  ctx.playlog.log('game', { hasSave: !!ctx.save.exists() });

  // GM
  ctx.gm = createNarrator(ctx);
  const dirMod = await optionalImport(ctx, 'gm/director.js');
  if (dirMod?.createDirector) ctx.gm.director = dirMod.createDirector(ctx);

  // Screens router
  const registry = new Map();
  const cache = new Map();
  const resolve = async (name) => {
    if (registry.has(name)) return { fn: registry.get(name), real: true };
    if (!cache.has(name)) {
      const spec = MODULES[name];
      cache.set(name, spec ? optionalImport(ctx, spec[0]).then((m) => m?.[spec[1]] || null) : Promise.resolve(null));
    }
    const fn = await cache.get(name);
    return { fn: fn || FALLBACKS[name] || null, real: !!fn };
  };
  ctx.screens = {
    register(name, fn) { registry.set(name, fn); },
    async has(name) { return (await resolve(name)).real; },
    async go(name, ...args) {
      const { fn, real } = await resolve(name);
      if (!fn) { console.warn('[screens] no screen', name); return undefined; }
      bus.emit('screen:enter', { name, args });
      try { return await fn(...args, ctx); }
      catch (e) {
        if (!real || !FALLBACKS[name]) throw e;
        console.error(`[screens] ${name} threw; using fallback`, e);
        return FALLBACKS[name](...args, ctx);
      }
      finally { bus.emit('screen:exit', { name }); }
    },
  };

  // Core UI that lives on the stage the whole game (optional during phase 1)
  if (pack.hud !== false) {
    const hudMod = await optionalImport(ctx, 'ui/hud.js');
    if (hudMod?.createHud) ctx.hud = hudMod.createHud(ctx);
  }
  const weatherMod = await optionalImport(ctx, 'ui/weather.js');
  if (weatherMod?.createWeather) ctx.weather = weatherMod.createWeather(ctx);
  if (!ctx.weather) ctx.weather = { set() {}, clear() {} };

  // Play-time clock
  setInterval(() => { if (ctx.state && document.visibilityState === 'visible') ctx.state.playMs += 1000; }, 1000);

  bus.emit('boot:ready', { ctx });
  document.documentElement.dataset.ready = '1';
  if (pack.boot) {
    const bootMod = await pack.boot();
    const flow = await bootMod.default(ctx);
    window.__LF.state = ctx.state;
    await flow.run(ctx);
    return;
  }
  await run(ctx);
}

function setupParty(ctx, list, level) {
  ctx.state.setParty(list);
  for (let l = 2; l <= level; l++) {
    for (const hero of [...ctx.state.party]) {
      const perk = ctx.content?.heroes?.[hero.arch]?.perks?.[l]?.[0] || null;
      ctx.state.replaceHero(ctx.rules.levelUpHero(hero, l, perk));
    }
  }
  ctx.state.heal('all', 'full');
}

async function playFrom(ctx, sceneId, { resumed = false } = {}) {
  let id = sceneId;
  let first = true;
  while (id && id !== 'end') {
    if (!ctx.content.scenes?.[id]) { console.error('[lanternfall] unknown scene', id); break; }
    id = await ctx.screens.go('scene', id, { resumed: resumed && first });
    first = false;
  }
  ctx.bus.emit('adventure:ending', {});
  await ctx.screens.go('ending');
  ctx.save.clear();
  ctx.bus.emit('adventure:done', { tally: ctx.state.tally });
  document.documentElement.dataset.done = '1';
}

async function run(ctx) {
  const P = ctx.params;
  const start = ctx.content.startScene || Object.keys(ctx.content.scenes)[0];
  const quickStart = P.scene || (P.auto && P.party);
  if (quickStart || (P.auto && P.content === 'dev')) {
    ctx.state.reset(ctx.rng.seed);
    setupParty(ctx, (P.party || 'knight,wizard').split(',').map((s) => s.trim()).filter(Boolean), P.level);
    return playFrom(ctx, P.scene || start);
  }
  for (;;) {
    const choice = await ctx.screens.go('title');
    if (choice === 'continue') {
      const data = ctx.save.load();
      if (data) { ctx.state.load(data); return playFrom(ctx, data.scene, { resumed: true }); }
    }
    ctx.state.reset(ctx.rng.seed);
    if (P.auto) setupParty(ctx, ['knight', 'wizard', 'bard'], 1);
    else await ctx.screens.go('party');
    if (!ctx.state.party.length) setupParty(ctx, ['knight'], 1);
    await ctx.screens.go('prologue');
    return playFrom(ctx, start);
  }
}

window.addEventListener('unhandledrejection', (e) => console.error('[lanternfall] unhandled rejection', e.reason));
boot().catch(bootError);
