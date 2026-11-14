/* ctx.ui — the Lanternfall UI kit (SPEC 10). Public API (stable after FOUNDATION_READY; it may grow):
 *
 *   ui.h(tag, attrs, ...kids)                          DOM builder (see dom.js). 'div.a.b#id' shorthand.
 *   ui.icon(name) -> <svg>                             star coin book gear heart shield talent chevron close dice check spark lock map
 *                                                      talk gift gem drop wing
 *   ui.button(label, { kind:'primary'|'gold'|'ghost'|'danger', size:'lg', icon, onClick, sfx }) -> <button.lf-btn>
 *   ui.modal({ kicker?, title, body (string|Node|Node[]), buttons:[{ id, label, kind?, auto? }], wide?, onOpen?(el, close) })
 *       -> Promise<buttonId>. Autoplay picks the button marked auto:true, else the first.
 *       onOpen gets close(id) so custom bodies can resolve the modal themselves.
 *   ui.toast(text, { icon?: 'star'|'coin'|itemId|url|Node, kind?: 'star'|'item'|'quest'|'hurt'|'info', sub?, ms? })
 *   ui.banner(text, { kind:'success'|'fail'|'partial'|'crit'|'fumble'|'quest'|'chapter', sub?, hold?, top? }) -> Promise
 *   ui.chapterCard({ kicker, title, sub? }) -> Promise   full-stage title card, holds then fades
 *   ui.itemCard(itemId, { kicker? }) -> Promise          parchment card, resolves when tapped (autoplay: quick)
 *   ui.portrait(heroOrNpcId, size='md'|'sm'|'lg', { mood? }) -> <div.lf-portrait>   hero arch, npc id, or 'gm'
 *   ui.statChip(stat, value?) -> <span.lf-chip.lf-stat>
 *   ui.heroPicker({ title, sub?, stat?, talent?, filter?(hero)->bool, showBonus=true }) -> Promise<heroId>
 *       one eligible hero resolves at once. Shows each hero's bonus, the talent badge, the spotlight mark.
 *   ui.itemImg(itemId, size=64) -> element (img with styled placeholder)
 *   ui.heroColor(arch) -> css colour
 */
import { h, tap, wait, clear } from './dom.js';
import * as R from '../core/rules.js';
import { L } from '../core/i18n.js';

const STR = L({
  en: { cont: 'Continue', found: 'You found', keep: 'Keep it', who: 'Who will try?', spot: 'Your turn to shine', talent: 'Talent', quill: 'Old Quill' },
  da: { cont: 'Fortsæt', found: 'Du fandt', keep: 'Behold den', who: 'Hvem prøver?', spot: 'Din tur til at skinne', talent: 'Talent', quill: 'Gamle Fjer' },
});

