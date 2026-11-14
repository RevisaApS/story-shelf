// Items: ids fixed by SPEC 5. Prices are the usual price; shops set their own.

const items = {
  // Consumables
  honeycake:     { id: 'honeycake', name: 'Honeycake', kind: 'consumable', price: 3,
    text: 'Sticky, golden, still warm somehow. Heals 6 hearts. Gloops adore them.', use: { heal: 6 } },
  sparkberry:    { id: 'sparkberry', name: 'Sparkberry', kind: 'consumable', price: 4,
    text: 'Fizzes on the tongue. +2 Sparks. Battle only.', use: { sparks: 2, battleOnly: true } },
  moonpetal_tea: { id: 'moonpetal_tea', name: 'Moonpetal Tea', kind: 'consumable', price: 6,
    text: 'A flask of silver tea. Heals the whole party 3 hearts and clears bad effects.', use: { heal: 3, who: 'all', clear: true } },
  flash_lantern: { id: 'flash_lantern', name: 'Flash Lantern', kind: 'consumable', price: 6,
    text: 'One blinding flash. Blinds every foe; those that hate light are stunned too.', use: { blindAll: true, stunIfWeak: 'light', battleOnly: true } },
  lucky_acorn:   { id: 'lucky_acorn', name: 'Lucky Acorn', kind: 'consumable', price: 8,
    text: 'Rub it and wish. +1 Star.', use: { star: 1 } },
  blackberry_pie:{ id: 'blackberry_pie', name: 'Blackberry Pie', kind: 'consumable', price: 6,
    text: "Mother Crumb's prize pie, still warm. Heals 10 hearts, or makes someone very happy.", use: { heal: 10, gift: true } },

  // Trinkets (one per hero)
  brass_compass: { id: 'brass_compass', name: 'Brass Compass', kind: 'trinket', price: 10,
    text: 'Always points somewhere interesting. +1 Wits.', passive: { stat: { wits: 1 } } },
  fox_charm:     { id: 'fox_charm', name: 'Fox Charm', kind: 'trinket', price: 10,
    text: 'A carved fox with a wink. +1 Agility.', passive: { stat: { agility: 1 } } },
  troll_tooth:   { id: 'troll_tooth', name: 'Troll Tooth', kind: 'trinket', price: 8,
    text: "Grumble's spare tooth, on a string. +1 Might.", passive: { stat: { might: 1 } } },
  glow_pendant:  { id: 'glow_pendant', name: 'Glow Pendant', kind: 'trinket', price: 10,
    text: 'Warm to the touch, like a held hand. +1 Heart.', passive: { stat: { heart: 1 } } },
  moth_silk_cloak:{ id: 'moth_silk_cloak', name: 'Moth-Silk Cloak', kind: 'trinket', price: 12,
    text: 'Spun by Glowmoths, light as moonlight. +1 Guard.', passive: { guard: 1 } },
  sturdy_boots:  { id: 'sturdy_boots', name: 'Sturdy Boots', kind: 'trinket', price: 10,
    text: 'Good for marching, stamping and puddles. +3 max hearts.', passive: { maxHp: 3 } },
  goblin_goggles:{ id: 'goblin_goggles', name: 'Goblin Goggles', kind: 'trinket', price: 12,
    text: 'Seventeen lenses, one of them useful. Natural 19s count as 20s.', passive: { critOn: 19 } },

  // Quest items
  tuning_fork:        { id: 'tuning_fork', name: 'Tuning Fork', kind: 'quest',
    text: 'Old silver. It hums when a Songstone is near.' },
  elders_map:         { id: 'elders_map', name: "Elder's Map", kind: 'quest',
    text: 'The Lantern Vale in faded ink, with a thumbprint of jam on the mountain.' },
  songstone_morning:  { id: 'songstone_morning', name: 'Songstone of Morning', kind: 'quest',
    text: 'Warm amber. It sings the first part of the lullaby.' },
  songstone_evening:  { id: 'songstone_evening', name: 'Songstone of Evening', kind: 'quest',
    text: 'Soft rose. It sings the middle of the lullaby.' },
  songstone_midnight: { id: 'songstone_midnight', name: 'Songstone of Midnight', kind: 'quest',
    text: 'Deep sapphire. It sings the end of the lullaby.' },
  brass_feather_key:  { id: 'brass_feather_key', name: 'Brass Feather Key', kind: 'quest',
    text: 'A key shaped like a feather. Glint-made, by the look of it.' },
  golem_eye:          { id: 'golem_eye', name: 'Golem Eye', kind: 'quest', price: 8,
    text: 'A very round crystal. No refunds.' },
  marsh_lily:         { id: 'marsh_lily', name: 'Marsh Lily', kind: 'quest',
    text: 'A white lily that glows faintly. Smells like rain on stone.' },
  dragon_scale:       { id: 'dragon_scale', name: 'Dragon Scale', kind: 'quest',
    text: "One of Solenne's scales, golden-red and warm as a hearth." },
};

export default items;
