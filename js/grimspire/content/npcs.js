// Grimspire cast (GRIMSPIRE.md section 2). `voice` is an English TTS direction and is never translated.
// Speakers: 'gm' is Varg and performs every voice except the Bone King's. 'gs_boneking' and 'gs_crown'
// are both performed by the Bone King's own voice (tools/voice-build.mjs maps them).

const npcs = {
  gm: { id: 'gm', name: 'Varg', title: 'the Battle-Skald',
    voice: 'A gravel-voiced, intense old battle storyteller who loves a good fight, with dry humour and warmth underneath' },
  gs_hilda: { id: 'gs_hilda', name: 'Hilda Emberhand', title: 'Smith of the Last Hearth',
    voice: 'A booming, blunt, cheerful blacksmith who speaks in short sentences' },
  gs_sod: { id: 'gs_sod', name: 'Sod', title: "Varg's raven",
    voice: 'A croaky, greedy, sly raven voice, quick and pleased with itself' },
  gs_boneking: { id: 'gs_boneking', name: 'The Bone King', title: 'Lord of Grimspire',
    voice: 'Cold, hollow and regal, slow and deep, an ancient king speaking from inside an iron helm' },
  gs_crown: { id: 'gs_crown', name: 'The Hollow Crown', title: 'The true master of the tower',
    voice: 'A whispering, hungry, many-layered hiss, as if many voices speak at once, scary but right for children' },
};

// Sod's stall of found things (event f3_e2, { shop: 'sod' }). greeting and bye are spoken as ('gs_sod', 'funny').
export const shops = {
  sod: { id: 'sod', keeper: 'gs_sod',
    greeting: [
      "Shiny things! Found things! Sod found them all by himself.",
      "Welcome, welcome. Touch nothing. Buy everything.",
      "Sod has bargains. Sod has secrets. Sod has a spoon. Not for sale.",
      "Hunters! Sod's favourite customers. Sod's only customers.",
    ],
    stock: [
      { item: 'gs_draught', price: 20 },
      { item: 'gs_fury_tonic', price: 40 },
      { item: 'gs_smoke_bomb', price: 35 },
      { item: 'gs_frost_bomb', price: 45 },
      { item: 'gs_ember_feather', price: 80 },
      { item: 'gs_charm_gravecoin', price: 110 },
      { item: 'gs_helm_wolfskull', price: 120 },
      { item: 'gs_charm_owleye', price: 130 },
    ],
    bye: [
      "Come back with more gold. Sod will wait. Sod is very patient.",
      "Bye, bye! Shiny luck to you.",
      "Go, go. Sod has counting to do.",
      "Off you hop. Mind the shiny traps. Sod set none of them.",
    ] },
};

export default npcs;
