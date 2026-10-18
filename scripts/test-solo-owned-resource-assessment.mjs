import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  assessSoloOwnedResources,
  OWNED_RESOURCE_LIMITS,
} from './solo-owned-resource-assessment.mjs';

const retainedBytes = await readFile(
  new URL(
    '../docs/performance/fixtures/solo-resource-assessment/retained-3ad-soak.fixture',
    import.meta.url,
  ),
);
assert.equal(retainedBytes.length, 37519);
assert.equal(
  createHash('sha256').update(retainedBytes).digest('hex'),
  '9396928f6ef2a34da12b884eee46fbfda7cb1edceab9e7bc9c85f71af2610fe4',
);
const retained = JSON.parse(retainedBytes);
const clone = (value) => structuredClone(value);
// Synthetic current-schema owner model, derived from the exact retained resource
// shape. These changes add missing owner fields; they are not native observations.
function resources() {
  const value = clone(retained.snapshots[1].application.resources);
  value.pcm.published = {
    decodedBytes: 0,
    decodedBytesLimit: 32 * 1024 ** 2,
    cacheEntries: 0,
    loading: 0,
  };
  value.soundtrack.inspection.workerOwned = true;
  value.soundtrack.playback = {
    ownedBlobURLCount: 1,
    ownedBlobBytes: 4170,
    failedRevocationCount: 0,
    failedRevocationBytes: 0,
    decks: [
      { index: 0, ownedBlobURLCount: 1, ownedBlobBytes: 4170 },
      { index: 1, ownedBlobURLCount: 0, ownedBlobBytes: 0 },
    ],
  };
  return value;
}
function report(count = 10) {
  return {
    format: 'SoloQualificationReportV1',
    sourceRevision: 'a'.repeat(40),
    performanceGateStatus: 'fail',
    snapshots: Array.from({ length: count }, () => ({
      group: 'completed',
      application: { resources: resources() },
    })),
  };
}
const failures = (result) => result.rows.flatMap((row) => row.failures);
const series = (result, path) => result.retention.series.find((item) => item.path === path);

test('retained failed native snapshots remain failed evidence with missing owners unobserved', () => {
  const before = JSON.stringify(retained);
  const result = assessSoloOwnedResources(retained);
  assert.equal(result.rows.length, 5);
  assert.equal(result.bounds.status, 'inconclusive');
  assert.equal(result.rawFailurePresent, true);
  assert.equal(result.rawPerformanceGateStatus, 'fail');
  assert.equal(result.sourceRevision, '3adcd53792043ef02459e86168c6b33a66d6ef00');
  assert.equal(result.retention.observed, 3);
  assert.equal(result.retention.status, 'inconclusive');
  assert(
    result.rows.some((row) =>
      row.unknown.some((item) => item.path === 'soundtrack.inspection.workerOwned'),
    ),
  );
  assert.equal(result.gameplayQualification, false);
  assert.equal(result.nativeMemoryQualification, false);
  assert.equal(JSON.stringify(retained), before);
});

test('complete bounded owner counters never grant retention or gameplay qualification', () => {
  const input = report();
  const result = assessSoloOwnedResources(input);
  assert.deepEqual(result.bounds, {
    status: 'pass',
    failures: 0,
    unknown: 0,
    checkedSnapshots: 10,
  });
  assert.equal(result.retention.status, 'requires-owner-trend-review');
  assert.equal(result.retention.pendingAtObservedBoundaries, 'observed-idle');
  assert.equal(series(result, 'soundtrack.inspection.workerOwned').status, 'observed-flat');
  assert.equal(series(result, 'soundtrack.inspection.workerOwned').maximum, 1);
  assert.equal(series(result, 'soundtrack.playback.ownedBlobBytes').maximum, 4170);
  assert.equal(result.rawPerformanceGateStatus, 'fail');
  assert.equal(result.gameplayQualification, false);
});

