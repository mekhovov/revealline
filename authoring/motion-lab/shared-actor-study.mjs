import {
  validateActorAnimation,
  sampleActorAnimation,
} from '../../game/presentation/actor-animation.mjs';
import { OVERHEAD_ACTOR_SAMPLES } from '../../game/hunt/actor-art.mjs';

export const ACTOR_FRAME_FIELDS = Object.freeze({
  durationMs: Object.freeze({ min: 16, max: 2000 }),
  stride: Object.freeze({ min: -3, max: 3 }),
  breath: Object.freeze({ min: 0, max: 2 }),
  accessory: Object.freeze({ min: -2, max: 2 }),
});

function admit(source) {
  const descriptor = validateActorAnimation(source);
  if (descriptor.rig !== 'overhead-soldier.v1') throw new Error('atlas');
  return descriptor;
}

/** A local draft of the existing data-only descriptor. No new save format,
 * gameplay state, collection ownership or art-family preference is written. */
export function createSharedActorStudy({ family = 'courier' } = {}) {
  const drafts = new Map();
  let currentFamily,
    descriptor,
    clip = 'move',
    timeMs = 0;
  function selectFamily(value) {
    if (!Object.hasOwn(OVERHEAD_ACTOR_SAMPLES, value)) throw new Error('family');
    currentFamily = value;
    descriptor = drafts.get(value) ?? admit(OVERHEAD_ACTOR_SAMPLES[value]);
    drafts.set(value, descriptor);
    if (!Object.hasOwn(descriptor.clips, clip)) clip = 'idle';
    timeMs = 0;
  }
  selectFamily(family);
  const sequence = () =>
    descriptor.clips[clip].frames.map((id) => descriptor.frames.find((frame) => frame.id === id));
  const duration = () => sequence().reduce((sum, frame) => sum + frame.durationMs, 0);
  function frameIndex() {
    let remaining = timeMs;
    return sequence().findIndex((frame) => {
      if (remaining < frame.durationMs) return true;
      remaining -= frame.durationMs;
      return false;
    });
  }
  function seekFrame(index) {
    const frames = sequence();
    if (!Number.isSafeInteger(index) || index < 0 || index >= frames.length)
      throw new Error('frame');
    timeMs = frames.slice(0, index).reduce((sum, frame) => sum + frame.durationMs, 0);
  }
  function replace(source) {
    // Admission happens before ownership changes, retaining the last valid draft.
    const next = admit(source);
    descriptor = next;
    drafts.set(currentFamily, next);
    if (!Object.hasOwn(next.clips, clip)) clip = 'idle';
    timeMs = 0;
  }
  return Object.freeze({
    snapshot({ reducedEffects = false } = {}) {
      return Object.freeze({
        family: currentFamily,
        descriptor,
        clip,
        timeMs,
        durationMs: duration(),
        frameIndex: frameIndex(),
        frame: sampleActorAnimation(descriptor, { clip, timeMs }),
        visibleFrame: sampleActorAnimation(descriptor, { clip, timeMs, reducedEffects }),
      });
    },
    selectFamily,
    selectClip(value) {
      if (!Object.hasOwn(descriptor.clips, value)) throw new Error('clip');
      clip = value;
      timeMs = 0;
    },
    seekFrame,
    stepFrame(delta = 1) {
      if (![1, -1].includes(delta)) throw new Error('step');
      const count = sequence().length;
      seekFrame((frameIndex() + delta + count) % count);
    },
    advance(deltaMs) {
      if (!Number.isFinite(deltaMs) || deltaMs < 0 || deltaMs > 250) throw new Error('time');
      const next = timeMs + deltaMs,
        total = duration();
      timeMs = descriptor.clips[clip].loop ? next % total : Math.min(next, total - 1);
    },
    editFrame(patch) {
      if (!patch || Object.keys(patch).some((key) => !Object.hasOwn(ACTOR_FRAME_FIELDS, key)))
        throw new Error('field');
      const index = frameIndex(),
        id = sequence()[index].id;
      const source = structuredClone(descriptor);
      Object.assign(
        source.frames.find((frame) => frame.id === id),
        patch,
      );
      replace(source);
      seekFrame(index);
    },
    setLoop(value) {
      if (typeof value !== 'boolean') throw new Error('loop');
      const index = frameIndex(),
        source = structuredClone(descriptor);
      source.clips[clip].loop = value;
      replace(source);
      seekFrame(index);
    },
    importJSON(text) {
      // Pretty-printed text can be larger than the validator's 32 KiB payload.
      if (typeof text !== 'string' || new TextEncoder().encode(text).length > 131072)
        throw new Error('size');
      const source = JSON.parse(text);
      if (source?.rig === 'sprite.v1') throw new Error('atlas');
      replace(source);
    },
    exportJSON() {
      return JSON.stringify(descriptor, null, 2);
    },
  });
}
