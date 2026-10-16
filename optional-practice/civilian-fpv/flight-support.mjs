import { Q, attitude, atan2, clamp, isqrt, roundDiv } from './math.mjs';

const AXES = ['x', 'y', 'z'];

/** Production support conversion. A steep nearest surface is not a landing support. */
export function flightSupportFromRay(originYMetres, radius, hit, id) {
  if (!hit || hit.normal.y < 0.8660254) return null;
  const surface = originYMetres * 1000 - hit.timeOfImpact * 1000;
  return {
    id,
    y: Math.ceil(surface + radius / hit.normal.y - radius),
    normal: Object.fromEntries(AXES.map((k) => [k, Math.round(hit.normal[k] * 1000000)])),
  };
}

export function relativeFlightTilt(orientation, surfaceNormal) {
  const up = attitude(orientation).up;
  const dot = clamp(
    roundDiv(
      AXES.reduce((n, k) => n + up[k] * surfaceNormal[k], 0),
      Q,
    ),
    -Q,
    Q,
  );
  return Math.abs(atan2(isqrt(Math.max(0, Q * Q - dot * dot)), dot));
}

export function initializeFlightSupport(state, ground) {
  state.grounded = !!ground && Math.abs(ground.y - state.position.y) <= 5;
  state.support = state.grounded ? ground : null;
}

/** Mutates the owning candidate; impactSpeed is sampled before contact velocity projection. */
export function applyFlightSupport(state, ground, wasGrounded, impactSpeed) {
  state.grounded =
    !!ground &&
    state.velocity.y <= 0 &&
    state.position.y - ground.y <= 6 &&
    state.position.y >= ground.y - 6;
  state.support = state.grounded ? ground : null;
  if (state.grounded) {
    state.position.y = Math.max(state.position.y, ground.y);
    if (!wasGrounded) {
      state.landingSpeed = impactSpeed;
      state.landingTilt = relativeFlightTilt(state.orientation, ground.normal);
    }
    state.velocity.y = 0;
    state.velocity.x = roundDiv(state.velocity.x * 700, 1000);
    state.velocity.z = roundDiv(state.velocity.z * 700, 1000);
  }
}
