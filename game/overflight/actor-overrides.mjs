import { validateActorAnimation } from '../presentation/actor-animation.mjs';
import {
  INDUSTRIAL_BUILTIN_SPRITES,
  hasCustomIndustrialMachineryGeometry,
} from '../presentation/industrial-arcade-builtins.mjs';
import {
  OVERFLIGHT_ACTOR_SLOTS,
  OVERFLIGHT_MACHINERY_ALIASES,
} from '../presentation/overflight-actor-slots.mjs';

const clips = ['move', 'anticipation', 'fire', 'recovery', 'caught', 'blocked'];
const wardrobes = ['tactical', 'rivals', 'arcade'];
function acceptedImage(snapshot, slot, alias = false) {
  const source = snapshot?.image?.(slot);
  if (!source?.image || source.asset?.kind !== 'image') return null;
  if (
    alias &&
    !source.asset.animation &&
    !source.geometry?.animation &&
    source.asset.id === `${slot}.field-kit` &&
    INDUSTRIAL_BUILTIN_SPRITES[slot]?.includes(source.asset.file?.sha256) &&
    !hasCustomIndustrialMachineryGeometry(source.asset, slot)
  )
    return null;
  return source;
}

/** Read the accepted snapshot once. No imported URL, callback or new resource
 * owner is introduced; this only consumes already validated/decoded images. */
export function prepareOverflightActorOverrides(snapshot) {
  const actors = new Map(),
    entries = [];
  for (const contract of OVERFLIGHT_ACTOR_SLOTS) {
    const source =
      acceptedImage(snapshot, contract.id) ??
      (contract.kind === 'machine'
        ? acceptedImage(snapshot, OVERFLIGHT_MACHINERY_ALIASES[contract.family], true)
        : null);
    if (!source) continue;
    const animation = source.geometry?.animation ?? source.asset.animation;
    const descriptor = animation
      ? validateActorAnimation(animation, {
          width: source.asset.file?.width ?? source.image.naturalWidth ?? source.image.width,
          height: source.asset.file?.height ?? source.image.naturalHeight ?? source.image.height,
        })
      : null;
    if (descriptor?.rig === 'overhead-soldier.v1' && contract.kind !== 'soldier')
      throw new TypeError('A machinery override needs a sprite animation.');
    const prepared = { ...contract, source, descriptor, clips: {} };
    if (!descriptor) {
      const id = `custom:${contract.id}:still`;
      entries.push({
        id,
        kind: 'custom-actor',
        width: contract.size,
        height: contract.size,
        override: prepared,
        clip: 'move',
        timeMs: 0,
        sample: null,
      });
      for (const clip of clips)
        prepared.clips[clip] = { duration: 1, loop: false, frames: [{ id, end: 1 }] };
    } else
      for (const clip of clips) {
        const actualClip = descriptor.clips[clip] ? clip : 'idle';
        const sequence = descriptor.clips[actualClip];
        let duration = 0;
        const frames = sequence.frames.map((name, index) => {
          const sample = descriptor.frames.find((frame) => frame.id === name);
          const id = `custom:${contract.id}:${clip}:${index}`;
          entries.push({
            id,
            kind: 'custom-actor',
            width: contract.size,
            height: contract.size,
            override: prepared,
            clip: actualClip,
            timeMs: duration + 1,
            sample,
          });
          duration += sample.durationMs;
          return { id, end: duration };
        });
        prepared.clips[clip] = { duration, loop: sequence.loop, frames };
      }
    actors.set(contract.id, prepared);
  }
  return {
    entries,
    has(family, wardrobe) {
      return actors.has(
        wardrobe ? `overflight.soldier.${family}.${wardrobe}` : `overflight.machine.${family}`,
      );
    },
    frame(enemy, time, reduced, cast, state) {
      const wardrobe = wardrobes.includes(cast) ? cast : wardrobes[(enemy.wardrobe ?? 0) % 3];
      const actor =
        actors.get(`overflight.machine.${enemy.family}`) ??
        actors.get(`overflight.soldier.${enemy.family}.${wardrobe}`);
      if (!actor) return null;
      const sequence = actor.clips[state.clip ?? 'move'];
      let phase = reduced
        ? 0
        : state.state === 'moving'
          ? time * 1000 + ((enemy.id % 6) * sequence.duration) / 6
          : state.elapsed * 1000;
      phase = sequence.loop ? phase % sequence.duration : Math.min(phase, sequence.duration - 1);
      return sequence.frames.find((frame) => phase < frame.end)?.id ?? sequence.frames.at(-1).id;
    },
    summary: [...actors.values()].map(({ id, source, descriptor }) => ({
      slot: id,
      asset: source.asset.id,
      revision: source.asset.revision,
      sha256: source.asset.file?.sha256 ?? null,
      animation: descriptor ? { id: descriptor.id, revision: descriptor.revision } : null,
    })),
  };
}
