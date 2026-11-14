// Camp rest (SPEC 11): rest(ctx) -> void
// A warm campfire moment: the scene glows orange, a fire flickers, and each hero's hearts refill in turn.
import { h, wait } from '../ui/dom.js';
import { lanternSky } from './title.js';
import { L } from '../core/i18n.js';

const STR = L({
  en: { kicker: 'By the fire', title: 'Rest', full: 'Hearts full' },
  da: { kicker: 'Ved bålet', title: 'Hvil', full: 'Fulde hjerter' },
});

export async function rest(ctx) {
  const layer = ctx.stage.layers.screen;
  const party = ctx.state.party || [];
  const canvas = h('canvas.sa-camp-embers');
  const rows = party.map((hero) => {
    const bar = h('div.lf-bar.sa-camp-bar', h('i'));
    const num = h('div.sa-camp-num');
    const el = h('div.sa-camp-hero', ctx.ui.portrait(hero.id, 'md'), h('div.sa-camp-name', hero.name.split(' ')[0]), bar, num);
    return { hero, el, bar, num };
  });
  const setBar = (r, hp) => {
    const max = r.hero.maxHp || 1;
    r.bar.style.setProperty('--v', String(Math.max(0, Math.min(1, hp / max))));
    r.num.textContent = `${hp} / ${max}`;
  };
  rows.forEach((r) => setBar(r, r.hero.hp));
  const root = h('div.sa-camp', h('div.sa-camp-warm'), h('div.sa-camp-glow'),
    canvas,
    h('div.sa-camp-head', h('div.lf-kicker', STR.kicker)),
    h('div.sa-camp-row', rows.map((r) => r.el)));
  layer.appendChild(root);
  const fx = lanternSky(canvas, ctx, { lanterns: 0, embers: 90, area: { x0: 360, x1: 920, y0: 0, y1: 800 } });
  ctx.audio.sfx('whoosh', { volume: 0.4 });
  await wait(30);
  root.classList.add('is-in');
  const intro = ctx.gm?.react?.('rest.intro');
  await ctx.sleep(900);

  for (const r of rows) {
    const before = r.hero.hp;
    ctx.state.heal(r.hero.id, 'full');
    const after = r.hero.hp;
    r.el.classList.add('is-healing');
    ctx.audio.sfx('heal', { volume: 0.8 });
    const steps = Math.max(1, after - before);
    for (let k = 1; k <= steps; k++) {
      setBar(r, Math.round(before + ((after - before) * k) / steps));
      await ctx.sleep(Math.min(70, 600 / steps));
    }
    setBar(r, after);
    r.el.classList.add('is-full');
    r.el.appendChild(h('div.sa-camp-full', ctx.ui.icon('heart'), STR.full));
    await ctx.sleep(380);
  }
  await Promise.race([Promise.resolve(intro), ctx.sleep(4500)]);
  await ctx.sleep(500);
  root.classList.add('is-leaving');
  await ctx.sleep(800);
  fx.stop();
  root.remove();
}
