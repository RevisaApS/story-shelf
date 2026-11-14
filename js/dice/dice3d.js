// Lanternfall 3D dice (SPEC section 6). Rules decide the numbers; these dice only show them.
// createDice(hostEl) -> { roll(spec), clear(opts), setQuality(q), dispose() }
// spec as in SPEC 6, plus size: scale factor for the dice (default 1; e.g. 0.7 for small battle dice).
// No physics engine: each die follows a scripted throw (arc, bounces, roll, settle) that ends
// exactly on an orientation chosen so the requested value is on top and reads upright to the viewer.
import * as THREE from '../vendor/three.module.min.js';

const V3 = THREE.Vector3;
const STAGE_W = 1280;
const STAGE_H = 800;
const UP = new V3(0, 1, 0);
const PHI = (1 + Math.sqrt(5)) / 2;
const DEFAULT_TINT = '#1b2a78';
const VALID = [4, 6, 8, 10, 12, 20];
const GREY_T = 0.3;

// World size (circumradius) per die, bevel amount, numeral size (fraction of an atlas cell).
const SIZE = { 4: 1.3, 6: 0.94, 8: 0.94, 10: 0.94, 12: 0.92, 20: 0.96 };
const BEVEL = { 4: 0.13, 6: 0.15, 8: 0.13, 10: 0.11, 12: 0.11, 20: 0.13 };
const FONT = { 4: 0.27, 6: 0.5, 8: 0.36, 10: 0.3, 12: 0.4, 20: 0.33 };
const FILL = 0.96;
const NUM_FONT = '"Palatino Linotype", Palatino, "Book Antiqua", "Noto Serif", "Times New Roman", serif';

const rand = (a, b) => a + Math.random() * (b - a);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (k) => 1 - (1 - k) * (1 - k);
const qAxis = (axis, ang) => new THREE.Quaternion().setFromAxisAngle(axis, ang);

function speedNow() {
  const s = Number(typeof window !== 'undefined' ? window.__LF_SPEED : 1);
  return s > 0 ? s : 1;
}

// ---------- shapes ----------

function shapePoints(sides) {
  const p = [];
  const g = 1 / PHI;
  const pm = [1, -1];
  if (sides === 4) p.push([1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]);
  else if (sides === 6) { for (const x of pm) for (const y of pm) for (const z of pm) p.push([x, y, z]); }
  else if (sides === 8) p.push([1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]);
  else if (sides === 12) {
    for (const x of pm) for (const y of pm) for (const z of pm) p.push([x, y, z]);
    for (const a of pm) for (const b of pm) p.push([0, a * g, b * PHI], [a * g, b * PHI, 0], [a * PHI, 0, b * g]);
  } else if (sides === 20) {
    for (const a of pm) for (const b of pm) p.push([0, a, b * PHI], [a, b * PHI, 0], [a * PHI, 0, b]);
  } else if (sides === 10) {
    // Pentagonal trapezohedron: apexes at +-1, ring of 10 at +-e; e makes the kites planar.
    const c36 = Math.cos(Math.PI / 5);
    const e = (1 - c36) / (1 + c36);
    p.push([0, 1, 0], [0, -1, 0]);
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5;
      p.push([Math.cos(a), i % 2 ? -e : e, Math.sin(a)]);
    }
  }
  const pts = p.map((a) => new V3(a[0], a[1], a[2]));
  let m = 0;
  for (const v of pts) m = Math.max(m, v.length());
  for (const v of pts) v.multiplyScalar(1 / m);
  return pts;
}

// Faces of a convex point set (origin inside): brute-force supporting planes.
function hullFaces(pts) {
  const faces = [];
  const eps = 1e-5;
  const n = pts.length;
  const a = new V3();
  const b = new V3();
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
    const nrm = a.subVectors(pts[j], pts[i]).clone().cross(b.subVectors(pts[k], pts[i]));
    if (nrm.lengthSq() < 1e-10) continue;
    nrm.normalize();
    let d = nrm.dot(pts[i]);
    if (d < 0) { nrm.negate(); d = -d; }
    let ok = true;
    for (const p of pts) if (nrm.dot(p) - d > eps) { ok = false; break; }
    if (!ok || faces.some((f) => f.n.dot(nrm) > 1 - 1e-6)) continue;
    const idx = [];
    pts.forEach((p, ii) => { if (Math.abs(nrm.dot(p) - d) < eps) idx.push(ii); });
    faces.push({ n: nrm, d, idx });
  }
  for (const f of faces) {
    const c = new V3();
    for (const i of f.idx) c.add(pts[i]);
    c.multiplyScalar(1 / f.idx.length);
    const e1 = pts[f.idx[0]].clone().sub(c).normalize();
    const e2 = f.n.clone().cross(e1);
    const ang = (i) => { const v = pts[i].clone().sub(c); return Math.atan2(v.dot(e2), v.dot(e1)); };
    f.idx.sort((x, y) => ang(x) - ang(y));
    f.c = c;
  }
  return faces;
}

