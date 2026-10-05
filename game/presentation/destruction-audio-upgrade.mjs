import { DESTRUCTION_CUES } from '../ui/destruction-audio.mjs';
import { addPresentationSlots, needsPresentationSlots } from './team-anchor-upgrade.mjs';

export const DESTRUCTION_AUDIO_SLOTS = Object.freeze(DESTRUCTION_CUES.map((cue) => `audio.${cue}`));
export const needsDestructionAudioSlots = (source) =>
  needsPresentationSlots(source, DESTRUCTION_AUDIO_SLOTS);
export const addDestructionAudioSlots = (source) =>
  addPresentationSlots(source, DESTRUCTION_AUDIO_SLOTS, 'Destruction audio');
