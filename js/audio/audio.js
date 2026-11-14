// Lanternfall audio service (SPEC 7). Web Audio only.
//
// Graph:  sfx ─┬───────────────┐
//              └─ reverb send ─┤
//  chime ──┬───────────────────┤
//          └─ reverb send ─────┤
//  music ── duck ──────────────┼─ master ─ compressor ─ destination
//  ambience ── duck ───────────┤
//  voice ──────────────────────┘
//
// Every one-shot is scheduled on the audio clock (no timers), so the same code renders in an
// OfflineAudioContext (see renderSfx, used by dev/audio.html for checks).

const MUSIC_IDS = ['title', 'village', 'forest', 'glade', 'marsh', 'market', 'road', 'dungeon', 'crystal',
  'battle', 'boss', 'lair', 'lullaby', 'camp', 'victory', 'ending',
  // Grimspire (GRIMSPIRE 5.9)
  'gs_title', 'gs_camp', 'gs_explore_a', 'gs_explore_b', 'gs_explore_c', 'gs_battle', 'gs_boss', 'gs_final', 'gs_victory', 'gs_ending'];
const ONE_SHOT_MUSIC = new Set(['victory']);
const CHIME_HZ = [523.25, 587.33, 659.25, 783.99, 880.0];   // C5 D5 E5 G5 A5

const base = (() => {
  try { return new URL('../../', import.meta.url).href; } catch { return './'; }
})();
const silentMode = () => (typeof window !== 'undefined' && Number(window.__LF_SPEED) > 1);
const rnd = (a, b) => a + Math.random() * (b - a);
const vary = (amt = 0.04) => 1 + rnd(-amt, amt);

// ---------------------------------------------------------------------------------------------
// Synth kit: built per AudioContext (live or offline)
// ---------------------------------------------------------------------------------------------

function makeKit(ac) {
  const sr = ac.sampleRate;
  const noise = (() => {
    const len = sr * 2, b = ac.createBuffer(1, len, sr), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  })();
  const brown = (() => {
    const len = sr * 4, b = ac.createBuffer(1, len, sr), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    return b;
  })();

  const gain = (dest, v = 1) => { const g = ac.createGain(); g.gain.value = v; if (dest) g.connect(dest); return g; };
  const filt = (dest, type, f, Q = 0.7) => { const n = ac.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = Q; n.connect(dest); return n; };

  // Gain with a quick attack and an exponential tail.
  function envGain(dest, t, a, peak, d) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    g.connect(dest);
    return g;
  }
  function osc(dest, type, f, t, dur, f2, glide) {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + (glide || dur));
    o.connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  function noiseSrc(dest, t, dur, buf = noise) {
    const s = ac.createBufferSource();
    s.buffer = buf; s.loop = true;
    s.connect(dest);
    s.start(t, Math.random() * (buf.duration - 0.5)); s.stop(t + dur + 0.05);
    return s;
  }

  // Primitive sounds
  const tone = (dest, t, f, { type = 'sine', a = 0.004, d = 0.3, vol = 0.5, f2, glide } = {}) =>
    osc(envGain(dest, t, a, vol, d), type, f, t, a + d, f2, glide);

  function click(dest, t, f, vol = 0.4, d = 0.012, Q = 2) {
    noiseSrc(filt(envGain(dest, t, 0.0008, vol, d), 'bandpass', f, Q), t, d + 0.01);
  }
  function thump(dest, t, f1, f2, d, vol) { tone(dest, t, f1, { d, vol, f2, glide: d * 0.8, a: 0.002 }); }

  function bell(dest, t, f, vol = 0.3, decay = 1.6, partials = [[1, 1, 1], [2.0, 0.45, 0.6], [3.0, 0.2, 0.4], [4.16, 0.14, 0.25], [5.43, 0.08, 0.16]]) {
    for (const [r, amp, dm] of partials) tone(dest, t, f * r, { a: 0.002, d: decay * dm, vol: vol * amp });
  }
  function mallet(dest, t, f, vol = 0.3) {        // marimba-like: woody, soft
    tone(dest, t, f, { a: 0.002, d: 0.45, vol });
    tone(dest, t, f * 4, { a: 0.001, d: 0.06, vol: vol * 0.25 });
    tone(dest, t, f * 9.9, { a: 0.0005, d: 0.015, vol: vol * 0.08 });
  }
  function whoosh(dest, t, dur, vol, f1, f2, Q = 1.2) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(dest);
    const bp = filt(g, 'bandpass', f1, Q);
    bp.frequency.setValueAtTime(f1, t);
    bp.frequency.exponentialRampToValueAtTime(f2, t + dur);
    noiseSrc(bp, t, dur);
  }
  function brass(dest, t, f, dur, vol = 0.25) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.05);
    g.gain.setValueAtTime(vol * 0.85, t + Math.max(0.06, dur - 0.12));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
    g.connect(dest);
    const lp = filt(g, 'lowpass', f * 1.5, 1.5);
    lp.frequency.setValueAtTime(f * 1.2, t);
    lp.frequency.linearRampToValueAtTime(f * 5, t + 0.08);
    lp.frequency.exponentialRampToValueAtTime(f * 2.5, t + dur);
    for (const det of [-6, 5]) { const o = osc(lp, 'sawtooth', f, t, dur + 0.25); o.detune.value = det; }
  }
  const ksCache = new Map();
  function pluck(dest, t, f, vol = 0.3, dur = 1.2) {   // Karplus-Strong string
    const key = `${Math.round(f)}|${dur}`;
    let b = ksCache.get(key);
    if (!b) {
      const N = Math.max(2, Math.round(sr / f)), len = Math.floor(sr * dur);
      b = ac.createBuffer(1, len, sr);
      const d = b.getChannelData(0), ring = new Float32Array(N);
      let prev = 0;
      for (let i = 0; i < N; i++) { prev = prev * 0.5 + (Math.random() * 2 - 1) * 0.5; ring[i] = prev; }
      for (let i = 0, idx = 0; i < len; i++) {
        const a = ring[idx], n = ring[(idx + 1) % N];
        d[i] = a; ring[idx] = (a + n) * 0.5 * 0.995; idx = (idx + 1) % N;
      }
      ksCache.set(key, b);
    }
    const s = ac.createBufferSource(); s.buffer = b;
    s.connect(envGain(dest, t, 0.002, vol, dur));
    s.start(t);
  }
  // A die (or anything hard and small) striking a wooden table.
  function clack(dest, t, vol = 0.6) {
    const k = vary(0.12);
    click(dest, t, rnd(2800, 4600), vol * 0.9, 0.01, 1.4);                     // corner tick
    for (const [f, a, d] of [[190, 0.7, 0.07], [330, 0.5, 0.05], [560, 0.35, 0.035], [910, 0.2, 0.02]]) {
      tone(dest, t, f * k, { a: 0.0008, d: d * vary(0.2), vol: vol * a * 0.7 });  // table body
    }
    thump(dest, t, 140 * k, 60, 0.05, vol * 0.5);
    noiseSrc(filt(envGain(dest, t, 0.0005, vol * 0.35, 0.02), 'lowpass', 2500), t, 0.03);
  }
  function buffer(dur, fill) {
    const len = Math.floor(sr * dur), b = ac.createBuffer(1, len, sr);
    fill(b.getChannelData(0), sr);
    const s = ac.createBufferSource(); s.buffer = b;
    return s;
  }

  return { ac, sr, noise, brown, gain, filt, envGain, osc, noiseSrc, tone, click, thump, bell, mallet, whoosh, brass, pluck, clack, buffer };
}

function makeImpulse(ac, seconds = 2.6) {
  const sr = ac.sampleRate, len = Math.floor(sr * seconds), b = ac.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      lp = lp * 0.6 + (Math.random() * 2 - 1) * 0.4;                // warm: soften the highs
      d[i] = i < sr * 0.012 ? 0 : lp * Math.pow(1 - t, 3.2) * (1 - Math.exp(-i / (sr * 0.02)));
    }
  }
  return b;
}

// ---------------------------------------------------------------------------------------------
// SFX. Each is (kit, out, t) where out is a per-play gain (volume, pan, reverb send applied).
// [function, base volume, reverb send]
// ---------------------------------------------------------------------------------------------

const C = { C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, B5: 987.77, C6: 1046.5, E6: 1318.5, G6: 1568.0, C7: 2093.0 };

