// HUD (SPEC 10): party portraits with hearts bars and level pips top left; Stars and coins top right;
// the GM screen (book) and Settings (gear) buttons. ctx.hud.show(), .hide(), .sceneTitle(title|null, sub), .refresh()
import { h, tap } from './dom.js';
import * as R from '../core/rules.js';
import { L } from '../core/i18n.js';

const STR = L({
  en: { stars: 'Stars', coins: 'Coins', book: "The Storykeeper's Book", settings: 'Settings' },
  da: { stars: 'Stjerner', coins: 'Mønter', book: 'Sagnvogterens bog', settings: 'Indstillinger' },
});

const HIDE_ON = new Set(['title', 'party', 'prologue', 'ending']);
const FULL = new Set(['combat', 'melody', 'runes', 'travel', 'levelup']); // full-stage screens: HUD steps aside, returns after

export function createHud(ctx) {
  const { ui, bus, state } = ctx;
  const layer = ctx.stage.layers.hud;
  const partyEl = h('div.lf-hud-party');
  const starsEl = h('div.lf-hud-stars', { title: STR.stars });
  const coinsVal = h('b', '0');
  const coinsEl = h('div.lf-hud-coins', { title: STR.coins }, ui.icon('coin'), coinsVal);
  const bookBtn = ui.button(null, { kind: 'ghost', icon: 'book', cls: 'lf-btn--icon lf-hud-btn', attrs: { 'aria-label': STR.book }, onClick: () => open('gmscreen') });
  const gearBtn = ui.button(null, { kind: 'ghost', icon: 'gear', cls: 'lf-btn--icon lf-hud-btn', attrs: { 'aria-label': STR.settings }, onClick: () => open('settings') });
  const right = h('div.lf-hud-right', h('div.lf-hud-purse.lf-panel.no-corners', starsEl, h('span.lf-hud-sep'), coinsEl), bookBtn, gearBtn);
  const titleEl = h('div.lf-hud-title');
  const root = h('div.lf-hud.is-hidden', partyEl, titleEl, right);
  layer.appendChild(root);

  let opening = false;
  async function open(name) {
    if (opening) return;
    opening = true;
    try { await ctx.screens.go(name); } finally { opening = false; refresh(); }
  }

  const cards = new Map();
  function renderParty() {
    partyEl.replaceChildren();
    cards.clear();
    for (const hero of state.party) {
      const bar = h('div.lf-bar', h('i'));
      const hp = h('span.lf-hud-hp');
      const pips = h('span.lf-hud-pips');
      const card = h('div.lf-hud-hero', { dataset: { hero: hero.id } },
        ui.portrait(hero.id, 'sm'),
        h('div.lf-hud-hero-info', h('div.lf-hud-hero-top', h('span.lf-hud-name', hero.name.split(' ')[0]), pips), bar, hp));
      cards.set(hero.id, { card, bar, hp, pips });
      partyEl.appendChild(card);
    }
    updateParty();
  }
  function updateParty() {
    for (const hero of state.party) {
      const c = cards.get(hero.id);
      if (!c) { renderParty(); return; }
      const v = Math.max(0, Math.min(1, hero.hp / Math.max(1, hero.maxHp)));
      c.bar.style.setProperty('--v', v);
      c.bar.classList.toggle('is-low', v <= 0.3);
      c.hp.textContent = `${hero.hp} / ${hero.maxHp}`;
      c.card.classList.toggle('is-down', hero.hp <= 0);
      const lv = hero.level || 1;
      if (c.pips.childElementCount !== 3 || c.pips.dataset.lv !== String(lv)) {
        c.pips.dataset.lv = lv;
        c.pips.replaceChildren(...[1, 2, 3].map((i) => h('i', { class: i <= lv ? 'on' : null })));
      }
      c.card.classList.toggle('is-actor', ctx.gm?.actor === hero.id);
    }
  }
  function renderStars(gain = false) {
    const n = state.stars;
    if (starsEl.childElementCount !== R.STARS_MAX) starsEl.replaceChildren(...Array.from({ length: R.STARS_MAX }, () => h('span.lf-hud-star', ui.icon('star'))));
    [...starsEl.children].forEach((s, i) => {
      const was = s.classList.contains('on');
      s.classList.toggle('on', i < n);
      if (gain && !was && i < n) { s.classList.remove('pop'); void s.offsetWidth; s.classList.add('pop'); }
    });
  }
  function renderCoins(delta) {
    coinsVal.textContent = String(state.gold);
    if (delta) { coinsEl.classList.remove('pop'); void coinsEl.offsetWidth; coinsEl.classList.add('pop'); }
  }
  function refresh() { renderParty(); renderStars(); renderCoins(); }

  bus.on('party:changed', renderParty);
  bus.on('state:loaded', refresh);
  bus.on('state:reset', refresh);
  bus.on('party:hp', (d) => {
    updateParty();
    const c = cards.get(d?.id);
    if (c && d?.delta) { const cls = d.delta < 0 ? 'hurt' : 'healed'; c.card.classList.remove(cls); void c.card.offsetWidth; c.card.classList.add(cls); }
  });
  bus.on('stars:changed', (d) => renderStars(d?.delta > 0));
  bus.on('gold:changed', (d) => renderCoins(d?.delta));
  bus.on('state:changed', () => updateParty());
  bus.on('gm:actor', () => updateParty());
  bus.on('screen:enter', ({ name }) => { if (HIDE_ON.has(name) || FULL.has(name)) hide(); });
  bus.on('screen:exit', ({ name }) => { if (FULL.has(name) && ctx.state.scene) show(); });
  bus.on('scene:entered', () => show());

  let titleTimer = null;
  function sceneTitle(title, sub) {
    clearTimeout(titleTimer);
    if (!title) { titleEl.classList.remove('is-in'); return; }
    titleEl.replaceChildren(...[h('div.lf-hud-title-main', title), sub ? h('div.lf-hud-title-sub', sub) : null].filter(Boolean));
    requestAnimationFrame(() => titleEl.classList.add('is-in'));
    titleTimer = setTimeout(() => titleEl.classList.remove('is-in'), 5200 / (window.__LF_SPEED || 1));
  }
  function show() { root.classList.remove('is-hidden'); refresh(); }
  function hide() { root.classList.add('is-hidden'); }

  refresh();
  return { show, hide, refresh, sceneTitle, el: root };
}
