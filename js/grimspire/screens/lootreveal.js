// gs.lootreveal [gs-gear]: lootReveal({ items: [ids|instances], roll?: { luck?, bonus?, die?, floor? }, title? }, ctx)
//   -> { rarity, die, total, items: [instances], equipped: [{ uid, heroId }] }
// With a roll: the 3D d20 flies, + Luck (and the boss bonus) count up on a rarity ladder, the rarity is called, and
// one item of that rarity is picked (loot.pickItem) and dealt first. Then every drop lies face down; tap (or Space)
// turns it with a burst in its rarity colour, a sound per rarity and one of Varg's loot.<rarity> lines. Gear opens
// "Who wears it?" with the compare; consumables, materials and trophies go straight where they belong.
// Items are added to the state here (gs-meta's rewards do not add them). Autoplay: no waits on input; equips
// when better for someone, else the bag.
//
// Also exports fxCanvas(host, ctx) -> { burst(x, y, color, n, power), rain(color, n), stop() } and stagePos(ctx, el),
// used by the forge for hammer sparks.
import { h, tap } from '../../ui/dom.js';
import { L } from '../../core/i18n.js';
import { pickItem, lootRollDetail, RARITY_COLOR, RARITY_RANK } from '../loot.js';
import {
  loadGear, itemCard, itemIcon, compareBlock, gearDelta, bestHeroFor, heroPortrait, heroesOf, refOf, slotOf,
  rarityName, pickLine, speak, bubbleEl, arrowSvg, familyOf, deriveHero,
  fill,
} from './itemcard.js';

const STR = L({
  en: {
    kicker: 'Spoils', title: 'Loot!', rollKicker: 'Loot roll', luck: 'Luck', bonus: 'Boss', bonusChest: 'Bonus', total: 'Total',
    hint: 'Tap a card to turn it over', turnAll: 'Turn them all', onward: 'Onward',
    whoTitle: 'Who wears it?', equipOn: (n) => `Equip on ${n}`, toBag: 'To the bag', wears: (n) => `${n} wears it`, inBag: 'In the bag',
    trophy: 'On the Trophy Wall', bands: ['Common', 'Rare', 'Epic', 'Legendary'], cantAny: 'Nobody here can use this one yet. It goes in the bag.',
    natural: 'Natural 20!', called: { common: 'Common', rare: 'Rare!', epic: 'Epic!', legendary: 'LEGENDARY!' },
  },
  da: {
    kicker: 'Bytte', title: 'Bytte!', rollKicker: 'Byttekast', luck: 'Held', bonus: 'Boss', bonusChest: 'Bonus', total: 'I alt',
    hint: 'Tryk på et kort for at vende det', turnAll: 'Vend dem alle', onward: 'Videre',
    whoTitle: 'Hvem skal bære den?', equipOn: (n) => `Giv den til ${n}`, toBag: 'I tasken', wears: (n) => `${n} bærer den`, inBag: 'I tasken',
    trophy: 'På Trofævæggen', bands: ['Almindelig', 'Sjælden', 'Episk', 'Legendarisk'], cantAny: 'Ingen her kan bruge den endnu. Den ryger i tasken.',
    natural: 'Naturlig 20!', called: { common: 'Almindelig', rare: 'Sjælden!', epic: 'Episk!', legendary: 'LEGENDARISK!' },
  },
});

