// All Lanternfall content in one object (SPEC 8). If any file is missing, this import fails
// and main.js falls back to the dev adventure.

import heroes from './heroes.js';
import enemies from './enemies.js';
import encounters from './encounters.js';
import items from './items.js';
import shops from './shops.js';
import npcs from './npcs.js';
import gmLines from './gm-lines.js';
import map from './map.js';
import prologue from './prologue.js';
import act1a from './adventure/act1a.js';
import act1b from './adventure/act1b.js';
import act2 from './adventure/act2.js';
import act3 from './adventure/act3.js';
import finale from './adventure/finale.js';

const scenes = { ...act1a, ...act1b, ...act2, ...act3, ...finale };

export default {
  heroes, enemies, encounters, items, shops, npcs, gmLines, map, prologue, scenes,
  startScene: 'village_square',
};
