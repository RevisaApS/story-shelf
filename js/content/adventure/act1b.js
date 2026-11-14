// Act I, second half: the Old Stone Bridge, Moonpetal Glade, and the first camp.
// Written by story-2. Every spoken line is voiced by Old Quill (or the NPC in `as`).

// Said once, before the first skill challenge a party meets (ROUND2 3.3). Same text in every act file.
const TEACH_SKILL = { if: { not: 'taught_skill' }, then: [
  { say: "No die for this one. This one is up to your own two hands. Watch how it goes, then have a go.", mood: 'warm' },
  { set: { taught_skill: true } },
] };

// --- Grumble becomes a friend: shared by every friendly path at the bridge ---
const GRUMBLE_FRIEND = [
  { set: { troll_friend: true } },
  { say: "Grumble sniffs. Then he reaches into his mouth, wiggles something, and pulls out a tooth the size of a teacup.", mood: 'funny' },
  { say: "Tooth. Wobbly. Lucky. For you.", as: 'grumble' },
  { give: 'troll_tooth' },
  "It is warm, a little damp, and it makes you feel strong enough to carry a cow. That is what troll friendship feels like.",
  { say: "Come back. Talk. Bring pie.", as: 'grumble' },
];

// --- The riddle contest: three real riddles, two right to win ---
const RIDDLES = [
  { set: { riddle_1: false, riddle_2: false, riddle_3: false } },
  { say: "Riddles! Grumble's whole face lights up, which takes a while, because there is a lot of face.", mood: 'excited' },
  { say: "Three riddles. Two right. You cross.", as: 'grumble' },
  "Put your heads together, all of you. This one is for the whole table.",
  { say: "First. What has a bed, but never sleeps? And a mouth, but never eats?", as: 'grumble' },
  { choice: { prompt: 'A bed that never sleeps, a mouth that never eats...', options: [
    { label: 'A river', steps: [
      { set: { riddle_1: true } },
      { say: "Hrrm! River. Yes. Like that one. Loud mouth. Never sleeps. Keeps me up.", as: 'grumble' },
    ] },
    { label: 'A troll', steps: [
      { say: "Troll? I sleep. Lots. And I eat. Lots. Wrong.", as: 'grumble' },
      { say: "He pats his tummy, which makes a sound like a drum full of soup.", mood: 'funny' },
    ] },
    { label: 'A pillow', steps: [
      { say: "Pillow. No mouth. Unless... no. Wrong.", as: 'grumble' },
      "He looks at his armchair suspiciously, just in case.",
    ] },
    { label: 'A crocodile with insomnia', steps: [
      { say: "Grumble thinks about this for a very long time. A moth lands on his nose and leaves again.", mood: 'funny' },
      { say: "Good guess. Funny. Wrong.", as: 'grumble' },
    ] },
  ] } },
  { say: "Second. The more you take, the more you leave behind. What?", as: 'grumble' },
  { choice: { prompt: 'The more you take, the more you leave behind...', options: [
    { label: 'Biscuits', steps: [
      { say: "Biscuits. Hrrm. If you take biscuits, I get none. Wrong. Sad.", as: 'grumble' },
    ] },
    { label: 'Footsteps', steps: [
      { set: { riddle_2: true } },
      { say: "Footsteps! Yes. Everybody takes footsteps. Away from me. Quickly.", as: 'grumble' },
      { say: "He says it like a joke. It does not quite sound like one.", mood: 'sad' },
    ] },
    { label: 'Naps', steps: [
      { say: "Naps. Take a nap, leave a... drool. Close. Wrong.", as: 'grumble' },
    ] },
  ] } },
  { say: "Last one. Hard one. What gets wetter, and wetter, the more it dries?", as: 'grumble' },
  { choice: { prompt: 'Wetter and wetter, the more it dries...', options: [
    { label: 'A fish', steps: [
      { say: "Fish. Fish never dry. Fish just wet. Wrong.", as: 'grumble' },
    ] },
    { label: 'The moon', steps: [
      { say: "Everyone looks up at the moon. The moon looks perfectly dry. Wrong, says Grumble, kindly.", mood: 'funny' },
    ] },
    { label: 'A towel', steps: [
      { set: { riddle_3: true } },
      { say: "Towel! Yes! I had a towel once. Lost it. In the river. It got very wet.", as: 'grumble' },
    ] },
    { label: "Grumble's armchair", steps: [
      { say: "My chair? Chair is rock. Rock does not dry. Rock does not do anything. Wrong.", as: 'grumble' },
    ] },
  ] } },
  { if: { any: [ { all: ['riddle_1', 'riddle_2'] }, { all: ['riddle_1', 'riddle_3'] }, { all: ['riddle_2', 'riddle_3'] } ] },
    then: [
      { sfx: 'fanfare.small' },
      { say: "Grumble claps. It sounds like two boulders meeting at a party.", mood: 'excited' },
      { say: "You win. Clever. Nobody plays with me. Thirty years. You played.", as: 'grumble' },
      ...GRUMBLE_FRIEND,
    ],
    else: [
      { say: "Grumble laughs so hard the whole bridge shakes and three fish jump out of the river to see what is going on.", mood: 'funny' },
      { say: "You lose. Terrible. Best game in thirty years.", as: 'grumble' },
      "And he steps aside anyway. Nobody has played with him in a very long time, and that was worth more than any toll.",
      ...GRUMBLE_FRIEND,
    ] },
];

