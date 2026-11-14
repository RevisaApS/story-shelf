// The shop (SPEC 11): openShop(shopId, ctx) -> void
// Keeper and spoken greeting, stock as parchment item cards, the party purse, buy with a flourish,
// trinkets go straight to "who wears it?" (state.equip: one per hero, the old one returns to the bag),
// a spoken goodbye. Bought counts live in state.counters['shop.<shopId>.<itemId>'].
import { h, tap } from '../ui/dom.js';
import * as R from '../core/rules.js';
import { L } from '../core/i18n.js';
import { ensureCss, anim, voiceLine, itemEffect } from './sys-util.js';

// Danish genitive: Pip -> Pips, Glimt -> Glimts, but Kiks -> Kiks'
const daGen = (name) => `${name}${/[sxz]$/i.test(name) ? '’' : 's'}`;

const STR = L({
  en: {
    purse: 'Your purse',
    bag: 'Bag',
    buy: 'Buy',
    need: (n) => `Need ${n} more`,
    soldOut: 'Sold out',
    left: (n) => `${n} left`,
    leave: 'Say goodbye',
    kind: { consumable: 'Use once', trinket: 'Trinket', quest: 'Treasure' },
    short: [
      'Ah, a few coins short there. Keep it in mind for later!',
      'Not quite enough coins, friend. No shame in that.',
      'Save up a little, and it will still be here.',
    ],
    thanks: ['Lovely choice!', 'A fine pick!', 'Good as gold!', 'Treat it well!'],
    wearsTitle: 'Who wears it?',
    wearsSub: 'One trinket per hero. A swapped trinket goes back in the bag.',
    keepBag: 'Keep it in the bag',
    wearing: 'Wearing',
    nothing: 'Nothing yet',
    back: (name) => `${name} goes back in the bag`,
    equipped: (hero, item) => `${hero} wears the ${item}`,
    shop: 'Shop',
    titles: { pip_cart: "Pip's Oddments", snaggle_stall: "Snaggle's Stall" },
    wares: (first) => `${first}'s Wares`,
    guard: (a, b) => `Guard ${a} → ${b}`,
    hearts: (a, b) => `Hearts ${a} → ${b}`,
    critOn: (n) => `20s on ${n}+`,
  },
  da: {
    purse: 'Jeres pung',
    bag: 'Taske',
    buy: 'Køb',
    need: (n) => `Mangler ${n}`,
    soldOut: 'Udsolgt',
    left: (n) => `${n} tilbage`,
    leave: 'Sig farvel',
    kind: { consumable: 'Brug én gang', trinket: 'Smykke', quest: 'Skat' },
    short: [
      'Åh, der mangler vist et par mønter. Husk den til senere!',
      'Ikke helt nok mønter, min ven. Det er ingen skam.',
      'Spar lidt sammen, så ligger den her endnu.',
    ],
    thanks: ['Dejligt valg!', 'Godt valgt!', 'Den er guld værd!', 'Pas godt på den!'],
    wearsTitle: 'Hvem skal have den på?',
    wearsSub: 'Ét smykke til hver helt. Et byttet smykke ryger tilbage i tasken.',
    keepBag: 'Gem den i tasken',
    wearing: 'Har på',
    nothing: 'Intet endnu',
    back: (name) => `${name} ryger tilbage i tasken`,
    equipped: (hero, item) => `${hero} tager ${item} på`,
    shop: 'Butik',
    titles: { pip_cart: 'Pips pudsigheder', snaggle_stall: 'Skævtands bod' },
    wares: (first) => `${daGen(first)} varer`,
    guard: (a, b) => `Værn ${a} → ${b}`,
    hearts: (a, b) => `Hjerter ${a} → ${b}`,
    critOn: (n) => `20 på ${n}+`,
  },
});

