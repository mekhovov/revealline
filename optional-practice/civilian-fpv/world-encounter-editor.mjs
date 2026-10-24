import { boundedJSON, canonicalJSON, exactKeys, required } from '../../game/data-json.mjs';
import {
  createEncounterDefinition,
  validateEncounterDefinition,
  normalizeEncounterConfig,
  ENCOUNTER_FORMAT_V2,
  resolveMilitaryEncounterActor,
  encounterAttackAdmission,
} from './encounter-runtime.mjs';

export const ENCOUNTER_STUDIO_FORMAT = 'FPVEncounterStudioBundle.v1';
// The editable and source definitions each retain their independently validated
// 1 MiB / 64,000-node envelope, including complete 128-actor Survival routes.
const STUDIO_BUNDLE_BYTES = 2 * 1024 * 1024 + 4096;
const clone = structuredClone;
const equal = (a, b) => canonicalJSON(a ?? null) === canonicalJSON(b ?? null);
const read = (input) =>
  boundedJSON(input, {
    maxBytes: STUDIO_BUNDLE_BYTES,
    maxNodes: 132000,
    maxArray: 256,
    maxDepth: 14,
  });

/** A companion export owns its source pin and edit baseline, never the base map. */
export function validateEncounterStudioBundle(input, { baseIdentity } = {}) {
  const bundle = read(input);
  exactKeys(
    bundle,
    ['format', 'baseIdentity', 'definition', 'sourceDefinition'],
    'encounter studio bundle',
  );
  required(bundle.format === ENCOUNTER_STUDIO_FORMAT, 'Unsupported encounter studio bundle');
  const definition = validateEncounterDefinition(bundle.definition);
  const sourceDefinition = validateEncounterDefinition(bundle.sourceDefinition);
  required(
    equal(bundle.baseIdentity, definition.baseIdentity) &&
      equal(bundle.baseIdentity, sourceDefinition.baseIdentity),
    'Encounter source identity mismatch',
  );
  required(
    baseIdentity === undefined || equal(bundle.baseIdentity, baseIdentity),
    'This encounter belongs to another map revision. Open that revision or explicitly reimport the source.',
  );
  return {
    format: ENCOUNTER_STUDIO_FORMAT,
    baseIdentity: clone(bundle.baseIdentity),
    definition,
    sourceDefinition,
  };
}

/** Preserve authored fields by stable actor ID. Missing IDs require a visible decision. */
export function reconcileEncounterSource(bundleInput, incoming) {
  const bundle = validateEncounterStudioBundle(bundleInput);
  const source = validateEncounterDefinition(incoming);
  const before = new Map(bundle.sourceDefinition.actors.map((actor) => [actor.id, actor]));
  const edits = new Map(bundle.definition.actors.map((actor) => [actor.id, actor]));
  const unresolved = [];
  const actors = source.actors.flatMap((actor) => {
    const old = before.get(actor.id),
      edited = edits.get(actor.id);
    if (old && !edited) return []; // An explicit author deletion stays deleted.
    if (!old || !edited) return [clone(actor)];
    const merged = clone(actor);
    for (const key of new Set([...Object.keys(old), ...Object.keys(edited)])) {
      if (equal(old[key], edited[key])) continue;
      if (Object.hasOwn(edited, key)) merged[key] = clone(edited[key]);
      else delete merged[key];
    }
    return [merged];
  });
  const nextIds = new Set(source.actors.map((actor) => actor.id));
  for (const actor of bundle.definition.actors) {
    if (nextIds.has(actor.id)) continue;
    if (before.has(actor.id)) unresolved.push(actor.id);
    actors.push(clone(actor));
  }
  const definition = { ...clone(source), actors };
  for (const field of [
    'activity',
    'difficulty',
    'population',
    'seed',
    'survivalMode',
    'crowdModel',
    'contactModel',
    'loadout',
    'payload',
    'ammoPreset',
    'playerDamage',
    'enemyDamage',
    'servicePad',
  ])
    if (!equal(bundle.definition[field], bundle.sourceDefinition[field]))
      if (bundle.definition[field] !== undefined)
        definition[field] = clone(bundle.definition[field]);
  if (
    bundle.definition.format === ENCOUNTER_FORMAT_V2 &&
    definition.format !== ENCOUNTER_FORMAT_V2
  ) {
    Object.assign(definition, normalizeEncounterConfig(definition), {
      format: ENCOUNTER_FORMAT_V2,
      revision: 'r2',
      crowdModel: 'squad-lanes-v1',
      contactModel: 'arcade-ram-v1',
    });
    definition.actors = definition.actors.map(resolveMilitaryEncounterActor);
  }
  return { sourceDefinition: source, definition, unresolved };
}

