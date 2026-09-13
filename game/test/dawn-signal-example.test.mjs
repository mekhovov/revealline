import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, rm, symlink, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import {
  buildDawnSignalPair,
  decodeDawnPoster,
  writeDawnSignalPair,
} from '../../authoring/library/dawn-signal-example/build.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { createStoryMediaStore } from '../story-media-store.mjs';
import {
  importMediaBundle,
  exportMediaBundle,
  prepareMediaBundleRestore,
  commitMediaBundleRestore,
} from '../media-bundle.mjs';
import {
  importStoryBundle,
  inspectStoryBundle,
  exportStoryBundle,
  prepareStoryBundleRestore,
  commitStoryBundleRestore,
} from '../story-bundle.mjs';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
import { inspectionEnvironment } from './helpers/victory-story-fixture.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const bytes = async (blob) => Buffer.from(await blob.arrayBuffer());
const sha = (buffer) => createHash('sha256').update(buffer).digest('hex');
const candidate = await buildDawnSignalPair();
const inspection = () =>
  inspectionEnvironment({ facts: { durationSeconds: 8, width: 640, height: 360 } }).options;

test('Dawn example deterministically retains the exact owned movie and fully decoded final PNG for the real base-game identity', async () => {
  const second = await buildDawnSignalPair();
  assert.deepEqual(second.manifest, candidate.manifest);
  for (let i = 0; i < candidate.files.length; i++)
    assert.deepEqual(await bytes(second.files[i].blob), await bytes(candidate.files[i].blob));
  for (const item of candidate.files)
    assert.deepEqual(
      await readFile(join(ROOT, 'authoring/still-media/examples/dawn-signal', item.name)),
      await bytes(item.blob),
      'The published example is the exact reproducible CLI pair.',
    );
  assert.deepEqual(
    JSON.parse(
      await readFile(
        join(ROOT, 'authoring/still-media/examples/dawn-signal/manifest.json'),
        'utf8',
      ),
    ),
    candidate.manifest,
  );
  assert.deepEqual(candidate.manifest.identity, {
    baseCampaignKey: 'first-signal/2/88639f3aab7b6cc1',
    levelId: 'signal-01',
    levelRevision: '1',
    themeId: 'fpv',
  });
  assert.equal(candidate.manifest.producer, 'CLI; not a native browser export');
  assert.equal(
    candidate.manifest.poster.decodedRgbSha256,
    '61a6df9d99447c1607de52a1d3cbac3d73c366b9ddc19834be60f023cd835c31',
  );
  const image = await importMediaBundle(candidate.files[0].blob, { decodeImage: decodeDawnPoster });
  const movie = await inspectStoryBundle(candidate.files[1].blob);
  assert.equal(image.document.owners.length, 1);
  assert.equal(image.document.library.assignments.length, 1);
  assert.equal(movie.document.stories.length, 1);
  assert.equal(movie.document.bindings.length, 1);
  assert.deepEqual(
    await bytes(image.assets[0].blob),
    await readFile(join(ROOT, 'authoring/library/dawn-signal-story/candidate-v1/frame-95.png')),
  );
  assert.deepEqual(
    await bytes(movie.assets[0].blob),
    await readFile(join(ROOT, 'authoring/library/dawn-signal-story/candidate-v1/dawn-signal.mp4')),
  );
});

