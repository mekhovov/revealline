import { flightSupportFromRay } from '../flight-support.mjs';
/** Precise, bounded static queries for the shared production contact solver. */
import RAPIER from '../vendor/rapier/rapier.mjs';
const AXES = ['x', 'y', 'z'];
const IDENTITY = Object.freeze({ x: 0, y: 0, z: 0, w: 1 });
const point = (value) =>
  value && AXES.every((key) => Number.isFinite(value[key]) && Math.abs(value[key]) <= 100000000);

function motionEnd(from, delta, radius) {
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
  return to;
}

/** Coverage is not collision clearance. Advanced resolves contacts in its worker;
 * this query retains the owner's exact swept-cell proof without repeating them. */
export function createRegionMotionCoverageQuery({ covers, live }) {
  return (from, delta, radius) => {
    live();
    return covers(from, motionEnd(from, delta, radius), radius)
      ? { status: 'motion-covered' }
      : { status: 'unknown-cell' };
  };
}

// Only trusted admission modules construct this closure. Verified owners never accept a caller query.
export function createRegionMotionQuery({ world, local, covers, colliderIds, layer, live }) {
  return (from, delta, radius) => {
    live();
    const to = motionEnd(from, delta, radius);
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

/** Exact production support ray with explicit coverage and nearest-hit metadata. */
export function createRegionFlightSupportQuery({
  world,
  local,
  covers,
  colliderIds,
  layer,
  live,
  originYMm = 0,
}) {
  return (position, radius, drop = 60) => {
    live();
    if (
      !point(position) ||
      !Number.isSafeInteger(radius) ||
      radius <= 0 ||
      radius > 2000 ||
      !Number.isSafeInteger(drop) ||
      drop <= 0 ||
      drop > 4000000
    )
      throw new TypeError('Invalid regional flight support query');
    if (!covers(position, position, radius)) return { status: 'unknown-cell' };
    const origin = local({ ...position, y: position.y + radius + 5 });
    const hit = world.castRayAndGetNormal(
      new RAPIER.Ray(origin, { x: 0, y: -1, z: 0 }),
      (radius + drop + 5) / 1000,
      true,
    );
    const ground = flightSupportFromRay(
      origin.y,
      radius,
      hit,
      hit && layer + ':' + colliderIds.get(hit.collider.handle),
    );
    if (ground) ground.y += originYMm;
    return {
      status: 'flight-support',
      // Keep a steep nearest hit, even though it cannot support landing. A mixed
      // owner must not select a lower floor through that surface.
      hitDistanceMm: hit ? hit.timeOfImpact * 1000 : null,
      ground,
    };
  };
}

/** Read-only ownership counts; no engine handles or mutable sets escape. */
export function regionalCollisionCounts(...owners) {
  const total = { worlds: 0, colliders: 0, rigidBodies: 0 };
  for (const owner of owners) {
    if (!owner) continue;
    const counts = owner.collisionSnapshot();
    for (const key of Object.keys(total)) total[key] += counts[key];
  }
  return total;
}
