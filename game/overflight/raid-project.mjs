import {
  createOverflightCombatProfile,
  validateOverflightCombatProfile,
} from './combat-profile.mjs';
import { OVERFLIGHT_DIFFICULTIES, seededOverflightRandom } from './tactics.mjs';
import {
  boundedJSON,
  canonicalJSON,
  dataIdentity,
  exactKeys,
  required,
  stableId,
} from '../data-json.mjs';
import { OVERFLIGHT_RESOURCES, OVERFLIGHT_SOLDIERS, OVERFLIGHT_MACHINERY } from './project.mjs';

export const OVERFLIGHT_HUNT_PROJECT_FORMAT = 'OverflightHuntProjectV1';
export const OVERFLIGHT_HUNT_COMPILED_FORMAT = 'OverflightHuntCompiledV1';
export const OVERFLIGHT_HUNT_PROJECT_FORMAT_V2 = 'OverflightHuntProjectV2';
export const OVERFLIGHT_HUNT_COMPILED_FORMAT_V2 = 'OverflightHuntCompiledV2';
export const OVERFLIGHT_HUNT_PROJECT_MAX_BYTES = 128 * 1024;
export const OVERFLIGHT_HUNT_ENCOUNTER_SETS = Object.freeze(['patrol', 'crossing', 'mixed']);
export const OVERFLIGHT_HUNT_BEHAVIORS = Object.freeze([
  'patrol',
  'crossing',
  'runner',
  'sprinter',
  'courier',
  'shield',
  'brace',
  'vehicle',
]);
export const OVERFLIGHT_HUNT_UPGRADES = Object.freeze([
  'strike-width',
  'slow-wake',
  'rush-charge',
  'boost-cooldown',
  'boost-duration',
  'chain-window',
  'heavy-exposure',
  'guard-interrupt',
  'recovery-shield',
  'plating',
]);
const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const point = (x, y) => ({ x, y });
const title = (en, uk) => ({ en, uk });
const familyBehavior = {
  patroller: 'patrol',
  lookout: 'patrol',
  runner: 'runner',
  sprinter: 'sprinter',
  courier: 'courier',
  guard: 'brace',
  'refuge-seeker': 'runner',
  switchback: 'sprinter',
  'rendezvous-pair': 'crossing',
  'relay-warden': 'crossing',
  'shield-bearer': 'shield',
  'brace-trooper': 'brace',
};
const familySets = {
  patrol: [
    'patroller',
    'lookout',
    'runner',
    'refuge-seeker',
    'courier',
    'sprinter',
    'rendezvous-pair',
    'relay-warden',
  ],
  crossing: [
    'runner',
    'switchback',
    'rendezvous-pair',
    'courier',
    'relay-warden',
    'refuge-seeker',
    'lookout',
    'sprinter',
  ],
  mixed: [
    'patroller',
    'sprinter',
    'switchback',
    'lookout',
    'rendezvous-pair',
    'runner',
    'courier',
    'relay-warden',
  ],
};

