// gs.armoury [gs-gear]: openArmoury({ heroId? }, ctx) -> void. Also exports registerGear(ctx), which registers
// every gs-gear screen: gs.armoury, gs.forge, gs.trophy, gs.lootreveal (gs-meta calls it from boot.js).
//
// A paper-doll per hunter (cutout or portrait, four slots), the five stats with the change previewed while an item is
// selected, the bag as a grid (filter by slot, sort by rarity or newest), tap to see an item, then equip, swap or
// unequip. Weapons of another family are dimmed with the reason. "Equip best" fills every slot with the best gear in
// the bag. Consumables are listed with counts and can be used here when they heal, revive or cleanse.
// Autoplay: equips the best for everyone and closes.
import { h, tap } from '../../ui/dom.js';
import { L } from '../../core/i18n.js';
import {
  loadGear, itemCard, itemIcon, itemTile, compareBlock, gearDelta, statPanel, equipBest, heroPortrait, heroesOf, refOf,
  slotOf, canEquip, rarityName, kindName, SLOTS, RARITY_RANK, RARITY_COLOR, coinSvg, shardSvg, pickLine, speak, useLines,
  fill,
} from './itemcard.js';
import { anim, stagePos, gearButton, fxCanvas } from './lootreveal.js';

export function registerGear(ctx) {
  const wrap = (load) => async (...args) => {
    const c = args[args.length - 1];
    const params = args.length > 1 && args[0] && typeof args[0] === 'object' ? args[0] : {};
    const fn = await load();
    return fn(params, c);
  };
  ctx.screens.register('gs.armoury', wrap(async () => openArmoury));
  ctx.screens.register('gs.lootreveal', wrap(async () => (await import('./lootreveal.js')).lootReveal));
  ctx.screens.register('gs.forge', wrap(async () => (await import('./forge.js')).openForge));
  ctx.screens.register('gs.trophy', wrap(async () => (await import('./trophy.js')).openTrophy));
}

const STR = L({
  en: {
    title: 'Armoury', kicker: 'The Last Hearth', bag: 'Bag', close: 'Close',
    slot: { weapon: 'Weapon', armour: 'Armour', helm: 'Helm', charm: 'Charm' },
    filter: { all: 'All', weapon: 'Weapons', armour: 'Armour', helm: 'Helms', charm: 'Charms', consumable: 'Potions' },
    sortRarity: 'Best first', sortNew: 'Newest first',
    equip: 'Equip', swap: 'Swap', unequip: 'Take off', use: (n) => `Use on ${n}`, inBattle: 'Use it in battle', full: 'Health is full',
    best: 'Equip best', bestDone: (n) => (n ? `Swapped ${n} ${n === 1 ? 'item' : 'items'}` : 'Already wearing the best'),
    pickHint: 'Tap an item to see it', empty: 'Nothing here yet. Beat monsters to find loot.', worn: 'Worn by', stats: 'Stats',
    wornNow: 'Wearing', level: (n) => `Level ${n}`,
  },
  da: {
    title: 'Våbenkammer', kicker: 'Det Sidste Bål', bag: 'Taske', close: 'Luk',
    slot: { weapon: 'Våben', armour: 'Rustning', helm: 'Hjelm', charm: 'Amulet' },
    filter: { all: 'Alt', weapon: 'Våben', armour: 'Rustning', helm: 'Hjelme', charm: 'Amuletter', consumable: 'Drikke' },
    sortRarity: 'Bedste først', sortNew: 'Nyeste først',
    equip: 'Tag på', swap: 'Byt', unequip: 'Tag af', use: (n) => `Brug på ${n}`, inBattle: 'Brug den i kamp', full: 'Livet er fuldt',
    best: 'Tag det bedste på', bestDone: (n) => (n ? `Byttede ${n} ${n === 1 ? 'ting' : 'ting'}` : 'Har allerede det bedste på'),
    pickHint: 'Tryk på en ting for at se den', empty: 'Intet her endnu. Slå monstre for at finde bytte.', worn: 'Båret af', stats: 'Værdier',
    wornNow: 'Har på', level: (n) => `Niveau ${n}`,
  },
});

