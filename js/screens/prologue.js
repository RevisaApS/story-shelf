// Prologue (SPEC 11): prologueScreen(ctx) -> void
// Storybook panels from content.prologue, each slowly panning, lines voiced through the narrator,
// a page turn between panels, and Skip.
import { h, tap, wait } from '../ui/dom.js';
import { L } from '../core/i18n.js';

const STR = L({
  en: { skip: 'Skip', kicker: 'Before the story', page: (i, n) => `${i} / ${n}` },
  da: { skip: 'Spring over', kicker: 'Før historien', page: (i, n) => `${i} / ${n}` },
});
// Art that stands in while a story panel is still being painted.
const STAND_IN = ['title', 'dragon_lair', 'village_square', 'dragon_lair'];
// Pan moves per panel: [fromX, fromY, fromScale, toX, toY, toScale]
const PANS = [
  [-2, 1.5, 1.06, 2, -1.5, 1.16],
  [2, -1, 1.14, -2, 1, 1.05],
  [0, 2, 1.04, 0, -2, 1.14],
  [-1.5, -1, 1.16, 1.5, 1, 1.06],
];

async function artUrl(ctx, p, i) {
  const own = p.art ? ctx.assets.story(p.art) : null;
  if (own && (await ctx.assets.exists(own))) return own;
  const alt = ctx.assets.bg(STAND_IN[i % STAND_IN.length]);
  return (await ctx.assets.exists(alt)) ? alt : null;
}

export async function prologueScreen(ctx) {
  const panels = ctx.content?.prologue?.panels || [];
  if (!panels.length) return;
  const layer = ctx.stage.layers.screen;
  ctx.hud?.hide?.();
  ctx.weather?.set?.('none');
  ctx.audio.music('lullaby');

  let skipped = false;
  let resolveSkip;
  const skipP = new Promise((r) => { resolveSkip = r; });
  const skipBtn = ctx.ui.button(STR.skip, { kind: 'ghost', cls: 'sa-pro-skip', icon: 'chevron' });
  const pageNo = h('div.sa-pro-pageno');
  const book = h('div.sa-pro-book');
  const root = h('div.sa-pro', book, h('div.sa-pro-frame'), h('div.sa-pro-top', h('div.lf-kicker', STR.kicker), pageNo), skipBtn);
  layer.appendChild(root);
  tap(skipBtn, () => { if (skipped) return; skipped = true; resolveSkip(); });
  const onKey = (e) => { if (e.key === 'Escape' && !skipped) { skipped = true; resolveSkip(); } };
  window.addEventListener('keydown', onKey);

  const urls = await Promise.all(panels.map((p, i) => artUrl(ctx, p, i)));
  ctx.assets.preload(urls.filter(Boolean));
  await wait(30);
  root.classList.add('is-in');

  let current = null;
  const makePage = (i) => {
    const pan = PANS[i % PANS.length];
    const img = urls[i]
      ? h('div.sa-pro-img', { style: { backgroundImage: `url("${urls[i]}")`, '--fx': `${pan[0]}%`, '--fy': `${pan[1]}%`, '--fs': pan[2], '--tx': `${pan[3]}%`, '--ty': `${pan[4]}%`, '--ts': pan[5] } })
      : h('div.sa-pro-img.is-ph');
    return h('div.sa-pro-page', img, h('div.sa-pro-shade'));
  };

  // Run narration, racing the skip button. On skip, the pending line is released by pressing on.
  const sayOrSkip = async (text, mood) => {
    if (skipped) return;
    const p = ctx.gm.say(text, { mood });
    await Promise.race([p, skipP]);
    if (skipped) {
      for (let k = 0; k < 3; k++) { window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' })); await wait(20); }
      ctx.audio.stopVoice?.();
    }
  };

  for (let i = 0; i < panels.length && !skipped; i++) {
    const page = makePage(i);
    pageNo.textContent = STR.page(i + 1, panels.length);
    if (current) {
      // Page turn: the old page lifts and turns over its left edge, revealing the new one.
      const old = current;
      page.classList.add('is-under');
      book.insertBefore(page, old);
      ctx.gm.hide();
      ctx.audio.sfx('ui.page');
      old.classList.add('is-turning');
      await wait(20);
      page.classList.add('is-in');
      await Promise.race([ctx.sleep(1150), skipP]);
      old.remove();
      page.classList.remove('is-under');
    } else {
      book.appendChild(page);
      await wait(20);
      page.classList.add('is-in');
      await Promise.race([ctx.sleep(900), skipP]);
    }
    current = page;
    for (const l of panels[i].lines || []) {
      if (skipped) break;
      const text = typeof l === 'string' ? l : l.say;
      const mood = (typeof l === 'object' && l.mood) || (i === panels.length - 1 ? 'hush' : 'warm');
      await sayOrSkip(text, mood);
    }
  }

  window.removeEventListener('keydown', onKey);
  ctx.gm.hide();
  if (skipped) ctx.audio.sfx('ui.page');
  root.classList.add('is-leaving');
  await ctx.sleep(900);
  root.remove();
}