test('earlier and partial boundary breaches remain failures outside the final plateau window', () => {
  const input = report(12);
  input.snapshots[0].group = 'prepared';
  input.snapshots[0].application.resources.pcm.effects.decodedBytes =
    OWNED_RESOURCE_LIMITS.effectPCMBytes + 1;
  input.snapshots[1].group = 'failed-attempt-partial';
  input.snapshots[1].application.resources.media.active.fetch = 3;
  const result = assessSoloOwnedResources(input);
  assert.equal(result.bounds.status, 'fail');
  assert.equal(result.bounds.failures, 2);
  assert.equal(result.retention.observed, 10);
  assert.equal(result.rows[0].failures[0].path, 'pcm.effects.decodedBytes');
  assert.equal(result.rows[1].failures[0].path, 'media.active.fetch');
});

test('all bounded raw qualifier labels are retained without promotion', () => {
  for (const label of [
    'pass-observed-window',
    'partial-baseline-internal-unknown',
    'review-required',
    'invalid-evidence',
    'excluded-synthetic-recovery',
    'not-evaluated',
  ]) {
    const input = report(3);
    input.performanceGateStatus = label;
    const result = assessSoloOwnedResources(input, { last: 3 });
    assert.equal(result.rawPerformanceGateStatus, label);
    assert.equal(result.gameplayQualification, false);
  }
});

test('one Phaser canvas identity requires matching shared surfaces and aggregate pixels', () => {
  const input = report(3);
  for (const snapshot of input.snapshots) {
    const p = snapshot.application.resources.phaser;
    p.uniqueCanvases = 1;
    p.pixels = p.displayed.pixels;
    p.rgbaBytesEstimate = p.displayed.rgbaBytesEstimate;
  }
  assert.equal(assessSoloOwnedResources(input, { last: 3 }).bounds.status, 'pass');
  for (const mutate of [
    (p) => {
      p.pixels++;
      p.rgbaBytesEstimate += 4;
    },
    (p) => {
      [p.detachedBoard.width, p.detachedBoard.height] = [
        p.detachedBoard.height,
        p.detachedBoard.width,
      ];
    },
    (p) => {
      p.uniqueCanvases = 0;
      p.pixels = 0;
      p.rgbaBytesEstimate = 0;
    },
  ]) {
    const changed = clone(input);
    mutate(changed.snapshots[0].application.resources.phaser);
    assert.equal(assessSoloOwnedResources(changed, { last: 3 }).bounds.status, 'fail');
  }
});

test('invalid, missing and inflated limits cannot become zero or extend a source budget', () => {
  for (const invalid of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '0']) {
    const input = report(3);
    input.snapshots[0].application.resources.pcm.effects.decodedBytes = invalid;
    assert.equal(assessSoloOwnedResources(input, { last: 3 }).bounds.status, 'fail');
  }
  const input = report(3);
  input.snapshots[0].application.resources.pcm.effects.decodedBytesLimit *= 2;
  assert(
    failures(assessSoloOwnedResources(input, { last: 3 })).some(
      (item) => item.code === 'source-constant-disagrees',
    ),
  );
  input.snapshots[0].application.resources.pcm.effects = null;
  const result = assessSoloOwnedResources(input, { last: 3 });
  assert.equal(result.bounds.status, 'inconclusive');
  assert.deepEqual(series(result, 'pcm.effects.decodedBytes').values, [null, 0, 0]);
  assert.equal(series(result, 'pcm.effects.decodedBytes').status, 'unobserved');
});

test('deck transfers, remote URLs and disposal preserve actual compressed-byte ownership', () => {
  const input = report(3);
  const second = input.snapshots[1].application.resources.soundtrack.playback;
  second.decks.reverse();
  second.decks.forEach((deck, index) => {
    deck.index = index;
  });
  const third = input.snapshots[2].application.resources.soundtrack;
  third.playback.ownedBlobURLCount = 0;
  third.playback.ownedBlobBytes = 0;
  third.playback.decks.forEach((deck) => {
    deck.ownedBlobURLCount = 0;
    deck.ownedBlobBytes = 0;
  });
  third.inspection.workerOwned = false;
  const result = assessSoloOwnedResources(input, { last: 3 });
  assert.equal(result.bounds.status, 'pass');
  assert.equal(
    series(result, 'soundtrack.playback.ownedBlobBytes').status,
    'requires-owner-trend-review',
  );
  assert.deepEqual(series(result, 'soundtrack.inspection.workerOwned').values, [1, 1, 0]);
  assert.equal(result.retention.pendingAtObservedBoundaries, 'observed-idle');
});