export function createEncounterStudioSession({
  definition,
  sourceDefinition = definition,
  admitActor,
  admitServicePad,
  onChange = () => {},
}) {
  let bundle = validateEncounterStudioBundle({
    format: ENCOUNTER_STUDIO_FORMAT,
    baseIdentity: definition.baseIdentity,
    definition,
    sourceDefinition,
  });
  let past = [],
    future = [],
    pending = null;
  const validate = (input) => {
    const next = validateEncounterDefinition(input);
    if (next.format === ENCOUNTER_FORMAT_V2 && next.servicePad && admitServicePad) {
      const admitted = admitServicePad(clone(next.servicePad), { exact: true });
      required(
        admitted != null && equal(admitted, next.servicePad),
        'The service pad needs a clear supported surface. Reposition it before saving.',
      );
    }
    if (admitActor)
      for (const actor of next.actors) {
        const admitted = admitActor(
          clone(actor),
          next.format === ENCOUNTER_FORMAT_V2 ? encounterAttackAdmission(next.loadout) : undefined,
        );
        required(
          admitted != null,
          `Target ${actor.id} needs a supported route and a reachable firing position.`,
        );
        required(
          equal(admitted.position, actor.position) && equal(admitted.path, actor.path),
          `Target ${actor.id} needs its position or route aligned with the map surface.`,
        );
      }
    return next;
  };
  function adopt(next, { history = true } = {}) {
    const accepted = validateEncounterStudioBundle({
      ...next,
      definition: validate(next.definition),
    });
    required(onChange(clone(accepted.definition)) !== false, 'Encounter change was not accepted.');
    if (history) {
      past.push(bundle);
      past = past.slice(-40);
      future = [];
    }
    bundle = accepted;
    pending = null;
    return clone(bundle.definition);
  }
  return {
    snapshot: () => clone(bundle.definition),
    status: () => ({
      undo: past.length > 0,
      redo: future.length > 0,
      pending: !!pending,
      unresolved: [...(pending?.unresolved ?? [])],
    }),
    apply(definition) {
      required(!pending, 'Resolve the changed source before applying edits.');
      required(
        equal(definition.baseIdentity, bundle.baseIdentity),
        'Use source reimport to change the map identity.',
      );
      return adopt({ ...bundle, definition });
    },
    exportBundle: () => canonicalJSON(bundle),
    importBundle(input) {
      return adopt(validateEncounterStudioBundle(input, { baseIdentity: bundle.baseIdentity }));
    },
    reimport(incoming) {
      pending = reconcileEncounterSource(bundle, incoming);
      return clone(pending);
    },
    resolveSource({ keepMissing = false } = {}) {
      required(pending, 'No source change needs resolution.');
      const next = clone(pending);
      if (!keepMissing)
        next.definition.actors = next.definition.actors.filter(
          (actor) => !next.unresolved.includes(actor.id),
        );
      return adopt({
        format: ENCOUNTER_STUDIO_FORMAT,
        baseIdentity: next.definition.baseIdentity,
        definition: next.definition,
        sourceDefinition: next.sourceDefinition,
      });
    },
    cancelReimport() {
      pending = null;
    },
    undo() {
      if (!past.length) return false;
      const prior = past.at(-1),
        current = bundle;
      adopt(prior, { history: false });
      past.pop();
      future.push(current);
      return true;
    },
    redo() {
      if (!future.length) return false;
      const next = future.at(-1),
        current = bundle;
      adopt(next, { history: false });
      future.pop();
      past.push(current);
      return true;
    },
  };
}

