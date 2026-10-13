import { boundedJSON, dataIdentity, exactKeys, required } from '../data-json.mjs';
import {
  createOverflightProject,
  validateOverflightProject,
  compileOverflightProject,
  OVERFLIGHT_PROJECT_MAX_BYTES,
} from './project.mjs';
import { upgradeOverflightProjectCopy } from './project-upgrade.mjs';

export const OVERFLIGHT_RIY_PROJECT_FORMAT = 'OverflightRiyProjectV1';
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
function numericFields(value, fields) {
  for (const [key, min, max] of fields)
    required(
      Number.isFinite(value[key]) && value[key] >= min && value[key] <= max,
      `Riy ${key} must be between ${min} and ${max}.`,
    );
}
export function validateOverflightRiySettings(source) {
  const value = boundedJSON(source, {
    maxBytes: 4096,
    maxDepth: 4,
    maxArray: 2,
    maxNodes: 100,
  });
  exactKeys(value, [...OVERFLIGHT_RIY_FIELDS.map(([key]) => key), 'escorts'], 'Riy settings');
  numericFields(value, OVERFLIGHT_RIY_FIELDS);
  required(value.leash >= value.focusRange, 'Riy recall distance must cover focus range.');
  required(
    value.commandCooldown >= value.focusSeconds,
    'Riy command cooldown must cover focus duration.',
  );
  required(
    value.defendRange <= value.attackRange,
    'Riy follow targeting range must not exceed attack range.',
  );
  required(
    Array.isArray(value.escorts) && value.escorts.length === 2,
    'Riy needs exactly two escorts.',
  );
  for (const escort of value.escorts) {
    exactKeys(escort, ['role', ...OVERFLIGHT_RIY_ESCORT_FIELDS.map(([key]) => key)], 'Riy escort');
    required(['sweeper', 'breaker'].includes(escort.role), 'Unsupported Riy escort role.');
    numericFields(escort, OVERFLIGHT_RIY_ESCORT_FIELDS);
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
  return {
    ...base,
    id: `riy-${base.id}`,
    title: { en: `Riy · ${base.title.en}`, uk: `Рій · ${base.title.uk}` },
    survivorFormat: base.format,
    format: OVERFLIGHT_RIY_PROJECT_FORMAT,
    riy: structuredClone(OVERFLIGHT_RIY_DEFAULTS),
  };
}
export function validateOverflightRiyProject(source) {
  const project = boundedJSON(source, {
    maxBytes: OVERFLIGHT_RIY_MAX_BYTES,
    maxNodes: 15000,
    maxArray: 128,
    maxDepth: 12,
  });
  required(project.format === OVERFLIGHT_RIY_PROJECT_FORMAT, 'Unsupported Riy project version.');
  const base = validateOverflightProject(overflightRiySurvivorProject(project));
  const riy = validateOverflightRiySettings(project.riy);
  return freeze({
    ...base,
    format: OVERFLIGHT_RIY_PROJECT_FORMAT,
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
    projectIdentity: dataIdentity(project),
    riy: project.riy,
  });
}
export function upgradeOverflightRiyProjectCopy(source, options) {
  const project = validateOverflightRiyProject(source);
  const base = upgradeOverflightProjectCopy(overflightRiySurvivorProject(project), options);
  return {
    ...base,
    format: OVERFLIGHT_RIY_PROJECT_FORMAT,
    survivorFormat: base.format,
    riy: structuredClone(project.riy),
  };
}