test('deck totals, zero-byte ownership and active-worker contradictions fail', () => {
  for (const change of [
    (r) => {
      r.soundtrack.playback.ownedBlobBytes++;
    },
    (r) => {
      r.soundtrack.playback.decks[0].ownedBlobBytes = 0;
    },
    (r) => {
      r.soundtrack.playback.decks[0].ownedBlobBytes = OWNED_RESOURCE_LIMITS.trackBytes + 1;
    },
    (r) => {
      r.soundtrack.playback.decks[0].index = 1;
    },
    (r) => {
      r.soundtrack.playback.decks.push(clone(r.soundtrack.playback.decks[0]));
    },
    (r) => {
      r.soundtrack.inspection.workerActive = true;
      r.soundtrack.inspection.workerOwned = false;
    },
    (r) => {
      r.soundtrack.inspection.workerOwnedBytes = 4;
    },
    (r) => {
      r.pcm.reactions.loading = 3;
    },
  ]) {
    const input = report(3);
    change(input.snapshots[0].application.resources);
    assert.equal(assessSoloOwnedResources(input, { last: 3 }).bounds.status, 'fail');
  }
});

test('noncancelable pending ownership is observed until settlement without adding reservations to memory', () => {
  const input = report(3),
    value = input.snapshots[0].application.resources;
  for (const admission of [value.media, value.soundtrack.admission]) {
    admission.active.decode = 1;
    admission.reservedDecodeBytes = 16 * 1024 ** 2;
  }
  Object.assign(value.soundtrack.inspection, {
    workerActive: true,
    pendingRequests: 1,
    workerOwnedBytes: 32000,
  });
  const result = assessSoloOwnedResources(input, { last: 3 });
  assert.equal(result.bounds.status, 'pass');
  assert.equal(result.retention.pendingAtObservedBoundaries, 'observed-pending');
  assert.deepEqual(series(result, 'soundtrack.inspection.workerOwnedBytes').values, [32000, 0, 0]);
  assert.equal(Object.hasOwn(result, 'totalMemoryBytes'), false);
});

test('failed revocation and unknown image dimensions prevent a bounded assessment pass', () => {
  const input = report(3),
    value = input.snapshots[0].application.resources;
  value.soundtrack.playback.failedRevocationCount = Number.MAX_SAFE_INTEGER;
  value.soundtrack.playback.failedRevocationBytes = Number.MAX_SAFE_INTEGER;
  value.sharedPresentationImages.uniqueObserved.unknownDimensions = 1;
  const result = assessSoloOwnedResources(input, { last: 3 });
  assert.equal(result.bounds.status, 'inconclusive');
  assert(result.rows[0].unknown.some((item) => item.code === 'browser-release-uncertain'));
  assert(result.rows[0].unknown.some((item) => item.code === 'unobserved-image-dimensions'));
});

test('RGBA category and reservation sums are checked, including arithmetic overflow', () => {
  for (const change of [
    (r) => {
      r.renderer.ownedCanvases.rgbaBytesEstimate++;
    },
    (r) => {
      r.renderer.ownedCanvases.categories.sourceArt.canvases++;
    },
    (r) => {
      r.renderer.legacyImages.reservedPixels = 16 * 1024 ** 2;
    },
    (r) => {
      r.renderer.legacyImages.retainedPixels = Number.MAX_SAFE_INTEGER;
      r.renderer.legacyImages.reservedPixels = Number.MAX_SAFE_INTEGER;
    },
    (r) => {
      r.phaser.displayed.width++;
    },
  ]) {
    const input = report(3);
    change(input.snapshots[0].application.resources);
    assert.equal(assessSoloOwnedResources(input, { last: 3 }).bounds.status, 'fail');
  }
});

