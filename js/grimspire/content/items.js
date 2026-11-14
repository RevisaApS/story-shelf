// Grimspire items (GRIMSPIRE.md 4.7, schema 5.4). 66 items: 24 weapons, 8 armours, 8 helms, 12 charms,
// 8 consumables, Bone Shards, 5 boss trophies. Owner: gs-content-b.
//
// stats: flat adds to the hunter's sheet (atk, def, hp, spd, luck); weapons carry dice. Forge `plus` adds 10%
// of the main stats per level (rules.js).
// traits: [ { id, ...params, text } ]. `text` is the short player-facing line the item card shows (ui text).
// Trait ids, agreed with gs-rules (battle-rules.js implements each one; loot.js reads goldFind / shardFind):
//   weapon:  statusOn { status, on: 'perfect'|'hit', chance? }   apply a status to the struck foe
//            crit { pct }          +crit chance                  lifesteal { pct }   heal self pct of damage dealt
//            furyOnKill { n }      pierce { pct } ignore pct of Defence
//            splash { pct }        on a Perfect, every other foe takes pct of the damage
//            extraHit { mult }     on a Perfect, strike the same foe again at once
//            chain { jumps, mult } every strike that is not Weak leaps to more foes
//            volley { arrows, mult } on a Perfect, extra arrows hit random foes
//            lowHpPower { max }    damage x(1 + max x missing Health fraction)
//            healOnPerfect { pct } heal the most hurt ally     healOnKill { pct } heal every ally on a kill
//   gear:    thorns { pct }  resist { elements, mult }  regen { pct }  startShield { pct }
//            blockWindow { pct }  strikeWindow { pct }  furyStart { n }  furyOnPerfect { n }  furyOnBlock { n }
//            goldFind { pct }  shardFind { pct }  lastStand { pct }  dodge { pct }  immune { statuses }
// use (consumables, schema 5.4 plus `apply`, same shape as a skill effect's apply):
//   heal: pct of max Health (one ally), fury: n, cleanse: true, revive: pct, smoke: true (the next foe attack
//   on each hunter misses), dmg: { mult, element, target: 'all' } (bomb damage = mult x the user's Attack x 2,
//   before Defence: gs-rules owns the base).
// Trophies carry boss: '<foeId>' (approved addition for loot.js and the Trophy Wall); no battle effect.

const T = {
  burnPerfect: { id: 'statusOn', status: 'burn', on: 'perfect', text: 'Perfect strikes set the foe on fire.' },
  chillPerfect: { id: 'statusOn', status: 'chill', on: 'perfect', text: 'Perfect strikes freeze the foe slow.' },
  cursePerfect: { id: 'statusOn', status: 'curse', on: 'perfect', text: 'Perfect strikes curse the foe.' },
  markPerfect: { id: 'statusOn', status: 'mark', on: 'perfect', text: 'Perfect shots mark the foe for everyone.' },
};

const W = (family, rarity, name, text, extra = {}) => {
  const dice = { common: '1d6', rare: '1d8+2', epic: '2d6+4', legendary: '2d8+8' }[rarity];
  const floor = { common: 1, rare: 2, epic: 3, legendary: 5 }[rarity];
  const price = { common: 60, rare: 160, epic: 360, legendary: 900 }[rarity];
  const { stats = {}, traits = [], element, floor: fl, price: pr } = extra;
  const it = { id: `gs_${family}_${rarity}`, name, text, kind: 'weapon', family, rarity, floor: fl || floor, price: pr || price,
    stats: { dice, ...stats }, traits };
  if (element) it.element = element;
  return it;
};

