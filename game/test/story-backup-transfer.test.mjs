import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, stepRun, getSummary, FIXED_DT, CLASSES } from '../core/index.mjs';
import { createRecorder, recordInput, authoritativeCheckpoint } from '../replay.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';
import {
  emptyLibrary,
  exportLibrary,
  importLibrary,
  recordLibraryCompletion,
  withCinematicVolume,
} from '../library.mjs';
import { emptyPackLibrary } from '../packs.mjs';
import { createExecutionCatalog, expandDifficultyCampaigns } from '../campaign-contexts.mjs';
import { createMediaIdentityCatalog } from '../media-library.mjs';
import {
  prepareStoredStillMedia,
  createStoredStillIdentityCatalog,
} from '../media-storage-record.mjs';
import { STORY_STORAGE_FORMAT, changeStoredStoryBinding } from '../story-storage-record.mjs';
import { createFlightPresentationPins, storyPinForTheme } from '../flight-media-pins.mjs';
import { BACKUP_FORMAT, prepareBackup, exportBackup, isPreparedBackup } from '../backup.mjs';
import { commitBackup } from '../backup-storage.mjs';
import { prepareProfileTransfer, transferFingerprint } from '../profile-transfer.mjs';
import { createStoryFixture } from './helpers/victory-story-fixture.mjs';
import { pngBytes } from './helpers/media-fixtures.mjs';

