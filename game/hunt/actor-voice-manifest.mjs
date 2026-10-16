import { ACTOR_REACTION_LINES } from './actor-reactions.mjs';

/** Authoring inputs only. A planned clip is never treated as an installed recording. */
export const ACTOR_VOICE_MANIFEST_VERSION = 'humanoid-voice-generation.v1';
export const ACTOR_VOICE_LIMITS = Object.freeze({
  clipBytes: 2 * 1024 * 1024,
  localeBundleBytes: 32 * 1024 * 1024,
  durationSeconds: 15,
  linesPerFamily: 2,
});
const voices = {
  lookout: ['Samantha', 150],
  patroller: ['Daniel', 155],
  runner: ['Karen', 175],
  sprinter: ['Daniel', 180],
  courier: ['Samantha', 170],
  guard: ['Fred', 150],
  'refuge-seeker': ['Samantha', 155],
  switchback: ['Karen', 165],
  'rendezvous-pair': ['Daniel', 160],
  'shield-bearer': ['Fred', 145],
  'brace-trooper': ['Daniel', 145],
  'relay-warden': ['Fred', 140],
};
const directions = {
  lookout: 'Observant and curious; a brief intake of surprise when caught.',
  patroller: 'Unhurried and matter-of-fact; surprised without shouting.',
  runner: 'Alert, quick and playful. Leave the words easy to understand.',
  sprinter: 'A measured breath, then determined energy; lightly breathless when caught.',
  courier: 'Busy and cheerful, with gentle disappointment at the interrupted delivery.',
  guard: 'Watchful and concise. Do not imitate a real person or military recording.',
  'refuge-seeker': 'Cautiously hopeful, then rueful when the shortcut fails.',
  switchback: 'Resourceful and mischievous, impressed by a better interception.',
  'rendezvous-pair': 'Friendly anticipation and a warm greeting, then mild surprise.',
  'shield-bearer': 'Steady confidence, then acknowledgement of a clever flank.',
  'brace-trooper': 'Three deliberate beats before action; impressed recognition when caught.',
  'relay-warden': 'Calm, resonant and restrained, never a long dramatic monologue.',
};
export const ACTOR_VOICE_JOBS = Object.freeze(
  ACTOR_REACTION_LINES.flatMap((line) =>
    ['en', 'uk'].map((locale) => {
      const [englishVoice, rate] = voices[line.speaker];
      return Object.freeze({
        lineId: line.id,
        locale,
        speaker: line.speaker,
        event: line.family,
        transcript: line.text[locale],
        filename: `actor-${line.speaker}-${line.family}-${locale}.m4a`,
        localePack: `humanoid-reactions-${locale}-v1`,
        direction: directions[line.speaker],
        profile: Object.freeze({
          provider: 'macos-say',
          voice: locale === 'uk' ? 'Lesya' : englishVoice,
          rate,
        }),
        status: 'generation-pending',
      });
    }),
  ),
);

export function actorVoiceGenerationPlan(locale = null) {
  if (locale !== null && !['en', 'uk'].includes(locale))
    throw new TypeError('Choose en, uk or both voice locales.');
  return Object.freeze({
    version: ACTOR_VOICE_MANIFEST_VERSION,
    limits: ACTOR_VOICE_LIMITS,
    jobs: Object.freeze(ACTOR_VOICE_JOBS.filter((job) => locale === null || job.locale === locale)),
    runtimeGeneration: false,
    replacementFormat: 'ReactionVoiceBundleV1',
    qualification: 'Generation inputs only; recordings and listening review are pending.',
  });
}
