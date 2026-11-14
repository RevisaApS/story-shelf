// How the player last touched the game, for this pack's on-screen hints (one place for it).
// inputMode() -> 'touch' | 'mouse' | 'key'. Starts as 'touch' on a touch screen, else 'mouse'.
// showKeys() -> true when key names (Space, Enter) may be shown: only after a keyboard or mouse input.
// keyHint(text) -> a <kbd> element with the key name, or null after a touch.
let mode = null;
let wired = false;

function wire() {
  if (wired || typeof window === 'undefined') return;
  wired = true;
  const touchFirst = (navigator.maxTouchPoints || 0) > 0 || window.matchMedia?.('(pointer: coarse)').matches;
  mode = touchFirst ? 'touch' : 'mouse';
  const onPointer = (e) => { mode = e.pointerType === 'touch' || e.pointerType === 'pen' ? 'touch' : 'mouse'; };
  window.addEventListener('pointerdown', onPointer, { capture: true, passive: true });
  window.addEventListener('touchstart', () => { mode = 'touch'; }, { capture: true, passive: true });
  window.addEventListener('keydown', (e) => { if (!e.repeat) mode = 'key'; }, { capture: true, passive: true });
}

export function inputMode() { wire(); return mode; }
export function showKeys() { return inputMode() !== 'touch'; }
export function keyHint(text) {
  if (!showKeys() || !text) return null;
  const k = document.createElement('kbd');
  k.textContent = text;
  return k;
}
wire();
