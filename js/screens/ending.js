// The Chronicle (SPEC 11): endingScreen(ctx) -> void
// A parchment page that writes the party's legend: each hero with an earned title, friends made,
// the numbers, the journal as the story so far, and Play again. A keepsake worth a photo.
import { h, tap, wait } from '../ui/dom.js';
import { L } from '../core/i18n.js';

const STR = L({
  en: {
    kicker: 'As written by Old Quill, the Storykeeper',
    title: 'The Chronicle of Lanternfall',
    sub: (date) => `The tale of the Sleepless Dragon, told on ${date}`,
    heroes: 'The Heroes', friends: 'Friends Made', numbers: 'By the Numbers', story: 'The Story So Far',
    noFriends: 'No friends this time. There is always another tale.',
    noStory: 'The pages are still blank. The best stories start that way.',
    level: (n) => `Level ${n}`,
    stats: { nat20: 'Natural 20s', nat1: 'Natural 1s', stars: 'Stars', friends: 'Befriended', time: 'Minutes' },
    again: 'Play again',
    fin: 'The End',
    sealed: 'Sealed by the Storykeeper',
    dateLocale: 'en-GB',
    // a title for a category when the pool has none
    fallbackTitle: (cat) => `the ${cat[0].toUpperCase()}${cat.slice(1)}`,
    // flag -> friend line
    friendLines: {
      duck_rescued: 'A boy and his wooden duck',
      thorn_friends: 'The Thornlings',
      troll_friend: 'Grumble the troll',
      glowmoth_friend: 'Queen Lumina\u2019s Glowmoths',
      snail_champion: 'A very fast snail',
      bouldergrin_friend: 'Bouldergrin',
      spared_glint: 'Glint, forgiven',
      glint_promise: 'Glint, who promised',
      perfect_song: 'Solenne herself',
    },
  },
  da: {
    kicker: 'Skrevet af Gamle Fjer, Sagnvogteren',
    title: 'Kr\u00f8niken om Lygtefald',
    sub: (date) => `Sagnet om Den s\u00f8vnl\u00f8se drage, fortalt den ${date}`,
    heroes: 'Heltene', friends: 'Nye venner', numbers: 'I tal', story: 'Historien indtil nu',
    noFriends: 'Ingen nye venner denne gang. Der kommer altid et nyt eventyr.',
    noStory: 'Siderne er stadig tomme. S\u00e5dan starter de bedste historier.',
    level: (n) => `Niveau ${n}`,
    stats: { nat20: 'Rene 20\u2019ere', nat1: 'Rene 1\u2019ere', stars: 'Stjerner', friends: 'Venner', time: 'Minutter' },
    again: 'Spil igen',
    fin: 'Slut',
    sealed: 'Forseglet af Sagnvogteren',
    dateLocale: 'da-DK',
    fallbackTitle: (cat) => ({ friend: 'Vennen', kind: 'den Gode', brave: 'den Modige', clever: 'den Kloge', lucky: 'den Heldige', unlucky: 'den Uheldige' }[cat] || cat),
    friendLines: {
      duck_rescued: 'En dreng og hans tr\u00e6and',
      thorn_friends: 'Tornlingerne',
      troll_friend: 'Brumle, trolden',
      glowmoth_friend: 'Dronning Luminas Lysm\u00f8l',
      snail_champion: 'En meget hurtig snegl',
      bouldergrin_friend: 'Stengrin',
      spared_glint: 'Glimt, der fik tilgivelse',
      glint_promise: 'Glimt, der gav et l\u00f8fte',
      perfect_song: 'Solenne selv',
    },
  },
});

// Flag -> friend line (in story order).
const FRIENDS = ['duck_rescued', 'thorn_friends', 'troll_friend', 'glowmoth_friend', 'snail_champion',
  'bouldergrin_friend', 'spared_glint', 'glint_promise', 'perfect_song'];

// Title lines that only fit when a flag is set (matched against the pool text).
const SPECIAL = {
  'the Troll-Friend': 'troll_friend', 'Friend of Moths': 'glowmoth_friend', 'the Thornling-Tamer': 'thorn_friends',
  'Friend of Stone': 'bouldergrin_friend', 'the Goblin-Forgiver': 'spared_glint', 'the Duck-Rescuer': 'duck_rescued',
  'Hay-in-the-Hair': 'hay_hair', 'Gloop-Whisperer': 'gloops_befriended', 'the Dragon-Singer': 'perfect_song',
};

const AFFINITY = {
  knight: { brave: 3, kind: 1 }, wizard: { clever: 3, lucky: 1 }, ranger: { friend: 3, brave: 1 },
  trickster: { clever: 2, lucky: 2 }, bard: { friend: 2, kind: 2 }, mender: { kind: 3, friend: 1 },
};

