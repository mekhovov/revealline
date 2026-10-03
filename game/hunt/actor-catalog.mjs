/** Shared identities, not a grant of gameplay capability. Native engines must
 * accept a versioned policy before an actor can enter an attempt. */
export const ACTOR_CATALOG_VERSION = 'humanoid-actors.v1';
export const ACTOR_ART_BUDGET = Object.freeze({ decodedBytes: 32 * 1024 * 1024, sharedBoards: 2 });
const freeze = (value) => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};

export const ACTOR_CASTS = freeze([
  { id: 'tactical', name: { en: 'Tactical', uk: 'Тактичні' }, accessory: 'field-kit' },
  { id: 'rivals', name: { en: 'Rival crews', uk: 'Команди суперників' }, accessory: 'crew-jacket' },
  { id: 'arcade', name: { en: 'Arcade', uk: 'Аркадні' }, accessory: 'oversized-gloves' },
]);
export const ACTOR_STATES = Object.freeze([
  'idle',
  'walk',
  'notice',
  'flee',
  'warning',
  'burst',
  'recover',
  'blocked',
  'caught',
]);

const descriptions = [
  [
    'lookout',
    'Lookout',
    'Спостерігач',
    'binoculars',
    false,
    ['Watches a post.', 'Спостерігає за постом.'],
    ['Binoculars rise while the lookout scans.', 'Під час огляду піднімає бінокль.'],
    [
      'Approach directly. This introductory target does not flee.',
      'Наближайтеся прямо. Ця навчальна ціль не тікає.',
    ],
  ],
  [
    'patroller',
    'Patroller',
    'Патрульний',
    'cap',
    false,
    ['Completes a circuit or shuttle route.', 'Проходить коло або маршрут туди й назад.'],
    [
      'A cap, measured steps and a direction arrow identify the route.',
      'Кашкет, рівні кроки та стрілка показують напрямок маршруту.',
    ],
    [
      'Intercept a crossing; a blocked patrol waits.',
      'Перехопіть на перетині; заблокований патруль чекає.',
    ],
  ],
  [
    'runner',
    'Runner',
    'Бігун',
    'light-jacket',
    false,
    ['Seeks space away from nearby players.', 'Шукає простір подалі від гравців.'],
    [
      'Looks back, then commits to a short escape.',
      'Озирається, потім виконує короткий ривок утечі.',
    ],
    [
      'Cut off the next opening instead of following directly.',
      'Перекрийте наступний вихід замість переслідування слідом.',
    ],
  ],
  [
    'sprinter',
    'Sprinter',
    'Спринтер',
    'headband',
    false,
    ['Reaches an open straight for a burst.', 'Шукає пряму ділянку для ривка.'],
    [
      'A headband and crouched warning precede the dash; breathing marks recovery.',
      'Пов’язка та присідання попереджають про ривок; важке дихання означає відпочинок.',
    ],
    [
      'Predict the straight dash and catch the recovery.',
      'Передбачте прямий ривок і перехопіть під час відпочинку.',
    ],
  ],
  [
    'courier',
    'Courier',
    'Кур’єр',
    'satchel',
    false,
    [
      'Visits delivery checkpoints for an optional reward.',
      'Відвідує пункти доставки заради необов’язкової нагороди.',
    ],
    [
      'A bouncing satchel and parcel symbol distinguish the bonus target.',
      'Сумка та символ пакунка позначають бонусну ціль.',
    ],
    [
      'Choose a safe interception; ordinary completion does not require the courier.',
      'Оберіть безпечне перехоплення; кур’єр не потрібен для звичайного завершення.',
    ],
  ],
  [
    'guard',
    'Guard',
    'Охоронець',
    'helmet',
    false,
    [
      'Defends a post with warned shots in Capture combat.',
      'Захищає пост попередженими пострілами в бойових місіях захоплення.',
    ],
    [
      'A helmet and locked aim precede each shot.',
      'Шолом та зафіксоване прицілювання позначають постріл.',
    ],
    [
      'Evade the shot and touch the body during an opening.',
      'Ухиліться від пострілу й торкніться тіла у вдалий момент.',
    ],
  ],
  [
    'refuge-seeker',
    'Refuge seeker',
    'Шукач укриття',
    'hood',
    false,
    [
      'Commits to a reachable shelter and briefly rests there.',
      'Прямує до доступного укриття й ненадовго відпочиває там.',
    ],
    [
      'A hood and pointing gesture announce the selected goal.',
      'Каптур та жест указують на обрану ціль.',
    ],
    [
      'Intercept the shelter approach; shelter gives no invulnerability.',
      'Перехопіть біля укриття; воно не дає невразливості.',
    ],
  ],
  [
    'switchback',
    'Switchback',
    'Маневрувальник',
    'scarf',
    false,
    [
      'Escapes through an announced alternative exit.',
      'Тікає через заздалегідь показаний інший вихід.',
    ],
    [
      'A scarf and fork symbol introduce a committed direction change.',
      'Шарф і розгалужена стрілка попереджають про зміну напрямку.',
    ],
    [
      'Read the next direction and cover that exit.',
      'Стежте за наступним напрямком і перекрийте цей вихід.',
    ],
  ],
  [
    'rendezvous-pair',
    'Rendezvous pair',
    'Пара для зустрічі',
    'paired-badge',
    false,
    ['Two actors seek a shared meeting point.', 'Двоє прямують до спільного місця зустрічі.'],
    [
      'Linked badges and greeting gestures identify the partners.',
      'Парні значки та вітальні жести позначають напарників.',
    ],
    [
      'Separate their routes; each counts once, and the survivor becomes a Runner.',
      'Розділіть їхні маршрути; кожен зараховується один раз, а вцілілий стає Бігуном.',
    ],
  ],
  [
    'shield-bearer',
    'Shield bearer',
    'Щитоносець',
    'shield',
    true,
    [
      'Keeps its front protected while committing to a heading.',
      'Тримає фронт захищеним і дотримується обраного напрямку.',
    ],
    [
      'A solid shield marks the hazardous front; a hollow arrow warns of its next turn.',
      'Суцільний щит позначає небезпечний фронт; порожня стрілка попереджає про поворот.',
    ],
    [
      'Touch a side or the rear. The exact side boundary is exposed; enclosure also works in Capture.',
      'Торкніться збоку або ззаду. Межа бічної сторони відкрита; у захопленні також діє оточення.',
    ],
  ],
  [
    'brace-trooper',
    'Brace trooper',
    'Броньований спринтер',
    'opening-armor',
    true,
    [
      'Braces for a burst, then opens its armor to recover.',
      'Закриває броню для ривка, потім відкриває її на відпочинок.',
    ],
    [
      'Closed armor during warning and burst is hazardous; split panels mark recovery.',
      'Закрита броня під час попередження та ривка небезпечна; відкриті панелі позначають відпочинок.',
    ],
    [
      'Catch the open recovery. Pulse freezes the visible armor state; it does not open it.',
      'Перехопіть під час відкритого відпочинку. Імпульс фіксує поточний стан броні, а не відкриває її.',
    ],
  ],
  [
    'relay-warden',
    'Relay warden',
    'Вартовий ретранслятора',
    'relay-crown',
    true,
    [
      'Holds a native Capture relay or stronghold objective.',
      'Утримує ціль ретранслятора або фортеці в режимі захоплення.',
    ],
    [
      'A linked crown and relay indicators show its objective role.',
      'Корона зі зв’язками та індикатори ретранслятора позначають роль цілі.',
    ],
    [
      'Follow the mission’s relay or stronghold rules; this is not ordinary contact prey.',
      'Виконуйте правила ретранслятора або фортеці; це не звичайна контактна ціль.',
    ],
  ],
];

