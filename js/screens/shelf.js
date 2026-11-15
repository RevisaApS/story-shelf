// The shelf (ROUND2 1): shelfScreen(ctx, packs) -> packId
// The first thing a family sees: one large painted card per pack on the candlelit table, each with its honest label
// (ages first), and the language switch top right. A card tilts a little toward the pointer and glows on hover or
// focus. Switching language saves settings.lang and reloads the page. "Who is playing?" (top left) holds the
// player's name for the play log; a tablet that has never been asked gets the question before a story opens.
// Styles: css/shelf.css.
import { h, tap, wait } from '../ui/dom.js';
import { L, tr, getLang } from '../core/i18n.js';
import { lanternSky } from './title.js';
import { install } from '../core/install.js';
import { countingOff, setCounting, getPlayer, setPlayer, knownPlayers, playerAsked, markPlayerAsked } from '../core/playlog.js';

const STR = L({
  en: {
    kicker: 'Tonight at the table', title: 'Choose a story', play: 'Play', lang: 'Language', foot: 'Every story can be read aloud or listened to.',
    close: 'Close', parents: 'For parents', install: 'Install as app',
    howTitle: 'Put the game on the home screen',
    howLead: 'Then it opens full screen from its own icon, like any other app.',
    how: {
      android: ['Tap the three dots at the top right of the browser.', 'Choose "Add to Home screen" or "Install app".', 'Open the game from the new icon.'],
      ios: ['Tap the Share button in Safari (the square with an arrow).', 'Choose "Add to Home Screen".', 'Open the game from the new icon.'],
      other: ['Open this page on the tablet, in Chrome.', 'Tap "Install as app" there.', 'Open the game from the new icon.'],
    },
    noteTitle: 'For parents',
    note: [
      [null, 'Lanternfall and Grimspire are two story games a dad made for his own boys. This is an early test version. It is free, with no ads, no purchases and no account.'],
      ['What we count', 'Which game is opened, battles won and lost, level, how long a visit lasts, and errors in the game. We use it only to make the games better.'],
      ['The name', 'The name typed under "Who is playing?" is stored with the counts, so we can see who played what. A first name or a nickname is enough, and the field can be left empty.'],
      ['What we do not store', 'Anything else your child types or says, e-mail, or where you are. The tablet gets a random number, so we can see whether the same tablet comes back.'],
      ['Where it is kept', 'The numbers are kept in the EU (Ireland) with Supabase. The game itself is fetched from GitHub. Your saved games stay on this tablet only.'],
    ],
    countOn: 'Counting is on for this tablet.', countOff: 'Counting is off for this tablet.', turnOff: 'Turn off', turnOn: 'Turn on',
    by: 'Revisa ApS, Denmark',
    who: 'Who is playing?', whoNew: 'Write your name', ok: 'OK', skip: 'Skip',
  },
  da: {
    kicker: 'I aften ved bordet', title: 'Vælg en historie', play: 'Spil', lang: 'Sprog', foot: 'Alle historier kan læses højt eller lyttes til.',
    close: 'Luk', parents: 'Til forældre', install: 'Installer som app',
    howTitle: 'Læg spillet på startskærmen',
    howLead: 'Så åbner det i fuld skærm fra sit eget ikon, som enhver anden app.',
    how: {
      android: ['Tryk på de tre prikker øverst til højre i browseren.', 'Vælg "Føj til startskærm" eller "Installer app".', 'Åbn spillet fra det nye ikon.'],
      ios: ['Tryk på Del-knappen i Safari (firkanten med en pil).', 'Vælg "Føj til hjemmeskærm".', 'Åbn spillet fra det nye ikon.'],
      other: ['Åbn denne side på tabletten, i Chrome.', 'Tryk på "Installer som app" dér.', 'Åbn spillet fra det nye ikon.'],
    },
    noteTitle: 'Til forældre',
    note: [
      [null, 'Lygtefald og Grumspir er to eventyrspil, som en far har lavet til sine egne drenge. Det er en tidlig testudgave. Den er gratis, uden reklamer, uden køb og uden konto.'],
      ['Det tæller vi', 'Hvilket spil der åbnes, kampe der vindes og tabes, niveau, hvor længe et besøg varer, og fejl i spillet. Vi bruger det kun til at gøre spillene bedre.'],
      ['Navnet', 'Navnet, der skrives under "Hvem spiller?", gemmes sammen med tallene, så vi kan se, hvem der har spillet hvad. Et fornavn eller et kælenavn er nok, og feltet kan stå tomt.'],
      ['Det gemmer vi ikke', 'Andet, som jeres barn skriver eller siger, e-mail, eller hvor I er. Tabletten får et tilfældigt nummer, så vi kan se, om den samme tablet kommer igen.'],
      ['Her ligger det', 'Tallene ligger i EU (Irland) hos Supabase. Selve spillet hentes fra GitHub. Jeres gemte spil ligger kun på denne tablet.'],
    ],
    countOn: 'Tælling er slået til på denne tablet.', countOff: 'Tælling er slået fra på denne tablet.', turnOff: 'Slå fra', turnOn: 'Slå til',
    by: 'Revisa ApS, Danmark',
    who: 'Hvem spiller?', whoNew: 'Skriv dit navn', ok: 'OK', skip: 'Spring over',
  },
});
const LANG_NAMES = { da: 'Dansk', en: 'English' };

