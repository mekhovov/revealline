import { boundedJSON, dataIdentity } from '../../game/data-json.mjs';

const title = (en, uk) => ({ en, uk });
const profile = (id, names, palette, extras = {}) =>
  Object.freeze({
    format: 'ThemeProfile.v1',
    id,
    revision: 'r1',
    title: names,
    palette,
    textureFilter: 'linear',
    drone: 'racer',
    characters: 'civilian',
    assets: {
      gate: 'builtin:gate',
      marker: 'builtin:beacon',
      enemy: 'builtin:sentry',
      vehicle: 'builtin:vehicle',
    },
    audio: { ambience: 'hangar', motor: 'quad', gate: 'chime' },
    ui: { accent: '#a2dfcf', font: 'system-ui', borderRadius: 12 },
    ...extras,
  });
export const THEME_PROFILES = Object.freeze([
  profile('academy', title('Flight Academy', 'Льотна академія'), {
    sky: 0xb5d5e2,
    fog: 0xc5d7d9,
    ground: 0x526963,
    wall: 0x375164,
    accent: 0xa9ebbd,
    warm: 0xe5b881,
  }),
  profile(
    'ukrainian',
    title('Ukrainian Horizons', 'Українські обрії'),
    {
      sky: 0xbad7e8,
      fog: 0xc7d9d4,
      ground: 0x6e835d,
      wall: 0xe4d5b6,
      accent: 0x6fbcdf,
      warm: 0xf1cf66,
    },
    {
      characters: 'civilian',
      assets: {
        gate: 'builtin:timber-gate',
        marker: 'builtin:ceramic-beacon',
        enemy: 'builtin:practice-drone',
        vehicle: 'builtin:utility-van',
      },
      audio: { ambience: 'woodland', motor: 'quad', gate: 'bell' },
      ui: { accent: '#e5c36e', font: 'system-ui', borderRadius: 12 },
    },
  ),
  profile(
    'pixel',
    title('Pixel Circuit', 'Піксельні перегони'),
    {
      sky: 0x233348,
      fog: 0x344657,
      ground: 0x33404c,
      wall: 0x344657,
      accent: 0x66e6dc,
      warm: 0xf1ae75,
    },
    {
      textureFilter: 'nearest',
      drone: 'pixel',
      characters: 'arcade',
      assets: {
        gate: 'builtin:neon-gate',
        marker: 'builtin:pixel-beacon',
        enemy: 'builtin:arcade-rival',
        vehicle: 'builtin:pixel-truck',
      },
      audio: { ambience: 'stadium', motor: 'arcade', gate: 'digital' },
      ui: { accent: '#bd9cfc', font: 'monospace', borderRadius: 2 },
    },
  ),
  profile(
    'operations',
    title('Field Operations', 'Польові операції'),
    {
      sky: 0xc4d0d5,
      fog: 0xabbfc2,
      ground: 0x66716b,
      wall: 0x50616a,
      accent: 0x91c7bc,
      warm: 0xefb76b,
    },
    {
      drone: 'utility',
      characters: 'training-patrol',
      assets: {
        gate: 'builtin:utility-gate',
        marker: 'builtin:signal-beacon',
        enemy: 'builtin:sentry',
        vehicle: 'builtin:patrol-rover',
      },
      audio: { ambience: 'industrial', motor: 'utility', gate: 'radio' },
      ui: { accent: '#a5c581', font: 'system-ui', borderRadius: 4 },
    },
  ),
]);
export const WORLD_RULESETS = Object.freeze([
  {
    format: 'Ruleset.v1',
    id: 'open-practice',
    revision: 'r1',
    rules: { collisionDamage: 0, playerHealth: 100 },
    conditions: { profile: 'clear', revision: 'r1' },
  },
  {
    format: 'Ruleset.v1',
    id: 'clean-racing',
    revision: 'r1',
    rules: { collisionDamage: 0, playerHealth: 100 },
    conditions: { profile: 'clear', revision: 'r1' },
  },
  {
    format: 'Ruleset.v1',
    id: 'pulse-encounter',
    revision: 'r1',
    rules: {
      collisionDamage: 0,
      playerHealth: 100,
      playerDamage: 25,
      fireCooldown: 8,
      projectileSpeed: 20000,
      projectileTicks: 150,
    },
    conditions: { profile: 'clear', revision: 'r1' },
  },
]);

