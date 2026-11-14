// The check moment (SPEC 10): dim, the check card rises, pick a hero, "Roll 8 or more", tap (hold to shake),
// the die lands, bonuses count up, a banner hits, Quill reacts, and on a fail with Stars: roll again?
//
// runCheck(ctx, { stat, dc, label, talent?, who='choose'|'each'|'actor', hasPartial?, actor? })
//   -> { outcome:'crit'|'success'|'partial'|'fail'|'fumble', heroId, die, total, target, passed? }
import { h, tap, wait } from '../ui/dom.js';
import * as R from '../core/rules.js';
import { L } from '../core/i18n.js';

const STR = L({
  en: {
    kicker: (stat) => `A roll of ${R.STAT_NAMES[stat] || stat}`,
    choose: 'Who will try?',
    each: 'Everyone rolls!',
    need: (n) => `Roll <b>${n}</b> or more`,
    tap: 'Tap the die to roll',
    hold: 'Hold to shake, let go to throw',
    reroll: 'Spend a Star to roll again?',
    spend: 'Spend a Star', keep: 'Keep it',
    banner: { crit: 'NATURAL 20!', success: 'SUCCESS!', partial: 'SO CLOSE', fail: 'NOT QUITE', fumble: 'OOPS!' },
    sub: { crit: 'The die sings!', success: (d, n) => `${d}: that is enough!`, partial: (d, n) => `${d}, just short of ${n}`, fail: (d, n) => `${d}, you needed ${n}`, fumble: 'A natural 1!' },
    talent: 'Talent',
    spot: 'Your turn to shine',
    mercy: 'The Storykeeper smiles: a little easier this time',
    rollDie: 'Roll the die', vs: 'needed',
    easier: (name) => `${name} makes it easier`,
    tumbleWhy: 'For a glorious tumble', tumble: 'A Star for a glorious tumble',
    done: (w, n) => `${w} of ${n} done`, slips: (f, a) => `${f} of ${a} slips`,
  },
  da: {
    kicker: (stat) => `Slå med ${R.STAT_NAMES[stat] || stat}`,
    choose: 'Hvem prøver?',
    each: 'Alle slår!',
    need: (n) => `Slå <b>${n}</b> eller mere`,
    tap: 'Tryk på terningen for at slå',
    hold: 'Hold for at ryste, giv slip for at kaste',
    reroll: 'Brug en Stjerne og slå igen?',
    spend: 'Brug en Stjerne', keep: 'Behold det',
    banner: { crit: 'RENT 20!', success: 'DET LYKKES!', partial: 'LIGE VED', fail: 'DET GLIPPER', fumble: 'UPS!' },
    sub: { crit: 'Terningen synger!', success: (d, n) => `${d}: det er nok!`, partial: (d, n) => `${d}, lige under ${n}`, fail: (d, n) => `${d}, du skulle bruge ${n}`, fumble: 'Et rent 1-tal!' },
    talent: 'Talent',
    spot: 'Din tur til at skinne',
    mercy: 'Sagnvogteren smiler: lidt lettere denne gang',
    rollDie: 'Slå med terningen', vs: 'skulle bruge',
    easier: (name) => `${name} gør det lettere`,
    tumbleWhy: 'For et flot fald', tumble: 'En Stjerne for et flot fald',
    done: (w, n) => `${w} af ${n} klaret`, slips: (f, a) => `${f} af ${a} smuttere`,
  },
});

const D20 = '<svg viewBox="0 0 100 100" class="lf-d20"><defs><linearGradient id="d20g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1c4"/><stop offset=".5" stop-color="#f7c95c"/><stop offset="1" stop-color="#9a6a1c"/></linearGradient><linearGradient id="d20f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--dc1)"/><stop offset="1" stop-color="var(--dc2)"/></linearGradient></defs><polygon points="50,3 93,27 93,73 50,97 7,73 7,27" fill="url(#d20f)" stroke="url(#d20g)" stroke-width="2.5" stroke-linejoin="round"/><polygon points="50,22 76,66 24,66" fill="rgba(255,255,255,.10)" stroke="rgba(255,231,163,.75)" stroke-width="1.6" stroke-linejoin="round"/><path d="M50 3 L50 22 M93 27 L76 66 M7 27 L24 66 M50 97 L24 66 M50 97 L76 66 M93 73 L76 66 M7 73 L24 66 M7 27 L50 22 L93 27" stroke="rgba(255,231,163,.45)" stroke-width="1.3" fill="none"/><text x="50" y="57" text-anchor="middle" font-family="Cinzel, serif" font-weight="900" font-size="20" fill="#fff8e0">20</text></svg>';

