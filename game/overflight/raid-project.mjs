import { validateOverflightPresentationCover } from './world-layout-presentation.mjs';
import {
  OVERFLIGHT_BATTLEFIELDS,
  applyOverflightBattlefield,
  validateOverflightBattlefieldProject,
  validateOverflightMovement,
} from './battlefields.mjs';
import { validateOverflightTerrain } from './terrain.mjs';
import {
  applyOverflightWorld,
  createOverflightWorldPresentation,
  validateOverflightEncounterProfile,
  validateOverflightWorldPresentation,
  overflightGameplayIdentity,
  overflightPresentationIdentity,
} from './worlds.mjs';
import {
  createOverflightCombatProfile,
  validateOverflightCombatProfile,
} from './combat-profile.mjs';
import { seededOverflightRandom, validateOverflightSupplyTerrain } from './tactics.mjs';
import { boundedJSON, canonicalJSON, exactKeys, required, stableId } from '../data-json.mjs';
import { OVERFLIGHT_RESOURCES, OVERFLIGHT_SOLDIERS, OVERFLIGHT_MACHINERY } from './project.mjs';

export const OVERFLIGHT_HUNT_PROJECT_FORMAT = 'OverflightHuntProjectV1';
export const OVERFLIGHT_HUNT_COMPILED_FORMAT = 'OverflightHuntCompiledV1';
export const OVERFLIGHT_HUNT_PROJECT_FORMAT_V2 = 'OverflightHuntProjectV2';
export const OVERFLIGHT_HUNT_COMPILED_FORMAT_V2 = 'OverflightHuntCompiledV2';
export const OVERFLIGHT_HUNT_PROJECT_FORMAT_V3 = 'OverflightHuntProjectV3';
export const OVERFLIGHT_HUNT_COMPILED_FORMAT_V3 = 'OverflightHuntCompiledV3';
export const OVERFLIGHT_HUNT_PROJECT_FORMAT_V4 = 'OverflightHuntProjectV4';
export const OVERFLIGHT_HUNT_COMPILED_FORMAT_V4 = 'OverflightHuntCompiledV4';
export const OVERFLIGHT_HUNT_BALANCE_REVISION_V4 = 'overflight-balance.v4';
export const OVERFLIGHT_HUNT_BALANCE_REVISION = 'overflight-balance.v3';
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

/** Shared compiler/Studio boundary: small wings do not shrink ordinary crowds. */
export function overflightHuntMinimumPackSize(format, behavior) {
  return [
    OVERFLIGHT_HUNT_PROJECT_FORMAT_V2,
    OVERFLIGHT_HUNT_PROJECT_FORMAT_V3,
    OVERFLIGHT_HUNT_PROJECT_FORMAT_V4,
  ].includes(format)
    ? ['shield', 'brace'].includes(behavior)
      ? 2
      : 4
    : 6;
}

