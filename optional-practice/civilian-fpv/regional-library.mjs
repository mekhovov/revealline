import { openRegionalLibrary } from './regional-delivery.mjs';
import { validateTerrainSurface } from './regional/terrain-surface.mjs';
import { REGION_CELL_SIZES_MM } from './regional/region-manifest.mjs';

// This immutable source needs the separately qualified 512 m natural-cell capability.
// Older runtimes keep their current catalogue rather than offering an unloadable entry.
export const DESERT_EXPEDITION_LIBRARY_PIN = Object.freeze({
  id: 'desert-expedition-study',
  title: {
    en: 'Desert Expedition — 16 km relief study',
    uk: 'Пустельна експедиція — дослідження рельєфу 16 км',
  },
  description: {
    en: '16.384 × 16.384 km · six landscapes and six starting points · unscored free flight. Explore broad dunes, a dry wash, salt basin, escarpment, mesa corridor and rocky plain. Early terrain study focused on broad relief.',
    uk: '16,384 × 16,384 км · шість ландшафтів і шість стартових точок · вільний політ без заліку. Досліджуйте широкі дюни, сухе русло, соляну улоговину, уступ, прохід між плато та кам’янисту рівнину. Раннє дослідження великих форм рельєфу.',
  },
  bytes: 47883876,
  appearance: { terrain: 'desert' },
  pin: {
    url: 'https://raw.githubusercontent.com/mekhovov/revealline/2ccdf059d9d0d55c6eb7e668da6cee9496288255/authoring/fpv-worlds/regions/desert-expedition/delivery-natural-r1/delivery.json',
    bytes: 327361,
    sha256: '6ecb919762a9d3fac6519ca80600489cab0cb6b3cb3e0804d01d5f7e8791029d',
  },
});

export const DESERT_LANDMARKS_LIBRARY_PIN = Object.freeze({
  id: 'desert-expedition-study',
  title: {
    en: 'Desert Expedition — rock routes',
    uk: 'Пустельна експедиція — маршрути серед скель',
  },
  description: {
    en: '16.384 × 16.384 km · six close-range rock practice areas · unscored free flight. Weave between windstones, pass through a natural arch, climb the escarpment ribs and orbit the mesa crown. Early composition study; the wider terrain remains sparse.',
    uk: '16,384 × 16,384 км · шість невеликих зон для практики серед скель · вільний політ без заліку. Маневруйте між каменями, пролітайте крізь природну арку, піднімайтеся між скельними ребрами й облітайте вершину плато. Раннє дослідження композиції; решта ландшафту ще малонаповнена.',
  },
  bytes: 48164518,
  appearance: { terrain: 'desert' },
  pin: {
    url: 'https://raw.githubusercontent.com/mekhovov/revealline/6cbd5efd0e5138431bdb29023b8eb696765168e7/authoring/fpv-worlds/regions/desert-expedition/delivery-landmarks-r1/delivery.json',
    bytes: 329271,
    sha256: 'fed1f7d18bfe3163cbb52b8b7ecd174a777b89a45ac962c181bd8ca11b727ea7',
  },
});