const speed = () => window.__LF_SPEED || 1;
const reduced = () => document.documentElement.classList.contains('lf-reduce') || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
export function anim(el, frames, ms, opts = {}) {
  if (!el?.animate) return null;
  try { return el.animate(frames, { duration: Math.max(1, (reduced() ? Math.min(ms, 90) : ms) / speed()), easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both', ...opts }); }
  catch { return null; }
}

export function stagePos(ctx, el) {
  const r = el.getBoundingClientRect(), base = ctx.stage.el.getBoundingClientRect();
  const k = 1280 / (base.width || 1280);
  return { x: (r.left + r.width / 2 - base.left) * k, y: (r.top + r.height / 2 - base.top) * k, w: r.width * k, h: r.height * k };
}

// ------------------------------------------------------------------------------------------------ particles

export function fxCanvas(host, ctx) {
  const cvs = h('canvas.gsg-fx');
  host.appendChild(cvs);
  const W = 1280, H = 800, pr = Math.min(2, ctx.stage?.pixelRatio?.() || 1);
  cvs.width = W * pr; cvs.height = H * pr;
  const g = cvs.getContext('2d');
  g.scale(pr, pr);
  const parts = [];
  let alive = true, last = performance.now(), running = false;
  const tick = (now) => {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000) * speed();
    last = now;
    g.clearRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.t += dt;
      if (p.t > p.life) { parts.splice(i, 1); continue; }
      p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt; p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const k = 1 - p.t / p.life;
      g.globalAlpha = Math.min(1, k * 1.4);
      if (p.streak) {
        g.strokeStyle = p.color; g.lineWidth = p.size; g.lineCap = 'round';
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); g.stroke();
      } else {
        const r = p.size * (1 + (1 - k) * 0.6) * 3;
        const grd = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.25, p.color); grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd; g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill();
      }
    }
    g.globalAlpha = 1;
    if (parts.length) requestAnimationFrame(tick); else running = false;
  };
  const kick = () => { if (!running && alive) { running = true; last = performance.now(); requestAnimationFrame(tick); } };
  const lite = reduced() ? 0.25 : 1;
  return {
    burst(x, y, color, n = 40, power = 1) {
      for (let i = 0; i < n * lite; i++) {
        const a = Math.random() * Math.PI * 2, s = (120 + Math.random() * 420) * power;
        parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60 * power, life: 0.6 + Math.random() * 0.9 * power, t: 0, size: 1 + Math.random() * 2.4, color, drag: 2.2, grav: 260, streak: Math.random() < 0.55 });
      }
      kick();
    },
    sparks(x, y, color = '#ffb347', n = 26) {
      for (let i = 0; i < n * lite; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, s = 220 + Math.random() * 380;
        parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.45 + Math.random() * 0.6, t: 0, size: 1.2 + Math.random() * 1.8, color, drag: 1.4, grav: 900, streak: true });
      }
      kick();
    },
    rain(color, n = 80) {
      for (let i = 0; i < n * lite; i++) {
        parts.push({ x: Math.random() * W, y: -20 - Math.random() * 300, vx: (Math.random() - 0.5) * 30, vy: 80 + Math.random() * 160, life: 2.5 + Math.random() * 2, t: 0, size: 1 + Math.random() * 2.2, color, drag: 0.2, grav: 30, streak: false });
      }
      kick();
    },
    stop() { alive = false; cvs.remove(); },
  };
}

// ------------------------------------------------------------------------------------------------ the screen