const weapons = [
  // sword: Kaelen, fire and toughness
  W('sword', 'common', 'Grave-Iron Greatsword', 'Heavy, honest and a bit rusty. It still bites.'),
  W('sword', 'rare', 'Emberbrand', 'Its edge glows like a coal you just blew on.', { element: 'fire', traits: [T.burnPerfect] }),
  W('sword', 'epic', 'Wyrmspine Cleaver', 'Forged around the spine of a fire drake. It hums when foes are near.',
    { element: 'fire', stats: { def: 1 }, traits: [{ id: 'splash', pct: 0.35, text: 'Perfect strikes scorch every other foe too.' }, T.burnPerfect] }),
  W('sword', 'legendary', 'Sunderflame', 'The last breath of a dragon, folded into steel. Swing it and the air catches fire.',
    { element: 'fire', stats: { def: 2, hp: 10 }, traits: [{ id: 'splash', pct: 0.6, text: 'Perfect strikes send a wave of fire through every foe.' }, T.burnPerfect] }),

  // daggers: Nyx, crits and poison
  W('daggers', 'common', 'Alley Fangs', 'Two plain knives, quick and quiet.'),
  W('daggers', 'rare', 'Viper Kiss', 'A green drop hangs on each tip and never falls.',
    { element: 'shadow', traits: [{ id: 'statusOn', status: 'poison', on: 'hit', chance: 0.5, text: 'Half your strikes poison the foe.' }] }),
  W('daggers', 'epic', 'Nightglass Fangs', 'Black glass blades that drink the light around them.',
    { element: 'shadow', stats: { spd: 1 }, traits: [{ id: 'crit', pct: 0.1, text: 'More critical hits.' }, { id: 'statusOn', status: 'poison', on: 'hit', chance: 0.5, text: 'Half your strikes poison the foe.' }] }),
  W('daggers', 'legendary', 'Whisper and Woe', 'One blade whispers, the other answers. Foes hear both too late.',
    { element: 'shadow', stats: { spd: 2, luck: 1 }, traits: [{ id: 'extraHit', mult: 1, text: 'A Perfect strike strikes again at once, full power.' }, { id: 'crit', pct: 0.1, text: 'More critical hits.' }] }),

  // staff: Zarek, storm and stun
  W('staff', 'common', 'Ash-Wood Staff', 'Smells of smoke and old spells.'),
  W('staff', 'rare', 'Sparkthorn Staff', 'Little sparks crawl up and down it like ants.',
    { element: 'storm', traits: [{ id: 'statusOn', status: 'stun', on: 'perfect', chance: 0.25, text: 'Perfect blasts can stun the foe.' }] }),
  W('staff', 'epic', 'Rimefang Rod', 'Frost grows on it in the shape of teeth.',
    { element: 'frost', stats: { luck: 1 }, traits: [T.chillPerfect, { id: 'pierce', pct: 0.3, text: 'Cuts through some of the foe\'s armour.' }] }),
  W('staff', 'legendary', 'Skyrender', 'Cut from a tree struck by lightning a hundred times. It is still angry about it.',
    { element: 'storm', stats: { spd: 1, luck: 1 }, traits: [{ id: 'chain', jumps: 2, mult: 0.5, text: 'Every blast leaps to two more foes.' }, { id: 'statusOn', status: 'stun', on: 'perfect', chance: 0.3, text: 'Perfect blasts can stun the foe.' }] }),

  // bow: Brynja, marks and piercing
  W('bow', 'common', 'Yew Hunting Bow', 'Bent, strung and trusted on a hundred hunts.'),
  W('bow', 'rare', 'Ghostfeather Bow', 'The arrows glow pale and fly without a sound.', { element: 'spirit', traits: [T.markPerfect] }),
  W('bow', 'epic', 'Winterhowl Longbow', 'When you draw it, you hear a wolf far away.',
    { element: 'frost', stats: { spd: 1 }, traits: [{ id: 'pierce', pct: 0.5, text: 'Arrows punch through half the foe\'s armour.' }, T.markPerfect] }),
  W('bow', 'legendary', 'Starfall', 'Strung with a thread of moonlight. Every arrow is a falling star.',
    { element: 'spirit', stats: { spd: 1, luck: 2 }, traits: [{ id: 'volley', arrows: 2, mult: 0.6, text: 'A Perfect shot splits into a rain of arrows on other foes.' }, { id: 'pierce', pct: 0.5, text: 'Arrows punch through half the foe\'s armour.' }] }),

  // axes: Torvald, huge hits and risk
  W('axes', 'common', 'Woodsplitter Pair', 'Made for logs. Logs do not fight back. Monsters do.'),
  W('axes', 'rare', 'Frostbite Hatchets', 'So cold your breath turns to snow when you swing them.', { element: 'frost', traits: [T.chillPerfect] }),
  W('axes', 'epic', 'Thunderjaw Axes', 'Blue runes crackle along the blades with every swing.',
    { element: 'storm', stats: { atk: 1 }, traits: [{ id: 'furyOnKill', n: 2, text: 'Each foe you knock down gives 2 Fury.' }] }),
  W('axes', 'legendary', 'Worldsplitter Twins', 'Two axes that hit like a mountain falling over. The more you are hurt, the harder they swing.',
    { element: 'storm', stats: { atk: 2, hp: 10 }, traits: [{ id: 'lowHpPower', max: 0.6, text: 'Hits harder the lower your Health.' }, { id: 'lifesteal', pct: 0.15, text: 'Every hit heals you a little.' }] }),

  // scythe: Morwen, healing and curses
  W('scythe', 'common', "Gravedigger's Scythe", 'Long handle, kind blade. It has cut a lot of graveyard grass.'),
  W('scythe', 'rare', 'Lanternreap', 'A tiny ghost-light lives in the blade and likes you.',
    { element: 'spirit', traits: [{ id: 'healOnPerfect', pct: 0.08, text: 'Perfect strikes heal your most hurt ally.' }] }),
  W('scythe', 'epic', 'Hexmoon Scythe', 'The blade is shaped like a crescent moon, and so is its shadow.',
    { element: 'shadow', stats: { def: 1 }, traits: [T.cursePerfect, { id: 'healOnPerfect', pct: 0.08, text: 'Perfect strikes heal your most hurt ally.' }] }),
  W('scythe', 'legendary', 'Dawnreaper', 'It glows like the first light of morning. Whatever it beats, it turns into hope.',
    { element: 'spirit', stats: { def: 2, hp: 10 }, traits: [{ id: 'healOnKill', pct: 0.15, text: 'Each foe you knock down heals every ally.' }, { id: 'healOnPerfect', pct: 0.1, text: 'Perfect strikes heal your most hurt ally.' }] }),
];

