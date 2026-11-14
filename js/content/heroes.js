// Heroes: numbers from SPEC 5. Spoken lines are second person ("you" is the acting hero).

const heroes = {
  knight: {
    arch: 'knight', name: 'Rowan Shieldheart', calling: 'Knight',
    blurb: 'Big shield, bigger grin. Stands in front so everyone else can stand behind.',
    talent: { id: 'stand_firm', name: 'Stand Firm', text: 'Feats of strength and courage.' },
    stats: { might: 3, agility: 0, wits: 1, heart: 2 }, hp: 14, guard: 13, attackStat: 'might',
    strike: {
      name: 'Sword Swing', die: '1d8', fx: 'slash',
      lines: {
        hit: [
          "Your sword sings through the air. Clang! Right on target.",
          "One big swing, one big bonk. That one felt it.",
          "You step in, swing wide, and connect with a ring like a bell.",
          "Shield up, sword round. Textbook. Somebody write that down.",
          "Whoosh, thwack. You make it look easy.",
          "You swing with your whole heart, and your whole heart hits.",
          "A clean, bright swing. The sun on your shield winks.",
        ],
        miss: [
          "Your sword whistles past. Very dramatic. Very empty.",
          "You swing so hard you spin all the way round. Still facing the right way, mostly.",
          "So close. Your blade parts a hair and nothing else.",
          "It ducks. Your sword thunks into the ground and stands there, wobbling.",
          "A mighty swing at exactly where it was a moment ago.",
          "You miss, but you look magnificent doing it.",
        ],
        crit: [
          "You plant your feet and swing like thunder. Kra-CHANG! The whole battle stops to stare.",
          "The sun on your shield flares and your sword lands like a falling star.",
          "One perfect swing. Somewhere, a bard has just found a new song.",
          "You leap, swing, land. The ground shakes a little, out of respect.",
        ],
      },
    },
    powers: [
      { id: 'shield_bash', name: 'Shield Bash', text: 'Bash a foe with your shield (1d6 + Might). On a hit it is stunned and loses its next turn.',
        cost: 2, target: 'foe', fx: 'bash', tags: [], damage: '1d6',
        lines: {
          use: ["Shield first. You charge in with the sun crest leading.", "You lift your shield like a front door and run.", "You lower your head and barrel forward, shield up."],
          hit: ["BONG. Little stars spin round its head. It forgets what it was doing.", "Your shield rings like a gong. It wobbles, dizzy as a spun top.", "Bash! It sits down hard, seeing stars.", "Clonk. It blinks at you, very confused about everything."],
          miss: ["It sidesteps and you bash a very surprised patch of air.", "You charge right past it and have to jog back. Nobody mention it.", "It ducks, and your shield skids along like a sledge."],
        } },
      { id: 'guardians_vow', name: "Guardian's Vow", text: 'Choose a friend. Until your next turn, you take the hits meant for them, at half the hurt.',
        cost: 2, target: 'ally', fx: 'shield',
        tags: [],
        lines: {
          use: ["You step in front of your friend. Anything that wants them goes through you first.", "You plant your shield beside your friend. Not today.", "You raise your shield over a friend and say it plainly: I've got you."],
          hit: ["A golden glow wraps the two of you. Let them try.", "Your vow shines on your shield like morning on a lake.", "Your friend stands a little taller with you beside them."],
        } },
      { id: 'lionheart_charge', name: 'Lionheart Charge', text: 'Your great power. One mighty run through every foe (1d8 + Might to each).',
        cost: 3, great: true, target: 'allFoes', fx: 'charge', tags: [], damage: '1d8',
        lines: {
          use: ["You roar like a lion, raise your shield and charge the whole lot of them.", "Head down, heart up. You run at every single one of them at once.", "The sun crest blazes. You charge, and the ground drums under your boots."],
          hit: ["You go through them like a gust through leaves. Everybody's falling over.", "Bowled over! Foes tumble left and right like skittles.", "A golden streak, a great clatter, and a lot of dizzy enemies."],
          miss: ["You charge, they scatter, and you end up hugging a tree. Brave tree.", "They leap aside together, as if they had practised. Rude."],
        } },
    ],
    perks: {
      2: [
        { id: 'knight_iron_skin', name: 'Iron Skin', text: '+3 max hearts. You were tough. Now you are a wall.', effect: { maxHp: 3 } },
        { id: 'knight_shield_wall', name: 'Shield Wall', text: '+1 Guard. Foes find you harder to hit.', effect: { guard: 1 } },
      ],
      3: [
        { id: 'knight_great_blade', name: 'Great Blade', text: 'Your Sword Swing rolls 1d10.', effect: { strikeDie: '1d10' } },
        { id: 'knight_brave_heart', name: 'Brave Heart', text: '+1 Heart. Better at kind words and brave faces.', effect: { stat: { heart: 1 } } },
      ],
    },
    intro: "A knight with a sun on her shield and a grin to match. Trouble had better knock first.",
  },

  wizard: {
    arch: 'wizard', name: 'Nim Starcaller', calling: 'Wizard',
    blurb: 'Small, bookish, and carrying a hat with actual stars in it. Knows a spell for that.',
    talent: { id: 'read_runes', name: 'Read Runes', text: 'Old writing, magic and puzzles.' },
    stats: { might: 0, agility: 1, wits: 3, heart: 2 }, hp: 9, guard: 10, attackStat: 'wits',
    strike: {
      name: 'Spark', die: '1d6', fx: 'spark',
      lines: {
        hit: [
          "You flick your staff. A bright spark zips out and pops right on target.",
          "Zap! A tiny star leaps from your staff and stings.",
          "You point, you mutter, and a spark goes snap.",
          "Crackle, fizz, ouch. Your spark finds its mark.",
          "A little spark, a big surprise. It hops on the spot.",
          "You push your glasses up and fire. Bullseye.",
          "Your hat glitters, and a spark shoots out like a firework seed.",
        ],
        miss: [
          "Your spark fizzles into a sad little puff. Phht.",
          "The spark zips off, loops twice, and hits a leaf. The leaf is fine.",
          "You aim, you fire, and your glasses slide down your nose at the worst moment.",
          "A spark, a whoosh, a miss. Your hat looks embarrassed.",
          "It ducks under your spark, which wanders off to be a firefly.",
          "Nearly. The spark singes the air beside it.",
        ],
        crit: [
          "Every star in your hat lights at once. Your spark hits like a lightning bolt.",
          "You speak a word that tastes of thunder. KRAK! Brilliant.",
          "Your spark splits into a dozen and every one of them lands. Show-off. Wonderful.",
          "Your staff blazes white. Even your enemies say ooh.",
        ],
      },
    },
    powers: [
      { id: 'star_bolt', name: 'Star Bolt', text: 'A bolt of starlight (2d6 + Wits). Light: creatures of the dark hate it.',
        cost: 2, target: 'foe', fx: 'starbolt', tags: ['light'], damage: '2d6',
        lines: {
          use: ["You pluck a star from your hat and throw it like a dart.", "You raise your staff. The stars in your hat swirl and gather.", "You whisper to the night sky, and the night sky answers."],
          hit: ["The star bolt bursts in a shower of silver. Direct hit!", "Starlight crashes over it like a wave. It squeals.", "A bolt of pure star. It glows for a moment, then wishes it hadn't."],
          miss: ["The star sails past and hangs in the sky. Well, now it's a new constellation.", "Your bolt goes wide and lights up the whole place. Lovely. Useless. Lovely.", "So bright, so fast, so slightly to the left."],
        } },
      { id: 'sleepy_dust', name: 'Sleepy Dust', text: 'A Wits check to send a foe to sleep. Big foes only get drowsy: easier to hit for a while.',
        cost: 2, target: 'foe', fx: 'dust', tags: [],
        lines: {
          use: ["You blow a pinch of glittering dust off your palm. Sleepy time.", "You hum a yawn and sprinkle silver dust.", "You flick a pinch of dream-dust off the brim of your hat."],
          hit: ["Its eyes droop. It curls up and snores like a teakettle.", "It yawns, wobbles, and falls fast asleep. Shh.", "Out like a candle. Tiny snores."],
          miss: ["It sneezes the dust right back at you. You feel a bit yawny yourself.", "It shakes its head hard and stays awake. Grumpy, but awake.", "The dust drifts off and sends a passing beetle to sleep instead."],
        } },
      { id: 'comet_shower', name: 'Comet Shower', text: 'Your great power. Comets rain on every foe (1d8 + Wits each). Light.',
        cost: 3, great: true, target: 'allFoes', fx: 'comets', tags: ['light'], damage: '1d8',
        lines: {
          use: ["You take off your hat, hold it high, and let every star in it fall.", "You lift your staff to the sky and call the comets down.", "Your hat empties itself into the sky. Then the sky comes back down, on fire."],
          hit: ["Comets land everywhere, boom, boom, boom! Silver sparks fly like snow.", "A storm of falling stars. When it clears, everything is dazzled.", "The sky rains light. Your foes run in circles."],
          miss: ["The comets crash all around them and miss by a whisker. Still very pretty.", "A beautiful shower of stars, and they dodge every one. Impressive, honestly."],
        } },
    ],
    perks: {
      2: [
        { id: 'wizard_bright_mind', name: 'Bright Mind', text: '+1 Wits. Sharper spells, sharper puzzles.', effect: { stat: { wits: 1 } } },
        { id: 'wizard_deep_well', name: 'Deep Well', text: 'Start every battle with 1 extra Spark.', effect: { sparks: 1 } },
      ],
      3: [
        { id: 'wizard_star_shield', name: 'Star Shield', text: '+1 Guard. Tiny stars orbit you and nudge blows aside.', effect: { guard: 1 } },
        { id: 'wizard_crackling', name: 'Crackling Spark', text: 'Your Spark rolls 1d8.', effect: { strikeDie: '1d8' } },
      ],
    },
    intro: "A small wizard with a very big hat. Every star in it is real, and every one has a name.",
  },

  ranger: {
    arch: 'ranger', name: 'Fenn Wildstrider', calling: 'Ranger',
    blurb: 'Quiet, kind, and never lost. His fox, Biscuit, is never quiet and frequently lost.',
    talent: { id: 'animal_friend', name: 'Animal Friend', text: 'Beasts, tracks and the wild.' },
    stats: { might: 1, agility: 3, wits: 1, heart: 1 }, hp: 11, guard: 12, attackStat: 'agility',
    strike: {
      name: 'Bow Shot', die: '1d8', fx: 'arrow',
      lines: {
        hit: [
          "You draw, breathe, loose. Thwip! Right where you meant it.",
          "Your arrow hums across and lands with a thock.",
          "A quick shot from the hip. Biscuit yips approval.",
          "You don't even seem to aim. You just know.",
          "Thwip, thock. One arrow, one ouch.",
          "You loose an arrow, and the wind politely moves out of its way.",
          "Steady hands, soft breath, clean hit.",
        ],
        miss: [
          "Your arrow whispers past and pins a leaf to a tree. Biscuit goes to fetch it.",
          "Thwip. Thunk. That tree will never be the same.",
          "A gust nudges your arrow off course. The wind owes you one.",
          "It hops aside just as you loose. Clever thing.",
          "You miss, and Biscuit gives you a look.",
          "The arrow flies true, to where it used to be.",
        ],
        crit: [
          "You draw, the whole world goes quiet, and the arrow lands perfectly. Biscuit howls with pride.",
          "One arrow, fired so fast nobody saw you draw. Thock! Bullseye.",
          "Your arrow curves round a branch like it was told the way. Incredible shot.",
          "You loose, and the arrow sings a note all the way there. Perfect.",
        ],
      },
    },
    powers: [
      { id: 'twin_arrows', name: 'Twin Arrows', text: 'Two quick shots (1d6 + Agility each), at one foe or two.',
        cost: 2, target: 'foe', fx: 'arrows', tags: [], damage: '1d6', shots: 2,
        lines: {
          use: ["Two arrows, one breath. You draw them both at once.", "You nock two arrows and grin.", "Quick as a blink, two arrows on the string."],
          hit: ["Thwip-thwip! Both find their mark.", "One, two, ouch, ouch.", "Two arrows, two hits, zero wasted."],
          miss: ["Thwip-thwip, both miss. They make a neat little X in a tree.", "Both arrows land a whisker wide. Neatly, at least."],
        } },
      { id: 'biscuit_go', name: 'Biscuit, Go!', text: 'No roll. Biscuit nips a foe (1d4) and marks it: easier for everyone to hit.',
        cost: 2, target: 'foe', fx: 'fox', tags: [],
        lines: {
          use: ["You whistle. Biscuit's ears shoot up. Go get 'em.", "You point. A streak of orange fur is already running.", "Biscuit, go! And he goes, tail like a flame."],
          hit: ["Biscuit nips its ankle and dances away, yapping. Now everyone knows where to aim.", "Biscuit bites, spins, and sits there looking smug. Marked!", "A fox-shaped blur, a nip, a yelp. Biscuit trots back, very pleased."],
        } },
      { id: 'rain_of_arrows', name: 'Rain of Arrows', text: 'Your great power. Arrows fall on every foe (1d6 + Agility each) and mark them.',
        cost: 3, great: true, target: 'allFoes', fx: 'rain', tags: [], damage: '1d6',
        lines: {
          use: ["You aim straight up at the sky and empty your quiver.", "You fire arrow after arrow into the clouds. Then you wait.", "Every arrow you own goes up. Now watch them come down."],
          hit: ["Arrows patter down like hard rain. Every foe is pinned and flustered.", "A whistling storm of arrows. Nothing out there is having a nice time.", "The sky rains arrows and Biscuit hides his nose under his tail."],
          miss: ["The arrows come down all around them like a fence. They stand very still.", "It rains arrows everywhere except on them. They look up, relieved and surprised."],
        } },
    ],
    perks: {
      2: [
        { id: 'ranger_keen_eye', name: 'Keen Eye', text: '+1 Agility. Quicker hands, truer arrows.', effect: { stat: { agility: 1 } } },
        { id: 'ranger_wild_heart', name: 'Wild Heart', text: '+1 Heart. Animals and strangers trust you sooner.', effect: { stat: { heart: 1 } } },
      ],
      3: [
        { id: 'ranger_longbow', name: 'Longbow', text: 'Your Bow Shot rolls 1d10.', effect: { strikeDie: '1d10' } },
        { id: 'ranger_trailwise', name: 'Trailwise', text: '+3 max hearts. Long roads made you tough.', effect: { maxHp: 3 } },
      ],
    },
    intro: "A ranger in a green hood, and Biscuit the fox, who would like you to know he is the real hero.",
  },

  trickster: {
    arch: 'trickster', name: 'Zia Quickfingers', calling: 'Trickster',
    blurb: 'Lynx ears, brass goggles, a coat with forty pockets. Thirty-nine of them are full.',
    talent: { id: 'nimble_fingers', name: 'Nimble Fingers', text: 'Locks, traps and sleight of hand.' },
    stats: { might: 1, agility: 3, wits: 2, heart: 0 }, hp: 10, guard: 12, attackStat: 'agility',
    strike: {
      name: 'Quick Jab', die: '1d6', fx: 'jab', bonusDie: '1d6', bonusWhen: ['marked', 'asleep', 'tangled', 'stunned'],
      lines: {
        hit: [
          "Jab! You're in, you're out, you're grinning.",
          "Quick as a cat, you poke right where it hurts.",
          "You dart in, tap tap, and you're gone before it turns round.",
          "A jab so fast it only notices afterwards. Ow?",
          "Flick, stab, wink. Lovely work.",
          "You slip past its guard like a key into a lock.",
          "It blinks, and you've already hit it twice. Well, once. Very quickly.",
        ],
        miss: [
          "You dart in, it dodges, you dart out. Everyone is very fast and nobody is hurt.",
          "You jab, it hops. You both look slightly impressed with each other.",
          "Your goggles fog up at the worst possible moment.",
          "You trip on your own coat. Forty pockets, one tangle.",
          "It slaps your paw away. Cheeky.",
          "Nearly. You land in a crouch and pretend you meant to.",
        ],
        crit: [
          "You vanish, reappear behind it, and tap it on the shoulder. Then you really hit it.",
          "A blur of goggles and coat-tails. Every jab lands. Show-stopping.",
          "You find the one soft spot, right between the prickles. Perfect.",
          "You flip over its head, jab on the way down, and land on your feet. Of course you do.",
        ],
      },
    },
    powers: [
      { id: 'sneak_strike', name: 'Sneak Strike', text: 'A sneaky blow (2d6 + Agility). Lands a huge hit on 18 or more.',
        cost: 2, target: 'foe', fx: 'sneak', tags: [], damage: '2d6', critOn: 18,
        lines: {
          use: ["You melt into the shadows. Where did you go?", "You tiptoe round the back, ears flat, grinning.", "One moment you're there. The next, you're not."],
          hit: ["Surprise! You strike from nowhere and it yelps.", "From the shadows, one perfect, sneaky hit.", "It never saw you coming. It still hasn't."],
          miss: ["You sneak up, and it turns round just in time. Awkward. You wave.", "So sneaky that even you lose track of where you are."],
        } },
      { id: 'smoke_puff', name: 'Smoke Puff', text: 'No roll. A puff of smoke blinds every foe: their next attacks are clumsy.',
        cost: 2, target: 'allFoes', fx: 'smoke', tags: [],
        lines: {
          use: ["You pull a little ball from pocket nineteen and throw it down. Poof!", "You clap your paws. Smoke billows out of your sleeves.", "Pocket twelve: smoke. Always pocket twelve."],
          hit: ["Grey smoke everywhere. Your foes cough and stumble about.", "They can't see a thing. One of them apologises to a rock.", "Smoke rolls over them. Somebody bumps into somebody else."],
        } },
      { id: 'pocket_tricks', name: 'Pocket Full of Tricks', text: 'Your great power. A dazzling trick (1d8 + Agility). On a hit the foe is stunned and you find coins.',
        cost: 3, great: true, target: 'foe', fx: 'tricks', tags: [], damage: '1d8', coins: '1d6+2',
        lines: {
          use: ["You open every pocket at once. Out comes everything.", "Marbles, springs, a rubber spider, a very small kite. Here goes.", "You empty your coat at it. All forty pockets."],
          hit: ["Marbles under its feet, a spider on its nose, a kite in its ear. It's stunned, and look, coins!", "It goes down in a heap of your nonsense. And something clinks. Treasure!", "A perfect bundle of tricks. While it sits there stunned, you pocket a few shiny coins."],
          miss: ["Everything bounces off it. You'll be picking up marbles for a week.", "It steps neatly over every trick. You'll get it next time."],
        } },
    ],
    perks: {
      2: [
        { id: 'trickster_light_feet', name: 'Light Feet', text: '+1 Guard. Hard to pin down.', effect: { guard: 1 } },
        { id: 'trickster_quick_wits', name: 'Quick Wits', text: '+1 Wits. You spot the trick before it springs.', effect: { stat: { wits: 1 } } },
      ],
      3: [
        { id: 'trickster_charm', name: 'Lucky Charm', text: '+1 Heart. Even grumpy folk smile at you now.', effect: { stat: { heart: 1 } } },
        { id: 'trickster_extra_pocket', name: 'Extra Pocket', text: 'Start every battle with 1 extra Spark.', effect: { sparks: 1 } },
      ],
    },
    intro: "A cat-eared trickster with forty pockets. Don't ask what's in them. She'll show you anyway.",
  },

  bard: {
    arch: 'bard', name: 'Lark Songweaver', calling: 'Bard',
    blurb: 'A round, cheerful badger with a lute. Has never met a silence he could not fill.',
    talent: { id: 'silver_tongue', name: 'Silver Tongue', text: 'Charm, song and performance.' },
    stats: { might: 0, agility: 1, wits: 2, heart: 3 }, hp: 10, guard: 11, attackStat: 'heart',
    strike: {
      name: 'Sharp Note', die: '1d6', fx: 'note',
      lines: {
        hit: [
          "You strike one sharp note. TWANG! It hits like a pebble.",
          "A high, bright note flies off your lute and smacks it on the nose.",
          "Plink! That one stung.",
          "You pluck a chord so sour it makes them wince.",
          "A note so loud it bounces. It hits twice, if you count the echo.",
          "Strum, ping, ouch. Music is powerful.",
          "You sing one perfect high note, and it wobbles from the force of it.",
        ],
        miss: [
          "A string goes boing and curls up. Embarrassing. You retune, quickly.",
          "Your note misses and lands in someone's ear in the next valley.",
          "You hit a wrong note. Everyone winces, including you.",
          "Plonk. Wrong key. It didn't even notice.",
          "Your sharp note comes out flat. Like your hat, a bit.",
          "It covers its ears just in time. Clever.",
        ],
        crit: [
          "You hit a note so perfect the air shimmers. It knocks them clean off their feet.",
          "One chord, played like you mean it. Even your enemy taps a foot before it falls over.",
          "You hold a note for a full five seconds. It hits like a gong. Bravo!",
          "A note so beautiful it hurts. Literally. Wonderful.",
        ],
      },
    },
    powers: [
      { id: 'rousing_tune', name: 'Rousing Tune', text: 'No roll. A song that lifts every friend: better rolls for a while, and a Spark each.',
        cost: 2, target: 'allAllies', fx: 'song', tags: ['song'],
        lines: {
          use: ["You stamp your foot and launch into a marching song.", "One, two, three, four! You strike up a tune nobody can sit still for.", "You sing loud and proud, the way heroes do in stories."],
          hit: ["Everyone stands a little taller. Toes are tapping. Hearts are pounding.", "Your friends feel brave right down to their boots.", "The song gets into everybody's bones. Onward!"],
        } },
      { id: 'dazzling_chord', name: 'Dazzling Chord', text: 'A chord of light and music (1d6 + Heart) that also calms the foe.',
        cost: 2, target: 'foe', fx: 'chord', tags: ['song', 'light'], damage: '1d6',
        lines: {
          use: ["You sweep your paw over every string at once. The lute starts to glow.", "You strum a chord that shines like a sunrise.", "You play the brightest chord you know."],
          hit: ["The chord flashes gold. It's dazzled, and a little bit charmed.", "Light and music wash over it. It stops scowling, just for a moment.", "Dazzling! It sways, rubbing its eyes, half smiling."],
          miss: ["The chord shines past it. It didn't care for the song. Its loss.", "Bright, beautiful, and a tiny bit off target."],
        } },
      { id: 'encore', name: 'Encore!', text: 'Your great power. No roll. A friend takes a whole extra turn, right now.',
        cost: 3, great: true, target: 'ally', fx: 'encore', tags: ['song'],
        lines: {
          use: ["You bow low and shout: Encore! Encore!", "You play a fanfare for a friend. The crowd demands more!", "You point your lute at a friend. One more time, with feeling!"],
          hit: ["Your friend bounces up, ready to go again.", "Encore! Your friend takes another bow, and another turn.", "The music won't let your friend sit down. Go again!"],
        } },
    ],
    perks: {
      2: [
        { id: 'bard_big_voice', name: 'Big Voice', text: '+1 Heart. Your songs reach further, your words land softer.', effect: { stat: { heart: 1 } } },
        { id: 'bard_sturdy', name: 'Well Fed', text: '+3 max hearts. All those festival pies paid off.', effect: { maxHp: 3 } },
      ],
      3: [
        { id: 'bard_second_verse', name: 'Second Verse', text: 'Start every battle with 1 extra Spark.', effect: { sparks: 1 } },
        { id: 'bard_ringing_lute', name: 'Ringing Lute', text: 'Your Sharp Note rolls 1d8.', effect: { strikeDie: '1d8' } },
      ],
    },
    intro: "A badger bard with a lute and a feather in his cap. He has already written a song about you.",
  },

  mender: {
    arch: 'mender', name: 'Moss Greenmender', calling: 'Mender',
    blurb: 'A gentle young forest giant. Flowers grow on his shoulders, and broken things get better near him.',
    talent: { id: 'herb_lore', name: 'Herb Lore', text: "Plants, healing and nature's secrets." },
    stats: { might: 2, agility: 0, wits: 2, heart: 2 }, hp: 13, guard: 11, attackStat: 'might',
    strike: {
      name: 'Staff Thump', die: '1d6', fx: 'thump',
      lines: {
        hit: [
          "Thump. Gently, firmly, right on the head.",
          "You bring your lantern-staff down like a falling branch. Bonk.",
          "A slow, sure swing. It lands with a deep, woody thud.",
          "You tap it with your staff. For a giant, a tap is a lot.",
          "Thump! The flowers on your shoulders don't even shake.",
          "You sigh, sorry about it, and thump it anyway.",
          "One big, patient swing. It connects.",
        ],
        miss: [
          "Your staff thumps the ground and a little daisy pops up. Nice, but not helpful.",
          "You swing slowly, and it walks round it. Fair.",
          "You miss, and apologise to the ground.",
          "Thud. Into the dirt. A worm looks up, offended.",
          "Too gentle. It barely notices.",
          "Your staff snags on a root. Even the forest wants a turn.",
        ],
        crit: [
          "You swing like an old oak in a storm. THOOM. That was something.",
          "Your lantern flares as the staff lands. A ring of flowers bursts up around your feet.",
          "One huge, kind, unstoppable thump. It sees every star there is.",
          "You don't hit it so much as plant it. Wonderful.",
        ],
      },
    },
    powers: [
      { id: 'mending_light', name: 'Mending Light', text: 'Heal a friend (1d8 + Heart + level). Also wakes a dazed friend.',
        cost: 2, target: 'ally', fx: 'heal', tags: ['light'], heal: '1d8',
        lines: {
          use: ["You raise your lantern-staff. Its light turns warm and green.", "You lay a big, gentle hand on your friend's shoulder.", "You hum to your lantern, and it hums back in light."],
          hit: ["Warm light pours over your friend. Scrapes close. Breath comes back.", "Your friend glows like a hearth, and feels a whole lot better.", "Green light, the smell of spring rain, and fresh hearts."],
        } },
      { id: 'tangle_vines', name: 'Tangle Vines', text: 'Vines burst up (1d4 + Wits). On a hit the foe is tangled: easier to hit, and its special move is stuck.',
        cost: 2, target: 'foe', fx: 'vines', tags: ['vines'], damage: '1d4',
        lines: {
          use: ["You tap the ground with your staff and whisper to the roots.", "You kneel, press a palm to the earth, and ask nicely.", "Your shoulders bloom. The ground starts to wriggle."],
          hit: ["Vines whip up and wrap it like a parcel. Tangled!", "Green ropes burst from the ground and hold tight.", "It's caught in a knot of vines, kicking and cross."],
          miss: ["Vines leap up and grab nothing. They wave around, a bit lost.", "It hops clear of the vines just in time. They sulk back into the ground."],
        } },
      { id: 'spring_bloom', name: 'Spring Bloom', text: 'Your great power. Every friend heals (1d6 + Heart) and shakes off bad effects.',
        cost: 3, great: true, target: 'allAllies', fx: 'bloom', tags: [], heal: '1d6',
        lines: {
          use: ["You plant your staff, close your eyes, and call the spring.", "You spread your arms wide. Flowers burst from your shoulders.", "Your lantern blazes green. Here comes spring, early."],
          hit: ["Flowers bloom around every friend. Hurts heal, worries fall away.", "A meadow bursts up under everyone's feet. It smells like hope.", "Spring rolls through the party like a warm wind."],
        } },
    ],
    perks: {
      2: [
        { id: 'mender_deep_roots', name: 'Deep Roots', text: '+1 Guard. Hard to knock over, like an old tree.', effect: { guard: 1 } },
        { id: 'mender_green_thumb', name: 'Green Thumb', text: '+1 Wits. Your vines grab harder and your herbs work better.', effect: { stat: { wits: 1 } } },
      ],
      3: [
        { id: 'mender_kind_heart', name: 'Kind Heart', text: '+1 Heart. Your healing light shines brighter.', effect: { stat: { heart: 1 } } },
        { id: 'mender_oak_staff', name: 'Oak Staff', text: 'Your Staff Thump rolls 1d8.', effect: { strikeDie: '1d8' } },
      ],
    },
    intro: "A gentle forest giant with flowers on his shoulders. Bees follow him around. He doesn't mind.",
  },
};

export default heroes;
