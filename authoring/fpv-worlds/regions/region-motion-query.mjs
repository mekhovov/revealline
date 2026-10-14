/** Precise, bounded static queries for the shared production contact solver. */
import RAPIER from '../../../optional-practice/civilian-fpv/vendor/rapier/rapier.mjs';
const AXES = ['x', 'y', 'z'];
const IDENTITY = Object.freeze({ x: 0, y: 0, z: 0, w: 1 });
const point = (value) =>
  value && AXES.every((key) => Number.isFinite(value[key]) && Math.abs(value[key]) <= 100000000);

// Only trusted admission modules construct this closure. Verified owners never accept a caller query.
export function createRegionMotionQuery({ world, local, covers, colliderIds, layer, live }) {
  return (from, delta, radius) => {
    live();
    if (
      !point(from) ||
      !point(delta) ||
      !Number.isSafeInteger(radius) ||
      radius <= 0 ||
      radius > 2000
    )
      throw new TypeError('Invalid regional motion query');
    const to = Object.fromEntries(AXES.map((key) => [key, from[key] + delta[key]]));
    if (!point(to)) throw new TypeError('Regional motion exceeds coordinate limits');
    if (!covers(from, to, radius)) return { status: 'unknown-cell' };
    const hit = world.castShape(
      local(from),
      IDENTITY,
      Object.fromEntries(AXES.map((key) => [key, delta[key] / 1000])),
      new RAPIER.Ball(radius / 1000),
      0,
      1,
      false,
    );
    return hit
      ? {
          status: 'motion-hit',
          hit: {
            id: `${layer}:${colliderIds.get(hit.collider.handle)}`,
            toi: hit.time_of_impact,
            normal: Object.fromEntries(
              AXES.map((key) => [key, Math.round(hit.normal1[key] * 1000000)]),
            ),
            moving: false,
          },
        }
      : { status: 'motion-clear' };
  };
}
