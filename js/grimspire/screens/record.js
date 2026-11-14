// The top of the tower (GRIMSPIRE.md 3.9). gsEnding(ctx) -> 'smash'|'forge' ; gsRecord(ctx) -> void
// gsEnding: the crown lies on the bones; the party chooses (smash it, or carry it to Hilda's forge), then that
//   branch of story.ending runs (its one last skill challenge included) through the shared step interpreter.
// gsRecord: the Hunt Record. Varg's record.intro line, the numbers (time, battles, perfect strikes, perfect
//   blocks, best hit, legendary items found), and a title for each hunter from the title.* pools.
//   Sets document.documentElement.dataset.done = '1' (autoplay contract, SPEC 13).
import { h, tap, wait } from '../../ui/dom.js';
import { L } from '../../core/i18n.js';
import { portrait, icon, sfx, say, countUp, heroColor } from '../hud.js';
import { runSteps } from './room.js';

const STR = L({
  en: {
    prompt: 'The Hollow Crown lies on the bones, still flickering. What do you do with it?',
    smash: 'Smash it to pieces', smashHint: 'Here and now, with everything you have', forge: "Take it to Hilda's forge", forgeHint: 'What fire made, fire can unmake',
    record: 'The Hunt Record', kicker: 'Grimspire has fallen', time: 'Time', battles: 'Battles won', perfects: 'Perfect strikes', blocks: 'Perfect blocks', best: 'Best hit',
    legend: 'Legendary items', level: 'Party level', gold: 'Gold earned', again: 'Hunt again from the start', diff: { squire: 'Squire', knight: 'Knight', legend: 'Legend' },
    ended: { smash: 'The crown was smashed', forge: 'The crown was melted down' },
  },
  da: {
    prompt: 'Den Hule Krone ligger på knoglerne og flakker stadig. Hvad gør I med den?',
    smash: 'Slå den i stykker', smashHint: 'Her og nu, med alt hvad I har', forge: 'Bær den til Hildas smedje', forgeHint: 'Hvad ild har skabt, kan ild gøre om',
    record: 'Jagtbogen', kicker: 'Grumspir er faldet', time: 'Tid', battles: 'Vundne kampe', perfects: 'Perfekte slag', blocks: 'Perfekte blokeringer', best: 'Bedste slag',
    legend: 'Legendariske ting', level: 'Holdets niveau', gold: 'Tjent guld', again: 'Jag igen fra begyndelsen', diff: { squire: 'Væbner', knight: 'Ridder', legend: 'Legende' },
    ended: { smash: 'Kronen blev slået i stykker', forge: 'Kronen blev smeltet om' },
  },
});

export async function gsEnding(ctx) {
  const st = ctx.state;
  ctx.hud.hide();
  await ctx.stage.setBg(ctx.content.floors?.[5]?.bg || 'gs_floor5', { fade: 1 });
  ctx.audio.music('gs_ending');
  const id = await ctx.gm.choose({ prompt: STR.prompt, options: [
    { id: 'smash', label: STR.smash, hint: STR.smashHint },
    { id: 'forge', label: STR.forge, hint: STR.forgeHint },
  ] });
  st.ending = id === 'forge' ? 'forge' : 'smash';
  ctx.save.write(st);
  const steps = ctx.content.story?.ending?.[st.ending] || [];
  await runSteps(ctx, `gs.ending.${st.ending}`, steps, { bg: ctx.stage.bgId, music: 'gs_ending' });
  ctx.gm.hide();
  return st.ending;
}

