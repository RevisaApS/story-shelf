// Autosave (SPEC 4). One slot in localStorage['lanternfall.save.v1']; settings live separately.
// save.write(state), save.load() -> data|null, save.clear(), save.exists()
// settings: loadSettings() -> object with defaults, saveSettings(obj)
export const SAVE_KEY = 'lanternfall.save.v1';
const DEFAULT_SAVE_KEY = SAVE_KEY;
export const SETTINGS_KEY = 'lanternfall.settings.v1';

const store = (() => {
  try { const k = '__lf_probe'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return localStorage; }
  catch { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; }
})();

// createSave({ disabled, key }): key is the pack's saveKey (ROUND2 1); save.key tells which slot this is.
export function createSave({ disabled = false, key = DEFAULT_SAVE_KEY } = {}) {
  const SAVE_KEY = key;
  return {
    key,
    write(state) {
      if (disabled) return;
      try { store.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { console.warn('[save] write failed', e); }
    },
    load() {
      try { const raw = store.getItem(SAVE_KEY); if (!raw) return null; const d = JSON.parse(raw); return d && d.v === 1 && d.scene ? d : null; }
      catch { return null; }
    },
    clear() { if (disabled) return; try { store.removeItem(SAVE_KEY); } catch { /* ignore */ } },
    exists() { return !!this.load(); },
  };
}

export const SETTINGS_DEFAULTS = {
  master: 0.9, music: 0.6, sfx: 0.8, voice: 1,
  voiceOn: true, textSpeed: 'normal', reduceMotion: false, diceQuality: 'high',
};

export function loadSettings() {
  let saved = {};
  try { saved = JSON.parse(store.getItem(SETTINGS_KEY) || '{}') || {}; } catch { saved = {}; }
  const s = { ...SETTINGS_DEFAULTS, ...saved };
  Object.defineProperty(s, 'save', { enumerable: false, value() { try { store.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ } } });
  return s;
}
