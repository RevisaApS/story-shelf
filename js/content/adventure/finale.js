// Finale: The Sleepless Dragon, and the dawn after.
// Written by story-3. Every spoken line is voiced by Old Quill (or the NPC in `as`).

// Said once, before the first skill challenge a party meets (ROUND2 3.3). Same text in every act file.
const TEACH_SKILL = { if: { not: 'taught_skill' }, then: [
  { say: "No die for this one. This one is up to your own two hands. Watch how it goes, then have a go.", mood: 'warm' },
  { set: { taught_skill: true } },
] };

// One dragon scale for each hero at the table.
const SCALES = [
  { if: { party: 4 }, then: [ { give: { id: 'dragon_scale', qty: 4 } } ], else: [
    { if: { party: 3 }, then: [ { give: { id: 'dragon_scale', qty: 3 } } ], else: [
      { if: { party: 2 }, then: [ { give: { id: 'dragon_scale', qty: 2 } } ], else: [
        { give: 'dragon_scale' },
      ] },
    ] },
  ] },
];

export default {

  // ------------------------------------------------------------------
  dragon_lair: {
    id: 'dragon_lair', title: 'The Hush-Shrine', subtitle: 'The heart of the mountain',
    bg: 'dragon_lair', music: 'lair', ambience: 'lair', weather: 'mist',
    steps: [
      { card: { kicker: 'Finale', title: 'The Sleepless Dragon' } },
      { say: "You come down into the heart of the mountain. The first thing you notice is the warmth. It wraps round you like a blanket fresh from the fire.", mood: 'hush' },
      "The second thing you notice is the breathing. In, like wind through a canyon. Out, like a hundred kettles.",
      "In front of you stands an ancient round shrine with three empty sockets. And behind it, filling the whole cave, a hill of red and gold.",
      { sfx: 'rumble' },
      { show: 'solenne', at: 'right' },
      { say: "The hill moves. An eye opens, big as a doorway, amber and half asleep. Antlers like winter trees, hung with tiny lantern-flowers.", mood: 'grand' },
      { say: "Solenne. Dragon of the Lantern Vale. The most beautiful thing you have ever seen. And so very, very tired.", mood: 'hush' },
      { say: "Little... lights. So small. So far from the valley. Have you come... to tell me... why the song stopped?", as: 'solenne', mood: 'hush' },
      { say: "I cannot sleep. And when I cannot sleep... my dreams... get out.", as: 'solenne', mood: 'sad' },
      { fx: 'dim' }, { sfx: 'sting.danger' },
      { say: "Smoke pours from her nostrils, dark and curling, with tiny cold stars for eyes. Her nightmares. They slide toward you, whispering.", mood: 'ominous' },

      { choice: { prompt: 'The bad dreams are coming. What do you do?', options: [

        { label: 'Tell Solenne you are here to help', stat: 'heart', steps: [
          { check: { stat: 'heart', dc: 'medium', label: 'Speak to the dragon',
            success: [
              "You walk right up to that enormous eye and say it plainly: we brought your song back. We are going to help you sleep.",
              { say: "The eye softens. A warm puff of breath rolls over you, smelling of summer hay. The nightmares flinch.", mood: 'warm' },
            ],
            fail: [
              { say: "You start to say it, but a nightmare whispers in your ear and it comes out as a squeak. Solenne blinks, very slowly. She heard you anyway.", mood: 'funny' },
            ],
          } },
        ] },

        { label: 'Stand between the dreams and your friends', stat: 'might', steps: [
          { check: { stat: 'might', dc: 'medium', label: 'Stare down the nightmares',
            success: [
              "You step forward, chin up, and stare the nightmares down. They hesitate. Nightmares are not used to being stared at.",
            ],
            crit: [
              { say: "You step forward and shout: NOT TODAY. The whole cave rings with it. Two nightmares fall over each other trying to get away.", mood: 'excited' },
            ],
            fail: [
              { say: "You step forward bravely, trip on a loose scale the size of a dinner plate, and land at the nightmares' feet. They seem confused. So are you.", mood: 'funny' },
            ],
          } },
        ] },

        { label: 'Light every lantern you have', stat: 'wits', hint: 'Bad dreams hate light', steps: [
          { check: { stat: 'wits', dc: 'easy', label: 'Light up the cave',
            success: [
              "Nightmares hate light, and you know it. Lamps lit, lanterns high, every bit of shine you carry. The smoke shies away, hissing.",
            ],
            fail: [
              { say: "You light a lantern. It goes out. You light it again. Out again. The nightmares, I am sorry to say, are blowing on it.", mood: 'funny' },
            ],
          } },
        ] },

        { label: 'Biscuit, guard!', talent: 'animal_friend', steps: [
          { say: "Biscuit plants all four paws and growls the biggest growl a small fox has ever growled. One nightmare actually backs away.", mood: 'excited' },
        ] },

        { label: 'Read the warding runes', talent: 'read_runes', steps: [
          "Round the rim of the shrine, old runes glow faintly. You read them out loud, fast:",
          { say: "Light melts the bad dreams. Song sends them home.", mood: 'hush' },
        ] },
      ] } },

      { combat: 'nightmares',
        win: [
          "The last wisp melts like frost in sunshine. Its tiny star eyes blink out. One. Two. Gone.",
        ],
        befriend: [
          { say: "One by one the nightmares stop whispering. They curl up small, sigh, and drift back into Solenne's nose, like cats going home.", mood: 'warm' },
        ] },
      { fx: 'undim' },

      { say: "But Solenne is still restless. Her tail, as long as a village street, swishes across the floor. Toward you. Duck!", mood: 'excited' },
      { sfx: 'whoosh' },
      TEACH_SKILL,
      { skill: { kind: 'timing', stat: 'agility', dc: 'easy', who: 'each', label: 'Duck the sleepy tail',
        success: [
          "You all drop flat. The great tail swooshes over your heads, warm as a sunny wall, and thumps against the far side of the cave.",
        ],
        fail: [
          { say: "The tail scoops you up like crumbs off a table and drops you, gently, in a heap of warm golden sand. Pfft. Sand everywhere.", mood: 'funny' },
          { hurt: 1, who: 'all' },
        ],
      } },

      { say: "Quickly now. The shrine. Three sockets. Three stones.", mood: 'hush' },
      { sfx: 'rune.click' },
      "The Morning stone, amber like honey, from Queen Lumina's glade.",
      { take: 'songstone_morning' },
      { sfx: 'rune.click' },
      "The Evening stone, rose pink, all the way from the goblin market.",
      { take: 'songstone_evening' },
      { sfx: 'rune.click' },
      "And the Midnight stone, deep blue, from Glint's vault.",
      { take: 'songstone_midnight' },

      { sfx: 'rumble' }, { fx: 'shake' },
      { say: "As the last stone clicks in, there is an awful crack. The song-bowl in the middle of the shrine has split, right across.", mood: 'ominous' },
      { say: "And high above, a piece of ceiling the size of a cottage breaks loose.", mood: 'excited' },

      // --- Friends made along the way ---
      { if: 'troll_friend',
        then: [
          { sfx: 'footsteps' },
          { show: 'grumble', at: 'left' },
          { say: "BOOM. A huge mossy hand catches it. Grumble! He has followed you all the way from the bridge.", mood: 'grand' },
          { say: "Friends... don't let friends... get squashed. Grumble hold rock. You sing.", as: 'grumble' },
          { hide: 'grumble' },
        ],
        else: [
          "You dive aside. The rock smashes down where you were standing, and the whole cave shudders. Hurry.",
        ] },

      { if: 'glowmoth_friend', then: [
        { sfx: 'sting.wonder' },
        { show: 'queen_lumina', at: 'left' },
        { say: "Then the dark fills with lights. Hundreds of Glowmoths pour in, and at their head, small and blazing, Queen Lumina.", mood: 'grand' },
        { say: "You promised us warm nights. A queen does not sit at home waiting for promises. Moths! Light the way!", as: 'queen_lumina' },
        "The whole cave glows silver. The last shadows shrink away into the corners.",
        { hide: 'queen_lumina' },
      ] },

      { if: 'spared_glint',
        then: [
          { show: 'glint', at: 'left' },
          "A squeaky voice: move, move, coming through! Glint skids in on a tea tray, with a bag of tools.",
          { say: "A cracked song-bowl? Pfft. I fix cracked things. I'm practically made of fixing. Spoon, cog, bit of string, aaand... done!", as: 'glint', mood: 'excited' },
          "The bowl rings out, clear and whole. Glint looks so proud he might float away.",
          { hide: 'glint' },
        ],
        else: [
          { if: 'glint_promise', then: [
            "Far above, very faintly, a squeaky voice is counting spoons. A promise, being kept. It makes you smile.",
          ] },
          "The cracked bowl buzzes. The song will sound a little rough. You will have to sing it with all your heart.",
        ] },

      { if: 'bouldergrin_friend', then: [
        { sfx: 'rumble' },
        { show: 'bouldergrin', at: 'left' },
        "Then the floor begins to purr. Bouldergrin steps out of the wall as if it were a doorway, and settles beside the shrine.",
        { say: "I... said... I... would... hum. I... am... a... stone... of... my... word.", as: 'bouldergrin' },
        "He hums one note, so low you feel it in your teeth. The bass of the lullaby. The mountain hums along with him.",
        { hide: 'bouldergrin' },
      ] },

      { if: 'thorn_friends', then: [
        "From every crack in the walls, prickly little faces pop out. The Thornlings! A wisp of bad dream tries to sneak back toward you.",
        { say: "They poke it. Thoroughly. They did promise to poke anything that bothers you.", mood: 'funny' },
      ] },

      { if: { not: { any: [ 'troll_friend', 'glowmoth_friend', 'spared_glint', 'bouldergrin_friend', 'thorn_friends' ] } }, then: [
        "Nobody else is coming. That's all right. You have each other. And you have me. And Wick. Wick is very brave, for a candle.",
      ] },

      // --- The table moment ---
      { say: "Before you play, the song needs one more voice. Not your heroes. Yours. The real people, at the real table.", mood: 'hush' },
      { table: { text: "Everyone at the table: take a breath, and hum one note together. Any note. Hold it as long as you can.", done: 'We hummed!', star: 1 } },
      { say: "There. Did you feel that? So did the mountain.", mood: 'warm' },

      { music: 'lullaby' },
      { say: "Solenne's eye is closing and opening, closing and opening. Now. Play her the lullaby. Morning, Evening, Midnight. Each of you leads a part.", mood: 'hush' },

      { puzzle: 'melody', mode: 'finale',
        success: [
          { say: "The last note hangs in the air like a lantern on a still night. Nobody breathes.", mood: 'hush' },
          { say: "Solenne's great eye closes, slowly, slowly, like a door shut softly so as not to wake the house.", mood: 'hush' },
          "Her breathing changes. Long. Deep. Even. The warmth in the cave grows, and spills up through the whole mountain.",
          { if: { count: ['songMistakes', 1] },
            then: [
              { say: "Sleep... at last. Thank you... little lights.", as: 'solenne', mood: 'hush' },
              "Her antler-flowers glow, one by one. As she settles, loose scales drift down round you, warm as toast. One for each of you.",
            ],
            else: [
              { set: { perfect_song: true } },
              { sfx: 'sting.wonder' },
              { say: "And then, because you played it perfectly, every note, she does something nobody has seen in a thousand years.", mood: 'grand' },
              "She wakes. Properly. Just for one minute. Both eyes open, clear and gold, and she lowers her head until it fills the whole cave.",
              { say: "I heard you. All the way down in the dark, I heard you coming. Little lights, carrying my song.", as: 'solenne', mood: 'warm' },
              { say: "Every summer the valley sends me lanterns. But no one ever came to bring the song themselves. Thank you.", as: 'solenne', mood: 'warm' },
              "With one claw, gentle as a hand brushing hair from a forehead, she slips a golden scale into each of your hands.",
              { say: "Keep it. When you are old, and the nights are long, hold it, and you will be warm. Now... I think... I will sleep.", as: 'solenne', mood: 'hush' },
            ] },
          ...SCALES,
        ],
        fail: [
          { say: "Oh no. A wrong note. Then another. Solenne's eye flicks wide open, and the whole mountain holds its breath.", mood: 'excited' },
          "So you do the only thing left. You all just... hum the rest. Loudly. Someone goes far too high. Someone else does the bass, badly.",
          { say: "It is, honestly, the worst lullaby ever sung under a mountain.", mood: 'funny' },
          "And Solenne's eye... closes. The corner of her mouth curls up into what might be a dragon smile.",
          { say: "Silly... wonderful... little lights. Goodnight.", as: 'solenne', mood: 'hush' },
          { say: "She snores. It sounds like a very happy volcano. As she settles, warm golden scales drift down round you. One for each of you.", mood: 'funny' },
          ...SCALES,
        ] },

      { weather: 'sparkles' },
      "Up through every crack in the mountain, warmth pours out into the night. And outside, very softly, the snow begins to melt.",
      { journal: "Sang Solenne, the dragon of the Lantern Vale, back to sleep in the Hush-Shrine." },
      { say: "Somewhere far above, a bird starts to sing. It is nearly dawn. Shall we go and see?", mood: 'warm' },
      { travel: 'peak_dawn' },
      { goto: 'ending' },
    ],
  },

  // ------------------------------------------------------------------
  ending: {
    id: 'ending', title: 'Lanternfall', subtitle: 'A day late, and all the better for it',
    bg: 'peak_dawn', music: 'ending', ambience: 'wind', weather: 'lanterns',
    steps: [
      "You climb out of the mountain into morning. Real morning. The sky is pink and gold, and the air smells of wet grass.",
      { say: "All down the slopes the snow is melting. You can hear it: a thousand tiny trickles, as if the whole mountain is giggling.", mood: 'warm' },
      "Below you, the Lantern Vale is green again. And down in Thistlehollow, somebody is ringing the Elder's bell. Not the warning bell. The other one.",
      { say: "Lanternfall! A day late. Thistlehollow has decided not to waste a perfectly good festival.", mood: 'excited' },
      "And here is what the village remembers, for years and years after.",

      { if: 'lantern_saved', then: [
        "The little girl whose lantern you saved sends it up first. She tells everyone you are her personal heroes. She is not wrong.",
      ] },
      { if: 'gave_pie',
        then: [ "Grumble eats another blackberry pie. This time at a table, with a fork. He has been practising." ],
        else: [ { if: 'won_pie', then: [ "The pie judges give you a ribbon and a lifetime supply of crumbs. Mostly crumbs. Excellent crumbs." ] } ] },
      { if: 'duck_rescued', then: [
        "The small boy from the well sails his wooden duck in the melting puddles all morning. The duck has never been happier. Nor has he.",
      ] },
      { if: 'troll_friend', then: [
        "Grumble sits in the square, too big for any chair, telling riddles to children. Nobody pays the toll. He doesn't mind any more.",
      ] },
      { if: 'glowmoth_friend', then: [
        "When the lanterns rise, Queen Lumina's moths rise with them, and the sky glitters. She says she never doubted you. She did. A bit.",
      ] },
      { if: 'snail_champion', then: [
        "The goblins carry your champion snail round the square on a cushion. It looks unimpressed. Champions often do.",
      ] },
      { if: 'spared_glint',
        then: [ "Glint opens a little stall: Broken Things Fixed, No Charge for Friends. It turns out he has rather a lot of friends now." ],
        else: [ { if: 'glint_promise', then: [ "At dawn, a small goblin in a big cloak leaves spoons on doorsteps all over the valley. Every single one. He kept his promise." ] } ] },
      { if: 'bouldergrin_friend', then: [
        "Deep in the mountain, Bouldergrin hums the lullaby every night, with both eyes shut. Very slowly. Very happily.",
      ] },
      { if: 'thorn_friends', then: [
        "The Thornlings turn up uninvited and poke the bunting, the cakes and the Elder. She pokes them back with a knitting needle. Lovely time.",
      ] },
      { if: 'perfect_song', then: [
        { say: "And they say that on a summer night, high on the mountain, you can hear a dragon saying thank you in her sleep.", mood: 'hush' },
      ] },

      { say: "Now the sun is up, and every lantern in the valley is lit and ready. Yours too.", mood: 'warm' },
      { choice: { prompt: 'Your lantern is lit. What do you do with it?', options: [

        { label: 'Give it to someone who has none', stat: 'heart', steps: [
          "You spot a small goblin at the back with no lantern at all, and you put yours in his hands. He holds it like treasure.",
          { say: "That was kind. On the very last page, still kind. I will write that down twice.", mood: 'warm' },
        ] },

        { label: 'Send it up the highest', stat: 'might', steps: [
          TEACH_SKILL,
          { skill: { kind: 'mash', stat: 'might', dc: 'medium', label: 'Launch your lantern',
            success: [
              "You give it a mighty push. It sails up past all the others, and goes the highest of all. The whole square cheers.",
            ],
            crit: [
              { say: "It goes so high it bumps into a cloud, and that cloud glows gold for the rest of the day. People will talk about it for years.", mood: 'excited' },
            ],
            fail: [
              { say: "You give it a mighty push. It wobbles up, thinks better of it, and lands on Elder Maren's ear trumpet. She wears it as a hat all day.", mood: 'funny' },
            ],
          } },
        ] },

        { label: 'Write a message on it', stat: 'wits', steps: [
          "Before you let go, you write something on the paper. Small and careful. Only you know what it says.",
          { say: "Well. You, and one very large, very sleepy dragon. She will read it tonight, I think.", mood: 'hush' },
        ] },

        { label: 'Lead the whole valley in the lullaby', talent: 'silver_tongue', steps: [
          "You start to sing. The village joins in. Then the goblins, the moths, a frog, and somebody very large.",
          { say: "Deep in the mountain, something enormous smiles in its sleep. Sing on, songbird.", mood: 'warm' },
        ] },
      ] } },

      { sfx: 'fanfare.big' },
      { say: "A thousand lanterns rise over Thistlehollow, up and up, toward the sleeping mountain. Thank you, they say. Thank you.", mood: 'grand' },
      { journal: "Celebrated Lanternfall a day late, with every friend we made along the way." },

      { say: "And there, my friends, the ink runs out. For tonight.", mood: 'warm' },
      "I close the great book. Thump. On my shoulder, Wick yawns a tiny puff of wax smoke.",
      { say: "Now. Look up from the screen for a moment. Look at the people round this table.", mood: 'hush' },
      { say: "Those are the heroes. Not the ones in the pictures. The ones in the chairs. The ones who chose kind, and brave, and clever. Together.", mood: 'hush' },
      "Every story in my book began like this. A few people, a table, and somebody who needed help.",
      { say: "So. If it ever snows in summer. If anyone you love can't sleep. You know the song now.", mood: 'warm' },
      { say: "Goodnight, heroes. Come back soon. I'll keep your chairs warm.", mood: 'warm' },
      { end: true },
    ],
  },
};
