/** Presentation-only vocabulary shared by every destruction adapter and Studio.
 * Classify before coalescing crowds; never consume the simulation random stream. */
export const DESTRUCTION_CATEGORIES = Object.freeze([
  'soft',
  'armored',
  'light',
  'heavy',
  'electronic',
]);
export const DESTRUCTION_CUES = Object.freeze(DESTRUCTION_CATEGORIES.map((id) => `destroy-${id}`));

// Separate slots preserve the dry impact when Classic sounds is selected. Human identity
// is independent of armor/electronics material (for example a relay operator).
export const HUMAN_REACTION_CUES = Object.freeze(
  Array.from({ length: 8 }, (_, index) => `human-reaction-${index + 1}`),
);
const humanoidFamilies = new Set([
  'lookout',
  'patroller',
  'runner',
  'sprinter',
  'courier',
  'guard',
  'refuge',
  'refuge-seeker',
  'switchback',
  'pair',
  'rendezvous-pair',
  'shield',
  'shield-bearer',
  'brace',
  'brace-trooper',
  'relay-warden',
]);
export function isHumanoidDestruction(details = {}) {
  if (details.machine || details.humanoid === false || details.flesh === false) return false;
  return details.humanoid === true || humanoidFamilies.has(details.family ?? details.kind);
}

export function destructionCategory(details = {}) {
  if (DESTRUCTION_CATEGORIES.includes(details.category)) return details.category;
  const family = String(details.family ?? details.kind ?? '').toLowerCase();
  const machine = String(details.machine ?? '').toLowerCase();
  if (/relay|jammer|radar|electronic|generator|core|sentry|turret/.test(family))
    return 'electronic';
  if (/tank|carrier|tracked|heavy/.test(family + ' ' + machine)) return 'heavy';
  if (/shield|brace|guard|armored/.test(family) && !details.machine) return 'armored';
  if (details.machine || /car|truck|rover|buggy|vehicle|transport/.test(family)) return 'light';
  return details.material === 'metal' ? 'armored' : 'soft';
}

// Shape and decay, not loudness alone, separate infantry, equipment and engines.
const profiles = Object.freeze({
  soft: [0.52, 0.24, 0.09, 190, 64, 'sine', 900, 280],
  armored: [0.54, 0.32, 0.11, 250, 72, 'triangle', 1300, 320],
  light: [0.58, 0.48, 0.16, 130, 38, 'triangle', 690, 100],
  heavy: [0.64, 0.8, 0.22, 86, 32, 'sine', 420, 70],
  electronic: [0.48, 0.33, 0.14, 710, 76, 'triangle', 1150, 145],
});

export function destructionSoundRecipe(details = {}) {
  const category = destructionCategory(details);
  const [baseGain, maxDuration, cooldown, from, to, type, accentFrom, accentTo] =
    profiles[category];
  const scale = Number.isFinite(details.gainScale)
    ? Math.max(0, Math.min(1, details.gainScale))
    : 1;
  const organic = category === 'soft' || category === 'armored';
  const brutal = organic && details.brutal === true;
  const rate = /sprinter|courier/.test(details.family ?? '')
    ? 1.06
    : /brace|guard/.test(details.family ?? '')
      ? 0.96
      : 1;
  const gain = baseGain * scale * (brutal ? 1.12 : 1);
  return {
    category,
    name: `destroy-${category}`,
    gain,
    priority: category === 'heavy' ? 4 : 3,
    movement: false,
    rate,
    maxDuration,
    cooldown,
    // The recorded bank has quiet calibrated peaks. A full-scale oscillator
    // needs matching attenuation or initial/offline kills are much louder.
    tone: { from, to, duration: maxDuration * 0.7, gain: gain * (0.2 / 3), type },
    layers: [
      {
        from: accentFrom,
        to: accentTo,
        duration: brutal ? 0.16 : 0.08,
        gain: gain * ((brutal ? 0.085 : 0.045) / 3),
        type: 'triangle',
        kind: 'snare',
        delay: 0.008,
      },
    ],
  };
}
