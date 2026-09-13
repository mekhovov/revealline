import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { canonicalJSON } from '../data-json.mjs';
import { prepareStoredStillMedia } from '../media-storage-record.mjs';
import {
  STORY_STORAGE_FORMAT,
  STORY_BINDINGS_FORMAT,
  validateStoredStories,
  changeStoredStoryBinding,
  verifyStoredStoryBindings,
  storyDescriptorSha256,
  assertStoredStoryTransition,
  storedStoryMetadataBytes,
} from '../story-storage-record.mjs';
import {
  STORY_PIN_FORMAT,
  snapshotStoryPin,
  createAuthoredStoryPin,
  resolveAuthoredStoryPin,
} from '../story-bindings.mjs';
import { createStoryFixture } from './helpers/victory-story-fixture.mjs';
import { pngBytes, presentationRecord, deferred } from './helpers/media-fixtures.mjs';

const copy = (value) => structuredClone(value),
  f = createStoryFixture(),
  still = (
    await prepareStoredStillMedia(
      f.library,
      [{ sha256: f.pin.sha256, blob: new Blob([pngBytes()]) }],
      {
        executionCatalog: f.catalog,
        decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }),
      },
    )
  ).library;
const history = (stories = [f.descriptor]) => ({
  format: STORY_STORAGE_FORMAT,
  stories: copy(stories),
  originals: [...new Set(stories.map((s) => s.source.sha256))],
});
const select = (document, story = f.descriptor, picturePin = f.pin, context = still) =>
  changeStoredStoryBinding(
    document,
    { picturePin, story: story === null ? null : { id: story.id, revision: story.revision } },
    context,
  );
const freeze = (document, picturePin = f.pin, context = still) =>
  createAuthoredStoryPin({ document, still: context, picturePin });
const resolve = (pin, document, picturePin = f.pin, context = still) =>
  resolveAuthoredStoryPin(pin, { document, still: context, picturePin });

test('descriptor digest uses complete canonical UTF-8 bytes, independent of object key order', async () => {
  const expected = createHash('sha256').update(canonicalJSON(f.descriptor)).digest('hex');
  assert.equal(await storyDescriptorSha256(f.descriptor), expected);
  const reordered = Object.fromEntries(Object.entries(f.descriptor).reverse());
  reordered.source = Object.fromEntries(Object.entries(reordered.source).reverse());
  assert.equal(await storyDescriptorSha256(reordered), expected);
  for (const mutate of [
    (s) => (s.description += ' Another description.'),
    (s) => (s.segment.startSeconds = 1),
    (s) => (s.source.sha256 = 'a'.repeat(64)),
    (s) => (s.picturePin.presentationRevision = 2),
    (s) => (s.revision = 2),
    (s) => (s.id = 'other-story'),
  ]) {
    const changed = copy(f.descriptor);
    mutate(changed);
    assert.notEqual(await storyDescriptorSha256(changed), expected);
  }
});

test('v1, absent binding and explicit null never infer a story from available history', async () => {
  const old = history(),
    original = canonicalJSON(old);
  assert.equal(await freeze(old), null);
  assert.equal(canonicalJSON(validateStoredStories(old, still)), original);
  assert.equal(await freeze({ ...old, format: STORY_BINDINGS_FORMAT, bindings: [] }), null);
  const disabled = await select(old, null);
  assert.equal(disabled.bindings[0].story, null);
  assert.equal(await freeze(disabled), null);
  const added = { ...disabled, stories: [...disabled.stories, { ...f.descriptor, revision: 2 }] };
  assert.equal(await freeze(added), null);
  const enabled = await select(added);
  assert.ok(await freeze(enabled));
  assert.equal(await resolve(null, enabled), null, 'A previously frozen null stays null.');
  assert.equal(
    await resolveAuthoredStoryPin(null, {
      document: undefined,
      still: undefined,
      picturePin: undefined,
    }),
    null,
    'Literal null does not consult current storage.',
  );
  assert.equal(canonicalJSON(old), original);
  assert.equal(still.library.presentations[0].story, null);
});