test('hard input bounds reject excess snapshots and retain all bounded malformed rows', () => {
  assert.throws(() => assessSoloOwnedResources(report(513)), /Snapshot assessment cap/);
  assert.throws(() => assessSoloOwnedResources(report(), { last: 2 }));
  assert.throws(() => assessSoloOwnedResources(report(), { group: '__proto__' }));
  const result = assessSoloOwnedResources({
    format: 'SoloQualificationReportV1',
    snapshots: Array.from({ length: 512 }, () => ({ group: 'completed', application: null })),
  });
  assert.equal(result.rows.length, 512);
  assert.equal(result.bounds.status, 'inconclusive');
  assert(result.rows.every((row) => row.unknown.length > 0));
  assert(Buffer.byteLength(JSON.stringify(result)) < 16 * 1024 ** 2);
});

function neverCreated(input) {
  for (const snapshot of input.snapshots) {
    const r = snapshot.application.resources;
    r.pcm.publishedOwner = { format: 'SoloOptionalOwnerStateV1', state: 'never-created' };
    r.soundtrackOwner = {
      format: 'SoloOptionalOwnerStateV1',
      state: 'never-created',
      bootstrapMediaElementCreated: true,
    };
    const { reservationAccounting, ...shared } = r.media;
    r.soundtrack = {
      admission: clone(shared),
      inspection: {
        workerOwned: false,
        workerActive: false,
        workerOwnedBytes: 0,
        pendingRequests: 0,
      },
      playback: {
        ownedBlobURLCount: 0,
        ownedBlobBytes: 0,
        failedRevocationCount: 0,
        failedRevocationBytes: 0,
        decks: [],
      },
    };
  }
  return input;
}

test('explicit never-created owners admit only observed zero counters and a shared busy queue', () => {
  const input = neverCreated(report());
  for (const snapshot of input.snapshots) {
    const r = snapshot.application.resources;
    for (const queue of [r.media, r.soundtrack.admission]) {
      queue.active.decode = 1;
      queue.reservedDecodeBytes = 4096;
    }
  }
  const result = assessSoloOwnedResources(input);
  assert.equal(result.bounds.status, 'pass');
  assert.equal(result.rows[0].ownership.soundtrackOwner.bootstrapMediaElementCreated, true);
  assert.equal(series(result, 'soundtrack.inspection.workerOwned').maximum, 0);
  assert.equal(series(result, 'soundtrack.admission.reservedDecodeBytes').maximum, 4096);
  assert.equal(result.rawPerformanceGateStatus, 'fail');
  assert.equal(result.gameplayQualification, false);
  assert.equal(result.nativeMemoryQualification, false);
});

test('every contradictory never-created counter, missing zero and malformed owner remains rejected', () => {
  const changes = [
    (r) => {
      r.pcm.published.decodedBytes = 1;
    },
    (r) => {
      r.pcm.published.cacheEntries = 1;
    },
    (r) => {
      r.pcm.published.loading = 1;
    },
    (r) => {
      delete r.pcm.published.loading;
    },
    (r) => {
      r.soundtrack.inspection.workerOwned = true;
    },
    (r) => {
      r.soundtrack.inspection.workerActive = true;
    },
    (r) => {
      r.soundtrack.inspection.workerOwnedBytes = 1;
    },
    (r) => {
      r.soundtrack.inspection.pendingRequests = 1;
    },
    (r) => {
      r.soundtrack.playback.ownedBlobURLCount = 1;
    },
    (r) => {
      r.soundtrack.playback.ownedBlobBytes = 1;
    },
    (r) => {
      r.soundtrack.playback.failedRevocationCount = 1;
    },
    (r) => {
      r.soundtrack.playback.failedRevocationBytes = 1;
    },
    (r) => {
      r.soundtrack.playback.decks = [{ index: 0, ownedBlobURLCount: 0, ownedBlobBytes: 0 }];
    },
    (r) => {
      r.pcm.publishedOwner.format = 'unknown';
    },
    (r) => {
      r.pcm.publishedOwner.state = 'missing';
    },
    (r) => {
      r.soundtrackOwner.extra = true;
    },
    (r) => {
      r.soundtrackOwner.bootstrapMediaElementCreated = null;
    },
    (r) => {
      r.soundtrack.admission.active.fetch = 1;
    },
    (r) => {
      r.soundtrack.admission.phase = r.media.phase === 'paused' ? 'menu' : 'paused';
    },
  ];
  for (const change of changes) {
    const input = neverCreated(report());
    change(input.snapshots[0].application.resources);
    assert.equal(assessSoloOwnedResources(input).bounds.status, 'fail', String(change));
  }
});