const ICONS = {
  star: '<path d="M12 2.2l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.1l-5.9 3.2 1.3-6.6L2.5 9.1l6.6-.8z" fill="url(#gS)" stroke="#5e3f10" stroke-width=".8"/>',
  coin: '<circle cx="12" cy="12" r="9.5" fill="url(#gS)" stroke="#5e3f10" stroke-width=".9"/><circle cx="12" cy="12" r="6.6" fill="none" stroke="#9a6a1c" stroke-width="1"/><path d="M12 8.2l1.1 2.4 2.6.3-1.9 1.8.5 2.6-2.3-1.3-2.3 1.3.5-2.6-1.9-1.8 2.6-.3z" fill="#9a6a1c"/>',
  book: '<path d="M3 5.5C5.5 4.3 8.5 4.3 11.4 6v13c-2.9-1.7-5.9-1.7-8.4-.5zM21 5.5c-2.5-1.2-5.5-1.2-8.4.5v13c2.9-1.7 5.9-1.7 8.4-.5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  gear: '<circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3L5.5 5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="12" r="6.6" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  heart: '<path d="M12 20.5S3 14.8 3 8.9C3 6.2 5.1 4.2 7.6 4.2c1.8 0 3.4 1 4.4 2.5 1-1.5 2.6-2.5 4.4-2.5 2.5 0 4.6 2 4.6 4.7 0 5.9-9 11.6-9 11.6z" fill="#ff6f86" stroke="#7a1f33" stroke-width=".8"/>',
  shield: '<path d="M12 2.5l8 3v6c0 5-3.4 8.7-8 10-4.6-1.3-8-5-8-10v-6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  talent: '<path d="M12 2l2.2 6.8H21l-5.5 4 2.1 6.7L12 15.4l-5.6 4.1 2.1-6.7-5.5-4h6.8z" fill="currentColor"/>',
  chevron: '<path d="M6 9l6 6 6-6" fill="none" stroke="#f7c95c" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  close: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  dice: '<path d="M12 2l8.7 5v10L12 22l-8.7-5V7z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 2L7.5 14.5h9zM3.3 7l4.2 7.5M20.7 7l-4.2 7.5M7.5 14.5L12 22l4.5-7.5" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  spark: '<path d="M12 2l1.8 7.2L21 12l-7.2 1.8L12 21l-1.8-7.2L3 12l7.2-2.8z" fill="#a9d4ff" stroke="#3d6aa8" stroke-width=".6"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 10.5V8a4 4 0 018 0v2.5" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  talk: '<path d="M4 5.5h16v10H10l-4.5 3.8V15.5H4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="8.5" cy="10.5" r="1.1" fill="currentColor"/><circle cx="12" cy="10.5" r="1.1" fill="currentColor"/><circle cx="15.5" cy="10.5" r="1.1" fill="currentColor"/>',
  gift: '<rect x="4" y="10" width="16" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 7.5h18V10H3zM12 7.5V20M12 7.5c-1-3-5-4-5-1.5 0 1.5 3 1.5 5 1.5zm0 0c1-3 5-4 5-1.5 0 1.5-3 1.5-5 1.5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  gem: '<path d="M6 4h12l3.5 5L12 21 2.5 9z M2.5 9h19 M9 4l-1.5 5L12 21l4.5-12L15 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  drop: '<path d="M12 3c3.5 5 6 8.2 6 11.2A6 6 0 016 14.2C6 11.2 8.5 8 12 3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9.2 14.5a2.8 2.8 0 002.8 2.8" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/>',
  wing: '<path d="M12 9c-2-3-6-4.5-9.5-3.5C4 8 5 11 8 12.5c-2 .5-3 2-3 3.5 3 0 5.5-1.5 7-4 1.5 2.5 4 4 7 4 0-1.5-1-3-3-3.5 3-1.5 4-4.5 5.5-7C18 4.5 14 6 12 9z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  map: '<path d="M3 6l6-2.5 6 2.5 6-2.5v14.5L15 20.5 9 18l-6 2.5z M9 3.5V18M15 6v14.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
};
const DEFS = '<defs><linearGradient id="gS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1c4"/><stop offset=".45" stop-color="#f7c95c"/><stop offset="1" stop-color="#c58a2a"/></linearGradient></defs>';

const HERO_COLORS = { knight: '#c8463a', wizard: '#3b5fc4', ranger: '#3f8a4a', trickster: '#c78a2a', bard: '#8a4fc0', mender: '#5c8a3a', gm: '#3a3466' };

