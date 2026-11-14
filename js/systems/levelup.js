// Level up (SPEC 11): levelUp(level, ctx) -> void
// A great emblem, then each hero in turn: level badge, +3 hearts, two perk cards to choose from
// (content.heroes[arch].perks[level]); the chosen perk is applied to the hero in state. At level 3 the
// hero's great power is revealed with some drama.
import { h, tap, wait } from '../ui/dom.js';
import * as R from '../core/rules.js';
import { L } from '../core/i18n.js';

const STR = L({
  en: {
    emblem: (l) => `Level ${l}`,
    emblemSub: 'Every hero grows stronger',
    level: (l) => `Level ${l}`,
    hearts: '+3 hearts',
    choose: 'Choose a gift',
    chooseSub: 'It lasts the whole adventure.',
    great: 'Great power unlocked',
    cost: (n) => `${n} Sparks`,
    ok: 'Wonderful!',
    next: 'Next hero',
  },
  da: {
    emblem: (l) => `Niveau ${l}`,
    emblemSub: 'Alle helte bliver stærkere',
    level: (l) => `Niveau ${l}`,
    hearts: '+3 hjerter',
    choose: 'Vælg en gave',
    chooseSub: 'Den varer hele eventyret.',
    great: 'Stor kraft låst op',
    cost: (n) => `${n} ${n === 1 ? 'Gnist' : 'Gnister'}`,
    ok: 'Vidunderligt!',
    next: 'Næste helt',
  },
});

function perkIcon(effect = {}) {
  if (effect.stat && Object.keys(effect.stat).length) return Object.keys(effect.stat)[0];
  if (effect.maxHp) return 'heart';
  if (effect.guard) return 'shield';
  if (effect.sparks) return 'spark';
  if (effect.strikeDie) return 'dice';
  return 'talent';
}

export async function levelUp(level, ctx) {
  const layer = ctx.stage.layers.screen;
  const heroesC = ctx.content?.heroes || {};
  ctx.gm?.hide?.();
  const stageEl = h('div.sa-lv-stage');
  const emblem = h('div.sa-lv-emblem', h('div.sa-lv-rays'), h('div.sa-lv-num', String(level)), h('div.lf-title.sa-lv-etitle', STR.emblem(level)), h('div.lf-sub', STR.emblemSub));
  const root = h('div.sa-lv', h('div.sa-lv-veil'), emblem, stageEl);
  layer.appendChild(root);
  ctx.audio.sfx('levelup');
  await wait(30);
  root.classList.add('is-in');
  await ctx.sleep(500);
  await ctx.gm?.react?.('levelup.intro');
  ctx.gm?.hide?.();
  await ctx.sleep(300);
  emblem.classList.add('is-up');
  await ctx.sleep(500);

  for (const hero0 of [...(ctx.state.party || [])]) {
    const hero = ctx.state.hero(hero0.id) || hero0;
    const hc = heroesC[hero.arch] || {};
    const perks = (hc.perks?.[level] || []).slice(0, 2);
    const beforeMax = hero.maxHp;
    const heartsNum = h('b', String(beforeMax));
    const badge = h('div.sa-lv-badge', h('span', STR.level(hero.level || level - 1)));
    const left = h('div.sa-lv-hero',
      h('div.sa-lv-port', ctx.ui.portrait(hero.id, 'lg'), badge),
      h('div.sa-lv-name', hero.name),
      h('div.sa-lv-calling', hc.calling || hero.arch),
      h('div.sa-lv-hearts', ctx.ui.icon('heart'), heartsNum, h('span.sa-lv-plus', STR.hearts)));
    let resolvePick;
    const pickP = new Promise((r) => { resolvePick = r; });
    let chosen = null;
    const cards = perks.map((p, i) => {
      const ic = perkIcon(p.effect);
      const statV = p.effect?.stat?.[ic];
      const iconEl = statV != null ? ctx.ui.statChip(ic, statV) : h('span.sa-lv-picon', ctx.ui.icon(ic));
      const c = h('button.sa-lv-perk.lf-parch', { type: 'button', style: { '--i': i } },
        h('div.sa-lv-perk-n', String(i + 1)), iconEl, h('h3', p.name), h('p', p.text));
      tap(c, () => { if (chosen) return; chosen = p; c.classList.add('is-chosen'); cards.forEach((o) => { if (o !== c) o.classList.add('is-other'); }); ctx.audio.sfx('ui.confirm'); ctx.audio.sfx('star.gain'); resolvePick(p); }, ctx);
      return c;
    });
    const right = h('div.sa-lv-choose', h('div.lf-kicker', STR.choose), h('div.lf-sub', STR.chooseSub), h('div.sa-lv-perks', cards));
    const panel = h('div.sa-lv-panel.lf-panel', { style: { '--hc': ctx.ui.heroColor(hero.arch) } }, left, right);
    stageEl.replaceChildren(panel);
    await wait(30);
    panel.classList.add('is-in');
    await ctx.sleep(600);

    // badge + hearts
    badge.classList.add('is-pop');
    badge.firstChild.textContent = STR.level(level);
    ctx.audio.sfx('fanfare.small');
    const after = R.maxHp({ ...hero, level });
    for (let v = beforeMax + 1; v <= after; v++) { await ctx.sleep(140); heartsNum.textContent = String(v); ctx.audio.sfx('heal', { volume: 0.4, rate: 1 + (v - beforeMax) * 0.1 }); }
    left.classList.add('is-grown');
    await ctx.sleep(300);
    right.classList.add('is-in');

    const onKey = (e) => { const n = parseInt(e.key, 10); if (n >= 1 && n <= cards.length) cards[n - 1].click(); };
    window.addEventListener('keydown', onKey);
    let perk = null;
    if (perks.length) {
      if (ctx.auto) ctx.sleep(700).then(() => { if (!chosen) cards[0].click(); });
      perk = await pickP;
    }
    window.removeEventListener('keydown', onKey);
    const cur = ctx.state.hero(hero.id) || hero;
    ctx.state.replaceHero(R.levelUpHero(cur, level, perk));
    await ctx.sleep(900);

    if (level >= 3) {
      const great = (hc.powers || []).find((p) => p.great);
      if (great) {
        panel.classList.add('is-dim');
        const ok = ctx.ui.button(STR.ok, { kind: 'primary', size: 'lg', sfx: 'ui.confirm' });
        const reveal = h('div.sa-lv-great', h('div.sa-lv-great-rays'), h('div.sa-lv-great-burst'),
          h('div.lf-kicker', STR.great),
          h('div.sa-lv-great-port', ctx.ui.portrait(hero.id, 'lg')),
          h('h2.sa-lv-great-name', great.name),
          h('p.sa-lv-great-text', great.text),
          h('div.sa-lv-great-cost', ctx.ui.icon('spark'), STR.cost(great.cost || R.SPARKS.great)), ok);
        stageEl.appendChild(reveal);
        ctx.audio.sfx('sting.wonder');
        await ctx.sleep(350);
        ctx.stage.fx?.('flash');
        ctx.audio.sfx('fanfare.big');
        reveal.classList.add('is-in');
        await new Promise((res) => { tap(ok, res, ctx, { sfx: null }); if (ctx.auto) ctx.sleep(1200).then(res); });
        reveal.classList.add('is-out');
        await ctx.sleep(400);
      }
    }
    panel.classList.add('is-out');
    await ctx.sleep(450);
  }
  root.classList.add('is-leaving');
  await ctx.sleep(600);
  root.remove();
}