/** Finite encounter populations: advancing a sector never replaces casualties. */
export function createOverflightHuntProject({
  encounterSet = 'patrol',
  seed = 17031991,
  difficulty = 'standard',
  legacy = false,
} = {}) {
  required(OVERFLIGHT_DIFFICULTIES.includes(difficulty), 'Unknown difficulty.');
  const random = seededOverflightRandom(seed ^ 0x7f4a7c15);
  required(OVERFLIGHT_HUNT_ENCOUNTER_SETS.includes(encounterSet), 'Unknown Raid encounter set.');
  const families = familySets[encounterSet];
  const encounters = ['patrols', 'column', 'command'].map((id, sector) => {
    const left = sector * 960;
    const packs = Array.from({ length: [8, 10, 14][sector] }, (_, index) => {
      let x = left + 120 + (index % 4) * 215;
      let y = 170 + Math.floor(index / 4) * 240;
      if (!legacy) {
        if (encounterSet === 'crossing') {
          x = left + 170 + (index % 3) * 280;
          y = 180 + Math.floor(index / 3) * 160;
        }
        if (encounterSet === 'mixed') {
          const a = index * 2.399963;
          x = left + 480 + Math.cos(a) * 290;
          y = 540 + Math.sin(a) * 340;
        }
        x += (random() - 0.5) * 24;
        y += (random() - 0.5) * 24;
      }
      const family = families[(index + sector * 3) % families.length];
      return {
        id: `${id}-pack-${index + 1}`,
        family,
        behavior: familyBehavior[family],
        count: legacy || difficulty === 'veteran' ? 16 : 12,
        x,
        y,
        spacing: 24,
        speed: 64 + (index % 3) * 16 + (!legacy && difficulty === 'veteran' ? 12 : 0),
        route:
          !legacy && encounterSet === 'crossing'
            ? [point(left + 130, y), point(left + 820, 1080 - y)]
            : !legacy && encounterSet === 'mixed'
              ? [
                  point(left + 480, 540),
                  point(left + 850 - (x - left) * 0.65, 1080 - y),
                  point(x, y),
                ]
              : [
                  point(Math.min(left + 850, x + 180), Math.min(950, y + 75)),
                  point(Math.max(left + 90, x - 100), Math.min(950, y + 160)),
                  point(x, y),
                ],
      };
    });
    // Finite brace escorts threaten the objective approach. They commit to a
    // short local route rather than pursuing the player into the next sector.
    // The simulation admits guards against the shared specialist budget.
    packs.push({
      id: `${id}-escort`,
      family: 'brace-trooper',
      behavior: 'brace',
      count: legacy ? 6 : difficulty === 'veteran' ? 6 : 4,
      x: [420, 1550, 2680][sector],
      y: 540,
      spacing: 24,
      speed: 42,
      route: [
        point([420, 1550, 2680][sector] + 35, 565),
        point([420, 1550, 2680][sector] - 35, 515),
      ],
    });
    const objective = (name, family, behavior, x, y, armorSegments = 0) => ({
      id: name,
      family,
      behavior,
      x,
      y,
      armorSegments,
      route: [point(x + 65, y + 60), point(x - 65, y - 60)],
    });
    return {
      id,
      title: [
        title('Break the patrols', 'Розбий патрулі'),
        title('Intercept the column', 'Перехопи колону'),
        title('Finish the hunt', 'Заверши полювання'),
      ][sector],
      sector,
      entry: point(left + 160, 540),
      packs,
      objectives:
        sector === 0
          ? [
              objective('leader-1', 'patroller', 'patrol', 340, 410),
              objective('leader-2', 'shield-bearer', 'shield', 620, 740),
              objective(
                'leader-3',
                encounterSet === 'mixed' ? 'guard' : 'brace-trooper',
                'brace',
                800,
                340,
              ),
            ]
          : sector === 1
            ? [
                objective(
                  'light-1',
                  encounterSet === 'crossing' ? 'scout-car' : 'utility-car',
                  'vehicle',
                  1210,
                  340,
                  1,
                ),
                objective(
                  'light-2',
                  encounterSet === 'mixed' ? 'radar-truck' : 'cargo-truck',
                  'vehicle',
                  1520,
                  760,
                  1,
                ),
                objective('carrier', 'armored-carrier', 'vehicle', 1770, 480, 2),
              ]
            : [objective('command-tank', 'tracked-tank', 'vehicle', 2600, 520, 3)],
    };
  });
  return {
    format: legacy ? OVERFLIGHT_HUNT_PROJECT_FORMAT : OVERFLIGHT_HUNT_PROJECT_FORMAT_V2,
    ...(!legacy ? { difficulty, combat: createOverflightCombatProfile(difficulty) } : {}),
    id: `overflight-raid-${encounterSet}`,
    title: title(
      `Overflight: Raid · ${encounterSet === 'patrol' ? 'Patrol Break' : encounterSet === 'crossing' ? 'Crossing Lines' : 'Countermove'}`,
      `Проліт: Наліт · ${encounterSet === 'patrol' ? 'Зрив патруля' : encounterSet === 'crossing' ? 'Перетин маршрутів' : 'Контрхід'}`,
    ),
    seed,
    arena: { width: 2880, height: 1080, cameraWidth: 960, cameraHeight: 540 },
    population: { capacity: 1500, specialists: 8, heavies: 4, priorityAttacks: 2 },
    encounters,
    upgrades: {
      choices: 8,
      rerolls: 2,
      thresholds: [10, 35],
      modules: OVERFLIGHT_HUNT_UPGRADES.filter((id) => !legacy || id !== 'plating'),
    },
    resources: structuredClone(OVERFLIGHT_RESOURCES),
    props: [
      { id: 'raid-case-west', kind: 'supply-case', x: legacy ? 980 : 520, y: 320 },
      { id: 'raid-case-east', kind: 'supply-case', x: legacy ? 1910 : 1500, y: 650 },
    ],
  };
}
export const DEFAULT_OVERFLIGHT_HUNT_PROJECT = freeze(createOverflightHuntProject());
function fields(value, keys, label) {
  exactKeys(value, keys, label);
  required(
    keys.every((key) => Object.hasOwn(value, key)),
    `${label} is incomplete.`,
  );
}
function number(value, min, max, label, integer = false) {
  required(
    Number.isFinite(value) &&
      value >= min &&
      value <= max &&
      (!integer || Number.isSafeInteger(value)),
    `Invalid ${label}: expected ${integer ? 'integer ' : ''}${min}–${max}.`,
  );
}
function localized(value, label) {
  fields(value, ['en', 'uk'], label);
  required(
    Object.values(value).every(
      (text) => typeof text === 'string' && text.trim().length > 0 && text.length <= 120,
    ),
    `${label} needs bounded EN/UK text.`,
  );
}
/** A conservative camera-overlap proof includes route motion, formation offsets,
 * body radius and spawn jitter. Earlier objectives are gone before a new sector;
 * earlier ordinary packs remain, so their full movement bounds are retained. */
