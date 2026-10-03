import { drawHuntActor } from '../hunt/actor-art.mjs';

/** Historical Classic API, now backed by the shared humanoid painter. The
 * caller still owns its cosmetic clock; this never reads or advances target AI. */
export function drawClassicTarget(ctx, x, y, size, pose = 0, options = {}) {
  drawHuntActor(ctx, x, y, size, pose, options);
}