// Original, reviewed sources are pinned to an immutable published commit.
export const REGIONAL_LIBRARY_PINS = Object.freeze([
  ...(REGION_CELL_SIZES_MM.includes(512000)
    ? [DESERT_LANDMARKS_LIBRARY_PIN, DESERT_EXPEDITION_LIBRARY_PIN]
    : []),
  {
    id: 'tropical-coastal-districts',
    title: {
      en: 'Tropical coast — connected harbour',
      uk: 'Тропічне узбережжя — сполучені пірси гавані',
    },
    description: {
      en: '768 × 768 m · connected wooden harbour decks and shore approach · six starting areas, unscored free flight. Separate harbour-r3 revision; the earlier coastal settlement remains available. Early coastal study; visual water only.',
      uk: '768 × 768 м · сполучені дерев’яні пірси гавані та вихід на берег · шість стартових місць, вільний політ без заліку. Окрема версія harbour-r3; попереднє прибережне поселення залишається доступним. Раннє дослідження узбережжя; вода лише візуальна.',
    },
    bytes: 7952305,
    appearance: { terrain: 'tropical-settlement' },
    pin: {
      url: 'https://raw.githubusercontent.com/mekhovov/revealline/80f161c5709caa7081ff26bb7472fae67fbdb921/authoring/fpv-worlds/regions/tropical-coast/harbour-delivery-r3/delivery.json',
      bytes: 6617,
      sha256: '44aa0de26f4b4aa79fb0ca8f4b6c7d39bdd62debbdc5e4c51a3a12368a0f42ce',
    },
  },
  {
    id: 'railway-valley-expanse',
    title: {
      en: 'Railway Valley — six districts',
      uk: 'Залізнична долина — шість районів',
    },
    description: {
      en: '4.096 × 4.096 km · six starting areas · unscored free flight. Explore a freight hall, viaduct, quarry conveyor, station canopy, foundry and timber yard. Early landscape study with static trains and sparse scenery between districts.',
      uk: '4,096 × 4,096 км · шість місць старту · вільний політ без заліку. Досліджуйте вантажний цех, віадук, конвеєр кар’єру, навіс станції, ливарню й лісовий склад. Раннє дослідження ландшафту зі статичними потягами та невеликою кількістю деталей між районами.',
    },
    bytes: 17943638,
    appearance: { terrain: 'railway' },
    pin: {
      url: 'https://raw.githubusercontent.com/mekhovov/revealline/53c3c5dc25ac0639c93ec663a10beb492844032b/authoring/fpv-worlds/regions/railway-valley/delivery-expanse-r1/delivery.json',
      bytes: 98773,
      sha256: '38bddc6a19c8ba5965992b68ed9b80398cb515dc99de7ce07cac11c9436606c7',
    },
  },
  {
    id: 'coaster-gardens-study',
    title: {
      en: 'Coaster Gardens — connected park study',
      uk: 'Сади атракціонів — дослідження парку зі сполученими доріжками',
    },
    description: {
      en: '2.048 × 2.048 km · six starting points · unscored free flight. Explore the supported loop, linked approach paths, station courts and woodland routes. Early static park study; district scenery is still being refined and rides do not move.',
      uk: '2,048 × 2,048 км · шість стартових точок · вільний політ без заліку. Досліджуйте петлю на опорах, сполучені підходи, площі станцій і лісові маршрути. Ранній варіант парку; оформлення районів ще вдосконалюється, атракціони нерухомі.',
    },
    bytes: 34214390,
    appearance: { terrain: 'plain' },
    pin: {
      url: 'https://raw.githubusercontent.com/mekhovov/revealline/2afed8a0fb8e847e2965424ee2363488cca85e27/authoring/fpv-worlds/regions/coaster-park/delivery-review-r2/delivery.json',
      bytes: 32824,
      sha256: '935a4a4034c206d5bbce77e333f72530812a50c60135117616887a6dac70b53a',
    },
  },
  {
    id: 'coaster-gardens-study',
    title: {
      en: 'Coaster Gardens — 2 km study',
      uk: 'Сади атракціонів — пробний світ 2 км',
    },
    description: {
      en: '2.048 × 2.048 km · six park districts and six starting points · unscored free flight. Explore garden plazas, a looping landmark, station terraces, service halls and woodland paths. Early static park study; rides do not move.',
      uk: '2,048 × 2,048 км · шість паркових районів і шість стартових точок · вільний політ без заліку. Досліджуйте садові площі, петлю атракціону, тераси станції, службові павільйони й лісові доріжки. Ранній варіант парку; атракціони нерухомі.',
    },
    bytes: 33908597,
    appearance: { terrain: 'plain' },
    pin: {
      url: 'https://raw.githubusercontent.com/mekhovov/revealline/3b6edef381a917e7ce0b6a37054fcfc3ee7188cd/authoring/fpv-worlds/regions/coaster-park/delivery-review-r1/delivery.json',
      bytes: 29654,
      sha256: '4800da2f8a06134333fad8def9615a96c94b2fb76f7fb3ef41bfa69b4a9872b5',
    },
  },
  {
    id: 'hillside-town-study',
    title: {
      en: 'Hillside Town — civic court materials',
      uk: 'Містечко на схилі — матеріали міського подвір’я',
    },
    description: {
      en: '384 × 384 m · open market aisle, planted civic courtyard, distinct roofs and four starting points · unscored free flight. A bounded town study with grounded facade materials; the wider terraces remain sparse. The original town version stays available.',
      uk: '384 × 384 м · відкритий ринковий прохід, озеленене міське подвір’я, різні дахи й чотири стартові точки · вільний політ без заліку. Невелике дослідження містечка з виразнішими матеріалами фасадів; дальні тераси ще малодетальні. Початкова версія містечка залишається доступною.',
    },
    bytes: 8660487,
    appearance: { terrain: 'hillside-town' },
    pin: {
      url: 'https://raw.githubusercontent.com/mekhovov/revealline/ce13f7955d30d3f6417458c7f44b01e047d345e5/authoring/fpv-worlds/regions/hillside-town/delivery-courtyard-r5/delivery.json',
      bytes: 6579,
      sha256: 'f6717cb5833932f4ab1be27705802ba0600384e0f4fc2f4d0e2e8f4b06bdf573',
    },
  },
  {
    id: 'hillside-town-study',
    title: {
      en: 'Hillside Town — terraces and courtyards',
      uk: 'Містечко на схилі — тераси та подвір’я',
    },
    description: {
      en: '384 × 384 m · three terraces, graded streets, open doorways and an elevated pad · unscored free flight. Choose one of four starting points. Early town study with original building-kit materials.',
      uk: '384 × 384 м · три тераси, похилі вулиці, відкриті дверні проходи й піднятий майданчик · вільний політ без заліку. Виберіть одну з чотирьох стартових точок. Ранній огляд містечка з оригінальними матеріалами набору будівель.',
    },
    bytes: 8352486,
    appearance: { terrain: 'plain' },
    pin: {
      url: 'https://raw.githubusercontent.com/mekhovov/revealline/0cdeca133c5f0f10a3a0d1c2b8c8a2361ce8b8a1/authoring/fpv-worlds/regions/hillside-town/delivery-town-r2/delivery.json',
      bytes: 6558,
      sha256: 'de1dc4726724bf4851e5976191585e04205f81ba3b83f14442e0c94f18b907d9',
    },
  },
  {
    id: 'tropical-coastal-districts',
    title: {
      en: 'Tropical coast — six flight districts',
      uk: 'Тропічне узбережжя — шість районів польоту',
    },
    description: {
      en: '768 × 768 m · harbour, lagoon piers, reef rocks, palm valley, hillside huts and bamboo grove · unscored free flight. Follow shoreline routes, practise pier openings and explore the village paths. Early coastal study; visual water only.',
      uk: '768 × 768 м · гавань, пірси лагуни, прибережні скелі, пальмова долина, хатини на схилі й бамбуковий гай · вільний політ без заліку. Літайте вздовж берега, крізь отвори пірсів і над стежками поселення. Раннє дослідження узбережжя; вода лише візуальна.',
    },
    bytes: 7857157,
    appearance: { terrain: 'tropical-settlement' },
    pin: {
      url: 'https://raw.githubusercontent.com/mekhovov/revealline/9f7fbbccf00e94c62cb51c9111dbf2b2ec13235c/authoring/fpv-worlds/regions/tropical-coast/settlement-delivery-review-r2/delivery.json',
      bytes: 6609,
      sha256: 'dab4be6dd5b782d38c6c01f510137d048b9646d1f14e80c4dc40c6d848720f49',
    },
  },
  {
    id: 'canyon-expanse-study',
    title: {
      en: 'Canyon Expanse — broad relief study',
      uk: 'Простори каньйону — дослідження рельєфу',
    },
    description: {
      en: '8.192 × 8.192 km · six starting areas · unscored free flight. Broad terrain-only relief with basins, mesas and ridges; an early landscape study with sparse detail.',
      uk: '8,192 × 8,192 км · шість місць старту · вільний політ без заліку. Відкритий рельєф з улоговинами, плато та хребтами; раннє дослідження ландшафту з невеликою кількістю деталей.',
    },
    bytes: 47975524,
    appearance: {
      terrain: 'canyon',
    },
    pin: {
      url: 'https://raw.githubusercontent.com/mekhovov/revealline/e561b41bb06d39775bf1bc5f9e078cabeeb84fef/authoring/fpv-worlds/regions/canyon-badlands/delivery-expanse-r1/delivery.json',
      bytes: 329372,
      sha256: 'd2c3dce6c39227e85a10256fb3d1082fec2a6c7a47f6347fd664e2840eb57003',
    },
  },
  {
    id: 'tropical-coastal-study',
    title: {
      en: 'Tropical coast — bounded flight study',
      uk: 'Тропічне узбережжя — дослідження польоту',
    },
    description: {
      en: '384 × 384 m · two piers, a stilt hut, palms and dunes · unscored free flight. Practise open bays, low passes and a shoreline circuit. Early coastal preview; visual water only.',
      uk: '384 × 384 м · два пірси, хатина на палях, пальми й дюни · вільний політ без заліку. Тренуйте проходи, низький політ та маршрут уздовж берега. Ранній огляд узбережжя; вода лише візуальна.',
    },
    bytes: 5982641,
    appearance: { terrain: 'tropical' },
    pin: {
      url: 'https://raw.githubusercontent.com/mekhovov/revealline/7f2b74dfc186f14c712aa548151bd5baf3eeebf1/authoring/fpv-worlds/regions/tropical-coast/delivery-review-r1/delivery.json',
      bytes: 6602,
      sha256: 'ddd62d4662b873bc97243a414dc4ddc291eeb7e9c084f15af661b449ddcc3443',
    },
  },
  {
    id: 'canyon-arrival-landmarks-study',
    title: {
      en: 'Canyon Badlands — six districts',
      uk: 'Каньйон — шість районів',
    },
    description: {
      en: '768 × 768 m · six districts and six starting points. Explore the basin, mesa, winding gorge, twin buttes, split ravine and sunset shelf in a stylized region for unscored free flight.',
      uk: '768 × 768 м · шість районів і шість стартових точок. Досліджуйте улоговину, плато, звивисту ущелину, парні скелі, роздвоєну балку й терасу у стилізованому регіоні для вільного польоту без заліку.',
    },
    bytes: 3404577,
    appearance: { terrain: 'canyon' },
    pin: {
      url: 'https://raw.githubusercontent.com/mekhovov/revealline/dbfa4cef92866938ce05815ee9beb4830d935647/authoring/fpv-worlds/regions/canyon-badlands/delivery-districts-r1/delivery.json',
      bytes: 24279,
      sha256: 'f69cc4d315c254d5b825e2cfbde21d8509da1c8e3ae2a3e743de95782c5300c8',
    },
  },
  {
    id: 'canyon-arrival-landmarks-study',
    title: {
      en: 'Canyon Badlands — regional preview',
      uk: 'Каньйон — огляд регіону',
    },
    description: {
      en: '384 × 384 m · basin, gorge and rock openings · unscored free flight. A stylized regional preview with twin spires, ridge passages and clear practice routes.',
      uk: '384 × 384 м · улоговина, ущелина та отвори у скелях · вільний політ без заліку. Стилізований огляд регіону з парними шпилями, проходами на хребті й відкритими тренувальними маршрутами.',
    },
    bytes: 1180140,
    appearance: {
      terrain: 'canyon',
    },
    pin: {
      url: 'https://raw.githubusercontent.com/mekhovov/revealline/5591a1ccbc9302665cc2e97c0cc13f96affae4e8/authoring/fpv-worlds/regions/canyon-badlands/delivery-rounded-r1/delivery.json',
      bytes: 6790,
      sha256: '5cd92029c88179e94231b4ec4f799372b075cd187421e9feec3fb6ee2eabf6d0',
    },
  },
  {
    id: 'railway-valley-study',
    title: {
      en: 'Railway Valley — regional preview',
      uk: 'Залізнична долина — огляд регіону',
    },
    description: {
      en: '384 × 384 m · bridge, freight yard and open workshop · unscored free flight. An early regional preview with static trains and clear practice corridors.',
      uk: '384 × 384 м · міст, вантажний двір і відкритий цех · вільний політ без заліку. Ранній огляд регіону зі статичними потягами та відкритими маршрутами для практики.',
    },
    bytes: 5691267,
    appearance: { terrain: 'railway' },
    pin: {
      url: 'https://raw.githubusercontent.com/mekhovov/revealline/31c0b54b668fa004be03f46f7ddcfa195ee734b3/authoring/fpv-worlds/regions/railway-valley/delivery-structure-r1/delivery.json',
      bytes: 6661,
      sha256: '431b2dfb4be228e094174f1ccdd8eb72f906f09eb39a62c31b16e2bfb1239f15',
    },
  },
  {
    id: 'urban-earthworks-study',
    title: {
      en: 'Urban earthworks — regional preview',
      uk: 'Міські земляні споруди — огляд регіону',
    },
    description: {
      en: '384 × 384 m · loading court, open workshop and connected parking ramps · unscored free flight. A regional preview with marked roads, building openings and rooftop passages.',
      uk: '384 × 384 м · вантажний двір, відкритий цех і сполучені пандуси паркінгу · вільний політ без заліку. Огляд регіону з розміченими дорогами, отворами будівель і проходами на дахах.',
    },
    bytes: 2275449,
    appearance: { terrain: 'urban' },
    pin: {
      url: 'https://raw.githubusercontent.com/mekhovov/revealline/622fade3a7a4e70021cab9c509c1116d0378ad2b/authoring/fpv-worlds/regions/urban-bando/delivery-review-r2/delivery.json',
      bytes: 6603,
      sha256: '9a7d157d2d5fd197c632b870bd9b9ebacd62015ad0084605712185064c8ae73a',
    },
  },
]);

