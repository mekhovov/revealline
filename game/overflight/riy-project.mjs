import { overflightGameplayIdentity } from './worlds.mjs';
import { boundedJSON, exactKeys, required } from '../data-json.mjs';
import {
  createOverflightProject,
  validateOverflightProject,
  compileOverflightProject,
  OVERFLIGHT_PROJECT_MAX_BYTES,
} from './project.mjs';
import { upgradeOverflightProjectCopy } from './project-upgrade.mjs';

export const OVERFLIGHT_RIY_PROJECT_FORMAT = 'OverflightRiyProjectV1';
export const OVERFLIGHT_RIY_PROJECT_FORMAT_V2 = 'OverflightRiyProjectV2';
export const OVERFLIGHT_RIY_PROJECT_FORMAT_V3 = 'OverflightRiyProjectV3';
export const OVERFLIGHT_RIY_MAX_BYTES = OVERFLIGHT_PROJECT_MAX_BYTES + 4096;
const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
export const OVERFLIGHT_RIY_DEFAULTS = freeze({
  focusRange: 360,
  leash: 420,
  focusSeconds: 3,
  commandCooldown: 6,
  escortSpeed: 260,
  attackRange: 120,
  defendRange: 105,
  focusForward: -65,
  escorts: [
    {
      role: 'sweeper',
      forward: -38,
      lateral: -52,
      damage: 12,
      radius: 40,
      interval: 1.1,
    },
    {
      role: 'breaker',
      forward: -38,
      lateral: 52,
      damage: 36,
      radius: 10,
      interval: 1.8,
    },
  ],
});
export const OVERFLIGHT_RIY_FIELDS = Object.freeze([
  ['focusRange', 180, 500, 10, 'Focus range', 'Дальність фокуса'],
  ['leash', 200, 600, 10, 'Recall distance', 'Відстань повернення'],
  ['focusSeconds', 1, 6, 0.25, 'Focus duration (seconds)', 'Тривалість фокуса (с)'],
  ['commandCooldown', 2, 12, 0.25, 'Command cooldown (seconds)', 'Відновлення команди (с)'],
  ['escortSpeed', 180, 360, 10, 'Escort speed', 'Швидкість супроводу'],
  ['attackRange', 60, 180, 5, 'Attack range', 'Дальність атаки'],
  ['defendRange', 40, 180, 5, 'Follow-mode targeting range', 'Дальність цілей у супроводі'],
  ['focusForward', -120, -20, 5, 'Focused formation offset', 'Відступ строю у фокусі'],
]);
export const OVERFLIGHT_RIY_ESCORT_FIELDS = Object.freeze([
  ['forward', -120, 0, 5, 'Forward offset', 'Поздовжній відступ'],
  ['lateral', -120, 120, 5, 'Side offset', 'Бічний відступ'],
  ['damage', 1, 60, 1, 'Impact damage', 'Шкода від удару'],
  ['radius', 1, 60, 1, 'Impact radius', 'Радіус удару'],
  ['interval', 0.5, 4, 0.1, 'Attack interval (seconds)', 'Інтервал атак (с)'],
]);
export const OVERFLIGHT_RIY_FIELDS_V2 = Object.freeze([
  ...OVERFLIGHT_RIY_FIELDS.filter(([key]) => !['attackRange', 'defendRange'].includes(key)),
  [
    'approachSeconds',
    0.5,
    2,
    0.25,
    'Maximum focus approach (seconds)',
    'Максимальний захід у фокусі (с)',
  ],
]);
export const OVERFLIGHT_RIY_ESCORT_FIELDS_V2 = Object.freeze([
  ...OVERFLIGHT_RIY_ESCORT_FIELDS,
  ['followArc', 60, 180, 5, 'Follow firing arc (degrees)', 'Сектор вогню в строю (градуси)'],
  ['attackRange', 80, 220, 5, 'Attack range', 'Дальність атаки'],
]);
function upgradedSettings(source) {
  const { attackRange, defendRange: _defendRange, ...shared } = structuredClone(source);
  return {
    ...shared,
    approachSeconds: 2,
    intro: [
      { facing: 'rear', start: 0, end: 12, count: 18 },
      { facing: 'front', start: 12, end: 30, count: 36 },
    ],
    commandCooldown: Math.max(shared.commandCooldown, shared.focusSeconds + 2),
    escorts: source.escorts.map((escort) => ({
      ...escort,
      followArc: escort.role === 'sweeper' ? 140 : 120,
      attackRange:
        escort.role === 'sweeper' ? Math.max(80, attackRange) : Math.min(220, attackRange + 60),
    })),
  };
}
export const OVERFLIGHT_RIY_DEFAULTS_V2 = freeze(upgradedSettings(OVERFLIGHT_RIY_DEFAULTS));
function numericFields(value, fields) {
  for (const [key, min, max] of fields)
    required(
      Number.isFinite(value[key]) && value[key] >= min && value[key] <= max,
      `Riy ${key} must be between ${min} and ${max}.`,
    );
}
export function validateOverflightRiySettings(source, version = 1) {
  const value = boundedJSON(source, {
    maxBytes: 4096,
    maxDepth: 4,
    maxArray: 2,
    maxNodes: 100,
  });
  const fields = version === 2 ? OVERFLIGHT_RIY_FIELDS_V2 : OVERFLIGHT_RIY_FIELDS;
  const escortFields =
    version === 2 ? OVERFLIGHT_RIY_ESCORT_FIELDS_V2 : OVERFLIGHT_RIY_ESCORT_FIELDS;
  exactKeys(
    value,
    [...fields.map(([key]) => key), 'escorts', ...(version === 2 ? ['intro'] : [])],
    'Riy settings',
  );
  if (version === 2) {
    required(
      Array.isArray(value.intro) && value.intro.length === 2,
      'Riy introduction needs rear then front packs.',
    );
    for (const [index, pack] of value.intro.entries()) {
      exactKeys(pack, ['facing', 'start', 'end', 'count'], 'Riy introduction pack');
      required(
        pack.facing === (index ? 'front' : 'rear'),
        'Riy introduction teaches rear then front coverage.',
      );
      required(
        Number.isFinite(pack.start) &&
          Number.isFinite(pack.end) &&
          pack.start === (index ? value.intro[0].end : 0) &&
          pack.end - pack.start >= 5 &&
          pack.end - pack.start <= 20 &&
          pack.end <= 30,
        'Riy introduction packs must connect within the first 30 seconds.',
      );
      required(
        Number.isInteger(pack.count) && pack.count >= 4 && pack.count <= 48,
        'Riy introduction pack needs four to 48 infantry.',
      );
    }
  }
  numericFields(value, fields);
  required(value.leash >= value.focusRange, 'Riy recall distance must cover focus range.');
  required(
    value.commandCooldown >= value.focusSeconds + (version === 2 ? value.approachSeconds : 0),
    'Riy command cooldown must cover focus duration.',
  );
  if (version === 1)
    required(
      value.defendRange <= value.attackRange,
      'Riy follow targeting range must not exceed attack range.',
    );
  required(
    Array.isArray(value.escorts) && value.escorts.length === 2,
    'Riy needs exactly two escorts.',
  );
  for (const escort of value.escorts) {
    exactKeys(escort, ['role', ...escortFields.map(([key]) => key)], 'Riy escort');
    required(['sweeper', 'breaker'].includes(escort.role), 'Unsupported Riy escort role.');
    numericFields(escort, escortFields);
  }
  required(
    new Set(value.escorts.map(({ role }) => role)).size === 2,
    'Riy needs one sweeper and one breaker.',
  );
  required(
    Math.hypot(
      value.escorts[0].forward - value.escorts[1].forward,
      value.escorts[0].lateral - value.escorts[1].lateral,
    ) >= 24,
    'Riy escorts need at least 24 units of separation.',
  );
  return freeze(value);
}
export function overflightRiySurvivorProject(source) {
  const { riy: _riy, survivorFormat, ...base } = source;
  return { ...base, format: survivorFormat };
}
export function createOverflightRiyProject(options = {}) {
  const base = createOverflightProject(options);
  const v3 = base.format === 'OverflightProjectV4';
  const v2 = v3 || base.format === 'OverflightProjectV3';
  if (v2)
    base.upgrades.modules = base.upgrades.modules.filter((id) =>
      ['primary', 'scanner', 'shield', 'plating'].includes(id),
    );
  return {
    ...base,
    id: `riy-${base.id}`,
    title: { en: `Riy · ${base.title.en}`, uk: `Рій · ${base.title.uk}` },
    survivorFormat: base.format,
    format: v3
      ? OVERFLIGHT_RIY_PROJECT_FORMAT_V3
      : v2
        ? OVERFLIGHT_RIY_PROJECT_FORMAT_V2
        : OVERFLIGHT_RIY_PROJECT_FORMAT,
    riy: structuredClone(v2 ? OVERFLIGHT_RIY_DEFAULTS_V2 : OVERFLIGHT_RIY_DEFAULTS),
  };
}
export function validateOverflightRiyProject(source) {
  const project = boundedJSON(source, {
    maxBytes: OVERFLIGHT_RIY_MAX_BYTES,
    maxNodes: 15000,
    maxArray: 128,
    maxDepth: 12,
  });
  required(
    [
      OVERFLIGHT_RIY_PROJECT_FORMAT,
      OVERFLIGHT_RIY_PROJECT_FORMAT_V2,
      OVERFLIGHT_RIY_PROJECT_FORMAT_V3,
    ].includes(project.format),
    'Unsupported Riy project version.',
  );
  const v3 = project.format === OVERFLIGHT_RIY_PROJECT_FORMAT_V3;
  const v2 = v3 || project.format === OVERFLIGHT_RIY_PROJECT_FORMAT_V2;
  required(
    v3
      ? project.survivorFormat === 'OverflightProjectV4'
      : v2
        ? project.survivorFormat === 'OverflightProjectV3'
        : ['OverflightProjectV1', 'OverflightProjectV2'].includes(project.survivorFormat),
    'Riy project and Survivor rules versions do not match.',
  );
  const base = validateOverflightProject(overflightRiySurvivorProject(project));
  if (v2)
    required(
      base.upgrades.modules.every((id) => ['primary', 'scanner', 'shield', 'plating'].includes(id)),
      'Riy squad slots belong to the escorts.',
    );
  const riy = validateOverflightRiySettings(project.riy, v2 ? 2 : 1);
  return freeze({
    ...base,
    format: project.format,
    survivorFormat: base.format,
    riy,
  });
}
export function compileOverflightRiyProject(source) {
  const project = validateOverflightRiyProject(source);
  const base = compileOverflightProject(overflightRiySurvivorProject(project));
  return freeze({
    ...base,
    sourceFormat: project.format,
    projectIdentity: overflightGameplayIdentity(project),
    riyVersion: project.format !== OVERFLIGHT_RIY_PROJECT_FORMAT ? 2 : 1,
    riy: project.riy,
  });
}
export function upgradeOverflightRiyProjectCopy(source, options) {
  const project = validateOverflightRiyProject(source);
  const base = upgradeOverflightProjectCopy(overflightRiySurvivorProject(project), options);
  const v3 = base.format === 'OverflightProjectV4';
  const v2 = v3 || base.format === 'OverflightProjectV3';
  if (v2)
    base.upgrades.modules = base.upgrades.modules.filter((id) =>
      ['primary', 'scanner', 'shield', 'plating'].includes(id),
    );
  return {
    ...base,
    format: v3
      ? OVERFLIGHT_RIY_PROJECT_FORMAT_V3
      : v2
        ? OVERFLIGHT_RIY_PROJECT_FORMAT_V2
        : OVERFLIGHT_RIY_PROJECT_FORMAT,
    survivorFormat: base.format,
    riy:
      v2 && project.format === OVERFLIGHT_RIY_PROJECT_FORMAT
        ? upgradedSettings(project.riy)
        : structuredClone(project.riy),
  };
}
