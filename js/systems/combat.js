// Turn-based battles (SPEC 5, 9, 12). Rules live in combat-rules.js (pure); this file plays them on the stage.
//
// runCombat(encounterId, ctx) -> { result:'win'|'befriend'|'lose', befriended:[types], defeated:[types] }
// runCombat(encounterId, opts, ctx) also works; opts.lose (or opts.hasLose) = the scene step has a `lose` branch,
//   so an all-dazed party returns 'lose' instead of the Storykeeper's rewind mercy.
// Autoplay (ctx.auto): heroes act by a simple AI (heal when hurt, befriend sometimes under policy kind, else attack
// the weakest). Every wait goes through ctx.sleep; nothing waits on animationend.
import { h } from '../ui/dom.js';
import * as R from '../core/rules.js';
import { L } from '../core/i18n.js';
import * as C from './combat-rules.js';
import { createFx } from './combat-fx.js';
import { voiceId } from '../core/voiceid.js';

export * from './combat-rules.js';

// Unspoken UI text (one place; English and Danish, read in the current language at access time).
const STR = L({
  en: {
    round: 'Round', turn: (n) => `What will ${n} do?`, chooseFoe: 'Tap a foe', chooseCalm: 'Tap a foe to win over',
    chooseAlly: 'Tap a friend', chooseOther: 'Tap a friend (not yourself)', second: 'Second arrow: tap a foe (the same one is fine)',
    back: 'Back', sparks: 'Sparks', free: 'Free', items: 'Pick something from the pack', victory: 'Victory!', friends: 'New Friends!',
    victorySub: 'The battle is won', friendsSub: 'Not a single foe left unhappy', miss: 'Miss', crit: 'Critical!', fumble: 'Oops!',
    hit: 'Hit!', success: 'Success!', notYet: 'Not yet', weak: 'Weak spot! +3', calm: (n) => `+${n} calm`, liked: 'They like that! +3',
    armour: 'Armour off!', armourSub: 'Easier to hit, but it acts twice a round now', blocked: 'Shielded', dazed: 'Dazed',
    stunned: 'Stunned!', asleep: 'Zzz...', dizzy: 'Dizzy! -4', next: (m) => `Next turn: ${m}!`, wakeUp: 'Awake!', revive: 'Back up!',
    needs: (n) => `needs ${n}`, hits: (n) => (n === 1 ? '1 hit' : `${n} hits!`), vsEach: (foe) => (foe ? 'against each hero' : 'against each foe'), coins: (n) => `+${n} coins`, star: 'A Star!', encore: 'Encore!', thorns: 'Thornlings to the rescue!',
    secondWind: 'Second wind', rewind: 'The page turns back...', fled: 'The foes run off!', levelLock: 'Level 3',
    guardOn: 'Guarding', calmLabel: 'Calm', youGet: 'You found', gift: (n) => `Gave a ${n}`,
    reroll: 'Spend a Star to roll again? You keep the better die.', spend: 'Spend a Star', keep: 'Keep it',
    spendHint: (n) => `${n} left`, keepHint: 'Take the miss', rerolled: 'Star reroll!',
  },
  da: {
    round: 'Runde', turn: (n) => `Hvad gør ${n}?`, chooseFoe: 'Tryk på en fjende', chooseCalm: 'Tryk på den, du vil være ven med',
    chooseAlly: 'Tryk på en ven', chooseOther: 'Tryk på en ven (ikke dig selv)', second: 'Anden pil: tryk på en fjende (gerne den samme)',
    back: 'Tilbage', sparks: 'Gnister', free: 'Gratis', items: 'Vælg noget fra tasken', victory: 'Sejr!', friends: 'Nye venner!',
    victorySub: 'Kampen er vundet', friendsSub: 'Ingen fjender er kede af det mere', miss: 'Forbi', crit: 'Fuldtræffer!', fumble: 'Ups!',
    hit: 'Ramt!', success: 'Det lykkes!', notYet: 'Ikke endnu', weak: 'Svagt punkt! +3', calm: (n) => `+${n} ro`, liked: 'Det kan den lide! +3',
    armour: 'Rustningen er væk!', armourSub: 'Lettere at ramme, men nu går den to gange hver runde', blocked: 'Skærmet', dazed: 'Omtumlet',
    stunned: 'Lamslået!', asleep: 'Zzz...', dizzy: 'Svimmel! -4', next: (m) => `Næste tur: ${m}!`, wakeUp: 'Vågen!', revive: 'Oppe igen!',
    needs: (n) => `kræver ${n}`, hits: (n) => (n === 1 ? '1 ramt' : `${n} ramt!`), vsEach: (foe) => (foe ? 'mod hver helt' : 'mod hver fjende'), coins: (n) => `+${n} mønter`, star: 'En Stjerne!', encore: 'En tur til!', thorns: 'Tornlingerne kommer til hjælp!',
    secondWind: 'Nye kræfter', rewind: 'Siden bladrer tilbage...', fled: 'Fjenderne stikker af!', levelLock: 'Niveau 3',
    guardOn: 'I værn', calmLabel: 'Ro', youGet: 'Du fandt', gift: (n) => `Gave: ${n}`,
    reroll: 'Brug en Stjerne og slå igen? Du beholder det bedste slag.', spend: 'Brug en Stjerne', keep: 'Behold det',
    spendHint: (n) => `${n} tilbage`, keepHint: 'Lad den gå forbi', rerolled: 'Slået igen!',
  },
});

// one short hint under each action button (the full text shows in the strip above)
const HINT = L({
  en: {
    strike: 'Free attack', befriend: 'Win over, Heart', guard: 'Safer, +1 Spark', item: 'From the pack',
    shield_bash: 'Hit and stun', guardians_vow: 'Shield a friend', lionheart_charge: 'Hit every foe', star_bolt: 'Big bright hit',
    sleepy_dust: 'Send to sleep', comet_shower: 'Hit every foe', twin_arrows: 'Two shots', biscuit_go: 'Nip and mark',
    rain_of_arrows: 'Hit and mark all', sneak_strike: 'Sneaky big hit', smoke_puff: 'Blind every foe', pocket_tricks: 'Stun and coins',
    rousing_tune: '+2 for everyone', dazzling_chord: 'Hit and calm', encore: 'A friend goes again', mending_light: 'Heal a friend',
    tangle_vines: 'Hit and tangle', spring_bloom: 'Heal everyone',
  },
  da: {
    strike: 'Gratis angreb', befriend: 'Ven med Hjerte', guard: 'Sikrere, +1 Gnist', item: 'Fra tasken',
    shield_bash: 'Ram og lamslå', guardians_vow: 'Skærm en ven', lionheart_charge: 'Ram alle fjender', star_bolt: 'Stort lysende angreb',
    sleepy_dust: 'Send i søvn', comet_shower: 'Ram alle fjender', twin_arrows: 'To skud', biscuit_go: 'Nap og mærk',
    rain_of_arrows: 'Ram og mærk alle', sneak_strike: 'Lumsk stort angreb', smoke_puff: 'Blænd alle fjender', pocket_tricks: 'Lamslå og mønter',
    rousing_tune: '+2 til alle', dazzling_chord: 'Ram og berolig', encore: 'En ven går igen', mending_light: 'Hel en ven',
    tangle_vines: 'Ram og vikl ind', spring_bloom: 'Hel alle',
  },
});

const STATUS = L({
  en: {
    stunned: { name: 'Stunned', text: 'Dizzy and seeing stars. It loses its next turn (big foes just aim worse for a turn).' },
    asleep: { name: 'Asleep', text: 'Fast asleep. It skips its turns until something hurts it.' },
    tangled: { name: 'Tangled', text: 'Wrapped in vines: easier to hit, and it cannot use its special move.' },
    marked: { name: 'Marked', text: 'Easier for everyone to hit, and its next attack is clumsy.' },
    inspired: { name: 'Inspired', text: 'The music helps: +2 on every roll for a little while.' },
    guarded: { name: 'Guarding', text: 'Braced and ready: attacks roll twice and take the lower one.' },
    protected: { name: 'Protected', text: 'The knight takes the hits meant for this friend, at half the hurt.' },
    blinded: { name: 'Blinded', text: 'Can hardly see: its attacks roll twice and take the lower one.' },
    drowsy: { name: 'Drowsy', text: 'Yawning and slow: easier to hit for a little while.' },
    shaken: { name: 'Ears ringing', text: 'The next roll is 1 lower.' },
    worried: { name: 'Worried', text: 'A gloomy whisper: the next roll takes the worse of two dice.' },
    dazed: { name: 'Dazed', text: 'Out of this battle. Stands up again with 1 heart when the battle is won.' },
    targeted: { name: 'In danger', text: 'A foe is aiming a big move at this hero next turn. Guard!' },
  },
  da: {
    stunned: { name: 'Lamslået', text: 'Svimmel og ser stjerner. Den mister sin næste tur (store fjender sigter bare dårligere en tur).' },
    asleep: { name: 'Sover', text: 'Sover tungt. Den springer sine ture over, til noget gør den ondt.' },
    tangled: { name: 'Viklet ind', text: 'Fanget i ranker: lettere at ramme, og den kan ikke bruge sit særlige træk.' },
    marked: { name: 'Mærket', text: 'Lettere for alle at ramme, og dens næste angreb bliver klodset.' },
    inspired: { name: 'Opildnet', text: 'Musikken hjælper: +2 på hvert slag et lille stykke tid.' },
    guarded: { name: 'I værn', text: 'Klar og parat: angreb slår to gange og tager det laveste.' },
    protected: { name: 'Beskyttet', text: 'Ridderen tager hugene for denne ven, og de gør kun halvt så ondt.' },
    blinded: { name: 'Blændet', text: 'Kan næsten ikke se: dens angreb slår to gange og tager det laveste.' },
    drowsy: { name: 'Døsig', text: 'Gaber og er langsom: lettere at ramme et lille stykke tid.' },
    shaken: { name: 'Susen i ørerne', text: 'Næste slag er 1 lavere.' },
    worried: { name: 'Bekymret', text: 'En dyster hvisken: næste slag tager den dårligste af to terninger.' },
    dazed: { name: 'Omtumlet', text: 'Ude af kampen. Rejser sig igen med 1 hjerte, når kampen er vundet.' },
    targeted: { name: 'I fare', text: 'En fjende sigter et stort træk mod denne helt i næste tur. Værn!' },
  },
});

