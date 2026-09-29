import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, stepRun, FIXED_DT, CLASSES } from '../core/index.mjs';
import { createRecorder, recordInput, authoritativeCheckpoint, exportReplay } from '../replay.mjs';
import { createPresentationPins, snapshotPresentationPins } from '../presentation-pins.mjs';
import {
  FLIGHT_MEDIA_PINS_FORMAT,
  createFlightPresentationPins,
  snapshotFlightPresentationPins,
  presentationPicturePins,
  storyPinForTheme,
  validateFlightPresentationPinsForRun,
} from '../flight-media-pins.mjs';
import { suspendSession, restoreSession, snapshotSession } from '../sessions.mjs';
import { prepareStoredStillMedia } from '../media-storage-record.mjs';
import { STORY_STORAGE_FORMAT, changeStoredStoryBinding } from '../story-storage-record.mjs';
import { resolveAuthoredStoryPin } from '../story-bindings.mjs';
import { createStoryFixture } from './helpers/victory-story-fixture.mjs';
import { pngBytes } from './helpers/media-fixtures.mjs';

const copy = (v) => structuredClone(v),
  f = createStoryFixture();
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
const b = { ...copy(f.descriptor), revision: 2, segment: { startSeconds: 1, endSeconds: 3 } };
const history = {
  format: STORY_STORAGE_FORMAT,
  stories: [f.descriptor, b],
  originals: [f.descriptor.source.sha256],
};
const bound = await changeStoredStoryBinding(
  history,
  {
    picturePin: f.pin,
    story: { id: f.descriptor.id, revision: 1 },
  },
  still,
);
const request = (mode = 'standard') => ({
  library: f.library,
  identityCatalog: f.identityCatalog,
  ...f.request(mode),
  themeIds: ['fpv', 'ukraine', 'retro', 'network'],
});
const pins = (document = bound, mode = 'standard', context = still) =>
  createFlightPresentationPins({
    ...request(mode),
    storyDocument: document,
    stillDocument: context,
  });

test('fresh choices freeze complete selected story A and explicit null for every other world', async () => {
  const a = await pins();
  assert.equal(a.format, FLIGHT_MEDIA_PINS_FORMAT);
  assert.equal(a.choices.length, 4);
  assert.equal(storyPinForTheme(a, 'fpv').revision, 1);
  assert.equal(storyPinForTheme(a, 'retro'), null);
  assert.deepEqual(presentationPicturePins(a), createPresentationPins(request()));
  const changed = await changeStoredStoryBinding(
    bound,
    {
      picturePin: f.pin,
      story: { id: b.id, revision: b.revision },
    },
    still,
  );
  assert.equal(storyPinForTheme(await pins(changed), 'fpv').revision, 2);
  const resolved = await resolveAuthoredStoryPin(storyPinForTheme(a, 'fpv'), {
    document: changed,
    still,
    picturePin: f.pin,
  });
  assert.equal(resolved.descriptor.revision, 1);
  assert.ok(Object.isFrozen(a.choices[0].story));
});

test('old attempt and explicit null never add a newly available authored story', async () => {
  const old = createPresentationPins(request()),
    raw = JSON.stringify(old);
  assert.equal(storyPinForTheme(old, 'fpv'), null);
  assert.equal(JSON.stringify(snapshotFlightPresentationPins(old)), raw);
  const empty = await pins(history),
    cleared = await changeStoredStoryBinding(
      bound,
      {
        picturePin: f.pin,
        story: null,
      },
      still,
    );
  assert.equal(storyPinForTheme(empty, 'fpv'), null);
  assert.equal(storyPinForTheme(await pins(cleared), 'fpv'), null);
  assert.throws(() => snapshotPresentationPins(empty), /Unsupported|Invalid/);
});

test('original unavailability preserves the exact movie pin without decoder allocation', async () => {
  const a = await pins(),
    detached = { ...copy(bound), originals: [] };
  assert.deepEqual(await pins(detached), a);
  assert.equal(
    (
      await resolveAuthoredStoryPin(storyPinForTheme(a, 'fpv'), {
        document: detached,
        still,
        picturePin: f.pin,
      })
    ).kind,
    'unavailable',
  );
});

