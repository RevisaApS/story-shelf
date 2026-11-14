// The dev adventure (?content=dev): small, self-contained, and it uses every step type in SPEC 8.2,
// a hub, and a check with all five outcomes. Used by tools/playtest.cjs and when js/content/index.js is missing.
const perks = (a, b) => ({
  2: [{ id: `${a}_p2a`, name: 'Steady Hands', text: '+1 Wits', effect: { stat: { wits: 1 } } }, { id: `${a}_p2b`, name: 'Tough Hide', text: '+3 max hearts', effect: { maxHp: 3 } }],
  3: [{ id: `${b}_p3a`, name: 'Bright Eyes', text: '+1 Guard', effect: { guard: 1 } }, { id: `${b}_p3b`, name: 'Big Heart', text: '+1 Heart', effect: { stat: { heart: 1 } } }],
});
import { ARCH } from '../../core/rules.js';

const POWER = {
  knight: { id: 'shield_bash', name: 'Shield Bash', target: 'foe', fx: 'bash', tags: [] },
  wizard: { id: 'star_bolt', name: 'Star Bolt', target: 'foe', fx: 'starbolt', tags: ['light'] },
  ranger: { id: 'biscuit_go', name: 'Biscuit, Go!', target: 'foe', fx: 'fox', tags: [] },
  trickster: { id: 'smoke_puff', name: 'Smoke Puff', target: 'allFoes', fx: 'smoke', tags: [] },
  bard: { id: 'rousing_tune', name: 'Rousing Tune', target: 'allAllies', fx: 'song', tags: ['song'] },
  mender: { id: 'mending_light', name: 'Mending Light', target: 'ally', fx: 'heal', tags: ['light'] },
};
const hero = (arch, name, calling, talent, talentName) => {
  const a = ARCH[arch];
  return {
    arch, name, calling, blurb: `A ${calling.toLowerCase()} for testing.`, talent: { id: talent, name: talentName, text: 'Plus 3 on rolls that fit.' },
    stats: { ...a.stats }, hp: a.hp, guard: a.guard, attackStat: a.attackStat,
    strike: { name: a.strike.name, die: a.strike.die, fx: 'strike', lines: { hit: ['A solid hit.'], miss: ['A near miss.'], crit: ['A mighty blow!'] } },
    powers: [{ ...POWER[arch], text: 'A test power.', cost: 2, lines: { use: ['Here it comes.'], hit: ['It lands.'], miss: ['It fizzles.'] } }],
    perks: perks(arch, arch), intro: `A ${calling.toLowerCase()} joins the table.`,
  };
};

const heroes = {
  knight: hero('knight', 'Rowan Shieldheart', 'Knight', 'stand_firm', 'Stand Firm'),
  wizard: hero('wizard', 'Nim Starcaller', 'Wizard', 'read_runes', 'Read Runes'),
  ranger: hero('ranger', 'Fenn Wildstrider', 'Ranger', 'animal_friend', 'Animal Friend'),
  trickster: hero('trickster', 'Zia Quickfingers', 'Trickster', 'nimble_fingers', 'Nimble Fingers'),
  bard: hero('bard', 'Lark Songweaver', 'Bard', 'silver_tongue', 'Silver Tongue'),
  mender: hero('mender', 'Moss Greenmender', 'Mender', 'herb_lore', 'Herb Lore'),
};

const enemies = {
  thornling: { id: 'thornling', name: 'Thornling', plural: 'Thornlings', art: 'thornling', hp: 7, guard: 10, toHit: 2, resolve: 6, befriend: { dc: 9, verb: 'Befriend' }, likes: ['song'], weak: ['light'],
    moves: [{ id: 'slap', name: 'Thorn Slap', weight: 2, target: 'random', damage: '1d4', lines: { intent: ['A thornling bristles at you.'], hit: ['Prickle!'], miss: ['It misses.'] } }],
    lines: { enter: ['Bramble sprites tumble out of the hedge.'], hurt: ['It squeaks.'], flee: ['It rolls away.'], befriended: ['It purrs like a pinecone.'], weakHint: ['They flinch from bright light.'] } },
};
const encounters = { dev_ambush: { id: 'dev_ambush', title: 'Thornling Tumble', music: 'battle', foes: [{ type: 'thornling', min: 1 }, { type: 'thornling', min: 3 }], intro: ['Something rustles.'], canBefriend: true } };

