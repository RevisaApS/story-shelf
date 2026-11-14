// The step interpreter (SPEC 8.2). runScene(sceneId, { resumed }, ctx) -> next scene id | 'end'
// Every step type in SPEC 8.2 is handled here; [screens]/[combat] steps go through ctx.screens.go (SPEC 11/12),
// which falls back to a working stand-in when a module is missing. The `skill` step (ROUND2 3.1) runs
// ctx.screens.go('skill', spec) (systems/skill.js, or a plain check as the fallback) and branches like a check.
import { fmt } from '../ui/dom.js';
import * as R from '../core/rules.js';
import { runCheck, runChallengeFallback } from '../systems/check.js';
import { runHub } from '../systems/hub.js';
import { L } from '../core/i18n.js';

const STR = L({
  en: {
    gold: (n) => (n >= 0 ? `+${n} coins` : `${n} coins`),
    star: 'A Star!', starLost: 'A Star fades', starsFull: 'The Star pool is full',
    quest: 'New quest', questDone: 'Quest complete',
    hurt: (n) => `-${n} hearts`, heal: 'Hearts restored', lost: (name) => `${name} handed over`,
    journal: 'The Chronicle grows',
    what: 'What do you do?', found: 'You found', foundN: (n) => `You found ${n}`, you: 'you', party: 'the party', joining: 'For joining in',
  },
  da: {
    gold: (n) => (n >= 0 ? `+${n} ${Math.abs(n) === 1 ? 'mønt' : 'mønter'}` : `${n} ${Math.abs(n) === 1 ? 'mønt' : 'mønter'}`),
    star: 'En Stjerne!', starLost: 'En Stjerne slukkes', starsFull: 'Der er ikke plads til flere Stjerner',
    quest: 'Ny opgave', questDone: 'Opgaven er klaret',
    hurt: (n) => `-${n} ${n === 1 ? 'hjerte' : 'hjerter'}`, heal: 'Hjerterne er fyldt op', lost: (name) => `${name} givet væk`,
    journal: 'Krøniken vokser',
    what: 'Hvad gør du?', found: 'Du fandt', foundN: (n) => `Du fandt ${n}`, you: 'du', party: 'flokken', joining: 'For at være med',
  },
});

