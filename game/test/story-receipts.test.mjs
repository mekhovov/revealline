import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, stepRun, getSummary, FIXED_DT, CLASSES } from '../core/index.mjs';
import {
  emptyLibrary,
  recordLibraryCompletion,
  importLibrary,
  exportLibrary,
  mergeLibraries,
  saveLibrary,
  loadLibrary,
  withCinematicVolume,
  updatePreferences,
} from '../library.mjs';
import { createFlightPresentationPins, presentationPicturePins } from '../flight-media-pins.mjs';
import { prepareStoredStillMedia } from '../media-storage-record.mjs';
import { STORY_STORAGE_FORMAT, changeStoredStoryBinding } from '../story-storage-record.mjs';
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
const second = { ...copy(f.descriptor), revision: 2, segment: { startSeconds: 1, endSeconds: 3 } };
const history = {
  format: STORY_STORAGE_FORMAT,
  stories: [f.descriptor, second],
  originals: [f.descriptor.source.sha256],
};
async function chosen(revision, mode = 'standard') {
  const document = await changeStoredStoryBinding(
    history,
    {
      picturePin: f.pin,
      story: revision === null ? null : { id: f.descriptor.id, revision },
    },
    still,
  );
  return createFlightPresentationPins({
    library: f.library,
    identityCatalog: f.identityCatalog,
    ...f.request(mode),
    themeIds: ['fpv', 'retro'],
    storyDocument: document,
    stillDocument: still,
  });
}
function completion(runId, pins, { delay = 0, mode = 'standard', themeId = 'fpv' } = {}) {
  const entry = f.catalog.entries.find((e) => e.difficulty === mode),
    level = entry.campaign.levels[0],
    run = createRun(level, { classRecipes: entry.campaign.classRecipes ?? CLASSES });
  for (let tick = 0; tick < delay; tick++) stepRun(run, { direction: null }, FIXED_DT);
  for (let tick = 0; tick < 1000 && run.status === 'running'; tick++)
    stepRun(run, { direction: 'down' }, FIXED_DT);
  assert.equal(run.status, 'won');
  return {
    campaign: entry.campaign,
    result: getSummary(run),
    runId,
    bodyId: 'fpv-body',
    themeId,
    completedAt: '2026-09-13T08:00:00.000Z',
    mediaIdentityCatalog: f.identityCatalog,
    ...(pins === undefined ? {} : { presentationPins: pins }),
  };
}

test('real first win records S once with its picture; a faster real later win keeps first S', async () => {
  const a = chosen(1),
    b = chosen(2),
    first = completion('first', await a, { delay: 120 });
  const profile = recordLibraryCompletion(emptyLibrary(), first);
  assert.equal(profile.format, 'xonix-library.v4');
  assert.equal(profile.storyReceipts[0].storyPin.revision, 1);
  assert.equal(profile.storyReceipts[0].earnedRunId, profile.pictureReceipts[0].earnedRunId);
  const faster = completion('faster', await b);
  assert.ok(faster.result.time < first.result.time);
  const next = recordLibraryCompletion(profile, faster);
  assert.equal(next.gallery[0].runId, 'faster');
  assert.deepEqual(next.pictureReceipts, profile.pictureReceipts);
  assert.deepEqual(next.storyReceipts, profile.storyReceipts);
  assert.deepEqual(importLibrary(exportLibrary(next)), next);
  assert.equal(recordLibraryCompletion(next, faster), next);
});

test('explicit null, old picture receipts and old gallery never receive a later movie', async () => {
  const a = await chosen(1),
    none = await chosen(null);
  const oldGallery = recordLibraryCompletion(emptyLibrary(), completion('legacy')),
    oldPicture = recordLibraryCompletion(
      emptyLibrary(),
      completion('old-picture', presentationPicturePins(a)),
    ),
    explicit = recordLibraryCompletion(emptyLibrary(), completion('explicit-null', none));
  assert.equal(oldGallery.format, 'xonix-library.v2');
  assert.equal(oldPicture.format, 'xonix-library.v3');
  for (const old of [oldGallery, oldPicture, explicit]) {
    const before = exportLibrary(old);
    const next = recordLibraryCompletion(old, completion('later', a));
    assert.equal(next.format, 'xonix-library.v4');
    assert.ok(next.storyReceipts.every((r) => r.storyPin === null));
    assert.equal(exportLibrary(old), before);
  }
  assert.equal(explicit.storyReceipts[0].storyPin, null);
});