const SIZE = { knight: 272, wizard: 246, ranger: 280, trickster: 250, bard: 246, mender: 300, thornling: 172, gloop: 165, rattlewing: 168, flutterfang: 150, bouldergrin: 480, clatterclaw: 440, nightmare_wisp: 215 };
const EXIT = { thornling: 'leaves', gloop: 'splash', rattlewing: 'cogs', flutterfang: 'shards', bouldergrin: 'dust', clatterclaw: 'bigcogs', nightmare_wisp: 'sparkles' };
const FOE_FX = { thorn_slap: 'claw', prickle_toss: 'thorns', glomp: 'glomp', sticky_splat: 'splat', peck: 'peck', dive: 'dive', nip: 'bite', screech: 'screech', slam: 'slam', rumble: 'rumble', claw: 'claw', steam_blast: 'steam', chill: 'chill', whisper: 'whisper' };
const FOE_RANGED = ['prickle_toss', 'sticky_splat', 'screech', 'steam_blast', 'rumble', 'chill', 'whisper'];
const MELEE = ['slash', 'jab', 'thump', 'bash', 'sneak', 'charge'];
const SFX = { slash: 'hit.heavy', spark: 'spell.cast', arrow: 'bow', arrows: 'bow', jab: 'hit.light', note: 'spell.song', thump: 'hit.heavy', bash: 'hit.heavy', shield: 'block', charge: 'charge', starbolt: 'spell.star', dust: 'spell.sleep', comets: 'spell.star', fox: 'fox', rain: 'bow', sneak: 'whoosh', smoke: 'smoke', tricks: 'whoosh', song: 'spell.song', chord: 'spell.song', encore: 'fanfare.small', heal: 'heal', vines: 'spell.vine', bloom: 'heal', guard: 'block', item: 'item.get', befriend: 'befriend' };
const FOE_SFX = { screech: 'wing', rumble: 'rumble', steam_blast: 'whoosh', dive: 'wing', sticky_splat: 'splash', glomp: 'splash', whisper: 'whoosh', chill: 'spell.cast', slam: 'hit.heavy', claw: 'hit.heavy' };
const HERO_TINT = { knight: '#b07a22', wizard: '#2f55c8', ranger: '#2f7a44', trickster: '#9a6a1c', bard: '#7a44b8', mender: '#4f7a2a' };
const FOE_TINT = '#b3222c';

// small line-art icons for the action bar and statuses (24x24)
const IC = {
  sword: '<path d="M5 19l9.5-9.5M13 4h7v7l-9 9-3-3 9-9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M4 16l4 4M3 21l2-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  star: '<path d="M12 2.8l2.6 5.6 6.1.7-4.5 4.2 1.2 6.1L12 16.4l-5.4 3 1.2-6.1L3.3 9.1l6.1-.7z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  bow: '<path d="M6 3c7 3 7 15 0 18M6 3v18" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4 12h16M17 9l3 3-3 3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  note: '<path d="M9 18V5l11-2v13" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="6.5" cy="18" r="2.8" fill="currentColor"/><circle cx="17.5" cy="16" r="2.8" fill="currentColor"/>',
  shield: '<path d="M12 2.5l8 3v6c0 5-3.4 8.7-8 10-4.6-1.3-8-5-8-10v-6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  heart: '<path d="M12 20.5S3 14.8 3 8.9C3 6.2 5.1 4.2 7.6 4.2c1.8 0 3.4 1 4.4 2.5 1-1.5 2.6-2.5 4.4-2.5 2.5 0 4.6 2 4.6 4.7 0 5.9-9 11.6-9 11.6z" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  bag: '<path d="M5 9h14l-1.2 11H6.2z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9 9V7a3 3 0 016 0v2" fill="none" stroke="currentColor" stroke-width="1.7"/>',
  leaf: '<path d="M5 19C5 9 11 4 20 4c0 9-5 15-15 15zM5 19l8-8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  burst: '<path d="M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3.5 3.5M15.5 15.5L19 19M19 5l-3.5 3.5M8.5 15.5L5 19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  moon: '<path d="M19 15A8 8 0 019 5a8 8 0 1010 10z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  paw: '<circle cx="12" cy="15" r="4" fill="currentColor"/><circle cx="6" cy="10" r="2" fill="currentColor"/><circle cx="10" cy="6" r="2" fill="currentColor"/><circle cx="14" cy="6" r="2" fill="currentColor"/><circle cx="18" cy="10" r="2" fill="currentColor"/>',
  cloud: '<path d="M7 18h10a4 4 0 000-8 5 5 0 00-9.6-1.5A3.8 3.8 0 007 18z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  cross: '<path d="M12 4v16M4 12h16" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
  zz: '<path d="M5 6h6l-6 7h6M13 12h6l-6 7h6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
  vine: '<path d="M4 20c4-2 2-7 6-8s3-6 7-7M9 13c-2-1-3 0-3 0M14 8c1-2 3-2 3-2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
  target: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5" stroke="currentColor" stroke-width="1.8"/>',
  eye: '<path d="M2 12s4-6.5 10-6.5S22 12 22 12s-4 6.5-10 6.5S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M4 20L20 4" stroke="currentColor" stroke-width="2"/>',
  spiral: '<path d="M12 12a1.5 1.5 0 113 0 3.5 3.5 0 01-6 0 5.5 5.5 0 0110 0 7.5 7.5 0 01-14 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  wave: '<path d="M8 8a5 5 0 000 8M5 5a9 9 0 000 14M16 8a5 5 0 010 8M19 5a9 9 0 010 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  bang: '<path d="M12 3v12" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/><circle cx="12" cy="20" r="1.9" fill="currentColor"/>',
};
const ACT_ICON = { slash: 'sword', jab: 'sword', thump: 'sword', spark: 'star', arrow: 'bow', note: 'note', bash: 'shield', shield: 'shield', charge: 'burst', starbolt: 'star', dust: 'moon', comets: 'burst', arrows: 'bow', fox: 'paw', rain: 'bow', sneak: 'moon', smoke: 'cloud', tricks: 'burst', song: 'note', chord: 'note', encore: 'star', heal: 'cross', vines: 'vine', bloom: 'leaf' };
const ST_ICON = { stunned: 'star', asleep: 'zz', tangled: 'vine', marked: 'target', inspired: 'note', guarded: 'shield', protected: 'heart', blinded: 'eye', drowsy: 'moon', shaken: 'wave', worried: 'cloud', dazed: 'spiral', targeted: 'bang' };
const icon = (name, cls = '') => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', 'cb-ic ' + cls); s.innerHTML = IC[name] || IC.star; return s; };

// hero and foe slots: feet position on the stage
// heroes stand in one row, evenly spaced so every face and plate stays clear; bigger parties get slightly smaller cutouts
const HERO_SLOTS = { 1: [[330, 584]], 2: [[220, 574], [445, 594]], 3: [[135, 572], [315, 594], [495, 572]], 4: [[92, 570], [240, 594], [388, 570], [536, 594]] };
const HERO_SCALE = { 1: 1.1, 2: 1, 3: 0.92, 4: 0.82 };
// several foes of one kind: each a little different (size, hue, breathing), never pixel twins
const TWIN_VARY = [{ s: 1, hue: 0 }, { s: 0.9, hue: 16, mirror: true }, { s: 1.07, hue: -14 }, { s: 0.95, hue: 9, mirror: true }, { s: 1.03, hue: -7 }];
const MIRROR_OK = ['gloop', 'nightmare_wisp', 'flutterfang'];
const FOE_SLOTS = { 1: [[950, 582]], 2: [[860, 556], [1070, 592]], 3: [[790, 550], [955, 594], [1115, 552]], 4: [[775, 548], [900, 596], [1030, 542], [1160, 592]], 5: [[765, 552], [868, 598], [972, 540], [1078, 598], [1180, 550]] };

const lastPicks = new WeakMap();
const localRewinds = new Map();

export async function runCombat(encounterId, a, b) {
  const ctx = b || a;
  const opts = b ? (a || {}) : {};
  const enc = ctx.content?.encounters?.[encounterId];
  if (!enc) throw new Error('Unknown encounter ' + encounterId);
  ensureCss(ctx);
  const view = new BattleView(ctx, encounterId, enc, opts);
  try { return await view.run(); }
  finally { view.cleanup(); }
}

function ensureCss(ctx) {
  const link = document.getElementById('css-combat');
  if (link) { if (link.disabled) link.disabled = false; return; }
  if (document.querySelector('link[data-cb-css]')) return;
  document.head.appendChild(h('link', { rel: 'stylesheet', href: 'css/combat.css', 'data-cb-css': '1' }));
  void ctx;
}

class BattleView {
  constructor(ctx, encId, enc, opts) {
    this.ctx = ctx; this.encId = encId; this.enc = enc; this.opts = opts;
    this.L = ctx.stage.layers;
    this.speed = () => window.__LF_SPEED || 1;
    this.reduce = () => !!ctx.settings?.reduceMotion || document.documentElement.classList.contains('lf-reduce');
    this.els = new Map();
    this.keyFn = null;
    this.lineQ = Promise.resolve(); this.opSeq = 0; this.curOp = 0;
  }

