// Fallbacks used by main.js when an optional module is missing or throws (SPEC 3).
// silentAudio(), createDice2D(hostEl), and FALLBACKS[name](...args, ctx) for every [screens]/[combat] entry point.
import { h, wait } from '../ui/dom.js';
import * as R from './rules.js';
import { L } from './i18n.js';

const STR = L({
  en: {
    begin: 'Begin', cont: 'Continue', sub: 'The Sleepless Dragon', title: 'Lanternfall', wait: 'Pull up a chair. The Storykeeper is waiting.',
    partyKicker: 'Who is at the table tonight?', partyTitle: 'Choose your heroes', partyNote: 'Pick one to four heroes.', partyGo: 'Begin the tale',
    travel: (to) => `Travelling to ${to}`, rest: 'Everyone rests. Hearts are full.',
    level: (n) => `Level ${n}!`, levelSub: '+3 hearts for every hero', gift: 'Choose a gift', giftNote: 'Each gift lasts the whole adventure.',
    shop: 'Shop', purse: (n) => `You have ${n} coins.`, leave: 'Leave',
    lullaby: 'The lullaby', sing: 'Sing her to sleep', phrase: (n) => `Phrase ${n}`, chimes: 'The chimes are not built yet.', playTrue: 'Play it true', stumble: 'Stumble',
    door: 'The Dwarf-Door', runes: 'Six runes', runesNote: 'The rune puzzle is not built yet.', answer: 'Lantern, Song, Dragon', giveUp: 'Give up',
    hero: (x) => `${x.name}, level ${x.level}, ${x.hp}/${x.maxHp} hearts`, quests: 'Quests', done: 'Done: ', noQuests: 'No quests yet.',
    book: "The Storykeeper's Book", close: 'Close',
    settings: 'Settings', voiceIs: (on) => `Voice is ${on ? 'on' : 'off'}.`, voiceOff: 'Voice off', voiceOn: 'Voice on', restart: 'Restart',
    told: 'And so the tale is told.', nat20: (n) => `Natural 20s: ${n}`, passed: (a, b) => `Checks passed: ${a} of ${b}`, friends: (n) => `Friends made: ${n}`, stars: (n) => `Stars earned: ${n}`,
    chronicle: 'The Chronicle', end: 'The End', again: 'Play again',
    win: 'Win', befriend: 'Befriend', lose: 'Lose', battleKicker: 'Battle (not built yet)', battleNote: 'Pick how the battle ends.',
  },
  da: {
    begin: 'Begynd', cont: 'Fortsæt', sub: 'Den søvnløse drage', title: 'Lygtefald', wait: 'Find en stol. Sagnvogteren venter.',
    partyKicker: 'Hvem sidder ved bordet i aften?', partyTitle: 'Vælg jeres helte', partyNote: 'Vælg fra en til fire helte.', partyGo: 'Begynd fortællingen',
    travel: (to) => `På vej til ${to}`, rest: 'Alle hviler. Hjerterne er fulde.',
    level: (n) => `Niveau ${n}!`, levelSub: '+3 hjerter til hver helt', gift: 'Vælg en gave', giftNote: 'Hver gave varer hele eventyret.',
    shop: 'Butik', purse: (n) => `I har ${n} ${n === 1 ? 'mønt' : 'mønter'}.`, leave: 'Gå',
    lullaby: 'Vuggevisen', sing: 'Syng hende i søvn', phrase: (n) => `Vers ${n}`, chimes: 'Klokkespillet er ikke bygget endnu.', playTrue: 'Spil den rent', stumble: 'Snub',
    door: 'Dværgeporten', runes: 'Seks runer', runesNote: 'Rune-gåden er ikke bygget endnu.', answer: 'Lygte, Sang, Drage', giveUp: 'Giv op',
    hero: (x) => `${x.name}, niveau ${x.level}, ${x.hp}/${x.maxHp} hjerter`, quests: 'Opgaver', done: 'Klaret: ', noQuests: 'Ingen opgaver endnu.',
    book: 'Sagnvogterens bog', close: 'Luk',
    settings: 'Indstillinger', voiceIs: (on) => `Stemmen er ${on ? 'tændt' : 'slukket'}.`, voiceOff: 'Sluk stemmen', voiceOn: 'Tænd stemmen', restart: 'Start forfra',
    told: 'Og sådan blev fortællingen fortalt.', nat20: (n) => `Rene 20'ere: ${n}`, passed: (a, b) => `Slag der lykkedes: ${a} af ${b}`, friends: (n) => `Nye venner: ${n}`, stars: (n) => `Stjerner fået: ${n}`,
    chronicle: 'Krøniken', end: 'Slut', again: 'Spil igen',
    win: 'Vind', befriend: 'Bliv venner', lose: 'Tab', battleKicker: 'Kamp (ikke bygget endnu)', battleNote: 'Vælg hvordan kampen ender.',
  },
});

