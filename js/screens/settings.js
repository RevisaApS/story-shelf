// Settings (SPEC 11): openSettings(ctx) -> void
// Volumes (master, music, effects, voice), voice on/off, text speed, reduce motion, fullscreen,
// restart adventure (with a confirm), language (saves settings.lang and reloads), change story (back to the shelf).
// Every change is saved at once.
import { h, tap, wait } from '../ui/dom.js';
import { L, getLang } from '../core/i18n.js';

const STR = L({
  en: {
    title: 'Settings', kicker: 'The Storykeeper\'s table',
    sound: 'Sound', master: 'Master', music: 'Music', sfx: 'Effects', voice: 'Voice',
    story: 'Story', voiceOn: 'Old Quill speaks aloud', textSpeed: 'Text speed',
    speeds: { slow: 'Slow', normal: 'Normal', fast: 'Fast' },
    lang: 'Language',
    view: 'Screen', reduce: 'Calmer motion', full: 'Fullscreen', fullOn: 'Leave fullscreen',
    restart: 'Restart adventure', sure: 'Start again from the very beginning? Your saved adventure will be lost.',
    yes: 'Yes, start again', no: 'Keep playing', shelf: 'Change story',
    done: 'Done',
  },
  da: {
    title: 'Indstillinger', kicker: 'Sagnvogterens bord',
    sound: 'Lyd', master: 'Samlet', music: 'Musik', sfx: 'Effekter', voice: 'Stemme',
    story: 'Historie', voiceOn: 'Gamle Fjer læser højt', textSpeed: 'Teksthastighed',
    speeds: { slow: 'Langsom', normal: 'Normal', fast: 'Hurtig' },
    lang: 'Sprog',
    view: 'Skærm', reduce: 'Roligere bevægelser', full: 'Fuld skærm', fullOn: 'Luk fuld skærm',
    restart: 'Start forfra', sure: 'Starte helt forfra? Det gemte eventyr bliver væk.',
    yes: 'Ja, start forfra', no: 'Spil videre', shelf: 'Skift historie',
    done: 'Færdig',
  },
});
const LANG_NAMES = { da: 'Dansk', en: 'English' };