export async function lootReveal(params = {}, ctx) {
  await loadGear(ctx);
  const s = ctx.state, content = ctx.content, audio = ctx.audio;
  const auto = !!ctx.auto;
  const sfx = (n, o) => { try { audio?.sfx?.(n, o); } catch { /* ignore */ } };
  const list = (params.items || []).filter(Boolean);
  const result = { rarity: null, die: null, total: null, items: [], equipped: [] };

  const root = h('div.gsg-root.gsg-reveal', { 'data-no-advance': '' });
  const veil = h('div.gsg-reveal-veil');
  const rays = h('div.gsg-reveal-rays');
  const head = h('div.gsg-reveal-head', h('div.gsg-kicker', STR.kicker), h('h2.gsg-title', params.title || STR.title));
  const stageArea = h('div.gsg-reveal-stage');
  const hint = h('div.gsg-reveal-hint');
  const foot = h('div.gsg-reveal-foot');
  const bubble = bubbleEl('gsg-reveal-bubble');
  const varg = h('div.gsg-reveal-varg', heroPortraitGm(ctx), bubble);
  const call = h('div.gsg-call');
  root.append(veil, rays, head, stageArea, call, varg, hint, foot);
  ctx.stage.layers.overlay.appendChild(root);
  const fx = fxCanvas(root, ctx);
  await ctx.sleep(20);
  root.classList.add('is-in');
  sfx('ui.open');

  // ---------- the roll ----------
  const pending = [];
  if (params.roll) {
    const roll = params.roll;
    const luck = roll.luck ?? Math.max(0, ...heroesOf(ctx).map((x) => deriveHero(ctx, x)?.luck || 0));
    const die = roll.die ?? (ctx.rng?.int ? ctx.rng.int(1, 20) : 1 + Math.floor(Math.random() * 20));
    const r = lootRollDetail({ die, luck, bonus: roll.bonus || 0 });
    Object.assign(result, { rarity: r.rarity, die: r.die, total: r.total });
    await showRoll(r, roll);
    const floor = roll.floor ?? params.floor ?? currentFloor(s);
    const id = pickItem({ content, floor, rarity: r.rarity, rng: ctx.rng, owned: ownedIds(ctx), families: heroesOf(ctx).map((x) => familyOf(ctx, x)) });
    if (id) pending.push(id);
  }
  pending.push(...list);

  if (!pending.length) {
    await ctx.sleep(auto ? 200 : 900);
    return close();
  }

  // ---------- cards ----------
  const entries = pending.map((ref) => ({ ref, ...refOf(ctx, ref), inst: null, done: false, arrived: false, queued: false }));
  // declared before any card can be tapped (a tap during the slide-in used to hit these before initialisation)
  let busy = false;
  let decideOpen = false, onwardBtn = null;
  // a tap while the cards are still sliding in is remembered and plays once they have arrived
  const tapCard = (e) => { if (!e.arrived) { e.queued = true; return; } turn(e); };
  const allDone = new Promise((resolve) => { root._allDone = resolve; });
  const n = entries.length;
  const size = n <= 3 ? 'md' : 'sm';
  const row = h('div.gsg-reveal-row', { class: `n-${Math.min(n, 6)}` });
  fill(stageArea, row);
  for (const [i, e] of entries.entries()) {
    const rarity = e.item?.rarity || 'common';
    const back = h('div.gsg-cardback', { style: { '--rc': RARITY_COLOR[rarity] } }, h('div.gsg-cardback-sigil', sigilSvg()), h('div.gsg-cardback-shine'));
    const front = h('div.gsg-flip-front', itemCard(ctx, e.inst || e.ref, { size }));
    const stamp = h('div.gsg-stamp');
    const flip = h('button.gsg-flip', { type: 'button', dataset: { rarity, i }, style: { '--rc': RARITY_COLOR[rarity] } },
      h('div.gsg-flip-in', h('div.gsg-flip-back', back), front), stamp);
    e.el = flip; e.front = front; e.stamp = stamp;
    tap(flip, () => tapCard(e), ctx);
    row.appendChild(flip);
    anim(flip, [{ transform: 'translateY(60px) scale(0.85)', opacity: 0 }, { transform: 'none', opacity: 1 }], 520, { delay: (80 + i * 110) / speed() });
    sfx('ui.page', { rate: 0.9 + i * 0.05 });
  }
  hint.textContent = STR.hint;
  const turnAll = button(STR.turnAll, 'ghost', async () => { for (const e of entries) if (!e.done) await turn(e); });
  fill(foot, n > 1 ? turnAll : null);
  await ctx.sleep(400 + n * 110);
  for (const e of entries) e.arrived = true;

  const onKey = (e) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    if (decideOpen) return;
    const next = entries.find((x) => !x.done);
    if (next) { e.preventDefault(); turn(next); } else if (onwardBtn) { e.preventDefault(); onwardBtn.click(); }
  };
  window.addEventListener('keydown', onKey);

  if (!auto) (async () => { for (const e of entries) if (e.queued && !e.done) await turn(e); })();
  if (auto) (async () => { for (const e of entries) { await ctx.sleep(260); await turn(e); } })();
  await allDone;

  // ---------- onward ----------
  hint.textContent = '';
  await new Promise((resolve) => {
    onwardBtn = button(STR.onward, 'ember', () => resolve(), 'lg');
    fill(foot, onwardBtn);
    anim(onwardBtn, [{ transform: 'translateY(20px)', opacity: 0 }, { transform: 'none', opacity: 1 }], 380);
    if (auto) ctx.sleep(500).then(resolve);
  });
  window.removeEventListener('keydown', onKey);
  return close();

  // ================================================================================== helpers
  async function close() {
    root.classList.remove('is-in');
    root.classList.add('is-out');
    sfx('ui.close');
    await ctx.sleep(380);
    fx.stop();
    root.remove();
    try { await ctx.dice?.clear?.(); } catch { /* ignore */ }
    return result;
  }

  async function turn(e) {
    if (e.done || e.turning || busy) return;
    busy = true; e.turning = true;
    const rarity = e.item?.rarity || 'common';
    const rank = RARITY_RANK[rarity] ?? 0;
    // the anticipation: rare and better shake and leak light first
    if (rank >= 1) {
      e.el.classList.add('is-charging');
      if (rank >= 3) { root.classList.add('is-legend-dim'); sfx('gs.charge'); }
      await ctx.sleep(rank >= 3 ? 1100 : rank === 2 ? 650 : 320);
    }
    // add it to the state
    e.inst = addToState(e);
    if (e.inst && e.inst.uid) fill(e.front, itemCard(ctx, e.inst, { size }));
    e.el.classList.remove('is-charging');
    e.el.classList.add('is-flipped');
    sfx(`gs.loot.${rarity}`);
    sfx('ui.page');
    await ctx.sleep(260);
    const p = stagePos(ctx, e.el);
    fx.burst(p.x, p.y, RARITY_COLOR[rarity], 26 + rank * 30, 0.8 + rank * 0.35);
    if (rank >= 2) {
      rays.style.setProperty('--rc', RARITY_COLOR[rarity]);
      rays.classList.remove('is-on'); void rays.offsetWidth; rays.classList.add('is-on');
    }
    if (rank >= 3) {
      root.classList.add('is-legend');
      ctx.stage.fx?.('shake');
      fx.rain(RARITY_COLOR.legendary, 120);
      fx.burst(640, 400, '#fff3c4', 80, 1.6);
      calling(STR.called.legendary, rarity);
    } else if (rank === 2) calling(STR.called.epic, rarity);
    e.el.classList.add('is-lit');
    const line = pickLine(ctx, `loot.${rarity}`);
    const said = line ? speak(ctx, line, { as: 'gm', mood: 'fierce', bubble }) : Promise.resolve();
    if (rank >= 3) await said; else await ctx.sleep(380);
    root.classList.remove('is-legend-dim');

    if (entries.every((x) => x.done || x === e)) hint.textContent = '';
    // where it goes
    const item = e.item;
    if (item?.kind === 'trophy') stampIt(e, STR.trophy, 'trophy');
    else if (slotOf(item)) await decide(e);
    else stampIt(e, STR.inBag, 'bag');
    e.done = true; e.turning = false; busy = false;
    if (rank >= 3) setTimeout(() => root.classList.remove('is-legend'), 1600 / speed());
    if (entries.every((x) => x.done)) root._allDone();
  }

  function addToState(e) {
    const item = e.item;
    if (item?.kind === 'trophy') {
      if (s.addTrophy) s.addTrophy(e.id); else if (!s.trophies?.includes(e.id)) s.trophies?.push(e.id);
      result.items.push({ uid: null, id: e.id, plus: 0 });
      return null;
    }
    // an instance already in the bag (or worn) stays where it is
    if (e.ref && typeof e.ref === 'object' && e.ref.uid && s.findItem?.(e.ref.uid)) { result.items.push(e.ref); return e.ref; }
    const inst = s.addItem ? s.addItem(e.id, { plus: e.plus || 0 }) : null;
    if (inst) result.items.push(inst);
    return inst;
  }

  function stampIt(e, text, kind) {
    fill(e.stamp, h('span', text));
    e.stamp.dataset.kind = kind;
    e.el.classList.add('is-stamped');
  }

  // "Who wears it?" with the compare. Resolves when the player picks a hunter or the bag.
  function decide(e) {
    const party = heroesOf(ctx);
    const best = bestHeroFor(ctx, e.inst);
    const eligible = party.filter((x) => gearDelta(ctx, x, e.inst).ok);
    if (!eligible.length) { stampIt(e, STR.inBag, 'bag'); speakBubbleOnly(STR.cantAny); return Promise.resolve(); }
    if (auto) {
      return (async () => {
        await ctx.sleep(300);
        if (best && s.equip(best.heroId, e.inst.uid)) {
          result.equipped.push({ uid: e.inst.uid, heroId: best.heroId });
          sfx('gs.equip');
          stampIt(e, STR.wears(firstName(s.hero(best.heroId))), 'hero');
        } else stampIt(e, STR.inBag, 'bag');
      })();
    }
    return new Promise((resolve) => {
      decideOpen = true;
      let sel = best?.heroId || eligible[0].id;
      const cardSlot = h('div.gsg-decide-card', itemCard(ctx, e.inst, { size: 'lg' }));
      const chips = h('div.gsg-decide-heroes');
      const cmpSlot = h('div.gsg-decide-cmp');
      const equipBtn = button('', 'ember', () => pick(sel), 'lg');
      const bagBtn = button(STR.toBag, 'ghost', () => pick(null));
      const panel = h('div.gsg-decide', { style: { '--rc': RARITY_COLOR[e.item.rarity || 'common'] } },
        cardSlot,
        h('div.gsg-decide-right',
          h('div.gsg-kicker', rarityName(e.item.rarity)),
          h('h2.gsg-title', STR.whoTitle),
          chips, cmpSlot,
          h('div.gsg-decide-btns', equipBtn, bagBtn)));
      const layer = h('div.gsg-decide-layer', panel);
      root.appendChild(layer);
      const draw = () => {
        fill(chips, ...party.map((hero) => {
          const d = gearDelta(ctx, hero, e.inst);
          const mark = !d.ok ? 'no' : d.gain > 0.25 ? 'up' : d.gain < -0.25 ? 'down' : 'same';
          const chip = h('button.gsg-herochip', { type: 'button', class: [hero.id === sel ? 'is-sel' : '', !d.ok ? 'is-dim' : ''].filter(Boolean).join(' ') || null, dataset: { hero: hero.id, mark } },
            heroPortrait(ctx, hero, 56), h('b', firstName(hero)),
            mark === 'up' || mark === 'down' ? h('span.gsg-herochip-mark', { dataset: { mark } }, arrowSvg(mark)) : null);
          tap(chip, () => { if (!d.ok) { sfx('ui.deny'); return; } sel = hero.id; draw(); }, ctx);
          return chip;
        }));
        fill(cmpSlot, compareBlock(ctx, sel, e.inst));
        equipBtn.querySelector('span').textContent = STR.equipOn(firstName(s.hero(sel)));
      };
      draw();
      requestAnimationFrame(() => layer.classList.add('is-in'));
      const onK = (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); pick(sel); }
        else if (ev.key === 'Escape') { ev.preventDefault(); pick(null); }
      };
      window.addEventListener('keydown', onK);
      let picked = false;
      async function pick(heroId) {
        if (picked) return; picked = true;
        window.removeEventListener('keydown', onK);
        if (heroId && s.equip(heroId, e.inst.uid)) {
          result.equipped.push({ uid: e.inst.uid, heroId });
          sfx('gs.equip'); sfx('ui.confirm');
          stampIt(e, STR.wears(firstName(s.hero(heroId))), 'hero');
          const better = gearDelta(ctx, heroId, e.inst);
          if (better && (ctx.rng?.chance?.(0.5) ?? true)) { const l = pickLine(ctx, 'equip.better'); if (l) speak(ctx, l, { as: 'gm', mood: 'warm', bubble }); }
        } else stampIt(e, STR.inBag, 'bag');
        layer.classList.remove('is-in');
        await ctx.sleep(300);
        layer.remove();
        decideOpen = false;
        resolve();
      }
    });
  }

  function speakBubbleOnly(text) {
    bubble.querySelector('.gsg-bubble-text').textContent = text;
    bubble.classList.remove('is-in'); void bubble.offsetWidth; bubble.classList.add('is-in');
  }

  function calling(text, rarity, low = false) {
    call.classList.toggle('is-low', low);
    fill(call, h('span', text));
    call.style.setProperty('--rc', RARITY_COLOR[rarity]);
    call.classList.remove('is-on'); void call.offsetWidth; call.classList.add('is-on');
  }

  // the d20, then the Luck and bonus counting up on the rarity ladder
  async function showRoll(r, roll) {
    const bands = [[1, 9, 'common'], [10, 15, 'rare'], [16, 19, 'epic'], [20, 30, 'legendary']];
    const marker = h('div.gsg-ladder-marker', h('b', '0'));
    const ladder = h('div.gsg-ladder', bands.map(([a, b, rar], i) => h('div.gsg-ladder-band', { dataset: { rarity: rar }, style: { '--rc': RARITY_COLOR[rar], flex: String(rar === 'legendary' ? 4 : b - a + 1) } },
      h('span', STR.bands[i]), h('small', rar === 'legendary' ? '20+' : `${a}-${b}`))), marker);
    const chip = (label, val, cls) => h('div.gsg-rollchip', { class: cls }, h('small', label), h('b', String(val)));
    const dieChip = chip('d20', '?', 'is-die');
    const luckChip = chip(`+ ${STR.luck}`, r.luck, 'is-luck');
    const bonusChip = r.bonus ? chip(`+ ${roll.bonusLabel || (r.bonus >= 6 ? STR.bonus : STR.bonusChest)}`, r.bonus, 'is-bonus') : null;
    const totalChip = chip(STR.total, '?', 'is-total');
    const panel = h('div.gsg-rollpanel', h('div.gsg-kicker', STR.rollKicker), h('div.gsg-rollchips', dieChip, h('i', '+'), luckChip, bonusChip ? [h('i', '+'), bonusChip] : null, h('i', '='), totalChip), ladder);
    fill(stageArea, panel);
    for (const c of [luckChip, bonusChip, totalChip]) if (c) c.classList.add('is-wait');
    anim(panel, [{ transform: 'translateY(-30px)', opacity: 0 }, { transform: 'none', opacity: 1 }], 480);
    sfx('gs.chest');
    await ctx.sleep(300);
    try {
      await ctx.dice.roll({ dice: [{ sides: 20, value: r.die, tint: '#ff7a2e' }], crit: r.die === 20 ? 'success' : r.die === 1 ? 'fail' : null, from: { x: 1180, y: 760 } });
    } catch (err) { console.warn('[gs-gear] dice failed', err); }
    dieChip.querySelector('b').textContent = String(r.die);
    anim(dieChip, [{ transform: 'scale(1.5)' }, { transform: 'scale(1)' }], 380, { fill: 'none' });
    sfx('ui.confirm');
    if (r.die === 20) calling(STR.natural, 'legendary', true);
    const setMarker = (v) => {
      const pct = Math.max(0, Math.min(1, (v - 1) / 23)) * 100;
      marker.style.left = `${pct}%`;
      marker.querySelector('b').textContent = String(v);
      for (const band of ladder.querySelectorAll('.gsg-ladder-band')) band.classList.toggle('is-on', band.dataset.rarity === (v >= 20 ? 'legendary' : v >= 16 ? 'epic' : v >= 10 ? 'rare' : 'common'));
    };
    marker.classList.add('is-on');
    setMarker(r.die);
    await ctx.sleep(500);
    let cur = r.die;
    for (const [c, add] of [[luckChip, r.luck], [bonusChip, r.bonus]]) {
      if (!c) continue;
      c.classList.remove('is-wait');
      anim(c, [{ transform: 'translateY(14px)', opacity: 0 }, { transform: 'none', opacity: 1 }], 300);
      for (let i = 0; i < add; i++) { cur++; setMarker(cur); sfx('gs.coin', { rate: 1 + i * 0.06, volume: 0.5 }); await ctx.sleep(120); }
      await ctx.sleep(220);
    }
    totalChip.classList.remove('is-wait');
    totalChip.querySelector('b').textContent = String(r.total);
    totalChip.style.setProperty('--rc', RARITY_COLOR[r.rarity]);
    if (r.die === 20) setMarker(Math.max(20, r.total));
    panel.dataset.rarity = r.rarity;
    panel.style.setProperty('--rc', RARITY_COLOR[r.rarity]);
    calling(STR.called[r.rarity], r.rarity, true);
    sfx(`gs.loot.${r.rarity}`);
    const p = stagePos(ctx, totalChip);
    fx.burst(p.x, p.y, RARITY_COLOR[r.rarity], 30 + RARITY_RANK[r.rarity] * 20, 1);
    await ctx.sleep(1300);
    try { await ctx.dice.clear?.(); } catch { /* ignore */ }
    anim(panel, [{ opacity: 1 }, { opacity: 0, transform: 'translateY(-20px)' }], 300);
    await ctx.sleep(300);
  }
}