const fmtTime = (ms) => {
  const m = Math.round((ms || 0) / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}` : `${m} min`;
};

// one distinct title pool per hunter, strongest claim first
function titles(ctx) {
  const st = ctx.state, t = st.tally;
  const n = Math.max(1, t.battles || 1);
  const claims = [
    ['title.perfect', (t.perfects || 0) / Math.max(1, (t.perfects || 0) + (t.goods || 0) + (t.weaks || 0))],
    ['title.wall', (t.perfectBlocks || 0) / Math.max(1, t.blocks || 1)],
    ['title.fierce', Math.min(1, (t.bestHit || 0) / 120)],
    ['title.lucky', Math.min(1, ((t.legendaries || 0) + (t.chests || 0) * 0.3) / 5)],
    ['title.rich', Math.min(1, (t.gold || st.gold || 0) / 1500)],
    ['title.steady', Math.min(1, (t.wins || 0) / n) * 0.5],
  ].sort((a, b) => b[1] - a[1]);
  const used = new Set();
  return st.party.map((hero, i) => {
    const pool = claims[i % claims.length][0];
    const lines = ctx.content.lines?.[pool] || [];
    let pick = lines.length ? lines[(hero.arch.length * 7 + i * 3 + (st.seed || 0)) % lines.length] : '';
    if (used.has(pick) && lines.length > 1) pick = lines.find((x) => !used.has(x)) || pick;
    used.add(pick);
    return typeof pick === 'string' ? pick : pick?.text || '';
  });
}

export async function gsRecord(ctx) {
  const st = ctx.state, t = st.tally;
  const layer = ctx.stage.layers.screen;
  ctx.gm.hide(); ctx.hud.hide(); ctx.hud.setBack(null);
  await ctx.stage.setBg('gs_ending', { fade: 1.2 });
  ctx.audio.music('gs_ending');
  sfx(ctx, 'gs.victory');
  const ts = titles(ctx);
  const stats = [
    ['hourglass', STR.time, fmtTime(st.finishedMs || st.playMs), false],
    ['battle', STR.battles, t.wins || 0, true],
    ['star', STR.perfects, t.perfects || 0, true],
    ['shield', STR.blocks, t.perfectBlocks || 0, true],
    ['fury', STR.best, t.bestHit || 0, true],
    ['chest', STR.legend, t.legendaries || 0, true],
  ];
  const statEls = stats.map(([ic, k, v, num]) => {
    const b = h('b', num ? '0' : String(v));
    return { el: h('div.gs-rec-stat', icon(ic), h('small', k), b), b, v, num };
  });
  const heroes = st.party.map((hero, i) => h('div.gs-rec-hero', { style: { '--hc': heroColor(hero.arch), '--i': i } },
    portrait(ctx, hero.arch, 'lg'), h('div.gs-rec-name', hero.name), h('div.gs-rec-title', ts[i] || '')));
  const again = ctx.ui.button(STR.again, { kind: 'primary', size: 'lg', sfx: 'ui.confirm' });
  again.hidden = true;
  const root = h('div.gs-rec', { 'data-no-advance': '' },
    h('div.gs-rec-shade'),
    h('div.gs-rec-book.gs-panel',
      h('div.gs-kicker', STR.kicker), h('h1.gs-title', STR.record),
      h('div.gs-rec-sub', `${STR.diff[st.difficulty] || ''} · ${STR.level} ${st.level} · ${STR.ended[st.ending || 'smash']}`),
      h('div.gs-rec-heroes', { class: `n-${heroes.length}` }, heroes),
      h('div.gs-rec-stats', statEls.map((s) => s.el)),
      h('div.gs-rec-foot', again)));
  layer.appendChild(root);
  await wait(20);
  root.classList.add('is-in');
  await ctx.sleep(600);
  say(ctx, 'record.intro', 'grand');
  for (const [i, el] of heroes.entries()) { await ctx.sleep(260); el.classList.add('is-on'); sfx(ctx, i === heroes.length - 1 ? 'gs.perfect' : 'ui.confirm', { volume: 0.6 }); }
  for (const s of statEls) { s.el.classList.add('is-on'); if (s.num) countUp(s.b, 0, s.v, 700, ctx); await ctx.sleep(160); }
  await ctx.sleep(600);
  again.hidden = false;
  document.documentElement.dataset.done = '1';
  ctx.bus.emit('adventure:done', { tally: t });
  if (ctx.auto) return;
  await new Promise((r) => tap(again, r, ctx, { sfx: null }));
  ctx.gm.hide();
  root.classList.add('is-leaving');
  await ctx.sleep(500);
  root.remove();
}