export async function openShop(shopId, ctx) {
  await ensureCss();
  const { state, content, ui, audio } = ctx;
  const shop = content.shops?.[shopId];
  if (!shop) { console.warn('[shop] unknown shop', shopId); return; }
  const keeper = content.npcs?.[shop.keeper] || { name: shop.keeper, title: '' };
  const bought = (item) => state.count(`shop.${shopId}.${item}`);
  const left = (s) => (s.qty == null ? Infinity : Math.max(0, s.qty - bought(s.item)));

  // ---------- build ----------
  const bubbleText = h('p');
  const bubble = h('div.lfs-shop-bubble', bubbleText);
  const keeperArt = (() => {
    const src = ctx.assets.char(shop.keeper);
    if (ctx.assets.has(src) === true) {
      const img = h('img.lfs-shop-cutout', { src, alt: keeper.name, draggable: 'false' });
      return h('div.lfs-shop-keeper.has-cutout', img);
    }
    const p = ui.portrait(shop.keeper, 'lg');
    p.classList.add('lfs-shop-portrait');
    return h('div.lfs-shop-keeper', p);
  })();
  const coinNum = h('b.lfs-purse-num', String(state.gold));
  const purse = h('div.lfs-purse', h('span.lfs-purse-coin', ui.icon('coin')), h('div', h('small', STR.purse), coinNum));
  const bagNum = h('b.lfs-bag-num', String(bagCount()));
  const bag = h('div.lfs-bag', h('span.lfs-bag-icon', bagSvg()), h('div', h('small', STR.bag), bagNum));
  const grid = h('div.lfs-shop-grid', { class: `n-${shop.stock.length > 6 ? 4 : 3}` });
  const leaveBtn = ui.button(STR.leave, { kind: 'gold', size: 'lg', onClick: () => finish() });
  const pickLayer = h('div.lfs-shop-pick');
  const root = h('div.lfs-shop', { 'data-no-advance': '' },
    h('div.lfs-shop-veil'),
    h('div.lfs-shop-left',
      keeperArt,
      h('div.lfs-shop-name', h('div.lf-nameplate', keeper.name), keeper.title ? h('div.lfs-shop-title', keeper.title) : null),
      bubble,
      leaveBtn),
    h('div.lfs-shop-right.lf-panel',
      h('div.lfs-shop-head', h('div', h('div.lf-kicker', keeper.title || STR.shop), h('h2.lf-title', shopTitle())), h('div.lfs-shop-wallet', purse, bag)),
      grid),
    pickLayer);

  const cards = new Map();
  for (const s of shop.stock) {
    const item = content.items?.[s.item] || { id: s.item, name: s.item, kind: 'consumable', text: '' };
    const priceEl = h('span.lfs-price', ui.icon('coin'), h('b', String(s.price)));
    const stockEl = h('span.lfs-left');
    const btn = h('button.lf-btn.lf-btn--gold.lfs-buy', { type: 'button' }, h('span', STR.buy));
    const card = h('div.lfs-card.lf-parch', { dataset: { item: s.item, kind: item.kind } },
      h('div.lfs-card-kind', STR.kind[item.kind] || ''),
      h('div.lfs-card-art', ui.itemImg(s.item, 104)),
      h('h3', item.name),
      h('div.lfs-card-effect', itemEffect(item)),
      h('p', flavour(item.text)),
      h('div.lfs-card-foot', priceEl, stockEl, btn),
      h('div.lfs-card-stamp', STR.soldOut));
    tap(btn, () => buy(s, card), null);
    btn.addEventListener('pointerdown', () => audio.sfx('ui.tap'));
    cards.set(s.item, { card, btn, stockEl, s, item });
    grid.appendChild(card);
  }

  ctx.stage.fx('blur');
  ctx.stage.layers.overlay.appendChild(root);
  audio.sfx('ui.open');
  refresh();
  await ctx.sleep(20);
  root.classList.add('is-in');
  [...grid.children].forEach((c, i) => setTimeout(() => c.classList.add('is-in'), (120 + i * 60) / (window.__LF_SPEED || 1)));

  let busy = false, done = false, leaveAsked = false, resolveDone;
  const finished = new Promise((r) => { resolveDone = r; });
  const onKey = (e) => { if (e.key === 'Escape' && !busy && !pickLayer.childElementCount) finish(); };
  window.addEventListener('keydown', onKey);

  // greeting
  const greet = say(ctx.rng.pick(shop.greeting || [''])).catch(() => {});

  if (ctx.auto) {
    (async () => {
      await greet;
      await ctx.sleep(500);
      const affordable = shop.stock.filter((s) => s.price <= state.gold && left(s) > 0 && content.items?.[s.item]?.kind !== 'quest');
      const pick = affordable.find((s) => s.item === 'honeycake') || affordable[0];
      if (pick && ctx.auto.rng.chance(0.75)) { await buy(pick, cards.get(pick.item).card); await ctx.sleep(400); }
      finish();
    })();
  }

  await finished;

  // ---------- helpers ----------
  function shopTitle() {
    const first = (keeper.name || '').split(' ').pop();
    return shopId === 'pip_cart' ? STR.titles.pip_cart : shopId === 'snaggle_stall' ? STR.titles.snaggle_stall : STR.wares(first);
  }

  function bagCount() { return Object.values(state.inventory).reduce((a, b) => a + b, 0); }

  function refresh() {
    coinNum.textContent = String(state.gold);
    bagNum.textContent = String(bagCount());
    for (const { card, btn, stockEl, s } of cards.values()) {
      const n = left(s);
      const short = s.price - state.gold;
      card.classList.toggle('is-sold', n <= 0);
      card.classList.toggle('is-short', n > 0 && short > 0);
      stockEl.textContent = n === Infinity || n <= 0 ? '' : (n <= 3 ? STR.left(n) : '');
      btn.replaceChildren(h('span', n <= 0 ? STR.soldOut : short > 0 ? STR.need(short) : STR.buy));
      btn.setAttribute('aria-disabled', n <= 0 ? 'true' : 'false');
    }
  }

  async function say(text, { voiced = true } = {}) {
    if (!text) return;
    bubbleText.textContent = text;
    bubble.classList.remove('is-in'); void bubble.offsetWidth; bubble.classList.add('is-in');
    keeperArt.classList.add('is-talking');
    if (voiced) await voiceLine(ctx, text, shop.keeper, 'warm');
    else await ctx.sleep(1400);
    keeperArt.classList.remove('is-talking');
  }

  async function buy(s, card) {
    if (busy || done) return;
    if (left(s) <= 0) return;
    if (state.gold < s.price) {
      audio.sfx('ui.deny');
      anim(card, [{ transform: 'translateX(0)' }, { transform: 'translateX(-7px) rotate(-0.6deg)' }, { transform: 'translateX(6px) rotate(0.5deg)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }], 460, { fill: 'none' });
      anim(purse, [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], 420, { fill: 'none' });
      say(ctx.rng.pick(STR.short), { voiced: false });
      return;
    }
    busy = true;
    root.classList.add('is-busy');
    const item = content.items?.[s.item];
    // coins fly from the purse to the card
    const pr = rel(purse.querySelector('.lfs-purse-coin')), cr = rel(card.querySelector('.lfs-price'));
    for (let i = 0; i < Math.min(5, s.price); i++) {
      const c = h('span.lfs-flycoin', ui.icon('coin'));
      root.appendChild(c);
      anim(c, [
        { transform: `translate(${pr.x}px, ${pr.y}px) scale(0.9)`, opacity: 0 },
        { opacity: 1, offset: 0.15 },
        { transform: `translate(${(pr.x + cr.x) / 2}px, ${Math.max(40, Math.min(pr.y, cr.y) - 70)}px) scale(1.15)`, offset: 0.55 },
        { transform: `translate(${cr.x}px, ${cr.y}px) scale(0.6)`, opacity: 0.2 },
      ], 620, { delay: i * 70 / (window.__LF_SPEED || 1), easing: 'cubic-bezier(0.4, 0, 0.2, 1)' });
      setTimeout(() => c.remove(), (720 + i * 70) / (window.__LF_SPEED || 1));
      setTimeout(() => audio.sfx('coin', { rate: 0.95 + i * 0.05, volume: 0.6 }), i * 70 / (window.__LF_SPEED || 1));
    }
    state.addGold(-s.price);
    state.addCounter(`shop.${shopId}.${s.item}`, 1);
    refresh();
    anim(coinNum, [{ transform: 'scale(1.35)', color: '#ffe7a3' }, { transform: 'scale(1)' }], 500, { fill: 'none' });
    await ctx.sleep(560);
    // the card blooms and the item flies to the bag
    card.classList.add('is-bought');
    audio.sfx('item.get');
    const art = card.querySelector('.lfs-card-art');
    const ar = rel(art), br = rel(bag.querySelector('.lfs-bag-icon'));
    const fly = h('div.lfs-flyitem', ui.itemImg(s.item, 104));
    root.appendChild(fly);
    anim(fly, [
      { transform: `translate(${ar.x - 52}px, ${ar.y - 52}px) scale(1)`, opacity: 1 },
      { transform: `translate(${ar.x - 52}px, ${ar.y - 90}px) scale(1.25)`, opacity: 1, offset: 0.3 },
      { transform: `translate(${br.x - 52}px, ${br.y - 52}px) scale(0.3)`, opacity: 0.4 },
    ], 760, { easing: 'cubic-bezier(0.65, 0, 0.35, 1)' });
    setTimeout(() => fly.remove(), 800 / (window.__LF_SPEED || 1));
    state.give(s.item, 1);
    await ctx.sleep(720);
    refresh();
    anim(bag, [{ transform: 'scale(1)' }, { transform: 'scale(1.18) rotate(-4deg)' }, { transform: 'scale(1)' }], 420, { fill: 'none' });
    card.classList.remove('is-bought');
    if (item?.kind === 'trinket') await whoWears(s.item);
    else say(ctx.rng.pick(STR.thanks), { voiced: false });
    root.classList.remove('is-busy');
    busy = false;
    if (leaveAsked) finish();   // "Say goodbye" was tapped while the purchase played out
  }

  function rel(el) {
    const r = el.getBoundingClientRect(), base = ctx.stage.el.getBoundingClientRect();
    const k = 1280 / base.width;
    return { x: (r.left + r.width / 2 - base.left) * k, y: (r.top + r.height / 2 - base.top) * k };
  }

  function whoWears(itemId) {
    const item = content.items[itemId];
    return new Promise((resolve) => {
      let picked = false;
      const opts = state.party.map((hero) => {
        const cur = hero.trinket ? content.items?.[hero.trinket] : null;
        const preview = previewChange(hero, item);
        const el = h('button.lfs-wear', { type: 'button', dataset: { hero: hero.id } },
          ui.portrait(hero.id, 'md'),
          h('b', hero.name.split(' ')[0]),
          h('div.lfs-wear-now', h('small', STR.wearing), cur ? h('span', ui.itemImg(hero.trinket, 30), cur.name) : h('span.is-none', STR.nothing)),
          preview ? h('div.lfs-wear-gain', preview) : null);
        tap(el, () => choose(hero.id), ctx);
        return el;
      });
      const keep = ui.button(STR.keepBag, { kind: 'ghost', onClick: () => choose(null) });
      const panel = h('div.lfs-pick-panel.lf-panel',
        h('div.lfs-pick-item', ui.itemImg(itemId, 120)),
        h('div.lf-kicker', item.name),
        h('h2.lf-title', STR.wearsTitle),
        h('p.lfs-pick-sub', STR.wearsSub),
        h('div.lfs-pick-row', opts),
        h('div.lfs-pick-foot', keep));
      pickLayer.replaceChildren(panel);
      requestAnimationFrame(() => pickLayer.classList.add('is-in'));
      audio.sfx('ui.open');
      if (ctx.auto) ctx.sleep(600).then(() => choose(state.party.find((x) => !x.trinket)?.id || state.party[0]?.id || null));

      async function choose(heroId) {
        if (picked) return; picked = true;
        if (heroId) {
          const hero = state.hero(heroId);
          const old = hero.trinket ? content.items?.[hero.trinket] : null;
          const el = opts.find((o) => o.dataset.hero === heroId);
          el?.classList.add('is-sel');
          state.equip(heroId, itemId);
          audio.sfx('ui.confirm');
          audio.sfx('levelup', { volume: 0.5 });
          ui.toast(STR.equipped(hero.name.split(' ')[0], item.name), { icon: itemId, kind: 'item', sub: old ? STR.back(old.name) : itemEffect(item) });
          await ctx.sleep(520);
        }
        pickLayer.classList.remove('is-in');
        await ctx.sleep(320);
        pickLayer.replaceChildren();
        refresh();
        resolve();
      }
    });
  }

  function previewChange(hero, item) {
    const p = item.passive || {};
    const after = { ...hero, trinket: item.id, trinketPassive: p };
    if (p.stat) {
      const k = Object.keys(p.stat)[0];
      return `${R.STAT_NAMES[k]} ${R.statValue(hero, k)} → ${R.statValue(after, k)}`;
    }
    if (p.guard) return STR.guard(R.guard(hero), R.guard(after));
    if (p.maxHp) return STR.hearts(R.maxHp(hero), R.maxHp(after));
    if (p.critOn) return STR.critOn(p.critOn);
    return null;
  }

  // The first tap always counts: during a purchase it is remembered and runs when the purchase is done;
  // the button answers at once (pressed and dimmed) while the keeper says goodbye.
  async function finish() {
    if (done) return;
    leaveBtn.classList.add('is-leaving');
    leaveBtn.setAttribute('aria-disabled', 'true');
    if (busy) { leaveAsked = true; return; }
    done = true;
    window.removeEventListener('keydown', onKey);
    root.classList.add('is-busy', 'is-leaving');
    audio.sfx('ui.close');
    // the goodbye starts at once; the shop closes after its first words and the voice plays on over the scene
    await Promise.race([say(ctx.rng.pick(shop.bye || [''])), ctx.sleep(2400)]);
    root.classList.remove('is-in');
    root.classList.add('is-out');
    ctx.stage.fx('unblur');
    await ctx.sleep(460);
    root.remove();
    resolveDone();
  }
}

// the card already states the effect, so keep only the flavour sentences
function flavour(text = '') {
  const parts = String(text).match(/[^.!?]+[.!?]+/g) || [text];
  const keep = parts.filter((p) => !/\d|battle only|natural|blinds|heals|stun|kun i kamp|blænder|helbreder|lammer/i.test(p)).join(' ').trim();
  return keep || text;
}

function bagSvg() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 48 48');
  s.innerHTML = '<defs><linearGradient id="lfsBag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c98f52"/><stop offset="1" stop-color="#6b3f1d"/></linearGradient></defs>'
    + '<path d="M17 13c-2-4 1-7 7-7s9 3 7 7" fill="none" stroke="#f7c95c" stroke-width="2.2" stroke-linecap="round"/>'
    + '<path d="M14 14h20c5 6 8 13 7 20-1 6-6 9-17 9S8 40 7 34c-1-7 2-14 7-20z" fill="url(#lfsBag)" stroke="#3a2412" stroke-width="1.4"/>'
    + '<path d="M13 16h22" stroke="#f7c95c" stroke-width="2.4" stroke-linecap="round"/><circle cx="24" cy="29" r="4" fill="#f7c95c" opacity=".85"/>';
  return s;
}