/** Resolve presentation only after the installed descriptor and source pair have verified. */
export function applyRegionalAppearance(configuration, identity, pins = REGIONAL_LIBRARY_PINS) {
  const approved = pins.find(
    (row) =>
      row.id === identity?.id &&
      row.id === configuration?.manifest?.id &&
      row.pin.sha256 === identity?.sha256,
  );
  const terrain = approved?.appearance?.terrain ?? 'plain';
  if (
    ![
      'plain',
      'canyon',
      'urban',
      'railway',
      'tropical',
      'tropical-settlement',
      'desert',
      'hillside-town',
    ].includes(terrain)
  )
    throw new TypeError('Unknown trusted regional terrain appearance');
  return {
    ...configuration,
    source: { ...configuration.source, surfaceStyle: terrain },
  };
}

/** Apply the player's selected detail tier when starting/restarting a regional session. */
export function regionalPresentationOptions(configuration, quality) {
  const tiers = { low: 'performance', balanced: 'balanced', high: 'quality' };
  if (!Object.hasOwn(tiers, quality)) throw new TypeError('Unknown regional flight quality');
  const surface = validateTerrainSurface(
    configuration.source?.surfaceStyle ?? 'plain',
    tiers[quality],
  );
  return {
    ...configuration,
    source: {
      ...configuration.source,
      surfaceStyle: surface.style,
      surfaceQuality: surface.quality,
    },
  };
}

