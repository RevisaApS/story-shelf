// Grimspire event rooms (GRIMSPIRE.md 3.6, schema 5.4). Owner: gs-content-b.
// Ten events, two per floor, referenced by floors.js rooms as event: 'f1_e1' ... 'f5_e2'.
// Steps are the SPEC 8.2 step language (run by screens/scene.js through gs-meta's room runner), plus:
//   { skill: { kind, stat, dc, label, success, fail, crit?, partial? } }   ROUND2 3.1, the hands decide
//   { loot: { roll: true, bonus?: n } }   a loot roll (d20 + Luck + bonus picks the rarity, loot.js picks the item)
//   { loot: { item: id } }                a fixed item
//   { ambush: encounterId }               a battle starts at once (the f<n>_h1 battles always exist)
//   { shop: 'sod' }                       Sod's stall: content.shops.sod, opened by gs-meta / gs-gear
// Flags the room runner reads before the next battle and then clears (gs-meta):
//   'gs.nextBattleEasy': true      every foe starts the next battle at 75% Health (runBattle opts.foeHp = 0.75)
//   'gs.blessing': 'fury'|'shield' the next battle starts with +2 Fury for every hunter, or a shield of 20% Health
// Every kind of skill challenge appears: timing (f1_e1, f5_e2), sneak (f1_e2), balance (f2_e1), aim (f2_e2),
// mash (f3_e1), memory (f4_e1).

