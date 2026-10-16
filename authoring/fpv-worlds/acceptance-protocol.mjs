import {
  Matrix4,
  Quaternion,
  Vector3,
} from '../../optional-practice/civilian-fpv/vendor/three.module.js';
import { FLIGHT_COURSES } from '../../optional-practice/civilian-fpv/catalogue.mjs';
import {
  ADVENTURE_COURSES,
  FLIGHT_WORLDS,
  WORLD_COURSES,
} from '../../optional-practice/civilian-fpv/world-catalogue.mjs';

export const ACCEPTANCE_PROTOCOL = 'SIMAppearanceAcceptance.v1';
export const ACCEPTANCE_QUALITIES = Object.freeze(['low', 'balanced', 'high']);
const courses = [...FLIGHT_COURSES, ...WORLD_COURSES, ...ADVENTURE_COURSES];
export const ACCEPTANCE_CASES = Object.freeze(
  FLIGHT_WORLDS.map((world) => {
    const options = courses.filter((course) => course.environment === world.id);
    const course =
      options.find((item) => item.steps['self-level'].some((step) => step.type === 'gate')) ??
      options[0];
    return Object.freeze({
      id: world.id,
      title: world.title.en,
      course,
      renderer: course.world ? 'world' : 'academy',
    });
  }),
);

const centre = (min, max) =>
  Object.fromEntries(['x', 'y', 'z'].map((key) => [key, (min[key] + max[key]) / 2]));
