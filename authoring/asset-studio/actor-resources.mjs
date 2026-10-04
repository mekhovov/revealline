import { pageActorArtPool } from '../../game/presentation/actor-art-pool.mjs';
import { ACTOR_PRESENTATION_SLOTS } from '../../game/presentation/host.mjs';

const actorSlots = new Set(ACTOR_PRESENTATION_SLOTS);
let canvasSequence = 0;
export const isStudioActorSlot = (slotId) => actorSlots.has(slotId);

function resourceOwner(own) {
  if (typeof own !== 'function') throw new TypeError('Actor preview needs a resource owner.');
  const controller = new AbortController(),
    leases = [];
  const release = () => {
    controller.abort();
    for (const lease of leases) lease.release();
    leases.length = 0;
  };
  own(release);
  return { controller, leases, release };
}

/** Share runtime source/crop identities. Keep the source leased until an
 * asynchronous crop settles, even if its visible preview was already closed. */
export async function studioActorImage(asset, blob, options, own) {
  if (!isStudioActorSlot(options.slotId)) throw new TypeError('Not an actor preview slot.');
  const owner = resourceOwner(own),
    pool = pageActorArtPool(document),
    file = asset.file,
    frame = asset.geometry.frame;
  try {
    const original = await pool.acquire({
      key: file.sha256,
      width: file.width,
      height: file.height,
      signal: owner.controller.signal,
      load: () => createImageBitmap(blob),
    });
    owner.leases.push(original);
    if (!options.isCurrent()) {
      owner.release();
      return null;
    }
    if (
      asset.animation ||
      (!frame.x && !frame.y && frame.width === file.width && frame.height === file.height)
    )
      return original.image;
    const releaseSource = original.retain();
    try {
      const crop = await pool.acquire({
        key: `${file.sha256}:${frame.x},${frame.y},${frame.width},${frame.height}`,
        width: frame.width,
        height: frame.height,
        signal: owner.controller.signal,
        load: () => createImageBitmap(original.image, frame.x, frame.y, frame.width, frame.height),
      });
      owner.leases.push(crop);
      if (!options.isCurrent()) {
        owner.release();
        return null;
      }
      return crop.image;
    } finally {
      releaseSource();
    }
  } catch (error) {
    owner.release();
    throw error;
  }
}

/** Inspection canvases are writable, so they have exclusive identities rather
 * than sharing a source crop. Reserve their full backing store before allocation. */
export async function studioActorCanvas(width, height, options, own) {
  const owner = resourceOwner(own);
  try {
    const lease = await pageActorArtPool(document).acquire({
      key: `studio-actor-canvas:${++canvasSequence}`,
      width,
      height,
      signal: owner.controller.signal,
      load: () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.close = () => {
          canvas.width = canvas.height = 0;
        };
        return canvas;
      },
    });
    owner.leases.push(lease);
    if (!options.isCurrent()) {
      owner.release();
      return null;
    }
    return lease.image;
  } catch (error) {
    owner.release();
    throw error;
  }
}
