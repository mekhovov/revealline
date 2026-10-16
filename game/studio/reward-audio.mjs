import { createAudioMaster } from '../ui/audio-master.mjs';

const owners = new WeakMap();
/** One ephemeral output owner per Studio document, shared by all reward previews.
 * This never reads or writes the player's saved audio preferences. */
export function acquireStudioRewardAudio(document) {
  let owner = owners.get(document);
  if (!owner) {
    owner = { master: createAudioMaster({ muted: false, volume: 0.7 }), references: 0 };
    owners.set(document, owner);
  }
  owner.references++;
  let released = false;
  return {
    master: owner.master,
    release() {
      if (released) return;
      released = true;
      if (--owner.references === 0) {
        owner.master.dispose();
        owners.delete(document);
      }
    },
  };
}