test('selection snapshots caller metadata before real digest work and honors cancellation', async () => {
  const document = copy(bound),
    owner = copy(still),
    pending = pins(document, 'standard', owner);
  document.bindings[0].story = null;
  owner.library.assets[0].sha256 = 'f'.repeat(64);
  assert.equal(storyPinForTheme(await pending, 'fpv').revision, 1);
  const controller = new AbortController();
  const cancelled = createFlightPresentationPins(
    { ...request(), storyDocument: bound, stillDocument: still },
    { signal: controller.signal },
  );
  controller.abort();
  await assert.rejects(cancelled, { name: 'AbortError' });
});

test('new strict envelope rejects missing/null confusion, extra fields, legacy movie and oversize', async () => {
  const source = await pins();
  for (const mutate of [
    (p) => delete p.choices[0].story,
    (p) => (p.choices[0].story = undefined),
    (p) => (p.choices[0].story.extra = 1),
    (p) => (p.choices[0].story.sourceSha256 = 'bad'),
    (p) => (p.choices[1].story = copy(p.choices[0].story)),
    (p) => (p.choices[0].picture.identity.levelId = 'foreign'),
    (p) => p.choices.push(copy(p.choices[0])),
    (p) => (p.extra = 'x'.repeat(8192)),
  ]) {
    const changed = copy(source);
    mutate(changed);
    assert.throws(() => snapshotFlightPresentationPins(changed));
  }
  assert.throws(() => storyPinForTheme(source, 'foreign'), /absent/);
  const foreign = copy(source);
  foreign.choices[0].picture.identity.baseCampaignKey += '-foreign';
  assert.throws(() =>
    validateFlightPresentationPinsForRun(foreign, {
      identityCatalog: f.identityCatalog,
      campaignKey: f.request().executionKey,
      level: f.catalog.entries[0].campaign.levels[0],
      themeId: 'fpv',
    }),
  );
});

for (const difficulty of ['standard', 'gentle'])
  for (const turnPolicy of ['immediate', 'grid-center'])
    test(`v4 real unfinished replay restores ${difficulty}/${turnPolicy} A with unchanged continuation`, async () => {
      const entry = f.catalog.entries.find((e) => e.difficulty === difficulty),
        level = entry.campaign.levels[0],
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
      const chosen = await pins(bound, difficulty),
        checkpoint = authoritativeCheckpoint(run),
        before = exportReplay(recorder, run),
        flight = {
          run,
          recorder,
          campaignKey: entry.executionKey,
          themeId: 'fpv',
          bodyId: 'fpv-body',
          runId: 'story-flight',
          savedAt: '2026-09-13T08:00:00.000Z',
          continuation: { direction: 'right' },
        },
        saved = suspendSession({ ...flight, presentationPins: chosen });
      assert.equal(saved.format, 'xonix-session.v4');
      assert.deepEqual(exportReplay(recorder, run), before);
      assert.deepEqual(snapshotSession(JSON.stringify(saved)), saved);
      const context = {
        campaign: entry.campaign,
        campaignKey: entry.executionKey,
        mediaIdentityCatalog: f.identityCatalog,
      };
      const restored = await restoreSession(saved, context);
      assert.deepEqual(authoritativeCheckpoint(restored.run), checkpoint);
      assert.deepEqual(restored.session.presentationPins, chosen);
      assert.equal(restored.session.continuation.direction, 'right');
      assert.deepEqual(
        exportReplay(restored.recorder, restored.run).checkpoint,
        saved.replay.checkpoint,
      );
      await assert.rejects(
        restoreSession(saved, { ...context, mediaIdentityCatalog: undefined }),
        /execution catalog/,
      );
      const old = suspendSession({ ...flight, presentationPins: presentationPicturePins(chosen) });
      assert.equal(old.format, 'xonix-session.v3');
      assert.equal(
        storyPinForTheme((await restoreSession(old, context)).session.presentationPins, 'fpv'),
        null,
      );
      assert.throws(
        () => snapshotSession({ ...saved, format: 'xonix-session.v3' }),
        /versions differ/,
      );
      assert.throws(
        () => snapshotSession({ ...old, format: 'xonix-session.v4' }),
        /versions differ/,
      );
    });