export async function runCheck(ctx, spec) {
  const { stat = 'wits', label = '', talent = null } = spec;
  const who = spec.who || 'choose';
  const state = ctx.state;
  const dir = ctx.gm.director;
  const living = state.party.filter((x) => x.hp > 0);
  const pool = living.length ? living : state.party;
  let target = R.dcTarget(spec.dc);
  let mercy = false;
  if (dir?.checkTarget) { const m = dir.checkTarget(target); target = m.target; mercy = m.mercy; }

  ctx.bus.emit('check:start', { ...spec, target });
  await dir?.teach?.('check');

  // ---- build the card ----
  const color = R.STAT_COLORS[stat] || '#f7c95c';
  const heroesRow = h('div.lf-check-heroes');
  const needEl = h('div.lf-check-need');
  const dieBtn = h('button.lf-check-die', { type: 'button', 'aria-label': STR.rollDie, html: D20 });
  const hintEl = h('div.lf-check-hint');
  const mathEl = h('div.lf-check-math');
  const actions = h('div.lf-check-actions');
  const card = h('div.lf-check.lf-panel', { style: { '--sc': color } },
    h('div.lf-check-kicker', h('span.lf-check-gem'), STR.kicker(stat), talent ? h('span.lf-chip.lf-check-talent', ctx.ui.icon('talent'), R.TALENT_NAMES[talent] || STR.talent) : null),
    h('h2.lf-check-title', label),
    mercy ? h('div.lf-check-mercy', STR.mercy) : null,
    heroesRow,
    h('div.lf-check-stage', needEl, h('div.lf-check-diewrap', dieBtn), hintEl, mathEl),
    actions);
  const wrap = h('div.lf-check-wrap', card);
  ctx.stage.layers.overlay.appendChild(wrap);
  ctx.stage.fx('dim');
  ctx.audio.sfx('ui.open');
  await wait(20);
  wrap.classList.add('is-in');

  const close = async () => {
    wrap.classList.remove('is-in');
    wrap.classList.add('is-out');
    ctx.dice.clear?.().catch?.(() => {});
    ctx.stage.fx('undim');
    await ctx.sleep(380);
    wrap.remove();
  };

  const spotId = dir?.spotlight?.(pool) || null;
  const heroEls = new Map();
  for (const hero of pool) {
    const b = R.checkBonus(hero, { stat, talent });
    const el = h('button.lf-check-hero', { type: 'button', dataset: { hero: hero.id } },
      spotId === hero.id && who === 'choose' ? h('span.lf-spot-mark', ctx.ui.icon('talent'), STR.spot) : null,
      ctx.ui.portrait(hero.id, 'md'),
      h('span.lf-check-hero-name', hero.name.split(' ')[0]),
      h('span.lf-check-hero-bonus', (b.total >= 0 ? '+' : '') + b.total),
      b.talent ? h('span.lf-check-hero-talent', ctx.ui.icon('talent')) : null,
      h('span.lf-check-hero-res'));
    heroEls.set(hero.id, el);
    heroesRow.appendChild(el);
  }

  // One target for a child: the number the die must show. The bonus is the reason it is low (the hero's face and +3),
  // never a second target number.
  const reasonChip = (hero, b) => (b.total > 0 ? h('span.lf-check-why', ctx.ui.portrait(hero.id, 'sm'),
    h('b', `+${b.total}`), b.talent ? ctx.ui.icon('talent') : null, h('small', STR.easier(hero.name.split(' ')[0]))) : null);
  const setNeed = (hero) => {
    const b = R.checkBonus(hero, { stat, talent });
    needEl.replaceChildren(...[h('span.lf-check-need-n', { html: STR.need(R.needOnDie(target, b.total)) }), reasonChip(hero, b)].filter(Boolean));
    needEl.classList.add('is-on');
  };

  // pick hero(es)
  const pickHero = () => new Promise((resolve) => {
    if (who === 'actor') {
      const id = (spec.actor && state.hero(spec.actor)) ? spec.actor : (ctx.gm.actor && state.hero(ctx.gm.actor) ? ctx.gm.actor : pool[0].id);
      return resolve(id);
    }
    if (pool.length === 1) return resolve(pool[0].id);
    hintEl.textContent = STR.choose;
    card.classList.add('is-choosing');
    let done = false;
    for (const [id, el] of heroEls) {
      tap(el, () => { if (done) return; done = true; ctx.audio.sfx('ui.confirm'); resolve(id); }, ctx);
      el.addEventListener('pointerenter', () => { if (!done) setNeed(state.hero(id)); });
    }
    if (ctx.auto) ctx.sleep(500).then(() => { if (done) return; done = true; resolve(ctx.auto.pickHero(pool, { stat, talent, spot: spotId })); });
  });

  // wait for the player to throw the die
  const throwDie = () => new Promise((resolve) => {
    dieBtn.classList.add('is-ready');
    dieBtn.disabled = false;
    hintEl.textContent = ctx.auto ? '' : STR.tap;
    let shaking = null, done = false, holdT = 0;
    const fin = () => { if (done) return; done = true; clearInterval(shaking); dieBtn.classList.remove('is-shaking', 'is-ready'); dieBtn.classList.add('is-thrown'); dieBtn.disabled = true; resolve(); };
    const down = () => {
      if (done) return;
      holdT = performance.now();
      dieBtn.classList.add('is-shaking');
      ctx.audio.sfx('dice.shake');
      hintEl.textContent = STR.hold;
      shaking = setInterval(() => ctx.audio.sfx('dice.shake', { volume: 0.6, rate: 0.9 + Math.random() * 0.3 }), 380);
    };
    dieBtn.onpointerdown = down;
    dieBtn.onpointerup = () => { if (holdT) fin(); };
    dieBtn.onpointerleave = () => { if (holdT && !done) fin(); };
    dieBtn.onclick = () => fin();
    dieBtn.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fin(); } };
    const onKey = (e) => { if (done) return window.removeEventListener('keydown', onKey); if ((e.key === ' ' || e.key === 'Enter') && document.activeElement !== dieBtn) { e.preventDefault(); fin(); } };
    window.addEventListener('keydown', onKey);
    if (ctx.auto) ctx.sleep(450).then(fin);
  });

  // one roll for one hero; returns the result
  const rollOnce = async (hero, { keepBetterOf = null } = {}) => {
    const b = R.checkBonus(hero, { stat, talent });
    const co = R.critOn(hero);
    let die = ctx.rng.d(20);
    const dice = [{ sides: 20, value: die, tint: color }];
    if (keepBetterOf != null) {
      const better = Math.max(die, keepBetterOf), worse = Math.min(die, keepBetterOf);
      dice[0] = { sides: 20, value: keepBetterOf, tint: color, dropped: keepBetterOf < die };
      dice.push({ sides: 20, value: die, tint: color, dropped: die < keepBetterOf || (die === keepBetterOf) });
      die = better; void worse;
    }
    const crit = die >= co ? 'success' : die === 1 ? 'fail' : null;
    ctx.audio.sfx('dice.throw');
    hintEl.textContent = '';
    await ctx.dice.roll({ dice, crit, fast: false });
    ctx.audio.sfx('dice.land');
    const out = R.outcome({ die, bonus: b.total, target, hasPartial: !!spec.hasPartial, critOn: co });
    const total = die + b.total;
    // the result row: the die, then the one number it needed (the same number as before the roll), then why it was low
    const need = R.needOnDie(target, b.total);
    const mark = R.isPass(out) ? 'is-pass' : out === 'partial' ? 'is-partial' : 'is-fail';
    mathEl.replaceChildren(...[
      h('span.lf-math-die', { class: die >= co ? 'is-crit' : die === 1 ? 'is-fumble' : null }, String(die)),
      h('span.lf-math-vs', STR.vs), h('span.lf-math-target', { class: mark }, String(need)),
      reasonChip(hero, b)].filter(Boolean));
    needEl.classList.remove('is-on');
    mathEl.classList.add('is-on');
    ctx.audio.sfx('ui.tap', { volume: 0.25, rate: 1.2 });
    await ctx.sleep(260);
    return { outcome: out, heroId: hero.id, die, total, target, need };
  };

  const showBanner = async (res) => {
    const o = res.outcome;
    ctx.audio.sfx(o === 'crit' ? 'check.crit' : o === 'fumble' ? 'check.fumble' : R.isPass(o) ? 'check.success' : 'check.fail');
    if (o === 'crit') ctx.stage.fx('flash');
    const sub = typeof STR.sub[o] === 'function' ? STR.sub[o](res.die, res.need ?? res.target) : STR.sub[o];
    await ctx.ui.banner(STR.banner[o], { kind: o === 'partial' ? 'partial' : o, sub, hold: o === 'crit' ? 1700 : 1200, top: 150 });
  };

  // After a failed roll with Stars in the pool: spend one to roll again and keep the better die.
  const offerReroll = async (hero, res, { banner }) => {
    if (R.isPass(res.outcome) || state.stars <= 0) return res;
    const offer = ctx.gm.line('reroll.offer');
    if (offer) ctx.gm.aside(offer);
    const spend = await askReroll(ctx, actions);
    if (!spend || !state.spendStar()) return res;
    ctx.audio.sfx('star.spend');
    ctx.bus.emit('star:spent', { why: 'reroll' });
    const sl = ctx.gm.line('star.spend');
    if (sl) ctx.gm.aside(sl);
    await ctx.dice.clear?.();
    dieBtn.classList.remove('is-thrown');
    mathEl.classList.remove('is-on');
    await throwDie();
    const prev = res.die;
    state.tally.checks--; // the reroll counts as the same check
    if (prev === 1) state.tally.nat1--;
    const again = await rollOnce(hero, { keepBetterOf: prev });
    tallyRoll(ctx, again);
    if (banner) await showBanner(again);
    return again;
  };

  let result;
  let rolls = [];
  try {
    if (who === 'each') {
      hintEl.textContent = STR.each;
      card.classList.add('is-each');
      const results = [];
      for (const hero of pool) {
        heroEls.forEach((el, id) => el.classList.toggle('is-sel', id === hero.id));
        setNeed(hero);
        await throwDie();
        let r = await rollOnce(hero);
        tallyRoll(ctx, r);
        r = await offerReroll(hero, r, { banner: false });
        results.push(r);
        const el = heroEls.get(hero.id);
        el.classList.add(R.isPass(r.outcome) ? 'is-pass' : 'is-fail');
        el.querySelector('.lf-check-hero-res').replaceChildren(ctx.ui.icon(R.isPass(r.outcome) ? 'check' : 'close'));
        ctx.audio.sfx(R.isPass(r.outcome) ? 'check.success' : 'check.fail', { volume: 0.6 });
        await ctx.sleep(700);
        await ctx.dice.clear?.();
        dieBtn.classList.remove('is-thrown');
        mathEl.classList.remove('is-on');
      }
      rolls = results;
      const passes = results.filter((r) => R.isPass(r.outcome)).length;
      const ok = passes >= Math.ceil(results.length / 2);
      const best = [...results].sort((a, b) => b.total - a.total)[0];
      result = { ...best, outcome: ok ? (results.some((r) => r.outcome === 'crit') ? 'crit' : 'success') : 'fail', passed: passes, of: results.length, total: best.total };
      await showBanner(result);
    } else {
      const heroId = await pickHero();
      const hero = state.hero(heroId);
      card.classList.remove('is-choosing');
      card.classList.add('is-picked');
      heroEls.forEach((el, id) => { el.classList.toggle('is-sel', id === heroId); el.classList.toggle('is-dim', id !== heroId); });
      setNeed(hero);
      const ask = ctx.gm.line('roll.ask');
      if (ask) ctx.gm.aside(ask);
      await throwDie();
      result = await rollOnce(hero);
      tallyRoll(ctx, result);
      await showBanner(result);
      result = await offerReroll(hero, result, { banner: true });
      rolls = [result];
    }
    const poolKey = { crit: 'roll.crit', success: 'roll.success', partial: 'roll.partial', fail: 'roll.fail', fumble: 'roll.fumble' }[result.outcome];
    await ctx.gm.react(poolKey);
  } finally {
    await close();
  }

  dir?.onCheckResult?.(result);
  ctx.bus.emit('check:result', result);
  // a natural 1 earns a consolation Star once per scene (in an each-hero check, any hero's natural 1 counts)
  if (rolls.some((r) => r.outcome === 'fumble') && !ctx.sceneMemo?.fumbleStar) {
    if (ctx.sceneMemo) ctx.sceneMemo.fumbleStar = true;
    const got = state.addStar(1, STR.tumbleWhy);
    if (got) { ctx.audio.sfx('star.gain'); ctx.ui.toast(STR.tumble, { icon: 'star', kind: 'star' }); }
  }
  return result;
}

