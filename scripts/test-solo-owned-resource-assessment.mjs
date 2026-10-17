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
