const explanations = Object.freeze({
  'self-contact': [
    'Your unfinished line crossed itself.',
    'Rejoin safe ground without crossing the line you are drawing.',
  ],
  'enemy-trail': [
    'An enemy caught your unfinished line.',
    'Try a shorter cut while keeping enemies away from the open line.',
  ],
  'enemy-player': [
    'An enemy reached your character.',
    'Keep a gap from enemies, including patrols on safe ground.',
  ],
  'boss-lane': [
    'An active marked lane caught your character or unfinished line.',
    'Keep both outside the marked lane while it is active.',
  ],
  'cut-timeout': [
    'The time allowed for one open line ran out.',
    'Rejoin safe ground sooner. Pause the game when you need time to plan.',
  ],
  'cable-limit': [
    'Your open line exceeded its length limit.',
    'Plan a shorter line back to safe ground.',
  ],
  'mission-timeout': [
    'The mission clock ran out.',
    'Plan a shorter route to the required reveal area and objectives.',
  ],
});
const fallback = ['That attempt ended.', 'Review the mission brief and choose another route.'];

function ownValue(source, key) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(source, key);
  return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
}

function practiceOption(options) {
  if (
    !options ||
    typeof options !== 'object' ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(options))
  )
    throw new TypeError('Retry options must be a plain object');
  const descriptor = Object.getOwnPropertyDescriptor(options, 'practice');
  if (!descriptor) return false;
  if (!Object.hasOwn(descriptor, 'value') || typeof descriptor.value !== 'boolean')
    throw new TypeError('Retry practice must be an own data boolean');
  return descriptor.value;
}

/** Display-only advice; an existing cause may survive recovery and a later win. */
export function retryExplanation(run, options = {}) {
  const practice = practiceOption(options);
  if (ownValue(run, 'status') !== 'lost') return null;
  const failureCause = ownValue(run, 'failureCause');
  const cause =
    typeof failureCause === 'string' && Object.hasOwn(explanations, failureCause)
      ? failureCause
      : null;
  const [reason, tip] = cause ? explanations[cause] : fallback;
  return {
    cause,
    reason,
    tip,
    footnote: practice
      ? 'Retry starts this practice again. This reveal resets; practice grants no campaign rewards.'
      : 'Retry starts this mission again. This reveal resets; collected pictures and best results remain.',
  };
}
