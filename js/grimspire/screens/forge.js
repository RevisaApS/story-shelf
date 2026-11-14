// gs.forge [gs-gear]: openForge({ shop? }, ctx) -> void
// Hilda Emberhand's Forge at the Last Hearth: Buy (potions, bombs and a few items for the highest floor reached),
// Sell (a third of the price; rare or better asks first), Upgrade (plus 0 to 3 for gold and Bone Shards, hammer
// sparks, the numbers rising). With { shop: id } it is that keeper's stall instead (content.shops[id]: keeper,
// greeting, stock, bye): Buy and Sell only. Hilda speaks the forge.* pools as ('gs_hilda', 'warm'); a shop keeper
// speaks greeting / bye as (keeper, 'funny'). Autoplay: buys draughts while the bag holds fewer than three, upgrades
// the first weapon it can afford, leaves.
import { h, tap } from '../../ui/dom.js';
import { L } from '../../core/i18n.js';
import { pickItem, RARITY_COLOR, RARITY_RANK } from '../loot.js';
import {
  loadGear, itemCard, itemTile, itemIcon, compareBlock, bestHeroFor, gearDelta, heroPortrait, heroesOf, slotOf, SLOTS,
  itemStatLines, rarityName, coinSvg, shardSvg, pickLine, speak, bubbleEl, familyOf, arrowSvg,
  fill,
} from './itemcard.js';
import { anim, stagePos, gearButton, fxCanvas, heroPortraitLike } from './lootreveal.js';
import { bgImg } from './armoury.js';

export const MAX_PLUS = 3;
// cost of the next plus: gold 15% of the price per step (at least 10), shards 1-4 per step by rarity
export function upgradeCost(item, plus = 0) {
  const step = plus + 1;
  const rank = (RARITY_RANK[item?.rarity] ?? 0) + 1;
  return { gold: Math.max(10, Math.round((item?.price || 60) * 0.15 * step)), shards: step * rank };
}
export const sellPrice = (item) => Math.max(1, Math.floor((item?.price || 0) / 3));

const STR = L({
  en: {
    title: 'The Forge', shopTitle: 'Stall', tabs: { buy: 'Buy', sell: 'Sell', upgrade: 'Upgrade' }, leave: 'Leave',
    buy: 'Buy', need: (n) => `Need ${n} more`, sold: 'Sold', sellFor: (n) => `Sell for ${n}`, nothingSell: 'Nothing to sell. Equipped gear stays on.',
    confirmTitle: 'Sell it?', confirmText: (name, n) => `${name} for ${n} gold. Once it is sold, it is gone.`, yes: 'Sell it', no: 'Keep it',
    upgrade: 'Strike the anvil', maxed: 'Fully forged', pickUp: 'Pick a piece of gear to make it stronger', pickSell: 'Pick something to sell',
    short: 'Not enough', gold: 'gold', shards: 'Bone Shards', worn: (n) => `${n} wears it`, inBag: 'In the bag', forFloor: (n) => `New for floor ${n}`,
    supplies: 'Potions and bombs', bought: (name) => `${name} is in the bag`, upgraded: (name, p) => `${name} is now +${p}`,
    equipQ: 'Who wears it?', equipOn: (n) => `Equip on ${n}`, toBag: 'To the bag', have: (n) => `You have ${n}`,
  },
  da: {
    title: 'Smedjen', shopTitle: 'Bod', tabs: { buy: 'Køb', sell: 'Sælg', upgrade: 'Forbedr' }, leave: 'Gå',
    buy: 'Køb', need: (n) => `Mangler ${n}`, sold: 'Solgt', sellFor: (n) => `Sælg for ${n}`, nothingSell: 'Intet at sælge. Udstyr, der er taget på, bliver på.',
    confirmTitle: 'Sælge den?', confirmText: (name, n) => `${name} for ${n} guld. Når den er solgt, er den væk.`, yes: 'Sælg den', no: 'Behold den',
    upgrade: 'Slå på ambolten', maxed: 'Færdigsmedet', pickUp: 'Vælg noget udstyr for at gøre det stærkere', pickSell: 'Vælg noget at sælge',
    short: 'Ikke nok', gold: 'guld', shards: 'Benskår', worn: (n) => `${n} bærer den`, inBag: 'I tasken', forFloor: (n) => `Nyt til etage ${n}`,
    supplies: 'Drikke og bomber', bought: (name) => `${name} er i tasken`, upgraded: (name, p) => `${name} er nu +${p}`,
    equipQ: 'Hvem skal bære den?', equipOn: (n) => `Giv den til ${n}`, toBag: 'I tasken', have: (n) => `Du har ${n}`,
  },
});

