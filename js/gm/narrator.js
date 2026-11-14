/* The narrator: Old Quill's panel at the bottom of the stage (SPEC 9). Public API on ctx.gm (stable; may grow):
 *
 *   gm.say(text, { as='gm', mood='warm', quick=false, voiceAs? }) -> Promise
 *       Types the line in step with the voice (audio.voice(voiceId(as, mood, text))). Tap / click / Space / Enter:
 *       the first press completes the line, the second moves on. quick: auto-advances after the voice (max 4 s).
 *       `as` is 'gm' or an npc id (portrait + name plate). Lines from content pools use mood 'warm' for the voice id.
 *   gm.choose({ prompt, options:[ { id, label, hint?, stat?, hero?, talent?, disabled?, why? } ] }) -> Promise<id>
 *       Choice cards above the panel. `hero` shows that hero's portrait (talent options). Keys 1-9 pick.
 *   gm.react(poolKey) -> Promise        one line from content.gmLines[poolKey], never the same twice in a row; quick
 *   gm.line(poolKey) -> string|null     pick a pool line without saying it
 *   gm.table({ text, done='We did it!', star }) -> Promise<boolean>   a table moment; true when the table joined in
 *   gm.aside(text, { mood }) -> Promise  a short voiced line that does not wait for input (used for nudges)
 *   gm.setActor(heroId|null), gm.actor (current actor id), gm.hide(), gm.show(), gm.isBusy()
 *   gm.showPrompt(text), gm.clearPrompt()  a gold prompt in the panel with no cards (hubs)
 *   gm.director                         set by director.js (spotlight, mercy, pace, teaching, welcome back)
 *
 * Emits bus 'gm:line' { text, as, mood } for every spoken line, 'gm:choice:open' / 'gm:choice:close'.
 */
import { h, tap, wait } from '../ui/dom.js';
import { voiceId } from '../core/voiceid.js';
import { L } from '../core/i18n.js';

const STR = L({
  en: { quill: 'Old Quill', what: 'What do you do?', talent: 'Talent', table: 'Table moment! Everyone joins in.', done: 'We did it!',
    earns: (n) => `Earns ${n === 1 ? 'a Star' : n + ' Stars'}`, skip: 'Maybe next time', cue: 'Tap to continue' },
  da: { quill: 'Gamle Fjer', what: 'Hvad gør du?', talent: 'Talent', table: 'Bordøjeblik! Alle er med.', done: 'Vi gjorde det!',
    earns: (n) => `Giver ${n === 1 ? 'en Stjerne' : n + ' Stjerner'}`, skip: 'Måske næste gang', cue: 'Tryk for at fortsætte' },
});

const CPS = { slow: 24, normal: 36, fast: 58, instant: 9999 };

