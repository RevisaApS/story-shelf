// Tiny event bus. bus.on(evt, fn) -> off(); bus.once(evt, fn) -> off(); bus.emit(evt, data).
// '*' listeners receive (evt, data) for every event.
export function createBus() {
  const map = new Map();
  const on = (evt, fn) => {
    if (!map.has(evt)) map.set(evt, new Set());
    map.get(evt).add(fn);
    return () => map.get(evt)?.delete(fn);
  };
  const once = (evt, fn) => {
    const off = on(evt, (d) => { off(); fn(d); });
    return off;
  };
  const emit = (evt, data) => {
    for (const fn of [...(map.get(evt) || [])]) {
      try { fn(data); } catch (e) { console.error('[bus]', evt, e); }
    }
    for (const fn of [...(map.get('*') || [])]) {
      try { fn(evt, data); } catch (e) { console.error('[bus *]', evt, e); }
    }
  };
  return { on, once, emit };
}