const SFX = {
  // ---- UI: soft and woody
  'ui.tap': [(k, o, t) => { const f = 620 * vary(0.06); k.tone(o, t, f, { d: 0.07, vol: 0.5, f2: f * 0.8, glide: 0.05 }); k.click(o, t, 2400, 0.12, 0.008); }, 0.35, 0.05],
  'ui.hover': [(k, o, t) => k.tone(o, t, 1300 * vary(0.05), { d: 0.04, vol: 0.25 }), 0.15, 0.05],
  'ui.open': [(k, o, t) => { k.whoosh(o, t, 0.28, 0.25, 500, 2200); k.mallet(o, t + 0.05, C.G5, 0.25); k.mallet(o, t + 0.12, C.C6, 0.22); }, 0.45, 0.2],
  'ui.close': [(k, o, t) => { k.whoosh(o, t, 0.25, 0.22, 2000, 450); k.mallet(o, t + 0.04, C.C6, 0.2); k.mallet(o, t + 0.11, C.G5, 0.2); }, 0.4, 0.2],
  'ui.page': [(k, o, t) => {
    const g = k.gain(o, 1);
    const bp = k.filt(g, 'bandpass', 3000, 0.8);
    for (let i = 0; i < 6; i++) k.noiseSrc(k.filt(k.envGain(bp, t + i * 0.035 + rnd(0, 0.02), 0.01, rnd(0.15, 0.4), 0.05), 'highpass', 1200), t, 0.3);
    k.whoosh(o, t, 0.3, 0.2, 1500, 5000, 0.7);
  }, 0.5, 0.1],
  'ui.confirm': [(k, o, t) => { k.mallet(o, t, C.G5, 0.35); k.mallet(o, t + 0.08, C.C6, 0.35); k.bell(o, t + 0.08, C.C7, 0.03, 0.6); }, 0.5, 0.25],
  'ui.deny': [(k, o, t) => { k.mallet(o, t, 300, 0.35); k.mallet(o, t + 0.11, 262, 0.3); }, 0.45, 0.1],

  // ---- Dice: the most important sounds in the game
  'dice.shake': [(k, o, t) => {
    // Dice rattling in a cupped hand: three shakes of many tiny resin clicks, muffled by fingers.
    const dur = 0.85;
    const src = k.buffer(dur, (d, sr) => {
      const strokes = [0.04, rnd(0.3, 0.34), rnd(0.56, 0.62)];
      for (const [si, c] of strokes.entries()) {
        const n = 16 + Math.floor(Math.random() * 10);
        for (let j = 0; j < n; j++) {
          const at = c + (Math.random() + Math.random() + Math.random() - 1.5) * 0.06;
          if (at < 0 || at > dur - 0.02) continue;
          const dieClack = Math.random() < 0.18;
          const f = dieClack ? rnd(1300, 2100) : rnd(2400, 6800);
          const amp = (dieClack ? 0.9 : rnd(0.15, 0.7)) * (si === 2 ? 1 : 0.85);
          const dec = dieClack ? rnd(0.004, 0.007) : rnd(0.0012, 0.0035);
          const start = Math.floor(at * sr), stop = Math.min(d.length, start + Math.floor(dec * 7 * sr));
          const ph = Math.random() * 6.28;
          for (let i = start; i < stop; i++) {
            const tt = (i - start) / sr;
            d[i] += amp * Math.sin(ph + 6.2832 * f * tt) * Math.exp(-tt / dec) + amp * 0.25 * (Math.random() * 2 - 1) * Math.exp(-tt / (dec * 0.4));
          }
        }
        // the soft swish of the hand moving
        const s0 = Math.floor((c - 0.07) * sr), s1 = Math.floor((c + 0.09) * sr);
        for (let i = Math.max(0, s0); i < Math.min(d.length, s1); i++) d[i] += (Math.random() * 2 - 1) * 0.05 * Math.sin(Math.PI * (i - s0) / (s1 - s0));
      }
    });
    const pk = k.ac.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 900; pk.gain.value = 5; pk.Q.value = 1.2; pk.connect(o);
    const lp = k.filt(pk, 'lowpass', 5200 * vary(0.1), 0.8);
    src.connect(k.filt(lp, 'highpass', 280));
    src.start(t);
  }, 0.75, 0.08],
  'dice.throw': [(k, o, t) => {
    // Dice knock together and slip off the fingers, then fly.
    for (const [d, v] of [[0, 0.7], [rnd(0.02, 0.03), 0.5], [rnd(0.05, 0.06), 0.35]]) { k.click(o, t + d, rnd(2200, 4200), v, 0.008, 1.5); k.click(o, t + d + 0.004, rnd(1200, 1800), v * 0.6, 0.006, 2); }
    k.noiseSrc(k.filt(k.envGain(o, t, 0.01, 0.12, 0.07), 'bandpass', 3000, 0.8), t, 0.1);   // skin release
    k.whoosh(o, t + 0.04, 0.4, 0.32, 500, 2800, 1.4);
  }, 0.55, 0.1],
  'dice.land': [(k, o, t) => {
    // A few hard clacks on wood, each bounce lower and quicker, then a little roll.
    const n = 3 + Math.floor(Math.random() * 3);
    let at = t, gap = rnd(0.1, 0.14), vol = 0.95;
    for (let i = 0; i < n; i++) { k.clack(o, at, vol); at += gap; gap *= rnd(0.6, 0.75); vol *= rnd(0.5, 0.65); }
    for (let i = 0; i < 6; i++) k.click(o, at + i * rnd(0.018, 0.03), rnd(2500, 4200), 0.08 * (1 - i / 6), 0.006);
  }, 0.85, 0.12],
  'dice.settle': [(k, o, t) => {
    // The die rocks on an edge and drops flat: accelerating ticks and a soft final tok.
    let at = t, gap = rnd(0.07, 0.085), v = 0.3;
    for (let i = 0; i < 8; i++) { k.click(o, at, rnd(2600, 3800), v, 0.007, 1.5); at += gap; gap *= 0.78; v *= 0.8; }
    k.clack(o, at + 0.012, 0.3);
  }, 0.6, 0.1],

  // ---- Check stingers
  'check.success': [(k, o, t) => {
    [C.C5, C.E5, C.G5, C.C6].forEach((f, i) => k.bell(o, t + i * 0.07, f, 0.22, 1.4));
    k.tone(o, t, C.C4, { a: 0.05, d: 1.2, vol: 0.15, type: 'triangle' });
  }, 0.6, 0.35],
  'check.fail': [(k, o, t) => {
    k.tone(o, t, C.E4, { type: 'triangle', a: 0.01, d: 0.35, vol: 0.35 });
    k.tone(o, t + 0.22, C.C4, { type: 'triangle', a: 0.01, d: 0.7, vol: 0.35, f2: C.C4 * 0.97, glide: 0.6 });
    k.mallet(o, t + 0.22, C.C4 / 2, 0.25);
  }, 0.5, 0.2],
  'check.crit': [(k, o, t) => {
    [C.C5, C.E5, C.G5, C.C6, C.E6, C.G6].forEach((f, i) => k.bell(o, t + i * 0.055, f, 0.2, 1.8));
    for (const f of [C.C4, C.E4, C.G4]) k.brass(o, t + 0.3, f, 1.0, 0.12);
    k.thump(o, t, 110, 45, 0.5, 0.6);
    const hp = k.filt(k.envGain(o, t + 0.3, 0.3, 0.12, 1.6), 'highpass', 6000);
    k.noiseSrc(hp, t + 0.3, 2);
  }, 0.7, 0.45],
  'check.fumble': [(k, o, t) => {
    // Comic slide whistle down and a boing.
    const g = k.envGain(o, t, 0.02, 0.3, 0.9);
    const v = k.osc(g, 'sine', 1100, t, 0.9, 260, 0.8);
    const lfo = k.ac.createOscillator(); lfo.frequency.value = 7; const lg = k.gain(v.frequency, 18); lfo.connect(lg); lfo.start(t); lfo.stop(t + 1);
    k.tone(o, t + 0.85, 180, { d: 0.4, vol: 0.4, f2: 420, glide: 0.12, type: 'triangle' });
    k.tone(o, t + 0.97, 420, { d: 0.3, vol: 0.2, f2: 200, glide: 0.25, type: 'triangle' });
  }, 0.5, 0.2],

  // ---- Rewards
  'star.gain': [(k, o, t) => {
    [C.E6, C.G6, C.C7, 2637].forEach((f, i) => k.bell(o, t + i * 0.06, f, 0.12, 1.2));
    for (let i = 0; i < 8; i++) k.tone(o, t + 0.1 + i * 0.04, rnd(3000, 6000), { d: 0.12, vol: 0.04 });
    k.tone(o, t, C.C5, { a: 0.1, d: 1.2, vol: 0.1 });
  }, 0.6, 0.45],
  'star.spend': [(k, o, t) => {
    k.whoosh(o, t, 0.5, 0.2, 800, 6000, 2);
    [2637, C.C7, C.G6].forEach((f, i) => k.bell(o, t + 0.4 + i * 0.05, f, 0.12, 1.0));
  }, 0.55, 0.4],
  'coin': [(k, o, t) => {
    const f = 2200 * vary(0.05);
    k.bell(o, t, f, 0.2, 0.5, [[1, 1, 1], [2.76, 0.5, 0.5], [5.4, 0.3, 0.3]]);
    k.bell(o, t + 0.08, f * 1.33, 0.2, 0.7, [[1, 1, 1], [2.76, 0.5, 0.5], [5.4, 0.3, 0.3]]);
  }, 0.4, 0.2],
  'item.get': [(k, o, t) => {
    [C.C5, C.E5, C.G5].forEach((f, i) => k.mallet(o, t + i * 0.08, f, 0.3));
    k.bell(o, t + 0.24, C.C6, 0.15, 1.2);
    for (let i = 0; i < 5; i++) k.tone(o, t + 0.25 + i * 0.05, rnd(3500, 6500), { d: 0.1, vol: 0.04 });
  }, 0.55, 0.35],
  'heal': [(k, o, t) => {
    for (const f of [C.C4, C.E4, C.G4, C.C5]) k.tone(o, t, f, { a: 0.4, d: 1.2, vol: 0.1, type: 'triangle' });
    [C.G5, C.C6, C.E6].forEach((f, i) => k.bell(o, t + 0.3 + i * 0.12, f, 0.1, 1.4));
    k.whoosh(o, t, 1.0, 0.08, 1000, 5000, 1);
  }, 0.6, 0.5],
  'levelup': [(k, o, t) => {
    [C.C5, C.E5, C.G5, C.C6, C.E6].forEach((f, i) => k.bell(o, t + i * 0.09, f, 0.18, 1.6));
    for (const [f, d] of [[C.C4, 0], [C.E4, 0], [C.G4, 0]]) k.brass(o, t + 0.45 + d, f, 0.9, 0.11);
    k.thump(o, t + 0.45, 100, 45, 0.6, 0.4);
  }, 0.65, 0.4],
  'quest': [(k, o, t) => {
    k.brass(o, t, C.G4, 0.22, 0.18); k.brass(o, t + 0.24, C.C5, 0.6, 0.2);
    k.bell(o, t + 0.24, C.C6, 0.1, 1.4);
  }, 0.55, 0.35],
  'chapter': [(k, o, t) => {
    k.bell(o, t, 98, 0.45, 4, [[1, 1, 1], [2.0, 0.5, 0.7], [2.76, 0.35, 0.5], [4.07, 0.2, 0.35], [5.4, 0.15, 0.2]]);
    k.bell(o, t + 0.2, C.G5, 0.12, 2.5);
    k.whoosh(o, t, 1.4, 0.07, 300, 1200, 0.8);
  }, 0.65, 0.55],

  // ---- Combat
  'hit.light': [(k, o, t) => {
    k.thump(o, t, 160 * vary(), 70, 0.12, 0.7);
    k.noiseSrc(k.filt(k.envGain(o, t, 0.001, 0.5, 0.06), 'lowpass', 1800), t, 0.08);
  }, 0.6, 0.08],
  'hit.heavy': [(k, o, t) => {
    k.noiseSrc(k.filt(k.envGain(o, t, 0.0005, 0.6, 0.025), 'highpass', 2500), t, 0.04);   // slap
    k.thump(o, t, 110 * vary(), 38, 0.3, 0.9);
    k.tone(o, t + 0.02, 240, { type: 'triangle', d: 0.25, vol: 0.12, f2: 180, glide: 0.2 });
    k.noiseSrc(k.filt(k.envGain(o, t, 0.001, 0.7, 0.14), 'lowpass', 1200), t, 0.18);
    k.click(o, t, 900, 0.35, 0.03, 1);
  }, 0.75, 0.12],
  'hit.magic': [(k, o, t) => {
    k.tone(o, t, 1800, { d: 0.25, vol: 0.25, f2: 300, glide: 0.2, type: 'triangle' });
    k.noiseSrc(k.filt(k.envGain(o, t, 0.002, 0.25, 0.25), 'highpass', 4000), t, 0.3);
    k.bell(o, t + 0.03, C.E6, 0.08, 0.6); k.thump(o, t, 130, 60, 0.15, 0.45);
  }, 0.6, 0.3],
  'miss': [(k, o, t) => k.whoosh(o, t, 0.28 * vary(), 0.4, 700, 2400, 1.6), 0.45, 0.08],
  'block': [(k, o, t) => {
    k.bell(o, t, 520 * vary(), 0.35, 0.45, [[1, 1, 1], [2.32, 0.6, 0.6], [3.9, 0.35, 0.4], [5.1, 0.2, 0.25]]);
    k.click(o, t, 3000, 0.5, 0.02, 1); k.thump(o, t, 150, 80, 0.08, 0.4);
  }, 0.55, 0.2],
  'hero.hurt': [(k, o, t) => { k.thump(o, t, 220 * vary(), 110, 0.18, 0.6); k.noiseSrc(k.filt(k.envGain(o, t, 0.002, 0.25, 0.08), 'lowpass', 1500), t, 0.1); }, 0.55, 0.1],
  'hero.down': [(k, o, t) => {
    [C.G4, C.E4, C.C4].forEach((f, i) => k.tone(o, t + i * 0.18, f, { type: 'triangle', d: 0.5, vol: 0.25 }));
    k.thump(o, t + 0.55, 90, 40, 0.35, 0.6);
  }, 0.55, 0.3],
  'enemy.hurt': [(k, o, t) => { k.tone(o, t, 700 * vary(0.1), { d: 0.15, vol: 0.4, f2: 220, glide: 0.12, type: 'triangle' }); k.noiseSrc(k.filt(k.envGain(o, t, 0.001, 0.3, 0.05), 'bandpass', 1500), t, 0.06); }, 0.5, 0.1],
  'enemy.flee': [(k, o, t) => {
    k.tone(o, t, 400, { d: 0.4, vol: 0.25, f2: 1600, glide: 0.35, type: 'triangle' });
    for (let i = 0; i < 8; i++) k.click(o, t + 0.1 + i * 0.055, rnd(700, 1100), 0.25 * (1 - i / 9), 0.02, 2);
  }, 0.5, 0.15],
  'befriend': [(k, o, t) => {
    k.bell(o, t, C.E5, 0.2, 1.6); k.bell(o, t + 0.14, C.G5, 0.2, 1.6); k.bell(o, t + 0.28, C.C6, 0.2, 2);
    for (const f of [C.C4, C.E4, C.G4]) k.tone(o, t, f, { a: 0.3, d: 1.4, vol: 0.08, type: 'triangle' });
  }, 0.6, 0.45],

  // ---- Powers
  'spell.cast': [(k, o, t) => {
    k.whoosh(o, t, 0.6, 0.25, 400, 5000, 3);
    for (let i = 0; i < 6; i++) k.tone(o, t + i * 0.06, 500 * Math.pow(1.25, i), { d: 0.2, vol: 0.08, type: 'triangle' });
  }, 0.55, 0.4],
  'spell.star': [(k, o, t) => {
    k.tone(o, t, 3000, { d: 0.3, vol: 0.2, f2: 600, glide: 0.25, type: 'triangle' });
    [C.C6, C.G6, C.E6].forEach((f, i) => k.bell(o, t + 0.05 + i * 0.04, f, 0.12, 0.9));
    for (let i = 0; i < 10; i++) k.tone(o, t + i * 0.03, rnd(3000, 7000), { d: 0.08, vol: 0.04 });
  }, 0.55, 0.4],
  'spell.vine': [(k, o, t) => {
    const g = k.envGain(o, t, 0.1, 0.35, 0.8);
    const bp = k.filt(g, 'bandpass', 900, 2);
    const s = k.osc(bp, 'sawtooth', 90, t, 0.9, 140, 0.8);
    const lfo = k.ac.createOscillator(); lfo.frequency.value = 23; const lg = k.gain(s.frequency, 25); lfo.connect(lg); lfo.start(t); lfo.stop(t + 1);
    for (let i = 0; i < 10; i++) k.click(o, t + rnd(0, 0.8), rnd(1500, 3500), 0.12, 0.03, 1.5);
  }, 0.5, 0.2],
  'spell.sleep': [(k, o, t) => {
    [C.A5, C.G5, C.E5, C.D5, C.C5].forEach((f, i) => k.bell(o, t + i * 0.16, f, 0.12, 1.6, [[1, 1, 1], [2, 0.3, 0.5], [3, 0.1, 0.3]]));
    k.whoosh(o, t, 1.2, 0.06, 2000, 600, 0.8);
  }, 0.55, 0.55],
  'spell.song': [(k, o, t) => {
    [C.G4, C.C5, C.E5, C.G5, C.E5].forEach((f, i) => k.pluck(o, t + i * 0.13, f, 0.4, 1.0));
    k.pluck(o, t, C.C4, 0.3, 1.4);
  }, 0.6, 0.35],
  'bow': [(k, o, t) => { k.pluck(o, t, 110 * vary(), 0.5, 0.5); k.click(o, t, 1200, 0.3, 0.02); k.whoosh(o, t + 0.02, 0.3, 0.35, 1200, 3500, 2); }, 0.55, 0.1],
  'fox': [(k, o, t) => {
    for (const d of [0, 0.16]) { k.tone(o, t + d, 750 * vary(), { d: 0.12, vol: 0.35, f2: 1400, glide: 0.04, type: 'triangle' }); k.tone(o, t + d + 0.05, 1400, { d: 0.08, vol: 0.2, f2: 900, glide: 0.06, type: 'triangle' }); }
  }, 0.45, 0.15],
  'smoke': [(k, o, t) => {
    const g = k.ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9); g.connect(o);
    const lp = k.filt(g, 'lowpass', 2500, 0.5); lp.frequency.setValueAtTime(2500, t); lp.frequency.exponentialRampToValueAtTime(400, t + 0.8);
    k.noiseSrc(lp, t, 0.9); k.thump(o, t, 120, 60, 0.1, 0.4);
  }, 0.5, 0.25],
  'charge': [(k, o, t) => {
    const g = k.ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75); g.connect(o);
    k.noiseSrc(k.filt(g, 'lowpass', 300), t, 0.8, k.brown);
    k.whoosh(o, t + 0.2, 0.5, 0.4, 400, 2500, 1.2);
    k.thump(o, t + 0.68, 100, 35, 0.4, 0.9); k.click(o, t + 0.68, 900, 0.4, 0.04, 1);
  }, 0.7, 0.2],

  // ---- World
  'roar': [(k, o, t) => {
    const dur = 1.9;
    const g = k.ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.35); g.gain.setValueAtTime(0.45, t + 1.1); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); g.connect(o);
    const lp = k.filt(g, 'lowpass', 300, 2); lp.frequency.setValueAtTime(250, t); lp.frequency.linearRampToValueAtTime(1100, t + 0.5); lp.frequency.exponentialRampToValueAtTime(300, t + dur);
    for (const [f, det] of [[72, 0], [73.5, 7], [108, -5]]) {
      const s = k.osc(lp, 'sawtooth', f, t, dur, f * 0.8, dur); s.detune.value = det;
      const lfo = k.ac.createOscillator(); lfo.frequency.value = 9 + Math.random() * 4; const lg = k.gain(s.frequency, 4); lfo.connect(lg); lfo.start(t); lfo.stop(t + dur);
    }
    k.noiseSrc(k.filt(k.envGain(o, t, 0.3, 0.2, 1.4), 'bandpass', 600, 0.8), t, dur);
  }, 0.75, 0.5],
  'wing': [(k, o, t) => { for (const d of [0, 0.32]) k.noiseSrc(k.filt(k.envGain(o, t + d, 0.06, 0.6, 0.22), 'lowpass', 500, 1), t + d, 0.3, k.brown); }, 0.65, 0.3],
  'rumble': [(k, o, t) => {
    const g = k.ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.8, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4); g.connect(o);
    k.noiseSrc(k.filt(g, 'lowpass', 140, 1), t, 2.5, k.brown);
    k.tone(o, t, 42, { a: 0.5, d: 1.8, vol: 0.35 });
  }, 0.8, 0.3],
  'thunder': [(k, o, t) => {
    k.noiseSrc(k.filt(k.envGain(o, t, 0.002, 0.6, 0.25), 'highpass', 800), t, 0.3);
    const g = k.ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.8, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2); g.connect(o);
    k.noiseSrc(k.filt(g, 'lowpass', 220, 0.8), t, 3.3, k.brown);
  }, 0.7, 0.5],
  'door.stone': [(k, o, t) => {
    const dur = 2.2;
    const g = k.ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.6, t + 0.2); g.gain.setValueAtTime(0.6, t + dur - 0.3); g.gain.linearRampToValueAtTime(0, t + dur); g.connect(o);
    const am = k.ac.createGain(); am.connect(k.filt(g, 'bandpass', 260, 1.2));
    for (let i = 0; i < 40; i++) am.gain.setValueAtTime(rnd(0.3, 1), t + i * dur / 40);
    k.noiseSrc(am, t, dur, k.brown);
    k.noiseSrc(k.filt(k.envGain(o, t, 0.3, 0.1, dur - 0.3), 'bandpass', 1800, 2), t, dur);
    k.thump(o, t + dur, 80, 35, 0.5, 0.9); k.click(o, t + dur, 600, 0.3, 0.06, 0.8);
  }, 0.7, 0.4],
  'rune.click': [(k, o, t) => { k.click(o, t, 1500 * vary(), 0.5, 0.025, 1.5); k.thump(o, t, 200, 90, 0.08, 0.4); }, 0.5, 0.3],
  'rune.right': [(k, o, t) => { for (const f of [C.C5, C.G5, C.E6]) k.bell(o, t, f, 0.14, 2); k.tone(o, t, C.C4, { a: 0.2, d: 1.5, vol: 0.12 }); }, 0.55, 0.55],
  'rune.wrong': [(k, o, t) => {
    k.thump(o, t, 120, 50, 0.3, 0.6); k.tone(o, t, 98, { type: 'sawtooth', d: 0.35, vol: 0.1 });
    k.noiseSrc(k.filt(k.envGain(o, t + 0.05, 0.05, 0.25, 0.5), 'lowpass', 1500), t, 0.6);
  }, 0.5, 0.3],
  'chime.right': [(k, o, t) => { k.bell(o, t, C.C6, 0.18, 1.4); k.bell(o, t + 0.07, C.G6, 0.12, 1.4); k.bell(o, t + 0.14, C.C7, 0.08, 1.4); }, 0.5, 0.5],
  'chime.wrong': [(k, o, t) => { k.bell(o, t, 466, 0.15, 0.9, [[1, 1, 1], [2.1, 0.4, 0.5]]); k.bell(o, t + 0.02, 494, 0.13, 0.9, [[1, 1, 1], [2.1, 0.4, 0.5]]); }, 0.4, 0.4],
  'splash': [(k, o, t) => {
    k.noiseSrc(k.filt(k.envGain(o, t, 0.005, 0.7, 0.6), 'lowpass', 2500, 0.7), t, 0.7);
    for (let i = 0; i < 10; i++) k.tone(o, t + rnd(0.05, 0.7), rnd(500, 1400), { d: 0.06, vol: 0.12, f2: rnd(1500, 2500), glide: 0.05 });
  }, 0.6, 0.3],
  'boat': [(k, o, t) => {
    const g = k.envGain(o, t, 0.15, 0.3, 0.6); const bp = k.filt(g, 'bandpass', 700, 6);
    k.osc(bp, 'sawtooth', 70, t, 0.75, 90, 0.7);
    for (const d of [0.1, 0.6]) k.noiseSrc(k.filt(k.envGain(o, t + d, 0.2, 0.25, 0.5), 'lowpass', 600), t + d, 0.8);
  }, 0.55, 0.3],
  'whoosh': [(k, o, t) => k.whoosh(o, t, 0.55 * vary(), 0.5, 300, 2200, 1), 0.55, 0.2],
  'footsteps': [(k, o, t) => {
    for (let i = 0; i < 4; i++) {
      const at = t + i * rnd(0.3, 0.36);
      k.noiseSrc(k.filt(k.envGain(o, at, 0.005, 0.5, 0.09), 'lowpass', 700), at, 0.12, k.brown);
      for (let j = 0; j < 4; j++) k.click(o, at + rnd(0, 0.05), rnd(1500, 4000), 0.08, 0.01);
    }
  }, 0.55, 0.15],

  // ---- Stingers and fanfares
  'sting.danger': [(k, o, t) => {
    for (const f of [73.4, 87.3, 110]) k.brass(o, t, f, 1.4, 0.16);
    k.thump(o, t, 80, 40, 0.8, 0.7);
    k.noiseSrc(k.filt(k.envGain(o, t, 0.6, 0.1, 1), 'lowpass', 400), t, 1.6, k.brown);
  }, 0.7, 0.45],
  'sting.wonder': [(k, o, t) => {
    [C.C5, C.E5, C.G5, C.B5, C.E6].forEach((f, i) => k.bell(o, t + i * 0.1, f, 0.14, 2.2));
    for (const f of [C.C4, C.E4, C.G4, C.B4]) k.tone(o, t, f, { type: 'triangle', a: 0.6, d: 2, vol: 0.07 });
  }, 0.6, 0.6],
  'fanfare.small': [(k, o, t) => {
    [[C.G4, 0, 0.14], [C.C5, 0.16, 0.14], [C.E5, 0.32, 0.6]].forEach(([f, d, l]) => k.brass(o, t + d, f, l, 0.2));
    k.brass(o, t + 0.32, C.C4, 0.6, 0.12); k.bell(o, t + 0.32, C.C6, 0.08, 1.2);
  }, 0.6, 0.35],
  'fanfare.big': [(k, o, t) => {
    const n = [[C.C5, 0, 0.12], [C.C5, 0.13, 0.12], [C.C5, 0.26, 0.12], [C.E5, 0.4, 0.3], [C.D5, 0.72, 0.15], [C.E5, 0.88, 0.15], [C.G5, 1.04, 1.0]];
    for (const [f, d, l] of n) k.brass(o, t + d, f, l, 0.18);
    for (const f of [C.C4, C.E4, C.G4]) k.brass(o, t + 1.04, f, 1.0, 0.1);
    k.thump(o, t + 1.04, 90, 40, 0.6, 0.6);
    for (let i = 0; i < 10; i++) k.tone(o, t + 1.04 + i * 0.05, rnd(3000, 6000), { d: 0.15, vol: 0.04 });
  }, 0.65, 0.4],

  ...gsSfx(),
};

