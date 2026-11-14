// The lullaby (SPEC 11): runMelody({ mode: 'learn'|'finale', phrase: 1|2|3 }, ctx) -> { ok, mistakes }
// Five tall crystal chimes (pads 0..4, low to high) over the scene; ctx.audio.chime(i) plays them.
// Learn: the Songstone plays its phrase, the players echo it; a wrong note wobbles and replays, never fails.
// Finale: all three phrases, a different hero leads each; each mistake makes Solenne stir (tally + counter
// `songMistakes`); the phrase then replays slower; three mistakes end with ok:false.
import { h } from '../ui/dom.js';
import * as R from '../core/rules.js';
import { L } from '../core/i18n.js';
import { ensureCss, anim, motes, speed } from './sys-util.js';

const PADS = [
  { note: 'C', color: '#a98bff', deep: '#4b2c9e' },
  { note: 'D', color: '#6fb4ff', deep: '#1f4f9e' },
  { note: 'E', color: '#5ee6cc', deep: '#11756a' },
  { note: 'G', color: '#ffcf5e', deep: '#a3650f' },
  { note: 'A', color: '#ff8fb8', deep: '#a3305f' },
];
const STONES = {
  1: { item: 'songstone_morning', name: 'Morning', color: '#ffb54a', deep: '#a8580c' },
  2: { item: 'songstone_evening', name: 'Evening', color: '#ff8fb0', deep: '#a3365c' },
  3: { item: 'songstone_midnight', name: 'Midnight', color: '#6f9bff', deep: '#22398f' },
};
// Stone names in Danish: the short name and the genitive (the STONES name stays English, it is also an svg id)
const DA_STONE = { Morning: ['Morgen', 'Morgenens'], Evening: ['Aften', 'Aftenens'], Midnight: ['Midnat', 'Midnattens'] };
const STR = L({
  en: {
    kicker: 'The Lullaby',
    learnTitle: (n) => `The Song of ${n}`,
    finaleTitle: 'Sing Solenne to Sleep',
    listen: 'Listen to the stone...',
    listenAgain: 'Listen again, a little slower...',
    yourTurn: 'Your turn! Tap the crystals in the same order.',
    wrong: 'Oops! A wobbly note.',
    kept: 'You know this part of the song now!',
    leads: (name) => `${name} leads`,
    phraseOf: (n) => `the ${n} phrase`,
    stir: 'Solenne stirs',
    sleeping: 'Sleeping',
    done: 'The lullaby is whole',
    keys: 'Keys 1 to 5 play the crystals',
    stoneName: (n) => n,
    crystal: (n) => `Crystal ${n}`,
  },
  da: {
    kicker: 'Vuggevisen',
    learnTitle: (n) => `${DA_STONE[n]?.[1] || n} sang`,
    finaleTitle: 'Syng Solenne i søvn',
    listen: 'Lyt til stenen...',
    listenAgain: 'Lyt igen, lidt langsommere...',
    yourTurn: 'Din tur! Tryk på krystallerne i samme rækkefølge.',
    wrong: 'Ups! En vakkelvorn tone.',
    kept: 'Nu kan I den del af sangen!',
    leads: (name) => `${name} fører an`,
    phraseOf: (n) => `${(DA_STONE[n]?.[1] || n).toLowerCase()} del`,
    stir: 'Solenne rører sig',
    sleeping: 'Sover',
    done: 'Vuggevisen er hel',
    keys: 'Tasterne 1 til 5 spiller krystallerne',
    stoneName: (n) => DA_STONE[n]?.[0] || n,
    crystal: (n) => `Krystal ${n}`,
  },
});

const CRYSTAL_H = [400, 372, 344, 316, 288];