// --- Grumble's long, slow sigh: used when someone asks what is wrong ---
const GRUMBLE_SAD = [
  { say: "Nobody stops. Everybody runs. I say toll, they scream, they run.", as: 'grumble', mood: 'sad' },
  { say: "I just want... chat. Somebody to say, nice bridge, Grumble. Good moss.", as: 'grumble', mood: 'sad' },
];

export default {
  // ------------------------------------------------------------------
  stone_bridge: {
    id: 'stone_bridge', title: 'The Old Stone Bridge', subtitle: 'Toll: one riddle, or one pie',
    bg: 'stone_bridge', music: 'forest', ambience: 'night', weather: 'mist',
    steps: [
      "You hear it before you see it: the Tumblewater, roaring down the gorge like a herd of very wet horses.",
      { if: 'thorn_friends', then: [
        { say: "Behind you, a row of tiny glowing eyes blinks from the brambles. The Thornlings are waving goodbye. One blows its nose on a leaf.", mood: 'funny' },
      ] },
      "Ahead, an old stone bridge arches over the water, green with moss and silver with moonlight. The air smells of wet stone and river mint.",
      "At the near end stands an armchair. A troll-sized armchair, made of boulders. Beside it, a crooked wooden sign. It says: TOLL.",
      { sfx: 'rumble' },
      { fx: 'shake' },
      { say: "Then one of the boulders stands up.", mood: 'hush' },
      { show: 'grumble', at: 'right' },
      { say: "Hrrm. Bridge. Mine.", as: 'grumble' },
      { wait: 600 },
      { say: "Toll.", as: 'grumble' },
      { say: "He is as big as a barn and twice as mossy. A small yellow flower grows on top of his head. He has clearly waited years to say that word.", mood: 'funny' },
      { say: "Now. Trolls judge each other mostly by their growl. And I happen to know there are some excellent growlers at this table.", mood: 'funny' },
      { table: { text: "Everyone at the table: give Grumble your very best troll growl. Deep, slow and rumbly. Ready? Growl!", done: 'We growled!' } },
      { say: "Grumble's ears swivel. Hrrm. Good growl. For a moment he looks almost proud of you.", mood: 'warm' },
      { say: "Then his face falls back into its usual shape, which is a frown with moss on it.", mood: 'funny' },
      { choice: { prompt: 'Grumble wants a toll. How do you get across?', options: [
        // clever
        { label: 'Challenge him to a riddle contest', stat: 'wits', hint: 'Trolls love riddles', steps: RIDDLES },

        // kind (callback: the pie from the village)
        { label: 'Offer him the blackberry pie', requires: { has: 'blackberry_pie' }, hint: 'You won it fair and square', steps: [
          { take: 'blackberry_pie' },
          { set: { gave_pie: true } },
          { say: "You hold out the pie. The prize pie, from the contest. It is still a tiny bit warm.", mood: 'hush' },
          { say: "Grumble's nose twitches. His eyes go wide. His bottom lip begins, very slowly, to wobble.", mood: 'funny' },
          { say: "For... me? Nobody... pie. Ever.", as: 'grumble', mood: 'sad' },
          "He eats it in one bite. Then he eats the dish. Then he says sorry for eating the dish.",
          { say: "That was kind. Truly kind. Take a Star.", mood: 'warm' },
          { star: 1, why: 'For kindness' },
          ...GRUMBLE_FRIEND,
        ] },

        // bold
        { label: 'Arm-wrestle him for it', stat: 'might', hint: 'Very hard. He is mostly rock', steps: [
          { say: "Grumble looks at your arm. Then at his own arm, which is roughly the size of a pine tree. He grins.", mood: 'funny' },
          { say: "Hrrm. Brave. Rock. Here.", as: 'grumble' },
          "He kneels by a flat boulder and plants his elbow. The stone cracks a little. You plant yours. Hands clasp.",
          TEACH_SKILL,
          { skill: { kind: 'mash', stat: 'might', dc: 'hard', talent: 'stand_firm', label: 'Out-muscle a troll',
            success: [
              { sfx: 'hit.heavy' },
              "You push. He pushes. Your teeth grit, his eyebrows rise, and inch by inch his giant hand goes down. Thump.",
              { say: "Grumble stares at his own hand like it has betrayed him. Then he roars with laughter.", mood: 'excited' },
              { say: "Strong! Small and strong! Like an angry pebble!", as: 'grumble' },
              ...GRUMBLE_FRIEND,
            ],
            crit: [
              { sfx: 'hit.heavy' },
              { fx: 'shake' },
              { say: "You slam his hand down so hard the boulder splits in two. Fish leap from the river to applaud. Grumble gasps.", mood: 'excited' },
              { say: "Nobody. Ever. You are... troll strong.", as: 'grumble' },
              ...GRUMBLE_FRIEND,
            ],
            fail: [
              "You push with everything you have. Grumble does not move. Grumble yawns. Grumble checks a bird's nest in his beard.",
              { say: "Then, very gently, he lowers your hand to the rock, like tucking a baby into bed.", mood: 'funny' },
              { say: "Good try. Strong try. Again sometime? I like the trying.", as: 'grumble' },
              ...GRUMBLE_FRIEND,
            ],
          } },
        ] },

        // sneaky / agile
        { label: 'Sneak across underneath', stat: 'agility', hint: 'Along the slippery stones', steps: [
          "While Grumble is busy frowning, you slip over the bank and onto the slimy stones under the arch.",
          TEACH_SKILL,
          { skill: { kind: 'sneak', stat: 'agility', dc: 'medium', label: 'Creep under the bridge',
            success: [
              "Step, wobble, step. The river roars an inch from your boots. Then you are up the far bank, dry and grinning.",
              { say: "Behind you, Grumble sits down in his big stone chair. He lets out a sigh that bends the reeds.", mood: 'sad' },
              { choice: { prompt: 'Grumble looks so lonely. What now?', options: [
                { label: 'Go back and say hello', stat: 'heart', steps: [
                  "You walk back across. In the open. Grumble watches you come, astonished.",
                  { say: "You... came back? Nobody comes back.", as: 'grumble' },
                  "You tell him it is a very nice bridge. He tells you it is a very nice face you have. You both mean it.",
                  { say: "Coming back took more courage than sneaking. Take a Star.", mood: 'warm' },
                  { star: 1, why: 'For kindness' },
                  ...GRUMBLE_FRIEND,
                ] },
                { label: 'Wave and keep going', steps: [
                  "You wave. After a long moment, a hand the size of a door waves back. It is a start.",
                ] },
              ] } },
            ],
            fail: [
              { sfx: 'splash' },
              "Step, wobble, step, wobble, wobble, and whoops. You slide off the stone and dangle over the water by one boot.",
              { say: "A huge hand plucks you up by the collar and sets you down, dripping, on the bridge.", mood: 'funny' },
              { say: "Hrrm. Wet. Silly. Why sneak? Could just ask.", as: 'grumble' },
              ...GRUMBLE_SAD,
              "So you sit with him a while, dripping, and say exactly that. Nice bridge. Good moss. He goes pink under the green.",
              ...GRUMBLE_FRIEND,
            ],
          } },
        ] },

        // kind / heart
        { label: 'Ask him why he looks so sad', stat: 'heart', steps: [
          "You do not run. You do not scream. You sit down on the bridge and ask him how he is.",
          { say: "Grumble freezes. Nobody has ever asked him that.", mood: 'hush' },
          { check: { stat: 'heart', dc: 'medium', label: 'Get a lonely troll to open up',
            success: [
              ...GRUMBLE_SAD,
              "So you say it. Nice bridge, Grumble. Good moss. And the flower on your head is very handsome.",
              { say: "A tear the size of an apple rolls down his nose and plops in the river.", mood: 'warm' },
              ...GRUMBLE_FRIEND,
            ],
            fail: [
              { say: "Grumble mumbles something. You lean closer. He mumbles closer. You both bump heads.", mood: 'funny' },
              { say: "Ow. Hrrm. Sorry. Not good at... words. Out of practice.", as: 'grumble' },
              ...GRUMBLE_SAD,
              "It is a slow, wobbly chat with a lot of hrrms in it. But it is the first chat he has had in thirty years.",
              ...GRUMBLE_FRIEND,
            ],
          } },
        ] },

        // talent: nimble fingers
        { label: 'Open his rusty toll box', talent: 'nimble_fingers', hint: 'It has been stuck for years', steps: [
          "Beside the chair sits a little iron toll box, rusted shut. Grumble's fingers are far too big for the lock. He has never once opened it.",
          "You kneel, wiggle a hairpin, listen, and click. The lid creaks open.",
          { say: "Inside: one button, one acorn, and a child's drawing of a smiling troll. Someone left it here long ago. For him.", mood: 'hush' },
          { say: "Grumble holds the drawing very carefully between two enormous fingers. That's me, he whispers. Somebody liked me.", mood: 'warm' },
          { gold: 2 },
          ...GRUMBLE_FRIEND,
        ] },
      ] } },

      { if: 'troll_friend',
        then: [
          { say: "Grumble walks you across his bridge like it is a palace. At the far end he waves, and keeps waving, until the trees hide him.", mood: 'warm' },
          { journal: "Crossed the Old Stone Bridge and made a friend of Grumble the troll, who gave us a lucky tooth." },
        ],
        else: [
          { journal: "Slipped past Grumble the troll at the Old Stone Bridge." },
        ] },
      { sfx: 'chime.right' },
      { say: "Then, in your pack, something begins to hum. The tuning fork. Very softly, it is singing toward the trees ahead.", mood: 'hush' },
      "Somewhere up there, through the dark, a soft blue light is glowing. What could be waiting?",
      { travel: 'moonpetal_glade' },
      { goto: 'moonpetal_glade' },
    ],
  },

  // ------------------------------------------------------------------
  moonpetal_glade: {
    id: 'moonpetal_glade', title: 'Moonpetal Glade', subtitle: 'The court of the Glowmoths',
    bg: 'moonpetal_glade', music: 'glade', ambience: 'forest', weather: 'fireflies',
    steps: [
      "You follow the hum through the ferns, and the trees step back, and there it is.",
      "A ring of giant white flowers, each one glowing like a lamp. The air smells of honey and cold rain. And everywhere, moths.",
      { say: "Hundreds of them, softly glowing, drifting like slow sparks. They are all huddled around one light. A warm, amber light.", mood: 'hush' },
      { sfx: 'chime.right' },
      "The tuning fork in your pack jumps and rings. That amber light is a Songstone. The Songstone of Morning.",
      { show: 'queen_lumina', at: 'right' },
      "It sits in the lap of a tiny figure on a mushroom throne. She is no taller than a teacup, and she glows brighter than all her moths.",
      { say: "Halt! Who tramples into the court of the Glowmoths, in boots, at this hour?", as: 'queen_lumina' },
      { if: 'hay_hair', then: [
        { say: "And why does one of you have hay in their hair? Is it a hat? It is not a good hat.", as: 'queen_lumina' },
      ] },
      { say: "I am Lumina, Queen of the Glowmoths. You may bow. Lower. No, that is too low, now you look silly. Perfect.", as: 'queen_lumina' },
      { say: "Ever since the singing stopped, the nights are cold and dark. My moths are frightened of the dark.", as: 'queen_lumina', mood: 'sad' },
      { say: "Then this lovely thing rolled out of the sky. It is our nightlight now. And you cannot have it.", as: 'queen_lumina' },
      { wait: 500 },
      { say: "Unless... you offer me something worth it. I do love a good offer.", as: 'queen_lumina' },
      { choice: { prompt: 'What will you offer the Queen?', options: [
        // bold / performance
        { label: 'Put on a performance', stat: 'heart', once: true, hint: 'Song, dance, anything with flair', steps: [
          { say: "A performance! The moths settle on the flowers like an audience in velvet seats.", mood: 'excited' },
          { check: { stat: 'heart', dc: 'medium', talent: 'silver_tongue', label: 'Dazzle the Glowmoth court',
            success: [
              { sfx: 'spell.song' },
              "You sing, you twirl, you bow at exactly the right moment. The moths swirl around you in a glowing ribbon.",
              { say: "Well! That was nearly as good as me. Nearly.", as: 'queen_lumina' },
            ],
            crit: [
              { sfx: 'spell.song' },
              { say: "You give the performance of your life. The moths spell a glowing heart in the air. The Queen dabs her eyes with a petal.", mood: 'excited' },
              { say: "Bravo! Bravo! I am not crying, it is pollen!", as: 'queen_lumina' },
            ],
            fail: [
              { say: "You start well. Then you forget every word and finish with a long, confident hum. Dum de dum. Dum.", mood: 'funny' },
              { say: "Dreadful. Delightful. Never again. Try something else.", as: 'queen_lumina' },
              { again: true },
            ],
            fumble: [
              { say: "You bow with a flourish, trip over a mushroom and roll gently into a flower. It closes around you. You are now a bud.", mood: 'funny' },
              { say: "The whole court laughs so hard their glow flickers. Lovely. But no. Something else.", as: 'queen_lumina' },
              { again: true },
            ],
          } },
        ] },

        // clever / star pattern
        { label: 'Play her star-pattern game', stat: 'wits', once: true, hint: 'Which star comes next?', steps: [
          { say: "Oh, a clever one. Moths! Places!", as: 'queen_lumina' },
          "Her moths rise and hang in the air in a pattern: one, then three, then five. A glowing staircase of stars. One gap is left at the top.",
          { say: "Which comes next? Guess wrong and you must hop on one foot until I say stop.", as: 'queen_lumina' },
          TEACH_SKILL,
          { skill: { kind: 'memory', stat: 'wits', dc: 'medium', talent: 'read_runes', label: 'Solve the star staircase',
            success: [
              "One, three, five... seven! You point. Seven moths flutter up and fill the gap, and the whole staircase shines.",
              { say: "Correct! How annoying. I mean, how wonderful.", as: 'queen_lumina' },
            ],
            fail: [
              { say: "You point confidently at a star. It is not a star. It is a moth who sneezed.", mood: 'funny' },
              { say: "Wrong! Hop! Hop, hop. Keep hopping. All right, you may stop. Try something else.", as: 'queen_lumina' },
              { again: true },
            ],
          } },
        ] },

        // agile
        { label: 'Play catch-the-wisp', stat: 'agility', once: true, hint: 'Quick hands, quick feet', steps: [
          "The Queen claps. A tiny silver wisp of moonlight zips out of a flower and darts around the glade, giggling.",
          { say: "Catch it before it hides, and I shall be impressed. I am very hard to impress.", as: 'queen_lumina' },
          TEACH_SKILL,
          { skill: { kind: 'aim', stat: 'agility', dc: 'medium', label: 'Catch the giggling wisp',
            success: [
              "You feint left, spin right, and cup the wisp in your hands. It tickles. It giggles. It glows between your fingers.",
              { say: "Impressive. Fine. I am impressed. Do not tell anyone.", as: 'queen_lumina' },
            ],
            crit: [
              { say: "You leap off a mushroom, flip over a flower and catch the wisp in your hat. The moths cheer. One faints.", mood: 'excited' },
              { say: "Show-off. I like it.", as: 'queen_lumina' },
            ],
            fail: [
              { sfx: 'splash' },
              { say: "You dive, you grab, and you land face first in a puddle of dew. In your hands: one very surprised beetle.", mood: 'funny' },
              { say: "That is a beetle. Put him down. Try something else.", as: 'queen_lumina' },
              { again: true },
            ],
          } },
        ] },

        // kind / the promise
        { label: 'Promise to bring the warm nights back', stat: 'heart', hint: 'A promise costs something real', steps: [
          "You kneel so you are eye to eye with the Queen. You tell her the truth: that stone belongs to the mountain, and without it the cold will stay.",
          "You promise to bring back the warm nights. For her, and for every frightened moth.",
          { if: { stars: 1 },
            then: [
              { say: "A promise like that costs something real. One of your Stars lifts out of the pool, floats up, and becomes a little lamp for the moths.", mood: 'hush' },
              { star: -1, why: 'A promise to the moths' },
            ],
            else: [
              { say: "You have no Stars to give. So you give your word instead. The Queen decides that is worth exactly the same.", mood: 'hush' },
            ] },
          { set: { glowmoth_friend: true } },
          { say: "Hmph. Nobody has ever promised me anything. Except my moths, and they promise to be good, and they lie.", as: 'queen_lumina' },
          { say: "Very well. The Glowmoths will remember this. When you need light, call us.", as: 'queen_lumina', mood: 'grand' },
        ] },

        // talent: herb lore
        { label: 'Brew the moths a brave-tea', talent: 'herb_lore', hint: 'Moonpetals calm a frightened heart', steps: [
          "You pick three moonpetals, warm them in your hands, and breathe on them. They begin to steam. The smell is like a hug.",
          { say: "The moths drift down, one by one, and drink the steam. Their trembling stops. A few even yawn.", mood: 'hush' },
          { say: "They are not afraid. Look at them. Not afraid at all.", as: 'queen_lumina', mood: 'warm' },
          { set: { glowmoth_friend: true } },
          { give: 'moonpetal_tea' },
          { say: "You did not trick a queen. You helped her people. That is what heroes are for.", mood: 'warm' },
        ] },
      ] } },

      // the swap
      { say: "Queen Lumina floats down from her throne, holding the amber stone in both arms like a sleeping kitten.", mood: 'hush' },
      { say: "Take it, then. But be quick. My moths can be brave for exactly one night.", as: 'queen_lumina' },
      { give: 'songstone_morning' },
      "It is warm, like a stone that has been lying in the sun. And as you hold it, it begins, very softly, to sing.",
      { say: "Three notes, climbing like a sunrise. This is the first part of the dragon's lullaby. Listen. Then sing it back.", mood: 'hush' },
      { puzzle: 'melody', mode: 'learn', phrase: 1,
        success: [
          { sfx: 'sting.wonder' },
          { say: "The stone glows brighter, pleased. The first phrase of the lullaby is yours. Two more to find.", mood: 'warm' },
        ],
        fail: [
          { say: "Not quite. But the stone hums it again, patient as a grandmother. When it matters, you will know it.", mood: 'warm' },
        ] },
      { say: "One more thing, before you go. A warning.", as: 'queen_lumina', mood: 'ominous' },
      { say: "The night the stone fell, a crow was watching. A brass crow. Its eye glowed red. Crows like that belong to someone.", as: 'queen_lumina', mood: 'ominous' },
      { hide: 'queen_lumina' },
      { journal: "In Moonpetal Glade, Queen Lumina gave us the Songstone of Morning, and we learned the first part of the lullaby." },
      "You walk on, the stone warm in your pack. The forest gets deeper and quieter. Somewhere above, a branch creaks.",
      "Time to find somewhere to sleep.",
      { goto: 'camp_whisperwood' },
    ],
  },

  // ------------------------------------------------------------------
  camp_whisperwood: {
    id: 'camp_whisperwood', title: 'Camp in the Whisperwood', subtitle: 'A fire, a kettle, and the stars',
    bg: 'camp_whisperwood', music: 'camp', ambience: 'fire', weather: 'embers',
    steps: [
      "In a hollow between the roots of an old tree, you build a fire. It crackles. The kettle starts to sing.",
      "The smell of woodsmoke and warm cocoa curls up into the leaves. Above, through the branches, the stars are out.",
      { rest: true },
      { say: "Feel that? Every heart filling back up. That is what a good fire does.", mood: 'warm' },
      { if: 'duck_rescued', then: [
        { say: "Far away in Thistlehollow, a small boy is asleep with a wooden duck tucked under his chin. You did that. Remember it.", mood: 'warm' },
      ] },
      { if: 'troll_friend', then: [
        { sfx: 'rumble' },
        { say: "And far behind you, a deep rumble rolls through the trees. Grumble, practising his growl. For you.", mood: 'funny' },
      ] },
      { if: 'thorn_friends', then: [
        "In the bushes nearby, something prickly is snoring. The Thornlings have followed you. They are terrible at hiding.",
      ] },
      "Somebody finds a bag of slightly squashed marshmallows. Somebody else finds sticks. This is how the best parts of a journey begin.",
      { say: "On my shoulder, Wick the candle-dragon leans toward your fire and sighs. He likes a fire. It reminds him of his mother, who was a birthday cake.", mood: 'funny' },
      "The marshmallows go gold, then brown, then one of them catches fire and has to be blown out and eaten anyway. It is delicious.",
      { say: "Now. This is the part of the night where travellers talk.", mood: 'hush' },
      { actor: 'spotlight' },
      { table: { text: "A question for the table, by the fire: what does your hero miss most from home tonight? Each of you, tell everyone.", done: 'We told our stories', star: 1 } },
      { say: "Good. Those are the things worth coming home to. Hold them tight.", mood: 'warm' },
      { say: "You have walked a long way since the lanterns. You are not the same travellers who left the village.", mood: 'grand' },
      { levelup: 2 },
      { wait: 400 },
      { sfx: 'wing' },
      { say: "Then the fire pops, and in the quiet after, you hear it. Tick. Tick. Tick.", mood: 'hush' },
      { say: "High on a branch sits a crow. Its feathers shine like brass. One eye glows red, and it does not blink.", mood: 'ominous' },
      { choice: { prompt: 'A clockwork crow is watching you. What do you do?', options: [
        // kind
        { label: 'Wave at it', stat: 'heart', steps: [
          "You give it a friendly wave. The crow tilts its head. Click. Whirr. Click.",
          { say: "It does not wave back. Crows made of clockwork never do. But you were polite, and politeness is never wasted.", mood: 'warm' },
        ] },
        // bold
        { label: 'Throw a pinecone at it', stat: 'agility', steps: [
          { check: { stat: 'agility', dc: 'medium', label: 'Pinecone the crow',
            success: [
              { sfx: 'hit.light' },
              "Plonk! Right on its brass beak. The crow squawks, a noise like a door hinge, and flaps away.",
            ],
            crit: [
              { sfx: 'hit.heavy' },
              { say: "The pinecone hits it square. A spring goes boing. A cog falls out and lands in your cocoa. You keep the cog.", mood: 'excited' },
              { gold: 1 },
            ],
            fail: [
              { say: "You throw. The pinecone bounces off a branch, then another branch, then lands on your own head.", mood: 'funny' },
              "The crow watches all of this without blinking. You are fairly sure it is laughing at you.",
            ],
            fumble: [
              { sfx: 'splash' },
              { say: "You wind up, throw, and the pinecone lands in the kettle. Plop. Pinecone cocoa. Nobody wants pinecone cocoa.", mood: 'funny' },
            ],
          } },
        ] },
        // clever
        { label: 'Pretend to sleep and watch it', stat: 'wits', steps: [
          { check: { stat: 'wits', dc: 'medium', label: 'Fake-sleep and spy on the crow',
            success: [
              "You close your eyes almost all the way and snore a convincing snore. The crow hops closer.",
              { say: "Now you see it: a tiny key-shaped feather in its tail, and a little brass plate on its chest. A maker's mark, shaped like a magpie.", mood: 'hush' },
              { say: "Someone built this. Someone who likes shiny things. Clever eyes. Remember that mark.", mood: 'warm' },
            ],
            fail: [
              { say: "You close your eyes, snore a fake snore, and then snore a real one. You are fast asleep. You dream about soup.", mood: 'funny' },
              "When you wake, the crow is gone. There is a small brass dropping on your boot. Charming.",
            ],
          } },
        ] },
        // talent: animal friend
        { label: 'Ask Biscuit what he thinks', talent: 'animal_friend', steps: [
          "Biscuit lifts his nose, sniffs, and gives a low growl you have never heard from him before.",
          { say: "You understand him the way you always do. Not a bird, he says. Oil and clockwork. And it smells of goblin.", mood: 'hush' },
          "Good fox. Very good fox. He gets the last biscuit, which seems only fair.",
        ] },
      ] } },
      { sfx: 'wing' },
      { say: "The crow lifts off the branch and flies away, north, toward the mountain. Toward Mount Kettle, glowing faintly red.", mood: 'ominous' },
      "Whoever sent it now knows you are coming.",
      { journal: "Camped in the Whisperwood and grew stronger. A brass crow with one red eye watched us, then flew to the mountain." },
      { card: { kicker: 'Act I', title: 'The End of the First Night' } },
      "In the morning, the path leads down into fog. The ground goes soft. Somewhere, a frog says something rude.",
      { travel: 'mirefen_marsh' },
      { goto: 'mirefen_marsh' },
    ],
  },
};
