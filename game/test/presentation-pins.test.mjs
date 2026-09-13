import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, stepRun, FIXED_DT, CLASSES } from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  authoritativeCheckpoint,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';
import {
  suspendSession,
  restoreSession,
  snapshotSession,
  saveSession,
  SESSION_STORAGE_BYTES,
} from '../sessions.mjs';
import { validateMediaLibrary, MEDIA_LIBRARY_FORMAT } from '../media-library.mjs';
import {
  createPresentationPins,
  snapshotPresentationPins,
  validatePresentationPinsForRun,
  resolvePinnedPicture,
  PRESENTATION_PINS_BYTES,
} from '../presentation-pins.mjs';
import {
  mediaFixture,
  libraryRecord,
  assetRecord,
  presentationRecord,
} from './helpers/media-fixtures.mjs';

function fixture(mode = 'standard', turnPolicy = 'grid-center') {
  const f = mediaFixture(true),
    entry = f.catalog.entries.find((item) => item.difficulty === mode),
    library = validateMediaLibrary(libraryRecord(f.identity), f);
  const request = f.request(mode),
    pins = createPresentationPins({
      library,
      identityCatalog: f.identityCatalog,
      ...request,
      themeIds: ['fpv', 'ukraine', 'retro', 'network'],
    });
  const level = entry.campaign.levels[0],
    options = {
      classId: 'scout',
      classRecipes: entry.campaign.classRecipes ?? CLASSES,
      turnPolicy,
    },
    run = createRun(level, options),
    recorder = createRecorder(level, options);
  for (const direction of [...Array(13).fill('down'), 'right']) {
    const command = { direction, boost: false, action: false, pickup: false };
    stepRun(run, command, FIXED_DT);
    recordInput(recorder, command);
  }
  const flight = {
    run,
    recorder,
    campaignKey: entry.executionKey,
    themeId: 'fpv',
    bodyId: 'fpv-body',
    runId: 'pinned-flight',
    savedAt: '2026-09-13T08:00:00.000Z',
    continuation: { direction: 'right' },
  };
  return { ...f, entry, library, pins, flight, level };
}

test('per-world choices freeze original A and explicit authored art despite assignment B', () => {
  const f = fixture(),
    pins = f.pins;
  assert.equal(resolvePinnedPicture(pins, 'fpv', f.library).asset.id, 'picture-a');
  assert.equal(resolvePinnedPicture(pins, 'retro', f.library).kind, 'legacy');
  const next = structuredClone(f.library);
  next.assets.push({ ...assetRecord('picture-b'), sha256: 'b'.repeat(64) });
  next.presentations.push(presentationRecord(f.identity, 2, 'picture-b'));
  next.assignments[0].revision = 2;
  const changed = validateMediaLibrary(next, { ...f, previous: f.library });
  assert.equal(resolvePinnedPicture(pins, 'fpv', changed).asset.id, 'picture-a');
  assert.equal(resolvePinnedPicture(pins, 'retro', changed).kind, 'legacy');
  const fresh = createPresentationPins({
    library: changed,
    identityCatalog: f.identityCatalog,
    ...f.request(),
    themeIds: ['fpv', 'retro'],
  });
  assert.equal(resolvePinnedPicture(fresh, 'fpv', changed).asset.id, 'picture-b');
  assert.throws(() => {
    pins.choices[0].assetId = 'picture-b';
  }, TypeError);
});

for (const mode of ['standard', 'gentle'])
  for (const turn of ['immediate', 'grid-center'])
    test(`v3 ${mode}/${turn} saves exact replay and continuation with authored picture owner`, async () => {
      const f = fixture(mode, turn),
        before = authoritativeCheckpoint(f.flight.run),
        recording = structuredClone(f.flight.recorder);
      const saved = suspendSession({ ...f.flight, presentationPins: f.pins });
      assert.equal(saved.format, 'xonix-session.v3');
      assert.deepEqual(authoritativeCheckpoint(f.flight.run), before);
      assert.deepEqual(f.flight.recorder, recording);
      assert.equal(verifyReplay(saved.replay).match, true);
      const restored = await restoreSession(saved, {
        campaign: f.entry.campaign,
        campaignKey: f.entry.executionKey,
        mediaIdentityCatalog: f.identityCatalog,
      });
      assert.deepEqual(restored.session.presentationPins, f.pins);
      assert.deepEqual(authoritativeCheckpoint(restored.run), before);
      assert.equal(restored.session.continuation.direction, 'right');
      assert.deepEqual(
        exportReplay(restored.recorder, restored.run).checkpoint,
        saved.replay.checkpoint,
      );
      assert.deepEqual(snapshotSession(JSON.stringify(saved)), saved);
      if (mode === 'gentle')
        assert.notEqual(f.pins.levelRevision, f.pins.choices[0].identity.levelRevision);
    });

