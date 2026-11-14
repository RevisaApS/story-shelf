// Encounters. A foe appears when party size >= min.

const encounters = {
  thornling_ambush: {
    id: 'thornling_ambush', title: 'Thornling Ambush', music: 'battle', canBefriend: true,
    foes: [
      { type: 'thornling', name: 'Prickle', min: 1 },
      { type: 'thornling', name: 'Burr', min: 1 },
      { type: 'thornling', name: 'Nettlenose', min: 3 },
      { type: 'thornling', name: 'Tiny Spike', min: 4 },
    ],
    intro: [
      "The brambles burst open and out tumble the Thornlings, giggling, waving prickly fists.",
      "This is a battle. Everyone gets a turn, heroes first. Pick what you do, and I'll tell you how it goes.",
      "Now look closely. They squint at every light, and they keep swaying to the sound of the wind.",
      "You can fight them, of course. But a Thornling who likes you is worth ten who don't.",
    ],
  },

  gloop_ambush: {
    id: 'gloop_ambush', title: 'Gloops!', music: 'battle', canBefriend: true,
    foes: [
      { type: 'gloop', name: 'Big Blorp', min: 1 },
      { type: 'gloop', name: 'Little Blorp', min: 2 },
      { type: 'gloop', name: 'Medium Blorp', min: 3 },
    ],
    intro: [
      "The water bubbles. Blorp. Blorp. BLORP. Up rise the Gloops, pebble eyes blinking, grinning muddy grins.",
      "They wobble away from your lantern light. And is that one sniffing at your bag?",
    ],
  },

  rattlewing_raid: {
    id: 'rattlewing_raid', title: 'Rattlewing Raid', music: 'battle', canBefriend: false,
    foes: [
      { type: 'rattlewing', min: 1 },
      { type: 'rattlewing', min: 2 },
      { type: 'rattlewing', min: 3 },
      { type: 'rattlewing', min: 4 },
    ],
    intro: [
      "Tick-tick-tick. Out of the dusk come the Rattlewings, brass wings clattering, red eyes fixed on your Songstones.",
      "These are Glint's machines. No talking them round. But all those gears look like they'd jam on something grabby.",
    ],
    twist: {
      when: 'thorn_friends', at: 'start', target: 'first', status: 'tangled',
      lines: [
        "Then the hedge explodes. Thornlings! Your Thornlings! They leap on the first crow and tie it up in brambles.",
        "One of them shouts: We said we'd poke anything that bothers you! And they do.",
      ],
    },
  },

  flutterfang_roost: {
    id: 'flutterfang_roost', title: 'The Flutterfang Roost', music: 'battle', canBefriend: true,
    foes: [
      { type: 'flutterfang', min: 1 },
      { type: 'flutterfang', min: 1 },
      { type: 'flutterfang', min: 2 },
      { type: 'flutterfang', min: 3 },
      { type: 'flutterfang', min: 4 },
    ],
    intro: [
      "The ceiling shivers and comes alive. Flutterfangs, wings like broken glass, chiming as they swoop.",
      "Quick, slippery, hard to hit. But listen to their wings ring. They'd ring at a song, too.",
    ],
  },

  bouldergrin: {
    id: 'bouldergrin', title: 'Bouldergrin', music: 'boss', canBefriend: true,
    foes: [ { type: 'bouldergrin', min: 1 } ],
    intro: [
      "Bouldergrin stands. And stands. And keeps on standing, until his head scrapes the crystals.",
      "One eye glows. The other is an empty hole. He says, very slowly: None. Shall. Pass.",
    ],
  },

  clatterclaw: {
    id: 'clatterclaw', title: 'The Clatterclaw', music: 'boss', canBefriend: false,
    foes: [
      { type: 'clatterclaw', min: 1 },
      { type: 'rattlewing', min: 3 },
      { type: 'rattlewing', min: 4 },
    ],
    intro: [
      "The junk pile rises, and rises, on eight clanking legs. Glint sits at the levers, cackling, hat askew.",
      "A machine like that can't be charmed. But every joint is open to the air. Something tangly would jam it.",
    ],
  },

  nightmares: {
    id: 'nightmares', title: 'Nightmares', music: 'boss', canBefriend: true,
    foes: [
      { type: 'nightmare_wisp', min: 1 },
      { type: 'nightmare_wisp', min: 1 },
      { type: 'nightmare_wisp', min: 2 },
      { type: 'nightmare_wisp', min: 3 },
      { type: 'nightmare_wisp', min: 4 },
    ],
    intro: [
      "Solenne groans in her sleep, and her bad dreams pour out like smoke, with little stars for eyes.",
      "You can't stab a bad dream. But light thins them, and a song might soothe them right away.",
    ],
  },
};

export default encounters;