test('retired, failed, disposed and lost ownership never derive zeros', () => {
  for (const state of ['creating', 'retired', 'failed', 'disposed', 'unavailable']) {
    const input = neverCreated(report());
    for (const snapshot of input.snapshots) {
      const r = snapshot.application.resources;
      r.pcm.publishedOwner.state = state;
      r.pcm.published = null;
      r.soundtrackOwner.state = state;
      r.soundtrack.inspection = null;
      r.soundtrack.playback = null;
    }
    const result = assessSoloOwnedResources(input);
    assert.equal(result.bounds.status, 'inconclusive', state);
    assert(result.rows.every((row) => row.unknown.length > 0));
  }
});

test('active ownership requires bootstrap, while a new document may begin with no owner', () => {
  const active = report();
  active.snapshots[0].application.resources.soundtrackOwner = {
    format: 'SoloOptionalOwnerStateV1',
    state: 'active',
    bootstrapMediaElementCreated: false,
  };
  assert(
    assessSoloOwnedResources(active).rows[0].failures.some(
      (item) => item.code === 'player-without-bootstrap',
    ),
  );
  const freshDocument = neverCreated(report());
  freshDocument.snapshots[0].application.resources.pcm.publishedOwner.state = 'active';
  freshDocument.snapshots[1].application.resources.soundtrackOwner.bootstrapMediaElementCreated = false;
  assert.equal(assessSoloOwnedResources(freshDocument).bounds.status, 'pass');
  assert.equal(
    assessSoloOwnedResources(freshDocument).retention.status,
    'requires-owner-trend-review',
  );
});

test('bounded chunk storage preserves new lifecycle facts and exact original assessment', async (t) => {
  const { mkdtemp, realpath, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { createQualificationSnapshotStore, readQualificationSnapshotReport } = await import(
    './solo-qualification-snapshot-store.mjs'
  );
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'solo-owner-proposal-')));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'report.json');
  const input = neverCreated(report(3));
  const options = {
    maximumBytes: 1024 * 1024,
    maximumIndexBytes: 16384,
    maximumSnapshotBytes: 65536,
    maximumSnapshots: 3,
  };
  const writer = await createQualificationSnapshotStore(path, options);
  await writer.save(input);
  const output = await readQualificationSnapshotReport(path, options);
  assert.deepEqual(output, input);
  assert.deepEqual(
    assessSoloOwnedResources(output, { last: 3 }),
    assessSoloOwnedResources(input, { last: 3 }),
  );
  assert(writer.metrics().peakLogicalBytes <= options.maximumBytes);
  assert.equal(writer.metrics().snapshotWrites, 3);
});

test('a failed owner with readable zero counters is still explicitly uncertain', () => {
  const input = report();
  input.snapshots[0].application.resources.pcm.publishedOwner = {
    format: 'SoloOptionalOwnerStateV1',
    state: 'failed',
  };
  const result = assessSoloOwnedResources(input);
  assert.equal(result.bounds.status, 'inconclusive');
  assert.equal(result.rows[0].values['pcm.published.decodedBytes'], 0);
  assert(
    result.rows[0].unknown.some(
      (item) => item.path === 'pcm.publishedOwner' && item.code === 'owner-not-active',
    ),
  );
  assert.equal(result.rawPerformanceGateStatus, 'fail');
});