test('restore verifies exact installed authored owner instead of trusting pin metadata', async () => {
  const f = fixture(),
    saved = suspendSession({ ...f.flight, presentationPins: f.pins });
  await assert.rejects(
    restoreSession(saved, { campaign: f.entry.campaign, campaignKey: f.entry.executionKey }),
    /execution catalog/,
  );
  const forged = structuredClone(saved);
  for (const item of forged.presentationPins.choices) item.identity.baseCampaignKey += '-another';
  await assert.rejects(
    restoreSession(forged, {
      campaign: f.entry.campaign,
      campaignKey: f.entry.executionKey,
      mediaIdentityCatalog: f.identityCatalog,
    }),
    /authored map/,
  );
  assert.throws(
    () =>
      validatePresentationPinsForRun(f.pins, {
        identityCatalog: f.identityCatalog,
        campaignKey: f.entry.executionKey,
        level: { ...f.level, revision: 'other' },
        themeId: 'fpv',
      }),
    /flight context/,
  );
});

test('missing old picture stays unavailable; unknown worlds never use a fresh assignment', () => {
  const f = fixture(),
    empty = validateMediaLibrary(
      { format: MEDIA_LIBRARY_FORMAT, assets: [], presentations: [], assignments: [] },
      f,
    );
  assert.equal(resolvePinnedPicture(f.pins, 'fpv', empty).kind, 'unavailable');
  assert.equal(resolvePinnedPicture(f.pins, 'retro', empty).kind, 'legacy');
  assert.throws(() => resolvePinnedPicture(f.pins, 'unexpected-world', f.library), /not included/);
  assert.throws(
    () =>
      createPresentationPins({
        library: f.library,
        identityCatalog: f.identityCatalog,
        ...f.request(),
        themeIds: ['fpv', 'missing'],
      }),
    /execution catalog/,
  );
});

test('strict bounded owned pins reject malformed or mixed map identities', () => {
  const f = fixture();
  for (const change of [
    (p) => {
      p.extra = true;
    },
    (p) => {
      p.choices.push(p.choices[0]);
    },
    (p) => {
      p.choices[0].sha256 = 'bad';
    },
    (p) => {
      p.choices[0].presentationRevision = 0;
    },
    (p) => {
      p.choices[0].assetId = '../asset';
    },
    (p) => {
      p.choices[1].identity.levelRevision = 'other';
    },
    (p) => {
      p.choices[1].identity.levelId = 'other';
    },
    (p) => {
      p.choices[1].assetId = 'unexpected';
    },
    (p) => {
      p.choices = [];
    },
    (p) => {
      p.choices = Array.from({ length: 65 }, (_, i) => ({
        kind: 'legacy',
        identity: { ...p.choices[0].identity, themeId: `theme-${i}` },
      }));
    },
  ]) {
    const p = structuredClone(f.pins);
    change(p);
    assert.throws(() => snapshotPresentationPins(p));
  }
  const source = structuredClone(f.pins),
    accepted = snapshotPresentationPins(source);
  source.choices[0].sha256 = 'b'.repeat(64);
  assert.equal(accepted.choices[0].sha256, 'a'.repeat(64));
  assert.ok(Buffer.byteLength(JSON.stringify(accepted)) < PRESENTATION_PINS_BYTES);
});

test('v1 and v2 stay unchanged; invalid v3 never releases a queued turn', () => {
  const f = fixture(),
    before = authoritativeCheckpoint(f.flight.run);
  assert.throws(
    () => suspendSession({ ...f.flight, continuation: undefined, presentationPins: f.pins }),
    /explicit continuation/,
  );
  assert.deepEqual(authoritativeCheckpoint(f.flight.run), before);
  const v2 = suspendSession(f.flight);
  assert.equal(v2.format, 'xonix-session.v2');
  assert.equal(Object.hasOwn(v2, 'presentationPins'), false);
  assert.throws(() => snapshotSession({ ...v2, presentationPins: f.pins }));
  const v1 = suspendSession({ ...f.flight, continuation: undefined });
  assert.equal(v1.format, 'xonix-session.v1');
  assert.equal(Object.hasOwn(v1, 'presentationPins'), false);
  assert.equal(verifyReplay(v1.replay).match, true);
  assert.equal(SESSION_STORAGE_BYTES, 2 * 1024 * 1024);
});

test('storage failure preserves previous saved flight with valid v3 envelope', () => {
  const f = fixture(),
    saved = suspendSession({ ...f.flight, presentationPins: f.pins });
  const storage = {
    previous: 'old',
    setItem() {
      throw new Error('quota');
    },
  };
  assert.equal(saveSession(storage, 'flight', saved).ok, false);
  assert.equal(storage.previous, 'old');
});
