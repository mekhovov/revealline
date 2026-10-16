/** Exact Library pin, approved appearance/heading, and real shared-flight starts; native UI separately gated. */
import { rotate, Q } from '../../../../optional-practice/civilian-fpv/math.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { prepareRegionalDownload } from '../../../../optional-practice/civilian-fpv/regional-delivery.mjs';
import { createRegionalSession } from '../../../../optional-practice/civilian-fpv/regional-session.mjs';
import { createVerifiedMixedWindow } from '../../../../optional-practice/civilian-fpv/regional/verified-mixed-window.mjs';
import {
  LUNAR_BASIN_LIBRARY_PIN,
  REGIONAL_LIBRARY_PINS,
  applyRegionalAppearance,
  regionalPresentationOptions,
} from '../../../../optional-practice/civilian-fpv/regional-library.mjs';
const root = resolve(
  process.argv[2] ?? new URL('./delivery-composition-r2/', import.meta.url).pathname,
);
const libraryPin = LUNAR_BASIN_LIBRARY_PIN;
assert(REGIONAL_LIBRARY_PINS.includes(libraryPin));
assert.equal(
  REGIONAL_LIBRARY_PINS.filter(
    (p) => p.id === libraryPin.id && p.pin.sha256 === libraryPin.pin.sha256,
  ).length,
  1,
);
assert.equal(libraryPin.bytes, 1981832);
assert.match(libraryPin.description.en, /Earth flight physics, not Moon gravity/);
assert(libraryPin.description.uk.includes('земну фізику'));
assert.deepEqual(libraryPin.appearance, { terrain: 'lunar-regolith', scenery: 'lunar-survey' });
assert.match(libraryPin.pin.url, /\/423f60966ec5dd4946a05ae1ea3c59f4910216ef\//);
const pin = { ...libraryPin.pin, url: 'https://lunar.invalid/delivery.json' };

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const requests = [];
const prepared = await prepareRegionalDownload(pin, {
  pageURL: 'https://lunar.invalid/sim',
  fetchImpl: async (url, options) => {
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'error');
    options.signal?.throwIfAborted();
    const pathname = new URL(url).pathname,
      file = resolve(root, '.' + pathname);
    assert(file.startsWith(root + sep));
    requests.push(pathname);
    return new Response(await readFile(file));
  },
});
const descriptor = prepared.descriptor;
assert.deepEqual(libraryPin.title, descriptor.title, 'Offered and saved region titles must agree');
assert.equal(descriptor.format, 'FPVRegionalDelivery.v2');
assert.equal(descriptor.id, 'lunar-basin-study');
assert.equal(descriptor.revision, 'composition-r2');
assert.equal(descriptor.files.length, 116);
assert.equal(requests.length, 117);
assert.equal(new Set(requests).size, 117);
assert(descriptor.totalBytes + pin.bytes < 64 * 1024 * 1024);
const sourcePreparation = JSON.parse(
  await readFile(new URL('./preparation.json', import.meta.url)),
);
const manifests = {};
for (const layer of ['terrain', 'scenery']) {
  const bytes = new Uint8Array(await prepared.assets.get(layer + '/region.json').arrayBuffer());
  assert.equal(hash(bytes), sourcePreparation[layer + 'ManifestSHA256']);
  manifests[layer] = JSON.parse(new TextDecoder().decode(bytes));
}
const source = (layer) => ({
  baseURL: `https://prepared.invalid/${layer}/`,
  fetchImpl: async (url, { signal } = {}) => {
    signal?.throwIfAborted();
    const path = new URL(url).pathname.slice(1);
    assert(prepared.assets.has(path), 'No unverified or network fallback');
    return new Response(prepared.assets.get(path));
  },
});
const configuration = {
  manifest: manifests.terrain,
  source: source('terrain'),
  scenery: { manifest: manifests.scenery, source: source('scenery') },
  geometryProfile: 'terrain-scenery-v1',
};
const zeroResources = (snapshot) => {
  for (const key of [
    'geometryBytes',
    'textureBytes',
    'resourceBytes',
    'sourceBytes',
    'reservedGeometryBytes',
    'reservedSourceBytes',
  ])
    assert.equal(snapshot[key], 0, key);
};
const starts = [];
for (const mode of ['self-level', 'acro'])
  for (const spawn of manifests.terrain.spawns) {
    const launch = regionalPresentationOptions(
      applyRegionalAppearance(
        { ...configuration, mode, spawnId: spawn.id },
        { id: libraryPin.id, sha256: libraryPin.pin.sha256 },
      ),
      'balanced',
    );
    assert.equal(launch.initialHeading, libraryPin.startHeadings[spawn.id]);
    const session = createRegionalSession(launch);
    try {
      assert.equal(session.arm(), false, 'Unprepared source cannot arm');
      await session.prepare();
      let state = session.snapshot();
      assert.equal(state.status, 'paused');
      assert.equal(state.ticks, 0);
      assert.equal(state.contacts, 0);
      assert.deepEqual(state.position, spawn.position);
      assert.deepEqual(state.lastInput, { roll: 0, pitch: 0, yaw: 0, throttle: 0 });
      assert.equal(state.terrain.terrainReady, true);
      assert(state.terrain.resourceBytes * 2 <= 8 * 1024 * 1024);
      const preparedResources = state.terrain.resourceBytes;
      assert.equal(session.arm(), true, 'Only explicit arm starts flight');
      for (let i = 0; i < 200; i++)
        state = session.step({ roll: 0, pitch: 0, yaw: 0, throttle: 0.58 });
      assert.equal(state.ticks, 200);
      assert.equal(state.contacts, 0);
      assert(state.position.y > spawn.position.y, 'Deliberate climb from authored start');
      session.pause();
      const paused = session.snapshot();
      assert.equal(paused.status, 'paused');
      assert.deepEqual(session.step({ roll: 1, pitch: 1, yaw: 1, throttle: 1 }), paused);
      starts.push({
        mode,
        id: spawn.id,
        preparedResources,
        ticks: state.ticks,
        contacts: state.contacts,
        pausedBeforeArm: true,
        pausedInputIgnored: true,
      });
    } finally {
      await session.dispose();
      zeroResources(session.snapshot().terrain);
      assert.equal(session.root.children.length, 0);
    }
  }
