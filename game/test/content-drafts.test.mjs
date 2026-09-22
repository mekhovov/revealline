import test from 'node:test';
import assert from 'node:assert/strict';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import {
  createContentDraftBackend,
  createDraftHistory,
  forkMissionMap,
} from '../content-design/drafts.mjs';

const draft = () => ({
  format: 'ContentProjectV1',
  id: 'draft-project',
  revision: '1',
  name: 'Draft',
  maps: [
    {
      format: 'MapDesignV1',
      id: 'island',
      revision: '1',
      name: 'Island',
      width: 72,
      height: 36,
      foundations: [{ x: 30, y: 15, w: 5, h: 5 }],
      walls: [],
      terrain: [],
      spawns: [{ id: 'home', x: 32.5, y: 17.5 }],
    },
  ],
  missions: [
    { id: 'first', map: { id: 'island', revision: '1' } },
    { id: 'second', map: { id: 'island', revision: '1' } },
  ],
  campaigns: [],
  packs: [],
});

function closableBackend() {
  const memory = managedIndexedDB(),
    requests = [];
  const indexedDB = {
    open(...args) {
      const request = memory.indexedDB.open(...args);
      requests.push(request);
      return request;
    },
  };
  return { memory, requests, backend: createContentDraftBackend({ indexedDB }) };
}

test('retry reopens a cached closing connection without replaying the failed transaction', async () => {
  const { memory, requests, backend } = closableBackend();
  await backend.save(draft(), null);
  requests[0].result.close();
  await assert.rejects(backend.read('draft-project'), { name: 'InvalidStateError' });
  assert.equal(memory.openCount, 1, 'no hidden transaction replay');
  assert.equal((await backend.read('draft-project')).revision, 1);
  assert.equal(memory.openCount, 2);
  assert.equal(memory.allPuts.length, 2);
});

test('close notifications reopen storage while stale notifications cannot discard the new connection', async () => {
  const { memory, requests, backend } = closableBackend();
  await backend.save(draft(), null);
  const old = requests[0].result;
  old.close();
  old.onclose?.();
  assert.equal((await backend.read('draft-project')).revision, 1);
  old.onclose?.();
  assert.equal((await backend.read('draft-project')).revision, 1);
  assert.equal(memory.openCount, 2);
});

test('reopened write retries still honor a newer writer and immutable checkpoint history', async () => {
  const { memory, requests, backend } = closableBackend();
  await backend.save(draft(), null);
  requests[0].result.close();
  const changed = { ...draft(), name: 'Retry candidate' };
  await assert.rejects(backend.save(changed, 1), { name: 'InvalidStateError' });
  const other = createContentDraftBackend(memory);
  await other.save({ ...draft(), name: 'Other writer' }, 1);
  await assert.rejects(backend.save(changed, 1), { code: 'draft-conflict' });
  assert.equal((await backend.read('draft-project')).project.name, 'Other writer');
  assert.equal((await backend.read('draft-project', 1)).project.name, 'Draft');
});

test('draft saves are immutable checkpoints with atomic cross-tab revision conflicts', async () => {
  const memory = managedIndexedDB();
  const first = createContentDraftBackend(memory),
    second = createContentDraftBackend(memory);
  const initial = await first.save(draft(), null);
  assert.equal(initial.revision, 1);
  const changed = { ...draft(), name: 'New name' };
  const results = await Promise.allSettled([
    first.save(changed, 1),
    second.save({ ...changed, name: 'Other tab' }, 1),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  const rejected = results.find((r) => r.status === 'rejected');
  assert.equal(rejected.reason.code, 'draft-conflict');
  assert.equal((await second.read('draft-project')).revision, 2);
  assert.equal((await second.read('draft-project', 1)).project.name, 'Draft');
});

test('failed draft writes do not replace the saved head', async () => {
  const memory = managedIndexedDB(),
    backend = createContentDraftBackend(memory);
  await backend.save(draft(), null);
  memory.failAnyPutAt = 1;
  await assert.rejects(backend.save({ ...draft(), name: 'Unsaved' }, 1));
  memory.failAnyPutAt = null;
  assert.equal((await backend.read('draft-project')).revision, 1);
  assert.equal((await backend.read('draft-project')).project.name, 'Draft');
});

test('history owns edits, supports undo/redo and preserves unsaved export after failure', () => {
  const original = draft(),
    history = createDraftHistory(original);
  original.name = 'Caller mutation';
  history.replace({ ...history.current(), name: 'Edited' });
  assert.equal(history.current().name, 'Edited');
  assert.equal(history.undo().name, 'Draft');
  assert.equal(history.redo().name, 'Edited');
  history.undo();
  history.replace({ ...history.current(), name: 'New branch' });
  assert.equal(history.canRedo(), false);
  assert.equal(JSON.parse(history.export()).name, 'New branch');
});

test('editing one shared map preserves the original revision and other dependent missions', () => {
  const original = draft();
  const edited = forkMissionMap(original, 'first', { foundations: [{ x: 20, y: 12, w: 5, h: 5 }] });
  assert.equal(original.maps.length, 1);
  assert.equal(edited.maps.length, 2);
  assert.deepEqual(edited.maps[0], original.maps[0]);
  assert.equal(edited.missions[1].map.revision, '1');
  assert.notEqual(edited.missions[0].map.revision, '1');
  assert.equal(edited.maps[1].foundations[0].x, 20);
});