// Actual core runs and canonical pins; storage/Web Locks are modeled. No movie
// inspection, .rlmedia/.rlstory read or original-byte recovery is claimed here.
const f = createStoryFixture();
const still = (
  await prepareStoredStillMedia(
    f.library,
    [{ sha256: f.pin.sha256, blob: new Blob([pngBytes()]) }],
    {
      executionCatalog: f.catalog,
      decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }),
    },
  )
).library;
const second = {
  ...structuredClone(f.descriptor),
  revision: 2,
  segment: { startSeconds: 1, endSeconds: 3 },
};
const history = {
  format: STORY_STORAGE_FORMAT,
  stories: [f.descriptor, second],
  originals: [f.descriptor.source.sha256],
};
async function fixture(mode = 'standard', turnPolicy = 'grid-center') {
  const entry = f.catalog.entries.find((e) => e.difficulty === mode),
    level = entry.campaign.levels[0];
  const choose = async (revision) =>
    createFlightPresentationPins({
      library: f.library,
      identityCatalog: f.identityCatalog,
      ...f.request(mode),
      themeIds: ['fpv', 'retro'],
      storyDocument: await changeStoredStoryBinding(
        history,
        { picturePin: f.pin, story: { id: f.descriptor.id, revision } },
        still,
      ),
      stillDocument: still,
    });
  const a = await choose(1),
    b = await choose(2);
  const options = {
    classId: 'scout',
    classRecipes: entry.campaign.classRecipes ?? CLASSES,
    turnPolicy,
    seed: 1,
  };
  function win(runId, pins, delay) {
    const run = createRun(level, options);
    for (let i = 0; i < delay; i++) stepRun(run, { direction: null }, FIXED_DT);
    for (let i = 0; i < 1000 && run.status === 'running'; i++)
      stepRun(run, { direction: 'down' }, FIXED_DT);
    assert.equal(run.status, 'won');
    return {
      campaign: entry.campaign,
      result: getSummary(run),
      themeId: 'fpv',
      bodyId: 'fpv-body',
      runId,
      completedAt: '2026-09-13T15:00:00.000Z',
      presentationPins: pins,
      mediaIdentityCatalog: f.identityCatalog,
    };
  }
  const first = win('first-story-A', a, 120),
    better = win('better-story-B', b, 0);
  assert(better.result.time < first.result.time);
  const library = withCinematicVolume(
    recordLibraryCompletion(recordLibraryCompletion(emptyLibrary(), first), better),
    0.25,
  );
  assert.equal(library.gallery[0].runId, 'better-story-B');
  assert.equal(library.storyReceipts[0].storyPin.revision, 1);
  const run = createRun(level, options),
    recorder = createRecorder(level, options);
  for (const direction of [...Array(13).fill('down'), 'right']) {
    const command = { direction };
    recordInput(recorder, command);
    stepRun(run, command, FIXED_DT);
  }
  assert.equal(run.status, 'running');
  const session = suspendSession({
    run,
    recorder,
    campaignKey: entry.executionKey,
    themeId: 'fpv',
    bodyId: 'fpv-body',
    runId: 'unfinished-A',
    savedAt: '2026-09-13T15:01:00.000Z',
    continuation: { direction: 'right' },
    presentationPins: a,
  });
  return {
    entry,
    run,
    library,
    session,
    a,
    b,
    source: { format: BACKUP_FORMAT, library, packs: emptyPackLibrary(), session },
    options: {
      campaigns: [f.campaign],
      expandCampaigns: expandDifficultyCampaigns,
      resolveMediaIdentityCatalog: () => f.identityCatalog,
    },
  };
}
function target() {
  const local = new Map(),
    assets = new Map(),
    writes = [];
  let failFinalize = false;
  const storage = {
    getItem: (key) => local.get(key) ?? null,
    setItem: (key, value) => {
      writes.push(['local', key]);
      local.set(key, value);
    },
    removeItem: (key) => {
      writes.push(['remove', key]);
      local.delete(key);
    },
  };
  const adapters = {
    storage,
    profileKey: 'profile',
    sessionKey: 'session',
    packsKey: 'packs',
    journalKey: 'journal',
    readAsset: async (key) => assets.get(key) ?? null,
    writeAsset: async (key, value) => {
      if (failFinalize && key === 'journal' && value === null) {
        failFinalize = false;
        throw new Error('Journal clear quota');
      }
      writes.push(['asset', key]);
      if (value === null) assets.delete(key);
      else assets.set(key, value);
    },
    withLock: async (task) => task(),
    commitProfile: async (library, options) => {
      assert.equal(options.mode, 'replace');
      assert.equal(local.get(options.writeLock.key), options.writeLock.token);
      storage.setItem('profile', exportLibrary(library));
      return { ok: true, library };
    },
  };
  return {
    local,
    assets,
    writes,
    adapters,
    failFinalization() {
      failFinalize = true;
    },
    snapshot: () => structuredClone({ local, assets }),
  };
}
function transferSource(input) {
  // Explicit future test channels, not a claim that any frozen release writes v4.
  const id = 'release-v9.0.0',
    profile = `revealline.library.${id}.v1`;
  const keys = {
    profile,
    session: `revealline.suspended.${id}.v1`,
    packs: `revealline.packs.${id}.v1`,
    writer: `${profile}.writer`,
    lock: `${profile}.backup-lock`,
  };
  const local = new Map([
    [keys.profile, exportLibrary(input.library)],
    [keys.session, JSON.stringify(input.session)],
  ]);
  const assets = new Map([[keys.packs, JSON.stringify(input.source.packs)]]),
    held = new Set();
  const read = (map, key) => {
    assert.deepEqual(held, new Set([keys.writer, keys.lock]));
    return map.get(key) ?? null;
  };
  return {
    id,
    local,
    assets,
    held,
    options: {
      ...input.options,
      currentVersion: '9.0.1',
      storage: {
        getItem: (key) => read(local, key),
        setItem: () => assert.fail('Source write'),
        removeItem: () => assert.fail('Source delete'),
      },
      readAsset: async (key) => read(assets, key),
      lockManager: {
        async request(key, options, task) {
          assert.deepEqual(options, { mode: 'exclusive', ifAvailable: true });
          assert.equal(held.has(key), false);
          held.add(key);
          try {
            return await task({ name: key });
          } finally {
            held.delete(key);
          }
        },
      },
    },
  };
}

