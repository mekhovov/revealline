/** Shared semantic cues; both recorded and offline procedural renditions use
 * these recipes. No context, clock, randomness or actor mutation lives here. */
import { destructionSoundRecipe } from './destruction-audio.mjs';
import { worldAmbienceRecipe } from './world-ambience.mjs';
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
// Original material accents reuse the admitted bank. Cadence follows observed
// movement, never a sprite frame, random choice or simulation mutation.
const ACTOR_SOUNDS = Object.freeze({
  runner: Object.freeze({
    cadence: 0.32,
    rate: 1.08,
    equipment: 'paper',
    from: 240,
    to: 150,
  }),
  courier: Object.freeze({
    cadence: 0.29,
    rate: 1.19,
    equipment: 'ratchet',
    from: 360,
    to: 210,
  }),
  guard: Object.freeze({
    cadence: 0.41,
    rate: 0.87,
    equipment: 'contact-metal',
    from: 210,
    to: 90,
  }),
  shield: Object.freeze({
    cadence: 0.48,
    rate: 0.7,
    equipment: 'contact-metal',
    from: 135,
    to: 48,
  }),
});
export function actorSoundProfile(family) {
  return ACTOR_SOUNDS[family === 'shield-bearer' ? 'shield' : family] ?? ACTOR_SOUNDS.runner;
}
/** Version-two flight cues are semantic and deterministic; old courses keep their bank. */
export function combatSoundRecipe(type, details = {}) {
  const profiles = {
    autocannon: [230, 64, 0.065, 0.055, 0.032],
    scatter: [115, 35, 0.18, 0.09, 0.085],
    precision: [1240, 180, 0.09, 0.065, 0.02],
    rocket: [95, 28, 0.26, 0.085, 0.18],
  };
  const profile = profiles[details.weapon];
  let tint = 0;
  for (const char of String(details.eventId ?? ''))
    tint = (Math.imul(tint, 31) + char.charCodeAt(0)) >>> 0;
  const variant = 0.97 + (tint % 61) / 1000;
  const tone = (from, to, duration, gain = 0.025, extra = {}) => ({
    from,
    to,
    duration,
    gain,
    type: 'triangle',
    ...extra,
  });
  const recipe = (name, priority, voice, layers = [], cooldown = 0.08) => ({
    name,
    procedural: true,
    gain: 0.3,
    priority,
    movement: false,
    cooldown,
    tone: voice,
    layers,
  });
  if (type === 'player-damage')
    return recipe(
      'hull-damage',
      5,
      tone(175, 38, 0.15, 0.045),
      [tone(0, 0, 0.055, 0.024, { kind: 'snare' })],
      0.12,
    );
  if (type === 'fire' && profile) {
    const [from, to, duration, gain, noise] = profile;
    return recipe(
      `weapon-${details.weapon}`,
      3,
      tone(from * variant, to * variant, duration, gain),
      [tone(0, 0, noise, gain * 0.6, { kind: 'snare' })],
      details.weapon === 'autocannon' ? 0.08 : 0.12,
    );
  }
  if (type === 'reload-start')
    return recipe(
      'reload-start',
      2,
      tone(170, 310, 0.065, 0.018),
      [tone(260, 130, 0.055, 0.012, { delay: 0.09 })],
      0.2,
    );
  if (type === 'reload-ready')
    return recipe(
      'reload-ready',
      4,
      tone(660, 880, 0.065, 0.025),
      [tone(990, 1320, 0.08, 0.018, { delay: 0.07 })],
      0.15,
    );
  if (type === 'weapon-empty')
    return recipe('weapon-empty', 4, tone(155, 80, 0.045, 0.025), [], 0.3);
  if (type === 'weapon-selected')
    return recipe('weapon-selected', 2, tone(profile?.[0] ?? 320, 540, 0.06, 0.014), [], 0.15);
  if (type === 'payload')
    return recipe(
      'payload-release',
      3,
      tone(220, 70, 0.13, 0.03),
      [tone(0, 0, 0.07, 0.02, { kind: 'snare' })],
      0.2,
    );
  if (type === 'payload-armed' || type === 'payload-ready')
    return recipe(
      type,
      4,
      tone(510, 720, 0.07, 0.025),
      [tone(720, 1040, 0.1, 0.02, { delay: 0.1 })],
      0.3,
    );
  if (type === 'explosion')
    return recipe(
      'combat-explosion',
      3,
      tone(82, 25, 0.4, 0.075, { type: 'sine' }),
      [tone(0, 0, 0.25, 0.07, { kind: 'snare' })],
      0.12,
    );
  if (type === 'component')
    return recipe(
      'component-break',
      4,
      tone(740, 130, 0.13, 0.04),
      [tone(0, 0, 0.05, 0.02, { kind: 'snare' })],
      0.12,
    );
  if (type === 'surface-impact' || (type === 'impact' && details.weapon)) {
    const organic = details.material === 'organic' && !details.protected;
    const glass = details.material === 'glass';
    return recipe(
      details.protected ? 'shield-hit' : `hit-${details.material ?? 'stone'}`,
      2,
      tone(organic ? 160 : glass ? 1800 : 650, organic ? 45 : 130, organic ? 0.07 : 0.095, 0.028),
      organic ? [] : [tone(0, 0, 0.035, 0.012, { kind: 'snare' })],
      0.09,
    );
  }
  if (['repair', 'resupply', 'challenge'].includes(type))
    return recipe(
      type,
      4,
      tone(440, 660, 0.08),
      [tone(880, 1040, 0.09, 0.02, { delay: 0.1 })],
      0.2,
    );
  return null;
}