const events = {
  // ---- Floor 1: The Bone Gate
  f1_e1: { id: 'f1_e1', title: 'The Iron-Bound Chest', steps: [
    { say: "In a corner sits a chest, bound in black iron. The lock is a ring of turning teeth.", mood: 'hush' },
    { say: "Watch the teeth spin. Stop them at the right moment and the lock gives. Get it wrong and it bites.", mood: 'warm' },
    { skill: { kind: 'timing', stat: 'agility', dc: 'easy', label: 'Stop the turning lock',
      crit: [
        { say: "Click. The teeth fold back like a flower. The lid swings open on its own. Oh, look at that.", mood: 'excited' },
        { sfx: 'gs.chest' },
        { loot: { roll: true, bonus: 4 } },
      ],
      success: [
        { say: "Clack. The lock gives with a grumble. Inside: something that glints.", mood: 'excited' },
        { sfx: 'gs.chest' },
        { loot: { roll: true } },
      ],
      fail: [
        { say: "Snap! The teeth nip your fingers and the lid slams shut. A few coins spill from the hinge.", mood: 'funny' },
        { hurt: 4, who: 'actor' },
        { gold: 15 },
      ],
    } },
  ] },

  f1_e2: { id: 'f1_e2', title: 'The Dart Corridor', steps: [
    { say: "A long corridor of grinning skulls. Every skull has a hole for a mouth. Every hole has a dart.", mood: 'ominous' },
    { say: "At the far end hangs a bag of Bone Shards. The skulls only shoot when their eyes glow. Move when they go dark.", mood: 'hush' },
    { skill: { kind: 'sneak', stat: 'agility', dc: 'medium', label: 'Creep past the skull darts',
      crit: [
        { say: "Not one skull sees you. You grab the bag and wave at them from the far end. Rude, but fair.", mood: 'excited' },
        { give: { id: 'gs_bone_shards', qty: 6 } },
        { gold: 20 },
      ],
      success: [
        { say: "One dart hisses past your ear and pings off the wall. You make it, bag in hand.", mood: 'excited' },
        { give: { id: 'gs_bone_shards', qty: 4 } },
      ],
      fail: [
        { say: "Thwip, thwip, thwip! You dance back out with darts stuck in your cloak. No bag. A bit of pride lost.", mood: 'funny' },
        { hurt: 6, who: 'actor' },
      ],
    } },
  ] },

  // ---- Floor 2: The Spider Vaults
  f2_e1: { id: 'f2_e1', title: 'The Crumbling Bridge', steps: [
    { say: "A stone bridge crosses a pit of web. Halfway over, it starts to crumble under your boots.", mood: 'ominous' },
    { say: "Something big shifts in the web below. Keep your balance. Do not look down. Fine, look down, but quickly.", mood: 'dry' },
    { skill: { kind: 'balance', stat: 'agility', dc: 'medium', label: 'Cross the crumbling bridge',
      crit: [
        { say: "You walk it like a tightrope dancer. On the far side, in an old nest, a spider has been hoarding treasure.", mood: 'excited' },
        { loot: { roll: true, bonus: 2 } },
      ],
      success: [
        { say: "Stones fall away behind every step. You leap the last gap and land rolling. Safe.", mood: 'excited' },
        { gold: 25 },
      ],
      partial: [
        { say: "You wobble, slip, and grab the edge with one hand. Somebody hauls you up. Your knees are not happy.", mood: 'warm' },
        { hurt: 5, who: 'actor' },
      ],
      fail: [
        { say: "Crack! The bridge drops and so do you, straight into sticky web. And the web has owners.", mood: 'fierce' },
        { ambush: 'f2_h1' },
      ],
    } },
  ] },

  f2_e2: { id: 'f2_e2', title: 'The Web-Hung Chandelier', steps: [
    { say: "Above the next door hangs a great iron chandelier, held up by one thick chain and a lot of web.", mood: 'hush' },
    { say: "Beyond the door, you hear clicking. Lots of it. Shoot the chain, and that chandelier drops right on whatever waits there.", mood: 'fierce' },
    { skill: { kind: 'aim', stat: 'wits', dc: 'medium', label: 'Shoot the chandelier chain',
      crit: [
        { say: "One shot, dead centre. The chain snaps, the chandelier falls, and the clicking turns to squealing. Ha!", mood: 'excited' },
        { set: { 'gs.nextBattleEasy': true } },
        { give: { id: 'gs_bone_shards', qty: 3 } },
      ],
      success: [
        { say: "Clang! The chain parts and the whole thing crashes down beyond the door. Whatever is in there just got a headache.", mood: 'excited' },
        { set: { 'gs.nextBattleEasy': true } },
      ],
      fail: [
        { say: "Your shot pings off the ceiling. The clicking stops. Now they know you are here. Lovely.", mood: 'dry' },
      ],
    } },
  ] },

  // ---- Floor 3: The Molten Forge
  f3_e1: { id: 'f3_e1', title: 'The Jammed Portcullis', steps: [
    { say: "A portcullis of black iron blocks the way, rusted half shut. Behind it, an old weapon rack glows red.", mood: 'warm' },
    { say: "There is a crank. It is very stiff. Turn it fast and hard, before the gate grinds back down.", mood: 'fierce' },
    { skill: { kind: 'mash', stat: 'might', dc: 'medium', label: 'Crank the jammed portcullis',
      crit: [
        { say: "The crank spins, the gate shrieks up into the ceiling, and it stays there. Arms like a forge giant.", mood: 'excited' },
        { loot: { roll: true, bonus: 3 } },
      ],
      success: [
        { say: "Inch by inch, the gate rises. Everyone ducks under, and you grab what glows on the rack.", mood: 'excited' },
        { loot: { roll: true } },
      ],
      partial: [
        { say: "Halfway up, the crank slips. You squeeze a hand under and pull out a few coins before it slams.", mood: 'warm' },
        { gold: 30 },
      ],
      fail: [
        { say: "The crank does not move. You do. Mostly sideways. The gate stays shut and laughs at you in rust.", mood: 'funny' },
      ],
    } },
  ] },

  f3_e2: { id: 'f3_e2', title: "Sod's Stall of Found Things", steps: [
    { say: "On a cooling anvil sits a raven behind a little blanket full of shiny things. Sod. How did he get up here?", mood: 'funny' },
    { say: "Found things! Good things! Only slightly haunted. Cheap for friends. Very cheap for nobody.", as: 'gs_sod', mood: 'funny' },
    { choice: { prompt: 'Sod looks at your purse.', options: [
      { label: 'See what Sod has', steps: [
        { shop: 'sod' },
      ] },
      { label: 'Give Sod a shiny coin for luck', hint: '10 gold', requires: { gold: 10 }, steps: [
        { gold: -10 },
        { say: "A coin! For me? Sod is touched. Sod gives you this. Sod did not steal it. Much.", as: 'gs_sod', mood: 'funny' },
        { loot: { item: 'gs_charm_sodsbutton' } },
      ] },
      { label: 'Walk on', steps: [
        { say: "Fine. Fine! Sod will remember this. Sod remembers everything shiny.", as: 'gs_sod', mood: 'funny' },
      ] },
    ] } },
  ] },

  // ---- Floor 4: The Frozen Library
  f4_e1: { id: 'f4_e1', title: 'The Rune Door', steps: [
    { say: "A door of blue ice, carved with six runes. As you step close, they light up one by one, and then go dark.", mood: 'hush' },
    { say: "It wants them back in the same order. Watch closely. The library does not like slow readers.", mood: 'ominous' },
    { skill: { kind: 'memory', stat: 'wits', dc: 'hard', label: 'Repeat the rune pattern',
      crit: [
        { say: "Every rune, first try. The door melts into a waterfall and freezes again behind you. Inside: a reading desk full of treasure.", mood: 'excited' },
        { loot: { roll: true, bonus: 4 } },
      ],
      success: [
        { say: "The last rune clicks. The ice door groans open. A small vault, and something sparkles on the shelf.", mood: 'excited' },
        { loot: { roll: true } },
      ],
      fail: [
        { say: "Wrong rune. The door frosts over, and a blast of snow knocks everyone back. Brr. Find another way round.", mood: 'dry' },
        { hurt: 6, who: 'all' },
      ],
    } },
  ] },

  f4_e2: { id: 'f4_e2', title: 'The Whispering Book', steps: [
    { say: "On a lectern of ice lies a book that breathes. Its pages flutter, and you hear it whisper your name. Well, a name.", mood: 'ominous' },
    { say: "It offers you a secret. Books with teeth do not give secrets for free.", mood: 'hush' },
    { choice: { prompt: 'The book waits, pages trembling.', options: [
      { label: 'Read the secret page', hint: 'Treasure, or trouble', steps: [
        { say: "You turn the page. The words jump off the paper and the whole shelf comes alive. It was a trap. Of course it was.", mood: 'fierce' },
        { ambush: 'f4_h1' },
        { say: "With the shelf beaten, the book goes quiet. Under its cover lies a real treasure. It was not all lies.", mood: 'excited' },
        { loot: { roll: true, bonus: 3 } },
      ] },
      { label: 'Slam it shut and tie it with a strap', stat: 'might', steps: [
        { say: "You slam the cover. The book squeals. You buckle it shut, and a handful of Bone Shards rattle out of the spine.", mood: 'funny' },
        { give: { id: 'gs_bone_shards', qty: 5 } },
      ] },
    ] } },
  ] },

  // ---- Floor 5: The Throne of Bones
  f5_e1: { id: 'f5_e1', title: 'The Shrine of the Last Light', steps: [
    { say: "Between the bone pillars glows a tiny shrine. One candle still burns here, warm and gold, in all this green.", mood: 'hush' },
    { say: "Someone kept it lit for a long time. It offers you a gift. Only one. Choose.", mood: 'warm' },
    { choice: { prompt: 'The candle flickers. What do you ask for?', options: [
      { label: 'Heal every wound', steps: [
        { say: "Warm light washes over you. Every bruise and every cut is gone. You feel brand new.", mood: 'warm' },
        { heal: 'full', who: 'all' },
      ] },
      { label: 'A blessing of fury for the next fight', steps: [
        { say: "The flame leaps into your eyes. Your hands tingle. The next fight, you start roaring.", mood: 'fierce' },
        { set: { 'gs.blessing': 'fury' } },
      ] },
      { label: 'A blessing of shields for the next fight', steps: [
        { say: "The light wraps around you like a cloak. The next fight, you start behind a shield of gold.", mood: 'grand' },
        { set: { 'gs.blessing': 'shield' } },
      ] },
    ] } },
    { say: "The candle burns a little lower. Whoever lit it, thank you.", mood: 'hush' },
  ] },

  f5_e2: { id: 'f5_e2', title: 'The Bell Rope', steps: [
    { say: "Here it is. The rope of the great bell, thick as your arm, dropping from the dark. Every night it rings, and the dead get up.", mood: 'ominous' },
    { say: "The bell swings even now. Cut the rope between two swings and it rings no more. Miss, and the bell calls the guards.", mood: 'fierce' },
    { skill: { kind: 'timing', stat: 'might', dc: 'hard', label: 'Cut the bell rope between swings',
      crit: [
        { say: "One cut, clean as winter. The rope falls in a heap. Far above, the bell stops. Listen. Silence. Beautiful.", mood: 'excited' },
        { set: { 'gs.bellCut': true } },
        { loot: { roll: true, bonus: 4 } },
      ],
      success: [
        { say: "The blade bites, the rope frays, and on the third chop it parts. The bell gives one sad clonk and is still.", mood: 'excited' },
        { set: { 'gs.bellCut': true } },
        { loot: { roll: true } },
      ],
      fail: [
        { say: "Bonggg. The bell rings right over your head. Your teeth buzz. And from the dark, bones start marching.", mood: 'fierce' },
        { ambush: 'f5_h1' },
        { say: "With the guards in pieces, you hack the rope through at last. The bell falls silent.", mood: 'warm' },
        { set: { 'gs.bellCut': true } },
      ],
    } },
  ] },
};

export default events;
