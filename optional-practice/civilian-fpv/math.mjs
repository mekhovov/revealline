import { QUARTER_SINE } from './rotation-table.mjs';
export const Q = 1000000;
export const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
export const roundDiv = (a, b) =>
  Math.sign(a) * Math.floor((Math.abs(a) + Math.floor(b / 2)) / b) || 0;
export const mul = (a, b) => roundDiv(a * b, Q);
export function sin(angle) {
  let a = ((angle % 36000) + 36000) % 36000,
    sign = 1;
  if (a >= 18000) {
    a -= 18000;
    sign = -1;
  }
  if (a > 9000) a = 18000 - a;
  const i = Math.floor(a / 10),
    remainder = a % 10;
  return (
    sign *
    (QUARTER_SINE[i] +
      (remainder ? roundDiv((QUARTER_SINE[i + 1] - QUARTER_SINE[i]) * remainder, 10) : 0))
  );
}
export const cos = (angle) => sin(angle + 9000);
export function isqrt(n) {
  if (!Number.isSafeInteger(n) || n < 0) throw new TypeError('Integer square root outside bounds');
  if (n < 2) return n;
  let x = n,
    next = Math.floor((x + Math.floor(n / x)) / 2);
  while (next < x) {
    x = next;
    next = Math.floor((x + Math.floor(n / x)) / 2);
  }
  return x;
}
export function atan2(y, x) {
  if (!x && !y) return 0;
  const ax = Math.abs(x),
    ay = Math.abs(y);
  let lo = 0,
    hi = 9000;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (sin(mid) * ax < cos(mid) * ay) lo = mid + 1;
    else hi = mid;
  }
  const angle = x < 0 ? 18000 - lo : lo;
  return y < 0 ? -angle : angle;
}
export function multiplyQuaternion(a, b) {
  const result = [
    roundDiv(a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], Q),
    roundDiv(a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], Q),
    roundDiv(a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], Q),
    roundDiv(a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2], Q),
  ];
  const norm = isqrt(result.reduce((n, x) => n + x * x, 0));
  if (!norm) throw new Error('Invalid orientation');
  return result.map((x) => roundDiv(x * Q, norm));
}
export function rotate(q, v) {
  const [x, y, z, w] = q;
  return {
    x:
      mul(Q - 2 * (mul(y, y) + mul(z, z)), v.x) +
      mul(2 * (mul(x, y) - mul(z, w)), v.y) +
      mul(2 * (mul(x, z) + mul(y, w)), v.z),
    y:
      mul(2 * (mul(x, y) + mul(z, w)), v.x) +
      mul(Q - 2 * (mul(x, x) + mul(z, z)), v.y) +
      mul(2 * (mul(y, z) - mul(x, w)), v.z),
    z:
      mul(2 * (mul(x, z) - mul(y, w)), v.x) +
      mul(2 * (mul(y, z) + mul(x, w)), v.y) +
      mul(Q - 2 * (mul(x, x) + mul(y, y)), v.z),
  };
}
export function attitude(q) {
  const up = rotate(q, { x: 0, y: Q, z: 0 }),
    forward = rotate(q, { x: 0, y: 0, z: -Q }),
    right = rotate(q, { x: Q, y: 0, z: 0 });
  return {
    roll: atan2(-right.y, up.y),
    pitch: atan2(-forward.y, up.y),
    yaw: atan2(forward.x, -forward.z),
    up,
  };
}
export function integrateOrientation(q, rates, hz) {
  for (const [axis, key] of [
    [0, 'pitch'],
    [1, 'yaw'],
    [2, 'roll'],
  ]) {
    const angle = -roundDiv(rates[key], hz * 2),
      rotation = [0, 0, 0, cos(angle)];
    rotation[axis] = sin(angle);
    q = multiplyQuaternion(q, rotation);
  }
  return q;
}
