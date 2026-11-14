// Shops. greeting/bye lines are spoken by the keeper.

const shops = {
  pip_cart: {
    id: 'pip_cart', keeper: 'pip',
    greeting: [
      "Roll up, roll up! Pip's Oddments: if I haven't got it, you don't need it, and if you need it, I've probably got it!",
      "Customers! Real ones! Have a look, have a poke, mind the stuffed owl. It bites. Probably.",
      "Welcome back, friends! Everything's half price. Well. Some price. Have a look!",
    ],
    stock: [
      { item: 'honeycake', price: 3, qty: 5 },
      { item: 'sparkberry', price: 4, qty: 4 },
      { item: 'flash_lantern', price: 6, qty: 2 },
      { item: 'lucky_acorn', price: 8, qty: 1 },
      { item: 'brass_compass', price: 10, qty: 1 },
      { item: 'sturdy_boots', price: 10, qty: 1 },
    ],
    bye: [
      "Pleasure doing business! Tell your friends! Tell your enemies, even, their coin spends the same!",
      "Off you go, heroes. Come back alive, I've got stock to shift!",
      "Mind how you go. And mind the mountain!",
    ],
  },

  snaggle_stall: {
    id: 'snaggle_stall', keeper: 'madam_snaggle',
    greeting: [
      "Ooh, big folk with big pockets! Come in, come in, Madam Snaggle has everything, and everything has a price!",
      "Back again, my little gold mines? Snaggle's missed you. Snaggle's missed your coins even more.",
      "Look, don't touch. Touch, you buy. Buy, Snaggle smiles. Snaggle has lovely teeth, see?",
    ],
    stock: [
      { item: 'honeycake', price: 4, qty: 4 },
      { item: 'moonpetal_tea', price: 6, qty: 3 },
      { item: 'sparkberry', price: 4, qty: 4 },
      { item: 'flash_lantern', price: 6, qty: 2 },
      { item: 'golem_eye', price: 8, qty: 1 },
      { item: 'fox_charm', price: 10, qty: 1 },
      { item: 'glow_pendant', price: 10, qty: 1 },
      { item: 'goblin_goggles', price: 12, qty: 1 },
    ],
    bye: [
      "Pleasure, pleasure! No refunds, no returns, no complaints, no exceptions!",
      "Go on then. Snaggle will be here. Snaggle is always here.",
      "Mind your purses on the way out, dearies. Not everyone is as honest as Snaggle. Heh.",
    ],
  },
};

export default shops;
