export const COMBAT_FEEDBACK_EVENT_LIMIT = 64;

const caption = (priority, cue, text) => Object.freeze({ priority, cue, text });
const sound = (steps, voice, spacing, duration, volume) =>
  Object.freeze({
    steps: Object.freeze(steps),
    voice,
    spacing,
    duration,
    volume,
  });

const captions = Object.freeze({
  'combat.impact': caption(
    50,
    'failure',
    'CRAFT HIT · Sentry shots damage the exposed craft, not its trail.',
  ),
  'combat.locked': caption(
    40,
    'combat',
    'SENTRY LOCK · The dashed line marks a craft-only shot; your trail is not the target.',
  ),
  'combat.fired': caption(
    30,
    'combat',
    'SHOT FIRED · Move the craft clear of the diamond projectile.',
  ),
  'combat.eliminated': caption(
    20,
    'secured',
    'PATROL REMOVED · Unlike field keepers, removable patrols never retain territory.',
  ),
  'combat.cancelled': caption(
    10,
    'secured',
    'LOCK BROKEN · Reclaimed ground or a blocked firing line stopped the shot.',
  ),
});

const sounds = Object.freeze({
  'combat.locked': sound([0, 0], 'chip', 0.12, 0.07, 0.055),
  'combat.fired': sound([12], 'lead', 0, 0.09, 0.07),
  'combat.impact': sound([-1, -8], 'lead', 0.045, 0.13, 0.08),
  'combat.eliminated': sound([0, 7], 'bell', 0.045, 0.12, 0.055),
  'combat.cancelled': sound([4, -1], 'chip', 0.04, 0.08, 0.045),
});

const eventType = (event) =>
  typeof event === 'string'
    ? event
    : event !== null && typeof event === 'object' && typeof event.type === 'string'
      ? event.type
      : null;

/** A supplementary synthetic cue recipe. Soundscape owns gesture, mute, pause,
 * deduplication and voice limits; this module never creates audio resources. */
export function combatSoundCue(event) {
  return sounds[eventType(event)] ?? null;
}

/** Select at most one short, non-modal caption from one bounded simulation batch.
 * Stable input order breaks equal-priority ties. The host decides whether to
 * append this to a higher-priority failure/completion notice. */
export function selectCombatCaption(events) {
  if (!Array.isArray(events)) return null;
  let selected = null;
  const length = Math.min(events.length, COMBAT_FEEDBACK_EVENT_LIMIT);
  for (let index = 0; index < length; index++) {
    const type = eventType(events[index]),
      candidate = captions[type];
    if (!candidate || (selected && selected.priority >= candidate.priority)) continue;
    selected = { type, eventIndex: index, ...candidate };
  }
  return selected ? Object.freeze(selected) : null;
}