// ---------------------------------------------------------------------------------------------
// Grimspire one-shots (GRIMSPIRE 5.9): steel, bone and war drums; punchier and darker than Lanternfall.
// The grade sounds (perfect / good / weak) and the two blocks are heard hundreds of times: short,
// clearly different in pitch and colour, nothing shrill. The four loot sounds climb in grandeur.
// ---------------------------------------------------------------------------------------------

function gsSfx() {   // a hoisted function, so SFX can spread it before this point in the file
  const ANVIL = [[1, 1, 1], [2.76, 0.55, 0.55], [5.4, 0.3, 0.32], [8.93, 0.14, 0.18]];      // inharmonic steel
  const SHIELD = [[1, 1, 1], [1.59, 0.6, 0.7], [2.14, 0.45, 0.5], [2.92, 0.3, 0.35], [4.1, 0.15, 0.2]];
  const TOWER_BELL = [[0.5, 0.7, 1.4], [1, 1, 1], [1.19, 0.55, 0.8], [1.5, 0.4, 0.6], [2.0, 0.35, 0.45], [2.52, 0.18, 0.3], [3.0, 0.12, 0.2]];
  const burst = (k, o, t, type, f, vol, d, Q = 0.7, a = 0.001, buf) => k.noiseSrc(k.filt(k.envGain(o, t, a, vol, d), type, f, Q), t, a + d + 0.02, buf);
  const swell = (k, o, t, dur, vol, peakAt = 0.8) => {   // a gain that rises then cuts off (reverse-cymbal feel)
    const g = k.ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * peakAt); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); g.connect(o); return g;
  };
  const sparkle = (k, o, t, n, span, vol = 0.035, lo = 3000, hi = 7000) => { for (let i = 0; i < n; i++) k.tone(o, t + rnd(0, span), rnd(lo, hi), { d: rnd(0.06, 0.16), vol }); };
  const pad = (k, o, t, freqs, dur, vol, cutoff = 1800) => {   // a soft wordless "choir" chord: detuned saws through a lowpass
    const g = k.ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.3); g.gain.setValueAtTime(vol, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); g.connect(o);
    const lp = k.filt(g, 'lowpass', cutoff, 0.8);
    for (const f of freqs) for (const det of [-9, 0, 8]) { const s = k.osc(lp, 'sawtooth', f, t, dur); s.detune.value = det + rnd(-3, 3); }
  };
  const crunch = (k, o, t, vol, d, f = 1800) => {   // saturated noise: the grit of a heavy impact
    const ws = k.ac.createWaveShaper(); const cv = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 127.5 - 1; cv[i] = Math.tanh(x * 6); } ws.curve = cv;
    const g = k.envGain(o, t, 0.001, vol, d); const bp = k.filt(g, 'bandpass', f, 0.7); ws.connect(bp);
    k.noiseSrc(k.filt(ws, 'lowpass', 20000), t, d + 0.02, k.brown); // brown noise driven hard into the shaper
  };
  const horn = (k, o, t, f, dur, vol = 0.15) => {   // a bolder brass voice than brass(): more saws, brighter bloom, an octave below
    const g = k.ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.04); g.gain.setValueAtTime(vol * 0.8, t + Math.max(0.05, dur - 0.1)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.3); g.connect(o);
    const lp = k.filt(g, 'lowpass', f * 2, 1.2); lp.frequency.setValueAtTime(f * 1.5, t); lp.frequency.linearRampToValueAtTime(f * 7, t + 0.06); lp.frequency.exponentialRampToValueAtTime(f * 3, t + dur);
    for (const [r, det] of [[1, -9], [1, 0], [1, 8], [0.5, 3]]) { const s = k.osc(lp, 'sawtooth', f * r, t, dur + 0.3); s.detune.value = det; }
  };
  const drum = (k, o, t, vol = 0.9, f = 85) => { k.thump(o, t, f * vary(0.05), f * 0.4, 0.45, vol); burst(k, o, t, 'lowpass', 700, vol * 0.5, 0.12); k.click(o, t, 1100, vol * 0.25, 0.02, 0.8); };

  return {
    // ---- strikes
    'gs.swing': [(k, o, t) => {
      // broadband air, no whistle: a low body sweep and a bright edge, fast attack
      const d = 0.18 * vary(0.1);
      const g = k.ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.7, t + d * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + d); g.connect(o);
      const lp = k.filt(g, 'lowpass', 1200, 0.5); lp.frequency.setValueAtTime(700, t); lp.frequency.exponentialRampToValueAtTime(5000, t + d * 0.4); lp.frequency.exponentialRampToValueAtTime(1500, t + d);
      k.noiseSrc(k.filt(lp, 'highpass', 250, 0.5), t, d);
      const g2 = k.envGain(o, t + d * 0.25, d * 0.15, 0.18, d * 0.5); k.noiseSrc(k.filt(g2, 'highpass', 5000, 0.5), t, d);
    }, 0.6, 0.08],
    'gs.hit': [(k, o, t) => {
      // all noise, no pitched parts (so it never reads as a blip): a bright crack, a meaty low-mid body, a little grit
      burst(k, o, t, 'highpass', 2500, 0.9, 0.012);
      burst(k, o, t, 'bandpass', 1800, 0.5, 0.03, 0.7);
      burst(k, o, t, 'bandpass', 320, 1.3, 0.09, 0.8, 0.001, k.brown);
      burst(k, o, t, 'lowpass', 160, 1.2, 0.12, 0.7, 0.001, k.brown);
      crunch(k, o, t, 0.25, 0.04, 1200);
      k.thump(o, t, 110 * vary(), 60, 0.045, 0.6);
    }, 0.65, 0.08],
    'gs.hit.heavy': [(k, o, t) => {
      burst(k, o, t, 'highpass', 2000, 0.9, 0.02);
      crunch(k, o, t, 0.8, 0.14, 1800);                                 // crunch that cuts through
      k.click(o, t, 3500, 0.5, 0.015, 1);
      burst(k, o, t, 'bandpass', 170, 1.2, 0.22, 0.8, 0.001, k.brown);  // low-mid weight
      k.thump(o, t, 70 * vary(), 28, 0.45, 1.0);                        // deep sub
      burst(k, o, t, 'lowpass', 500, 0.6, 0.3, 0.8, 0.001, k.brown);
    }, 0.8, 0.14],
    'gs.crit': [(k, o, t) => {
      k.whoosh(o, t, 0.08, 0.25, 1500, 6000, 0.8);
      burst(k, o, t + 0.06, 'highpass', 2000, 0.9, 0.02);               // blade transient
      k.click(o, t + 0.06, 4500, 0.6, 0.012, 1);
      for (let i = 0; i < 5; i++) k.click(o, t + 0.065 + i * 0.012, rnd(1500, 3500), 0.45 * (1 - i / 6), 0.012, 1.5);
      k.thump(o, t + 0.06, 110, 26, 0.55, 1.0);
      burst(k, o, t + 0.06, 'lowpass', 900, 0.7, 0.26, 0.8, 0.001, k.brown);
      k.bell(o, t + 0.07, 880, 0.11, 0.9, ANVIL);                       // big steel ring
      k.bell(o, t + 0.13, 1318.5, 0.08, 1.0, ANVIL);
      sparkle(k, o, t + 0.08, 10, 0.35, 0.03);
    }, 0.8, 0.3],

    // ---- grades: up glint, clean tock, dull thud
    'gs.perfect': [(k, o, t) => {
      k.tone(o, t, 1318.5, { d: 0.09, vol: 0.12, f2: 2637, glide: 0.06, type: 'triangle' });   // upward flick
      for (const [f, d, v] of [[1975.5, 0.04, 0.16], [2637, 0.06, 0.12]]) k.bell(o, t + d, f, v, 0.55, [[1, 1, 1], [2.0, 0.25, 0.5], [3.0, 0.08, 0.3]]);
      k.thump(o, t, 180, 90, 0.07, 0.3);
      sparkle(k, o, t + 0.05, 5, 0.18, 0.02, 4000, 7500);
    }, 0.5, 0.3],
    'gs.good': [(k, o, t) => {
      // a clean steel tink, mid pitch, short: between the bright perfect glint and the dull weak thud
      k.bell(o, t, 740 * vary(0.015), 0.2, 0.28, [[1, 1, 1], [2.76, 0.3, 0.4], [5.4, 0.1, 0.25]]);
      k.thump(o, t, 240, 120, 0.06, 0.35);
      k.click(o, t, 3000, 0.12, 0.01, 1.2);
    }, 0.45, 0.12],
    'gs.weak': [(k, o, t) => {
      k.thump(o, t, 260 * vary(0.03), 150, 0.13, 0.45);
      k.tone(o, t, 330, { type: 'triangle', d: 0.16, vol: 0.12, f2: 247, glide: 0.14 });
      burst(k, o, t, 'lowpass', 700, 0.18, 0.06);
    }, 0.45, 0.06],

    // ---- blocks: shield clang, and a bright ringing parry
    'gs.block': [(k, o, t) => {
      k.thump(o, t, 200, 85, 0.12, 1.0);                                // shield weight
      burst(k, o, t, 'bandpass', 250, 0.9, 0.08, 0.9, 0.001, k.brown);
      burst(k, o, t, 'bandpass', 1500, 0.45, 0.05, 0.9);                  // clang body
      k.bell(o, t, 360 * vary(0.04), 0.22, 0.12, SHIELD);               // very short ring, so it never nags
      burst(k, o, t, 'highpass', 3000, 0.35, 0.015);
    }, 0.55, 0.15],
    'gs.block.perfect': [(k, o, t) => {
      // a physical steel-on-steel parry: a hard clash, then a clear ring (lower than the attack 'perfect' glint)
      crunch(k, o, t, 0.6, 0.035, 3000);
      burst(k, o, t, 'highpass', 2500, 0.6, 0.025);
      k.thump(o, t, 170, 65, 0.12, 0.8);
      k.bell(o, t, 784 * vary(0.01), 0.24, 0.8, SHIELD);
      k.bell(o, t + 0.004, 1175, 0.08, 0.5, ANVIL);
    }, 0.55, 0.35],

    // ---- elements
    'gs.fire': [(k, o, t) => {
      // fwoomp: a flame bursts, roars briefly and sizzles out
      const g = k.ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.8, t + 0.06); g.gain.setValueAtTime(0.6, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1); g.connect(o);
      const am = k.ac.createGain(); am.connect(g);
      for (let i = 0; i < 44; i++) am.gain.setValueAtTime(rnd(0.5, 1), t + i * 0.025);   // flame flutter
      const lp = k.filt(am, 'lowpass', 900, 0.6); lp.frequency.setValueAtTime(600, t); lp.frequency.exponentialRampToValueAtTime(3500, t + 0.08); lp.frequency.exponentialRampToValueAtTime(800, t + 1.0);
      k.noiseSrc(lp, t, 1.1); k.noiseSrc(k.filt(am, 'lowpass', 350, 0.8), t, 1.1, k.brown);
      k.thump(o, t, 110, 40, 0.35, 0.9);
      burst(k, o, t, 'lowpass', 5000, 0.8, 0.08);                         // ignition
      crunch(k, o, t, 0.45, 0.1, 900);
      for (let i = 0; i < 26; i++) k.click(o, t + 0.02 + Math.pow(Math.random(), 0.8) * 1.0, rnd(1800, 6000), rnd(0.25, 0.7), rnd(0.003, 0.01), 1);
    }, 0.7, 0.2],
    'gs.frost': [(k, o, t) => {
      crunch(k, o, t, 0.5, 0.05, 4500);                                  // ice shatter
      for (let i = 0; i < 10; i++) k.click(o, t + i * rnd(0.006, 0.018), rnd(3000, 8000), 0.7 * (1 - i / 11), 0.006, 1);
      burst(k, o, t, 'highpass', 4500, 0.6, 0.06);
      k.thump(o, t, 160, 70, 0.08, 0.5);
      for (const [f, d] of [[1174.7, 0.03], [1568, 0.07], [1760, 0.12]]) k.bell(o, t + d, f, 0.04, 1.0, [[1, 1, 1], [2.0, 0.3, 0.5], [3.0, 0.1, 0.3]]);
      const hg = k.envGain(o, t + 0.02, 0.06, 0.3, 0.8); k.noiseSrc(k.filt(hg, 'highpass', 5000, 0.5), t, 0.9);   // frosty hiss
    }, 0.6, 0.4],
    'gs.storm': [(k, o, t) => {
      // lightning: a dense electric crackle, a whip crack, then a short rolling thunder (no pitched sweep)
      const cg = k.ac.createGain(); cg.connect(k.filt(o, 'highpass', 1500, 0.5));
      for (let i = 0; i < 40; i++) cg.gain.setValueAtTime(Math.random() < 0.5 ? 0 : rnd(0.4, 1), t + i * 0.008);
      cg.gain.setValueAtTime(0, t + 0.33);
      k.noiseSrc(cg, t, 0.34);
      for (let i = 0; i < 20; i++) k.click(o, t + rnd(0, 0.3), rnd(2000, 8000), rnd(0.3, 0.7), 0.004, 0.8);
      burst(k, o, t + 0.02, 'highpass', 1200, 0.9, 0.05);
      crunch(k, o, t + 0.02, 0.5, 0.08, 2500);
      k.thump(o, t + 0.04, 85, 28, 0.5, 0.9);
      const rg = k.ac.createGain(); rg.gain.setValueAtTime(0, t + 0.05); rg.gain.linearRampToValueAtTime(0.7, t + 0.15); rg.gain.exponentialRampToValueAtTime(0.0001, t + 1.4); rg.connect(o);
      const am = k.ac.createGain(); am.connect(rg); for (let i = 0; i < 20; i++) am.gain.setValueAtTime(rnd(0.5, 1), t + 0.05 + i * 0.065);
      k.noiseSrc(k.filt(am, 'lowpass', 300, 0.8), t + 0.05, 1.4, k.brown);
    }, 0.65, 0.35],
    'gs.shadow': [(k, o, t) => {
      const g = swell(k, o, t, 0.6, 0.55, 0.75);
      k.noiseSrc(k.filt(g, 'lowpass', 600, 1.2), t, 0.65, k.brown);
      for (const [f, det] of [[98, -12], [103.8, 10]]) { const s = k.osc(k.filt(g, 'lowpass', 700, 1), 'sawtooth', f, t, 0.65, f * 0.7, 0.6); s.detune.value = det; }
      k.thump(o, t + 0.45, 75, 35, 0.4, 0.65);
      k.whoosh(o, t + 0.4, 0.5, 0.15, 1500, 300, 1);
    }, 0.65, 0.4],
    'gs.spirit': [(k, o, t) => {
      for (const [f, d] of [[659.25, 0], [987.77, 0.08]]) {
        const g = k.envGain(o, t + d, 0.18, 0.06, 0.7);
        const s = k.osc(k.filt(g, 'lowpass', 1500, 0.5), 'sine', f * 0.94, t + d, 0.95, f, 0.35);
        const lfo = k.ac.createOscillator(); lfo.frequency.value = 5; const lg = k.gain(s.frequency, f * 0.015); lfo.connect(lg); lfo.start(t + d); lfo.stop(t + d + 1);
      }
      const g = k.ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.3, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9); g.connect(o);
      const bp = k.filt(g, 'bandpass', 900, 0.8); bp.frequency.setValueAtTime(600, t); bp.frequency.exponentialRampToValueAtTime(2500, t + 0.3); bp.frequency.exponentialRampToValueAtTime(800, t + 0.9);
      k.noiseSrc(bp, t, 0.95);                                            // breathy spectral whoosh
    }, 0.6, 0.55],
    'gs.bone': [(k, o, t) => {
      // a clatter of dry bones: a couple of heavier knocks on the floor, then many crisp hollow knocks scattering
      for (const [d, f] of [[0, 420], [0.07, 360]]) { k.tone(o, t + d, f, { a: 0.0005, d: 0.06, vol: 0.4 }); k.click(o, t + d, 1200, 0.5, 0.015, 1.5); k.thump(o, t + d, 220, 120, 0.05, 0.4); }
      let at = t + 0.05, v = 0.75;
      for (let i = 0; i < 22; i++) {
        const f = rnd(900, 2600);
        k.tone(o, at, f, { a: 0.0005, d: rnd(0.015, 0.035), vol: v * 0.45 });
        k.tone(o, at, f * 1.7, { a: 0.0005, d: 0.012, vol: v * 0.2 });
        k.click(o, at, f * 2, v * 0.7, 0.008, 2.5);
        at += rnd(0.015, 0.06) * (1 + i * 0.04); v *= 0.9;
      }
    }, 0.55, 0.15],
    'gs.roar': [(k, o, t) => {
      const dur = 1.4;
      const g = k.ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.55, t + 0.18); g.gain.setValueAtTime(0.5, t + 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); g.connect(o);
      const lp = k.filt(g, 'lowpass', 400, 3); lp.frequency.setValueAtTime(300, t); lp.frequency.linearRampToValueAtTime(1300, t + 0.25); lp.frequency.exponentialRampToValueAtTime(350, t + dur);
      const am = k.ac.createGain(); am.connect(lp);
      const trem = k.ac.createOscillator(); trem.frequency.value = 26; const tg = k.gain(am.gain, 0.4); trem.connect(tg); trem.start(t); trem.stop(t + dur);
      for (const [f, det] of [[58, 0], [59, 9], [87, -6], [116, 4]]) { const s = k.osc(am, 'sawtooth', f, t, dur, f * 0.72, dur); s.detune.value = det; }
      k.noiseSrc(k.filt(k.envGain(o, t, 0.12, 0.3, 1.1), 'bandpass', 800, 0.9), t, dur, k.brown);   // breath
      k.thump(o, t, 70, 32, 0.6, 0.6);
    }, 0.7, 0.45],
    'gs.charge': [(k, o, t) => {
      // a mystical build with no pitch glide: deep arcane rumble, crystal hums fading in, rushing air, a quickening shimmer
      const dur = 1.4;
      const rg = k.ac.createGain(); rg.gain.setValueAtTime(0.05, t); rg.gain.linearRampToValueAtTime(0.6, t + dur * 0.9); rg.gain.linearRampToValueAtTime(0, t + dur); rg.connect(o);
      k.noiseSrc(k.filt(rg, 'lowpass', 180, 0.8), t, dur, k.brown);
      const ag = k.ac.createGain(); ag.gain.setValueAtTime(0.01, t); ag.gain.linearRampToValueAtTime(0.22, t + dur * 0.92); ag.gain.linearRampToValueAtTime(0, t + dur); ag.connect(o);
      const bp = k.filt(ag, 'bandpass', 600, 0.8); bp.frequency.setValueAtTime(500, t); bp.frequency.exponentialRampToValueAtTime(3500, t + dur);
      k.noiseSrc(bp, t, dur);
      for (const [f, at] of [[220, 0], [329.6, 0.35], [440, 0.7], [659.3, 0.95]]) {   // crystal hums stack up
        const g = k.ac.createGain(); g.gain.setValueAtTime(0, t + at); g.gain.linearRampToValueAtTime(0.05, t + at + 0.2); g.gain.setValueAtTime(0.05, t + dur - 0.1); g.gain.linearRampToValueAtTime(0, t + dur); g.connect(o);
        const sOsc = k.osc(g, 'sine', f, t + at, dur - at); const lfo = k.ac.createOscillator(); lfo.frequency.value = 5 + at * 4; const lg = k.gain(sOsc.frequency, f * 0.006); lfo.connect(lg); lfo.start(t + at); lfo.stop(t + dur + 0.05);
      }
      for (let i = 0; i < 16; i++) k.bell(o, t + dur * Math.sqrt(Math.random()), rnd(2000, 4500), 0.012, 0.3, [[1, 1, 1], [2, 0.3, 0.5]]);
    }, 0.55, 0.35],
    'gs.release': [(k, o, t) => {
      // the blast: broadband burst, deep boom, grit, no tonal sweep
      burst(k, o, t, 'lowpass', 7000, 0.9, 0.25, 0.5, 0.002);
      crunch(k, o, t, 0.45, 0.15, 1200);
      k.thump(o, t, 90, 26, 0.6, 1.0);
      burst(k, o, t, 'lowpass', 500, 0.8, 0.45, 0.7, 0.003, k.brown);
      k.bell(o, t, 220, 0.05, 1.0, TOWER_BELL);
    }, 0.7, 0.35],

    // ---- loot: common < rare < epic < legendary
    'gs.loot.common': [(k, o, t) => {
      k.bell(o, t, 1760 * vary(0.02), 0.08, 0.35, ANVIL);
      k.mallet(o, t + 0.05, C.G5, 0.3); k.mallet(o, t + 0.13, C.C6, 0.28);
    }, 0.5, 0.2],
    'gs.loot.rare': [(k, o, t) => {
      k.whoosh(o, t, 0.35, 0.12, 900, 5000, 1.5);
      [C.D5, C.A5, C.D5 * 2].forEach((f, i) => k.bell(o, t + 0.05 + i * 0.08, f, 0.16, 1.3));
      k.tone(o, t + 0.05, C.D4, { a: 0.05, d: 0.9, vol: 0.1, type: 'triangle' });
      sparkle(k, o, t + 0.2, 8, 0.5, 0.03);
    }, 0.6, 0.4],
    'gs.loot.epic': [(k, o, t) => {
      const g = swell(k, o, t, 0.55, 0.22, 0.95);
      k.noiseSrc(k.filt(g, 'bandpass', 2000, 0.8), t, 0.6);                // rising rush
      k.thump(o, t + 0.5, 90, 38, 0.5, 0.75);
      [C.E5, C.G5, C.B5, C.E6, C.G6].forEach((f, i) => k.bell(o, t + 0.5 + i * 0.075, f, 0.14, 1.6));
      for (const f of [164.8, 246.9, 329.6]) k.brass(o, t + 0.5, f, 0.8, 0.09);
      pad(k, o, t + 0.5, [329.6, 392, 493.9], 1.6, 0.025);
      sparkle(k, o, t + 0.6, 14, 0.9, 0.03);
    }, 0.65, 0.5],
    'gs.loot.legendary': [(k, o, t) => {
      // An event: a long rising rush, a deep boom, a brass and choir chord, a cascade of bells, a glittering tail.
      const g = swell(k, o, t, 1.0, 0.3, 0.97);
      const bp = k.filt(g, 'bandpass', 600, 0.9); bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(4000, t + 1.0);
      k.noiseSrc(bp, t, 1.05);
      for (const det of [-10, 10]) { const s = k.osc(k.filt(g, 'lowpass', 1500), 'sawtooth', 110, t, 1.0, 440, 1.0); s.detune.value = det; }
      const T = t + 0.98;
      k.thump(o, T, 70, 26, 1.0, 1.0); burst(k, o, T, 'lowpass', 800, 0.6, 0.35, 0.7, 0.001, k.brown);
      k.bell(o, T, 110, 0.25, 3, TOWER_BELL);
      for (const f of [146.8, 220, 293.7, 370]) k.brass(o, T, f, 1.6, 0.09);                    // D major
      k.brass(o, T + 0.4, 440, 1.2, 0.08);
      pad(k, o, T, [293.7, 370, 440, 587.3], 2.6, 0.03, 2400);
      [C.D5, 740, C.A5, C.D5 * 2, 1480, 1760, 2349].forEach((f, i) => k.bell(o, T + 0.08 + i * 0.07, f, 0.13, 2.0));
      sparkle(k, o, T + 0.1, 28, 1.8, 0.03, 3000, 8000);
      const hp = k.filt(k.envGain(o, T, 0.3, 0.1, 2.2), 'highpass', 6500); k.noiseSrc(hp, T, 2.6);
    }, 0.75, 0.55],

    // ---- gear, camp, progress
    'gs.equip': [(k, o, t) => {
      // armour settles on: a leather creak-thump, then a rattle of mail rings and a buckle
      burst(k, o, t, 'bandpass', 400, 0.35, 0.06, 0.8, 0.003, k.brown);
      k.noiseSrc(k.filt(k.envGain(o, t, 0.02, 0.15, 0.12), 'bandpass', 2500, 1), t, 0.16);
      for (let i = 0; i < 9; i++) {
        const at = t + 0.03 + i * rnd(0.012, 0.03), f = rnd(3500, 6500);
        k.bell(o, at, f, 0.1 * (1 - i / 12), rnd(0.06, 0.12), [[1, 1, 1], [1.47, 0.6, 0.7], [2.09, 0.4, 0.5]]);
        k.click(o, at, f, 0.25, 0.004, 2);
      }
      k.click(o, t + 0.2, 3000, 0.4, 0.008, 1.5); k.bell(o, t + 0.2, 2200, 0.06, 0.12, ANVIL);   // buckle
    }, 0.55, 0.12],
    'gs.forge': [(k, o, t) => {
      for (const [d, v] of [[0, 0.8], [0.34, 0.85], [0.66, 1]]) {        // three heavy hammer blows on the anvil
        k.thump(o, t + d, 130, 50, 0.18, 0.9 * v);
        crunch(k, o, t + d, 0.35 * v, 0.04, 2500);
        k.bell(o, t + d, 520 * vary(0.01), 0.4 * v, 1.3, [[1, 1, 1], [2.76, 0.7, 0.7], [4.1, 0.4, 0.5], [5.4, 0.35, 0.4], [8.93, 0.2, 0.25]]);
      }
      const g = k.ac.createGain(); g.gain.setValueAtTime(0, t + 1.05); g.gain.linearRampToValueAtTime(0.55, t + 1.1); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.3); g.connect(o);   // quench
      k.noiseSrc(k.filt(g, 'bandpass', 4500, 0.5), t + 1.05, 1.3);
      for (let i = 0; i < 20; i++) k.click(o, t + 1.07 + rnd(0, 0.8), rnd(3000, 7000), rnd(0.1, 0.25), 0.005, 1);   // sizzle
      [C.D5 * 2, 1760].forEach((f, i) => k.bell(o, t + 1.5 + i * 0.08, f, 0.06, 1.0));   // upgraded
    }, 0.6, 0.3],
    'gs.levelup': [(k, o, t) => {
      for (let i = 0; i < 8; i++) k.thump(o, t + i * 0.04, 90, 55, 0.12, 0.25 + i * 0.05);   // timpani roll
      [[146.8, 0.04, 0.16], [220, 0.2, 0.16], [293.7, 0.36, 1.0]].forEach(([f, d, l]) => horn(k, o, t + d, f, l, 0.15));
      for (const f of [73.4, 146.8, 220, 370]) horn(k, o, t + 0.36, f, 1.0, 0.05);
      drum(k, o, t + 0.36, 1, 58); drum(k, o, t + 0.36, 0.6, 110); crunch(k, o, t + 0.36, 0.2, 0.08, 1500);
      k.bell(o, t + 0.36, 1174.7, 0.1, 1.4, ANVIL);
      sparkle(k, o, t + 0.4, 10, 0.6, 0.03);
    }, 0.65, 0.4],
    'gs.heal': [(k, o, t) => {
      for (const d of [0, 0.13]) k.tone(o, t + d, 260, { a: 0.005, d: 0.09, vol: 0.25, f2: 520, glide: 0.07 });   // gulp
      for (const [f, d] of [[392, 0.2], [493.9, 0.25], [587.3, 0.3]]) k.tone(o, t + d, f, { a: 0.25, d: 0.9, vol: 0.08, type: 'triangle' });
      [C.G5, C.B5, C.D5 * 2].forEach((f, i) => k.bell(o, t + 0.4 + i * 0.1, f, 0.08, 1.1, [[1, 1, 1], [2, 0.3, 0.5]]));
      k.whoosh(o, t + 0.2, 0.9, 0.08, 800, 4000, 1);
    }, 0.55, 0.5],
    'gs.ko': [(k, o, t) => {
      // a beaten monster crumbles to dust
      k.thump(o, t, 110, 35, 0.4, 0.8);
      const g = k.ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.45, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1); g.connect(o);
      const lp = k.filt(g, 'lowpass', 2500, 0.6); lp.frequency.setValueAtTime(2500, t); lp.frequency.exponentialRampToValueAtTime(250, t + 1.0);
      k.noiseSrc(lp, t, 1.1);
      for (let i = 0; i < 14; i++) k.click(o, t + 0.05 + Math.pow(Math.random(), 1.6) * 0.8, rnd(800, 3000), rnd(0.06, 0.2), 0.01, 2);
      k.whoosh(o, t + 0.2, 0.9, 0.1, 2000, 500, 0.8);
    }, 0.65, 0.3],
    'gs.victory': [(k, o, t) => {
      drum(k, o, t, 1, 65); drum(k, o, t + 0.17, 0.8, 65); drum(k, o, t + 0.5, 0.8, 85);
      const n = [[220, 0, 0.14], [220, 0.16, 0.14], [293.7, 0.34, 0.28], [329.6, 0.66, 0.14], [370, 0.82, 1.2]];   // A A D E F# (low, heroic)
      for (const [f, d, l] of n) horn(k, o, t + d, f, l, 0.14);
      for (const f of [73.4, 146.8, 220, 293.7]) horn(k, o, t + 0.82, f, 1.2, 0.06);
      drum(k, o, t + 0.82, 1, 55); drum(k, o, t + 0.82, 0.7, 120); crunch(k, o, t + 0.82, 0.25, 0.1, 1500);
      k.bell(o, t + 0.82, 740, 0.08, 1.6, ANVIL);
      sparkle(k, o, t + 0.85, 10, 0.7, 0.025);
    }, 0.7, 0.4],
    'gs.defeat': [(k, o, t) => {
      drum(k, o, t, 0.7, 70);
      [[C.A4, 0, 0.4], [C.F4, 0.42, 0.4], [C.D4, 0.84, 1.1]].forEach(([f, d, l]) => k.brass(o, t + d, f, l, 0.14));
      for (const f of [73.4, 110, 146.8]) k.brass(o, t + 0.84, f, 1.1, 0.07);
      drum(k, o, t + 0.84, 0.8, 60);
      pad(k, o, t + 0.84, [146.8, 174.6, 220], 1.6, 0.02, 900);
    }, 0.6, 0.45],
    'gs.bell': [(k, o, t) => {
      // the great tower bell: one deep toll with a long hum
      k.bell(o, t, 98 * vary(0.01), 0.45, 4.2, TOWER_BELL);
      k.click(o, t, 900, 0.3, 0.04, 0.8); k.thump(o, t, 90, 50, 0.3, 0.4);
    }, 0.7, 0.6],
    'gs.fury': [(k, o, t) => {
      const g = k.envGain(o, t, 0.25, 0.35, 0.45);
      const lp = k.filt(g, 'lowpass', 500, 4); lp.frequency.setValueAtTime(300, t); lp.frequency.exponentialRampToValueAtTime(2500, t + 0.3);
      for (const det of [-14, 0, 12]) { const s = k.osc(lp, 'sawtooth', 73.4, t, 0.7, 146.8, 0.3); s.detune.value = det; }
      drum(k, o, t + 0.28, 1, 75);
      burst(k, o, t + 0.28, 'highpass', 2000, 0.4, 0.04);
      k.bell(o, t + 0.28, 587.3, 0.08, 0.7, ANVIL);
    }, 0.7, 0.3],
    'gs.chest': [(k, o, t) => {
      k.click(o, t, 2200, 0.45, 0.015, 2); k.click(o, t + 0.03, 1400, 0.3, 0.02, 2);   // latch
      const g = k.envGain(o, t + 0.08, 0.15, 0.25, 0.5);                       // hinge creak
      const bp = k.filt(g, 'bandpass', 900, 6);
      const s = k.osc(bp, 'sawtooth', 180, t + 0.08, 0.6, 260, 0.55);
      const lfo = k.ac.createOscillator(); lfo.frequency.value = 31; const lg = k.gain(s.frequency, 40); lfo.connect(lg); lfo.start(t); lfo.stop(t + 0.7);
      k.thump(o, t + 0.62, 120, 60, 0.15, 0.6);                                 // lid falls back
      burst(k, o, t + 0.62, 'lowpass', 900, 0.3, 0.08, 0.7, 0.002, k.brown);
      k.whoosh(o, t + 0.6, 0.4, 0.1, 1500, 6000, 1.5);
      [C.A5, C.E6].forEach((f, i) => k.bell(o, t + 0.68 + i * 0.07, f, 0.07, 1.0));
    }, 0.6, 0.3],
    'gs.coin': [(k, o, t) => {
      // a few gold coins dropping into a pile: bright inharmonic clinks with tiny ticks between
      const n = 5 + Math.floor(Math.random() * 3);
      let at = t;
      for (let i = 0; i < n; i++) {
        const f = rnd(2400, 3400), v = 0.12 * (1 - i / (n + 3));
        k.bell(o, at, f, v, rnd(0.18, 0.3), [[1, 1, 1], [1.47, 0.7, 0.8], [2.09, 0.5, 0.6], [2.56, 0.35, 0.5], [3.4, 0.2, 0.3]]);
        k.click(o, at, 6000, v * 2, 0.004, 1);
        at += rnd(0.03, 0.08);
      }
      burst(k, o, t, 'bandpass', 900, 0.15, 0.05, 1);              // the soft bag/pile under them
    }, 0.45, 0.2],
  };
}