const engines = (capture, snake, flight) => ({ capture, snake, flight });
const supported = (policy, requires = []) => ({ policy, requires });
// Required policies are intentionally namespaced. Catalogue presence, costume
// and field-guide text never upgrade a historical recipe or imply an adapter.
const capabilities = {
  lookout: engines(null, supported('stationary'), supported('ground-patrol', ['stationary-route'])),
  patroller: engines(
    supported('authored-patrol', ['successor-recipe']),
    supported('patroller'),
    supported('ground-patrol'),
  ),
  runner: engines(
    supported('humanoid-runner'),
    supported('runner'),
    supported('ground-pursuit', ['successor-recipe']),
  ),
  sprinter: engines(
    supported('burst-pursuit', ['successor-recipe']),
    supported('sprinter'),
    supported('ground-burst', ['successor-recipe']),
  ),
  courier: engines(
    supported('optional-courier', ['successor-recipe', 'bonus-objective']),
    supported('courier', ['bonus-objective']),
    supported('optional-courier', ['successor-recipe', 'bonus-objective']),
  ),
  guard: engines(supported('humanoid-guard', ['projectiles']), null, null),
  'refuge-seeker': engines(
    supported('refuge', ['successor-recipe', 'goal-waypoints']),
    supported('refuge', ['successor-recipe', 'goal-waypoints']),
    supported('ground-refuge', ['successor-recipe', 'goal-waypoints']),
  ),
  switchback: engines(
    supported('switchback', ['successor-recipe']),
    supported('switchback', ['successor-recipe']),
    supported('ground-switchback', ['successor-recipe']),
  ),
  'rendezvous-pair': engines(
    supported('rendezvous', ['successor-recipe', 'pair']),
    supported('pair', ['successor-recipe', 'pair']),
    supported('ground-rendezvous', ['successor-recipe', 'pair']),
  ),
  'shield-bearer': engines(
    supported('directional-shield', ['successor-recipe', 'specialist-opt-in']),
    supported('shield', ['successor-recipe', 'specialist-opt-in']),
    supported('ground-shield', ['successor-recipe', 'specialist-opt-in']),
  ),
  'brace-trooper': engines(
    supported('brace', ['successor-recipe', 'specialist-opt-in']),
    supported('brace', ['successor-recipe', 'specialist-opt-in']),
    supported('ground-brace', ['successor-recipe', 'specialist-opt-in']),
  ),
  'relay-warden': engines(
    supported('relay-stronghold', ['native-boss-objective', 'specialist-opt-in']),
    null,
    null,
  ),
};

