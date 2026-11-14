// da dictionary for grimspire: merges the group files (ROUND2 2.2). The file list is written by
// tools/i18n-extract.mjs. A group file that is missing, empty or broken is skipped (a warning, never a crash), and
// an empty "" entry never hides a translation from another file. Works in the browser and in Node.
const FILES = [
  "heroes",
  "encounters",
  "items",
  "shops",
  "npcs",
  "gmlines",
  "story",
  "foes",
  "floors",
  "events",
  "boons"
];

const dict = {};
const mods = await Promise.all(FILES.map((f) => import(`./${f}.js`).catch((e) => {
  console.warn(`[i18n] da/grimspire/${f}.js skipped:`, e?.message || e);
  return null;
})));
for (const m of mods) {
  const d = m?.default;
  if (!d || typeof d !== 'object') continue;
  for (const [k, v] of Object.entries(d)) if (typeof v === 'string' && v.trim()) dict[k] = v;
}

export default dict;
