// Weather (SPEC 10): one canvas of soft, layered particles, plus gentle pointer parallax on the background.
// ctx.weather.set(id) with id in lanterns fireflies snow embers dust spores mist sparkles rain none; .clear()
import { h } from './dom.js';

const W = 1280, H = 800;
const TYPES = {
  lanterns:  { n: 26, layers: 3 },
  fireflies: { n: 46, layers: 2 },
  snow:      { n: 150, layers: 3 },
  embers:    { n: 70, layers: 2 },
  dust:      { n: 60, layers: 2 },
  spores:    { n: 55, layers: 2 },
  mist:      { n: 10, layers: 2 },
  sparkles:  { n: 60, layers: 2 },
  rain:      { n: 220, layers: 2 },
};

export function createWeather(ctx) {
  const canvas = h('canvas.lf-weather', { width: W, height: H, style: 'position:absolute;inset:0;width:1280px;height:800px' });
  ctx.stage.layers.weather.appendChild(canvas);
  const g = canvas.getContext('2d');
  let dpr = 1;
  const resize = () => {
    dpr = Math.min(2, ctx.stage.pixelRatio());
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  };
  resize();
  ctx.stage.onResize(resize);

  let type = 'none';
  let parts = [];
  let raf = 0, last = 0;
  let fade = 0, target = 0;
  const rnd = Math.random; // visual only: never touches the game rng
  const sprites = {};

  const glow = (r, inner, outer) => {
    const key = `${r}|${inner}|${outer}`;
    if (sprites[key]) return sprites[key];
    const c = document.createElement('canvas'); c.width = c.height = r * 2;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, inner); gr.addColorStop(0.35, outer); gr.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gr; x.fillRect(0, 0, r * 2, r * 2);
    return (sprites[key] = c);
  };

  function spawn(t, initial) {
    const layer = Math.floor(rnd() * (TYPES[t]?.layers || 1));
    const depth = 0.45 + layer * 0.35;
    const p = { x: rnd() * W, y: initial ? rnd() * H : 0, depth, layer, a: rnd() * Math.PI * 2, s: 0.5 + rnd(), life: 0, max: 0 };
    switch (t) {
      case 'lanterns': p.y = initial ? rnd() * H : H + 40; p.vx = (rnd() - 0.5) * 6; p.vy = -(8 + rnd() * 12) * depth; p.size = (7 + rnd() * 7) * depth; break;
      case 'fireflies': p.vx = (rnd() - 0.5) * 14; p.vy = (rnd() - 0.5) * 10; p.size = 1.5 + rnd() * 2 * depth; p.blink = rnd() * 6; break;
      case 'snow': p.y = initial ? rnd() * H : -10; p.vx = (rnd() - 0.3) * 12; p.vy = (18 + rnd() * 26) * depth; p.size = (1.2 + rnd() * 2.6) * depth; break;
      case 'embers': p.y = initial ? rnd() * H : H + 10; p.vx = (rnd() - 0.5) * 18; p.vy = -(20 + rnd() * 40) * depth; p.size = (1.2 + rnd() * 2.2) * depth; p.max = 3 + rnd() * 5; break;
      case 'dust': p.vx = 4 + rnd() * 8; p.vy = (rnd() - 0.5) * 4; p.size = (0.8 + rnd() * 1.6) * depth; break;
      case 'spores': p.vx = (rnd() - 0.5) * 8; p.vy = -(3 + rnd() * 8); p.size = (1.5 + rnd() * 2.5) * depth; p.hue = rnd() < 0.5 ? 'rgba(150,255,190,' : 'rgba(190,170,255,'; break;
      case 'mist': p.y = H * (0.5 + rnd() * 0.45); p.x = initial ? rnd() * W : -400; p.vx = 6 + rnd() * 8; p.vy = 0; p.size = 220 + rnd() * 220; break;
      case 'sparkles': p.vx = (rnd() - 0.5) * 6; p.vy = -(2 + rnd() * 6); p.size = 1 + rnd() * 2.5; p.blink = rnd() * 6; break;
      case 'rain': p.y = initial ? rnd() * H : -20; p.vx = -60; p.vy = (700 + rnd() * 300) * depth; p.size = 10 + rnd() * 12 * depth; break;
      default: break;
    }
    return p;
  }

  function step(t, dt) {
    const sp = window.__LF_SPEED > 1 ? 1 : 1; // weather is cosmetic; it never speeds up
    void sp;
    fade += (target - fade) * Math.min(1, dt * 1.6);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    if (fade < 0.01 && target === 0) { parts = []; return; }
    g.globalAlpha = fade;
    const time = t / 1000;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      p.a += dt * 0.8;
      p.life += dt;
      p.x += (p.vx + Math.sin(p.a + i) * (type === 'snow' ? 8 : type === 'fireflies' ? 12 : 3)) * dt;
      p.y += (p.vy + (type === 'fireflies' ? Math.cos(p.a * 0.7 + i) * 8 : 0)) * dt;
      const out = p.y < -60 || p.y > H + 60 || p.x < -460 || p.x > W + 460 || (p.max && p.life > p.max);
      if (out) { parts[i] = spawn(type, false); if (type === 'dust' || type === 'fireflies' || type === 'sparkles' || type === 'spores') { parts[i].x = rnd() * W; parts[i].y = rnd() * H; } continue; }
      drawP(p, time, i);
    }
    g.globalAlpha = 1;
  }

  function drawP(p, time, i) {
    switch (type) {
      case 'lanterns': {
        const r = p.size * 3.2, s = glow(48, 'rgba(255,236,170,1)', 'rgba(255,154,74,0.35)');
        g.globalAlpha = fade * (0.55 + 0.45 * Math.sin(time * 2 + i));
        g.drawImage(s, p.x - r * 2, p.y - r * 2, r * 4, r * 4);
        g.globalAlpha = fade * 0.95;
        g.fillStyle = '#ffd98a';
        g.beginPath(); g.ellipse(p.x, p.y, p.size * 0.55, p.size * 0.75, 0, 0, Math.PI * 2); g.fill();
        break;
      }
      case 'fireflies': case 'sparkles': {
        const b = 0.5 + 0.5 * Math.sin(time * (type === 'sparkles' ? 5 : 2.2) + p.blink);
        const s = type === 'sparkles' ? glow(16, 'rgba(255,255,255,1)', 'rgba(169,212,255,0.5)') : glow(16, 'rgba(240,255,170,1)', 'rgba(170,255,120,0.4)');
        const r = p.size * 4;
        g.globalAlpha = fade * b;
        g.drawImage(s, p.x - r, p.y - r, r * 2, r * 2);
        break;
      }
      case 'snow': g.globalAlpha = fade * (0.5 + p.layer * 0.2); g.fillStyle = '#f4f8ff'; g.beginPath(); g.arc(p.x, p.y, p.size, 0, Math.PI * 2); g.fill(); break;
      case 'embers': {
        const life = p.max ? 1 - p.life / p.max : 1;
        const s = glow(12, 'rgba(255,230,160,1)', 'rgba(255,120,40,0.6)');
        const r = p.size * 3;
        g.globalAlpha = fade * life;
        g.drawImage(s, p.x - r, p.y - r, r * 2, r * 2);
        break;
      }
      case 'dust': g.globalAlpha = fade * (0.25 + 0.25 * Math.sin(time + i)); g.fillStyle = '#ffe7a3'; g.beginPath(); g.arc(p.x, p.y, p.size, 0, Math.PI * 2); g.fill(); break;
      case 'spores': { const s = glow(12, p.hue + '1)', p.hue + '0.35)'); const r = p.size * 3; g.globalAlpha = fade * 0.7; g.drawImage(s, p.x - r, p.y - r, r * 2, r * 2); break; }
      case 'mist': { const s = glow(64, 'rgba(200,210,255,0.22)', 'rgba(170,180,230,0.10)'); g.globalAlpha = fade * 0.8; g.drawImage(s, p.x - p.size, p.y - p.size * 0.4, p.size * 2, p.size * 0.8); break; }
      case 'rain': g.globalAlpha = fade * 0.35; g.strokeStyle = '#bcd6ff'; g.lineWidth = 1; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.size * 0.08, p.y - p.size); g.stroke(); break;
      default: break;
    }
  }

  function loop(t) {
    const dt = Math.min(0.05, (t - (last || t)) / 1000);
    last = t;
    step(t, dt);
    if (target > 0 || fade > 0.01) raf = requestAnimationFrame(loop);
    else { raf = 0; g.clearRect(0, 0, canvas.width, canvas.height); }
  }

  function set(id) {
    id = TYPES[id] ? id : 'none';
    if (id === type) return;
    const reduce = ctx.settings.reduceMotion;
    if (id === 'none') { target = 0; type = type; ctx.bus.emit('weather:changed', { id }); if (!raf) raf = requestAnimationFrame(loop); setTimeout(() => { if (target === 0) type = 'none'; }, 1500); return; }
    type = id;
    const n = Math.round(TYPES[id].n * (reduce ? 0.35 : 1) * (ctx.fast ? 0.2 : 1));
    parts = Array.from({ length: n }, () => spawn(id, true));
    fade = 0; target = 1;
    ctx.bus.emit('weather:changed', { id });
    if (!raf) { last = 0; raf = requestAnimationFrame(loop); }
  }

  // pointer parallax on the background
  const bg = ctx.stage.layers.bg, actors = ctx.stage.layers.actor;
  bg.style.transition = 'translate 900ms cubic-bezier(0.22,1,0.36,1)';
  actors.style.transition = 'translate 900ms cubic-bezier(0.22,1,0.36,1), opacity 500ms ease';
  ctx.stage.el.addEventListener('pointermove', (e) => {
    if (ctx.settings.reduceMotion || e.pointerType === 'touch') return;
    const p = ctx.stage.toStage(e.clientX, e.clientY);
    const dx = (p.x / W - 0.5), dy = (p.y / H - 0.5);
    bg.style.translate = `${(-dx * 14).toFixed(1)}px ${(-dy * 9).toFixed(1)}px`;
    actors.style.translate = `${(-dx * 22).toFixed(1)}px ${(-dy * 6).toFixed(1)}px`;
  });

  return { set, clear: () => set('none'), get id() { return type; } };
}
