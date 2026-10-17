// Ghost geometry is a bounded visual summary, never replay verification data.
export const MAX_GHOST_PATH_SAMPLES = 8192;

export function createGhostPathCollector({ maxSamples = MAX_GHOST_PATH_SAMPLES } = {}) {
  if (!Number.isSafeInteger(maxSamples) || maxSamples < 8 || maxSamples > MAX_GHOST_PATH_SAMPLES)
    throw new Error('Invalid ghost path budget');
  let points = [],
    firstTick = null,
    last = null,
    stride = 1,
    count = 0;
  return {
    add(point) {
      if (
        !Array.isArray(point) ||
        point.length !== 8 ||
        !point.every(Number.isFinite) ||
        !Number.isSafeInteger(point[0]) ||
        point[0] < 0 ||
        (last && point[0] !== last[0] + 1) ||
        !Number.isSafeInteger(count + 1) ||
        Math.hypot(...point.slice(4)) < 1e-12
      )
        throw new Error('Invalid or discontinuous ghost sample');
      firstTick ??= point[0];
      last = [...point];
      count++;
      if ((point[0] - firstTick) % stride === 0) points.push(last);
      // Reserve one slot for the exact final sample, regardless of the stride.
      if (points.length >= maxSamples) {
        stride *= 2;
        points = points.filter((entry) => (entry[0] - firstTick) % stride === 0);
      }
    },
    snapshot() {
      const path = points.map((entry) => [...entry]);
      if (last && path.at(-1)?.[0] !== last[0]) path.push([...last]);
      return { path, pathStride: stride, sourceSampleCount: count, maxPathSamples: maxSamples };
    },
  };
}

/** Linear position and shortest-arc quaternion interpolation for display only. */
export function sampleGhostPath(path, tick) {
  if (!path.length || !Number.isFinite(tick)) return null;
  if (tick <= path[0][0]) return [...path[0]];
  if (tick >= path.at(-1)[0]) return [...path.at(-1)];
  let left = 0,
    right = path.length - 1;
  while (right - left > 1) {
    const middle = Math.floor((left + right) / 2);
    if (path[middle][0] <= tick) left = middle;
    else right = middle;
  }
  const a = path[left],
    b = path[right],
    fraction = (tick - a[0]) / (b[0] - a[0]),
    qa = a.slice(4),
    qb = b.slice(4),
    normA = Math.hypot(...qa),
    normB = Math.hypot(...qb);
  for (let i = 0; i < 4; i++) {
    qa[i] /= normA;
    qb[i] /= normB;
  }
  let dot = qa.reduce((sum, value, i) => sum + value * qb[i], 0);
  if (dot < 0) {
    dot = -dot;
    for (let i = 0; i < 4; i++) qb[i] = -qb[i];
  }
  let wa = 1 - fraction,
    wb = fraction;
  if (dot < 0.9995) {
    const angle = Math.acos(Math.min(1, dot)),
      sine = Math.sin(angle);
    wa = Math.sin((1 - fraction) * angle) / sine;
    wb = Math.sin(fraction * angle) / sine;
  }
  const q = qa.map((value, i) => wa * value + wb * qb[i]),
    norm = Math.hypot(...q);
  return [
    tick,
    ...a.slice(1, 4).map((value, i) => value + fraction * (b[i + 1] - value)),
    ...q.map((value) => value / norm),
  ];
}
