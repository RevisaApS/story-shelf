// Grimspire battle screen (GRIMSPIRE 4.2, 4.5, 5.3, 5.7). battle-rules.js decides every number; this file plays
// its events on the stage and runs the action commands (commands.js) that decide each grade.
//
// runBattle(encounterId, opts, ctx) -> { result:'win'|'lose', turns, seconds, perfects, goods, weaks, perfectBlocks,
//   blocks, bestHit, defeated:[foeIds], weakFound:[foeIds] }
//   opts: { floor, roomId, kind, huntAgain, bg, foeHp, furyBonus, shieldPct, foes (override list), skipIntro,
//           engine (a battle-rules stand-in, for the bench), mix (autoplay grade mix id, default 'auto') }
// It writes hunter Health and used items to ctx.state, adds the battle tallies (tallyAdd, tallyMax), and calls
// state.seeFoe(id, weakKnown). It hands out no rewards. Knocked-down hunters stay at 0 Health.
// Every wait goes through ctx.sleep; nothing waits on animationend. window.__GS_BATTLE is the live view (tests).
import { h } from '../ui/dom.js';
import { L } from '../core/i18n.js';
import * as R from './rules.js';
import { runCommand } from './commands.js';
import { createGsFx, colorOf } from './battle-fx.js';

const STR = L({
  en: {
    round: 'Round', turnOf: (n) => `${n}'s turn`, pickFoe: 'Pick a foe', pickAlly: 'Pick an ally', pickFallen: 'Pick a fallen ally',
    back: 'Back', fury: 'Fury', free: 'Free', items: 'Pick something from the bag', noItems: 'The bag is empty',
    victory: 'VICTORY', victorySub: 'The monsters are dust', defeat: 'KNOCKED DOWN', defeatSub: 'Varg drags you back to the fire',
    weak: 'WEAK POINT!', resist: 'RESIST', crit: 'CRIT!', miss: 'MISS', dodged: 'DODGED', vanished: 'VANISHED', blocked: 'BLOCKED',
    big: 'BIG ATTACK!', bigSub: 'Perfect block it!', incoming: 'Block!', guardBreak: 'GUARD BROKEN!', opening: 'OPENING!', openingSub: 'Stunned for a turn',
    stagger: 'Shrugs it off', down: 'DOWN', standUp: 'UP AGAIN!', laststand: 'HOLDS ON!', free2: 'FREED!', immune: 'IMMUNE',
    skip: { stun: 'STUNNED', cocoon: 'COCOONED', stone: 'STONE', down: '' }, explode: 'BURSTS!', counter: 'COUNTER!',
    trapSet: 'Trap set', trapSprung: 'SNARED!', page: (e) => `Next: ${e}`, weakTo: (e) => `Weak to ${e} now`, heat: (n) => `Heat ${n}`, cooled: 'Cooled!',
    defend: 'Braced', shield: (n) => `+${n} shield`, summon: 'Reinforcements!', phase: 'The fight changes', form: 'It rises again',
    lv: (n) => `Lv ${n}`, lockedAt: (n) => `Unlocks at Level ${n}`, cost: (n) => `${n} Fury`, defendHint: 'Half damage', itemHint: (n) => `${n} in the bag`,
    strikeHint: 'Free', boss: 'BOSS', next: 'Next',
    el: { fire: 'fire', frost: 'frost', storm: 'storm', shadow: 'shadow', spirit: 'spirit' },
  },
  da: {
    round: 'Runde', turnOf: (n) => `${n}s tur`, pickFoe: 'Vælg en fjende', pickAlly: 'Vælg en ven', pickFallen: 'Vælg en faldet ven',
    back: 'Tilbage', fury: 'Raseri', free: 'Gratis', items: 'Vælg noget fra tasken', noItems: 'Tasken er tom',
    victory: 'SEJR', victorySub: 'Monstrene er støv', defeat: 'SLÅET NED', defeatSub: 'Varg slæber jer tilbage til bålet',
    weak: 'SVAGT PUNKT!', resist: 'MODSTÅR', crit: 'KRITISK!', miss: 'FORBI', dodged: 'UNDVEG', vanished: 'VÆK', blocked: 'BLOKERET',
    big: 'STORT ANGREB!', bigSub: 'Blokér perfekt!', incoming: 'Blokér!', guardBreak: 'DÆKNING BRUDT!', opening: 'ÅBNING!', openingSub: 'Lammet en tur',
    stagger: 'Ryster det af sig', down: 'NEDE', standUp: 'OPPE IGEN!', laststand: 'HOLDER STAND!', free2: 'FRI!', immune: 'IMMUN',
    skip: { stun: 'LAMMET', cocoon: 'I KOKON', stone: 'STEN', down: '' }, explode: 'SPRÆNGER!', counter: 'MODANGREB!',
    trapSet: 'Fælden er sat', trapSprung: 'FANGET!', page: (e) => `Næste: ${e}`, weakTo: (e) => `Svag for ${e} nu`, heat: (n) => `Varme ${n}`, cooled: 'Kølet af!',
    defend: 'Klar', shield: (n) => `+${n} skjold`, summon: 'Forstærkninger!', phase: 'Kampen skifter', form: 'Den rejser sig igen',
    lv: (n) => `Niv. ${n}`, lockedAt: (n) => `Låses op på niveau ${n}`, cost: (n) => `${n} Raseri`, defendHint: 'Halv skade', itemHint: (n) => `${n} i tasken`,
    strikeHint: 'Gratis', boss: 'BOSS', next: 'Næste',
    el: { fire: 'ild', frost: 'frost', storm: 'storm', shadow: 'skygge', spirit: 'ånd' },
  },
});

const CMD_NAME = L({
  en: { sword: 'Sweep', daggers: 'Double strike', staff: 'Charge', bow: 'Aim', axes: 'Fury taps', scythe: 'Pulse' },
  da: { sword: 'Fej', daggers: 'Dobbeltstød', staff: 'Lad op', bow: 'Sigt', axes: 'Raseri-slag', scythe: 'Puls' },
});

const STATUS = L({
  en: {
    burn: ['Burning', 'Takes fire damage each turn.'], poison: ['Poisoned', 'Takes damage each turn. Stacks up to 3.'],
    chill: ['Chilled', 'Speed halved. A chilled foe is easier to block.'], stun: ['Stunned', 'Loses the next turn.'],
    mark: ['Marked', 'Takes 25% more damage.'], curse: ['Cursed', 'Weaker defence and attack.'], rally: ['Rallied', '+25% Attack.'],
    taunt: ['Taunting', 'Foes must attack this one.'], vanish: ['Vanished', 'Cannot be targeted. The next strike hits double.'],
    webbed: ['Webbed', 'Cannot strike this turn.'], silenced: ['Silenced', 'Cannot use skills this turn.'],
    cocoon: ['Cocooned', 'Skips turns until an ally strikes the cocoon.'], smoke: ['Smoke', 'Hard to hit.'],
    defend: ['Defending', 'Takes half damage until the next turn.'], reckless: ['Reckless', 'Takes more damage until the next turn.'],
    guardBroken: ['Guard broken', 'The shield is down. Hit it now!'], stone: ['Stone', 'Takes very little damage and cannot act.'],
    hidden: ['Hidden', 'Cannot be targeted unless marked.'], shield: ['Shield', 'Absorbs damage first.'], heat: ['Heat', 'Hits harder every round.'],
  },
  da: {
    burn: ['Brænder', 'Tager ildskade hver tur.'], poison: ['Forgiftet', 'Tager skade hver tur. Op til 3 gange.'],
    chill: ['Afkølet', 'Halv Fart. En afkølet fjende er lettere at blokere.'], stun: ['Lammet', 'Mister næste tur.'],
    mark: ['Mærket', 'Tager 25% mere skade.'], curse: ['Forbandet', 'Svagere forsvar og angreb.'], rally: ['Opildnet', '+25% Angreb.'],
    taunt: ['Udfordrer', 'Fjender skal angribe denne.'], vanish: ['Forsvundet', 'Kan ikke rammes. Næste slag rammer dobbelt.'],
    webbed: ['Spundet ind', 'Kan ikke slå denne tur.'], silenced: ['Tavs', 'Kan ikke bruge evner denne tur.'],
    cocoon: ['I kokon', 'Springer ture over, til en ven slår kokonen op.'], smoke: ['Røg', 'Svær at ramme.'],
    defend: ['Forsvarer sig', 'Tager halv skade til næste tur.'], reckless: ['Dumdristig', 'Tager mere skade til næste tur.'],
    guardBroken: ['Dækning brudt', 'Skjoldet er nede. Slå nu!'], stone: ['Sten', 'Tager næsten ingen skade og kan ikke handle.'],
    hidden: ['Skjult', 'Kan ikke rammes, medmindre den er mærket.'], shield: ['Skjold', 'Tager skaden først.'], heat: ['Varme', 'Slår hårdere hver runde.'],
  },
});

// pool -> [speaker, mood] (matches content/index.js POOL_VOICE so voice ids line up)
const POOL_MOOD = {
  'strike.weak': 'dry', 'block.miss': 'dry', 'foe.big': 'ominous', 'battle.win': 'excited', 'battle.lose': 'warm',
  'teach.strike': 'warm', 'teach.block': 'warm', 'teach.fury': 'warm', 'teach.weak': 'warm',
};
// pools Varg may skip when he is already talking (the rest wait their turn briefly)
const CHATTER = new Set(['strike.good', 'block.good', 'strike.perfect', 'block.perfect', 'strike.weak', 'block.miss', 'strike.resisted', 'hero.lowHp']);

// ---------- art sizes (stage px, fixed per id so layout never depends on the picture) ----------
const HERO_H = { dragonknight: 330, shadow: 300, stormmage: 312, hunter: 306, berserker: 346, gravewarden: 312 };
const HERO_SCALE = { 1: 1.1, 2: 1, 3: 0.92, 4: 0.84 };
const HERO_SLOTS = { 1: [[330, 606]], 2: [[230, 594], [450, 616]], 3: [[150, 592], [330, 616], [505, 592]], 4: [[100, 588], [245, 614], [390, 588], [535, 614]] };
const FOE_H = {
  gs_bonegrunt: 290, gs_gravebat: 190, gs_boneshield: 300, gs_rattlejaw: 470,
  gs_webspinner: 190, gs_venomling: 160, gs_husk: 300, gs_silkfang: 400,
  gs_cinderimp: 190, gs_magmahound: 220, gs_ironsentry: 330, gs_brann: 480,
  gs_frostwraith: 300, gs_cursedtome: 160, gs_icegargoyle: 300, gs_vex: 440,
  gs_boneknight: 330, gs_shadowstalker: 310, gs_crownguard: 320, gs_marrowmaw: 470, gs_boneking: 470, gs_hollowcrown: 520,
};
const FOE_ASPECT = { gs_gravebat: 1.5, gs_webspinner: 1.4, gs_venomling: 1.6, gs_silkfang: 1.5, gs_magmahound: 1.4, gs_marrowmaw: 1.3, gs_cursedtome: 1.2, gs_cinderimp: 0.9 };
const FLY = { gs_gravebat: 150, gs_cursedtome: 140, gs_cinderimp: 70, gs_frostwraith: 30, gs_vex: 24, gs_hollowcrown: 16 };
const FOE_SLOTS = { 1: [[960, 610]], 2: [[860, 596], [1080, 620]], 3: [[790, 592], [960, 622], [1130, 594]], 4: [[770, 590], [905, 622], [1040, 588], [1170, 620]], 5: [[760, 592], [865, 624], [970, 586], [1075, 624], [1180, 592]] };
const BOSS_AT = [990, 632];
const MINION_SLOTS = [[775, 628], [1205, 632], [880, 668], [1110, 668], [700, 640], [1250, 640]];
// what a beaten monster turns into (5.0: dust, bones or smoke)
const CRUMBLE = { gs_bonegrunt: 'bone', gs_boneshield: 'bone', gs_rattlejaw: 'bone', gs_boneknight: 'bone', gs_crownguard: 'bone', gs_marrowmaw: 'bone', gs_boneking: 'bone',
  gs_cinderimp: 'fire', gs_magmahound: 'fire', gs_brann: 'fire', gs_ironsentry: 'fire', gs_frostwraith: 'frost', gs_icegargoyle: 'frost', gs_vex: 'frost',
  gs_shadowstalker: 'shadow', gs_hollowcrown: 'spirit', gs_gravebat: 'shadow', gs_cursedtome: 'shadow' };
