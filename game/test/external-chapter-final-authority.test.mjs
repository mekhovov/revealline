import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fixture,
  installPack,
  exportPackLibrary,
  writeAssetStore,
  hash,
} from './pr771-r2-host.mjs';
import { profileWriterOwns } from '../profile-writer.mjs';

async function reviewed() {
  const f = await fixture({ host: true });
  const snapshot = await f.ctx.checkedChapters();
  const next = installPack(f.ctx.packs, f.prepared);
  const review = await f.ctx.externalChapters.prepareMutation(snapshot, next);
  assert(profileWriterOwns(f.ctx.writer, f.ctx.libraryKey + '.writer'));
  return { f, review, expected: exportPackLibrary(next) };
}

for (const hazard of ['writer', 'backup-marker']) {
  for (const invocation of [1, 2]) {
    test(
      'final host authority: ' + hazard + ' changed by caller invocation ' + invocation,
      async (t) => {
        const { f, review, expected } = await reviewed();
        const controller = new AbortController();
        const run = f.ctx.run,
          flight = JSON.stringify(run),
          recorder = JSON.stringify(f.ctx.recorder);
        let calls = 0,
          changed = false,
          failure = null;
        try {
          try {
            await f.ctx.externalChapters.commitMutation(review, {
              signal: controller.signal,
              beforeWrite() {
                calls++;
                if (calls !== invocation) return;
                if (hazard === 'writer') {
                  assert(profileWriterOwns(f.ctx.writer, f.ctx.libraryKey + '.writer'));
                  f.ctx.writer.release();
                  assert.equal(f.ctx.writer.writable, false);
                } else f.values.set(f.ctx.libraryKey + '.backup-lock', 'pending-backup');
                changed = true;
                assert.equal(
                  controller.signal.aborted,
                  false,
                  'Authority loss is independent of AbortSignal',
                );
              },
            });
          } catch (error) {
            failure = error;
          }
          const stored = await f.stored();
          t.diagnostic(
            JSON.stringify({
              hazard,
              invocation,
              calls,
              changed,
              rejected: !!failure,
              message: failure?.message,
              stored: stored === null ? null : hash(stored),
            }),
          );
          if (changed) {
            assert.equal(
              stored,
              null,
              'No pack pointer may publish after caller revokes final host authority',
            );
            assert(failure, 'Revoked final authority must reject the transaction');
            assert.match(failure.message, /writer lease|backup lock/i);
          } else {
            // A single caller veto eliminates the second-callback attack surface.
            assert.equal(invocation, 2);
            assert.equal(calls, 1);
            assert.equal(failure, null);
            assert.equal(stored, expected);
            assert(profileWriterOwns(f.ctx.writer, f.ctx.libraryKey + '.writer'));
            assert.equal(f.values.get(f.ctx.libraryKey + '.backup-lock'), undefined);
          }
          assert.equal(f.ctx.run, run);
          assert.equal(JSON.stringify(run), flight);
          assert.equal(JSON.stringify(f.ctx.recorder), recorder);
          await assert.rejects(
            async () => f.ctx.externalChapters.commitMutation(review),
            /fresh single-use/,
          );
        } finally {
          f.close();
        }
      },
    );
  }
}

test('final host authority: first caller cancellation still aborts the transaction', async () => {
  const { f, review } = await reviewed(),
    controller = new AbortController();
  let calls = 0;
  try {
    await assert.rejects(
      () =>
        f.ctx.externalChapters.commitMutation(review, {
          signal: controller.signal,
          beforeWrite() {
            calls++;
            controller.abort();
          },
        }),
      { name: 'AbortError' },
    );
    assert.equal(calls, 1);
    assert.equal(await f.stored(), null);
  } finally {
    f.close();
  }
});

for (const guarded of [false, true]) {
  test(
    'final host authority: ordinary valid publication succeeds guarded=' + guarded,
    async (t) => {
      const { f, review, expected } = await reviewed();
      let calls = 0;
      try {
        const result = await f.ctx.externalChapters.commitMutation(
          review,
          guarded
            ? {
                beforeWrite() {
                  calls++;
                },
              }
            : {},
        );
        assert.equal(result.status, 'committed');
        assert.equal(await f.stored(), expected);
        assert(profileWriterOwns(f.ctx.writer, f.ctx.libraryKey + '.writer'));
        assert.equal(guarded ? calls >= 1 : calls === 0, true);
        t.diagnostic(JSON.stringify({ guarded, calls, stored: hash(expected) }));
      } finally {
        f.close();
      }
    },
  );
}

test('final host authority: pointer CAS mismatch rejects before any caller veto', async () => {
  const { f, review } = await reviewed();
  const different = exportPackLibrary(f.ctx.packs);
  let calls = 0;
  try {
    await writeAssetStore(f.ctx.packsKey, different);
    await assert.rejects(
      () =>
        f.ctx.externalChapters.commitMutation(review, {
          beforeWrite() {
            calls++;
          },
        }),
      /snapshot changed|review again/i,
    );
    assert.equal(calls, 0);
    assert.equal(await f.stored(), different);
  } finally {
    f.close();
  }
});

test('final host authority: pre-existing backup marker rejects before any caller veto', async () => {
  const { f, review } = await reviewed();
  let calls = 0;
  try {
    f.values.set(f.ctx.libraryKey + '.backup-lock', 'pending-backup');
    await assert.rejects(
      () =>
        f.ctx.externalChapters.commitMutation(review, {
          beforeWrite() {
            calls++;
          },
        }),
      /backup|snapshot changed|review again/i,
    );
    assert.equal(calls, 0);
    assert.equal(await f.stored(), null);
  } finally {
    f.close();
  }
});
