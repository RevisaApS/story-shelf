// World map. Node ids = scene ids. x,y are stage pixels measured (1280 x 800) on assets/bg/world_map.webp,
// village bottom-left to mountain top-right. Measured on the painted map by screens-A.

const map = {
  nodes: [
    { id: 'village_square',  label: 'Thistlehollow',        x: 160, y: 600 },
    { id: 'whisperwood',     label: 'The Whisperwood',      x: 200, y: 200 },
    { id: 'stone_bridge',    label: 'The Old Stone Bridge', x: 505, y: 365 },
    { id: 'moonpetal_glade', label: 'Moonpetal Glade',      x: 612, y: 590 },
    { id: 'mirefen_marsh',   label: 'Mirefen Marsh',        x: 1010, y: 590 },
    { id: 'goblin_market',   label: 'The Goblin Night Market', x: 600, y: 120 },
    { id: 'sunken_road',     label: 'The Sunken Road',      x: 1010, y: 370 },
    { id: 'dwarf_door',      label: 'The Dwarf-Door',       x: 1000, y: 175 },
    { id: 'crystal_cavern',  label: 'The Crystal Cavern',   x: 1045, y: 150 },
    { id: 'chasm_bridge',    label: 'The Chasm',            x: 1085, y: 135 },
    { id: 'glint_vault',     label: "Glint's Vault",        x: 1120, y: 120 },
    { id: 'dragon_lair',     label: 'The Hush-Shrine',      x: 1080, y: 95 },
    { id: 'peak_dawn',       label: 'The Peak',             x: 1095, y: 60 },
  ],
  path: ['village_square', 'whisperwood', 'stone_bridge', 'moonpetal_glade', 'mirefen_marsh', 'goblin_market',
    'sunken_road', 'dwarf_door', 'crystal_cavern', 'chasm_bridge', 'glint_vault', 'dragon_lair', 'peak_dawn'],
};

export default map;