const RANGED_MOVE = /bolt|breath|spit|flare|whisper|inferno|blast|fire|frost|storm|page|shriek|howl|web|venom|ember|lance|nova|curse|hunger|judgement|wave|rattle/i;
const FAMILY_FX = { sword: 'strike_sword', daggers: 'strike_daggers', staff: 'strike_staff', bow: 'strike_bow', axes: 'strike_axes', scythe: 'strike_scythe' };
const RANGED_FX = new Set(['strike_staff', 'strike_bow', 'arrow', 'fire_burst', 'frost_lance', 'lightning_chain', 'poison', 'hex', 'arrow_rain', 'thunder', 'tempest']);

// ---------- line-art icons ----------
const IC = {
  sword: '<path d="M5 19l9.5-9.5M13 4h7v7l-9 9-3-3 9-9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M4 16l4 4M3 21l2-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  daggers: '<path d="M4 20L14 6l2 2L6 22zM20 20L10 6l-2 2 10 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  staff: '<path d="M6 21L16 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="17.5" cy="6" r="3.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M21 2l-2 2M13 2l1 2M22 9l-2-1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  bow: '<path d="M6 3c7 3 7 15 0 18M6 3v18" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4 12h16M17 9l3 3-3 3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  axes: '<path d="M7 3v18M17 3v18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M7 4c-4 1-5 5-3 8 1-2 2-3 3-3M17 4c4 1 5 5 3 8-1-2-2-3-3-3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  scythe: '<path d="M8 22L15 3" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M15 3c-5 0-10 2-12 7 4-2 8-2 11-1" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  shield: '<path d="M12 2.5l8 3v6c0 5-3.4 8.7-8 10-4.6-1.3-8-5-8-10v-6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  bag: '<path d="M5 9h14l-1.2 11H6.2z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9 9V7a3 3 0 016 0v2" fill="none" stroke="currentColor" stroke-width="1.7"/>',
  flame: '<path d="M12 22c-4 0-7-3-7-7 0-4 3-6 4-10 2 2 3 4 3 6 1-1 2-2 2-4 3 2 5 5 5 8 0 4-3 7-7 7z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  drop: '<path d="M12 3c3 5 6 8 6 12a6 6 0 01-12 0c0-4 3-7 6-12z" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  snow: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9 4l3 2 3-2M9 20l3-2 3 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  star: '<path d="M12 2.8l2.6 5.6 6.1.7-4.5 4.2 1.2 6.1L12 16.4l-5.4 3 1.2-6.1L3.3 9.1l6.1-.7z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  target: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
  skull: '<path d="M12 3a8 8 0 00-8 8c0 3 1.5 4.5 3 5.5V20h10v-3.5c1.5-1 3-2.5 3-5.5a8 8 0 00-8-8z" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="9" cy="11.5" r="1.8" fill="currentColor"/><circle cx="15" cy="11.5" r="1.8" fill="currentColor"/>',
  up: '<path d="M12 20V5M6 11l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  bang: '<path d="M12 3v12" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/><circle cx="12" cy="20" r="1.9" fill="currentColor"/>',
  eye: '<path d="M2 12s4-6.5 10-6.5S22 12 22 12s-4 6.5-10 6.5S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4 20L20 4" stroke="currentColor" stroke-width="2"/>',
  web: '<path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="1.2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.3"/>',
  mute: '<path d="M4 9h4l5-4v14l-5-4H4z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  cloud: '<path d="M7 18h10a4 4 0 000-8 5 5 0 00-9.6-1.5A3.8 3.8 0 007 18z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  rock: '<path d="M4 18l3-9 5-4 6 3 2 10z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  broken: '<path d="M12 2.5l8 3v6c0 5-3.4 8.7-8 10-4.6-1.3-8-5-8-10v-6z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 4l-2 6 3 3-2 7" fill="none" stroke="currentColor" stroke-width="2"/>',
  cross: '<path d="M12 4v16M4 12h16" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
  fury: '<path d="M13 2L5 14h6l-1 8 8-12h-6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  spark: '<path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l4 4M15 15l4 4M19 5l-4 4M9 15l-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  heal: '<path d="M12 20.5S3 14.8 3 8.9C3 6.2 5.1 4.2 7.6 4.2c1.8 0 3.4 1 4.4 2.5 1-1.5 2.6-2.5 4.4-2.5 2.5 0 4.6 2 4.6 4.7 0 5.9-9 11.6-9 11.6z" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  back: '<path d="M10 5l-7 7 7 7M3 12h18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 11V8a4 4 0 018 0v3" fill="none" stroke="currentColor" stroke-width="1.8"/>',
};
const ST_ICON = { burn: 'flame', poison: 'drop', chill: 'snow', stun: 'star', mark: 'target', curse: 'skull', rally: 'up', taunt: 'bang', vanish: 'eye', webbed: 'web', silenced: 'mute', cocoon: 'web', smoke: 'cloud', defend: 'shield', reckless: 'fury', guardBroken: 'broken', stone: 'rock', hidden: 'eye', heat: 'flame' };
const BAD = new Set(['burn', 'poison', 'chill', 'stun', 'mark', 'curse', 'webbed', 'silenced', 'cocoon', 'reckless', 'guardBroken']);
const SKILL_ICON = (a, family) => {
  const fx = a.fx || '';
  if (/heal|dawn/.test(fx)) return 'heal';
  if (/ward|shield/.test(fx)) return 'shield';
  if (/war_cry|rune/.test(fx)) return 'fury';
  if (/hex/.test(fx)) return 'skull';
  if (/smoke/.test(fx)) return 'cloud';
  if (/poison/.test(fx)) return 'drop';
  if (/frost/.test(fx)) return 'snow';
  if (/fire/.test(fx)) return 'flame';
  if (/thunder|tempest|lightning/.test(fx)) return 'spark';
  if (/trap/.test(fx)) return 'target';
  return family || 'star';
};
const icon = (name, cls = '') => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', 'gsb-ic ' + cls); s.innerHTML = IC[name] || IC.star; return s; };

// ---------- css ----------
let cssP = null;
function ensureCss() {
  if (cssP) return cssP;
  const href = new URL('../../css/gs-battle.css', import.meta.url).href;
  if (document.querySelector('link[data-gs-battle-css]')) { cssP = Promise.resolve(); return cssP; }
  cssP = new Promise((res) => {
    const link = h('link', { rel: 'stylesheet', href, 'data-gs-battle-css': '1' });
    link.onload = res; link.onerror = res; document.head.appendChild(link); setTimeout(res, 1500);
  });
  return cssP;
}

export async function runBattle(encounterId, opts = {}, ctx) {
  if (!ctx && opts?.state && opts?.stage) { ctx = opts; opts = {}; }
  const E = opts.engine || await import('./battle-rules.js');
  const enc = ctx.content?.encounters?.[encounterId];
  if (!enc) throw new Error('Unknown encounter ' + encounterId);
  await ensureCss();
  const view = new BattleView(ctx, E, encounterId, enc, opts || {});
  try { return await view.run(); }
  finally { view.cleanup(); }
}

const lastPick = new Map();

class BattleView {
  constructor(ctx, E, encId, enc, opts) {
    this.ctx = ctx; this.E = E; this.encId = encId; this.enc = enc; this.opts = opts;
    this.layers = ctx.stage.layers;
    this.els = new Map();
    this.vw = new Map(); // uid -> displayed { hp, maxHp, fury, shield, st:Set }
    this.weakFound = new Set();
    this.defeated = [];
    this.speed = () => window.__LF_SPEED || 1;
    this.reduce = () => !!ctx.settings?.reduceMotion || document.documentElement.classList.contains('lf-reduce');
    this.turns = 0;
    this.taught = {};
  }

  // ---------- small helpers ----------
  sleep(ms) { return this.ctx.sleep(ms); }
  sfx(n, o) { try { this.ctx.audio.sfx(n, o); } catch { /* silent */ } }
  unit(uid) { return this.E.unit(this.b, uid); }
  get units() { return [...this.b.heroes, ...this.b.foes]; }
  anim(el, frames, ms, o = {}) {
    if (!el?.animate) return this.sleep(ms);
    const dur = this.reduce() ? Math.min(ms, 120) : ms;
    try {
      if (!o.keep) for (const x of el.getAnimations?.() || []) if (!(typeof CSSAnimation !== 'undefined' && x instanceof CSSAnimation)) x.cancel();
      el.animate(frames, { duration: Math.max(1, dur / this.speed()), easing: o.easing || 'cubic-bezier(.22,1,.36,1)', fill: o.fill || 'none', delay: (o.delay || 0) / this.speed() });
    } catch { /* ignore */ }
    return this.sleep(dur + (o.delay || 0));
  }
  pickLine(arr) {
    if (!arr || !arr.length) return null;
    let i = Math.floor(this.lineRng() * arr.length);
    if (arr.length > 1 && i === lastPick.get(arr)) i = (i + 1) % arr.length;
    lastPick.set(arr, i);
    return arr[i];
  }
  lineRng() { const r = this.ctx.rng; return r?.float ? r.float() : r?.next ? r.next() : Math.random(); }
  resolveLine(line, mood = 'fierce') {
    if (!line) return null;
    if (typeof line === 'string') return line.trim() ? { text: line, as: 'gm', mood } : null;
    if (typeof line.say === 'string' && line.say.trim()) return { text: line.say, as: line.as || 'gm', mood: line.mood || (line.as && line.as !== 'gm' ? 'cold' : mood) };
    return null;
  }
  // a quick Varg call through the narrator (compact bar during the fight). Never blocks the fight unless awaited.
  call(lineOrPool, { mood, force = false, wait = false } = {}) {
    const ctx = this.ctx;
    let line = lineOrPool;
    let m = mood;
    if (lineOrPool == null || (Array.isArray(lineOrPool) && !lineOrPool.length)) return Promise.resolve();
    if (typeof lineOrPool === 'string' && /^[a-z]+\.[a-zA-Z.]+$/.test(lineOrPool) && !ctx.content.lines?.[lineOrPool]?.length) return Promise.resolve();
    if (typeof lineOrPool === 'string' && ctx.content.lines?.[lineOrPool]) {
      m = mood || POOL_MOOD[lineOrPool] || 'fierce';
      if (!force && CHATTER.has(lineOrPool) && ctx.gm.isBusy?.()) return Promise.resolve();
      line = this.pickLine(ctx.content.lines[lineOrPool]);
    } else if (Array.isArray(lineOrPool)) line = this.pickLine(lineOrPool);
    const r = this.resolveLine(line, m || 'fierce');
    if (!r) return Promise.resolve();
    if (!force && ctx.gm.isBusy?.()) return Promise.resolve();
    const p = Promise.race([ctx.gm.say(r.text, { as: r.as, mood: r.mood, quick: true }), this.sleep(6000)]).catch(() => {});
    return wait ? p : Promise.resolve();
  }
  // story lines (encounter intro, phases, win): spoken in full; taps advance (autoplay advances itself)
  async story(lines, mood = 'ominous', { quick = false } = {}) {
    for (const l of lines || []) {
      const r = this.resolveLine(l, mood);
      if (r) await Promise.race([this.ctx.gm.say(r.text, { as: r.as, mood: r.mood, quick }), this.sleep(quick ? 7000 : 30000)]).catch(() => {});
    }
  }
  async teach(kind) {
    const f = 'teach.' + kind;
    const st = this.ctx.state;
    if (this.taught[kind] || st.flag?.(f) || st.flags?.[f]) return;
    this.taught[kind] = true;
    if (st.setFlag) st.setFlag(f, true); else if (st.flags) st.flags[f] = true;
    // plays while the player acts: it never holds the fight
    this.call(f, { force: true });
  }

