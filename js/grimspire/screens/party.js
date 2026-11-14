// Hunter picking (GRIMSPIRE.md 3.3). gsParty(ctx) -> void, fills state.party.
// Six tall cards: cutout art (placeholder without it), name, role, weapon family and the skills. Tap to pick
// (1 to 4, numbered in order), tap again to put back, pencil to rename. Each pick speaks the hunter's intro.
import { h, tap, wait } from '../../ui/dom.js';
import { L } from '../../core/i18n.js';
import { icon, art, portrait, heroColor, sfx, say, STRC } from '../hud.js';

const STR = L({
  en: {
    kicker: 'The Last Hearth', title: 'Who climbs tonight?', sub: 'Pick one to four hunters. Each player takes one.',
    go: 'To the hunt', pickOne: 'Pick at least one hunter', count: (n) => (n === 1 ? 'One hunter' : `${['', 'One', 'Two', 'Three', 'Four'][n]} hunters`), full: 'The party is full',
    skills: 'Skills', ult: 'Ultimate', lv: (n) => `Lv ${n}`, rename: 'Rename', renameTitle: 'A new name', save: 'Save', reset: 'Default', cancel: 'Cancel',
  },
  da: {
    kicker: 'Det Sidste Bål', title: 'Hvem klatrer i nat?', sub: 'Vælg fra én til fire jægere. Hver spiller tager én.',
    go: 'Til jagten', pickOne: 'Vælg mindst én jæger', count: (n) => (n === 1 ? 'Én jæger' : `${['', 'Én', 'To', 'Tre', 'Fire'][n]} jægere`), full: 'Holdet er fuldt',
    skills: 'Evner', ult: 'Ultimativ', lv: (n) => `Nv ${n}`, rename: 'Omdøb', renameTitle: 'Et nyt navn', save: 'Gem', reset: 'Standard', cancel: 'Fortryd',
  },
});
const ORDER = ['dragonknight', 'shadow', 'stormmage', 'hunter', 'berserker', 'gravewarden'];
const MAX = 4;