function objectivePoint(step) {
  if (step.type === 'gate')
    return {
      x: step.axis === 'x' ? step.at : (step.minSide + step.maxSide) / 2,
      y: (step.minY + step.maxY) / 2,
      z: step.axis === 'z' ? step.at : (step.minSide + step.maxSide) / 2,
    };
  return centre(step.min, step.max);
}
function clampEye(course, value) {
  return Object.fromEntries(
    ['x', 'y', 'z'].map((key) => [
      key,
      Math.max(course.bounds.min[key] + 400, Math.min(course.bounds.max[key] - 400, value[key])),
    ]),
  );
}
/** Synthetic presentation route only. No commands are fed to physics or recordings. */
export function acceptanceRoute(course) {
  const steps = course.steps['self-level'];
  let index = steps.findIndex((step) => step.type === 'gate');
  if (index < 0) index = steps.findIndex((step) => step.min && step.max);
  if (index < 0) throw new TypeError('Acceptance course needs a visible objective.');
  const goal = steps[index],
    target = objectivePoint(goal),
    axis = goal.axis ?? 'z',
    direction = goal.direction ?? -1;
  const make = (id, title, eye, aim, step = index, cameraMode = 'fpv') =>
    Object.freeze({
      id,
      title,
      eye: clampEye(course, eye),
      target: { ...aim },
      step,
      cameraMode,
    });
  const approach = (distance) => ({ ...target, [axis]: target[axis] - direction * distance });
  const views = [
    make('near', 'Near objective / gate opening', approach(6000), target),
    make('far', 'Distant objective / gate opening', approach(24000), target),
  ];
  const middle = centre(course.bounds.min, course.bounds.max);
  const eye = { x: middle.x, y: course.bounds.min.y + 800, z: middle.z + 6000 };
  views.push(
    make('grazing', 'Grazing floor / texture shimmer', eye, {
      ...eye,
      y: course.bounds.min.y + 450,
      z: middle.z - 12000,
    }),
  );
  const landing = steps.findIndex((step) => step.type === 'land');
  if (landing >= 0) {
    const point = objectivePoint(steps[landing]);
    views.push(
      make(
        'landing',
        'Oblique landing markings',
        { ...point, y: point.y + 3800, z: point.z + 6500 },
        point,
        landing,
      ),
    );
  }
  const actor = course.actors?.[0];
  if (actor) {
    const point = { ...actor.position, y: actor.position.y + (actor.height ?? 1200) / 2 };
    views.push(
      make(
        'actor',
        'Actor silhouette / orientation',
        { ...point, y: point.y + 1000, z: point.z + 8500 },
        point,
      ),
    );
  }
  views.push(
    make('chase', 'Drone rear / side orientation', approach(6000), target, index, 'chase'),
  );
  return Object.freeze({
    format: ACCEPTANCE_PROTOCOL,
    courseId: course.id,
    environment: course.environment,
    gate: goal.type === 'gate',
    actor: Boolean(actor),
    landing: landing >= 0,
    views: Object.freeze(views),
  });
}
export function acceptanceFrame(course, route, tick, viewId = null) {
  if (!Number.isInteger(tick) || tick < 0 || tick > 100000)
    throw new TypeError('Invalid acceptance tick.');
  const view = viewId
    ? route.views.find((item) => item.id === viewId)
    : route.views[Math.floor(tick / 40) % route.views.length];
  if (!view) throw new TypeError('Unknown acceptance view.');
  const eye = { ...view.eye, x: view.eye.x + Math.sin(((tick % 40) / 40) * Math.PI * 2) * 250 };
  const bounded = clampEye(course, eye),
    position = new Vector3(...['x', 'y', 'z'].map((k) => bounded[k]));
  const rotation = new Quaternion().setFromRotationMatrix(
    new Matrix4().lookAt(
      position,
      new Vector3(...['x', 'y', 'z'].map((k) => view.target[k])),
      new Vector3(0, 1, 0),
    ),
  );
  return {
    viewId: view.id,
    options: { cameraMode: view.cameraMode, cameraFov: 82, cameraTilt: 0 },
    state: {
      position: { ...bounded, y: bounded.y - (course.rules?.droneRadius ?? 220) },
      orientation: rotation.toArray().map((value) => Math.round(value * 1000000)),
      status: 'active',
      ticks: tick,
      step: view.step,
      lastInput: { roll: 0, pitch: 0, yaw: 0, throttle: 500 },
      actors: course.actors?.map((actor) => ({ ...actor, health: actor.health ?? 100 })),
      projectiles: [],
    },
  };
}
export function frameStatistics(values) {
  if (values.length < 120 || values.some((value) => !Number.isFinite(value) || value < 0))
    throw new TypeError('At least 120 finite frame samples are required.');
  const sorted = [...values].sort((a, b) => a - b),
    percentile = (p) => sorted[Math.ceil(sorted.length * p) - 1];
  return {
    samples: values.length,
    medianMs: percentile(0.5),
    p95Ms: percentile(0.95),
    p99Ms: percentile(0.99),
    maxMs: sorted.at(-1),
  };
}
export function compareAcceptanceRuns(runs, collectionId) {
  const order = ['authored', collectionId, collectionId, 'authored'];
  if (
    collectionId === 'authored' ||
    runs.length !== 4 ||
    runs.some((run, i) => run.collectionId !== order[i])
  )
    throw new TypeError('A complete authored/theme/theme/authored comparison is required.');
  const signature = ({ quality, courseId, viewport, routeSha256, sourceSha256, samples }) =>
    JSON.stringify({ quality, courseId, viewport, routeSha256, sourceSha256, samples });
  if (runs.some((run) => signature(run) !== signature(runs[0])))
    throw new TypeError('Comparison conditions differ.');
  const pairs = [
    [runs[0], runs[1]],
    [runs[3], runs[2]],
  ].map(([base, themed]) => {
    if (!(base.frame.p95Ms > 0) || !(themed.frame.p95Ms > 0))
      throw new TypeError('Invalid p95 timing.');
    return {
      authoredP95Ms: base.frame.p95Ms,
      themedP95Ms: themed.frame.p95Ms,
      ratio: themed.frame.p95Ms / base.frame.p95Ms,
      withinTenPercent: themed.frame.p95Ms <= base.frame.p95Ms * 1.1,
    };
  });
  return {
    pairs,
    browserFrameGate: pairs.every((pair) => pair.withinTenPercent) ? 'pass' : 'review',
    repeatResourceCounts: runs.map((run) => ({
      collectionId: run.collectionId,
      registered: run.resourcesAfter?.registered ?? null,
      gpuAllocations: run.resourcesAfter?.renderer
        ? {
            geometries: run.resourcesAfter.renderer.geometries,
            textures: run.resourcesAfter.renderer.textures,
          }
        : null,
    })),
    physicalDeviceQualified: false,
    gpuTimestampMeasurement: false,
    note: 'Browser requestAnimationFrame cadence, separate CPU submission timings. Vsync may hide GPU cost. Human readability review and physical-device qualification remain required.',
  };
}
