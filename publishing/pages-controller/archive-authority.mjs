/** Fresh, bounded read-only observations; never shared between publication phases. */
import { spawn } from 'node:child_process';

export const ARCHIVE_CONCURRENCY = 4;
const REQUEST_TIMEOUT_MS = 60_000;
const PHASE_TIMEOUT_MS = 180_000;
const MAX_BYTES = 16_000_000;

const bounded = (value, maximum, name) => {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum)
    throw new Error(`Invalid ${name} bound.`);
};

/** Resolve only after close, including cancellation, timeout and output overflow. */
export function githubJSON(
  endpoint,
  {
    cwd,
    signal,
    spawnChild = spawn,
    timeoutMs = REQUEST_TIMEOUT_MS,
    maxBytes = MAX_BYTES,
    killGraceMs = 1_000,
  } = {},
) {
  bounded(timeoutMs, REQUEST_TIMEOUT_MS, 'request timeout');
  bounded(maxBytes, MAX_BYTES, 'response bytes');
  bounded(killGraceMs, 1_000, 'kill grace');
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error('Archive observation aborted.'));
      return;
    }
    let child;
    try {
      child = spawnChild('gh', ['api', endpoint], {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      reject(error);
      return;
    }
    const stdout = [],
      stderr = [];
    let stdoutBytes = 0,
      stderrBytes = 0,
      failure = null,
      closed = false,
      killTimer;
    const fail = (error) => {
      if (closed || failure) return;
      failure = error;
      child.kill('SIGTERM');
      killTimer = setTimeout(() => {
        if (!closed) child.kill('SIGKILL');
      }, killGraceMs);
    };
    const aborted = () => fail(signal.reason ?? new Error('Archive observation aborted.'));
    const timer = setTimeout(
      () => fail(new Error(`GitHub API deadline exceeded: ${endpoint}`)),
      timeoutMs,
    );
    child.stdout.on('data', (chunk) => {
      if (failure) return;
      stdoutBytes += chunk.length;
      if (stdoutBytes > maxBytes)
        fail(new Error(`GitHub API stdout exceeds byte budget: ${endpoint}`));
      else stdout.push(chunk);
    });
    child.stderr.on('data', (chunk) => {
      if (failure) return;
      stderrBytes += chunk.length;
      if (stderrBytes > maxBytes)
        fail(new Error(`GitHub API stderr exceeds byte budget: ${endpoint}`));
      else stderr.push(chunk);
    });
    child.on('error', fail);
    child.stdout.on('error', fail);
    child.stderr.on('error', fail);
    child.once('close', (code, exitSignal) => {
      closed = true;
      clearTimeout(timer);
      clearTimeout(killTimer);
      signal?.removeEventListener('abort', aborted);
      if (failure) reject(failure);
      else if (code !== 0)
        reject(
          new Error(
            `gh api failed (${code ?? exitSignal}): ${Buffer.concat(stderr).toString('utf8').slice(0, 4096)}`,
          ),
        );
      else {
        try {
          resolve(JSON.parse(Buffer.concat(stdout).toString('utf8')));
        } catch {
          reject(new Error(`GitHub API returned invalid JSON: ${endpoint}`));
        }
      }
    });
    signal?.addEventListener('abort', aborted, { once: true });
    if (signal?.aborted) aborted();
  });
}

export async function observeArchiveAuthorities(
  admissions,
  {
    cwd,
    api = (endpoint, options) => githubJSON(endpoint, { cwd, ...options }),
    timeoutMs = PHASE_TIMEOUT_MS,
  } = {},
) {
  bounded(timeoutMs, PHASE_TIMEOUT_MS, 'archive phase timeout');
  const controller = new AbortController();
  const observations = new Array(admissions.length);
  let next = 0,
    failure = null;
  const fail = (error) => {
    if (failure) return;
    failure =
      error instanceof Error ? error : new Error('Archive observation failed.', { cause: error });
    controller.abort(failure);
  };
  const timer = setTimeout(
    () => fail(new Error('Archive authority phase deadline exceeded.')),
    timeoutMs,
  );
  const request = async (endpoint) => {
    controller.signal.throwIfAborted();
    const result = await api(endpoint, { signal: controller.signal });
    controller.signal.throwIfAborted();
    return result;
  };
  const worker = async () => {
    while (!failure && next < admissions.length) {
      const index = next++,
        admission = admissions[index];
      try {
        const repo = `mekhovov/revealline-${admission.id}`;
        const commit = await request(`repos/${repo}/commits/main`);
        const deployment = await request(`repos/${repo}/deployments/${admission.deploymentId}`);
        const statuses = await request(
          `repos/${repo}/deployments/${admission.deploymentId}/statuses`,
        );
        // Keep the existing authority assertions and receipt fields unchanged.
        if (
          commit.sha !== admission.infrastructureCommit ||
          deployment.sha !== admission.infrastructureCommit ||
          deployment.environment !== 'github-pages' ||
          statuses[0]?.state !== 'success'
        )
          throw new Error(`Admitted archive changed or is not deployed: ${admission.id}`);
        observations[index] = {
          archiveId: admission.id,
          infrastructureCommit: commit.sha,
          deploymentId: deployment.id,
          deploymentState: statuses[0].state,
        };
      } catch (error) {
        fail(error);
      }
    }
  };
  try {
    // Wait for every active transport to close before returning or throwing.
    await Promise.all(
      Array.from({ length: Math.min(ARCHIVE_CONCURRENCY, admissions.length) }, worker),
    );
    if (failure) throw failure;
    return observations;
  } finally {
    clearTimeout(timer);
  }
}
