import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { performance } from 'node:perf_hooks';
import { setTimeout as pause } from 'node:timers/promises';
import {
  withDirectoryDistributionIO,
  DIRECTORY_DISTRIBUTION_IO_POLICY,
} from './practice-distribution-io.mjs';
const limits = { phaseMs: 500, inactivityMs: 50, settleMs: 30 };

test('fixed functional IO policy cannot increase any deadline or worker count', async () => {
  assert.deepEqual(DIRECTORY_DISTRIBUTION_IO_POLICY, {
    id: 'original-distribution-stream-verification.v1',
    concurrency: 4,
    phaseMs: 600000,
    inactivityMs: 30000,
    settleMs: 5000,
  });
  for (const bad of [
    { concurrency: 8 },
    { phaseMs: 600001 },
    { inactivityMs: 30001 },
    { settleMs: 5001 },
    { phaseMs: 0 },
  ])
    await assert.rejects(withDirectoryDistributionIO(async () => {}, {}, bad));
});
test('four streams maximum; every member is streamed and accounted without full-file buffers', async () => {
  const diagnostics = {},
    rows = Array.from({ length: 13 }, (_, i) => ({ path: `file-${i}`, bytes: 3 }));
  let active = 0,
    maximum = 0;
  await withDirectoryDistributionIO(
    async (io) => {
      await io.members(rows, async (row) => {
        let bytes = 0;
        active++;
        maximum = Math.max(maximum, active);
        try {
          await io.consume(
            row.path,
            () => {
              const stream = new PassThrough();
              setTimeout(() => {
                stream.write('a');
                stream.end('bc');
              }, 5);
              return stream;
            },
            (chunk) => {
              bytes += chunk.length;
            },
          );
          assert.equal(bytes, row.bytes);
        } finally {
          active--;
        }
      });
    },
    diagnostics,
    limits,
  );
  assert.equal(maximum, 4);
  assert.equal(diagnostics.completedFiles, 13);
  assert.equal(diagnostics.completedBytes, 39);
  assert.equal(diagnostics.streamedBytes, 39);
  assert(diagnostics.completed && diagnostics.cleanup.completed);
});
test('idle stream aborts and closes all owned streams with exact failure member', async () => {
  const diagnostics = {},
    stream = new PassThrough();
  await assert.rejects(
    withDirectoryDistributionIO(
      (io) =>
        io.consume(
          'stalled.bin',
          () => stream,
          () => {},
        ),
      diagnostics,
      { ...limits, inactivityMs: 10 },
    ),
    /inactivity/,
  );
  assert(stream.destroyed);
  assert.equal(diagnostics.failureMember, 'stalled.bin');
  assert(!diagnostics.completed && diagnostics.cleanup.completed);
});
test('continuing bytes cannot bypass the overall phase bound', async () => {
  const diagnostics = {};
  let timer, stream;
  try {
    await assert.rejects(
      withDirectoryDistributionIO(
        (io) =>
          io.consume(
            'trickle.bin',
            () => {
              stream = new PassThrough();
              timer = setInterval(() => stream.write('a'), 2);
              return stream;
            },
            () => {},
          ),
        diagnostics,
        { ...limits, phaseMs: 25 },
      ),
      /phase deadline/,
    );
    assert(stream.destroyed);
    assert(diagnostics.streamedBytes > 0);
    assert(!diagnostics.completed && diagnostics.cleanup.completed);
  } finally {
    clearInterval(timer);
  }
});
test('late phase response cannot pass when timer dispatch is stalled', async () => {
  const diagnostics = {};
  await assert.rejects(
    withDirectoryDistributionIO(
      async (io) => {
        await io.perform('metadata', () => {
          const end = performance.now() + 25;
          while (performance.now() < end) {}
          return 'late';
        });
      },
      diagnostics,
      { ...limits, phaseMs: 10 },
    ),
    /phase deadline/,
  );
  assert(!diagnostics.completed && diagnostics.cleanup.completed);
});
test('late chunk cannot reset inactivity when timer dispatch is stalled', async () => {
  const diagnostics = {},
    stream = new PassThrough();
  await assert.rejects(
    withDirectoryDistributionIO(
      (io) =>
        io.consume(
          'late.bin',
          () => {
            queueMicrotask(() => {
              const end = performance.now() + 25;
              while (performance.now() < end) {}
              stream.end('late');
            });
            return stream;
          },
          () => {},
        ),
      diagnostics,
      { ...limits, inactivityMs: 10 },
    ),
    /inactivity/,
  );
  assert(!diagnostics.completed && diagnostics.cleanup.completed);
});
test('failure preserves original error, stops new members and quiesces other streams', async () => {
  const diagnostics = {},
    original = new Error('hash mismatch: bad.bin'),
    streams = [];
  let started = 0;
  await assert.rejects(
    withDirectoryDistributionIO(
      (io) =>
        io.members(
          Array.from({ length: 12 }, (_, i) => ({ path: `file-${i}`, bytes: 1 })),
          async (row) => {
            started++;
            await io.consume(
              row.path,
              () => {
                const stream = new PassThrough();
                streams.push(stream);
                setTimeout(() => stream.end('x'), 5);
                return stream;
              },
              () => {
                throw original;
              },
            );
          },
        ),
      diagnostics,
      limits,
    ),
    (error) => error === original,
  );
  assert(started <= 4);
  assert(streams.every((s) => s.destroyed));
  assert(diagnostics.cleanup.completed);
  assert.match(diagnostics.failureMember, /^file-/);
});
test('nonabortable pending metadata is retained as unverified cleanup and cannot start a late stream', async () => {
  const diagnostics = {};
  let resolve,
    lateOpen = false;
  await assert.rejects(
    withDirectoryDistributionIO(
      async (io) => {
        await io.perform(
          'SMB realpath: stuck.bin',
          () =>
            new Promise((r) => {
              resolve = r;
            }),
        );
        lateOpen = true;
      },
      diagnostics,
      { phaseMs: 10, inactivityMs: 10, settleMs: 10 },
    ),
    /phase deadline/,
  );
  assert(!diagnostics.cleanup.completed);
  assert(diagnostics.cleanup.pending.includes('SMB realpath: stuck.bin'));
  resolve('late');
  await pause(5);
  assert.equal(lateOpen, false);
  assert.equal(
    diagnostics.cleanup.completed,
    false,
    'Late settlement cannot rewrite captured cleanup.',
  );
});