const merge = (a, b) => {
  const result = { ...a };
  for (const [key, value] of Object.entries(b ?? {})) {
    if (['__proto__', 'prototype', 'constructor'].includes(key))
      throw new TypeError('Unsafe theme property.');
    result[key] =
      value && typeof value === 'object' && !Array.isArray(value)
        ? merge(a?.[key] ?? {}, value)
        : value;
  }
  return result;
};
function copy(value) {
  return boundedJSON(value, { maxBytes: 64 * 1024, maxNodes: 4096, maxDepth: 10, maxArray: 128 });
}
export function validateThemeProfile(input) {
  const value = copy(input);
  if (
    value.format !== 'ThemeProfile.v1' ||
    !/^[a-z][a-z0-9-]{0,63}$/.test(value.id) ||
    typeof value.revision !== 'string'
  )
    throw new TypeError('Invalid theme profile.');
  for (const key of ['sky', 'fog', 'ground', 'wall', 'accent', 'warm'])
    if (
      !Number.isInteger(value.palette?.[key]) ||
      value.palette[key] < 0 ||
      value.palette[key] > 0xffffff
    )
      throw new TypeError(`Invalid theme color: ${key}.`);
  if (
    !['linear', 'nearest'].includes(value.textureFilter) ||
    !['racer', 'pixel', 'utility'].includes(value.drone)
  )
    throw new TypeError('Unsupported theme presentation.');
  for (const slot of ['gate', 'marker', 'enemy', 'vehicle'])
    if (
      typeof value.assets?.[slot] !== 'string' ||
      value.assets[slot].length > 240 ||
      /^(https?:|data:|javascript:)/i.test(value.assets[slot])
    )
      throw new TypeError(`Missing or invalid theme asset slot: ${slot}.`);
  if (
    !/^#[a-f\d]{6}$/i.test(value.ui?.accent) ||
    !['system-ui', 'monospace'].includes(value.ui.font) ||
    !Number.isFinite(value.ui.borderRadius) ||
    value.ui.borderRadius < 0 ||
    value.ui.borderRadius > 24
  )
    throw new TypeError('Invalid theme UI profile.');
  return value;
}

/** Visual overrides never change rules, physical shape, sight lines or scoring. */
export function resolveThemeProfile(
  course = {},
  { profiles = THEME_PROFILES, campaign = null } = {},
) {
  const fallback = ['woodland', 'courtyard'].includes(course.environment)
    ? 'ukrainian'
    : ['warehouse', 'stadium'].includes(course.environment)
      ? 'pixel'
      : ['container-yard', 'garage'].includes(course.environment)
        ? 'operations'
        : 'academy';
  const all = [...THEME_PROFILES, ...profiles],
    find = (id) => all.findLast((p) => p.id === id);
  let value = copy(find('academy'));
  for (const layer of [campaign, course.world, course]) {
    const id = typeof layer?.theme === 'string' ? layer.theme : layer?.themeId;
    if (id) {
      const selected = find(id);
      if (!selected) throw new TypeError(`Missing theme profile: ${id}.`);
      value = merge(value, selected);
    }
    if (layer?.themeProfile) value = merge(value, layer.themeProfile);
  }
  if (
    !campaign?.theme &&
    !campaign?.themeId &&
    !course.world?.theme &&
    !course.theme &&
    !course.themeId &&
    !course.themeProfile
  )
    value = merge(value, find(fallback));
  return validateThemeProfile(value);
}

export function resolveThemeExperience({
  course,
  campaign = null,
  profiles = THEME_PROFILES,
  rulesets = WORLD_RULESETS,
} = {}) {
  const theme = resolveThemeProfile(course, { campaign, profiles });
  const id = course.rulesetId ?? campaign?.rulesetId ?? 'open-practice';
  const ruleset = [...WORLD_RULESETS, ...rulesets].findLast((r) => r.id === id);
  if (!ruleset) throw new TypeError(`Missing ruleset: ${id}.`);
  const rules = merge(ruleset.rules, course.rules),
    conditions = merge(ruleset.conditions, course.conditions);
  const compiled = {
    ...course,
    rules,
    conditions,
    world: { ...course.world, theme: theme.id, themeProfile: theme },
  };
  delete compiled.rulesetId;
  delete compiled.theme;
  delete compiled.themeId;
  delete compiled.themeProfile;
  return {
    theme,
    ruleset: copy(ruleset),
    course: compiled,
    compatibility: dataIdentity({
      ruleset: { id: ruleset.id, revision: ruleset.revision },
      rules,
      conditions,
    }),
  };
}