// ---------- canvas textures ----------

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function drawLabel(g, lab, cx, cy, px, mode) {
  g.save();
  g.translate(cx + lab.x, cy + lab.y);
  g.rotate(lab.rot);
  g.font = `700 ${px}px ${NUM_FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  const yOff = px * 0.04;
  const under = lab.text === '6' || lab.text === '9';
  const uw = px * 0.46;
  const uh = px * 0.075;
  const uy = px * 0.47;
  const groove = (style, w) => {
    g.strokeStyle = style; g.lineWidth = w;
    g.strokeText(lab.text, 0, yOff);
    if (under) g.strokeRect(-uw / 2, uy, uw, uh);
  };
  const fill = (style) => {
    g.fillStyle = style;
    g.fillText(lab.text, 0, yOff);
    if (under) g.fillRect(-uw / 2, uy, uw, uh);
  };
  if (mode === 'color') {
    groove('rgba(4,6,18,0.92)', px * 0.15);
    const gr = g.createLinearGradient(0, -px * 0.45, 0, px * 0.5);
    gr.addColorStop(0, '#fff3c0');
    gr.addColorStop(0.3, '#ffd466');
    gr.addColorStop(0.7, '#d79a2c');
    gr.addColorStop(1, '#f7d27a');
    fill(gr);
    g.strokeStyle = 'rgba(255,248,214,0.55)';
    g.lineWidth = Math.max(1, px * 0.018);
    g.strokeText(lab.text, 0, yOff);
  } else {
    // surface map: R = height (bump), G = roughness, B = metalness
    groove('rgb(0,215,0)', px * 0.15);
    fill('rgb(70,70,255)');
  }
  g.restore();
}

// A stat tint becomes a deep jewel enamel (dark, saturated body; the gold numerals stay the same),
// so a pale stat colour such as agility mint reads as emerald, not as a washed-out pastel.
const SRGB = THREE.SRGBColorSpace;
function jewel(tint) {
  const c = new THREE.Color(tint);
  const hsl = {};
  c.getHSL(hsl, SRGB);
  if (hsl.l <= 0.3) return c; // already deep (the default sapphire)
  return new THREE.Color().setHSL(hsl.h, Math.min(0.95, hsl.s + 0.15), 0.22, SRGB);
}

function drawAtlas(kit, C, tint, mode) {
  const W = kit.cols * C;
  const H = kit.rows * C;
  const cv = makeCanvas(W, H);
  const g = cv.getContext('2d');
  const base = jewel(tint);
  const css = (col) => `#${col.getHexString()}`;
  if (mode === 'color') {
    g.fillStyle = css(base);
    g.fillRect(0, 0, W, H);
  } else {
    g.fillStyle = 'rgb(255,105,0)';
    g.fillRect(0, 0, W, H);
    g.filter = `blur(${Math.max(0.6, C / 200)}px)`;
  }
  // glowing core: the same hue, lifted (not whitened); rim: near black
  const bh = {};
  base.getHSL(bh, SRGB);
  const light = new THREE.Color().setHSL(bh.h, Math.min(1, bh.s * 1.05), Math.min(0.5, bh.l + 0.12), SRGB);
  const deep = base.clone().lerp(new THREE.Color('#000000'), 0.45);
  const rnd = seeded(kit.sides * 97 + 13);
  kit.faces.forEach((f, i) => {
    const x0 = (i % kit.cols) * C;
    const y0 = Math.floor(i / kit.cols) * C;
    const cx = x0 + C / 2;
    const cy = y0 + C / 2;
    if (mode === 'color') {
      // deep enamel: glowing core, darker rim, a few mica flecks
      const gr = g.createRadialGradient(cx - C * 0.08, cy - C * 0.1, C * 0.02, cx, cy, C * 0.55);
      gr.addColorStop(0, css(light));
      gr.addColorStop(0.55, css(base));
      gr.addColorStop(1, css(deep));
      g.fillStyle = gr;
      g.fillRect(x0, y0, C, C);
      for (let k = 0; k < 26; k++) {
        const r = C * rand(0.004, 0.012);
        g.fillStyle = `rgba(200,220,255,${(0.08 + rnd() * 0.18).toFixed(3)})`;
        g.beginPath();
        g.arc(x0 + rnd() * C, y0 + rnd() * C, r, 0, Math.PI * 2);
        g.fill();
      }
    }
    const px = C * FONT[kit.sides];
    for (const lab of f.labels) drawLabel(g, lab, cx, cy, px * (lab.text.length > 1 && kit.sides === 10 ? 0.92 : 1), mode);
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = mode === 'color' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function radialTex(size, stops) {
  const cv = makeCanvas(size, size);
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function fxTextures() {
  const glow = radialTex(128, [[0, 'rgba(255,255,255,1)'], [0.22, 'rgba(255,255,255,0.45)'], [0.6, 'rgba(255,255,255,0.08)'], [1, 'rgba(255,255,255,0)']]);
  const spark = radialTex(64, [[0, 'rgba(255,255,255,1)'], [0.18, 'rgba(255,255,255,0.9)'], [0.45, 'rgba(255,255,255,0.18)'], [1, 'rgba(255,255,255,0)']]);
  const blob = radialTex(128, [[0, 'rgba(0,0,0,0.78)'], [0.35, 'rgba(0,0,0,0.5)'], [0.7, 'rgba(0,0,0,0.14)'], [1, 'rgba(0,0,0,0)']]);
  // light rays
  const S = 256;
  const rc = makeCanvas(S, S);
  const rg = rc.getContext('2d');
  rg.globalCompositeOperation = 'lighter';
  const rr = seeded(7);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rr() * 0.2;
    const w = 0.05 + rr() * 0.09;
    const len = S * (0.36 + rr() * 0.14);
    const gr = rg.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, len);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    rg.fillStyle = gr;
    rg.beginPath();
    rg.moveTo(S / 2, S / 2);
    rg.lineTo(S / 2 + Math.cos(a - w) * len, S / 2 + Math.sin(a - w) * len);
    rg.lineTo(S / 2 + Math.cos(a + w) * len, S / 2 + Math.sin(a + w) * len);
    rg.closePath();
    rg.fill();
  }
  const rays = new THREE.CanvasTexture(rc);
  rays.colorSpace = THREE.SRGBColorSpace;
  // shock ring
  const ring = makeCanvas(S, S);
  const ng = ring.getContext('2d');
  const ngr = ng.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S / 2);
  ngr.addColorStop(0, 'rgba(255,255,255,0)');
  ngr.addColorStop(0.55, 'rgba(255,255,255,0.9)');
  ngr.addColorStop(0.75, 'rgba(255,255,255,0.25)');
  ngr.addColorStop(1, 'rgba(255,255,255,0)');
  ng.fillStyle = ngr;
  ng.fillRect(0, 0, S, S);
  const ringT = new THREE.CanvasTexture(ring);
  ringT.colorSpace = THREE.SRGBColorSpace;
  // smoke puff
  const sc = makeCanvas(128, 128);
  const sg = sc.getContext('2d');
  const sr = seeded(3);
  for (let i = 0; i < 9; i++) {
    const x = 64 + (sr() - 0.5) * 44;
    const y = 64 + (sr() - 0.5) * 44;
    const r = 22 + sr() * 22;
    const gr = sg.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.4)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    sg.fillStyle = gr;
    sg.fillRect(0, 0, 128, 128);
  }
  const smoke = new THREE.CanvasTexture(sc);
  smoke.colorSpace = THREE.SRGBColorSpace;
  return { glow, spark, blob, rays, ring: ringT, smoke };
}

// ---------- kits (geometry + numbering per die type) ----------

