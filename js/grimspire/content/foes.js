// Grimspire monsters and boss forms (GRIMSPIRE.md 2, 4.6). Owner: gs-content-a.
// Base stats are for a party of three on Knight; rules.scaleFoe() scales them for party size and difficulty.
// Every line is Varg (second person, present tense, 90 characters or fewer), except lines written as
// { say, as: 'gs_boneking' } or { say, as: 'gs_crown' }: those are spoken in the Bone King's own voice.
// Move `effect` uses the same keys as hero skill effects (apply / heal / shield). `phases[].moves`, when given,
// replaces the foe's move list from that point on. A phase at `at: 0` with `form` swaps the foe for that form
// with a fresh Health bar.

const KING = (say) => ({ say, as: 'gs_boneking' });
const CROWN = (say) => ({ say, as: 'gs_crown' });

const foes = {
  // ───────────────────────── Floor 1: The Bone Gate ─────────────────────────
  gs_bonegrunt: {
    id: 'gs_bonegrunt', name: 'Bone Grunt', art: 'gs_bonegrunt', floor: 1,
    base: { hp: 44, atk: 18, def: 1, spd: 3 }, weak: ['spirit'], resist: ['shadow'], traits: [], xp: 10, gold: [3, 6],
    moves: [
      { id: 'rusty_slash', name: 'Rusty Slash', weight: 3, mult: 1, target: 'random',
        lines: { intent: [
          "A Bone Grunt lifts its rusty sword at you. Get ready!",
          "Clack, clack. A Grunt shuffles your way with its blade up.",
          "That Grunt has picked you. Watch the sword.",
        ] } },
      { id: 'skull_butt', name: 'Skull Butt', weight: 1, mult: 1.3, target: 'one',
        lines: { intent: [
          "A Grunt lowers its skull and charges at you. Headfirst!",
          "Its jaw clacks. It is going to headbutt you. Block it!",
        ] } },
    ],
    lines: {
      enter: [
        "Bones rise off the floor and snap together. A Bone Grunt, sword up.",
        "Something rattles in the dark. A skeleton soldier steps out, grinning.",
        "A Bone Grunt pulls itself out of the rubble. It still has its sword. Pity.",
      ],
      defeat: [
        "The Grunt clatters apart into a pile of bones. Stay down.",
        "Crack! It falls to pieces and the skull rolls away.",
        "The green light in its eyes goes out. Just bones now.",
      ],
      weakHint: [
        "Old bones hate ghost-light. Spirit hits them hardest.",
        "Shadow just slides off them. Find something with a bit of spirit.",
      ],
    },
  },

  gs_gravebat: {
    id: 'gs_gravebat', name: 'Grave Bat', art: 'gs_gravebat', floor: 1,
    base: { hp: 32, atk: 16, def: 0, spd: 7 }, weak: ['storm'], resist: [], traits: ['evasive'], xp: 8, gold: [2, 5],
    moves: [
      { id: 'wing_swoop', name: 'Wing Swoop', weight: 3, mult: 0.9, target: 'random',
        lines: { intent: [
          "The Grave Bat folds its wings and dives at you!",
          "Green eyes in the rafters, coming straight for you.",
          "Flap, flap, swoop. It has picked you. Block!",
        ] } },
      { id: 'screech', name: 'Screech', weight: 1, mult: 0.6, target: 'all',
        lines: { intent: [
          "The bat opens its mouth wide. Cover your ears, everyone!",
          "It sucks in a breath. That is going to be a loud one.",
        ] } },
    ],
    lines: {
      enter: [
        "Leathery wings. Green eyes. A Grave Bat as big as a dog drops from the ceiling.",
        "Something big flaps in the dark above you. A Grave Bat. Keep your heads down.",
        "A screech bounces off the walls. A Grave Bat, tattered and fast.",
      ],
      defeat: [
        "The bat flutters, then blows away like a puff of black smoke.",
        "It spins down, down, and bursts into dust. Good riddance.",
        "One last squeak, and the bat is a cloud of ash.",
      ],
      weakHint: [
        "Bats dodge sloppy hits. Strike clean, or you hit nothing.",
        "Lightning loves a flying thing. Storm knocks it right out of the air.",
      ],
    },
  },

  gs_boneshield: {
    id: 'gs_boneshield', name: 'Shield Skeleton', art: 'gs_boneshield', floor: 1,
    base: { hp: 48, atk: 16, def: 2, spd: 2 }, weak: ['spirit'], resist: [], traits: ['guarded'], xp: 12, gold: [3, 7],
    moves: [
      { id: 'shield_shove', name: 'Shield Shove', weight: 2, mult: 1, target: 'one',
        lines: { intent: [
          "The Shield Skeleton braces its tower shield and shoves at you.",
          "A wall of iron is coming at you. Brace!",
        ] } },
      { id: 'spear_jab', name: 'Spear Jab', weight: 2, mult: 1.1, target: 'weakest',
        lines: { intent: [
          "A spear pokes out from behind the shield. It wants you, the tired one.",
          "Jab, jab. It aims for whoever looks weakest. That is you. Block!",
        ] } },
    ],
    lines: {
      enter: [
        "Clang. A skeleton steps out behind a shield taller than you.",
        "A Shield Skeleton. All you can see are its eyes over the iron rim.",
        "Iron scrapes on stone. A tower shield, and something grinning behind it.",
      ],
      defeat: [
        "The shield falls with a huge clang, and the bones behind it fall too.",
        "It topples over backwards. Shield first, skeleton second.",
        "Its bones scatter. The shield spins on the floor like a coin.",
      ],
      weakHint: [
        "That shield is thick. A perfect hit smashes the guard open.",
        "Ghost-light gets round any shield. Spirit hurts it most.",
      ],
    },
  },

  gs_rattlejaw: {
    id: 'gs_rattlejaw', name: 'Rattlejaw the Gatekeeper', art: 'gs_rattlejaw', floor: 1, boss: true, trophy: 'gs_trophy_rattlejaw',
    base: { hp: 370, atk: 14, def: 2, spd: 3 }, weak: ['spirit'], resist: ['shadow'], traits: ['summoner'], xp: 60, gold: [40, 60],
    moves: [
      { id: 'portcullis_slam', name: 'Portcullis Slam', weight: 3, mult: 1.1, target: 'one',
        lines: { intent: [
          "Rattlejaw lifts the portcullis over his head. It is coming down on you!",
          "Iron bars swing your way. Block it, or get flattened!",
          "He swings the gate like a club. You are the nail.",
        ] } },
      { id: 'jaw_rattle', name: 'Jaw Rattle', weight: 2, mult: 0.6, target: 'all',
        lines: { intent: [
          "His jaw starts to chatter. The whole floor shakes. Everybody brace!",
          "Clackclackclack. That rattle is going to hit all of you.",
        ] } },
      { id: 'gate_crash', name: 'Gate Crash', weight: 1, mult: 1.6, target: 'all', telegraph: 'big',
        lines: { intent: [
          "He raises the whole gate high. This is the big one. Perfect block, now!",
          "Rattlejaw roars and the portcullis shakes over all of you. Big hit coming!",
        ] } },
    ],
    phases: [
      { at: 0.5, summon: [{ type: 'gs_bonegrunt', n: 2 }],
        lines: [
          "Rattlejaw bangs his gate twice. Bones climb out of the floor to help him.",
          "He is hurt and he knows it. He calls his Grunts. Here they come!",
          "The gate rings like a bell, and the dead answer it.",
        ] },
    ],
    lines: {
      enter: [
        "The floor shakes. A giant skeleton in rusted armour steps out, carrying a portcullis.",
        "Rattlejaw the Gatekeeper. Nothing gets past him. That is the rumour, anyway.",
        "His jaw clacks open. Green fire behind his teeth. He has been waiting for you.",
      ],
      defeat: [
        "The gate drops. Rattlejaw crumbles into a mountain of old bones. The way is open!",
        "His jaw rattles one last time and falls off. Then the rest of him follows.",
        "Down goes the Gatekeeper. The portcullis rings on the stones like a gong.",
      ],
      weakHint: [
        "Bones hate ghost-light. Hit him with spirit and he really feels it.",
        "When he lifts the whole gate, a perfect block knocks him silly.",
      ],
    },
  },

  // ───────────────────────── Floor 2: The Spider Vaults ─────────────────────────
  gs_webspinner: {
    id: 'gs_webspinner', name: 'Webspinner', art: 'gs_webspinner', floor: 2,
    base: { hp: 114, atk: 34, def: 2, spd: 5 }, weak: ['fire'], resist: [], traits: [], xp: 26, gold: [6, 10],
    moves: [
      { id: 'web_shot', name: 'Web Shot', weight: 2, mult: 0.6, target: 'random',
        effect: { apply: [{ status: 'webbed', turns: 1, to: 'target' }] },
        lines: { intent: [
          "The Webspinner raises its rear. Sticky web, aimed at you!",
          "It is about to glue you to the floor. A perfect block keeps you free!",
        ] } },
      { id: 'spinner_bite', name: 'Fang Bite', weight: 3, mult: 1, target: 'random',
        lines: { intent: [
          "Eight legs, two fangs, one target. You. Block!",
          "The Webspinner skitters at you with its fangs open.",
          "Its markings glow brighter. It is going to bite you.",
        ] } },
    ],
    lines: {
      enter: [
        "Glowing markings in the dark. A spider the size of a dog drops on a thread.",
        "Tick tick tick. A Webspinner walks down the wall toward you.",
        "Webs shiver. Something heavy is climbing down. A Webspinner.",
      ],
      defeat: [
        "Its legs curl up and it crumbles into dry dust.",
        "The markings fade and the spider blows away like old cobweb.",
        "Down it goes. Its web sags and drifts to the floor.",
      ],
      weakHint: [
        "Spiders hate fire. Burn it and watch it run.",
        "A perfect block stops the web from sticking to you.",
      ],
    },
  },

  gs_venomling: {
    id: 'gs_venomling', name: 'Venomlings', art: 'gs_venomling', floor: 2,
    base: { hp: 80, atk: 28, def: 1, spd: 6 }, weak: ['fire'], resist: [], traits: [], xp: 20, gold: [5, 8],
    moves: [
      { id: 'swarm_bite', name: 'Swarm Bite', weight: 3, mult: 0.8, target: 'random',
        effect: { apply: [{ status: 'poison', turns: 3, chance: 0.5, to: 'target' }] },
        lines: { intent: [
          "The swarm pours toward you like a black wave. Lots of tiny fangs!",
          "Hundreds of little legs, all running at you. Block!",
          "The Venomlings swirl up your boots. Shake them off!",
        ] } },
      { id: 'skitter', name: 'Skitter', weight: 1, mult: 0.5, target: 'all',
        lines: { intent: [
          "The swarm splits up and runs at all of you at once!",
          "They scatter everywhere. Everybody stamp your feet!",
        ] } },
    ],
    lines: {
      enter: [
        "The floor moves. No, it is not the floor. It is a swarm of tiny spiders.",
        "Skitter skitter skitter. Venomlings, a whole carpet of them.",
        "A crack in the wall spills out spiders. Lots and lots of spiders.",
      ],
      defeat: [
        "The swarm scatters into the cracks and does not come back.",
        "Pop pop pop. The little spiders burst into puffs of dust.",
        "The last Venomling curls up and blows away. Phew.",
      ],
      weakHint: [
        "A swarm burns fast. Fire is the answer here.",
        "Their bites leave poison. Kill them quick before it stacks up.",
      ],
    },
  },

  gs_husk: {
    id: 'gs_husk', name: 'Cocoon Husk', art: 'gs_husk', floor: 2,
    base: { hp: 128, atk: 28, def: 4, spd: 1 }, weak: ['fire'], resist: ['frost'], traits: [], xp: 30, gold: [7, 12],
    moves: [
      { id: 'husk_slam', name: 'Husk Slam', weight: 3, mult: 1.2, target: 'one',
        lines: { intent: [
          "The Husk lifts its wrapped arms high over you. Slow, but heavy!",
          "Thump. Thump. It lumbers at you. Block that slam!",
        ] } },
      { id: 'web_grab', name: 'Web Grab', weight: 1, mult: 0.8, target: 'random',
        effect: { apply: [{ status: 'webbed', turns: 1, chance: 0.6, to: 'target' }] },
        lines: { intent: [
          "Sticky strands trail off its arms. It reaches for you!",
          "It wants to wrap you up like itself. Block it clean!",
        ] } },
    ],
    lines: {
      enter: [
        "A shape wrapped in grey web shuffles out of the dark. A Cocoon Husk.",
        "Something wrapped in old silk groans and starts to walk. Slowly. Toward you.",
        "The web on the wall tears open. Out steps a Husk, dragging its feet.",
      ],
      defeat: [
        "The web unravels and there is nothing inside but dust.",
        "It sags, sighs, and falls into a heap of old silk.",
        "The Husk crumples like a paper lantern. Done.",
      ],
      weakHint: [
        "Old web burns like dry grass. Fire, fire, fire.",
        "Ice does nothing to it. It is wrapped up too warm.",
      ],
    },
  },

  gs_silkfang: {
    id: 'gs_silkfang', name: 'Queen Silkfang', art: 'gs_silkfang', floor: 2, boss: true, trophy: 'gs_trophy_silkfang',
    base: { hp: 560, atk: 17, def: 3, spd: 4 }, weak: ['fire'], resist: ['shadow'], traits: ['cocoon', 'summoner'], xp: 160, gold: [70, 100],
    moves: [
      { id: 'queen_fang', name: 'Queen Fang', weight: 3, mult: 1.1, target: 'random',
        effect: { apply: [{ status: 'poison', turns: 3, chance: 0.4, to: 'target' }] },
        lines: { intent: [
          "Silkfang rears up and her fangs drip green. She wants you!",
          "The Queen lunges at you. Fangs first. Block!",
          "Her crown markings blaze. She strikes at you!",
        ] } },
      { id: 'web_storm', name: 'Web Storm', weight: 2, mult: 0.6, target: 'all',
        effect: { apply: [{ status: 'webbed', turns: 1, chance: 0.3, to: 'target' }] },
        lines: { intent: [
          "She sprays web across the whole room. Everybody block!",
          "Strands fly everywhere. Do not get stuck!",
        ] } },
      { id: 'spin_cocoon', name: 'Spin Cocoon', weight: 1, mult: 0.4, target: 'strongest',
        effect: { apply: [{ status: 'cocoon', turns: 2, to: 'target' }] },
        lines: { intent: [
          "She grabs at you with four legs. She wants to wrap you up!",
          "Silkfang is spinning a cocoon. A perfect block keeps you free!",
        ] } },
      { id: 'venom_rain', name: 'Venom Rain', weight: 1, mult: 1.5, target: 'all', telegraph: 'big',
        effect: { apply: [{ status: 'poison', turns: 3, chance: 0.5, to: 'target' }] },
        lines: { intent: [
          "She climbs to the ceiling. Green drops are gathering. Big one, block it perfect!",
          "The Queen hisses and venom rains from above. Everyone, perfect block!",
        ] } },
    ],
    phases: [
      { at: 0.5, summon: [{ type: 'gs_venomling', n: 2 }],
        lines: [
          "Silkfang screeches. Her egg sacs split open. Babies!",
          "Hundreds of little legs spill out of the walls. She called her swarm.",
          "The Queen is angry now. And she brought her children.",
        ] },
    ],
    lines: {
      enter: [
        "The biggest web you have ever seen. In the middle sits a spider wearing a crown.",
        "Queen Silkfang. Her markings glow like a crown of green fire.",
        "Eight eyes open in the dark, one after another. The Queen is awake.",
      ],
      defeat: [
        "The Queen curls up and crumbles. Her whole web falls down like snow.",
        "Silkfang shrieks and turns to dust. The vaults go quiet.",
        "Her crown markings flicker out. The Spider Vaults are yours.",
      ],
      weakHint: [
        "Spiders and fire. You know what to do.",
        "If she wraps a friend, strike the cocoon to cut them loose.",
      ],
    },
  },

  // ───────────────────────── Floor 3: The Molten Forge ─────────────────────────
  gs_cinderimp: {
    id: 'gs_cinderimp', name: 'Cinder Imp', art: 'gs_cinderimp', floor: 3,
    base: { hp: 88, atk: 31, def: 2, spd: 6 }, weak: ['frost'], resist: ['fire'], traits: ['explodes'], xp: 28, gold: [10, 15],
    moves: [
      { id: 'coal_toss', name: 'Coal Toss', weight: 3, mult: 0.9, element: 'fire', target: 'random',
        effect: { apply: [{ status: 'burn', turns: 3, chance: 0.3, to: 'target' }] },
        lines: { intent: [
          "The imp juggles a red-hot coal and throws it at you!",
          "Hee hee hee. It picks a glowing lump and aims at you.",
          "A Cinder Imp winds up a fiery pitch. Catch it on your shield!",
        ] } },
      { id: 'spark_spit', name: 'Spark Spit', weight: 1, mult: 0.6, element: 'fire', target: 'all',
        lines: { intent: [
          "It puffs up its cheeks. Sparks for everyone!",
          "The imp grins and spits fire across all of you.",
        ] } },
    ],
    lines: {
      enter: [
        "A lump of coal sits up and grins at you. A Cinder Imp!",
        "Giggling in the fire. Little glowing imps hop out of the coals.",
        "Something small and burning cartwheels across the floor. Watch it.",
      ],
      defeat: [
        "The imp swells up, glows white, and BOOM. Block the blast!",
        "It pops like a firework. Little sparks everywhere.",
        "The imp bursts into a shower of embers. Mind your eyebrows.",
      ],
      weakHint: [
        "Ice puts out its fire. Frost hits it hardest.",
        "It explodes when it falls. Be ready to block when it goes.",
      ],
    },
  },

  gs_magmahound: {
    id: 'gs_magmahound', name: 'Magma Hound', art: 'gs_magmahound', floor: 3,
    base: { hp: 116, atk: 35, def: 3, spd: 7 }, weak: ['frost'], resist: ['fire'], traits: [], xp: 32, gold: [11, 16],
    moves: [
      { id: 'lava_bite', name: 'Lava Bite', weight: 3, mult: 1, element: 'fire', target: 'random',
        effect: { apply: [{ status: 'burn', turns: 3, chance: 0.5, to: 'target' }] },
        lines: { intent: [
          "The Magma Hound opens jaws full of lava and leaps at you!",
          "Its cracks glow brighter. It is going for your leg. Block!",
          "A growl like rocks grinding. It wants a bite of you.",
        ] } },
      { id: 'pounce', name: 'Pounce', weight: 2, mult: 1.3, target: 'weakest',
        lines: { intent: [
          "It crouches low. It is going to pounce on you, the hurt one!",
          "The hound smells weakness. It leaps at you. Shield up!",
        ] } },
    ],
    lines: {
      enter: [
        "A hound of cracked black rock steps out of the lava. Its eyes are molten.",
        "Hot breath. Heavy paws. A Magma Hound, and it is hungry.",
        "The lava bubbles and a dog of stone and fire climbs out, shaking off sparks.",
      ],
      defeat: [
        "The hound cools, cracks, and falls into a pile of grey rocks.",
        "Its fire goes out with a hiss. Just stones now.",
        "It howls once and crumbles into smoking gravel.",
      ],
      weakHint: [
        "Cold cracks hot rock. Hit it with frost.",
        "Fire just warms it up. Do not bother.",
      ],
    },
  },

  gs_ironsentry: {
    id: 'gs_ironsentry', name: 'Iron Sentry', art: 'gs_ironsentry', floor: 3,
    base: { hp: 160, atk: 33, def: 5, spd: 2 }, weak: ['storm'], resist: [], traits: ['armored'], xp: 36, gold: [12, 18],
    moves: [
      { id: 'iron_fist', name: 'Iron Fist', weight: 3, mult: 1.1, target: 'one',
        lines: { intent: [
          "The Sentry raises a fist like an anvil over you. Block it!",
          "Clank. Clank. Its glowing slit turns to you. Here comes the punch.",
        ] } },
      { id: 'steam_vent', name: 'Steam Vent', weight: 1, mult: 0.7, element: 'fire', target: 'all',
        lines: { intent: [
          "Its armour hisses. Hot steam is about to blast all of you!",
          "Every joint starts whistling. Steam for everyone. Brace!",
        ] } },
    ],
    lines: {
      enter: [
        "An empty suit of forge-armour stands up by itself. One slit glows orange.",
        "Clank. Clank. An Iron Sentry marches out of the smoke.",
        "Steam hisses from a giant suit of iron. Nobody is inside it. It moves anyway.",
      ],
      defeat: [
        "The Sentry falls apart, plate by plate, with a great crash.",
        "Its slit flickers out. The armour clatters to the floor, empty.",
        "Bang, clang, crash. It sounds like a kitchen falling down stairs.",
      ],
      weakHint: [
        "Plain hits bounce off that armour. Use fire, frost, storm, anything magic.",
        "Lightning loves iron. Storm hits it hardest.",
      ],
    },
  },

  gs_brann: {
    id: 'gs_brann', name: 'Forgemaster Brann', art: 'gs_brann', floor: 3, boss: true, trophy: 'gs_trophy_brann',
    base: { hp: 880, atk: 23, def: 4, spd: 3 }, weak: ['frost'], resist: ['fire'], traits: ['heat'], xp: 200, gold: [110, 150],
    moves: [
      { id: 'molten_hammer', name: 'Molten Hammer', weight: 3, mult: 1.1, element: 'fire', target: 'one',
        lines: { intent: [
          "Brann swings his anvil hammer at you. Block, or be flattened!",
          "The hammer glows white hot over your head. Shield up!",
          "He spits on his palms. You are the anvil now.",
        ] } },
      { id: 'spark_shower', name: 'Spark Shower', weight: 2, mult: 0.6, element: 'fire', target: 'all',
        effect: { apply: [{ status: 'burn', turns: 3, chance: 0.3, to: 'target' }] },
        lines: { intent: [
          "He beats his apron and sparks fly at all of you!",
          "Brann strikes the floor and a shower of sparks rains down. Brace!",
        ] } },
      { id: 'anvil_fall', name: 'Anvil Fall', weight: 1, mult: 1.6, element: 'fire', target: 'all', telegraph: 'big',
        lines: { intent: [
          "Brann lifts a whole anvil over his head. Big one! Perfect block!",
          "The forge roars. He is about to drop something very heavy on all of you.",
        ] } },
    ],
    phases: [
      { at: 0.5,
        moves: [
          { id: 'molten_hammer', name: 'Molten Hammer', weight: 3, mult: 1.2, element: 'fire', target: 'one',
            lines: { intent: [
              "Brann swings faster now. The hammer is coming for you!",
              "His hammer drips lava. It is aimed right at you. Block!",
            ] } },
          { id: 'lava_wave', name: 'Lava Wave', weight: 2, mult: 0.8, element: 'fire', target: 'all',
            effect: { apply: [{ status: 'burn', turns: 3, chance: 0.4, to: 'target' }] },
            lines: { intent: [
              "He kicks over a vat. Lava rolls toward all of you!",
              "A wave of glowing metal sloshes across the floor. Brace!",
            ] } },
          { id: 'anvil_fall', name: 'Anvil Fall', weight: 1, mult: 1.6, element: 'fire', target: 'all', telegraph: 'big',
            lines: { intent: [
              "Another anvil goes up. Perfect block, and he is wide open!",
              "Brann roars and lifts the anvil high. Here it comes. Perfect block!",
            ] } },
        ],
        lines: [
          "Brann laughs like a bellows. The forge behind him burns white. It is getting hotter.",
          "His apron glows red. Every round he burns hotter. Cool him down!",
          "Frost on him, or perfect blocks. Otherwise he just keeps heating up.",
        ] },
    ],
    lines: {
      enter: [
        "A giant of molten rock wipes his hands on an iron apron. Forgemaster Brann.",
        "Clang. Clang. He is hammering something. He stops. He looks at you.",
        "The forge roars. Brann lifts a hammer the size of an anvil. He has a new job.",
      ],
      defeat: [
        "Brann cools, cracks and falls like a mountain. The forge goes dark.",
        "His hammer hits the floor. Then he does. Then a lot of steam.",
        "The Forgemaster turns to black stone, mid-swing. Done.",
      ],
      weakHint: [
        "He gets hotter every round. Frost or a perfect block cools him right down.",
        "Fire is his home. Ice is his enemy.",
      ],
    },
  },

  // ───────────────────────── Floor 4: The Frozen Library ─────────────────────────
  gs_frostwraith: {
    id: 'gs_frostwraith', name: 'Frost Wraith', art: 'gs_frostwraith', floor: 4,
    base: { hp: 180, atk: 58, def: 3, spd: 6 }, weak: ['fire'], resist: ['frost'], traits: [], xp: 55, gold: [14, 20],
    moves: [
      { id: 'frost_touch', name: 'Frost Touch', weight: 3, mult: 1, element: 'frost', target: 'random',
        effect: { apply: [{ status: 'chill', turns: 2, chance: 0.5, to: 'target' }] },
        lines: { intent: [
          "The Wraith drifts close and reaches a cold hand toward you.",
          "Your breath turns white. It is coming for you. Block!",
          "Frost creeps across the floor to your boots. It is about to touch you.",
        ] } },
      { id: 'cold_wail', name: 'Cold Wail', weight: 1, mult: 0.6, element: 'frost', target: 'all',
        lines: { intent: [
          "The Wraith opens its hood and lets out a freezing wail. Everyone brace!",
          "A howl like winter wind is about to hit all of you.",
        ] } },
    ],
    lines: {
      enter: [
        "A hooded shape of ice mist floats between the shelves. A Frost Wraith.",
        "The candles shiver and go blue. Something cold is here.",
        "Snow falls inside the library. Out of it drifts a Wraith, with no feet at all.",
      ],
      defeat: [
        "The Wraith melts into a little puddle and steams away.",
        "It sighs like a cold wind and blows out like a candle.",
        "The mist thins and is gone. The air warms up a little.",
      ],
      weakHint: [
        "Ice ghosts melt. Fire hits it hardest.",
        "Its touch slows you down. Shake off the chill with a good block.",
      ],
    },
  },

  gs_cursedtome: {
    id: 'gs_cursedtome', name: 'Cursed Tome', art: 'gs_cursedtome', floor: 4,
    base: { hp: 152, atk: 55, def: 3, spd: 7 }, weak: ['fire'], resist: [], traits: [], xp: 50, gold: [13, 19],
    moves: [
      { id: 'page_snap', name: 'Page Snap', weight: 3, mult: 1, target: 'random',
        lines: { intent: [
          "The book flaps open. Teeth! It is flying at you!",
          "Snap, snap, snap. That book wants a bite of you.",
          "It riffles its pages like a growl and dives at you.",
        ] } },
      { id: 'hush', name: 'Hush', weight: 1, mult: 0.5, target: 'random',
        effect: { apply: [{ status: 'silenced', turns: 1, to: 'target' }] },
        lines: { intent: [
          "The Tome whispers SHHH at you. Block it perfect, or no skills next turn!",
          "Its pages glow grey. It wants to hush you up.",
        ] } },
    ],
    lines: {
      enter: [
        "A book flaps off the shelf by itself. It has teeth. Of course it does.",
        "Rustle, rustle, SNAP. A Cursed Tome, flapping like a mad bird.",
        "The books are whispering. One of them opens its cover and grins.",
      ],
      defeat: [
        "The Tome slams shut and drops. Its pages flutter away.",
        "It bursts into loose pages that float down like snow.",
        "Thump. Closed for good. Nobody is borrowing that one.",
      ],
      weakHint: [
        "It is paper. Paper and fire. Easy.",
        "If it hushes you, you cannot use skills. A perfect block stops it.",
      ],
    },
  },

  gs_icegargoyle: {
    id: 'gs_icegargoyle', name: 'Ice Gargoyle', art: 'gs_icegargoyle', floor: 4,
    base: { hp: 194, atk: 56, def: 5, spd: 3 }, weak: ['storm'], resist: ['frost'], traits: ['stoneform'], xp: 62, gold: [15, 22],
    moves: [
      { id: 'ice_claw', name: 'Ice Claw', weight: 3, mult: 1.2, element: 'frost', target: 'random',
        lines: { intent: [
          "The Gargoyle cracks its wings open and slashes at you!",
          "Icy claws, aimed at you. Block it!",
        ] } },
      { id: 'dive', name: 'Diving Crash', weight: 1, mult: 1.5, target: 'weakest',
        lines: { intent: [
          "It flies up to the ceiling and dives at you, the hurt one. Shield!",
          "Wings folded, coming straight down at you. Block!",
        ] } },
    ],
    lines: {
      enter: [
        "A statue of blue ice blinks. Then it spreads its wings.",
        "Crack. Crack. An Ice Gargoyle pulls itself off the wall.",
        "The statue on the bookcase was not a statue. It is looking at you.",
      ],
      defeat: [
        "The Gargoyle shatters into a thousand tinkling pieces.",
        "It cracks down the middle and falls into ice cubes.",
        "Smash! Blue shards slide across the floor.",
      ],
      weakHint: [
        "Every other turn it turns to stone. Hit it when it is ice, not stone.",
        "Lightning cracks ice. Storm hits it hardest.",
      ],
    },
  },

  gs_vex: {
    id: 'gs_vex', name: 'Archivist Vex', art: 'gs_vex', floor: 4, boss: true, trophy: 'gs_trophy_vex',
    base: { hp: 1040, atk: 42, def: 4, spd: 5 }, weak: ['fire'], resist: ['frost'], traits: ['pagecast', 'summoner'], xp: 360, gold: [150, 200],
    moves: [
      { id: 'page_of_frost', name: 'Page of Frost', weight: 2, mult: 1.1, element: 'frost', target: 'random',
        effect: { apply: [{ status: 'chill', turns: 2, chance: 0.4, to: 'target' }] },
        lines: { intent: [
          "Vex tears out a blue page. Frost is coming for you!",
          "The frost page glows. Burn him while it shows!",
        ] } },
      { id: 'page_of_storm', name: 'Page of Storm', weight: 2, mult: 1.1, element: 'storm', target: 'random',
        lines: { intent: [
          "A page crackles with lightning. He aims it at you!",
          "Storm page! Thunder is coming for you. Block!",
        ] } },
      { id: 'page_of_shadow', name: 'Page of Shadow', weight: 2, mult: 0.7, element: 'shadow', target: 'all',
        effect: { apply: [{ status: 'silenced', turns: 1, chance: 0.3, to: 'target' }] },
        lines: { intent: [
          "A black page opens. Shadows spill out over all of you!",
          "Shadow page. It wants to hush every one of you. Block!",
        ] } },
      { id: 'blizzard_of_pages', name: 'Blizzard of Pages', weight: 1, mult: 1.6, element: 'frost', target: 'all', telegraph: 'big',
        lines: { intent: [
          "Every book flies open. A blizzard of frozen pages! Perfect block!",
          "Vex raises both arms. The whole library is about to hit you. Big one!",
        ] } },
    ],
    phases: [
      { at: 0.5, summon: [{ type: 'gs_cursedtome', n: 2 }],
        lines: [
          "Vex screams without a mouth. Books tear off the shelves and fly to him.",
          "The Archivist calls his books. They come snapping!",
          "Shelves crash. Two Tomes flap down beside him, teeth first.",
        ] },
    ],
    lines: {
      enter: [
        "Pages swirl like snow into a tall robed shape. Archivist Vex. He has no face.",
        "Every book in the library opens at once. Then they all go quiet. He is here.",
        "A spectre of frost and paper. He turns a page. It is about you.",
      ],
      defeat: [
        "Vex comes apart into a whirl of pages that fall like snow. Silence.",
        "His frost melts away and the pages turn to plain paper. Just a library now.",
        "The Archivist closes. Forever. The ice on the shelves begins to drip.",
      ],
      weakHint: [
        "Watch his page. It shows his next attack, and the opposite hurts him.",
        "Frost does nothing to him. Fire is your friend here.",
      ],
    },
  },

  // ───────────────────────── Floor 5: The Throne of Bones ─────────────────────────
  gs_boneknight: {
    id: 'gs_boneknight', name: 'Bone Knight', art: 'gs_boneknight', floor: 5,
    base: { hp: 200, atk: 55, def: 6, spd: 4 }, weak: ['spirit'], resist: ['shadow'], traits: ['counter'], xp: 70, gold: [20, 30],
    moves: [
      { id: 'black_blade', name: 'Black Blade', weight: 3, mult: 1.1, target: 'random',
        lines: { intent: [
          "The Bone Knight raises a black sword and steps toward you.",
          "A clean, cold swing is coming at you. Block it!",
          "It salutes you with its blade. Then it attacks.",
        ] } },
      { id: 'crushing_blow', name: 'Crushing Blow', weight: 1, mult: 1.6, target: 'one',
        lines: { intent: [
          "Two hands on the sword, high over its helm. A huge hit is coming at you!",
          "It plants its feet. This one is going to hurt you. Shield!",
        ] } },
    ],
    lines: {
      enter: [
        "Black plate, green eyes, a sword that drinks the light. A Bone Knight.",
        "Heavy boots on bone. The King's knights do not shuffle. They march.",
        "A Bone Knight draws its sword slowly. It has done this a thousand times.",
      ],
      defeat: [
        "The Knight drops to one knee. Then it falls apart inside its armour.",
        "Its sword clatters down and the black plate is suddenly empty.",
        "A last salute, and the knight turns to dust.",
      ],
      weakHint: [
        "Sloppy hits get punished. It hits back at a weak strike.",
        "Ghost-light breaks old bones. Spirit hurts it most.",
      ],
    },
  },

  gs_shadowstalker: {
    id: 'gs_shadowstalker', name: 'Shadow Stalker', art: 'gs_shadowstalker', floor: 5,
    base: { hp: 152, atk: 53, def: 3, spd: 8 }, weak: ['spirit'], resist: ['shadow'], traits: ['stealth'], xp: 64, gold: [18, 28],
    moves: [
      { id: 'shadow_claw', name: 'Shadow Claw', weight: 3, mult: 1, element: 'shadow', target: 'weakest',
        lines: { intent: [
          "Two white eyes open right behind you. Block!",
          "The Stalker slides across the floor toward you, the tired one.",
          "Claws of smoke reach for you. Quick!",
        ] } },
      { id: 'fade_strike', name: 'Fade Strike', weight: 1, mult: 1.4, element: 'shadow', target: 'random',
        lines: { intent: [
          "It vanishes. Where did it go? There! At you!",
          "Shadow folds in on itself and leaps at you from nowhere.",
        ] } },
    ],
    lines: {
      enter: [
        "Your torchlight bends. A thin shape of shadow stands where no shadow should be.",
        "Two white eyes in the dark. Then they blink out. A Shadow Stalker.",
        "Something follows you along the wall. It is your shadow. Except it is not.",
      ],
      defeat: [
        "Light floods in and the Stalker simply is not there any more.",
        "It shrieks like wind through a keyhole and fades away.",
        "The shadow tears like a rag and blows apart.",
      ],
      weakHint: [
        "It hides every other turn. Mark it and it has nowhere to hide.",
        "Shadow cannot hurt a shadow. Use spirit light.",
      ],
    },
  },

  gs_crownguard: {
    id: 'gs_crownguard', name: 'Crown Guard', art: 'gs_crownguard', floor: 5,
    base: { hp: 172, atk: 44, def: 5, spd: 3 }, weak: ['spirit'], resist: [], traits: ['aura'], xp: 60, gold: [18, 28],
    moves: [
      { id: 'banner_strike', name: 'Banner Strike', weight: 3, mult: 0.9, target: 'random',
        lines: { intent: [
          "The Crown Guard swings its heavy banner pole at you.",
          "The standard comes down at you like a club. Block!",
        ] } },
      { id: 'dread_horn', name: 'Dread Horn', weight: 1, mult: 0.5, target: 'all',
        lines: { intent: [
          "It lifts a bone horn. That blast will hit all of you!",
          "A long, low horn note is coming. Everyone brace!",
        ] } },
    ],
    lines: {
      enter: [
        "A skeleton holds up a tattered banner with a crown on it. The others stand taller.",
        "A Crown Guard plants its banner in the floor. The dead around it start to glow.",
        "The banner flaps without any wind. Under it stands a Crown Guard.",
      ],
      defeat: [
        "The banner falls and burns away in green fire. The others look less sure now.",
        "The Guard crumbles, still holding its pole.",
        "Down comes the banner. Down comes the Guard.",
      ],
      weakHint: [
        "While it stands, its friends hit harder. Knock it down first.",
        "Old bones again. Spirit, if you have it.",
      ],
    },
  },

  gs_marrowmaw: {
    id: 'gs_marrowmaw', name: 'Marrowmaw, the Bone Dragon', art: 'gs_marrowmaw', floor: 5, boss: true, trophy: 'gs_trophy_marrowmaw',
    base: { hp: 1640, atk: 62, def: 5, spd: 4 }, weak: ['spirit'], resist: ['shadow'], traits: [], xp: 400, gold: [180, 240],
    moves: [
      { id: 'bone_bite', name: 'Bone Bite', weight: 3, mult: 1.1, target: 'random',
        lines: { intent: [
          "The dragon's skull swings down at you, jaws wide. Block!",
          "Teeth like swords, coming for you!",
          "Marrowmaw snaps at you. Its jaw is bigger than a door.",
        ] } },
      { id: 'tail_sweep', name: 'Tail Sweep', weight: 2, mult: 0.7, target: 'all',
        lines: { intent: [
          "A tail of bones whips round the whole room. Everybody block!",
          "It turns. The tail is coming. Brace, all of you!",
        ] } },
      { id: 'grave_fire', name: 'Grave Fire', weight: 1, mult: 1.35, element: 'shadow', target: 'all', telegraph: 'big',
        lines: { intent: [
          "Green fire fills its ribs. It is going to breathe. Perfect block, now!",
          "Marrowmaw rears up, ribs blazing. Big one! Block it perfect!",
        ] } },
    ],
    phases: [
      { at: 0.5,
        lines: [
          "Marrowmaw roars. The fire in its ribs burns twice as bright.",
          "It is hurt. Bones fall off it. It does not care. It is angry.",
          "The dragon beats its bony wings. Dust everywhere. Hold on!",
        ] },
    ],
    lines: {
      enter: [
        "The floor is not a floor. It is a rib. The whole room stands up. It is a dragon.",
        "A dragon skeleton, green fire burning in its chest. Marrowmaw.",
        "It lifts its skull and looks at you. There is nothing in the eyes but fire.",
      ],
      defeat: [
        "The green fire in its ribs goes out. Marrowmaw falls in a rain of bones.",
        "The dragon groans and collapses. The whole tower shakes.",
        "Marrowmaw breaks apart like a falling cliff. Only the king is left.",
      ],
      weakHint: [
        "It is all bone. Spirit hits it hardest.",
        "When the ribs glow, a perfect block stuns it. Then hit hard.",
      ],
    },
  },

  gs_boneking: {
    id: 'gs_boneking', name: 'The Bone King', art: 'gs_boneking', floor: 5, boss: true,
    base: { hp: 1240, atk: 35, def: 6, spd: 4 }, weak: ['spirit'], resist: ['shadow'], traits: ['summoner'], xp: 0, gold: [0, 0],
    moves: [
      { id: 'royal_blade', name: 'Royal Blade', weight: 3, mult: 1.1, element: 'shadow', target: 'random',
        lines: { intent: [
          "The King lifts his rusted sword and points it at you. Block!",
          "He walks at you, slow and certain. The sword comes down.",
          "A royal swing, aimed at you. Shield up!",
        ] } },
      { id: 'crown_flare', name: 'Crown Flare', weight: 2, mult: 0.7, element: 'shadow', target: 'all',
        effect: { apply: [{ status: 'curse', turns: 3, chance: 0.3, to: 'target' }] },
        lines: { intent: [
          "The crown on his head flares green. All of you, brace!",
          "Green fire pulses out from the crown. Block it!",
        ] } },
      { id: 'kings_judgement', name: "King's Judgement", weight: 1, mult: 1.7, element: 'shadow', target: 'all', telegraph: 'big',
        lines: { intent: [
          "He raises his sword to the ceiling. Green lightning gathers. Perfect block!",
          "The King says one word and the room goes dark. Big one coming!",
        ] } },
    ],
    phases: [
      { at: 0.5, summon: [{ type: 'gs_crownguard', n: 2 }],
        lines: [
          KING("Guards. To your king."),
          "Banners rise out of the floor. The King has called his guard.",
          KING("You climb so far, only to kneel here."),
        ] },
      { at: 0, form: 'gs_hollowcrown',
        lines: [
          KING("At last. Thank you. Now... run."),
          "The King falls. But the crown does not. It floats up. Off his skull. Into the air.",
          CROWN("He was only my throne. I am the king of this tower."),
          "The crown burns, grows, wears a shape of green fire. That is the real monster.",
        ] },
    ],
    lines: {
      enter: [
        KING("So. Hunters. At my door, with your little lights."),
        KING("Kneel, and I will let the tower keep you."),
        "The King stands up from his throne. Bones creak. Green fire in his eyes.",
      ],
      defeat: [
        "The Bone King drops his sword. He looks almost grateful.",
        "He sinks to his knees. The crown on his head is still burning.",
        "The King is down. Wait. Why is the crown still glowing?",
      ],
      weakHint: [
        "Bones and shadow. You know by now. Spirit hits him hardest.",
        "When he raises the sword high, a perfect block knocks him back.",
      ],
    },
  },

  gs_hollowcrown: {
    id: 'gs_hollowcrown', name: 'The Hollow Crown', art: 'gs_hollowcrown', floor: 5, boss: true,
    base: { hp: 1440, atk: 36, def: 5, spd: 6 }, weak: ['spirit'], resist: ['shadow'], traits: [], xp: 600, gold: [300, 400],
    moves: [
      { id: 'soul_hunger', name: 'Soul Hunger', weight: 3, mult: 1.1, element: 'shadow', target: 'random',
        lines: { intent: [
          "A hand of green fire reaches for you. Block it!",
          "The Crown hisses your way. It is hungry for you.",
          "Fingers of fire stretch out. They want you!",
        ] } },
      { id: 'thousand_whispers', name: 'Thousand Whispers', weight: 2, mult: 0.6, target: 'all',
        effect: { apply: [{ status: 'curse', turns: 3, chance: 0.4, to: 'target' }] },
        lines: { intent: [
          "Whispers in every corner. They are coming for all of you. Block!",
          "The Crown hisses a thousand voices at once. Brace!",
        ] } },
      { id: 'crown_grip', name: 'Crown Grip', weight: 1, mult: 0.8, target: 'strongest',
        effect: { apply: [{ status: 'silenced', turns: 1, to: 'target' }] },
        lines: { intent: [
          "The Crown grips your mind. A perfect block shakes it off!",
          "Green rings tighten around you. Block, or no skills!",
        ] } },
      { id: 'green_inferno', name: 'Green Inferno', weight: 1, mult: 1.7, element: 'shadow', target: 'all', telegraph: 'big',
        lines: { intent: [
          "The whole Crown blazes. Green fire, everywhere. Perfect block, all of you!",
          "It sucks in every flame in the tower. This is the biggest one. Block it perfect!",
        ] } },
    ],
    phases: [
      { at: 0.5,
        lines: [
          CROWN("Your lights are small. My hunger is not."),
          "A crack runs across the Crown. A thin one. But you heard it.",
          CROWN("I have outlived a hundred kings. I will outlive you."),
        ] },
      { at: 0.2,
        lines: [
          "The Crown shrieks. Its fire flickers. It is breaking!",
          CROWN("No. No! I will not be a trinket again!"),
          "One more push, hunters. One more!",
        ] },
    ],
    lines: {
      enter: [
        CROWN("Little lights. I have eaten braver."),
        CROWN("The king was mine. The tower is mine. Now you."),
        "A tower of green fire, wearing itself as a crown. The Hollow Crown.",
      ],
      defeat: [
        CROWN("Nooo..."),
        "The fire goes out. The Crown drops to the floor with a small, sad clink.",
        "Silence. Just a dented old crown on the stones. You did it.",
      ],
      weakHint: [
        "It is the thing that kept the dead awake. Spirit light burns it.",
        "Shadow feeds it. Use anything else.",
      ],
    },
  },
};

export default foes;