test('CLI pair restores to a fresh modeled v4 store only after poster review, then re-exports exact originals and immutable binding', async (t) => {
  const memory = memoryIndexedDB();
  const manager = createManagedMediaStore({ indexedDB: memory.indexedDB, storyMedia: true });
  const still = createStillMediaStore({ managedStore: manager, decodeImage: decodeDawnPoster });
  const story = createStoryMediaStore({ managedStore: manager, decodeImage: decodeDawnPoster });
  t.after(async () => {
    await story.close();
    manager.close();
  });
  // Movie metadata events are modeled. PNG pixels and both original hashes are real.
  const importedStory = await importStoryBundle(candidate.files[1].blob, inspection());
  await assert.rejects(
    prepareStoryBundleRestore(importedStory, {
      store: story,
      restoreBindings: true,
      ...inspection(),
    }),
    /historical poster/,
  );
  assert.equal((await story.readMetadata()).generation, 0);
  const importedMedia = await importMediaBundle(candidate.files[0].blob, {
    decodeImage: decodeDawnPoster,
  });
  const review = await prepareMediaBundleRestore(importedMedia, {
    store: still,
    decodeImage: decodeDawnPoster,
  });
  assert.equal((await still.readMetadata()).generation, 0, 'Review cannot publish an assignment.');
  await commitMediaBundleRestore(review);
  const movieReview = await prepareStoryBundleRestore(importedStory, {
    store: story,
    restoreBindings: true,
    ...inspection(),
  });
  assert.equal((await story.readMetadata()).generation, 0, 'Review cannot publish a story.');
  await commitStoryBundleRestore(movieReview);
  const metadata = await still.readPresentationMetadata();
  assert.deepEqual(metadata.story.document.bindings[0].picturePin, candidate.manifest.picturePin);
  assert.deepEqual(metadata.story.document.bindings[0].story, candidate.manifest.story);
  const pictures = await still.read(),
    movies = await story.exportInventory();
  assert.deepEqual(
    await bytes(
      await exportMediaBundle(pictures.document, pictures.assets, {
        decodeImage: decodeDawnPoster,
      }),
    ),
    await bytes(candidate.files[0].blob),
  );
  assert.deepEqual(
    await bytes(
      await exportStoryBundle(movies.document, movies.assets, { still: pictures.document }),
    ),
    await bytes(candidate.files[1].blob),
  );
});

test('changed PNG/movie originals fail byte verification rather than gaining candidate authority', async () => {
  const png = await readFile(
    join(ROOT, 'authoring/library/dawn-signal-story/candidate-v1/frame-95.png'),
  );
  png[png.length - 1] ^= 1;
  await assert.rejects(decodeDawnPoster(new Blob([png])), /exact owned/);
  for (const [index, importer] of [
    [0, (blob) => importMediaBundle(blob, { decodeImage: decodeDawnPoster })],
    [1, inspectStoryBundle],
  ]) {
    const raw = await bytes(candidate.files[index].blob);
    raw[raw.length - 1] ^= 1;
    await assert.rejects(importer(new Blob([raw])), /exact|hash|bytes|Invalid|differs/);
  }
});

test('candidate output is exclusive and rejects a symlink parent before any outside file creation', async (t) => {
  await mkdir(join(ROOT, '.cache'), { recursive: true });
  const scratch = await mkdtemp(join(ROOT, '.cache/dawn-example-test-'));
  const outside = await mkdtemp(join(tmpdir(), 'dawn-example-owned-'));
  t.after(async () => {
    await rm(scratch, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  });
  await symlink(outside, join(scratch, 'linked'));
  await assert.rejects(
    writeDawnSignalPair(relative(ROOT, join(scratch, 'linked', 'out'))),
    /ordinary directories/,
  );
  await assert.rejects(stat(join(outside, 'out')), { code: 'ENOENT' });
  const output = relative(ROOT, join(scratch, 'candidate'));
  const written = await writeDawnSignalPair(output);
  for (const file of candidate.manifest.files) {
    const raw = await readFile(join(written.output, file.name));
    assert.equal(raw.length, file.bytes);
    assert.equal(sha(raw), file.sha256);
  }
  await writeFile(join(written.output, 'owned-marker'), 'keep');
  await assert.rejects(writeDawnSignalPair(output), { code: 'EEXIST' });
  assert.equal(await readFile(join(written.output, 'owned-marker'), 'utf8'), 'keep');
  await assert.rejects(writeDawnSignalPair('../outside'), /below this checkout/);
});
