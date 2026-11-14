// da dictionary for lanternfall: merges the group files (ROUND2 2.2). The file list is written by
// tools/i18n-extract.mjs. A group file that is missing, empty or broken is skipped (a warning, never a crash), and
// an empty "" entry never hides a translation from another file. Works in the browser and in Node.
const FILES = [
  "scene.village_square",
  "scene.elder_hall",
  "scene.whisperwood",
  "scene.stone_bridge",
  "scene.moonpetal_glade",
  "scene.camp_whisperwood",
  "scene.mirefen_marsh",
  "scene.goblin_market",
  "scene.sunken_road",
  "scene.camp_ruins",
  "scene.dwarf_door",
  "scene.crystal_cavern",
  "scene.chasm_bridge",
  "scene.glint_vault",
  "scene.dragon_lair",
  "scene.ending",
  "heroes",
  "enemies",
  "encounters",
  "items",
  "shops",
  "npcs",
  "gmlines",
  "misc"
];

const dict = {};
const mods = await Promise.all(FILES.map((f) => import(`./${f}.js`).catch((e) => {
  console.warn(`[i18n] da/lanternfall/${f}.js skipped:`, e?.message || e);
  return null;
})));
for (const m of mods) {
  const d = m?.default;
  if (!d || typeof d !== 'object') continue;
  for (const [k, v] of Object.entries(d)) if (typeof v === 'string' && v.trim()) dict[k] = v;
}

export default dict;
