// Act II: Mirefen Marsh, the Goblin Night Market, the Sunken Road, and camp in the ruins.
// Written by story-2. Every spoken line is voiced by Old Quill (or the NPC in `as`).

// Said once, before the first skill challenge a party meets (ROUND2 3.3). Same text in every act file.
const TEACH_SKILL = { if: { not: 'taught_skill' }, then: [
  { say: "No die for this one. This one is up to your own two hands. Watch how it goes, then have a go.", mood: 'warm' },
  { set: { taught_skill: true } },
] };

// --- After the Gloops, however they were handled ---
const GLOOPS_GONE = [
  { say: "The marsh goes quiet. Just the drip of the reeds, the slap of the water, and Bogsworth's pipe, blowing bubbles.", mood: 'hush' },
  { say: "Hm. Gloops... always in a hurry... never get anywhere...", as: 'bogsworth' },
];

// --- The Songstone of Evening changes hands: shared by every path in the market ---
const GET_EVENING = [
  { sfx: 'sting.wonder' },
  "A rose-pink stone, glowing like a sunset through a window. The tuning fork in your pack rings so loudly a goblin drops his sandwich.",
  { give: 'songstone_evening' },
];

// --- The Great Snail Race ---
const SNAIL_RACE = [
  { sfx: 'fanfare.small' },
  { say: "Roll up, roll up! The Great Snail Race! Four snails! One track! Absolutely no refunds!", as: 'madam_snaggle' },
  { if: { not: { has: 'songstone_evening' } },
    then: [ { say: "And the grand prize, my sweet little customers: one genuine singing stone! Pink! Shiny! Hums in the bath!", as: 'madam_snaggle' } ],
    else: [ { say: "And the grand prize: a turnip the size of my head, and five whole coins! Ooh!", as: 'madam_snaggle' } ] },
  "Four snails wait at the start line, each with a tiny number painted on its shell. The crowd is already shouting.",
  { choice: { prompt: 'Pick your snail!', options: [
    { label: 'Thunderslime', stat: 'might', steps: [
      { say: "Thunderslime! The biggest snail in the market. He has a scar. Nobody knows how a snail gets a scar.", mood: 'funny' },
    ] },
    { label: 'Lady Lettuce', stat: 'heart', steps: [
      { say: "Lady Lettuce! She wears a little bonnet. She has won nothing, ever, and she does not care. She is having a lovely time.", mood: 'funny' },
    ] },
    { label: 'Professor Ponder', stat: 'wits', steps: [
      { say: "Professor Ponder! He stops to think about every single pebble. He is very wise and extremely slow.", mood: 'funny' },
    ] },
    { label: 'Zippy, who has never once zipped', stat: 'agility', steps: [
      { say: "Zippy! The name is a hope, not a fact. But look at that determination. Look at those little eye-stalks.", mood: 'funny' },
    ] },
  ] } },
  { say: "Snails ready! Steady! Slime!", as: 'madam_snaggle', mood: 'excited' },
  { challenge: {
    title: 'The Great Snail Race',
    intro: [
      "This is a race for the whole party. Every one of you gets a turn to help your snail. Three good turns and you win.",
    ],
    need: 3, allow: 2,
    turns: [
      { label: 'Cheer your snail on', stat: 'heart', dc: 'medium', talent: 'silver_tongue',
        win: "You cheer so sweetly that your snail lifts its head and puts on a burst of speed. Nearly a whole inch!",
        lose: "You cheer so loudly that your snail pulls its head into its shell and has a little rest." },
      { label: 'Clear a pebble off the track', stat: 'agility', dc: 'medium', talent: 'nimble_fingers',
        win: "You flick the pebble away just in time. Your snail glides past Thunderslime, who is stuck on a crumb.",
        lose: "You flick the pebble. It bounces off a goblin's hat and lands right back on the track." },
      { label: 'Spot the shortcut lettuce leaf', stat: 'wits', dc: 'medium', talent: 'animal_friend',
        win: "You spot a lettuce leaf past the finish line and point. Your snail sees it too. The snail is now very motivated.",
        lose: "You point at a lettuce leaf. It is a goblin's green sock. Your snail is deeply disappointed." },
      { label: 'Blow a mighty tailwind', stat: 'might', dc: 'medium', talent: 'stand_firm',
        win: "You take the biggest breath of your life and blow. Your snail surfs the wind like a tiny slimy sailboat.",
        lose: "You blow. Everyone's snail goes faster except yours. Also, a goblin's wig flies off." },
    ],
    success: [
      { sfx: 'fanfare.big' },
      { say: "Over the line! Your snail wins by a nose. Snails do not have noses. It wins by a whole face!", mood: 'excited' },
      { say: "A winner! A WINNER! Oh, I hate it when people win. Wonderful, wonderful.", as: 'madam_snaggle' },
      { set: { snail_champion: true } },
      { if: { not: { has: 'songstone_evening' } },
        then: [ ...GET_EVENING ],
        else: [ { gold: 5 }, "You also get the turnip. It is enormous. You leave it with the snail, who has earned it." ] },
    ],
    fail: [
      { say: "Your snail comes fourth. Out of four. But it is smiling, if snails can smile, and you are fairly sure this one can.", mood: 'funny' },
      { say: "Lost? Oh, pity, pity. Still, the prize goes to whoever can pay, dearie. Come and see me at the shelf.", as: 'madam_snaggle' },
    ],
  } },
];