  // ---------- run ----------
  async run() {
    const { ctx, E, opts } = this;
    const st = ctx.state;
    this.t0 = performance.now();
    const party = (st.party || []).map((p) => ({ id: p.id, arch: p.arch, name: p.name, hp: p.hp, gear: p.gear }));
    this.b = E.createBattle({
      content: ctx.content, encounterId: this.encId, party, level: st.level || 1, boons: st.boons || [], bag: st.bag || [],
      difficulty: st.difficulty || 'knight', rng: ctx.rng.fork ? ctx.rng.fork('gsb:' + this.encId + ':' + (st.tally?.battles || 0)) : ctx.rng,
      foes: opts.foes || null, foeHp: opts.foeHp, furyBonus: opts.furyBonus, shieldPct: opts.shieldPct,
    });
    this.difficulty = st.difficulty || 'knight';
    this.isBoss = this.enc.kind === 'boss' || this.b.foes.some((f) => f.boss);
    window.__GS_BATTLE = this;
    const bg = opts.bg || this.enc.bg;
    if (bg && ctx.stage.setBg && ctx.stage.bgId !== bg) ctx.stage.setBg(bg, { fade: 0.6 });
    ctx.audio.music?.(this.enc.music || (this.isBoss ? 'gs_boss' : 'gs_battle'));
    for (const f of this.b.foes) st.seeFoe?.(f.type || f.id, false);
    this.build();
    this.sfx(this.isBoss ? 'gs.bell' : 'gs.roar', { volume: 0.7 });
    await this.enter();

    if (!opts.skipIntro && (this.enc.intro || []).length) { this.root.classList.add('is-intro'); await this.story(this.enc.intro, 'ominous'); this.root.classList.remove('is-intro'); }
    document.documentElement.classList.add('gsb-calls');
    const boss = this.b.foes.find((f) => f.boss);
    if (boss) await this.story([this.pickLine(boss.src?.lines?.enter || ctx.content.foes?.[boss.type]?.lines?.enter)], 'ominous', { quick: true });
    else this.call(this.isBoss ? 'battle.boss' : 'battle.start', { force: true });

    let result = null;
    try { result = await this.loop(); }
    catch (e) { console.error('[grimspire battle] loop failed', e); result = this.E.outcome(this.b) || 'lose'; }
    return this.end(result);
  }

  async loop() {
    const { E, b } = this;
    for (let guard = 0; guard < 60; guard++) {
      await this.play(E.beginRound(b));
      if (b.capHit) return 'lose';
      this.renderRibbon();
      const order = E.turnOrder(b);
      for (let i = 0; i < order.length; i++) {
        if (E.outcome(b)) break;
        const uid = order[i];
        const u = this.unit(uid);
        if (!u || u.ko) continue;
        this.renderRibbon(uid);
        await this.play(E.beginTurn(b, uid));
        await this.drainPending();
        if (E.outcome(b)) break;
        if (E.canAct(b, uid)) {
          this.turns++;
          if (u.side === 'hero') await this.heroTurn(u);
          else await this.foeTurn(u);
          await this.drainPending();
        }
        if (E.outcome(b)) break;
        await this.play(E.endTurn(b, uid));
        await this.drainPending();
      }
      const o = E.outcome(b);
      if (o) return o;
      if (b.round === 2 && !this.hinted) await this.weakHint();
    }
    return E.outcome(b) || 'lose';
  }

  async weakHint() {
    this.hinted = true;
    const seen = this.ctx.state.seenFoes || {};
    const f = this.E.livingFoes(this.b).find((x) => !seen[x.type]?.weakKnown && (x.src?.lines?.weakHint || []).length);
    if (f) this.call(f.src.lines.weakHint, { mood: 'fierce', force: true });
    else if (!this.ctx.state.flag?.('teach.weak')) this.teach('weak');
  }

  async drainPending() {
    const { E, b } = this;
    for (let n = 0; n < 8; n++) {
      const list = E.takePending(b);
      if (!list.length) return;
      // every intent takePending handed over is resolved (with its block) before anyone checks the outcome:
      // a last foe's explosion or a counter must land before the victory banner
      for (const p of list) await this.foeAttack(this.unit(p.uid) || { uid: p.uid, name: p.intent?.name || '', side: 'foe' }, p.intent);
    }
  }

