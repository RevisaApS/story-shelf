// The Dwarf-Door (SPEC 11): runRunes(ctx) -> boolean
// Six carved stone tiles (lantern, river, song, star, dragon, stone), three sockets above. Press three in
// order: lantern, song, dragon. A wrong set puffs dust and pops the tiles back; the third wrong try returns
// false. A hero with read_runes offers one hint; holding brass_feather_key offers another.
import { h, tap } from '../ui/dom.js';
import * as R from '../core/rules.js';
import { L } from '../core/i18n.js';
import { ensureCss, anim, speed } from './sys-util.js';

const STR = L({
  en: {
    kicker: 'The Dwarf-Door',
    title: 'Press three runes in order',
    names: { lantern: 'Lantern', river: 'River', song: 'Song', star: 'Star', dragon: 'Dragon', stone: 'Stone' },
    tries: (n) => `${n} ${n === 1 ? 'try' : 'tries'} left before the door loses patience`,
    runeHint: (name) => `${name} reads the runes`,
    keyHint: (name) => `Use the ${name || 'Brass Feather Key'}`,
    runeText: 'The old stone-folk letters say: "Light opens the way." The first rune must be the one that gives light.',
    keyText: 'A tiny hatch clicks open. Scratched inside, in very small letters: "the middle one hums."',
    reset: 'Start again',
  },
  da: {
    kicker: 'Dværgeporten',
    title: 'Tryk på tre runer i rækkefølge',
    names: { lantern: 'Lygte', river: 'Flod', song: 'Sang', star: 'Stjerne', dragon: 'Drage', stone: 'Sten' },
    tries: (n) => `${n} forsøg tilbage, før porten mister tålmodigheden`,
    runeHint: (name) => `${name} læser runerne`,
    keyHint: (name) => `Brug ${name || 'Messingfjernøglen'}`,
    runeText: 'De gamle stenfolks bogstaver siger: "Lys åbner vejen." Den første rune må være den, der giver lys.',
    keyText: 'En lille luge klikker op. Indeni står der med bittesmå bogstaver: "den midterste nynner."',
    reset: 'Start forfra',
  },
});
const ANSWER = R.RUNES.answer;