function chooseTitles(ctx) {
  const st = ctx.state;
  const t = st.tally || {};
  const f = (k) => (st.flag ? st.flag(k) : !!st.flags?.[k]);
  const friendFlags = ['troll_friend', 'glowmoth_friend', 'thorn_friends', 'bouldergrin_friend', 'spared_glint'].filter(f).length;
  const passRate = t.checks ? t.passed / t.checks : 0.5;
  const score = {
    friend: (t.befriended || 0) * 0.8 + friendFlags * 1.5,
    kind: (f('duck_rescued') ? 2 : 0) + (f('spared_glint') ? 2 : 0) + (f('glowmoth_friend') ? 1 : 0) + (t.tableMoments || 0) * 0.5,
    brave: (t.defeated || 0) * 0.6 + 1.5,
    clever: passRate * 4 + (f('knows_rhyme') ? 0.5 : 0),
    lucky: (t.nat20 || 0) * 1.6,
    unlucky: (t.nat1 || 0) * 1.4 + (f('hay_hair') ? 1 : 0),
  };
  const party = [...(st.party || [])];
  // Most active hero picks first, so the spotlight hero gets the strongest title.
  const byActs = [...party].sort((a, b) => (b.acts || 0) - (a.acts || 0));
  const used = new Set();
  const out = {};
  for (const hero of byActs) {
    let best = null, bv = -1;
    for (const [cat, v] of Object.entries(score)) {
      if (used.has(cat)) continue;
      const s = v + (AFFINITY[hero.arch]?.[cat] || 0);
      if (s > bv) { bv = s; best = cat; }
    }
    used.add(best);
    out[hero.id] = best;
  }
  const usedLines = new Set();
  const titleFor = (cat) => {
    const pool = ctx.content?.gmLines?.[`title.${cat}`] || [];
    // SPECIAL is keyed by the English title: map a localised line back to its English source by its place in the pool
    const src = ctx.contentSource?.gmLines?.[`title.${cat}`] || pool;
    const flagOf = (l) => SPECIAL[l] || SPECIAL[src[pool.indexOf(l)]];
    const special = pool.filter((l) => flagOf(l) && f(flagOf(l)) && !usedLines.has(l));
    const generic = pool.filter((l) => !flagOf(l) && !usedLines.has(l));
    const list = special.length ? special : generic.length ? generic : pool;
    const line = list.length ? list[ctx.rng.int(0, list.length - 1)] : STR.fallbackTitle(cat);
    usedLines.add(line);
    return line;
  };
  const res = {};
  for (const hero of party) res[hero.id] = titleFor(out[hero.id]);
  return res;
}

// name on its own line, the earned title under it (wraps and centres inside the hero's own column)
const withTitle = (name, title) => [h('span.sa-ch-hfirst', String(name).split(' ')[0]), h('span.sa-ch-htitle', title)];

// The whole journal should fit the page for the photo: step the type down until it does; past the smallest
// size the column scrolls, with a soft fade and a small "more below" cue that goes away at the end.
function fitStory(el) {
  const wrap = el.parentElement;
  for (const px of [19, 18, 17, 16, 15]) {
    el.style.setProperty('--story-px', px + 'px');
    if (el.scrollHeight <= el.clientHeight + 1) { wrap.classList.remove('is-more'); return; }
  }
  wrap.classList.add('is-more');
  const cue = () => wrap.classList.toggle('is-end', el.scrollTop + el.clientHeight >= el.scrollHeight - 4);
  el.addEventListener('scroll', cue, { passive: true });
  cue();
}

