/** Admits combat routes only against the regional host's verified resident geometry. */
const axes = ['x', 'y', 'z'];
const delta = (a, b) => Object.fromEntries(axes.map((key) => [key, b[key] - a[key]]));
const magnitude = (v) => Math.hypot(v.x, v.y, v.z);
const blocked = () => ({ toi: 0, normal: { x: 0, y: 1, z: 0 }, unavailable: true });

/** A pad needs a supported landing patch and a clear approach from the launch. */
export function admitEncounterServicePad(
  position,
  { bounds, launch, surface, sweepStatic, exact = false },
) {
  const offsets = exact
    ? [[0, 0]]
    : [
        [0, 0],
        ...[3000, 6000].flatMap((r) => [
          [r, 0],
          [-r, 0],
          [0, r],
          [0, -r],
          [r, r],
          [-r, r],
          [r, -r],
          [-r, -r],
        ]),
      ];
  for (const [x, z] of offsets) {
    const candidate = { ...position, x: position.x + x, z: position.z + z };
    if (
      !['x', 'z'].every(
        (k) => candidate[k] >= bounds.min[k] + 800 && candidate[k] <= bounds.max[k] - 800,
      )
    )
      continue;
    const support = surface(candidate);
    if (!support || support.unavailable || support.normal.y < Math.cos(Math.PI / 6)) continue;
    const ground = support.position;
    if (
      ground.y < bounds.min.y ||
      ground.y > bounds.max.y - 1200 ||
      (exact && Math.abs(ground.y - position.y) > 20)
    )
      continue;
    const patch = [
      [750, 0],
      [-750, 0],
      [0, 750],
      [0, -750],
    ].every(([dx, dz]) => {
      const hit = surface({ ...ground, x: ground.x + dx, z: ground.z + dz });
      return (
        hit &&
        !hit.unavailable &&
        hit.normal.y >= Math.cos(Math.PI / 6) &&
        Math.abs(hit.position.y - ground.y) <= 150
      );
    });
    if (!patch) continue;
    const hover = { ...ground, y: ground.y + 650 };
    if (sweepStatic(hover, hover, 600)) continue;
    const start = { ...launch, y: launch.y + 250 };
    if (sweepStatic(start, hover, 220)) continue;
    return Object.fromEntries(axes.map((k) => [k, Math.round(ground[k])]));
  }
  return null;
}

