/** Exercise authored starts through production presentation/session boundaries. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  applyRegionalAppearance,
  regionalPresentationOptions,
  DESERT_LANDMARKS_LIBRARY_PIN as row,
  DESERT_EXPEDITION_LIBRARY_PIN as natural,
} from '../../../../optional-practice/civilian-fpv/regional-library.mjs';
import {
  createRegionalSession,
  regionalLibraryEntry,
  regionalStartingPoint,
} from '../../../../optional-practice/civilian-fpv/regional-session.mjs';

assert(process.argv[2], 'Provide the immutable landmark delivery directory');
const root = resolve(process.argv[2]);
const manifest = JSON.parse(await readFile(resolve(root, 'terrain/region.json')));
const scenery = JSON.parse(await readFile(resolve(root, 'scenery/region.json')));
const source = (layer) => ({
  baseURL: `https://headings.invalid/${layer}/`,
  fetchImpl: async (url, { signal } = {}) => {
    signal?.throwIfAborted();
    const path = new URL(url).pathname.slice(1);
    assert(!path.includes('..'));
    return new Response(await readFile(resolve(root, path)));
  },
});
const configuration = {
  manifest,
  source: source('terrain'),
  scenery: { manifest: scenery, source: source('scenery') },
  geometryProfile: 'terrain-scenery-v1',
};
const reviewed = applyRegionalAppearance(configuration, {
  id: row.id,
  sha256: row.pin.sha256,
});
const entry = regionalLibraryEntry(reviewed, { sha256: row.pin.sha256 });
const targets = {
  'crescent-dunes': [2800000, 3240000],
  'dry-wash': [6980000, 5250000],
  'salt-basin': [2910000, 11120000],
  'sunrise-escarpment': [11420000, 2890000],
  'mesa-corridor': [11920000, 9050000],
  'rocky-plain': [10360000, 13560000],
};
const angularError = (a, b) => Math.abs(((a - b + 54000) % 36000) - 18000);
const results = [];
for (const mode of ['self-level', 'acro']) {
  for (const spawn of manifest.spawns) {
    const selected = regionalStartingPoint(entry, spawn.id);
    const options = regionalPresentationOptions(selected.configuration, 'balanced');
    const session = createRegionalSession({ ...options, mode });
    try {
      assert.equal(session.arm(), false, 'Starting view cannot arm before preparation');
      await session.prepare();
      const state = session.snapshot();
      assert.equal(state.status, 'paused');
      assert.equal(state.ticks, 0);
      assert.equal(state.contacts, 0);
      assert.deepEqual(state.position, spawn.position, 'Only heading changes');
      assert.deepEqual(state.lastInput, {
        roll: 0,
        pitch: 0,
        yaw: 0,
        throttle: 0,
      });
      const target = targets[spawn.id];
      const expected =
        ((Math.atan2(target[0] - spawn.position.x, spawn.position.z - target[1]) * 18000) /
          Math.PI +
          36000) %
        36000;
      assert(
        angularError(state.attitude.yaw, expected) < 10,
        'Aircraft faces the local composition',
      );
      results.push({ mode, start: spawn.id, heading: state.attitude.yaw });
    } finally {
      await session.dispose();
      assert.equal(session.snapshot().terrain.geometryBytes, 0);
    }
  }
}

// A saved place owns its orientation; selecting a different authored start clears it.
const savedStart = {
  position: { ...manifest.spawns[0].position },
  heading: 27123,
};
const bookmarked = { ...entry, configuration: { ...reviewed, savedStart } };
const savedOptions = regionalPresentationOptions(bookmarked.configuration, 'high');
assert.equal(savedOptions.savedStart, savedStart);
const restored = createRegionalSession(savedOptions);
try {
  await restored.prepare();
  assert(angularError(restored.snapshot().attitude.yaw, savedStart.heading) < 10);
  assert.equal(restored.snapshot().status, 'paused');
  assert.equal(restored.snapshot().ticks, 0);
} finally {
  await restored.dispose();
}
const switched = regionalStartingPoint(bookmarked, 'mesa-corridor');
assert.equal(switched.configuration.savedStart, undefined);
assert.equal(
  regionalPresentationOptions(switched.configuration, 'low').initialHeading,
  row.startHeadings['mesa-corridor'],
);

for (const identity of [
  { id: natural.id, sha256: natural.pin.sha256 },
  { id: row.id, sha256: '0'.repeat(64) },
  { id: 'wrong-region', sha256: row.pin.sha256 },
]) {
  const reset = applyRegionalAppearance(reviewed, identity);
  assert.deepEqual(reset.authoredStartHeadings, {}, 'Hints cannot leak across revisions');
  assert.equal(regionalPresentationOptions(reset, 'balanced').initialHeading, 'region-centre');
}
for (const invalid of [{ missing: 100 }, { 'mesa-corridor': -1 }, { 'mesa-corridor': 36000 }])
  assert.throws(
    () =>
      applyRegionalAppearance(configuration, { id: row.id, sha256: row.pin.sha256 }, [
        { ...row, startHeadings: invalid },
      ]),
    /Invalid trusted regional starting heading/,
  );
const host = await readFile(
  new URL('../../../../optional-practice/civilian-fpv/world-app.mjs', import.meta.url),
  'utf8',
);
const launch = host.slice(host.indexOf('const nextFlight = createRegionalSession('));
assert(launch.indexOf('...regionalPresentationOptions') < launch.indexOf('prepareFrame:'));
assert(
  !launch.slice(0, launch.indexOf('prepareFrame:')).includes('initialHeading:'),
  'Host must not override the resolved heading',
);
console.log(
  JSON.stringify(
    {
      passed: true,
      starts: results,
      savedHeadingPreserved: true,
      oldAndUnknownPinsUnchanged: true,
      sourcePositionsUnchanged: true,
      nativeReview: 'pending',
    },
    null,
    2,
  ),
);
