import {
  boundedJSON,
  canonicalJSON,
  dataIdentity,
  exactKeys,
  required,
  stableId,
} from '../data-json.mjs';

export const OVERFLIGHT_PROJECT_FORMAT = 'OverflightProjectV1';
export const OVERFLIGHT_COMPILED_FORMAT = 'OverflightCompiledV1';
export const OVERFLIGHT_PROJECT_MAX_BYTES = 128 * 1024;
export const OVERFLIGHT_SOLDIERS = Object.freeze([
  'lookout',
  'patroller',
  'runner',
  'sprinter',
  'courier',
  'guard',
  'refuge-seeker',
  'switchback',
  'rendezvous-pair',
  'shield-bearer',
  'brace-trooper',
  'relay-warden',
]);
export const OVERFLIGHT_MACHINERY = Object.freeze([
  'utility-car',
  'cargo-truck',
  'armored-carrier',
  'scout-car',
  'tracked-tank',
  'radar-truck',
]);
export const OVERFLIGHT_MODULES = Object.freeze([
  'primary',
  'slow-field',
  'proximity-pulse',
  'side-burst',
  'scanner',
  'shield',
]);
const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
// Code-owned capabilities are exact resource references, never arbitrary URLs or scripts.
export const OVERFLIGHT_RESOURCES = freeze({
  profile: 'board',
  actorArtRevision: 'industrial-roster-v3',
  wardrobes: ['tactical', 'rivals', 'arcade'],
  soldiers: OVERFLIGHT_SOLDIERS,
  machinery: OVERFLIGHT_MACHINERY,
  effects: { id: 'overflight-field-kit', revision: 1 },
  motion: { id: 'overflight-field-kit-motion', revision: 1 },
  pools: { pickups: 2048, effects: 512, projectiles: 512 },
});
const encounterFamilies = {
  front: [
    ['patroller', 'runner'],
    ['lookout', 'guard', 'utility-car'],
    ['sprinter', 'shield-bearer', 'armored-carrier'],
    ['courier', 'brace-trooper', 'cargo-truck'],
  ],
  crossing: [
    ['runner', 'courier'],
    ['switchback', 'scout-car'],
    ['rendezvous-pair', 'refuge-seeker', 'radar-truck'],
    ['sprinter', 'relay-warden', 'utility-car'],
  ],
  mixed: [
    ['patroller', 'lookout'],
    ['guard', 'courier', 'cargo-truck'],
    ['shield-bearer', 'brace-trooper', 'armored-carrier'],
    ['switchback', 'rendezvous-pair', 'relay-warden', 'scout-car', 'radar-truck'],
  ],
};
export function createOverflightProject({ encounterSet = 'front', seed = 17031991 } = {}) {
  required(Object.hasOwn(encounterFamilies, encounterSet), 'Unknown Overflight encounter set.');
  const groups = encounterFamilies[encounterSet];
  const encounters = [];
  for (let index = 0; index < 9; index++) {
    const start = index * 40;
    encounters.push({
      id: `front-${index + 1}`,
      start,
      end: start + 35,
      spawnPerSecond: [3, 5, 7, 10, 13, 17, 32, 38, 40][index],
      speed: [34, 37, 40, 43, 46, 49, 34, 32, 30][index],
      hp: [30, 30, 30, 45, 45, 60, 120, 120, 120][index],
      families: [...groups[index % groups.length]],
      pattern: index % 3 === 2 ? 'surge' : encounterSet === 'crossing' ? 'crossing' : 'pursuit',
    });
    encounters.push({
      id: `relief-${index + 1}`,
      start: start + 35,
      end: start + 40,
      spawnPerSecond: 0.5,
      speed: 34 + index * 3,
      hp: 30,
      families: ['patroller'],
      pattern: 'relief',
    });
  }
  return {
    format: OVERFLIGHT_PROJECT_FORMAT,
    id: `overflight-${encounterSet}`,
    title: {
      en: `Overflight · ${encounterSet === 'front' ? 'Breakthrough' : encounterSet === 'crossing' ? 'Crosswinds' : 'Convergence'}`,
      uk: `Проліт · ${encounterSet === 'front' ? 'Прорив' : encounterSet === 'crossing' ? 'Бічний вітер' : 'Сходження'}`,
    },
    seed,
    arena: { width: 2880, height: 1080, cameraWidth: 960, cameraHeight: 540 },
    duration: 360,
    population: { capacity: 2500, specialists: 8, heavies: 4, priorityAttacks: 2 },
    encounters,
    upgrades: {
      choices: 10,
      rerolls: 2,
      thresholds: [12, 45, 100, 180, 300, 480, 750, 1150, 1750, 2400],
      modules: [...OVERFLIGHT_MODULES],
    },
    goals: { eliteAt: 120, finalAt: 300, finalHp: 5000 },
    resources: structuredClone(OVERFLIGHT_RESOURCES),
    props: [
      { id: 'case-west', x: 960, y: 320, kind: 'supply-case' },
      { id: 'case-east', x: 1920, y: 760, kind: 'supply-case' },
    ],
  };
}
export const DEFAULT_OVERFLIGHT_PROJECT = freeze(createOverflightProject());
function number(value, min, max, label, integer = false) {
  required(
    Number.isFinite(value) &&
      value >= min &&
      value <= max &&
      (!integer || Number.isSafeInteger(value)),
    `Invalid ${label}: expected ${integer ? 'integer ' : ''}${min}–${max}.`,
  );
}
function fields(value, keys, label) {
  exactKeys(value, keys, label);
  required(
    keys.every((key) => Object.hasOwn(value, key)),
    `${label} is incomplete.`,
  );
}
export function validateOverflightProject(source) {
  const project = boundedJSON(source, {
    maxBytes: OVERFLIGHT_PROJECT_MAX_BYTES,
    maxNodes: 12000,
    maxArray: 128,
    maxDepth: 10,
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
      'duration',
      'population',
      'encounters',
      'upgrades',
      'goals',
      'resources',
      'props',
    ],
    'Overflight project',
  );
  required(project.format === OVERFLIGHT_PROJECT_FORMAT, 'Unsupported Overflight project version.');
  required(stableId(project.id), 'Invalid Overflight project ID.');
  fields(project.title, ['en', 'uk'], 'Project title');
  for (const text of Object.values(project.title))
    required(
      typeof text === 'string' && text.trim().length > 0 && text.length <= 120,
      'Project needs bounded EN/UK titles.',
    );
  number(project.seed, 1, 0xffffffff, 'seed', true);
  fields(project.arena, ['width', 'height', 'cameraWidth', 'cameraHeight'], 'Arena');
  number(project.arena.width, 960, 5760, 'arena width', true);
  number(project.arena.height, 540, 2160, 'arena height', true);
  required(
    project.arena.cameraWidth === 960 && project.arena.cameraHeight === 540,
    'Overflight V1 uses a 960×540 camera.',
  );
  number(project.duration, 60, 360, 'duration', true);
  fields(
    project.population,
    ['capacity', 'specialists', 'heavies', 'priorityAttacks'],
    'Population',
  );
  number(project.population.capacity, 1500, 2500, 'enemy pool', true);
  number(project.population.specialists, 0, 8, 'specialists', true);
  number(project.population.heavies, 0, 4, 'heavies', true);
  number(project.population.priorityAttacks, 0, 2, 'priority attacks', true);
  required(
    Array.isArray(project.encounters) &&
      project.encounters.length > 0 &&
      project.encounters.length <= 48,
    'Use one to 48 encounters.',
  );
  const ids = new Set();
  let previousEnd = 0;
  for (const encounter of project.encounters) {
    fields(
      encounter,
      ['id', 'start', 'end', 'spawnPerSecond', 'speed', 'hp', 'families', 'pattern'],
      'Encounter',
    );
    required(stableId(encounter.id) && !ids.has(encounter.id), 'Encounter IDs must be unique.');
    ids.add(encounter.id);
    number(encounter.start, previousEnd, project.duration, 'encounter start');
    number(encounter.end, encounter.start + 1, project.duration, 'encounter end');
    previousEnd = encounter.end;
    number(encounter.spawnPerSecond, 0, 40, 'spawn rate');
    number(encounter.speed, 10, 140, 'enemy speed');
    number(encounter.hp, 1, 300, 'enemy hull');
    required(
      ['pursuit', 'crossing', 'surge', 'relief'].includes(encounter.pattern),
      'Unsupported encounter pattern.',
    );
    required(
      Array.isArray(encounter.families) &&
        encounter.families.length > 0 &&
        new Set(encounter.families).size === encounter.families.length &&
        encounter.families.every((id) =>
          [...OVERFLIGHT_SOLDIERS, ...OVERFLIGHT_MACHINERY].includes(id),
        ),
      'Use supported, distinct native families.',
    );
  }
  fields(project.upgrades, ['choices', 'rerolls', 'thresholds', 'modules'], 'Upgrades');
  number(project.upgrades.choices, 1, 10, 'choices', true);
  number(project.upgrades.rerolls, 0, 2, 'rerolls', true);
  required(
    Array.isArray(project.upgrades.thresholds) &&
      project.upgrades.thresholds.length === project.upgrades.choices,
    'Each choice needs a cumulative salvage threshold.',
  );
  let previous = 0;
  for (const threshold of project.upgrades.thresholds) {
    number(threshold, previous + 1, 10000, 'salvage threshold', true);
    previous = threshold;
  }
  required(
    Array.isArray(project.upgrades.modules) &&
      project.upgrades.modules.includes('primary') &&
      new Set(project.upgrades.modules).size === project.upgrades.modules.length &&
      project.upgrades.modules.every((id) => OVERFLIGHT_MODULES.includes(id)),
    'Unsupported or repeated module capability.',
  );
  fields(project.goals, ['eliteAt', 'finalAt', 'finalHp'], 'Goals');
  number(project.goals.eliteAt, 10, project.duration - 20, 'elite arrival');
  number(project.goals.finalAt, project.goals.eliteAt + 10, project.duration, 'final arrival');
  number(project.goals.finalHp, 300, 10000, 'final hull', true);
  required(
    canonicalJSON(project.resources) === canonicalJSON(OVERFLIGHT_RESOURCES),
    'Unsupported shared resource references; this runtime needs overflight-field-kit@1 and industrial-roster-v3.',
  );
  required(
    Array.isArray(project.props) && project.props.length <= 64,
    'At most 64 low supply cases.',
  );
  const propIds = new Set();
  for (const prop of project.props) {
    fields(prop, ['id', 'kind', 'x', 'y'], 'Arena prop');
    required(
      stableId(prop.id) && !propIds.has(prop.id) && prop.kind === 'supply-case',
      'Invalid supply case.',
    );
    propIds.add(prop.id);
    number(prop.x, 0, project.arena.width, 'prop x');
    number(prop.y, 0, project.arena.height, 'prop y');
  }
  return freeze(project);
}
export function compileOverflightProject(source) {
  const project = validateOverflightProject(source);
  return freeze({
    ...project,
    format: OVERFLIGHT_COMPILED_FORMAT,
    projectIdentity: dataIdentity(project),
    sourceFormat: project.format,
  });
}