test('remote first earn wins merges, including old and explicit-null metadata', async () => {
  const a = recordLibraryCompletion(emptyLibrary(), completion('a', await chosen(1))),
    b = recordLibraryCompletion(emptyLibrary(), completion('b', await chosen(2))),
    old = recordLibraryCompletion(emptyLibrary(), completion('old')),
    none = recordLibraryCompletion(emptyLibrary(), completion('none', await chosen(null)));
  assert.deepEqual(mergeLibraries(b, a).storyReceipts, a.storyReceipts);
  assert.deepEqual(mergeLibraries(a, b).storyReceipts, b.storyReceipts);
  assert.deepEqual(mergeLibraries(a, old).storyReceipts, []);
  assert.deepEqual(mergeLibraries(a, none).storyReceipts, none.storyReceipts);
  assert.deepEqual(mergeLibraries(old, a).storyReceipts, a.storyReceipts);
});

test('Standard/Gentle and explicit legacy worlds retain separate first-earned choices', async () => {
  let profile = recordLibraryCompletion(emptyLibrary(), completion('std', await chosen(1)));
  profile = recordLibraryCompletion(
    profile,
    completion('gentle', await chosen(2, 'gentle'), { mode: 'gentle' }),
  );
  profile = recordLibraryCompletion(
    profile,
    completion('retro', await chosen(1), { themeId: 'retro' }),
  );
  assert.deepEqual(
    profile.storyReceipts.map((r) => r.storyPin?.revision ?? null),
    [1, 2, null],
  );
  assert.equal(new Set(profile.storyReceipts.map((r) => r.galleryKey)).size, 3);
  assert.deepEqual(importLibrary(exportLibrary(profile)).storyReceipts, profile.storyReceipts);
});

test('malformed story receipts reject before profile writes and preserve old strict formats', async () => {
  const profile = recordLibraryCompletion(emptyLibrary(), completion('first', await chosen(1)));
  for (const mutate of [
    (p) => (p.format = 'xonix-library.v3'),
    (p) => delete p.storyReceipts,
    (p) => (p.storyReceipts[0].storyPin = undefined),
    (p) => (p.storyReceipts[0].earnedRunId = 'other-first'),
    (p) => (p.storyReceipts[0].storyPin.picturePin.sha256 = 'f'.repeat(64)),
    (p) => (p.storyReceipts[0].storyPin.sourceSha256 = 'bad'),
    (p) => p.storyReceipts.push(copy(p.storyReceipts[0])),
    (p) => (p.pictureReceipts = []),
    (p) => (p.cinematicVolume = 1.1),
    (p) => (p.storyReceipts[0].extra = true),
  ]) {
    const changed = copy(profile);
    mutate(changed);
    assert.throws(() => importLibrary(changed));
    let writes = 0;
    assert.equal(
      saveLibrary(
        {
          setItem() {
            writes++;
          },
        },
        'profile',
        changed,
      ).ok,
      false,
    );
    assert.equal(writes, 0);
  }
});

test('one ordinary profile write persists both receipts; quota refusal preserves the prior bytes', async () => {
  const profile = recordLibraryCompletion(emptyLibrary(), completion('first', await chosen(1)));
  let raw = null,
    writes = 0;
  const storage = {
    getItem: () => raw,
    setItem: (_key, value) => {
      raw = value;
      writes++;
    },
  };
  assert.equal(saveLibrary(storage, 'profile', profile).ok, true);
  assert.equal(writes, 1);
  assert.deepEqual(loadLibrary(storage, 'profile').library.storyReceipts, profile.storyReceipts);
  const before = raw;
  storage.setItem = () => {
    throw new Error('quota');
  };
  assert.equal(saveLibrary(storage, 'profile', withCinematicVolume(profile, 0.2)).ok, false);
  assert.equal(raw, before);
});

test('cinematic preference uses v4 only, merges independently and keeps music and old profile bytes', () => {
  const old = emptyLibrary(),
    bytes = exportLibrary(old),
    a = withCinematicVolume(old, 0.2);
  assert.equal(a.format, 'xonix-library.v4');
  assert.equal(a.preferences.musicVolume, old.preferences.musicVolume);
  assert.deepEqual(a.pictureReceipts, []);
  assert.deepEqual(a.storyReceipts, []);
  assert.equal(exportLibrary(old), bytes);
  assert.equal(
    mergeLibraries(a, withCinematicVolume(old, 0.4), { baseline: old }).cinematicVolume,
    0.2,
  );
  assert.equal(
    mergeLibraries(a, withCinematicVolume(a, 0.4), { baseline: a }).cinematicVolume,
    0.4,
  );
  assert.equal(updatePreferences(a, { textSize: 'large' }).cinematicVolume, 0.2);
  assert.throws(() => withCinematicVolume(a, NaN));
});
