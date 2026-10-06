import RAPIER from './vendor/rapier/rapier.mjs';

export const WORLD_COLLISION_BACKEND =
  'rapier3d-compat-0.21.0:02dc6a4e2fffc013bab08fbb44fa68f501d8303615e9afe4c7d89ad4eedda0d0';
const IDENTITY = Object.freeze({ x: 0, y: 0, z: 0, w: 1 });
const AXES = ['x', 'y', 'z'];
const mm = (v) => Object.fromEntries(AXES.map((k) => [k, v[k] / 1000]));
const add = (a, b) => Object.fromEntries(AXES.map((k) => [k, a[k] + b[k]]));
const sub = (a, b) => Object.fromEntries(AXES.map((k) => [k, a[k] - b[k]]));
const scale = (a, n) => Object.fromEntries(AXES.map((k) => [k, a[k] * n]));
const centre = (p, lift) => ({ x: p.x, y: p.y + lift, z: p.z });
const rounded = (p) => Object.fromEntries(AXES.map((k) => [k, Math.round(p[k]) || 0]));
const normal = (p) => Object.fromEntries(AXES.map((k) => [k, Math.round(p[k] * 1000000)]));
let ready = false;
let initialization;

/** The pinned compatibility build embeds its WASM: no CDN or implicit fetch. */
export async function initWorldRuntime() {
  if (!initialization)
    initialization = RAPIER.init().then(
      () => {
        ready = true;
        return WORLD_COLLISION_BACKEND;
      },
      (error) => {
        initialization = undefined;
        throw error;
      },
    );
  return initialization;
}

function earlier(a, b) {
  if (!a) return b;
  if (!b) return a;
  const delta = a.toi - b.toi;
  return Math.abs(delta) > 0.000001 ? (delta < 0 ? a : b) : a.id < b.id ? a : b;
}

/** Static broad phase is built once. Moving proxies are queried directly and
 * deliberately excluded from every world query: moving them does not refresh
 * Rapier 0.21's broad phase. All public positions/distances are millimetres. */