for (const mode of ['standard', 'gentle'])
  for (const policy of ['immediate', 'grid-center']) {
    test(`story metadata backup preserves real ${mode}/${policy} flight A and first-earned A after better B`, async () => {
      const input = await fixture(mode, policy),
        source = structuredClone(input.source),
        before = structuredClone(source);
      const prepared = await prepareBackup(source, input.options);
      const text = await exportBackup(prepared, input.options);
      const restored = await prepareBackup(text, input.options);
      assert(isPreparedBackup(restored));
      assert.equal(restored.library.format, 'xonix-library.v4');
      assert.equal(restored.session.format, 'xonix-session.v4');
      assert.deepEqual(restored.library, input.library);
      assert.deepEqual(restored.session.presentationPins, input.a);
      assert.equal(restored.library.cinematicVolume, 0.25);
      assert.equal(storyPinForTheme(restored.session.presentationPins, 'fpv').revision, 1);
      assert.equal(restored.library.storyReceipts[0].earnedRunId, 'first-story-A');
      assert.equal(restored.library.gallery[0].runId, 'better-story-B');
      const flight = await restoreSession(restored.session, {
        campaign: input.entry.campaign,
        campaignKey: input.entry.executionKey,
        mediaIdentityCatalog: f.identityCatalog,
      });
      assert.deepEqual(authoritativeCheckpoint(flight.run), authoritativeCheckpoint(input.run));
      for (let i = 0; i < 40; i++) {
        stepRun(flight.run, { direction: 'right' }, FIXED_DT);
        stepRun(input.run, { direction: 'right' }, FIXED_DT);
      }
      assert.deepEqual(authoritativeCheckpoint(flight.run), authoritativeCheckpoint(input.run));
      assert.deepEqual(source, before);
    });
  }

test('v4 flight with no earned receipts still invokes its exact owner resolver and roundtrips', async () => {
  const input = await fixture();
  let calls = 0;
  const options = {
    ...input.options,
    resolveMediaIdentityCatalog(context) {
      calls++;
      assert.deepEqual(context.originals, [f.campaign]);
      assert.deepEqual(context.packs, emptyPackLibrary());
      return f.identityCatalog;
    },
  };
  const prepared = await prepareBackup({ ...input.source, library: emptyLibrary() }, options);
  assert.equal(calls, 1);
  assert.deepEqual(prepared.library, emptyLibrary());
  assert.deepEqual(prepared.session, input.session);
  const again = await prepareBackup(await exportBackup(prepared, options), options);
  assert.equal(calls, 3);
  assert.deepEqual(again.session.presentationPins, input.a);
});

test('v4 flight with empty profile still requires a synchronous branded owner resolver before any write', async () => {
  const input = await fixture(),
    destination = target();
  const foreign = createMediaIdentityCatalog(createExecutionCatalog([]));
  for (const source of [
    input.source,
    { ...input.source, session: null },
    { ...input.source, library: emptyLibrary() },
  ]) {
    for (const resolveMediaIdentityCatalog of [
      undefined,
      () => ({}),
      async () => f.identityCatalog,
      () => foreign,
    ]) {
      await assert.rejects(async () => {
        const prepared = await prepareBackup(source, {
          ...input.options,
          resolveMediaIdentityCatalog,
        });
        await commitBackup(prepared, destination.adapters);
      }, /picture|catalog|authored|owner/);
      assert.deepEqual(destination.writes, []);
    }
  }
});

test('retained owner reconstructs earned story metadata after pack removal without originals or an installation', async () => {
  const input = await fixture('gentle');
  const historical = createStoredStillIdentityCatalog(JSON.stringify(still));
  const prepared = await prepareBackup(
    { ...input.source, session: null },
    {
      campaigns: [],
      resolveMediaIdentityCatalog: (context) => {
        assert.deepEqual(context.originals, []);
        assert.deepEqual(context.campaigns, []);
        assert.deepEqual(context.packs, emptyPackLibrary());
        return historical;
      },
    },
  );
  assert.deepEqual(prepared.library.storyReceipts, input.library.storyReceipts);
  assert.deepEqual(prepared.library.pictureReceipts, input.library.pictureReceipts);
  assert.deepEqual(prepared.packs, emptyPackLibrary());
});

test('coherent but foreign story/picture owner fields refuse before target commit', async () => {
  const input = await fixture('gentle'),
    destination = target();
  for (const kind of ['session', 'earned']) {
    const source = structuredClone(input.source);
    if (kind === 'session') {
      const choice = source.session.presentationPins.choices[0];
      choice.picture.identity.baseCampaignKey += '-foreign';
    } else {
      source.session = null;
      source.library.pictureReceipts[0].presentationPin.identity.levelRevision += '-foreign';
      source.library.storyReceipts[0].storyPin.picturePin.identity.levelRevision += '-foreign';
    }
    await assert.rejects(async () => {
      const prepared = await prepareBackup(source, input.options);
      await commitBackup(prepared, destination.adapters);
    }, /owner|authored|picture|identity/);
    assert.deepEqual(destination.writes, []);
  }
});

