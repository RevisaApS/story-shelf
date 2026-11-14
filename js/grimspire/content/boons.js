// Grimspire boons (GRIMSPIRE.md 4.7). Owner: gs-content-a.
// At party levels 3, 5, 7 and 8 the party picks one of the two boons with that `level`. A boon applies to
// every hunter. Effect keys (agreed with gs-rules, read by rules.derive and battle-rules):
//   hpPct (+x Health), startFury (+n Fury at battle start), luck (+n Luck), perfectBlockFury (+n Fury on a
//   Perfect block), spd (+n Speed), healAfterWin (heal x of Health after a won battle), bossDmgPct (+x damage
//   to bosses), lastStand (once per battle the first hunter knocked down stands up at x Health).

const boons = {
  gs_boon_toughhide: { id: 'gs_boon_toughhide', level: 3, name: 'Hide of the Bear',
    text: 'Every hunter gets 10% more Health. Harder to knock down.', effect: { hpPct: 0.1 } },
  gs_boon_warmblood: { id: 'gs_boon_warmblood', level: 3, name: 'Fire in the Blood',
    text: 'Every hunter starts each battle with 1 extra Fury. Skills come sooner.', effect: { startFury: 1 } },

  gs_boon_ravenluck: { id: 'gs_boon_ravenluck', level: 5, name: "Sod's Lucky Feather",
    text: '+2 Luck for every hunter: more critical hits and better loot rolls.', effect: { luck: 2 } },
  gs_boon_ironwill: { id: 'gs_boon_ironwill', level: 5, name: 'Shield of Fury',
    text: 'Every Perfect block gives that hunter 1 Fury.', effect: { perfectBlockFury: 1 } },

  gs_boon_wolfspeed: { id: 'gs_boon_wolfspeed', level: 7, name: 'Wolf Feet',
    text: '+2 Speed for every hunter: act sooner and get wider strike windows.', effect: { spd: 2 } },
  gs_boon_secondwind: { id: 'gs_boon_secondwind', level: 7, name: 'Second Wind',
    text: 'After every battle you win, every hunter heals 20% of their Health.', effect: { healAfterWin: 0.2 } },

  gs_boon_kingslayer: { id: 'gs_boon_kingslayer', level: 8, name: 'Kingslayer',
    text: 'Every hunter deals 20% more damage to bosses.', effect: { bossDmgPct: 0.2 } },
  gs_boon_unbroken: { id: 'gs_boon_unbroken', level: 8, name: 'Not Today',
    text: 'Once per battle, the first hunter knocked down jumps back up with 30% Health.', effect: { lastStand: 0.3 } },
};

export default boons;
