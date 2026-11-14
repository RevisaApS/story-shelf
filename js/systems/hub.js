// Explore hubs (SPEC 8.2 hub): glowing markers on the scene at stage x,y. After each spot the hub returns.
// Visited spots are remembered in flags hub.<id>.<spotId>; `once` spots vanish after a visit.
// runHub(ctx, hub, runSteps(steps) -> Promise<exit|undefined>) -> Promise<exit|undefined>
import { h, tap, wait, fmt } from '../ui/dom.js';
import { L } from '../core/i18n.js';

const ICON_MAP = { star: 'star', dice: 'dice', shop: 'coin', coin: 'coin', cart: 'coin', heal: 'heart', heart: 'heart', scroll: 'book', book: 'book', map: 'map', talk: 'talk', gift: 'gift', gem: 'gem', crystal: 'gem', stone: 'gem', pie: 'gift', well: 'drop', bat: 'wing', door: 'lock', lock: 'lock' };
const STR = L({
  en: { leave: 'Move on', visited: 'Visited', locked: 'Not yet', you: 'you', party: 'the party', prompt: 'Where do you go?' },
  da: { leave: 'Gå videre', visited: 'Besøgt', locked: 'Ikke endnu', you: 'du', party: 'flokken', prompt: 'Hvor går I hen?' },
});

export async function runHub(ctx, hub, runSteps) {
  const { state } = ctx;
  const layer = ctx.stage.layers.screen;
  const key = (spotId) => `hub.${hub.id}.${spotId}`;
  const vars = { actor: ctx.gm.actor ? state.hero(ctx.gm.actor)?.name.split(' ')[0] : STR.you, party: STR.party };
  let guard = 0;

  while (guard++ < 200) {
    ctx.gm.setActor(null);
    const spots = (hub.spots || []).filter((s) => state.test(s.requires) && !(s.once && state.flag(key(s.id))));
    const leave = hub.leave || { label: STR.leave };
    const leaveOpen = state.test(leave.requires);

    const wrap = h('div.lf-hub', { 'data-no-advance': '' });
    let resolvePick;
    const picked = new Promise((r) => { resolvePick = r; });
    let done = false;
    const pick = (v) => { if (done) return; done = true; ctx.audio.sfx('ui.confirm'); resolvePick(v); };

    spots.forEach((s, i) => {
      const visited = state.flag(key(s.id));
      const iconName = ICON_MAP[s.icon] || null;
      const m = h('button.lf-hub-marker', { type: 'button', class: visited ? 'is-visited' : null, dataset: { spot: s.id }, style: { left: `${s.x}px`, top: `${s.y}px`, '--d': `${i * 0.37}s` } },
        h('span.lf-hub-ring'), h('span.lf-hub-ring.lf-hub-ring--2'),
        h('span.lf-hub-core', iconName ? ctx.ui.icon(iconName) : h('span.lf-hub-dot')),
        visited ? h('span.lf-hub-check', ctx.ui.icon('check')) : null,
        h('span.lf-hub-label', fmt(s.label, vars), visited ? h('small', STR.visited) : null));
      tap(m, () => pick({ spot: s }), ctx);
      wrap.appendChild(m);
    });
    const leaveBtn = ctx.ui.button(fmt(leave.label || STR.leave, vars), { kind: leaveOpen ? 'primary' : 'ghost', cls: 'lf-hub-leave', icon: leaveOpen ? null : 'lock', onClick: () => {
      if (leaveOpen) pick({ leave: true });
      else if (leave.lockedHint) ctx.gm.aside(leave.lockedHint);
    } });
    if (!leaveOpen) leaveBtn.setAttribute('aria-disabled', 'true'), leaveBtn.removeAttribute('disabled');
    wrap.appendChild(h('div.lf-hub-leave-wrap', leaveBtn, !leaveOpen && leave.lockedHint ? h('div.lf-hub-locked', fmt(leave.lockedHint, vars)) : null));
    layer.appendChild(wrap);
    await wait(20);
    wrap.classList.add('is-in');

    // prompt in the narration panel without choice cards
    ctx.gm.showPrompt?.(fmt(hub.prompt || STR.prompt, vars));
    ctx.bus.emit('gm:choice:open', { prompt: hub.prompt, hub: hub.id });
    ctx.bus.emit('hub:open', { id: hub.id, spots: spots.map((s) => s.id), leaveOpen });

    if (ctx.auto) {
      ctx.sleep(500).then(() => {
        const fresh = spots.filter((s) => !state.flag(key(s.id)));
        if (fresh.length) return pick({ spot: ctx.auto.policy === 'first' ? fresh[0] : ctx.auto.rng.pick(fresh) });
        if (leaveOpen) return pick({ leave: true });
        if (spots.length) return pick({ spot: ctx.auto.rng.pick(spots) });
        console.warn('[hub] auto: no open spot and leave is locked; leaving', hub.id);
        pick({ leave: true });
      });
    }

    const choice = await picked;
    ctx.bus.emit('gm:choice:close', {});
    wrap.classList.remove('is-in');
    wrap.classList.add('is-out');
    setTimeout(() => wrap.remove(), 450);
    ctx.gm.clearPrompt?.();

    if (choice.leave) {
      ctx.bus.emit('hub:leave', { id: hub.id });
      if (leave.steps) return runSteps(leave.steps);
      return undefined;
    }
    const s = choice.spot;
    state.setFlag(key(s.id), true);
    ctx.bus.emit('hub:spot', { id: hub.id, spot: s.id });
    const exit = await runSteps(s.steps || []);
    if (exit) return exit;
  }
  console.error('[hub] too many visits, leaving', hub.id);
  return undefined;
}

export { ICON_MAP };
