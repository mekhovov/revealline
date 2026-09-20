import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inspectDraftCheckpoint,
  createInspectionRequests,
  projectIdFromURL,
} from '../content-design/recovery.mjs';
import { createContentDraftBackend } from '../content-design/drafts.mjs';
import { createContentDraftSession } from '../content-design/session.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

test('restoring an old checkpoint appends history and preserves both earlier revisions', async () => {
  const backend = createContentDraftBackend(managedIndexedDB());
  const first = createStarterProject();
  await backend.save(first, null);
  await backend.save({ ...first, name: 'Second checkpoint' }, 1);
  const inspected = await inspectDraftCheckpoint(backend, first.id, 1);
  const session = createContentDraftSession(inspected.head.project, {
    backend,
    revision: inspected.head.revision,
  });
  session.replace(inspected.selected.project);
  assert.equal(session.status().dirty, true);
  await session.save();
  assert.equal(session.status().revision, 3);
  assert.equal((await backend.read(first.id, 1)).project.name, first.name);
  assert.equal((await backend.read(first.id, 2)).project.name, 'Second checkpoint');
  assert.equal((await backend.read(first.id)).project.name, first.name);
  session.undo();
  assert.equal(session.current().name, 'Second checkpoint');
});

test('a newer cross-tab save after inspection refuses stale checkpoint restoration', async () => {
  const backend = createContentDraftBackend(managedIndexedDB()),
    first = createStarterProject();
  await backend.save(first, null);
  await backend.save({ ...first, name: 'Second' }, 1);
  const inspected = await inspectDraftCheckpoint(backend, first.id, 1);
  await backend.save({ ...first, name: 'Third from another tab' }, 2);
  const session = createContentDraftSession(inspected.head.project, {
    backend,
    revision: inspected.head.revision,
  });
  session.replace(inspected.selected.project);
  await assert.rejects(session.save(), { code: 'draft-conflict' });
  assert.equal(session.status().dirty, true);
  assert.equal((await backend.read(first.id)).project.name, 'Third from another tab');
});

test('checkpoint inspection rejects invalid and missing revisions without writes', async () => {
  const backend = createContentDraftBackend(managedIndexedDB()),
    source = createStarterProject();
  for (const revision of [0, -1, 1.2, NaN, Infinity, '1'])
    await assert.rejects(inspectDraftCheckpoint(backend, source.id, revision));
  await assert.rejects(inspectDraftCheckpoint(backend, source.id), /No checkpoint/);
  await backend.save(source, null);
  await assert.rejects(inspectDraftCheckpoint(backend, source.id, 2), /does not exist/);
  assert.equal((await inspectDraftCheckpoint(backend, source.id)).selected.revision, 1);
});

test('late imports and saved reads lose authority when newer edits or requests exist', () => {
  let state = 'a';
  const requests = createInspectionRequests(() => state);
  const first = requests.begin();
  assert(first());
  const second = requests.begin();
  assert(!first());
  assert(second());
  state = 'b';
  assert(!second());
  const third = requests.begin();
  requests.invalidate();
  assert(!third());
  assert(requests.begin()());
});

test('custom-project address survives reload without introducing another persistence store', () => {
  assert.equal(projectIdFromURL('https://example.test/game/studio/'), 'my-journey');
  assert.equal(
    projectIdFromURL('https://example.test/game/studio/?project=another-project'),
    'another-project',
  );
  for (const value of ['../secret', '', 'hello%20world'])
    assert.throws(() => projectIdFromURL(`https://example.test/game/studio/?project=${value}`));
});