export async function gsParty(ctx) {
  const { ui } = ctx;
  const heroes = ctx.content.heroes || {};
  const order = ORDER.filter((a) => heroes[a]);
  const layer = ctx.stage.layers.screen;
  const picked = [];
  const names = {};
  ctx.gm.hide(); ctx.hud.hide();
  ctx.stage.setBg('gs_camp', { fade: 1 });
  ctx.audio.music('gs_camp');

  const caption = h('div.gs-party-say');
  const counter = h('div.gs-party-count');
  const go = ui.button(STR.go, { kind: 'primary', size: 'lg', sfx: 'ui.confirm', cls: 'gs-party-go' });
  const cards = {};
  let tok = 0;
  const speak = (text, mood = 'grand') => {
    if (!text) return;
    const t = ++tok;
    caption.classList.remove('is-on');
    setTimeout(() => { if (t !== tok) return; caption.textContent = text; caption.classList.add('is-on'); }, 140);
    ctx.gm.aside?.(text, { mood });
  };
  const refresh = () => {
    for (const arch of order) {
      const c = cards[arch];
      const i = picked.indexOf(arch);
      c.el.classList.toggle('is-picked', i >= 0);
      c.el.classList.toggle('is-muted', i < 0 && picked.length >= MAX);
      c.seat.textContent = i >= 0 ? String(i + 1) : '';
      c.el.setAttribute('aria-pressed', String(i >= 0));
      c.name.textContent = names[arch] || heroes[arch].name;
    }
    counter.textContent = picked.length ? (picked.length >= MAX ? STR.full : STR.count(picked.length)) : STR.pickOne;
    go.disabled = !picked.length;
    go.classList.toggle('is-ready', !!picked.length);
  };
  const toggle = (arch) => {
    const c = cards[arch];
    const i = picked.indexOf(arch);
    if (i >= 0) { picked.splice(i, 1); sfx(ctx, 'ui.close'); }
    else {
      if (picked.length >= MAX) { sfx(ctx, 'ui.deny'); c.el.classList.remove('is-nope'); void c.el.offsetWidth; c.el.classList.add('is-nope'); return; }
      picked.push(arch);
      sfx(ctx, 'ui.confirm'); sfx(ctx, 'gs.swing', { volume: 0.6 });
      c.el.classList.remove('is-pop'); void c.el.offsetWidth; c.el.classList.add('is-pop');
      speak(heroes[arch].intro);
    }
    refresh();
  };
  const rename = async (arch) => {
    const def = heroes[arch].name;
    const input = h('input.gs-rename-input', { type: 'text', maxlength: '22', value: names[arch] || def, spellcheck: 'false', autocomplete: 'off', 'data-no-advance': '' });
    let closeFn = null;
    input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') closeFn?.('save'); if (e.key === 'Escape') closeFn?.('cancel'); });
    const id = await ui.modal({
      kicker: heroes[arch].role, title: STR.renameTitle, cls: 'gs-rename',
      body: h('div.gs-rename-body', portrait(ctx, arch, 'md'), input),
      buttons: [{ id: 'save', label: STR.save, kind: 'primary', auto: true }, { id: 'default', label: STR.reset, kind: 'ghost' }, { id: 'cancel', label: STR.cancel, kind: 'ghost' }],
      onOpen: (_b, close) => { closeFn = close; setTimeout(() => { input.focus(); input.select(); }, 80); },
    });
    if (id === 'save') { const v = input.value.replace(/\s+/g, ' ').trim().slice(0, 22); if (v && v !== def) names[arch] = v; else delete names[arch]; }
    else if (id === 'default') delete names[arch];
    refresh();
  };

  const grid = h('div.gs-party-grid');
  order.forEach((arch, idx) => {
    const hc = heroes[arch];
    const skills = (hc.skills || []).slice().sort((a, b) => (a.level || 1) - (b.level || 1));
    const name = h('div.gs-hc-name');
    const seat = h('div.gs-hc-seat');
    const pen = h('button.gs-hc-pen', { type: 'button', 'aria-label': STR.rename, title: STR.rename }, icon('pencil'));
    const el = h('div.gs-hc', { role: 'button', tabindex: '0', dataset: { arch }, style: { '--hc': heroColor(arch), '--i': idx } },
      h('div.gs-hc-glow'),
      art(ctx, 'char', `gs_${arch}`, { cls: 'gs-hc-art', label: hc.name }),
      h('div.gs-hc-fade'),
      seat, pen,
      h('div.gs-hc-info',
        h('div.gs-hc-role', hc.role || ''),
        name,
        h('div.gs-hc-fam', icon(hc.family || 'sword'), h('span', STRC.families[hc.family] || hc.family || '')),
        h('div.gs-hc-skills', skills.map((s) => h('div.gs-hc-skill', { class: s.ultimate ? 'is-ult' : null },
          h('span', s.name), h('small', s.ultimate ? STR.ult : STR.lv(s.level || 1)))))));
    tap(el, (e) => { if (e.target.closest('.gs-hc-pen')) return; toggle(arch); }, ctx, { sfx: null });
    el.addEventListener('keydown', (e) => { if (e.target !== el) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggle(arch); } });
    tap(pen, (e) => { e.stopPropagation(); rename(arch); }, ctx);
    cards[arch] = { el, name, seat };
    grid.appendChild(el);
  });

  let done;
  const doneP = new Promise((r) => { done = r; });
  tap(go, () => { if (picked.length) done(); }, ctx, { sfx: null });
  const root = h('div.gs-party', { 'data-no-advance': '' },
    h('div.gs-party-shade'),
    h('header.gs-party-head', h('div.gs-kicker', STR.kicker), h('h1.gs-title', STR.title), h('div.gs-sub', STR.sub)),
    grid,
    h('footer.gs-party-foot', h('div.gs-party-varg', portrait(ctx, 'gs_varg', 'sm'), caption), h('div.gs-party-goes', counter, go)));
  layer.appendChild(root);
  refresh();
  await wait(30);
  root.classList.add('is-in');
  ctx.sleep(700).then(() => speak(ctx.gm.line?.('party.ask') || STR.title, 'warm'));

  if (ctx.auto) {
    (async () => {
      const want = String(new URLSearchParams(location.search).get('party') || '').split(',').filter((a) => heroes[a]);
      for (const a of (want.length ? want : order.slice(0, 3)).slice(0, MAX)) { await ctx.sleep(400); if (!picked.includes(a)) toggle(a); }
      await ctx.sleep(500); done();
    })();
  }
  await doneP;
  ctx.state.setParty(picked.map((arch) => ({ arch, name: names[arch] || null })));
  sfx(ctx, 'gs.roar', { volume: 0.5 });
  root.classList.add('is-leaving');
  const ready = ctx.gm.line?.('party.ready');
  if (ready) speak(ready, 'fierce');
  await ctx.sleep(ready ? 1800 : 800);
  root.remove();
  ctx.gm.hide();
  void say;
}