// Level trims from offline measurement (peak and RMS of each rendered sound), so the set sits together.
const TRIM = { 'miss': 2.5, 'enemy.flee': 2.5, 'boat': 3, 'dice.throw': 1.8, 'spell.cast': 2.5, 'enemy.hurt': 2.5, 'spell.vine': 2, 'bow': 2,
  'rune.click': 2, 'footsteps': 2, 'whoosh': 2, 'chime.wrong': 1.5, 'hit.magic': 1.5, 'hit.light': 1.5, 'coin': 1.5,
  'roar': 0.65, 'dice.shake': 0.6, 'ui.page': 0.45, 'sting.danger': 0.8,
  // Grimspire
  'gs.swing': 0.4, 'gs.perfect': 1.6, 'gs.good': 1.8, 'gs.weak': 1.5, 'gs.spirit': 1.2, 'gs.bone': 1.6, 'gs.frost': 1, 'gs.equip': 2.5, 'gs.hit': 2,
  'gs.coin': 2, 'gs.heal': 1.4, 'gs.roar': 0.8, 'gs.crit': 0.9, 'gs.fury': 0.85, 'gs.shadow': 0.7, 'gs.charge': 0.8 };

export const SFX_NAMES = Object.keys(SFX);

function playSfx(kit, dest, reverbIn, name, { volume = 1, rate = 1, pan = 0 } = {}, t) {
  const def = SFX[name];
  if (!def) return false;
  const [fn, baseVol, send] = def;
  const ac = kit.ac;
  const out = ac.createGain();
  out.gain.value = baseVol * (TRIM[name] || 1) * volume;
  let node = out;
  if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); out.connect(p); node = p; }
  node.connect(dest);
  if (reverbIn && send) node.connect(kit.gain(reverbIn, send));
  // rate: pitch everything by detuning via a wrapper kit
  const k = rate === 1 ? kit : rateKit(kit, rate);
  fn(k, out, t);
  return true;
}
function rateKit(kit, r) {
  const scale = f => f * r;
  return { ...kit,
    tone: (d, t, f, o = {}) => kit.tone(d, t, scale(f), { ...o, f2: o.f2 && scale(o.f2) }),
    bell: (d, t, f, ...a) => kit.bell(d, t, scale(f), ...a),
    mallet: (d, t, f, v) => kit.mallet(d, t, scale(f), v),
    brass: (d, t, f, ...a) => kit.brass(d, t, scale(f), ...a),
    pluck: (d, t, f, ...a) => kit.pluck(d, t, scale(f), ...a),
    click: (d, t, f, ...a) => kit.click(d, t, scale(f), ...a),
    thump: (d, t, f1, f2, ...a) => kit.thump(d, t, scale(f1), scale(f2), ...a),
  };
}

