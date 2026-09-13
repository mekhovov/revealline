import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, stepRun, getSummary, FIXED_DT, CLASSES } from '../core/index.mjs';
import {
  emptyLibrary,
  recordLibraryCompletion,
  exportLibrary,
  importLibrary,
  mergeLibraries,
  saveLibrary,
  loadLibrary,
  updatePreferences,
} from '../library.mjs';
import { validateMediaLibrary } from '../media-library.mjs';
import { createPresentationPins } from '../presentation-pins.mjs';
import {
  mediaFixture,
  libraryRecord,
  assetRecord,
  presentationRecord,
} from './helpers/media-fixtures.mjs';

function fixture() {
  const f = mediaFixture(true),
    first = validateMediaLibrary(libraryRecord(f.identity), f),
    next = structuredClone(first);
  next.assets.push({ ...assetRecord('picture-b'), sha256: 'b'.repeat(64) });
  next.presentations.push(presentationRecord(f.identity, 2, 'picture-b'));
  next.assignments[0].revision = 2;
  const second = validateMediaLibrary(next, { ...f, previous: first });
  const options = (id, library = first, mode = 'standard', themeId = 'fpv') => {
    const entry = f.catalog.entries.find((x) => x.difficulty === mode),
      level = entry.campaign.levels[0],
      run = createRun(level, { classRecipes: entry.campaign.classRecipes ?? CLASSES });
    for (let i = 0; i < 1000 && run.status === 'running'; i++)
      stepRun(run, { direction: 'down' }, FIXED_DT);
    assert.equal(run.status, 'won');
    return {
      campaign: entry.campaign,
      result: getSummary(run),
      runId: id,
      bodyId: 'fpv-body',
      themeId,
      completedAt: '2026-09-13T08:00:00.000Z',
      mediaIdentityCatalog: f.identityCatalog,
      presentationPins: createPresentationPins({
        library,
        identityCatalog: f.identityCatalog,
        ...f.request(mode),
        themeIds: ['fpv', 'retro'],
      }),
    };
  };
  return { ...f, first, second, options };
}

test('first real win commits artwork metadata with gallery; better score never replaces first picture', () => {
  const f = fixture(),
    a = recordLibraryCompletion(emptyLibrary(), f.options('first'));
  assert.equal(a.format, 'xonix-library.v3');
  assert.equal(a.pictureReceipts[0].presentationPin.assetId, 'picture-a');
  const better = f.options('better', f.second);
  better.result.score += 1000;
  const b = recordLibraryCompletion(a, better);
  assert.equal(b.gallery[0].runId, 'better');
  assert.deepEqual(b.pictureReceipts, a.pictureReceipts);
  assert.deepEqual(importLibrary(exportLibrary(b)), b);
  assert.equal(recordLibraryCompletion(b, better), b);
  assert.equal(updatePreferences(b, { textSize: 'large' }).pictureReceipts[0].earnedRunId, 'first');
});

test('legacy earned rows are not assigned today’s art retrospectively', () => {
  const f = fixture(),
    { presentationPins, ...oldOptions } = f.options('legacy');
  const old = recordLibraryCompletion(emptyLibrary(), oldOptions);
  assert.equal(old.format, 'xonix-library.v2');
  const later = recordLibraryCompletion(old, f.options('later', f.second));
  assert.equal(later.format, 'xonix-library.v3');
  assert.deepEqual(later.pictureReceipts, []);
  assert.equal(Object.hasOwn(old, 'pictureReceipts'), false);
});

test('Standard/Gentle and worlds retain independent first-earned receipts', () => {
  const f = fixture();
  let library = recordLibraryCompletion(emptyLibrary(), f.options('standard'));
  library = recordLibraryCompletion(library, f.options('gentle', f.second, 'gentle'));
  library = recordLibraryCompletion(library, f.options('retro', f.second, 'standard', 'retro'));
  assert.equal(library.pictureReceipts.length, 3);
  assert.deepEqual(
    library.pictureReceipts.map((x) => x.presentationPin.kind),
    ['still', 'still', 'legacy'],
  );
  assert.deepEqual(
    library.pictureReceipts.slice(0, 2).map((x) => x.presentationPin.assetId),
    ['picture-a', 'picture-b'],
  );
  assert.equal(new Set(library.pictureReceipts.map((x) => x.galleryKey)).size, 3);
  assert.deepEqual(
    importLibrary(exportLibrary(library), { campaigns: [] }).pictureReceipts,
    library.pictureReceipts,
  );
});

test('ordinary merge retains committed first picture or implicit legacy; explicit import selects a document', () => {
  const f = fixture(),
    a = recordLibraryCompletion(emptyLibrary(), f.options('a')),
    b = recordLibraryCompletion(emptyLibrary(), f.options('b', f.second));
  assert.deepEqual(mergeLibraries(b, a).pictureReceipts, a.pictureReceipts);
  assert.deepEqual(mergeLibraries(a, b).pictureReceipts, b.pictureReceipts);
  const { presentationPins, ...legacyOptions } = f.options('old');
  const old = recordLibraryCompletion(emptyLibrary(), legacyOptions);
  assert.deepEqual(mergeLibraries(a, old).pictureReceipts, []);
  assert.deepEqual(mergeLibraries(old, a).pictureReceipts, a.pictureReceipts);
  assert.deepEqual(importLibrary(exportLibrary(b)).pictureReceipts, b.pictureReceipts);
  const other = recordLibraryCompletion(emptyLibrary(), f.options('other', f.second, 'gentle'));
  assert.equal(mergeLibraries(other, a).pictureReceipts.length, 2);
});

test('malformed receipts cannot enter old formats or detach from completed gallery identity', () => {
  const f = fixture(),
    a = recordLibraryCompletion(emptyLibrary(), f.options('first'));
  for (const alter of [
    (p) => {
      p.format = 'xonix-library.v2';
    },
    (p) => {
      p.pictureReceipts[0].extra = true;
    },
    (p) => {
      p.pictureReceipts.push(p.pictureReceipts[0]);
    },
    (p) => {
      p.pictureReceipts[0].earnedAt = 'yesterday';
    },
    (p) => {
      p.pictureReceipts[0].seed = -1;
    },
    (p) => {
      p.pictureReceipts[0].presentationPin.sha256 = 'wrong';
    },
    (p) => {
      p.pictureReceipts[0].presentationPin.identity.levelId = 'other';
    },
    (p) => {
      p.pictureReceipts[0].presentationPin.identity.themeId = 'other';
    },
    (p) => {
      p.gallery = [];
    },
  ]) {
    const p = structuredClone(a);
    alter(p);
    assert.throws(() => importLibrary(p));
  }
});

test('one profile write stores receipts and completion; failure preserves existing data', () => {
  const f = fixture(),
    a = recordLibraryCompletion(emptyLibrary(), f.options('first'));
  let raw = null,
    writes = 0;
  const storage = {
    getItem: (key) => (key === 'profile' ? raw : null),
    setItem: (_key, value) => {
      raw = value;
      writes++;
    },
  };
  assert.equal(saveLibrary(storage, 'profile', a).ok, true);
  assert.equal(writes, 1);
  assert.deepEqual(loadLibrary(storage, 'profile').library.pictureReceipts, a.pictureReceipts);
  const before = raw;
  storage.setItem = () => {
    throw new Error('quota');
  };
  assert.equal(
    saveLibrary(storage, 'profile', recordLibraryCompletion(a, f.options('second', f.second))).ok,
    false,
  );
  assert.equal(raw, before);
});