function validateVisibleSpecialists(project) {
  const survivors = [];
  const bounds = (actor) => {
    const count = actor.count ?? 1,
      columns = Math.ceil(Math.sqrt(count));
    const extraX = ((columns - 1) / 2) * (actor.spacing ?? 0) + 10;
    const extraY = ((Math.ceil(count / columns) - 1) / 2) * (actor.spacing ?? 0) + 10;
    const points = [actor, ...actor.route];
    return {
      minX: Math.min(...points.map((p) => p.x)) - extraX - project.arena.cameraWidth / 2,
      maxX: Math.max(...points.map((p) => p.x)) + extraX + project.arena.cameraWidth / 2,
      minY: Math.min(...points.map((p) => p.y)) - extraY - project.arena.cameraHeight / 2,
      maxY: Math.max(...points.map((p) => p.y)) + extraY + project.arena.cameraHeight / 2,
      count,
    };
  };
  const specialist = (actor) => ['shield', 'brace'].includes(actor.behavior);
  for (const encounter of project.encounters) {
    survivors.push(...encounter.packs.filter(specialist).map(bounds));
    const boxes = [...survivors, ...encounter.objectives.filter(specialist).map(bounds)];
    for (const xBox of boxes)
      for (const yBox of boxes) {
        const count = boxes.reduce(
          (sum, box) =>
            sum +
            (xBox.minX >= box.minX &&
            xBox.minX <= box.maxX &&
            yBox.minY >= box.minY &&
            yBox.minY <= box.maxY
              ? box.count
              : 0),
          0,
        );
        required(
          count <= project.population.specialists,
          `Raid routes can bring more than ${project.population.specialists} specialists into one camera in ${encounter.id}. Separate escort routes or reduce guard density; survivors stay on the map.`,
        );
      }
  }
}
export function validateOverflightHuntProject(source) {
  const project = boundedJSON(source, {
    maxBytes: OVERFLIGHT_HUNT_PROJECT_MAX_BYTES,
    maxNodes: 15000,
    maxArray: 128,
    maxDepth: 12,
    maxString: 256,
  });
  fields(
    project,
    [
      'format',
      'id',
      'title',
      'seed',
      'arena',
      'population',
      'encounters',
      'upgrades',
      'resources',
      'props',
      ...(project.format === OVERFLIGHT_HUNT_PROJECT_FORMAT_V2 ? ['difficulty', 'combat'] : []),
    ],
    'Raid project',
  );
  required(
    [OVERFLIGHT_HUNT_PROJECT_FORMAT, OVERFLIGHT_HUNT_PROJECT_FORMAT_V2].includes(project.format),
    'Unsupported Raid project version.',
  );
  const v2 = project.format === OVERFLIGHT_HUNT_PROJECT_FORMAT_V2;
  if (v2) {
    required(OVERFLIGHT_DIFFICULTIES.includes(project.difficulty), 'Unknown difficulty.');
    validateOverflightCombatProfile(project.combat);
  }
  required(stableId(project.id), 'Invalid Raid project ID.');
  localized(project.title, 'Raid title');
  number(project.seed, 1, 0xffffffff, 'seed', true);
  fields(project.arena, ['width', 'height', 'cameraWidth', 'cameraHeight'], 'Raid arena');
  number(project.arena.width, 2880, 5760, 'arena width', true);
  number(project.arena.height, 1080, 2160, 'arena height', true);
  required(
    project.arena.cameraWidth === 960 && project.arena.cameraHeight === 540,
    'Raid V1 uses a 960×540 camera.',
  );
  fields(
    project.population,
    ['capacity', 'specialists', 'heavies', 'priorityAttacks'],
    'Raid population',
  );
  number(project.population.capacity, 1500, 2500, 'enemy capacity', true);
  number(project.population.specialists, 2, 8, 'specialists', true);
  number(project.population.heavies, 3, 4, 'heavies', true);
  number(project.population.priorityAttacks, 1, 2, 'priority attacks', true);
  const location = (value, label) => {
    fields(value, ['x', 'y'], label);
    number(value.x, 40, project.arena.width - 40, `${label} x`);
    number(value.y, 40, project.arena.height - 40, `${label} y`);
  };
  const ids = new Set();
  const identity = (id) => {
    required(
      stableId(id) && !ids.has(id),
      'Raid encounter, pack and objective IDs must be unique.',
    );
    ids.add(id);
  };
  const route = (value) => {
    required(
      Array.isArray(value) && value.length >= 2 && value.length <= 8,
      'Use two to eight committed route points.',
    );
    value.forEach((item) => location(item, 'Route point'));
    required(
      value.some((item) => item.x !== value[0].x || item.y !== value[0].y),
      'A committed route must move between distinct points.',
    );
  };
  const actor = (value) => {
    identity(value.id);
    required(
      [...OVERFLIGHT_SOLDIERS, ...OVERFLIGHT_MACHINERY].includes(value.family),
      'Unsupported Raid actor family.',
    );
    required(
      OVERFLIGHT_HUNT_BEHAVIORS.includes(value.behavior),
      'Unsupported Raid contact behavior.',
    );
    required(
      OVERFLIGHT_MACHINERY.includes(value.family) === (value.behavior === 'vehicle'),
      'Machinery requires vehicle contact behavior.',
    );
    location({ x: value.x, y: value.y }, 'Actor placement');
    route(value.route);
  };
  required(
    Array.isArray(project.encounters) && project.encounters.length === 3,
    'Raid V1 requires three encounter sectors.',
  );
  let total = 0;
  project.encounters.forEach((encounter, sector) => {
    fields(encounter, ['id', 'title', 'sector', 'entry', 'packs', 'objectives'], 'Raid encounter');
    identity(encounter.id);
    localized(encounter.title, 'Encounter title');
    required(encounter.sector === sector, 'Encounter sectors must be ordered 0, 1, 2.');
    location(encounter.entry, 'Sector entry');
    required(
      Array.isArray(encounter.packs) && encounter.packs.length >= 1 && encounter.packs.length <= 20,
      'Use one to twenty finite packs per sector.',
    );
    let specialists = 0,
      heavies = 0;
    for (const pack of encounter.packs) {
      fields(
        pack,
        ['id', 'family', 'behavior', 'count', 'x', 'y', 'spacing', 'speed', 'route'],
        'Raid pack',
      );
      actor(pack);
      required(pack.behavior !== 'vehicle', 'Author machinery as objectives, not ordinary packs.');
      number(pack.count, v2 ? 4 : 6, 20, 'pack size', true);
      number(pack.spacing, 16, 40, 'pack spacing');
      number(pack.speed, 30, 140, 'pack speed');
      const columns = Math.ceil(Math.sqrt(pack.count));
      const marginX = ((columns - 1) / 2) * pack.spacing + 10;
      const marginY = ((Math.ceil(pack.count / columns) - 1) / 2) * pack.spacing + 10;
      required(
        [pack, ...pack.route].every(
          (p) =>
            p.x >= marginX &&
            p.x <= project.arena.width - marginX &&
            p.y >= marginY &&
            p.y <= project.arena.height - marginY,
        ),
        'Raid pack formation reaches beyond the arena. Move its spawn and route points inward or reduce spacing.',
      );

      if (['shield', 'brace'].includes(pack.behavior)) specialists += pack.count;
      total += pack.count;
    }
    required(
      Array.isArray(encounter.objectives) && encounter.objectives.length === [3, 3, 1][sector],
      'Raid sectors require three patrol leaders, three vehicles, then one tank.',
    );
    encounter.objectives.forEach((objective) => {
      fields(
        objective,
        ['id', 'family', 'behavior', 'x', 'y', 'armorSegments', 'route'],
        'Raid objective',
      );
      actor(objective);
      required(objective.behavior !== 'courier', 'Required objectives cannot escape as couriers.');
      if (sector === 0)
        required(
          objective.armorSegments === 0 && objective.behavior !== 'vehicle',
          'Patrol leaders must be infantry.',
        );
      else
        required(
          objective.behavior === 'vehicle',
          'Column and command objectives must be machinery.',
        );
      number(objective.armorSegments, 0, 3, 'armor segments', true);
      if (objective.behavior === 'vehicle') {
        required(objective.armorSegments >= 1, 'Machinery needs at least one armor segment.');
        heavies++;
      }
      if (['shield', 'brace'].includes(objective.behavior)) specialists++;
      total++;
    });
    if (sector === 1)
      required(
        encounter.objectives.map((item) => item.armorSegments).join(',') === '1,1,2',
        'The column requires two light vehicles and a two-segment carrier.',
      );
    if (sector === 2)
      required(
        encounter.objectives[0].family === 'tracked-tank' &&
          encounter.objectives[0].armorSegments === 3,
        'The final objective is a three-segment tank.',
      );
    required(
      specialists <= project.population.specialists && heavies <= project.population.heavies,
      'Encounter exceeds specialist or heavy population limits.',
    );
  });
  required(total <= project.population.capacity, 'Finite Raid population exceeds the actor pool.');
  validateVisibleSpecialists(project);
  fields(project.upgrades, ['choices', 'rerolls', 'thresholds', 'modules'], 'Raid upgrades');
  required(
    project.upgrades.choices === 8,
    'Raid V1 provides six milestone choices and two optional choices.',
  );
  number(project.upgrades.rerolls, 0, 2, 'rerolls', true);
  required(
    Array.isArray(project.upgrades.thresholds) && project.upgrades.thresholds.length === 2,
    'Raid needs two optional kill thresholds.',
  );
  number(project.upgrades.thresholds[0], 1, 100, 'first optional kill threshold', true);
  number(
    project.upgrades.thresholds[1],
    project.upgrades.thresholds[0] + 1,
    300,
    'second optional kill threshold',
    true,
  );
  required(
    Array.isArray(project.upgrades.modules) &&
      project.upgrades.modules.length >= 6 &&
      new Set(project.upgrades.modules).size === project.upgrades.modules.length &&
      project.upgrades.modules.every(
        (id) => OVERFLIGHT_HUNT_UPGRADES.includes(id) && (v2 || id !== 'plating'),
      ),
    'Use at least six distinct registered Raid upgrade families.',
  );
  required(
    canonicalJSON(project.resources) === canonicalJSON(OVERFLIGHT_RESOURCES),
    'Unsupported Raid shared-resource closure. Use industrial-roster-v3 and overflight-field-kit@1 with its registered motion profile.',
  );
  required(
    Array.isArray(project.props) && project.props.length <= 64,
    'At most 64 low supply cases.',
  );
  for (const prop of project.props) {
    fields(prop, ['id', 'kind', 'x', 'y'], 'Raid prop');
    identity(prop.id);
    required(prop.kind === 'supply-case', 'Unsupported Raid prop.');
    location({ x: prop.x, y: prop.y }, 'Supply case');
  }
  return freeze(project);
}
export function compileOverflightHuntProject(source) {
  const project = validateOverflightHuntProject(source);
  return freeze({
    ...project,
    format:
      project.format === OVERFLIGHT_HUNT_PROJECT_FORMAT_V2
        ? OVERFLIGHT_HUNT_COMPILED_FORMAT_V2
        : OVERFLIGHT_HUNT_COMPILED_FORMAT,
    rulesVersion: project.format === OVERFLIGHT_HUNT_PROJECT_FORMAT_V2 ? 2 : 1,
    difficulty: project.difficulty ?? 'standard',
    combat: project.combat ?? null,
    projectIdentity: dataIdentity(project),
    sourceFormat: project.format,
  });
}