export async function runScene(sceneId, opts = {}, ctx) {
  const scene = ctx.content.scenes[sceneId];
  if (!scene) throw new Error('Unknown scene ' + sceneId);
  const { state, stage, gm, ui, audio } = ctx;

  state.scene = sceneId;
  const firstVisit = !state.flag(`seen.${sceneId}`);
  state.setFlag(`seen.${sceneId}`, true);
  ctx.sceneMemo = { fumbleStar: false, sceneId };
  gm.setActor(null);
  ctx.save.write(state);
  ctx.bus.emit('scene:entered', { id: sceneId, firstVisit, resumed: !!opts.resumed });
  ctx.hud?.show?.();

  stage.hideActor('all');
  if (scene.music) audio.music(scene.music);
  audio.ambience(scene.ambience || null);
  ctx.weather.set(scene.weather || 'none');
  await stage.setBg(scene.bg || null);
  let pendingTitle = !!(scene.steps?.[0] && scene.steps[0].card);
  if (!pendingTitle) ctx.hud?.sceneTitle?.(scene.title, scene.subtitle);

  if (opts.resumed && ctx.gm.director?.welcomeBack) await ctx.gm.director.welcomeBack();

  const vars = () => {
    const a = gm.actor ? state.hero(gm.actor) : null;
    return { actor: a ? a.name.split(' ')[0] : STR.you, party: state.party.length > 1 ? STR.party : (state.party[0]?.name.split(' ')[0] || STR.you) };
  };
  const progress = () => { window.__LF.progress = (window.__LF.progress || 0) + 1; };

  // ---------------- interpreter ----------------
  async function run(steps, frame = {}) {
    for (const step of steps || []) {
      progress();
      const exit = await exec(step, frame);
      if (exit) return exit;
    }
    return undefined;
  }

  const branch = (steps, frame) => run(Array.isArray(steps) ? steps : steps ? [steps] : [], frame);

  async function exec(step, frame) {
    if (step == null) return undefined;
    if (typeof step === 'string') { await gm.say(step); return undefined; }
    if (Array.isArray(step)) return run(step, frame);
    ctx.bus.emit('scene:step', { scene: sceneId, type: Object.keys(step)[0] });

    if ('say' in step) { await gm.say(step.say, { as: step.as || 'gm', mood: step.mood || 'warm' }); return; }
    if ('card' in step) { await ui.chapterCard(step.card); if (pendingTitle) { pendingTitle = false; ctx.hud?.sceneTitle?.(scene.title, scene.subtitle); } return; }
    if ('show' in step) { await stage.showActor(step.show, { at: step.at || 'right' }); return; }
    if ('hide' in step) { await stage.hideActor(step.hide); return; }
    if ('bg' in step) { await stage.setBg(step.bg); return; }
    if ('music' in step) { audio.music(step.music || null); return; }
    if ('ambience' in step) { audio.ambience(step.ambience || null); return; }
    if ('weather' in step) { ctx.weather.set(step.weather || 'none'); return; }
    if ('sfx' in step) { audio.sfx(step.sfx); return; }
    if ('fx' in step) { await stage.fx(step.fx); return; }
    if ('wait' in step) { await ctx.sleep(step.wait); return; }
    if ('again' in step) { if (frame.choice) frame.choice.again = true; return; }
    if ('goto' in step) return { exit: 'goto', to: step.goto };
    if ('end' in step) return { exit: 'end' };

    if ('choice' in step) return doChoice(step.choice, frame);
    if ('check' in step) return doCheck(step.check, frame);
    if ('skill' in step) return doSkill(step.skill, frame);
    if ('hub' in step) return runHub(ctx, step.hub, (s) => run(s, { ...frame, choice: null }));
    if ('challenge' in step) {
      gm.setActor(null);
      const real = await ctx.screens.has('challenge');
      const ok = real ? await ctx.screens.go('challenge', step.challenge) : await runChallengeFallback(step.challenge, ctx);
      return branch(ok ? step.challenge.success : step.challenge.fail, frame);
    }
    if ('combat' in step) return doCombat(step, frame);
    if ('puzzle' in step) return doPuzzle(step, frame);
    if ('shop' in step) { await ctx.screens.go('shop', step.shop); return; }

    if ('give' in step) {
      const g = typeof step.give === 'string' ? { id: step.give, qty: 1 } : step.give;
      const qty = g.qty === 'party' || g.qty === 'each' ? state.party.length : (g.qty || 1);
      state.give(g.id, qty);
      await ui.itemCard(g.id, { kicker: qty > 1 ? STR.foundN(qty) : STR.found });
      await ctx.gm.director?.teach?.('item');
      return;
    }
    if ('take' in step) {
      const t = typeof step.take === 'string' ? { id: step.take, qty: 1 } : step.take;
      if (state.take(t.id, t.qty || 1)) ui.toast(STR.lost(ctx.content.items?.[t.id]?.name || t.id), { icon: t.id, kind: 'item' });
      return;
    }
    if ('gold' in step) {
      const n = Number(step.gold) || 0;
      state.addGold(n);
      audio.sfx('coin');
      ui.toast(STR.gold(n), { icon: 'coin', kind: 'item' });
      await ctx.sleep(300);
      return;
    }
    if ('star' in step) {
      const n = Number(step.star) || 0;
      const delta = state.addStar(n, step.why || '');
      if (n > 0) {
        audio.sfx('star.gain');
        ui.toast(delta > 0 ? (step.why || STR.star) : STR.starsFull, { icon: 'star', kind: 'star', sub: delta > 0 && step.why ? STR.star : null });
        if (delta > 0) await gm.react('star.award');
        await ctx.gm.director?.teach?.('star');
      } else if (delta < 0) {
        audio.sfx('star.spend');
        ui.toast(step.why || STR.starLost, { icon: 'star', kind: 'star' });
      }
      return;
    }
    if ('heal' in step) {
      const who = step.who === 'actor' && gm.actor ? gm.actor : 'all';
      state.heal(who, step.heal === 'full' ? 'full' : Number(step.heal) || 0);
      audio.sfx('heal');
      ui.toast(STR.heal, { icon: 'heart', kind: 'info', ms: 1800 });
      return;
    }
    if ('hurt' in step) {
      const n = Number(step.hurt) || 0;
      const list = step.who !== 'all' && gm.actor ? [state.hero(gm.actor)] : state.party;
      for (const hero of list.filter(Boolean)) state.damage(hero.id, n, { floor: 1 });
      audio.sfx('hero.hurt');
      ui.toast(STR.hurt(n), { icon: 'heart', kind: 'hurt', ms: 1800 });
      return;
    }
    if ('set' in step) { for (const [k, v] of Object.entries(step.set)) state.setFlag(k, v); return; }
    if ('add' in step) { for (const [k, v] of Object.entries(step.add)) state.addCounter(k, Number(v) || 0); return; }
    if ('if' in step) return state.test(step.if) ? branch(step.then, frame) : branch(step.else, frame);
    if ('quest' in step) {
      const isNew = !state.quests.find((q) => q.id === step.quest.id);
      state.quest(step.quest);
      if (isNew) { audio.sfx('quest'); ui.toast(step.quest.title, { icon: 'book', kind: 'quest', sub: STR.quest }); }
      return;
    }
    if ('questDone' in step) {
      const q = state.quests.find((x) => x.id === step.questDone);
      if (q && q.done) return;
      state.questDone(step.questDone);
      audio.sfx('quest');
      await ui.banner(STR.questDone, { kind: 'quest', sub: q?.title || '', hold: 1200 });
      return;
    }
    if ('journal' in step) { state.addJournal(step.journal); ui.toast(STR.journal, { icon: 'book', kind: 'info', ms: 1600 }); return; }
    if ('table' in step) {
      const t = step.table;
      const joined = await gm.table({ text: t.text, done: t.done, star: t.star });
      if (joined) {
        state.tallyAdd('tableMoments');
        if (t.star) { const d = state.addStar(t.star, STR.joining); if (d > 0) { audio.sfx('star.gain'); ui.toast(STR.joining, { icon: 'star', kind: 'star', sub: STR.star }); } }
        // only a table moment that carries a Star talks about Stars (ROUND2 4); the others thank the table
        const pool = t.star ? 'star.award' : (ctx.content.gmLines?.['table.thanks']?.length ? 'table.thanks' : null);
        if (pool) await gm.react(pool);
      }
      return;
    }
    if ('travel' in step) { gm.hide(); await ctx.screens.go('travel', step.travel); return; }
    if ('rest' in step) { await gm.react('rest.intro'); await ctx.screens.go('rest'); return; }
    if ('levelup' in step) { await gm.react('levelup.intro'); await ctx.screens.go('levelup', Number(step.levelup)); return; }
    if ('actor' in step) { gm.setActor(resolveActor(step.actor)); return; }

    console.warn('[scene] unknown step', step);
    return undefined;
  }

  // a talent's name as the players read it: the hero content's own (translated) name, else the rules' fallback
  function talentName(id) {
    for (const hc of Object.values(ctx.content.heroes || {})) if (hc?.talent?.id === id && hc.talent.name) return hc.talent.name;
    return R.TALENT_NAMES[id] || id;
  }

  function resolveActor(a) {
    const party = state.party.filter((x) => x.hp > 0);
    const list = party.length ? party : state.party;
    if (!a || !list.length) return null;
    if (a === 'spotlight') return ctx.gm.director?.spotlight?.(list) || [...list].sort((x, y) => (x.acts || 0) - (y.acts || 0))[0].id;
    if (a.startsWith('best:')) {
      const stat = a.slice(5);
      return [...list].sort((x, y) => R.statValue(y, stat) - R.statValue(x, stat))[0].id;
    }
    return state.hero(a)?.id || null;
  }

  // ---------------- choice ----------------
  async function doChoice(choice, outer) {
    const used = new Set();
    for (let round = 0; round < 50; round++) {
      gm.setActor(null);
      const v = vars();
      const visible = [];
      (choice.options || []).forEach((o, i) => {
        if (used.has(i) && o.once) return;
        if (o.requires && !state.test(o.requires)) return;
        let hero = null;
        if (o.talent) { hero = state.hasTalent(o.talent); if (!hero) return; }
        visible.push({ o, i, hero });
      });
      if (!visible.length) return undefined;
      const id = await gm.choose({
        prompt: fmt(choice.prompt || STR.what, v),
        options: visible.map(({ o, i, hero }) => ({
          id: String(i), label: fmt(o.label, hero ? { ...v, actor: hero.name.split(' ')[0] } : v), hint: o.hint ? fmt(o.hint, v) : null,
          stat: o.stat || null, hero: hero?.id || null, talent: o.talent || null, talentName: o.talent ? talentName(o.talent) : null,
        })),
      });
      const pick = visible.find((x) => String(x.i) === String(id));
      used.add(pick.i);
      if (pick.hero) { gm.setActor(pick.hero.id); pick.hero.acts = (pick.hero.acts || 0) + 1; }
      const frame = { ...outer, choice: { again: false } };
      const exit = await run(pick.o.steps || [], frame);
      if (exit) return exit;
      if (!frame.choice.again) return undefined;
    }
    console.error('[scene] choice repeated too often', choice.prompt);
    return undefined;
  }

  // ---------------- check ----------------
  async function doCheck(c, frame) {
    const r = await runCheck(ctx, { stat: c.stat, dc: c.dc, label: fmt(c.label || '', vars()), talent: c.talent, who: c.who, hasPartial: !!c.partial, actor: gm.actor });
    const hero = state.hero(r.heroId);
    if (hero) hero.acts = (hero.acts || 0) + 1;
    gm.setActor(r.heroId);
    const steps = r.outcome === 'crit' ? (c.crit || c.success)
      : r.outcome === 'success' ? c.success
      : r.outcome === 'partial' ? (c.partial || c.fail)
      : r.outcome === 'fumble' ? (c.fumble || c.fail)
      : c.fail;
    return branch(steps, frame);
  }

  // ---------------- skill (ROUND2 3.1) ----------------
  // Same place in the story as a check, same outcomes: crit falls back to success, partial to fail.
  async function doSkill(c, frame) {
    const spec = { kind: c.kind, stat: c.stat, dc: c.dc, label: fmt(c.label || '', vars()), talent: c.talent, who: c.who,
      hasPartial: !!c.partial, actor: gm.actor };
    if (c.who === 'actor' && gm.actor) spec.heroId = gm.actor;
    const r = await ctx.screens.go('skill', spec) || { outcome: 'success', heroId: gm.actor || state.party[0]?.id };
    const hero = state.hero(r.heroId);
    if (hero) hero.acts = (hero.acts || 0) + 1;
    gm.setActor(r.heroId || null);
    const steps = r.outcome === 'crit' ? (c.crit || c.success)
      : r.outcome === 'success' ? c.success
      : r.outcome === 'partial' ? (c.partial || c.fail)
      : c.fail;
    return branch(steps, frame);
  }

  // ---------------- combat ----------------
  async function doCombat(step, frame) {
    gm.setActor(null);
    await ctx.gm.director?.teach?.('battle');
    const dir = ctx.gm.director;
    let res;
    for (let attempt = 0; attempt < 3; attempt++) {
      dir?.battleStart?.();
      ctx.bus.emit('combat:start', { id: step.combat, attempt });
      res = await ctx.screens.go('combat', step.combat, { lose: !!step.lose }) || { result: 'win', befriended: [], defeated: [] };
      dir?.battleEnd?.();
      ctx.bus.emit('combat:end', { id: step.combat, ...res });
      if (res.result !== 'lose' || step.lose) break;
      // mercy: turn the page back, then the second time the foes simply flee
      if (dir) dir.rewinds = (dir.rewinds || 0) + 1;
      await gm.react('mercy.rewind');
      state.heal('all', 'full');
      if ((dir?.rewinds || attempt + 1) >= 2) { res = { result: 'win', befriended: [], defeated: [], fled: true }; break; }
      ctx.mercyFoeHp = 0.75;
    }
    ctx.mercyFoeHp = null;
    // dazed heroes stand up with 1 heart
    for (const x of state.party) if (x.hp <= 0) state.heal(x.id, 1);
    if (res.result === 'lose') return branch(step.lose, frame);
    if (res.result === 'befriend') return branch(step.befriend || step.win, frame);
    return branch(step.win, frame);
  }

  // ---------------- puzzles ----------------
  async function doPuzzle(step, frame) {
    gm.setActor(null);
    if (step.puzzle === 'melody') {
      const r = await ctx.screens.go('melody', { mode: step.mode || 'learn', phrase: step.phrase }) || { ok: true, mistakes: 0 };
      state.tallyAdd('songMistakes', r.mistakes || 0);
      return branch(r.ok || !step.fail ? step.success : step.fail, frame);
    }
    if (step.puzzle === 'runes') {
      const ok = await ctx.screens.go('runes');
      return branch(ok || !step.fail ? step.success : step.fail, frame);
    }
    console.warn('[scene] unknown puzzle', step.puzzle);
    return branch(step.success, frame);
  }

  // ---------------- go ----------------
  const exit = await run(scene.steps, {});
  ctx.hud?.sceneTitle?.(null);
  if (exit?.exit === 'goto') return exit.to;
  if (exit?.exit === 'end') return 'end';
  console.warn(`[scene] ${sceneId} ran out of steps without goto or end; ending`);
  return 'end';
}