/** Host previews use the same accepted definition and effect recipes as live combat. */
export function mountEncounterEditor({
  container,
  getCourse,
  getBaseIdentity,
  definition,
  bundle: savedBundle,
  onChange = () => {},
  onPreview = () => {},
  locale = 'en',
  admitActor,
  admitServicePad,
} = {}) {
  required(
    container && typeof getCourse === 'function' && typeof getBaseIdentity === 'function',
    'Encounter editor needs a map and its exact identity',
  );
  const doc = container.ownerDocument;
  const text = (en, uk) => ((typeof locale === 'function' ? locale() : locale) === 'uk' ? uk : en);
  let session = null,
    selected = null,
    disposed = false,
    notice = '',
    transfer = '';
  const create = () =>
    createEncounterDefinition({
      course: getCourse(),
      baseIdentity: getBaseIdentity(),
      admitActor,
      admitServicePad,
      version: 2,
    });
  const el = (tag, value) => {
    const node = doc.createElement(tag);
    if (value !== undefined) node.textContent = value;
    return node;
  };
  const label = (title, control) => {
    const node = el('label');
    node.append(el('span', title), control);
    return node;
  };
  function action(title, callback, disabled = false) {
    const button = el('button', title);
    button.type = 'button';
    button.disabled = disabled;
    button.addEventListener('click', () => {
      try {
        const result = callback();
        if (result?.catch)
          result.catch((error) => {
            notice = error.message;
            refresh();
          });
      } catch (error) {
        notice = error.message;
      }
      refresh();
    });
    return button;
  }
  const choose = (name, choices, value) => {
    const node = el('select');
    node.dataset.encounterField = name;
    for (const [key, title] of choices) {
      const option = el('option', title);
      option.value = key;
      node.append(option);
    }
    node.value = String(value);
    return node;
  };
  const number = (name, value, min = 0, max = 100000, step = 1) => {
    const node = el('input');
    node.type = 'number';
    node.value = String(value);
    node.min = String(min);
    node.max = String(max);
    node.step = String(step);
    node.dataset.encounterField = name;
    return node;
  };
  const numeric = (node) => {
    required(
      node.value.trim() !== '' && Number.isFinite(Number(node.value)),
      text('Enter a number.', 'Введіть число.'),
    );
    return Number(node.value);
  };
  function ensure() {
    if (!session) {
      // A saved companion from an older revision stays readable so its stable
      // IDs and authored overrides can be explicitly reconciled with the map.
      const restored = savedBundle ? validateEncounterStudioBundle(savedBundle) : null;
      const initial = restored?.definition ?? definition ?? create();
      session = createEncounterStudioSession({
        definition: initial,
        sourceDefinition: restored?.sourceDefinition ?? initial,
        admitActor,
        admitServicePad,
        onChange,
      });
      savedBundle = null;
      definition = undefined;
    }
    return session;
  }
  function refresh() {
    if (disposed) return;
    container.replaceChildren();
    container.append(el('h3', text('Combat encounters', 'Бойові сутички')));
    let draft, state;
    try {
      draft = ensure().snapshot();
      state = session.status();
    } catch (error) {
      container.append(el('p', error.message));
      return;
    }
    const status = el('p', notice);
    status.setAttribute('role', 'status');
    status.dataset.encounterStatus = '';
    container.append(
      el(
        'p',
        text(
          'Edit a combat companion for this map. Original course objectives stay available.',
          'Налаштуйте бойовий сценарій цієї мапи. Початкові завдання курсу залишаються доступними.',
        ),
      ),
    );
    const stale = !equal(draft.baseIdentity, getBaseIdentity());
    if (stale) {
      container.append(
        el(
          'p',
          text(
            'Map source changed. Reimport its targets before saving.',
            'Джерело мапи змінилося. Повторно імпортуйте цілі перед збереженням.',
          ),
        ),
      );
    }
    const activity = choose(
      'activity',
      [
        ['continuous', text('Continuous combat', 'Безперервний бій')],
        ['hunting', text('Three-minute hunt', 'Трихвилинне полювання')],
        ['elimination', text('Eliminate every target', 'Знищити всі цілі')],
        ['strike', text('Strike objective', 'Удар по цілі')],
        ['survival', text('Survival', 'Виживання')],
      ],
      draft.activity,
    );
    const difficulty = choose(
      'difficulty',
      [
        ['easy', text('Easy', 'Легко')],
        ['normal', text('Normal', 'Звичайно')],
        ['hard', text('Hard', 'Складно')],
      ],
      draft.difficulty,
    );
    const population = choose(
      'population',
      (draft.activity === 'survival' ? [64, 96, 128] : [6, 12, 20]).map((n) => [n, String(n)]),
      draft.population,
    );
    activity.addEventListener('change', () => {
      const values = activity.value === 'survival' ? [64, 96, 128] : [6, 12, 20];
      const previous = Number(population.value);
      population.replaceChildren(
        ...values.map((n) => {
          const node = el('option', String(n));
          node.value = String(n);
          return node;
        }),
      );
      population.value = String(
        values.includes(previous) ? previous : activity.value === 'survival' ? 96 : 12,
      );
    });
    const config = normalizeEncounterConfig(draft);
    const weapons = [
      ['autocannon', text('Autocannon', 'Автогармата')],
      ['scatter', text('Scatter', 'Картеч')],
      ['precision', text('Precision', 'Точна зброя')],
      ['rocket', text('Rockets', 'Ракети')],
    ];
    const primary = choose('primaryWeapon', weapons, config.loadout[0]);
    const secondary = choose('secondaryWeapon', weapons, config.loadout[1]);
    const payload = choose(
      'payload',
      [
        ['bomb', text('Dropped bomb', 'Бомба')],
        ['remote', text('Remote charge', 'Дистанційний заряд')],
        ['drone', text('Drone charge', 'Заряд дрона')],
      ],
      config.payload,
    );
    const ammo = choose(
      'ammoPreset',
      [
        ['balanced', text('Balanced', 'Збалансовано')],
        ['arcade', text('Arcade', 'Аркада')],
        ['tactical', text('Tactical', 'Тактично')],
      ],
      config.ammoPreset,
    );
    const survival = choose(
      'survivalMode',
      [
        ['timed', text('Six minutes', 'Шість хвилин')],
        ['endless', text('Endless', 'Нескінченно')],
      ],
      config.survivalMode,
    );
    const playerDamage = choose(
      'playerDamage',
      [
        ['normal', text('Normal damage', 'Звичайна шкода')],
        ['invulnerable', text('Invulnerable practice', 'Невразливе тренування')],
      ],
      config.playerDamage,
    );
    const enemyDamage = choose(
      'enemyDamage',
      [
        ['normal', text('Normal health', 'Звичайне здоров’я')],
        ['one-hit', text('One-hit practice', 'Тренування одним влучанням')],
      ],
      config.enemyDamage,
    );
    const seed = number('seed', draft.seed, 1, 4294967295);
    const serviceEnabled = el('input');
    serviceEnabled.type = 'checkbox';
    serviceEnabled.dataset.encounterField = 'servicePadEnabled';
    serviceEnabled.checked = draft.servicePad != null;
    const serviceCoordinates = Object.fromEntries(
      ['x', 'y', 'z'].map((axis) => [
        axis,
        number(
          `servicePad-${axis}`,
          (draft.servicePad?.[axis] ?? draft.spawn[axis]) / 1000,
          -100000,
          100000,
          0.001,
        ),
      ]),
    );
    const serviceFields = el('fieldset');
    serviceFields.append(
      el('legend', text('Service pad', 'Майданчик поповнення')),
      label(text('Enable supported service pad', 'Додати майданчик на поверхні'), serviceEnabled),
      ...Object.entries(serviceCoordinates).map(([axis, node]) =>
        label(`${axis.toUpperCase()} (m)`, node),
      ),
    );

    container.append(
      label(text('Activity', 'Режим'), activity),
      label(text('Difficulty', 'Складність'), difficulty),
      label(text('Active targets', 'Активні цілі'), population),
      label(text('Seed', 'Зерно'), seed),
      label(text('Survival duration', 'Тривалість виживання'), survival),
      label(text('Primary weapon', 'Перша зброя'), primary),
      label(text('Secondary weapon', 'Друга зброя'), secondary),
      label(text('Payload', 'Заряд'), payload),
      label(text('Ammunition rules', 'Правила боєприпасів'), ammo),
      label(text('Player damage', 'Шкода гравцеві'), playerDamage),
      label(text('Enemy health rules', 'Правила здоров’я ворогів'), enemyDamage),
      serviceFields,
      action(
        text('Apply encounter settings', 'Застосувати параметри сутички'),
        () => {
          required(
            primary.value !== secondary.value,
            text('Choose two different weapons.', 'Оберіть дві різні зброї.'),
          );
          let servicePad = null;
          if (serviceEnabled.checked) {
            const requested = Object.fromEntries(
              Object.entries(serviceCoordinates).map(([axis, node]) => [
                axis,
                Math.round(numeric(node) * 1000),
              ]),
            );
            servicePad = admitServicePad ? admitServicePad(requested) : requested;
            required(
              servicePad != null,
              text(
                'Choose a clear supported surface for the service pad.',
                'Оберіть вільну поверхню для майданчика.',
              ),
            );
          }
          required(
            ammo.value !== 'tactical' || servicePad != null,
            text(
              'Tactical ammunition needs an enabled, reachable service pad.',
              'Тактичні боєприпаси потребують доступного майданчика поповнення.',
            ),
          );
          session.apply({
            ...draft,
            servicePad,
            format: ENCOUNTER_FORMAT_V2,
            revision: 'r2',
            crowdModel: 'squad-lanes-v1',
            contactModel: 'arcade-ram-v1',
            ...normalizeEncounterConfig({
              activity: activity.value,
              difficulty: difficulty.value,
              population: Number(population.value),
              survivalMode: survival.value,
              loadout: [primary.value, secondary.value],
              payload: payload.value,
              ammoPreset: ammo.value,
              playerDamage: playerDamage.value,
              enemyDamage: enemyDamage.value,
            }),
            actors: draft.actors.map(resolveMilitaryEncounterActor),
            activity: activity.value,
            difficulty: difficulty.value,
            population: Number(population.value),
            seed: numeric(seed),
          });
          notice = '';
        },
        stale || state.pending,
      ),
    );
    selected = draft.actors.some((actor) => actor.id === selected) ? selected : draft.actors[0]?.id;
    const selector = choose(
      'actor',
      draft.actors.map((actor) => [actor.id, `${actor.id} · ${actor.family}`]),
      selected,
    );
    selector.addEventListener('change', () => {
      selected = selector.value;
      refresh();
    });
    container.append(label(text('Target', 'Ціль'), selector));
    const actor = draft.actors.find((actor) => actor.id === selected);
    if (actor) {
      const controls = {};
      for (const [key, en, uk, maximum, scale] of [
        ['radius', 'Body radius (m)', 'Радіус тіла (м)', 2000, 1000],
        ['height', 'Body height (m)', 'Висота тіла (м)', 5000, 1000],
        ['health', 'Health', 'Здоров’я', 1000, 1],
        ['damage', 'Damage', 'Шкода', 1000, 1],
        ['speed', 'Movement speed (m/s)', 'Швидкість руху (м/с)', 15000, 1000],
        [
          'fireEveryTicks',
          'Time between shots (seconds, 0 = no weapon)',
          'Час між пострілами (секунди, 0 = без зброї)',
          5000,
          50,
        ],
        ['projectileSpeed', 'Projectile speed (m/s)', 'Швидкість снаряда (м/с)', 60000, 1000],
        ['range', 'Range (m)', 'Дальність (м)', 100000, 1000],
      ]) {
        const node = number(key, actor[key] / scale, 0, maximum / scale, 1 / scale);
        controls[key] = { node, scale };
        container.append(label(text(en, uk), node));
      }
      const knownFamilies = [
        ['runner', text('Recon scout', 'Бігун')],
        ['patroller', text('Patrol trooper', 'Патрульний')],
        ['lookout', text('Military lookout', 'Вартовий')],
        ['sprinter', text('Assault scout', 'Спринтер')],
        ['switchback', text('Flanking scout', 'Маневровий бігун')],
        ['refuge-seeker', text('Cover-seeking rifleman', 'Шукач укриття')],
        ['courier', text('Dispatch trooper', 'Кур’єр')],
        ['rendezvous-pair', text('Patrol pair', 'Бігун до місця зустрічі')],
        [
          'shield-bearer',
          text('Shield bearer — frontal protection', 'Щитоносець — захист спереду'),
        ],
        [
          'brace-trooper',
          text('Brace trooper — guarded bursts', 'Боєць зі щитом — захищені ривки'),
        ],
      ];
      if (!knownFamilies.some(([id]) => id === actor.family))
        knownFamilies.unshift([actor.family, actor.family]);
      const family = choose('family', knownFamilies, actor.family);
      container.append(label(text('Behaviour and shield', 'Поведінка та щит'), family));
      const type = choose(
        'type',
        [
          ['patrol', text('Military trooper', 'Рухома наземна ціль')],
          ['sentry', text('Military sentry', 'Вартовий')],
          ['vehicle', text('Military vehicle', 'Транспорт')],
          ['drone', text('Military UAV', 'Дрон')],
          ['prop', text('Ground robot / supply', 'Тренувальний об’єкт')],
          ['hazard', text('Interceptor UAV', 'Рухома перешкода')],
        ],
        actor.type,
      );
      const material = choose(
        'material',
        [
          ['organic', text('Organic', 'Органічний')],
          ['metal', text('Metal', 'Метал')],
          ['electronic', text('Electronics', 'Електроніка')],
          ['wood', text('Wood', 'Деревина')],
          ['glass', text('Glass', 'Скло')],
        ],
        actor.material,
      );
      type.addEventListener('change', () => {
        const human = ['patrol', 'sentry'].includes(type.value);
        const radius = {
          patrol: 350,
          sentry: 350,
          vehicle: 900,
          drone: 450,
          prop: 450,
          hazard: 600,
        }[type.value];
        material.value = human ? 'organic' : type.value === 'drone' ? 'electronic' : 'metal';
        controls.radius.node.value = String(radius / 1000);
        controls.height.node.value = String((human ? 1800 : radius * 2) / 1000);
      });
      container.append(
        label(text('Target type', 'Тип цілі'), type),
        label(text('Impact material', 'Матеріал удару'), material),
      );
      container.append(
        el(
          'p',
          text(
            'Every combat target can be destroyed. Props are optional and do not block completion.',
            'Кожну бойову ціль можна знищити. Декоративні предмети необов’язкові й не перешкоджають завершенню.',
          ),
        ),
      );
      const position = {};
      for (const axis of ['x', 'y', 'z']) {
        position[axis] = number(
          `position-${axis}`,
          actor.position[axis] / 1000,
          draft.bounds.min[axis] / 1000,
          draft.bounds.max[axis] / 1000,
          0.001,
        );
        container.append(
          label(text(`Position ${axis} (m)`, `Позиція ${axis} (м)`), position[axis]),
        );
      }
      const path = el('textarea');
      path.rows = 4;
      path.dataset.encounterField = 'path';
      path.value = JSON.stringify(
        actor.path.map((p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v / 1000]))),
      );
      const zone = el('textarea');
      zone.rows = 3;
      zone.dataset.encounterField = 'spawnZone';
      zone.value = actor.spawnZone
        ? JSON.stringify(
            Object.fromEntries(
              Object.entries(actor.spawnZone).map(([edge, p]) => [
                edge,
                Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v / 1000])),
              ]),
            ),
          )
        : '';
      container.append(
        label(text('Route points in metres (JSON)', 'Точки маршруту в метрах (JSON)'), path),
        label(
          text(
            'Spawn zone in metres (optional JSON min/max)',
            'Зона появи в метрах (необов’язковий JSON min/max)',
          ),
          zone,
        ),
      );
      container.append(
        action(
          text('Apply target settings', 'Застосувати параметри цілі'),
          () => {
            const metres = (p) =>
              Object.fromEntries(
                ['x', 'y', 'z'].map((axis) => {
                  required(Number.isFinite(p?.[axis]), 'Route coordinates must be finite.');
                  return [axis, Math.round(p[axis] * 1000)];
                }),
              );
            const route = read(path.value);
            required(Array.isArray(route), 'Route points need an array.');
            const next = {
              ...actor,
              ...Object.fromEntries(
                Object.entries(controls).map(([key, { node, scale }]) => [
                  key,
                  Math.round(numeric(node) * scale),
                ]),
              ),
              type: type.value,
              material: material.value,
              family: family.value.trim(),
              appearance: { ...actor.appearance, family: family.value.trim() },
              destructible: true,
              position: Object.fromEntries(
                Object.entries(position).map(([key, node]) => [
                  key,
                  Math.round(numeric(node) * 1000),
                ]),
              ),
              path: route.map(metres),
            };
            if (next.type !== 'vehicle') delete next.vehicleModel;
            if (['patrol', 'sentry', 'vehicle', 'prop'].includes(next.type))
              next.groundMotion = 'support-v1';
            else delete next.groundMotion;
            if (zone.value.trim()) {
              const value = read(zone.value);
              next.spawnZone = { min: metres(value.min), max: metres(value.max) };
            } else delete next.spawnZone;
            session.apply({
              ...draft,
              actors: draft.actors.map((item) =>
                item.id === actor.id
                  ? draft.format === ENCOUNTER_FORMAT_V2
                    ? resolveMilitaryEncounterActor({
                        ...next,
                        appearance: {
                          ...next.appearance,
                          archetype:
                            type.value === actor.type ? next.appearance.archetype : undefined,
                        },
                      })
                    : next
                  : item,
              ),
            });
            notice = '';
          },
          stale || state.pending,
        ),
      );
      container.append(
        action(
          text('Duplicate target', 'Дублювати ціль'),
          () => {
            let index = 1;
            while (draft.actors.some((item) => item.id === `authored-target-${index}`)) index++;
            const next = { ...clone(actor), id: `authored-target-${index}` };
            session.apply({ ...draft, actors: [...draft.actors, next] });
            selected = next.id;
          },
          draft.actors.length >= (draft.format === ENCOUNTER_FORMAT_V2 ? 128 : 20) ||
            stale ||
            state.pending,
        ),
        action(
          text('Remove target', 'Вилучити ціль'),
          () => {
            session.apply({
              ...draft,
              actors: draft.actors.filter((item) => item.id !== actor.id),
            });
          },
          draft.actors.length <= 1 || stale || state.pending,
        ),
      );
      container.append(
        el(
          'p',
          text(
            `Admitted roster: ${draft.actors.length} / requested ${draft.population}. Targets need supported routes and reachable firing positions.`,
            `Допущено цілей: ${draft.actors.length} / запитано ${draft.population}. Цілі потребують опорних маршрутів і доступних позицій для стрільби.`,
          ),
        ),
      );
      const previewWeapon = choose(
        'previewWeapon',
        [
          ...weapons,
          ['bomb', text('Bomb', 'Бомба')],
          ['remote', text('Remote charge', 'Дистанційний заряд')],
          ['impact', text('Drone impact', 'Удар дроном')],
        ],
        'precision',
      );
      const previewOutcome = choose(
        'previewOutcome',
        [
          ['localized', text('Localized defeat', 'Локальне руйнування')],
          ['breakup', text('High-energy defeat', 'Сильне руйнування')],
          ['explosive', text('Explosive defeat', 'Вибухове руйнування')],
        ],
        'breakup',
      );
      container.append(
        label(text('Preview weapon', 'Зброя перегляду'), previewWeapon),
        label(text('Preview outcome', 'Результат перегляду'), previewOutcome),
      );
      for (const [en, uk, destruction] of [
        [
          'Preview clean impact',
          'Переглянути чистий удар',
          { brutal: false, blood: false, showRemains: true },
        ],
        ['Preview debris', 'Переглянути уламки', { brutal: true, blood: false, showRemains: true }],
        [
          'Preview blood and remains',
          'Переглянути кров і рештки',
          { brutal: true, blood: true, showRemains: true },
        ],
      ])
        container.append(
          action(
            text(en, uk),
            () =>
              onPreview({
                definition: session.snapshot(),
                actorId: actor.id,
                destruction,
                weapon: previewWeapon.value,
                outcome: previewOutcome.value,
              }),
            stale,
          ),
        );
    }
    const history = el('div');
    history.className = 'button-row';
    history.append(
      action(
        text('Undo encounter edit', 'Скасувати зміну сутички'),
        () => session.undo(),
        !state.undo,
      ),
      action(
        text('Redo encounter edit', 'Повторити зміну сутички'),
        () => session.redo(),
        !state.redo,
      ),
      action(text('Reimport map targets', 'Повторно імпортувати цілі мапи'), () => {
        const result = session.reimport(create());
        if (!result.unresolved.length) session.resolveSource();
        else
          notice =
            text('Unresolved source target IDs: ', 'Нерозпізнані ID цілей джерела: ') +
            result.unresolved.join(', ');
      }),
    );
    container.append(history);
    if (state.unresolved.length)
      container.append(
        el(
          'p',
          text('Source targets no longer exist: ', 'Цілей більше немає в джерелі: ') +
            state.unresolved.join(', '),
        ),
        action(text('Keep them as authored targets', 'Зберегти як авторські цілі'), () => {
          session.resolveSource({ keepMissing: true });
          notice = '';
        }),
        action(text('Remove missing source targets', 'Вилучити відсутні цілі джерела'), () => {
          session.resolveSource();
          notice = '';
        }),
      );
    if (state.pending)
      container.append(
        action(text('Cancel source reimport', 'Скасувати повторний імпорт'), () => {
          session.cancelReimport();
          notice = '';
        }),
      );
    const json = el('textarea');
    json.rows = 5;
    json.maxLength = STUDIO_BUNDLE_BYTES;
    json.value = transfer;
    json.dataset.encounterField = 'bundle';
    json.addEventListener('input', () => {
      transfer = json.value;
    });
    container.append(
      label(text('Encounter companion JSON', 'JSON бойового сценарію'), json),
      action(text('Export encounter', 'Експортувати сутичку'), () => {
        transfer = session.exportBundle();
      }),
      action(
        text('Import encounter', 'Імпортувати сутичку'),
        () => {
          session.importBundle(json.value);
          transfer = json.value;
          notice = '';
        },
        stale,
      ),
      status,
    );
  }
  refresh();
  return {
    snapshot: () => ensure().snapshot(),
    refresh,
    exportBundle: () => ensure().exportBundle(),
    importBundle(input) {
      const result = ensure().importBundle(input);
      refresh();
      return result;
    },
    reimport(incoming) {
      const result = ensure().reimport(incoming);
      refresh();
      return result;
    },
    undo() {
      const result = ensure().undo();
      refresh();
      return result;
    },
    redo() {
      const result = ensure().redo();
      refresh();
      return result;
    },
    dispose() {
      disposed = true;
      session = null;
      container.replaceChildren();
    },
  };
}
