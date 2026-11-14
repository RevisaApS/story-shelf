// gs.trophy [gs-gear]: openTrophy({ tab? }, ctx) -> void
// The Trophy Wall: the bosses, each with its trophy once beaten (state.trophies, or a 'beat.<foeId>' flag for the
// king and the crown, which drop no trophy), and the Bestiary: every monster met (state.seenFoes) by floor, its
// weakness shown once discovered (weakKnown), unmet ones as dark shapes. Autoplay: glances and closes.
import { h, tap } from '../../ui/dom.js';
import { L } from '../../core/i18n.js';
import { loadGear, itemIcon, elementChip, fill } from './itemcard.js';
import { anim, fxCanvas, stagePos } from './lootreveal.js';
import { bgImg } from './armoury.js';

const STR = L({
  en: {
    title: 'Trophy Wall', kicker: 'The Last Hearth', tabs: { wall: 'Trophies', beasts: 'Bestiary' }, close: 'Close',
    beaten: 'Beaten', notYet: 'Not yet beaten', floor: (n) => `Floor ${n}`, weak: 'Weak to', resist: 'Shrugs off', unknownWeak: 'Weakness unknown: hit it with everything',
    unmet: 'Not met yet', met: (a, b) => `${a} of ${b} met`, count: (a, b) => `${a} of ${b} beaten`, boss: 'Boss', none: 'Nothing',
    traits: { evasive: 'Dodges Weak strikes', guarded: 'Hides behind a shield until a Perfect strike', explodes: 'Explodes when it falls', armored: 'Plain hits do half damage',
      stoneform: 'Turns to stone every other turn', counter: 'Hits back at a Weak strike', stealth: 'Vanishes every other turn', aura: 'Makes other foes hit harder',
      summoner: 'Calls for help', heat: 'Grows hotter every round', pagecast: 'Shows the element of its next attack', cocoon: 'Wraps a hunter in web' },
  },
  da: {
    title: 'Trofævæg', kicker: 'Det Sidste Bål', tabs: { wall: 'Trofæer', beasts: 'Bestiarium' }, close: 'Luk',
    beaten: 'Besejret', notYet: 'Ikke besejret endnu', floor: (n) => `Etage ${n}`, weak: 'Svag over for', resist: 'Tåler', unknownWeak: 'Svaghed ukendt: prøv alt',
    unmet: 'Ikke mødt endnu', met: (a, b) => `${a} af ${b} mødt`, count: (a, b) => `${a} af ${b} besejret`, boss: 'Boss', none: 'Intet',
    traits: { evasive: 'Undviger svage slag', guarded: 'Gemmer sig bag et skjold til et perfekt slag', explodes: 'Eksploderer, når den falder', armored: 'Almindelige slag gør halv skade',
      stoneform: 'Bliver til sten hver anden tur', counter: 'Slår igen ved et svagt slag', stealth: 'Forsvinder hver anden tur', aura: 'Får andre fjender til at slå hårdere',
      summoner: 'Kalder på hjælp', heat: 'Bliver varmere hver runde', pagecast: 'Viser elementet i sit næste angreb', cocoon: 'Spinder en jæger ind' },
  },
});