function button(label, kind, onClick, size) {
  const b = h('button.gsg-btn', { type: 'button', class: [`gsg-btn--${kind}`, size ? `gsg-btn--${size}` : ''].filter(Boolean).join(' ') }, h('span', label));
  b.addEventListener('click', () => onClick());
  return b;
}
export { button as gearButton };

const firstName = (hero) => String(hero?.name || '').split(' ')[0];
function currentFloor(s) {
  if (s?.where && typeof s.where === 'object' && s.where.floor) return s.where.floor;
  let f = 1;
  for (let i = 1; i <= 5; i++) if (s?.floors?.[i]?.unlocked) f = i;
  return f;
}
export function ownedIds(ctx) {
  const s = ctx.state;
  const ids = (s?.bag || []).map((x) => x.id);
  for (const hero of heroesOf(ctx)) for (const v of Object.values(hero.gear || {})) if (v) ids.push(v.id || v);
  return ids;
}
function heroPortraitGm(ctx) {
  const art = ctx.pack?.gmArt || 'gs_varg';
  return heroPortraitLike(ctx, art, 'Varg');
}
export function heroPortraitLike(ctx, id, name, size = 76) {
  const wrap = h('span.gsg-portrait.is-npc', { style: { width: `${size}px`, height: `${size}px` } });
  const ph = () => fill(wrap, h('span.gsg-portrait-ph', { style: { fontSize: `${Math.round(size * 0.38)}px` } }, name[0]));
  const src = ctx.assets?.portrait?.(id);
  if (!src || ctx.assets?.has?.(src) === false) ph();
  else { const img = h('img', { alt: name, draggable: 'false' }); img.onerror = ph; img.src = src; wrap.appendChild(img); }
  return wrap;
}
function sigilSvg() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 100 140');
  s.innerHTML = '<g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round">'
    + '<path d="M50 14 L62 40 L58 40 L58 98 L66 106 L50 126 L34 106 L42 98 L42 40 L38 40 Z"/>'
    + '<path d="M30 56 Q50 46 70 56 M28 72 Q50 62 72 72" opacity=".55"/>'
    + '<path d="M38 22 L44 8 L50 18 L56 8 L62 22" opacity=".9"/>'
    + '<circle cx="50" cy="70" r="30" opacity=".35"/><circle cx="50" cy="70" r="40" opacity=".18"/></g>'
    + '<circle cx="50" cy="60" r="3.5" fill="currentColor"/>';
  return s;
}