const items = {
  honeycake: { id: 'honeycake', name: 'Honeycake', text: 'Sticky, golden, heals 6 hearts.', kind: 'consumable', price: 3, use: { heal: 6 } },
  lucky_acorn: { id: 'lucky_acorn', name: 'Lucky Acorn', text: 'Crack it open for a Star.', kind: 'consumable', price: 5, use: { stars: 1 } },
  brass_compass: { id: 'brass_compass', name: 'Brass Compass', text: 'Always points somewhere interesting. +1 Wits.', kind: 'trinket', price: 8, passive: { stat: { wits: 1 } } },
  tuning_fork: { id: 'tuning_fork', name: 'Tuning Fork', text: 'It hums near a Songstone.', kind: 'quest' },
  songstone_morning: { id: 'songstone_morning', name: 'Songstone of Morning', text: 'Warm amber, humming softly.', kind: 'quest' },
};
const npcs = {
  gm: { id: 'gm', name: 'Old Quill', title: 'the Storykeeper', voice: 'warm storyteller' },
  pip: { id: 'pip', name: 'Pip the Tinker', title: 'Travelling seller', voice: 'fast and cheerful' },
  elder_maren: { id: 'elder_maren', name: 'Elder Maren', title: 'Elder of Thistlehollow', voice: 'brisk and kind' },
};
const shops = { dev_cart: { id: 'dev_cart', keeper: 'pip', greeting: ['Step up, step up! Everything shiny, most things useful!'], stock: [{ item: 'honeycake', price: 3, qty: 5 }, { item: 'lucky_acorn', price: 5, qty: 2 }, { item: 'brass_compass', price: 8, qty: 1 }], bye: ['Come back when your pockets jingle!'] } };

const L = (...a) => a;
const gmLines = {
  'roll.ask': L('Here is the die. Give it a good throw.', 'Roll it. Let us see what fate says.'),
  'roll.crit': L('A twenty! The whole table cheers!', 'Now that is how legends start.'),
  'roll.success': L('Well done. It works.', 'Yes! Exactly like that.'),
  'roll.partial': L('So close. It half works.', 'Nearly. The story bends a little.'),
  'roll.fail': L('Not this time. But the story goes on.', 'Ah. That did not go to plan.'),
  'roll.fumble': L('A one! Oh dear. Oh, that is wonderful.', 'Everybody saw that. Everybody.'),
  'star.award': L('Take a Star. You earned it.'),
  'star.spend': L('A Star flares. Roll again.'),
  'reroll.offer': L('You could spend a Star and try again.'),
  'teach.check': L('This is a roll. Higher is better. The die decides, and I just tell the truth about it.'),
  'teach.battle': L('A battle! Take turns. Pick what your hero does, then watch it happen.'),
  'teach.star': L('Stars are for brave, kind or clever moments. Spend one to roll again.'),
  'teach.item': L('Things you find go in your bag. Look in my book to use them.'),
  'mercy.check': L('Let me make this one a little easier.'),
  'mercy.battle': L('Catch your breath, heroes. A second wind.'),
  'mercy.rewind': L('Hm. Let me turn the page back a little.'),
  'idle.nudge': L('Take your time. Whenever you are ready.'),
  'welcome.back': L('Ah, you are back. Where were we?'),
  'travel.go': L('Off you go, along the winding path.'),
  'rest.intro': L('Time to rest by the fire.'),
  'levelup.intro': L('You feel stronger. Something new is waking in you.'),
};

const map = { nodes: [{ id: 'dev_village', label: 'Thistlehollow', x: 200, y: 640 }, { id: 'dev_wood', label: 'Whisperwood', x: 420, y: 470 }], path: ['dev_village', 'dev_wood'] };
const prologue = { panels: [{ art: 'prologue_1', lines: ['Long ago, a dragon curled up under the mountain.'] }] };

const checkAll = (label) => ({ check: { stat: 'agility', dc: 'medium', label,
  success: ['You land it. Clean and quick.'],
  crit: [{ say: 'You land it with a flip, and the crowd goes wild!', mood: 'excited' }, { star: 1, why: 'For style' }],
  partial: [{ say: 'You land it, mostly. Your hat does not.', mood: 'funny' }, { set: { lost_hat: true } }],
  fail: [{ say: 'You wobble and sit down hard. Nobody saw. Probably.', mood: 'funny' }, { hurt: 1 }],
  fumble: [{ say: 'You trip over absolutely nothing and roll into a hay cart.', mood: 'funny' }, { set: { hay_hair: true } }],
} });