const firstName = (x) => String(x?.name || '').split(' ')[0];
function seeded(seed) {
  let a = (Number(seed) >>> 0) || 0x9e3779b9;
  const float = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { float, int: (x, y) => x + Math.floor(float() * (y - x + 1)), chance: (p) => float() < p, pick: (arr) => arr[Math.floor(float() * arr.length)] };
}
const topFloor = (s) => { let f = 1; for (let i = 1; i <= 5; i++) if (s?.floors?.[i]?.unlocked) f = i; return f; };

export async function openForge(params = {}, ctx) {
  await loadGear(ctx);
  const s = ctx.state, content = ctx.content, items = content.items || {};
  const sfx = (n, o) => { try { ctx.audio?.sfx?.(n, o); } catch { /* ignore */ } };
  const shop = params.shop ? content.shops?.[params.shop] : null;
  const keeperId = shop?.keeper || 'gs_hilda';
  const keeper = content.npcs?.[keeperId] || { name: keeperId === 'gs_hilda' ? 'Hilda Emberhand' : keeperId, title: '' };
  const mood = shop ? (keeperId === 'gs_sod' ? 'funny' : 'warm') : 'warm';
  const tabsList = shop ? ['buy', 'sell'] : ['buy', 'sell', 'upgrade'];
  let tab = params.tab && tabsList.includes(params.tab) ? params.tab : 'buy';
  let sel = null; // uid in sell / upgrade
  let busy = false, done = false;

  // ---------- stock ----------
  const floor = topFloor(s);
  function stock() {
    if (shop) return (shop.stock || []).filter((x) => items[x.item]).map((x) => ({ id: x.item, price: x.price ?? items[x.item].price, gear: !!slotOf(items[x.item]) }));
    const cons = Object.values(items).filter((it) => it.kind === 'consumable' && (it.floor || 1) <= floor + 1).sort((a, b) => a.price - b.price).map((it) => ({ id: it.id, price: it.price, gear: false }));
    // a few items for the highest floor reached, fixed for this save and floor, gone once bought
    const r = seeded((Number(s.seed) || 7) * 31 + floor * 977);
    const fams = heroesOf(ctx).map((x) => familyOf(ctx, x));
    const rar = floor <= 1 ? ['common', 'common', 'rare', 'common'] : floor <= 3 ? ['rare', 'common', 'rare', 'epic'] : ['epic', 'rare', 'epic', 'rare'];
    const gear = [];
    for (const rarity of rar) {
      const id = pickItem({ content, floor, rarity, rng: r, owned: gear, families: fams });
      if (id && !gear.includes(id)) gear.push(id);
    }
    const left = gear.filter((id) => !(s.count?.(`forge.bought.${id}`) > 0)).map((id) => ({ id, price: items[id].price, gear: true }));
    return [...left, ...cons];
  }

  // ---------- build ----------
  const bubble = bubbleEl('gsg-forge-bubble');
  const keeperArt = keeperEl(ctx, keeperId, keeper.name);
  const purse = h('div.gsg-purse');
  const tabsEl = h('div.gsg-tabs');
  const body = h('div.gsg-forge-body');
  const leaveBtn = gearButton(STR.leave, 'ghost', () => finish(), 'lg');
  const confirmLayer = h('div.gsg-confirm-layer');
  const root = h('div.gsg-root.gsg-forge', { class: shop ? 'is-shop' : null, 'data-no-advance': '' },
    h('div.gsg-arm-bg', bgImg(ctx, 'gs_camp')),
    h('div.gsg-forge-glow'),
    h('div.gsg-forge-left', keeperArt, h('div.gsg-forge-name', h('b', keeper.name), keeper.title ? h('small', keeper.title) : null), bubble),
    h('div.gsg-forge-right.gsg-panel',
      h('div.gsg-forge-head', h('div', h('div.gsg-kicker', keeper.title || ''), h('h2.gsg-title', shop ? keeper.name : STR.title)), purse),
      tabsEl, body),
    h('div.gsg-forge-leave', leaveBtn),
    confirmLayer);
  ctx.stage.layers.overlay.appendChild(root);
  const fx = fxCanvas(root, ctx);
  for (const t of tabsList) {
    const b = h('button.gsg-tab', { type: 'button', dataset: { tab: t } }, STR.tabs[t]);
    tap(b, () => { if (busy || tab === t) return; tab = t; sel = null; sfx('ui.page'); draw(); }, ctx);
    tabsEl.appendChild(b);
  }
  draw();
  await ctx.sleep(20);
  root.classList.add('is-in');
  sfx('ui.open');
  let resolveDone;
  const finished = new Promise((r) => { resolveDone = r; });
  const onKey = (e) => { if (e.key === 'Escape' && !busy) finish(); };
  window.addEventListener('keydown', onKey);
  const greet = say(shop ? pick(shop.greeting) : pickLine(ctx, 'forge.greet'));

  if (ctx.auto) {
    (async () => {
      await greet;
      for (let i = 0; i < 3; i++) {
        const nDraught = s.bag.filter((x) => x.id === 'gs_draught').length;
        const st = stock().find((x) => x.id === 'gs_draught') || stock().find((x) => !x.gear);
        if (!st || nDraught >= 3 || s.gold < st.price) break;
        await buy(st);
      }
      if (!shop) {
        const w = heroesOf(ctx).map((x) => x.gear?.weapon).find((inst) => inst && (inst.plus || 0) < MAX_PLUS && canAfford(upgradeCost(items[inst.id], inst.plus || 0)));
        if (w) { tab = 'upgrade'; sel = w.uid; draw(); await ctx.sleep(200); await doUpgrade(w); }
      }
      await ctx.sleep(200);
      finish();
    })();
  }
  await finished;
  return;

  // ================================================================================== draw
  function draw() {
    for (const b of tabsEl.children) b.classList.toggle('is-sel', b.dataset.tab === tab);
    fill(purse, h('span.gsg-purse-item', coinSvg(), h('b', String(s.gold || 0))), h('span.gsg-purse-item', shardSvg(), h('b', String(s.shards || 0))));
    body.dataset.tab = tab;
    if (tab === 'buy') drawBuy();
    else if (tab === 'sell') drawSell();
    else drawUpgrade();
  }

  function drawBuy() {
    const list = stock();
    const gear = list.filter((x) => x.gear), cons = list.filter((x) => !x.gear);
    const card = (st) => {
      const short = st.price - (s.gold || 0);
      const have = s.bag.filter((x) => x.id === st.id).length;
      const btn = gearButton(short > 0 ? STR.need(short) : STR.buy, short > 0 ? 'ghost' : 'ember', () => buy(st));
      if (short > 0) btn.setAttribute('aria-disabled', 'true');
      const extra = h('div.gsg-buy-foot', h('span.gsg-price', coinSvg(), h('b', String(st.price))), !st.gear && have ? h('small', STR.have(have)) : null, btn);
      const c = itemCard(ctx, st.id, { size: 'sm', extra });
      c.classList.add('gsg-buycard');
      c.dataset.id = st.id;
      if (st.gear) {
        const best = bestHeroFor(ctx, st.id);
        if (best) c.appendChild(h('span.gsg-buy-up', arrowSvg('up'), firstName(s.hero(best.heroId))));
      }
      return c;
    };
    fill(body, 
      gear.length ? h('div.gsg-shelf', h('h3.gsg-h3', shop ? '' : STR.forFloor(floor)), h('div.gsg-buygrid', gear.map(card))) : null,
      cons.length ? h('div.gsg-shelf', h('h3.gsg-h3', STR.supplies), h('div.gsg-buygrid', cons.map(card))) : null);
  }

  function sellable() {
    return s.bag.filter((x) => { const it = items[x.id]; return it && (slotOf(it) || it.kind === 'consumable') && (it.price || 0) > 0; })
      .sort((a, b) => (RARITY_RANK[items[b.id].rarity] || 0) - (RARITY_RANK[items[a.id].rarity] || 0) || String(a.id).localeCompare(b.id));
  }
  function drawSell() {
    const list = sellable();
    if (!list.length) { fill(body, h('div.gsg-grid-empty', STR.nothingSell)); return; }
    if (sel && !list.find((x) => x.uid === sel)) sel = null;
    const grid = h('div.gsg-grid.is-sell', list.map((inst) => itemTile(ctx, inst, { selected: inst.uid === sel, onTap: () => { sel = inst.uid; drawSell(); } })));
    const inst = list.find((x) => x.uid === sel);
    let side;
    if (inst) {
      const price = sellPrice(items[inst.id]);
      side = h('div.gsg-sell-side', itemCard(ctx, inst, { size: 'sm' }), h('div.gsg-detail-btns', gearButton(STR.sellFor(price), 'ember', () => sell(inst), 'lg')));
    } else side = h('div.gsg-sell-side.is-empty', h('p', STR.pickSell));
    fill(body, h('div.gsg-split', h('div.gsg-grid-scroll', grid), side));
  }

  function upgradable() {
    const out = [];
    for (const x of heroesOf(ctx)) for (const slot of SLOTS) if (x.gear?.[slot]) out.push({ inst: x.gear[slot], hero: x });
    for (const inst of s.bag) if (slotOf(items[inst.id])) out.push({ inst, hero: null });
    return out;
  }
  function drawUpgrade() {
    const list = upgradable();
    if (!sel && list[0]) sel = list[0].inst.uid;
    const grid = h('div.gsg-grid.is-up', list.map(({ inst, hero }) => {
      const t = itemTile(ctx, inst, { selected: inst.uid === sel, onTap: () => { if (busy) return; sel = inst.uid; drawUpgrade(); } });
      if (hero) t.appendChild(h('span.gsg-tile-who', heroPortrait(ctx, hero, 26)));
      return t;
    }));
    const cur = list.find((x) => x.inst.uid === sel);
    fill(body, h('div.gsg-split.is-up', h('div.gsg-grid-scroll', grid), cur ? anvilView(cur) : h('div.gsg-sell-side.is-empty', h('p', STR.pickUp))));
  }

  function anvilView({ inst, hero }) {
    const it = items[inst.id];
    const p = inst.plus || 0;
    const maxed = p >= MAX_PLUS;
    const cost = upgradeCost(it, p);
    const now = itemStatLines(ctx, it, p), next = maxed ? now : itemStatLines(ctx, it, p + 1);
    const rows = now.map((l, i) => {
      const n = next[i];
      const changed = n && n.text !== l.text;
      return h('div.gsg-up-row', { dataset: { k: l.k, changed: changed ? '1' : '' } }, h('span', l.label || ''), h('b.gsg-up-a', l.text), changed ? [h('span.gsg-row-arrow', arrowSvg('up')), h('b.gsg-up-b', n.text)] : null);
    });
    const pips = h('div.gsg-pips', [1, 2, 3].map((i) => h('span.gsg-pip', { class: i <= p ? 'is-on' : null })));
    const okGold = (s.gold || 0) >= cost.gold, okSh = (s.shards || 0) >= cost.shards;
    const costEl = maxed ? h('div.gsg-up-cost.is-max', STR.maxed)
      : h('div.gsg-up-cost', h('span', { class: okGold ? null : 'is-short' }, coinSvg(), h('b', String(cost.gold))), h('span', { class: okSh ? null : 'is-short' }, shardSvg(), h('b', String(cost.shards))));
    const btn = gearButton(maxed ? STR.maxed : STR.upgrade, maxed || !(okGold && okSh) ? 'ghost' : 'ember', () => doUpgrade(inst), 'lg');
    if (maxed || !(okGold && okSh)) btn.setAttribute('aria-disabled', 'true');
    const anvilIcon = h('div.gsg-anvil-item', { style: { '--rc': RARITY_COLOR[it.rarity] } }, itemIcon(ctx, inst, 132), p ? h('span.gsg-plus.is-big', `+${p}`) : null);
    return h('div.gsg-anvil', { dataset: { rarity: it.rarity } },
      h('div.gsg-anvil-top', h('div', h('div.gsg-kicker', `${rarityName(it.rarity)} · ${hero ? STR.worn(firstName(hero)) : STR.inBag}`), h('h3.gsg-card-name', { style: { color: RARITY_COLOR[it.rarity] } }, it.name, p ? ` +${p}` : '')), pips),
      h('div.gsg-anvil-stage', anvilIcon, hammerSvg(), anvilSvg()),
      h('div.gsg-up-rows', rows),
      h('div.gsg-up-foot', costEl, btn));
  }

  // ================================================================================== actions
  function canAfford(c) { return (s.gold || 0) >= c.gold && (s.shards || 0) >= c.shards; }
  function pick(arr) { return Array.isArray(arr) && arr.length ? arr[Math.floor((ctx.rng?.float?.() ?? Math.random()) * arr.length)] : null; }
  function say(text) {
    if (!text) return Promise.resolve();
    keeperArt.classList.add('is-talking');
    return speak(ctx, text, { as: keeperId, mood, bubble }).finally(() => keeperArt.classList.remove('is-talking'));
  }
  function sayPool(key) { return say(shop ? null : pickLine(ctx, key)); }

  async function buy(st) {
    if (busy || done) return;
    if ((s.gold || 0) < st.price) {
      sfx('ui.deny');
      const c = body.querySelector(`[data-id="${st.id}"]`);
      if (c) anim(c, [{ transform: 'translateX(0)' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], 380, { fill: 'none' });
      sayPool('forge.short');
      return;
    }
    busy = true;
    const c = body.querySelector(`[data-id="${st.id}"]`);
    const from = c ? stagePos(ctx, c) : { x: 840, y: 400 };
    const to = stagePos(ctx, purse);
    flyCoins(to, from, Math.min(6, 2 + Math.floor(st.price / 60)));
    s.addGold(-st.price);
    if (st.gear) s.addCounter?.(`forge.bought.${st.id}`, 1);
    const inst = s.addItem(st.id);
    sfx('gs.coin');
    fx.burst(from.x, from.y, RARITY_COLOR[items[st.id].rarity || 'common'], 22, 0.7);
    await ctx.sleep(420);
    ctx.ui?.toast?.(STR.bought(items[st.id].name), { kind: 'item' });
    if (st.gear) { draw(); await askEquip(inst); }
    else if ((ctx.rng?.chance?.(0.5) ?? true)) sayPool('forge.buy');
    busy = false;
    draw();
  }

  function askEquip(inst) {
    const party = heroesOf(ctx);
    const best = bestHeroFor(ctx, inst);
    const eligible = party.filter((x) => gearDelta(ctx, x, inst).ok);
    if (!eligible.length) return Promise.resolve();
    if (ctx.auto) { if (best) s.equip(best.heroId, inst.uid); return Promise.resolve(); }
    return new Promise((resolve) => {
      let pickId = best?.heroId || eligible[0].id;
      const chips = h('div.gsg-decide-heroes'), cmp = h('div.gsg-decide-cmp');
      const eq = gearButton('', 'ember', () => end(pickId), 'lg');
      const panel = h('div.gsg-decide.is-small', { style: { '--rc': RARITY_COLOR[items[inst.id].rarity] } },
        h('div.gsg-decide-card', itemCard(ctx, inst, { size: 'md' })),
        h('div.gsg-decide-right', h('h2.gsg-title', STR.equipQ), chips, cmp, h('div.gsg-decide-btns', eq, gearButton(STR.toBag, 'ghost', () => end(null)))));
      const layer = h('div.gsg-decide-layer', panel);
      root.appendChild(layer);
      const drawC = () => {
        fill(chips, ...party.map((x) => {
          const d = gearDelta(ctx, x, inst);
          const mark = !d.ok ? 'no' : d.gain > 0.25 ? 'up' : d.gain < -0.25 ? 'down' : 'same';
          const chip = h('button.gsg-herochip', { type: 'button', class: [x.id === pickId ? 'is-sel' : '', !d.ok ? 'is-dim' : ''].filter(Boolean).join(' ') || null, dataset: { mark } },
            heroPortrait(ctx, x, 52), h('b', firstName(x)), mark === 'up' || mark === 'down' ? h('span.gsg-herochip-mark', { dataset: { mark } }, arrowSvg(mark)) : null);
          tap(chip, () => { if (!d.ok) return; pickId = x.id; drawC(); }, ctx);
          return chip;
        }));
        fill(cmp, compareBlock(ctx, pickId, inst));
        eq.querySelector('span').textContent = STR.equipOn(firstName(s.hero(pickId)));
      };
      drawC();
      requestAnimationFrame(() => layer.classList.add('is-in'));
      let fin = false;
      async function end(id) {
        if (fin) return; fin = true;
        if (id && s.equip(id, inst.uid)) sfx('gs.equip');
        layer.classList.remove('is-in');
        await ctx.sleep(280);
        layer.remove();
        resolve();
      }
    });
  }

  async function sell(inst) {
    if (busy) return;
    const it = items[inst.id];
    const price = sellPrice(it);
    if ((RARITY_RANK[it.rarity] || 0) >= 1 && !ctx.auto) {
      const ok = await confirm(it, price);
      if (!ok) return;
    }
    busy = true;
    const tile = body.querySelector(`[data-uid="${inst.uid}"]`);
    const from = tile ? stagePos(ctx, tile) : { x: 840, y: 400 };
    s.removeItem(inst.uid);
    s.addGold(price);
    flyCoins(from, stagePos(ctx, purse), Math.min(6, 2 + Math.floor(price / 30)));
    sfx('gs.coin');
    sel = null;
    await ctx.sleep(300);
    if ((ctx.rng?.chance?.(0.5) ?? true)) sayPool('forge.sell');
    busy = false;
    draw();
  }

  function confirm(it, price) {
    return new Promise((resolve) => {
      const box = h('div.gsg-confirm.gsg-panel', { style: { '--rc': RARITY_COLOR[it.rarity] } },
        itemIcon(ctx, it.id, 96),
        h('h3.gsg-title', STR.confirmTitle),
        h('p', STR.confirmText(it.name, price)),
        h('div.gsg-decide-btns', gearButton(STR.no, 'ember', () => end(false), 'lg'), gearButton(STR.yes, 'ghost', () => end(true), 'lg')));
      fill(confirmLayer, box);
      confirmLayer.classList.add('is-in');
      sfx('ui.open');
      function end(v) { confirmLayer.classList.remove('is-in'); setTimeout(() => confirmLayer.replaceChildren(), 250); resolve(v); }
    });
  }

  async function doUpgrade(inst) {
    if (busy) return;
    const it = items[inst.id];
    const p = inst.plus || 0;
    if (p >= MAX_PLUS) return;
    const cost = upgradeCost(it, p);
    if (!canAfford(cost)) { sfx('ui.deny'); sayPool('forge.short'); return; }
    busy = true;
    root.classList.add('is-forging');
    s.addGold(-cost.gold);
    s.addShards(-cost.shards);
    const stageEl = body.querySelector('.gsg-anvil-stage');
    const hammer = stageEl?.querySelector('.gsg-hammer');
    const target = body.querySelector('.gsg-anvil-item');
    for (let i = 0; i < 3; i++) {
      if (hammer) anim(hammer, [{ transform: 'rotate(-55deg)' }, { transform: 'rotate(-62deg)', offset: 0.55 }, { transform: 'rotate(8deg)', offset: 0.8 }, { transform: 'rotate(-10deg)' }], 420, { fill: 'none', easing: 'cubic-bezier(0.5, 0, 0.75, 0)' });
      await ctx.sleep(340);
      sfx('gs.forge', { rate: 0.95 + i * 0.06 });
      const pos = target ? stagePos(ctx, target) : { x: 900, y: 360 };
      fx.sparks(pos.x, pos.y + 40, i === 2 ? RARITY_COLOR[it.rarity] : '#ffb347', 28 + i * 10);
      if (target) anim(target, [{ transform: 'scale(1.12)', filter: 'brightness(2)' }, { transform: 'scale(1)', filter: 'brightness(1)' }], 260, { fill: 'none' });
      if (i === 2) ctx.stage.fx?.('shake');
      await ctx.sleep(180);
    }
    inst.plus = p + 1;
    const found = s.findItem?.(inst.uid);
    if (found && found.where !== 'bag') s.refreshHero?.(found.where);
    ctx.bus?.emit?.('gs:upgrade', { uid: inst.uid, plus: inst.plus });
    ctx.bus?.emit?.('state:changed', { evt: 'gs:upgrade' });
    ctx.bus?.emit?.('gs:bag', {});
    sfx('gs.levelup', { volume: 0.6 });
    draw();
    // the numbers rise
    for (const row of body.querySelectorAll('.gsg-up-row')) anim(row, [{ background: 'rgba(255,122,46,0.4)' }, { background: 'rgba(255,122,46,0)' }], 900, { fill: 'none' });
    const mark = body.querySelector('.gsg-anvil-item .gsg-plus');
    if (mark) anim(mark, [{ transform: 'scale(2.4)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], 500);
    const pos = target ? stagePos(ctx, body.querySelector('.gsg-anvil-item')) : { x: 900, y: 360 };
    fx.burst(pos.x, pos.y, RARITY_COLOR[it.rarity], 40, 1);
    root.classList.remove('is-forging');
    const varg = ctx.rng?.chance?.(0.4);
    const line = varg ? pickLine(ctx, 'forge.upgrade') : pickLine(ctx, 'forge.upgrade.hilda');
    if (line) { if (varg) speak(ctx, line, { as: 'gm', mood: 'excited', bubble }); else say(line); }
    busy = false;
  }

  function flyCoins(from, to, n) {
    for (let i = 0; i < n; i++) {
      const c = h('span.gsg-flycoin', coinSvg());
      root.appendChild(c);
      anim(c, [
        { transform: `translate(${from.x - 14}px, ${from.y - 14}px) scale(0.9)`, opacity: 0 },
        { opacity: 1, offset: 0.15 },
        { transform: `translate(${(from.x + to.x) / 2 - 14}px, ${Math.min(from.y, to.y) - 80}px) scale(1.2)`, offset: 0.55 },
        { transform: `translate(${to.x - 14}px, ${to.y - 14}px) scale(0.6)`, opacity: 0.2 },
      ], 620, { delay: (i * 70) / (window.__LF_SPEED || 1), easing: 'cubic-bezier(0.4, 0, 0.2, 1)' });
      setTimeout(() => c.remove(), (720 + i * 70) / (window.__LF_SPEED || 1));
    }
  }

  async function finish() {
    if (done || busy) return;
    done = true;
    window.removeEventListener('keydown', onKey);
    sfx('ui.close');
    await say(shop ? pick(shop.bye) : pickLine(ctx, 'forge.bye'));
    root.classList.remove('is-in');
    root.classList.add('is-out');
    await ctx.sleep(380);
    fx.stop();
    root.remove();
    resolveDone();
  }
}

function keeperEl(ctx, id, name) {
  const src = ctx.assets?.char?.(id);
  const wrap = h('div.gsg-keeper');
  const fb = () => { wrap.classList.add('is-portrait'); fill(wrap, heroPortraitLike(ctx, id, name, 240)); };
  if (!src || ctx.assets?.has?.(src) === false) fb();
  else { const img = h('img', { alt: name, draggable: 'false' }); img.onerror = fb; img.src = src; wrap.appendChild(img); }
  return wrap;
}

function hammerSvg() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 120 120'); s.setAttribute('class', 'gsg-hammer');
  s.innerHTML = '<defs><linearGradient id="gsgHm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6ebf2"/><stop offset=".5" stop-color="#7b8494"/><stop offset="1" stop-color="#2b303a"/></linearGradient><linearGradient id="gsgHw" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a4a24"/><stop offset="1" stop-color="#3c230f"/></linearGradient></defs>'
    + '<rect x="56" y="34" width="9" height="82" rx="3" fill="url(#gsgHw)" stroke="#1d1209"/>'
    + '<path d="M30 14h58l6 8v14l-6 8H30l-6-8V22z" fill="url(#gsgHm)" stroke="#12151b" stroke-width="2"/><path d="M34 20h50" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>';
  return s;
}
function anvilSvg() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 260 110'); s.setAttribute('class', 'gsg-anvil-svg');
  s.innerHTML = '<defs><linearGradient id="gsgAv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b6372"/><stop offset=".25" stop-color="#2e333d"/><stop offset="1" stop-color="#0d0f14"/></linearGradient></defs>'
    + '<path d="M10 10h200c20 0 36 8 44 22-26-4-46 2-60 14H170v22l26 30H64l26-30V46H60C40 46 22 32 10 10z" fill="url(#gsgAv)" stroke="#05060a" stroke-width="2"/>'
    + '<path d="M14 12h196" stroke="#ff9a4a" stroke-opacity=".55" stroke-width="2.5"/>';
  return s;
}
