import { boundedJSON, exactKeys, required } from '../data-json.mjs';

/** Data-only shared combat capabilities. Native play and both Creators use these
 * bounds; custom content cannot shorten the readable warning/recovery floors. */
export function createOverflightCombatProfile(difficulty = 'standard', rulesVersion = 2) {
  const modern = rulesVersion >= 3;
  const index = difficulty === 'relaxed' ? 0 : difficulty === 'veteran' ? 2 : 1;
  return {
    ...(modern
      ? {
          friendlyDamageMultiplier: index === 0 ? 1.15 : 1,
          threats: { standoffMin: 180, standoffMax: 260, groundLifetime: 2 },
        }
      : {}),
    guard: {
      integrity: 60,
      absorption: 0.75,
      commitSeconds: modern ? [2.2, 1.8, 1.4][index] : 1.8,
    },
    machinery: {
      plateFraction: 0.3,
      exposureSeconds: modern ? [4, 3.5, 3][index] : 3,
      exposedMultiplier: 1.5,
    },
    attacks: {
      warningSeconds: modern ? [1.4, 1.2, 1][index] : 1,
      priorityLimit: modern && index === 0 ? 1 : 2,
    },
    supplies: {
      enabled: true,
      guardCount: 8,
      repairHull: modern ? [35, 25, 15][index] : 30,
      rerollCap: 3,
      ...(modern ? { overdrive: true } : {}),
    },
    pacing: {
      reliefSeconds: modern ? [10, 8, 5][index] : difficulty === 'veteran' ? 5 : 8,
    },
  };
}

export const OVERFLIGHT_COMBAT_FIELDS = Object.freeze([
  ['guard', 'integrity', 20, 240, 1, 'Guard integrity', 'Міцність щита'],
  ['guard', 'absorption', 0, 0.9, 0.05, 'Frontal absorption', 'Поглинання спереду'],
  ['guard', 'commitSeconds', 1, 3, 0.1, 'Facing commitment (s)', 'Фіксація напрямку (с)'],
  [
    'machinery',
    'plateFraction',
    0.1,
    0.5,
    0.05,
    'Armor share of total durability',
    'Частка броні в загальній міцності',
  ],
  ['machinery', 'exposureSeconds', 3, 6, 0.5, 'Exposed recovery (s)', 'Вразливе відновлення (с)'],
  [
    'machinery',
    'exposedMultiplier',
    1,
    2,
    0.1,
    'Exposed damage multiplier',
    'Множник шкоди під час вразливості',
  ],
  ['attacks', 'warningSeconds', 1, 2, 0.1, 'Minimum warning (s)', 'Мінімальне попередження (с)'],
  [
    'attacks',
    'priorityLimit',
    1,
    2,
    1,
    'Simultaneous priority attacks',
    'Одночасні пріоритетні атаки',
  ],
  ['supplies', 'guardCount', 4, 12, 1, 'Guards per supply case', 'Охоронців на ящик'],
  ['supplies', 'repairHull', 10, 40, 1, 'Repair reward', 'Винагорода ремонту'],
  ['supplies', 'rerollCap', 2, 3, 1, 'Banked reroll limit', 'Ліміт збережених перевиборів'],
  ['pacing', 'reliefSeconds', 5, 12, 1, 'Formation relief (s)', 'Перепочинок між формаціями (с)'],
]);

export const OVERFLIGHT_COMBAT_V3_FIELDS = Object.freeze([
  ['threats', 'standoffMin', 120, 220, 10, 'Minimum firing distance', 'Мінімальна дистанція вогню'],
  [
    'threats',
    'standoffMax',
    220,
    300,
    10,
    'Maximum firing distance',
    'Максимальна дистанція вогню',
  ],
  [
    'threats',
    'groundLifetime',
    0.5,
    2,
    0.25,
    'Ground danger duration (s)',
    'Тривалість небезпеки на землі (с)',
  ],
]);

export function validateOverflightCombatProfile(source, rulesVersion = 2) {
  const profile = boundedJSON(source, {
    maxBytes: 2048,
    maxNodes: 64,
    maxDepth: 4,
    maxArray: 16,
  });
  const expected = createOverflightCombatProfile('standard', rulesVersion);
  exactKeys(profile, Object.keys(expected), 'Combat profile');
  for (const [section, fields] of Object.entries(expected)) {
    if (typeof fields !== 'object') continue;
    required(
      profile[section] && typeof profile[section] === 'object',
      `Missing combat ${section}.`,
    );
    exactKeys(profile[section], Object.keys(fields), `Combat ${section}`);
  }
  required(
    typeof profile.supplies.enabled === 'boolean',
    'Supply encounters need a boolean enabled flag.',
  );
  for (const [section, key, min, max, step] of [
    ...OVERFLIGHT_COMBAT_FIELDS,
    ...(rulesVersion >= 3 ? OVERFLIGHT_COMBAT_V3_FIELDS : []),
  ]) {
    const value = profile[section][key];
    required(
      Number.isFinite(value) &&
        value >= min &&
        value <= max &&
        (step !== 1 || Number.isSafeInteger(value)),
      `Invalid combat ${section}.${key}: expected ${min}–${max}.`,
    );
  }
  if (rulesVersion >= 3) {
    required(
      [1, 1.15].includes(profile.friendlyDamageMultiplier),
      'Unsupported friendly damage multiplier.',
    );
    required(typeof profile.supplies.overdrive === 'boolean', 'Overdrive needs a boolean flag.');
    required(
      profile.threats.standoffMax >= profile.threats.standoffMin + 40,
      'Firing band needs at least 40 units.',
    );
  }
  return profile;
}
