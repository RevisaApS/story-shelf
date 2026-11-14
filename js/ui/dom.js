// DOM helpers.
// h(tag, attrs, ...kids): tag may be 'div.class1.class2#id'. attrs: class, style (string|object), dataset,
//   on<Event> handlers (onClick...), html (innerHTML), any other attribute. kids: nodes, strings, arrays, null.
// $(sel, root), $$(sel, root), clear(el), raf(), nextFrame(), wait(ms) (real time, not scaled),
// transitionEnd(el, ms) -> Promise (always resolves by ms), tap(el, fn, ctx?) (press feedback + ui.tap sfx),
// fmt(text, vars) replaces {actor} {party} in unspoken UI text.
export function h(tag, attrs, ...kids) {
  let t = tag, id = null; const classes = [];
  const parts = tag.split(/(?=[.#])/);
  t = parts[0] && !/^[.#]/.test(parts[0]) ? parts.shift() : 'div';
  for (const p of parts) { if (p[0] === '.') classes.push(p.slice(1)); else if (p[0] === '#') id = p.slice(1); }
  const isSvg = ['svg', 'path', 'circle', 'g', 'polygon', 'rect', 'line', 'defs', 'linearGradient', 'radialGradient', 'stop', 'ellipse', 'polyline', 'text', 'use', 'filter', 'feGaussianBlur'].includes(t);
  const el = isSvg ? document.createElementNS('http://www.w3.org/2000/svg', t) : document.createElement(t);
  if (id) el.id = id;
  if (classes.length) el.setAttribute('class', classes.join(' '));
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class' || k === 'className') { const prev = el.getAttribute('class'); el.setAttribute('class', (prev ? prev + ' ' : '') + v); }
    else if (k === 'style') { if (typeof v === 'string') el.style.cssText += v; else for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; } }
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  append(el, kids);
  return el;
}

function append(el, kids) {
  for (const k of kids) {
    if (k == null || k === false || k === true) continue;
    if (Array.isArray(k)) append(el, k);
    else if (k instanceof Node) el.appendChild(k);
    else el.appendChild(document.createTextNode(String(k)));
  }
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const clear = (el) => { while (el && el.firstChild) el.removeChild(el.firstChild); return el; };
export const raf = () => new Promise((r) => requestAnimationFrame(r));
export const nextFrame = () => raf().then(raf);
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function transitionEnd(el, ms = 600) {
  return new Promise((res) => {
    let done = false;
    const fin = () => { if (done) return; done = true; el.removeEventListener('transitionend', fin); el.removeEventListener('animationend', fin); res(); };
    el.addEventListener('transitionend', fin);
    el.addEventListener('animationend', fin);
    setTimeout(fin, ms);
  });
}

export function tap(el, fn, ctx = null, { sfx = 'ui.tap' } = {}) {
  el.addEventListener('pointerdown', () => {
    el.classList.add('is-pressed');
    if (sfx && ctx?.audio) ctx.audio.sfx(sfx);
  });
  const up = () => el.classList.remove('is-pressed');
  el.addEventListener('pointerup', up);
  el.addEventListener('pointerleave', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('click', (e) => { if (el.disabled || el.getAttribute('aria-disabled') === 'true') return; fn(e); });
  if (ctx?.audio) el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') ctx.audio.sfx('ui.hover', { volume: 0.35 }); });
  return el;
}

export function fmt(text, vars = {}) {
  return String(text ?? '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
}
