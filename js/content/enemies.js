// Foes: numbers from SPEC 5. Hearts are for a party of 2+ (combat trims 25% for a lone hero).
// "you" in foe lines is the hero being targeted.

const enemies = {
  thornling: {
    id: 'thornling', name: 'Thornling', plural: 'Thornlings', art: 'thornling',
    hp: 10, guard: 10, toHit: 2, resolve: 6, befriend: { dc: 9, verb: 'Befriend' },
    likes: ['song'], weak: ['light'],
    moves: [
      { id: 'thorn_slap', name: 'Thorn Slap', weight: 3, target: 'random', damage: '1d4',
        lines: {
          intent: [
            "A Thornling scuttles toward you, waving a prickly little fist.",
            "A Thornling winds up its arm like a bramble whip. You're next.",
            "A Thornling sticks its tongue out at you and charges.",
            "A Thornling hops from foot to foot, eyeing your ankles.",
            "One Thornling points at you and giggles. That's never good.",
            "A Thornling bristles all over and stomps your way.",
          ],
          hit: [
            "Slap! Tiny thorns, big sting.",
            "It whacks your shin and cackles. Ow, ow, ow.",
            "Thwap. It leaves a little scratch and a lot of attitude.",
            "Prickly! It slaps your hand and leaps back, delighted.",
            "It gets you right on the knee. Small, but very pointy.",
            "A slap like a nettle. You'll feel that one tomorrow.",
          ],
          miss: [
            "It swings, misses, and spins round into a bush.",
            "Its slap bounces off you. It looks at its hand, offended.",
            "You step aside. It slaps the air very hard.",
            "It trips on its own roots before it gets there.",
            "It swings and gets tangled in its own prickles. Embarrassing.",
            "Whiff! It misses and pretends it was waving.",
          ],
        } },
      { id: 'prickle_toss', name: 'Prickle Toss', weight: 2, target: 'random', damage: '1d4',
        lines: {
          intent: [
            "A Thornling plucks a burr from its head and takes aim at you.",
            "A Thornling rolls a prickle ball between its palms, looking your way.",
            "A Thornling winds up a spiky little throw at you.",
            "A Thornling licks its thumb, holds it up to the wind, and aims at you.",
          ],
          hit: [
            "Thwick! A burr sticks right in your sleeve. Itchy!",
            "The prickle ball bonks you and clings on.",
            "Got you. A burr in the hair, of all places.",
            "Bullseye. It does a tiny victory dance.",
          ],
          miss: [
            "The burr sails over your head and sticks to a tree.",
            "It throws, and the prickle ball bounces right back and hits it instead.",
            "You duck. The burr lands in another Thornling. They argue.",
            "A wild throw. Somewhere in the woods, an owl says ow.",
          ],
        } },
    ],
    lines: {
      enter: [
        "Bushes rustle, and out pop the Thornlings: knee-high, all prickles and giggles.",
        "A Thornling drops from a branch, all elbows and thorns.",
        "Something small and spiky cartwheels out of the brambles.",
        "A Thornling pops up from the undergrowth and blows a raspberry.",
      ],
      hurt: [
        "The Thornling yelps and loses a leaf.",
        "Ow! It hops about, shaking its prickles.",
        "It squeaks and rubs its bottom.",
        "A few thorns fall off. It looks very cross about it.",
        "It wobbles, blinking, all its leaves standing on end.",
      ],
      flee: [
        "With a squeak, the Thornling dives back into the brambles.",
        "It bursts into a puff of leaves and scuttles off, sulking.",
        "The Thornling rolls away like a tumbleweed, yelling about being late.",
        "It scampers up a tree and refuses to come down.",
      ],
      befriended: [
        "The Thornling stops, sways to the music, and gives you a very prickly hug.",
        "It grins with all its tiny teeth and pats your boot. Friends!",
        "The Thornling puts a little flower behind your ear. That means yes.",
        "It giggles, bows, and does a wobbly happy dance.",
      ],
      weakHint: [
        "See how the Thornlings squint and shrink back whenever a light flares? They hate bright light.",
        "Every time somebody hums, the Thornlings stop to listen. They love music. I wonder if they'd rather be friends.",
        "That one is swaying to the sound of the wind. A song might win it over.",
        "Bramble sprites live in the dark. A flash of light makes them jump right out of their prickles.",
        "Those little ones aren't wicked, only bored and grumpy. A kind word might go a long way.",
      ],
    },
  },

  gloop: {
    id: 'gloop', name: 'Gloop', plural: 'Gloops', art: 'gloop',
    hp: 15, guard: 9, toHit: 2, resolve: 8, befriend: { dc: 11, verb: 'Befriend' },
    likes: ['honeycake'], weak: ['light'],
    moves: [
      { id: 'glomp', name: 'Glomp', weight: 3, target: 'random', damage: '1d6',
        lines: {
          intent: [
            "The Gloop wobbles toward you, wide and grinning.",
            "A Gloop rears up like a wave of pudding. It's coming for you.",
            "The Gloop's pebble eyes swivel and fix on you.",
            "A Gloop goes blorp and slides your way.",
            "The Gloop opens a very large mouth in your direction.",
            "A Gloop gathers itself up, wibbling, aiming at you.",
          ],
          hit: [
            "GLOMP. You're up to your knees in mud. Cold mud.",
            "It flops on you like a wet blanket. Ugh.",
            "Splat! It sits on you, then slides off, pleased.",
            "It glomps your boots. You'll never get them clean.",
            "Squelch. You've been glomped. It's as bad as it sounds.",
            "A big muddy hug that nobody asked for.",
          ],
          miss: [
            "It lunges and splats on the ground right beside you.",
            "You step back. The Gloop glomps a rock and looks disappointed.",
            "It slides past you and keeps sliding. Bye.",
            "Blorp. It misses and wobbles, embarrassed.",
            "It glomps, slips on itself, and goes splat.",
            "Too slow. You were never there.",
          ],
        } },
      { id: 'sticky_splat', name: 'Sticky Splat', weight: 2, special: true, target: 'random', damage: '1d4',
        effect: { sparks: -1 },
        lines: {
          intent: [
            "The Gloop puffs its cheeks, aiming a big blob of goo at you.",
            "A Gloop gurgles and wobbles. Something sticky is coming your way.",
            "The Gloop scoops up a handful of itself and winds up at you.",
          ],
          hit: [
            "Splat! Sticky goo everywhere. Your magic feels gummed up. You lose a Spark.",
            "Right in the face. You blink through the goo, and a Spark fizzles out.",
            "It sticks. Everything sticks. One of your Sparks is stuck too.",
          ],
          miss: [
            "The blob flies past and splats on a lily pad. The frog on it is furious.",
            "You duck. The goo slaps the Gloop next door.",
            "Splat, on the ground. It slowly crawls back to its owner.",
          ],
        } },
    ],
    lines: {
      enter: [
        "The mud bubbles, and up rises a Gloop: a wobbling blob with two pebble eyes.",
        "Blorp. A Gloop heaves itself out of the marsh.",
        "Something round and brown and cheerful slides out of the reeds.",
        "A Gloop pops up, blinks its pebbles at you, and grins.",
      ],
      hurt: [
        "The Gloop wobbles like a jelly in an earthquake.",
        "Blorp! A chunk of it splashes off.",
        "It shrinks a little and goes a paler shade of brown.",
        "It quivers, bubbles, and frowns its whole body.",
      ],
      flee: [
        "The Gloop melts into a puddle and slurps away under the water.",
        "It slides off backwards into the marsh with a sad little glug.",
        "Plop. It sinks out of sight, leaving two pebbles and a bubble.",
        "The Gloop oozes off between the reeds, grumbling.",
      ],
      befriended: [
        "The Gloop sighs happily and lets you pat it. Your hand comes back muddy. Worth it.",
        "It wobbles with joy and does a very small burp.",
        "The Gloop rolls over like a puppy. A muddy, enormous puppy.",
        "It goes blorp, but softly. Gloop for thank you.",
      ],
      weakHint: [
        "Gloops shrink from bright light. Look how it flinches from your lantern.",
        "That Gloop keeps sniffing the air. Is it smelling the honeycake in your bag?",
        "Gloops love a good joke. That one nearly smiled when somebody tripped.",
        "Shine something bright at a Gloop and it dries out fast.",
      ],
    },
  },

  rattlewing: {
    id: 'rattlewing', name: 'Rattlewing', plural: 'Rattlewings', art: 'rattlewing',
    hp: 13, guard: 12, toHit: 4, resolve: 0, befriend: null,
    likes: [], weak: ['vines'],
    moves: [
      { id: 'peck', name: 'Peck', weight: 3, target: 'random', damage: '1d6',
        lines: {
          intent: [
            "A Rattlewing clacks its brass beak and turns one red eye on you.",
            "Tick, tick, tick. A Rattlewing swoops low toward you.",
            "A Rattlewing's gears whirr as it picks you out.",
            "A Rattlewing caws like a rusty hinge and dives your way.",
            "One red eye. One sharp beak. Both pointed at you.",
            "A Rattlewing flaps on clanking wings, straight at you.",
          ],
          hit: [
            "Peck! A sharp brass beak, right on the arm.",
            "Clack-clack-clack. It pecks like a woodpecker with a grudge.",
            "It nips your ear and rattles off, cawing.",
            "Ow! That beak is sharper than it looks.",
            "It pecks and pecks. Brass beaks don't get tired.",
            "Chink! It catches your shoulder and flaps away.",
          ],
          miss: [
            "It pecks and hits your belt buckle. Clang! Its eye spins.",
            "You swat it aside. It wobbles off, ticking angrily.",
            "Its peck goes wide and it bonks its beak on a stone.",
            "The Rattlewing misjudges and flies right past you.",
            "You duck, and it pecks the empty air. Clack.",
            "A loose cog pops out of its wing mid-peck. Missed!",
          ],
        } },
      { id: 'dive', name: 'Dive', weight: 2, special: true, announce: true, target: 'weakest', damage: '1d8',
        lines: {
          intent: [
            "A Rattlewing climbs high and hangs there, red eye locked on you. It's going to dive!",
            "Whirr-click. A Rattlewing folds its brass wings and takes aim at you.",
            "Up, up, up it goes. Then it stops. It's picked you. Watch out!",
          ],
          hit: [
            "It drops like a stone. KRANG! That hurt.",
            "A brass blur, a crash, and you're on the ground.",
            "It dives straight into you, all beak and gears.",
          ],
          miss: [
            "It dives, you roll, and it crunches beak first into the ground. Stuck!",
            "You sidestep at the last moment. It ploughs into a bush and twangs.",
            "Down it comes, and away you go. It pulls up just in time, rattling.",
          ],
        } },
    ],
    lines: {
      enter: [
        "Tick-tick-tick. Brass wings clatter out of the dark: a Rattlewing, one red eye glowing.",
        "A clockwork crow lands on a branch, gears whirring, and caws like a rusty gate.",
        "A Rattlewing swoops in, wound up and furious.",
        "Clank, flap, clank. Another of Glint's brass crows.",
      ],
      hurt: [
        "A spring boings out of the Rattlewing.",
        "It sparks and spins, cawing in a crackly voice.",
        "Clang! A dent in its brass chest. Its eye flickers.",
        "A cog pops out and rolls away. It squawks.",
      ],
      flee: [
        "The Rattlewing falls apart into a little rain of cogs and springs.",
        "Its key stops turning. It wobbles, ticks once, and clatters down in pieces.",
        "Sproing! It unwinds all at once and spins away into the dark.",
        "It flaps off crookedly, trailing smoke and bolts.",
      ],
      befriended: [
        "Its gears slow. It tilts its head, as if, just for a moment, it understood.",
      ],
      weakHint: [
        "That's a machine. Kind words won't wind it down, but something tangling up its gears might.",
        "Look at all those open cogs. A vine in there would jam it right up.",
        "You can't befriend clockwork, I'm afraid. But you can tie it in knots.",
        "Rattlewings swoop in a straight line. Get something grabby in its wings.",
      ],
    },
  },

  flutterfang: {
    id: 'flutterfang', name: 'Flutterfang', plural: 'Flutterfangs', art: 'flutterfang',
    hp: 9, guard: 13, toHit: 3, resolve: 5, befriend: { dc: 10, verb: 'Befriend' },
    likes: ['song'], weak: ['song'],
    moves: [
      { id: 'nip', name: 'Nip', weight: 3, target: 'random', damage: '1d4',
        lines: {
          intent: [
            "A Flutterfang zigzags toward you, crystal wings chiming.",
            "A Flutterfang hangs upside down, staring right at you.",
            "Tiny fangs glint. A Flutterfang swoops at you.",
            "A Flutterfang squeaks and darts your way.",
            "Wings like stained glass flicker. It's coming for you.",
          ],
          hit: [
            "Nip! A tiny bite, right on the finger.",
            "It nips your ear and flutters off, squeaking.",
            "Ow! Small fangs, sharp fangs.",
            "It nibbles your sleeve, then your arm. Rude.",
            "A quick nip and a jingle of wings. It's gone again.",
          ],
          miss: [
            "It flutters past your nose and misses. So close you felt the breeze.",
            "You flinch, it swerves, everybody's fine.",
            "It nips at your hat and gets a mouthful of feather.",
            "It dives, squeaks, and bonks into a crystal. Chime!",
            "Missed! It flaps off in a huff.",
          ],
        } },
      { id: 'screech', name: 'Screech', weight: 1, special: true, target: 'all', damage: null,
        effect: { nextRoll: -1 },
        lines: {
          intent: [
            "A Flutterfang fills its little lungs. Uh oh. Cover your ears!",
            "The Flutterfang's crystal wings start to buzz. Something loud is coming.",
          ],
          hit: [
            "SKREEEEE! The whole cave rings. Everybody's ears are buzzing. Your next rolls are a little worse.",
            "A screech like a squeaky gate the size of a castle. Your teeth tingle and your aim wobbles.",
          ],
          miss: [
            "It screeches, but it's more of a hiccup. Nobody minds.",
            "It screeches so hard it falls off its perch. The noise goes with it.",
          ],
        } },
    ],
    lines: {
      enter: [
        "Crystal wings chime overhead. Flutterfangs, dozens of glass-winged bats, peel off the ceiling.",
        "A Flutterfang drops from the dark, squeaking, wings sparkling.",
        "The roost wakes. Little fangs, big eyes, bright wings.",
        "A Flutterfang flutters in, jingling like a wind chime with teeth.",
      ],
      hurt: [
        "The Flutterfang squeaks and spins.",
        "One of its crystal wings cracks, ping! It wobbles in the air.",
        "It tumbles, catches itself, and squeaks crossly.",
        "Its wings flicker dim for a moment.",
      ],
      flee: [
        "The Flutterfang zips off into the dark with a sulky squeak.",
        "It flaps back up to the roost and hides its face in its wings.",
        "Off it goes, chiming, into a crack in the ceiling.",
        "It squeaks once and vanishes into the crystals.",
      ],
      befriended: [
        "The Flutterfang lands on your shoulder, folds its glass wings, and hums along.",
        "It hangs upside down from your hat and goes to sleep. Adorable. Slightly heavy.",
        "It squeaks a tiny tune back at you. That's a yes.",
        "The Flutterfang nuzzles your cheek, wings tinkling.",
      ],
      weakHint: [
        "Flutterfangs are hard to hit, but listen: their wings chime along with any music.",
        "Song soothes Flutterfangs. A tune might calm them, or knock them right out of the air.",
        "They only bite because they're frightened. A gentle tune could change that.",
        "Those crystal wings ring at every sound. A song would rattle them to their toes.",
      ],
    },
  },

  bouldergrin: {
    id: 'bouldergrin', name: 'Bouldergrin', plural: 'Bouldergrins', art: 'bouldergrin', boss: true,
    hp: 30, guard: 13, toHit: 4, resolve: 12, befriend: { dc: 13, verb: 'Befriend' },
    likes: ['marsh_lily'], weak: [],
    moves: [
      { id: 'slam', name: 'Slam', weight: 3, target: 'strongest', damage: '1d8+1',
        lines: {
          intent: [
            "Bouldergrin raises one enormous stone fist over you. Slowly. Very slowly.",
            "Bouldergrin turns his one glowing eye on you. Grrrind.",
            "A shadow falls over you. It's a fist. It's Bouldergrin's fist.",
            "Bouldergrin rumbles: Small. Thing. And reaches for you.",
            "The stone guardian winds up, creaking like an old door, aimed at you.",
          ],
          hit: [
            "SLAM. The floor jumps. So do you.",
            "His fist comes down like a falling wall. Oof.",
            "Thoom. You're flat for a second, seeing crystals.",
            "He swats you like a fly. A very slow, very heavy swat.",
            "BOOM. Dust everywhere. You're sore all over.",
          ],
          miss: [
            "His fist slams down beside you and gets stuck in the floor. He pulls. And pulls.",
            "You step aside. It took him long enough to wind up.",
            "SLAM, into nothing. Bouldergrin looks at his hand, puzzled.",
            "He misses, because he can only see you with one eye.",
            "The fist lands a whisker away. Your hair blows back.",
          ],
        } },
      { id: 'rumble', name: 'Rumble', weight: 1, special: true, target: 'all', damage: '1d4',
        lines: {
          intent: [
            "Bouldergrin stamps one foot. Then lifts the other. Everybody brace!",
            "A deep growl rises from Bouldergrin's belly. The ground starts to shake.",
          ],
          hit: [
            "RUMMMBLE. The whole cavern shakes and crystals rain down on everyone.",
            "He stamps, and the floor bucks like a horse. Everyone tumbles.",
          ],
          miss: [
            "He stamps, and the floor only wobbles. Everyone keeps their feet.",
            "The rumble rolls away under the floor and grumbles off somewhere else.",
          ],
        } },
    ],
    lines: {
      enter: [
        "The archway's wall stands up. It's not a wall. It's Bouldergrin, and he has one crystal eye.",
        "With a grinding groan, the stone guardian unfolds himself, taller and taller and taller.",
      ],
      hurt: [
        "A chip of stone flies off Bouldergrin. He says: Ow. Some time later.",
        "Crack! A line runs down his arm. He looks at it, very slowly.",
        "He rocks back on his heels, grinding.",
        "Bouldergrin grunts, and a few pebbles fall out of his ear.",
        "Dust puffs out of him like a sigh.",
      ],
      flee: [
        "Bouldergrin sits down, heavily. Then lies down. Then is a pile of rocks with a snore in it.",
        "He backs into his alcove and curls up into a boulder. Done.",
      ],
      befriended: [
        "Bouldergrin's crystal eye glows soft and warm. He rumbles: Friend. Slowly. Like he's tasting the word.",
        "The guardian kneels. The floor shakes. He pats you on the head with one careful finger.",
      ],
      weakHint: [
        "He's not angry. Look at that empty socket. He's lonely, and he can't see properly.",
        "Bouldergrin is slow. Very slow. Strike while his fist is still on its way up.",
        "Something in him softens when you talk. A friend might be hiding in all that stone.",
        "Stone is hard to hurt. But stone can be kind, if you're patient.",
      ],
    },
  },

  clatterclaw: {
    id: 'clatterclaw', name: 'The Clatterclaw', plural: 'Clatterclaws', art: 'clatterclaw', boss: true,
    hp: 42, guard: 12, toHit: 4, resolve: 0, befriend: null,
    likes: [], weak: ['vines'],
    phase: { atHalf: { guard: 10, actsPerRound: 2 } },
    moves: [
      { id: 'claw', name: 'Claw', weight: 3, target: 'random', damage: '1d8+2',
        lines: {
          intent: [
            "The Clatterclaw swings a claw made of two kettles and a sugar tongs your way.",
            "Glint yanks a lever. A giant clockwork claw opens over you. Clack.",
            "The Clatterclaw scuttles sideways, claw snapping, toward you.",
            "Whirr, clank, SNAP. That claw is looking right at you.",
            "Glint shrieks: Get that one! And the claw turns to you.",
          ],
          hit: [
            "CLANG. The claw pinches and tosses you like a pancake.",
            "It snaps shut on your cloak and swings you round. Dizzy!",
            "Bonk! A kettle-claw right on the noggin.",
            "The claw smacks you aside with a noise like a falling cupboard.",
            "Pinch! That's going to leave a mark.",
          ],
          miss: [
            "The claw snaps shut on thin air. Glint bangs the controls.",
            "You duck. The claw grabs a coat stand instead. Glint says: That's mine!",
            "Clack! Missed. A spring boings out of the elbow.",
            "It swings too far and the whole machine spins round once.",
            "The claw stops short. Something inside goes ping. Glint swears in goblin.",
          ],
        } },
      { id: 'steam_blast', name: 'Steam Blast', weight: 1, special: true, target: 'all', damage: '1d6',
        lines: {
          intent: [
            "Every kettle on the Clatterclaw starts to whistle. Everyone, look out!",
            "Glint cackles and pulls the big red lever. The machine shudders and hisses.",
          ],
          hit: [
            "WHOOSH! Hot steam everywhere. Everyone's pink and puffing.",
            "A hundred kettles blow at once. The whole party gets a very rude steam bath.",
          ],
          miss: [
            "It hisses and blows steam, mostly into Glint's face. He coughs.",
            "The kettles whistle a sad little tune and let out a puff. Fizzle.",
          ],
        } },
    ],
    lines: {
      enter: [
        "The junk pile heaves. Up rises the Clatterclaw: a crab the size of a cottage, built from kettles and clocks, Glint at the levers.",
        "Clank, hiss, whirr. Glint's great machine scuttles out of the junk, steam pouring from its spout.",
      ],
      hurt: [
        "A clock face pops off the Clatterclaw and rolls away, ticking.",
        "Clang! A kettle dents. Glint shrieks: Careful! That was an antique!",
        "Springs and spoons spray out of a joint.",
        "The machine lurches and Glint grabs his hat.",
        "Steam whistles from a fresh crack. The whole thing shudders.",
      ],
      flee: [
        "With a groan and a hiss and a very sad little ding, the Clatterclaw falls apart into kettles, clocks and cogs.",
        "The machine collapses in a clattering heap. Somewhere under it, a small voice says: Ow.",
      ],
      befriended: [
        "The machine winds down with a long, sad whistle.",
      ],
      weakHint: [
        "It's a machine. It can't be talked round, but look at all those open joints. Vines would jam them.",
        "Every leg is a clockwork knot of gears. Tangle them and it'll trip over itself.",
        "Watch out when its armour falls off. It gets softer, but it gets faster too.",
        "Glint is the one at the levers. The machine isn't angry. It's only doing what it's told.",
      ],
    },
  },

  nightmare_wisp: {
    id: 'nightmare_wisp', name: 'Nightmare Wisp', plural: 'Nightmare Wisps', art: 'nightmare_wisp',
    hp: 12, guard: 11, toHit: 3, resolve: 6, befriend: { dc: 10, verb: 'Soothe' },
    likes: ['song'], weak: ['light'],
    moves: [
      { id: 'chill', name: 'Chill', weight: 3, target: 'random', damage: '1d6',
        lines: {
          intent: [
            "A Nightmare Wisp drifts toward you, star eyes blinking.",
            "Cold smoke curls around your ankles. A wisp has chosen you.",
            "A wisp swirls into the shape of something with teeth, and floats your way.",
            "The wisp whispers your name. Well, it tries to. It comes toward you.",
            "Smoky fingers reach for you out of the dark.",
            "A wisp shivers into a long, thin shape and slides toward you.",
          ],
          hit: [
            "Cold! Like a snowball down your back, but on the inside.",
            "The wisp passes through you, and you shiver to your toes.",
            "A chill grabs your heart for a moment. Then lets go.",
            "Brrr. Frost on your eyelashes.",
            "It wraps round you like a cold, wet fog.",
            "You feel, just for a second, like you've forgotten something important.",
          ],
          miss: [
            "The wisp swirls past and breaks into puffs. It gathers itself back up, embarrassed.",
            "You wave it off like smoke from a candle. It goes.",
            "It reaches for you, but you're too warm. It flinches.",
            "It drifts right through the space you just left.",
            "You think of something nice, and the chill can't find you.",
            "It sneaks up, then gets distracted by its own reflection in a crystal.",
          ],
        } },
      { id: 'whisper', name: 'Whisper', weight: 1, special: true, target: 'random', damage: null,
        effect: { nextRollWorst: true },
        lines: {
          intent: [
            "A wisp leans close to your ear. It wants to tell you something.",
            "The wisp's star eyes go narrow. It drifts up behind you, whispering.",
          ],
          hit: [
            "It whispers: You'll miss. You'll miss. Your next roll takes the worse of two dice.",
            "A worry slides into your ear like cold water. Your next roll will be shaky.",
          ],
          miss: [
            "It whispers something gloomy, but you're humming too loud to hear it.",
            "It whispers, and you whisper back: No, thank you. It blinks.",
          ],
        } },
    ],
    lines: {
      enter: [
        "The dream-smoke thickens and twists into shapes with star eyes. Nightmare Wisps.",
        "Out of the dragon's dreams, a wisp unfolds itself, cold and sad.",
        "Smoke pours from the nest and stands up. Two little stars blink in it.",
        "A wisp swirls out of the dark like ink in water.",
      ],
      hurt: [
        "The wisp frays at the edges like a cobweb in the wind.",
        "Its star eyes flicker. It shrinks.",
        "The wisp flinches, thinning into ribbons.",
        "A piece of it blows away like smoke.",
      ],
      flee: [
        "The wisp unravels into nothing, and the air is a little warmer.",
        "It thins out to a ribbon and blows away up the chimney of the world.",
        "Pop. Just stars, then not even that.",
        "The wisp curls up small and drifts back into the dark, quieter.",
      ],
      befriended: [
        "The wisp turns from grey to gold and melts into a soft, glowing dream. The dragon sighs.",
        "Soothed, it becomes a cloud of little lights, like fireflies, and floats away.",
        "Its star eyes close. It's not a nightmare any more. Just a nice dream, drifting home.",
        "It shivers into a warm glow and fades with a sound like a yawn.",
      ],
      weakHint: [
        "Bad dreams can't stand the light. Shine something and watch them shrink.",
        "Listen. They go quiet when there's music. Sing to them, and they might soothe.",
        "These aren't monsters. They're bad dreams. You don't fight a bad dream. You calm it down.",
        "Every time a light flares, the wisps go thin as paper.",
      ],
    },
  },
};

export default enemies;