export default {
  // ------------------------------------------------------------------
  mirefen_marsh: {
    id: 'mirefen_marsh', title: 'Mirefen Marsh', subtitle: 'Fog, reeds and a ferryman',
    bg: 'mirefen_marsh', music: 'marsh', ambience: 'marsh', weather: 'mist',
    steps: [
      { card: { kicker: 'Act II', title: 'The Sunken Road' } },
      "The marsh smells like wet socks and old pond. Fog lies on the water so thick you could spread it on toast.",
      "Reeds whisper. Dead trees lean over the water like old men looking for something they dropped.",
      { sfx: 'boat' },
      "At the end of a rickety jetty bobs a small wooden boat with a lantern on a pole. In the boat sits a frog. A very large, very old frog.",
      { show: 'bogsworth', at: 'right' },
      "He wears a waistcoat. He smokes a pipe. Every puff comes out as a slow, shiny bubble.",
      { say: "Evenin'... ferry's open... more or less...", as: 'bogsworth' },
      { say: "Fare's one coin. Or a song. Or a story... if it's a good one... I've heard most of 'em...", as: 'bogsworth' },
      { choice: { prompt: 'How will you pay the ferryman?', options: [
        // kind / fair
        { label: 'Pay him a coin', requires: { gold: 1 }, steps: [
          { gold: -1 },
          { sfx: 'coin' },
          "You drop a coin in his webbed hand. He bites it, which is hard for a frog, as frogs have no teeth.",
          { say: "Mm. Shiny... sit anywhere... except there... that's where I keep my lunch...", as: 'bogsworth' },
        ] },
        // bold / heart
        { label: 'Sing him a song', stat: 'heart', steps: [
          { check: { stat: 'heart', dc: 'easy', talent: 'silver_tongue', label: 'Sing for your fare',
            success: [
              { sfx: 'spell.song' },
              "You sing across the water. Out in the fog, a hundred frogs join in on the low notes. Ribbit. Ribbit. Bmmm.",
              { say: "Huh... not bad... my mother used to sing that... or a duck did... one of 'em...", as: 'bogsworth' },
            ],
            fail: [
              { say: "You sing. A heron flies away. A fish jumps out of the water, looks at you, and jumps back in, offended.", mood: 'funny' },
              { say: "Well... that was... a sound... get in anyway... for the entertainment...", as: 'bogsworth' },
            ],
            fumble: [
              { say: "You hit a note so high every frog in the marsh stops croaking at once. Even the fog seems to wince.", mood: 'funny' },
              { say: "...I'll take you for free... if you promise never to... do that again...", as: 'bogsworth' },
            ],
          } },
        ] },
        // clever / a story (callbacks)
        { label: 'Tell him a story', stat: 'wits', steps: [
          { if: 'troll_friend',
            then: [
              "You tell him about the troll at the bridge who only wanted somebody to talk to. And how you talked to him.",
              { say: "Grumble?... still sulkin' under that bridge?... Hm... good... somebody should've... long ago...", as: 'bogsworth' },
            ],
            else: [
              "You tell him the story of the night the song stopped, the snow in summer, and a shadow with a sack.",
              { say: "Hm... a shadow with a sack... I saw it... went by on a raft made of spoons... noisy...", as: 'bogsworth' },
            ] },
          { say: "Good story... get in...", as: 'bogsworth' },
        ] },
        // talent: animal friend
        { label: 'Ask the marsh frogs for a lift', talent: 'animal_friend', steps: [
          "You crouch at the water's edge and croak, politely. Out in the fog, a hundred frogs croak back.",
          { sfx: 'splash' },
          { say: "Then the whole boat lifts an inch and starts moving, pushed by a hundred little green hands. Bogsworth does not even pick up his pole.", mood: 'funny' },
          { say: "...show-off...", as: 'bogsworth' },
        ] },
      ] } },

      { sfx: 'boat' },
      "The boat slides out into the fog. The jetty disappears behind you. Now there is only water, reeds, and the creak of the pole.",
      { say: "Then lights appear. Little green lights, bobbing over the water, this way and that. Pretty. And wrong.", mood: 'hush' },
      { say: "Marsh-lights... don't follow 'em... or do... I'm not your mother...", as: 'bogsworth' },
      TEACH_SKILL,
      { skill: { kind: 'timing', stat: 'wits', dc: 'medium', talent: 'herb_lore', label: 'Spot the real way through the marsh-lights',
        success: [
          "You squint. The false lights dance. But the real lantern posts stand still, rusty and steady. You point the way.",
          { say: "Hm... you've got eyes... I've got eyes too... mostly use 'em for sleeping...", as: 'bogsworth' },
        ],
        crit: [
          "You spot the real path at once, and a shortcut, and a sunken purse caught in the reeds. Someone dropped it long ago.",
          { gold: 3 },
          { say: "Sharp eyes. Take the coins. Finders keepers, out here in the marsh.", mood: 'warm' },
        ],
        fail: [
          "You point at a light. The boat turns toward it. The light giggles, and goes out. The boat slides into the reeds and stops. Stuck.",
          { say: "...happens...", as: 'bogsworth' },
          { set: { marsh_stuck: true } },
        ],
      } },

      { sfx: 'sting.danger' },
      { say: "Blub. The water near the boat bubbles. Blub, blub. Then mud rises up out of the marsh, in wobbling lumps, with pebbles for eyes.", mood: 'ominous' },
      "Gloops. Four, five, six of them, wobbling closer. They hate bright light. And, strangely, they love a good joke.",
      { choice: { prompt: 'The Gloops are coming! What do you do?', options: [
        // bold
        { label: 'Fight them off!', stat: 'might', steps: [
          { combat: 'gloop_ambush',
            win: [ { say: "The last Gloop splats into a puddle and slides off into the dark, sulking. You are muddy to the knees.", mood: 'funny' }, ...GLOOPS_GONE ],
            befriend: [ { say: "The Gloops wobble happily around the boat, waving with sticky little arms. One gives you a muddy kiss. It is very sincere.", mood: 'funny' }, ...GLOOPS_GONE ],
          },
        ] },
        // kind / funny
        { label: 'Tell them a joke', stat: 'heart', hint: 'Gloops love a good joke', steps: [
          "You stand up in the boat, clear your throat, and say: why do Gloops never get lost?",
          { say: "The Gloops stop. They lean in. Blub?", mood: 'hush' },
          { check: { stat: 'heart', dc: 'medium', talent: 'silver_tongue', label: 'Make a Gloop laugh',
            success: [
              "Because they always stick together!",
              { sfx: 'befriend' },
              { say: "The Gloops wobble. They jiggle. They laugh, and Gloop laughter sounds exactly like someone stepping in a bog. Squelch, squelch, squelch.", mood: 'funny' },
              "Then they sink back into the marsh, happy, still giggling bubbles. You made friends with mud. Not many can say that.",
              ...GLOOPS_GONE,
            ],
            fail: [
              { say: "Because they... um. Because the mud... no, wait. Because they always... lose their map? The Gloops look at each other.", mood: 'funny' },
              { say: "Then they glomp toward the boat, deeply offended. It was a very bad joke. Here they come!", mood: 'excited' },
              { combat: 'gloop_ambush',
                win: [ "The last Gloop splats and slides away, still muttering about the joke.", ...GLOOPS_GONE ],
                befriend: [ "In the end the Gloops forgive you, and even tell you a joke of their own. It is worse than yours. Much worse.", ...GLOOPS_GONE ],
              },
            ],
          } },
        ] },
        // clever / sneaky
        { label: 'Pole quietly past them', stat: 'agility', requires: { not: 'marsh_stuck' }, hint: 'Not if the boat is stuck', steps: [
          "Bogsworth hands you the pole without a word. You dip it, slowly, silently, and slide the boat between the bubbles.",
          TEACH_SKILL,
          { skill: { kind: 'sneak', stat: 'agility', dc: 'medium', label: 'Sneak the boat past the Gloops',
            success: [
              "Not a splash. Not a ripple. The Gloops wobble right past you, grumbling about the weather. You are through.",
              { say: "Hm... nice poling... you can have my job... when I'm dead... in about ninety years...", as: 'bogsworth' },
            ],
            fail: [
              { sfx: 'splash' },
              { say: "Bonk. The pole lands right on top of a Gloop's head. It turns around, very slowly. It has a pebble frown.", mood: 'funny' },
              { combat: 'gloop_ambush',
                win: [ "The Gloops splat and slide away, rubbing their heads.", ...GLOOPS_GONE ],
                befriend: [ "The Gloop you bonked decides it was an accident and hugs you. Squelch.", ...GLOOPS_GONE ],
              },
            ],
          } },
        ] },
        // the flash lantern, if bought
        { label: 'Flash the lantern at them', requires: { has: 'flash_lantern' }, hint: 'Gloops hate bright light', steps: [
          { take: 'flash_lantern' },
          { fx: 'flash' },
          { sfx: 'spell.star' },
          { say: "Flash! Light bursts over the water, bright as noon. The Gloops shriek, a noise like a wet balloon, and dive back into the mud.", mood: 'excited' },
          "Clever. Spending the right thing at the right time is half of being a hero.",
          ...GLOOPS_GONE,
        ] },
        // talent: herb lore
        { label: 'Wake the glowcap mushrooms', talent: 'herb_lore', hint: 'Light that grows', steps: [
          "On a dead tree beside the boat grow pale little mushrooms. Glowcaps. You know them. You rub one gently, the way you rub a sleepy cat.",
          { fx: 'flash' },
          { say: "Every glowcap in the marsh lights up at once, gold and green. The Gloops squeal and slide away from the light, grumbling.", mood: 'excited' },
          ...GLOOPS_GONE,
        ] },
      ] } },

      { if: 'marsh_stuck', then: [
        "With the Gloops gone, you all heave the boat out of the reeds together. It comes free with a loud, rude slurp.",
      ] },
      { set: { marsh_stuck: false } },
      { sfx: 'boat' },
      "At last the fog thins. Ahead, a far shore. And growing at the water's edge, a single white lily, glowing faintly blue.",
      { say: "Here... take this... marsh lily... funny flower... smells like home...", as: 'bogsworth' },
      { say: "Somebody stony liked 'em... long ago... used to come down for 'em... big fellow... can't remember...", as: 'bogsworth' },
      { give: 'marsh_lily' },
      { say: "Now... go on... that racket over there... that's the goblins... mind your pockets...", as: 'bogsworth' },
      { hide: 'bogsworth' },
      { journal: "Crossed Mirefen Marsh with Bogsworth the frog, got past the Gloops, and were given a glowing marsh lily." },
      "Through the trees, you see it: a tree stump as big as a castle, glowing with a hundred coloured lamps. And the noise. What is that noise?",
      { travel: 'goblin_market' },
      { goto: 'goblin_market' },
    ],
  },

  // ------------------------------------------------------------------
  goblin_market: {
    id: 'goblin_market', title: 'The Goblin Night Market', subtitle: 'Everything shiny, nothing refunded',
    bg: 'goblin_market', music: 'market', ambience: 'market', weather: 'sparkles',
    steps: [
      { sfx: 'door.stone' },
      "You squeeze through a crack in the giant stump, and the noise hits you like a pillow fight.",
      { say: "Inside the stump, a hundred tiny stalls are piled up to the roof, joined by rope bridges, lit by lamps in every colour there is.", mood: 'excited' },
      "It smells of fried mushrooms, burnt sugar and something nobody wants to name. Every goblin is shouting. Most of them are selling spoons.",
      { if: 'hay_hair', then: [
        { say: "A goblin runs up, points at your hair and offers you two coins for the hay. Then three. Then he just takes a bit and runs.", mood: 'funny' },
      ] },
      { show: 'madam_snaggle', at: 'right' },
      { say: "Customers! Fresh ones! Ooh, look at you, all clean and full of coins. Madam Snaggle, at your service, my darlings!", as: 'madam_snaggle' },
      { say: "She smiles. One tooth is pure gold. She taps it, so you notice.", mood: 'funny' },
      { if: 'won_pie', then: [
        { say: "Do I smell... pie? Prize pie? Crumbs on your cloak, dearie! I can sniff a winner from a mile off.", as: 'madam_snaggle' },
      ] },
      { sfx: 'chime.right' },
      { say: "Then the tuning fork in your pack starts to ring. Somewhere in this market, very close, is a Songstone.", mood: 'hush' },
      { hide: 'madam_snaggle' },
      { hub: {
        id: 'goblin_market',
        prompt: 'Explore the Goblin Night Market. The Songstone of Evening is here somewhere.',
        spots: [
          // the shop
          { id: 'stall', label: "Madam Snaggle's stall", icon: 'shop', x: 317, y: 248, steps: [
            { show: 'madam_snaggle', at: 'right' },
            { say: "Browse, browse! Everything is shiny, everything is rare, everything is absolutely, positively, no refunds.", as: 'madam_snaggle' },
            { shop: 'snaggle_stall' },
            { if: { has: 'golem_eye' }, then: [
              { say: "The round crystal, eh? Lovely choice. It stares at you. I like that in a crystal.", as: 'madam_snaggle' },
            ] },
            { hide: 'madam_snaggle' },
          ] },

          // the race
          { id: 'race', label: 'The Great Snail Race', icon: 'star', x: 658, y: 440, once: true, steps: SNAIL_RACE },

          // the prize shelf: other ways to get the stone
          { id: 'shelf', label: 'The prize shelf', icon: 'gem', x: 500, y: 186, requires: { not: { has: 'songstone_evening' } }, steps: [
            "On a high shelf behind Madam Snaggle's counter, under a glass bell jar, sits a stone glowing rose-pink. It is humming to itself.",
            { show: 'madam_snaggle', at: 'right' },
            { say: "Ah ah ah! That's the grand prize, sweetness. Win the snail race. Or make me an offer I simply cannot refuse.", as: 'madam_snaggle' },
            { choice: { prompt: 'How do you get the Songstone from Madam Snaggle?', options: [
              // charm
              { label: 'Haggle with her', stat: 'heart', once: true, hint: 'She loves a bargain more than gold', steps: [
                { check: { stat: 'heart', dc: 'hard', talent: 'silver_tongue', label: 'Out-haggle a goblin',
                  success: [
                    "You tell her the stone is chipped. She says it isn't. You say it hums off key. She gasps. You offer her a compliment about her tooth.",
                    { say: "Oh! Oh, you little scoundrel. You're as bad as me. I love it. Take it, take it, before I change my mind!", as: 'madam_snaggle' },
                    ...GET_EVENING,
                  ],
                  fail: [
                    { say: "You haggle. She haggles back. Ten minutes later, somehow, you have agreed to buy a bucket of buttons. You did not want buttons.", mood: 'funny' },
                    { say: "Lovely doing business! The stone? Oh, still not for sale, dearie. Try something else.", as: 'madam_snaggle' },
                    { again: true },
                  ],
                } },
              ] },
              // kind / honest work
              { label: 'Offer a fair night of work for it', stat: 'might', steps: [
                { say: "Work? WORK? Nobody in this market has ever offered to work. Oh, how thrilling. Yes. Polish the spoons.", as: 'madam_snaggle' },
                { say: "The spoons are a mountain. A whole mountain of spoons, taller than you, and every one of them sticky.", mood: 'funny' },
                "You polish. You polish until your arms ache and you can see your own tired face in a thousand little spoons.",
                { say: "Beautiful. Shiny. Honest. Disgusting. Here, take your stone, and never do that again, you'll ruin my reputation.", as: 'madam_snaggle' },
                { say: "Hard, honest work for something that matters. Take a Star.", mood: 'warm' },
                { star: 1, why: 'For honest work' },
                ...GET_EVENING,
              ] },
              // trade the troll tooth
              { label: "Trade her Grumble's tooth", requires: { has: 'troll_tooth' }, hint: 'Goblins go wild for troll teeth', steps: [
                "You hold up the troll tooth. The whole market goes silent. A goblin faints.",
                { say: "Is that... a REAL troll tooth? Still a bit wobbly? Still a bit DAMP? Oh. Oh, I need to sit down.", as: 'madam_snaggle' },
                { take: 'troll_tooth' },
                { say: "Deal! Deal! Done! No take-backs!", as: 'madam_snaggle' },
                "Somewhere far away, a troll sneezes. He does not mind. A gift is for giving.",
                { say: "You gave away your lucky troll tooth to bring the song home. That is a real gift. Take a Star.", mood: 'warm' },
                { star: 1, why: 'For giving up the tooth' },
                ...GET_EVENING,
              ] },
              // talent: nimble fingers, the risky swap
              { label: 'Swap it for a painted pebble', talent: 'nimble_fingers', hint: 'Risky', steps: [
                "You find a round pebble, rub some berry juice on it until it is just the right pink, and wait for her to turn around.",
                { check: { stat: 'agility', dc: 'hard', label: 'Swap the stone under her nose',
                  success: [
                    "Lift the jar. Swap. Jar down. She turns back. Smiles at the pebble. Pats the jar. You are already three stalls away.",
                    { say: "Later, you leave a coin and a little note on her counter that says sorry. A trick is better with good manners.", mood: 'warm' },
                    ...GET_EVENING,
                  ],
                  crit: [
                    { say: "Swap, spin, gone. She never notices. In fact she sells the pebble to the next customer for twenty coins. Everyone wins, sort of.", mood: 'funny' },
                    ...GET_EVENING,
                  ],
                  fail: [
                    { say: "Your hand is on the jar when a green hand closes over your wrist. Madam Snaggle is smiling. Her gold tooth twinkles.", mood: 'ominous' },
                    { say: "Ooh, a sneaky one! I LIKE you. You can have it, my little thief, but you have to wear the Hat of Shame.", as: 'madam_snaggle' },
                    { say: "The Hat of Shame is a teapot. It is still warm. It has a lid. You wear it with as much dignity as you can.", mood: 'funny' },
                    { set: { teapot_hat: true } },
                    ...GET_EVENING,
                  ],
                } },
              ] },
            ] } },
            { hide: 'madam_snaggle' },
          ] },

          // gossip: the hook to Glint
          { id: 'gossip', label: 'Gossiping goblins', icon: 'talk', x: 792, y: 182, once: true, steps: [
            "On a rope bridge above, three goblins are gossiping so hard the bridge sways. You climb up and listen.",
            { say: "Glint the Magnificent! That's who brought the pink stone. Sold it to Snaggle for a bucket of cogs, didn't he!", mood: 'funny' },
            { say: "Cogs, springs, kettles, clocks! He's building something big up in the mountain. Something with claws!", mood: 'funny' },
            { say: "Wears a cloak of magpie feathers. Talks to himself. Calls himself magnificent. Nobody else does.", mood: 'funny' },
            { say: "Got a vault in the mountain, full of shiny stuff. And crows! Brass crows! They bring him everything that sparkles.", mood: 'ominous' },
            { say: "So the shadow with the sack has a name. Glint. And he has the last Songstone. What a thing to know.", mood: 'hush' },
            { journal: "Goblins told us about Glint the Magnificent, who stole the Songstones and keeps a vault inside the mountain." },
          ] },

          // the egg juggler: a quick funny check
          { id: 'juggler', label: 'The egg juggler', icon: 'dice', x: 1083, y: 290, once: true, steps: [
            "A goblin is juggling seven eggs while standing on a barrel. He sees you watching and grins.",
            { say: "Catch one, win three coins! Drop one, wear it!", mood: 'funny' },
            TEACH_SKILL,
            { skill: { kind: 'timing', stat: 'agility', dc: 'medium', label: 'Catch a flying egg',
              success: [
                "An egg comes spinning at you. You catch it, soft as a cloud. It does not even crack. The juggler bows and pays up.",
                { gold: 3 },
              ],
              crit: [
                { say: "He throws one. You catch it. He throws three. You catch them all and juggle them back. The crowd goes wild.", mood: 'excited' },
                { gold: 5 },
              ],
              fail: [
                { say: "An egg comes spinning at you. You reach. You miss. Splat. Right on top of your head. It drips. You are a breakfast now.", mood: 'funny' },
                "The juggler is so pleased he gives you one coin anyway. For the face you made.",
                { gold: 1 },
              ],
            } },
          ] },

          // a small callback stall
          { id: 'ducks', label: 'The duck stall', icon: 'gift', x: 640, y: 282, once: true, requires: 'duck_rescued', steps: [
            "One stall sells nothing but wooden ducks. Hundreds of them. One looks just like the duck from the village well.",
            { say: "It is not that duck. That duck is safe at home, under a small boy's chin. You made sure of that.", mood: 'warm' },
            "The goblin stallkeeper sees you smile and gives you a duck for free. Just a small one. For luck.",
            { give: 'honeycake' },
            "Wait, that is a honeycake. He has given you a honeycake. Goblins. Still, it does smell lucky.",
          ] },
        ],
        leave: {
          label: 'Leave the market',
          requires: { has: 'songstone_evening' },
          lockedHint: 'The tuning fork is still ringing. The Songstone of Evening is here somewhere.',
          steps: [
            { if: 'teapot_hat', then: [
              { say: "You are still wearing the teapot. Madam Snaggle waves you off with a hanky. Keep it, she calls. It suits you.", mood: 'funny' },
            ] },
            { hide: 'madam_snaggle' },
            "Outside the stump, the noise falls away behind you. The night is cold and still. Snow is falling, softly.",
            { say: "Then the rose-pink stone in your pack begins to sing. Three notes, falling, like a sunset going down.", mood: 'hush' },
            { puzzle: 'melody', mode: 'learn', phrase: 2,
              success: [
                { sfx: 'sting.wonder' },
                { say: "And listen: the Morning stone hums along. Two phrases now, side by side. The lullaby is coming back.", mood: 'warm' },
              ],
              fail: [
                { say: "A note goes astray. The stone hums it again, gently, like it has all the time in the world. It will come back to you.", mood: 'warm' },
              ] },
            { journal: "At the Goblin Night Market we won back the Songstone of Evening and learned the second part of the lullaby." },
            "Past the stump, an old road climbs toward the mountain. And high above it, something brass glints in the moonlight.",
            { travel: 'sunken_road' },
            { goto: 'sunken_road' },
          ],
        },
      } },
    ],
  },

  // ------------------------------------------------------------------
  sunken_road: {
    id: 'sunken_road', title: 'The Sunken Road', subtitle: 'The old road of the stone-folk',
    bg: 'sunken_road', music: 'road', ambience: 'wind', weather: 'snow',
    steps: [
      "Dusk. The old road of the stone-folk climbs ahead of you, paved with stones as big as beds, cracked and tilted and dusted with snow.",
      "On either side lie fallen statues. Bearded stone-folk, huge and patient, with moss in their beards and snow on their noses.",
      { say: "And ahead, close now, Mount Kettle. It glows red from inside, like a coal. You can feel its warmth on your face, even in the snow.", mood: 'grand' },
      { sfx: 'rumble' },
      "The road shivers under your boots. The mountain is grumbling in its sleep. Or trying to sleep.",
      { choice: { prompt: 'The road climbs past the old statues. How do you go?', options: [
        // clever
        { label: 'Keep your eyes open', stat: 'wits', steps: [
          { check: { stat: 'wits', dc: 'medium', label: 'Watch the road for trouble',
            success: [
              "You notice what the others miss: a brass feather in the snow. Then another. Then a third, still warm.",
              { say: "Crows. Brass crows. They have been here, and not long ago. You warn the others. Good eyes.", mood: 'hush' },
              { set: { crows_spotted: true } },
            ],
            fail: [
              { say: "You keep your eyes open the whole way. You notice a very nice rock. It is shaped like a potato. You keep it.", mood: 'funny' },
            ],
          } },
        ] },
        // bold
        { label: 'March up the middle, singing', stat: 'heart', steps: [
          "You march right up the middle of the road, singing the two phrases of the lullaby at the top of your voice.",
          { say: "The statues seem to listen. Snow slides off their stone heads. Somewhere a rock falls, plonk, as if in applause.", mood: 'warm' },
          "It is wonderful. It is also extremely loud. Anyone hiding nearby certainly knows you are here now.",
        ] },
        // kind / strength talent
        { label: "Lift a fallen statue's head back on", talent: 'stand_firm', steps: [
          "One statue has lost its head. It lies in the snow, looking sad, with a bird's nest in one ear.",
          { sfx: 'hit.heavy' },
          "You squat, lift, and heave. It is heavier than a pony. Slowly, grinding, the head goes back on its shoulders. Clunk.",
          { say: "The old stone face looks up at the mountain again, the way it was always meant to. That was kind, and very strong.", mood: 'warm' },
        ] },
        // talent: read runes (a clue for the Dwarf-Door)
        { label: 'Read the carving on the statue', talent: 'read_runes', steps: [
          "At the foot of the largest statue, old runes are cut into the stone. You brush off the snow and trace them with a finger.",
          { say: "They say: we made the door to listen. Show it light, then sing, then let the sleeper rest.", mood: 'hush' },
          { if: 'knows_rhyme', then: [
            "First the Light, then the Song, then the Sleeper. The Elder's old rhyme. It was never just a rhyme.",
          ] },
        ] },
      ] } },

      { sfx: 'wing' },
      { say: "Tick. Tick. Tick. The sound comes from everywhere at once.", mood: 'ominous' },
      { if: 'crows_spotted',
        then: [ "But you were ready. You all look up just in time to see them." ],
        else: [ "You all look up. Too late to hide." ] },
      { say: "Brass crows. Five, six, more, dropping out of the dusk with their wings clattering like cutlery. Red eyes. Sharp beaks. Diving for your packs.", mood: 'ominous' },
      { say: "They want the Songstones.", mood: 'hush' },
      { if: 'thorn_friends', then: [
        { sfx: 'spell.vine' },
        { say: "Then the hedge beside the road explodes. Thornlings! Dozens of them, yelling. They promised to poke anything that bothers you.", mood: 'excited' },
        "One crow gets a bramble wrapped round its beak and spins into the snow. The Thornlings cheer. Now it's your turn!",
      ] },
      { combat: 'rattlewing_raid',
        win: [
          { sfx: 'fanfare.small' },
          { say: "The last crow falls apart in mid-air. Cogs, springs and brass feathers rain down onto the road, tinkling like a dropped music box.", mood: 'excited' },
          { say: "Both stones are safe. You held the road against a sky full of metal. That was brave. Very brave.", mood: 'warm' },
        ],
      },
      { if: 'thorn_friends', then: [
        "The Thornlings wave their prickles, giggle, and vanish back into the hedge. Good friends are worth more than gold.",
      ] },
      "In the snow, among the cogs, something glints. A key. Small and brass, with a handle shaped like a feather.",
      { give: 'brass_feather_key' },
      "Next to it lies a crumpled scrap of paper, covered in loopy, very proud handwriting. You smooth it out and read it.",
      { say: "Note to self: stop losing notes to self.", mood: 'funny' },
      { wait: 600 },
      { say: "On the back, in smaller letters: Also, oil the crows. Count the stones. Three! All mine! Ha!", mood: 'funny' },
      { say: "Glint. The goblin who took the stones. And by the look of this, he is not very good at keeping track of things.", mood: 'warm' },
      { journal: "On the Sunken Road we fought off Glint's brass crows and found a feather-shaped key and one of his notes to himself." },
      "Night is falling fast, and the snow with it. Among the ruins ahead, there is shelter. Rest first. The mountain can wait one more night.",
      { goto: 'camp_ruins' },
    ],
  },

  // ------------------------------------------------------------------
  camp_ruins: {
    id: 'camp_ruins', title: 'Camp in the Ruins', subtitle: 'The last night before the mountain',
    bg: 'camp_ruins', music: 'camp', ambience: 'fire', weather: 'snow',
    steps: [
      "Among the fallen pillars of the stone-folk, you find a dry corner and build a small, brave fire.",
      { say: "Snow falls all around, soft and silent. But the fire crackles, and the stones keep the wind away, and that is enough.", mood: 'hush' },
      { say: "And right there, so close now it fills the sky: Mount Kettle, glowing ember-red, breathing steam into the stars.", mood: 'grand' },
      { rest: true },
      "Nobody says much at first. You hold your hands out to the flames and listen to the snow fall. It makes the softest sound in the world.",
      { say: "Then someone laughs, remembering something silly from the road. Then everyone is laughing, quietly, the way you laugh when you are tired and safe.", mood: 'warm' },
      { say: "Wick, on my shoulder, has curled his tail around his candle-flame to keep it warm. Even wax dragons feel the cold up here.", mood: 'hush' },
      { if: 'lantern_saved', then: [
        { say: "Far below in the valley, one small paper lantern drifts up into the night. Maybe the one you caught. Maybe it followed you.", mood: 'warm' },
      ] },
      { if: 'glowmoth_friend', then: [
        "A few Glowmoths have come along, tucked in your hood. They glow a little brighter when you look at them. They remember your promise.",
      ] },
      { if: 'snail_champion', then: [
        { say: "Somewhere back in the goblin market, a champion snail is eating a turnip and telling everyone about you.", mood: 'funny' },
      ] },
      { if: 'troll_friend', then: [
        "You think of Grumble, sitting by his bridge, waiting for someone to stop and talk. Next time, you will.",
      ] },
      { say: "Look how far you have come. A village, a forest, a bridge, a glade, a marsh, a market, a road. And you are still standing.", mood: 'warm' },
      { levelup: 3 },
      { say: "And now something new burns in each of you. A great power. Save it for when it matters most.", mood: 'grand' },
      { choice: { prompt: 'The last night before the mountain. How do you spend it?', options: [
        // kind
        { label: 'Share out the last of the food', stat: 'heart', steps: [
          "You split everything that is left: a crust, a few berries, a squashed honeycake, half an apple. Everybody gets a share, carefully even.",
          { say: "It is the smallest supper of the journey and somehow the best. Sharing does that. Take a Star.", mood: 'warm' },
          { star: 1, why: 'For sharing' },
        ] },
        // bold
        { label: 'Keep watch through the night', stat: 'heart', steps: [
          { check: { stat: 'heart', dc: 'medium', label: 'Stay awake on watch',
            success: [
              "You stay awake while the others sleep. The fire burns low. The snow stops. And you notice something.",
              { say: "The mountain's glow is pulsing. Slow. Bright, dim. Bright, dim. Like breathing. Like something huge, trying very hard to sleep.", mood: 'hush' },
            ],
            fail: [
              { say: "You watch bravely for almost four minutes. Then you are asleep sitting up, with your mouth open.", mood: 'funny' },
              "When you wake, the snow has piled on your head in a tall white wig. You look very wise. Nobody tells you for an hour.",
            ],
          } },
        ] },
        // clever
        { label: "Study Glint's note again", stat: 'wits', steps: [
          { check: { stat: 'wits', dc: 'medium', label: 'Find what is hidden in the note',
            success: [
              "You hold the note up to the fire. And there, pressed into the paper, faint lines appear. A little map.",
              { say: "Glint's vault. And scribbled by a river: back door, do not use, very wet. Interesting.", mood: 'hush' },
              { set: { knows_back_door: true } },
            ],
            fail: [
              { say: "You study it for ages. It still says: stop losing notes to self. You start to feel the note is right.", mood: 'funny' },
            ],
          } },
        ] },
        // talent: silver tongue
        { label: 'Sing the two phrases you know', talent: 'silver_tongue', steps: [
          { sfx: 'spell.song' },
          "You sing, very softly. Morning, then Evening. Six notes, rising and falling, like a little boat on a calm sea.",
          { say: "In your pack, both Songstones hum along. And far away, deep in the mountain, the rumbling grows a tiny bit quieter.", mood: 'hush' },
          { say: "She heard you. Somewhere down there, a dragon heard you.", mood: 'warm' },
        ] },
      ] } },
      { say: "Now, before the fire goes out. One more question, and a quieter one.", mood: 'hush' },
      { actor: 'spotlight' },
      { table: { text: "Tomorrow you meet a tired dragon who cannot sleep. If your hero could whisper one thing to her, what would it be? Tell the table.", done: 'We whispered' } },
      { say: "Remember those words. You may need them.", mood: 'hush' },
      { sfx: 'wing' },
      { say: "High on a broken pillar, a single brass crow sits watching. One wing is bent from the fight. Its red eye flickers.", mood: 'ominous' },
      "It looks at you a long moment. Then it flaps away, crooked, up toward the mountain. Toward a great stone door.",
      { journal: "Camped among the stone-folk ruins in the snow, grew stronger still, and woke our great powers. Tomorrow, the mountain." },
      { card: { kicker: 'Act II', title: 'The End of the Road' } },
      "In the grey morning, the path ends at a cliff. And in the cliff, a door so big it makes the mountain look like it has a mouth.",
      { travel: 'dwarf_door' },
      { goto: 'dwarf_door' },
    ],
  },
};