const G = (id, kind, rarity, floor, price, name, text, stats, traits = []) => ({ id, name, text, kind, rarity, floor, price, stats, traits });

const armours = [
  G('gs_armour_leathers', 'armour', 'common', 1, 40, "Hunter's Leathers", 'Stitched, patched and stitched again. Every patch is a story.', { def: 1, hp: 5 }),
  G('gs_armour_rattlechain', 'armour', 'common', 1, 70, 'Rattle-Chain Shirt', 'Loud when you walk. Louder when something hits it.', { def: 2, hp: 4 }),
  G('gs_armour_spidersilk', 'armour', 'rare', 2, 140, 'Spider-Silk Vest', 'Light as a cobweb and twice as tough as rope.', { def: 2, hp: 10, spd: 1 },
    [{ id: 'immune', statuses: ['poison', 'webbed'], text: 'You cannot be poisoned or webbed.' }]),
  G('gs_armour_bonemail', 'armour', 'rare', 2, 170, 'Bone-Plate Mail', 'Old skeleton armour, polished up. Foes that hit it get a nasty jab back.', { def: 3, hp: 8 },
    [{ id: 'thorns', pct: 0.15, text: 'Foes that hit you take some damage back.' }]),
  G('gs_armour_cinderplate', 'armour', 'epic', 3, 360, 'Cinder-Forged Plate', 'Still warm from the forge. Fire slides off it like rain.', { def: 4, hp: 15 },
    [{ id: 'resist', elements: ['fire'], mult: 0.5, text: 'Fire hurts you half as much.' }]),
  G('gs_armour_frostweave', 'armour', 'epic', 4, 380, 'Frostweave Robe', 'Woven from snow that never melts. It mends you while you fight.', { def: 2, hp: 12, spd: 2 },
    [{ id: 'regen', pct: 0.05, text: 'Heals you a little at the start of every turn.' }]),
  G('gs_armour_dragonscale', 'armour', 'legendary', 5, 900, 'Dragonscale Hauberk', 'Scales of a dragon who lost a bet. Fire, frost and lightning barely tickle.', { def: 6, hp: 25 },
    [{ id: 'resist', elements: ['fire', 'frost', 'storm'], mult: 0.6, text: 'Fire, frost and lightning hurt you much less.' }, { id: 'thorns', pct: 0.2, text: 'Foes that hit you take some damage back.' }]),
  G('gs_armour_nightshroud', 'armour', 'legendary', 5, 900, 'Nightshroud', 'A cloak cut from the night wind. Attacks pass through where you were a blink ago.', { def: 4, hp: 15, spd: 3 },
    [{ id: 'dodge', pct: 0.2, text: 'One foe attack in five misses you completely.' }]),
];

