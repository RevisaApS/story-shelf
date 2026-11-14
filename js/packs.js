// The shelf of story games that share one engine (ROUND2 1). A game is a pack.
// main.js imports this registry, offers every pack whose content module imports on the shelf, then builds ctx
// for the chosen one. Text fields are { en, da } and are read with tr() from core/i18n.js.
//
//   content: () => import(...)  default export = the pack's content (English source). A named export
//                               textFields(content, visit) replaces the Lanternfall text walker (ROUND2 2.1).
//   dict.<lang>: () => import(...)  default export = { "English text": "translated text" } (ROUND2 2.2)
//   boot: null = the default flow in main.js; else () => import(...) whose default export is
//         async (ctx) => ({ run(ctx) }) and replaces the flow after ctx is built.
//   gmArt: portrait id the narrator and ui.portrait show for speaker 'gm' (default 'gm').
//   hud: false = main.js does not create Lanternfall's HUD; the pack brings its own.
//   needs: module paths under js/ that must exist before the pack is offered (checked without a request on serve.py).

const packs = {
  lanternfall: {
    id: 'lanternfall', order: 1, theme: 'lf', saveKey: 'lanternfall.save.v1',
    title: { en: 'Lanternfall', da: 'Lygtefald' }, sub: { en: 'The Sleepless Dragon', da: 'Den søvnløse drage' },
    label: {
      ages: { en: 'Ages 4 to 8, with a grown-up', da: 'For de 4-8-årige, sammen med en voksen' },
      tone: { en: 'Calm and gentle. Foes become friends.', da: 'Rolig og blid. Fjender bliver til venner.' },
      play: { en: 'Story, choices, dice and a lullaby. About an hour.', da: 'Historie, valg, terninger og en vuggevise. Cirka en time.' },
    },
    // the line under the subtitle on the pack's own title screen
    tagline: { en: 'A calm tale for ages 4 to 8', da: 'En rolig fortælling for de 4-8-årige' },
    art: 'assets/bg/title.webp',
    needs: ['js/content/index.js'],
    content: () => import('./content/index.js'),
    dict: { da: () => import('./i18n/da/lanternfall/index.js') },
    dictPath: { da: 'js/i18n/da/lanternfall/index.js' },
    boot: null,
  },
  grimspire: {
    id: 'grimspire', order: 2, theme: 'gs', saveKey: 'grimspire.save.v1',
    title: { en: 'Grimspire', da: 'Grumspir' }, sub: { en: 'Crown of the Bone King', da: 'Benkongens krone' },
    label: {
      ages: { en: 'Ages 7 to 12', da: 'For de 7-12-årige' },
      tone: { en: 'Fast battles and scary monsters.', da: 'Hurtige kampe og uhyggelige monstre.' },
      play: { en: 'Timing, aim and piles of loot: weapons, armour, helms and charms.', da: 'Timing, sigte og bunker af bytte: våben, rustninger, hjelme og amuletter.' },
    },
    art: 'assets/bg/gs_title.webp',
    gmArt: 'gs_varg',
    hud: false,
    needs: ['js/grimspire/content/index.js', 'js/grimspire/boot.js'],
    content: () => import('./grimspire/content/index.js'),
    dict: { da: () => import('./i18n/da/grimspire/index.js') },
    dictPath: { da: 'js/i18n/da/grimspire/index.js' },
    boot: () => import('./grimspire/boot.js'),
  },
};

export default packs;
