// Grimspire HUD and the small helpers every gs-meta screen shares.
//
// createGsHud(ctx) -> hud: show(), hide(), refresh(), sceneTitle(title|null, sub), setBack(fn|null), setLocked(bool), el
//   Top left: hunter portraits with Health bars. Beside them the party level badge and the XP bar.
//   Top right: gold, Bone Shards, Armoury, Settings. "Back to camp" appears when a screen calls setBack(fn).
// Helpers: icon(name), portrait(ctx, arch, size), art(ctx, kind, id, { cls, label }), heroColor(arch),
//   say(ctx, pool, mood) (a quick Varg line from content.lines), countUp(el, from, to, ms, ctx),
//   firstName(hero), STRC (shared UI strings), sfx(ctx, name, opts), ensureGsCss()
import { h, tap } from '../ui/dom.js';
import { L } from '../core/i18n.js';

export const STRC = L({
  en: {
    level: 'Level', lv: 'Lv', gold: 'gold', shards: 'Bone Shards', armoury: 'Armoury', settings: 'Settings',
    back: 'Back to camp', health: 'Health', xp: 'XP', cont: 'Continue', skip: 'Skip', down: 'Knocked down',
    families: { sword: 'Greatsword', daggers: 'Twin daggers', staff: 'Storm staff', bow: 'Recurve bow', axes: 'Twin axes', scythe: 'Scythe-staff' },
    stats: { hp: 'Health', atk: 'Attack', def: 'Defence', spd: 'Speed', luck: 'Luck', fury: 'Fury' },
    rarity: { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' },
  },
  da: {
    level: 'Niveau', lv: 'Nv', gold: 'guld', shards: 'Benskår', armoury: 'Våbenkammer', settings: 'Indstillinger',
    back: 'Tilbage til lejren', health: 'Liv', xp: 'XP', cont: 'Fortsæt', skip: 'Spring over', down: 'Slået ned',
    families: { sword: 'Tohåndssværd', daggers: 'Tvillingedolke', staff: 'Stormstav', bow: 'Rekurvbue', axes: 'Tvillingeøkser', scythe: 'Leestav' },
    stats: { hp: 'Liv', atk: 'Angreb', def: 'Forsvar', spd: 'Fart', luck: 'Held', fury: 'Raseri' },
    rarity: { common: 'Almindelig', rare: 'Sjælden', epic: 'Episk', legendary: 'Legendarisk' },
  },
});

export const HERO_COLORS = { dragonknight: '#ff6a2a', shadow: '#a46bff', stormmage: '#5fb4ff', hunter: '#7fcf6a', berserker: '#4fd0ff', gravewarden: '#6dffb0' };
export const heroColor = (arch) => HERO_COLORS[arch] || '#ff7a2e';
export const firstName = (hero) => String(hero?.name || '').split(' ')[0];
export const sfx = (ctx, name, opts) => { try { ctx.audio?.sfx?.(name, opts); } catch { /* ignore */ } };

let cssP = null;
export function ensureGsCss() {
  if (cssP) return cssP;
  const add = (file) => new Promise((res) => {
    const href = new URL(`../../css/${file}`, import.meta.url).href;
    if ([...document.querySelectorAll('link[rel="stylesheet"]')].some((l) => l.href === href)) return res();
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = href; link.onload = res; link.onerror = res;
    document.head.appendChild(link);
    setTimeout(res, 1500);
  });
  cssP = Promise.all([add('gs-theme.css'), add('gs-screens.css')]);
  return cssP;
}

// ---------- icons (24 x 24, stroke = currentColor) ----------
const P = {
  battle: '<path d="M4 4l9 9M4 4h4M4 4v4M20 4l-9 9M20 4h-4M20 4v4M7 15l-3 3 2 2 3-3M17 15l3 3-2 2-3-3" />',
  elite: '<path d="M5 3l3 4M19 3l-3 4M6 11a6 6 0 0112 0v4l-2 1v3H8v-3l-2-1z"/><circle cx="9.5" cy="12" r="1.3" fill="currentColor"/><circle cx="14.5" cy="12" r="1.3" fill="currentColor"/><path d="M11 19v-2M13 19v-2"/>',
  event: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  rest: '<path d="M12 3c2.5 3 4.5 5 4.5 8a4.5 4.5 0 01-9 0c0-1.6.8-2.7 1.8-3.7.2 1.3.9 2 1.7 2.2C10.7 7.6 11 5.4 12 3z"/><path d="M4 20l16-3M4 17l16 3"/>',
  boss: '<path d="M3 8l4.5 3.5L12 5l4.5 6.5L21 8l-2 10H5z"/><path d="M5 21h14"/><circle cx="12" cy="14" r="1.4" fill="currentColor"/>',
  chest: '<rect x="3.5" y="9" width="17" height="10" rx="1.5"/><path d="M3.5 9a8.5 5 0 0117 0M3.5 13h17M11 12h2v3h-2z"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5.5" opacity=".6"/><path d="M12 8.5v7M9.8 10.2h4.4"/>',
  shard: '<path d="M12 2.5l5 7-5 12-5-12z"/><path d="M7 9.5h10M12 2.5v19" opacity=".55"/>',
  armoury: '<path d="M5 10a7 7 0 0114 0v3l-2.5 1.5V20h-9v-5.5L5 13z"/><path d="M12 4v8M8.5 14h7"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3L5.5 5.5"/><circle cx="12" cy="12" r="6.6"/>',
  back: '<path d="M10 5L3 12l7 7M3 12h11a6 6 0 016 6v1"/>',
  forge: '<path d="M3 8h13a4 4 0 004 4H15v2l3 5H6l3-5v-2H7a4 4 0 01-4-4z"/><path d="M14 3l1.5 2.5M18 2l-.5 3"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 01-10 0z"/><path d="M7 6H4a3 3 0 003 4M17 6h3a3 3 0 01-3 4M12 14v4M8 21h8M9 18h6"/>',
  gate: '<path d="M4 21V9a8 8 0 0116 0v12"/><path d="M8 21v-9M12 21v-10M16 21v-9M4 15h16"/>',
  fire: '<path d="M12 2.5c3.5 4 6 6.5 6 10.5a6 6 0 01-12 0c0-2 1-3.6 2.3-4.8.2 1.8 1.1 2.8 2.2 3.1C10 8.3 10.5 5.3 12 2.5z"/><path d="M12 20a2.6 2.6 0 01-2.6-2.6c0-1.6 1.4-2.6 2.6-4.4 1.2 1.8 2.6 2.8 2.6 4.4A2.6 2.6 0 0112 20z"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 018 0v2.5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  pencil: '<path d="M4 20l1.2-4.6L15.8 4.8a2 2 0 012.8 0l.6.6a2 2 0 010 2.8L8.6 18.8z"/><path d="M13.8 6.8l3.4 3.4"/>',
  heart: '<path d="M12 20.5S3 14.8 3 8.9C3 6.2 5.1 4.2 7.6 4.2c1.8 0 3.4 1 4.4 2.5 1-1.5 2.6-2.5 4.4-2.5 2.5 0 4.6 2 4.6 4.7 0 5.9-9 11.6-9 11.6z"/>',
  star: '<path d="M12 2.2l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.1l-5.9 3.2 1.3-6.6L2.5 9.1l6.6-.8z"/>',
  skull: '<path d="M5 11a7 7 0 0114 0v3l-2 1v4H7v-4l-2-1z"/><circle cx="9.3" cy="11.5" r="1.6" fill="currentColor"/><circle cx="14.7" cy="11.5" r="1.6" fill="currentColor"/><path d="M10.5 19v-2.5M13.5 19v-2.5"/>',
  sword: '<path d="M19.5 4.5L9 15M19.5 4.5V8l-8.5 8.5M19.5 4.5H16L7.5 13M6 14.5l3.5 3.5M7.5 16.5L4 20"/>',
  daggers: '<path d="M7 3l2 9-2 2-2-2zM6 14v6M17 3l2 9-2 2-2-2zM16 14v6M3.5 12.5h5M13.5 12.5h5"/>',
  staff: '<path d="M7 21L15.5 8.5"/><circle cx="17" cy="6" r="3"/><path d="M14 2.5l1 2M21 4l-2 .8M20.5 9.5l-1.6-1"/>',
  bow: '<path d="M6 3c7 3 7 15 0 18"/><path d="M6 3v18M4 12h16M17 9.5l3 2.5-3 2.5"/>',
  axes: '<path d="M8 3v18M16 3v18"/><path d="M8 4c-3 0-5 2-5 5h5M16 4c3 0 5 2 5 5h-5"/>',
  scythe: '<path d="M8 21L14 4"/><path d="M14 4c3 0 6 1.5 7.5 4-3-1-6-.5-8.4 1"/>',
  fury: '<path d="M13 2L5 13h6l-1 9 8-11h-6z"/>',
  bag: '<path d="M6 8h12l1.5 12h-15zM9 8a3 3 0 016 0"/>',
  flag: '<path d="M5 21V4M5 4h12l-2.5 4L17 12H5"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  book: '<path d="M3 5.5C5.5 4.3 8.5 4.3 11.4 6v13c-2.9-1.7-5.9-1.7-8.4-.5zM21 5.5c-2.5-1.2-5.5-1.2-8.4.5v13c2.9-1.7 5.9-1.7 8.4-.5z"/>',
  shield: '<path d="M12 2.5l8 3v6c0 5-3.4 8.7-8 10-4.6-1.3-8-5-8-10v-6z"/>',
  hourglass: '<path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9"/>',
};
export function icon(name, cls = '') {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('class', `gs-icon gs-icon-${name} ${cls}`.trim());
  s.innerHTML = `<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${P[name] || P.star}</g>`;
  return s;
}

// ---------- art with a styled placeholder (SPEC 3: layout never depends on an image) ----------
export function art(ctx, kind, id, { cls = '', label = '', fit = 'contain' } = {}) {
  const wrap = h('div.gs-art', { class: cls || null, dataset: { kind, id } });
  const ph = () => {
    wrap.classList.add('is-ph');
    wrap.replaceChildren(h('div.gs-art-ph', h('i'), label ? h('span', label) : null));
  };
  const src = ctx.assets.url ? ctx.assets.url(kind, id) : `assets/${kind}/${id}.webp`;
  if (ctx.assets.has(src) === false) ph();
  else {
    const img = h('img', { alt: label || '', draggable: 'false', style: { objectFit: fit } });
    img.onerror = ph;
    img.src = src;
    wrap.appendChild(img);
  }
  return wrap;
}
export function portrait(ctx, arch, size = 'md') {
  const hero = ctx.state?.hero?.(arch);
  const name = hero?.name || ctx.content?.heroes?.[arch]?.name || ctx.content?.npcs?.[arch]?.name || arch;
  const id = arch.startsWith('gs_') ? arch : `gs_${arch}`;
  const inner = art(ctx, 'portrait', id, { cls: 'gs-portrait-in', fit: 'cover' });
  if (inner.classList.contains('is-ph')) inner.replaceChildren(h('span.gs-portrait-ini', name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()));
  else inner.querySelector('img').addEventListener('error', () => inner.replaceChildren(h('span.gs-portrait-ini', name.slice(0, 2).toUpperCase())));
  return h('div.gs-portrait', { class: `gs-portrait--${size}`, style: { '--hc': heroColor(arch) }, dataset: { id: arch }, title: name }, inner);
}

export async function say(ctx, pool, mood = 'warm') {
  try { await ctx.gm?.react?.(pool, { mood }); } catch (e) { console.warn('[gs] line failed', pool, e); }
}

export function countUp(el, from, to, ms, ctx) {
  return new Promise((res) => {
    const sp = window.__LF_SPEED || 1;
    const dur = Math.max(1, ms / sp);
    const t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = String(Math.round(from + (to - from) * e));
      if (k < 1) requestAnimationFrame(step); else res();
    };
    if (to === from) { el.textContent = String(to); res(); return; }
    requestAnimationFrame(step);
    setTimeout(() => { el.textContent = String(to); res(); }, dur + 400); // never hang on a throttled frame loop
  });
}

