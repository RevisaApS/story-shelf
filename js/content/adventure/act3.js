// Act III: Under Mount Kettle. The Dwarf-Door, the Crystal Cavern, the Chasm, Glint's Vault.
// Written by story-3. Every spoken line is voiced by Old Quill (or the NPC in `as`).

// Said once, before the first skill challenge a party meets (ROUND2 3.3). Same text in every act file.
const TEACH_SKILL = { if: { not: 'taught_skill' }, then: [
  { say: "No die for this one. This one is up to your own two hands. Watch how it goes, then have a go.", mood: 'warm' },
  { set: { taught_skill: true } },
] };

// --- Crystal Cavern: the Flutterfang roost, shared by every path that ends in a scuffle ---
const ROOST_FIGHT = [
  { combat: 'flutterfang_roost',
    win: [
      "The last Flutterfang zips off into the dark, squeaking very rude things in bat.",
      "On their ledge, tucked in a crack, you find their treasure: a berry that crackles with light.",
      { give: 'sparkberry' },
    ],
    befriend: [
      { say: "The Flutterfangs settle on your shoulders and hats, chirping softly. One drops a crackling berry into your hand.", mood: 'warm' },
      "Bats, it turns out, give presents. Who knew?",
      { give: 'sparkberry' },
    ] },
];

const ROOST_CALM = [
  "On the ledge, in a crack between two crystals, is their little hoard: one berry that crackles with light.",
  { give: 'sparkberry' },
];

// --- Crystal Cavern: Bouldergrin steps aside as a friend ---
const BOULDER_FRIEND = [
  { set: { bouldergrin_friend: true, bouldergrin_passed: true } },
  { sfx: 'rumble' },
  "Bouldergrin shuffles aside with a noise like furniture being moved by a mountain.",
  { say: "Go... softly. She... sleeps... badly. If... you... need... a... deep... voice... I... will... hum.", as: 'bouldergrin' },
  { hide: 'bouldergrin' },
];

// --- Crystal Cavern: his one very slow question ---
const BOULDER_QUESTION = [
  { say: "I... have... one... question. Only... one. I... have... been... thinking... it... for... a... long... time.", as: 'bouldergrin' },
  { say: "What... can... you... hold... without... hands?", as: 'bouldergrin', mood: 'hush' },
  "Talk it over together, all of you. There may be more than one good answer. Then choose who says it.",
  { check: { stat: 'wits', dc: 'medium', label: 'Answer the stone guardian',
    success: [
      "You tell him. A song. A breath. A promise. Bouldergrin thinks about it for so long that a little moss grows on his nose.",
      { say: "Yes... That... is... a... good... answer. I... will... keep... it.", as: 'bouldergrin' },
      ...BOULDER_FRIEND,
    ],
    fail: [
      { say: "You panic, and you say: a sandwich. Bouldergrin considers this very, very seriously.", mood: 'funny' },
      { say: "A... sandwich. You... could... hold... it... in... your... teeth. ...Yes. Also... a... good... answer.", as: 'bouldergrin', mood: 'funny' },
      ...BOULDER_FRIEND,
    ],
  } },
];