function playChime(kit, dest, reverbIn, index, { long = false } = {}, t) {
  const f = CHIME_HZ[Math.max(0, Math.min(4, index | 0))];
  if (!f) return;
  const D = long ? 4.5 : 2.6;
  const out = kit.gain(dest, 0.55);
  if (reverbIn) out.connect(kit.gain(reverbIn, 0.4));
  // Warm music-box / glass bell: a pure fundamental, soft harmonics, a gentle sub-octave bloom,
  // a slightly detuned twin for shimmer, and a tiny hammer touch.
  for (const [r, amp, dm] of [[1, 0.55, 1], [2.0, 0.16, 0.55], [3.0, 0.06, 0.35], [4.2, 0.03, 0.2]]) kit.tone(out, t, f * r, { a: 0.003, d: D * dm, vol: amp });
  kit.tone(out, t, f * 1.0025, { a: 0.01, d: D * 0.9, vol: 0.16 });
  kit.tone(out, t, f / 2, { a: 0.09, d: D * 0.8, vol: 0.14, type: 'triangle' });
  kit.click(out, t, 5200, 0.025, 0.006, 3);
}

// Renders one sound to an AudioBuffer offline (for dev/audio.html checks).
export async function renderSfx(name, opts = {}, seconds = 3, sampleRate = 44100) {
  const ac = new OfflineAudioContext(2, Math.floor(seconds * sampleRate), sampleRate);
  const kit = makeKit(ac);
  const comp = ac.createDynamicsCompressor();
  setComp(comp);
  comp.connect(ac.destination);
  const verb = ac.createConvolver(); verb.buffer = makeImpulse(ac); verb.connect(comp);
  if (name.startsWith('chime:')) playChime(kit, comp, verb, +name.slice(6), opts, 0.01);
  else playSfx(kit, comp, verb, name, opts, 0.01);
  return ac.startRendering();
}
function setComp(c) {
  c.threshold.value = -16; c.knee.value = 12; c.ratio.value = 3; c.attack.value = 0.008; c.release.value = 0.25;
}