export function silentAudio() {
  let vol = { master: 1, music: 1, sfx: 1, voice: 1 };
  return {
    silent: true,
    unlock() {}, music() {}, ambience() {}, sfx() {}, chime() {},
    voice() { return Promise.resolve(); }, voiceDuration() { return 0; }, stopVoice() {},
    setVolume(v) { vol = { ...vol, ...v }; }, getVolume() { return { ...vol }; },
  };
}

// A 2D CSS die that tumbles and lands on the number.
export function createDice2D(host) {
  const sp = () => window.__LF_SPEED || 1;
  let tray = null;
  return {
    fallback: true,
    async roll(spec = {}) {
      if (tray) tray.remove();
      tray = h('div.lf-die2d-tray');
      host.appendChild(tray);
      const els = (spec.dice || []).map((d) => {
        const span = h('span', String(d.value));
        const sz = Math.min(2, Math.max(0.3, Number(spec.size) || 1));
        const el = h('div.lf-die2d', { style: { '--tint': d.tint || '#6a4bd8', zoom: sz !== 1 ? String(sz) : null }, dataset: { sides: d.sides } }, span);
        tray.appendChild(el);
        return { el, span, d };
      });
      const dur = (spec.fast ? 520 : 1300) / sp();
      const t0 = performance.now();
      while (performance.now() - t0 < dur * 0.75) {
        for (const x of els) x.span.textContent = String(1 + Math.floor(Math.random() * x.d.sides));
        await wait(70 / sp());
      }
      for (const x of els) {
        x.span.textContent = String(x.d.value);
        if ((x.d.sides === 20 && x.d.value === 20) || spec.crit === 'success') x.el.classList.add('is-crit');
      }
      await wait(dur * 0.25);
      for (const x of els) if (x.d.dropped) x.el.classList.add('is-dropped');
    },
    async clear() {
      if (!tray) return;
      const t = tray; tray = null;
      [...t.children].forEach((c) => c.classList.add('is-out'));
      await wait(380 / sp());
      t.remove();
    },
    setQuality() {}, dispose() { tray?.remove(); },
  };
}

const note = (t) => h('p.lf-fallback-note', t);