export async function shelfScreen(ctx, packs = []) {
  const layer = ctx.stage.layers.screen;
  ctx.gm?.hide?.();
  ctx.hud?.hide?.();
  ctx.weather?.set?.('none');

  // a tablet that has never been asked gets "Who is playing?" before a story opens (never on robot runs)
  const robot = !!(ctx.auto || ctx.fast || ctx.params?.auto || ctx.params?.fast);
  const mustAsk = () => !robot && !playerAsked();

  let resolvePick;
  const picked = new Promise((r) => { resolvePick = r; });
  let done = false;
  const pick = (id) => { if (done) return; done = true; resolvePick(id); };

  // ---- language switch
  const cur = getLang();
  const langBtns = ['da', 'en'].map((l) => {
    const b = h('button.sh-lang-opt', { type: 'button', class: l === cur ? 'is-on' : null, lang: l, 'aria-pressed': String(l === cur) }, LANG_NAMES[l]);
    tap(b, () => {
      if (l === getLang() || done) return;
      ctx.settings.lang = l;
      try { ctx.settings.save?.(); } catch { /* ignore */ }
      const q = new URLSearchParams(location.search);
      q.delete('lang');
      const s = q.toString();
      done = true;
      root.classList.add('is-leaving');
      setTimeout(() => { location.href = location.pathname + (s ? `?${s}` : ''); }, 260);
    }, ctx, { sfx: 'ui.confirm' });
    return b;
  });
  const langSwitch = h('div.sh-lang', { role: 'group', 'aria-label': STR.lang }, langBtns[0], h('span.sh-lang-dot'), langBtns[1]);

  // ---- cards
  const cards = packs.map((pack, i) => {
    const art = h('div.sh-card-art', h('img', { src: pack.art, alt: '', draggable: 'false', onerror: (e) => { e.target.remove(); } }), h('div.sh-card-art-fade'));
    const play = h('span.sh-card-play.lf-btn.lf-btn--primary.lf-btn--lg', h('span', STR.play));
    const lab = pack.label || {};
    const card = h('button.sh-card', { type: 'button', dataset: { pack: pack.id, theme: pack.theme || '' }, style: { '--i': i },
      'aria-label': `${tr(pack.title)}. ${tr(lab.ages) || ''}. ${tr(lab.tone) || ''}` },
    h('div.sh-card-in',
      art,
      h('div.sh-card-body',
        h('h2.sh-card-title', tr(pack.title)),
        h('div.sh-card-sub', tr(pack.sub)),
        h('div.sh-card-rule', h('i'), h('b'), h('i')),
        lab.ages ? h('div.sh-card-ages', tr(lab.ages)) : null,
        lab.tone ? h('div.sh-card-tone', tr(lab.tone)) : null,
        lab.play ? h('div.sh-card-playline', tr(lab.play)) : null,
        play)),
    h('div.sh-card-shine'));
    // tilt toward the pointer
    card.addEventListener('pointermove', (e) => {
      if (ctx.settings.reduceMotion) return;
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty('--ry', `${(x * 7).toFixed(2)}deg`);
      card.style.setProperty('--rx', `${(-y * 5).toFixed(2)}deg`);
      card.style.setProperty('--mx', `${((x + 0.5) * 100).toFixed(1)}%`);
      card.style.setProperty('--my', `${((y + 0.5) * 100).toFixed(1)}%`);
    });
    card.addEventListener('pointerleave', () => { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
    card.addEventListener('pointerenter', () => ctx.audio.sfx('ui.hover', { volume: 0.4 }));
    tap(card, () => { unlock(); if (mustAsk()) { askWho(true); return; } card.classList.add('is-picked'); pick(pack.id); }, ctx, { sfx: 'ui.confirm' });
    return card;
  });

  // ---- a panel over the shelf: the note to parents, or the steps to install
  let panel = null;
  let opener = null;
  // while a panel is open the shelf behind it takes no taps, focus or keys
  const setBehind = (off) => { for (const el of root.children) if (el !== panel) el.inert = off; };
  let onPanelClose = null;
  const closePanel = () => {
    if (!panel) return;
    panel.remove(); panel = null;
    setBehind(false);
    const after = onPanelClose; onPanelClose = null;
    try { after?.(); } catch { /* ignore */ }
    try { opener?.focus?.(); } catch { /* ignore */ }
    opener = null;
  };
  // opts: cls (an extra class on the panel), closeLabel, onClose (runs however the panel closes), focus (an element),
  // stay (a tap beside the card does not close it)
  const openPanel = (title, body, opts = {}) => {
    closePanel();
    opener = document.activeElement;
    const x = h('button.sh-panel-x.lf-btn', { type: 'button' }, h('span', opts.closeLabel || STR.close));
    panel = h('div.sh-panel', { class: opts.cls || null, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div.sh-panel-card', h('h2.sh-panel-title', title), h('div.sh-panel-body', body), x));
    if (!opts.stay) panel.addEventListener('pointerdown', (e) => { if (e.target === panel) closePanel(); });
    tap(x, closePanel, ctx);
    root.appendChild(panel);
    setBehind(true);
    onPanelClose = opts.onClose || null;
    (opts.focus || x).focus();
  };

  // ---- install as app (the published page only; hidden once it runs as an app)
  const steps = (list) => h('ol.sh-steps', list.map((t) => h('li', t)));
  const installBtn = h('button.sh-install', { type: 'button' }, h('span.sh-install-ico', { 'aria-hidden': 'true' }), h('span', STR.install));
  const showInstall = () => { installBtn.hidden = !install.offered(); };
  tap(installBtn, async () => {
    if (done) return;
    if (install.ready()) {
      const outcome = await install.prompt();
      ctx.playlog?.log('install', { outcome });
      if (outcome !== 'none') { showInstall(); return; }
    }
    ctx.playlog?.log('install', { outcome: 'steps', platform: install.platform() });
    openPanel(STR.howTitle, [h('p', STR.howLead), steps(STR.how[install.platform()] || STR.how.other)]);
  }, ctx, { sfx: 'ui.confirm' });
  const stopInstallWatch = install.onChange(() => { showInstall(); if (install.installed()) ctx.playlog?.log('install', { outcome: 'installed' }); });
  showInstall();

  // ---- the note to parents, with the switch for counting (shown where the page can count at all)
  const parentsBtn = h('button.sh-parents', { type: 'button' }, STR.parents);
  const noteBody = () => {
    const parts = STR.note.map(([head, text]) => [head ? h('h3', head) : null, h('p', text)]);
    if (!ctx.playlog?.can) return [parts, h('p.sh-by', STR.by)];
    const state = h('span');
    const sw = h('button.sh-switch.lf-btn', { type: 'button' }, h('span'));
    const paint = () => { const off = countingOff(); state.textContent = off ? STR.countOff : STR.countOn; sw.firstChild.textContent = off ? STR.turnOn : STR.turnOff; };
    tap(sw, () => {
      const off = !countingOff();
      setCounting(!off);
      if (off) ctx.playlog?.stop?.(); // right away; turning it on again counts from the next visit
      paint();
    }, ctx);
    paint();
    return [parts, h('div.sh-count', state, sw), h('p.sh-by', STR.by)];
  };
  tap(parentsBtn, () => { if (!done) openPanel(STR.noteTitle, noteBody()); }, ctx);

  // ---- who is playing: a chip top left, and the question (the first time on a tablet, or on a tap of the chip).
  // The panel sits high on the screen, so the tablet's keyboard does not cover the field.
  const whoName = h('span.sh-who-name');
  const whoBtn = h('button.sh-who', { type: 'button' }, h('span.sh-who-ico', { 'aria-hidden': 'true' }), h('span.sh-who-txt', h('span.sh-who-ask', STR.who), whoName));
  const paintWho = () => {
    const n = getPlayer();
    whoName.textContent = n;
    whoName.hidden = !n;
    whoBtn.classList.toggle('is-empty', !n);
    whoBtn.setAttribute('aria-label', n ? `${STR.who} ${n}` : STR.who);
  };
  const choose = (name, how) => {
    const before = getPlayer();
    const now = setPlayer(name);
    if (now !== before) ctx.playlog?.log('player', { how, cleared: !now, known: knownPlayers().length });
    paintWho();
    closePanel();
  };
  const askWho = (first) => {
    if (done) return;
    const cur = getPlayer();
    const known = knownPlayers().sort((a, b) => a.localeCompare(b, getLang())); // a fixed order, so a name stays where a child last saw it
    const input = h('input.sh-who-input', { type: 'text', maxlength: '40', value: '', placeholder: STR.whoNew, 'aria-label': STR.whoNew,
      spellcheck: 'false', autocomplete: 'off', autocapitalize: 'words', enterkeyhint: 'done' });
    const ok = h('button.sh-who-ok.lf-btn.lf-btn--primary', { type: 'button' }, h('span', STR.ok));
    const submit = () => choose(input.value, 'typed'); // an empty field means nobody: rows go without a name
    input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); submit(); } if (e.key === 'Escape') closePanel(); });
    tap(ok, submit, ctx, { sfx: 'ui.confirm' });
    const names = known.length ? h('div.sh-who-names', known.map((n) => {
      const b = h('button.sh-who-pick.lf-btn', { type: 'button', class: n === cur ? 'is-on' : null, 'aria-pressed': String(n === cur) }, h('span', n));
      tap(b, () => choose(n, 'picked'), ctx, { sfx: 'ui.confirm' });
      return b;
    })) : null;
    // no names yet: straight into the field (the keyboard comes up); names to pick: no keyboard until the field is tapped
    openPanel(STR.who, [names, h('div.sh-who-row', input, ok)],
      // the first time, a tap on the blurred shelf behind does not count as Skip
      { cls: 'sh-panel--top', closeLabel: first ? STR.skip : STR.close, onClose: first ? markPlayerAsked : null, stay: first, focus: known.length ? null : input });
  };
  tap(whoBtn, () => askWho(false), ctx);
  paintWho();

  const canvas = h('canvas.sh-sky');
  const root = h('div.sh', { class: `n-${packs.length}` },
    h('div.sh-shade'), canvas, h('div.sh-vignette'),
    h('div.sh-top-left', whoBtn, installBtn),
    h('div.sh-top', langSwitch),
    h('div.sh-head', h('div.lf-kicker', STR.kicker), h('h1.sh-title', STR.title), h('div.lf-divider')),
    h('div.sh-cards', cards),
    h('div.sh-foot', h('span', STR.foot), parentsBtn),
    h('div.sh-black'));
  layer.appendChild(root);

  const sky = lanternSky(canvas, ctx, { lanterns: 14, embers: 46 });
  const bgP = ctx.stage.setBg('party_table', { fade: 0.1 });
  let unlocked = false;
  const unlock = () => {
    if (unlocked) return; unlocked = true;
    try { ctx.audio.unlock(); } catch { /* ignore */ }
    ctx.audio.music('title');
  };
  root.addEventListener('pointerdown', unlock, { capture: true });
  ctx.audio.music('title');

  const onKey = (e) => {
    if (e.key === 'Escape' && panel) { closePanel(); return; }
    if (done || panel || ctx.stage.layers.overlay.childElementCount) return;
    if (e.target?.closest?.('button')) return; // a focused card or switch handles its own Enter
    const n = parseInt(e.key, 10);
    const want = e.key === 'Enter' && cards.length === 1 ? packs[0].id : (n >= 1 && n <= packs.length ? packs[n - 1].id : null);
    if (!want) return;
    unlock();
    if (mustAsk()) askWho(true); else pick(want);
  };
  window.addEventListener('keydown', onKey);

  await Promise.race([bgP, ctx.sleep(1200)]);
  await wait(30);
  root.classList.add('is-in');
  if (ctx.auto) ctx.sleep(900).then(() => pick(packs[0]?.id));
  else if (mustAsk()) ctx.sleep(500).then(() => { if (!done && !panel && mustAsk()) askWho(true); });

  const id = await picked;
  window.removeEventListener('keydown', onKey);
  stopInstallWatch();
  closePanel();
  ctx.audio.sfx('sting.wonder', { volume: 0.7 });
  root.classList.add('is-leaving');
  await ctx.sleep(900);
  sky.stop();
  root.remove();
  return id;
}
