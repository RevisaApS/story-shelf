// Party screen (SPEC 11): partyScreen(ctx) -> void, fills state.party.
// Six hero cards on the candlelit table. Tap to seat a hero (1 to 4), tap again to stand them up,
// rename with the pencil. Each pick plays the hero's spoken intro through the narrator.
import { h, tap, wait } from '../ui/dom.js';
import * as R from '../core/rules.js';
import { L } from '../core/i18n.js';

const STR = L({
  en: {
    kicker: 'The Storykeeper asks',
    title: 'Who is at the table tonight?',
    sub: 'Tap a hero to join. Pick one to four.',
    begin: 'Begin the adventure',
    pickOne: 'Pick at least one hero',
    seated: (n) => (n === 1 ? 'One hero at the table' : `${['', 'One', 'Two', 'Three', 'Four'][n]} heroes at the table`),
    full: 'The table is full',
    talent: 'Talent',
    powers: 'Powers',
    renameTitle: 'A new name',
    renameKicker: (calling) => `Rename the ${calling}`,
    save: 'Save', cancel: 'Cancel', reset: 'Default',
    seat: (n) => `Seat ${n}`,
    rename: 'Rename',
  },
  da: {
    kicker: 'Sagnvogteren spørger',
    title: 'Hvem sidder ved bordet i aften?',
    sub: 'Tryk på en helt. Vælg fra én til fire.',
    begin: 'Begynd eventyret',
    pickOne: 'Vælg mindst én helt',
    seated: (n) => (n === 1 ? 'Én helt ved bordet' : `${['', 'Én', 'To', 'Tre', 'Fire'][n]} helte ved bordet`),
    full: 'Bordet er fuldt',
    talent: 'Talent',
    powers: 'Kræfter',
    renameTitle: 'Et nyt navn',
    renameKicker: (calling) => `Nyt navn til din ${String(calling).toLowerCase()}`,
    save: 'Gem', cancel: 'Fortryd', reset: 'Standard',
    seat: (n) => `Plads ${n}`,
    rename: 'Omdøb',
  },
});

const MAX = 4;

function heroArt(ctx, arch, name) {
  const wrap = h('div.sa-hc-art');
  const src = ctx.assets.char(arch);
  const fallback = () => wrap.replaceChildren(h('div.sa-hc-artph', ctx.ui.portrait(arch, 'lg')));
  if (ctx.assets.has(src) === false) fallback();
  else {
    const img = h('img.sa-hc-img', { alt: name, draggable: 'false' });
    img.onerror = fallback;
    img.src = src;
    wrap.appendChild(img);
  }
  return wrap;
}

const pencil = () => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.innerHTML = '<path d="M4 20l1.2-4.6L15.8 4.8a2 2 0 012.8 0l.6.6a2 2 0 010 2.8L8.6 18.8z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M13.8 6.8l3.4 3.4" stroke="currentColor" stroke-width="1.7"/>';
  return s;
};