function buildKit(sides, C) {
  const unit = shapePoints(sides);
  const scale = SIZE[sides];
  const pts = unit.map((p) => p.clone().multiplyScalar(scale));
  const faces = hullFaces(pts);
  const kit = { sides, pts, faces, Rc: scale };

  // numbering: opposite faces sum to sides + 1 (d4 numbers its vertices instead)
  if (sides === 4) {
    pts.forEach((p, i) => { p.userData = i + 1; });
    kit.vertValue = [1, 2, 3, 4];
  } else {
    // greedy spread: each new pair (k, sides+1-k) goes as far as possible from faces holding nearby numbers
    const oppOf = (f) => faces.find((g) => g !== f && g.n.dot(f.n) < -0.999);
    for (let k = 1; k <= sides / 2; k++) {
      let best = null; let bestScore = -Infinity;
      for (const f of faces) {
        if (f.value) continue;
        const o = oppOf(f);
        let score = Math.PI;
        for (const g of faces) {
          if (!g.value) continue;
          for (const [h, v] of [[f, k], [o, sides + 1 - k]]) {
            if (Math.abs(g.value - v) <= 2) score = Math.min(score, Math.acos(Math.max(-1, Math.min(1, h.n.dot(g.n)))));
          }
        }
        if (score > bestScore + 1e-6) { bestScore = score; best = f; }
      }
      best.value = k;
      oppOf(best).value = sides + 1 - k;
    }
  }

  // reading frame per face
  for (const f of faces) {
    const vs = f.idx.map((i) => pts[i]);
    let target;
    if (sides === 6) target = vs[0].clone().add(vs[1]).multiplyScalar(0.5);
    else if (sides === 10) target = vs.reduce((m, v) => (Math.abs(v.y) > Math.abs(m.y) ? v : m), vs[0]);
    else target = vs[0];
    const up = target.clone().sub(f.c);
    up.addScaledVector(f.n, -up.dot(f.n)).normalize();
    f.up = up;
    f.right = up.clone().cross(f.n).normalize();
    f.R = Math.max(...vs.map((v) => v.distanceTo(f.c)));
  }

  kit.cols = Math.ceil(Math.sqrt(faces.length));
  kit.rows = Math.ceil(faces.length / kit.cols);
  kit.C = C;
  const W = kit.cols * C;
  const H = kit.rows * C;
  const cellPx = (f, i, p) => {
    const d = p.clone().sub(f.c);
    const s = d.dot(f.right) / f.R;
    const t = d.dot(f.up) / f.R;
    return [((i % kit.cols) + 0.5 + 0.5 * s * FILL) * C, (Math.floor(i / kit.cols) + 0.5 - 0.5 * t * FILL) * C];
  };
  const uvOf = (f, i, p) => { const [x, y] = cellPx(f, i, p); return [x / W, 1 - y / H]; };

  // labels in cell pixels (relative to cell centre)
  faces.forEach((f, i) => {
    const [ccx, ccy] = cellPx(f, i, f.c);
    if (sides === 4) {
      f.labels = f.idx.map((vi) => {
        const pos = f.c.clone().lerp(pts[vi], 0.58);
        const [x, y] = cellPx(f, i, pos);
        const d = pts[vi].clone().sub(f.c);
        const s = d.dot(f.right);
        const t = d.dot(f.up);
        return { text: String(vi + 1), x: x - ccx, y: y - ccy, rot: Math.atan2(s, t) };
      });
    } else {
      let pos = f.c;
      if (sides === 10) pos = f.c.clone().addScaledVector(f.up, -0.12 * f.R);
      const [x, y] = cellPx(f, i, pos);
      f.labels = [{ text: String(f.value), x: x - ccx, y: y - ccy, rot: 0 }];
    }
  });

  // rest height, mid radius (centre to an edge), tilt that balances on an edge
  const f0 = faces[0];
  kit.rest = f0.d;
  const e0 = pts[f0.idx[0]].clone().add(pts[f0.idx[1]]).multiplyScalar(0.5);
  kit.mid = e0.length();
  kit.edgeTilt = Math.acos(Math.min(1, kit.rest / kit.mid));

  // geometry: inset faces (numbered), bevel quads along edges, corner caps; smooth bevel normals
  const bevel = BEVEL[sides];
  const inset = faces.map((f) => {
    const m = new Map();
    for (const vi of f.idx) m.set(vi, f.c.clone().add(pts[vi].clone().sub(f.c).multiplyScalar(1 - bevel)));
    return m;
  });
  const faceTris = [];
  const bevelTris = [];
  const ab = new V3();
  const ac = new V3();
  function tri(list, a, b, c, na, nb, nc, ua, ub, uc) {
    ab.subVectors(b, a); ac.subVectors(c, a);
    const cr = ab.clone().cross(ac);
    if (cr.lengthSq() < 1e-14) return;
    const cen = a.clone().add(b).add(c);
    if (cr.dot(cen) < 0) { [b, c] = [c, b]; [nb, nc] = [nc, nb]; [ub, uc] = [uc, ub]; }
    list.push([a, b, c, na, nb, nc, ua, ub, uc]);
  }
  const Z = [0, 0];
  faces.forEach((f, fi) => {
    const P = f.idx.map((vi) => inset[fi].get(vi));
    for (let k = 1; k < P.length - 1; k++) {
      tri(faceTris, P[0], P[k], P[k + 1], f.n, f.n, f.n, uvOf(f, fi, P[0]), uvOf(f, fi, P[k]), uvOf(f, fi, P[k + 1]));
    }
  });
  const edgeFace = new Map();
  faces.forEach((f, fi) => f.idx.forEach((a, k) => edgeFace.set(`${a}_${f.idx[(k + 1) % f.idx.length]}`, fi)));
  faces.forEach((f, fi) => f.idx.forEach((a, k) => {
    const b = f.idx[(k + 1) % f.idx.length];
    const gi = edgeFace.get(`${b}_${a}`);
    if (gi === undefined || gi < fi) return;
    const g = faces[gi];
    const pa = inset[fi].get(a); const pb = inset[fi].get(b);
    const qa = inset[gi].get(a); const qb = inset[gi].get(b);
    tri(bevelTris, pa, pb, qb, f.n, f.n, g.n, Z, Z, Z);
    tri(bevelTris, pa, qb, qa, f.n, g.n, g.n, Z, Z, Z);
  }));
  pts.forEach((v, vi) => {
    const around = faces.map((f, fi) => ({ f, fi })).filter((o) => o.f.idx.includes(vi));
    if (around.length < 3) return;
    const axis = v.clone().normalize();
    const e1 = around[0].f.n.clone().addScaledVector(axis, -around[0].f.n.dot(axis)).normalize();
    const e2 = axis.clone().cross(e1);
    around.sort((x, y) => Math.atan2(x.f.n.dot(e2), x.f.n.dot(e1)) - Math.atan2(y.f.n.dot(e2), y.f.n.dot(e1)));
    const P = around.map((o) => inset[o.fi].get(vi));
    for (let k = 1; k < P.length - 1; k++) {
      tri(bevelTris, P[0], P[k], P[k + 1], around[0].f.n, around[k].f.n, around[k + 1].f.n, Z, Z, Z);
    }
  });
  const all = faceTris.concat(bevelTris);
  const pos = new Float32Array(all.length * 9);
  const nor = new Float32Array(all.length * 9);
  const uv = new Float32Array(all.length * 6);
  all.forEach((t, i) => {
    for (let k = 0; k < 3; k++) {
      pos.set([t[k].x, t[k].y, t[k].z], i * 9 + k * 3);
      nor.set([t[3 + k].x, t[3 + k].y, t[3 + k].z], i * 9 + k * 3);
      uv.set(t[6 + k], i * 6 + k * 2);
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.addGroup(0, faceTris.length * 3, 0);
  geo.addGroup(faceTris.length * 3, bevelTris.length * 3, 1);
  geo.computeBoundingSphere();
  kit.geo = geo;
  kit.surface = drawAtlas(kit, C, DEFAULT_TINT, 'surface');
  kit.atlases = new Map();
  return kit;
}

function topValue(kit, quat) {
  if (kit.sides === 4) {
    let best = -Infinity; let val = 0;
    kit.pts.forEach((p, i) => { const y = p.clone().applyQuaternion(quat).y; if (y > best) { best = y; val = i + 1; } });
    return val;
  }
  let best = -Infinity; let val = 0;
  for (const f of kit.faces) { const y = f.n.clone().applyQuaternion(quat).y; if (y > best) { best = y; val = f.value; } }
  return val;
}

function addGrey(mat) {
  const u = { value: 0 };
  mat.userData.grey = u;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uGrey = u;
    sh.fragmentShader = 'uniform float uGrey;\n' + sh.fragmentShader.replace(
      '#include <map_fragment>',
      '#include <map_fragment>\n  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114))) * 0.8, uGrey);',
    );
  };
  mat.customProgramCacheKey = () => 'lf-grey';
}

// ---------- the service ----------

export async function createDice(hostEl) {
  if (!hostEl) throw new Error('dice: no host element');
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
  if (!gl) throw new Error('dice: WebGL2 unavailable');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, context: gl, alpha: true, antialias: true });
  } catch (e) {
    throw new Error(`dice: WebGL unavailable (${e && e.message})`);
  }
  Object.assign(canvas.style, { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', pointerEvents: 'none', display: 'block' });
  if (getComputedStyle(hostEl).position === 'static') hostEl.style.position = 'relative';
  hostEl.appendChild(canvas);

  let quality = 'high';
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, STAGE_W / STAGE_H, 0.5, 80);
  const camBase = new V3(0, 14.6, 5.4);
  const camLook = new V3(0, 0, 0.9);
  camera.position.copy(camBase);
  camera.lookAt(camLook);
  camera.updateMatrixWorld();

  // environment for reflections: dark room, warm softbox, cool strip
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.SphereGeometry(20, 24, 12), new THREE.MeshBasicMaterial({ color: 0x0b0d16, side: THREE.BackSide }));
  env.add(room);
  const panel = (w, h, col, k, x, y, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
  };
  panel(12, 8, '#ffd7a0', 3.2, -8, 12, 8);
  panel(18, 2.2, '#8fb8ff', 2.4, 9, 5, -10);
  panel(6, 6, '#ffb070', 1.4, 6, 9, 9);
  panel(30, 10, '#3a2a1e', 0.6, 0, -9, 0);
  const envTex = pmrem.fromScene(env, 0.035).texture;
  env.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  pmrem.dispose();
  scene.environment = envTex;

  scene.add(new THREE.HemisphereLight(0x9fb4e8, 0x2a1a10, 0.45));
  const key = new THREE.DirectionalLight(0xffd6a0, 2.8);
  key.position.set(-5, 11, 6);
  key.target.position.set(0, 0, 1.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -7, right: 7, top: 6, bottom: -6, near: 2, far: 30 });
  key.shadow.bias = -0.0008;
  key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x86b4ff, 2.6);
  rim.position.set(4.5, 4, -9);
  scene.add(rim);
  const goldLight = new THREE.PointLight(0xffc25a, 0, 7, 1.6);
  scene.add(goldLight);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.3 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const tex = fxTextures();
  const blobGeo = new THREE.PlaneGeometry(1, 1);
  const kits = {};
  const cellPx = () => (quality === 'high' ? 192 : 128);
  const getKit = (s) => kits[s] || (kits[s] = buildKit(s, cellPx()));
  const getAtlas = (kit, tint) => {
    let t = kit.atlases.get(tint);
    if (!t) { t = drawAtlas(kit, kit.C, tint, 'color'); kit.atlases.set(tint, t); }
    return t;
  };

  const ray = new THREE.Raycaster();
  function stageToWorld(x, y, h) {
    ray.setFromCamera(new THREE.Vector2((x / STAGE_W) * 2 - 1, -((y / STAGE_H) * 2 - 1)), camera);
    const out = new V3();
    if (!ray.ray.intersectPlane(new THREE.Plane(UP, -h), out)) out.set(0, h, 0);
    return out;
  }

  // ----- sizing -----
  let disposed = false;
  function resize() {
    if (disposed) return;
    const r = hostEl.getBoundingClientRect();
    const w = r.width || STAGE_W;
    const h = r.height || STAGE_H;
    const cap = quality === 'high' ? 2 : 1.25;
    const dpr = Math.min(cap, window.devicePixelRatio || 1);
    renderer.setPixelRatio(1);
    renderer.setSize(Math.max(1, Math.round(w * dpr)), Math.max(1, Math.round(h * dpr)), false);
    camera.aspect = w / h || STAGE_W / STAGE_H;
    camera.updateProjectionMatrix();
    if (!raf) renderer.render(scene, camera);
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
  if (ro) ro.observe(hostEl);
  const onWin = () => { resize(); requestAnimationFrame(resize); };
  window.addEventListener('resize', onWin);

  // ----- state -----
  let dice = [];
  let fx = [];
  let T = 0;
  let busyUntil = 0;
  let raf = 0;
  let last = 0;
  let shake = 0;
  let pending = null; // { resolve, t0, tAll, timer }
  let clearing = null; // { t0, dur, dice, resolve }

  function makeDie(d, i, n, spec, crit) {
    const sides = VALID.includes(d.sides) ? d.sides : 20;
    const value = Math.min(sides, Math.max(1, Math.round(Number(d.value) || 1)));
    const kit = getKit(sides);
    const tint = d.tint || DEFAULT_TINT;
    const atlas = getAtlas(kit, tint);
    const high = quality === 'high';
    const Mat = high ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
    const coat = high ? { clearcoat: 0.85, clearcoatRoughness: 0.16 } : {};
    const faceMat = new Mat({
      map: atlas, emissiveMap: atlas, emissive: new THREE.Color('#ffc861'), emissiveIntensity: 0.26,
      roughnessMap: kit.surface, metalnessMap: kit.surface, bumpMap: kit.surface, bumpScale: 2.2,
      roughness: 1, metalness: 1, envMapIntensity: 1.1, ...coat,
    });
    const bevelMat = new Mat({ color: jewel(tint), roughness: 0.4, metalness: 0, emissive: new THREE.Color('#ffc861'), emissiveIntensity: 0, envMapIntensity: 1.1, ...coat });
    addGrey(faceMat); addGrey(bevelMat);
    const mesh = new THREE.Mesh(kit.geo, [faceMat, bevelMat]);
    mesh.castShadow = high;
    const blob = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ map: tex.blob, transparent: true, depthWrite: false, opacity: 0.8 }));
    blob.rotation.x = -Math.PI / 2;
    blob.renderOrder = 1;
    scene.add(mesh, blob);
    const size = Math.min(2, Math.max(0.3, Number(spec.size) || 1));
    const die = { sides, value, kit, mesh, blob, faceMat, bevelMat, dropped: !!d.dropped, crit: crit || null, t0: T, done: false, scale: 1, size };
    planDie(die, i, n, spec);
    return die;
  }

  function planDie(die, i, n, spec) {
    // autoplay at high speed uses the short battle throw so a roll resolves in a few frames
    const fast = !!spec.fast || speedNow() >= 8;
    const fail = die.crit === 'fail';
    const from = spec.from && Number.isFinite(spec.from.x) ? spec.from : { x: STAGE_W / 2, y: STAGE_H + 70 };
    const lane = i - (n - 1) / 2;
    const gap = (n > 2 ? 176 : 205) * die.size;
    const land = { x: STAGE_W / 2 + lane * gap + rand(-14, 14), y: 552 + rand(-14, 14) - Math.abs(lane) * (n > 2 ? 10 : 0) };
    const P = {};
    P.L = stageToWorld(land.x, land.y, 0);
    P.h0 = fast ? 1.8 : 2.3;
    P.S = stageToWorld(from.x + lane * 150, from.y, P.h0);
    const g = fast ? 50 : 30;
    let hs = fast ? [0.42, 0.1] : [1.05, 0.42, 0.13];
    if (fail) hs = hs.slice(0, hs.length - 1);
    P.bounces = hs.map((h0) => { const h = h0 * rand(0.88, 1.1); return { h, d: 2 * Math.sqrt((2 * h) / g) }; });
    P.tf = (fast ? 0.19 : 0.46) * rand(0.94, 1.06);
    P.arc = fast ? 0.5 : 1.3;
    P.delay = i * (fast ? 0.025 : 0.06);
    P.tStop = P.tf + P.bounces.reduce((s, b) => s + b.d, 0) + (fast ? 0.03 : 0.12);
    P.rockDur = fast ? 0.08 : 0.34;
    P.rockAmp = fast ? 0.05 : 0.09;
    P.rockAx = new V3(rand(-1, 1), 0, rand(-1, 1)).normalize();
    P.impacts = [];
    let ti = P.tf;
    P.impacts.push(ti);
    for (let k = 0; k < P.bounces.length - 1; k++) { ti += P.bounces[k].d; P.impacts.push(ti); }
    P.nextImpact = 0;
    const dir = new V3().subVectors(P.L, P.S); dir.y = 0;
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    dir.normalize();
    P.ax1 = UP.clone().cross(dir).normalize();
    P.ax2 = new V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
    P.th1 = fast ? rand(2.6, 3.4) * Math.PI : rand(4.4, 6) * Math.PI;
    P.th2 = rand(0.6, 1.4) * Math.PI * (fast ? 0.6 : 1);

    // final orientation: value up, numeral upright towards the camera
    const kit = die.kit;
    let nLoc; let tcLoc;
    if (kit.sides === 4) {
      const vi = die.value - 1;
      nLoc = kit.pts[vi].clone().normalize();
      const adj = kit.faces.filter((f) => f.idx.includes(vi));
      tcLoc = adj[Math.floor(Math.random() * adj.length)].n.clone();
    } else {
      const f = kit.faces.find((x) => x.value === die.value);
      nLoc = f.n.clone();
      tcLoc = f.up.clone().negate();
    }
    const q1 = new THREE.Quaternion().setFromUnitVectors(nLoc, UP);
    const tcW = tcLoc.applyQuaternion(q1); tcW.y = 0; tcW.normalize();
    const toCam = new V3(camBase.x - P.L.x, 0, camBase.z - P.L.z).normalize();
    const yaw = Math.atan2(tcW.z, tcW.x) - Math.atan2(toCam.z, toCam.x) + rand(-0.2, 0.2);
    P.qFinal = qAxis(UP, yaw).multiply(q1);

    // natural 1: comes to rest balanced on an edge, teeters, then flops onto the value
    P.tilt0 = 0;
    P.endT = P.tStop + P.rockDur;
    if (fail) {
      let bottom = kit.faces[0];
      const nTop = nLoc;
      for (const f of kit.faces) if (f.n.dot(nTop) < bottom.n.dot(nTop)) bottom = f;
      let best = null; let bestDot = -1;
      bottom.idx.forEach((a, k) => {
        const b = bottom.idx[(k + 1) % bottom.idx.length];
        const e = kit.pts[b].clone().sub(kit.pts[a]).applyQuaternion(P.qFinal); e.y = 0; e.normalize();
        const dd = Math.abs(e.dot(toCam));
        if (dd > bestDot) { bestDot = dd; best = e; }
      });
      P.tiltAx = (best || new V3(0, 0, 1)).multiplyScalar(Math.random() < 0.5 ? 1 : -1);
      P.beta = kit.edgeTilt;
      P.tilt0 = P.beta * 0.7;
      P.teeter = fast ? 0.15 : 0.48;
      P.flop = fast ? 0.09 : 0.17;
      P.rebound = fast ? 0.1 : 0.24;
      P.endT = P.tStop + P.teeter + P.flop + P.rebound;
      P.flopped = false;
    }
    die.plan = P;
  }

  function bounceY(P, t) {
    if (t < P.tf) { const u = t / P.tf; return Math.max(0, P.h0 * (1 - u) + P.arc * 4 * u * (1 - u)); }
    let t0 = P.tf;
    for (const b of P.bounces) {
      if (t < t0 + b.d) { const u = (t - t0) / b.d; return 4 * b.h * u * (1 - u); }
      t0 += b.d;
    }
    return 0;
  }

  const tmpQ = new THREE.Quaternion();
  function evalDie(die) {
    const P = die.plan;
    const kit = die.kit;
    const tt = Math.min(T - die.t0 - P.delay, P.endT);
    if (tt < 0) { die.mesh.visible = false; die.blob.visible = false; return; }
    die.mesh.visible = true; die.blob.visible = true;
    const u = Math.min(1, tt / P.tStop);
    const sH = 1 - (1 - u) * (1 - u);
    const sR = 1 - Math.pow(1 - u, 2.6);
    const ph1 = P.th1 * (1 - sR);
    const ph2 = P.th2 * (1 - sR);
    let tilt = P.tilt0;
    let rock = 0;
    if (tt > P.tStop) {
      const tau = tt - P.tStop;
      if (P.tiltAx) {
        if (tau < P.teeter) {
          const w = tau / P.teeter;
          tilt = P.beta * (0.7 + 0.27 * Math.sin(w * Math.PI * 2.5));
        } else if (tau < P.teeter + P.flop) {
          const w = (tau - P.teeter) / P.flop;
          tilt = P.beta * 0.97 * (1 - w * w);
        } else {
          const w = clamp01((tau - P.teeter - P.flop) / P.rebound);
          tilt = P.beta * 0.22 * Math.sin(Math.PI * w) * (1 - w);
          if (!P.flopped) { P.flopped = true; onFlop(die); }
        }
      } else {
        const w = Math.min(tau, P.rockDur);
        rock = P.rockAmp * Math.sin((w / 0.2) * Math.PI * 2) * Math.exp(-w * 9) * (1 - w / P.rockDur);
      }
    }
    // height: bounce + rolling lift + edge tilt
    const mis = ph1 + ph2;
    let h = kit.rest + (kit.Rc - kit.rest) * 0.75 * Math.min(1, mis / 0.7);
    const tl = Math.abs(tilt) + Math.abs(rock);
    if (tl > 0) h = Math.max(h, kit.mid * Math.cos(Math.max(0, kit.edgeTilt - tl)));
    const s = die.scale * die.size;
    const pos = die.mesh.position;
    pos.lerpVectors(P.S, P.L, sH);
    pos.y = bounceY(P, tt) + h * s;
    const q = die.mesh.quaternion;
    q.copy(qAxis(P.ax1, -ph1)).multiply(qAxis(P.ax2, -ph2));
    if (tilt) q.multiply(qAxis(P.tiltAx, tilt));
    if (rock) q.multiply(tmpQ.setFromAxisAngle(P.rockAx, rock));
    q.multiply(P.qFinal);
    if (die.spinOut) q.premultiply(qAxis(UP, die.spinOut));
    die.mesh.scale.setScalar(s);
    // contact shadow
    const air = Math.max(0, pos.y - kit.rest * s);
    const bs = kit.Rc * 2.5 * s * (1 + air * 0.35);
    die.blob.scale.set(bs, bs, 1);
    die.blob.position.set(pos.x + 0.1 + air * 0.25, 0.004, pos.z + 0.06 + air * 0.12);
    die.blob.material.opacity = 0.8 * s * Math.max(0, 1 - air / 3.2);
    // impacts
    while (P.nextImpact < P.impacts.length && tt >= P.impacts[P.nextImpact]) {
      const k = P.nextImpact++;
      shake += [0.055, 0.025, 0.01][k] || 0.006;
      if (k === 0) spawnPuff(pos, 0.25, 4);
      bump(0.25);
    }
    if (!die.done && tt >= P.endT) { die.done = true; die.doneT = T; onSettle(die); }
  }

  function bump(dur) { busyUntil = Math.max(busyUntil, T + dur); }

  // ----- effects -----
  function addFx(dur, obj, update, dispose) {
    if (obj) scene.add(obj);
    fx.push({ t: 0, dur, obj, update, dispose });
    bump(dur);
  }

  // Additive light that never writes alpha, so it brightens the page under the transparent canvas
  // instead of leaving dark specks where it fades.
  function glowBlend(mat) {
    Object.assign(mat, {
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor,
      blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    });
    return mat;
  }
  function spritefx(map, color, blending, opacity) {
    const m = new THREE.SpriteMaterial({ map, color, transparent: true, depthWrite: false, opacity });
    if (blending === THREE.AdditiveBlending) glowBlend(m);
    return new THREE.Sprite(m);
  }

  function spawnPuff(at, strength, count) {
    for (let i = 0; i < count; i++) {
      const sp = spritefx(tex.smoke, 0xb4b0a8, THREE.NormalBlending, 0);
      const a = (i / count) * Math.PI * 2 + rand(-0.4, 0.4);
      const dir = new V3(Math.cos(a), 0, Math.sin(a));
      const p0 = new V3(at.x, 0.18, at.z).addScaledVector(dir, 0.45);
      sp.material.rotation = rand(0, 6);
      addFx(rand(0.55, 0.8), sp, (k) => {
        const e = easeOut(k);
        sp.position.copy(p0).addScaledVector(dir, e * 0.9);
        sp.position.y = 0.18 + e * 0.35;
        const sc = 0.5 + e * 1.1;
        sp.scale.set(sc, sc, 1);
        sp.material.opacity = strength * Math.sin(Math.PI * Math.min(1, k * 1.2)) * (1 - k);
      });
    }
  }

  function onFlop(die) {
    shake += 0.03;
    spawnPuff(die.mesh.position, 0.7, 8);
  }

  function onSettle(die) {
    if (die.dropped) {
      const t0 = T;
      addFx(0.4, null, () => {
        const k = clamp01((T - t0) / GREY_T);
        die.faceMat.userData.grey.value = 0.85 * k;
        die.bevelMat.userData.grey.value = 0.85 * k;
        die.faceMat.emissiveIntensity = 0.26 * (1 - k);
        die.scale = 1 - 0.12 * k;
      });
    }
    if (die.crit === 'success') burst(die);
  }

  function burst(die) {
    const p = die.mesh.position.clone();
    const top = p.clone(); top.y = die.kit.rest * 2 + 0.05;
    const away = new V3(p.x - camBase.x, 0, p.z - camBase.z).normalize();
    const flashAt = p.clone().addScaledVector(away, 0.6); flashAt.y = 0.5;
    const big = quality === 'high';
    // die glow + proud little hop
    const t0 = T;
    addFx(1.3, null, () => {
      const k = clamp01((T - t0) / 1.3);
      const pulse = Math.sin(Math.PI * Math.min(1, k * 1.6));
      die.faceMat.emissiveIntensity = 0.26 + 1.7 * pulse + 0.2 * k;
      die.bevelMat.emissiveIntensity = 0.08 * pulse + 0.03 * k;
      die.scale = 1 + 0.12 * Math.sin(Math.PI * clamp01(k / 0.3));
      goldLight.position.set(p.x, 2.4, p.z - 0.9);
      goldLight.intensity = 7 * pulse;
    });
    // flash
    const flash = spritefx(tex.glow, 0xffc65a, THREE.AdditiveBlending, 1);
    flash.position.copy(flashAt);
    addFx(0.6, flash, (k) => { const s = 1.5 + 5.5 * easeOut(k); flash.scale.set(s, s, 1); flash.material.opacity = 0.55 * Math.pow(1 - k, 1.8); });
    // light rays behind the die
    const rays = spritefx(tex.rays, 0xffbb45, THREE.AdditiveBlending, 0);
    rays.position.copy(p).addScaledVector(away, 1.1); rays.position.y = 0.9;
    addFx(1.7, rays, (k, dt) => {
      const s = 6.5 + 1.5 * k;
      rays.scale.set(s, s, 1);
      rays.material.rotation += dt * 0.45;
      rays.material.opacity = 0.95 * Math.sin(Math.PI * Math.min(1, k * 1.15));
    });
    // shock ring on the table
    const ring = new THREE.Mesh(blobGeo, glowBlend(new THREE.MeshBasicMaterial({ map: tex.ring, color: 0xffc85a, transparent: true, depthWrite: false })));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(p.x, 0.02, p.z);
    addFx(0.75, ring, (k) => { const s = 0.8 + 6.5 * easeOut(k); ring.scale.set(s, s, 1); ring.material.opacity = 0.9 * (1 - k); });
    // sparks
    const N = big ? 110 : 45;
    const posA = new Float32Array(N * 3);
    const colA = new Float32Array(N * 3);
    const vel = [];
    const life = [];
    for (let i = 0; i < N; i++) {
      const a = rand(0, Math.PI * 2);
      const up = rand(0.35, 1);
      const sp = rand(2.5, 7);
      vel.push(new V3(Math.cos(a) * (1 - up * 0.6), up, Math.sin(a) * (1 - up * 0.6)).normalize().multiplyScalar(sp));
      posA.set([top.x + rand(-0.2, 0.2), top.y + rand(-0.1, 0.2), top.z + rand(-0.2, 0.2)], i * 3);
      life.push(rand(0.6, 1.5));
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(posA, 3));
    pg.setAttribute('color', new THREE.BufferAttribute(colA, 3));
    const pts = new THREE.Points(pg, glowBlend(new THREE.PointsMaterial({ map: tex.spark, size: 0.26, vertexColors: true, transparent: true, depthWrite: false })));
    let age = 0;
    addFx(1.55, pts, (k, dt) => {
      age += dt;
      for (let i = 0; i < N; i++) {
        const v = vel[i];
        v.y -= 9 * dt;
        v.multiplyScalar(1 - 1.2 * dt);
        posA[i * 3] += v.x * dt; posA[i * 3 + 1] += v.y * dt; posA[i * 3 + 2] += v.z * dt;
        if (posA[i * 3 + 1] < 0.03) { posA[i * 3 + 1] = 0.03; v.y *= -0.4; }
        const f = Math.max(0, 1 - age / life[i]);
        const tw = 0.75 + 0.25 * Math.sin(age * 40 + i);
        colA[i * 3] = 1.0 * f * tw; colA[i * 3 + 1] = 0.78 * f * tw; colA[i * 3 + 2] = 0.35 * f * tw;
      }
      pg.attributes.position.needsUpdate = true;
      pg.attributes.color.needsUpdate = true;
    }, () => pg.dispose());
    shake += 0.05;
  }

  // ----- loop -----
  function update(dt) {
    T += dt;
    for (const d of dice) evalDie(d);
    if (clearing) {
      const k = clamp01((T - clearing.t0) / clearing.dur);
      for (const d of clearing.dice) {
        const e = k * k;
        d.scale = (d.baseScale || 1) * (1 - e);
        d.spinOut = k * 2.4;
        evalDie(d);
        d.mesh.position.y += e * 1.4;
        d.blob.material.opacity *= 1 - k;
      }
      if (k >= 1) { const c = clearing; clearing = null; c.dice.forEach(removeDie); c.resolve(); }
    }
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.t += dt;
      const k = clamp01(f.t / f.dur);
      f.update(k, dt);
      if (k >= 1) {
        if (f.obj) { scene.remove(f.obj); if (f.obj.material) f.obj.material.dispose(); }
        if (f.dispose) f.dispose();
        fx.splice(i, 1);
      }
    }
    if (goldLight.intensity > 0 && !fx.length) goldLight.intensity = 0;
    // a dropped die greys before the roll resolves, so the result reads the moment the promise does
    if (pending && dice.every((d) => d.done && T >= d.doneT + (d.dropped ? GREY_T : 0))) finishPending();
    // camera punch
    shake *= Math.exp(-dt * 16);
    if (shake < 0.0005) shake = 0;
    camera.position.set(camBase.x + Math.sin(T * 93) * shake, camBase.y - shake * 2.2 + Math.cos(T * 71) * shake * 0.5, camBase.z - shake * 1.6);
    camera.lookAt(camLook);
  }

  function frame(now) {
    raf = 0;
    if (disposed) return;
    const real = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    update(real * speedNow());
    renderer.render(scene, camera);
    const busy = clearing || pending || fx.length || shake > 0 || T < busyUntil || dice.some((d) => !d.done);
    if (busy) raf = requestAnimationFrame(frame);
  }
  function kick() {
    if (!raf && !disposed) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }

  function finishPending() {
    const p = pending;
    pending = null;
    clearTimeout(p.timer);
    p.resolve();
  }

  function removeDie(d) {
    scene.remove(d.mesh, d.blob);
    d.faceMat.dispose(); d.bevelMat.dispose(); d.blob.material.dispose();
  }

  function dropAll() {
    if (clearing) { const c = clearing; clearing = null; c.dice.forEach(removeDie); c.resolve(); }
    dice.forEach(removeDie);
    dice = [];
    for (const f of fx) { if (f.obj) { scene.remove(f.obj); if (f.obj.material) f.obj.material.dispose(); } if (f.dispose) f.dispose(); }
    fx = [];
    goldLight.intensity = 0;
  }

  // ----- warm-up: build the d20 kit and compile every program before the first roll -----
  resize();
  {
    const warm = makeDie({ sides: 20, value: 20 }, 0, 1, {}, 'success');
    dice = [warm];
    T = 10;
    spawnPuff(new V3(0, 0, 1), 0.5, 1);
    update(0.05);
    renderer.render(scene, camera);
    dropAll();
    T = 0; busyUntil = 0; shake = 0;
    camera.position.copy(camBase); camera.lookAt(camLook);
    renderer.clear();
    renderer.render(scene, camera);
  }

  function roll(spec) {
    if (disposed) return Promise.resolve();
    spec = spec || {};
    const list = (Array.isArray(spec.dice) ? spec.dice : [{ sides: 20, value: 20 }]).slice(0, 4);
    if (!list.length) return Promise.resolve();
    if (pending) finishPending();
    dropAll();
    // which die carries the crit flair: the matching d20, else the first kept die
    let critIdx = -1;
    if (spec.crit === 'success' || spec.crit === 'fail') {
      const want = spec.crit === 'success' ? 20 : 1;
      critIdx = list.findIndex((d) => !d.dropped && d.sides === 20 && Number(d.value) === want);
      if (critIdx < 0) critIdx = list.findIndex((d) => !d.dropped);
    }
    dice = list.map((d, i) => makeDie(d, i, list.length, spec, i === critIdx ? spec.crit : null));
    const tAll = Math.max(...dice.map((d) => d.plan.delay + d.plan.endT + (d.dropped ? GREY_T : 0)));
    return new Promise((resolve) => {
      const p = { resolve };
      p.timer = setTimeout(() => {
        if (pending !== p) return;
        T = Math.max(T, dice[0] ? dice[0].t0 + tAll + 0.001 : T);
        update(0); // settles every die; a dropped die starts greying here
        // frames were throttled: finish the dropped die's grey look before resolving
        if (dice.some((d) => d.dropped)) { T += GREY_T + 0.001; update(0); }
        renderer.render(scene, camera);
        if (pending === p) finishPending();
      }, (tAll / speedNow()) * 1000 + 600);
      pending = p;
      kick();
    });
  }

  function clear(opts) {
    if (disposed) return Promise.resolve();
    if (pending) finishPending();
    if (clearing) { const c = clearing; clearing = null; c.dice.forEach(removeDie); c.resolve(); }
    if (!dice.length) { dropAll(); renderer.render(scene, camera); return Promise.resolve(); }
    const instant = opts && opts.instant;
    for (const f of fx) { if (f.obj) { scene.remove(f.obj); if (f.obj.material) f.obj.material.dispose(); } if (f.dispose) f.dispose(); }
    fx = [];
    goldLight.intensity = 0;
    const leaving = dice;
    dice = [];
    if (instant) { leaving.forEach(removeDie); renderer.render(scene, camera); return Promise.resolve(); }
    for (const d of leaving) { d.baseScale = d.scale; d.plan.endT = Math.min(d.plan.endT, T - d.t0 - d.plan.delay); d.done = true; }
    return new Promise((resolve) => {
      clearing = { t0: T, dur: 0.32, dice: leaving, resolve };
      setTimeout(() => { if (clearing && clearing.resolve === resolve) { const c = clearing; clearing = null; c.dice.forEach(removeDie); renderer.render(scene, camera); resolve(); } }, (0.32 / speedNow()) * 1000 + 400);
      kick();
    });
  }

  function setQuality(q) {
    const next = q === 'low' ? 'low' : 'high';
    if (next === quality) return;
    quality = next;
    renderer.shadowMap.enabled = quality === 'high';
    key.castShadow = quality === 'high';
    ground.visible = quality === 'high';
    for (const d of dice) d.mesh.castShadow = quality === 'high';
    resize();
  }

  function dispose() {
    if (disposed) return;
    if (pending) finishPending();
    dropAll();
    disposed = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (ro) ro.disconnect();
    window.removeEventListener('resize', onWin);
    for (const k of Object.values(kits)) { k.geo.dispose(); k.surface.dispose(); k.atlases.forEach((t) => t.dispose()); }
    Object.values(tex).forEach((t) => t.dispose());
    blobGeo.dispose();
    ground.geometry.dispose(); ground.material.dispose();
    envTex.dispose();
    renderer.dispose();
    canvas.remove();
  }

  return {
    roll,
    clear,
    setQuality,
    dispose,
    // test helper: the value each die shows on top, read from its geometry
    _debugTopFaces() {
      return dice.map((d) => ({ sides: d.sides, value: d.value, top: topValue(d.kit, d.mesh.quaternion), dropped: d.dropped }));
    },
  };
}
