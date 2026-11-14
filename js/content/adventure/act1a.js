// Act I, part one: Thistlehollow and the Whisperwood (story-1).

const M = 'elder_maren';

// Said once, before the first skill challenge a party meets (ROUND2 3.3). Same text in every act file.
const TEACH_SKILL = { if: { not: 'taught_skill' }, then: [
  { say: "No die for this one. This one is up to your own two hands. Watch how it goes, then have a go.", mood: 'warm' },
  { set: { taught_skill: true } },
] };

const act1a = {
  // ------------------------------------------------------------------ village_square
  village_square: {
    id: 'village_square', title: 'Thistlehollow', subtitle: 'The night of Lanternfall',
    bg: 'village_square', music: 'village', ambience: 'festival', weather: 'lanterns',
    steps: [
      { say: "Ah. There you are. Pull up a chair. Mind the dragon, he's only wax.", mood: 'warm' },
      { card: { kicker: 'Act I', title: 'The Night the Song Stopped' } },
      "Thistlehollow glows tonight. A hundred paper lanterns sway over the square, and the whole village smells of cinnamon and woodsmoke.",
      { say: "But look up. Past the rooftops, Mount Kettle is puffing grey smoke at the stars. And is that... snow? In the middle of summer?", mood: 'hush' },
      { sfx: 'whoosh' },
      { say: "Before anyone can wonder, a gust of wind snatches a lantern from a little girl's hands. It tumbles away over the crowd, flame wobbling. She gasps.", mood: 'excited' },
      { choice: { prompt: 'The lantern is getting away! What do you do?', options: [
        { label: 'Leap and catch it', stat: 'agility', steps: [
          TEACH_SKILL,
          { skill: { kind: 'aim', stat: 'agility', dc: 'easy', label: 'Catch the runaway lantern',
            success: [ "You spring off a barrel, pluck the lantern out of the air and land like you meant to. The crowd goes: ooooh." ],
            crit: [ { say: "You run up a tent rope, flip, and catch it by the string, one handed, upside down. Someone drops their pie. It is the best thing Thistlehollow has ever seen.", mood: 'excited' } ],
            fail: [ { say: "You leap, you stretch, and you land face first in a hay cart. The lantern drifts gently down beside you anyway. Nobody saw. Probably.", mood: 'funny' }, { set: { hay_hair: true } } ],
          } } ] },
        { label: 'Call it down kindly', stat: 'heart', hint: 'Lanterns like a gentle voice', steps: [
          { check: { stat: 'heart', dc: 'easy', label: 'Coax the lantern down',
            success: [ "You hold out your hands and talk to it, soft and low, like a frightened kitten. The lantern bobs, considers, and floats down into your palms.",
              "You give it back to the little girl. Her name is Tansy, and she hugs your knees." ],
            fail: [ { say: "You call to it sweetly. The lantern ignores you, bonks off the bell tower, and drops into the girl's arms all by itself. You take a bow anyway.", mood: 'funny' } ],
          } } ] },
        { label: 'Knock it down with a thrown apple', stat: 'wits', hint: 'Gently. Very gently.', steps: [
          { check: { stat: 'wits', dc: 'easy', label: 'Judge the throw',
            success: [ "You toss an apple from a stall. It taps the lantern's string just so, and the lantern sways back down to earth. The apple seller is too impressed to charge you." ],
            fail: [ { say: "Your apple sails past the lantern and lands in a bowl of punch. Splosh. The lantern, unimpressed, drifts down on its own. The punch man glares.", mood: 'funny' } ],
          } } ] },
        { label: 'Send Biscuit to fetch it', talent: 'animal_friend', steps: [
          "You whistle. A streak of orange shoots between forty pairs of legs, up a cheese stall, and back, lantern string held proudly in his teeth. Good fox." ] },
      ] } },
      { set: { lantern_saved: true } },
      "The music strikes up again. The festival is in full swing, and nobody needs you just yet.",
      { hub: { id: 'square', prompt: 'Explore the festival. Where to?', spots: [
        // Pie stall, centre right
        { id: 'pie', label: 'The Pie Contest', icon: 'pie', x: 808, y: 440, once: true, steps: [
          "Mother Crumb's pie stall groans under twenty steaming pies. The smell alone could knock over a goat.",
          "It's the Lanternfall pie-eating race. First prize: one whole blackberry pie, still warm.",
          { say: "And there, tucking in his napkin, is Farmer Hobb. Eleven years champion. He has the belly of a legend.", mood: 'funny' },
          { choice: { prompt: 'Will you race Farmer Hobb?', options: [
            { label: 'Eat like a hero', stat: 'might', steps: [
              { check: { stat: 'might', dc: 'medium', label: 'Out-eat Farmer Hobb',
                success: [ "You eat with the focus of a dragon and the manners of a badger. Pie one, pie two, pie three. Farmer Hobb looks over, and goes pale.",
                  { say: "Mother Crumb rings her spoon on a pan. A new champion! She hands you the prize pie with a curtsey.", mood: 'excited' },
                  { set: { won_pie: true } }, { give: 'blackberry_pie' } ],
                crit: [ { say: "You eat so fast that pies seem to vanish when you look at them. Farmer Hobb puts down his fork and slowly takes off his hat to you.", mood: 'excited' },
                  { set: { won_pie: true } }, { give: 'blackberry_pie' } ],
                fail: [ { say: "You eat four pies. Farmer Hobb eats nine, then asks if there's custard. Second place. Mother Crumb gives you a honeycake for trying, and a pat on the belly.", mood: 'funny' },
                  { give: 'honeycake' } ],
                fumble: [ { say: "First bite, and you get the hiccups. Loud ones. Hic! The crowd laughs so hard even Farmer Hobb chokes. He still wins. You get a honeycake for the show.", mood: 'funny' },
                  { give: 'honeycake' } ],
              } } ] },
            { label: 'Small bites, steady pace', stat: 'wits', hint: 'Farmer Hobb always starts too fast', steps: [
              { check: { stat: 'wits', dc: 'medium', label: 'Pace yourself',
                success: [ "Farmer Hobb gulps three pies in a minute, then has to lie down. You keep nibbling, slow and steady, like a clever tortoise. Pie by pie, you pull ahead.",
                  "The spoon clangs. You win! Mother Crumb hands you the prize pie, laughing.",
                  { set: { won_pie: true } }, { give: 'blackberry_pie' } ],
                fail: [ { say: "Steady, steady, slightly too steady. You're on your second pie when Farmer Hobb finishes his tenth. He shakes your sticky hand. Good race.", mood: 'funny' },
                  { give: 'honeycake' } ],
              } } ] },
            { label: 'Cheer on little Dot instead', stat: 'heart', hint: 'She has never won anything', steps: [
              "At the end of the table sits Dot, the smallest racer, staring at her pie like it might bite her.",
              { check: { stat: 'heart', dc: 'easy', label: 'Cheer Dot to victory',
                success: [ "You crouch beside her and cheer every mouthful. Go, Dot! The whole square joins in. Dot eats like a hurricane and wins by a crumb.",
                  "She looks at the big prize pie, then at you, and pushes it into your arms. For you, she says. For the adventure.",
                  { set: { won_pie: true } }, { give: 'blackberry_pie' } ],
                fail: [ "You cheer your loudest. Dot comes third, which is two places higher than she has ever come. She runs off to show her grandmother her purple face." ],
              } },
              { say: "Wick, ring the bell. You gave up your own shot at the prize so a small girl could shine. That is worth a Star.", mood: 'grand' },
              { star: 1, why: 'For giving up the prize' } ] },
            { label: 'Sing the Pie Song', talent: 'silver_tongue', steps: [
              { say: "You hop on the table and burst into the Pie Song, all forty verses. By verse three the crowd is singing. By verse nine Farmer Hobb is laughing too hard to chew.", mood: 'excited' },
              "Mother Crumb declares the race a draw and gives you the prize pie, for services to music.",
              { set: { won_pie: true } }, { give: 'blackberry_pie' } ] },
          ] } },
        ] },

        // Notice board, far left
        { id: 'notices', label: 'The Notice Board', icon: 'scroll', x: 188, y: 423, steps: [
          { say: "The notice board is crowded. Lost: one goat, answers to Doris. Found: Doris. Wanted: brave folk for... the rest is torn off.", mood: 'funny' },
          "And pinned in the middle, a child's crayon drawing. Three round stones with music coming out of them, and a very big, very sad dragon.",
          { say: "Underneath, in wobbly letters: MISSING. THREE SINGING STONES. PLEASE HELP.", mood: 'hush' },
          { choice: { prompt: 'The notice board', options: [
            { label: 'Look closer at the drawing', stat: 'wits', once: true, steps: [
              { check: { stat: 'wits', dc: 'easy', label: 'Spot the detail',
                success: [ "In the corner, the child has drawn something else. Tiny pointed footprints, leading away from the mountain. And a black and white feather.",
                  { set: { saw_footprints: true } } ],
                fail: [ { say: "You lean in very close. Something nibbles your cloak. You turn round. It's Doris. Doris has found you.", mood: 'funny' } ],
              } }, { again: true } ] },
            { label: 'Read the old carving under the board', talent: 'read_runes', once: true, steps: [
              "Under the board, half hidden by moss, there's a row of stone-folk runes. Nobody in the village can read them. You can.",
              { say: "They say: Light first. Then song. Then the one who sleeps. You have no idea what it means. Yet.", mood: 'hush' },
              { set: { read_carving: true } }, { again: true } ] },
            { label: 'Leave a kind note for the child', stat: 'heart', once: true, steps: [
              "You find a stub of chalk and write under the drawing: WE WILL FIND THEM. Someone small will read that in the morning and feel braver.",
              { again: true } ] },
            { label: 'Back to the festival', steps: [] },
          ] } },
          { journal: "A child's drawing on the notice board: three singing stones, missing." },
        ] },

        // Pip's cart, far right
        { id: 'pip', label: "Pip's Cart", icon: 'cart', x: 1108, y: 440, steps: [
          { show: 'pip', at: 'right' },
          "A cart painted every colour there is leans at the edge of the square, hung with pans, clocks, boots and a stuffed owl.",
          { say: "Heroes! Adventurers! Customers, even! Pip the Tinker, at your service, oddments and essentials, mind the owl, it bites!", as: 'pip', mood: 'excited' },
          { choice: { prompt: 'Pip the Tinker', options: [
            { label: 'Fix the cart\'s wobbly wheel', stat: 'might', once: true, requires: { not: 'pip_helped' }, steps: [
              { say: "Ah, the wheel. She wobbles. She's always wobbled. Fix her and I'll pay, honest coin!", as: 'pip', mood: 'funny' },
              { check: { stat: 'might', dc: 'easy', label: 'Lift the cart and fix the wheel',
                success: [ "You heave the cart up on one shoulder while Pip bangs the wheel straight. Clunk. Perfect. He presses three coins into your hand.",
                  { gold: 3 }, { set: { pip_helped: true } } ],
                fail: [ { say: "You lift. The wheel falls off. For ten long minutes you hold up the whole shop while Pip finds a hammer. He pays you two coins, out of pity and respect.", mood: 'funny' },
                  { gold: 2 }, { set: { pip_helped: true } } ],
              } }, { again: true } ] },
            { label: 'Fix the wheel with a hairpin', talent: 'nimble_fingers', once: true, requires: { not: 'pip_helped' }, steps: [
              "You pull a hairpin from pocket seven, give the wheel's pin a twist and a flick, and it clicks into place. Pip stares.",
              { say: "Thirty years that wheel's wobbled! Here, take four coins. Take five! No, four. Four's fair.", as: 'pip', mood: 'excited' },
              { gold: 4 }, { set: { pip_helped: true } }, { again: true } ] },
            { label: 'Ask about the mountain', once: true, steps: [
              { say: "The mountain? Funny you ask. Last week a little goblin in a feather cloak bought every cog I had. Forty pounds of cogs! Paid in spoons. Who pays in spoons?", as: 'pip', mood: 'funny' },
              { set: { heard_of_glint: true } }, { again: true } ] },
            { label: 'Browse the cart', steps: [ { shop: 'pip_cart' }, { again: true } ] },
            { label: 'Say goodbye', steps: [] },
          ] } },
          { hide: 'pip' },
        ] },

        // The well, centre
        { id: 'well', label: 'The Old Well', icon: 'well', x: 492, y: 473, once: true, steps: [
          "By the old stone well, a little boy is crying into his sleeve.",
          { say: "His name is Wim. His wooden duck, Captain Quack, has fallen down the well. Far below, it bobs in the dark, going round and round.", mood: 'sad' },
          { choice: { prompt: 'Captain Quack is down the well', options: [
            { label: 'Climb down the rope', stat: 'agility', steps: [
              TEACH_SKILL,
              { skill: { kind: 'balance', stat: 'agility', dc: 'medium', label: 'Climb down the well',
                success: [ "Hand over hand you climb down the slippery rope, scoop up Captain Quack, and climb back up with him between your teeth." ],
                crit: [ { say: "You stand in the bucket, salute, and ride it all the way down like a lift. Splash, grab, and back up again, duck held high. Wim cheers so hard he falls over.", mood: 'excited' } ],
                fail: [ { say: "Halfway down, your hands slip. SPLASH. You come up spluttering, soaked to the skin, with Captain Quack sitting on your head. Wim laughs until he hiccups.", mood: 'funny' } ],
              } } ] },
            { label: 'Fish for it with the bucket', stat: 'wits', steps: [
              { check: { stat: 'wits', dc: 'easy', label: 'Steer the bucket',
                success: [ "You lower the bucket, tip it just so, and scoop. Up comes Captain Quack, riding in the bucket like a little king." ],
                fail: [ { say: "First the bucket brings up an old boot. Then a very offended frog. Then, at last, Captain Quack. The frog is not invited back.", mood: 'funny' } ],
              } } ] },
            { label: 'Help Wim do it himself', stat: 'heart', hint: 'He is braver than he thinks', steps: [
              { check: { stat: 'heart', dc: 'easy', label: 'Give Wim courage',
                success: [ "You kneel beside him and hold the rope with him. Slowly, carefully, Wim lowers the bucket and fishes out his own duck. He stands up a foot taller.",
                  { say: "That was kind. You didn't just save the duck. You gave him a story of his own. He will tell it for years.", mood: 'warm' } ],
                fail: [ "Wim is too wobbly, so you do it together, four hands on the rope, both of you squeaking. Up comes Captain Quack, dripping." ],
              } } ] },
            { label: 'Haul the whole rope up in one pull', talent: 'stand_firm', steps: [
              { say: "You plant your feet, grab the rope, and pull. The bucket shoots up the well like a cork from a bottle, with Captain Quack on top. Whoosh!", mood: 'excited' },
              "You catch the duck one-handed and give it back. Wim's mouth hangs open." ] },
          ] } },
          { say: "Wim squeezes Captain Quack and then digs in his pocket. He gives you his very best thing: an acorn. It's lucky, he says. It really is.", mood: 'warm' },
          { give: 'lucky_acorn' },
          { set: { duck_rescued: true } },
          { journal: "Rescued a wooden duck called Captain Quack from the village well." },
        ] },
      ], leave: { label: 'Watch the lanterns go up', steps: [
        "The square hushes. All over Thistlehollow, the villagers lift their lanterns. Grandmothers, babies, farmers, Doris the goat.",
        { table: { text: "Everyone at the table: count down from three with the village, and let your lanterns go!", done: 'We did it!' } },
        { say: "Up they rise, a hundred warm lights drifting toward the mountain. It's the most beautiful thing you've ever seen.", mood: 'hush' },
        { sfx: 'rumble' }, { fx: 'rumble' },
        { say: "Then the ground growls. High on Mount Kettle, a great grey cloud bursts out, and a cold wind comes rushing down the slopes.", mood: 'ominous' },
        { weather: 'snow' },
        { say: "It catches the lanterns and blows them back, one by one, like falling leaves. And behind the wind comes snow. Thick, cold, summer snow.", mood: 'ominous' },
        { if: 'won_pie', then: [ { say: "Someone shouts. Somebody's pie has frozen solid. Not yours. Yours is safe in your pack, still warm.", mood: 'funny' } ] },
        { sfx: 'thunder' },
        { say: "Then, from the top of the hill: a bell. Clang. Clang. Clang. The Elder's bell. It only rings for trouble.", mood: 'ominous' },
        "Every face in the square turns. And somehow, they all turn to look at you.",
        { journal: "On the night of Lanternfall, the mountain roared, the lanterns fell, and it snowed in summer." },
        { goto: 'elder_hall' },
      ] } } },
    ],
  },

  // ------------------------------------------------------------------ elder_hall
  elder_hall: {
    id: 'elder_hall', title: "The Elder's Hall", subtitle: 'A bargain and a theft',
    bg: 'elder_hall', music: 'village', ambience: 'fire', weather: 'embers',
    steps: [
      "The Elder's hall is round and warm, and smells of woodsmoke and peppermint. A fire crackles in a hearth big enough to stand in.",
      { show: M, at: 'left' },
      "By the fire, in a rocking chair, sits Elder Maren. She's tiny and sharp-eyed, knitting something huge and blue, with a brass ear trumpet tucked under one arm.",
      { say: "Come in, come in! Shut the door, you're letting the snow in. Snow! In summer! What? Speak up!", as: M, mood: 'funny' },
      { if: 'hay_hair', then: [ { say: "You've got hay in your hair, dear. No. The other side.", as: M, mood: 'funny' } ] },
      { if: 'duck_rescued', then: [ { say: "And you fished young Wim's duck out of the well. He's my great-grandson. One of forty-two. I'm told he's the good one.", as: M } ] },
      { if: 'won_pie', then: [ { say: "And somebody finally beat Farmer Hobb at pies! He'll be sulking till midwinter. Good.", as: M, mood: 'funny' } ] },
      { say: "Now sit. Listen. You know the old story. Solenne sleeps under the mountain, and her warm breath keeps our valley green.", as: M },
      { say: "She sleeps because the Songstones sing to her. Morning, Evening and Midnight. Every night, for a thousand years.", as: M },
      { say: "Three nights ago, they stopped. I felt it in my knees. My knees are never wrong.", as: M, mood: 'sad' },
      { say: "Somebody took them. Somebody small. They left footprints in the frost. Pointy ones. And a feather.", as: M, mood: 'hush' },
      { if: { any: ['saw_footprints', 'heard_of_glint'] }, then: [ "Pointy footprints. A feather. You've heard about those already tonight, haven't you?" ] },
      { say: "No song, no sleep. No sleep, no warm breath. And a dragon who can't sleep gets very, very grumpy.", as: M, mood: 'ominous' },
      { sfx: 'rumble' }, { fx: 'shake' },
      "As if it heard her, the mountain grumbles. The jars on the shelves chatter. A ball of blue wool rolls slowly across the floor.",
      { choice: { prompt: 'What do you say to Elder Maren?', options: [
        { label: '"We\'ll find the stones. Tonight."', stat: 'might', steps: [
          { say: "Ha! Tonight, they say! Not even a cup of tea first. I like you. Tonight it is.", as: M, mood: 'excited' } ] },
        { label: '"Are you all right, Elder?"', stat: 'heart', steps: [
          "She stops knitting. For a moment the clicking needles are quiet.",
          { say: "Nobody's asked me that in forty years. I'm frightened, dear. That's the truth. But I'm a bit less frightened now you're here.", as: M, mood: 'sad' } ] },
        { label: '"Tell us about the feather."', stat: 'wits', steps: [
          { say: "Black and white, long, and shiny. A magpie's feather. Now who would wear magpie feathers? Somebody who likes shiny things, that's who.", as: M, mood: 'hush' },
          { say: "Pointy feet, light as a sparrow. If you ask me, that's a goblin. And goblins love anything that glitters.", as: M },
          { set: { suspects_goblin: true } } ] },
        { label: 'Brew her a cup of peppermint tea', talent: 'herb_lore', steps: [
          "You find the peppermint on her shelf, add a pinch of honeybalm for nerves, and hand her a steaming cup. She sips. Her shoulders drop.",
          { say: "Oh, that's lovely. That's better than mine, and I've been making it for ninety years. Here, take my good flask. You'll want it more than me.", as: M, mood: 'warm' },
          { give: 'moonpetal_tea' } ] },
      ] } },
      { say: "Now. You'll need some things. Hold out your hands.", as: M },
      { give: 'tuning_fork' },
      { say: "My grandmother's tuning fork. Silver. It hums when a Songstone is near. The closer you get, the louder it hums.", as: M },
      { give: 'elders_map' },
      { say: "A map of the valley. The jam on the mountain isn't part of the map. Or it is now.", as: M, mood: 'funny' },
      { gold: 10 },
      { if: 'won_pie', then: [ { say: "And ten coins. Don't spend them on more pie.", as: M, mood: 'funny' } ],
        else: [ { say: "And ten coins. Don't spend them all on pie.", as: M, mood: 'funny' } ] },
      { say: "And there's a rhyme. An old stone-folk rhyme about the mountain. My grandmother sang it. It goes... First the... first the...", as: M },
      { say: "Oh, bother. It's right on the tip of my tongue. Eh? What was I saying?", as: M, mood: 'funny' },
      { choice: { prompt: 'Help the Elder remember the rhyme', options: [
        { label: 'Ask her where she first heard it', stat: 'wits', steps: [
          { check: { stat: 'wits', dc: 'medium', label: 'Jog her memory',
            success: [ "You ask what she was doing when her grandmother sang it. Knitting, of course. She picks up her needles. Click, click, click. Her eyes light up.",
              { say: "First the Light, then the Song, then the Sleeper! That's it!", as: M, mood: 'excited' } ],
            crit: [ "You ask just the right question, and the memories pour out of her like water from a jug.",
              { say: "First the Light, then the Song, then the Sleeper! And there's a second verse, about a goat! And I've found my spectacles! They were on my head!", as: M, mood: 'excited' } ],
            fail: [ { say: "You suggest she try standing on her head. To your horror, she does. Her knitting unravels across the whole floor. And upside down, red as a beetroot, she shouts:", mood: 'funny' },
              { say: "First the Light, then the Song, then the Sleeper! It's the blood rushing to the head. Old trick. Help me up.", as: M, mood: 'funny' } ],
            fumble: [ { say: "You lean in to her ear trumpet to ask, and sneeze into it. HONK. She jumps so high her slippers fly off. And in pure shock, out it comes:", mood: 'funny' },
              { say: "First the Light, then the Song, then the Sleeper! Goodness. Bless you. Please never do that again.", as: M, mood: 'funny' } ],
          } } ] },
        { label: 'Hum her an old tune', stat: 'heart', steps: [
          { check: { stat: 'heart', dc: 'medium', label: 'Find the right tune',
            success: [ "You hum something old and slow. She hums along, and then the words come with it, like a cart behind a pony.",
              { say: "First the Light, then the Song, then the Sleeper. Oh, that's my grandmother's voice. I'd forgotten her voice.", as: M, mood: 'sad' } ],
            fail: [ { say: "You hum. She frowns. That's a pig-calling song, dear. But the pig-calling song reminds her of her grandmother's pigs, and her grandmother's pigs remind her of...", mood: 'funny' },
              { say: "First the Light, then the Song, then the Sleeper! Ha! Thank you, pigs.", as: M, mood: 'funny' } ],
          } } ] },
        { label: 'Read it from the carving over the hearth', talent: 'read_runes', steps: [
          "Over the hearth, under a hundred years of soot, there's a line of stone-folk runes. You wipe them clean with your sleeve and read them out.",
          { say: "That's it! First the Light, then the Song, then the Sleeper! Ninety years I've sat under that, and never knew. Clever thing.", as: M, mood: 'excited' } ] },
      ] } },
      { set: { knows_rhyme: true } },
      { say: "First the Light, then the Song, then the Sleeper. I don't know what it means. But the stone-folk never carved anything for nothing.", as: M, mood: 'hush' },
      { journal: "Elder Maren's rhyme: First the Light, then the Song, then the Sleeper." },
      { quest: { id: 'songstones', title: 'The Three Songstones', text: 'Find the Songstones of Morning, Evening and Midnight, and sing Solenne back to sleep.' } },
      { say: "Out of the window, Mount Kettle glows a dull, angry red. Somewhere inside it, something enormous turns over in its sleep.", mood: 'ominous' },
      { say: "The tuning fork, dear. Listen to it.", as: M, mood: 'hush' },
      { say: "You hold it up. Faint as a gnat, it hums. And when you point it toward the Whisperwood, it hums a little louder.", mood: 'hush' },
      { say: "Off you go, then. Bring back the song. And wear a scarf.", as: M },
      { hide: M },
      { journal: 'The Elder gave us a tuning fork, a map and ten coins. The fork hums toward the Whisperwood.' },
      { travel: 'whisperwood' },
      { goto: 'whisperwood' },
    ],
  },

  // ------------------------------------------------------------------ whisperwood
  whisperwood: {
    id: 'whisperwood', title: 'The Whisperwood', subtitle: 'Where the trees gossip',
    bg: 'whisperwood', music: 'forest', ambience: 'forest', weather: 'fireflies',
    steps: [
      "The Whisperwood is old. Older than the village, older than the road. Its trees lean over the path like grandparents over a cradle.",
      { say: "Blue mist curls round your boots. Fireflies blink on and off. And the trees... the trees are whispering.", mood: 'hush' },
      { say: "Psst. Look. Heroes. Small ones. Do you think they know we can see them?", mood: 'funny' },
      { if: 'won_pie', then: [ { say: "That one smells of blackberry pie. Rustle rustle. Lucky thing.", mood: 'funny' } ],
        else: [ { if: 'hay_hair', then: [ { say: "That one has hay in its hair. Rustle rustle. Shall we tell it? No. Let's not.", mood: 'funny' } ] } ] },
      "The tuning fork hums in your hand, tugging you onward. But ahead, the path splits three ways, and each one looks darker than the last.",
      { choice: { prompt: 'Which way through the Whisperwood?', options: [
        { label: 'Stay on the path and greet the trees', stat: 'heart', hint: 'Old trees like good manners', steps: [
          { check: { stat: 'heart', dc: 'easy', label: 'Charm the gossiping trees',
            success: [ "You bow and wish the trees good evening. They rustle with delight. Nobody has said good evening to them in two hundred years.",
              { say: "Psst. Lovely manners. A tip, then: prickly folk ahead, bored and grumpy. Hum them a tune and they'll dance. They can't help it.", mood: 'hush' } ],
            fail: [ { say: "You bow deeply to a tall shape in the mist and say good evening. It's a bush. The trees laugh so hard that acorns rain on your head.", mood: 'funny' },
              "Somewhere in the brambles, something small giggles along with them." ],
          } } ] },
        { label: 'Follow the tuning fork\'s hum', stat: 'wits', steps: [
          { check: { stat: 'wits', dc: 'medium', label: 'Follow the hum',
            success: [ "You hold the fork out like a compass and follow its note, left, right, under a fallen log. It leads you straight and true.",
              "On the way you find a little purse someone dropped long ago, with three old coins inside.", { gold: 3 } ],
            fail: [ { say: "You follow the hum deep into a holly bush. The humming gets louder and louder. It's a bee. It's a very cross bee.", mood: 'funny' },
              { hurt: 1 } ],
          } } ] },
        { label: 'Cut straight through the brambles', stat: 'might', steps: [
          { check: { stat: 'might', dc: 'medium', label: 'Smash a path through',
            success: [ "You push through the brambles like a bear through tall grass, and leave a fine wide path for everyone else.",
              "On the far side, a bush full of sparkberries glints in the dark. You pick a handful.", { give: 'sparkberry' } ],
            fail: [ { say: "The brambles grab your cloak, your sleeves and your dignity. You get through, but you leave a fair bit of all three behind.", mood: 'funny' },
              { hurt: 1 } ],
            fumble: [ { say: "You charge the brambles. The brambles win. You're stuck upside down for a full minute, like a fly in a web, while everyone politely looks the other way.", mood: 'funny' },
              { hurt: 1 } ],
          } } ] },
        { label: 'Follow the tracks with Biscuit', talent: 'animal_friend', steps: [
          "You kneel and read the ground. Biscuit sniffs beside you. Tiny pointed boot prints, goblin-sized, heading for the mountain, three nights old.",
          { say: "And caught on a thorn, a long black and white feather. Biscuit sneezes at it. He does not approve of magpies.", mood: 'hush' },
          { set: { found_feather: true } } ] },
        { label: 'Gather glowcap mushrooms', talent: 'herb_lore', steps: [
          "Under the roots you spot glowcaps, little mushrooms that shine when squeezed. You pop a few into a jar and shake it.",
          { say: "It blazes like a tiny sun. A flash lantern, forest style. Creatures of the dark will not like this one bit.", mood: 'warm' },
          { give: 'flash_lantern' } ] },
      ] } },
      { say: "Then the brambles giggle.", mood: 'hush' },
      { sfx: 'sting.danger' },
      { say: "Bushes do not giggle. Bushes should not giggle. These bushes are giggling.", mood: 'ominous' },
      { combat: 'thornling_ambush',
        befriend: [
          { say: "The Thornlings stop. They sway. And then, one by one, they start to dance, a wobbly, prickly, wonderful little dance.", mood: 'warm' },
          { say: "The biggest one, Prickle, puffs out its chest and squeaks: You're nice! We'll poke anything that bothers you! Anything at all!", mood: 'funny' },
          { set: { thorn_friends: true } },
          { say: "You made friends instead of foes. That's the best kind of win. Take a Star.", mood: 'warm' },
          { star: 1, why: 'For making friends' },
          { journal: 'Made friends with the Thornlings of the Whisperwood. They promised to poke anything that bothers us.' } ],
        win: [
          { say: "The last Thornling dives into the brambles. From deep in the bushes, a small voice: We're not scared. We're just going home. For tea.", mood: 'funny' },
          "In the trampled bramble nest, something glints. Four coins the Thornlings had been hoarding, probably stolen off picnic blankets.",
          { gold: 4 },
          { journal: 'Fought off a Thornling ambush in the Whisperwood.' } ] },
      "The wood goes quiet. The fireflies come back, one by one. Even the trees have stopped gossiping, for once.",
      { table: { text: "The trees want to hear you whisper. Everyone at the table: whisper one nice thing about the person next to you.", done: 'We did it!' } },
      { say: "Rustle rustle. Oh, that was sweet. We'll be talking about that for a hundred years.", mood: 'warm' },
      "The tuning fork hums louder now. And down the hill, through the trees, you hear the rush of fast water.",
      { say: "Moonlight on a river. An old stone bridge. And in the middle of it, something huge, and mossy... is snoring.", mood: 'hush' },
      { journal: 'The tuning fork led us out of the Whisperwood, toward the Old Stone Bridge.' },
      { travel: 'stone_bridge' },
      { goto: 'stone_bridge' },
    ],
  },
};

export default act1a;