const helms = [
  G('gs_helm_ironpot', 'helm', 'common', 1, 30, 'Iron Pot Helm', 'Varg says it is a soup pot. Varg is right. It still stops a club.', { def: 1, hp: 3 }),
  G('gs_helm_horned', 'helm', 'common', 1, 60, 'Horned Battle Helm', 'Two big horns. Monsters take you more seriously.', { def: 1, atk: 1 }),
  G('gs_helm_wolfskull', 'helm', 'rare', 2, 130, 'Wolf-Skull Hood', 'Fur, teeth and a wolf grin. You feel quicker the moment it goes on.', { def: 1, spd: 1, luck: 1 }),
  G('gs_helm_embercrest', 'helm', 'rare', 2, 140, 'Ember Crest Helm', 'A plume of glowing embers that never burns out. Your eyes get sharper.', { def: 2, hp: 6 },
    [{ id: 'blockWindow', pct: 0.1, text: 'Blocks are a little easier to time.' }]),
  G('gs_helm_owlwatch', 'helm', 'epic', 3, 330, 'Owl-Watch Circlet', 'A silver band with an owl\'s eye. It sees the gap in every guard.', { def: 2, luck: 2 },
    [{ id: 'crit', pct: 0.05, text: 'More critical hits.' }]),
  G('gs_helm_gargoyle', 'helm', 'epic', 4, 370, 'Gargoyle-Face Helm', 'Carved stone with a frown. Nothing can freeze or tangle a face this grumpy.', { def: 3, hp: 10 },
    [{ id: 'immune', statuses: ['chill', 'webbed', 'silenced'], text: 'You cannot be chilled, webbed or silenced.' }]),
  G('gs_helm_thunderhorn', 'helm', 'legendary', 5, 900, 'Thunderhorn Helm', 'Lightning lives between its horns. You walk into battle already roaring.', { def: 3, spd: 2, luck: 2 },
    [{ id: 'furyStart', n: 2, text: 'Start every battle with 2 extra Fury.' }, { id: 'furyOnPerfect', n: 1, text: 'Perfect strikes give 1 more Fury.' }]),
  G('gs_helm_palelantern', 'helm', 'legendary', 5, 900, 'Mask of the Pale Lantern', 'A ghost-light burns behind the eyes. Curses melt, and wounds close on their own.', { def: 3, hp: 15, luck: 3 },
    [{ id: 'regen', pct: 0.06, text: 'Heals you at the start of every turn.' }, { id: 'immune', statuses: ['curse', 'burn', 'poison'], text: 'You cannot be cursed, burned or poisoned.' }]),
];

const charms = [
  G('gs_charm_knucklebone', 'charm', 'common', 1, 50, "Gambler's Knucklebone", 'Toss it, catch it, feel lucky. Chests seem to like you more.', { luck: 3 }),
  G('gs_charm_hawkfeather', 'charm', 'common', 1, 70, 'Hawk Feather', 'Tie it to your wrist and your aim slows down time a little.', {},
    [{ id: 'strikeWindow', pct: 0.2, text: 'Strikes are easier to time.' }]),
  G('gs_charm_sodsbutton', 'charm', 'common', 1, 40, "Sod's Lucky Button", 'Sod swears it is gold. It is brass. It still finds money everywhere.', {},
    [{ id: 'goldFind', pct: 0.3, text: 'Find more gold after battles.' }]),
  G('gs_charm_wardstone', 'charm', 'rare', 2, 130, 'Ward-Stone', 'A round grey stone with a rune. It throws up a shield before the first blow.', {},
    [{ id: 'startShield', pct: 0.15, text: 'Start every battle behind a shield.' }]),
  G('gs_charm_owleye', 'charm', 'rare', 2, 140, 'Owl-Eye Bead', 'A glass bead that blinks. It warns you a heartbeat early.', {},
    [{ id: 'blockWindow', pct: 0.25, text: 'Blocks are much easier to time.' }]),
  G('gs_charm_gravecoin', 'charm', 'rare', 2, 120, "Grave-Digger's Coin", 'Bones rattle toward it like iron to a magnet.', {},
    [{ id: 'shardFind', pct: 0.5, text: 'Find more Bone Shards.' }]),
  G('gs_charm_thornheart', 'charm', 'rare', 3, 150, 'Thornheart Amulet', 'A heart of black thorns. Hit the wearer and you get pricked.', { def: 1 },
    [{ id: 'thorns', pct: 0.3, text: 'Foes that hit you take a big jab back.' }]),
  G('gs_charm_emberheart', 'charm', 'epic', 3, 330, 'Ember Heart', 'A warm red stone that beats like a drum. You start every fight fired up.', { atk: 1 },
    [{ id: 'furyStart', n: 1, text: 'Start every battle with 1 extra Fury.' }]),
  G('gs_charm_hearthward', 'charm', 'epic', 4, 360, 'Hearth-Ward Talisman', 'A little iron fire-dog. It keeps you warm in ice and cool in flame.', { hp: 8 },
    [{ id: 'resist', elements: ['fire', 'frost'], mult: 0.7, text: 'Fire and frost hurt you less.' }]),
  G('gs_charm_stormbell', 'charm', 'epic', 4, 340, 'Storm-Bell', 'A tiny bell that rings when you block just right, and then you feel the thunder.', {},
    [{ id: 'furyOnBlock', n: 1, text: 'A Perfect block gives 1 Fury.' }]),
  G('gs_charm_moonleech', 'charm', 'epic', 4, 370, 'Moonleech Pendant', 'A silver moth that sips the strength of whatever you hit and gives it to you.', {},
    [{ id: 'lifesteal', pct: 0.15, text: 'Every hit heals you a little.' }]),
  G('gs_charm_secondwind', 'charm', 'legendary', 5, 900, 'Locket of the Second Wind', 'Open it when all seems lost. A gust of morning air pulls you back to your feet.', { hp: 10 },
    [{ id: 'lastStand', pct: 0.4, text: 'Once a battle, the blow that would knock you down leaves you standing.' }]),
];

