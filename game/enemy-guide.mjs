import { ENEMY_CATALOG, ENEMY_THEMES, emptyEnemyCatalogDraft } from './enemy-catalog.mjs';
import { createEnemyCatalogScenario } from './enemy-catalog-scenarios.mjs';
import { validateScenario } from './content.mjs';

const advice = {
  bouncer: [
    'Watch its direction before leaving the border.',
    'Close a short cut while it is moving away.',
  ],
  'border-patrol': [
    'It follows the outside edge, including your starting ground.',
    'Leave its path before it reaches you. Secured ground is not invulnerability.',
  ],
  'contour-patrol': [
    'Look for the corner badge on the changing frontier.',
    'After a capture, check the new boundary before choosing your next direction.',
  ],
  'claimed-rover': [
    'Its sleeping outline means it cannot move yet.',
    'Watch for the wake-up warning when its whole footprint becomes secured.',
  ],
  eroder: [
    'A bite-shaped badge marks a threat to captured ground.',
    'Watch the warning at a secured edge; reopened cells become dangerous again.',
  ],
  'lane-boss': [
    'The marked lane warns before the attack becomes active.',
    'Cross during the gap. Do not wait inside a warned lane.',
  ],
  'relay-sentinel': [
    'The lock marks a core protected by linked shield relays.',
    'Capture every linked shield relay. During CORE OPEN, close a sufficient new cut—or, if the core is isolated, return to reclaimed ground with no unfinished line.',
  ],
};
export const ENEMY_GUIDE_TOPICS = Object.freeze([
  ...ENEMY_CATALOG.map(({ type, label }) => Object.freeze({ id: type, label })),
  Object.freeze({ id: 'line-impact', label: 'Race the impact' }),
]);

/** Short player copy, separate from authoring controls and runtime authority. */
export function enemyGuideEntry(topic, themeId = 'fpv') {
  const theme = ENEMY_THEMES.includes(themeId) ? themeId : 'fpv';
  if (topic === 'line-impact')
    return Object.freeze({
      id: topic,
      label: 'Race the impact',
      form: 'Two sparks on your unfinished line',
      spot: 'A line strike sends one spark back to the start and another toward you.',
      risk: 'The pursuing spark costs a life if it reaches you. Direct enemy contact still hurts immediately.',
      try: 'Close the cut before the spark catches you. Closing safely clears both sparks.',
      note: 'This rule is active in First Light R3 and this lesson. Older editions can use immediate line-hit damage.',
    });
  const record = ENEMY_CATALOG.find(({ type }) => type === topic);
  if (!record) throw new TypeError('Choose a registered enemy lesson.');
  return Object.freeze({
    id: topic,
    label: record.label,
    form: record.forms[ENEMY_THEMES.indexOf(theme)],
    spot: `${record.domain}. ${advice[topic][0]}`,
    risk: record.risk,
    try: advice[topic][1],
    note: 'The small center marks contact; the larger animated body helps you recognize the role.',
  });
}

export function enemyGuidePracticeInstructions(topic, exercise = 'observe') {
  if (topic === 'line-impact') {
    if (!['observe', 'escape'].includes(exercise)) throw new TypeError('Unknown impact exercise.');
    return exercise === 'observe'
      ? 'First, leave Boost off and tap Down. Watch the hit split into two sparks and the forward spark catch you. Then Retry or return here to try Escape.'
      : 'Enable Boost before tapping Down: hold your Boost button, or switch it on if Toggle is selected. Keep flying to the far safe border to clear the sparks. No ability is needed.';
  }
  return `${enemyGuideEntry(topic).try} Move with direction taps; Pause when you want to inspect. Closing a cut stops your craft; tap a fresh direction to fly again. Retry starts the same lesson.`;
}

/** Materializes a fresh isolated practice recipe; it never changes a pack or live run. */
export function createEnemyGuideScenario({
  topic,
  themeId = 'fpv',
  turnPolicy = 'immediate',
  themes,
  impactScenario,
}) {
  enemyGuideEntry(topic, themeId);
  if (!['immediate', 'grid-center'].includes(turnPolicy))
    throw new TypeError('Unknown turning mode.');
  const selected = ENEMY_THEMES.includes(themeId) ? themeId : 'fpv',
    theme = themes?.find((entry) => entry.id === selected);
  if (!theme) throw new Error('This lesson theme is unavailable.');
  let scenario;
  if (topic === 'line-impact') {
    if (impactScenario?.level?.id !== 'line-impact-demo')
      throw new Error('The impact lesson could not load.');
    scenario = structuredClone(impactScenario);
    scenario.theme = structuredClone(theme);
  } else {
    scenario = createEnemyCatalogScenario(topic, emptyEnemyCatalogDraft(selected), themes);
    scenario.level.id = `guide-${topic}`;
    scenario.level.name = `Field guide: ${enemyGuideEntry(topic).label}`;
    scenario.level.rules = { ...scenario.level.rules, stopOnCapture: true };
  }
  scenario.settings.turnPolicy = turnPolicy;
  scenario.masteryDefinition = null;
  const checked = validateScenario(scenario);
  if (!checked.valid) throw new Error(checked.errors.join('\n'));
  return scenario;
}
