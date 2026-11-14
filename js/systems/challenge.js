// Group challenge (SPEC 8.2 `challenge`, SPEC 11): runChallenge(spec, ctx) -> boolean
// spec = { title, intro:[..], need, allow, turns:[ { label, stat, dc, talent?, win, lose } ] }
// A ribbon at the top: the title, success pips (need) and slip pips (allow), the heroes in turn order.
// Heroes take turns in party order, the turns cycle until `need` successes or `allow` slips.
// Each turn is a check through the core's check moment (systems/check.js, who: 'actor').
import { h } from '../ui/dom.js';
import * as R from '../core/rules.js';
import { L } from '../core/i18n.js';
import { ensureCss, anim, speed } from './sys-util.js';
import { runCheck } from './check.js';

const STR = L({
  en: {
    kicker: 'Everyone together',
    goal: (n) => `${n} good roll${n === 1 ? '' : 's'} to win`,
    slips: (n) => `${n} slip${n === 1 ? '' : 's'} allowed`,
    turn: (name) => `${name}'s turn`,
    win: 'Together!',
    winSub: (t) => t,
    lose: 'Not this time',
    loseSub: 'The story goes on',
    defaultTurn: 'Give it your all',
    defaultTitle: 'A challenge',
  },
  da: {
    kicker: 'Alle sammen',
    goal: (n) => `${n} ${n === 1 ? 'godt slag' : 'gode slag'} for at vinde`,
    slips: (n) => `${n} ${n === 1 ? 'smutter' : 'smuttere'} tilladt`,
    turn: (name) => `${name}${/[sxz]$/i.test(name) ? '’' : 's'} tur`,
    win: 'Sammen!',
    winSub: (t) => t,
    lose: 'Ikke denne gang',
    loseSub: 'Historien går videre',
    defaultTurn: 'Giv den alt, du har',
    defaultTitle: 'En udfordring',
  },
});

export async function runChallenge(spec = {}, ctx) {
  await ensureCss();
  const { state, audio, gm } = ctx;
  const turns = spec.turns?.length ? spec.turns : [{ label: STR.defaultTurn, stat: 'might', dc: 'medium' }];
  const need = spec.need || Math.ceil(turns.length / 2);
  const allow = spec.allow || 2;
  const living = state.party.filter((x) => x.hp > 0);
  const heroes = living.length ? living : state.party;

  // ---------- ribbon ----------
  const winPips = Array.from({ length: need }, () => h('i.lfc-pip.is-win', h('b')));
  const slipPips = Array.from({ length: allow }, () => h('i.lfc-pip.is-slip', h('b')));
  const queue = heroes.map((hero) => h('div.lfc-q', { dataset: { hero: hero.id } }, ctx.ui.portrait(hero.id, 'sm')));
  const turnLabel = h('div.lfc-turn');
  const ribbon = h('div.lfc.lf-panel', { 'data-no-advance': '' },
    h('div.lfc-head', h('div.lf-kicker', STR.kicker), h('h2.lf-title', spec.title || STR.defaultTitle)),
    h('div.lfc-track',
      h('div.lfc-group', h('div.lfc-pips', winPips), h('small', STR.goal(need))),
      h('div.lfc-queue', queue),
      h('div.lfc-group.is-right', h('div.lfc-pips', slipPips), h('small', STR.slips(allow)))),
    turnLabel);
  ctx.stage.layers.screen.appendChild(ribbon);
  await ctx.sleep(30);
  ribbon.classList.add('is-in');
  audio.sfx('ui.open');
  await ctx.sleep(500);

  for (const l of spec.intro || []) {
    if (typeof l === 'string') await gm.say(l);
    else if (l?.say) await gm.say(l.say, { as: l.as, mood: l.mood });
  }

  let wins = 0, fails = 0, i = 0;
  try {
    while (wins < need && fails < allow && i < 60) {
      const t = turns[i % turns.length];
      const hero = heroes[i % heroes.length];
      i++;
      queue.forEach((q) => q.classList.toggle('is-now', q.dataset.hero === hero.id));
      turnLabel.replaceChildren(h('b', STR.turn(hero.name.split(' ')[0])), h('span', t.label), t.stat ? ctx.ui.statChip(t.stat) : null);
      anim(turnLabel, [{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }], 360);
      gm.setActor(hero.id);
      await ctx.sleep(900);
      ribbon.classList.add('is-under'); // the check card takes the stage; the ribbon steps back so the two never show through each other
      let r;
      try { r = await runCheck(ctx, { stat: t.stat, dc: t.dc, label: t.label, talent: t.talent, who: 'actor', actor: hero.id }); }
      finally { ribbon.classList.remove('is-under'); }
      hero.acts = (hero.acts || 0) + 1;
      const passed = R.isPass(r?.outcome);
      const pip = passed ? winPips[wins++] : slipPips[fails++];
      pip.classList.add('is-on');
      anim(pip, [{ transform: 'scale(0.4)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], 520);
      audio.sfx(passed ? 'chime.right' : 'block', { volume: 0.7 });
      const line = passed ? t.win : t.lose;
      if (line) await gm.say(line, { mood: passed ? 'excited' : 'funny' });
    }
  } finally {
    queue.forEach((q) => q.classList.remove('is-now'));
  }

  const ok = wins >= need;
  turnLabel.replaceChildren();
  ribbon.classList.add(ok ? 'is-won' : 'is-lost');
  if (ok) { audio.sfx('fanfare.small'); queue.forEach((q, k) => setTimeout(() => q.classList.add('is-cheer'), k * 90 / speed())); }
  else audio.sfx('check.fail');
  await ctx.ui.banner(ok ? STR.win : STR.lose, { kind: ok ? 'success' : 'fail', sub: ok ? STR.winSub(spec.title || '') : STR.loseSub, hold: 1300 });
  ribbon.classList.remove('is-in');
  ribbon.classList.add('is-out');
  await ctx.sleep(500);
  ribbon.remove();
  return ok;
}