// ---------------------------------------------------------------------------------------------
// Ambience beds: procedural loops. Each returns { stop(fade) }.
// ---------------------------------------------------------------------------------------------

function bedNoise(k, dest, buf, type, f, Q, vol, lfo) {
  const g = k.gain(dest, vol);
  const fl = k.filt(g, type, f, Q);
  const s = k.ac.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(fl); s.start(k.ac.currentTime, Math.random() * 2);
  const nodes = [s];
  if (lfo) {   // slow sweep for wind and breath
    const o = k.ac.createOscillator(); o.frequency.value = lfo.rate;
    const lg = k.gain(fl.frequency, lfo.depth); o.connect(lg); o.start();
    const o2 = k.ac.createOscillator(); o2.frequency.value = lfo.rate * 0.73;
    const ag = k.gain(g.gain, vol * (lfo.amp || 0.5)); o2.connect(ag); o2.start();
    nodes.push(o, o2);
  }
  return nodes;
}

const AMB = {
  fire: k => ({ beds: [[k.brown, 'lowpass', 500, 0.7, 0.35, { rate: 0.13, depth: 120, amp: 0.3 }]], events: [[0.04, 0.25, crackle]] }),
  festival: k => ({ beds: [[k.noise, 'bandpass', 700, 0.6, 0.06, { rate: 0.2, depth: 200, amp: 0.4 }]], events: [[0.25, 0.9, murmurVoice], [1.5, 5, clink], [0.3, 1.2, crackle]] }),
  market: k => ({ beds: [[k.noise, 'bandpass', 600, 0.6, 0.07, { rate: 0.25, depth: 180, amp: 0.4 }]], events: [[0.15, 0.6, murmurVoice], [0.8, 3, clink], [3, 8, clink]] }),
  forest: k => ({ beds: [[k.noise, 'bandpass', 900, 0.4, 0.05, { rate: 0.07, depth: 400, amp: 0.7 }]], events: [[0.15, 0.6, cricket], [5, 14, owl], [1.5, 4, rustle]] }),
  night: k => ({ beds: [[k.noise, 'lowpass', 500, 0.5, 0.05, { rate: 0.05, depth: 150, amp: 0.6 }]], events: [[0.08, 0.35, cricket], [8, 20, owl]] }),
  marsh: k => ({ beds: [[k.brown, 'lowpass', 400, 0.6, 0.18, { rate: 0.11, depth: 120, amp: 0.4 }]], events: [[0.6, 2.2, frog], [0.2, 0.7, cricket], [0.8, 2.5, lap]] }),
  cave: k => ({ beds: [[k.brown, 'lowpass', 160, 0.7, 0.3, { rate: 0.04, depth: 40, amp: 0.3 }]], events: [[0.5, 2.5, drip]] }),
  crystal: k => ({ beds: [[k.brown, 'lowpass', 180, 0.7, 0.22, { rate: 0.05, depth: 40, amp: 0.3 }]], events: [[0.6, 2.2, glass], [1.5, 4, drip]] }),
  wind: k => ({ beds: [[k.noise, 'bandpass', 500, 1.2, 0.12, { rate: 0.09, depth: 350, amp: 0.8 }], [k.noise, 'bandpass', 1400, 3, 0.03, { rate: 0.13, depth: 600, amp: 0.9 }]], events: [] }),
  lair: k => ({ beds: [[k.brown, 'lowpass', 120, 0.8, 0.35, { rate: 0.03, depth: 30, amp: 0.3 }]], events: [[5.5, 7.5, breath], [1, 3.5, drip]] }),
};