export async function partyScreen(ctx) {
  const { ui } = ctx;
  const layer = ctx.stage.layers.screen;
  const heroes = ctx.content?.heroes || {};
  const order = R.ARCH_ORDER.filter((a) => R.ARCH[a]);
  const names = {};
  const picked = [];
  ctx.gm?.hide?.();
  ctx.hud?.hide?.();
  ctx.weather?.set?.('none');
  ctx.stage.setBg('party_table', { fade: 1.2 });
  ctx.audio.music('title');

  const caption = h('div.sa-party-say');
  const captionWrap = h('div.sa-party-quill', ui.portrait('gm', 'sm'), caption);
  const counter = h('div.sa-party-count');
  const begin = ui.button(STR.begin, { kind: 'primary', size: 'lg', cls: 'sa-party-begin', sfx: 'ui.confirm' });
  const cards = {};

  let sayToken = 0;
  const say = (text) => {
    if (!text) return;
    const tok = ++sayToken;
    caption.classList.remove('is-on');
    setTimeout(() => {
      if (tok !== sayToken) return;
      caption.textContent = text;
      caption.classList.add('is-on');
    }, 160);
    ctx.gm?.aside?.(text, { mood: 'warm' });
  };

  const refresh = () => {
    const n = picked.length;
    for (const arch of order) {
      const c = cards[arch];
      const i = picked.indexOf(arch);
      c.el.classList.toggle('is-picked', i >= 0);
      c.el.classList.toggle('is-muted', i < 0 && n >= MAX);
      c.seat.textContent = i >= 0 ? String(i + 1) : '';
      c.el.setAttribute('aria-pressed', i >= 0 ? 'true' : 'false');
      c.name.textContent = names[arch] || heroes[arch]?.name || R.DEFAULT_NAMES[arch];
    }
    counter.textContent = n ? (n >= MAX ? STR.full : STR.seated(n)) : STR.pickOne;
    begin.disabled = !n;
    begin.classList.toggle('is-ready', !!n);
  };

  const toggle = (arch) => {
    const i = picked.indexOf(arch);
    const c = cards[arch];
    if (i >= 0) {
      picked.splice(i, 1);
      ctx.audio.sfx('ui.close');
      c.el.classList.remove('is-pop');
    } else {
      if (picked.length >= MAX) {
        ctx.audio.sfx('ui.deny');
        c.el.classList.remove('is-nope'); void c.el.offsetWidth; c.el.classList.add('is-nope');
        return;
      }
      picked.push(arch);
      ctx.audio.sfx('ui.confirm');
      ctx.audio.sfx('star.gain', { volume: 0.5 });
      c.el.classList.remove('is-pop'); void c.el.offsetWidth; c.el.classList.add('is-pop');
      say(heroes[arch]?.intro);
    }
    refresh();
  };

  const rename = async (arch) => {
    const hc = heroes[arch] || {};
    const def = hc.name || R.DEFAULT_NAMES[arch];
    const input = h('input.sa-rename-input', { type: 'text', maxlength: '22', value: names[arch] || def, spellcheck: 'false', autocomplete: 'off', 'data-no-advance': '' });
    let closeFn = null;
    input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') closeFn?.('save'); if (e.key === 'Escape') closeFn?.('cancel'); });
    const id = await ui.modal({
      kicker: STR.renameKicker(hc.calling || arch), title: STR.renameTitle, cls: 'sa-rename',
      body: h('div.sa-rename-body', ui.portrait(arch, 'md'), input),
      buttons: [{ id: 'save', label: STR.save, kind: 'primary', auto: true }, { id: 'default', label: STR.reset, kind: 'ghost' }, { id: 'cancel', label: STR.cancel, kind: 'ghost' }],
      onOpen: (_box, close) => { closeFn = close; setTimeout(() => { input.focus(); input.select(); }, 80); },
    });
    if (id === 'save') {
      const v = input.value.replace(/\s+/g, ' ').trim().slice(0, 22);
      if (v && v !== def) names[arch] = v; else delete names[arch];
    } else if (id === 'default') delete names[arch];
    refresh();
  };

  const grid = h('div.sa-party-grid');
  order.forEach((arch, idx) => {
    const hc = heroes[arch] || {};
    const base = R.ARCH[arch];
    const stats = hc.stats || base.stats;
    const powers = (hc.powers || []).filter((p) => !p.great).slice(0, 2);
    const name = h('div.sa-hc-name');
    const seat = h('div.sa-hc-seat');
    const pen = h('button.sa-hc-pen', { type: 'button', 'aria-label': STR.rename, title: STR.rename }, pencil());
    const el = h('div.sa-hc', { role: 'button', tabindex: '0', dataset: { arch }, style: { '--hc': ui.heroColor(arch), '--i': idx } },
      h('div.sa-hc-frame'),
      h('div.sa-hc-halo'),
      heroArt(ctx, arch, hc.name || R.DEFAULT_NAMES[arch]),
      seat, pen,
      h('div.sa-hc-info',
        h('div.sa-hc-calling', hc.calling || arch),
        name,
        h('div.sa-hc-stats', R.STATS.map((s) => h('span.sa-hc-stat', { dataset: { stat: s } }, h('i'), h('span', R.STAT_NAMES[s]), h('b', String(stats[s] ?? 0))))),
        h('div.sa-hc-talent', ui.icon('talent'), h('span', hc.talent?.name || R.TALENT_NAMES[base.talent] || STR.talent)),
        h('div.sa-hc-powers', powers.map((p) => h('div.sa-hc-power', ui.icon('spark'), h('span', p.name))))));
    tap(el, (e) => { if (e.target.closest('.sa-hc-pen')) return; toggle(arch); }, ctx, { sfx: null });
    el.addEventListener('pointerdown', () => ctx.audio.sfx('ui.tap'));
    el.addEventListener('keydown', (e) => { if (e.target !== el) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggle(arch); } });
    tap(pen, (e) => { e.stopPropagation(); rename(arch); }, ctx);
    cards[arch] = { el, name, seat };
    grid.appendChild(el);
  });

  let resolveDone;
  const doneP = new Promise((r) => { resolveDone = r; });
  tap(begin, () => { if (picked.length) resolveDone(); }, ctx, { sfx: null });

  const root = h('div.sa-party',
    h('div.sa-party-shade'),
    h('header.sa-party-head',
      h('div.lf-kicker', STR.kicker),
      h('h1.lf-title.sa-party-title', STR.title),
      h('div.sa-party-hint', STR.sub)),
    grid,
    h('footer.sa-party-foot', captionWrap, h('div.sa-party-go', counter, begin)));
  layer.appendChild(root);
  refresh();
  await wait(30);
  root.classList.add('is-in');
  setTimeout(() => Object.values(cards).forEach((c) => c.el.classList.add('is-settled')), 1400 / (window.__LF_SPEED || 1));
  ctx.sleep(700).then(() => say(ctx.gm?.line?.('party.ask') || STR.title));

  if (ctx.auto) {
    (async () => {
      const want = String(ctx.params?.party || '').split(',').map((s) => s.trim()).filter((a) => R.ARCH[a]);
      const list = (want.length ? want : order.slice(0, 2)).slice(0, MAX);
      for (const a of list) { await ctx.sleep(500); if (!picked.includes(a)) toggle(a); }
      await ctx.sleep(700);
      resolveDone();
    })();
  }

  await doneP;
  ctx.state.setParty(picked.map((arch) => ({ arch, name: names[arch] || null })));
  ctx.audio.sfx('fanfare.small');
  const ready = ctx.gm?.line?.('party.ready');
  root.classList.add('is-leaving');
  if (ready) say(ready);
  await ctx.sleep(ready ? 1900 : 900);
  root.remove();
}