// Execute the actual manual Demo snapshot body against explicit modeled owners.
// No browser, renderer, native allocation or timing result is implied.
const demoSource = await readFile(new URL('../game/ui/demo-host.mjs', import.meta.url), 'utf8');
const demoStart = demoSource.indexOf('  function resourceSnapshot() {');
const demoEnd = demoSource.indexOf('\n  const listen =', demoStart);
assert(demoStart > 0 && demoEnd > demoStart);
const demoSnapshot = new Function(
  'state',
  `const {canvas,resourceOwners,active,disposed,preparationPhase,pendingSourceLoads,
    pendingPreparations,sceneTransition,reward,workerHandles,workersCreated,
    workerTerminationRequests}=state;
   ${demoSource.slice(demoStart, demoEnd)}
   return resourceSnapshot();`,
);
const surface = (pixels = 0) => ({
  canvases: Number(pixels > 0),
  pixels,
  rgbaBytesEstimate: pixels * 4,
});
function demoState(overrides = {}) {
  return {
    canvas: { width: 640, height: 480 },
    resourceOwners: new Set(),
    active: false,
    disposed: false,
    preparationPhase: () => null,
    pendingSourceLoads: 0,
    pendingPreparations: 0,
    sceneTransition: { resourceSnapshot: () => ({ ...surface(), loading: false }) },
    reward: {
      resourceSnapshot: () => ({
        state: 'idle',
        pendingPreparations: 0,
        poster: surface(),
        presentation: null,
        presentationUnavailable: false,
      }),
    },
    workerHandles: 0,
    workersCreated: 0,
    workerTerminationRequests: 0,
    ...overrides,
  };
}
function demoReport(count = 3) {
  const input = report(count);
  for (const snapshot of input.snapshots)
    snapshot.application.resources.demo = demoSnapshot(demoState());
  return input;
}
const demoOptions = {
  last: 3,
  demo: { format: 'DemoOwnedResourcesV1', sourceRevision: 'a'.repeat(40) },
};

test('Demo assessment is explicit and source-bound; the historical default stays exact', () => {
  assert.deepEqual(assessSoloOwnedResources(demoReport()), assessSoloOwnedResources(report(3)));
  for (const demo of [
    {},
    { ...demoOptions.demo, format: 'DemoOwnedResourcesV2' },
    { ...demoOptions.demo, sourceRevision: 'b'.repeat(40) },
    { ...demoOptions.demo, sourceRevision: null },
  ])
    assert.throws(() => assessSoloOwnedResources(demoReport(), { last: 3, demo }));
  const result = assessSoloOwnedResources(report(3), demoOptions);
  assert.equal(result.bounds.status, 'inconclusive');
  assert(result.rows[0].unknown.some((item) => item.path === 'demo.format'));
  assert.equal(series(result, 'demo.display.pixels').status, 'unobserved');
});

test('actual Demo snapshot across ten close/reopen cycles retains display and nonadditive images', () => {
  const input = report(0);
  const image = { width: 32, height: 24 };
  const snapshot = { resolved: { assets: { original: {} } }, image: () => ({ image }) };
  for (let cycle = 1; cycle <= 10; cycle++) {
    const r = resources();
    const painter = clone(r.renderer);
    const owner = {
      painter: { resourceSnapshot: () => painter },
      presentation: { snapshot },
      actors: { snapshot },
      picture: { backdrop: { image } },
    };
    r.demo = demoSnapshot(
      demoState({
        active: true,
        preparationPhase: () => 'paused',
        resourceOwners: new Set([owner]),
        workerHandles: 1,
        workersCreated: cycle,
        workerTerminationRequests: cycle - 1,
      }),
    );
    input.snapshots.push({ group: 'demo-paused', application: { resources: r } });
    const closed = resources();
    closed.demo = demoSnapshot(
      demoState({ workersCreated: cycle, workerTerminationRequests: cycle }),
    );
    input.snapshots.push({ group: 'demo-closed', application: { resources: closed } });
  }
  input.failure = { message: 'A separate raw failure remains authoritative.' };
  const original = JSON.stringify(input);
  const result = assessSoloOwnedResources(input, {
    ...demoOptions,
    group: 'demo-closed',
    last: 10,
  });
  assert.equal(result.bounds.status, 'pass');
  assert.equal(result.retention.status, 'requires-owner-trend-review');
  assert.equal(series(result, 'demo.display.pixels').minimum, 640 * 480);
  assert.equal(series(result, 'demo.painterTotals.canvases').maximum, 0);
  assert.equal(series(result, 'demo.workers.observedHandles').maximum, 0);
  assert.equal(series(result, 'demo.workers.created').firstToLast, 9);
  assert.equal(result.rows[0].values['demo.sharedImages.uniqueObserved.images'], 1);
  assert.equal(result.rows[0].values['demo.sharedImages.categories.actors.images'], 1);
  assert.equal(result.rawFailurePresent, true);
  assert.equal(result.nativeMemoryQualification, false);
  assert.equal(result.gameplayQualification, false);
  assert.equal(Object.hasOwn(result, 'totalMemoryBytes'), false);
  assert.equal(JSON.stringify(input), original);
});