export function createRegionalEncounterGeometry(query, { bounds, player, radius = 40000 } = {}) {
  player = player.position ? player : { position: player, radius: 220 };
  const centre = { ...player.position };
  const area = {
    min: Object.fromEntries(
      axes.map((axis) => [
        axis,
        Math.max(bounds.min[axis], centre[axis] - (axis === 'y' ? 12000 : radius)),
      ]),
    ),
    max: Object.fromEntries(
      axes.map((axis) => [
        axis,
        Math.min(bounds.max[axis], centre[axis] + (axis === 'y' ? 12000 : radius)),
      ]),
    ),
  };
  const inside = (p, margin = 0) =>
    axes.every((axis) => p[axis] >= area.min[axis] + margin && p[axis] <= area.max[axis] - margin);
  function sweepStatic(from, to, bodyRadius = 25) {
    const result = query.castMotion(from, delta(from, to), Math.max(1, Math.round(bodyRadius)));
    if (result.status === 'motion-clear') return null;
    if (result.status !== 'motion-hit') return blocked();
    const hit = result.hit,
      size = magnitude(hit.normal) || 1;
    return {
      ...hit,
      position: Object.fromEntries(
        axes.map((key) => [key, Math.round(from[key] + (to[key] - from[key]) * hit.toi)]),
      ),
      normal: Object.fromEntries(axes.map((key) => [key, hit.normal[key] / size])),
      surfaceId: hit.id,
    };
  }
  function groundAt(point) {
    const start = { ...point, y: Math.min(bounds.max.y - 1, centre.y + 5000) };
    const support = query.support(
      start,
      Math.min(4000000, Math.max(1, Math.ceil(start.y - bounds.min.y + 1))),
    );
    if (
      !['terrain-hit', 'scenery-hit'].includes(support.status) ||
      support.normal.y < Math.cos(Math.PI / 6)
    )
      return null;
    return {
      position: { ...point, y: Math.round(support.heightMm) },
      normal: support.normal,
      surfaceId: support.chunkId,
    };
  }
  // A restart may occur well above the floor. Include only a verified
  // supporting surface, so resources never settle at an invented air height.
  const launchSupport = groundAt(centre);
  if (launchSupport) area.min.y = Math.min(area.min.y, launchSupport.position.y);
  const admitServicePad = (position = centre, { exact = false } = {}) =>
    admitEncounterServicePad(position, {
      bounds: area,
      launch: centre,
      surface: groundAt,
      sweepStatic,
      exact,
    });
  function bodyLifts(actor) {
    const height = ['patrol', 'sentry'].includes(actor.type) ? actor.height : actor.radius * 2;
    const top = Math.max(actor.radius, height - actor.radius),
      count = Math.max(1, Math.ceil((top - actor.radius) / Math.max(100, actor.radius)));
    if (top === actor.radius) return [actor.radius];
    return Array.from(
      { length: count + 1 },
      (_, index) => actor.radius + ((top - actor.radius) * index) / count,
    );
  }
  function clearBody(point, actor) {
    const r = Math.max(1, actor.radius - 12);
    for (const lift of bodyLifts(actor)) {
      const from = { ...point, y: point.y + lift + 12 };
      if (sweepStatic(from, { ...from, y: from.y + 1 }, r)) return false;
    }
    return true;
  }
  function supportedPoint(point, actor) {
    if (
      !['x', 'z'].every(
        (axis) =>
          point[axis] >= area.min[axis] + actor.radius &&
          point[axis] <= area.max[axis] - actor.radius,
      )
    )
      return null;
    if (['drone', 'hazard'].includes(actor.type))
      return clearBody(point, actor) ? { ...point } : null;
    const ground = groundAt(point);
    return ground && inside(ground.position) && clearBody(ground.position, actor)
      ? ground.position
      : null;
  }
  function admitActor(
    candidate,
    { requireAttackPosition = false, attackRange = Infinity, attackRadius = 1 } = {},
  ) {
    const actor = structuredClone(candidate),
      points = [actor.position, ...(actor.path ?? [])],
      adjusted = [];
    for (const point of points) {
      const ready = supportedPoint(point, actor);
      if (!ready) return null;
      adjusted.push(ready);
    }
    if (
      magnitude(delta(adjusted[0], player.position)) <
      actor.radius + (player.radius ?? 220) + 2000
    )
      return null;
    // Runtime reaches path[0] from spawn once, then cycles the path itself.
    const route = [...adjusted, ...(adjusted.length > 2 ? [adjusted[1]] : [])];
    for (let edge = 1; edge < route.length; edge++) {
      const from = route[edge - 1],
        to = route[edge],
        travel = delta(from, to);
      const count = Math.max(1, Math.ceil(magnitude(travel) / 100));
      let previous = from;
      for (let index = 1; index <= count; index++) {
        const p = Object.fromEntries(
          axes.map((key) => [key, Math.round(from[key] + (travel[key] * index) / count)]),
        );
        const admitted = supportedPoint(p, actor);
        if (
          !admitted ||
          (!['drone', 'hazard'].includes(actor.type) && Math.abs(admitted.y - previous.y) > 200)
        )
          return null;
        for (const lift of bodyLifts(actor)) {
          const a = { ...previous, y: previous.y + lift + 12 },
            b = { ...admitted, y: admitted.y + lift + 12 };
          if (sweepStatic(a, b, Math.max(1, actor.radius - 12))) return null;
        }
        previous = admitted;
      }
    }
    if (requireAttackPosition) {
      const launch = { ...centre, y: centre.y + (player.supportHeight ?? 220) };
      const lift = ['patrol', 'sentry'].includes(actor.type) ? actor.height / 2 : actor.radius;
      if (
        !adjusted.some((point) => {
          const target = { ...point, y: point.y + lift };
          return (
            magnitude(delta(launch, target)) <= attackRange &&
            !sweepStatic(launch, target, attackRadius)
          );
        })
      )
        return null;
    }
    actor.position = adjusted[0];
    actor.path = adjusted.slice(1);
    return actor;
  }
  return {
    area,
    ready(bounds = area) {
      if (query.ready && !query.ready()) return false;
      if (!query.motionCoverage) return true;
      // Parallel swept strips prove all encounter cells, including intervening
      // blast sight lines, while allowing hits against known solid scenery.
      const width = bounds.max.x - bounds.min.x,
        depth = bounds.max.z - bounds.min.z;
      const bodyRadius = Math.max(1, Math.min(2000, Math.floor(Math.min(width, depth) / 2)));
      for (let z = bounds.min.z + bodyRadius; z <= bounds.max.z - bodyRadius; z += bodyRadius * 2) {
        const at = Math.min(z, bounds.max.z - bodyRadius);
        const from = { x: bounds.min.x + bodyRadius, y: centre.y, z: at };
        if (
          query.motionCoverage(
            from,
            { x: Math.max(0, width - bodyRadius * 2), y: 0, z: 0 },
            bodyRadius,
          ).status !== 'motion-covered'
        )
          return false;
      }
      const from = { x: bounds.min.x + bodyRadius, y: centre.y, z: bounds.max.z - bodyRadius };
      return (
        query.motionCoverage(
          from,
          { x: Math.max(0, width - bodyRadius * 2), y: 0, z: 0 },
          bodyRadius,
        ).status === 'motion-covered'
      );
    },
    admitActor,
    admitServicePad,
    sweepStatic,
    surface(point) {
      const surface = groundAt(point);
      // Preserve the historical v1 defeat-support envelope. Stable identifiers
      // remain available through groundQuery and pad admission.
      return surface ? { position: surface.position, normal: surface.normal } : null;
    },
    moveActor(actor, movement) {
      const start = actor.position,
        count = Math.max(1, Math.ceil(magnitude(movement) / 100));
      let previous = start;
      for (let index = 1; index <= count; index++) {
        const point = Object.fromEntries(
          axes.map((axis) => [axis, Math.round(start[axis] + (movement[axis] * index) / count)]),
        );
        const next = supportedPoint(point, actor);
        if (
          !next ||
          (!['drone', 'hazard'].includes(actor.type) && Math.abs(next.y - previous.y) > 200)
        )
          return { position: start, blocked: true };
        for (const lift of bodyLifts(actor))
          if (
            sweepStatic(
              { ...previous, y: previous.y + lift + 12 },
              { ...next, y: next.y + lift + 12 },
              Math.max(1, actor.radius - 12),
            )
          )
            return { position: start, blocked: true };
        previous = next;
      }
      return { position: previous, blocked: false };
    },
    visible: (from, to) => !sweepStatic(from, to, 1),
    groundQuery(point, normal = { x: 0, y: 1, z: 0 }) {
      if (Math.abs(normal.y) > 0.7) return groundAt(point);
      const length = magnitude(normal) || 1;
      const from = Object.fromEntries(
        axes.map((key) => [key, point[key] + (normal[key] / length) * 30]),
      );
      const to = Object.fromEntries(
        axes.map((key) => [key, point[key] - (normal[key] / length) * 100]),
      );
      const hit = sweepStatic(from, to, 1);
      if (!hit || hit.unavailable) return null;
      return {
        position: Object.fromEntries(
          axes.map((key) => [key, from[key] + (to[key] - from[key]) * hit.toi]),
        ),
        normal: hit.normal,
        surfaceId: hit.id,
      };
    },
  };
}