export function createWorldCollision(course) {
  if (!ready) throw new Error('Call and await initWorldRuntime before creating a world flight');
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  const staticIds = new Map();
  const actors = new Map();
  let disposed = false;
  const staticOnly = (collider) => staticIds.has(collider.handle);
  const assertLive = () => {
    if (disposed) throw new Error('World collision has been disposed');
  };
  try {
    const { min } = course.bounds;
    // An exact plane avoids GJK contact jitter on very wide, thin floor boxes.
    // Authored finite platforms and slopes still use their actual geometry.
    const floor = world.createCollider(
      new RAPIER.ColliderDesc(new RAPIER.HalfSpace({ x: 0, y: 1, z: 0 })).setTranslation(
        0,
        min.y / 1000,
        0,
      ),
    );
    staticIds.set(floor.handle, '$floor');
    for (const obstacle of [...course.obstacles].sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    )) {
      let desc;
      if (obstacle.type === 'trimesh') {
        desc = RAPIER.ColliderDesc.trimesh(
          new Float32Array(obstacle.vertices.map((n) => n / 1000)),
          new Uint32Array(obstacle.indices),
        );
      } else {
        desc = RAPIER.ColliderDesc.cuboid(
          (obstacle.max.x - obstacle.min.x) / 2000,
          (obstacle.max.y - obstacle.min.y) / 2000,
          (obstacle.max.z - obstacle.min.z) / 2000,
        ).setTranslation(
          (obstacle.max.x + obstacle.min.x) / 2000,
          (obstacle.max.y + obstacle.min.y) / 2000,
          (obstacle.max.z + obstacle.min.z) / 2000,
        );
        if (obstacle.rotation) {
          const [x, y, z, w] = obstacle.rotation;
          desc.setRotation({ x, y, z, w });
        }
      }
      staticIds.set(world.createCollider(desc).handle, obstacle.id);
    }
    world.step();
  } catch (error) {
    world.free();
    throw error;
  }
  const controller = world.createCharacterController(0.01);
  controller.enableAutostep(0.2, 0.3, false);
  controller.enableSnapToGround(0.22);
  // Fixed authored policy: 30 degrees, independent of cosmetic animation.
  controller.setMaxSlopeClimbAngle(0.5235987755982988);
  controller.setMinSlopeSlideAngle(0.5235987755982988);
  controller.setApplyImpulsesToDynamicBodies(false);

  function staticSweep(from, delta, radius) {
    const hit = world.castShape(
      mm(from),
      IDENTITY,
      mm(delta),
      new RAPIER.Ball(radius / 1000),
      0,
      1,
      false,
      undefined,
      undefined,
      undefined,
      undefined,
      staticOnly,
    );
    return (
      hit && {
        id: staticIds.get(hit.collider.handle),
        toi: hit.time_of_impact,
        normal: normal(hit.normal1),
        moving: false,
      }
    );
  }
  function movingSweep(from, delta, radius, motions, start = 0, duration = 1) {
    let best = null;
    for (const motion of motions) {
      const proxy = actors.get(motion.id);
      if (!proxy) continue;
      const travel = sub(motion.to, motion.from);
      const at = add(motion.from, scale(travel, start));
      const end = add(at, scale(travel, duration));
      // Conservative swept bounds avoid WASM calls for unrelated actors.
      if (
        AXES.some((k) => {
          const extent = k === 'y' ? proxy.lift : proxy.radius;
          const shift = k === 'y' ? proxy.lift : 0;
          return (
            Math.max(from[k], from[k] + delta[k]) + radius + 2 <
              Math.min(at[k], end[k]) + shift - extent ||
            Math.min(from[k], from[k] + delta[k]) - radius - 2 >
              Math.max(at[k], end[k]) + shift + extent
          );
        })
      )
        continue;
      proxy.collider.setTranslation(mm(centre(at, proxy.lift)));
      const hit = proxy.collider.castShape(
        mm(scale(travel, duration)),
        new RAPIER.Ball(radius / 1000),
        mm(from),
        IDENTITY,
        mm(delta),
        0,
        1,
        false,
      );
      proxy.collider.setTranslation(mm(centre(motion.to, proxy.lift)));
      if (hit)
        best = earlier(best, {
          id: motion.id,
          toi: hit.time_of_impact,
          normal: normal(hit.normal1),
          moving: true,
        });
    }
    return best;
  }
  function support(position, radius, drop = 100) {
    assertLive();
    const origin = mm(centre(position, radius + 5));
    const hit = world.castRayAndGetNormal(
      new RAPIER.Ray(origin, { x: 0, y: -1, z: 0 }),
      (radius + drop + 5) / 1000,
      true,
      undefined,
      undefined,
      undefined,
      undefined,
      staticOnly,
    );
    if (!hit || hit.normal.y < 0.8660254) return null;
    const surface = origin.y * 1000 - hit.timeOfImpact * 1000;
    return {
      id: staticIds.get(hit.collider.handle),
      y: Math.ceil(surface + radius / hit.normal.y - radius),
      normal: normal(hit.normal),
    };
  }
  return {
    support,
    addActor(actor, groundMotion) {
      assertLive();
      const grounded = ['patrol', 'sentry'].includes(actor.type);
      const lift = grounded ? actor.height / 2 : actor.radius;
      const desc = grounded
        ? RAPIER.ColliderDesc.capsule(Math.max(0, lift - actor.radius) / 1000, actor.radius / 1000)
        : RAPIER.ColliderDesc.ball(actor.radius / 1000);
      desc.setTranslation(...AXES.map((k) => centre(actor.position, lift)[k] / 1000));
      actors.set(actor.id, {
        collider: world.createCollider(desc),
        lift,
        radius: actor.radius,
        groundMotion,
      });
    },
    clearActorSpawn(actor) {
      assertLive();
      const proxy = actors.get(actor.id);
      const shape = ['patrol', 'sentry'].includes(actor.type)
        ? new RAPIER.Capsule((proxy.lift - actor.radius) / 1000, (actor.radius - 10) / 1000)
        : new RAPIER.Ball((actor.radius - 10) / 1000);
      return !world.intersectionWithShape(
        mm(centre(actor.position, proxy.lift)),
        IDENTITY,
        shape,
        undefined,
        undefined,
        undefined,
        undefined,
        staticOnly,
      );
    },
    placeActor(actor) {
      assertLive();
      const proxy = actors.get(actor.id);
      if (proxy) proxy.collider.setTranslation(mm(centre(actor.position, proxy.lift)));
    },
    moveGroundActor: function moveGroundActor(actor, delta) {
      assertLive();
      const proxy = actors.get(actor.id);
      const supported = proxy.groundMotion === 'support-v1';
      const distance2 = supported && AXES.reduce((n, k) => n + delta[k] * delta[k], 0);
      if (supported && distance2 > actor.radius * actor.radius) {
        // At most four parts for the schema's 300 mm/tick and 100 mm radius.
        // Leave two millimetres for component rounding before querying support.
        let parts = 2;
        while (distance2 > ((actor.radius - 2) * parts) ** 2) parts++;
        let current = actor,
          result;
        for (let i = 0; i < parts; i++) {
          result = moveGroundActor(
            current,
            sub(rounded(scale(delta, (i + 1) / parts)), rounded(scale(delta, i / parts))),
          );
          current = { ...actor, position: result.position };
          if (!result.grounded) break;
        }
        return result;
      }
      proxy.collider.setTranslation(mm(centre(actor.position, proxy.lift)));
      controller.computeColliderMovement(
        proxy.collider,
        mm({ ...delta, y: Math.min(delta.y, supported ? -1 : -10) }),
        undefined,
        undefined,
        staticOnly,
      );
      const movement = controller.computedMovement();
      const position = rounded(add(actor.position, scale(movement, 1000)));
      let grounded = controller.computedGrounded();
      if (supported) {
        // Keep the existing 10 mm controller offset, a 1 mm downward request
        // and 1 mm integer margin. Convert normal clearance to vertical lift.
        // Preserve swept steps; a center ray need not touch the supporting edge.
        const ground = support(position, actor.radius, 220);
        grounded = !!ground && position.y >= ground.y - 6 && position.y - ground.y <= 220;
        if (grounded) {
          const raise = Math.max(0, ground.y + Math.ceil(12000000 / ground.normal.y) - position.y);
          const hit =
            raise &&
            world.castShape(
              mm(centre(position, proxy.lift)),
              IDENTITY,
              { x: 0, y: raise / 1000, z: 0 },
              proxy.collider.shape,
              0,
              1,
              false,
              undefined,
              undefined,
              undefined,
              undefined,
              staticOnly,
            );
          position.y += raise;
          grounded = !hit;
        }
      } else if (!grounded) {
        // Retain legacy reacquisition and its exact integer trajectory.
        const ground = support(position, actor.radius, 220);
        if (ground && position.y >= ground.y - 6 && position.y - ground.y <= 220) {
          grounded = true;
          position.y = ground.y + 10;
        }
      }
      // Authored ground actors never acquire an unplanned fall or jump state.
      const result = grounded ? position : { ...actor.position };
      proxy.collider.setTranslation(mm(centre(result, proxy.lift)));
      return { position: result, grounded, blocked: !grounded };
    },
    clearSpawn(position, radius) {
      assertLive();
      return !world.intersectionWithShape(
        mm(centre(position, radius)),
        IDENTITY,
        new RAPIER.Ball(Math.max(1, radius - 3) / 1000),
        undefined,
        undefined,
        undefined,
        undefined,
        staticOnly,
      );
    },
    moveSphere(position, delta, radius, motions = []) {
      assertLive();
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
        const hit = earlier(
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
    },
    castPulse(from, to, motions = [], player = null) {
      assertLive();
      const delta = sub(to, from);
      let hit = earlier(staticSweep(from, delta, 25), movingSweep(from, delta, 25, motions));
      if (player) {
        // Direct shape query gives moving-player CCD without touching broad phase.
        const shape = new RAPIER.Ball(player.radius / 1000);
        const cast = shape.castShape(
          mm(centre(player.from, player.radius)),
          IDENTITY,
          mm(sub(player.to, player.from)),
          new RAPIER.Ball(0.025),
          mm(from),
          IDENTITY,
          mm(delta),
          0,
          1,
          false,
        );
        if (cast) hit = earlier(hit, { id: '$player', toi: cast.time_of_impact, moving: true });
      }
      return hit;
    },
    visible(from, to) {
      assertLive();
      const delta = sub(to, from);
      const hit = world.castRay(
        new RAPIER.Ray(mm(from), mm(delta)),
        1,
        true,
        undefined,
        undefined,
        undefined,
        undefined,
        staticOnly,
      );
      return !hit || hit.timeOfImpact >= 0.9999;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      actors.clear();
      staticIds.clear();
      world.free();
    },
  };
}