test('closed canceled Demo work remains pending until actual modeled settlement', () => {
  const input = demoReport();
  input.snapshots[0].application.resources.demo = demoSnapshot(
    demoState({
      pendingSourceLoads: 1,
      pendingPreparations: 1,
      workerHandles: 1,
      workersCreated: 1,
    }),
  );
  const pending = input.snapshots[0].application.resources.demo;
  pending.reward.pendingPreparations = 1;
  for (const snapshot of input.snapshots.slice(1)) {
    snapshot.application.resources.demo.workers.created = 1;
    snapshot.application.resources.demo.workers.terminationRequests = 1;
  }
  const result = assessSoloOwnedResources(input, demoOptions);
  assert.equal(result.bounds.status, 'pass');
  assert.equal(result.retention.pendingAtObservedBoundaries, 'observed-pending');
  assert.deepEqual(series(result, 'demo.pendingPreparations').values, [1, 0, 0]);
  assert.deepEqual(series(result, 'demo.reward.pendingPreparations').values, [1, 0, 0]);
  assert.deepEqual(series(result, 'demo.workers.observedHandles').values, [1, 0, 0]);
});

test('Demo accounting rejects contradictions, invalid exports and oversized evidence without leak claims', () => {
  for (const mutate of [
    (d) => {
      d.format = 'wrong';
    },
    (d) => {
      d.display.rgbaBytesEstimate++;
    },
    (d) => {
      d.transition.canvases = 2;
    },
    (d) => {
      d.workers.created = 1;
    },
    (d) => {
      d.workers.observedHandles = -1;
    },
    (d) => {
      d.active = true;
      d.phase = 'playing';
    },
    (d) => {
      d.active = true;
      d.phase = 'paused';
      d.pendingPreparations = 1;
    },
    (d) => {
      d.sharedImages.uniqueObserved.images = 1;
    },
    (d) => {
      d.painters = Array.from({ length: 65 }, () => ({}));
    },
  ]) {
    const input = demoReport();
    mutate(input.snapshots[0].application.resources.demo);
    const result = assessSoloOwnedResources(input, demoOptions);
    assert.equal(result.bounds.status, 'fail', String(mutate));
    assert.equal(result.nativeMemoryQualification, false);
  }
});

test('Demo missing owners, image dimensions and reward inspection stay unknown rather than zero', () => {
  for (const mutate of [
    (d) => {
      delete d.painters;
    },
    (d) => {
      delete d.workers;
    },
    (d) => {
      d.sharedImages.unavailableSnapshots = 1;
    },
    (d) => {
      const image = { width: 0, height: 0 };
      const snapshot = { resolved: { assets: { original: {} } }, image: () => ({ image }) };
      const actual = demoSnapshot(
        demoState({ resourceOwners: new Set([{ presentation: { snapshot } }]) }),
      );
      d.scenes = actual.scenes;
      d.sharedImages = actual.sharedImages;
    },
    (d) => {
      d.reward.presentationUnavailable = true;
    },
    (d) => {
      delete d.reward.presentation;
    },
  ]) {
    const input = demoReport();
    mutate(input.snapshots[0].application.resources.demo);
    const result = assessSoloOwnedResources(input, demoOptions);
    assert.equal(result.bounds.status, 'inconclusive', String(mutate));
    assert(result.rows[0].unknown.length > 0);
  }
});