export async function runMelody({ mode = 'learn', phrase = 1 } = {}, ctx) {
  await ensureCss();
  const { audio, state } = ctx;
  const finale = mode === 'finale';
  const phrases = finale ? [1, 2, 3] : [Number(phrase) || 1];
  let mistakes = 0;

  // ---------- build ----------
  const glow = h('div.lfm-glow');
  const bloom = h('div.lfm-bloom');
  const hint = h('div.lfm-hint');
  const header = h('div.lfm-head');
  const dotsRow = h('div.lfm-dots');
  const row = h('div.lfm-crystals');
  const leader = h('div.lfm-leader');
  const stir = finale ? buildStir() : null;
  const root = h('div.lfm', { 'data-no-advance': '', class: finale ? 'is-finale' : 'is-learn' },
    h('div.lfm-veil'), glow, header, dotsRow, row, leader, stir?.el, hint, bloom);
  const fx = motes(root, ctx, { rate: 5 });
  root.insertBefore(fx.el, header);

  const crystals = PADS.map((p, i) => {
    const el = h('button.lfm-crystal', { type: 'button', 'aria-label': STR.crystal(i + 1), dataset: { i }, style: { '--c': p.color, '--cd': p.deep, '--hgt': `${CRYSTAL_H[i]}px` } },
      h('span.lfm-beam'),
      crystalSvg(i, p),
      h('span.lfm-plinth'),
      h('span.lfm-num', String(i + 1)));
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); press(i); });
    row.appendChild(el);
    return el;
  });

  // header: one stone (learn) or three (finale)
  const stoneEls = {};
  const titleEl = h('h2.lf-title', finale ? STR.finaleTitle : STR.learnTitle(STONES[phrases[0]].name));
  const stonesWrap = h('div.lfm-stones');
  for (const n of phrases) {
    const s = STONES[n];
    const dots = h('div.lfm-stone-dots', R.LULLABY.phrases[n].map(() => h('i')));
    const el = h('div.lfm-stone', { style: { '--sc': s.color, '--sd': s.deep }, dataset: { n } }, stoneGem(ctx, s), finale ? h('span.lfm-stone-name', STR.stoneName(s.name)) : null, finale ? dots : null);
    stoneEls[n] = { el, dots };
    stonesWrap.appendChild(el);
  }
  header.append(h('div.lf-kicker', STR.kicker), titleEl, stonesWrap);

  ctx.gm.hide();
  ctx.stage.layers.screen.appendChild(root);
  await ctx.sleep(30);
  root.classList.add('is-in');
  crystals.forEach((c, i) => setTimeout(() => c.classList.add('is-in'), (200 + i * 110) / speed()));
  const onKey = (e) => { const n = parseInt(e.key, 10); if (n >= 1 && n <= 5) press(n - 1); };
  window.addEventListener('keydown', onKey);
  await ctx.sleep(900);

  // ---------- play state ----------
  let accepting = false, expect = [], pos = 0, onDone = null, guide = false, light = 0;

  function setLight(v) {
    light = v;
    glow.style.setProperty('--lv', String(Math.min(1, v)));
    fx.level(Math.min(3, v * 3));
  }

  function hideHint() { hint.className = 'lfm-hint'; }
  async function quill(pool) { hideHint(); await ctx.gm.react(pool); ctx.gm.hide(); }

  function setHint(text, kind = '') {
    hint.className = 'lfm-hint is-on' + (kind ? ' is-' + kind : '');
    hint.textContent = text;
  }

  function renderDots(n) {
    dotsRow.replaceChildren(...R.LULLABY.phrases[n].map(() => h('i')));
  }

  function lightCrystal(i, ms = 520, { soft = false } = {}) {
    const c = crystals[i];
    c.classList.remove('is-lit', 'is-soft'); void c.offsetWidth;
    c.classList.add(soft ? 'is-soft' : 'is-lit');
    setTimeout(() => c.classList.remove('is-lit', 'is-soft'), ms / speed());
  }

  function burstAt(i, n = 26) {
    const r = crystals[i].querySelector('svg').getBoundingClientRect(), base = ctx.stage.el.getBoundingClientRect(), k = 1280 / base.width;
    fx.burst((r.left + r.width / 2 - base.left) * k, (r.top - base.top) * k + 30, PADS[i].color, n);
  }

  async function demo(n, slow = false) {
    const notes = R.LULLABY.phrases[n];
    const gap = slow ? 1080 : 720, hold = slow ? 760 : 520;
    const stone = stoneEls[n].el;
    stone.classList.add('is-singing');
    setHint(slow ? STR.listenAgain : STR.listen, 'listen');
    await ctx.sleep(500);
    const ds = [...dotsRow.children];
    for (let k = 0; k < notes.length; k++) {
      const i = notes[k];
      audio.chime(i, { long: slow });
      lightCrystal(i, hold);
      burstAt(i, 10);
      ds[k]?.classList.add('is-demo');
      ds[k]?.style.setProperty('--dc', PADS[i].color);
      anim(stone, [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], 460, { fill: 'none' });
      await ctx.sleep(gap);
    }
    ds.forEach((d) => d.classList.remove('is-demo'));
    stone.classList.remove('is-singing');
    await ctx.sleep(250);
  }

  function listenFor(n) {
    expect = R.LULLABY.phrases[n];
    pos = 0;
    setHint(STR.yourTurn, 'turn');
    accepting = true;
    if (guide) crystals[expect[0]].classList.add('is-guide');
    return new Promise((res) => { onDone = res; });
  }

  function clearGuide() { crystals.forEach((c) => c.classList.remove('is-guide')); }

  function press(i) {
    const c = crystals[i];
    if (!accepting) return;
    audio.chime(i);
    anim(c, [{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(4px) scale(0.98)' }, { transform: 'translateY(0) scale(1)' }], 260, { fill: 'none' });
    if (i === expect[pos]) {
      lightCrystal(i, 640);
      burstAt(i, 30);
      const d = dotsRow.children[pos];
      if (d) { d.style.setProperty('--dc', PADS[i].color); d.classList.add('is-on'); }
      pos++;
      setLight(light + 0.06);
      clearGuide();
      if (pos >= expect.length) { accepting = false; const f = onDone; onDone = null; f(true); }
      else if (guide) crystals[expect[pos]].classList.add('is-guide');
    } else {
      accepting = false;
      clearGuide();
      c.classList.remove('is-wobble'); void c.offsetWidth; c.classList.add('is-wobble');
      setTimeout(() => c.classList.remove('is-wobble'), 700 / speed());
      audio.sfx('chime.wrong');
      [...dotsRow.children].forEach((d) => { d.classList.remove('is-on'); d.classList.add('is-shake'); setTimeout(() => d.classList.remove('is-shake'), 500 / speed()); });
      setHint(STR.wrong, 'wrong');
      const f = onDone; onDone = null; f(false);
    }
  }

  // autoplay: plays the phrase itself, with a slip when &mistakes=1
  // learn: one slip; finale: a slip in the first and last phrase (2 in all, so the song still succeeds)
  const slipped = new Set();
  async function autoPlay(n, phraseIdx) {
    const notes = R.LULLABY.phrases[n];
    const slipHere = ctx.auto.mistakes && !slipped.has(phraseIdx) && (!finale || phraseIdx !== 1);
    for (let k = 0; k < notes.length; k++) {
      await ctx.sleep(560);
      if (!accepting) return;
      if (slipHere && k === 1) { slipped.add(phraseIdx); press((notes[k] + 2) % 5); return; }
      press(notes[k]);
    }
  }

  // ---------- run ----------
  let ok = true;
  let stirLevel = 0;
  try {
    if (!finale) await quill('puzzle.melody.learn');
    else ctx.gm.hide();
    for (let idx = 0; idx < phrases.length; idx++) {
      const n = phrases[idx];
      const s = STONES[n];
      Object.values(stoneEls).forEach((x) => x.el.classList.toggle('is-current', x.el.dataset.n === String(n)));
      renderDots(n);
      root.style.setProperty('--pc', s.color);
      if (finale) await showLeader(idx, s);
      let slow = false, phraseMistakes = 0;
      guide = false;
      for (;;) {
        await demo(n, slow);
        const p = listenFor(n);
        if (ctx.auto) autoPlay(n, idx);
        const right = await p;
        if (right) break;
        mistakes++;
        phraseMistakes++;
        if (finale) {
          stirLevel++;
          state.tallyAdd('songMistakes', 1);
          state.addCounter('songMistakes', 1);
          stir.set(stirLevel);
          audio.sfx('rumble');
          ctx.stage.fx('rumble');
          if (stirLevel >= 3) { audio.sfx('roar', { volume: 0.7 }); await ctx.sleep(900); ok = false; break; }
        }
        await ctx.sleep(500);
        await quill('puzzle.melody.wrong');
        slow = true;
        guide = finale ? true : phraseMistakes >= 2;
        [...dotsRow.children].forEach((d) => d.classList.remove('is-on'));
      }
      if (!ok) break;
      // phrase kept
      setHint(finale ? '' : STR.kept, 'kept');
      const stone = stoneEls[n];
      stone.el.classList.add('is-kept');
      stone.dots.querySelectorAll('i').forEach((d) => d.classList.add('is-on'));
      audio.sfx('chime.right');
      R.LULLABY.phrases[n].forEach((i, k) => setTimeout(() => lightCrystal(i, 900, { soft: true }), k * 90 / speed()));
      setLight(light + 0.18);
      fx.burst(640, 140, s.color, 60);
      state.setFlag(`lullaby_phrase_${n}`, true);
      await ctx.sleep(700);
      if (!finale || idx < phrases.length - 1) await quill('puzzle.melody.right');
    }
    if (ok && finale) await grandFinale();
    else if (ok) await ctx.sleep(500);
  } finally {
    accepting = false;
    window.removeEventListener('keydown', onKey);
    root.classList.remove('is-in');
    root.classList.add('is-out');
    await ctx.sleep(700);
    fx.stop();
    root.remove();
  }
  return { ok, mistakes };

  // ---------- pieces ----------
  async function showLeader(idx, s) {
    const party = state.party.filter((x) => x.hp > 0).length ? state.party.filter((x) => x.hp > 0) : state.party;
    const hero = party[idx % Math.max(1, party.length)];
    if (!hero) return;
    hero.acts = (hero.acts || 0) + 1;
    leader.classList.remove('is-in');
    await ctx.sleep(260);
    leader.replaceChildren(
      ctx.ui.portrait(hero.id, 'lg'),
      h('div.lf-nameplate', STR.leads(hero.name.split(' ')[0])),
      h('div.lfm-leader-sub', { style: { color: s.color } }, STR.phraseOf(s.name)));
    leader.style.setProperty('--sc', s.color);
    leader.classList.add('is-in');
    ctx.gm.setActor?.(hero.id);
    audio.sfx('ui.page');
    await ctx.sleep(700);
  }

  async function grandFinale() {
    setHint(STR.done, 'kept');
    root.classList.add('is-grand');
    const all = [...R.LULLABY.phrases[1], ...R.LULLABY.phrases[2], ...R.LULLABY.phrases[3]];
    for (let k = 0; k < all.length; k++) {
      audio.chime(all[k], { long: k === all.length - 1 });
      lightCrystal(all[k], 700, { soft: true });
      burstAt(all[k], 18);
      setLight(light + 0.04);
      await ctx.sleep(k % 3 === 2 ? 620 : 420);
    }
    bloom.classList.add('is-on');
    fx.burst(640, 380, '#fff1c4', 140);
    audio.sfx('sting.wonder');
    stir?.set(0, true);
    await ctx.sleep(2200);
  }

  function buildStir() {
    const pips = [0, 1, 2].map(() => h('i'));
    const label = h('div.lfm-stir-label', STR.sleeping);
    const el = h('div.lfm-stir', eyeSvg(), h('div.lfm-stir-pips', pips), label);
    return {
      el,
      set(n, calm = false) {
        pips.forEach((p, k) => p.classList.toggle('is-on', k < n));
        el.dataset.level = String(n);
        label.textContent = n ? STR.stir : STR.sleeping;
        if (n && !calm) anim(el, [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], 420, { fill: 'none' });
      },
    };
  }
}

// ---------- art ----------
function crystalSvg(i, p) {
  const H = CRYSTAL_H[i], W = 120;
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', `0 0 ${W} ${H}`);
  s.setAttribute('class', 'lfm-crystal-svg');
  s.setAttribute('width', W); s.setAttribute('height', H);
  const id = `lfmC${i}`;
  const top = 46;
  // a tall hexagonal prism with a pointed tip
  s.innerHTML = `<defs>
      <linearGradient id="${id}a" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${p.deep}"/><stop offset=".45" stop-color="${p.color}"/><stop offset=".55" stop-color="#ffffff" stop-opacity=".85"/><stop offset=".62" stop-color="${p.color}"/><stop offset="1" stop-color="${p.deep}"/></linearGradient>
      <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".55"/><stop offset=".35" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="${p.deep}" stop-opacity=".7"/></linearGradient>
    </defs>
    <polygon points="60,4 104,${top} 104,${H - 14} 60,${H - 2} 16,${H - 14} 16,${top}" fill="url(#${id}a)" stroke="rgba(255,255,255,.55)" stroke-width="1.5" stroke-linejoin="round"/>
    <polygon points="60,4 104,${top} 104,${H - 14} 60,${H - 2} 16,${H - 14} 16,${top}" fill="url(#${id}b)"/>
    <path d="M60 4 L60 ${H - 2} M16 ${top} L60 ${top + 22} L104 ${top} M38 ${top + 11} L38 ${H - 8} M82 ${top + 11} L82 ${H - 8}" stroke="rgba(255,255,255,.35)" stroke-width="1.2" fill="none"/>
    <path d="M26 ${top + 30} L30 ${H - 40}" stroke="#fff" stroke-opacity=".5" stroke-width="3" stroke-linecap="round"/>`;
  return s;
}

function stoneGem(ctx, s) {
  const src = ctx.assets.item(s.item);
  const gem = h('div.lfm-gem');
  if (ctx.assets.has(src) === true) {
    gem.classList.add('has-img');
    gem.appendChild(h('img', { src, alt: STR.stoneName(s.name), draggable: 'false' }));
  } else {
    gem.innerHTML = `<svg viewBox="0 0 80 80"><defs><radialGradient id="lfmG${s.name}" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="${s.color}"/><stop offset="1" stop-color="${s.deep}"/></radialGradient></defs>
      <path d="M40 6 C58 8 72 22 72 42 C72 60 58 74 40 74 C22 74 8 60 8 42 C8 22 22 4 40 6 Z" fill="url(#lfmG${s.name})" stroke="rgba(255,255,255,.6)" stroke-width="1.5"/>
      <path d="M22 30 C26 20 34 16 42 16" stroke="#fff" stroke-opacity=".8" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M28 48 q6 -8 12 0 t12 0" stroke="#fff" stroke-opacity=".55" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
  }
  return gem;
}

function eyeSvg() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 120 70');
  s.setAttribute('class', 'lfm-eye');
  s.innerHTML = `<defs><radialGradient id="lfmEye" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff3b0"/><stop offset=".5" stop-color="#ffb02e"/><stop offset="1" stop-color="#b3420c"/></radialGradient></defs>
    <path class="lfm-eye-lid" d="M6 35 Q60 -8 114 35 Q60 78 6 35 Z" fill="#2a1408" stroke="#f7c95c" stroke-width="2"/>
    <g class="lfm-eye-open"><path d="M10 35 Q60 0 110 35 Q60 70 10 35 Z" fill="url(#lfmEye)"/><ellipse cx="60" cy="35" rx="6" ry="22" fill="#1a0a04"/></g>
    <path class="lfm-eye-shut" d="M10 36 Q60 56 110 36" stroke="#f7c95c" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  return s;
}