  // ---------- helpers ----------
  sleep(ms) { return this.ctx.sleep(ms); }
  pick(arr) {
    if (!arr || !arr.length) return null;
    let i = this.ctx.rng.int(0, arr.length - 1);
    if (arr.length > 1 && i === lastPicks.get(arr)) i = (i + 1) % arr.length;
    lastPicks.set(arr, i);
    const l = arr[i];
    return typeof l === 'string' ? l : l?.say || l?.text || null;
  }
  // Every battle line goes through one queue: at most one narrator operation from the battle exists at a time.
  // A line starts when the previous one has settled; when its time is up (the voice clip, or the reading time
  // with voice off) it advances only its own operation (checked by token), then waits for it to settle.
  say(text, { actor, quick = true, maxMs = null } = {}) {
    if (!text) return Promise.resolve();
    const run = () => this.narrate(text, { actor, quick, maxMs });
    const p = this.lineQ.then(run, run);
    this.lineQ = p.catch(() => {});
    return p;
  }
  async narrate(text, { actor, quick, maxMs }) {
    const gm = this.ctx.gm;
    if (actor !== undefined) gm.setActor(actor);
    const my = ++this.opSeq;
    this.curOp = my;
    let done = false;
    const p = Promise.resolve().then(() => gm.say(text, { as: 'gm', mood: 'warm', quick })).catch(() => {}).then(() => { done = true; });
    await Promise.race([p, this.sleep(maxMs ?? this.lineMs(text))]);
    for (let i = 0; !done && i < 3 && this.curOp === my; i++) { gm.advance?.(); await Promise.race([p, this.sleep(60)]); }
    if (!done) await Promise.race([p, this.sleep(4000)]);
    if (this.curOp === my) this.curOp = 0;
  }
  lineMs(text) {
    const { ctx } = this;
    const voiceOn = ctx.settings?.voiceOn !== false && !ctx.fast;
    let dur = 0;
    try { dur = voiceOn ? (ctx.audio.voiceDuration?.(voiceId('gm', 'warm', String(text))) || 0) : 0; } catch { dur = 0; }
    if (dur) return dur * 1000 + 120;
    // voice off: the typing time at the player's text speed plus time to read it
    const cps = { slow: 24, normal: 36, fast: 58, instant: 9999 }[ctx.settings?.textSpeed] || 36;
    return ctx.fast ? 600 : Math.min(12000, (String(text).length / cps) * 1000 + 2400);
  }
  barUp() { return !!this.bar && !this.bar.classList.contains('is-hidden'); }
  // a call heard without the narrator panel (used while the action bar is up)
  voiceOnly(text) {
    const { ctx } = this;
    if (!text) return Promise.resolve();
    try { ctx.bus.emit?.('gm:line', { text, as: 'gm', mood: 'warm' }); } catch { /* ignore */ }
    if (ctx.settings?.voiceOn === false || ctx.fast) return Promise.resolve();
    // never over a narrator line: it starts once the battle's line queue is idle
    return this.lineQ.then(() => Promise.race([Promise.resolve(ctx.audio.voice?.(voiceId('gm', 'warm', String(text)))).catch(() => {}), this.sleep(this.lineMs(text))]));
  }
  // the next unit to act this round is a hero: a trailing call may finish while that hero's bar is already up
  nextIsHero() {
    const q = this.queue || [];
    for (let j = this.qi + 1; j < q.length; j++) {
      const u = C.unit(this.b, q[j]);
      if (!u || (u.side === 'hero' && u.dazed) || (u.side === 'foe' && u.gone)) continue;
      return u.side === 'hero';
    }
    return false;
  }
  sayPool(key) { const t = this.ctx.gm.line?.(key); return t ? this.say(t, { actor: null }) : Promise.resolve(); }
  sfx(name, o) { try { this.ctx.audio.sfx(name, o); } catch { /* silent */ } }
  anim(el, frames, ms, o = {}) {
    if (!el?.animate) return this.sleep(ms);
    const dur = this.reduce() ? Math.min(ms, 120) : ms;
    try {
      // a new scripted move replaces the old one (a held lunge must never outlive its return)
      if (!o.keep) for (const x of el.getAnimations?.() || []) if (!(typeof CSSAnimation !== 'undefined' && x instanceof CSSAnimation)) x.cancel();
      el.animate(frames, { duration: dur / this.speed(), easing: o.easing || 'cubic-bezier(.22,1,.36,1)', fill: o.fill || 'none', delay: (o.delay || 0) / this.speed() });
    } catch { /* ignore */ }
    return this.sleep(dur + (o.delay || 0));
  }
  hideGm() { try { this.ctx.gm.hide(); } catch { /* ignore */ } }

  // ---------- run ----------
  async run() {
    const { ctx } = this;
    this.party = ctx.state.party.filter(Boolean);
    this.b = C.createBattle({ content: ctx.content, encounterId: this.encId, party: this.party, rng: ctx.rng.fork('battle:' + this.encId), flags: ctx.state.flags, inventory: ctx.state.inventory });
    this.firstBattle = !ctx.state.flag('teach.battle');
    ctx.gm.director?.battleStart?.();
    this.build();
    window.__LF_COMBAT = this; // inspection handle for tests (SPEC 13)
    ctx.audio.music?.(this.enc.music || 'battle');
    this.sfx('sting.danger');
    await this.enter();

    for (const l of this.enc.intro || []) await this.say(l, { quick: false, maxMs: 30000 });
    if (!(this.enc.intro || []).length) await this.sayPool('battle.start');
    if (this.firstBattle) await this.teach('battle');
    await this.twist();

    let result = null;
    for (;;) {
      result = await this.battleLoop();
      if (result !== 'wipe') break;
      const r = await this.onWipe();
      if (r) { result = r; break; }
    }
    return this.end(result);
  }

  async teach(kind) {
    const d = this.ctx.gm.director;
    if (d?.teach) return Promise.race([d.teach(kind), this.sleep(12000)]);
    const f = 'teach.' + kind;
    if (this.ctx.state.flag(f)) return;
    this.ctx.state.setFlag(f, true);
    return this.sayPool(f);
  }

  async twist() {
    const tw = this.enc.twist;
    if (!tw || !tw.status || !this.ctx.state.test(tw.when)) return;
    const f = tw.target === 'first' || !tw.target ? C.activeFoes(this.b)[0] : C.activeFoes(this.b).find((x) => x.type === tw.target);
    if (!f) return;
    f.st[tw.status] = { n: 2, fresh: false };
    this.sfx('spell.vine');
    this.fx.play('vines', { to: this.center(f) });
    this.float(f, STR.thorns, 'info');
    this.refresh(f);
    await this.say((tw.lines || [])[1] || (tw.lines || [])[0], { actor: null });
  }

  async battleLoop() {
    const { b } = this;
    for (;;) {
      b.round++;
      if (b.round > 40) { const fx = C.fleeAll(b); await this.playEffects(fx, null); return 'win'; }
      this.queue = C.buildQueue(b);
      this.qi = -1;
      this.renderRibbon();
      await this.roundLine();
      for (let i = 0; i < this.queue.length; i++) {
        this.qi = i;
        const u = C.unit(b, this.queue[i]);
        if (!u || (u.side === 'hero' && u.dazed) || (u.side === 'foe' && u.gone)) continue;
        this.renderRibbon();
        if (u.side === 'hero') await this.heroTurn(u);
        else await this.foeTurn(u);
        const o = C.outcome(b);
        if (o) return o;
      }
    }
  }

  async roundLine() {
    const { b } = this;
    this.roundTag.textContent = `${STR.round} ${b.round}`;
    this.anim(this.roundTag, [{ transform: 'scale(1.35)', color: '#fff6d8' }, { transform: 'scale(1)' }], 500);
    if (b.round === 1) return;
    if (b.round === 2 && !this.hinted) {
      this.hinted = true;
      const f = C.activeFoes(b).find((x) => x.def.lines?.weakHint?.length && ((x.def.weak || []).length || (x.def.likes || []).length || x.canCalm));
      if (f) { this.hideGm(); return this.say(this.pick(f.def.lines.weakHint), { actor: null }); }
    }
    if (b.round >= 3 && this.ctx.rng.chance(0.5)) {
      // flavour only: when a hero opens the round it plays on while that hero's bar comes up
      const first = C.unit(b, (this.queue || [])[0]);
      if (first?.side === 'hero' && !first.dazed) { this.voiceOnly(this.ctx.gm.line?.('battle.round')).catch(() => {}); return; }
      return this.sayPool('battle.round');
    }
  }

  async onWipe() {
    const { ctx, b } = this;
    if (this.opts.lose || this.opts.hasLose) return 'lose';
    const d = ctx.gm.director;
    const key = ctx.state.scene || '_';
    const rewinds = d ? (d.rewinds || 0) : (localRewinds.get(key) || 0);
    if (rewinds >= 1) {
      await this.sayPool('mercy.rewind');
      this.float(b.heroes[0], STR.fled, 'info');
      await this.playEffects(C.fleeAll(b), null);
      for (const h of b.heroes) { h.dazed = false; h.hp = Math.max(1, h.hp); this.refresh(h); }
      return 'win';
    }
    if (d) d.rewinds = rewinds + 1; else localRewinds.set(key, rewinds + 1);
    await this.sayPool('mercy.rewind');
    this.sfx('ui.page');
    const page = h('div.cb-page', h('span', STR.rewind));
    this.root.appendChild(page);
    await this.sleep(60);
    page.classList.add('is-on');
    await this.sleep(900);
    C.rewind(b);
    for (const u of [...b.heroes, ...b.foes]) {
      const el = this.els.get(u.uid);
      el?.classList.remove('is-gone', 'is-dazed', 'is-friend', 'is-fled');
      if (el && !(u.side === 'foe' && u.gone === 'befriended')) { el.style.opacity = ''; for (const x of el._parts.body.getAnimations()) x.cancel(); }
      this.refresh(u);
      if (u.side === 'foe' && u.gone === 'befriended') el?.classList.add('is-gone');
    }
    this.sync();
    page.classList.remove('is-on');
    await this.sleep(500);
    page.remove();
    return null;
  }

  async end(result) {
    const { ctx, b } = this;
    this.hideBar();
    this.clearTargets();
    const summary = C.finish(b);
    if (result === 'lose') { this.sync(); return { result: 'lose', befriended: summary.befriended, defeated: summary.defeated }; }
    for (const u of b.heroes) this.refresh(u);
    this.sync();
    ctx.state.tallyAdd?.('befriended', summary.befriended.length);
    ctx.state.tallyAdd?.('defeated', summary.defeated.length);
    const friends = result === 'befriend';
    this.sfx(this.enc.music === 'boss' ? 'fanfare.big' : 'fanfare.small');
    for (const u of b.heroes) this.els.get(u.uid)?.classList.add('is-cheer');
    this.fx.exit('sparkles', { x: 330, y: 380 });
    const banner = ctx.ui.banner(friends ? STR.friends : STR.victory, { kind: friends ? 'crit' : 'success', sub: friends ? STR.friendsSub : STR.victorySub, hold: 1400 });
    await this.sleep(500);
    await this.sayPool(friends ? 'battle.befriendWin' : 'battle.win');
    const rw = this.enc.reward;
    if (rw?.gold) { ctx.state.addGold(rw.gold); this.sfx('coin'); ctx.ui.toast(STR.coins(rw.gold), { icon: 'coin', kind: 'item' }); }
    if (rw?.item) { ctx.state.give(rw.item, 1); await ctx.ui.itemCard(rw.item, { kicker: STR.youGet }); }
    await Promise.race([banner, this.sleep(4000)]);
    ctx.gm.director?.battleEnd?.();
    const scMusic = ctx.content?.scenes?.[ctx.state.scene]?.music;
    if (scMusic) ctx.audio.music?.(scMusic);
    return { result: friends ? 'befriend' : 'win', befriended: summary.befriended, defeated: summary.defeated };
  }