  // ---------- build ----------
  build() {
    const { ctx, b } = this;
    document.documentElement.classList.add('gsb-on');
    this.layers.bg.classList.add('gsb-dim');
    this.layers.actor.classList.add('gsb-hide');
    try { ctx.gm.hide(); } catch { /* ignore */ }
    this.canvas = h('canvas.gsb-fx');
    this.floats = h('div.gsb-floats');
    this.unitsEl = h('div.gsb-units');
    this.platesEl = h('div.gsb-plates');
    this.world = h('div.gsb-world', h('div.gsb-ground'), this.unitsEl, this.platesEl, this.canvas, this.floats);
    this.roundEl = h('div.gsb-round', h('small', STR.round), h('b', '1'));
    this.chips = h('div.gsb-chips');
    this.ribbon = h('div.gsb-ribbon', this.roundEl, this.chips);
    this.bossBar = h('div.gsb-bossbar.is-hidden');
    this.banner = h('div.gsb-banner');
    this.bar = h('div.gsb-bar.is-hidden', { 'data-no-advance': '1' });
    this.tip = h('div.gsb-tip');
    this.flashEl = h('div.gsb-flash');
    this.root = h('div.gsb-root', h('div.gsb-vignette'), this.world, this.ribbon, this.bossBar, this.banner, this.bar, this.tip, this.flashEl);
    this.layers.screen.appendChild(this.root);
    this.fx = createGsFx(this.canvas, { pixelRatio: () => ctx.stage.pixelRatio?.() || 1, reduce: this.reduce });
    this.offResize = ctx.stage.onResize?.(() => this.fx.resize());
    this.root.addEventListener('pointerdown', (e) => { if (!e.target.closest('.gsb-st, .gsb-tip')) this.tip.classList.remove('is-on'); });
    this.root.classList.add(`n${Math.min(4, b.heroes.length)}`, `f${Math.min(5, b.foes.filter((f) => !f.boss).length)}`);
    this.layout();
    for (const u of this.units) this.addUnit(u);
    this.renderBoss();
    this.renderRibbon(null);
    this.layoutPlates();
    // names are measured in the real font: fit again once the fonts are in
    document.fonts?.ready?.then(() => { if (this.root?.isConnected) this.fitAll(); });
    this.keyFn = (e) => {
      if (this.bar.classList.contains('is-hidden') || !this.picking) return;
      if (e.key === 'Escape' && this.backFn) { e.preventDefault(); this.backFn(); return; }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9 && this.barKeys?.[n - 1]) { e.preventDefault(); this.barKeys[n - 1].click(); }
    };
    window.addEventListener('keydown', this.keyFn);
  }

  layout() {
    const { b } = this;
    const hs = b.heroes, n = Math.min(4, hs.length);
    hs.forEach((u, i) => {
      const [x, y] = (HERO_SLOTS[n] || HERO_SLOTS[4])[i] || [100 + i * 140, 600];
      u._pos = { x, y, ground: y, h: Math.round((HERO_H[u.arch] || 310) * (HERO_SCALE[n] || 1)), w: 0 };
      u._pos.w = Math.round(u._pos.h * 0.62);
    });
    this.placeFoes(b.foes);
  }
  foeSize(f) {
    const key = f.type || f.id;
    const hh = FOE_H[key] || (f.boss ? 440 : 280);
    return { h: hh, w: Math.round(hh * (FOE_ASPECT[key] || 0.62)), lift: FLY[key] || 0 };
  }
  placeFoes(list) {
    const living = list.filter((f) => !f.ko || this.els.has(f.uid));
    const boss = living.find((f) => f.boss);
    const put = (f, x, y, scale = 1) => {
      const s = this.foeSize(f);
      const hh = Math.round(s.h * scale);
      f._pos = { x, y: y - s.lift * scale, ground: y, h: hh, w: Math.round(s.w * scale) };
    };
    if (boss) {
      put(boss, BOSS_AT[0], BOSS_AT[1]);
      living.filter((f) => f !== boss).forEach((f, i) => { const [x, y] = MINION_SLOTS[i % MINION_SLOTS.length]; put(f, x, y, i >= 2 ? 0.7 : 0.78); });
    } else {
      const n = Math.min(5, living.length);
      const shrink = n >= 5 ? 0.82 : n === 4 ? 0.9 : 1;
      living.forEach((f, i) => { const [x, y] = (FOE_SLOTS[n] || FOE_SLOTS[5])[i] || [760 + i * 100, 600]; put(f, x, y, shrink); });
    }
  }
  // plates sit over heads, never under the top bars, and never on top of each other
  // Plates sit in rows above the heads: on each side every plate starts on the highest row its neighbours allow,
  // so plates never overlap each other and sit above the faces. Helpers next to a boss keep their own height.
  layoutPlates() {
    for (const side of ['hero', 'foe']) {
      const TOP = side === 'hero' ? 204 : this.b.foes.some((f) => f.boss) ? 172 : 92; // under Varg's call bar (left) and the boss bar (right)
      const list = this.units.filter((u) => u.side === side && this.els.has(u.uid) && !(u.boss && side === 'foe') && !u.ko);
      const bossNear = side === 'foe' && this.b.foes.some((f) => f.boss && !f.ko);
      const r = list.map((u) => {
        const el = this.els.get(u.uid), w = el._p.plate.offsetWidth || 170, ph = el._p.plate.offsetHeight || 86;
        const head = u._pos.y - u._pos.h;
        const x = Math.max(w / 2 + 8, Math.min(1272 - w / 2, u._pos.x)); // the whole plate stays on the stage
        el._p.plate.style.marginLeft = Math.round(x - u._pos.x) + 'px';
        return { u, el, w, ph, x, head, pref: Math.max(TOP, head - 12 - ph) };
      }).sort((a, b) => a.x - b.x);
      const place = (base) => {
        const placed = [];
        let lowest = 0;
        for (const p of r) {
          p.top = bossNear ? p.pref : base;
          // the foe intent banner sits at x 475-815, y 94-168: plates under it start below it
          if (p.x - p.w / 2 < 820 && p.x + p.w / 2 > 470) p.top = Math.max(p.top, 172);
          for (let guard = 0; guard < 12; guard++) {
            const hit = placed.find((q) => Math.abs(q.x - p.x) < (q.w + p.w) / 2 + 2 && p.top < q.top + q.ph + 4 && q.top < p.top + p.ph + 4);
            if (!hit) break;
            p.top = hit.top + hit.ph + 4;
          }
          lowest = Math.max(lowest, p.top + p.ph);
          placed.push(p);
        }
        return lowest;
      };
      let base = r.length ? Math.max(TOP, Math.min(...r.map((p) => p.pref))) : TOP;
      // a second row would sit on faces: lift the whole stack so its bottom stays where one row would end
      const oneRow = base + Math.max(0, ...r.map((p) => p.ph));
      const low = place(base);
      if (!bossNear && low > oneRow + 4) { base = Math.max(TOP, base - (low - oneRow)); place(base); }
      for (const p of r) p.el._p.plate.style.bottom = Math.round(p.u._pos.y - p.top - p.ph) + 'px';
    }
  }
  // names fit their plate: a step smaller, or two lines, before anything is cut
  fitName(el, { lines = 2, sizes = [18, 17, 16, 15, 14, 13] } = {}) {
    if (!el) return;
    const avail = el.clientWidth || 140;
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:inherit;letter-spacing:inherit;';
    el.appendChild(probe);
    const words = String(el.firstChild?.nodeType === 3 ? el.firstChild.textContent : el.textContent).split(/\s+/).filter(Boolean);
    let fit = sizes[sizes.length - 1];
    for (const px of sizes) {
      el.style.fontSize = px + 'px';
      const width = (t) => { probe.textContent = t; return probe.offsetWidth; };
      let n = 1, cur = '', ok = true;
      for (const w of words) {
        if (width(w) > avail) { ok = false; break; }
        const next = cur ? cur + ' ' + w : w;
        if (cur && width(next) > avail) { n++; cur = w; } else cur = next;
      }
      if (ok && n <= lines) { fit = px; break; }
    }
    // a single word too long even at the smallest size: widen this plate just enough
    el.style.fontSize = fit + 'px';
    const plate = el.closest('.gsb-plate');
    if (plate && lines > 1) {
      let widest = 0;
      for (const w of words) { probe.textContent = w; widest = Math.max(widest, probe.offsetWidth); }
      if (widest > avail) plate.style.width = Math.min(190, plate.offsetWidth + widest - avail + 4) + 'px';
    }
    probe.remove();
  }
  fitAll() {
    for (const el of this.els.values()) { const pl = el._p.plate; pl.style.width = ''; this.fitName(pl.querySelector('.gsb-name')); }
    this.layoutPlates();
  }
  center(u) { const p = u._pos; return { x: p.x, y: p.y - p.h * 0.52 }; }
  chest(u) { const p = u._pos; return { x: p.x + (u.side === 'hero' ? 6 : -6), y: p.y - p.h * 0.58 }; }

  addUnit(u) {
    const { ctx } = this;
    const isH = u.side === 'hero';
    const p = u._pos;
    const art = u.art || (isH ? 'gs_' + u.arch : u.type);
    const breath = h('div.gsb-breath', { style: { animationDelay: `${-(Math.random() * 3).toFixed(2)}s`, animationDuration: `${(3.2 + Math.random() * 1.2).toFixed(2)}s` } });
    this.fillArt(breath, u, art);
    const body = h('div.gsb-body', breath);
    const hp = h('div.gsb-hp', h('i.gsb-hp-lag'), h('i.gsb-hp-fill'), h('i.gsb-hp-shield'), h('span.gsb-hp-num'));
    const statuses = h('div.gsb-sts');
    const fury = isH ? h('div.gsb-fury', { title: STR.fury }, Array.from({ length: u.furyMax || 5 }, () => h('i'))) : null;
    const plate = h('div.gsb-plate', { class: u.boss ? 'is-boss' : null },
      h('div.gsb-name', isH ? String(u.name || '').split(' ')[0] : u.name), hp, h('div.gsb-plate-row', fury, statuses));
    const el = h('div.gsb-unit', {
      class: [isH ? 'is-hero' : 'is-foe', u.boss ? 'is-boss' : '', p.y < p.ground - 10 ? 'is-flyer' : ''].filter(Boolean).join(' '),
      dataset: { uid: u.uid, id: isH ? u.arch : u.type },
      style: { left: p.x + 'px', top: p.y + 'px', zIndex: String(Math.round(p.ground)) },
    },
    h('div.gsb-shadow', { style: { top: (p.ground - p.y) + 'px', width: Math.round(p.w * 0.9) + 'px' } }),
    h('div.gsb-ring', { style: { top: (p.ground - p.y) + 'px', width: Math.round(Math.max(130, p.w * 1.05)) + 'px' } }),
    body);
    // the plate lives in its own layer (above every cutout) and mirrors the unit's classes and place
    const pw = h('div.gsb-pw', { style: { left: p.x + 'px', top: p.y + 'px' } }, plate);
    const mirror = () => { pw.className = el.className.replace('gsb-unit', 'gsb-pw'); pw.style.left = el.style.left; pw.style.top = el.style.top; };
    new MutationObserver(mirror).observe(el, { attributes: true, attributeFilter: ['class', 'style'] });
    mirror();
    this.platesEl.appendChild(pw);
    plate.addEventListener('click', () => this.onUnitClick?.(u));
    plate.style.bottom = (p.h + 12) + 'px';
    el.addEventListener('click', (e) => { if (e.target.closest('.gsb-st')) return; this.onUnitClick?.(u); });
    statuses.addEventListener('click', (e) => { const s = e.target.closest('.gsb-st'); if (s) { e.stopPropagation(); this.showTip(s, s.dataset.s); } });
    this.els.set(u.uid, el);
    el._p = { body, breath, hp, statuses, plate, fury };
    this.vw.set(u.uid, { hp: u.hp, maxHp: u.maxHp, fury: u.fury || 0, shield: u.shield || 0, st: new Set(Object.keys(u.st || {})) });
    this.unitsEl.appendChild(el);
    this.fitName(plate.querySelector('.gsb-name'));
    this.refresh(u);
    if (u.ko) el.classList.add(isH ? 'is-down' : 'is-gone');
    return el;
  }
  fillArt(breath, u, art) {
    const { ctx } = this;
    const p = u._pos;
    const ph = () => {
      const tint = u.side === 'hero' ? '#ff7a2e' : u.boss ? '#6dffb0' : '#9aa6c8';
      breath.replaceChildren(h('div.gsb-ph', { style: { height: p.h + 'px', width: p.w + 'px', '--tint': tint } },
        h('div.gsb-ph-eyes', h('i'), h('i')), h('span', u.name)));
    };
    const src = ctx.assets.char(art);
    if (ctx.assets.has?.(src) === false) { ph(); return; }
    const img = h('img.gsb-img', { alt: u.name, draggable: 'false', style: { height: p.h + 'px', maxWidth: Math.round(p.h * (u.boss ? 1.5 : 1.3)) + 'px' } });
    img.onerror = ph;
    img.src = src;
    breath.replaceChildren(img);
  }

  // the displayed state of a unit (events move it; reconcile() snaps it to the engine at the end of a batch)
  refresh(u) {
    const el = this.els.get(u.uid); if (!el) return;
    const v = this.vw.get(u.uid);
    const p = el._p;
    const k = v.maxHp ? Math.max(0, v.hp) / v.maxHp : 0;
    p.hp.style.setProperty('--v', String(k));
    p.hp.style.setProperty('--s', String(v.maxHp ? Math.min(1, (v.shield || 0) / v.maxHp) : 0));
    p.hp.classList.toggle('is-low', k > 0 && k <= 0.3);
    p.hp.querySelector('.gsb-hp-num').textContent = `${Math.max(0, Math.round(v.hp))}/${v.maxHp}`;
    if (p.fury) {
      [...p.fury.children].forEach((x, i) => x.classList.toggle('on', i < v.fury));
      p.fury.classList.toggle('is-full', v.fury >= (u.furyMax || 5));
    }
    const list = [...v.st].filter((s) => ST_ICON[s]);
    if (u.heat) list.push('heat');
    const cur = [...p.statuses.children].map((c) => c.dataset.s).join(',');
    if (cur !== list.join(',')) {
      p.statuses.replaceChildren(...list.map((s) => {
        const turns = u.st?.[s]?.turns;
        const stacks = u.st?.[s]?.stacks;
        return h('button.gsb-st', { type: 'button', dataset: { s }, class: BAD.has(s) ? 'is-bad' : 'is-good', 'aria-label': STATUS[s]?.[0] || s, title: STATUS[s]?.[0] || s },
          icon(ST_ICON[s] || 'star'), stacks > 1 ? h('b', String(stacks)) : null, turns > 0 && turns < 9 && !stacks ? h('small', String(turns)) : null);
      }));
    }
    el.classList.toggle('is-stone', v.st.has('stone'));
    el.classList.toggle('is-hidden-u', v.st.has('hidden') || v.st.has('vanish'));
    el.classList.toggle('is-cocoon', v.st.has('cocoon'));
    if (u.boss && this.bossUid === u.uid) this.renderBoss();
  }
  reconcile() {
    for (const u of this.units) {
      const v = this.vw.get(u.uid); if (!v) continue;
      v.hp = u.hp; v.maxHp = u.maxHp; v.fury = u.fury || 0; v.shield = u.shield || 0;
      v.st = new Set(Object.keys(u.st || {}));
      this.refresh(u);
    }
    this.syncState();
  }
  syncState() {
    const st = this.ctx.state;
    for (const u of this.b.heroes) {
      const hero = st.hero?.(u.id) || st.party?.find((x) => x.id === u.id);
      if (!hero) continue;
      const hp = Math.max(0, Math.round(u.hp));
      if (hero.hp !== hp) { hero.hp = hp; this.ctx.bus.emit('party:hp', { id: hero.id, hp, maxHp: hero.maxHp }); }
    }
  }

  renderBoss() {
    const boss = this.b.foes.find((f) => f.boss && !f.ko) || this.b.foes.find((f) => f.boss);
    if (!boss) { this.bossBar.classList.add('is-hidden'); return; }
    this.bossUid = boss.uid;
    const v = this.vw.get(boss.uid) || { hp: boss.hp, maxHp: boss.maxHp, shield: 0 };
    const k = v.maxHp ? Math.max(0, v.hp) / v.maxHp : 0;
    if (!this.bossBar._built || this.bossBar._uid !== boss.uid + boss.name) {
      this.bossBar._built = true; this.bossBar._uid = boss.uid + boss.name; this.bossBar._fit = false;
      const phases = (boss.src?.phases || []).filter((p) => p.at > 0).map((p) => h('i.gsb-boss-mark', { style: { left: (p.at * 100) + '%' } }));
      this.bossBar.replaceChildren(h('div.gsb-boss-top', h('span.gsb-boss-kicker', STR.boss), h('span.gsb-boss-name', boss.name)),
        h('div.gsb-boss-hp', h('i.gsb-hp-lag'), h('i.gsb-hp-fill'), ...phases, h('span.gsb-boss-num')));
    }
    if (!this.bossBar._fit) { this.bossBar._fit = true; requestAnimationFrame(() => this.fitName(this.bossBar.querySelector('.gsb-boss-name'), { lines: 1, sizes: [22, 20, 19, 18, 17, 16] })); }
    const bar = this.bossBar.querySelector('.gsb-boss-hp');
    bar.style.setProperty('--v', String(k));
    this.bossBar.querySelector('.gsb-boss-num').textContent = `${Math.max(0, Math.round(v.hp))} / ${v.maxHp}`;
    this.bossBar.classList.remove('is-hidden');
    this.bossBar.classList.toggle('is-low', k <= 0.3);
  }

  renderRibbon(curUid = this.curUid) {
    this.curUid = curUid;
    const { E, b } = this;
    this.roundEl.querySelector('b').textContent = String(b.round || 1);
    let order = [];
    try { order = E.turnOrder(b); } catch { order = this.units.map((u) => u.uid); }
    const idx = order.indexOf(curUid);
    const chips = order.map((uid, i) => {
      const u = this.unit(uid);
      if (!u) return null;
      const out = u.ko;
      const isH = u.side === 'hero';
      const pid = isH ? 'gs_' + u.arch : (u.art || u.type);
      return h('div.gsb-chip', { class: [isH ? 'is-hero' : 'is-foe', u.boss ? 'is-boss' : '', uid === curUid ? 'is-now' : '', (idx >= 0 && i < idx) || out ? 'is-done' : ''].filter(Boolean).join(' '), title: u.name },
        this.portrait(pid, u));
    }).filter(Boolean);
    this.chips.replaceChildren(...chips);
  }
  portrait(pid, u) {
    const src = this.ctx.assets.portrait(pid);
    const box = h('div.gsb-pt');
    const fallback = () => {
      const csrc = this.ctx.assets.char(pid);
      if (this.ctx.assets.has?.(csrc) === false) { box.replaceChildren(h('span', String(u?.name || '?').slice(0, 1))); return; }
      const ci = h('img.is-char', { alt: '', draggable: 'false' });
      ci.onerror = () => box.replaceChildren(h('span', String(u?.name || '?').slice(0, 1)));
      ci.src = csrc; box.replaceChildren(ci);
    };
    if (this.ctx.assets.has?.(src) === false) { fallback(); return box; }
    const img = h('img', { alt: '', draggable: 'false' });
    img.onerror = fallback;
    img.src = src;
    box.appendChild(img);
    return box;
  }

  showTip(anchor, s) {
    const info = STATUS[s]; if (!info) return;
    this.sfx('ui.tap');
    this.tip.replaceChildren(h('b', info[0]), h('span', info[1]));
    const sr = this.ctx.stage.el.getBoundingClientRect(), r = anchor.getBoundingClientRect();
    const k = 1280 / sr.width;
    this.tip.style.left = Math.max(170, Math.min(1110, (r.left + r.width / 2 - sr.left) * k)) + 'px';
    this.tip.style.top = Math.max(10, (r.top - sr.top) * k - 12) + 'px';
    this.tip.classList.add('is-on');
    clearTimeout(this.tipT); this.tipT = setTimeout(() => this.tip.classList.remove('is-on'), 3600);
  }

  async enter() {
    this.units.forEach((u, i) => {
      const el = this.els.get(u.uid);
      const dx = u.side === 'hero' ? -300 : 300;
      this.anim(el._p.body, [{ transform: `translateX(${dx}px)`, opacity: 0, filter: 'brightness(0)' }, { transform: 'translateX(0)', opacity: 1, filter: 'brightness(1)' }], 640, { delay: i * 70, fill: 'backwards' });
      el._p.plate.animate?.([{ opacity: 0 }, { opacity: 0, offset: 0.6 }, { opacity: 1 }], { duration: (900 + i * 70) / this.speed() });
    });
    this.anim(this.ribbon, [{ transform: 'translate(-50%, -90px)', opacity: 0 }, { transform: 'translate(-50%, 0)', opacity: 1 }], 600);
    await this.sleep(720 + this.units.length * 50);
  }

  // ---------- hero turn ----------
  async heroTurn(u) {
    const { ctx, E, b } = this;
    const el = this.els.get(u.uid);
    el.classList.add('is-active');
    this.root.classList.add('is-hero-turn');
    try {
      let pick;
      if (ctx.auto) {
        this.showBar(u, { preview: true });
        await this.sleep(300);
        const ai = E.chooseAI(b, u.uid);
        pick = { action: this.acts.find((a) => a.id === ai.actionId) || this.acts[0], targets: ai.targetUids || [] };
        const btn = this.bar.querySelector(`[data-act="${CSS.escape(pick.action.id)}"]`);
        btn?.classList.add('is-chosen');
        await this.sleep(200);
      } else pick = await this.pickAction(u);
      this.hideBar();
      this.clearTargets();
      await this.doHeroAction(u, pick.action, pick.targets);
    } finally {
      el.classList.remove('is-active');
      this.root.classList.remove('is-hero-turn');
    }
  }

  async doHeroAction(u, a, targets) {
    const { ctx, E, b } = this;
    const grades = [];
    const tgt = targets.map((t) => this.unit(t)).filter(Boolean);
    if (a.kind === 'skill') this.call(ctx.content.heroes?.[u.arch]?.skills?.find((s) => s.id === a.id)?.lines?.use, { mood: 'fierce' });
    if (a.command && (a.hits || 1) > 0) {
      await this.teach('strike');
      const main = tgt.find((t) => t.side === 'foe') || tgt[0] || E.livingFoes(b)[0];
      const many = a.target === 'allFoes' && E.livingFoes(b).length > 1;
      const at = many ? this.groupCenter(E.livingFoes(b)) : main ? this.chest(main) : { x: 960, y: 380 };
      const el = this.els.get(u.uid);
      el.classList.add('is-winding');
      this.sfx('gs.charge', { volume: 0.4 });
      const hits = Math.max(1, a.hits || 1);
      for (let i = 0; i < hits; i++) {
        let win = a.window;
        if (win == null && main) win = E.commandWindowFor?.(b, u.uid, main.uid) ?? 1;
        const forced = ctx.auto ? R.autoGrade(this.gradeRng(), this.opts.mix || 'auto', 'strike') : null;
        const res = await runCommand(a.command, { at: { x: at.x, y: at.y + (hits > 1 ? (i % 2 ? 14 : -14) : 0) }, window: win ?? 1, color: colorOf(u.weapon?.element || this.heroElement(u, a)),
          host: this.layers.overlay, grade: forced, hint: this.hintFor(a.command), visualRng: null }, ctx);
        grades.push(res.grade);
      }
      el.classList.remove('is-winding');
    }
    const evs = E.resolveHeroAction(b, u.uid, a.id, targets, { grades });
    await this.play(evs, { actor: u, action: a, grades });
  }
  // the one-line "how" under a command: the first three times of each kind in a battle (always on Squire)
  hintFor(kind) {
    const c = (this.hints ||= {});
    c[kind] = (c[kind] || 0) + 1;
    return c[kind] <= 3 || this.difficulty === 'squire';
  }
  gradeRng() {
    const r = this.ctx.auto?.rng || this.ctx.rng;
    if (r?.float) return r;
    return { float: () => (r?.next ? r.next() : Math.random()) };
  }
  heroElement(u, a) {
    const sk = this.ctx.content.heroes?.[u.arch]?.skills?.find((s) => s.id === a.id);
    return sk?.effect?.dmg?.element || null;
  }
  groupCenter(list) {
    const ps = list.map((f) => this.chest(f));
    return { x: ps.reduce((s, p) => s + p.x, 0) / ps.length, y: Math.min(...ps.map((p) => p.y)) + 30 };
  }

  showBar(u, { preview = false } = {}) {
    const { ctx, E, b } = this;
    const acts = E.heroActions(b, u.uid);
    this.acts = acts;
    const v = this.vw.get(u.uid);
    const fam = u.family || ctx.content.heroes?.[u.arch]?.family;
    const card = h('div.gsb-card', this.portrait('gs_' + u.arch, u),
      h('div.gsb-card-info', h('div.gsb-card-name', String(u.name || '').split(' ')[0]),
        h('div.gsb-card-fury', icon('fury'), h('span.gsb-pips', Array.from({ length: u.furyMax || 5 }, (_, i) => h('i', { class: i < v.fury ? 'on' : null }))))));
    this.descEl = h('div.gsb-desc', h('b', STR.turnOf(String(u.name || '').split(' ')[0])));
    this.rowEl = h('div.gsb-acts');
    this.bar.replaceChildren(card, h('div.gsb-main', this.descEl, this.rowEl));
    const items = acts.filter((a) => a.kind === 'item');
    const main = acts.filter((a) => a.kind !== 'item');
    const btns = main.map((a) => this.actButton(a, u, fam, preview));
    const itemQty = items.reduce((s, a) => s + (a.qty || 1), 0);
    const itemBtn = h('button.gsb-act.k-item', { type: 'button', 'aria-disabled': itemQty ? null : 'true', dataset: { act: '_items' } },
      icon('bag', 'gsb-act-ic'), h('span.gsb-act-name', STR_ITEM()), h('span.gsb-act-sub', itemQty ? STR.itemHint(itemQty) : STR.noItems));
    itemBtn.addEventListener('click', () => {
      if (preview || !this.picking) return;
      if (!itemQty) { this.deny(itemBtn, STR.noItems, 'bag'); return; }
      this.sfx('ui.open'); this.showItems(u, items, preview);
    });
    this.rowEl.replaceChildren(...btns, itemBtn);
    this.fitTiles();
    this.barKeys = [...btns, itemBtn];
    this.bar.classList.remove('is-hidden');
    // auto preview: mark the item chosen if the AI picks one
    if (preview) for (const a of items) { const x = h('i', { dataset: { act: a.id } }); x.hidden = true; this.rowEl.appendChild(x); }
  }
  actButton(a, u, fam, preview) {
    const ic = a.kind === 'strike' ? (fam || 'sword') : a.kind === 'defend' ? 'shield' : SKILL_ICON(a, fam);
    const locked = !a.enabled && a.level && (this.ctx.state.level || 1) < a.level;
    const sub = a.kind === 'strike' ? (CMD_NAME[a.command || fam] || STR.strikeHint) : a.kind === 'defend' ? STR.defendHint : locked ? STR.lv(a.level) : !a.enabled && a.why ? a.why : a.cost ? STR.cost(a.cost) : STR.free;
    const btn = h('button.gsb-act', {
      type: 'button', dataset: { act: a.id },
      class: [`k-${a.kind}`, a.ultimate ? 'is-ult' : '', locked ? 'is-locked' : ''].filter(Boolean).join(' '),
      'aria-disabled': a.enabled ? null : 'true',
    },
    a.cost ? h('span.gsb-cost', Array.from({ length: a.cost }, () => h('i'))) : null,
    icon(locked ? 'lock' : ic, 'gsb-act-ic'), h('span.gsb-act-name', a.name), h('span.gsb-act-sub', sub));
    const show = () => this.descEl.replaceChildren(h('b', a.name + ': '), a.enabled ? (a.text || '') : (a.why ? `${a.why}. ${a.text || ''}` : a.text || ''));
    btn.addEventListener('pointerenter', show);
    btn.addEventListener('focus', show);
    btn.addEventListener('click', () => {
      if (preview || !this.picking || this.picking.done) return;
      show();
      if (!a.enabled) { this.deny(btn, locked ? STR.lockedAt(a.level) : a.why, locked ? 'locked' : a.kind); return; }
      this.sfx('ui.confirm');
      this.choose(a, u);
    });
    return btn;
  }
  // a tap on a greyed-out action: a shake, the deny sound, and the reason in big type right above the tile
  // (spoken too when content.lines has a 'deny.<kind>' pool: kinds strike, skill, item, bag, locked)
  deny(btn, why, kind) {
    this.sfx('ui.deny');
    this.anim(btn, [{ transform: 'translateX(0)' }, { transform: 'translateX(-10px)' }, { transform: 'translateX(10px)' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }], 380);
    if (!why) return;
    const el = (this.denyEl ||= h('div.gsb-deny', { role: 'status', 'aria-live': 'assertive' }));
    if (el.parentNode !== this.root) this.root.appendChild(el);
    el.textContent = why;
    const sr = this.ctx.stage.el.getBoundingClientRect(), r = btn.getBoundingClientRect();
    const k = 1280 / (sr.width || 1280);
    el.style.left = Math.max(230, Math.min(1050, (r.left + r.width / 2 - sr.left) * k)) + 'px';
    el.style.top = Math.max(60, (r.top - sr.top) * k - 14) + 'px';
    el.classList.remove('is-on'); void el.offsetWidth; el.classList.add('is-on');
    clearTimeout(this.denyT); this.denyT = setTimeout(() => el.classList.remove('is-on'), 2600);
    if (kind) this.call(`deny.${kind}`, { force: true });
  }
  showItems(u, items, preview) {
    this.descEl.replaceChildren(h('b', STR.items));
    const btns = items.map((a) => {
      const it = this.ctx.content.items?.[a.itemId] || {};
      const pic = h('span.gsb-item-pic');
      const src = this.ctx.assets.item?.(a.itemId);
      if (src && this.ctx.assets.has?.(src) !== false) { const im = h('img', { alt: '', draggable: 'false' }); im.onerror = () => im.remove(); im.src = src; pic.appendChild(im); } else pic.appendChild(icon('bag'));
      const btn = h('button.gsb-act.k-item', { type: 'button', dataset: { act: a.id }, 'aria-disabled': a.enabled ? null : 'true' },
        pic, h('span.gsb-act-name', a.name || it.name || a.itemId), h('span.gsb-act-sub', `x${a.qty || 1}`));
      btn.addEventListener('pointerenter', () => this.descEl.replaceChildren(h('b', (a.name || it.name) + ': '), a.text || it.text || ''));
      btn.addEventListener('click', () => { if (!this.picking) return; if (!a.enabled) { this.deny(btn, a.why || STR.noItems, 'item'); return; } this.sfx('ui.confirm'); this.choose(a, u); });
      return btn;
    });
    const back = h('button.gsb-act.k-back', { type: 'button' }, icon('back', 'gsb-act-ic'), h('span.gsb-act-name', STR.back));
    back.addEventListener('click', () => { this.sfx('ui.close'); this.showBar(u); });
    this.rowEl.replaceChildren(...btns, back);
    this.fitTiles();
    this.barKeys = [...btns, back];
    this.backFn = () => back.click();
  }
  // tile names fit the fixed 132 x 112 tile: a step smaller, then two lines, then a long word split with a hyphen
  fitTiles() { for (const el of this.rowEl?.querySelectorAll('.gsb-act-name') || []) fitTileName(el); }
  hideBar() { this.bar.classList.add('is-hidden'); this.picking = null; this.backFn = null; }

  pickAction(u) {
    return new Promise((resolve) => {
      this.picking = { u, done: false, resolve };
      this.showBar(u);
      const first = this.bar.querySelector('.gsb-act:not([aria-disabled="true"])');
      if (first && !this.ctx.auto) first.focus({ preventScroll: true });
    });
  }
  choose(a, u) {
    const { E, b } = this;
    const finish = (targets) => { if (this.picking.done) return; this.picking.done = true; this.picking.resolve({ action: a, targets }); };
    const ts = E.targetsFor(b, u.uid, a.id);
    if (a.target === 'self') return finish([u.uid]);
    // exactly one valid target (one foe left, a taunt, one hurt ally): no need to ask
    if (a.target === 'allFoes' || a.target === 'allAllies' || ts.length <= 1) return finish(ts);
    // pick a target
    this.descEl.replaceChildren(h('b', a.target === 'foe' ? STR.pickFoe : a.target === 'fallen' ? STR.pickFallen : STR.pickAlly), ` (${a.name})`);
    this.clearTargets();
    for (const uid of ts) this.els.get(uid)?.classList.add(this.unit(uid).side === 'foe' ? 'is-target' : 'is-target-ally');
    const back = h('button.gsb-act.k-back', { type: 'button' }, icon('back', 'gsb-act-ic'), h('span.gsb-act-name', STR.back));
    back.addEventListener('click', () => { this.sfx('ui.close'); this.clearTargets(); this.showBar(u); });
    this.rowEl.replaceChildren(back);
    this.barKeys = [...ts.map((uid) => ({ click: () => this.onUnitClick?.(this.unit(uid)) })), back];
    this.backFn = () => back.click();
    this.onUnitClick = (t) => {
      if (!ts.includes(t.uid)) return;
      this.sfx('ui.confirm');
      this.clearTargets();
      finish([t.uid]);
    };
  }
  clearTargets() { for (const el of this.els.values()) el.classList.remove('is-target', 'is-target-ally', 'is-aimed'); this.onUnitClick = null; }

  // ---------- foe turn ----------
  async foeTurn(f) {
    const intent = this.E.chooseFoeIntent(this.b, f.uid);
    if (!intent) return;
    await this.foeAttack(f, intent);
  }
  async foeAttack(f, intent) {
    const { ctx, E, b } = this;
    if (!f || !intent) return;
    const el = this.els.get(f.uid);
    const big = intent.telegraph === 'big';
    const targets = (intent.targets || []).map((t) => this.unit(t)).filter(Boolean);
    el?.classList.add('is-active');
    for (const t of targets) this.els.get(t.uid)?.classList.add('is-aimed');
    // telegraph: the name of the move, and for a big one the warning
    const label = intent.reason === 'explode' ? STR.explode : intent.reason === 'counter' ? STR.counter : intent.name;
    this.showBanner(f, label, big);
    if (big) {
      this.sfx('gs.roar');
      this.root.classList.add('is-big');
      this.call(intent.lines?.length ? intent.lines : 'foe.big', { mood: intent.lines?.length ? 'fierce' : 'ominous', force: true });
    } else if (intent.lines?.length && this.lineRng() < 0.55) this.call(intent.lines, { mood: 'fierce' });
    // wind-up
    const windup = big ? Math.max(900, Math.min(1600, intent.windup || 1300)) : Math.max(260, Math.min(700, (intent.windup || 800) * 0.6));
    if (el) this.anim(el._p.body, [{ transform: 'translateX(0) scale(1)' }, { transform: `translateX(${f.side === 'foe' ? 26 : -26}px) scale(${big ? 1.08 : 1.03})`, filter: `brightness(${big ? 1.5 : 1.2}) drop-shadow(0 0 24px ${big ? '#ff3d2e' : '#ff8a5a'})` }], windup * 0.55, { fill: 'forwards' });
    await this.sleep(Math.round(windup * (big ? 0.55 : 0.4)));
    let block = 'miss';
    if (intent.block !== false && targets.some((t) => t.side === 'hero')) {
      await this.teach('block');
      const heroes = targets.filter((t) => t.side === 'hero');
      const at = heroes.length > 1 ? this.groupCenter(heroes) : this.chest(heroes[0]);
      const forced = ctx.auto ? R.autoGrade(this.gradeRng(), this.opts.mix || 'auto', 'block') : null;
      const res = await runCommand('block', { at, big, window: intent.window ?? 1, host: this.layers.overlay, grade: forced, hint: this.hintFor(big ? 'bigblock' : 'block') }, ctx);
      block = res.grade;
    }
    this.hideBanner();
    this.root.classList.remove('is-big');
    const evs = E.resolveFoeIntent(b, f.uid, intent, { block });
    await this.play(evs, { foe: f, intent, block });
    if (el) this.anim(el._p.body, [{ transform: 'translateX(0) scale(1)' }], 260);
    el?.classList.remove('is-active');
    for (const t of targets) this.els.get(t.uid)?.classList.remove('is-aimed');
  }
  showBanner(f, text, big) {
    this.banner.className = `gsb-banner is-on${big ? ' is-big' : ''}`;
    // replaceChildren() would print a null as the text "null": build the list without empties
    const kids = [
      big ? h('div.gsb-banner-warn', icon('bang'), h('span', STR.big), icon('bang')) : null,
      h('div.gsb-banner-row', this.portrait(f.art || f.type, f), h('div', h('div.gsb-banner-who', f.name || ''), text ? h('div.gsb-banner-move', String(text)) : null)),
      big ? h('div.gsb-banner-sub', STR.bigSub) : null,
    ].filter(Boolean);
    this.banner.replaceChildren(...kids);
  }
  hideBanner() { this.banner.classList.remove('is-on'); }

  // ---------- event playback ----------
  async play(evs, info = {}) {
    if (!evs || !evs.length) { return; }
    const { ctx } = this;
    let impactDone = false;
    let lunged = null;
    const hitsShown = [];
    const doImpact = async (firstTarget) => {
      if (impactDone) return;
      impactDone = true;
      if (info.actor) lunged = await this.heroLunge(info.actor, info.action, evs);
      else if (info.foe) lunged = await this.foeLunge(info.foe, info.intent, firstTarget);
    };
    for (let i = 0; i < evs.length; i++) {
      const e = evs[i];
      const u = e.uid ? this.unit(e.uid) : null;
      const v = u ? this.vw.get(u.uid) : null;
      switch (e.t) {
        case 'round': this.roundEl.querySelector('b').textContent = String(e.n); this.anim(this.roundEl, [{ transform: 'scale(1.4)' }, { transform: 'scale(1)' }], 420); break;
        case 'turn': break;
        case 'cap': break;
        case 'act': break;
        case 'foeAct': break;
        case 'skip': if (u && e.why !== 'down') { this.pop(u, STR.skip[e.why] || '', 'info'); await this.sleep(300); } break;
        case 'damage': {
          if (!u || !v) break;
          if (['strike', 'skill', 'foe', 'chain', 'volley', 'splash', 'counter', 'explode', 'trap', 'item'].includes(e.source)) await doImpact(u);
          await this.showDamage(u, e, info, hitsShown.length);
          hitsShown.push(u.uid);
          break;
        }
        case 'miss': {
          if (!u) break;
          await doImpact(u);
          this.pop(u, e.why === 'vanish' || e.why === 'hidden' ? STR.vanished : e.why === 'evasive' || e.why === 'dodge' || e.why === 'smoke' ? STR.dodged : STR.miss, 'miss');
          this.anim(this.els.get(u.uid)?._p.body, [{ transform: 'translateX(0)' }, { transform: `translateX(${u.side === 'foe' ? 40 : -40}px) rotate(${u.side === 'foe' ? 5 : -5}deg)` }, { transform: 'translateX(0)' }], 380);
          if (e.why === 'evasive') this.call('strike.dodged', { force: true });
          this.sfx('gs.swing', { volume: 0.5 });
          await this.sleep(150);
          break;
        }
        case 'heal': {
          if (!u || !v) break;
          if (info.actor && !impactDone) { impactDone = true; await this.supportCast(info.actor, info.action, evs); }
          v.hp = e.hp ?? v.hp + e.n; if (e.maxHp) v.maxHp = e.maxHp;
          if (e.revive) { this.els.get(u.uid)?.classList.remove('is-down'); this.pop(u, STR.standUp, 'heal', { dy: -50 }); }
          this.pop(u, `+${e.n}`, 'heal', { big: e.n >= 15 });
          this.fx.heal(this.center(u));
          this.sfx('gs.heal', { volume: 0.7 });
          this.refresh(u);
          await this.sleep(90);
          break;
        }
        case 'shield': {
          if (!u || !v) break;
          if (info.actor && !impactDone && e.n > 0) { impactDone = true; await this.supportCast(info.actor, info.action, evs); }
          v.shield = e.total ?? v.shield + (e.n || 0);
          if (e.n > 0) { this.fx.shield(this.center(u)); this.pop(u, STR.shield(e.n), 'shield', { dy: 20 }); this.sfx('gs.block', { volume: 0.5 }); }
          this.refresh(u);
          break;
        }
        case 'fury': {
          if (!u || !v) break;
          const was = v.fury;
          v.fury = e.total ?? Math.max(0, v.fury + e.n);
          this.refresh(u);
          if (u.side === 'hero' && e.n > 0 && v.fury >= (u.furyMax || 5) && was < (u.furyMax || 5)) {
            this.sfx('gs.fury'); this.pop(u, STR.fury.toUpperCase() + '!', 'fury', { dy: 30 });
            if (!this.taught.fury) this.teach('fury'); else this.call('fury.full');
          }
          break;
        }
        case 'status': {
          if (!u || !v) break;
          if (e.on && info.actor && !impactDone && info.action?.kind === 'skill' && info.action?.target !== 'foe' && info.action?.target !== 'allFoes') { impactDone = true; await this.supportCast(info.actor, info.action, evs); }
          if (e.on) v.st.add(e.status); else v.st.delete(e.status);
          if (e.on && e.status !== 'defend' && e.status !== 'hidden' && e.status !== 'stone') { this.fx.status(this.center(u), e.status); this.pop(u, STATUS[e.status]?.[0] || '', BAD.has(e.status) ? 'bad' : 'good', { dy: 34, small: true }); }
          if (e.status === 'defend' && e.on) { this.fx.shield(this.center(u)); this.pop(u, STR.defend, 'shield', { dy: 20 }); this.sfx('gs.block', { volume: 0.5 }); }
          if (e.status === 'stone') { this.sfx(e.on ? 'gs.bone' : 'gs.frost', { volume: 0.6 }); }
          this.refresh(u);
          break;
        }
        case 'immune': if (u) this.pop(u, STR.immune, 'info', { dy: 34, small: true }); break;
        case 'guardBreak': if (u) { this.pop(u, STR.guardBreak, 'weak', { dy: -60, big: true }); this.sfx('gs.hit.heavy'); this.fx.shock(this.center(u), { color: '#ffd36b', r: 200 }); this.call('guard.broken', { force: true }); await this.sleep(260); } break;
        case 'ko': {
          if (!u) break;
          await doImpact(u);
          await this.knockOut(u);
          break;
        }
        case 'laststand': if (u) { v.hp = e.hp; this.refresh(u); this.pop(u, STR.laststand, 'heal', { dy: -50 }); } break;
        case 'free': if (u) { v.st.delete('cocoon'); this.refresh(u); this.pop(u, STR.free2, 'heal', { dy: -40 }); } break;
        case 'summon': await this.summon(e); break;
        case 'phase': await this.phase(e); break;
        case 'form': await this.formChange(e); break;
        case 'heat': if (u) { this.pop(u, e.reset ? STR.cooled : STR.heat(e.heat), e.reset ? 'shield' : 'bad', { dy: 30, small: true }); u.heat = e.reset ? 0 : e.heat; this.refresh(u); } break;
        case 'page': if (u) { const en = STR.el[e.element] || e.element, wn = STR.el[e.weakTo] || e.weakTo; this.showPage(u, e, en, wn); await this.sleep(700); } break;
        case 'opening': if (u) { this.pop(u, STR.opening, 'weak', { dy: -60, big: true }); this.fx.shock(this.center(u), { color: '#ffffff', r: 260 }); this.sfx('gs.crit'); await this.hitStop(140); await this.sleep(400); } break;
        case 'stagger': if (u) this.pop(u, STR.stagger, 'info', { dy: 20, small: true }); break;
        case 'explode': if (u) { this.pop(u, STR.explode, 'bad', { dy: -40, big: true }); this.fx.impact(this.center(u), { element: 'fire', big: true }); this.sfx('gs.fire'); await this.shake(1.2); } break;
        case 'counter': if (u) { this.pop(u, STR.counter, 'bad', { dy: -40 }); await this.sleep(150); } break;
        case 'trap': if (u) { if (e.on) this.pop(u, STR.trapSet, 'good', { dy: 30, small: true }); else { const t = this.unit(e.target) || u; this.pop(t, STR.trapSprung, 'weak', { dy: -40 }); this.fx.play('trap', { to: this.center(t) }); } } break;
        case 'item': {
          try { ctx.state.useItem?.(e.itemUid, { applied: true }) || ctx.state.removeItem?.(e.itemUid); } catch (err) { console.warn('[grimspire battle] item', err); }
          if (u) { this.sfx('ui.open'); this.pop(u, ctx.content.items?.[e.itemId]?.name || '', 'info', { dy: -10, small: true }); await this.sleep(150); }
          break;
        }
        case 'defend': if (u) { v.st.add('defend'); this.refresh(u); } break;
        case 'say': if (e.pool) this.sayPool(e.pool, u, info); break;
        default: if (!this.warned?.has(e.t)) { (this.warned ||= new Set()).add(e.t); console.warn('[grimspire battle] unknown event', e.t, e); }
      }
    }
    if (info.actor && !impactDone && info.action?.kind !== 'item') await this.supportCast(info.actor, info.action, evs);
    if (lunged) await lunged();
    this.reconcile();
    if (info.actor || info.foe) await this.sleep(110);
  }

  sayPool(pool, u, info) {
    // the hunter's own strike lines now and then, instead of the shared pool
    const grade = /^strike\.(perfect|good|weak)$/.exec(pool)?.[1];
    if (grade && info.actor && this.lineRng() < 0.45) {
      const own = this.ctx.content.heroes?.[info.actor.arch]?.strike?.lines?.[grade];
      if (own?.length) return this.call(own, { mood: grade === 'weak' ? 'dry' : 'fierce' });
    }
    if (pool === 'hero.down') return this.call(pool, { force: true });
    return this.call(pool);
  }

  async showDamage(u, e, info, idx) {
    const v = this.vw.get(u.uid);
    const el = this.els.get(u.uid);
    const perfect = e.grade === 'perfect' && (e.source === 'strike' || e.source === 'skill');
    const blockP = e.block === 'perfect';
    const big = e.big || e.crit || perfect || (v.maxHp && e.n >= v.maxHp * 0.25);
    const element = e.element || (CRUMBLE[u.type] === 'bone' && e.source === 'foe' ? 'bone' : null) || 'none';
    if (idx) await this.sleep(70);
    if (perfect || e.crit) await this.hitStop(perfect ? 120 : 80);
    this.fx.impact(this.chest(u), { element: element === 'none' && u.side === 'foe' ? (CRUMBLE[u.type] === 'bone' ? 'bone' : 'none') : element, big, perfect });
    this.sfx(e.crit ? 'gs.crit' : big ? 'gs.hit.heavy' : 'gs.hit', { volume: e.source === 'burn' || e.source === 'poison' ? 0.5 : 1 });
    if (e.element) this.sfx('gs.' + e.element, { volume: 0.7 });
    if (perfect) this.flash();
    if (big) this.shake(e.crit || perfect ? 1.3 : 1);
    else if (e.n > 0) this.shake(0.4);
    // the hit reaction
    if (el && e.n > 0) {
      const dir = u.side === 'foe' ? 1 : -1;
      this.anim(el._p.body, [{ transform: 'translateX(0)', filter: 'brightness(1)' }, { transform: `translateX(${dir * (big ? 30 : 16)}px) skewX(${-dir * 4}deg)`, filter: 'brightness(2.4) saturate(0.4)', offset: 0.15 }, { transform: 'translateX(0)', filter: 'brightness(1)' }], big ? 420 : 300);
    }
    v.hp = e.hp ?? Math.max(0, v.hp - e.n);
    if (e.maxHp) v.maxHp = e.maxHp;
    if (e.absorbed) v.shield = Math.max(0, (v.shield || 0) - e.absorbed);
    this.refresh(u);
    // the number and the call-outs
    const kind = e.source === 'burn' ? 'burn' : e.source === 'poison' ? 'poison' : e.crit ? 'crit' : e.weak ? 'weakhit' : u.side === 'hero' ? 'hurt' : 'dmg';
    this.pop(u, e.n > 0 ? String(e.n) : '0', kind, { big, num: true });
    if (e.absorbed) this.pop(u, `-${e.absorbed}`, 'shield', { dy: 46, small: true });
    let calloutY = -70;
    if (e.weak) {
      this.pop(u, STR.weak, 'weak', { dy: calloutY, big: true }); calloutY -= 44;
      const type = u.type || u.id;
      if (!this.weakFound.has(type)) {
        this.weakFound.add(type);
        this.ctx.state.seeFoe?.(type, true);
        if (!this.taught.weak && !this.ctx.state.flag?.('teach.weak')) this.teach('weak');
      }
    }
    if (e.resist) { this.pop(u, STR.resist, 'resist', { dy: calloutY }); calloutY -= 40; }
    if (e.crit) this.pop(u, STR.crit, 'crit', { dy: calloutY, big: true });
    if (u.side === 'hero' && e.block && e.source === 'foe') {
      if (blockP) { this.fx.shield(this.center(u)); this.sfx('gs.block.perfect', { volume: 0.6 }); }
    }
    await this.sleep(big ? 150 : 70);
  }

  async heroLunge(u, a, evs) {
    const el = this.els.get(u.uid);
    if (!el) return null;
    const fam = u.family || this.ctx.content.heroes?.[u.arch]?.family;
    const fxId = (a?.kind === 'strike' ? FAMILY_FX[fam] : a?.fx) || FAMILY_FX[fam] || 'strike_sword';
    const targets = [...new Set(evs.filter((e) => (e.t === 'damage' || e.t === 'miss') && this.unit(e.uid)?.side === 'foe').map((e) => e.uid))].map((x) => this.unit(x)).filter(Boolean);
    const first = targets[0];
    const ranged = RANGED_FX.has(fxId) || fam === 'staff' || fam === 'bow';
    const element = evs.find((e) => e.t === 'damage' && e.element)?.element || this.heroElement(u, a) || null;
    this.sfx('gs.swing');
    if (!ranged && first) {
      const dx = Math.max(0, first._pos.x - u._pos.x - 180) * (targets.length > 1 ? 0.6 : 1);
      this.anim(el._p.body, [{ transform: 'translate(0,0)' }, { transform: `translate(${-18}px, 4px) scale(0.97)`, offset: 0.25 }, { transform: `translate(${dx}px, -6px) scale(1.04)` }], 230, { fill: 'forwards', easing: 'cubic-bezier(.5,0,.75,0)' });
      await this.sleep(150);
    } else {
      this.anim(el._p.body, [{ transform: 'translate(0,0)' }, { transform: 'translate(-12px, 2px) scale(1.03)', filter: 'brightness(1.4)' }], 160, { fill: 'forwards' });
      await this.sleep(90);
    }
    await this.fx.play(fxId, { from: this.chest(u), to: first ? this.chest(first) : { x: 960, y: 380 }, targets: targets.map((t) => this.chest(t)), element: element || 'none', ranged });
    return async () => { await this.sleep(40); this.anim(el._p.body, [{ transform: 'translate(0,0) scale(1)' }], 300); };
  }
  async supportCast(u, a, evs) {
    if (!u || !a) return;
    const el = this.els.get(u.uid);
    const targets = [...new Set(evs.filter((e) => ['heal', 'shield', 'status', 'fury'].includes(e.t)).map((e) => e.uid))].map((x) => this.unit(x)).filter(Boolean);
    const fxId = a.fx || (a.kind === 'defend' ? 'shield_glow' : a.kind === 'item' ? 'heal' : 'rune_glow');
    if (el) this.anim(el._p.body, [{ transform: 'translateY(0)', filter: 'brightness(1)' }, { transform: 'translateY(-10px)', filter: 'brightness(1.6)', offset: 0.4 }, { transform: 'translateY(0)', filter: 'brightness(1)' }], 460);
    this.sfx(a.kind === 'defend' ? 'gs.block' : 'gs.spirit', { volume: 0.6 });
    await this.fx.play(fxId, { from: this.chest(u), targets: targets.map((t) => this.chest(t)), to: targets[0] ? this.chest(targets[0]) : this.chest(u) });
  }
  async foeLunge(f, intent, first) {
    const el = this.els.get(f.uid);
    if (!el) return null;
    const targets = (intent?.targets || []).map((t) => this.unit(t)).filter(Boolean);
    const t0 = first || targets[0];
    const ranged = RANGED_MOVE.test(intent?.moveId || '') || targets.length > 1;
    const element = intent?.element || null;
    this.sfx('gs.swing');
    if (!ranged && t0) {
      const dx = -Math.max(0, f._pos.x - t0._pos.x - 200);
      this.anim(el._p.body, [{ transform: `translateX(26px) scale(1.03)` }, { transform: `translateX(${dx}px) scale(1.06)` }], 220, { fill: 'forwards', easing: 'cubic-bezier(.5,0,.75,0)' });
      await this.sleep(150);
      await this.fx.foe(intent?.moveId?.includes('slam') || intent?.moveId?.includes('crash') ? 'slam' : 'claw', { from: this.chest(f), targets: targets.map((t) => this.chest(t)), element: element || 'none' });
    } else {
      this.anim(el._p.body, [{ transform: 'translateX(26px) scale(1.03)' }, { transform: 'translateX(-14px) scale(1.06)', filter: 'brightness(1.5)' }], 200, { fill: 'forwards' });
      await this.sleep(120);
      await this.fx.foe(targets.length > 1 ? 'breath' : 'bolt', { from: this.chest(f), targets: targets.map((t) => this.chest(t)), element: element || 'none' });
    }
    return async () => { await this.sleep(30); this.anim(el._p.body, [{ transform: 'translateX(0) scale(1)' }], 300); };
  }

  async knockOut(u) {
    const el = this.els.get(u.uid);
    const v = this.vw.get(u.uid);
    if (v) { v.hp = 0; this.refresh(u); }
    if (u.side === 'hero') {
      this.sfx('gs.ko');
      el?.classList.add('is-down');
      this.pop(u, STR.down, 'hurt', { dy: -40 });
      this.call('hero.down', { force: true });
      await this.sleep(350);
      return;
    }
    const type = u.type || u.id;
    this.defeated.push(type);
    const kind = CRUMBLE[type] || 'shadow';
    this.sfx(kind === 'bone' ? 'gs.bone' : 'gs.ko');
    await this.hitStop(70);
    this.fx.crumble({ x: u._pos.x, y: u._pos.y }, { w: u._pos.w, h: u._pos.h, element: kind });
    if (el) {
      el.classList.add('is-dying');
      this.anim(el._p.body, [{ opacity: 1, filter: 'brightness(1)', transform: 'translateY(0)' }, { opacity: 1, filter: 'brightness(3) saturate(0)', offset: 0.2 }, { opacity: 0, filter: 'brightness(0.5) blur(6px)', transform: 'translateY(30px) scaleY(0.85)' }], 900, { fill: 'forwards' });
    }
    if (u.boss) {
      await this.sleep(500);
      await this.story([this.pickLine(u.src?.lines?.defeat || this.ctx.content.foes?.[type]?.lines?.defeat)], 'fierce', { quick: true });
    } else await this.sleep(260);
    el?.classList.add('is-gone');
  }

  async summon(e) {
    const u = this.unit(e.uid);
    if (!u || this.els.has(u.uid)) return;
    this.placeFoes(this.b.foes.filter((f) => !f.ko || f === u));
    // move existing foes to their new spots
    for (const f of this.b.foes) {
      const el = this.els.get(f.uid);
      if (el && f._pos) { el.style.left = f._pos.x + 'px'; el.style.top = f._pos.y + 'px'; el.style.zIndex = String(Math.round(f._pos.ground)); el._p.plate.style.bottom = (f._pos.h + 12) + 'px'; }
    }
    const el = this.addUnit(u);
    this.layoutPlates();
    this.fx.summon(this.center(u));
    this.sfx('gs.spirit');
    this.anim(el._p.body, [{ transform: 'translateY(40px) scale(0.6)', opacity: 0, filter: 'brightness(0)' }, { transform: 'translateY(0) scale(1)', opacity: 1, filter: 'brightness(1)' }], 600);
    if (!this.summonedOnce) { this.summonedOnce = true; this.pop(u, STR.summon, 'bad', { dy: -40 }); }
    await this.sleep(360);
  }

  async phase(e) {
    const u = this.unit(e.uid);
    if (!u) return;
    const el = this.els.get(u.uid);
    this.sfx('gs.bell'); this.sfx('gs.roar', { volume: 0.8 });
    el?.classList.add('is-phasing');
    this.fx.phase(this.center(u), { element: u.type === 'gs_brann' ? 'fire' : u.type === 'gs_vex' ? 'frost' : 'spirit' });
    await this.shake(1.4);
    this.root.classList.add('is-phase');
    await this.story(e.lines || [], 'ominous', { quick: true });
    this.root.classList.remove('is-phase');
    el?.classList.remove('is-phasing');
  }

  async formChange(e) {
    const u = this.unit(e.uid);
    if (!u) return;
    const el = this.els.get(u.uid);
    const v = this.vw.get(u.uid);
    this.sfx('gs.roar'); this.sfx('gs.bell', { volume: 0.8 });
    this.flash('#6dffb0');
    this.fx.phase(this.center(u), { element: 'spirit' });
    if (el) {
      await this.anim(el._p.body, [{ filter: 'brightness(1)', opacity: 1 }, { filter: 'brightness(4) saturate(0)', opacity: 1, offset: 0.4 }, { filter: 'brightness(4)', opacity: 0 }], 700, { fill: 'forwards' });
      // the new shape: new size, new art, new name plate
      this.placeFoes(this.b.foes);
      el.style.left = u._pos.x + 'px'; el.style.top = u._pos.y + 'px';
      el._p.plate.style.bottom = (u._pos.h + 12) + 'px';
      el.dataset.id = u.type || e.to;
      this.fillArt(el._p.breath, u, e.art || u.art || e.to);
      const nm = el._p.plate.querySelector('.gsb-name');
      nm.textContent = e.name || u.name; this.fitName(nm);
      this.layoutPlates();
      el.classList.remove('is-gone', 'is-dying');
      for (const x of el._p.body.getAnimations?.() || []) x.cancel();
      this.anim(el._p.body, [{ transform: 'translateY(60px) scale(0.5)', opacity: 0, filter: 'brightness(4)' }, { transform: 'translateY(0) scale(1)', opacity: 1, filter: 'brightness(1)' }], 900);
    }
    // a fresh Health bar fills up
    v.maxHp = e.maxHp || u.maxHp; v.hp = 0; this.refresh(u);
    this.bossBar._built = false; this.renderBoss();
    await this.sleep(300);
    v.hp = e.hp || u.hp; this.refresh(u); this.renderBoss();
    this.sfx('gs.fury');
    await this.sleep(700);
    this.ctx.audio.music?.('gs_final');
  }

  showPage(u, e, en, wn) {
    const el = h('div.gsb-page', { style: { left: u._pos.x + 'px', top: Math.max(220, u._pos.y - u._pos.h - 90) + 'px', '--c': colorOf(e.element) } },
      h('b', STR.page(en)), h('span', STR.weakTo(wn)));
    this.floats.appendChild(el);
    keepInside(el);
    this.sfx('gs.' + (e.element || 'spirit'), { volume: 0.6 });
    setTimeout(() => el.remove(), 2600 / this.speed());
  }

  // ---------- juice ----------
  pop(u, text, kind = 'dmg', { dy = 0, big = false, small = false, num = false } = {}) {
    if (text == null || text === '' || text === 'null' || text === 'undefined' || !u) return;
    const p = u._pos ? { x: u._pos.x + (Math.random() - 0.5) * (num ? 30 : 0), y: u._pos.y - u._pos.h * 0.72 } : u;
    const el = h('div.gsb-pop', { class: [`k-${kind}`, big ? 'is-big' : '', small ? 'is-small' : '', num ? 'is-num' : ''].filter(Boolean).join(' '),
      style: { left: Math.round(p.x) + 'px', top: Math.round(Math.max(120, p.y + dy)) + 'px', animationDuration: `${Math.round((num ? 1150 : 1400) / this.speed())}ms` } }, text);
    this.floats.appendChild(el);
    keepInside(el);
    setTimeout(() => el.remove(), (num ? 1250 : 1500) / this.speed());
  }
  async hitStop(ms) {
    if (this.reduce()) return;
    this.root.classList.add('is-stop');
    this.fx.freeze(ms);
    await this.sleep(ms);
    this.root.classList.remove('is-stop');
  }
  flash(color = '#ffffff') {
    this.flashEl.style.setProperty('--c', color);
    this.flashEl.classList.remove('is-on'); void this.flashEl.offsetWidth; this.flashEl.classList.add('is-on');
    this.anim(this.world, [{ transform: 'scale(1.035)' }, { transform: 'scale(1)' }], 320, { keep: true });
  }
  shake(k = 1) {
    if (this.reduce()) return Promise.resolve();
    const a = 10 * k;
    return this.anim(this.root, [
      { transform: 'translate(0,0)' }, { transform: `translate(${-a}px, ${a * 0.4}px)` }, { transform: `translate(${a * 0.8}px, ${-a * 0.5}px)` },
      { transform: `translate(${-a * 0.5}px, ${a * 0.3}px)` }, { transform: `translate(${a * 0.3}px, 0)` }, { transform: 'translate(0,0)' }], 300 + k * 60, { keep: true });
  }

  // ---------- the end ----------
  async end(result) {
    const { ctx, b } = this;
    this.hideBar();
    this.hideBanner();
    this.clearTargets();
    document.documentElement.classList.remove('gsb-calls');
    let fin = null;
    try { fin = this.E.finish(b); } catch (e) { console.warn('[grimspire battle] finish', e); }
    this.reconcile();
    const t = fin?.tally || {};
    const seconds = Math.round((performance.now() - this.t0) * this.speed() / 1000);
    const out = {
      result: result === 'win' ? 'win' : 'lose', turns: this.turns, seconds, rounds: b.round,
      perfects: t.perfects || 0, goods: t.goods || 0, weaks: t.weaks || 0, perfectBlocks: t.perfectBlocks || 0, blocks: t.blocks || 0, bestHit: t.bestHit || 0,
      defeated: this.defeated, weakFound: [...this.weakFound],
    };
    const st = ctx.state;
    st.tallyAdd?.('battles', 1);
    st.tallyAdd?.(out.result === 'win' ? 'wins' : 'defeats', 1);
    for (const k of ['perfects', 'goods', 'weaks', 'perfectBlocks', 'blocks']) if (out[k]) st.tallyAdd?.(k, out[k]);
    if (st.tallyMax) st.tallyMax('bestHit', out.bestHit); else if (st.tally) st.tally.bestHit = Math.max(st.tally.bestHit || 0, out.bestHit);

    const win = out.result === 'win';
    this.sfx(win ? 'gs.victory' : 'gs.defeat');
    if (win) for (const u of b.heroes) if (!u.ko) this.els.get(u.uid)?.classList.add('is-cheer');
    if (win) ctx.audio.music?.('gs_victory');
    this.root.classList.add(win ? 'is-won' : 'is-lost');
    const ban = h('div.gsb-end', { class: win ? 'is-win' : 'is-lose' }, h('div.gsb-end-title', win ? STR.victory : STR.defeat), h('div.gsb-end-sub', win ? STR.victorySub : STR.defeatSub));
    this.root.appendChild(ban);
    await this.sleep(60);
    ban.classList.add('is-on');
    if (win) this.fx.shock({ x: 640, y: 330 }, { color: '#ffd36b', r: 520 });
    await this.sleep(900);
    if (win && (this.enc.win || []).length) await this.story(this.enc.win, 'excited', { quick: !!ctx.auto });
    else await this.call(win ? 'battle.win' : 'battle.lose', { force: true, wait: true });
    await this.sleep(win ? 500 : 900);
    ban.classList.remove('is-on');
    return out;
  }

  cleanup() {
    const { ctx } = this;
    if (window.__GS_BATTLE === this) delete window.__GS_BATTLE;
    if (this.keyFn) window.removeEventListener('keydown', this.keyFn);
    this.fx?.dispose();
    this.offResize?.();
    try { ctx.gm.hide(); } catch { /* ignore */ }
    document.documentElement.classList.remove('gsb-on', 'gsb-calls');
    this.layers.bg.classList.remove('gsb-dim');
    this.layers.actor.classList.remove('gsb-hide');
    for (const x of [...this.layers.overlay.querySelectorAll('.gsc-root')]) x.remove();
    if (this.root) { this.root.classList.add('is-out'); const r = this.root; setTimeout(() => r.remove(), 420); }
  }
}