test('a frozen story A resolves after current binding changes to B or explicit null', async () => {
  const b = { ...copy(f.descriptor), revision: 2, segment: { startSeconds: 1, endSeconds: 3 } },
    initial = await select(history([f.descriptor, b])),
    pinA = await freeze(initial),
    changed = await select(initial, b),
    pinB = await freeze(changed);
  assert.notDeepEqual(pinA, pinB);
  assert.equal(pinA.revision, 1);
  assert.equal(pinB.revision, 2);
  assert.deepEqual((await resolve(pinA, changed)).descriptor, f.descriptor);
  assert.deepEqual((await resolve(pinB, changed)).descriptor, b);
  const disabled = await select(changed, null);
  assert.equal(await freeze(disabled), null);
  assert.deepEqual((await resolve(pinA, disabled)).pin, pinA);
  assert.doesNotThrow(() => assertStoredStoryTransition(initial, disabled, still));
});

test('bindings distinguish the complete historical poster even when revisions share image bytes', async () => {
  const context = copy(still);
  context.library.presentations.push(presentationRecord(f.identity, 2));
  context.library.assignments[0].revision = 2;
  const pictureB = { ...copy(f.pin), presentationRevision: 2 },
    b = { ...copy(f.descriptor), id: 'second-poster-story', picturePin: pictureB },
    initial = await select(history([f.descriptor, b]), f.descriptor, f.pin, context),
    pinA = await freeze(initial, f.pin, context);
  assert.equal(await freeze(initial, pictureB, context), null);
  await assert.rejects(select(initial, f.descriptor, pictureB, context), /exact existing story/);
  const both = await select(initial, b, pictureB, context),
    pinB = await freeze(both, pictureB, context);
  assert.equal(both.bindings.length, 2);
  assert.deepEqual((await resolve(pinA, both, f.pin, context)).descriptor, f.descriptor);
  assert.deepEqual((await resolve(pinB, both, pictureB, context)).descriptor, b);
  await assert.rejects(resolve(pinA, both, pictureB, context), /different exact picture/);
});

test('detached original stays pinned and unavailable; restoring exact availability changes no identity', async () => {
  const bound = await select(history()),
    pin = await freeze(bound),
    detached = { ...bound, originals: [] },
    result = await resolve(pin, detached);
  assert.equal(result.kind, 'unavailable');
  assert.deepEqual(result.pin, pin);
  assert.deepEqual(result.descriptor, f.descriptor);
  assert.deepEqual(await freeze(detached), pin, 'Missing media does not silently become no story.');
  assert.equal((await resolve(pin, bound)).kind, 'available');
  assert.ok(Object.isFrozen(result.descriptor.segment));
});

test('structural story pins cannot authenticate foreign, Gentle-as-base, or changed poster owners', async () => {
  const bound = await select(history()),
    pin = await freeze(bound),
    gentle = f.catalog.entries.find((e) => e.difficulty === 'gentle');
  for (const mutate of [
    (p) => (p.identity.baseCampaignKey = gentle.executionKey),
    (p) => (p.identity.levelRevision = f.request('gentle').levelRevision),
    (p) => (p.identity.themeId = 'ukraine'),
    (p) => (p.presentationId = 'foreign-presentation'),
    (p) => (p.assetId = 'foreign-asset'),
    (p) => (p.sha256 = 'a'.repeat(64)),
  ]) {
    const wrong = copy(pin);
    mutate(wrong.picturePin);
    assert.doesNotThrow(() => snapshotStoryPin(wrong), 'Shape validation is not ownership.');
    await assert.rejects(resolve(wrong, bound, wrong.picturePin), /historical poster and owner/);
    await assert.rejects(freeze(bound, wrong.picturePin), /historical poster and owner/);
  }
  assert.equal(
    await freeze(bound, { kind: 'legacy', identity: f.pin.identity }),
    null,
    'Legacy pictures never acquire a managed story implicitly.',
  );
});

test('strict pins and binding requests reject malformed, missing and duplicate authority', async () => {
  const bound = await select(history()),
    pin = await freeze(bound);
  assert.equal(pin.format, STORY_PIN_FORMAT);
  assert.equal(snapshotStoryPin(null), null);
  for (const bad of [
    undefined,
    false,
    {},
    { ...pin, extra: true },
    { ...pin, revision: 0 },
    { ...pin, sourceSha256: 'wrong' },
    { ...pin, descriptorSha256: undefined },
    { ...pin, picturePin: { kind: 'legacy', identity: f.pin.identity } },
  ])
    assert.throws(() => snapshotStoryPin(bad));
  for (const request of [
    { picturePin: f.pin },
    { picturePin: f.pin, story: undefined },
    { picturePin: f.pin, story: { id: f.descriptor.id } },
    { picturePin: f.pin, story: { id: f.descriptor.id, revision: 1, extra: true } },
  ])
    await assert.rejects(changeStoredStoryBinding(history(), request, still));
  assert.throws(
    () =>
      validateStoredStories({ ...bound, bindings: [...bound.bindings, ...bound.bindings] }, still),
    /Duplicate exact picture/,
  );
  assert.throws(() => validateStoredStories({ ...history(), bindings: [] }, still));
});