/** Finite encounter populations: advancing a sector never replaces casualties. */
export function createOverflightHuntProject({
  world = null,
  layout = null,
  encounterSet = 'patrol',
  seed = 17031991,
  difficulty = 'standard',
  legacy = false,
  rulesVersion = legacy ? 1 : 2,
} = {}) {
  legacy = legacy || rulesVersion === 1;
  const v3 = !legacy && rulesVersion >= 3;
  required([1, 2, 3, 4].includes(rulesVersion), 'Unknown Raid rules version.');
  required(
    (v3 ? ['relaxed', 'standard', 'veteran'] : ['standard', 'veteran']).includes(difficulty),
    'Unknown difficulty.',
  );
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
        count: legacy || difficulty === 'veteran' ? 16 : difficulty === 'relaxed' ? 10 : 12,
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
    // A finite shield screen and an offset brace wing create two approaches:
    // flank the committed facing, or sweep the exposed wing after its warning.
    // Their combined population is unchanged and old-sector survivors remain.
    const escortX = [420, 1550, 2680][sector];
    const escortY = !legacy && sector === 1 ? 760 : 540;
    const shieldScreen = !legacy && sector === 1;
    const escort = (suffix, shield, y, count) => ({
      id: `${id}-escort${suffix}`,
      family: shield ? 'shield-bearer' : 'brace-trooper',
      behavior: shield ? 'shield' : 'brace',
      count,
      x: escortX,
      y,
      spacing: 32,
      speed: 42,
      route: [point(escortX + 35, y + 25), point(escortX - 35, y - 25)],
    });
    if (legacy) {
      packs.push({ ...escort('', false, escortY, 6), spacing: 24 });
    } else {
      const wingSize = !v3 && difficulty === 'veteran' ? 3 : 2;
      packs.push(escort('', shieldScreen, escortY - 42, wingSize));
      packs.push(escort('-wing', !shieldScreen, escortY + 42, wingSize));
    }
    const objective = (name, family, behavior, x, y, armorSegments = 0) => {
      // Keep the exposed introductory pass identical. Later sets teach distinct
      // interception geometry, rather than changing ordinary crowds only.
      const placement =
        !legacy &&
        {
          crossing: {
            'leader-2': point(710, 700),
            'leader-3': point(800, 300),
            'light-1': point(1230, 300),
            'light-2': point(1550, 700),
            carrier: point(1780, 400),
            'command-tank': point(2530, 430),
          },
          mixed: {
            'leader-2': point(670, 770),
            'leader-3': point(780, 360),
            'light-1': point(1270, 600),
            'light-2': point(1510, 360),
            carrier: point(1770, 740),
            'command-tank': point(2640, 660),
          },
        }[encounterSet]?.[name];
      if (placement) ({ x, y } = placement);
      let route = [point(x + 65, y + 60), point(x - 65, y - 60)];
      if (!legacy && name !== 'leader-1') {
        const bounds = (dx, dy) =>
          point(
            Math.max(left + 90, Math.min(left + 860, x + dx)),
            Math.max(120, Math.min(950, y + dy)),
          );
        route =
          encounterSet === 'crossing'
            ? [bounds(-110, 150), bounds(95, -140)]
            : encounterSet === 'mixed'
              ? [bounds(-110, -100), bounds(70, -125), bounds(60, 115)]
              : [bounds(90, 35), bounds(-110, 80), bounds(-30, -60)];
      }
      return { id: name, family, behavior, x, y, armorSegments, route };
    };
    const encounter = {
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
    if (v3) {
      const defended = encounter.objectives.at(-1);
      for (const [index, wing] of encounter.packs
        .filter((pack) => ['shield', 'brace'].includes(pack.behavior))
        .entries()) {
        const dx = -72,
          dy = index ? 68 : -68;
        wing.escortOf = defended.id;
        wing.x = defended.x + dx;
        wing.y = defended.y + dy;
        wing.speed = 80;
        wing.route = defended.route.map((p) => point(p.x + dx, p.y + dy));
      }
    }
    return encounter;
  });
  const project = {
    format: legacy
      ? OVERFLIGHT_HUNT_PROJECT_FORMAT
      : rulesVersion >= 4
        ? OVERFLIGHT_HUNT_PROJECT_FORMAT_V4
        : v3
          ? OVERFLIGHT_HUNT_PROJECT_FORMAT_V3
          : OVERFLIGHT_HUNT_PROJECT_FORMAT_V2,
    ...(!legacy
      ? {
          difficulty,
          combat: createOverflightCombatProfile(difficulty, v3 ? 3 : 2),
        }
      : {}),
    ...(v3
      ? {
          balanceRevision:
            rulesVersion >= 4
              ? OVERFLIGHT_HUNT_BALANCE_REVISION_V4
              : OVERFLIGHT_HUNT_BALANCE_REVISION,
          medalBudgets: {
            gold: 90,
            silver: 150,
            bronze: 240,
            provisional: true,
          },
        }
      : {}),
    id: `overflight-raid-${encounterSet}`,
    title: title(
      `Overflight: Raid · ${encounterSet === 'patrol' ? 'Patrol Break' : encounterSet === 'crossing' ? 'Crossing Lines' : 'Countermove'}`,
      `Проліт: Наліт · ${encounterSet === 'patrol' ? 'Зрив патруля' : encounterSet === 'crossing' ? 'Перетин маршрутів' : 'Контрхід'}`,
    ),
    seed,
    arena: { width: 2880, height: 1080, cameraWidth: 960, cameraHeight: 540 },
    population: {
      capacity: 1500,
      specialists: 8,
      heavies: 4,
      priorityAttacks: 2,
    },
    encounters,
    upgrades: {
      choices: 8,
      rerolls: 2,
      thresholds: [10, 35],
      modules: OVERFLIGHT_HUNT_UPGRADES.filter((id) => !legacy || id !== 'plating'),
    },
    resources: structuredClone(OVERFLIGHT_RESOURCES),
    props: [
      {
        id: 'raid-case-west',
        kind: 'supply-case',
        x: legacy ? 980 : 520,
        y: 320,
      },
      {
        id: 'raid-case-east',
        kind: 'supply-case',
        x: legacy ? 1910 : 1500,
        y: 650,
      },
    ],
  };
  if (!legacy && rulesVersion >= 4) {
    const chosen =
      layout ??
      OVERFLIGHT_BATTLEFIELDS.find((entry) => entry.world === (world ?? 'field-crossing'))?.id;
    required(chosen, 'Choose a known battlefield layout.');
    const result = applyOverflightBattlefield(project, chosen);
    result.presentation = createOverflightWorldPresentation(
      result.battlefield.world,
      result.arena,
      { layout: result.battlefield },
    );
    return result;
  }
  required(!layout, 'Battlefield layouts require V4 rules.');
  return world ? applyOverflightWorld(project, world) : project;
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
      ...(project.presentation !== undefined ? ['presentation'] : []),
      ...(project.encounterProfile !== undefined ? ['encounterProfile'] : []),
      ...(project.terrain !== undefined ? ['terrain'] : []),
      ...(project.battlefield !== undefined ? ['battlefield'] : []),
      ...([
        OVERFLIGHT_HUNT_PROJECT_FORMAT_V2,
        OVERFLIGHT_HUNT_PROJECT_FORMAT_V3,
        OVERFLIGHT_HUNT_PROJECT_FORMAT_V4,
      ].includes(project.format)
        ? ['difficulty', 'combat']
        : []),
      ...(['OverflightHuntProjectV3', 'OverflightHuntProjectV4'].includes(project.format)
        ? ['balanceRevision', 'medalBudgets']
        : []),
    ],
    'Raid project',
  );
  required(
    [
      OVERFLIGHT_HUNT_PROJECT_FORMAT,
      OVERFLIGHT_HUNT_PROJECT_FORMAT_V2,
      OVERFLIGHT_HUNT_PROJECT_FORMAT_V3,
      OVERFLIGHT_HUNT_PROJECT_FORMAT_V4,
    ].includes(project.format),
    'Unsupported Raid project version.',
  );
  const v4 = project.format === OVERFLIGHT_HUNT_PROJECT_FORMAT_V4;
  const v3 = v4 || project.format === OVERFLIGHT_HUNT_PROJECT_FORMAT_V3;
  const v2 = v3 || project.format === OVERFLIGHT_HUNT_PROJECT_FORMAT_V2;
  if (v2) {
    required(
      (v3 ? ['relaxed', 'standard', 'veteran'] : ['standard', 'veteran']).includes(
        project.difficulty,
      ),
      'Unknown difficulty.',
    );
    validateOverflightCombatProfile(project.combat, v3 ? 3 : 2);
  }
  if (v3) {
    required(
      project.balanceRevision ===
        (v4 ? OVERFLIGHT_HUNT_BALANCE_REVISION_V4 : OVERFLIGHT_HUNT_BALANCE_REVISION),
      'Unsupported Raid balance revision.',
    );
    fields(project.medalBudgets, ['gold', 'silver', 'bronze', 'provisional'], 'Medal budgets');
    number(project.medalBudgets.gold, 10, 1800, 'Gold medal time');
    number(project.medalBudgets.silver, project.medalBudgets.gold + 1, 2400, 'Silver medal time');
    number(project.medalBudgets.bronze, project.medalBudgets.silver + 1, 3600, 'Bronze medal time');
    required(
      typeof project.medalBudgets.provisional === 'boolean',
      'Medal calibration needs a provisional flag.',
    );
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
    if (value.movement !== undefined) validateOverflightMovement(value.movement, project.arena);
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
        [
          'id',
          'family',
          'behavior',
          'count',
          'x',
          'y',
          'spacing',
          'speed',
          'route',
          ...(v3 && Object.hasOwn(pack, 'escortOf') ? ['escortOf'] : []),
          ...(v4 && pack.movement !== undefined ? ['movement'] : []),
        ],
        'Raid pack',
      );
      actor(pack);
      if (Object.hasOwn(pack, 'escortOf')) {
        const defended = encounter.objectives.find((target) => target.id === pack.escortOf);
        required(
          v3 && ['shield', 'brace'].includes(pack.behavior) && defended,
          'Escort must defend an objective in its own sector.',
        );
        const dx = pack.x - defended.x,
          dy = pack.y - defended.y;
        required(Math.hypot(dx, dy) <= 180, 'Escort must stay within 180 units of its objective.');
        required(
          pack.route.length === defended.route.length &&
            pack.route.every(
              (p, i) =>
                Math.abs(p.x - defended.route[i].x - dx) < 1e-7 &&
                Math.abs(p.y - defended.route[i].y - dy) < 1e-7,
            ),
          'Escort routes must preserve their authored offset from the defended objective.',
        );
      }
      required(pack.behavior !== 'vehicle', 'Author machinery as objectives, not ordinary packs.');
      number(
        pack.count,
        overflightHuntMinimumPackSize(project.format, pack.behavior),
        20,
        'pack size',
        true,
      );
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
        [
          'id',
          'family',
          'behavior',
          'x',
          'y',
          'armorSegments',
          'route',
          ...(v4 && objective.movement !== undefined ? ['movement'] : []),
        ],
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
  if (project.terrain !== undefined) {
    required(v3, 'Experimental terrain requires current rules.');
    project.terrain = validateOverflightTerrain(project.terrain, project.arena);
    validateOverflightSupplyTerrain(project);
  }
  if (project.encounterProfile !== undefined) {
    required(v3, 'Authored world encounters require current rules.');
    validateOverflightEncounterProfile(project.encounterProfile);
  }
  if (project.presentation !== undefined) {
    required(v3, 'World presentation requires current rules.');
    project.presentation = validateOverflightWorldPresentation(project.presentation, project.arena);
  }
  if (project.battlefield !== undefined) {
    required(v4, 'Battlefield layouts require V4 rules.');
    project.battlefield = validateOverflightBattlefieldProject(project);
    if (project.presentation)
      validateOverflightPresentationCover(project.presentation, project.terrain);
  }
  if (project.terrain?.format === 'OverflightTerrainV2')
    required(v4 && project.battlefield, 'Terrain V2 needs a V4 battlefield snapshot.');
  return freeze(project);
}
export function compileOverflightHuntProject(source) {
  const project = validateOverflightHuntProject(source);
  return freeze({
    ...project,
    format:
      project.format === OVERFLIGHT_HUNT_PROJECT_FORMAT_V4
        ? OVERFLIGHT_HUNT_COMPILED_FORMAT_V4
        : project.format === OVERFLIGHT_HUNT_PROJECT_FORMAT_V3
          ? OVERFLIGHT_HUNT_COMPILED_FORMAT_V3
          : project.format === OVERFLIGHT_HUNT_PROJECT_FORMAT_V2
            ? OVERFLIGHT_HUNT_COMPILED_FORMAT_V2
            : OVERFLIGHT_HUNT_COMPILED_FORMAT,
    rulesVersion:
      project.format === OVERFLIGHT_HUNT_PROJECT_FORMAT_V4
        ? 4
        : project.format === OVERFLIGHT_HUNT_PROJECT_FORMAT_V3
          ? 3
          : project.format === OVERFLIGHT_HUNT_PROJECT_FORMAT_V2
            ? 2
            : 1,
    difficulty: project.difficulty ?? 'standard',
    combat: project.combat ?? null,
    projectIdentity: overflightGameplayIdentity(project),
    visualIdentity: overflightPresentationIdentity(project),
    sourceFormat: project.format,
  });
}