export function createNarrator(ctx) {
  const layer = ctx.stage.layers.gm;
  const ui = ctx.ui;

  const speakerSlot = h('div.lf-narr-speaker');
  const actorSlot = h('div.lf-narr-actor');
  const textEl = h('div.lf-narr-text');
  // data-cue: a "tap to continue" label a theme may show beside the arrow (the Grimspire theme does)
  const more = h('div.lf-narr-more', { dataset: { cue: STR.cue } }, ui.icon('chevron'));
  const panel = h('div.lf-narration.lf-panel.is-hidden', { 'aria-live': 'polite' },
    h('div.lf-narr-mood-glow'), speakerSlot, actorSlot, textEl, more);
  const choicesEl = h('div.lf-choices', { role: 'group' });
  layer.append(choicesEl, panel);

  let actorId = null;
  let currentSpeaker = null;
  let advanceFn = null; // set while a line waits for input
  let busy = false;
  const lastPick = new Map();

  // ---------- input ----------
  const isInteractive = (t) => t.closest('button, a, input, select, .lf-choice, .lf-hub-marker, .lf-hud, [data-no-advance], #overlay-layer > *');
  ctx.stage.el.addEventListener('pointerup', (e) => {
    if (!advanceFn || e.button > 0) return;
    // a tap anywhere on the speech box always advances, whatever screen sits behind it
    if (isInteractive(e.target) && !panel.contains(e.target)) return;
    advanceFn();
  });
  window.addEventListener('keydown', (e) => {
    if (!advanceFn) return;
    if (e.key !== ' ' && e.key !== 'Enter') return;
    if (ctx.stage.layers.overlay.childElementCount) return;
    if (document.activeElement && document.activeElement.tagName === 'BUTTON' && e.key === 'Enter') return;
    e.preventDefault();
    advanceFn();
  });

  // ---------- speaker ----------
  function setSpeaker(as, mood) {
    const key = `${as}|${as === 'gm' ? mood : ''}`;
    if (key === currentSpeaker) return;
    currentSpeaker = key;
    const npc = ctx.content?.npcs?.[as];
    const name = as === 'gm' ? (npc?.name || STR.quill) : (npc?.name || as.replace(/_/g, ' '));
    // long names (Glint the Magnificent) get smaller type and may take two lines instead of being cut
    const plate = h('div.lf-nameplate', { class: [as === 'gm' ? 'is-gm' : null, name.length > 13 ? 'is-long' : null].filter(Boolean).join(' ') || null }, name);
    speakerSlot.replaceChildren(ui.portrait(as, 'lg', { mood }), plate);
  }

  function renderActor() {
    const hero = actorId ? ctx.state.hero(actorId) : null;
    const showIt = hero && currentSpeaker?.startsWith('gm|');
    if (showIt && actorSlot.dataset.id !== hero.id) {
      actorSlot.dataset.id = hero.id;
      actorSlot.replaceChildren(ui.portrait(hero.id, 'sm'), h('span.lf-narr-actor-name', hero.name.split(' ')[0]));
    }
    actorSlot.classList.toggle('is-on', !!showIt);
  }

  function setText(text, { npc = false, prompt = false, mood = 'warm' } = {}) {
    const p = h('p');
    const words = [];
    const parts = String(text).split(/(\s+)/);
    for (const part of parts) {
      if (!part) continue;
      if (/^\s+$/.test(part)) p.appendChild(document.createTextNode(' '));
      else { const w = h('span.w', part); words.push(w); p.appendChild(w); }
    }
    // An NPC line is quoted: the marks live inside the first and last word, so the closing mark
    // appears with the last word and never wraps onto a line of its own.
    if (npc && words.length) {
      words[0].prepend(h('span.lf-q.lf-q-open', '\u201C'));
      words[words.length - 1].append(h('span.lf-q.lf-q-close', '\u201D'));
    }
    textEl.className = 'lf-narr-text' + (npc ? ' is-npc' : '') + (prompt ? ' is-prompt' : '');
    textEl.dataset.mood = mood;
    textEl.replaceChildren(p);
    // Shrink very long lines so they never overflow the panel.
    const len = String(text).length;
    p.style.fontSize = len > 170 ? '22px' : len > 140 ? '23.5px' : '';
    return words;
  }

  function show() { panel.classList.remove('is-hidden'); }
  function hide() { panel.classList.add('is-hidden'); more.classList.remove('is-on'); }

  // ---------- say ----------
  async function say(text, { as = 'gm', mood = 'warm', quick = false, voiceAs } = {}) {
    if (text == null || text === '') return;
    text = String(text);
    busy = true;
    const speaker = as || 'gm';
    ctx.bus.emit('gm:line', { text, as: speaker, mood });
    panel.classList.remove('is-prompt');
    panel.dataset.mood = mood;
    setSpeaker(speaker, mood);
    renderActor();
    show();
    more.classList.remove('is-on');
    const words = setText(text, { npc: speaker !== 'gm', mood });

    const vid = voiceId(voiceAs || speaker, mood, text);
    const voiceOn = ctx.settings.voiceOn !== false && !ctx.fast;
    const dur = voiceOn ? (ctx.audio.voiceDuration?.(vid) || 0) : 0;
    let voiceDone = !voiceOn || !dur;
    const voiceP = voiceOn ? Promise.resolve(ctx.audio.voice(vid)).catch(() => {}).then(() => { voiceDone = true; }) : Promise.resolve();

    panel.classList.add('is-talking');
    const cps = ctx.fast ? 9999 : (CPS[ctx.settings.textSpeed] || CPS.normal);
    const total = text.length;
    const typeMs = dur ? dur * 1000 * 0.9 : (total / cps) * 1000;

    let complete = false;
    let resolveAdvance;
    const advanced = new Promise((r) => { resolveAdvance = r; });
    const completeNow = () => { complete = true; words.forEach((w) => w.classList.add('on')); more.classList.add('is-on'); panel.classList.remove('is-talking'); };
    advanceFn = () => {
      if (!complete) { completeNow(); ctx.audio.sfx('ui.page', { volume: 0.4 }); return; }
      resolveAdvance('tap');
    };

    // type out word by word
    (async () => {
      let chars = 0;
      const t0 = performance.now();
      for (const w of words) {
        if (complete) break;
        chars += w.textContent.length + 1;
        const target = (chars / total) * typeMs;
        const now = performance.now() - t0;
        if (target > now) await wait(Math.min(400, target - now) / (window.__LF_SPEED || 1));
        if (complete) break;
        w.classList.add('on');
      }
      if (!complete) completeNow();
    })();

    if (ctx.auto || quick) {
      (async () => {
        while (!complete) await wait(30);
        if (quick && !ctx.auto) await Promise.race([voiceP, ctx.sleep(4000)]);
        else await Promise.race([voiceP, ctx.sleep(4000)]);
        await ctx.sleep(ctx.auto ? Math.max(500, text.length * 12) : 500);
        resolveAdvance('auto');
      })();
    }

    await advanced;
    advanceFn = null;
    if (!voiceDone) ctx.audio.stopVoice();
    more.classList.remove('is-on');
    panel.classList.remove('is-talking');
    busy = false;
  }

  // ---------- aside (non-blocking) ----------
  async function aside(text, { mood = 'warm', as = 'gm' } = {}) {
    if (!text) return;
    ctx.bus.emit('gm:line', { text, as, mood, aside: true });
    const prev = [...textEl.childNodes], prevCls = textEl.className;
    setSpeaker(as, mood);
    const words = setText(text, { npc: as !== 'gm', mood });
    words.forEach((w) => w.classList.add('on'));
    const p = Promise.resolve(ctx.settings.voiceOn !== false && !ctx.fast ? ctx.audio.voice(voiceId(as, mood, text)) : null).catch(() => {});
    await Promise.race([p.then(() => ctx.sleep(1200)), ctx.sleep(6000)]);
    // Restore a choice prompt after a nudge; otherwise the aside stays until the next line.
    if (panel.classList.contains('is-prompt') && textEl.firstChild === words[0]?.parentNode) { textEl.replaceChildren(...prev); textEl.className = prevCls; }
  }

  // ---------- choose ----------
  async function choose({ prompt, options = [] } = {}) {
    busy = true;
    const opts = options.filter(Boolean);
    panel.classList.add('is-prompt');
    panel.dataset.mood = 'warm';
    setSpeaker('gm', 'warm');
    actorSlot.classList.remove('is-on');
    show();
    more.classList.remove('is-on');
    setText(prompt || STR.what, { prompt: true }).forEach((w) => w.classList.add('on'));

    choicesEl.className = `lf-choices n-${opts.length}`;
    choicesEl.replaceChildren();
    let picked = null;
    let resolvePick;
    const pickedP = new Promise((r) => { resolvePick = r; });
    const cards = opts.map((o, i) => {
      const hero = o.hero ? ctx.state.hero(o.hero) : null;
      const side = h('div.lf-choice-side',
        o.stat ? ui.statChip(o.stat) : null,
        hero && o.talent ? h('span.lf-talent-tag', ui.icon('talent'), o.talentName || STR.talent) : null);
      const card = h('button.lf-choice', {
        type: 'button', class: hero ? 'is-talent' : null, dataset: { id: o.id, idx: i + 1 },
        'aria-disabled': o.disabled ? 'true' : null, title: o.disabled && o.why ? o.why : null,
      },
      hero ? ui.portrait(hero.id, 'sm') : h('span.lf-choice-num', String(i + 1)),
      h('div.lf-choice-body', h('div.lf-choice-label', o.label), (o.hint || (o.disabled && o.why)) ? h('div.lf-choice-hint', o.disabled && o.why ? o.why : o.hint) : null),
      (o.stat || hero) ? side : null);
      tap(card, () => { if (!o.disabled) pick(o.id); }, ctx);
      return card;
    });
    choicesEl.append(...cards);
    cards.forEach((c, i) => setTimeout(() => c.classList.add('is-in'), 60 + i * 70 / (window.__LF_SPEED || 1)));
    ctx.audio.sfx('ui.open', { volume: 0.5 });

    function pick(id) {
      if (picked) return;
      picked = id;
      ctx.audio.sfx('ui.confirm');
      cards.forEach((c) => c.classList.add(c.dataset.id === String(id) ? 'is-picked' : 'is-dismissed'));
      resolvePick(id);
    }
    const onKey = (e) => {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= opts.length && !ctx.stage.layers.overlay.childElementCount) { const o = opts[n - 1]; if (!o.disabled) pick(o.id); }
    };
    window.addEventListener('keydown', onKey);
    ctx.bus.emit('gm:choice:open', { prompt, options: opts });

    if (ctx.auto) {
      ctx.sleep(600).then(() => { if (!picked) pick(ctx.auto.choose(opts.filter((o) => !o.disabled), { prompt })); });
    }

    const id = await pickedP;
    window.removeEventListener('keydown', onKey);
    ctx.bus.emit('gm:choice:close', { id });
    await ctx.sleep(360);
    choicesEl.replaceChildren();
    panel.classList.remove('is-prompt');
    currentSpeaker = null;
    busy = false;
    return id;
  }

  // ---------- pools ----------
  function line(poolKey) {
    const pool = ctx.content?.gmLines?.[poolKey];
    if (!pool || !pool.length) return null;
    let i = ctx.rng.int(0, pool.length - 1);
    if (pool.length > 1 && i === lastPick.get(poolKey)) i = (i + 1) % pool.length;
    lastPick.set(poolKey, i);
    const l = pool[i];
    return typeof l === 'string' ? l : l?.say || l?.text || null;
  }
  async function react(poolKey, { mood = 'warm' } = {}) {
    const text = line(poolKey);
    if (!text) return;
    await say(text, { as: 'gm', mood, quick: true });
  }

  // ---------- table moment ----------
  async function table({ text, done = STR.done, star } = {}) {
    await say(text, { as: 'gm', mood: 'excited' });
    const id = await choose({ prompt: STR.table, options: [
      { id: 'done', label: done, hint: star ? STR.earns(star) : null },
      { id: 'skip', label: STR.skip },
    ] });
    return id === 'done';
  }

  function setActor(id) { const prev = actorId; actorId = id || null; renderActor(); if (prev !== actorId) ctx.bus.emit('gm:actor', { id: actorId }); }

  // A prompt in the panel with no cards (hubs use it; their markers are the options).
  function showPrompt(text) {
    panel.classList.add('is-prompt');
    panel.dataset.mood = 'warm';
    setSpeaker('gm', 'warm');
    actorSlot.classList.remove('is-on');
    show();
    more.classList.remove('is-on');
    setText(text, { prompt: true }).forEach((w) => w.classList.add('on'));
  }
  function clearPrompt() { panel.classList.remove('is-prompt'); currentSpeaker = null; }

  return {
    say, choose, react, line, table, aside, setActor, hide, show, showPrompt, clearPrompt,
    // advance(): what a tap on the box does (complete the line, then move on); true when a line was waiting
    advance: () => { if (!advanceFn) return false; advanceFn(); return true; },
    get actor() { return actorId; },
    isBusy: () => busy,
    director: null,
  };
}
