import { boundedJSON, exactKeys, required } from '../data-json.mjs';

/** Data-only shared combat capabilities. Native play and both Creators use these
 * bounds; custom content cannot shorten the readable warning/recovery floors. */
export function createOverflightCombatProfile(difficulty = 'standard') {
  return {
    guard: { integrity: 60, absorption: 0.75, commitSeconds: 1.8 },
    machinery: { plateFraction: 0.3, exposureSeconds: 3, exposedMultiplier: 1.5 },
    attacks: { warningSeconds: 1, priorityLimit: 2 },
    supplies: { enabled: true, guardCount: 8, repairHull: 30, rerollCap: 3 },
    pacing: { reliefSeconds: difficulty === 'veteran' ? 5 : 8 },
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

export function validateOverflightCombatProfile(source) {
  const profile = boundedJSON(source, { maxBytes: 2048, maxNodes: 64, maxDepth: 4, maxArray: 16 });
  const expected = createOverflightCombatProfile();
  exactKeys(profile, Object.keys(expected), 'Combat profile');
  for (const [section, fields] of Object.entries(expected)) {
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
  for (const [section, key, min, max, step] of OVERFLIGHT_COMBAT_FIELDS) {
    const value = profile[section][key];
    required(
      Number.isFinite(value) &&
        value >= min &&
        value <= max &&
        (step !== 1 || Number.isSafeInteger(value)),
      `Invalid combat ${section}.${key}: expected ${min}–${max}.`,
    );
  }
  return profile;
}