export function encounterSoundRecipe(type, details = {}) {
  const combat = combatSoundRecipe(type, details);
  if (combat) return combat;
  if (type === 'catch') return destructionSoundRecipe(details);
  if (type === 'ambience') return worldAmbienceRecipe(details.world);
  if (type === 'warning-charge') {
    const progress = Math.max(0, Math.min(1, details.progress ?? 0));
    return {
      name: 'warning-charge',
      procedural: true,
      gain: 0.18,
      priority: 5,
      movement: false,
      cooldown: 0.16,
      tone: {
        from: 660 + progress * 360,
        to: 740 + progress * 360,
        duration: 0.055,
        gain: 0.024,
        type: 'sine',
      },
    };
  }
  if (type === 'escort-shot') {
    const breaker = details.role === 'breaker';
    return {
      name: breaker ? 'escort-breaker' : 'escort-sweeper',
      procedural: true,
      gain: 0.15,
      priority: 2,
      movement: false,
      cooldown: 0.65,
      tone: {
        from: breaker ? 520 : 160,
        to: breaker ? 180 : 60,
        duration: breaker ? 0.075 : 0.12,
        gain: 0.016,
        type: breaker ? 'triangle' : 'sine',
      },
    };
  }
  const pitch = FAMILY_PITCH[details.family] ?? 1;
  const actor = actorSoundProfile(details.family),
    tracked = details.machine === 'tracked',
    metal = details.material === 'metal' || [true, 'tracked', 'wheeled'].includes(details.machine);
  const recipes = {
    step: ['grain', 0.11, 0, 130 * actor.rate, 65 * actor.rate, 0.055],
    equipment: [actor.equipment, 0.12, 1, actor.from, actor.to, 0.085],
    drive: [tracked ? 'ratchet' : 'wheels', 0.17, 1, tracked ? 110 : 210, tracked ? 48 : 90, 0.16],
    notice: ['switch', 0.17, 2, 360, 520, 0.09],
    warning: ['warning', 0.44, 5, 620, 860, 0.13],
    burst: ['paper', 0.19, 2, 190, 320, 0.09],
    recover: ['cancel', 0.13, 1, 310, 210, 0.08],
    blocked: ['contact-soft', 0.1, 1, 150, 100, 0.055],
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
  const scale = Number.isFinite(details.gainScale)
    ? Math.max(0, Math.min(1, details.gainScale))
    : 1;
  const movement = ['step', 'equipment', 'drive'].includes(type);
  return {
    name,
    gain: gain * scale,
    priority:
      details.semantic === 'armor-break'
        ? 4
        : details.semantic === 'harmful-contact'
          ? 5
          : details.semantic === 'friendly-impact'
            ? 3
            : priority,
    movement,
    // Loop textures are deliberately sampled as short envelopes for footsteps.
    maxDuration: movement ? duration : null,
    cooldown:
      type === 'step' ? actor.cadence : type === 'equipment' ? 0.7 : type === 'drive' ? 1.2 : null,
    rate: type === 'step' ? actor.rate : pitch,
    tone: {
      from: from * pitch,
      to: to * pitch,
      duration,
      gain: gain * scale * 0.14,
      type: metal || type === 'equipment' ? 'triangle' : 'sine',
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
