// Grimspire story beats (GRIMSPIRE.md 1, 3; schema 5.4). Owner: gs-content-b.
// All of it is SPEC 8.2 steps, run by screens/scene.js: plain string = ('gm', 'warm'), else (as || 'gm', mood || 'warm').
//   intro          the opening over the key art and the camp (skippable)
//   camp.firstVisit the first time the party reaches the Last Hearth: what each place is for
//   camp.fire[i]   Varg's Fire, one talk per visit in order (lore, tips and jokes); after the last, gs-meta repeats
//                  from the start or speaks a camp.rest line
//   ending.smash / ending.forge   after the Hollow Crown falls and the party picks: one last skill challenge, the
//                  Bone King freed and thanking the hunters in his own voice, then dawn. Both branches of the
//                  challenge end the same way (no way to lose the ending).

const KING = (say, mood = 'warm') => ({ say, as: 'gs_boneking', mood });
const CROWN = (say) => ({ say, as: 'gs_crown', mood: 'cold' });
const HILDA = (say) => ({ say, as: 'gs_hilda', mood: 'warm' });

const story = {
  intro: [
    { bg: 'gs_title' },
    { sfx: 'gs.bell' },
    { say: "Hear that? The bell. Every night it rings, and every night the dead climb out of that tower to hunt.", mood: 'ominous' },
    { say: "Sit. Sharpen something. Tonight, you climb up there and stop it.", mood: 'fierce' },
    { say: "That black tower on the cliff is Grimspire. Five floors of bone, web, fire and ice, stacked up into the storm.", mood: 'ominous' },
    { say: "At the very top sits the Bone King. On his skull sits a crown of green fire. While he wears it, the dead will not rest.", mood: 'ominous' },
    { bg: 'gs_camp' },
    { say: "Down here at its foot is the Last Hearth. A fire that never goes out, a forge, a few brave hunters. And me.", mood: 'warm' },
    { say: "I am Varg. One eye, one axe, and more stories than teeth. Most of them true.", mood: 'dry' },
    { say: "The raven on my shoulder is Sod. He steals anything shiny. Hold on to your buttons.", mood: 'funny' },
    { say: "Up there, your hands do the fighting, not your luck. Swing on the mark, block on the ring, and the tower learns to fear you.", mood: 'fierce' },
    { say: "Climb. Fight. Grab the loot. Come back stronger. The bell is ringing, hunters. Up you get.", mood: 'fierce' },
  ],

  camp: {
    firstVisit: [
      { say: "Welcome to the Last Hearth. This is home until the crown falls.", mood: 'warm' },
      { say: "The Tower Gate takes you up. Pick a floor you have opened, and in you go.", mood: 'warm' },
      { say: "Hilda's Forge sells potions and gear, buys your junk, and makes good gear better with Bone Shards.", mood: 'warm' },
      { say: "The Armoury is where you put on what you find. Look for the green arrows. Green means stronger.", mood: 'warm' },
      { say: "And my fire heals you, free. I tell a story too. Also free. You are welcome.", mood: 'dry' },
    ],
    fire: [
      [
        { say: "They say a king built Grimspire to watch over the moor. A good king, once. Kind to his people.", mood: 'hush' },
        { say: "Then a crown came out of the deep rock under the tower. He put it on. He never took it off.", mood: 'ominous' },
      ],
      [
        { say: "A tip. Every monster up there fears something. Fire, frost, storm, shadow or spirit.", mood: 'warm' },
        { say: "Hit it with what it fears and it shouts WEAK POINT. The Trophy Wall remembers, so you never forget.", mood: 'warm' },
      ],
      [
        { say: "You want to know about the eye. Everybody does. I lost it in a staring contest with a dragon.", mood: 'dry' },
        { say: "I won, by the way. The dragon blinked first. I just blinked a bit harder.", mood: 'funny' },
      ],
      [
        { say: "Every boss has one big attack. You see it coming: it winds up, the ring is small.", mood: 'warm' },
        { say: "Block that one perfectly and the big brute wobbles. Stunned for a whole turn. Then you pile in.", mood: 'fierce' },
      ],
      [
        { say: "Something odd. The night I was up there, I heard the Bone King talking. Not to me. To the crown.", mood: 'hush' },
        { say: "He sounded tired. Like a man begging to be let go. I have wondered about it ever since.", mood: 'sad' },
      ],
      [
        { say: "Floors you have cleared fill up with monsters again. Annoying for the moor, lovely for your pockets.", mood: 'warm' },
        { say: "Hunt them again for loot and practice. Then bring Hilda your shards. Plus three gear hits like a cart of rocks.", mood: 'fierce' },
      ],
      [
        { say: "Sod has a stall somewhere up in the tower. A stall of things he found.", mood: 'funny' },
        { say: "Found. In my pockets, mostly. If you see my lucky spoon there, buy it back for me.", mood: 'dry' },
      ],
      [
        { say: "Listen to the bell tonight. It does not sound like iron. It sounds like something hungry, calling.", mood: 'ominous' },
        { say: "I do not think the king rings it. I think the crown does. Keep that in mind when you get to the top.", mood: 'hush' },
      ],
    ],
  },

  ending: {
    smash: [
      { say: "The crown lies on the bones, flickering. Small now. But still whispering.", mood: 'hush' },
      CROWN("Put me on. Just once. You could rule the whole moor. Every bone would bow to you."),
      { say: "Do not listen to it. Lift your weapons, all of you. Hit it with everything you have left.", mood: 'fierce' },
      { skill: { kind: 'mash', stat: 'might', dc: 'medium', label: 'Smash the Hollow Crown',
        crit: [
          { say: "One mighty blow and the crown cracks right down the middle. Green fire shrieks out of it.", mood: 'excited' },
        ],
        success: [
          { say: "Bang, bang, bang! A crack runs through the gold, then another. Green fire shrieks out of it.", mood: 'excited' },
        ],
        fail: [
          { say: "It shrugs off your first blows. So you hit it again, all together, as one. Crack! Green fire shrieks out of it.", mood: 'fierce' },
        ],
      } },
      { sfx: 'gs.bone' },
      { say: "The fire blows away like smoke in the wind. Then, silence. Behind you, bones creak. The Bone King stands.", mood: 'hush' },
      { say: "The green is gone from his eyes. They are just tired now. Tired, and kind.", mood: 'sad' },
      KING("For a hundred years that crown wore me like a cloak. You have set me free, hunters. Thank you."),
      KING("Let me rest now. And let the moor sleep, with the bell quiet at last."),
      { say: "He sits down on his throne and crumbles gently into dust. Peaceful dust, this time.", mood: 'sad' },
      { bg: 'gs_ending' },
      { say: "Far below, the sun comes up over the moor. The tower's green fire goes out. The dead lie still.", mood: 'grand' },
      { say: "You did that. With your own hands. Now come down. Hilda is cooking, and Sod wants to see the loot.", mood: 'warm' },
    ],
    forge: [
      { say: "The crown lies on the bones, flickering. Hilda said fire made it, and fire can unmake it.", mood: 'hush' },
      CROWN("Not the forge. Anything but the forge! Put me on and I will make you a king."),
      { say: "Behind you, bones creak. The Bone King stands. The green is gone from his eyes. They are just tired now.", mood: 'hush' },
      KING("For a hundred years that crown wore me like a cloak. You have set me free, hunters. Thank you."),
      KING("Take it to your smith's fire. What fire made, fire can unmake. Then let me rest."),
      { say: "He sits down on his throne and crumbles gently into dust. Peaceful dust. Now grab that crown and hold on tight.", mood: 'sad' },
      { skill: { kind: 'balance', stat: 'heart', dc: 'medium', label: 'Carry the struggling crown down the tower',
        crit: [
          { say: "It twists and hisses the whole way down five floors. You never even wobble.", mood: 'excited' },
        ],
        success: [
          { say: "It yanks left, it yanks right. You stagger on every stair, but you get it all the way down.", mood: 'excited' },
        ],
        fail: [
          { say: "It jerks out of your grip on the last stair. You dive and catch it by one spike. Got it. Just.", mood: 'fierce' },
        ],
      } },
      { bg: 'gs_camp' },
      HILDA("Give it here. Hammer's hot."),
      { sfx: 'gs.forge' },
      { say: "Clang. Clang. Clang. The crown screams, then whines, then melts into a puddle of plain, quiet gold.", mood: 'excited' },
      HILDA("There. Just gold now. I will make you something nice from it. Something that does not talk."),
      { bg: 'gs_ending' },
      { say: "The sun comes up over the moor. The tower's green fire goes out, and the bell will never ring again.", mood: 'grand' },
    ],
  },
};

export default story;
