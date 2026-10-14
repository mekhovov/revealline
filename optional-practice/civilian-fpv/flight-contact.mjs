import { Q, roundDiv } from './math.mjs';

const AXES = ['x', 'y', 'z'];
const add = (a, b) => Object.fromEntries(AXES.map((k) => [k, a[k] + b[k]]));
const sub = (a, b) => Object.fromEntries(AXES.map((k) => [k, a[k] - b[k]]));
const scale = (a, n) => Object.fromEntries(AXES.map((k) => [k, a[k] * n]));
const centre = (p, lift) => ({ x: p.x, y: p.y + lift, z: p.z });
const rounded = (p) => Object.fromEntries(AXES.map((k) => [k, Math.round(p[k]) || 0]));

export function earlierFlightHit(a, b) {
  if (!a) return b;
  if (!b) return a;
  const delta = a.toi - b.toi;
  return Math.abs(delta) > 0.000001 ? (delta < 0 ? a : b) : a.id < b.id ? a : b;
}

/** Production continuous sphere motion; query providers own geometry and readiness. */
export function moveFlightSphere(position, delta, radius, motions, staticSweep, movingSweep) {
  let point = centre(position, radius);
  let remaining = { ...delta };
  let elapsed = 0;
  let duration = 1;
  const contacts = [];
  for (let i = 0; i < 3; i++) {
    // A stationary drone can still be crossed by a moving hazard. A floor
    // contact removes vertical movement, not the rest of the tick's CCD.
    if (
      AXES.every((k) => Math.abs(remaining[k]) < 0.001) &&
      (duration <= 0 || motions.every((m) => AXES.every((k) => m.from[k] === m.to[k])))
    )
      break;
    const hit = earlierFlightHit(
      staticSweep(point, remaining, radius),
      movingSweep(point, remaining, radius, motions, elapsed, duration),
    );
    if (!hit) {
      point = add(point, remaining);
      break;
    }
    contacts.push(hit);
    const toi = Math.max(0, Math.min(1, hit.toi));
    point = add(add(point, scale(remaining, toi)), scale(hit.normal, 0.000002));
    if (hit.moving) break;
    remaining = scale(remaining, 1 - toi);
    const into = AXES.reduce((n, k) => n + remaining[k] * hit.normal[k], 0) / 1000000;
    if (into < 0) remaining = sub(remaining, scale(hit.normal, into / 1000000));
    elapsed += duration * toi;
    duration *= 1 - toi;
  }
  return { position: rounded({ ...point, y: point.y - radius }), contacts };
}

/** Same velocity projection used by World; hit normals use fixed-point Q. */
export function projectContactVelocity(
  velocity,
  hit,
  into = roundDiv(
    AXES.reduce((n, k) => n + velocity[k] * hit.normal[k], 0),
    Q,
  ),
) {
  if (hit.moving) return { x: 0, y: 0, z: 0 };
  if (into < 0) for (const k of AXES) velocity[k] -= roundDiv(hit.normal[k] * into, Q);
  return velocity;
}
