/** Shared semantic cues; both recorded and offline procedural renditions use
 * these recipes. No context, clock, randomness or actor mutation lives here. */
const FAMILY_PITCH = Object.freeze({
  lookout: 1.1,
  patroller: 0.94,
  runner: 1.06,
  sprinter: 1.18,
  courier: 1.24,
  guard: 0.84,
  refuge: 0.98,
  switchback: 1.14,
  pair: 1.04,
  shield: 0.72,
  brace: 0.68,
  'refuge-seeker': 0.98,
  'rendezvous-pair': 1.04,
  'shield-bearer': 0.72,
  'brace-trooper': 0.68,
  'relay-warden': 0.62,
});
export function encounterSoundRecipe(type, details = {}) {
  const pitch = FAMILY_PITCH[details.family] ?? 1;
  const metal = details.material === 'metal' || details.machine === true;
  const brutal = details.brutal === true;
  const recipes = {
    step: ['grain', 0.11, 0, 130, 65, 0.055],
    notice: ['switch', 0.17, 2, 360, 520, 0.09],
    warning: ['warning', 0.44, 5, 620, 860, 0.13],
    burst: ['paper', 0.19, 2, 190, 320, 0.09],
    recover: ['cancel', 0.13, 1, 310, 210, 0.08],
    blocked: ['contact-soft', 0.1, 1, 150, 100, 0.055],
    catch: [
      metal ? 'contact-metal' : 'contact-soft',
      brutal ? 0.52 : 0.25,
      3,
      metal ? 150 : 390,
      metal ? 55 : 690,
      brutal ? 0.19 : 0.1,
    ],
    fire: ['attack', 0.34, 4, 620, 110, 0.08],
    impact: ['impact', 0.48, 5, 170, 38, 0.15],
    pulse: ['deploy', 0.33, 3, 880, 260, 0.19],
    reel: ['ratchet', 0.3, 3, 220, 510, 0.16],
    supply: ['pickup', 0.2, 2, 520, 780, 0.09],
    shutter: [
      details.closed ? 'closure' : 'gate',
      0.22,
      3,
      details.closed ? 360 : 260,
      details.closed ? 160 : 520,
      0.13,
    ],
    objective: ['confirm', 0.4, 4, 660, 990, 0.18],
    failure: ['loss', 0.42, 5, 260, 65, 0.23],
  };
  const row = recipes[type];
  if (!row) return null;
  const [name, gain, priority, from, to, duration] = row;
  return {
    name,
    gain,
    priority,
    rate: pitch,
    tone: {
      from: from * pitch,
      to: to * pitch,
      duration,
      gain: gain * 0.14,
      type: metal ? 'triangle' : 'sine',
    },
  };
}

/** Phase changes are incidental cues; blocked/idling actors never emit per frame. */
export function actorPhaseSound(previous, next) {
  if (!previous || previous === next) return null;
  if (['warning', 'telegraph', 'turning'].includes(next)) return 'warning';
  if (['burst', 'dash'].includes(next)) return 'burst';
  if (['recover', 'recovering', 'recovery', 'rest'].includes(next)) return 'recover';
  if (next === 'blocked') return 'blocked';
  if (['flee', 'fleeing', 'notice', 'committed'].includes(next)) return 'notice';
  return null;
}
