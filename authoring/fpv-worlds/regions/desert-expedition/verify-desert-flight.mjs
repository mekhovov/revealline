/** Controlled-command routes against the original 16.384 km canonical terrain. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import {
  loadRegionalReview,
  createRegionalSession,
} from '../../../../optional-practice/civilian-fpv/regional-session.mjs';
import {
  responseCurve,
  DEFAULT_RESPONSE,
} from '../../../../optional-practice/civilian-fpv/radio-profile.mjs';
const root = resolve(process.argv[2] ?? '');
assert(process.argv[2], 'Provide generated desert directory');
const landmarkStudy = process.argv[3] === 'landmarks';
assert(process.argv[3] === undefined || landmarkStudy, 'Unknown Desert flight study');
const receipt = JSON.parse(await readFile(resolve(root, 'preparation.json')));
const manifestBytes = await readFile(resolve(root, 'terrain/region.json'));
const manifestSHA256 = landmarkStudy ? receipt.terrainManifestSHA256 : receipt.manifestSHA256;
assert.equal(createHash('sha256').update(manifestBytes).digest('hex'), manifestSHA256);
let contactLandmarks = landmarkStudy ? [] : [receipt.landmarks[0], receipt.landmarks[13]];
if (landmarkStudy) {
  const verified = JSON.parse(await readFile(resolve(root, 'landmark-verification.json')));
  assert.equal(verified.passed, true);
  const representatives = receipt.compositions.map(
    (composition) => receipt.objects.find((object) => object.composition === composition.id).id,
  );
  contactLandmarks = representatives.map((id) =>
    verified.solidContacts.find((value) => value.id === id),
  );
  assert(contactLandmarks.every(Boolean));
}
const cache = new Map();
let sceneryAssetRequests = 0;
const fetchImpl = async (url, { signal } = {}) => {
  signal?.throwIfAborted();
  const pathname = new URL(url).pathname;
  if (pathname.startsWith('/scenery/') && pathname !== '/scenery/region.json')
    sceneryAssetRequests++;
  const file = resolve(root, '.' + pathname);
  assert(file.startsWith(root + sep));
  if (!cache.has(file)) cache.set(file, await readFile(file));
  return new Response(cache.get(file));
};
const configuration = await loadRegionalReview({
  manifestURL: '/terrain/region.json',
  sceneryURL: '/scenery/region.json',
  pageURL: 'https://desert.invalid/sim',
  fetchImpl,
});
assert.equal(configuration.manifest.grid.cellSizeMm, 512000);
const routes = receipt.routes;
const zero = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function inverseResponse(value) {
  const wanted = Math.round(clamp(value, -1, 1) * 1000);
  let low = -1000,
    high = 1000;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (responseCurve(middle, DEFAULT_RESPONSE.expo) < wanted) low = middle;
    else high = middle;
  }
  return high / 1000;
}
function measure(state, from, to) {
  const dx = to[0] - from[0],
    dz = to[2] - from[2],
    length = Math.hypot(dx, dz);
  const ux = dx / length,
    uz = dz / length;
  const x = state.position.x / 1000 - from[0],
    z = state.position.z / 1000 - from[2];
  const along = x * ux + z * uz,
    cross = -x * uz + z * ux;
  const height = from[1] + (to[1] - from[1]) * clamp(along / length, 0, 1);
  return { length, ux, uz, along, cross, height };
}
function command(state, from, to, mode) {
  const m = measure(state, from, to);
  const slope = Math.abs((to[1] - from[1]) / m.length);
  const speed = Math.min(5, 0.6 / Math.max(slope, 0.001));
  const forward = clamp((m.length - m.along) * 1.1, -2, speed);
  const lateral = clamp(-m.cross * 1.2, -2, 2);
  const climb = m.along < m.length ? ((to[1] - from[1]) / m.length) * forward : 0;
  const desired = {
    roll: clamp((m.ux * forward - m.uz * lateral - state.velocity.x / 1000) * 350, -1200, 1200),
    pitch: clamp(-(m.uz * forward + m.ux * lateral - state.velocity.z / 1000) * 350, -1200, 1200),
  };
  const axes = Object.fromEntries(
    ['roll', 'pitch'].map((axis) => [
      axis,
      inverseResponse(
        mode === 'self-level'
          ? desired[axis] / (DEFAULT_RESPONSE.maxTilt * 100)
          : ((desired[axis] - state.attitude[axis]) * 4) / (DEFAULT_RESPONSE.maxRate * 100),
      ),
    ]),
  );
  return {
    ...zero,
    ...axes,
    throttle: clamp(
      0.49 + (m.height - state.position.y / 1000) * 0.12 - (state.velocity.y / 1000 - climb) * 0.18,
      0,
      1,
    ),
  };
}
const frame = () => new Promise((resolve) => setImmediate(resolve));
function sessionAt(point, mode) {
  const spawn = {
    id: 'controlled-route-start',
    position: {
      x: Math.round(point[0] * 1000),
      y: Math.round(point[1] * 1000),
      z: Math.round(point[2] * 1000),
    },
  };
  return createRegionalSession({
    ...configuration,
    mode,
    initialHeading: 0,
    manifest: { ...configuration.manifest, spawns: [spawn] },
    scenery: {
      ...configuration.scenery,
      manifest: { ...configuration.scenery.manifest, spawns: [spawn] },
    },
  });
}
const records = [],
  contacts = [];
let authoredStarts = 0;
for (const mode of ['self-level', 'acro']) {
  for (const spawn of configuration.manifest.spawns) {
    const session = createRegionalSession({ ...configuration, mode, spawnId: spawn.id });
    try {
      assert.equal(session.arm(), false);
      await session.prepare();
      const state = session.snapshot();
      assert.equal(state.status, 'paused');
      assert.equal(state.ticks, 0);
      assert.equal(state.contacts, 0);
      assert.deepEqual(state.position, spawn.position);
      authoredStarts++;
    } finally {
      await session.dispose();
    }
  }
  for (const route of routes) {
    const session = sessionAt(route.points[0], mode);
    try {
      assert.equal(session.arm(), false);
      await session.prepare();
      assert.equal(session.snapshot().status, 'paused');
      const initialRecentres = session.snapshot().recentres;
      assert(session.arm());
      let state = session.snapshot(),
        maxCrossTrackM = 0,
        maxHeightErrorM = 0;
      const segments = [];
      for (let i = 1; i < route.points.length; i++) {
        const from = route.points[i - 1],
          to = route.points[i],
          startTick = state.ticks;
        let settled = false;
        for (let tick = 0; tick < 5000; tick++) {
          state = session.step(command(state, from, to, mode));
          assert.equal(state.status, 'active', `${mode}/${route.id}/${i}: ${state.reason}`);
          assert.equal(
            state.contacts,
            0,
            `${route.id}: collision at ${JSON.stringify(state.position)}`,
          );
          const m = measure(state, from, to);
          maxCrossTrackM = Math.max(maxCrossTrackM, Math.abs(m.cross));
          maxHeightErrorM = Math.max(maxHeightErrorM, Math.abs(m.height - state.position.y / 1000));
          assert(maxCrossTrackM < route.halfWidthM - 0.25, `${route.id}: left clear corridor`);
          assert(
            maxHeightErrorM < 0.75,
            `${mode}/${route.id}/${i}: vertical corridor margin ${maxHeightErrorM}m at ${JSON.stringify(state.position)}`,
          );
          await frame();
          if (
            Math.hypot(state.position.x / 1000 - to[0], state.position.z / 1000 - to[2]) < 0.4 &&
            Math.hypot(state.velocity.x, state.velocity.z) < 400 &&
            Math.abs(state.position.y / 1000 - to[1]) < 0.4
          ) {
            settled = true;
            break;
          }
        }
        assert(settled, `${mode}/${route.id}/${i}: endpoint not settled`);
        segments.push({ ticks: state.ticks - startTick, position: state.position });
      }
      session.pause();
      const held = session.snapshot();
      assert.deepEqual(session.step({ ...zero, roll: 1, throttle: 1 }), held);
      records.push({
        mode,
        route: route.id,
        segments,
        ticks: state.ticks,
        contacts: state.contacts,
        recentres: state.recentres,
        inFlightRecentres: state.recentres - initialRecentres,
        maxCrossTrackM,
        maxHeightErrorM,
      });
      await session.dispose();
      assert.equal(session.root.children.length, 0);
      assert.equal(session.snapshot().terrain.geometryBytes, 0);
    } finally {
      await session.dispose();
    }
  }
  for (const landmark of contactLandmarks) {
    const session = sessionAt([landmark.x, landmark.surfaceHeightMm / 1000 + 3, landmark.z], mode);
    try {
      await session.prepare();
      assert(session.arm());
      let state = session.snapshot();
      for (let tick = 0; tick < 500 && state.contacts === 0; tick++) {
        state = session.step(zero);
        await frame();
      }
      assert(state.contacts > 0, `${landmark.id}: actual flight must contact the visible relief`);
      assert(
        state.position.y >= landmark.surfaceHeightMm,
        `${landmark.id}: body crossed the surface`,
      );
      contacts.push({
        mode,
        landmark: landmark.id,
        ticks: state.ticks,
        contacts: state.contacts,
        position: state.position,
      });
    } finally {
      await session.dispose();
    }
  }
}
if (landmarkStudy)
  assert(sceneryAssetRequests > 0, 'The flight must use the actual licensed scenery');
else assert.equal(sceneryAssetRequests, 0, 'Explicit empty scenery must not request assets');
console.log(
  JSON.stringify(
    {
      passed: true,
      actualSourceExtentM: [16384, 16384],
      manifestSHA256,
      authoredStarts,
      sceneryAssetRequests,
      actualCommandedRoutes: records.length,
      actualSolidContacts: contacts,
      records,
      playerReady: false,
      claim: landmarkStudy
        ? 'Six close-range licensed rock compositions flown by actual shared-flight commands in both modes; not whole-map traversal, native art acceptance, device FPS or public admission.'
        : 'Representative controlled-command routes across six regions; not uninterrupted traversal of the entire 16.384 km extent, native FPS or public admission.',
    },
    null,
    2,
  ),
);