test('wrong descriptor digest and changed immutable source refuse despite structurally valid metadata', async () => {
  const bound = await select(history()),
    pin = await freeze(bound),
    wrong = copy(bound);
  wrong.bindings[0].story.descriptorSha256 = 'a'.repeat(64);
  assert.doesNotThrow(() => validateStoredStories(wrong, still));
  await assert.rejects(
    verifyStoredStoryBindings(validateStoredStories(wrong, still)),
    /descriptor hash/,
  );
  await assert.rejects(freeze(wrong), /descriptor hash/);
  await assert.rejects(
    resolve({ ...pin, descriptorSha256: 'a'.repeat(64) }, bound),
    /descriptor hash/,
  );
  await assert.rejects(
    resolve({ ...pin, sourceSha256: 'a'.repeat(64) }, bound),
    /exact immutable story/,
  );
  const changed = copy(bound);
  changed.stories[0].segment.startSeconds = 1;
  changed.bindings[0].story.descriptorSha256 = await storyDescriptorSha256(changed.stories[0]);
  await assert.rejects(resolve(pin, changed), /descriptor hash/);
  assert.throws(() => assertStoredStoryTransition(bound, changed, still), /Immutable story/);
});

test('selection and frozen resolution own caller input before asynchronous hashing', async () => {
  const source = history(),
    request = { picturePin: copy(f.pin), story: { id: f.descriptor.id, revision: 1 } },
    context = copy(still),
    pending = changeStoredStoryBinding(source, request, context);
  source.stories[0].description = 'Changed while hashing';
  request.picturePin.sha256 = 'b'.repeat(64);
  request.story = null;
  context.library.assignments.length = 0;
  const bound = await pending;
  assert.deepEqual(bound.stories[0], f.descriptor);
  assert.equal(bound.bindings[0].story.id, f.descriptor.id);
  const mutable = copy(bound),
    creating = freeze(mutable);
  mutable.stories[0].segment.endSeconds = 5;
  mutable.bindings[0].story = null;
  const pin = await creating,
    mutablePin = copy(pin),
    mutableHistory = copy(bound),
    resolving = resolve(mutablePin, mutableHistory);
  mutablePin.sourceSha256 = 'c'.repeat(64);
  mutableHistory.originals.length = 0;
  assert.deepEqual((await resolving).pin, pin);
  assert.equal((await resolve(pin, bound)).kind, 'available');
});

test('abort before and during real descriptor hashing rejects without changing inputs', async (t) => {
  const controller = new AbortController();
  controller.abort();
  const source = history(),
    original = canonicalJSON(source);
  await assert.rejects(
    changeStoredStoryBinding(source, { picturePin: f.pin, story: null }, still, {
      signal: controller.signal,
    }),
    { name: 'AbortError' },
  );
  const entered = deferred(),
    finish = deferred(),
    digest = crypto.subtle.digest.bind(crypto.subtle),
    active = new AbortController();
  t.mock.method(crypto.subtle, 'digest', async (...args) => {
    const result = await digest(...args);
    entered.resolve();
    await finish.promise;
    return result;
  });
  const pending = changeStoredStoryBinding(
    source,
    { picturePin: f.pin, story: { id: f.descriptor.id, revision: 1 } },
    still,
    { signal: active.signal },
  );
  await entered.promise;
  active.abort();
  finish.resolve();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(canonicalJSON(source), original);
});

test('v2 cannot downgrade or drop binding identities; explicit null retains history and consumes metadata budget', async () => {
  const bound = await select(history()),
    disabled = await select(bound, null);
  assert.throws(() => assertStoredStoryTransition(bound, history(), still), /downgraded/);
  assert.throws(
    () => assertStoredStoryTransition(disabled, { ...disabled, bindings: [] }, still),
    /identities cannot be removed/,
  );
  assert.doesNotThrow(() => assertStoredStoryTransition(bound, disabled, still));
  const nullOnly = await select(history([]), null);
  assert.equal(nullOnly.stories.length, 0);
  assert.equal(nullOnly.bindings[0].story, null);
  assert.equal(storedStoryMetadataBytes(nullOnly), Buffer.byteLength(canonicalJSON(nullOnly)));
  assert.ok(storedStoryMetadataBytes(nullOnly) > 0);
});
