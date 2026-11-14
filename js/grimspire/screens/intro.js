// The intro (GRIMSPIRE.md 3.4). gsIntro(ctx) -> void
// story.intro (about ten voiced lines over the key art and the camp) through the shared step interpreter,
// with storm weather, the camp music and a Skip button (top right) that fast-forwards to the end.
import { h, tap } from '../../ui/dom.js';
import { L } from '../../core/i18n.js';
import { icon, sfx } from '../hud.js';
import { runSteps } from './room.js';

const STR = L({ en: { skip: 'Skip' }, da: { skip: 'Spring over' } });

export async function gsIntro(ctx) {
  const steps = ctx.content.story?.intro || [];
  if (!steps.length) return;
  ctx.hud.suppress(true);
  const layer = ctx.stage.layers.fx;
  const skip = h('button.gs-skip', { type: 'button', 'data-no-advance': '' }, h('span', STR.skip), icon('play'));
  layer.appendChild(skip);
  requestAnimationFrame(() => skip.classList.add('is-in'));
  let running = true, skipping = null;
  tap(skip, () => {
    if (skipping) return;
    sfx(ctx, 'ui.confirm');
    skip.classList.add('is-gone');
    skipping = setInterval(() => {
      if (!running) return;
      if (ctx.stage.layers.overlay.childElementCount) return;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    }, 45);
  }, ctx, { sfx: null });
  try {
    await runSteps(ctx, 'gs.intro', steps, { bg: 'gs_title', music: 'gs_camp', weather: 'rain' });
  } finally {
    running = false;
    ctx.hud.suppress(false);
    clearInterval(skipping);
    skip.classList.remove('is-in');
    setTimeout(() => skip.remove(), 400);
    ctx.weather?.set?.('none');
  }
}