const firstName = (hero) => String(hero?.name || '').split(' ')[0];
const SLOT_ICON = {
  weapon: '<path d="M44 6h14v14L32 46l-4-4-4 4-6-6 4-4-4-4zM14 40l10 10-4 4-3-3-6 6-4-4 6-6-3-3z"/>',
  armour: '<path d="M14 10l10-4c2 4 6 6 8 6s6-2 8-6l10 4 8 12-8 4v32H14V26l-8-4z"/>',
  helm: '<path d="M32 6c14 0 22 10 22 24v18l-10 8V36H20v20l-10-8V30C10 16 18 6 32 6z"/>',
  charm: '<path d="M22 4h20l-4 8H26zM32 12l18 20-18 28-18-28z"/>',
};
function slotGhost(slot) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 64 64');
  s.innerHTML = `<g fill="currentColor">${SLOT_ICON[slot]}</g>`;
  return s;
}

export async function openArmoury(params = {}, ctx) {
  await loadGear(ctx);
  const s = ctx.state, audio = ctx.audio;
  const sfx = (n, o) => { try { audio?.sfx?.(n, o); } catch { /* ignore */ } };
  const party = heroesOf(ctx);
  if (!party.length) return;
  let heroId = params.heroId && s.hero(params.heroId) ? params.heroId : party[0].id;
  let filter = 'all', sort = 'rarity', sel = null; // sel = { uid } (bag or worn) | { cons: id }
  const order = new Map(s.bag.map((x, i) => [x.uid, i]));

  // ---------- build ----------
  const tabs = h('div.gsg-arm-tabs');
  const purse = h('div.gsg-purse');
  const closeBtn = h('button.gsg-x', { type: 'button', 'aria-label': STR.close }, xSvg());
  const doll = h('div.gsg-doll');
  const stats = h('div.gsg-arm-stats');
  const bestBtn = gearButton(STR.best, 'steel', () => doBest());
  const filters = h('div.gsg-filters');
  const sortBtn = h('button.gsg-chip.gsg-sort', { type: 'button' });
  const grid = h('div.gsg-grid');
  const detail = h('div.gsg-detail');
  const root = h('div.gsg-root.gsg-armoury', { 'data-no-advance': '' },
    h('div.gsg-arm-bg', bgImg(ctx, 'gs_armoury')),
    h('div.gsg-arm-top',
      h('div.gsg-arm-titles', h('div.gsg-kicker', STR.kicker), h('h2.gsg-title', STR.title)),
      tabs, purse, closeBtn),
    h('div.gsg-arm-body',
      h('div.gsg-arm-a.gsg-panel', doll, stats, h('div.gsg-arm-best', bestBtn)),
      h('div.gsg-arm-b.gsg-panel', h('div.gsg-arm-bagbar', h('div.gsg-arm-bagtop', h('h3.gsg-h3', STR.bag), sortBtn), filters), h('div.gsg-grid-scroll', grid)),
      h('div.gsg-arm-c.gsg-panel', detail)));
  ctx.stage.layers.overlay.appendChild(root);
  const fx = fxCanvas(root, ctx);
  tap(closeBtn, () => finish(), ctx);
  tap(sortBtn, () => { sort = sort === 'rarity' ? 'new' : 'rarity'; drawBag(); }, ctx);
  for (const f of ['all', 'weapon', 'armour', 'helm', 'charm', 'consumable']) {
    const b = h('button.gsg-chip', { type: 'button', dataset: { f } }, STR.filter[f]);
    tap(b, () => { filter = f; drawFilters(); drawBag(); }, ctx);
    filters.appendChild(b);
  }
  const off = ctx.bus?.on?.('gs:bag', () => { if (!busy) drawAll(); });
  drawAll();
  await ctx.sleep(20);
  root.classList.add('is-in');
  sfx('ui.open');

  let done = false, busy = false, resolveDone;
  const finished = new Promise((r) => { resolveDone = r; });
  const onKey = (e) => {
    if (e.key === 'Escape') finish();
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const i = party.findIndex((x) => x.id === heroId);
      heroId = party[(i + (e.key === 'ArrowRight' ? 1 : party.length - 1)) % party.length].id;
      sel = null; drawAll();
    }
  };
  window.addEventListener('keydown', onKey);

  if (ctx.auto) {
    (async () => {
      await ctx.sleep(300);
      for (const hero of party) { heroId = hero.id; equipBest(ctx, hero.id); drawAll(); await ctx.sleep(200); }
      finish();
    })();
  }
  await finished;
  return;

  // ================================================================================== draw
  function hero() { return s.hero(heroId); }

  function drawAll() { drawTabs(); drawPurse(); drawDoll(); drawStats(); drawFilters(); drawBag(); drawDetail(); }

  function drawTabs() {
    fill(tabs, ...party.map((x) => {
      const t = h('button.gsg-arm-tab', { type: 'button', class: x.id === heroId ? 'is-sel' : null, dataset: { hero: x.id } },
        heroPortrait(ctx, x, 52), h('span', firstName(x)));
      tap(t, () => { if (heroId === x.id) return; heroId = x.id; sel = null; sfx('ui.page'); drawAll(); }, ctx);
      return t;
    }));
  }
  function drawPurse() {
    fill(purse, h('span.gsg-purse-item', coinSvg(), h('b', String(s.gold || 0))), h('span.gsg-purse-item', shardSvg(), h('b', String(s.shards || 0))));
  }

  function drawDoll() {
    const x = hero();
    const fig = h('div.gsg-doll-fig', cutout(ctx, x));
    const slots = SLOTS.map((slot) => {
      const inst = x.gear?.[slot] || null;
      const it = inst ? ctx.content.items?.[inst.id] : null;
      const isSel = sel?.uid && inst && sel.uid === inst.uid;
      const el = h('button.gsg-slot', { type: 'button', class: [isSel ? 'is-sel' : '', inst ? 'is-full' : 'is-empty'].filter(Boolean).join(' '), dataset: { slot, rarity: it?.rarity || '' }, style: it ? { '--rc': RARITY_COLOR[it.rarity] } : null },
        h('span.gsg-slot-frame', inst ? itemIcon(ctx, inst, 78) : h('span.gsg-slot-ghost', slotGhost(slot)), inst?.plus ? h('span.gsg-plus', `+${inst.plus}`) : null),
        h('span.gsg-slot-label', inst ? (it?.name || inst.id) : STR.slot[slot]));
      tap(el, () => {
        if (inst) { sel = { uid: inst.uid }; sfx('ui.tap'); }
        else { filter = slot; sel = null; }
        drawAll();
      }, ctx);
      return el;
    });
    fill(doll, fig, h('div.gsg-doll-name', h('b', x.name), h('small', STR.level(s.level || 1))), ...slots);
  }

  function selInst() {
    if (!sel?.uid) return null;
    return s.findItem?.(sel.uid)?.inst || s.bag.find((b) => b.uid === sel.uid) || null;
  }
  function drawStats() {
    const inst = selInst();
    const worn = inst && Object.values(hero().gear || {}).some((g) => g?.uid === inst.uid);
    fill(stats, h('div.gsg-arm-stats-head', STR.stats), statPanel(ctx, heroId, { preview: inst && !worn ? inst : null }));
  }

  function drawFilters() {
    for (const b of filters.children) b.classList.toggle('is-sel', b.dataset.f === filter);
    sortBtn.textContent = sort === 'rarity' ? STR.sortRarity : STR.sortNew;
  }

  function bagEntries() {
    const items = ctx.content.items || {};
    if (filter === 'consumable') {
      const groups = s.consumables ? s.consumables() : groupCons(s.bag, items);
      return groups.map((g) => ({ cons: g.id, qty: g.qty, uids: g.uids }));
    }
    let list = s.bag.filter((b) => slotOf(items[b.id]) && (filter === 'all' || items[b.id].kind === filter));
    list = [...list].sort((a, b) => {
      if (sort === 'new') return (order.get(b.uid) ?? 1e9) - (order.get(a.uid) ?? 1e9) || 0;
      const ra = RARITY_RANK[items[a.id]?.rarity] ?? 0, rb = RARITY_RANK[items[b.id]?.rarity] ?? 0;
      return rb - ra || (b.plus || 0) - (a.plus || 0) || String(items[a.id]?.kind).localeCompare(items[b.id]?.kind) || String(a.id).localeCompare(b.id);
    });
    if (filter === 'all') {
      const cons = (s.consumables ? s.consumables() : groupCons(s.bag, items)).map((g) => ({ cons: g.id, qty: g.qty, uids: g.uids }));
      return [...list.map((inst) => ({ inst })), ...cons];
    }
    return list.map((inst) => ({ inst }));
  }

  function drawBag() {
    for (const b of s.bag) if (!order.has(b.uid)) order.set(b.uid, order.size);
    const list = bagEntries();
    if (!list.length) { fill(grid, h('div.gsg-grid-empty', STR.empty)); return; }
    fill(grid, ...list.map((e) => {
      if (e.cons) {
        return itemTile(ctx, e.cons, { count: e.qty, selected: sel?.cons === e.cons, onTap: () => { sel = { cons: e.cons }; drawStats(); drawBag(); drawDetail(); drawDoll(); } });
      }
      const t = itemTile(ctx, e.inst, { heroId, selected: sel?.uid === e.inst.uid, onTap: () => {
        if (sel?.uid === e.inst.uid) { primary(); return; } // second tap: do it
        sel = { uid: e.inst.uid }; drawStats(); drawBag(); drawDetail(); drawDoll();
      } });
      return t;
    }));
  }

  function drawDetail() {
    const x = hero();
    if (!sel) {
      fill(detail, h('div.gsg-detail-empty', h('div.gsg-detail-empty-icon', slotGhost('weapon')), h('p', STR.pickHint)));
      return;
    }
    if (sel.cons) {
      const it = ctx.content.items?.[sel.cons];
      const g = (s.consumables ? s.consumables() : groupCons(s.bag, ctx.content.items || {})).find((c) => c.id === sel.cons);
      if (!it || !g) { sel = null; drawDetail(); return; }
      const usable = canUseHere(it, x);
      const btn = gearButton(usable.ok ? STR.use(firstName(x)) : usable.why, usable.ok ? 'ember' : 'ghost', () => useCons(g), 'lg');
      if (!usable.ok) btn.setAttribute('aria-disabled', 'true');
      fill(detail, itemCard(ctx, sel.cons, { size: 'sm', extra: h('div.gsg-detail-count', `x${g.qty}`) }), h('div.gsg-detail-btns', btn));
      return;
    }
    const inst = selInst();
    if (!inst) { sel = null; drawDetail(); return; }
    const it = ctx.content.items?.[inst.id];
    const found = s.findItem?.(inst.uid);
    const wornBy = found && found.where !== 'bag' ? s.hero(found.where) : null;
    const btns = [];
    if (wornBy && wornBy.id === x.id) btns.push(gearButton(STR.unequip, 'ghost', () => doUnequip(found.slot), 'lg'));
    else {
      const can = canEquip(ctx, x, it);
      const cur = x.gear?.[slotOf(it)];
      const b = gearButton(can.ok ? (cur ? STR.swap : STR.equip) : can.why, can.ok ? 'ember' : 'ghost', () => doEquip(inst), 'lg');
      if (!can.ok) b.setAttribute('aria-disabled', 'true');
      btns.push(b);
    }
    fill(detail, 
      itemCard(ctx, inst, { size: 'sm' }),
      wornBy && wornBy.id !== x.id ? h('div.gsg-detail-worn', heroPortrait(ctx, wornBy, 30), `${STR.worn} ${firstName(wornBy)}`) : null,
      !(wornBy && wornBy.id === x.id) ? compareBlock(ctx, x, inst) : null,
      h('div.gsg-detail-btns', btns));
  }

  // ================================================================================== actions
  function primary() {
    const inst = selInst();
    if (!inst) return;
    const found = s.findItem?.(inst.uid);
    if (found && found.where === heroId) doUnequip(found.slot);
    else doEquip(inst);
  }

  async function doEquip(inst) {
    const x = hero();
    const it = ctx.content.items?.[inst.id];
    const can = canEquip(ctx, x, it);
    if (!can.ok) { sfx('ui.deny'); shake(detail); return; }
    const slot = slotOf(it);
    const tile = grid.querySelector(`[data-uid="${inst.uid}"]`);
    const from = tile ? stagePos(ctx, tile) : null;
    const d = gearDelta(ctx, x, inst);
    busy = true;
    const ok = s.equip(x.id, inst.uid);
    busy = false;
    if (!ok) { sfx('ui.deny'); return; }
    sfx('gs.equip'); sfx('ui.confirm');
    sel = { uid: inst.uid };
    drawAll();
    const slotEl = doll.querySelector(`[data-slot="${slot}"]`);
    if (slotEl) {
      const to = stagePos(ctx, slotEl);
      if (from) flyIcon(inst, from, to);
      slotEl.classList.add('is-pop');
      setTimeout(() => slotEl.classList.remove('is-pop'), 700 / (window.__LF_SPEED || 1));
      fx.burst(to.x, to.y, RARITY_COLOR[it.rarity || 'common'], 24, 0.7);
    }
    flashStats();
    if (d.gain > 3 && ctx.rng?.chance?.(0.35)) { const l = pickLine(ctx, 'equip.better'); if (l) speak(ctx, l, { as: 'gm', mood: 'warm' }); }
  }

  function doUnequip(slot) {
    busy = true;
    const inst = s.unequip(heroId, slot);
    busy = false;
    if (!inst) return;
    sfx('ui.close');
    sel = { uid: inst.uid };
    drawAll();
  }

  function doBest() {
    busy = true;
    const n = equipBest(ctx, heroId);
    busy = false;
    sel = null;
    drawAll();
    if (n) {
      sfx('gs.equip'); flashStats();
      for (const el of doll.querySelectorAll('.gsg-slot.is-full')) { const p = stagePos(ctx, el); fx.burst(p.x, p.y, '#ff7a2e', 14, 0.6); }
    } else sfx('ui.deny');
    ctx.ui?.toast?.(STR.bestDone(n), { kind: 'info' });
  }

  function canUseHere(it, x) {
    const u = it.use || {};
    if (u.dmg || u.smoke || (u.fury && !u.heal)) return { ok: false, why: STR.inBattle };
    if (u.revive && x.hp <= 0) return { ok: true };
    if (u.heal && x.hp > 0 && x.hp < (x.maxHp || 1)) return { ok: true };
    if (u.cleanse) return { ok: false, why: STR.inBattle };
    if (u.heal) return { ok: false, why: STR.full };
    return { ok: false, why: STR.inBattle };
  }
  function useCons(g) {
    const it = ctx.content.items?.[g.id];
    const x = hero();
    if (!canUseHere(it, x).ok || !s.useItem) { sfx('ui.deny'); return; }
    busy = true;
    s.useItem(g.uids[0], { heroId: x.id });
    busy = false;
    sfx('gs.heal'); sfx('heal');
    const p = stagePos(ctx, doll);
    fx.burst(p.x, p.y, '#6dffb0', 30, 0.8);
    ctx.ui?.toast?.(it.name, { kind: 'item', sub: useLines(it)[0] || '' });
    drawAll();
  }

  function flashStats() {
    for (const r of stats.querySelectorAll('.gsg-row')) anim(r, [{ background: 'rgba(255,122,46,0.35)' }, { background: 'rgba(255,122,46,0)' }], 700, { fill: 'none' });
  }
  function flyIcon(inst, from, to) {
    const f = h('div.gsg-fly', itemIcon(ctx, inst, 70));
    root.appendChild(f);
    anim(f, [
      { transform: `translate(${from.x - 35}px, ${from.y - 35}px) scale(1)`, opacity: 1 },
      { transform: `translate(${(from.x + to.x) / 2 - 35}px, ${Math.min(from.y, to.y) - 90}px) scale(1.3)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${to.x - 35}px, ${to.y - 35}px) scale(0.9)`, opacity: 0.2 },
    ], 520, { easing: 'cubic-bezier(0.65, 0, 0.35, 1)' });
    setTimeout(() => f.remove(), 560 / (window.__LF_SPEED || 1));
  }
  function shake(el) { anim(el, [{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(7px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }], 380, { fill: 'none' }); }

  async function finish() {
    if (done) return;
    done = true;
    window.removeEventListener('keydown', onKey);
    if (typeof off === 'function') off();
    sfx('ui.close');
    root.classList.remove('is-in');
    root.classList.add('is-out');
    await ctx.sleep(360);
    fx.stop();
    root.remove();
    resolveDone();
  }
}