export const FALLBACKS = {
  async title(ctx) {
    await ctx.stage.setBg('title', { fade: 0.6 });
    ctx.audio.music('title');
    if (ctx.auto) return 'new';
    const buttons = [{ id: 'new', label: STR.begin, kind: 'primary', size: 'lg' }];
    if (ctx.save.exists()) buttons.push({ id: 'continue', label: STR.cont, kind: 'ghost', size: 'lg' });
    return ctx.ui.modal({ kicker: STR.sub, title: STR.title, body: STR.wait, buttons });
  },

  async party(ctx) {
    const { ui } = ctx;
    const sel = new Set(['knight', 'wizard']);
    let resolveFn;
    const grid = h('div.lf-grid-heroes', R.ARCH_ORDER.map((arch) => {
      const hc = ctx.content?.heroes?.[arch];
      const b = h('button.lf-toggle-hero', { type: 'button', class: sel.has(arch) ? 'is-sel' : null },
        ui.portrait(arch, 'sm'), h('span', h('b', hc?.name || R.DEFAULT_NAMES[arch]), h('small', hc?.calling || arch)));
      b.addEventListener('click', () => {
        ctx.audio.sfx('ui.tap');
        if (sel.has(arch)) sel.delete(arch); else if (sel.size < 4) sel.add(arch);
        b.classList.toggle('is-sel', sel.has(arch));
      });
      return b;
    }));
    await ui.modal({ wide: true, kicker: STR.partyKicker, title: STR.partyTitle, body: [grid, note(STR.partyNote)],
      buttons: [{ id: 'go', label: STR.partyGo, kind: 'primary' }], onOpen: (_b, close) => { resolveFn = close; } });
    void resolveFn;
    ctx.state.setParty(sel.size ? [...sel] : ['knight']);
  },

  async prologue(ctx) {
    const panels = ctx.content?.prologue?.panels || [];
    for (const p of panels) {
      if (p.art) await ctx.stage.setBg(null, { url: ctx.assets.story(p.art), fade: 1 });
      for (const l of p.lines || []) await ctx.gm.say(typeof l === 'string' ? l : l.say, { mood: (typeof l === 'object' && l.mood) || 'warm' });
    }
  },

  async travel(nodeId, ctx) {
    const node = ctx.content?.map?.nodes?.find((n) => n.id === nodeId);
    ctx.ui.toast(STR.travel(node?.label || nodeId.replace(/_/g, ' ')), { icon: 'map', kind: 'info' });
    ctx.audio.sfx('footsteps');
    await ctx.gm.react('travel.go');
  },

  async rest(ctx) {
    ctx.audio.sfx('heal');
    ctx.state.heal('all', 'full');
    ctx.ui.toast(STR.rest, { icon: 'heart', kind: 'info' });
    await ctx.sleep(900);
  },

  async levelup(level, ctx) {
    await ctx.ui.banner(STR.level(level), { kind: 'chapter', sub: STR.levelSub });
    ctx.audio.sfx('levelup');
    for (const hero of ctx.state.party) {
      const perks = ctx.content?.heroes?.[hero.arch]?.perks?.[level] || [];
      let perk = null;
      if (perks.length) {
        const id = await ctx.ui.modal({ kicker: hero.name, title: STR.gift, body: note(STR.giftNote),
          buttons: perks.map((p) => ({ id: p.id, label: p.name, kind: 'gold' })) });
        perk = perks.find((p) => p.id === id) || perks[0];
      }
      ctx.state.replaceHero(R.levelUpHero(hero, level, perk));
    }
  },

  async shop(shopId, ctx) {
    const shop = ctx.content?.shops?.[shopId];
    if (!shop) return;
    if (shop.greeting?.length) await ctx.gm.say(ctx.rng.pick(shop.greeting), { as: shop.keeper });
    for (;;) {
      const affordable = (shop.stock || []).filter((s) => ctx.state.gold >= s.price);
      const id = await ctx.ui.modal({ kicker: STR.shop, title: ctx.content?.npcs?.[shop.keeper]?.name || STR.shop, body: note(STR.purse(ctx.state.gold)),
        buttons: [...(ctx.auto ? [] : affordable.slice(0, 4).map((s) => ({ id: s.item, label: `${ctx.content.items?.[s.item]?.name || s.item} (${s.price})` }))), { id: 'leave', label: STR.leave, kind: 'ghost', auto: true }] });
      if (id === 'leave') break;
      const s = shop.stock.find((x) => x.item === id);
      ctx.state.addGold(-s.price); ctx.state.give(s.item, 1); ctx.audio.sfx('coin');
    }
    if (shop.bye?.length) await ctx.gm.say(ctx.rng.pick(shop.bye), { as: shop.keeper });
  },

  async melody({ mode, phrase }, ctx) {
    await ctx.gm.react('puzzle.melody.learn');
    const id = await ctx.ui.modal({ kicker: STR.lullaby, title: mode === 'finale' ? STR.sing : STR.phrase(phrase || 1),
      body: note(STR.chimes), buttons: [{ id: 'ok', label: STR.playTrue, kind: 'primary', auto: true }, { id: 'miss', label: STR.stumble, kind: 'ghost' }] });
    return { ok: id === 'ok', mistakes: id === 'ok' ? 0 : 3 };
  },

  async runes(ctx) {
    const id = await ctx.ui.modal({ kicker: STR.door, title: STR.runes, body: note(STR.runesNote),
      buttons: [{ id: 'ok', label: STR.answer, kind: 'primary', auto: true }, { id: 'no', label: STR.giveUp, kind: 'ghost' }] });
    return id === 'ok';
  },

  async gmscreen(ctx) {
    const s = ctx.state;
    const body = h('div.lf-scroll', { style: 'max-height:440px;text-align:left' },
      h('ul.lf-list', s.party.map((x) => h('li', ctx.ui.portrait(x.id, 'sm'), h('span', STR.hero(x))))),
      h('h3.lf-kicker', { style: 'margin-top:16px' }, STR.quests),
      h('ul.lf-list', s.quests.length ? s.quests.map((q) => h('li', (q.done ? STR.done : '') + q.title)) : h('li', STR.noQuests)));
    await ctx.ui.modal({ title: STR.book, body, wide: true, buttons: [{ id: 'close', label: STR.close, kind: 'primary' }] });
  },

  async settings(ctx) {
    const id = await ctx.ui.modal({ title: STR.settings, body: note(STR.voiceIs(ctx.settings.voiceOn)),
      buttons: [{ id: 'voice', label: ctx.settings.voiceOn ? STR.voiceOff : STR.voiceOn }, { id: 'restart', label: STR.restart, kind: 'danger' }, { id: 'close', label: STR.close, kind: 'primary', auto: true }] });
    if (id === 'voice') { ctx.settings.voiceOn = !ctx.settings.voiceOn; ctx.settings.save(); }
    if (id === 'restart') { ctx.save.clear(); location.href = location.pathname + location.search.replace(/[?&]scene=[^&]*/, ''); }
  },

  async ending(ctx) {
    const t = ctx.state.tally;
    ctx.audio.music('ending');
    const body = h('div', h('p', STR.told),
      h('ul.lf-list', h('li', STR.nat20(t.nat20)), h('li', STR.passed(t.passed, t.checks)), h('li', STR.friends(t.befriended)), h('li', STR.stars(t.starsEarned))));
    ctx.bus.emit('game:ended', { tally: t });
    if (ctx.auto) { await ctx.sleep(400); return; }
    const id = await ctx.ui.modal({ kicker: STR.chronicle, title: STR.end, body, buttons: [{ id: 'again', label: STR.again, kind: 'primary' }] });
    if (id === 'again') { ctx.save.clear(); location.href = location.pathname + (new URLSearchParams(location.search).get('content') === 'dev' ? '?content=dev' : ''); }
  },

  async scene(sceneId, _opts, ctx) {
    const sc = ctx.content.scenes[sceneId];
    await ctx.stage.setBg(sc.bg);
    for (const st of sc.steps) if (typeof st === 'string' || st.say) await ctx.gm.say(st.say || st, { as: st.as, mood: st.mood });
    return 'end';
  },

  // ROUND2 3.1: without systems/skill.js a skill step is a plain check with the same stat and dc.
  async skill(spec, ctx) {
    const { runCheck } = await import('../systems/check.js');
    const r = await runCheck(ctx, { stat: spec.stat, dc: spec.dc, label: spec.label, talent: spec.talent, who: spec.who, hasPartial: !!spec.hasPartial, actor: spec.actor });
    return { outcome: r.outcome === 'fumble' ? 'fail' : r.outcome, heroId: r.heroId, score: r.die, kind: spec.kind || 'timing', fallback: true };
  },

  async combat(encounterId, optsOrCtx, maybeCtx) {
    const ctx = maybeCtx || optsOrCtx;
    const enc = ctx.content?.encounters?.[encounterId];
    const canBefriend = enc?.canBefriend !== false && (enc?.foes || []).every((f) => ctx.content?.enemies?.[f.type]?.befriend);
    const buttons = [{ id: 'win', label: STR.win, kind: 'primary', auto: true }];
    if (canBefriend) buttons.push({ id: 'befriend', label: STR.befriend, kind: 'gold' });
    buttons.push({ id: 'lose', label: STR.lose, kind: 'ghost' });
    const result = await ctx.ui.modal({ kicker: STR.battleKicker, title: enc?.title || encounterId.replace(/_/g, ' '), body: note(STR.battleNote), buttons });
    const foes = (enc?.foes || []).map((f) => f.type);
    if (result === 'befriend') ctx.state.tallyAdd('befriended', foes.length);
    if (result === 'win') ctx.state.tallyAdd('defeated', foes.length);
    if (result === 'lose') ctx.state.party.forEach((x) => { x.hp = 0; });
    return { result, befriended: result === 'befriend' ? foes : [], defeated: result === 'win' ? foes : [] };
  },
};