export async function openTrophy(params = {}, ctx) {
  await loadGear(ctx);
  const s = ctx.state, content = ctx.content;
  const sfx = (n, o) => { try { ctx.audio?.sfx?.(n, o); } catch { /* ignore */ } };
  const foes = Object.values(content.foes || {});
  const bosses = foes.filter((f) => f.boss && f.id !== 'gs_hollowcrown').sort((a, b) => (a.floor || 0) - (b.floor || 0));
  const trophyOf = (f) => f.trophy || Object.values(content.items || {}).find((it) => it.kind === 'trophy' && it.boss === f.id)?.id || null;
  const beaten = (f) => { const t = trophyOf(f); return (t && (s.trophies || []).includes(t)) || !!s.flags?.[`beat.${f.id}`] || !!s.flags?.[`gs.beat.${f.id}`]; };
  let tab = params.tab === 'beasts' ? 'beasts' : 'wall';
  let pick = null;

  const tabsEl = h('div.gsg-tabs');
  const body = h('div.gsg-trophy-body');
  const closeBtn = h('button.gsg-x', { type: 'button', 'aria-label': STR.close }, xSvg());
  const sub = h('div.gsg-trophy-sub');
  const root = h('div.gsg-root.gsg-trophy', { 'data-no-advance': '' },
    h('div.gsg-arm-bg', bgImg(ctx, 'gs_camp')),
    h('div.gsg-arm-top', h('div.gsg-arm-titles', h('div.gsg-kicker', STR.kicker), h('h2.gsg-title', STR.title)), tabsEl, sub, closeBtn),
    body);
  ctx.stage.layers.overlay.appendChild(root);
  const fx = fxCanvas(root, ctx);
  for (const t of ['wall', 'beasts']) {
    const b = h('button.gsg-tab', { type: 'button', dataset: { tab: t } }, STR.tabs[t]);
    tap(b, () => { if (tab === t) return; tab = t; pick = null; sfx('ui.page'); draw(); }, ctx);
    tabsEl.appendChild(b);
  }
  tap(closeBtn, () => finish(), ctx);
  draw();
  await ctx.sleep(20);
  root.classList.add('is-in');
  sfx('ui.open');
  let done = false, resolveDone;
  const finished = new Promise((r) => { resolveDone = r; });
  const onKey = (e) => { if (e.key === 'Escape') finish(); };
  window.addEventListener('keydown', onKey);
  if (ctx.auto) ctx.sleep(600).then(() => { tab = 'beasts'; draw(); return ctx.sleep(400); }).then(finish);
  await finished;
  return;

  function draw() {
    for (const b of tabsEl.children) b.classList.toggle('is-sel', b.dataset.tab === tab);
    if (tab === 'wall') drawWall(); else drawBeasts();
  }

  function drawWall() {
    const n = bosses.filter(beaten).length;
    sub.textContent = STR.count(n, bosses.length);
    const plaques = bosses.map((f, i) => {
      const won = beaten(f);
      const t = trophyOf(f);
      const tItem = t ? content.items?.[t] : null;
      const el = h('div.gsg-plaque', { class: won ? 'is-won' : 'is-locked', dataset: { foe: f.id } },
        h('div.gsg-plaque-shield', foeArt(ctx, f, 150, !won), won && t ? h('div.gsg-plaque-trophy', itemIcon(ctx, t, 72)) : null),
        h('div.gsg-plaque-floor', STR.floor(f.floor || 1)),
        h('b.gsg-plaque-name', won ? f.name : '? ? ?'),
        h('small.gsg-plaque-state', won ? (tItem?.name || STR.beaten) : STR.notYet));
      anim(el, [{ transform: 'translateY(24px)', opacity: 0 }, { transform: 'none', opacity: 1 }], 460, { delay: (i * 70) / (window.__LF_SPEED || 1) });
      if (won) setTimeout(() => { if (!el.isConnected) return; const p = stagePos(ctx, el); fx.burst(p.x, p.y - 30, '#ffb02e', 10, 0.5); }, (300 + i * 70) / (window.__LF_SPEED || 1));
      return el;
    });
    fill(body, h('div.gsg-wall', plaques));
  }

  function drawBeasts() {
    const met = foes.filter((f) => s.seenFoes?.[f.id]);
    sub.textContent = STR.met(met.length, foes.length);
    const floors = [1, 2, 3, 4, 5];
    const rows = floors.map((n) => {
      const list = foes.filter((f) => (f.floor || 1) === n);
      const fname = (Array.isArray(content.floors) ? content.floors.find((x) => x.n === n) : content.floors?.[n])?.name;
      return h('div.gsg-beast-row',
        h('div.gsg-beast-floor', h('b', String(n)), h('small', fname || STR.floor(n))),
        h('div.gsg-beast-list', list.map((f) => {
          const seen = s.seenFoes?.[f.id];
          const el = h('button.gsg-beast', { type: 'button', class: [seen ? 'is-seen' : 'is-unseen', pick === f.id ? 'is-sel' : '', f.boss ? 'is-boss' : ''].filter(Boolean).join(' '), dataset: { foe: f.id } },
            foeArt(ctx, f, 72, !seen),
            h('span.gsg-beast-name', seen ? f.name : '???'),
            seen?.weakKnown ? h('span.gsg-beast-weak', (f.weak || []).map((e) => elementChip(e, { label: false }))) : null);
          tap(el, () => { pick = f.id; drawBeasts(); }, ctx);
          return el;
        })));
    });
    const f = pick ? content.foes[pick] : null;
    const seen = f ? s.seenFoes?.[f.id] : null;
    const side = f ? h('div.gsg-beast-detail.gsg-panel',
      foeArt(ctx, f, 190, !seen),
      h('div.gsg-kicker', `${STR.floor(f.floor || 1)}${f.boss ? ` · ${STR.boss}` : ''}`),
      h('h3.gsg-title', seen ? f.name : '???'),
      !seen ? h('p', STR.unmet)
        : [
          seen.weakKnown
            ? [h('div.gsg-beast-k', STR.weak), h('div.gsg-beast-chips', (f.weak || []).length ? f.weak.map((e) => elementChip(e)) : h('span', STR.none)),
              (f.resist || []).length ? [h('div.gsg-beast-k', STR.resist), h('div.gsg-beast-chips', f.resist.map((e) => elementChip(e)))] : null]
            : h('p.gsg-beast-unknown', STR.unknownWeak),
          (f.traits || []).filter((t) => STR.traits[t]).length ? h('ul.gsg-card-traits', f.traits.filter((t) => STR.traits[t]).map((t) => h('li', STR.traits[t]))) : null,
        ])
      : null;
    fill(body, h('div.gsg-beasts', h('div.gsg-beast-rows', rows), side));
  }

  async function finish() {
    if (done) return;
    done = true;
    window.removeEventListener('keydown', onKey);
    sfx('ui.close');
    root.classList.remove('is-in');
    root.classList.add('is-out');
    await ctx.sleep(360);
    fx.stop();
    root.remove();
    resolveDone();
  }
}

function foeArt(ctx, f, size, dark) {
  const id = f.art || f.id;
  const wrap = h('span.gsg-foeart', { class: dark ? 'is-dark' : null, style: { width: `${size}px`, height: `${size}px` } });
  const ph = () => fill(wrap, h('span.gsg-portrait-ph', { style: { fontSize: `${Math.round(size * 0.4)}px` } }, dark ? '?' : (f.name || '?')[0]));
  const src = ctx.assets?.portrait?.(id);
  if (dark) ph();
  else if (!src || ctx.assets?.has?.(src) === false) {
    const c = ctx.assets?.char?.(id);
    if (c && ctx.assets?.has?.(c) !== false) { const img = h('img', { alt: '', draggable: 'false' }); img.onerror = ph; img.src = c; wrap.appendChild(img); }
    else ph();
  } else { const img = h('img', { alt: dark ? '' : f.name, draggable: 'false' }); img.onerror = ph; img.src = src; wrap.appendChild(img); }
  return wrap;
}

function xSvg() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.innerHTML = '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>';
  return s;
}