  cleanup() {
    const { ctx } = this;
    if (window.__LF_COMBAT === this) delete window.__LF_COMBAT;
    if (this.keyFn) window.removeEventListener('keydown', this.keyFn);
    this.fx?.dispose();
    this.offResize?.();
    try { ctx.dice.clear?.()?.catch?.(() => {}); } catch { /* ignore */ }
    ctx.gm.setActor?.(null);
    this.L.bg.classList.remove('cb-dim');
    setTimeout(() => this.L.dice.classList.remove('cb-dice', 'cb-dice-sm'), 600);
    this.L.actor.classList.remove('cb-hide');
    if (this.root) { this.root.classList.add('is-out'); const r = this.root; setTimeout(() => r.remove(), 450); }
  }

  // ---------- build ----------
  build() {
    const { ctx, b } = this;
    this.L.bg.classList.add('cb-dim');
    this.L.actor.classList.add('cb-hide');
    this.canvas = h('canvas.cb-fx');
    this.floats = h('div.cb-floats');
    this.units = h('div.cb-units');
    this.roundTag = h('div.cb-round', `${STR.round} 1`);
    this.chips = h('div.cb-chips');
    this.ribbon = h('div.cb-ribbon.lf-panel', this.roundTag, h('div.cb-ribbon-sep'), this.chips);
    this.rollEl = h('div.cb-roll');
    this.tip = h('div.cb-tip.lf-panel');
    this.bar = h('div.cb-bar.lf-panel.is-hidden', { 'data-no-advance': '1' });
    this.root = h('div.cb-root', { 'data-no-advance': '1' }, h('div.cb-vignette'), this.units, this.canvas, this.floats, this.ribbon, this.rollEl, this.bar, this.tip);
    this.L.screen.appendChild(this.root);
    this.fx = createFx(this.canvas, { pixelRatio: () => ctx.stage.pixelRatio(), reduce: this.reduce });
    this.offResize = ctx.stage.onResize?.(() => this.fx.resize());
    this.root.addEventListener('pointerdown', (e) => { if (!e.target.closest('.cb-st, .cb-tip')) this.tip.classList.remove('is-on'); });

    const hs = b.heroes, fs = b.foes;
    this.root.classList.add(`cb-n${Math.min(4, hs.length)}`);
    const seen = {};
    for (const f of fs) { const k = seen[f.type] = (seen[f.type] ?? -1) + 1; f.vary = fs.filter((x) => x.type === f.type).length > 1 ? TWIN_VARY[k % TWIN_VARY.length] : null; }
    hs.forEach((u, i) => { const s = (HERO_SLOTS[Math.min(4, hs.length)] || HERO_SLOTS[4])[i] || [140 + i * 110, 590]; this.place(u, s[0], s[1]); });
    const boss = fs.find((f) => f.boss);
    if (boss) {
      this.place(boss, fs.length > 1 ? 975 : 960, 606);
      const minions = fs.filter((f) => f !== boss);
      const spots = [[812, 404], [1182, 372], [840, 260], [1120, 240]];
      minions.forEach((f, i) => this.place(f, spots[i][0], spots[i][1], { fly: false }));
    } else {
      fs.forEach((u, i) => { const s = (FOE_SLOTS[Math.min(5, fs.length)] || FOE_SLOTS[5])[i] || [760 + i * 100, 590]; this.place(u, s[0], s[1]); });
    }
    for (const u of [...hs, ...fs]) this.units.appendChild(this.makeUnit(u));
    this.layoutPlates();
    this.renderRibbon();

    this.keyFn = (e) => {
      if (!this.bar.classList.contains('is-hidden')) {
        if (e.key === 'Escape' && this.backFn) { e.preventDefault(); this.backFn(); }
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= 9 && this.barKeys?.[n - 1]) { e.preventDefault(); this.barKeys[n - 1].click(); }
      }
    };
    window.addEventListener('keydown', this.keyFn);
  }

  place(u, x, y, { fly } = {}) {
    const key = u.side === 'hero' ? u.arch : u.type;
    const base = SIZE[key] || (u.side === 'hero' ? 260 : 180);
    const hgt = Math.round(base * (u.side === 'hero' ? (HERO_SCALE[Math.min(4, this.b.heroes.length)] || 1) : (u.vary?.s || 1)));
    const flyer = u.side === 'foe' && C.FLYERS.includes(u.type) && fly !== false;
    const lift = flyer ? ({ rattlewing: 130, flutterfang: 140, nightmare_wisp: 80 }[u.type] ?? 120) : 0;
    u.pos = { x, y: y - lift, ground: y, h: hgt, flyer: flyer || (u.side === 'foe' && C.FLYERS.includes(u.type)) };
  }
  // nudge name plates apart so neighbours never overlap (sideways first, then up and down)
  layoutPlates() {
    const ps = [...this.b.heroes, ...this.b.foes].map((u) => {
      const el = this.els.get(u.uid), pl = el._parts.plate;
      const w = pl.offsetWidth || 160, hh = pl.offsetHeight || 70;
      return { u, pl, x: u.pos.x, top: u.pos.y - u.pos.h - 10 - hh, w, h: hh, dx: 0, dy: 0 };
    });
    for (let it = 0; it < 40; it++) {
      let moved = false;
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i], c = ps[j];
        if (a.u.side !== c.u.side) continue;
        const ox = (a.w + c.w) / 2 + 6 - Math.abs((a.x + a.dx) - (c.x + c.dx));
        const oy = (a.h + c.h) / 2 + 4 - Math.abs((a.top + a.dy + a.h / 2) - (c.top + c.dy + c.h / 2));
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        const [l, r] = (a.x + a.dx) <= (c.x + c.dx) ? [a, c] : [c, a];
        if (ox < 70 && Math.abs(l.dx) < 46 && Math.abs(r.dx) < 46) { l.dx -= ox / 2 + 0.5; r.dx += ox / 2 + 0.5; }
        else { const [up, dn] = (a.top + a.dy) <= (c.top + c.dy) ? [a, c] : [c, a]; up.dy -= oy / 2 + 0.5; dn.dy += oy / 2 + 0.5; }
      }
      if (!moved) break;
    }
    for (const p of ps) {
      const cx = p.x + p.dx, half = p.w / 2 + 8;
      if (cx - half < 0) p.dx += half - cx;
      if (cx + half > 1280) p.dx -= cx + half - 1280;
      p.pl.style.marginLeft = Math.round(p.dx) + 'px'; p.pl.style.bottom = Math.round(p.u.pos.h + 10 - p.dy) + 'px'; }
  }
  center(u) { return { x: u.pos.x, y: u.pos.y - u.pos.h * 0.5 }; }
  head(u) { return { x: u.pos.x, y: u.pos.y - u.pos.h }; }

  makeUnit(u) {
    const { ctx } = this;
    const key = u.side === 'hero' ? u.arch : (u.def.art || u.type);
    const src = ctx.assets.char(key);
    const v = u.vary;
    const breath = h('div.cb-breath', { style: { animationDelay: `${-(v ? this.b.foes.indexOf(u) * 1.3 : Math.random() * 3)}s`, animationDuration: `${3.2 + Math.random() * 1.2}s`,
      filter: v?.hue ? `hue-rotate(${v.hue}deg) saturate(${1 + v.hue / 200})` : null } });
    if (v?.mirror && MIRROR_OK.includes(u.type)) breath.classList.add('is-mirror');
    const ph = () => breath.replaceChildren(h('div.cb-ph', { style: { height: u.pos.h + 'px', width: Math.round(u.pos.h * 0.55) + 'px' } }, ctx.ui.portrait(u.side === 'hero' ? u.arch : u.type, 'md'), h('span', u.name.split(' ')[0])));
    if (ctx.assets.has(src) === false) ph();
    else { const img = h('img.cb-img', { alt: u.name, draggable: 'false', style: { height: u.pos.h + 'px' } }); img.onerror = ph; img.src = src; breath.appendChild(img); }
    const body = h('div.cb-body', breath);
    const hp = h('div.lf-bar.cb-hpbar', h('i'));
    const hpNum = h('span.cb-hpnum');
    const statuses = h('div.cb-sts');
    const plate = h('div.cb-plate', { class: u.boss ? 'is-boss' : null },
      h('div.cb-namerow', h('span.cb-name', u.side === 'hero' ? u.name.split(' ')[0] : u.name)),
      h('div.cb-hprow', icon('heart', 'cb-hp-ic'), hp, hpNum),
      u.side === 'foe' && u.canCalm ? h('div.cb-calm', { title: STR.calmLabel }, Array.from({ length: u.resolve }, () => h('i', icon('heart')))) : null,
      u.side === 'hero' ? h('div.cb-sparks', { title: STR.sparks }, Array.from({ length: R.SPARKS.max }, () => h('i'))) : null,
      statuses);
    const el = h('div.cb-unit', {
      class: [u.side === 'hero' ? 'is-hero' : 'is-foe', u.boss ? 'is-boss' : '', u.pos.flyer ? 'is-flyer' : ''].filter(Boolean).join(' '),
      dataset: { uid: u.uid, id: u.side === 'hero' ? u.arch : u.type },
      style: { left: u.pos.x + 'px', top: u.pos.y + 'px' },
    }, h('div.cb-shadow', { style: { top: (u.pos.ground - u.pos.y) + 'px', width: Math.round(u.pos.h * (u.boss ? 0.75 : 0.6)) + 'px' } }), h('div.cb-ring'), body, plate);
    body.style.zIndex = String(Math.round(u.pos.ground));
    plate.style.bottom = (u.pos.h + 10) + 'px';
    el.addEventListener('click', () => this.onUnitClick?.(u));
    statuses.addEventListener('click', (e) => { const s = e.target.closest('.cb-st'); if (s) { e.stopPropagation(); this.showTip(s, s.dataset.s); } });
    this.els.set(u.uid, el);
    el._parts = { hp, hpNum, statuses, plate, body, breath };
    this.refresh(u, el);
    return el;
  }

  refresh(u, el = this.els.get(u.uid)) {
    if (!el) return;
    const p = el._parts;
    const v = Math.max(0, u.hp) / u.maxHp;
    p.hp.style.setProperty('--v', String(v));
    p.hp.classList.toggle('is-low', v > 0 && v <= 0.3);
    p.hpNum.textContent = `${Math.max(0, u.hp)}/${u.maxHp}`;
    if (u.side === 'foe' && u.canCalm) [...p.plate.querySelectorAll('.cb-calm > i')].forEach((x, i) => x.classList.toggle('on', i < u.calm));
    if (u.side === 'hero') [...p.plate.querySelectorAll('.cb-sparks > i')].forEach((x, i) => x.classList.toggle('on', i < u.sparks));
    const list = Object.keys(u.st).filter((s) => STATUS[s]);
    if (u.side === 'hero' && u.dazed) list.unshift('dazed');
    if (u.side === 'hero' && this.b.foes.some((f) => !f.gone && f.pending?.target === u.uid)) list.push('targeted');
    const cur = [...p.statuses.children].map((c) => c.dataset.s).join(',');
    if (cur !== list.join(',')) {
      p.statuses.replaceChildren(...list.map((s) => h('button.cb-st', { type: 'button', dataset: { s }, class: `st-${s}`, 'aria-label': STATUS[s].name, title: STATUS[s].name }, icon(ST_ICON[s] || 'star'))));
    }
    el.classList.toggle('is-dazed', u.side === 'hero' && !!u.dazed);
  }

  showTip(anchor, s) {
    const info = STATUS[s];
    if (!info) return;
    this.sfx('ui.tap');
    this.tip.replaceChildren(h('b', info.name), h('span', info.text));
    const sr = this.ctx.stage.el.getBoundingClientRect(), r = anchor.getBoundingClientRect();
    const k = 1280 / sr.width;
    const x = (r.left + r.width / 2 - sr.left) * k, y = (r.top - sr.top) * k;
    this.tip.style.left = Math.max(170, Math.min(1110, x)) + 'px';
    this.tip.style.top = Math.max(10, y - 12) + 'px';
    this.tip.classList.add('is-on');
    clearTimeout(this.tipT);
    this.tipT = setTimeout(() => this.tip.classList.remove('is-on'), 3600);
  }

  async enter() {
    const all = [...this.b.heroes, ...this.b.foes];
    all.forEach((u, i) => {
      const el = this.els.get(u.uid);
      const dx = u.side === 'hero' ? -260 : 260;
      this.anim(el._parts.body, [{ transform: `translateX(${dx}px)`, opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }], 620, { delay: i * 70, fill: 'backwards' });
      el._parts.plate.animate?.([{ opacity: 0 }, { opacity: 0, offset: 0.6 }, { opacity: 1 }], { duration: (900 + i * 70) / this.speed() });
    });
    this.anim(this.ribbon, [{ transform: 'translate(-50%, -80px)', opacity: 0 }, { transform: 'translate(-50%, 0)', opacity: 1 }], 600);
    await this.sleep(700 + all.length * 50);
  }

  renderRibbon() {
    const q = this.queue || C.buildQueue(this.b);
    const chips = q.map((uid, i) => {
      const u = C.unit(this.b, uid);
      const out = (u.side === 'hero' && u.dazed) || (u.side === 'foe' && u.gone);
      const chip = h('div.cb-chip', { class: [u.side === 'hero' ? 'is-hero' : 'is-foe', i === this.qi ? 'is-now' : '', i < this.qi || out ? 'is-done' : ''].filter(Boolean).join(' ') },
        this.ctx.ui.portrait(u.side === 'hero' ? u.arch : u.type, 'sm'));
      return chip;
    });
    this.chips.replaceChildren(...chips);
  }

  // ---------- floating text, roll readout ----------
  float(u, text, kind = 'dmg', { dy = 0, big = false } = {}) {
    const p = u.pos ? { x: u.pos.x, y: u.pos.y - Math.min(u.pos.h * 0.78, u.pos.h - 30) } : u;
    const el = h('div.cb-float', { class: `k-${kind}${big ? ' is-big' : ''}`, style: { left: p.x + 'px', top: (p.y - 20 + dy) + 'px' } }, text);
    this.floats.appendChild(el);
    setTimeout(() => el.remove(), 1700 / this.speed());
  }

  showRoll(roll, { label, foe = false, check = false } = {}) {
    const nHit = (roll.vs || []).filter((v) => v.hit).length;
    const many = (roll.vs || []).length > 1;
    const verdict = roll.crit ? STR.crit : roll.fumble ? STR.fumble : nHit ? (check ? STR.success : many ? STR.hits(nHit) : STR.hit) : (check ? STR.notYet : STR.miss);
    const cls = roll.crit ? 'is-crit' : roll.fumble ? 'is-fumble' : roll.vs?.some((v) => v.hit) ? 'is-hit' : 'is-miss';
    const need = roll.vs?.length === 1 ? roll.vs[0].need : null;
    const bonus = roll.bonus || 0;
    this.rollEl.className = `cb-roll ${cls}${foe ? ' is-foe' : ''}`;
    this.rollEl.replaceChildren(...[
      h('div.cb-roll-left', label ? h('div.cb-roll-label', label) : null,
        need != null ? h('div.cb-roll-need', STR.needs(need)) : many ? h('div.cb-roll-need', STR.vsEach(foe)) : null),
      h('div.cb-roll-row', h('span.cb-roll-die', String(roll.die)), bonus ? h('span.cb-roll-mod', (bonus > 0 ? '+ ' : '- ') + Math.abs(bonus)) : null,
        bonus ? h('span.cb-roll-eq', '= ' + roll.total) : null),
      h('div.cb-roll-verdict', verdict)].filter(Boolean));
    this.placeRoll();
    requestAnimationFrame(() => this.rollEl.classList.add('is-on'));
  }
  // the readout goes in the first free spot that covers no name plate (under the turn ribbon, else lower down the middle)
  placeRoll() {
    const sr = this.ctx.stage.el.getBoundingClientRect();
    const k = sr.width ? 1280 / sr.width : 1;
    const box = (el) => { const r = el.getBoundingClientRect(); return { l: (r.left - sr.left) * k, t: (r.top - sr.top) * k, r: (r.right - sr.left) * k, b: (r.bottom - sr.top) * k }; };
    const plates = [];
    for (const [uid, el] of this.els) { const u = C.unit(this.b, uid); if (u && !(u.side === 'foe' && u.gone)) plates.push(box(el._parts.plate)); }
    const w = Math.max(300, this.rollEl.offsetWidth || 440), hh = this.rollEl.offsetHeight || 64;
    const spots = [[640, 88], [640, 150], [640, 222], [640, 300], [640, 380], [460, 88], [820, 88]];
    let best = spots[0], bestHit = Infinity;
    for (const [x, y] of spots) {
      const a = { l: x - w / 2 - 6, r: x + w / 2 + 6, t: y - 4, b: y + hh + 4 };
      const hit = plates.reduce((n, p) => n + Math.max(0, Math.min(a.r, p.r) - Math.max(a.l, p.l)) * Math.max(0, Math.min(a.b, p.b) - Math.max(a.t, p.t)), 0);
      if (hit < bestHit) { best = [x, y]; bestHit = hit; }
      if (hit === 0) break;
    }
    this.rollEl.style.left = best[0] + 'px';
    this.rollEl.style.top = best[1] + 'px';
  }
  hideRoll() { this.rollEl.classList.remove('is-on'); }

  async diceRoll(roll, from, tint, { small = false } = {}) {
    const dice = roll.dice.map((v, i) => ({ sides: 20, value: v, tint, dropped: i === roll.dropped }));
    this.L.dice.classList.add('cb-dice');
    this.L.dice.classList.toggle('cb-dice-sm', small);
    this.sfx('dice.throw');
    // the dice service scales the die itself (size), so it never flies in big over faces and plates
    try { await Promise.race([this.ctx.dice.roll({ dice, fast: true, size: small ? 0.5 : 0.56, crit: roll.crit ? 'success' : roll.fumble ? 'fail' : null, from }), this.sleep(2600)]); }
    catch (e) { console.warn('[combat] dice', e); }
    this.sfx('dice.land');
  }
  clearDice() { try { Promise.resolve(this.ctx.dice.clear?.()).catch(() => {}); } catch { /* ignore */ } }

  // ---------- targets ----------
  clearTargets() {
    for (const el of this.els.values()) el.classList.remove('is-targetable', 'is-target-ally');
    this.onUnitClick = null;
  }

  // ---------- hero turn ----------
  async heroTurn(u, { extra = false } = {}) {
    const { b, ctx } = this;
    const fx0 = C.beginHeroTurn(b, u);
    this.refreshAll();
    const el = this.els.get(u.uid);
    el.classList.add('is-active');
    this.root.classList.add('is-hero-turn');
    el._parts.body.style.zIndex = '1500'; // the acting hero steps in front of the others
    if (fx0.some((e) => e.t === 'sparks')) this.sfx('ui.tap', { volume: 0.4, rate: 1.4 });
    try {
      if (!this.taughtFriend && this.firstBattleBefriend()) { this.taughtFriend = true; await this.teach('befriend'); }
      let pick;
      if (ctx.auto) {
        this.showBar(u, { preview: true });
        await this.sleep(450);
        pick = C.chooseAI(b, u, { mode: 'sensible', kind: ctx.auto.policy === 'kind' && ctx.auto.rng.chance(0.8) });
        await this.flashPick(pick);
      } else pick = await this.pickAction(u);
      this.hideBar();
      this.clearTargets();
      const snap = C.snapshot(b);
      let results = C.resolveHeroAction(b, u, pick.action, pick.targets);
      let shown = false;
      // SPEC 5: after a failed roll the party may spend a Star to roll again and keep the better die
      if (C.canReroll(results) && (ctx.state.stars || 0) > 0) {
        const r0 = results[0];
        const from = this.center(u);
        await this.diceRoll(r0.roll, { x: from.x + 40, y: from.y + 40 }, HERO_TINT[u.arch] || '#2f55c8');
        this.showRoll(r0.roll, { label: r0.name, check: r0.kind === 'check' || r0.kind === 'befriend' });
        shown = true;
        if (await this.askStar(u) && ctx.state.spendStar()) {
          this.sfx('star.spend');
          ctx.bus.emit?.('star:spent', { why: 'reroll' });
          this.float(u, STR.rerolled, 'gold', { dy: -46 });
          this.hideRoll();
          this.clearDice();
          C.restore(b, snap);
          b.keepBetter = r0.roll.die;
          results = C.resolveHeroAction(b, u, pick.action, pick.targets);
          shown = false;
          await this.sleep(300);
        }
      }
      // every resolved shot plays out (Twin Arrows' second arrow too), then the battle checks for the end
      for (const r of results) { await this.playHero(u, r, { shown }); shown = false; }
      for (const r of results) for (const e of r.effects) {
        if (e.t !== 'extra' || C.outcome(b)) continue;
        const ally = C.unit(b, e.target);
        if (ally && !ally.dazed) { el.classList.remove('is-active'); await this.heroTurn(ally, { extra: true }); }
      }
    } finally {
      el.classList.remove('is-active');
      this.root.classList.remove('is-hero-turn');
      el._parts.body.style.zIndex = String(Math.round(u.pos.ground));
      if (!extra) C.endTurn(b, u);
      this.refreshAll();
    }
  }

  // the Star reroll offer, in the action bar: one tap to spend, one to keep; autoplay decides by itself
  askStar(u) {
    const { ctx } = this;
    return new Promise((resolve) => {
      let done = false;
      const fin = (v) => { if (done) return; done = true; this.hideBar(); resolve(v); };
      this.showBar(u, { preview: true });
      this.descEl.replaceChildren(h('b', STR.reroll));
      const mk = (cls, ic, name, hint, v) => {
        const btn = h(`button.cb-act.${cls}`, { type: 'button' }, icon(ic, 'cb-act-ic'), h('span.cb-act-name', name), h('span.cb-act-hint', hint));
        btn.addEventListener('click', () => { this.sfx(v ? 'ui.confirm' : 'ui.close'); fin(v); });
        return btn;
      };
      const spend = mk('k-star', 'star', STR.spend, STR.spendHint(ctx.state.stars || 0), true);
      const keep = mk('k-back.k-keep', 'cross', STR.keep, STR.keepHint, false);
      this.rowEl.replaceChildren(spend, keep);
      this.barKeys = [spend, keep];
      this.backFn = () => fin(false);
      if (ctx.auto) this.sleep(600).then(() => fin(ctx.auto.rng.chance(0.6)));
    });
  }

  firstBattleBefriend() {
    return this.b.enc.canBefriend !== false && C.activeFoes(this.b).some((f) => f.canCalm) && !this.ctx.state.flag('teach.befriend');
  }

  refreshAll() { for (const u of [...this.b.heroes, ...this.b.foes]) this.refresh(u); }

  showBar(u, { preview = false } = {}) {
    this.hideGm();
    const acts = C.heroActions(this.b, u);
    this.curActs = acts;
    this.barHero = u;
    const desc = h('div.cb-desc', STR.turn(u.name.split(' ')[0]));
    const row = h('div.cb-acts');
    const card = h('div.cb-herocard',
      this.ctx.ui.portrait(u.arch, 'md'),
      h('div.cb-herocard-info', h('div.cb-herocard-name', u.name.split(' ')[0]),
        h('div.cb-herocard-sparks', h('span', STR.sparks), h('span.cb-pips', Array.from({ length: R.SPARKS.max }, (_, i) => h('i', { class: i < u.sparks ? 'on' : null }))))));
    this.bar.replaceChildren(card, h('div.cb-main', desc, row));
    this.descEl = desc; this.rowEl = row;
    this.renderActs(acts, preview);
    this.bar.classList.remove('is-hidden');
  }

  renderActs(acts, preview) {
    const keys = [];
    const btns = acts.map((a) => {
      const ic = a.kind === 'strike' ? (ACT_ICON[a.fx] || 'sword') : a.kind === 'befriend' ? 'heart' : a.kind === 'guard' ? 'shield' : a.kind === 'item' ? 'bag' : (ACT_ICON[a.fx] || 'star');
      const btn = h('button.cb-act', { type: 'button', class: [a.great ? 'is-great' : '', `k-${a.kind}`].join(' '), 'aria-disabled': a.enabled ? null : 'true', dataset: { act: a.id } },
        a.cost ? h('span.cb-cost', Array.from({ length: a.cost }, () => h('i'))) : null,
        icon(ic, 'cb-act-ic'), h('span.cb-act-name', a.name),
        h('span.cb-act-hint', !a.enabled && a.why ? a.why : (HINT[a.id] || HINT[a.kind] || '')));
      const show = () => { this.descEl.replaceChildren(h('b', a.name + (a.cost ? ` (${a.cost} ${STR.sparks})` : '') + ': '), a.enabled ? a.text : (a.why || a.text)); };
      btn.addEventListener('pointerenter', show);
      btn.addEventListener('focus', show);
      btn.addEventListener('click', () => {
        if (preview || !this.picking || this.picking.done) return;
        show();
        if (!a.enabled) { this.sfx('ui.deny'); this.anim(btn, [{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], 220); return; }
        this.sfx('ui.confirm');
        this.choose(a);
      });
      btn.addEventListener('pointerdown', () => btn.classList.add('is-pressed'));
      btn.addEventListener('pointerup', () => btn.classList.remove('is-pressed'));
      btn.addEventListener('pointerleave', () => btn.classList.remove('is-pressed'));
      keys.push(btn);
      return btn;
    });
    this.rowEl.replaceChildren(...btns);
    this.barKeys = keys;
    this.backFn = null;
    btns.forEach((b, i) => this.anim(b, [{ transform: 'translateY(24px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], 320, { delay: i * 35, fill: 'backwards' }));
  }

  hideBar() { this.bar.classList.add('is-hidden'); this.backFn = null; this.barKeys = null; this.rowEl?.querySelectorAll('.cb-act').forEach((b) => b.setAttribute('tabindex', '-1')); }

  pickAction(u) {
    return new Promise((resolve) => {
      this.picking = { u, resolve, done: false };
      this.showBar(u);
    });
  }

  finishPick(action, targets) {
    if (!this.picking || this.picking.done) return;
    this.picking.done = true;
    const res = this.picking.resolve;
    this.picking = null;
    res({ action, targets });
  }

  choose(a) {
    if (!this.picking || this.picking.done) return;
    const u = this.picking.u;
    if (a.kind === 'item') return this.chooseItem(u, a);
    const tg = a.target;
    if (tg === 'self') return this.finishPick(a.id, [u.uid]);
    if (tg === 'allFoes' || tg === 'allAllies') return this.finishPick(a.id, []);
    this.targetMode(u, a, (ids) => this.finishPick(a.id, ids));
  }

  chooseItem(u, a) {
    this.descEl.replaceChildren(STR.items);
    const back = h('button.cb-act.k-back', { type: 'button' }, icon('cross', 'cb-act-ic cb-rot45'), h('span.cb-act-name', STR.back));
    const go = () => { if (!this.picking || this.picking.done) return; this.sfx('ui.close'); this.renderActs(this.curActs); this.descEl.replaceChildren(STR.turn(u.name.split(' ')[0])); };
    back.addEventListener('click', go);
    const btns = a.items.map((it) => {
      const btn = h('button.cb-act.k-item', { type: 'button' }, h('span.cb-qty', '×' + it.qty), this.ctx.ui.itemImg(it.itemId, 40), h('span.cb-act-name', it.name));
      btn.addEventListener('pointerenter', () => this.descEl.replaceChildren(h('b', it.name + ': '), it.text));
      btn.addEventListener('click', () => {
        if (!this.picking || this.picking.done) return;
        this.sfx('ui.confirm');
        if (it.target === 'ally') this.targetMode(u, { ...it, id: it.id }, (ids) => this.finishPick(it.id, ids), go);
        else this.finishPick(it.id, it.target === 'self' ? [u.uid] : []);
      });
      return btn;
    });
    this.rowEl.replaceChildren(...btns, back);
    this.barKeys = [...btns, back];
    this.backFn = go;
  }

  targetMode(u, a, done, onBack) {
    const { b } = this;
    const list = C.targetsFor(b, u, a);
    const shots = a.id === 'twin_arrows' ? 2 : 1;
    const picked = [];
    const ally = ['ally', 'allyAny', 'allyOther'].includes(a.target);
    const prompt = () => this.descEl.replaceChildren(h('b', a.name + ': '), picked.length ? STR.second : a.target === 'calmFoe' ? STR.chooseCalm : a.target === 'allyOther' ? STR.chooseOther : ally ? STR.chooseAlly : STR.chooseFoe);
    prompt();
    const back = h('button.cb-act.k-back', { type: 'button' }, icon('cross', 'cb-act-ic cb-rot45'), h('span.cb-act-name', STR.back));
    const goBack = () => { if (!this.picking || this.picking.done) return; this.sfx('ui.close'); this.clearTargets(); if (onBack) onBack(); else { this.renderActs(this.curActs); this.descEl.replaceChildren(STR.turn(u.name.split(' ')[0])); } };
    back.addEventListener('click', goBack);
    this.rowEl.replaceChildren(h('div.cb-target-hint', icon(ally ? 'heart' : 'target', 'cb-act-ic'), h('span', a.name)), back);
    this.barKeys = [back];
    this.backFn = goBack;
    for (const t of list) this.els.get(t.uid)?.classList.add('is-targetable', ally ? 'is-target-ally' : 'x');
    this.onUnitClick = (t) => {
      if (!list.includes(t) || !this.picking || this.picking.done) return;
      this.sfx('ui.confirm');
      picked.push(t.uid);
      this.anim(this.els.get(t.uid)._parts.body, [{ transform: 'scale(1.06)' }, { transform: 'scale(1)' }], 260);
      if (picked.length >= shots || list.length === 0) { this.clearTargets(); done(picked); }
      else prompt();
    };
  }

  async flashPick(pick) {
    const btn = this.rowEl?.querySelector(`[data-act="${pick.action.startsWith('item:') ? 'item' : pick.action}"]`);
    btn?.classList.add('is-chosen');
    const a = this.curActs?.find((x) => x.id === pick.action);
    if (a && this.descEl) this.descEl.replaceChildren(h('b', a.name + ': '), a.text);
    for (const id of pick.targets || []) this.els.get(id)?.classList.add('is-targetable');
    await this.sleep(500);
    this.clearTargets();
  }

  // ---------- play a hero result ----------
  async playHero(u, r, { shown = false } = {}) {
    const { b, ctx } = this;
    const el = this.els.get(u.uid);
    const from = this.center(u);
    const targets = (r.targets || []).map((id) => C.unit(b, id)).filter(Boolean);
    const t0 = targets[0];
    const to = t0 ? this.center(t0) : from;
    // a foe leaving (flees or befriended) gets its own call at once; the hero's call would only stack in front of it
    const goes = (r.effects || []).some((e) => e.t === 'out');
    const lines = goes ? null : this.heroLines(u, r);
    const label = r.name;

    // wind-up
    this.anim(el._parts.body, [{ transform: 'translateX(0) scale(1)' }, { transform: 'translateX(-14px) scale(1.04, .97)' }, { transform: 'translateX(0) scale(1)' }], 320);
    if (r.cost) { this.refresh(u); this.float(u, `-${r.cost} ✦`, 'spark', { dy: 30 }); }
    if (r.roll) {
      if (!shown) {
        await this.diceRoll(r.roll, { x: from.x + 40, y: from.y + 40 }, HERO_TINT[u.arch] || '#2f55c8');
        this.showRoll(r.roll, { label, check: r.kind === 'check' || r.kind === 'befriend' });
      }
      // the Chronicle counts what the die showed: Sneak Strike's 18 or the Goggles' 19 are crits, not natural 20s
      if (r.roll.crit) this.sfx('check.crit');
      if (r.roll.die === 20) ctx.state.tallyAdd?.('nat20', 1);
      if (r.roll.fumble) this.sfx('check.fumble');
      if (r.roll.die === 1) ctx.state.tallyAdd?.('nat1', 1);
      await this.sleep(shown ? 100 : 250);
    } else {
      this.descFloat(u, label);
    }
    const lineP = this.say(lines, { actor: u.id });

    // the move
    const fxId = r.kind === 'befriend' ? 'befriend' : r.kind === 'guard' ? 'guard' : r.kind === 'item' ? (r.item === 'flash_lantern' ? 'flash_lantern' : 'item') : r.fx;
    this.sfx(SFX[fxId] || 'whoosh');
    const melee = MELEE.includes(fxId) && t0 && t0.side === 'foe';
    const ally = t0 && t0.side === 'hero';
    let lunge = null;
    if (melee) {
      const dx = Math.max(60, Math.min(t0.pos.x - u.pos.x - 150, 420));
      lunge = dx;
      await this.anim(el._parts.body, [{ transform: 'translateX(0)' }, { transform: `translateX(${dx}px)` }], 230, { easing: 'cubic-bezier(.5,0,.9,.4)', fill: 'forwards' });
    }
    const area = r.targets?.length > 1 && !ally;
    const play = {
      from, to: fxId === 'guard' || fxId === 'item' && !ally ? from : to,
      targets: (area ? targets : t0 ? [t0] : [u]).map((t) => this.center(t)),
    };
    if (['song', 'bloom'].includes(fxId)) play.targets = C.livingHeroes(b).map((t) => this.center(t));
    if (fxId === 'item' && r.effects.some((e) => e.t === 'heal')) play.to = this.center(C.unit(b, r.effects.find((e) => e.t === 'heal').target));
    const missed = r.roll && !r.roll.vs.some((v) => v.hit);
    if (missed && !['befriend', 'dust'].includes(fxId)) {
      // a miss still throws the punch, just a little wide
      const wide = { x: to.x + 60, y: to.y - 90 };
      if (!melee) await this.fx.play(fxId, { ...play, to: wide, targets: play.targets.map((p) => ({ x: p.x + 60, y: p.y - 90 })) });
      this.sfx('miss');
      for (const t of targets) { this.float(t, STR.miss, 'miss'); this.anim(this.els.get(t.uid)._parts.body, [{ transform: 'translateX(0)' }, { transform: 'translateX(26px) rotate(4deg)' }, { transform: 'translateX(0)' }], 360); }
    } else {
      await this.fx.play(fxId, { ...play, to: play.to });
      if (r.roll?.crit) { ctx.stage.fx('shake'); }
    }
    if (lunge != null) this.anim(el._parts.body, [{ transform: `translateX(${lunge}px)` }, { transform: 'translateX(0)' }], 360);
    if (r.liked && r.effects.some((e) => e.t === 'calm')) this.float(targets[0], STR.liked, 'calm', { dy: -40 });
    await this.playEffects(r.effects, u);
    if (r.kind === 'befriend' && missed) this.float(targets[0], STR.notYet, 'miss');
    await this.sleep(140);
    this.hideRoll();
    this.clearDice();
    await lineP;
    if (r.roll?.crit && !goes && C.outcome(b) == null) await this.sayPool('battle.heroCrit');
    await this.playOuts(r.effects);
  }

  descFloat(u, text) { this.float(u, text, 'info', { dy: -10 }); }

  heroLines(u, r) {
    const d = u.def;
    if (r.kind === 'guard') return this.ctx.gm.line?.('guard.use');
    if (r.kind === 'item') return this.ctx.gm.line?.('item.use');
    if (r.kind === 'befriend') return this.ctx.gm.line?.(r.outcome === 'hit' || r.outcome === 'crit' ? 'befriend.yes' : 'befriend.no');
    if (r.strike) {
      const L = d.strike?.lines || {};
      return this.pick(r.outcome === 'crit' ? (L.crit || L.hit) : r.outcome === 'hit' ? L.hit : L.miss);
    }
    const p = (d.powers || []).find((x) => x.id === r.power);
    const L = p?.lines || {};
    if (r.outcome === 'miss' || r.outcome === 'fumble') return this.pick(L.miss || L.use);
    return this.pick(L.hit || L.use);
  }

  // apply effects visually: numbers, bars, statuses
  async playEffects(effects, actor) {
    const { b, ctx } = this;
    let weakShown = false;
    for (const e of effects) {
      const t = e.target ? C.unit(b, e.target) : null;
      const el = t ? this.els.get(t.uid) : null;
      switch (e.t) {
        case 'dmg': {
          this.refresh(t);
          const big = e.crit || e.n >= 8;
          this.float(t, `-${e.n}`, e.crit ? 'crit' : 'dmg', { big });
          if (e.crit) this.float(t, STR.crit, 'crit', { dy: -46 });
          if (e.weak && !weakShown) { weakShown = true; this.float(t, STR.weak, 'weak', { dy: -46 }); }
          if (e.protectFor) { const pf = C.unit(b, e.protectFor); this.float(pf, STR.blocked, 'info'); this.fx.play('shield', { from: this.center(t), to: this.center(pf) }); }
          this.sfx(t.side === 'foe' ? (t.hp > 0 ? 'enemy.hurt' : 'hit.heavy') : 'hero.hurt');
          if (el) {
            const dir = t.side === 'foe' ? 1 : -1;
            this.anim(el._parts.body, [{ transform: 'translateX(0)', filter: 'brightness(1)' }, { transform: `translateX(${dir * 22}px)`, filter: 'brightness(2.6) saturate(.4)', offset: 0.18 }, { transform: `translateX(${-dir * 6}px)`, filter: 'brightness(1)', offset: 0.55 }, { transform: 'translateX(0)', filter: 'brightness(1)' }], 460);
          }
          if (big || e.weak) ctx.stage.fx('shake');
          break;
        }
        case 'heal': {
          this.refresh(t);
          this.float(t, `+${e.n}`, 'heal');
          if (e.revive) { this.float(t, STR.revive, 'heal', { dy: -46 }); this.fx.exit('revive', this.center(t)); this.sfx('heal'); }
          break;
        }
        case 'status': {
          this.refresh(t);
          if (['asleep', 'stunned', 'tangled', 'marked', 'blinded', 'drowsy'].includes(e.s) && el) {
            const st = el._parts.statuses.querySelector(`.st-${e.s}`);
            st?.classList.add('is-new');
          }
          if (e.s === 'asleep') this.float(t, STR.asleep, 'info', { dy: -46 });
          if (e.s === 'guarded') this.float(t, STR.guardOn, 'info', { dy: -10 });
          break;
        }
        case 'unstatus': case 'clear': case 'wake': this.refresh(t); if (e.t === 'wake') this.float(t, STR.wakeUp, 'info', { dy: -46 }); break;
        case 'calm': {
          this.refresh(t);
          this.float(t, STR.calm(e.n), 'calm', { dy: 10 });
          this.fx.exit('hearts', this.head(t));
          this.sfx('befriend', { volume: 0.6 });
          const pips = el?._parts.plate.querySelectorAll('.cb-calm > i.on');
          pips?.forEach((p, i) => { if (i >= e.calm - e.n) this.anim(p, [{ transform: 'scale(1.9)' }, { transform: 'scale(1)' }], 420, { delay: (i - (e.calm - e.n)) * 60, fill: 'backwards' }); });
          break;
        }
        case 'sparks': this.refresh(t); if (e.n > 0 && actor) this.float(t, `+${e.n} ✦`, 'spark', { dy: 30 }); if (e.n < 0) this.float(t, `${e.n} ✦`, 'spark', { dy: 30 }); break;
        case 'daze': {
          this.refresh(t);
          this.float(t, STR.dazed, 'miss', { dy: -46 });
          this.sfx('hero.down');
          break;
        }
        case 'phase': {
          // a proper beat: the machine rattles, cogs and steam burst out, a banner, then Quill's warning
          const c = this.center(t);
          this.sfx('thunder');
          ctx.stage.fx('shake');
          this.fx.exit('phase', c);
          this.fx.exit('steamburst', c);
          setTimeout(() => { this.fx.exit('bigcogs', c); this.sfx('hit.heavy'); ctx.stage.fx('shake'); }, 420 / this.speed());
          el?.classList.add('is-phase2', 'is-phasing');
          this.hideRoll();
          await Promise.race([ctx.ui.banner(STR.armour, { kind: 'crit', sub: STR.armourSub, hold: 1700 }), this.sleep(3400)]);
          el?.classList.remove('is-phasing');
          const warn = (t.def.lines?.weakHint || []).find((l) => /armour|panser/i.test(l));
          if (warn) await this.say(warn, { actor: null });
          break;
        }
        case 'coins': ctx.state.addGold(e.n); this.sfx('coin'); this.float(actor || b.heroes[0], STR.coins(e.n), 'gold', { dy: -46 }); break;
        case 'star': ctx.state.addStar?.(e.n, 'Lucky Acorn'); this.sfx('star.gain'); this.float(actor || b.heroes[0], STR.star, 'gold', { dy: -46 }); break;
        case 'useItem': ctx.state.take(e.id, 1); if (e.gift) { const f = C.unit(b, e.target); this.float(f, STR.gift(ctx.content.items?.[e.id]?.name || e.id), 'calm', { dy: -80 }); } break;
        case 'extra': this.float(t, STR.encore, 'gold', { dy: -46 }); break;
        default: break;
      }
    }
    this.sync();
    this.refreshAll();
    if (effects.some((e) => e.t === 'daze')) {
      const down = effects.filter((e) => e.t === 'daze');
      await this.say(this.ctx.gm.line?.('battle.heroDown'), { actor: down[0].target ? C.unit(b, down[0].target).id : null });
      const m = C.mercyHalf(b);
      if (m) {
        this.sfx('heal');
        for (const h2 of C.livingHeroes(b)) this.fx.play('heal', { to: this.center(h2) });
        ctx.ui.toast(STR.secondWind, { kind: 'info', icon: 'heart' });
        await this.sayPool('mercy.battle');
        await this.playEffects(m, null);
      }
    }
  }

  async playOuts(effects) {
    const { b } = this;
    const outs = effects.filter((e) => e.t === 'out');
    if (!outs.length) return;
    const lines = [];
    for (const e of outs) {
      const f = C.unit(b, e.target);
      const el = this.els.get(f.uid);
      if (!el || el.classList.contains('is-gone')) continue;
      if (e.how === 'befriended') {
        this.sfx('befriend');
        el.classList.add('is-friend');
        this.fx.exit('hearts', this.center(f));
        this.anim(el._parts.body, [
          { transform: 'translateY(0) rotate(0)' }, { transform: 'translateY(-40px) rotate(-6deg)', offset: 0.15 }, { transform: 'translateY(0) rotate(0)', offset: 0.3 },
          { transform: 'translateY(-26px) rotate(6deg)', offset: 0.45 }, { transform: 'translateY(0) rotate(0)', offset: 0.6 },
          { transform: 'translateY(0) rotate(-8deg)', offset: 0.7 }, { transform: 'translateY(0) rotate(8deg)', offset: 0.8 }, { transform: 'translateY(0) rotate(0)', offset: 0.9 },
          { transform: 'translateX(0)', opacity: 1 }], 1500);
        lines.push(this.pick(f.def.lines?.befriended));
        setTimeout(() => { this.anim(el._parts.body, [{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(320px)', opacity: 0 }], 900, { fill: 'forwards' }); el.classList.add('is-gone'); }, 1500 / this.speed());
      } else {
        this.sfx(EXIT[f.type] === 'cogs' || EXIT[f.type] === 'bigcogs' ? 'hit.heavy' : 'enemy.flee');
        el.classList.add('is-fled');
        this.fx.exit(EXIT[f.type] || 'sparkles', this.center(f));
        const machine = ['cogs', 'bigcogs'].includes(EXIT[f.type]);
        const pop = EXIT[f.type] === 'sparkles' || EXIT[f.type] === 'shards';
        const frames = machine
          ? [{ transform: 'translateY(0) rotate(0) scale(1)', opacity: 1 }, { transform: 'translateY(-20px) rotate(-6deg) scale(1.02)', offset: 0.2 }, { transform: 'translateY(60px) rotate(14deg) scale(.6)', opacity: 0 }]
          : pop ? [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.25)', opacity: 0.9, offset: 0.3 }, { transform: 'scale(.2)', opacity: 0 }]
            : [{ transform: 'translateX(0) scaleX(1)', opacity: 1 }, { transform: 'translateX(-20px) scaleX(1)', offset: 0.15 }, { transform: 'translateX(0) scaleX(-1)', offset: 0.3 }, { transform: 'translateX(380px) scaleX(-1)', opacity: 0 }];
        this.anim(el._parts.body, frames, machine ? 900 : 1000, { fill: 'forwards' });
        el.classList.add('is-gone');
        lines.push(this.pick(f.def.lines?.flee));
      }
    }
    this.renderRibbon();
    const line = lines.find(Boolean);
    if (line) await this.say(line, { actor: null });
    await this.sleep(150);
  }

  // ---------- foe turn ----------
  async foeTurn(f) {
    const { b, ctx } = this;
    const el = this.els.get(f.uid);
    el.classList.add('is-active');
    try {
      const st = C.beginFoeTurn(b, f);
      this.refresh(f);
      if (st.skip) {
        this.float(f, st.skip === 'asleep' ? STR.asleep : STR.stunned, 'info', { dy: -10 });
        this.sfx(st.skip === 'asleep' ? 'spell.sleep' : 'miss', { volume: 0.5 });
        this.anim(el._parts.body, [{ transform: 'rotate(0)' }, { transform: 'rotate(-4deg)' }, { transform: 'rotate(4deg)' }, { transform: 'rotate(0)' }], 700);
        await this.sleep(750);
        return;
      }
      if (st.dizzy) this.float(f, STR.dizzy, 'info', { dy: -10 });
      const intent = C.chooseFoeIntent(b, f);
      const targets = intent.targets.map((id) => C.unit(b, id)).filter(Boolean);
      if (!targets.length) return;
      for (const t of targets) this.els.get(t.uid)?.classList.add('is-aimed');
      const single = targets.length === 1 ? targets[0] : null;
      this.hideBar();
      // The intent line opens the turn; once its first half has been heard (about 2 to 3 s) the roll starts
      // and the clip plays on under it. The hit or miss call follows the intent clip, over the next hero's bar.
      let intentP = Promise.resolve();
      if (intent.pending) {
        this.float(f, intent.move.name + '!', 'crit', { dy: -10, big: true });
        this.anim(el._parts.body, [{ transform: 'translateY(0)' }, { transform: 'translateY(-70px)' }], 420, { fill: 'forwards' });
        await this.sleep(450);
      } else {
        this.anim(el._parts.body, [{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }], 500);
        const it = this.pick(intent.move.lines?.intent);
        intentP = this.say(it, { actor: single ? single.id : null });
        if (it) await Promise.race([intentP, this.sleep(Math.min(this.lineMs(it), Math.max(2200, Math.min(3000, this.lineMs(it) * 0.5))))]);
      }
      const r = C.resolveFoeIntent(b, f, intent);
      const from = this.center(f);
      await this.diceRoll(r.roll, { x: from.x - 40, y: from.y + 40 }, FOE_TINT, { small: true });
      this.showRoll(r.roll, { label: intent.move.name, foe: true });
      await this.sleep(200);
      // the move
      const fxId = FOE_FX[intent.move.id] || (targets.length > 1 ? 'rumble' : 'claw');
      this.sfx(FOE_SFX[intent.move.id] || 'whoosh');
      const ranged = FOE_RANGED.includes(intent.move.id);
      const t0 = single || targets[0];
      let dx = 0;
      if (!ranged && single) {
        dx = -Math.max(60, Math.min(f.pos.x - t0.pos.x - (f.boss ? 260 : 150), 460));
        const dy = intent.move.id === 'dive' ? (t0.pos.y - t0.pos.h * 0.5) - (f.pos.y - f.pos.h * 0.5) + 70 : 0;
        await this.anim(el._parts.body, [{ transform: `translate(0, ${intent.pending ? -70 : 0}px)` }, { transform: `translate(${dx}px, ${dy}px)` }], intent.move.id === 'dive' ? 300 : 240, { easing: 'cubic-bezier(.5,0,.9,.4)', fill: 'forwards' });
      }
      const hitT = r.roll.vs.filter((v) => v.hit).map((v) => C.unit(b, v.uid));
      const missT = r.roll.vs.filter((v) => !v.hit).map((v) => C.unit(b, v.uid));
      const lineKey = hitT.length ? 'hit' : 'miss';
      const line = lineKey === 'miss' && ctx.rng.chance(0.35) ? ctx.gm.line?.('battle.foeMiss') : this.pick(intent.move.lines?.[lineKey]);
      if (hitT.length || ranged || targets.length > 1) {
        await this.fx.foe(fxId, { from, to: this.center(t0), targets: (hitT.length ? hitT : targets).map((t) => this.center(t)) });
      }
      for (const t of missT) {
        const v = r.roll.vs.find((x) => x.uid === t.uid);
        this.float(t, v?.guarded ? STR.blocked : STR.miss, 'miss');
        this.sfx(v?.guarded ? 'block' : 'miss');
        this.anim(this.els.get(t.uid)._parts.body, [{ transform: 'translateX(0)' }, { transform: 'translateX(-30px) rotate(-5deg)' }, { transform: 'translateX(0)' }], 380);
      }
      if (dx) this.anim(el._parts.body, [{ transform: `translateX(${dx}px)` }, { transform: 'translateX(0)' }], 420);
      else if (intent.pending) this.anim(el._parts.body, [{ transform: 'translateY(-70px)' }, { transform: 'translateY(0)' }], 300);
      await this.playEffects(r.effects, null);
      await this.sleep(140);
      this.hideRoll();
      this.clearDice();
      // the bar comes back as soon as the last impact has landed: the intent clip ends and the hit or miss call
      // plays over the next hero's bar (voice only, the panel stays away from the bar). Another foe next: no call.
      // the intent call is always settled here; the result call is voice only and only when a hero acts next
      await intentP;
      if (this.nextIsHero() && !C.outcome(b) && !r.effects.some((e) => e.t === 'daze')) this.voiceOnly(line).catch(() => {});
      for (const t of targets) this.els.get(t.uid)?.classList.remove('is-aimed');
      if (C.outcome(b)) return;
      const ann = C.maybeAnnounce(b, f);
      if (ann) {
        await intentP;
        const t = C.unit(b, ann.target);
        this.refresh(t);
        this.els.get(t.uid)?.classList.add('is-aimed');
        this.float(t, STR.next(ann.move.name), 'crit', { dy: -10 });
        this.sfx('sting.danger', { volume: 0.5 });
        await this.say(this.pick(ann.move.lines?.intent), { actor: t.id });
        this.els.get(t.uid)?.classList.remove('is-aimed');
      }
    } finally {
      el.classList.remove('is-active');
      C.endTurn(b, f);
      this.refreshAll();
    }
  }

  // engine hearts -> ctx.state (so the HUD follows)
  sync() {
    const { ctx } = this;
    for (const u of this.b.heroes) {
      const sh = ctx.state.hero(u.id);
      if (!sh) continue;
      const hp = Math.max(0, u.hp);
      if (hp < sh.hp) ctx.state.damage(u.id, sh.hp - hp);
      else if (hp > sh.hp) ctx.state.heal(u.id, hp - sh.hp);
    }
  }
}