assert.equal(starts.length, 12);
const targets = {
  'mare-apron': [104, 144],
  'ejecta-fan': [352, 144],
  'sinuous-rille': [608, 160],
  'terraced-crater': [128, 544],
  'fractured-highland': [352, 520],
  'observatory-ridge': [608, 520],
};
const tierStarts = [];
for (const spawn of manifests.terrain.spawns) {
  const [tx, tz] = targets[spawn.id];
  const expectedHeading =
    (Math.round(
      (Math.atan2(tx - spawn.position.x / 1000, spawn.position.z / 1000 - tz) * 18000) / Math.PI,
    ) +
      36000) %
    36000;
  assert.equal(libraryPin.startHeadings[spawn.id], expectedHeading);
  for (const [quality, tier] of Object.entries({
    low: 'performance',
    balanced: 'balanced',
    high: 'quality',
  })) {
    const configured = applyRegionalAppearance(
      { ...configuration, spawnId: spawn.id },
      { id: libraryPin.id, sha256: libraryPin.pin.sha256 },
    );
    const launch = regionalPresentationOptions(configured, quality);
    assert.equal(launch.source.surfaceQuality, tier);
    assert.equal(launch.scenery.source.surfaceQuality, tier);
    assert.equal(launch.initialHeading, expectedHeading);
    const session = createRegionalSession(launch);
    try {
      await session.prepare();
      const state = session.snapshot();
      assert.equal(state.status, 'paused');
      assert.equal(state.ticks, 0);
      assert.deepEqual(state.position, spawn.position);
      const names = new Set();
      session.root.traverse((mesh) => {
        if (mesh.isMesh) names.add(mesh.material.name);
      });
      assert(names.has('Lunar regolith · ' + tier));
      assert([...names].some((name) => name.startsWith('Lunar rock')));
      const savedStart = { position: { ...spawn.position }, heading: 12345 };
      const savedLaunch = regionalPresentationOptions({ ...configured, savedStart }, quality);
      assert.deepEqual(savedLaunch.savedStart, savedStart);
      assert.equal(savedLaunch.initialHeading, 'region-centre');
      const saved = createRegionalSession(savedLaunch);
      try {
        await saved.prepare();
        assert.equal(saved.snapshot().status, 'paused');
        const nose = rotate(saved.snapshot().orientation, { x: 0, y: 0, z: -Q });
        const heading = ((Math.atan2(nose.x, -nose.z) * 18000) / Math.PI + 36000) % 36000;
        assert(Math.abs(heading - 12345) < 2, 'Saved heading survives authored hints');
        assert.deepEqual(saved.snapshot().position, savedStart.position);
      } finally {
        await saved.dispose();
        zeroResources(saved.snapshot().terrain);
      }
      tierStarts.push({
        id: spawn.id,
        tier,
        heading: expectedHeading,
        resourceBytes: state.terrain.resourceBytes,
      });
    } finally {
      await session.dispose();
      zeroResources(session.snapshot().terrain);
    }
  }
}
assert.equal(tierStarts.length, 18);
for (const identity of [
  { id: libraryPin.id, sha256: '0'.repeat(64) },
  { id: 'other-region', sha256: libraryPin.pin.sha256 },
]) {
  const known = applyRegionalAppearance(configuration, {
    id: libraryPin.id,
    sha256: libraryPin.pin.sha256,
  });
  const cleared = applyRegionalAppearance(known, identity);
  assert.equal(cleared.source.surfaceStyle, 'plain');
  assert.equal(cleared.scenery.source.surfaceStyle, 'plain');
  assert.deepEqual(cleared.authoredStartHeadings, {});
}

// Same verified source through the mixed owner exposes concrete collider ownership.
const owner = createVerifiedMixedWindow(configuration.manifest, {
  source: configuration.source,
  scenery: configuration.scenery,
});
let liveCollision;
try {
  await owner.transition({ x: 192000, y: 60000, z: 192000 });
  liveCollision = owner.collisionSnapshot();
  assert(liveCollision.worlds > 0 && liveCollision.colliders > 0);
} finally {
  await owner.dispose();
  zeroResources(owner.snapshot());
  assert(
    Object.values(owner.collisionSnapshot())
      .filter(Number.isFinite)
      .every((n) => n === 0),
  );
}
console.log(
  JSON.stringify(
    {
      passed: true,
      descriptor: pin,
      files: descriptor.files.length,
      verifiedResponses: requests.length,
      totalBytes: descriptor.totalBytes,
      totalWithDescriptor: descriptor.totalBytes + pin.bytes,
      originalSourceUnchanged: true,
      sourceRevision: '03e5b140b5a5eb2b5bbd4b73762364f6f297b6cc',
      starts,
      tierStarts,
      savedHeadingsPreserved: true,
      unknownPinsClearHints: true,
      liveCollision,
      disposedCollision: owner.collisionSnapshot(),
      allResourcesDisposed: true,
      nativeStorageVerified: false,
      playerAdmission: false,
      scope:
        'Exact immutable pin, both appearance layers at all three tiers, six landmark-facing starts, saved heading preservation and real production flights. Native Library, exact new package, offline and sustained device flight remain separate gates.',
    },
    null,
    2,
  ),
);
