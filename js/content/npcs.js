// NPCs. Art by convention: assets/char/<id>.webp, assets/portrait/<id>.webp.
// `voice` is TTS style direction for the Storykeeper doing the voice (Solenne has her own).
// `stage` is how the cutout stands in a scene (js/ui/stage.js): h = height in stage pixels (default 600),
// bottom = feet above the stage bottom (default 30), face = which way the art looks ('left'|'right'|'front';
// a cutout is mirrored so it looks into the scene), edge = 'right' to sit flush against the right edge
// (w = width then), hover = gentle floating bob, fx = a special look ('dragon').

const npcs = {
  gm:            { id: 'gm', name: 'Old Quill', title: 'the Storykeeper',
    stage: { edge: 'right', h: 640, face: 'left' },
    voice: 'A warm, wise, unhurried storyteller by a crackling fire, with a twinkle of mischief.' },
  elder_maren:   { id: 'elder_maren', name: 'Elder Maren', title: 'Elder of Thistlehollow',
    stage: { h: 560, face: 'right' },
    voice: 'A brisk, kind, slightly deaf old woman. Says "eh?" a lot. Quick and sharp.' },
  pip:           { id: 'pip', name: 'Pip', title: 'the Tinker',
    stage: { h: 600, face: 'front' },
    voice: 'A fast-talking, cheerful market seller. Rattles along, honest at heart.' },
  grumble:       { id: 'grumble', name: 'Grumble', title: 'Troll of the Old Stone Bridge',
    stage: { h: 660, face: 'left' },
    voice: 'A slow, rumbling, gruff but soft-hearted troll. Short words, long pauses.' },
  queen_lumina:  { id: 'queen_lumina', name: 'Queen Lumina', title: 'Queen of the Glowmoths',
    stage: { h: 470, bottom: 140, face: 'left', hover: true },
    voice: 'A silvery, regal, playful fairy queen. Proud, quick to laugh.' },
  bogsworth:     { id: 'bogsworth', name: 'Bogsworth', title: 'the Ferryman',
    stage: { h: 540, face: 'left' },
    voice: 'A croaky, drawling, unbothered old frog. Trails off at the end of sentences...' },
  madam_snaggle: { id: 'madam_snaggle', name: 'Madam Snaggle', title: 'Goblin Trader',
    stage: { h: 540, face: 'left' },
    voice: 'A sharp, wheedling, delighted goblin trader. Talks about herself in the third person.' },
  glint:         { id: 'glint', name: 'Glint the Magnificent', title: 'Goblin Tinkerer',
    stage: { h: 520, face: 'left' },
    voice: 'A squeaky, grand, theatrical show-off who is secretly nervous. Never one word when nine will do.' },
  bouldergrin:   { id: 'bouldergrin', name: 'Bouldergrin', title: 'Guardian of the Crystal Cavern',
    stage: { h: 660, face: 'front' },
    voice: 'A very slow, very deep, grinding stone voice. One word at a time.' },
  solenne:       { id: 'solenne', name: 'Solenne', title: 'the Sleeping Dragon',
    stage: { edge: 'right', w: 870, bottom: 112, face: 'left', fx: 'dragon' },
    voice: 'Vast, slow, warm and sleepy, like a mountain speaking.' },
};

export default npcs;
