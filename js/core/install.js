// "Install as app": keeps the browser's install offer (Chrome and Samsung Internet on Android send
// beforeinstallprompt once the page has a manifest) so a button on the shelf can show it with one tap.
// Imported first by main.js, because the offer can arrive before any screen is up.
//
//   install.offered()   true on the published page (it has a manifest) when not already running as an app
//   install.ready()     true when the browser's own install dialog can be shown now
//   install.prompt()    shows it -> 'accepted' | 'dismissed' | 'none'
//   install.platform()  'ios' | 'android' | 'other', for the written steps when there is no dialog
//   install.onChange(fn)

let offer = null;
let installed = false;
const subs = new Set();
const tell = () => subs.forEach((fn) => { try { fn(); } catch { /* ignore */ } });

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); offer = e; tell(); });
  window.addEventListener('appinstalled', () => { offer = null; installed = true; tell(); });
}

const standalone = () => {
  try { return matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone === true; }
  catch { return false; }
};

export const install = {
  offered: () => !installed && !standalone() && !!document.querySelector('link[rel="manifest"]'),
  ready: () => !!offer,
  installed: () => installed,
  platform() {
    const ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
    return /Android/.test(ua) ? 'android' : 'other';
  },
  async prompt() {
    if (!offer) return 'none';
    const e = offer;
    offer = null; // the browser lets an offer be shown once
    try { await e.prompt(); const choice = await e.userChoice; tell(); return choice?.outcome || 'dismissed'; }
    catch { tell(); return 'none'; }
  },
  onChange(fn) { subs.add(fn); return () => subs.delete(fn); },
};