// Ambient events (live only; scheduled a moment ahead on the audio clock)
function crackle(k, o, t) { const n = 1 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) k.click(o, t + i * rnd(0.01, 0.04), rnd(1500, 5000), rnd(0.15, 0.6), rnd(0.004, 0.015), 1); }
function murmurVoice(k, o, t) {
  const d = rnd(0.4, 1.4), f = rnd(110, 240);
  const g = k.envGain(o, t, d * 0.3, rnd(0.02, 0.05), d * 0.7);
  const f1 = k.filt(g, 'bandpass', rnd(500, 900), 3);
  const s = k.osc(f1, 'sawtooth', f, t, d, f * rnd(0.85, 1.15), d);
  s.detune.value = rnd(-30, 30);
}
function clink(k, o, t) { k.bell(o, t, rnd(1800, 3200), 0.03, 0.4, [[1, 1, 1], [2.7, 0.5, 0.5]]); }
function cricket(k, o, t) { const f = rnd(4200, 4800), n = 3 + Math.floor(Math.random() * 3), v = rnd(0.008, 0.02), p = (Math.random() * 2 - 1) * 0.8; const pan = k.ac.createStereoPanner(); pan.pan.value = p; pan.connect(o); for (let i = 0; i < n; i++) k.tone(pan, t + i * 0.045, f, { a: 0.004, d: 0.025, vol: v }); }
function owl(k, o, t) { for (const [d, l] of [[0, 0.35], [0.5, 0.25], [0.8, 0.6]]) k.tone(o, t + d, 380, { a: 0.06, d: l, vol: 0.03, f2: 340, glide: l }); }
function rustle(k, o, t) { k.noiseSrc(k.filt(k.envGain(o, t, 0.2, 0.04, 0.5), 'highpass', 2500), t, 0.8); }
function frog(k, o, t) { const f = rnd(90, 170), n = 2 + Math.floor(Math.random() * 4); const bp = k.filt(k.gain(o, rnd(0.03, 0.07)), 'bandpass', f * 4, 3); for (let i = 0; i < n; i++) { const g = k.envGain(bp, t + i * 0.12, 0.01, 1, 0.08); k.osc(g, 'sawtooth', f, t + i * 0.12, 0.09, f * 0.85, 0.08); } }
function lap(k, o, t) { k.noiseSrc(k.filt(k.envGain(o, t, 0.25, 0.06, 0.6), 'lowpass', 700), t, 0.9); }
function drip(k, o, t) { const f = rnd(900, 1800); k.tone(o, t, f, { a: 0.001, d: 0.12, vol: rnd(0.03, 0.07), f2: f * 1.8, glide: 0.04 }); }
function glass(k, o, t) { k.bell(o, t, rnd(1, 2) > 1.5 ? CHIME_HZ[Math.floor(Math.random() * 5)] * 2 : CHIME_HZ[Math.floor(Math.random() * 5)] * 4, 0.02, 2.2, [[1, 1, 1], [2.0, 0.3, 0.6], [3.0, 0.1, 0.3]]); }
function breath(k, o, t) {
  const g = k.ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + 1.6); g.gain.linearRampToValueAtTime(0.06, t + 2.2); g.gain.linearRampToValueAtTime(0.14, t + 3.0); g.gain.linearRampToValueAtTime(0, t + 4.8); g.connect(o);
  k.noiseSrc(k.filt(g, 'lowpass', 380, 0.7), t, 5, k.brown);
}

// ---------------------------------------------------------------------------------------------
// Fallback music: a quiet procedural pad when a track's file is missing
// ---------------------------------------------------------------------------------------------

const PAD = {   // root Hz, scale steps (semitones), chord roots as scale degrees, seconds per chord, pulse
  title: [146.8, [0, 2, 4, 6, 7, 9, 11], [0, 4, 5, 3], 6], village: [196, [0, 2, 4, 5, 7, 9, 11], [0, 3, 4, 0], 4],
  forest: [146.8, [0, 2, 3, 5, 7, 9, 10], [0, 3, 6, 0], 6], glade: [164.8, [0, 2, 4, 6, 7, 9, 11], [0, 1, 5, 0], 7],
  marsh: [110, [0, 2, 3, 5, 7, 8, 10], [0, 5, 3, 0], 8], market: [174.6, [0, 2, 4, 5, 7, 9, 10], [0, 6, 3, 0], 4],
  road: [130.8, [0, 2, 4, 5, 7, 9, 11], [0, 5, 3, 4], 5], dungeon: [73.4, [0, 2, 3, 5, 7, 8, 10], [0, 5, 0, 6], 8],
  crystal: [164.8, [0, 2, 4, 6, 7, 9, 11], [0, 4, 1, 0], 7], battle: [110, [0, 2, 3, 5, 7, 8, 10], [0, 5, 6, 4], 3, true],
  boss: [73.4, [0, 2, 3, 5, 7, 8, 10], [0, 6, 5, 4], 3, true], lair: [65.4, [0, 2, 3, 5, 7, 8, 10], [0, 5, 3, 6], 9],
  lullaby: [130.8, [0, 2, 4, 7, 9, 12, 14], [0, 3, 1, 0], 8], camp: [174.6, [0, 2, 4, 5, 7, 9, 11], [0, 3, 5, 4], 7],
  victory: [130.8, [0, 2, 4, 5, 7, 9, 11], [0, 3, 4, 0], 3], ending: [146.8, [0, 2, 4, 5, 7, 9, 11], [0, 5, 3, 4], 6],
  // Grimspire: darker modes, lower roots
  gs_title: [73.4, [0, 2, 3, 5, 7, 8, 10], [0, 5, 6, 4], 5], gs_camp: [98, [0, 2, 3, 5, 7, 8, 10], [0, 5, 3, 6], 8],
  gs_explore_a: [82.4, [0, 1, 3, 5, 7, 8, 10], [0, 1, 0, 5], 7], gs_explore_b: [87.3, [0, 2, 3, 5, 7, 8, 10], [0, 6, 5, 0], 6],
  gs_explore_c: [65.4, [0, 1, 3, 5, 6, 8, 10], [0, 1, 4, 0], 9], gs_battle: [110, [0, 2, 3, 5, 7, 8, 10], [0, 5, 6, 4], 2.5, true],
  gs_boss: [73.4, [0, 1, 3, 5, 7, 8, 10], [0, 1, 5, 6], 2.5, true], gs_final: [65.4, [0, 2, 3, 5, 7, 8, 10], [0, 5, 6, 4], 2.5, true],
  gs_victory: [146.8, [0, 2, 4, 5, 7, 9, 11], [0, 3, 4, 0], 4], gs_ending: [146.8, [0, 2, 4, 5, 7, 9, 11], [0, 5, 3, 4], 6],
};