// a name one step smaller when it is long; the plate wraps it to two lines before anything is cut
function fitName() {}
const TILE_W = 116, TILE_SIZES = [17, 16, 15, 14, 13];
function fitTileName(el) {
  const text = el.dataset.full || el.textContent;
  el.dataset.full = text;
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:inherit;letter-spacing:inherit;text-transform:inherit;';
  el.appendChild(probe);
  const width = (t) => { probe.textContent = t; return probe.offsetWidth; };
  const words = String(text).split(/\s+/).filter(Boolean);
  const plan = (split) => { // -> pieces (with split: a too-long word cut in two, the first half ending in a hyphen) or null
    const out = [];
    for (const w of words) {
      if (width(w) <= TILE_W) { out.push(w); continue; }
      if (!split) return null;
      let best = null;
      for (let i = 3; i <= w.length - 3; i++) {
        const a = w.slice(0, i) + '-', b = w.slice(i), wa = width(a), wb = width(b);
        if (wa <= TILE_W && wb <= TILE_W && (!best || Math.max(wa, wb) < best.m)) best = { i, m: Math.max(wa, wb) };
      }
      if (!best) return null;
      out.push({ a: w.slice(0, best.i), b: w.slice(best.i) });
    }
    let n = 1, cur = '';
    const add = (t) => { const next = cur ? cur + ' ' + t : t; if (cur && width(next) > TILE_W) { n++; cur = t; } else cur = next; };
    for (const t of out) { if (typeof t === 'string') add(t); else { add(t.a + '-'); n++; cur = t.b; } }
    return n <= 2 ? out : null;
  };
  let pieces = null, px = TILE_SIZES[TILE_SIZES.length - 1];
  // smaller type first; a word is only cut when it is too wide even at the smallest size
  for (const split of [false, true]) {
    for (const size of TILE_SIZES) { el.style.fontSize = size + 'px'; const t = plan(split); if (t) { pieces = t; px = size; break; } }
    if (pieces) break;
  }
  probe.remove();
  el.style.fontSize = px + 'px';
  if (pieces && pieces.some((t) => typeof t !== 'string')) {
    // a soft hyphen breaks the long word exactly there, with a visible hyphen
    el.textContent = pieces.map((t) => (typeof t === 'string' ? t : t.a + '\u00AD' + t.b)).join(' ');
  } else el.textContent = text;
}
function nameClass(name) { const n = String(name || '').length; return n > 17 ? 'is-long is-xlong' : n > 12 ? 'is-long' : ''; }
// a pop is centred on its point; nudge it so its whole box stays inside the 1280 x 800 stage
function keepInside(el) {
  const w = el.offsetWidth || 0, x = parseFloat(el.style.left) || 0;
  const min = w * 0.6 + 10, max = 1280 - w * 0.6 - 10; // room for the punch-in overshoot
  if (w && (x < min || x > max)) el.style.left = Math.round(Math.max(min, Math.min(max, x))) + 'px';
  const y = parseFloat(el.style.top) || 0, hh = el.offsetHeight || 0;
  if (hh && y - hh / 2 < 8) el.style.top = Math.round(hh / 2 + 8) + 'px';
}
function STR_ITEM() { return STR_I.item; }
const STR_I = L({ en: { item: 'Item' }, da: { item: 'Ting' } });
