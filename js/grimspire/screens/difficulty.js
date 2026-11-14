// Difficulty (GRIMSPIRE.md 3.2, 4.2). gsDifficulty(ctx, { current, fromCamp }) -> 'squire' | 'knight' | 'legend'
// Three tall banners, each with an emblem, its name and one line on what changes. From camp it opens as an
// overlay over the fire and can be closed without a change.
import { h, wait } from '../../ui/dom.js';
import { L } from '../../core/i18n.js';
import { sfx, say } from '../hud.js';

const STR = L({
  en: {
    kicker: 'How hard is the tower?', title: 'Choose your challenge', change: 'You can change this at camp.', keep: 'Keep it',
    squire: { name: 'Squire', line: 'Wide timing windows. A weak hit still counts as good. For a first climb.' },
    knight: { name: 'Knight', line: 'The tower as it was built. Timing matters, monsters hit hard.' },
    legend: { name: 'Legend', line: 'Narrow windows, tougher monsters. Big attacks need a perfect block.' },
    pickedOne: 'Chosen',
  },
  da: {
    kicker: 'Hvor svært skal tårnet være?', title: 'Vælg din udfordring', change: 'Du kan skifte det i lejren.', keep: 'Behold',
    squire: { name: 'Væbner', line: 'Brede tidsvinduer. Et svagt slag tæller stadig som godt. Til den første tur op.' },
    knight: { name: 'Ridder', line: 'Tårnet, som det er bygget. Timing tæller, og monstrene slår hårdt.' },
    legend: { name: 'Legende', line: 'Smalle vinduer og sejere monstre. Store angreb kræver en perfekt blokering.' },
    pickedOne: 'Valgt',
  },
});

const IDS = ['squire', 'knight', 'legend'];
const EMBLEM = {
  squire: '<path d="M32 6l20 8v16c0 13-9 22-20 27C21 52 12 43 12 30V14z"/><path d="M32 18v26M22 30h20"/>',
  knight: '<path d="M32 6l20 8v16c0 13-9 22-20 27C21 52 12 43 12 30V14z"/><path d="M24 20l16 18M40 20L24 38"/><circle cx="32" cy="29" r="4"/>',
  legend: '<path d="M32 6l20 8v16c0 13-9 22-20 27C21 52 12 43 12 30V14z"/><path d="M20 24l6 4 6-9 6 9 6-4-2 14H22z"/><circle cx="32" cy="44" r="2.4"/>',
};
const emblem = (id) => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 64 64');
  s.innerHTML = `<g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">${EMBLEM[id]}</g>`;
  return s;
};

export async function gsDifficulty(ctx, { current = 'knight', fromCamp = false } = {}) {
  const layer = fromCamp ? ctx.stage.layers.overlay : ctx.stage.layers.screen;
  if (!fromCamp) { ctx.gm.hide(); ctx.hud.hide(); ctx.stage.setBg('gs_title', { fade: 0.8 }); }
  let resolve;
  const p = new Promise((r) => { resolve = r; });
  let picked = null;
  const cards = IDS.map((id, i) => {
    const t = STR[id];
    const el = h('button.gs-diff-card', { type: 'button', class: [`is-${id}`, id === current ? 'is-current' : null].filter(Boolean).join(' '), style: { '--i': i }, dataset: { id } },
      h('div.gs-diff-shine'),
      h('div.gs-diff-emblem', emblem(id)),
      h('div.gs-diff-name', t.name),
      h('div.gs-diff-pips', IDS.map((_, k) => h('i', { class: k <= i ? 'on' : null }))),
      h('p.gs-diff-line', t.line),
      id === current && fromCamp ? h('div.gs-diff-tag', STR.pickedOne) : null);
    el.addEventListener('pointerdown', () => sfx(ctx, 'ui.tap'));
    el.addEventListener('click', () => {
      if (picked) return;
      picked = id;
      sfx(ctx, 'ui.confirm'); sfx(ctx, id === 'legend' ? 'gs.roar' : 'gs.swing', { volume: 0.6 });
      cards.forEach((c) => c.classList.add(c === el ? 'is-picked' : 'is-dismissed'));
      resolve(id);
    });
    return el;
  });
  const keep = fromCamp ? ctx.ui.button(STR.keep, { kind: 'ghost', onClick: () => { if (!picked) { picked = current; resolve(current); } } }) : null;
  const root = h('div.gs-diff', { class: fromCamp ? 'is-overlay' : null, 'data-no-advance': '' },
    h('div.gs-diff-shade'),
    h('header.gs-diff-head', h('div.gs-kicker', STR.kicker), h('h1.gs-title', STR.title), h('div.gs-sub', STR.change)),
    h('div.gs-diff-row', cards),
    keep ? h('div.gs-diff-foot', keep) : null);
  layer.appendChild(root);
  await wait(30);
  root.classList.add('is-in');
  if (!fromCamp) ctx.sleep(600).then(() => say(ctx, 'difficulty.pick', 'warm'));
  if (ctx.auto) ctx.sleep(900).then(() => cards[IDS.indexOf(current)]?.click());
  const id = await p;
  await ctx.sleep(700);
  root.classList.add('is-leaving');
  await ctx.sleep(450);
  root.remove();
  ctx.gm.hide();
  return id;
}