function startPad(kit, dest, id) {
  const [root, scale, prog, secs, pulse] = PAD[id] || PAD.camp;
  const ac = kit.ac;
  const out = kit.gain(dest, 0.0001);
  out.gain.setValueAtTime(0.0001, ac.currentTime);
  out.gain.exponentialRampToValueAtTime(1, ac.currentTime + 2);
  const lp = kit.filt(out, 'lowpass', 1400, 0.5);
  const note = deg => root * Math.pow(2, (scale[deg % scale.length] + 12 * Math.floor(deg / scale.length)) / 12);
  let i = 0, nextT = ac.currentTime + 0.05, stopped = false;
  const tick = () => {
    if (stopped) return;
    while (nextT < ac.currentTime + 1.5) {
      const deg = prog[i++ % prog.length];
      for (const [d, v, type] of [[0, 0.05, 'triangle'], [2, 0.035, 'triangle'], [4, 0.03, 'sine'], [7, 0.02, 'sine']]) {
        const g = ac.createGain();
        g.gain.setValueAtTime(0, nextT);
        g.gain.linearRampToValueAtTime(v, nextT + secs * 0.35);
        g.gain.linearRampToValueAtTime(v * 0.7, nextT + secs * 0.8);
        g.gain.linearRampToValueAtTime(0, nextT + secs * 1.25);
        g.connect(lp);
        for (const det of [-5, 5]) { const o = kit.osc(g, type, note(deg + d), nextT, secs * 1.25); o.detune.value = det; }
      }
      if (pulse) for (let b = 0; b < secs * 2; b++) kit.thump(lp, nextT + b * 0.5, 90, 50, 0.18, b % 2 ? 0.06 : 0.1);
      nextT += secs;
    }
  };
  tick();
  const timer = setInterval(tick, 500);
  return {
    stop(fade = 1.5) {
      stopped = true; clearInterval(timer);
      const t = ac.currentTime;
      out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), t);
      out.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.05, fade));
      setTimeout(() => out.disconnect(), (fade + secs * 1.3 + 0.5) * 1000);
    },
  };
}

// ---------------------------------------------------------------------------------------------
// The service
// ---------------------------------------------------------------------------------------------

export function createAudio() {
  const vol = { master: 0.9, music: 0.55, sfx: 0.8, voice: 1 };
  let ac = null, kit = null, bus = null;
  let pendingMusic, pendingAmb, curMusic = null, curAmb = null;
  let manifest = null;
  let voiceCur = null;
  const voiceCache = new Map();

  const manifestReady = (async () => {
    try {
      const res = await fetch(base + 'assets/voice/manifest.json', { cache: 'no-store' });
      manifest = res.ok ? await res.json() : {};
    } catch { manifest = {}; }
  })();

  function ensure() {
    if (ac) return true;
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return false;
    try { ac = new AC({ latencyHint: 'interactive' }); } catch { return false; }
    kit = makeKit(ac);
    const comp = ac.createDynamicsCompressor(); setComp(comp); comp.connect(ac.destination);
    const master = kit.gain(comp, vol.master);
    const verb = ac.createConvolver(); verb.buffer = makeImpulse(ac); verb.connect(master);
    const verbIn = kit.gain(verb, 0.6);
    const sfx = kit.gain(master, vol.sfx);
    const musicDuck = kit.gain(master, 1);
    const music = kit.gain(musicDuck, vol.music);
    const ambDuck = kit.gain(master, 1);
    const amb = kit.gain(ambDuck, Math.min(1, vol.music * 1.3));
    const voice = kit.gain(master, vol.voice);
    const verbSfx = kit.gain(verbIn, vol.sfx);
    const verbAmb = kit.gain(verbIn, Math.min(1, vol.music * 1.3)); // ambience reverb send follows the ambience volume
    bus = { comp, master, verbIn: verbSfx, verbAmb, sfx, music, musicDuck, amb, ambDuck, voice };
    return true;
  }
  const running = () => ac && ac.state === 'running';

  function applyVolumes() {
    if (!bus) return;
    const t = ac.currentTime, set = (g, v) => g.gain.setTargetAtTime(v, t, 0.05);
    set(bus.master, vol.master); set(bus.sfx, vol.sfx); set(bus.verbIn, vol.sfx);
    set(bus.music, vol.music); set(bus.amb, Math.min(1, vol.music * 1.3)); set(bus.verbAmb, Math.min(1, vol.music * 1.3)); set(bus.voice, vol.voice);
  }

  function duck(on) {
    if (!bus) return;
    const t = ac.currentTime;
    for (const [g, low] of [[bus.musicDuck, 0.32], [bus.ambDuck, 0.6]]) {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(on ? low : 1, t + (on ? 0.18 : 0.8));
    }
  }

  // ---- music
  // A track is one or two layers (an <audio> element streamed through a gain). Looping tracks
  // overlap their end with a fresh start of themselves, so the loop point is a soft crossfade.
  const LOOP_XFADE = 3;
  function fadeLayer(layer, to, secs) {
    const g = layer.gain.gain, t = ac.currentTime;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(to, t + Math.max(0.05, secs));
  }
  function killLayer(layer, after) {
    setTimeout(() => { try { layer.el.pause(); layer.el.removeAttribute('src'); layer.el.load(); layer.gain.disconnect(); } catch {} }, after * 1000 + 100);
  }
  function stopMusic(m, fade) {
    if (!m) return;
    m.stopped = true;
    clearInterval(m.timer);
    if (m.pad) m.pad.stop(fade);
    for (const l of m.layers) { fadeLayer(l, 0, fade); killLayer(l, fade); }
    m.layers = [];
  }
  function spawnLayer(m, fadeIn, onError) {
    const el = new Audio();
    el.preload = 'auto';
    const layer = { el, gain: kit.gain(bus.music, 0) };
    try { ac.createMediaElementSource(el).connect(layer.gain); } catch {}
    fadeLayer(layer, 1, fadeIn);
    if (onError) el.addEventListener('error', onError, { once: true });
    el.src = `${base}assets/music/${m.id}.mp3`;
    el.play().catch(() => {});
    m.layers.push(layer);
    return layer;
  }
  function startMusic(id, fade) {
    const m = { id, layers: [], pad: null, timer: 0, stopped: false };
    if (!MUSIC_IDS.includes(id)) { m.pad = startPad(kit, bus.music, id); return m; }
    const first = spawnLayer(m, fade, () => {
      if (m.stopped) return;
      clearInterval(m.timer);
      for (const l of m.layers) killLayer(l, 0);
      m.layers = [];
      m.pad = startPad(kit, bus.music, id);
    });
    if (ONE_SHOT_MUSIC.has(id)) return m;
    first.el.loop = false;
    m.timer = setInterval(() => {
      const cur = m.layers[m.layers.length - 1];
      if (!cur || m.stopped) return;
      const d = cur.el.duration;
      if (!isFinite(d) || d < LOOP_XFADE * 3 || cur.looping) return;
      if (cur.el.currentTime >= d - LOOP_XFADE - 0.2) {
        cur.looping = true;
        spawnLayer(m, 0.4);
        fadeLayer(cur, 0, LOOP_XFADE);
        killLayer(cur, LOOP_XFADE + 0.5);
        setTimeout(() => { m.layers = m.layers.filter(l => l !== cur); }, (LOOP_XFADE + 0.6) * 1000);
      }
    }, 200);
    return m;
  }

  // ---- ambience
  function startAmb(id) {
    const def = AMB[id];
    if (!def) return null;
    const spec = def(kit);
    const out = kit.gain(bus.amb, 0);
    const t0 = ac.currentTime;
    out.gain.setValueAtTime(0, t0); out.gain.linearRampToValueAtTime(1, t0 + 2.5);
    const nodes = [];
    for (const b of spec.beds) nodes.push(...bedNoise(kit, out, ...b));
    const evOut = kit.gain(out, 1);
    // the reverb send gets the same fade as `out` and passes the ambience volume (bus.verbAmb)
    const verbOut = kit.gain(bus.verbAmb, 0);
    verbOut.gain.setValueAtTime(0, t0); verbOut.gain.linearRampToValueAtTime(0.5, t0 + 2.5);
    evOut.connect(verbOut);
    const nexts = spec.events.map(([a, b]) => ac.currentTime + rnd(a, b));
    const timer = setInterval(() => {
      const horizon = ac.currentTime + 0.4;
      spec.events.forEach(([a, b, fn], i) => {
        while (nexts[i] < horizon) { if (nexts[i] > ac.currentTime) fn(kit, evOut, nexts[i]); nexts[i] += rnd(a, b); }
      });
    }, 150);
    return {
      id,
      stop(fade = 2) {
        clearInterval(timer);
        const t = ac.currentTime;
        for (const g of [out, verbOut]) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + fade); }
        setTimeout(() => { for (const n of nodes) { try { n.stop(); } catch {} } out.disconnect(); verbOut.disconnect(); }, fade * 1000 + 200);
      },
    };
  }

  // ---- voice
  async function loadVoice(id) {
    if (voiceCache.has(id)) return voiceCache.get(id);
    const p = fetch(`${base}assets/voice/${id}.mp3`).then(r => (r.ok ? r.arrayBuffer() : null)).then(b => (b ? ac.decodeAudioData(b) : null)).catch(() => null);
    voiceCache.set(id, p);
    if (voiceCache.size > 24) voiceCache.delete(voiceCache.keys().next().value);
    return p;
  }

  const api = {
    unlock() {
      if (!ensure()) return;
      if (ac.state !== 'running') ac.resume().catch(() => {});
      try { const s = ac.createBufferSource(); s.buffer = ac.createBuffer(1, 1, ac.sampleRate); s.connect(ac.destination); s.start(); } catch {}
      if (pendingMusic !== undefined) { const p = pendingMusic; pendingMusic = undefined; api.music(p.id, { fade: p.fade }); }
      if (pendingAmb !== undefined) { const p = pendingAmb; pendingAmb = undefined; api.ambience(p); }
    },

    music(id, { fade = 1.5 } = {}) {
      if (silentMode()) return;
      if (!ac) { pendingMusic = { id, fade }; return; }
      if ((curMusic && curMusic.id) === (id || null) || (!curMusic && !id)) return;
      stopMusic(curMusic, fade);
      curMusic = id ? startMusic(id, fade) : null;
    },

    ambience(id) {
      if (silentMode()) return;
      if (!ac) { pendingAmb = id; return; }
      if ((curAmb && curAmb.id) === id) return;
      if (curAmb) curAmb.stop(2);
      curAmb = id ? startAmb(id) : null;
    },

    sfx(name, opts = {}) {
      if (silentMode() || !running()) return;
      try { playSfx(kit, bus.sfx, bus.verbIn, name, opts, ac.currentTime + 0.005); } catch {}
    },

    chime(index, opts = {}) {
      if (silentMode() || !running()) return;
      try { playChime(kit, bus.sfx, bus.verbIn, index, opts, ac.currentTime + 0.005); } catch {}
    },

    voiceDuration(lineId) {
      return (manifest && +manifest[lineId]) || 0;
    },

    voice(lineId) {
      return new Promise(resolve => {
        (async () => {
          try {
            if (silentMode() || !lineId) return resolve();
            // register the line before any await, so stopVoice() during the manifest load cancels it
            api.stopVoice();
            const token = { resolve, src: null, done: false };
            voiceCur = token;
            await manifestReady;
            if (token.done) return;
            if (voiceCur !== token || !manifest || !manifest[lineId] || !running() || vol.voice <= 0) { if (voiceCur === token) voiceCur = null; token.done = true; return resolve(); }
            const buf = await loadVoice(lineId);
            if (token.done) return;
            if (!buf || voiceCur !== token) { token.done = true; return resolve(); }
            const src = ac.createBufferSource();
            src.buffer = buf; src.connect(bus.voice);
            token.src = src;
            const finish = () => {
              if (token.done) return;
              token.done = true; clearTimeout(token.timer);
              if (voiceCur === token) { voiceCur = null; duck(false); }
              resolve();
            };
            token.finish = finish;
            src.onended = finish;
            token.timer = setTimeout(finish, (buf.duration + 2) * 1000);
            duck(true);
            src.start(ac.currentTime + 0.02);
          } catch { resolve(); }
        })();
      });
    },

    stopVoice() {
      const v = voiceCur;
      if (!v) return;
      voiceCur = null;
      if (v.src) { try { v.src.onended = null; v.src.stop(); } catch {} }
      if (!v.done) { v.done = true; clearTimeout(v.timer); duck(false); v.resolve(); }
    },

    setVolume(v = {}) {
      for (const k of ['master', 'music', 'sfx', 'voice']) if (typeof v[k] === 'number') vol[k] = Math.max(0, Math.min(1, v[k]));
      applyVolumes();
      if (vol.voice <= 0) api.stopVoice();
    },
    getVolume() { return { ...vol }; },
  };
  return api;
}

export default createAudio;
