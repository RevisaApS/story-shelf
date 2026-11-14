// Grimspire hunters (GRIMSPIRE.md 2, 4.1, 4.5). Owner: gs-content-a.
// Every spoken line is Varg talking to the player who controls the hunter: second person, present tense.
// Battle lines (strike, skill use) are 90 characters or fewer. `fx` ids are the battle-fx vocabulary
// agreed with gs-battle: slash_arc, fire_burst, shield_glow, smoke, poison, lightning_chain, frost_lance,
// thunder, tempest, arrow, wolf_bite, trap, arrow_rain, heavy_slash, war_cry, rune_glow, heal, hex, ward, dawn,
// blade_flurry.

const heroes = {
  dragonknight: {
    arch: 'dragonknight', name: 'Kaelen Ashblade', role: 'Tank, fire',
    blurb: 'Black plate with embers glowing in the cracks. Stands in front, takes the hits, and swings a greatsword that burns.',
    family: 'sword',
    base: { hp: 46, hpPer: 9, atk: 5, def: 4, spd: 3, luck: 1 },
    knacks: { might: 3, agility: 0, wits: 1, heart: 2 },
    strike: {
      name: 'Ember Sweep',
      lines: {
        perfect: [
          "Right on the mark! The blade burns a line of light clean through it.",
          "Perfect sweep. Sparks fly off the edge like a forge in a storm.",
          "That is how a greatsword is meant to sing. Beautiful.",
          "Clean arc, full weight, dead centre. I felt that one from here.",
        ],
        good: [
          "Solid swing. The steel bites and the embers hiss.",
          "A good heavy sweep. It staggers back a step.",
          "You catch it on the swing. Not pretty, but it counts.",
          "The greatsword lands with a thud. It felt that.",
        ],
        weak: [
          "Late on the swing. The blade only grazes it.",
          "You swung at the air. The air is fine.",
          "Too early! The sword drags its heavy feet.",
          "A tap with the flat of the blade. It looks almost insulted.",
        ],
      },
    },
    skills: [
      { id: 'dk_cleave', name: 'Cleave', text: 'One huge sweep that hits every foe.', cost: 2, level: 1, command: true, hits: 1, target: 'allFoes',
        effect: { dmg: { mult: 0.7, target: 'all' } }, fx: 'slash_arc',
        lines: { use: [
          "You plant your feet and swing wide. Everyone in reach, duck!",
          "One great sweep, all the way round. Make it count.",
          "The greatsword rises over your head. They see it coming. Too late.",
        ] } },
      { id: 'dk_emberguard', name: 'Ember Guard', text: 'Foes must attack you. You glow with a shield of 30% of your Health for 2 turns.', cost: 2, level: 2, command: false, target: 'self',
        effect: { taunt: 2, shield: { pct: 0.3, to: 'self', turns: 2 } }, fx: 'shield_glow',
        lines: { use: [
          "You bang your sword on your armour. Over here, bone bags!",
          "The cracks in your plate flare orange. Let them come to you.",
          "You step in front of everyone. A wall of black steel and embers.",
        ] } },
      { id: 'dk_flamebrand', name: 'Flame Brand', text: 'A fire strike for double damage that sets the foe burning.', cost: 3, level: 4, command: true, hits: 1, target: 'foe',
        effect: { dmg: { mult: 2, element: 'fire', target: 'one' }, apply: [{ status: 'burn', turns: 3, to: 'target' }] }, fx: 'fire_burst',
        lines: { use: [
          "You run a hand down the blade and it bursts into flame.",
          "Fire crawls up the steel. Hold it, hold it, now strike!",
          "The sword glows white hot. Something is about to get toasted.",
        ] } },
      { id: 'dk_dragonswrath', name: "Dragon's Wrath", text: 'Dragon fire washes over every foe and sets them all burning.', cost: 5, level: 6, ultimate: true, command: true, hits: 1, target: 'allFoes',
        effect: { dmg: { mult: 1.6, element: 'fire', target: 'all' }, apply: [{ status: 'burn', turns: 3, to: 'foes' }] }, fx: 'fire_burst',
        lines: { use: [
          "Your shoulder guards open like wings. The air goes hot. Here it comes!",
          "You raise the greatsword and a dragon's roar comes out of it. Burn!",
          "Fire pours off you like a river. Nothing on that side stays cold.",
        ] } },
    ],
    intro: "Black plate, a sword full of fire. You stand in front so the others can breathe.",
    startGear: { weapon: 'gs_sword_common', armour: 'gs_armour_leathers' },
  },

  shadow: {
    arch: 'shadow', name: 'Nyx Nightstep', role: 'Crits, poison',
    blurb: 'A hood, violet eyes and twin daggers trailing smoke. Fast, quiet, and very hard to hit back.',
    family: 'daggers',
    base: { hp: 32, hpPer: 6, atk: 6, def: 1, spd: 7, luck: 4 },
    knacks: { might: 0, agility: 3, wits: 2, heart: 1 },
    strike: {
      name: 'Twin Fangs',
      lines: {
        perfect: [
          "Both blades, both on the mark. Snick, snick. Lovely.",
          "Perfect pair! It never even saw the second one.",
          "Two flashes of violet and you are already gone. Perfect.",
          "Left, right, flawless. Smoke curls where you were.",
        ],
        good: [
          "Two quick cuts. It spins round looking for you.",
          "The daggers find a gap in its guard. Good.",
          "In and out. Not your best, but it stings.",
          "A fast double strike. It hisses and backs off.",
        ],
        weak: [
          "One blade lands, the other finds nothing but smoke.",
          "Too slow on the second ring. It shrugs it off.",
          "You stab, you miss, you look cool anyway. Mostly.",
          "A scratch. It barely notices you are there.",
        ],
      },
    },
    skills: [
      { id: 'sh_backstab', name: 'Backstab', text: 'A heavy stab from behind. Always a critical hit if the foe already suffers a status.', cost: 2, level: 1, command: true, hits: 1, target: 'foe',
        effect: { dmg: { mult: 1.8, target: 'one', bonus: 'ifStatus' } }, fx: 'smoke',
        lines: { use: [
          "You melt into the smoke and come out right behind it.",
          "It turns left. You are already on its right. Strike!",
          "Quiet as a shadow. It does not know where you went.",
        ] } },
      { id: 'sh_venomedge', name: 'Venom Edge', text: 'A cut with poisoned daggers. Poison stacks up to three times.', cost: 2, level: 2, command: true, hits: 1, target: 'foe',
        effect: { dmg: { mult: 1, target: 'one' }, apply: [{ status: 'poison', turns: 3, to: 'target' }] }, fx: 'poison',
        lines: { use: [
          "You dip both blades in green venom. One little cut is all it takes.",
          "The daggers drip and glow. Give it something to think about.",
          "Venom on the edge, smoke at your heels. Go.",
        ] } },
      { id: 'sh_vanish', name: 'Vanish', text: 'Disappear into smoke. Foes cannot target you, and your next strike does double damage.', cost: 2, level: 4, command: false, target: 'self',
        effect: { vanish: 2 }, fx: 'smoke',
        lines: { use: [
          "A puff of smoke and you are simply not there any more.",
          "You step back into the shadows. They look everywhere but up.",
          "Gone. Even I lost you for a moment, and I have one good eye.",
        ] } },
      { id: 'sh_thousandcuts', name: 'Thousand Cuts', text: 'Five lightning strikes on one foe, one command for each.', cost: 5, level: 6, ultimate: true, command: true, hits: 5, target: 'foe',
        effect: { dmg: { mult: 0.5, target: 'one', hits: 5 } }, fx: 'blade_flurry',
        lines: { use: [
          "Your eyes flare violet. Five strikes. Hit every single ring!",
          "You become a storm of blades. Keep up with your own hands!",
          "Deep breath. Then cut, cut, cut, cut, cut.",
        ] } },
    ],
    intro: "Twin daggers, violet eyes, a step nobody hears. They will never see you coming.",
    startGear: { weapon: 'gs_daggers_common', armour: 'gs_armour_leathers' },
  },

  stormmage: {
    arch: 'stormmage', name: 'Zarek Stormcaller', role: 'Area damage, stun',
    blurb: 'A floating tome, a white streak in dark hair and a staff that crackles. Lightning that jumps from foe to foe.',
    family: 'staff',
    base: { hp: 28, hpPer: 5, atk: 7, def: 1, spd: 4, luck: 2 },
    knacks: { might: 0, agility: 1, wits: 3, heart: 2 },
    strike: {
      name: 'Storm Bolt',
      lines: {
        perfect: [
          "Released right in the bright band! The bolt cracks like thunder.",
          "Perfect charge. Your hair stands up and so does mine.",
          "A white bolt, dead on target. The whole room flashes.",
          "That is a full charge. It is still twitching.",
        ],
        good: [
          "A good bolt. It jumps back, smoking a little.",
          "Zap. Not the biggest flash, but it hits home.",
          "The staff spits a spark and it finds its mark.",
          "Lightning licks across it. It did not enjoy that.",
        ],
        weak: [
          "Let go too soon. The bolt fizzles into a tiny pop.",
          "Held too long! The spark sputters out like a wet candle.",
          "A little crackle. It looks more tickled than hurt.",
          "The tome sighs at you. The bolt barely reaches.",
        ],
      },
    },
    skills: [
      { id: 'sm_chainlightning', name: 'Chain Lightning', text: 'A storm bolt that jumps on to two more foes for a little less.', cost: 2, level: 1, command: true, hits: 1, target: 'foe',
        effect: { dmg: { mult: 1, element: 'storm', target: 'chain', jumps: 2, jumpMult: 0.6 } }, fx: 'lightning_chain',
        lines: { use: [
          "The staff hums. One bolt, then it goes looking for friends.",
          "Lightning wants to jump. Let it jump!",
          "You point the staff and the air starts to crackle.",
        ] } },
      { id: 'sm_frostlance', name: 'Frost Lance', text: 'A spear of ice that hits hard and chills the foe, slowing it down.', cost: 2, level: 2, command: true, hits: 1, target: 'foe',
        effect: { dmg: { mult: 1.4, element: 'frost', target: 'one' }, apply: [{ status: 'chill', turns: 2, to: 'target' }] }, fx: 'frost_lance',
        lines: { use: [
          "Your breath turns white. A spear of ice grows on the staff.",
          "The tome flips to a frosty page. Cold enough to bite.",
          "You call the winter in. Throw it hard!",
        ] } },
      { id: 'sm_thunderclap', name: 'Thunderclap', text: 'A crash of thunder hits every foe and may stun them.', cost: 3, level: 4, command: true, hits: 1, target: 'allFoes',
        effect: { dmg: { mult: 0.8, element: 'storm', target: 'all' }, apply: [{ status: 'stun', turns: 1, chance: 0.35, to: 'foes' }] }, fx: 'thunder',
        lines: { use: [
          "You slam the staff on the stones. Cover your ears!",
          "Dark clouds gather under the ceiling. Indoors. Impressive.",
          "The tome snaps shut like a drum. BOOM.",
        ] } },
      { id: 'sm_tempest', name: 'Tempest', text: 'You become the storm. Huge storm damage to every foe.', cost: 5, level: 6, ultimate: true, command: true, hits: 1, target: 'allFoes',
        effect: { dmg: { mult: 1.8, element: 'storm', target: 'all' } }, fx: 'tempest',
        lines: { use: [
          "You rise off the floor. Wind howls, the tome spins. Unleash it!",
          "Every page tears loose and turns to lightning. Here comes the storm.",
          "Your eyes go white. I am going to stand back a bit.",
        ] } },
    ],
    intro: "A staff full of lightning and a book that floats by itself. You bring the storm.",
    startGear: { weapon: 'gs_staff_common', armour: 'gs_armour_leathers' },
  },

  hunter: {
    arch: 'hunter', name: 'Brynja Wolfbow', role: 'Marks, piercing',
    blurb: 'A scarred monster hunter with a huge bow and her dire wolf, Fang. Finds the weak spot and puts an arrow in it.',
    family: 'bow',
    base: { hp: 34, hpPer: 6, atk: 6, def: 2, spd: 6, luck: 3 },
    knacks: { might: 1, agility: 3, wits: 2, heart: 0 },
    strike: {
      name: 'True Shot',
      lines: {
        perfect: [
          "Right in the weak spot! The arrow sings all the way there.",
          "Perfect aim. It does not know what hit it. An arrow did.",
          "Bullseye. The wolf howls, and so would I.",
          "You held your breath and let go at the exact moment. Lovely shot.",
        ],
        good: [
          "Thunk. A good arrow, well placed.",
          "The arrow sticks and it staggers. Nice.",
          "Not the sweet spot, but a solid hit.",
          "Twang, thwack. It felt that one.",
        ],
        weak: [
          "The arrow skims off. Close, but no.",
          "You shot the wall. The wall had it coming, I suppose.",
          "Too early! The reticle had not even got there.",
          "A wobbly shot. It hits, barely, and falls out.",
        ],
      },
    },
    skills: [
      { id: 'hu_piercingshot', name: 'Piercing Shot', text: 'A heavy arrow that ignores armour and Defence.', cost: 2, level: 1, command: true, hits: 1, target: 'foe',
        effect: { dmg: { mult: 1.5, target: 'one', pierce: true } }, fx: 'arrow',
        lines: { use: [
          "You pull the bow all the way back. That arrow is going through.",
          "The black arrow. The one for thick hides. Aim true.",
          "Armour? Shields? This arrow does not care.",
        ] } },
      { id: 'hu_sicem', name: "Sic 'em!", text: 'Fang bites a foe and marks it: it takes 25% more damage for 3 turns.', cost: 2, level: 2, command: true, hits: 1, target: 'foe',
        effect: { dmg: { mult: 1, target: 'one' }, apply: [{ status: 'mark', turns: 3, to: 'target' }] }, fx: 'wolf_bite',
        lines: { use: [
          "You whistle once. Fang is already running.",
          "Go on, Fang! A grey blur and a lot of teeth.",
          "You point. The wolf does the rest.",
        ] } },
      { id: 'hu_snaretrap', name: 'Snare Trap', text: 'Set a trap. The next foe to attack gets stunned and hurt.', cost: 2, level: 4, command: false, target: 'self',
        effect: { trap: { mult: 1 } }, fx: 'trap',
        lines: { use: [
          "You set a snare in the shadows. Go on, step forward.",
          "Rope, spikes, a little patience. Who wants to go first?",
          "The trap clicks into place. Now we wait for a clumsy foot.",
        ] } },
      { id: 'hu_arrowstorm', name: 'Arrow Storm', text: 'Six arrows rain down on random foes.', cost: 5, level: 6, ultimate: true, command: true, hits: 1, target: 'allFoes',
        effect: { dmg: { mult: 0.6, target: 'random', hits: 6 } }, fx: 'arrow_rain',
        lines: { use: [
          "You shoot six arrows straight up. Now look out below!",
          "The sky goes dark with feathers. Everybody duck except us.",
          "Arrow after arrow, faster than I can count. It starts to rain.",
        ] } },
    ],
    intro: "A big bow and a bigger wolf. You find the weak spot, and Fang finds the rest.",
    startGear: { weapon: 'gs_bow_common', armour: 'gs_armour_leathers' },
  },

  berserker: {
    arch: 'berserker', name: 'Torvald Twin-Axe', role: 'Huge hits, risk',
    blurb: 'A giant in a horned helm with blue runes glowing on his arms. Two axes, no plan, enormous hits.',
    family: 'axes',
    base: { hp: 42, hpPer: 8, atk: 7, def: 2, spd: 4, luck: 1 },
    knacks: { might: 3, agility: 1, wits: 0, heart: 2 },
    strike: {
      name: 'Twin Axe Fury',
      lines: {
        perfect: [
          "Full meter! Both axes come down like an avalanche.",
          "Chop, chop, CHOP. The runes blaze. Magnificent.",
          "That is a proper fury. The floor is shaking.",
          "Every tap counted. It flies backwards across the room.",
        ],
        good: [
          "A good flurry. The axes bite deep into bone.",
          "Thud, thud. Two heavy hits, well swung.",
          "You roar and chop. It does not like that.",
          "Solid! The runes flicker on your arms.",
        ],
        weak: [
          "A half-hearted chop. Tap faster next time!",
          "One axe lands, the other waves hello.",
          "You puff and swing. It barely wobbles.",
          "That was a tickle, not a fury. Again!",
        ],
      },
    },
    skills: [
      { id: 'be_recklessswing', name: 'Reckless Swing', text: 'A double-damage swing, but you take 25% more damage until your next turn.', cost: 2, level: 1, command: true, hits: 1, target: 'foe',
        effect: { dmg: { mult: 2, target: 'one' }, apply: [{ status: 'mark', turns: 1, to: 'self' }] }, fx: 'heavy_slash',
        lines: { use: [
          "Forget defence. You wind up both axes over your head.",
          "No guard, no worry, all swing. Make it a big one.",
          "You charge in with your arms wide open. Brave or silly? Both.",
        ] } },
      { id: 'be_warcry', name: 'War Cry', text: 'A roar that fires up every ally: +25% Attack for 3 turns.', cost: 2, level: 2, command: false, target: 'allAllies',
        effect: { apply: [{ status: 'rally', turns: 3, to: 'allies' }] }, fx: 'war_cry',
        lines: { use: [
          "You throw your head back and roar. Even Sod puffs up his feathers.",
          "A war cry that rattles the walls. Everyone feels braver.",
          "You bang the axes together. CLANG! Up, hunters, up!",
        ] } },
      { id: 'be_runeoffury', name: 'Rune of Fury', text: 'Costs 15% of your Health. Gain 3 Fury at once.', cost: 0, level: 4, command: false, target: 'self',
        effect: { hpCost: 0.15, fury: 3 }, fx: 'rune_glow',
        lines: { use: [
          "The runes on your arms burn bright blue. It hurts. It is worth it.",
          "You grit your teeth and the fury floods in.",
          "Blue fire runs up your arms. You are ready for something huge.",
        ] } },
      { id: 'be_avalanche', name: 'Avalanche', text: 'Triple damage to one foe. Up to four times when your Health is low.', cost: 5, level: 6, ultimate: true, command: true, hits: 1, target: 'foe',
        effect: { dmg: { mult: 3, target: 'one', bonus: 'lowHp' } }, fx: 'heavy_slash',
        lines: { use: [
          "You leap so high you nearly hit the ceiling. Both axes. All of it.",
          "The runes go white. This is the big one. Tap like thunder!",
          "You charge like a mountain falling down. Get out of the way!",
        ] } },
    ],
    intro: "Two axes and a roar that shakes dust off the rafters. You hit hardest of all.",
    startGear: { weapon: 'gs_axes_common', armour: 'gs_armour_leathers' },
  },

  gravewarden: {
    arch: 'gravewarden', name: 'Morwen Gravewarden', role: 'Healer, curses',
    blurb: 'Calm and pale, with a scythe-staff and a lantern of friendly ghost-lights. Mends the living and curses the dead.',
    family: 'scythe',
    base: { hp: 36, hpPer: 7, atk: 5, def: 3, spd: 5, luck: 2 },
    knacks: { might: 1, agility: 1, wits: 2, heart: 3 },
    strike: {
      name: 'Lantern Reap',
      lines: {
        perfect: [
          "Both pulses on the beat. The scythe glides through like moonlight.",
          "Perfect rhythm. The ghost-lights cheer, in their quiet way.",
          "A silver arc, right on time. It shivers to its bones.",
          "Tick, tock, reap. You make it look calm. It is terrifying.",
        ],
        good: [
          "A good reap. The blade hums as it lands.",
          "The lantern glows and the scythe finds its mark.",
          "Steady swing. It takes a step back.",
          "On the beat, more or less. It still stings.",
        ],
        weak: [
          "Off the beat. The scythe swishes past its nose.",
          "The ghost-lights wince. That one barely touched it.",
          "Too fast, then too slow. It hardly felt it.",
          "A gentle tap. It almost looks grateful.",
        ],
      },
    },
    skills: [
      { id: 'gw_soulmend', name: 'Soul Mend', text: 'Heal an ally for 35% of their Health.', cost: 2, level: 1, command: false, target: 'ally',
        effect: { heal: { pct: 0.35, to: 'target' } }, fx: 'heal',
        lines: { use: [
          "A ghost-light floats from your lantern and wraps around a friend.",
          "You whisper, and warm light closes every scrape.",
          "The lantern glows soft and green. Breathe. Better now.",
        ] } },
      { id: 'gw_hex', name: 'Hex', text: 'A shadow strike that curses a foe: weaker Attack and Defence for 3 turns.', cost: 2, level: 2, command: true, hits: 1, target: 'foe',
        effect: { dmg: { mult: 0.6, element: 'shadow', target: 'one' }, apply: [{ status: 'curse', turns: 3, to: 'target' }] }, fx: 'hex',
        lines: { use: [
          "You draw a grey sign in the air. It hangs there, waiting.",
          "The lantern dims. Something cold slides toward the foe.",
          "Three quiet words. The monster suddenly feels very tired.",
        ] } },
      { id: 'gw_spiritward', name: 'Spirit Ward', text: 'Every ally gets a ghost-light shield of 20% of their Health.', cost: 3, level: 4, command: false, target: 'allAllies',
        effect: { shield: { pct: 0.2, to: 'allies', turns: 3 } }, fx: 'ward',
        lines: { use: [
          "The lantern opens. Little lights circle every one of you.",
          "Friendly ghosts link hands around the party. Nothing gets through easily.",
          "You lift the lantern high. A green glow settles on your friends.",
        ] } },
      { id: 'gw_seconddawn', name: 'Second Dawn', text: 'Every fallen ally stands up with 40% Health, and everyone heals 30%.', cost: 5, level: 6, ultimate: true, command: false, target: 'allAllies',
        effect: { revive: { pct: 0.4 }, heal: { pct: 0.3, to: 'allies' } }, fx: 'dawn',
        lines: { use: [
          "The lantern blazes like a sunrise. Up, all of you. Not yet!",
          "Morning light fills the room. Even the shadows step back.",
          "You plant the scythe and the dawn comes early. Everyone stands.",
        ] } },
    ],
    intro: "A lantern of friendly ghosts and a scythe for the unfriendly ones. You keep everyone standing.",
    startGear: { weapon: 'gs_scythe_common', armour: 'gs_armour_leathers' },
  },
};

export default heroes;