const scenes = {
  dev_start: {
    id: 'dev_start', title: 'Thistlehollow', subtitle: 'A test of every step', bg: 'village_square', music: 'village', ambience: 'festival', weather: 'lanterns',
    steps: [
      { card: { kicker: 'Dev', title: 'Every Step', sub: 'A tiny test adventure' } },
      'Ah. There you are. Pull up a chair. Mind the dragon, he is only wax.',
      { say: 'Thistlehollow glows tonight. A hundred paper lanterns sway over the square.', mood: 'warm' },
      { sfx: 'whoosh' },
      { fx: 'shake' },
      { say: 'And is that... snow? In the middle of summer?', mood: 'hush' },
      { show: 'elder_maren', at: 'right' },
      { say: 'You there! Yes, you. Come closer, my ears are older than the mountain.', as: 'elder_maren', mood: 'warm' },
      { quest: { id: 'dev_quest', title: 'Test everything', text: 'Try every kind of step.' } },
      { give: 'tuning_fork' },
      { gold: 10 },
      { journal: 'The heroes met the Elder and took the tuning fork.' },
      { hide: 'elder_maren' },
      { choice: { prompt: 'A lantern blows away! What do you do?', options: [
        { label: 'Leap and catch it', stat: 'agility', hint: 'Quick feet', steps: [checkAll('Catch the runaway lantern')] },
        { label: 'Call it down kindly', stat: 'heart', once: true, steps: [{ say: 'You call softly, and the lantern drifts back, as if it heard you.' }, { star: 1, why: 'For kindness' }, { again: true }] },
        { label: 'Read the wind', stat: 'wits', requires: { not: 'never_set' }, steps: [{ check: { stat: 'wits', dc: 'easy', label: 'Read the wind', who: 'each', success: ['Everyone points the same way. There!'], fail: ['Everyone points a different way. Oops.'] } }] },
        { label: 'Send Biscuit to fetch it', talent: 'animal_friend', steps: ['A streak of orange shoots off, and comes back with the lantern string in his teeth.', { star: 1, why: 'Good fox' }] },
        { label: 'Hold the crowd back', talent: 'stand_firm', steps: ['You plant your feet and hold out your arms. The crowd stops. The lantern lands at your boots.'] },
      ] } },
      { set: { lantern_saved: true } },
      { add: { lanterns: 1 } },
      { if: { count: ['lanterns', 1] }, then: ['One lantern saved. Good start.'], else: ['No lanterns yet.'] },
      { hub: { id: 'square', prompt: 'The square is yours to explore. Where do you go?', spots: [
        { id: 'cart', label: "Pip's cart", icon: 'shop', x: 1080, y: 400, steps: [{ show: 'pip', at: 'right' }, { shop: 'dev_cart' }, { hide: 'pip' }] },
        { id: 'well', label: 'The old well', icon: 'well', x: 540, y: 430, once: true, steps: [checkAll('Fish out the wooden duck'), { star: 1, why: 'For helping' }] },
        { id: 'board', label: 'Notice board', icon: 'scroll', x: 210, y: 360, steps: ['A child has drawn three singing stones. MISSING, it says, in wobbly letters.', { table: { text: 'Everyone at the table: hum one note together, as loud as you dare!', done: 'We hummed!', star: 1 } }] },
        { id: 'secret', label: 'A glint of gold', icon: 'gem', x: 860, y: 300, requires: 'lantern_saved', once: true, steps: [{ actor: 'best:wits' }, 'You spot something shiny under the pie stall.', { gold: 3 }, { star: -1, why: 'A Star wobbles away' }] },
      ], leave: { label: 'Follow the mountain road', requires: { has: 'tuning_fork' }, lockedHint: 'You need the tuning fork first.', steps: ['The road winds up toward the dark trees.'] } } },
      { travel: 'dev_wood' },
      { goto: 'dev_wood' },
    ],
  },
  dev_wood: {
    id: 'dev_wood', title: 'The Whisperwood', subtitle: 'Where the trees gossip', bg: 'whisperwood', music: 'forest', ambience: 'forest', weather: 'fireflies',
    steps: [
      { weather: 'fireflies' },
      { ambience: 'forest' },
      { music: 'forest' },
      { say: 'The trees lean in to listen. Somewhere, a twig snaps.', mood: 'ominous' },
      { fx: 'dim' },
      { wait: 400 },
      { fx: 'undim' },
      { combat: 'dev_ambush', win: ['The thornlings scatter into the brambles.'], befriend: ['The thornlings purr and promise to poke anything that bothers you.', { set: { thorn_friends: true } }] },
      { challenge: { title: 'Cross the stream', intro: ['The stream is fast. Everyone must help.'], need: 2, allow: 2,
        turns: [{ label: 'Leap the stones', stat: 'agility', dc: 'easy', win: 'Hop, hop, across!', lose: 'Splash!' }, { label: 'Hold the rope', stat: 'might', dc: 'easy', win: 'The rope holds.', lose: 'The rope slips.' }],
        success: ['Everyone makes it across, mostly dry.'], fail: [{ say: 'Everyone makes it across, very wet.', mood: 'funny' }, { hurt: 1, who: 'all' }] } },
      { puzzle: 'runes', success: ['The runes glow and the stone rolls aside.'], fail: ['The stone stays shut, but there is a gap you can squeeze through.'] },
      { puzzle: 'melody', mode: 'learn', phrase: 1, success: [{ give: 'songstone_morning' }], fail: ['The tune slips away, but the stone hums anyway.', { give: 'songstone_morning' }] },
      { take: 'tuning_fork' },
      { heal: 2, who: 'actor' },
      { rest: true },
      { levelup: 2 },
      { questDone: 'dev_quest' },
      { actor: 'spotlight' },
      { say: 'And that is every step. You did wonderfully.', mood: 'grand' },
      { end: true },
    ],
  },
};

export default { heroes, enemies, encounters, items, shops, npcs, gmLines, map, prologue, scenes, startScene: 'dev_start' };