/** Bound a transfer by inactivity and total elapsed time, without penalizing steady progress. */
export function regionalOperationDeadline(win, controller, kind) {
  let received = 0,
    idleTimer,
    totalTimer,
    stopped = false;
  const stop = () => {
    stopped = true;
    win.clearTimeout(idleTimer);
    win.clearTimeout(totalTimer);
  };
  const expire = () => {
    stop();
    controller.abort(new DOMException('Regional operation timed out', 'TimeoutError'));
  };
  const renew = () => {
    win.clearTimeout(idleTimer);
    idleTimer = win.setTimeout(expire, 120000);
  };
  renew();
  if (kind === 'install') totalTimer = win.setTimeout(expire, 600000);
  return {
    // Descriptor reads happen twice (inspection, then verified installation).
    // Their chunk activity is independent of the payload's cumulative byte count.
    activity(bytes) {
      if (stopped || controller.signal.aborted || kind !== 'install') return;
      if (Number.isSafeInteger(bytes) && bytes > 0) renew();
    },
    progress(value) {
      if (stopped || controller.signal.aborted || kind !== 'install') return;
      // A commit already owns the atomic transaction. It must report its outcome
      // even if navigation or cancellation arrives while storage is finishing.
      if (value.phase === 'commit') {
        stop();
        return;
      }
      if (Number.isSafeInteger(value.loadedBytes) && value.loadedBytes > received) {
        received = value.loadedBytes;
        renew();
      }
    },
    stop,
  };
}

