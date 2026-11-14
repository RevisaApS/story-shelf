// The director (SPEC 9): spotlight, mercy, pace, teaching, welcome back. Lives at ctx.gm.director.
//
// director.spotlight(heroes?) -> heroId|null       the hero with the fewest acts (only when the spread is 1+)
// director.checkTarget(target) -> { target, mercy } after two failed checks in a row: target - 2, says mercy.check
// director.onCheckResult(result)
// director.battleMercy() -> Promise<bool>          once per battle: heal 4 to all + mercy.battle line (combat calls it
//                                                  when half the party is dazed; also check director.battleMercyUsed)
// director.battleStart() / director.battleEnd()    combat calls these (reset per-battle mercy)
// director.rewinds                                 how many times this scene's battle was "turned back"
// director.teach(kind) -> Promise                  'check'|'battle'|'star'|'item'|'befriend', once per save
// director.welcomeBack() -> Promise                on Continue
import * as R from '../core/rules.js';

export function createDirector(ctx) {
  let failStreak = 0;
  let mercyPending = false;
  let nudgeTimer = null;
  let battleMercyUsed = false;

  const d = {
    rewinds: 0,
    get battleMercyUsed() { return battleMercyUsed; },

    spotlight(list = ctx.state.party) {
      const heroes = (list || []).filter(Boolean);
      if (heroes.length < 2) return null;
      const acts = heroes.map((x) => x.acts || 0);
      const min = Math.min(...acts), max = Math.max(...acts);
      if (max - min < 1) return null;
      return heroes.find((x) => (x.acts || 0) === min)?.id || null;
    },

    checkTarget(target) {
      if (failStreak >= 2) {
        mercyPending = true;
        const line = ctx.gm.line('mercy.check');
        if (line) ctx.gm.aside(line);
        return { target: target - R.MERCY_DC_DROP, mercy: true };
      }
      return { target, mercy: false };
    },
    onCheckResult(r) {
      if (!r) return;
      if (R.isPass(r.outcome)) failStreak = 0;
      else if (mercyPending) failStreak = 0;
      else failStreak++;
      mercyPending = false;
    },

    battleStart() { battleMercyUsed = false; },
    battleEnd() { battleMercyUsed = false; },
    async battleMercy() {
      if (battleMercyUsed) return false;
      battleMercyUsed = true;
      for (const x of ctx.state.party) if (x.hp > 0) ctx.state.heal(x.id, 4);
      ctx.audio.sfx('heal');
      await ctx.gm.react('mercy.battle');
      return true;
    },

    async teach(kind) {
      const f = `teach.${kind}`;
      if (ctx.state.flag(f)) return;
      ctx.state.setFlag(f, true);
      await ctx.gm.react(f);
    },

    async welcomeBack() {
      await ctx.gm.react('welcome.back');
      const last = ctx.state.journal[ctx.state.journal.length - 1];
      if (last?.text) await ctx.gm.say(last.text, { mood: 'warm' });
    },
  };

  // Pace: one gentle nudge when a choice (or hub) waits 25 s with no tap, click or key press. Mouse moves
  // don't count. Every press restarts the wait; the nudge fires at most once per choice.
  const IDLE_MS = 25000;
  let stopIdle = () => {};
  ctx.bus.on('gm:choice:open', () => {
    stopIdle();
    if (ctx.auto) return;
    const arm = () => { clearTimeout(nudgeTimer); nudgeTimer = setTimeout(fire, IDLE_MS); };
    const fire = () => {
      stopIdle();
      const line = ctx.gm.line('idle.nudge');
      if (line) ctx.gm.aside(line);
    };
    window.addEventListener('pointerdown', arm, true);
    window.addEventListener('keydown', arm, true);
    stopIdle = () => {
      clearTimeout(nudgeTimer);
      window.removeEventListener('pointerdown', arm, true);
      window.removeEventListener('keydown', arm, true);
      stopIdle = () => {};
    };
    arm();
  });
  ctx.bus.on('gm:choice:close', () => stopIdle());
  ctx.bus.on('scene:entered', () => { d.rewinds = 0; });

  return d;
}
