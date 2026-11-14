// Seeded RNG (mulberry32). Everything random in the game goes through ctx.rng so ?seed= replays a run.
// rng.int(a,b) inclusive, rng.pick(arr), rng.chance(p), rng.d(sides), rng.float(), rng.shuffle(arr),
// rng.roll('2d6+1') -> { total, dice:[..], mod }, rng.fork(salt) -> independent child rng.
function hashSeed(s) {
  let h = 2166136261 >>> 0;
  const str = String(s);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function createRng(seed = Date.now()) {
  let a = (typeof seed === 'number' ? seed : hashSeed(seed)) >>> 0;
  if (a === 0) a = 0x9e3779b9;
  const float = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo, hi) => lo + Math.floor(float() * (hi - lo + 1));
  const rng = {
    seed,
    float,
    int,
    d: (sides) => int(1, sides),
    chance: (p) => float() < p,
    pick: (arr) => (arr && arr.length ? arr[int(0, arr.length - 1)] : undefined),
    shuffle(arr) {
      const out = [...arr];
      for (let i = out.length - 1; i > 0; i--) { const j = int(0, i); [out[i], out[j]] = [out[j], out[i]]; }
      return out;
    },
    roll(expr) {
      const m = /^\s*(\d*)d(\d+)\s*([+-]\s*\d+)?\s*$/i.exec(String(expr));
      if (!m) { const n = parseInt(expr, 10) || 0; return { total: n, dice: [], mod: n, sides: 0 }; }
      const count = parseInt(m[1] || '1', 10), sides = parseInt(m[2], 10);
      const mod = m[3] ? parseInt(m[3].replace(/\s/g, ''), 10) : 0;
      const dice = Array.from({ length: count }, () => int(1, sides));
      return { total: dice.reduce((s, x) => s + x, 0) + mod, dice, mod, sides };
    },
    fork(salt = 'fork') { return createRng(hashSeed(String(seed) + ':' + salt + ':' + int(0, 1e9))); },
    getState: () => a,
    setState: (s) => { a = s >>> 0; },
  };
  return rng;
}
