import test from 'node:test';
import assert from 'node:assert/strict';
import {
  corrected,
  fixture,
  deferred,
  until,
  writeAssetStore,
  readAssetStore,
} from './pr771-r2-host.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';

test(
  'guarded storage sees the actual transaction value and preserves old data on veto',
  { skip: !corrected },
  async () => {
    const key = 'r2.storage.transaction';
    await writeAssetStore(key, 'old');
    let seen;
    await assert.rejects(
      () =>
        writeAssetStore(key, 'new', {
          beforeWrite(value) {
            seen = value;
            throw Error('veto');
          },
        }),
      /veto/,
    );
    assert.equal(seen, 'old');
    assert.equal(await readAssetStore(key), 'old');
  },
);
test('storage guard abort reentry denies the actual put', { skip: !corrected }, async () => {
  const key = 'r2.storage.abort',
    controller = new AbortController();
  await assert.rejects(
    () =>
      writeAssetStore(key, 'new', {
        signal: controller.signal,
        beforeWrite() {
          controller.abort();
        },
      }),
    { name: 'AbortError' },
  );
  assert.equal(await readAssetStore(key), null);
});
test(
  'external-host commit review remains single-use when the final guard vetoes',
  { skip: !corrected },
  async () => {
    const f = await fixture({ host: true }),
      ctx = f.ctx;
    try {
      const snapshot = await ctx.checkedChapters();
      const proposal = await ctx.externalChapters.prepareMutation(snapshot, ctx.packs);
      let calls = 0;
      await assert.rejects(
        () =>
          ctx.externalChapters.commitMutation(proposal, {
            beforeWrite() {
              calls++;
              throw Error('publication veto');
            },
          }),
        /publication veto/,
      );
      assert.equal(calls, 1);
      await assert.rejects(
        async () => ctx.externalChapters.commitMutation(proposal),
        /fresh single-use/,
      );
      assert.equal(await f.stored(), null);
    } finally {
      f.close();
    }
  },
);
for (const cancel of [false, true])
  test(
    'library owns the forwarded row and retains cancellation semantics ' + cancel,
    { skip: !corrected },
    async () => {
      const gate = deferred(),
        token = Object.freeze({}),
        controller = new AbortController();
      let seen,
        ready = false;
      const owner = {
        id: 'fixture-owner',
        collection: 'Classic',
        editionId: 'fixture-edition',
        edition: 'Fixture',
        entries: [{ id: 'mission' }],
        describe: (entry) => ({
          id: entry.id,
          name: 'Mission',
          campaignKey: 'campaign',
          campaignTitle: 'Campaign',
          levelIndex: 0,
          modes: ['solo'],
          tags: [],
          rules: 'Authored',
        }),
        availability: () => (ready ? { state: 'ready' } : { state: 'download', bytes: 1 }),
        async prepare(_entry, context) {
          seen = context;
          await gate.promise;
          ready = true;
        },
        launch: () => true,
      };
      const library = createMissionLibrary([owner]),
        row = library.forMode('solo')[0];
      const work = library.prepare(row, {
        preparation: token,
        preparationRow: { forged: true },
        signal: controller.signal,
      });
      await until(() => !!seen);
      assert.equal(seen.preparation, token);
      assert.equal(seen.preparationRow, row);
      if (cancel) {
        library.remove(owner.id);
        assert(seen.signal.aborted);
      }
      gate.resolve();
      assert.equal((await work).state, cancel ? 'cancelled' : 'ready');
      library.dispose();
    },
  );