function groupCons(bag, items) {
  const map = new Map();
  for (const inst of bag) {
    if (items[inst.id]?.kind !== 'consumable') continue;
    if (!map.has(inst.id)) map.set(inst.id, { id: inst.id, qty: 0, uids: [] });
    const e = map.get(inst.id); e.qty += inst.qty || 1; e.uids.push(inst.uid);
  }
  return [...map.values()];
}

export function bgImg(ctx, id) {
  const src = ctx.assets?.bg?.(id);
  const el = h('div.gsg-bgimg');
  if (src && ctx.assets?.has?.(src) !== false) {
    const img = new Image();
    img.onload = () => { el.style.backgroundImage = `url("${src}")`; el.classList.add('has-img'); };
    img.src = src;
  }
  return el;
}

export function cutout(ctx, hero) {
  const id = `gs_${hero.arch}`;
  const src = ctx.assets?.char?.(id);
  const wrap = h('div.gsg-cutout');
  const fallback = () => fill(wrap, heroPortrait(ctx, hero, 190));
  if (!src || ctx.assets?.has?.(src) === false) fallback();
  else { const img = h('img', { alt: hero.name, draggable: 'false' }); img.onerror = fallback; img.src = src; wrap.appendChild(img); }
  return wrap;
}

function xSvg() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.innerHTML = '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>';
  return s;
}