export function pop(el, cls = 'is-pop') { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

// ---------- the HUD ----------
export function createGsHud(ctx) {
  const { bus } = ctx;
  const layer = ctx.stage.layers.hud;
  const partyEl = h('div.gs-hud-party');
  const lvNum = h('b', '1');
  const xpFill = h('i');
  const xpText = h('span.gs-hud-xptext');
  const lvEl = h('div.gs-hud-level', h('div.gs-hud-lvbadge', h('small', STRC.lv), lvNum), h('div.gs-hud-xp', h('div.gs-hud-xpbar', xpFill), xpText));
  const goldVal = h('b', '0');
  const shardVal = h('b', '0');
  const goldEl = h('div.gs-hud-pill.is-gold', { title: STRC.gold }, icon('coin'), goldVal);
  const shardEl = h('div.gs-hud-pill.is-shard', { title: STRC.shards }, icon('shard'), shardVal);
  const armBtn = h('button.gs-hud-btn', { type: 'button', 'aria-label': STRC.armoury, title: STRC.armoury }, icon('armoury'), h('span', STRC.armoury));
  const setBtn = h('button.gs-hud-btn.is-round', { type: 'button', 'aria-label': STRC.settings, title: STRC.settings }, icon('gear'));
  const backBtn = h('button.gs-hud-btn.gs-hud-back', { type: 'button', hidden: true }, icon('back'), h('span', STRC.back));
  const titleEl = h('div.gs-hud-title');
  const root = h('div.gs-hud.lf-hud.is-hidden', { 'data-no-advance': '' },
    h('div.gs-hud-left', partyEl, lvEl), titleEl, h('div.gs-hud-right', goldEl, shardEl, armBtn, setBtn), backBtn);
  layer.appendChild(root);

  let opening = false, locked = false, backFn = null;
  const open = async (fn) => {
    if (opening || locked) return;
    opening = true;
    try { await fn(); } catch (e) { console.error('[gs-hud]', e); } finally { opening = false; refresh(); }
  };
  tap(armBtn, () => open(() => ctx.screens.go('gs.armoury', {})), ctx, { sfx: 'ui.open' });
  tap(setBtn, () => open(() => ctx.screens.go('settings')), ctx, { sfx: 'ui.open' });
  tap(backBtn, () => { if (backFn && !locked) { const f = backFn; f(); } }, ctx, { sfx: 'ui.confirm' });

  const cards = new Map();
  function renderParty() {
    partyEl.replaceChildren();
    cards.clear();
    for (const hero of ctx.state.party) {
      const bar = h('div.gs-bar', h('i'), h('em'));
      const hp = h('span.gs-hud-hp');
      const card = h('div.gs-hud-hero', { dataset: { hero: hero.id }, style: { '--hc': heroColor(hero.arch) } },
        portrait(ctx, hero.arch, 'sm'),
        h('div.gs-hud-hero-info', h('span.gs-hud-name', firstName(hero)), bar, hp));
      cards.set(hero.id, { card, bar, hp });
      partyEl.appendChild(card);
    }
    updateParty();
  }
  function updateParty() {
    for (const hero of ctx.state.party) {
      const c = cards.get(hero.id);
      if (!c) { renderParty(); return; }
      const v = Math.max(0, Math.min(1, hero.hp / Math.max(1, hero.maxHp)));
      c.bar.style.setProperty('--v', v);
      c.bar.classList.toggle('is-low', v <= 0.3 && v > 0);
      c.hp.textContent = hero.hp > 0 ? `${hero.hp} / ${hero.maxHp}` : STRC.down;
      c.card.classList.toggle('is-down', hero.hp <= 0);
    }
  }
  function renderLevel() {
    const x = ctx.state.xpInfo?.() || { level: 1, pct: 0, into: 0, need: 1 };
    lvNum.textContent = String(ctx.state.level || 1);
    xpFill.style.setProperty('--v', x.pct);
    xpText.textContent = x.max ? 'MAX' : `${x.into} / ${x.need} ${STRC.xp}`;
  }
  function renderMoney(kind, delta) {
    goldVal.textContent = String(ctx.state.gold || 0);
    shardVal.textContent = String(ctx.state.shards || 0);
    if (delta && kind) pop(kind === 'gold' ? goldEl : shardEl);
  }
  function refresh() { renderParty(); renderLevel(); renderMoney(); }

  bus.on('party:changed', renderParty);
  bus.on('state:loaded', refresh);
  bus.on('state:reset', refresh);
  bus.on('party:hp', (d) => {
    updateParty();
    const c = cards.get(d?.id);
    if (c && d?.delta) pop(c.card, d.delta < 0 ? 'is-hurt' : 'is-healed');
  });
  bus.on('gold:changed', (d) => renderMoney('gold', d?.delta));
  bus.on('gs:shards', (d) => renderMoney('shards', d?.delta));
  bus.on('gs:xp', () => renderLevel());
  bus.on('state:changed', () => { updateParty(); renderLevel(); });

  let titleTimer = null;
  function sceneTitle(title, sub) {
    clearTimeout(titleTimer);
    if (!title) { titleEl.classList.remove('is-in'); return; }
    // replaceChildren() prints a null as the text "null": leave the subtitle out instead
    titleEl.replaceChildren(...[h('div.gs-hud-title-main', String(title)), sub != null && sub !== '' && String(sub) !== 'null' && String(sub) !== 'undefined' ? h('div.gs-hud-title-sub', String(sub)) : null].filter(Boolean));
    requestAnimationFrame(() => titleEl.classList.add('is-in'));
    titleTimer = setTimeout(() => titleEl.classList.remove('is-in'), 5200 / (window.__LF_SPEED || 1));
  }
  let suppressed = false;
  function show() { if (suppressed) return; root.classList.remove('is-hidden'); refresh(); }
  function suppress(v) { suppressed = !!v; if (suppressed) hide(); }
  function hide() { root.classList.add('is-hidden'); }
  function setBack(fn) { backFn = fn || null; backBtn.hidden = !backFn; }
  function setLocked(v) { locked = !!v; root.classList.toggle('is-locked', locked); }

  refresh();
  return { show, hide, refresh, sceneTitle, setBack, setLocked, suppress, el: root, isGs: true };
}