export const ACTOR_FAMILIES = freeze(
  descriptions.map(([id, en, uk, accessory, specialist, goal, tell, counter]) => ({
    id,
    name: { en, uk },
    accessory,
    specialist,
    contact: id === 'relay-warden' ? 'native-objective' : specialist ? 'conditional' : 'instant',
    guide: {
      en: { goal: goal[0], tell: tell[0], counter: counter[0] },
      uk: { goal: goal[1], tell: tell[1], counter: counter[1] },
    },
    capabilities: capabilities[id],
    reactionIds: ['notice', 'caught'].map((event) => `${ACTOR_CATALOG_VERSION}/${id}/${event}`),
  })),
);

const aliases = freeze({
  still: 'lookout',
  refuge: 'refuge-seeker',
  pair: 'rendezvous-pair',
  shield: 'shield-bearer',
  brace: 'brace-trooper',
  warden: 'relay-warden',
});
const families = new Map(ACTOR_FAMILIES.map((entry) => [entry.id, entry]));
const colors = {
  lookout: ['#c39b4b', '#ffe4a3', '#806336'],
  patroller: ['#67a6bb', '#b9e2e8', '#356579'],
  runner: ['#e5a148', '#ffd483', '#a96934'],
  sprinter: ['#dd7554', '#ffb588', '#934833'],
  courier: ['#a581ba', '#ddbee8', '#674979'],
  guard: ['#8a9878', '#d4ddba', '#4e5c4c'],
  'refuge-seeker': ['#55a797', '#b3e5c4', '#386957'],
  switchback: ['#c97ba2', '#ffc2df', '#884564'],
  'rendezvous-pair': ['#688bc4', '#c6d9ff', '#3b567e'],
  'shield-bearer': ['#738c9b', '#d3e4e7', '#465b6e'],
  'brace-trooper': ['#c78a52', '#ffe0a0', '#82563d'],
  'relay-warden': ['#967ab0', '#e3cfff', '#604779'],
};