export function createUI(ctx) {
  const L = () => ctx.stage.layers;
  const auto = () => ctx.auto;

  const icon = (name) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    s.classList.add('lf-icon', `lf-icon-${name}`);
    s.innerHTML = DEFS + (ICONS[name] || ICONS.star);
    return s;
  };

  const button = (label, { kind, size, icon: ic, onClick, sfx = 'ui.tap', cls = '', attrs = {} } = {}) => {
    const b = h('button.lf-btn', { type: 'button', class: [kind ? `lf-btn--${kind}` : '', size ? `lf-btn--${size}` : '', cls].filter(Boolean).join(' ') || null, ...attrs },
      ic ? icon(ic) : null, label != null ? h('span', label) : null);
    tap(b, (e) => onClick && onClick(e), ctx, { sfx });
    return b;
  };

  const heroColor = (id) => HERO_COLORS[id] || '#4a3d6e';

  // Portrait ids: a hero (any id the state knows), an npc id, or 'gm'. A pack may set gmArt (the portrait for 'gm')
  // and a pack whose art carries a prefix (Grimspire: gs_) gets it added when the plain id has no portrait.
  const portrait = (id, size = 'md', { mood } = {}) => {
    const hero = ctx.state?.hero?.(id) || null;
    const npc = ctx.content?.npcs?.[id];
    const gmArt = ctx.pack?.gmArt || 'gm';
    let pid = id === 'gm' ? gmArt : id;
    if (id === 'gm' && gmArt === 'gm' && mood) {
      if (['excited', 'funny'].includes(mood)) pid = 'gm_delighted';
      else if (['hush', 'ominous'].includes(mood)) pid = 'gm_hush';
      if (pid !== 'gm' && ctx.assets.has(ctx.assets.portrait(pid)) === false) pid = 'gm';
    }
    const pre = ctx.pack?.artPrefix || (ctx.pack?.theme === 'gs' ? 'gs_' : '');
    if (pre && id !== 'gm' && !pid.startsWith(pre) && ctx.assets.has(ctx.assets.portrait(pid)) !== true) pid = pre + pid;
    const name = hero?.name || npc?.name || (id === 'gm' ? (ctx.content?.npcs?.gm?.name || STR.quill) : id.replace(/_/g, ' '));
    const inner = h('div.lf-portrait-in', { style: { '--pc': heroColor(id) } });
    const ph = () => {
      const initials = name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
      inner.replaceChildren(h('span.lf-portrait-ph', initials || '?'));
    };
    const src = ctx.assets.portrait(pid);
    if (ctx.assets.has(src) === false) ph();
    else { const img = h('img', { alt: name, draggable: 'false' }); img.onerror = ph; img.src = src; inner.appendChild(img); }
    return h('div.lf-portrait', { class: `lf-portrait--${size}`, dataset: { id }, title: name }, inner);
  };

  const itemImg = (itemId, size = 64) => {
    const item = ctx.content?.items?.[itemId];
    const wrap = h('span.lf-item-img', { style: { display: 'inline-flex', width: `${size}px`, height: `${size}px`, alignItems: 'center', justifyContent: 'center' } });
    const ph = () => wrap.replaceChildren(h('span.lf-item-ph', { style: { width: `${size * 0.8}px`, height: `${size * 0.8}px`, fontSize: `${size * 0.36}px` } }, (item?.name || itemId)[0].toUpperCase()));
    const src = ctx.assets.item(itemId);
    if (ctx.assets.has(src) === false) ph();
    else { const img = h('img', { alt: item?.name || itemId, style: { width: '100%', height: '100%', objectFit: 'contain' } }); img.onerror = ph; img.src = src; wrap.appendChild(img); }
    return wrap;
  };

  const statChip = (stat, value) => h('span.lf-chip.lf-stat', { dataset: { stat } },
    h('span', R.STAT_NAMES[stat] || stat), value != null ? h('b', (value >= 0 ? '+' : '') + value) : null);

  const modal = ({ kicker, title, body, buttons = [{ id: 'ok', label: STR.cont, kind: 'primary' }], wide = false, onOpen, cls = '' } = {}) => new Promise((resolve) => {
    let done = false;
    const wrap = h('div.lf-modal-wrap');
    const close = async (id) => {
      if (done) return; done = true;
      ctx.audio.sfx('ui.close');
      wrap.classList.remove('is-in');
      setTimeout(() => wrap.remove(), 340);
      resolve(id);
    };
    const btns = buttons.map((b) => button(b.label, { kind: b.kind, size: b.size, icon: b.icon, onClick: () => close(b.id), sfx: b.sfx || 'ui.confirm', attrs: { 'data-id': b.id } }));
    const bodyEl = h('div.lf-modal-body', typeof body === 'string' ? h('p', { style: 'margin:8px 0' }, body) : body);
    const box = h('div.lf-modal.lf-panel', { class: [wide ? 'is-wide' : '', cls].filter(Boolean).join(' ') || null },
      h('div.lf-modal-head', kicker ? h('div.lf-kicker', kicker) : null, title ? h('h2.lf-title', title) : null, title ? h('div.lf-divider') : null),
      bodyEl, btns.length ? h('div.lf-modal-btns', btns) : null);
    wrap.appendChild(box);
    L().overlay.appendChild(wrap);
    ctx.audio.sfx('ui.open');
    requestAnimationFrame(() => wrap.classList.add('is-in'));
    if (onOpen) { try { onOpen(box, close); } catch (e) { console.error(e); } }
    const onKey = (e) => { if (done) { window.removeEventListener('keydown', onKey); return; } if ((e.key === 'Enter') && btns.length === 1) { e.preventDefault(); close(buttons[0].id); } };
    window.addEventListener('keydown', onKey);
    if (auto() && buttons.length) {
      ctx.sleep(500).then(() => { const b = buttons.find((x) => x.auto) || buttons[0]; close(b.id); });
    }
  });

  const toast = (text, { icon: ic, kind = 'info', sub, ms = 2600 } = {}) => {
    let iconEl = null;
    if (ic instanceof Node) iconEl = ic;
    else if (ic && ICONS[ic]) iconEl = icon(ic);
    else if (ic && ctx.content?.items?.[ic]) iconEl = itemImg(ic, 34);
    else if (typeof ic === 'string' && /\//.test(ic)) iconEl = h('img', { src: ic, alt: '' });
    const t = h('div.lf-toast', { class: `kind-${kind}` }, iconEl ? h('span.lf-toast-icon', iconEl) : null, h('div', text, sub ? h('small', sub) : null));
    L().toast.appendChild(t);
    while (L().toast.children.length > 3) L().toast.firstChild.remove();
    requestAnimationFrame(() => t.classList.add('is-in'));
    ctx.sleep(ms).then(() => { t.classList.add('is-out'); setTimeout(() => t.remove(), 500); });
    return t;
  };

  const banner = async (text, { kind = 'success', sub, hold = 1500, top } = {}) => {
    const b = h('div.lf-banner', { class: `kind-${kind}`, style: top != null ? { top: `${top}px` } : null }, h('div.lf-banner-rays'),
      h('div.lf-banner-ribbon', h('div.lf-banner-text', text)), sub ? h('div.lf-banner-sub', sub) : null);
    L().fx.appendChild(b);
    await wait(20);
    b.classList.add('is-in');
    await ctx.sleep(hold + 500);
    b.classList.add('is-out');
    setTimeout(() => b.remove(), 450);
    await ctx.sleep(250);
  };

  const chapterCard = async ({ kicker, title, sub }) => {
    const c = h('div.lf-chapter', kicker ? h('div.lf-kicker', kicker) : null, h('h1.lf-title', title), h('div.lf-divider'), sub ? h('div.lf-sub', sub) : null);
    L().fx.appendChild(c);
    ctx.audio.sfx('chapter');
    await wait(20);
    c.classList.add('is-in');
    await ctx.sleep(3400);
    c.classList.remove('is-in');
    await ctx.sleep(900);
    c.remove();
  };

  const itemCard = (itemId, { kicker = STR.found } = {}) => new Promise((resolve) => {
    const item = ctx.content?.items?.[itemId] || { name: itemId.replace(/_/g, ' '), text: '' };
    const wrap = h('div.lf-itemcard-wrap');
    const art = h('div.lf-itemcard-art', itemImg(itemId, 170));
    let done = false;
    const close = () => { if (done) return; done = true; ctx.audio.sfx('ui.close'); wrap.classList.remove('is-in'); setTimeout(() => wrap.remove(), 320); resolve(); };
    const card = h('div.lf-itemcard.lf-parch', h('div.lf-kicker', kicker), art, h('h3', item.name), item.text ? h('p', item.text) : h('p', ''),
      button(STR.keep, { kind: 'gold', onClick: close, sfx: 'ui.confirm' }));
    wrap.appendChild(card);
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    L().overlay.appendChild(wrap);
    ctx.audio.sfx('item.get');
    requestAnimationFrame(() => wrap.classList.add('is-in'));
    if (auto()) ctx.sleep(700).then(close);
  });

  const heroPicker = ({ title = STR.who, sub, stat, talent, filter, showBonus = true } = {}) => {
    const heroes = (ctx.state.party || []).filter((x) => x.hp > 0 || !filter).filter((x) => (filter ? filter(x) : true));
    const list = heroes.length ? heroes : ctx.state.party;
    if (list.length <= 1) return Promise.resolve(list[0]?.id);
    const spot = ctx.gm?.director?.spotlight?.(list) || null;
    return new Promise((resolve) => {
      let done = false;
      const opts = list.map((hero) => {
        const b = R.checkBonus(hero, { stat, talent });
        const el = h('button.lf-heropick-opt', { type: 'button', dataset: { hero: hero.id } },
          spot === hero.id ? h('span.lf-spot-mark', icon('talent'), STR.spot) : null,
          portrait(hero.id, 'md'),
          h('span.lf-heropick-name', hero.name.split(' ')[0]),
          showBonus && stat ? h('span.lf-heropick-bonus', (b.total >= 0 ? '+' : '') + b.total) : null,
          b.talent ? h('span.lf-chip', { style: 'height:24px;font-size:12px;color:var(--gold-1)' }, icon('talent'), R.TALENT_NAMES[hero.talent] || STR.talent) : null);
        tap(el, () => { if (done) return; done = true; el.classList.add('is-sel'); ctx.audio.sfx('ui.confirm'); setTimeout(() => close(hero.id), 220); }, ctx);
        return el;
      });
      let closeFn;
      modal({ title, kicker: stat ? R.STAT_NAMES[stat] : null, body: [sub ? h('p.lf-sub', { style: 'margin:0 0 8px' }, sub) : null, h('div.lf-heropick', opts)], buttons: [],
        onOpen: (_box, close) => { closeFn = close; } }).then(resolve);
      const close = (id) => closeFn(id);
      if (auto()) ctx.sleep(400).then(() => { if (done) return; done = true; close(ctx.auto.pickHero(list, { stat, talent, spot })); });
    });
  };

  return { h, icon, button, modal, toast, banner, chapterCard, itemCard, portrait, statChip, heroPicker, itemImg, heroColor, clear };
}