test('Demo reward media counts only owned objects and pending command, never native decode memory', () => {
  const input = demoReport();
  for (const snapshot of input.snapshots) {
    snapshot.application.resources.demo.reward.presentation = {
      state: 'paused',
      disposed: false,
      mediaElements: 1,
      ownedBlobURLs: 1,
      ownedBlobBytes: 2345,
      pendingPlayCommand: true,
      nativeDecodedBytes: null,
    };
  }
  const result = assessSoloOwnedResources(input, demoOptions);
  assert.equal(result.bounds.status, 'pass');
  assert.equal(series(result, 'demo.reward.presentation.ownedBlobBytes').maximum, 2345);
  assert.equal(result.retention.pendingAtObservedBoundaries, 'observed-pending');
  const bad = clone(input);
  bad.snapshots[0].application.resources.demo.reward.presentation.ownedBlobURLs = 0;
  assert.equal(assessSoloOwnedResources(bad, demoOptions).bounds.status, 'fail');
  bad.snapshots[0].application.resources.demo.reward.presentation = null;
  delete bad.snapshots[0].application.resources.demo.reward.presentationUnavailable;
  assert.equal(assessSoloOwnedResources(bad, demoOptions).bounds.status, 'inconclusive');
});

test('Demo painter category accounting and page-pool replicas are validated without adding shared bytes', () => {
  const input = demoReport();
  for (const snapshot of input.snapshots) {
    const r = snapshot.application.resources;
    r.demo = demoSnapshot(
      demoState({
        active: true,
        preparationPhase: () => 'paused',
        resourceOwners: new Set([{ painter: { resourceSnapshot: () => clone(r.renderer) } }]),
      }),
    );
  }
  const result = assessSoloOwnedResources(input, demoOptions);
  assert.equal(result.bounds.status, 'pass');
  assert.equal(
    series(result, 'demo.painterTotals.pixels').maximum,
    input.snapshots[0].application.resources.renderer.ownedCanvases.pixels,
  );
  assert.equal(
    result.retention.series.some((item) => item.path.startsWith('demo.painters.')),
    false,
  );
  for (const mutate of [
    (r) => {
      r.demo.painters[0].ownedCanvases.categories.sourceArt.pixels++;
    },
    (r) => {
      r.demo.painters[0].ownedCanvases.retainedPixelBufferBytes++;
    },
    (r) => {
      r.demo.painters[0].enemyImages.decodedBytes++;
    },
    (r) => {
      r.demo.painters[0].legacyImages.active = 2;
    },
    (r) => {
      r.demo.scenes = 0;
    },
    (r) => {
      r.demo.disposed = true;
    },
  ]) {
    const bad = clone(input);
    mutate(bad.snapshots[0].application.resources);
    assert.equal(assessSoloOwnedResources(bad, demoOptions).bounds.status, 'fail', String(mutate));
  }
  const missing = clone(input);
  delete missing.snapshots[0].application.resources.demo.painters[0].ownedCanvases.categories
    .sourceArt;
  assert.equal(assessSoloOwnedResources(missing, demoOptions).bounds.status, 'inconclusive');
});

test('Demo breaches before the comparable window and overflow remain explicit failures', () => {
  const input = demoReport(4);
  input.snapshots[0].group = 'failed-demo-prepare';
  input.snapshots[0].application.resources.demo.workers.created = Number.MAX_SAFE_INTEGER;
  input.snapshots[0].application.resources.demo.workers.observedHandles = Number.MAX_SAFE_INTEGER;
  input.snapshots[0].application.resources.demo.workers.terminationRequests =
    Number.MAX_SAFE_INTEGER;
  const result = assessSoloOwnedResources(input, demoOptions);
  assert.equal(result.retention.observed, 3);
  assert.equal(result.bounds.status, 'fail');
  assert(result.rows[0].failures.some((item) => item.code === 'sum-overflow'));
  assert.equal(series(result, 'demo.workers.observedHandles').status, 'observed-flat');
});