/** Regional installations stay separate from scored WorldPack courses. */
export function mountRegionalLibrary({
  el,
  txt,
  parent,
  fly,
  window: win = globalThis.window,
  pins = REGIONAL_LIBRARY_PINS,
  openLibrary = openRegionalLibrary,
}) {
  const root = el('section', undefined, 'world-catalogue'),
    heading = el('h2'),
    help = el('p'),
    message = el('p'),
    cards = el('div', undefined, 'world-catalogue-cards'),
    tools = el('div', undefined, 'button-row'),
    refresh = el('button'),
    cancel = el('button'),
    home = el('span');
  root.id = 'regional-world-library';
  heading.id = 'regional-world-library-title';
  root.setAttribute('aria-labelledby', heading.id);
  message.setAttribute('role', 'status');
  home.hidden = true;
  refresh.type = cancel.type = 'button';
  tools.append(refresh, cancel);
  root.append(heading, help, tools, message, cards);
  parent.before(home, root);
  let closed = false,
    operation = null,
    epoch = 0,
    records = [],
    pendingRefresh = false,
    removal = null,
    notice = ['', ''],
    database = null;
  const dbReady = Promise.resolve().then(() => openLibrary({ indexedDB: win.indexedDB }));
  // A missing browser store remains a visible, recoverable state, never an unhandled rejection.
  dbReady.then(
    (value) => {
      database = value;
      if (closed) value.close();
    },
    () => {
      if (!closed)
        show(
          'Device storage is unavailable. Reload the SIM to retry.',
          'Сховище пристрою недоступне. Перезавантажте SIM і повторіть.',
        );
    },
  );
  const visible = () =>
    !closed &&
    !parent.ownerDocument.hidden &&
    !root.closest('[hidden]') &&
    (!root.closest('dialog') || root.closest('dialog').open);
  const title = (value) => txt(value.en, value.uk);
  const size = (bytes) =>
    bytes < 1048576
      ? `${Math.ceil(bytes / 1024)} KiB`
      : `${(bytes / 1048576).toLocaleString(txt('en', 'uk'), { maximumFractionDigits: 1 })} MiB`;
  function show(...copy) {
    notice = copy;
    message.textContent = txt(...copy);
  }
  function action(text, callback, disabled = false) {
    const button = el('button', text);
    button.type = 'button';
    button.disabled = disabled;
    button.onclick = callback;
    return button;
  }
  function waitFor(value, signal) {
    return new Promise((resolve, reject) => {
      const cancel = () => reject(signal.reason);
      signal.addEventListener('abort', cancel, { once: true });
      if (signal.aborted) cancel();
      Promise.resolve(value)
        .then(resolve, reject)
        .finally(() => signal.removeEventListener('abort', cancel));
    });
  }
  function paint() {
    if (closed) return;
    heading.textContent = txt('Regional free flight', 'Вільний політ у регіонах');
    help.textContent = txt(
      'Download a region once, then choose Fly. Regions are unscored practice areas. Save the simulator offline separately; this download saves the scenery.',
      'Завантажте регіон один раз і виберіть «Летіти». Це тренувальні зони без заліку. Симулятор готується офлайн окремо; тут зберігається місцевість.',
    );
    refresh.textContent = txt('Refresh saved regions', 'Оновити збережені регіони');
    cancel.textContent = txt('Cancel', 'Скасувати');
    refresh.disabled = Boolean(operation);
    cancel.hidden = !operation;
    message.textContent = txt(...notice);
    const focused = parent.ownerDocument.activeElement,
      focusKey = focused?.closest?.('[data-region-key]')?.dataset.regionKey,
      focusAction = focused?.dataset.regionAction;
    cards.replaceChildren();
    const offered = new Set(pins.map((row) => row.pin.sha256));
    const rows = [
      ...pins.map((row) => ({
        ...row,
        saved: records.find((saved) => saved.sha256 === row.pin.sha256 && saved.id === row.id),
      })),
      ...records
        .filter((row) => !offered.has(row.sha256))
        .map((saved) => ({
          id: saved.id,
          title: saved.descriptor.title,
          saved,
        })),
    ];
    for (const row of rows) {
      const saved = row.saved,
        hash = saved?.sha256 ?? row.pin.sha256,
        card = el('article', undefined, 'world-catalogue-card'),
        name = saved?.descriptor.title ?? row.title,
        buttons = el('div', undefined, 'button-row');
      card.dataset.regionKey = hash;
      card.append(el('strong', title(name)));
      if (row.description) card.append(el('p', title(row.description)));
      card.append(
        el(
          'p',
          saved
            ? `${txt('Saved for offline flight', 'Збережено для польоту офлайн')} · ${size(saved.bytes)} · ${saved.descriptor.revision}`
            : txt(
                `Optional scenery download${row.bytes ? ` · ${size(row.bytes)}` : ''} · unscored`,
                `Окреме завантаження місцевості${row.bytes ? ` · ${size(row.bytes)}` : ''} · без заліку`,
              ),
        ),
      );
      if (saved) {
        const play = action(txt('Fly', 'Летіти'), () => run('fly', row), Boolean(operation));
        play.dataset.regionAction = 'fly';
        play.setAttribute('aria-label', `${txt('Fly', 'Летіти')}: ${title(name)}`);
        const remove = action(
          txt('Remove this version', 'Вилучити цю версію'),
          () => run('review-remove', row),
          Boolean(operation),
        );
        remove.dataset.regionAction = 'remove';
        buttons.append(play, remove);
        if (records.filter((record) => record.id === row.id).length > 1) {
          const removeAll = action(
            txt('Remove all versions', 'Вилучити всі версії'),
            () => run('review-remove-all', row),
            Boolean(operation),
          );
          removeAll.dataset.regionAction = 'remove-all';
          buttons.append(removeAll);
        }
      } else {
        const download = action(
          txt('Download region', 'Завантажити регіон'),
          () => run('install', row),
          Boolean(operation),
        );
        download.dataset.regionAction = 'install';
        download.setAttribute('aria-label', `${txt('Download', 'Завантажити')}: ${title(name)}`);
        buttons.append(download);
      }
      card.append(buttons);
      if (removal?.id === row.id && removal.viewHash === hash) {
        card.append(
          el(
            'p',
            removal.scope === 'revision'
              ? txt(
                  `Remove version ${removal.revision} (${size(removal.bytes)})? Other saved versions and saved places are kept. This version must be downloaded again before a new flight.`,
                  `Вилучити версію ${removal.revision} (${size(removal.bytes)})? Інші збережені версії та місця залишаться. Для нового польоту цю версію потрібно буде завантажити знову.`,
                )
              : txt(
                  `Remove all ${removal.revisions.length} saved revision(s) of this region (${size(removal.bytes)})? You can download available revisions again.`,
                  `Вилучити всі збережені версії цього регіону (${removal.revisions.length}; ${size(removal.bytes)})? Доступні версії можна завантажити знову.`,
                ),
          ),
        );
        const confirm = action(
          removal.scope === 'revision'
            ? txt('Remove this download', 'Вилучити це завантаження')
            : txt('Remove these downloads', 'Вилучити ці завантаження'),
          () => run('remove', row),
          Boolean(operation),
        );
        confirm.dataset.regionAction = 'confirm-remove';
        card.append(
          confirm,
          action(
            txt('Keep region', 'Залишити регіон'),
            () => {
              removal = null;
              paint();
            },
            Boolean(operation),
          ),
        );
      }
      cards.append(card);
      if (focusKey === hash)
        (
          card.querySelector(`[data-region-action="${focusAction}"]`) ??
          card.querySelector('button')
        )?.focus();
    }
    if (!rows.length)
      cards.append(
        el(
          'p',
          txt(
            'No regional downloads are available in this version yet.',
            'У цій версії ще немає доступних регіонів.',
          ),
        ),
      );
  }
  async function run(kind, row = null) {
    if (closed || operation) return;
    const controller = new AbortController(),
      signal = controller.signal,
      requestEpoch = epoch;
    const doc = parent.ownerDocument;
    let restoreFocus = Boolean(row);
    const trackFocus = (event) => {
      if (event.target !== doc.body && !root.contains(event.target)) restoreFocus = false;
    };
    doc.addEventListener('focusin', trackFocus);
    operation = controller;
    if (kind === 'refresh') show('', '');
    paint();
    const deadline = regionalOperationDeadline(win, controller, kind);
    let committed = false;
    try {
      const store = await waitFor(dbReady, signal);
      signal.throwIfAborted();
      if (kind === 'install') {
        show('Checking regional download…', 'Перевірка завантаження регіону…');
        const options = {
          pageURL: win.location.href,
          signal,
          onActivity: deadline.activity,
          onProgress(value) {
            deadline.progress(value);
            if (closed || requestEpoch !== epoch) return;
            if (value.phase === 'commit') {
              cancel.disabled = true;
              show('Saving verified region…', 'Збереження перевіреного регіону…');
            } else
              show(
                `Preparing region: ${size(value.loadedBytes)} / ${size(value.totalBytes)}`,
                `Підготовка регіону: ${size(value.loadedBytes)} / ${size(value.totalBytes)}`,
              );
          },
        };
        const inspected = await store.inspect(row.pin, options);
        if (inspected.descriptor.id !== row.id)
          throw new Error('Regional catalogue identity mismatch');
        signal.throwIfAborted();
        await store.install(row.pin, options);
        committed = true;
        records = await store.list({ includeRevisions: true });
        show(
          'Region saved. Choose Fly when you are ready.',
          'Регіон збережено. Виберіть «Летіти», коли будете готові.',
        );
      } else if (kind === 'fly') {
        show('Checking saved scenery…', 'Перевірка збереженої місцевості…');
        const configuration = await waitFor(
          store.load(row.id, { sha256: row.saved.sha256, signal }),
          signal,
        );
        signal.throwIfAborted();
        if (requestEpoch === epoch && visible())
          await fly(applyRegionalAppearance(configuration, row.saved, pins), row.saved, {
            isCurrent: () => requestEpoch === epoch && visible() && !signal.aborted,
          });
      } else if (kind === 'review-remove' || kind === 'review-remove-all') {
        const scope = kind === 'review-remove' ? 'revision' : 'all';
        const reviewed = await waitFor(
          store.removalSnapshot(row.id, scope === 'revision' ? { sha256: row.saved.sha256 } : {}),
          signal,
        );
        if (!reviewed) throw new Error('Regional revision is no longer installed');
        removal = { ...reviewed, scope, viewHash: row.saved.sha256 };
        signal.throwIfAborted();
      } else if (kind === 'remove') {
        if (!removal || removal.id !== row.id || removal.viewHash !== row.saved.sha256)
          throw new Error('Review removal again');
        cancel.disabled = true;
        const scope = removal.scope;
        if (scope === 'revision')
          await store.removeRevision(row.id, removal.sha256, {
            expectedGeneration: removal.generation,
          });
        else
          await store.remove(row.id, {
            expectedGeneration: removal.generation,
          });
        committed = true;
        removal = null;
        records = await waitFor(store.list({ includeRevisions: true }), signal);
        show(
          scope === 'revision'
            ? 'Saved version removed. Other versions and saved places are kept.'
            : 'Saved region removed.',
          scope === 'revision'
            ? 'Збережену версію вилучено. Інші версії та збережені місця залишилися.'
            : 'Збережений регіон вилучено.',
        );
      } else {
        records = await waitFor(store.list({ includeRevisions: true }), signal);
        removal = null;
      }
    } catch {
      if (kind === 'remove') removal = null;
      if (!closed && requestEpoch === epoch) {
        if (committed)
          show(
            'Saved changes are retained. Refresh saved regions.',
            'Зміни збережено. Оновіть список регіонів.',
          );
        else if (signal.reason?.name === 'TimeoutError')
          show(
            'This action took too long or stopped making progress. Existing downloads are retained. Please retry.',
            'Дія тривала надто довго або зупинилася. Наявні завантаження збережено. Повторіть спробу.',
          );
        else if (signal.aborted)
          show(
            'Cancelled. Existing downloads are retained.',
            'Скасовано. Наявні завантаження збережено.',
          );
        else
          show(
            'Could not complete this action. Existing downloads are retained; refresh and retry.',
            'Не вдалося виконати дію. Наявні завантаження збережено; оновіть список і повторіть.',
          );
      }
    } finally {
      deadline.stop();
      operation = null;
      cancel.disabled = false;
      doc.removeEventListener('focusin', trackFocus);
      if (!closed) {
        paint();
        if (restoreFocus && requestEpoch === epoch && visible()) {
          const hash = row.saved?.sha256 ?? row.pin?.sha256;
          const card = [...cards.children].find((item) => item.dataset.regionKey === hash);
          (
            card?.querySelector(
              kind.startsWith('review-remove') ? '[data-region-action="confirm-remove"]' : 'button',
            ) ?? refresh
          ).focus();
        }
        if (pendingRefresh && visible()) {
          pendingRefresh = false;
          void run('refresh');
        }
      }
    }
  }
  refresh.onclick = () => run('refresh');
  cancel.onclick = () => {
    if (!cancel.disabled) operation?.abort();
  };
  paint();
  return {
    open(container = null) {
      if (closed) return;
      if (container) container.append(root);
      else home.after(root);
      if (operation) pendingRefresh = true;
      else void run('refresh');
    },
    deactivate(container = null) {
      if (container && !container.contains(root)) return;
      epoch++;
      pendingRefresh = false;
      removal = null;
      operation?.abort();
    },
    refresh() {
      paint();
    },
    dispose() {
      closed = true;
      epoch++;
      operation?.abort();
      database?.close();
      home.remove();
      root.remove();
    },
  };
}
