// Grimspire floors (GRIMSPIRE.md 3.6, 3.8, 4.7). Owner: gs-content-a.
// Map coordinates are stage pixels on the 1280 x 800 `gs_map` cross-section; rooms climb from bottom to top.
// Each floor: two battles, two events (f<n>_e1, f<n>_e2 in events.js), a fork (elite or rest), the boss.
// Floor 5 has Marrowmaw in room 4 instead of the fork, and the Bone King last.
// intro / cleared are SPEC 8.2 steps spoken by Varg (speaker 'gm').
// loot.rarityWeights: relative weights for item drops on this floor (elites drop rare or better; chests and
// bosses use the loot roll instead).

const say = (text, mood = 'ominous') => ({ say: text, mood });

const floors = {
  1: {
    n: 1, name: 'The Bone Gate', sub: 'Where the dead stand guard', bg: 'gs_floor1', music: 'gs_explore_a', ambience: 'cave',
    map: { rooms: [
      { id: 'r1', kind: 'battle', x: 640, y: 700, next: ['r2'], encounter: 'f1_b1' },
      { id: 'r2', kind: 'event', x: 380, y: 590, next: ['r3'], event: 'f1_e1' },
      { id: 'r3', kind: 'battle', x: 640, y: 480, next: ['r4a', 'r4b'], encounter: 'f1_b2' },
      { id: 'r4a', kind: 'elite', x: 450, y: 360, next: ['r5'], encounter: 'f1_elite' },
      { id: 'r4b', kind: 'rest', x: 830, y: 360, next: ['r5'] },
      { id: 'r5', kind: 'event', x: 640, y: 240, next: ['r6'], event: 'f1_e2' },
      { id: 'r6', kind: 'boss', x: 640, y: 110, next: [], encounter: 'f1_boss' },
    ] },
    intro: [
      say("The tower door groans open. Cold air. Old dust. And bones, everywhere, set into the walls like bricks."),
      say("Somewhere ahead, iron scrapes on stone. Something big is dragging a gate around."),
      say("Stay close. Weapons ready. The Bone Gate does not like visitors."),
    ],
    cleared: [
      say("The Bone Gate is open. First floor, cleared!", 'excited'),
      say("Above you, the stairs wind up into a dark full of soft ticking. Spiders, I would bet my other eye."),
      say("Back to the fire for now. Hilda will want to see what you found."),
    ],
    huntAgain: ['f1_h1', 'f1_h2', 'f1_h3', 'f1_b3'],
    loot: { rarityWeights: { common: 70, rare: 28, epic: 2, legendary: 0 } },
  },

  2: {
    n: 2, name: 'The Spider Vaults', sub: 'Webs as thick as curtains', bg: 'gs_floor2', music: 'gs_explore_a', ambience: 'lair',
    map: { rooms: [
      { id: 'r1', kind: 'battle', x: 300, y: 700, next: ['r2'], encounter: 'f2_b1' },
      { id: 'r2', kind: 'event', x: 620, y: 620, next: ['r3'], event: 'f2_e1' },
      { id: 'r3', kind: 'battle', x: 940, y: 500, next: ['r4a', 'r4b'], encounter: 'f2_b2' },
      { id: 'r4a', kind: 'elite', x: 760, y: 370, next: ['r5'], encounter: 'f2_elite' },
      { id: 'r4b', kind: 'rest', x: 1080, y: 370, next: ['r5'] },
      { id: 'r5', kind: 'event', x: 640, y: 240, next: ['r6'], event: 'f2_e2' },
      { id: 'r6', kind: 'boss', x: 360, y: 120, next: [], encounter: 'f2_boss' },
    ] },
    intro: [
      say("The stairs end in a vault hung with webs. Thick ones. Strong enough to hold a cow."),
      say("Egg sacs glow green on the walls, like lanterns nobody asked for."),
      say("Every thread you touch hums. And far away, something feels it humming."),
      say("Bring fire if you have it. Spiders hate fire."),
    ],
    cleared: [
      say("The Spider Vaults are clear. Not one web left twitching.", 'excited'),
      say("Feel that? The stairs up are warm. Very warm. Something is burning up there."),
      say("Back to camp. Shake out your boots first. Trust me."),
    ],
    huntAgain: ['f2_h1', 'f2_h2', 'f2_h3', 'f2_b3'],
    loot: { rarityWeights: { common: 55, rare: 40, epic: 5, legendary: 0 } },
  },

  3: {
    n: 3, name: 'The Molten Forge', sub: 'Lava, chains and giant anvils', bg: 'gs_floor3', music: 'gs_explore_b', ambience: 'fire',
    map: { rooms: [
      { id: 'r1', kind: 'battle', x: 980, y: 700, next: ['r2'], encounter: 'f3_b1' },
      { id: 'r2', kind: 'event', x: 660, y: 610, next: ['r3'], event: 'f3_e1' },
      { id: 'r3', kind: 'battle', x: 340, y: 500, next: ['r4a', 'r4b'], encounter: 'f3_b2' },
      { id: 'r4a', kind: 'elite', x: 220, y: 360, next: ['r5'], encounter: 'f3_elite' },
      { id: 'r4b', kind: 'rest', x: 520, y: 360, next: ['r5'] },
      { id: 'r5', kind: 'event', x: 760, y: 240, next: ['r6'], event: 'f3_e2' },
      { id: 'r6', kind: 'boss', x: 1000, y: 120, next: [], encounter: 'f3_boss' },
    ] },
    intro: [
      say("Heat hits you like a wall. Rivers of lava run across the floor in stone channels."),
      say("Chains clank overhead. Somewhere deep in the smoke, a hammer rings. Clang. Clang. Clang."),
      say("Nobody has worked this forge in a hundred years. So who is hammering?"),
    ],
    cleared: [
      say("The Molten Forge goes dark and quiet. You beat the fire!", 'excited'),
      say("The stairs above are white with frost. Your breath is already smoking."),
      say("Hilda will want to hear about Brann. Smith to smith, she will be very jealous of that hammer."),
    ],
    huntAgain: ['f3_h1', 'f3_h2', 'f3_h3', 'f3_b3'],
    loot: { rarityWeights: { common: 10, rare: 60, epic: 28, legendary: 2 } },
  },

  4: {
    n: 4, name: 'The Frozen Library', sub: 'Books under the ice', bg: 'gs_floor4', music: 'gs_explore_b', ambience: 'crystal',
    map: { rooms: [
      { id: 'r1', kind: 'battle', x: 640, y: 710, next: ['r2'], encounter: 'f4_b1' },
      { id: 'r2', kind: 'event', x: 980, y: 600, next: ['r3'], event: 'f4_e1' },
      { id: 'r3', kind: 'battle', x: 640, y: 500, next: ['r4a', 'r4b'], encounter: 'f4_b2' },
      { id: 'r4a', kind: 'elite', x: 260, y: 380, next: ['r5'], encounter: 'f4_elite' },
      { id: 'r4b', kind: 'rest', x: 560, y: 380, next: ['r5'] },
      { id: 'r5', kind: 'event', x: 880, y: 250, next: ['r6'], event: 'f4_e2' },
      { id: 'r6', kind: 'boss', x: 540, y: 120, next: [], encounter: 'f4_boss' },
    ] },
    intro: [
      say("A library, frozen solid. Shelves of ice, books under glass-blue frost."),
      say("Snow falls from the ceiling. Indoors. Books float past you, pages turning by themselves."),
      say("Something here has read every book in the tower. Including the one about you."),
      say("Keep your voices down. Libraries have rules. This one has teeth."),
    ],
    cleared: [
      say("The Frozen Library is melting. Drip, drip, drip. You did it!", 'excited'),
      say("Only one floor left. Up there, green fire burns behind a door made of bones."),
      say("Go back to the fire. Eat something. Sleep. The king can wait one more night."),
    ],
    huntAgain: ['f4_h1', 'f4_h2', 'f4_h3', 'f4_b3'],
    loot: { rarityWeights: { common: 5, rare: 45, epic: 45, legendary: 5 } },
  },

  5: {
    n: 5, name: 'The Throne of Bones', sub: 'The top of Grimspire', bg: 'gs_floor5', music: 'gs_explore_c', ambience: 'night',
    map: { rooms: [
      { id: 'r1', kind: 'battle', x: 640, y: 710, next: ['r2'], encounter: 'f5_b1' },
      { id: 'r2', kind: 'event', x: 400, y: 590, next: ['r3'], event: 'f5_e1' },
      { id: 'r3', kind: 'battle', x: 880, y: 480, next: ['r4'], encounter: 'f5_b2' },
      { id: 'r4', kind: 'boss', x: 640, y: 360, next: ['r5'], encounter: 'f5_dragon' },
      { id: 'r5', kind: 'event', x: 400, y: 240, next: ['r6'], event: 'f5_e2' },
      { id: 'r6', kind: 'boss', x: 640, y: 110, next: [], encounter: 'f5_boss' },
    ] },
    intro: [
      say("The top of Grimspire. The walls are bones. The floor is bones. The air tastes of cold iron."),
      say("Green fire burns in bowls made of skulls. The bell above you is silent, for now."),
      say("Something huge is breathing in the next hall. And behind it, a throne."),
      say("This is it, hunters. Everything you learned. Everything you found. Let us finish it."),
    ],
    cleared: [
      say("The Throne of Bones is empty. The crown is fallen. Grimspire is quiet.", 'excited'),
      say("Listen. No bell. For the first time in a hundred years, no bell."),
      say("Look out of the window, hunters. The sun is coming up over the moor."),
    ],
    huntAgain: ['f5_h1', 'f5_h2', 'f5_h3', 'f5_b3', 'f5_elite'],
    loot: { rarityWeights: { common: 0, rare: 15, epic: 60, legendary: 25 } },
  },
};

export default floors;