function fmtDate(d = new Date()) {
  try { return d.toLocaleDateString(STR.dateLocale, { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return d.toDateString(); }
}

export async function endingScreen(ctx) {
  const layer = ctx.stage.layers.screen;
  const st = ctx.state;
  const t = st.tally || {};
  ctx.hud?.hide?.();
  ctx.audio.music('ending');
  ctx.stage.setBg('peak_dawn', { fade: 1.6 });
  ctx.weather?.set?.('sparkles');
  ctx.bus.emit('game:ended', { tally: t });

  await ctx.gm?.react?.('chronicle.intro');
  ctx.gm?.hide?.();

  const titles = chooseTitles(ctx);
  const party = st.party || [];
  const heroesC = ctx.content?.heroes || {};

  const heroEls = party.map((hero) => h('div.sa-ch-hero.sa-ink',
    h('div.sa-ch-medal', ctx.ui.portrait(hero.id, 'md')),
    h('div.sa-ch-htext',
      h('div.sa-ch-hname', withTitle(hero.name, titles[hero.id])),
      h('div.sa-ch-hmeta', `${heroesC[hero.arch]?.calling || hero.arch} · ${STR.level(hero.level || 1)}`))));

  const friends = FRIENDS.filter((k) => st.flag(k)).map((k) => STR.friendLines[k]);
  const friendsEl = h('ul.sa-ch-friends', friends.length
    ? friends.map((f) => h('li.sa-ink', ctx.ui.icon('heart'), h('span', f)))
    : h('li.sa-ink.is-none', h('span', STR.noFriends)));

  const minutes = Math.max(1, Math.round((st.playMs || 0) / 60000));
  const nums = [
    ['nat20', t.nat20 || 0, 'dice'], ['nat1', t.nat1 || 0, 'dice'], ['stars', t.starsEarned || 0, 'star'],
    ['friends', t.befriended || 0, 'heart'], ['time', minutes, 'book'],
  ];
  const numEls = nums.map(([k, v, ic]) => h('div.sa-ch-num.sa-ink', { dataset: { k } }, ctx.ui.icon(ic), h('b', { dataset: { v } }, '0'), h('span', STR.stats[k])));

  const journal = (st.journal || []).map((j) => (typeof j === 'string' ? j : j.text)).filter(Boolean);
  const storyEl = h('div.sa-ch-story.lf-scroll', journal.length
    ? journal.map((text, i) => h('p.sa-ink', i === 0 ? h('span.sa-ch-drop', text[0]) : null, i === 0 ? text.slice(1) : text))
    : h('p.sa-ink.is-none', STR.noStory));

  const again = ctx.ui.button(STR.again, { kind: 'primary', size: 'lg', sfx: 'ui.confirm' });
  const page = h('div.sa-ch-page.lf-parch',
    h('div.sa-ch-corner.tl'), h('div.sa-ch-corner.tr'), h('div.sa-ch-corner.bl'), h('div.sa-ch-corner.br'),
    h('header.sa-ch-head.sa-ink', h('div.sa-ch-kicker', STR.kicker), h('h1.sa-ch-title', STR.title), h('div.sa-ch-sub', STR.sub(fmtDate())), h('div.sa-ch-rule')),
    h('div.sa-ch-body',
      h('section.sa-ch-left', { class: `n-${party.length}` },
        h('div.sa-ch-sec', h('h2.sa-ch-h.sa-ink', STR.heroes), h('div.sa-ch-heroes', { class: `n-${party.length}` }, heroEls)),
        h('div.sa-ch-sec', h('h2.sa-ch-h.sa-ink', STR.friends), friendsEl),
        h('div.sa-ch-sec', h('h2.sa-ch-h.sa-ink', STR.numbers), h('div.sa-ch-nums', numEls))),
      h('section.sa-ch-right', h('h2.sa-ch-h.sa-ink', STR.story), h('div.sa-ch-storywrap', storyEl),
        h('div.sa-ch-fin.sa-ink', h('span', STR.fin), h('div.sa-ch-seal', { title: STR.sealed }, ctx.ui.icon('star'))))));
  const root = h('div.sa-ch', h('div.sa-ch-veil'), page, h('div.sa-ch-foot', again));
  layer.appendChild(root);
  fitStory(storyEl);
  await wait(30);
  root.classList.add('is-in');
  ctx.audio.sfx('ui.open');
  await ctx.sleep(900);

  // Write the page in, block by block, as if the quill were moving.
  const inks = [...page.querySelectorAll('.sa-ink')];
  for (const el of inks) {
    el.classList.add('is-on');
    if (el.classList.contains('sa-ch-hero')) { ctx.audio.sfx('ui.page', { volume: 0.5 }); await ctx.sleep(420); }
    else if (el.classList.contains('sa-ch-num')) {
      const b = el.querySelector('b'); const v = Number(b.dataset.v);
      for (let k = 1; k <= 12; k++) { b.textContent = String(Math.round((v * k) / 12)); await ctx.sleep(22); }
      ctx.audio.sfx('coin', { volume: 0.35 });
    } else await ctx.sleep(el.tagName === 'P' ? 90 : 160);
  }
  ctx.audio.sfx('fanfare.small');
  page.classList.add('is-sealed');
  root.classList.add('is-done');

  if (ctx.auto) { await ctx.sleep(1200); return; }
  await new Promise((res) => tap(again, res, ctx, { sfx: null }));
  ctx.save?.clear?.();
  root.classList.add('is-leaving');
  await ctx.sleep(700);
  const q = new URLSearchParams();
  if (new URLSearchParams(location.search).get('content') === 'dev') q.set('content', 'dev');
  location.href = location.pathname + (q.toString() ? `?${q}` : '');
  await new Promise(() => {});
}