export async function openSettings(ctx) {
  const s = ctx.settings;
  const layer = ctx.stage.layers.overlay;
  const save = () => { try { s.save?.(); } catch { /* ignore */ } };
  const vol = () => { ctx.applyVolume ? ctx.applyVolume() : ctx.audio.setVolume?.({ master: s.master, music: s.music, sfx: s.sfx, voice: s.voice }); };

  const slider = (key, label) => {
    const fill = h('i');
    const input = h('input', { type: 'range', min: '0', max: '100', step: '1', value: String(Math.round((s[key] ?? 1) * 100)), 'aria-label': label });
    const val = h('b');
    const paint = () => { fill.style.width = `${input.value}%`; val.textContent = String(input.value); };
    paint();
    input.addEventListener('input', () => { s[key] = Number(input.value) / 100; paint(); vol(); });
    input.addEventListener('change', () => { save(); ctx.audio.sfx(key === 'voice' ? 'ui.page' : 'ui.tap'); });
    return h('label.sa-set-row', h('span.sa-set-label', label), h('div.sa-set-slider', h('div.sa-set-track', fill), input), val);
  };
  const toggle = (label, get, set) => {
    const sw = h('button.sa-set-switch', { type: 'button', role: 'switch', 'aria-checked': String(!!get()) }, h('i'));
    tap(sw, () => { set(!get()); sw.setAttribute('aria-checked', String(!!get())); save(); }, ctx);
    return h('div.sa-set-row', h('span.sa-set-label', label), sw);
  };
  const speeds = h('div.sa-set-seg', Object.entries(STR.speeds).map(([k, l]) => {
    const b = h('button', { type: 'button', class: s.textSpeed === k ? 'is-on' : null }, l);
    tap(b, () => { s.textSpeed = k; save(); [...speeds.children].forEach((c) => c.classList.toggle('is-on', c === b)); }, ctx);
    return b;
  }));

  // Language: saved for every story; the page reloads in the new language (a running game continues from its save).
  const langs = h('div.sa-set-seg.sa-set-lang', ['da', 'en'].map((l) => {
    const b = h('button', { type: 'button', class: getLang() === l ? 'is-on' : null, lang: l }, LANG_NAMES[l]);
    tap(b, () => {
      if (getLang() === l) return;
      s.lang = l; save();
      [...langs.children].forEach((c) => c.classList.toggle('is-on', c === b));
      resolveDone('lang');
    }, ctx);
    return b;
  }));
  const shelfBtn = ctx.toShelf ? ctx.ui.button(STR.shelf, { kind: 'ghost', cls: 'sa-set-small', icon: 'book' }) : null;

  const fsBtn = ctx.ui.button(document.fullscreenElement ? STR.fullOn : STR.full, { kind: 'ghost', cls: 'sa-set-small' });
  tap(fsBtn, async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen?.();
    } catch { /* not allowed here */ }
    setTimeout(() => { fsBtn.querySelector('span').textContent = document.fullscreenElement ? STR.fullOn : STR.full; }, 150);
  });

  const confirmBox = h('div.sa-set-confirm', h('p', STR.sure));
  const yes = ctx.ui.button(STR.yes, { kind: 'danger' });
  const no = ctx.ui.button(STR.no, { kind: 'ghost' });
  confirmBox.append(h('div.sa-set-confirm-btns', no, yes));
  const restartBtn = ctx.ui.button(STR.restart, { kind: 'danger', cls: 'sa-set-small' });

  let resolveDone;
  const doneP = new Promise((r) => { resolveDone = r; });
  const doneBtn = ctx.ui.button(STR.done, { kind: 'primary', onClick: () => resolveDone('done'), sfx: 'ui.confirm' });
  const closeX = h('button.sa-set-x', { type: 'button', 'aria-label': STR.done }, ctx.ui.icon('close'));
  tap(closeX, () => resolveDone('done'), ctx);

  const box = h('div.sa-set.lf-panel',
    closeX,
    h('div.lf-modal-head', h('div.lf-kicker', STR.kicker), h('h2.lf-title', STR.title), h('div.lf-divider')),
    h('div.sa-set-cols',
      h('section', h('h3.sa-set-h', STR.sound), slider('master', STR.master), slider('music', STR.music), slider('sfx', STR.sfx), slider('voice', STR.voice)),
      h('section',
        h('h3.sa-set-h', STR.story),
        toggle(STR.voiceOn, () => s.voiceOn !== false, (v) => { s.voiceOn = v; if (!v) ctx.audio.stopVoice?.(); }),
        h('div.sa-set-row', h('span.sa-set-label', STR.textSpeed), speeds),
        h('div.sa-set-row', h('span.sa-set-label', STR.lang), langs),
        h('h3.sa-set-h', STR.view),
        toggle(STR.reduce, () => !!s.reduceMotion, (v) => { s.reduceMotion = v; document.documentElement.classList.toggle('lf-reduce', v); }),
        h('div.sa-set-row.sa-set-btnrow', fsBtn, restartBtn),
        shelfBtn ? h('div.sa-set-row.sa-set-btnrow', shelfBtn) : null)),
    confirmBox,
    h('div.lf-modal-btns', doneBtn));
  const wrap = h('div.lf-modal-wrap.sa-set-wrap', box);
  wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) resolveDone('done'); });
  tap(restartBtn, () => { box.classList.add('is-confirm'); ctx.audio.sfx('sting.danger', { volume: 0.5 }); });
  tap(no, () => box.classList.remove('is-confirm'));
  tap(yes, () => resolveDone('restart'));
  if (shelfBtn) tap(shelfBtn, () => resolveDone('shelf'));
  const onKey = (e) => { if (e.key === 'Escape') resolveDone('done'); };
  window.addEventListener('keydown', onKey);

  layer.appendChild(wrap);
  ctx.audio.sfx('ui.open');
  await wait(20);
  wrap.classList.add('is-in');
  if (ctx.auto) ctx.sleep(600).then(() => resolveDone('done'));

  const result = await doneP;
  window.removeEventListener('keydown', onKey);
  save();
  ctx.audio.sfx('ui.close');
  wrap.classList.remove('is-in');
  await ctx.sleep(340);
  wrap.remove();
  if (result === 'restart' || result === 'lang' || result === 'shelf') {
    if (result === 'restart') ctx.save?.clear?.();
    if (result === 'shelf') { ctx.toShelf(); await new Promise(() => {}); }
    const keep = new URLSearchParams(location.search);
    const q = new URLSearchParams();
    for (const k of ['content', 'game']) if (keep.get(k)) q.set(k, keep.get(k));
    // a ?lang= override survives a restart; only an explicit language change drops it (settings.lang then rules)
    if (result !== 'lang' && keep.get('lang')) q.set('lang', keep.get('lang'));
    location.href = location.pathname + (q.toString() ? `?${q}` : '');
    await new Promise(() => {});
  }
}