test('earlier-channel v4 transfer retains metadata, source locks and fingerprint, then explicit commit and Undo', async () => {
  const input = await fixture('gentle'),
    source = transferSource(input);
  const original = structuredClone({ local: source.local, assets: source.assets });
  const review = await prepareProfileTransfer(source.id, source.options);
  assert.deepEqual(review.prepared.library, input.library);
  assert.deepEqual(review.prepared.session, input.session);
  assert.equal(review.preview.pictures, 1);
  assert.equal(review.preview.hasSession, true);
  assert.equal(review.fingerprint, await transferFingerprint(review.prepared));
  assert.equal(
    (await prepareProfileTransfer(source.id, source.options)).fingerprint,
    review.fingerprint,
  );
  assert.deepEqual({ local: source.local, assets: source.assets }, original);
  assert.equal(source.held.size, 0);
  const destination = target(),
    previous = await prepareBackup({
      format: BACKUP_FORMAT,
      library: emptyLibrary(),
      packs: emptyPackLibrary(),
      session: null,
    });
  assert.equal((await commitBackup(previous, destination.adapters)).ok, true);
  const before = destination.snapshot();
  assert.equal((await commitBackup(review.prepared, destination.adapters)).ok, true);
  assert.deepEqual(
    importLibrary(destination.local.get('profile')).storyReceipts,
    input.library.storyReceipts,
  );
  assert.equal(importLibrary(destination.local.get('profile')).cinematicVolume, 0.25);
  assert.deepEqual(JSON.parse(destination.local.get('session')), input.session);
  assert.equal(destination.assets.has('journal'), false);
  assert.equal((await commitBackup(previous, destination.adapters)).ok, true);
  assert.deepEqual(destination.snapshot(), before);
  assert.deepEqual({ local: source.local, assets: source.assets }, original);
});

test('missing/foreign/cancelled transfer resolver cannot reach fingerprint or source/target writes', async () => {
  const input = await fixture(),
    destination = target();
  for (const issue of ['missing', 'foreign', 'cancel']) {
    const source = transferSource(input),
      original = structuredClone({ local: source.local, assets: source.assets }),
      controller = new AbortController();
    const options = {
      ...source.options,
      signal: controller.signal,
      digest: () => assert.fail('Refused fingerprint'),
    };
    if (issue === 'missing') options.resolveMediaIdentityCatalog = undefined;
    if (issue === 'foreign')
      options.resolveMediaIdentityCatalog = () =>
        createMediaIdentityCatalog(createExecutionCatalog([]));
    if (issue === 'cancel')
      options.resolveMediaIdentityCatalog = () => {
        controller.abort();
        return f.identityCatalog;
      };
    await assert.rejects(async () => {
      const reviewed = await prepareProfileTransfer(source.id, options);
      await commitBackup(reviewed.prepared, destination.adapters);
    }, /picture|authored|cancel/);
    assert.deepEqual(destination.writes, []);
    assert.deepEqual({ local: source.local, assets: source.assets }, original);
    assert.equal(source.held.size, 0);
  }
});

test('failure after v4 profile write rolls back exact prior target values and keeps the prepared import reusable', async () => {
  const input = await fixture(),
    destination = target();
  const previous = await prepareBackup({
    format: BACKUP_FORMAT,
    library: emptyLibrary(),
    packs: emptyPackLibrary(),
    session: null,
  });
  assert.equal((await commitBackup(previous, destination.adapters)).ok, true);
  const before = destination.snapshot(),
    prepared = await prepareBackup(input.source, input.options);
  destination.failFinalization();
  const result = await commitBackup(prepared, destination.adapters);
  assert.equal(result.ok, false);
  assert.equal(result.rolledBack, true);
  assert.equal(result.recoveryRequired, false);
  assert.deepEqual(destination.snapshot(), before);
  assert.equal((await commitBackup(prepared, destination.adapters)).ok, true);
  assert.deepEqual(importLibrary(destination.local.get('profile')), input.library);
});