function tallyRoll(ctx, r) {
  const t = ctx.state.tally;
  t.checks++;
  if (R.isPass(r.outcome)) t.passed++;
  if (r.die === 20) t.nat20++;
  if (r.die === 1) t.nat1++;
}

function askReroll(ctx, actions) {
  return new Promise((resolve) => {
    let done = false;
    const fin = (v) => { if (done) return; done = true; actions.classList.remove('is-on'); setTimeout(() => actions.replaceChildren(), 300); resolve(v); };
    actions.replaceChildren(
      h('div.lf-check-reroll-q', ctx.ui.icon('star'), STR.reroll),
      h('div.lf-check-reroll-btns',
        ctx.ui.button(STR.spend, { kind: 'gold', icon: 'star', onClick: () => fin(true), sfx: 'ui.confirm' }),
        ctx.ui.button(STR.keep, { kind: 'ghost', onClick: () => fin(false) })));
    requestAnimationFrame(() => actions.classList.add('is-on'));
    if (ctx.auto) ctx.sleep(500).then(() => fin(ctx.auto.rng.chance(0.6)));
  });
}

// Group challenge fallback (SPEC 8.2 challenge) used when systems/challenge.js is missing.
export async function runChallengeFallback(spec, ctx) {
  const party = ctx.state.party.filter((x) => x.hp > 0);
  const heroes = party.length ? party : ctx.state.party;
  for (const l of spec.intro || []) await ctx.gm.say(typeof l === 'string' ? l : l.say, { mood: l.mood || 'warm' });
  let wins = 0, fails = 0, i = 0;
  const need = spec.need || Math.ceil((spec.turns || []).length / 2), allow = spec.allow || 2;
  const turns = spec.turns || [];
  let guard = 0;
  while (wins < need && fails < allow && guard++ < 40) {
    const t = turns[i % turns.length];
    const hero = heroes[i % heroes.length];
    i++;
    ctx.gm.setActor(hero.id);
    const r = await runCheck(ctx, { stat: t.stat, dc: t.dc, label: t.label, talent: t.talent, who: 'actor', actor: hero.id });
    hero.acts = (hero.acts || 0) + 1;
    if (R.isPass(r.outcome)) { wins++; if (t.win) await ctx.gm.say(t.win); }
    else { fails++; if (t.lose) await ctx.gm.say(t.lose); }
    ctx.ui.toast(STR.done(wins, need), { icon: 'check', kind: 'info', sub: fails ? STR.slips(fails, allow) : null, ms: 1800 });
  }
  return wins >= need;
}