export async function runRunes(ctx) {
  await ensureCss();
  const { audio, state } = ctx;
  let tries = 0;
  const seq = [];
  let busy = false, done = false, resolveDone;
  const finished = new Promise((r) => { resolveDone = r; });

  const sockets = [0, 1, 2].map((k) => h('div.lfr-socket', { dataset: { k } }, h('span.lfr-socket-n', String(k + 1))));
  const tiles = R.RUNES.tiles.map((id) => {
    const el = h('button.lfr-tile', { type: 'button', dataset: { rune: id }, 'aria-label': STR.names[id] },
      h('span.lfr-tile-face', glyph(id), h('span.lfr-tile-name', STR.names[id])));
    tap(el, () => press(id, el), null);
    return el;
  });
  const triesEl = h('div.lfr-tries');
  const hintBox = h('div.lfr-note.lf-parch');
  const hintBtns = h('div.lfr-hints');
  const dust = h('div.lfr-dust');
  const door = h('div.lfr-door',
    h('div.lfr-arch'),
    h('div.lfr-head', h('div.lf-kicker', STR.kicker), h('h2.lf-title', STR.title)),
    h('div.lfr-sockets', sockets),
    h('div.lfr-tiles', tiles),
    triesEl, dust);
  const root = h('div.lfr', { 'data-no-advance': '' }, h('div.lfr-veil'), door, hintBtns, hintBox);

  // hints
  const reader = state.hasTalent('read_runes');
  const hints = [];
  if (reader) hints.push({ id: 'runes', label: STR.runeHint(reader.name.split(' ')[0]), node: () => ctx.ui.portrait(reader.id, 'sm'), text: STR.runeText, rune: ANSWER[0] });
  if (state.has('brass_feather_key')) hints.push({ id: 'key', label: STR.keyHint(ctx.content?.items?.brass_feather_key?.name), node: () => ctx.ui.itemImg('brass_feather_key', 44), text: STR.keyText, rune: ANSWER[1] });
  for (const hn of hints) {
    const b = h('button.lfr-hint', { type: 'button' }, hn.node(), h('span', hn.label));
    tap(b, () => showHint(hn, b), ctx);
    hintBtns.appendChild(b);
  }

  ctx.gm.hide();
  ctx.stage.layers.screen.appendChild(root);
  updateTries();
  await ctx.sleep(30);
  root.classList.add('is-in');
  tiles.forEach((t, i) => setTimeout(() => t.classList.add('is-in'), (240 + i * 80) / speed()));
  await ctx.sleep(700);

  if (ctx.auto) autoSolve();
  const result = await finished;
  root.classList.remove('is-in');
  root.classList.add('is-out');
  await ctx.sleep(650);
  root.remove();
  return result;

  // ---------- logic ----------
  function updateTries() {
    const n = 3 - tries;
    triesEl.textContent = STR.tries(n);
    triesEl.classList.toggle('is-low', n <= 1);
  }

  async function press(id, el) {
    if (busy || done || el.classList.contains('is-down')) return;
    el.classList.add('is-down');
    audio.sfx('rune.click');
    const k = seq.length;
    seq.push(id);
    const s = sockets[k];
    const g = h('span.lfr-socket-glyph', glyph(id));
    s.appendChild(g);
    s.classList.add('is-filled');
    anim(g, [{ transform: 'scale(1.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], 380);
    if (seq.length < 3) return;
    busy = true;
    await ctx.sleep(380);
    const right = seq.every((x, i) => x === ANSWER[i]);
    if (right) return win();
    tries++;
    updateTries();
    audio.sfx('rune.wrong');
    audio.sfx('door.stone', { volume: 0.4, rate: 1.3 });
    puff();
    ctx.stage.fx('shake');
    sockets.forEach((x) => x.classList.add('is-wrong'));
    await ctx.sleep(520);
    tiles.forEach((t) => t.classList.remove('is-down'));
    tiles.forEach((t) => anim(t, [{ transform: 'translateY(6px)' }, { transform: 'translateY(-6px)' }, { transform: 'translateY(0)' }], 360, { fill: 'none' }));
    sockets.forEach((x) => { x.classList.remove('is-filled', 'is-wrong'); x.querySelector('.lfr-socket-glyph')?.remove(); });
    seq.length = 0;
    if (tries >= 3) {
      await ctx.sleep(400);
      done = true;
      resolveDone(false);
      return;
    }
    await ctx.gm.react('puzzle.runes.wrong');
    ctx.gm.hide();
    busy = false;
    if (ctx.auto) autoSolve();
  }

  async function win() {
    done = true;
    audio.sfx('rune.right');
    door.classList.add('is-open');
    sockets.forEach((s, i) => setTimeout(() => s.classList.add('is-right'), i * 160 / speed()));
    await ctx.sleep(1500);
    resolveDone(true);
  }

  function puff() {
    dust.replaceChildren();
    for (let i = 0; i < 34; i++) {
      const p = h('i');
      dust.appendChild(p);
      const x = 120 + Math.random() * 640, a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 120;
      const sz = 30 + Math.random() * 60;
      p.style.cssText = `left:${x}px;width:${sz}px;height:${sz}px`;
      anim(p, [
        { transform: 'translate(-50%, -50%) scale(0.3)', opacity: 0.9 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d * 0.5 - 40}px)) scale(1.4)`, opacity: 0 },
      ], 900 + Math.random() * 500, { easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' });
    }
    setTimeout(() => dust.replaceChildren(), 1500 / speed());
  }

  function showHint(hn, btn) {
    btn.classList.add('is-used');
    btn.setAttribute('aria-disabled', 'true');
    audio.sfx(hn.id === 'key' ? 'door.stone' : 'spell.cast', { volume: 0.5 });
    hintBox.replaceChildren(h('p', hn.text));
    hintBox.classList.remove('is-in'); void hintBox.offsetWidth; hintBox.classList.add('is-in');
    const t = tiles.find((x) => x.dataset.rune === hn.rune);
    t?.classList.add('is-hinted');
  }

  async function autoSolve() {
    const wrongFirst = ctx.auto.mistakes && tries === 0;
    const order = wrongFirst ? ['lantern', 'star', 'dragon'] : ANSWER;
    for (const id of order) {
      await ctx.sleep(500);
      if (done) return;
      const el = tiles.find((t) => t.dataset.rune === id);
      press(id, el);
    }
  }
}

// ---------- glyphs (64 x 64, stroke art; engraved by CSS) ----------
const GLYPHS = {
  lantern: '<circle cx="32" cy="9" r="4"/><path d="M22 20 L26 13 H38 L42 20 Z"/><rect x="20" y="20" width="24" height="28" rx="5"/><path d="M32 27 C36 31 37 35 32 41 C27 35 28 31 32 27 Z"/><path d="M24 48 H40 L37 55 H27 Z"/>',
  river: '<path d="M6 20 q6.5 -7 13 0 t13 0 t13 0 t13 0"/><path d="M6 33 q6.5 -7 13 0 t13 0 t13 0 t13 0"/><path d="M6 46 q6.5 -7 13 0 t13 0 t13 0 t13 0"/>',
  song: '<ellipse cx="19" cy="47" rx="7" ry="5.2" transform="rotate(-18 19 47)"/><ellipse cx="45" cy="41" rx="7" ry="5.2" transform="rotate(-18 45 41)"/><path d="M25.5 45 V14 L51.5 8 V39"/><path d="M25.5 22 L51.5 16"/>',
  star: '<path d="M32 6 L39 24 L58 24 L43 36 L48 55 L32 44 L16 55 L21 36 L6 24 L25 24 Z"/>',
  // a winged dragon in silhouette (wing, horn, open jaws, back spikes, spade tail): reads as "dragon" at a glance
  dragon: '<path class="f" d="M22 32 C19 20 14 12 6 7 C15 6 23 9 28 15 C30 10 35 6 42 4 C40 11 41 17 45 22 C39 21 35 23 33 27 C30 25 26 27 22 32 Z"/><path class="f" d="M7 46 C12 39 21 35 31 35 C37 35 41 33 44 29 C46 25 49 22 53 22 L58 22 L63 26 L57 28 L62 31 L55 32 C53 33 51 35 49 39 C45 45 37 47 29 47 C23 47 19 49 15 53 C12 56 10 57 7 56 C10 53 10 49 7 46 Z"/><path d="M52 22 L45 14 L56 21"/><path class="f" d="M7 56 L3 61 L3 54 Z"/><path d="M26 47 L24 55 L28 55 M38 46 L40 54 L44 54"/><path class="f" d="M12 43 L13 37 L17 40 Z M18 39 L20 33 L23 36 Z"/><circle class="eye" cx="54.5" cy="25" r="1.3"/>',
  stone: '<path d="M7 46 L13 29 L27 18 L44 19 L57 31 L56 45 L42 53 L19 53 Z"/><path d="M27 18 L31 30 L26 38 L30 46"/><path d="M44 19 L41 28 L49 34"/><path d="M13 29 L20 33"/>',
};

function glyph(id) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 64 64');
  s.setAttribute('class', 'lfr-glyph');
  s.innerHTML = `<g class="lfr-g-hi" transform="translate(0 1.4)">${GLYPHS[id]}</g><g class="lfr-g">${GLYPHS[id]}</g>`;
  return s;
}