export const ACTOR_VISUALS = freeze(
  ACTOR_FAMILIES.flatMap((family) =>
    ACTOR_CASTS.map((cast) => {
      const [coat, light, dark] = colors[family.id];
      return {
        id: `${ACTOR_CATALOG_VERSION}/${family.id}/${cast.id}`,
        family: family.id,
        cast: cast.id,
        material: 'flesh',
        accessory: family.accessory,
        castAccessory: cast.accessory,
        palette: {
          coat,
          light,
          dark,
          ink: '#29313a',
          skin: '#e4ad7e',
          skinLight: '#ffd3a1',
          pants: cast.id === 'tactical' ? '#4b584d' : '#45515e',
          trim: cast.id === 'arcade' ? '#fff7dd' : cast.id === 'tactical' ? '#d4c6a3' : light,
        },
        detailPixels: 28,
        compactPixels: 16,
        decodedBytes: 0,
      };
    }),
  ),
);
const visuals = new Map(ACTOR_VISUALS.map((entry) => [entry.id, entry]));

export function resolveActorFamily(id) {
  if (typeof id !== 'string') return null;
  const candidate = Object.hasOwn(aliases, id) ? aliases[id] : id;
  return families.has(candidate) ? candidate : null;
}
export function actorDefinition(id) {
  return families.get(resolveActorFamily(id)) ?? null;
}
export function actorVisual(id, cast = 'rivals') {
  if (visuals.has(id)) return visuals.get(id);
  const family = resolveActorFamily(id);
  if (!family || !ACTOR_CASTS.some((entry) => entry.id === cast)) return null;
  return visuals.get(`${ACTOR_CATALOG_VERSION}/${family}/${cast}`) ?? null;
}
export function actorFieldGuide(id, locale = 'en') {
  const entry = actorDefinition(id);
  if (!entry) return null;
  const language = locale === 'uk' ? 'uk' : 'en';
  return Object.freeze({
    id: entry.id,
    name: entry.name[language],
    specialist: entry.specialist,
    contact: entry.contact,
    ...entry.guide[language],
  });
}
export function actorCapability(id, engine) {
  const entry = actorDefinition(id);
  return entry && Object.hasOwn(entry.capabilities, engine) ? entry.capabilities[engine] : null;
}

/** Accepted failure feedback; optional identity refines advice without changing rules. */
export function specialistFailureCopy(family, locale = 'en') {
  const uk = locale === 'uk';
  if (['shield', 'shield-bearer'].includes(family))
    return {
      reason: uk
        ? 'Ви торкнулися захищеного боку щита.'
        : 'You touched the protected shield front.',
      tip: uk
        ? 'Обійдіть щит збоку чи ззаду, або оточіть ціль. Стрілка показує захищений напрямок.'
        : 'Approach from the side or rear, or enclose the target. The arrow marks the protected front.',
    };
  if (['brace', 'brace-trooper'].includes(family))
    return {
      reason: uk ? 'Ви торкнулися закритої броні.' : 'You touched closed armor.',
      tip: uk
        ? 'Дочекайтеся відкритої броні під час відновлення, або оточіть ціль. Замороження не відкриває броню.'
        : 'Wait for exposed recovery, or enclose the target. Freezing does not open armor.',
    };
  return {
    reason: uk ? 'Захищений контакт зупинив ваш апарат.' : 'Protected armor stopped your craft.',
    tip: uk
      ? 'Заходьте до Щита збоку чи ззаду. Броньований ривок уразливий під час відновлення. Оточення долає обох.'
      : 'Catch Shield from the side or rear; catch Brace during recovery. Enclosure defeats either.',
  };
}