export default {

  // ------------------------------------------------------------------
  dwarf_door: {
    id: 'dwarf_door', title: 'The Dwarf-Door', subtitle: 'The way into Mount Kettle',
    bg: 'dwarf_door', music: 'dungeon', ambience: 'wind', weather: 'snow',
    steps: [
      { card: { kicker: 'Act III', title: 'Under Mount Kettle' } },
      "The Sunken Road ends at a cliff. Snow whirls. And set into the rock is a door, round as the moon and taller than ten trolls.",
      "Two stone bowls of blue fire burn on either side. They give no heat at all. Your breath puffs white.",
      { say: "Carved across the door, a dragon sleeps, nose to tail. Six smooth tiles run across her middle, like buttons on a giant's coat.", mood: 'hush' },
      { sfx: 'rumble' }, { fx: 'rumble' },
      { say: "Deep inside the mountain, something sighs. The snow on the doorstep shivers.", mood: 'ominous' },
      "In your pack, the tuning fork gives a tiny hum. Mmmmm. Another Songstone is in there somewhere.",
      { choice: { prompt: 'A door with no handle. What do you do?', options: [

        { label: 'Knock politely', stat: 'heart', once: true, hint: 'Old doors like good manners', steps: [
          { check: { stat: 'heart', dc: 'easy', label: 'Knock on the great door',
            success: [
              "You knock three times. A long pause. Then, from deep inside, three tiny knocks answer.",
              "Somebody built this door with good manners. That was polite. Doors notice these things.",
            ],
            fail: [
              { say: "You knock. A shelf of snow slides off the top of the door and lands on your head. Flump. The door, I think, is laughing.", mood: 'funny' },
            ],
          } },
          { again: true },
        ] },

        { label: 'Shove it open', stat: 'might', once: true, steps: [
          TEACH_SKILL,
          { skill: { kind: 'mash', stat: 'might', dc: 'hard', label: 'Shove the great stone door',
            success: [
              "You set your shoulder and heave. The door does not move. But the carved dragon's stone eyelid slides open, looks at you, and slides shut.",
              "Impressed, I think.",
            ],
            crit: [
              { say: "You heave so hard the whole cliff groans, and a curtain of snow slides off the mountain. The door stays shut. But it has never respected anyone more.", mood: 'excited' },
            ],
            fail: [
              { say: "You push. Your boots skid on the ice. You push harder. Now you are lying flat on your tummy, still pushing. Doors: one. Heroes: nil.", mood: 'funny' },
            ],
          } },
          { again: true },
        ] },

        { label: 'Study the carvings', stat: 'wits', once: true, steps: [
          { check: { stat: 'wits', dc: 'medium', label: 'Read the pictures in the stone',
            success: [
              "You brush off the frost. Above the dragon are three tiny pictures: a lantern, a mouth singing, and the dragon, fast asleep.",
              { say: "Light. Song. Sleeper. Now where have you heard something like that before?", mood: 'hush' },
            ],
            fail: [
              { say: "You study the carvings for a long, long time. Then you announce your findings: it is a door. A very round one. Nobody argues.", mood: 'funny' },
            ],
          } },
          { again: true },
        ] },

        { label: 'Read the rim runes', talent: 'read_runes', once: true, steps: [
          "You trace a line of runes round the rim with one finger. Old stone-folk letters, sharp as frost. They say:",
          { say: "Greet her as the valley greets her. First the light they send. Then the song they sing. Then the one they sing to.", mood: 'hush' },
          { again: true },
        ] },

        { label: 'Feel for worn tiles', talent: 'nimble_fingers', once: true, steps: [
          "You pull off a glove and run your fingertips over the six tiles, the way you would feel for a loose floorboard.",
          "Three are smoother than the rest, worn down by a thousand years of thumbs. The lantern. The song. The dragon.",
          "Which order, your fingers can't tell. But that's half a secret, and half is a lot.",
          { again: true },
        ] },

        { label: 'Let Biscuit sniff around', talent: 'animal_friend', once: true, steps: [
          "Biscuit snuffles along the doorstep, sneezes at the snow, and stops. He scratches at one spot. Clink.",
          "Under the frost: a tiny brass hatch, no bigger than a book, with a keyhole shaped like a feather. Good fox.",
          { again: true },
        ] },

        { label: 'Open the feather hatch', requires: { has: 'brass_feather_key' }, once: true, steps: [
          "Low by the doorstep, half hidden in frost, is a tiny hatch with a feather-shaped keyhole. The brass key from the road fits. Click.",
          "Inside is a scrap of paper. The handwriting is very wobbly, and very familiar.",
          { say: "Note to self. Door goes: lantern, song, dragon. Do NOT forget. P.S. Have already forgotten. Read this note.", as: 'glint', mood: 'funny' },
          { say: "Glint. Of course. Our thief has been here before you, and he is not very good at secrets.", mood: 'funny' },
          { again: true },
        ] },

        { label: 'Press the rune tiles', steps: [
          "You step up to the six tiles. They are cold, and they wait.",
        ] },
      ] } },

      { if: 'knows_rhyme',
        then: [
          "As your hand hovers, you hear a brisk old voice in your memory, knitting needles clicking:",
          { say: "First the Light, then the Song, then the Sleeper. Don't make me say it twice, dears.", as: 'elder_maren' },
        ],
        else: [
          "Old doors open for old words. Think about what the whole valley does, every Lanternfall.",
        ] },
      { say: "Careful, now. Old doors have old tempers. Press three tiles, in the right order.", mood: 'hush' },

      { puzzle: 'runes',
        success: [
          { sfx: 'rune.right' },
          "The three tiles glow gold. Deep in the rock, something goes clunk. Clunk. CLUNK.",
          { sfx: 'door.stone' }, { fx: 'shake' },
          { say: "And the great door rolls aside like a wheel of cheese, breathing out warm air that smells of crystals and old dreams.", mood: 'grand' },
        ],
        fail: [
          { say: "The door sighs. A stony face bulges out of it and sneezes a great cloud of dust all over you. Achoo.", mood: 'funny' },
          { sfx: 'door.stone' },
          "Then, very grudgingly, it rolls open anyway. I think it just wanted you to stop pressing things.",
        ] },

      { journal: "Opened the great Dwarf-Door and stepped inside Mount Kettle." },
      { say: "Beyond the door, a tunnel slopes down. Far below, something glitters teal and violet. And something else is breathing.", mood: 'hush' },
      { travel: 'crystal_cavern' },
      { goto: 'crystal_cavern' },
    ],
  },

  // ------------------------------------------------------------------
  crystal_cavern: {
    id: 'crystal_cavern', title: 'The Crystal Cavern', subtitle: 'Where the mountain keeps its light',
    bg: 'crystal_cavern', music: 'crystal', ambience: 'crystal', weather: 'sparkles',
    steps: [
      "The tunnel opens, and you all stop walking at the very same moment.",
      { say: "A cavern so big it has its own weather. Crystals taller than houses glow teal and violet, humming, like a choir holding one note.", mood: 'hush' },
      "On the left, a still pool shines like spilled moonlight. High on the right, things hang from a ledge in rows. Things with glass wings.",
      "And at the far end, in front of a stone archway, sits a boulder. A very large boulder. With a face.",
      { sfx: 'rumble' },
      { say: "It has one glowing crystal eye. Where the other eye should be, there is only a dark, empty hole.", mood: 'sad' },
      "The tuning fork hums. The way on is through that arch. But this cave has secrets. Where do you look first?",

      { hub: { id: 'cavern', prompt: 'The Crystal Cavern. Where do you go?', spots: [

        { id: 'echo', label: 'The echo crystals', icon: 'crystal', x: 392, y: 240, once: true, steps: [
          "You touch a crystal. It rings like a glass bell. And out of it, very faint, comes music.",
          { say: "Three gentle notes. Then three more. Then a hush where the last part should be. The lullaby, caught in the stone like a fly in amber.", mood: 'hush' },
          { choice: { prompt: 'The crystals are full of old sounds.', options: [
            { label: 'Listen closely', stat: 'wits', steps: [
              TEACH_SKILL,
              { skill: { kind: 'memory', stat: 'wits', dc: 'medium', label: 'Listen to the echoes',
                success: [
                  "You press your ear to the crystal. Under the music, old stone-folk voices, deep as cellars:",
                  { say: "Sing her the whole song, all three parts, and she will sleep a hundred summers.", mood: 'hush' },
                  "And then, much newer, a squeaky little voice:",
                  { say: "Ooh. Shiny. Shiny! Oh, the shiniest! I'll just borrow it. For ever. Is that borrowing? That's borrowing.", as: 'glint', mood: 'funny' },
                ],
                fail: [
                  { say: "You press your ear to the crystal. It plays you, very clearly, somebody sneezing. A hundred years ago. Bless them.", mood: 'funny' },
                  "Behind the sneeze, faint and deep: all three parts... a hundred summers...",
                ],
              } },
            ] },
            { label: 'Sing back to them', stat: 'heart', steps: [
              "You hum the bits of the lullaby you know. The crystals catch it and throw it back, ten times bigger, all round the cavern.",
              { say: "For a moment the whole mountain hums with you. Up on the ledge, glass wings rustle, and go still. That was lovely.", mood: 'warm' },
            ] },
          ] } },
        ] },

        { id: 'pool', label: 'The glowing pool', icon: 'heal', x: 250, y: 490, once: true, steps: [
          "The pool is warm, and it glows from underneath. Tiny bubbles rise, each one carrying a spark of light.",
          { choice: { prompt: 'The water glows. What do you do?', options: [
            { label: 'Drink and rest', steps: [
              "You cup your hands and drink. It tastes of mint and starlight. Every bruise from the road quietly packs its bags and leaves.",
              { heal: 'full', who: 'all' },
            ] },
            { label: 'Gaze into the water', stat: 'wits', steps: [
              { check: { stat: 'wits', dc: 'easy', label: 'Look deep into the pool',
                success: [
                  { say: "In the water you see not your face but a dream: a great golden dragon tossing and turning, with dark smoke curling round her.", mood: 'ominous' },
                  "She is waiting. Then the picture ripples away, and you drink, and you feel strong again.",
                ],
                fail: [
                  { say: "You lean closer. And closer. And plop: nose first into the pool. You come up glowing faintly, and feeling wonderful.", mood: 'funny' },
                ],
              } },
              { heal: 'full', who: 'all' },
            ] },
            { label: 'Gather moon-moss', talent: 'herb_lore', steps: [
              "Round the edge grows a pale moss you know from old books. Moon-moss, best thing there is for a sore heart.",
              "You pick a handful, with a thank-you to the cave, and brew it later into tea. You all drink. Ahh.",
              { heal: 'full', who: 'all' },
              { give: 'moonpetal_tea' },
            ] },
          ] } },
        ] },

        { id: 'roost', label: 'The glass-wing roost', icon: 'bat', x: 1083, y: 140, once: true, steps: [
          "You creep toward the ledge. Hanging upside down in rows: Flutterfangs. Cave bats with wings like stained glass, and very small, very sharp teeth.",
          { sfx: 'wing' },
          { say: "One opens an eye. Then another. Then all of them. Oh dear.", mood: 'hush' },
          { choice: { prompt: 'A hundred little eyes. What do you do?', options: [
            { label: 'Sneak past', stat: 'agility', steps: [
              TEACH_SKILL,
              { skill: { kind: 'sneak', stat: 'agility', dc: 'medium', label: 'Tiptoe past the roost',
                success: [
                  "Toe, heel. Toe, heel. You slip along the wall like a shadow. Not one wing twitches.",
                  ...ROOST_CALM,
                ],
                fail: [
                  { say: "Toe, heel. Toe, heel. Toe... CRUNCH. A crystal snaps under your boot. A hundred glass wings snap open at once.", mood: 'excited' },
                  ...ROOST_FIGHT,
                ],
              } },
            ] },
            { label: 'Sing them calm', stat: 'heart', hint: 'Song soothes them', steps: [
              { check: { stat: 'heart', dc: 'medium', label: 'Sing to the Flutterfangs',
                success: [
                  "You sing low and slow. The Flutterfangs sway, upside down, then fold their wings one by one like closing umbrellas. A tiny snore.",
                  ...ROOST_CALM,
                ],
                fail: [
                  { say: "You sing. Unfortunately, you sing the high bit. Very high. Every bat in the roost takes that personally.", mood: 'funny' },
                  ...ROOST_FIGHT,
                ],
              } },
            ] },
            { label: 'Sing like it is bedtime', talent: 'silver_tongue', steps: [
              "You don't sing loud. You sing the way you would put a baby to bed, soft and sure.",
              { say: "The whole roost sighs at once, and falls asleep in a heap. One bat is still holding another bat's wing.", mood: 'warm' },
              ...ROOST_CALM,
            ] },
            { label: 'Talk to them, bat to friend', talent: 'animal_friend', steps: [
              "You click your tongue softly, the way bats talk to each other. Biscuit adds one polite little yip.",
              "The Flutterfangs tilt their heads. One flutters down, lands on your boot, and leaves a crackling berry there. A gift.",
              { give: 'sparkberry' },
            ] },
            { label: 'Charge in!', stat: 'might', steps: [
              { say: "You let out a mighty battle cry. It echoes round the cavern nine times. That is nine more times than the bats wanted.", mood: 'excited' },
              ...ROOST_FIGHT,
            ] },
          ] } },
        ] },

        { id: 'guardian', label: 'The stone guardian', icon: 'stone', x: 733, y: 473, requires: { not: 'bouldergrin_passed' }, steps: [
          { show: 'bouldergrin', at: 'center' },
          { sfx: 'rumble' }, { fx: 'rumble' },
          "As you come close, the boulder unfolds. Arms like landslides. Shoulders like hills. He looks down at you with his one bright eye.",
          { say: "Who... walks... in... my... cave.", as: 'bouldergrin', mood: 'ominous' },
          { say: "That took him about as long as it takes to boil an egg. He is not finished.", mood: 'funny' },
          { say: "No one... passes... the arch. I... guard... it. Though... since... my eye... went... I guard... only... half... of it.", as: 'bouldergrin', mood: 'sad' },
          { choice: { prompt: 'Bouldergrin blocks the arch. What do you do?', options: [

            { label: 'Offer the very round crystal', requires: { has: 'golem_eye' }, steps: [
              "You take out the crystal from Madam Snaggle's stall. No refunds. It is very, very round.",
              "Bouldergrin goes completely still. Then, slowly, so slowly, he holds out one enormous palm.",
              { take: 'golem_eye' },
              { sfx: 'sting.wonder' },
              { say: "He presses it into the empty hole. Click. Light floods through him, teal and gold, like sunrise inside a stone.", mood: 'grand' },
              { say: "I... can... see... both... sides... of... everything... again.", as: 'bouldergrin', mood: 'warm' },
              { say: "You... are... very... small. And... very... kind.", as: 'bouldergrin' },
              { say: "You carried that all this way, and you gave it away to make a stone smile. Take a Star.", mood: 'warm' },
              { star: 1, why: 'For giving back what was lost' },
              ...BOULDER_FRIEND,
            ] },

            { label: 'Offer him the marsh lily', requires: { all: [ { has: 'marsh_lily' }, { not: { has: 'golem_eye' } } ] }, steps: [
              "You remember Bogsworth, drawling: somebody stony liked 'em. You hold up the marsh lily. It glows a soft, damp white.",
              { say: "Bouldergrin sniffs it. A sniff from a boulder takes about a minute and sounds like a cave clearing its throat.", mood: 'funny' },
              { say: "Lilies... from... the... marsh. I... have... not... smelled... one... since... I... was... a... pebble.", as: 'bouldergrin', mood: 'warm' },
              { take: 'marsh_lily' },
              { say: "You carried that all this way, and you gave it away to make a stone smile. Take a Star.", mood: 'warm' },
              { star: 1, why: 'For a thoughtful gift' },
              ...BOULDER_FRIEND,
            ] },

            { label: 'Ask him why he is sad', stat: 'heart', steps: [
              { check: { stat: 'heart', dc: 'medium', label: 'Talk to Bouldergrin',
                success: [
                  "You sit down on a rock and ask about his eye. He tells you. It takes a while. Nobody has asked him anything in three hundred years.",
                  { say: "A... goblin... in... feathers... said... it... was... the shiniest... thing... he... ever... saw. Then... he... said... sorry... and... ran.", as: 'bouldergrin', mood: 'sad' },
                  { say: "You... listened. Nobody... listens... to... stone.", as: 'bouldergrin' },
                  ...BOULDER_FRIEND,
                ],
                fail: [
                  "You ask him what is wrong. He begins to answer. You wait. And wait. Somebody's foot falls asleep.",
                  { say: "I... am... still... deciding... if... you... are... friends.", as: 'bouldergrin' },
                  ...BOULDER_QUESTION,
                ],
              } },
            ] },

            { label: 'Ask for his question', stat: 'wits', hint: 'Guardians always have one', steps: [
              "You ask, very politely, if there is a riddle. There is always a riddle with guardians.",
              ...BOULDER_QUESTION,
            ] },

            { label: 'Stand still and let him look', talent: 'stand_firm', steps: [
              "You plant your feet and lift your chin. Bouldergrin leans down until his huge stone face is a hand's width from yours.",
              "His breath smells of cold rain and old pennies. You do not blink. Not once.",
              { say: "Brave... little... pebble.", as: 'bouldergrin', mood: 'warm' },
              ...BOULDER_FRIEND,
            ] },

            { label: 'Fight your way through', stat: 'might', steps: [
              { hide: 'bouldergrin' },
              { combat: 'bouldergrin',
                win: [
                  { sfx: 'rumble' },
                  { say: "With a sound like a landslide giving up, Bouldergrin sits down hard. He rolls aside, grumbling, to let you pass.", mood: 'funny' },
                  "He doesn't look angry. Just lonely. Maybe someone will come back for him, one day.",
                  { set: { bouldergrin_passed: true } },
                ],
                befriend: [
                  { say: "Bouldergrin lowers his great fists, and the cave floor purrs. He is smiling. Stones, it turns out, can smile.", mood: 'warm' },
                  { show: 'bouldergrin', at: 'center' },
                  ...BOULDER_FRIEND,
                ] },
            ] },
          ] } },
        ] },
      ],
      leave: { label: 'Through the archway', requires: 'bouldergrin_passed', lockedHint: 'A very large stone is sitting in the way.', steps: [
        { journal: "Crossed the Crystal Cavern and got past Bouldergrin, the stone guardian." },
        "Beyond the arch, the floor simply stops. There is a long rope bridge, a deep orange glow, and the roar of falling water.",
      ] } } },

      { travel: 'chasm_bridge' },
      { goto: 'chasm_bridge' },
    ],
  },

  // ------------------------------------------------------------------
  chasm_bridge: {
    id: 'chasm_bridge', title: 'The Chasm', subtitle: 'A long way down',
    bg: 'chasm_bridge', music: 'dungeon', ambience: 'cave', weather: 'embers',
    steps: [
      { say: "A chasm so deep the bottom glows orange, like the inside of a kettle. Across it sags one rope bridge, old and patched and creaking.", mood: 'hush' },
      "To the left, an underground river pours off a ledge and falls roaring into the glow. The air tastes of wet stone and hot pennies.",
      "On the far side is a door made of a hundred mismatched spoons. Above it, painted in gold: a big letter G, with stars round it.",
      "In your pack the tuning fork is humming so hard it tickles. The last Songstone is over there.",
      { choice: { prompt: 'Before you cross, what do you do?', options: [

        { label: 'Check on each other', stat: 'heart', steps: [
          "You look round at each other and ask: everybody all right?",
          { say: "Nobody is entirely all right. Everybody says yes anyway. That is what friends are for.", mood: 'warm' },
        ] },

        { label: 'Just run for it', stat: 'might', steps: [
          { say: "Brave. Very brave. Let's see if the bridge agrees with you.", mood: 'excited' },
        ] },

        { label: 'Test the ropes first', stat: 'wits', steps: [
          { check: { stat: 'wits', dc: 'medium', label: 'Test the old ropes',
            success: [
              "You tug each rope in turn. Most are fine. One, on the left, is held together by hope and a single strand. Good to know.",
            ],
            fail: [
              { say: "You tug a rope, firmly, scientifically. It snaps. Well. Now you know.", mood: 'funny' },
            ],
          } },
        ] },

        { label: 'Grow a vine handrail', talent: 'herb_lore', steps: [
          "You whisper to a cave vine in a crack. It uncurls and winds along the bridge like a helpful green snake.",
          "Now there is a handrail that is alive, and a little bit ticklish.",
        ] },

        { label: 'Go first, and hold out a hand', talent: 'stand_firm', steps: [
          "You step onto the first plank. It creaks. It holds. You turn round and hold out your hand to the others.",
          { say: "Nobody has to say anything. Follow me, your hand says. That is what courage looks like.", mood: 'warm' },
        ] },
      ] } },

      "You all step out. One plank. Two. The bridge sways, and far below, the glow seems to breathe in.",
      { sfx: 'whoosh' },
      { say: "Halfway across, there comes a sound you never want to hear on a rope bridge. Twang.", mood: 'excited' },

      { challenge: {
        title: 'The Fraying Bridge',
        intro: [
          "This is a group challenge. Everyone takes a turn. Three good rolls get you across. Three bad ones, and, well. Splash.",
        ],
        need: 3, allow: 3,
        turns: [
          { label: 'Catch the snapping rope', stat: 'might', dc: 'medium', talent: 'stand_firm',
            win: "You grab the snapping rope and hold it, arms shaking. The bridge stops tipping. Good grip.",
            lose: "You grab the rope. The rope grabs back. You spin round it like a maypole and end up facing the wrong way." },
          { label: 'Leap the missing planks', stat: 'agility', dc: 'medium',
            win: "Three planks are gone. You run, jump, and land on the fourth like a cat on a fence.",
            lose: "You jump. You land. The plank you land on decides to retire. You grab the edge just in time, legs kicking." },
          { label: 'Find the safe planks', stat: 'wits', dc: 'medium', talent: 'animal_friend',
            win: "You spot which planks are pale and dry and which are dark and soggy. Everybody steps where you step.",
            lose: "You point confidently at a plank. It falls off. You point at another one, much less confidently." },
          { label: 'Keep everyone calm', stat: 'heart', dc: 'medium', talent: 'silver_tongue',
            win: "You start a silly marching song. Left foot, right foot, don't look down. Everyone sings. Nobody looks down.",
            lose: "You say, kindly: whatever you do, don't look down. So, naturally, everybody looks down." },
          { label: 'Tie a new knot', stat: 'agility', dc: 'hard', talent: 'nimble_fingers',
            win: "Your fingers fly. Over, under, round and through. A knot so good the old stone-folk would weep.",
            lose: "Your fingers fly. Over, under, round and through. Somehow you have tied your own sleeve to the bridge." },
        ],
        success: [
          { sfx: 'fanfare.small' },
          "The last of you leaps onto solid rock, and behind you the bridge gives up completely. It drops into the dark, twanging all the way down.",
          { say: "Nobody speaks. Then everyone laughs at once, the shaky kind of laugh. You made it. Together.", mood: 'warm' },
          "You straighten your clothes in front of the spoon door. Behind it, someone is practising a speech.",
        ],
        fail: [
          { say: "Snap. The bridge lets go. For one long moment you all hang in the air like surprised washing.", mood: 'excited' },
          { sfx: 'splash' },
          { say: "Then: SPLOOSH. Straight into the underground river. It is cold. It is very, very cold.", mood: 'funny' },
          { hurt: 2, who: 'all' },
          "The river whooshes you round a bend, down a slide of smooth stone, and spits you out in a heap on a pile of old spoons.",
          "Your boots are full of water. Something in your hood is wriggling. But look: you have washed up at the vault's back door.",
          { if: 'knows_back_door', then: [
            { say: "Back door, by the river, very wet. Glint's note was right about one thing, at least.", mood: 'funny' },
          ] },
          "And caught in your sleeve are three coins, shining gold. The river must think you deserve a little luck.",
          { gold: 3 },
          { set: { soggy: true } },
          "Behind the little door, someone is practising a speech.",
        ],
      } },

      { journal: "Crossed the great chasm, one way or another, and reached the vault of Glint the Magnificent." },
      { travel: 'glint_vault' },
      { goto: 'glint_vault' },
    ],
  },

  // ------------------------------------------------------------------
  glint_vault: {
    id: 'glint_vault', title: "Glint's Vault", subtitle: 'The Magnificent, apparently',
    bg: 'glint_vault', music: 'dungeon', ambience: 'cave', weather: 'dust',
    steps: [
      { if: 'soggy',
        then: [ { say: "You squelch through a little back door, dripping. Squelch. Squelch. Very sneaky. Not at all.", mood: 'funny' } ],
        else: [ "You push open the spoon door. It jingles like the world's biggest wind chime. So much for sneaking." ] },
      { say: "Inside: mountains. Mountains of shiny things. Clocks and kettles, spoons and crowns, mirrors and doorknobs and a hundred lost buttons.", mood: 'hush' },
      "It smells of metal polish and burnt toast. A thousand clocks tick, all slightly out of time.",
      "High at the back, on a wobbly workshop platform, a blue glow sits on a velvet cushion. The Songstone of Midnight.",
      { sfx: 'fanfare.small' }, { fx: 'flash' },
      { say: "A spotlight swings round and lands on top of the biggest junk pile. Someone up there clears their throat.", mood: 'excited' },
      { show: 'glint', at: 'right' },
      { say: "Ahem! Welcome, welcome, most humble visitors, to the Vault of Glint the Magnificent! That's me. I'm Glint. Hello.", as: 'glint', mood: 'grand' },
      { say: "You stand before the largest, loveliest, most extremely shiny collection in this mountain, or any mountain, or frankly anywhere at all!", as: 'glint', mood: 'grand' },
      { say: "Behold: one thousand spoons! Behold: a crown! It's slightly a teapot lid! And behold, my masterpiece: the singing stone of Midnight!", as: 'glint', mood: 'excited' },
      { say: "He sweeps his magpie-feather cloak. A few feathers fall off. He tries to catch them without anybody noticing.", mood: 'funny' },
      { if: 'teapot_hat', then: [
        { say: "Wait. I've heard of you! The teapot hat! The whole market's talking. A GOOD teapot, they said. I'd like that teapot. No. Focus, Glint.", as: 'glint', mood: 'funny' },
      ] },
      { if: { has: 'brass_feather_key' }, then: [
        { say: "Wait. Is that my key? That's my key! I've looked for that for weeks! Did you find a note as well? Never mind. Don't read the note.", as: 'glint', mood: 'funny' },
      ] },
      { say: "Now! You may admire things. From there. Do not touch. Especially not the stone. Please. I mean: ha! Begone! Is my cloak straight?", as: 'glint' },

      { choice: { prompt: 'Glint is waiting, rather nervously. What do you do?', options: [

        { label: 'Tell him it really is impressive', stat: 'heart', steps: [
          { check: { stat: 'heart', dc: 'medium', label: 'Be honest and kind to Glint',
            success: [
              "You tell him the truth. It really is the most impressive pile of spoons you have ever seen. Glint blinks.",
              { say: "You think it's impressive? Nobody's ever... I mean, obviously it is! Obviously. But nobody's ever said.", as: 'glint', mood: 'sad' },
              { say: "That was kind, to a thief. For one second his hand leaves the lever. Then his ears go pink, and he grabs it again.", mood: 'warm' },
            ],
            fail: [
              "You say: it's very... shiny? It comes out like a question. Glint's ears go flat.",
              { say: "Shiny? SHINY? It is MAGNIFICENT. Right. That's it. You asked for it. Well, you didn't, but you will have!", as: 'glint', mood: 'funny' },
            ],
          } },
        ] },

        { label: 'Climb the junk mountain', stat: 'agility', steps: [
          TEACH_SKILL,
          { skill: { kind: 'balance', stat: 'agility', dc: 'medium', label: 'Scramble up the junk',
            success: [
              "You scramble up the spoons like a mountain goat, knees clanking, halfway to the top before he notices.",
              { say: "Off! Off! That's the antique section!", as: 'glint', mood: 'funny' },
            ],
            crit: [
              { say: "You climb, you flip, and you land on the platform right beside him. Glint screams. It is a very small scream.", mood: 'excited' },
            ],
            fail: [
              { say: "Three steps up, the pile slides. You surf down on a tea tray through forty spoons, and stop at the bottom with a kettle on your head.", mood: 'funny' },
            ],
          } },
        ] },

        { label: 'Look for what he is hiding', stat: 'wits', steps: [
          { check: { stat: 'wits', dc: 'medium', label: 'Spot the hidden machine',
            success: [
              "Under the junk you spot iron legs, steam pipes, and a big lever in Glint's hand. He is sitting on a machine.",
              { say: "And the joints are full of gaps. Anything that tangles them, like a good thick vine, would jam the whole thing up.", mood: 'hush' },
            ],
            fail: [
              { say: "You stare hard at the junk. The junk stares back. A clock falls over. That is everything you learn.", mood: 'funny' },
            ],
          } },
        ] },

        { label: 'Read the plans on the wall', talent: 'read_runes', steps: [
          "Pinned to the wall are plans, covered in ink blots and doodles of Glint looking heroic. One label is underlined twice:",
          { say: "Weak spot: the joints. Do not tell anyone. Especially not heroes.", as: 'glint', mood: 'funny' },
          "Anything that tangles those joints, like vines, will jam the whole thing. Good to know.",
        ] },

        { label: 'Sneak up and swipe the stone', talent: 'nimble_fingers', steps: [
          "You slip between the junk piles, quiet as dust. Your fingers close on the velvet cushion. The stone is right there...",
          { sfx: 'chime.wrong' },
          "Then a tiny bell, tied to the cushion, goes ding.",
          { say: "A BELL! I put a BELL on it! Oh, I'm so clever! I'm so clever it's frightening!", as: 'glint', mood: 'excited' },
        ] },
      ] } },

      { say: "Glint pulls the lever. And the junk mountain beneath him heaves, and rises.", mood: 'ominous' },
      { sfx: 'rumble' }, { fx: 'shake' }, { music: 'boss' },
      { say: "Kettles become a body. Clocks become knees. Two giant spoon claws snap open. Steam hisses from every spout.", mood: 'excited' },
      { say: "Behold! The CLATTERCLAW! I built it myself! Mostly out of things people were still using! Charge! Please charge!", as: 'glint', mood: 'grand' },
      { hide: 'glint' },

      { combat: 'clatterclaw',
        win: [
          { music: 'dungeon' },
          { sfx: 'rumble' },
          "The Clatterclaw shudders. A bolt pings off. Then another. Then it all comes apart, very slowly, like a sandcastle in the tide.",
          { say: "Kettles bounce. Clocks roll away, ringing. And out of the middle tumbles Glint, landing on his bottom in a heap of spoons.", mood: 'funny' },
          { show: 'glint', at: 'center' },
          "Without his machine, he is just a small goblin in a very big cloak. It slides off one shoulder. He doesn't fix it.",
          { say: "Fine. Take it. Everyone always takes everything. Or they leave. Everything beautiful goes away. Summers. Moths. Friends.", as: 'glint', mood: 'sad' },
          { say: "I just wanted one beautiful thing that would stay. And the stones sang. Every night. To me.", as: 'glint', mood: 'sad' },
          { say: "I didn't know it would make it snow. I didn't know about the dragon. Honest. I'm only a little bit magnificent.", as: 'glint', mood: 'sad' },
          "He wipes his nose on a feather. The vault is very quiet now.",

          { choice: { prompt: 'What do you do about Glint?', options: [

            { label: 'Forgive him, and ask for help', stat: 'heart', steps: [
              "You crouch down and tell him: we're going to sing the dragon to sleep. We could use someone clever with broken things.",
              { say: "Help? Me? You'd let me? Yes! Glint the Magnificent, at your service! Glint the Helpful! Glint the... I'll work on it.", as: 'glint', mood: 'excited' },
              { set: { spared_glint: true } },
              { say: "Being kind to someone who wronged you is the hardest kindness there is. Wick, ring the bell. Take a Star.", mood: 'warm' },
              { star: 1, why: 'For forgiveness' },
            ] },

            { label: 'Make him promise to give it all back', stat: 'wits', steps: [
              "You hold out your little finger. He stares at it. Then, slowly, he hooks it with his own.",
              { say: "I promise. Every spoon. Every button. Even the crown that's a teapot lid. Glint keeps his promises. Starting... now.", as: 'glint' },
              { set: { glint_promise: true } },
            ] },

            { label: 'Shoo him off', stat: 'might', steps: [
              "You point at the door. Glint grabs his cloak and scurries off, tripping over his own feathers.",
              { say: "I'm going! I'm going! You'll miss me! ...You won't, will you.", as: 'glint', mood: 'sad' },
              { hide: 'glint' },
              "Fair enough. He has a lot to think about. Maybe, one day, he will.",
            ] },

            { label: 'Give him a seed that comes back', talent: 'herb_lore', steps: [
              "You find a seed in your pocket. A moonbell: it sleeps all winter and comes back every spring, all by itself.",
              "You put it in his hand. Something beautiful that stays, if you look after it.",
              { say: "It comes back? Every year? On purpose?", as: 'glint', mood: 'hush' },
              "He holds it like it's made of glass. He will not let go of it for the rest of the night.",
              { set: { spared_glint: true } },
              { say: "Being kind to someone who wronged you is the hardest kindness there is. Wick, ring the bell. Take a Star.", mood: 'warm' },
              { star: 1, why: 'For a gift that stays' },
            ] },
          ] } },
        ] },

      { say: "On the velvet cushion, the Songstone of Midnight glows deep blue, like the sky just before the stars come out.", mood: 'hush' },
      { give: 'songstone_midnight' },
      "The moment you lift it, it starts to sing. Low, a little higher, low again. Like a heartbeat. Sing it back.",
      { puzzle: 'melody', mode: 'learn', phrase: 3,
        success: [
          { sfx: 'chime.right' },
          { say: "The stone glows brighter in your hands. Now you know all three parts of the lullaby. Morning. Evening. Midnight.", mood: 'grand' },
        ],
        fail: [
          "Mostly right. Ish. The stone hums it again, patiently, like a teacher who has done this before. You'll remember when it counts.",
        ] },

      { sfx: 'roar' }, { fx: 'shake' },
      { say: "Then, from far below, a sound shakes the spoons off every shelf. A groan. Huge. Not angry. Just very, very tired.", mood: 'ominous' },
      { if: 'spared_glint',
        then: [
          { show: 'glint', at: 'center' },
          { say: "That's her. The dragon. This way, I know a shortcut! It's mostly a slide. Hold on to something! Not that! That's mine!", as: 'glint', mood: 'excited' },
          { hide: 'glint' },
        ],
        else: [
          { hide: 'glint' },
          "A crack opens in the floor, glowing gold. Hot air rushes up. Down there is the heart of the mountain. Run!",
        ] },
      { journal: "Beat the Clatterclaw and won back the Songstone of Midnight. Learned the whole lullaby." },
      { travel: 'dragon_lair' },
      { goto: 'dragon_lair' },
    ],
  },
};
