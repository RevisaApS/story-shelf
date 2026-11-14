// The shelf (ROUND2 1): shelfScreen(ctx, packs) -> packId
// The first thing a family sees: one large painted card per pack on the candlelit table, each with its honest label
// (ages first), and the language switch top right. A card tilts a little toward the pointer and glows on hover or
// focus. Switching language saves settings.lang and reloads the page. Styles: css/shelf.css.
import { h, tap, wait } from '../ui/dom.js';
import { L, tr, getLang } from '../core/i18n.js';
import { lanternSky } from './title.js';

const STR = L({
  en: { kicker: 'Tonight at the table', title: 'Choose a story', play: 'Play', lang: 'Language', foot: 'Every story can be read aloud or listened to.' },
  da: { kicker: 'I aften ved bordet', title: 'Vælg en historie', play: 'Spil', lang: 'Sprog', foot: 'Alle historier kan læses højt eller lyttes til.' },
});
const LANG_NAMES = { da: 'Dansk', en: 'English' };

export async function shelfScreen(ctx, packs = []) {
  const layer = ctx.stage.layers.screen;
  ctx.gm?.hide?.();
  ctx.hud?.hide?.();
  ctx.weather?.set?.('none');

  let resolvePick;
  const picked = new Promise((r) => { resolvePick = r; });
  let done = false;
  const pick = (id) => { if (done) return; done = true; resolvePick(id); };

  // ---- language switch
  const cur = getLang();
  const langBtns = ['da', 'en'].map((l) => {
    const b = h('button.sh-lang-opt', { type: 'button', class: l === cur ? 'is-on' : null, lang: l, 'aria-pressed': String(l === cur) }, LANG_NAMES[l]);
    tap(b, () => {
      if (l === getLang() || done) return;
      ctx.settings.lang = l;
      try { ctx.settings.save?.(); } catch { /* ignore */ }
      const q = new URLSearchParams(location.search);
      q.delete('lang');
      const s = q.toString();
      done = true;
      root.classList.add('is-leaving');
      setTimeout(() => { location.href = location.pathname + (s ? `?${s}` : ''); }, 260);
    }, ctx, { sfx: 'ui.confirm' });
    return b;
  });
  const langSwitch = h('div.sh-lang', { role: 'group', 'aria-label': STR.lang }, langBtns[0], h('span.sh-lang-dot'), langBtns[1]);

  // ---- cards
  const cards = packs.map((pack, i) => {
    const art = h('div.sh-card-art', h('img', { src: pack.art, alt: '', draggable: 'false', onerror: (e) => { e.target.remove(); } }), h('div.sh-card-art-fade'));
    const play = h('span.sh-card-play.lf-btn.lf-btn--primary.lf-btn--lg', h('span', STR.play));
    const lab = pack.label || {};
    const card = h('button.sh-card', { type: 'button', dataset: { pack: pack.id, theme: pack.theme || '' }, style: { '--i': i },
      'aria-label': `${tr(pack.title)}. ${tr(lab.ages) || ''}. ${tr(lab.tone) || ''}` },
    h('div.sh-card-in',
      art,
      h('div.sh-card-body',
        h('h2.sh-card-title', tr(pack.title)),
        h('div.sh-card-sub', tr(pack.sub)),
        h('div.sh-card-rule', h('i'), h('b'), h('i')),
        lab.ages ? h('div.sh-card-ages', tr(lab.ages)) : null,
        lab.tone ? h('div.sh-card-tone', tr(lab.tone)) : null,
        lab.play ? h('div.sh-card-playline', tr(lab.play)) : null,
        play)),
    h('div.sh-card-shine'));
    // tilt toward the pointer
    card.addEventListener('pointermove', (e) => {
      if (ctx.settings.reduceMotion) return;
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty('--ry', `${(x * 7).toFixed(2)}deg`);
      card.style.setProperty('--rx', `${(-y * 5).toFixed(2)}deg`);
      card.style.setProperty('--mx', `${((x + 0.5) * 100).toFixed(1)}%`);
      card.style.setProperty('--my', `${((y + 0.5) * 100).toFixed(1)}%`);
    });
    card.addEventListener('pointerleave', () => { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
    card.addEventListener('pointerenter', () => ctx.audio.sfx('ui.hover', { volume: 0.4 }));
    tap(card, () => { unlock(); card.classList.add('is-picked'); pick(pack.id); }, ctx, { sfx: 'ui.confirm' });
    return card;
  });

  const canvas = h('canvas.sh-sky');
  const root = h('div.sh', { class: `n-${packs.length}` },
    h('div.sh-shade'), canvas, h('div.sh-vignette'),
    h('div.sh-top', langSwitch),
    h('div.sh-head', h('div.lf-kicker', STR.kicker), h('h1.sh-title', STR.title), h('div.lf-divider')),
    h('div.sh-cards', cards),
    h('div.sh-foot', STR.foot),
    h('div.sh-black'));
  layer.appendChild(root);

  const sky = lanternSky(canvas, ctx, { lanterns: 14, embers: 46 });
  const bgP = ctx.stage.setBg('party_table', { fade: 0.1 });
  let unlocked = false;
  const unlock = () => {
    if (unlocked) return; unlocked = true;
    try { ctx.audio.unlock(); } catch { /* ignore */ }
    ctx.audio.music('title');
  };
  root.addEventListener('pointerdown', unlock, { capture: true });
  ctx.audio.music('title');

  const onKey = (e) => {
    if (done || ctx.stage.layers.overlay.childElementCount) return;
    if (e.target?.closest?.('button')) return; // a focused card or switch handles its own Enter
    if (e.key === 'Enter' && cards.length === 1) { unlock(); pick(packs[0].id); }
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= packs.length) { unlock(); pick(packs[n - 1].id); }
  };
  window.addEventListener('keydown', onKey);

  await Promise.race([bgP, ctx.sleep(1200)]);
  await wait(30);
  root.classList.add('is-in');
  if (ctx.auto) ctx.sleep(900).then(() => pick(packs[0]?.id));

  const id = await picked;
  window.removeEventListener('keydown', onKey);
  ctx.audio.sfx('sting.wonder', { volume: 0.7 });
  root.classList.add('is-leaving');
  await ctx.sleep(900);
  sky.stop();
  root.remove();
  return id;
}
