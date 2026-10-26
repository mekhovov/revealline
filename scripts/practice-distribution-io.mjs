/** Functional original-distribution I/O only; never changes gameplay budgets. */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

export const DIRECTORY_DISTRIBUTION_IO_POLICY = Object.freeze({
  id: 'original-distribution-stream-verification.v1',
  concurrency: 4,
  phaseMs: 600000,
  inactivityMs: 30000,
  settleMs: 5000,
});

/** Optional shorter limits are for deterministic tests only. Production passes
 * no overrides. Operations are owned until their underlying promise settles,
 * even when a timeout stops the caller waiting for a non-abortable filesystem call.
 */
export async function withDirectoryDistributionIO(run, diagnostics, shorter = {}) {
  const policy = { ...DIRECTORY_DISTRIBUTION_IO_POLICY, ...shorter };
  assert.deepEqual(
    Object.keys(shorter).filter((k) => !['phaseMs', 'inactivityMs', 'settleMs'].includes(k)),
    [],
  );
  for (const key of ['phaseMs', 'inactivityMs', 'settleMs'])
    assert(
      Number.isInteger(policy[key]) &&
        policy[key] > 0 &&
        policy[key] <= DIRECTORY_DISTRIBUTION_IO_POLICY[key],
    );
  const started = performance.now(),
    controller = new AbortController();
  const pending = new Map(),
    streams = new Set();
  let next = 0,
    stopped = false,
    abortReject,
    firstFailure;
  Object.assign(diagnostics, {
    policy: { ...policy },
    completed: false,
    totalFiles: 0,
    totalBytes: 0,
    completedFiles: 0,
    completedBytes: 0,
    streamedBytes: 0,
    activeMembers: [],
    qualificationScope:
      'Original-file integrity and functional I/O only; not app startup or performance qualification.',
  });
  const aborted = new Promise((_, reject) => {
    abortReject = reject;
  });
  void aborted.catch(() => {});
  const abort = (error) => {
    if (controller.signal.aborted) return;
    firstFailure = error;
    controller.abort(error);
    abortReject(error);
    for (const stream of streams) stream.destroy(error);
  };
  const check = () => {
    if (performance.now() - started >= policy.phaseMs)
      abort(new Error('Production distribution I/O phase deadline exceeded.'));
    if (controller.signal.aborted) throw firstFailure;
    assert(!stopped, 'Production distribution I/O has ended.');
  };
  const timer = setTimeout(
    () => abort(new Error('Production distribution I/O phase deadline exceeded.')),
    policy.phaseMs,
  );
  const perform = async (label, work) => {
    check();
    const id = ++next;
    const task = Promise.resolve().then(() => {
      check();
      return work();
    });
    pending.set(id, { label, task });
    void task.then(
      () => pending.delete(id),
      () => pending.delete(id),
    );
    const value = await Promise.race([task, aborted]);
    check();
    return value;
  };
  const consume = async (label, open, receive) => {
    let stream,
      idleTimer,
      last = performance.now();
    const inactivity = () => {
      if (performance.now() - last >= policy.inactivityMs)
        abort(new Error(`Production member inactivity deadline exceeded: ${label}`));
      check();
    };
    const arm = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(
        () => abort(new Error(`Production member inactivity deadline exceeded: ${label}`)),
        policy.inactivityMs,
      );
    };
    try {
      stream = await perform(`open stream: ${label}`, () => {
        const value = open(controller.signal);
        streams.add(value); // Own the stream before the acquisition promise can time out.
        value.on('error', () => {});
        value.once('close', () => streams.delete(value));
        last = performance.now();
        arm();
        return value;
      });
      await perform(`stream: ${label}`, async () => {
        for await (const chunk of stream) {
          inactivity();
          receive(chunk);
          check();
          diagnostics.streamedBytes += chunk.length;
          last = performance.now();
          arm();
        }
        inactivity();
      });
    } catch (error) {
      diagnostics.failureMember ??= label;
      abort(error);
      throw error;
    } finally {
      clearTimeout(idleTimer);
      stream?.destroy();
    }
  };
  const members = async (rows, verify) => {
    diagnostics.totalFiles = rows.length;
    diagnostics.totalBytes = rows.reduce((n, row) => n + row.bytes, 0);
    let index = 0;
    const worker = async () => {
      for (;;) {
        check();
        const row = rows[index++];
        if (!row) return;
        diagnostics.activeMembers.push(row.path);
        try {
          await perform(`member: ${row.path}`, () => verify(row));
          check();
          diagnostics.completedFiles++;
          diagnostics.completedBytes += row.bytes;
        } catch (error) {
          diagnostics.failureMember ??= row.path;
          abort(error);
          throw error;
        } finally {
          diagnostics.activeMembers = diagnostics.activeMembers.filter((name) => name !== row.path);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(policy.concurrency, rows.length) }, worker));
  };
  let result, failure;
  try {
    result = await perform('original distribution verification', () =>
      run({ check, perform, consume, members, signal: controller.signal }),
    );
    check();
    diagnostics.completed = true;
  } catch (error) {
    failure = error;
    abort(error);
    diagnostics.failure = String(error.message).slice(0, 2048);
  } finally {
    stopped = true;
    clearTimeout(timer);
    for (const stream of streams) stream.destroy(firstFailure);
    const pendingAtStart = [...pending.values()].map((row) => row.label);
    let settleTimer;
    // Include stream close events, not just async-iterator completion.
    const closes = [...streams].map(
      (stream) => new Promise((resolve) => stream.once('close', resolve)),
    );
    try {
      await Promise.race([
        Promise.allSettled([...pending.values()].map((row) => row.task).concat(closes)),
        new Promise((resolve) => {
          settleTimer = setTimeout(resolve, policy.settleMs);
        }),
      ]);
    } finally {
      clearTimeout(settleTimer);
    }
    diagnostics.elapsedMs = Math.round(performance.now() - started);
    diagnostics.cleanup = {
      completed: pending.size === 0 && streams.size === 0,
      pendingAtStart,
      pending: [...pending.values()].map((row) => row.label),
      openStreams: streams.size,
    };
    if (!diagnostics.cleanup.completed) {
      diagnostics.completed = false;
      failure ??= new Error('Production distribution I/O cleanup remains pending.');
      diagnostics.failure ??= failure.message;
    }
  }
  if (failure) throw failure;
  return result;
}
