// Asset URLs by id (SPEC 14). assets.bg(id), .char(id), .portrait(id), .item(id), .story(id), .ui(id),
// .music(id), .voice(id) -> URL string (relative to game/index.html).
// assets.init() reads the dev server's directory listings once, so the game knows which files exist and
// never requests a missing one (no 404 noise). On hosts without listings (any plain static host), has()
// returns undefined (unknown), optional modules load by plain dynamic import in try/catch, and images fall
// back to their placeholder on the error event.
// assets.has(url) -> true|false|undefined, assets.exists(url) -> Promise<bool> (probes with an Image when unknown),
// assets.preload(urls) -> Promise, assets.moduleExists(path) -> true|false|undefined (paths under js/).
const KINDS = { bg: 'webp', char: 'webp', portrait: 'webp', item: 'webp', story: 'webp', ui: 'webp', music: 'mp3', voice: 'mp3' };
const JS_DIRS = ['screens', 'systems', 'dice', 'audio', 'content', 'content/adventure', 'vendor', 'gm', 'ui',
  'grimspire', 'grimspire/screens', 'grimspire/content', 'i18n', 'i18n/da', 'i18n/da/lanternfall', 'i18n/da/grimspire'];

async function listing(dir) {
  try {
    const r = await fetch(dir.endsWith('/') ? dir : dir + '/', { cache: 'no-store' });
    if (!r.ok) return null;
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('text/html')) return null;
    const html = await r.text();
    if (!/Directory listing/i.test(html)) return null;
    const names = new Set();
    for (const m of html.matchAll(/href="([^"?#]+)"/g)) names.add(decodeURIComponent(m[1]));
    return names;
  } catch { return null; }
}

export function createAssets() {
  const known = new Map(); // dir -> Set(names) | null
  const probe = new Map(); // url -> Promise<bool>
  let ready = false;

  const url = (kind, id) => `assets/${kind}/${id}.${KINDS[kind]}`;
  const has = (u) => {
    if (!ready || !u) return undefined;
    const clean = u.replace(/^\.\//, '');
    const i = clean.lastIndexOf('/');
    const dir = clean.slice(0, i + 1), name = clean.slice(i + 1);
    if (!known.has(dir)) return undefined;
    const set = known.get(dir);
    if (set === null) return undefined;
    if (set === false) return false; // parent listing says the dir is missing
    return set.has(name);
  };

  const api = {
    url,
    bg: (id) => url('bg', id), char: (id) => url('char', id), portrait: (id) => url('portrait', id),
    item: (id) => url('item', id), story: (id) => url('story', id), ui: (id) => url('ui', id),
    music: (id) => url('music', id), voice: (id) => url('voice', id),
    has,
    async init() {
      // Only serve.py (header X-Lanternfall-Listings) has directory listings. On any other static host stop
      // here without requesting a listing (no 404s): has() answers undefined, modules load by plain import,
      // and images use their error placeholders.
      let dev = false;
      try { const r = await fetch('js/main.js', { method: 'HEAD', cache: 'no-store' }); dev = r.ok && r.headers.get('x-lanternfall-listings') === '1'; } catch { dev = false; }
      const jsTop = dev ? await listing('js/') : null;
      if (!jsTop) { ready = true; return; }
      const top = await listing('assets/');
      await Promise.all(Object.keys(KINDS).map(async (k) => {
        const dir = `assets/${k}/`;
        if (top && !top.has(`${k}/`)) { known.set(dir, false); return; }
        known.set(dir, top ? await listing(dir) : null);
      }));
      known.set('css/', await listing('css/'));
      // parents before children, so a missing parent marks its children missing without a request (no 404s)
      const depth = (d) => d.split('/').length;
      for (let lv = 1; lv <= Math.max(...JS_DIRS.map(depth)); lv++) {
        await Promise.all(JS_DIRS.filter((d) => depth(d) === lv).map(async (d) => {
          const dir = `js/${d}/`;
          const parts = d.split('/');
          const name = `${parts[parts.length - 1]}/`;
          const parent = parts.length > 1 ? known.get(`js/${parts.slice(0, -1).join('/')}/`) : jsTop;
          if (parent === false || (parent && !parent.has(name))) { known.set(dir, false); return; }
          known.set(dir, await listing(dir));
        }));
      }
      ready = true;
    },
    moduleExists(path) { return has(path.replace(/^\.\//, '')); },
    exists(u) {
      const k = has(u);
      if (k !== undefined) return Promise.resolve(k);
      if (!probe.has(u)) {
        probe.set(u, new Promise((res) => {
          const img = new Image();
          img.onload = () => res(true); img.onerror = () => res(false);
          img.src = u;
        }));
      }
      return probe.get(u);
    },
    preload(urls) {
      return Promise.all((urls || []).filter(Boolean).map((u) => {
        if (has(u) === false || /\.mp3$/.test(u)) return Promise.resolve(false);
        return new Promise((res) => {
          const img = new Image();
          img.onload = () => { (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => res(true)); };
          img.onerror = () => res(false);
          img.src = u;
        });
      }));
    },
  };
  return api;
}
