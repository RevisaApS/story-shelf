// Level up (GRIMSPIRE.md 4.7). gsLevelUp(ctx, levels:[n..]) -> void
// One card per level reached: the level number slams in, each hunter's Health, Attack and Defence count up from
// the old value, a new skill is unveiled at levels 2, 4 and 6 (whatever level the content gives a skill), and at
// levels 3, 5, 7 and 8 the party picks one of two boons. The state has already levelled (state.addXp).
import { h, wait } from '../../ui/dom.js';
import { L } from '../../core/i18n.js';
import { portrait, icon, countUp, sfx, say, firstName, heroColor, STRC } from '../hud.js';

const STR = L({
  en: { level: 'Level', up: 'Level up!', newSkill: 'New skill', ultimate: 'Ultimate', pick: 'Choose a boon for the whole party', go: 'Onward', fury: (n) => `${n} Fury`, healed: 'Everyone is fully healed' },
  da: { level: 'Niveau', up: 'Nyt niveau!', newSkill: 'Ny evne', ultimate: 'Ultimativ', pick: 'Vælg en velsignelse til hele holdet', go: 'Videre', fury: (n) => `${n} Raseri`, healed: 'Alle har fuldt Liv igen' },
});

const BOON_LEVELS = new Set([3, 5, 7, 8]);

function deriveAt(ctx, hero, level, boons) {
  const R = ctx.gsMods.rules;
  if (R?.derive) { try { return R.derive(hero, { level, boons, content: ctx.content, difficulty: ctx.state.difficulty }); } catch { /* stand-in */ } }
  return ctx.gsDev.derive(hero, { level, boons, content: ctx.content });
}

export async function gsLevelUp(ctx, levels = []) {
  for (const lv of levels) await oneLevel(ctx, lv);
}

async function oneLevel(ctx, lv) {
  const st = ctx.state;
  const layer = ctx.stage.layers.overlay;
  ctx.gm.hide();
  sfx(ctx, 'gs.levelup');
  const rows = st.party.map((hero) => {
    const a = deriveAt(ctx, hero, lv - 1, st.boons), b = st.derived(hero.id);
    const stat = (k) => {
      const v = h('b', String(Math.round(a[k])));
      const plus = Math.round(b[k]) - Math.round(a[k]);
      return { el: h('div.gs-lu-stat', h('small', STRC.stats[k]), v, plus > 0 ? h('em', `+${plus}`) : null), v, from: Math.round(a[k]), to: Math.round(b[k]) };
    };
    const s = [stat('hp'), stat('atk'), stat('def')];
    const skill = (ctx.content.heroes?.[hero.arch]?.skills || []).find((x) => x.level === lv);
    const skillEl = skill ? h('div.gs-lu-skill', { class: skill.ultimate ? 'is-ult' : null },
      h('small', skill.ultimate ? STR.ultimate : STR.newSkill), h('b', skill.name), skill.cost != null ? h('span.gs-lu-cost', icon('fury'), String(skill.cost)) : null, skill.text ? h('p', skill.text) : null) : null;
    const el = h('div.gs-lu-row', { style: { '--hc': heroColor(hero.arch) } }, portrait(ctx, hero.arch, 'md'), h('div.gs-lu-name', firstName(hero)), h('div.gs-lu-stats', s.map((x) => x.el)), skillEl);
    return { el, s, skillEl };
  });
  const btn = ctx.ui.button(STR.go, { kind: 'primary', size: 'lg', sfx: 'ui.confirm' });
  btn.hidden = true;
  const boonBox = h('div.gs-lu-boons');
  const num = h('div.gs-lu-num', String(lv));
  const card = h('div.gs-lu.gs-panel',
    h('div.gs-lu-head', h('div.gs-kicker', STR.up), h('div.gs-lu-badge', h('small', STR.level), num)),
    h('div.gs-lu-rows', { class: `n-${rows.length}` }, rows.map((r) => r.el)),
    h('div.gs-lu-healed', icon('heart'), STR.healed),
    boonBox, h('div.gs-lu-foot', btn));
  const root = h('div.gs-lu-wrap', { 'data-no-advance': '' }, h('div.gs-lu-burst'), card);
  layer.appendChild(root);
  await wait(20);
  root.classList.add('is-in');
  ctx.stage.fx?.('flash');
  await ctx.sleep(500);
  say(ctx, 'levelup', 'excited');

  for (const r of rows) {
    r.el.classList.add('is-on');
    await Promise.all(r.s.map((x) => countUp(x.v, x.from, x.to, 700, ctx)));
    sfx(ctx, 'ui.confirm', { volume: 0.4 });
    if (r.skillEl) { await ctx.sleep(150); r.skillEl.classList.add('is-on'); sfx(ctx, 'gs.fury'); }
    await ctx.sleep(180);
  }

  if (BOON_LEVELS.has(lv)) {
    const all = Object.values(ctx.content.boons || {}).filter((b) => !st.boons.includes(b.id));
    const pick = [];
    const pool = [...all];
    while (pool.length && pick.length < 2) pick.push(pool.splice(ctx.rng.int(0, pool.length - 1), 1)[0]);
    if (pick.length) {
      let chosen;
      const chosenP = new Promise((r) => { chosen = r; });
      boonBox.replaceChildren(h('div.gs-lu-pick', STR.pick), h('div.gs-lu-boonrow', pick.map((b) => {
        const el = h('button.gs-lu-boon', { type: 'button' }, icon('star'), h('b', b.name), h('p', b.text || ''));
        el.addEventListener('click', () => { el.classList.add('is-picked'); sfx(ctx, 'ui.confirm'); sfx(ctx, 'gs.perfect'); chosen(b.id); });
        return el;
      })));
      boonBox.classList.add('is-on');
      say(ctx, 'boon.pick', 'warm');
      if (ctx.auto) ctx.sleep(700).then(() => chosen(pick[0].id));
      const id = await chosenP;
      boonBox.querySelectorAll('button').forEach((b) => { b.disabled = true; if (!b.classList.contains('is-picked')) b.classList.add('is-gone'); });
      st.addBoon(id);
      st.fullHeal();
      await ctx.sleep(500);
    }
  }

  btn.hidden = false;
  let done;
  const p = new Promise((r) => { done = r; });
  btn.addEventListener('click', () => done(), { once: true });
  const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); done(); } };
  window.addEventListener('keydown', onKey);
  if (ctx.auto) ctx.sleep(600).then(() => done());
  await p;
  window.removeEventListener('keydown', onKey);
  ctx.gm.hide();
  root.classList.remove('is-in');
  root.classList.add('is-out');
  await ctx.sleep(400);
  root.remove();
}
