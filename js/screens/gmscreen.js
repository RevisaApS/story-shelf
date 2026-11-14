// The Storykeeper's Book (SPEC 11): openGmScreen(ctx) -> void
// Tabs: Party (hero sheets, trinkets, the bag with consumables usable outside battle), Quests,
// Chronicle (journal), Map (visited places). A "Storykeeper's shortcuts" drawer jumps to any scene with the
// current party, by reloading with ?scene=<id>&party=..&level=.. (the same quick start main.js uses).
import { h, tap } from '../ui/dom.js';
import * as R from '../core/rules.js';
import { L } from '../core/i18n.js';
import { ensureCss, anim, itemEffect, canUseOutside, useOutside } from '../systems/sys-util.js';

const STR = L({
  en: {
    book: "The Storykeeper's Book",
    tabs: { party: 'Party', quests: 'Quests', chronicle: 'Chronicle', map: 'Map' },
    level: (n) => `Level ${n}`,
    hearts: 'Hearts', guard: 'Guard',
    talent: 'Talent', powers: 'Powers', perks: 'Gifts', trinket: 'Trinket', bag: 'The Bag',
    great: 'Great power', greatLocked: 'Unlocks at level 3',
    cost: (n) => `${n} Sparks`,
    noPerks: 'Gifts arrive when the party grows in level.',
    noTrinket: 'Nothing worn yet. Trinkets from the bag can be worn here.',
    emptyBag: 'The bag is empty. Pockets full of fluff.',
    useOn: (name) => `Use on ${name}`,
    useAll: 'Use for everyone',
    wear: (name) => `${name} wears it`,
    takeOff: 'Back in the bag',
    used: (item, name) => `${name} used the ${item}`,
    quests: 'Quests in hand', questsDone: 'Quests done', noQuests: 'No quests yet. Adventure is coming.', noDone: 'Nothing finished yet.',
    chronicle: 'The tale so far', noJournal: 'The page is blank. The story is only beginning.',
    mapKicker: 'The Lantern Vale', here: 'You are here',
    shortcuts: "Storykeeper's shortcuts", shortcutsSub: 'For demos: jump to any scene with this party.', jump: 'Jump here',
    close: 'Close the book',
    coins: (n) => `${n} coins`, stars: (n) => `${n} Stars`,
    noHeroes: 'No heroes yet.', theParty: 'The party',
  },
  da: {
    book: 'Sagnvogterens bog',
    tabs: { party: 'Helte', quests: 'Opgaver', chronicle: 'Krøniken', map: 'Kort' },
    level: (n) => `Niveau ${n}`,
    hearts: 'Hjerter', guard: 'Værn',
    talent: 'Talent', powers: 'Kræfter', perks: 'Gaver', trinket: 'Smykke', bag: 'Tasken',
    great: 'Stor kraft', greatLocked: 'Låses op på niveau 3',
    cost: (n) => `${n} ${n === 1 ? 'Gnist' : 'Gnister'}`,
    noPerks: 'Gaverne kommer, når I stiger i niveau.',
    noTrinket: 'Intet på endnu. Smykker fra tasken kan tages på her.',
    emptyBag: 'Tasken er tom. Lommerne er fulde af fnug.',
    useOn: (name) => `Brug på ${name}`,
    useAll: 'Brug på alle',
    wear: (name) => `${name} tager den på`,
    takeOff: 'Tilbage i tasken',
    used: (item, name) => `${name} brugte ${item}`,
    quests: 'Opgaver i gang', questsDone: 'Klarede opgaver', noQuests: 'Ingen opgaver endnu. Eventyret er på vej.', noDone: 'Intet klaret endnu.',
    chronicle: 'Historien indtil nu', noJournal: 'Siden er tom. Historien er kun lige begyndt.',
    mapKicker: 'Lygtedalen', here: 'Her er I',
    shortcuts: 'Sagnvogterens genveje', shortcutsSub: 'Til demoer: hop til enhver scene med denne flok.', jump: 'Hop hertil',
    close: 'Luk bogen',
    coins: (n) => `${n} ${n === 1 ? 'mønt' : 'mønter'}`, stars: (n) => `${n} ${n === 1 ? 'Stjerne' : 'Stjerner'}`,
    noHeroes: 'Ingen helte endnu.', theParty: 'Flokken',
  },
});