const C = (id, name, text, price, floor, use, rarity = 'common') => ({ id, name, text, kind: 'consumable', rarity, floor, price, use });

const consumables = [
  C('gs_draught', 'Healing Draught', 'Tastes like mint and old socks. Heals a lot.', 25, 1, { heal: 40 }),
  C('gs_greater_draught', 'Greater Draught', 'Thick, red and fizzy. Heals a hunter all the way.', 70, 3, { heal: 100 }, 'rare'),
  C('gs_fury_tonic', 'Fury Tonic', 'One gulp and your ears steam. Gives 3 Fury.', 45, 1, { fury: 3 }),
  C('gs_cleansing_salt', 'Cleansing Salt', 'Throw a pinch over your shoulder. Poison, curses and frost fall away.', 30, 1, { cleanse: true, heal: 10 }),
  C('gs_fire_bomb', 'Fire Bomb', 'A clay pot full of angry coals. Hits every foe with fire.', 50, 1,
    { dmg: { mult: 1.2, element: 'fire', target: 'all' }, apply: [{ status: 'burn', to: 'foes' }] }),
  C('gs_frost_bomb', 'Frost Bomb', 'A glass ball of winter. Hits every foe with frost and slows them down.', 50, 2,
    { dmg: { mult: 1.0, element: 'frost', target: 'all' }, apply: [{ status: 'chill', to: 'foes' }] }),
  C('gs_smoke_bomb', 'Smoke Bomb', 'Pop. Cough. Where did everybody go? The next attack on each hunter misses.', 40, 1, { smoke: true }),
  C('gs_ember_feather', 'Ember Feather', 'A feather from a fire-bird. Lay it on a fallen hunter and they spring back up.', 90, 2, { revive: 40 }, 'rare'),
];

const material = [
  { id: 'gs_bone_shards', name: 'Bone Shards', text: 'Glowing splinters of old magic. Hilda uses them to make your gear stronger.', kind: 'material', rarity: 'common', floor: 1, price: 2 },
];

const Tr = (boss, name, text, floor) => ({ id: `gs_trophy_${boss.replace(/^gs_/, '')}`, name, text, kind: 'trophy', rarity: 'legendary', floor, price: 0, boss });

const trophies = [
  Tr('gs_rattlejaw', "Rattlejaw's Jawbone", 'The Gatekeeper\'s huge jaw. It still clacks if you tap it.', 1),
  Tr('gs_silkfang', "Silkfang's Crown-Mark", 'A shell plate with the queen\'s crown pattern. It glows faintly in the dark.', 2),
  Tr('gs_brann', "Brann's Hammerhead", 'The head of the Forgemaster\'s hammer. Too hot to touch for a week.', 3),
  Tr('gs_vex', "Vex's Frozen Page", 'A page of ice with words that move when you are not looking.', 4),
  Tr('gs_marrowmaw', "Marrowmaw's Fang", 'A dragon tooth as long as your arm. Green fire still flickers in it.', 5),
];

const items = {};
for (const it of [...weapons, ...armours, ...helms, ...charms, ...consumables, ...material, ...trophies]) items[it.id] = it;

export default items;