export async function openGmScreen(ctx) {
  await ensureCss();
  const { state, content, ui, audio } = ctx;
  let tab = 'party';
  let heroId = state.party[0]?.id || null;
  let selItem = null;
  let done = false, resolveDone;
  const finished = new Promise((r) => { resolveDone = r; });

  const tabBtns = {};
  const tabsEl = h('div.lfg-tabs', Object.entries(STR.tabs).map(([id, label]) => {
    const b = h('button.lfg-tab', { type: 'button', dataset: { tab: id } }, h('span', label));
    tap(b, () => setTab(id), ctx, { sfx: 'ui.page' });
    tabBtns[id] = b;
    return b;
  }));
  const pages = h('div.lfg-pages');
  const closeBtn = ui.button(null, { kind: 'ghost', icon: 'close', cls: 'lf-btn--icon lfg-close', onClick: () => close(), attrs: { 'aria-label': STR.close } });
  const drawer = h('div.lfg-drawer');
  const drawerBtn = h('button.lfg-drawer-btn', { type: 'button' }, ui.icon('book'), h('span', STR.shortcuts));
  tap(drawerBtn, () => toggleDrawer(), ctx);
  const purse = h('div.lfg-purse', h('span', ui.icon('coin'), h('b', String(state.gold))), h('span', ui.icon('star'), h('b', String(state.stars))));
  const book = h('div.lfg-book',
    h('div.lfg-cover'),
    h('div.lfg-top', h('div.lfg-booktitle', STR.book), tabsEl, purse, closeBtn),
    pages, drawerBtn, drawer);
  const root = h('div.lfg', { 'data-no-advance': '' }, book);
  root.addEventListener('pointerdown', (e) => { if (e.target === root) close(); });
  const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
  window.addEventListener('keydown', onKey);
  const offState = ctx.bus.on('state:changed', () => { if (!done) purse.replaceChildren(h('span', ui.icon('coin'), h('b', String(state.gold))), h('span', ui.icon('star'), h('b', String(state.stars)))); });

  render();
  ctx.stage.layers.overlay.appendChild(root);
  audio.sfx('ui.open');
  audio.sfx('ui.page', { volume: 0.6 });
  await ctx.sleep(20);
  root.classList.add('is-in');
  if (ctx.auto) ctx.sleep(900).then(close);
  await finished;
  return;

  // ---------- frame ----------
  function setTab(id) {
    if (tab === id) return;
    tab = id;
    selItem = null;
    pages.classList.remove('is-turn'); void pages.offsetWidth; pages.classList.add('is-turn');
    render();
  }

  function render() {
    for (const [id, b] of Object.entries(tabBtns)) b.classList.toggle('is-on', id === tab);
    const [l, r] = tab === 'party' ? partyPages() : tab === 'quests' ? questPages() : tab === 'chronicle' ? chroniclePages() : mapPages();
    pages.className = `lfg-pages is-${tab}` + (pages.classList.contains('is-turn') ? ' is-turn' : '');
    if (tab === 'map') pages.replaceChildren(l);
    else pages.replaceChildren(h('div.lfg-page.is-left.lf-scroll', l), h('div.lfg-gutter'), h('div.lfg-page.is-right.lf-scroll', r));
  }

  async function close() {
    if (done) return;
    done = true;
    window.removeEventListener('keydown', onKey);
    offState();
    audio.sfx('ui.close');
    root.classList.remove('is-in');
    root.classList.add('is-out');
    await ctx.sleep(420);
    root.remove();
    resolveDone();
  }

  // ---------- Party ----------
  function partyPages() {
    const hero = state.hero(heroId) || state.party[0];
    if (!hero) return [h('p.lfg-empty', STR.noHeroes), h('div')];
    const hc = content.heroes?.[hero.arch] || {};
    const picker = h('div.lfg-heroes', state.party.map((x) => {
      const b = h('button.lfg-heropick', { type: 'button', class: x.id === hero.id ? 'is-on' : null }, ui.portrait(x.id, 'sm'), h('span', x.name.split(' ')[0]));
      tap(b, () => { heroId = x.id; render(); }, ctx, { sfx: 'ui.page' });
      return b;
    }));
    const artSrc = ctx.assets.char(hero.arch);
    const art = h('div.lfg-art');
    if (ctx.assets.has(artSrc) === false) art.appendChild(ui.portrait(hero.id, 'lg'));
    else { const img = h('img', { src: artSrc, alt: hero.name, draggable: 'false' }); img.onerror = () => img.replaceWith(ui.portrait(hero.id, 'lg')); art.appendChild(img); }
    const maxHp = hero.maxHp || R.maxHp(hero);
    const bar = h('div.lf-bar', { class: hero.hp / maxHp < 0.34 ? 'is-low' : null, style: { '--v': String(Math.max(0, hero.hp / maxHp)) } }, h('i'));
    const stats = h('div.lfg-stats', R.STATS.map((s) => {
      const v = R.statValue(hero, s), base = hero.stats?.[s] ?? 0;
      const chip = ui.statChip(s, v);
      if (v !== base) chip.classList.add('is-boosted');
      return chip;
    }));
    const left = [
      picker,
      h('div.lfg-sheet',
        art,
        h('div.lfg-id',
          h('div.lf-kicker', `${hc.calling || hero.arch} · ${STR.level(hero.level || 1)}`),
          h('h2.lfg-name', hero.name),
          h('div.lfg-hearts', ui.icon('heart'), h('b', `${hero.hp} / ${maxHp}`), h('span', STR.hearts)),
          bar,
          h('div.lfg-guard', ui.icon('shield'), h('b', String(R.guard(hero))), h('span', STR.guard)),
          stats)),
      h('div.lfg-block',
        h('h4', ui.icon('talent'), STR.talent),
        h('p', h('b', hc.talent?.name || R.TALENT_NAMES[hero.talent] || hero.talent), hc.talent?.text ? ` · ${hc.talent.text}` : '')),
    ];

    const powers = (hc.powers || []).map((p) => {
      const locked = p.great && (hero.level || 1) < 3;
      return h('div.lfg-power', { class: [p.great ? 'is-great' : '', locked ? 'is-locked' : ''].filter(Boolean).join(' ') || null },
        h('div.lfg-power-head', h('b', p.name), h('span.lfg-cost', locked ? ui.icon('lock') : ui.icon('spark'), locked ? STR.greatLocked : STR.cost(p.cost))),
        h('p', p.text));
    });
    const perks = (hero.perks || []).filter((p) => p && typeof p === 'object');
    const trinket = hero.trinket ? content.items?.[hero.trinket] : null;
    const trinketEl = trinket
      ? h('div.lfg-trinket', ui.itemImg(hero.trinket, 64), h('div', h('b', trinket.name), h('p', itemEffect(trinket))), (() => {
        const b = ui.button(STR.takeOff, { kind: 'ghost', onClick: () => { state.equip(hero.id, null); audio.sfx('item.get'); render(); } });
        b.classList.add('lfg-small-btn');
        return b;
      })())
      : h('p.lfg-muted', STR.noTrinket);
    const right = [
      h('div.lfg-block', h('h4', ui.icon('spark'), STR.powers), powers.length ? powers : h('p.lfg-muted', '...')),
      h('div.lfg-block', h('h4', ui.icon('star'), STR.perks), perks.length ? perks.map((p) => h('p', h('b', p.name), p.text ? ` · ${p.text}` : '')) : h('p.lfg-muted', STR.noPerks)),
      h('div.lfg-block', h('h4', ui.icon('shield'), STR.trinket), trinketEl),
      bagBlock(hero),
    ];
    return [left, right];
  }

  function bagBlock(hero) {
    const entries = Object.entries(state.inventory).filter(([, q]) => q > 0);
    const order = { consumable: 0, trinket: 1, quest: 2 };
    entries.sort((a, b) => (order[content.items?.[a[0]]?.kind] ?? 3) - (order[content.items?.[b[0]]?.kind] ?? 3));
    const grid = h('div.lfg-bag', entries.map(([id, q]) => {
      const it = content.items?.[id] || { name: id, kind: 'quest' };
      const b = h('button.lfg-bagitem', { type: 'button', class: selItem === id ? 'is-on' : null, dataset: { kind: it.kind }, title: it.name }, ui.itemImg(id, 52), q > 1 ? h('span.lf-badge', String(q)) : null);
      tap(b, () => { selItem = selItem === id ? null : id; render(); }, ctx);
      return b;
    }));
    let detail = null;
    if (selItem && state.inventory[selItem]) {
      const it = content.items?.[selItem] || { name: selItem, kind: 'quest', text: '' };
      const acts = [];
      const first = hero.name.split(' ')[0];
      if (it.kind === 'consumable') {
        const can = canUseOutside(ctx, it);
        const all = it.use?.who === 'all' || it.use?.star;
        const b = ui.button(can.ok ? (all ? STR.useAll : STR.useOn(first)) : can.why, { kind: 'gold', onClick: () => {
          if (!can.ok) return;
          const id = selItem;
          if (useOutside(ctx, id, hero.id)) {
            ui.toast(STR.used(it.name, all ? STR.theParty : first), { icon: id, kind: 'item', sub: itemEffect(it) });
            if (!state.inventory[id]) selItem = null;
            render();
          }
        } });
        if (!can.ok) b.setAttribute('aria-disabled', 'true');
        acts.push(b);
      } else if (it.kind === 'trinket') {
        acts.push(ui.button(STR.wear(first), { kind: 'gold', onClick: () => { const id = selItem; selItem = null; state.equip(hero.id, id); audio.sfx('levelup', { volume: 0.5 }); render(); } }));
      }
      detail = h('div.lfg-itemdetail.lf-parch', ui.itemImg(selItem, 72), h('div', h('b', it.name), h('div.lfg-effect', itemEffect(it)), h('p', it.text || '')), acts.length ? h('div.lfg-itemacts', acts) : null);
      anim(detail, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], 260);
      const d = detail;
      requestAnimationFrame(() => d.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    }
    return h('div.lfg-block', h('h4', bagIcon(), STR.bag), entries.length ? grid : h('p.lfg-muted', STR.emptyBag), detail);
  }

  // ---------- Quests ----------
  function questPages() {
    const open = state.quests.filter((q) => !q.done), fin = state.quests.filter((q) => q.done);
    const q = (x, isDone) => h('div.lfg-quest', { class: isDone ? 'is-done' : null }, h('span.lfg-seal', isDone ? ui.icon('check') : ui.icon('star')), h('div', h('b', x.title || x.id), x.text ? h('p', x.text) : null));
    return [
      [h('h3.lfg-pagetitle', STR.quests), open.length ? open.map((x) => q(x, false)) : h('p.lfg-muted', STR.noQuests)],
      [h('h3.lfg-pagetitle', STR.questsDone), fin.length ? fin.map((x) => q(x, true)) : h('p.lfg-muted', STR.noDone)],
    ];
  }

  // ---------- Chronicle ----------
  function chroniclePages() {
    const entries = state.journal || [];
    if (!entries.length) return [[h('h3.lfg-pagetitle', STR.chronicle), h('p.lfg-muted', STR.noJournal)], [h('div.lfg-flourish')]];
    const blocks = [];
    let lastScene = null;
    entries.forEach((e, i) => {
      if (e.scene && e.scene !== lastScene) {
        lastScene = e.scene;
        blocks.push(h('div.lfg-chron-scene', content.scenes?.[e.scene]?.title || e.scene.replace(/_/g, ' ')));
      }
      blocks.push(h('p.lfg-chron', { class: i === 0 ? 'is-first' : null }, e.text));
    });
    const half = Math.ceil(blocks.length / 2);
    let cut = half;
    while (cut < blocks.length && blocks[cut].classList.contains('lfg-chron') && blocks[cut - 1]?.classList.contains('lfg-chron-scene')) cut++;
    return [[h('h3.lfg-pagetitle', STR.chronicle), ...blocks.slice(0, cut)], [...blocks.slice(cut), h('div.lfg-flourish')]];
  }

  // ---------- Map ----------
  function mapPages() {
    const map = content.map || { nodes: [], path: [] };
    const seen = (id) => state.flag(`seen.${id}`) || state.scene === id;
    const visited = (map.path || []).filter(seen);
    const nodes = Object.fromEntries((map.nodes || []).map((n) => [n.id, n]));
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 1280 800');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('class', 'lfg-map-svg');
    const line = (ids) => ids.map((id) => nodes[id]).filter(Boolean).map((n) => `${n.x},${n.y}`).join(' ');
    let inner = `<polyline points="${line(map.path || [])}" fill="none" stroke="rgba(58,42,20,.45)" stroke-width="3" stroke-dasharray="2 12" stroke-linecap="round"/>`;
    if (visited.length > 1) inner += `<polyline points="${line(visited)}" fill="none" stroke="#a3301c" stroke-width="5" stroke-dasharray="4 12" stroke-linecap="round"/>`;
    svg.innerHTML = inner;
    const here = nodes[state.scene] ? state.scene : visited[visited.length - 1];
    const marks = (map.nodes || []).map((n) => {
      const v = seen(n.id), cur = n.id === here;
      return h('div.lfg-node', { class: [v ? 'is-seen' : '', cur ? 'is-here' : ''].filter(Boolean).join(' ') || null, style: { left: `${n.x / 12.8}%`, top: `${n.y / 8}%` } },
        h('i'), v ? h('span', n.label) : null, cur ? h('em', STR.here) : null);
    });
    const bg = ctx.assets.bg('world_map');
    const mapEl = h('div.lfg-mapwrap', h('div.lfg-map', { style: ctx.assets.has(bg) === false ? null : { backgroundImage: `url("${bg}")` } }, svg, marks,
      h('div.lfg-map-kicker.lf-kicker', STR.mapKicker)));
    return [mapEl];
  }

  // ---------- shortcuts ----------
  function toggleDrawer() {
    const open = !drawer.classList.contains('is-open');
    if (open && !drawer.childElementCount) {
      const list = Object.values(content.scenes || {}).map((sc) => {
        const go = h('button.lfg-jump', { type: 'button' }, h('b', sc.title || sc.id), h('small', sc.id));
        tap(go, () => jump(sc.id), ctx);
        return go;
      });
      drawer.append(h('div.lfg-drawer-head', h('b', STR.shortcuts), h('small', STR.shortcutsSub)), h('div.lfg-drawer-list.lf-scroll', list));
    }
    drawer.classList.toggle('is-open', open);
    drawerBtn.classList.toggle('is-on', open);
  }

  function jump(sceneId) {
    const p = new URLSearchParams(location.search);
    p.set('scene', sceneId);
    p.set('party', state.party.map((x) => x.arch).join(',') || 'knight,wizard');
    p.set('level', String(Math.max(1, ...state.party.map((x) => x.level || 1))));
    audio.sfx('ui.confirm');
    location.href = location.pathname + '?' + p.toString();
  }
}

function bagIcon() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', 'lf-icon');
  s.innerHTML = '<path d="M8.5 6.5c-.8-2 .6-3.5 3.5-3.5s4.3 1.5 3.5 3.5M7 7h10c2.5 3 4 6.5 3.5 10-.5 3-3 4.5-8.5 4.5S4 20 3.5 17C3 13.5 4.5 10 7 7z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>';
  return s;
}
