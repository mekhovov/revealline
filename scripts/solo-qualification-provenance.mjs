import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, opendir, realpath } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, sep } from 'node:path';

const MiB = 1024 ** 2;
const limits = Object.freeze({
  files: 12,
  directoryEntries: 256,
  fileBytes: 512 * MiB,
  totalBytes: 1024 * MiB,
});
const failure = (error) => String(error?.message ?? error).slice(0, 512);
const inside = (root, path) => {
  const value = relative(root, path);
  if (!value || value === '..' || value.startsWith('..' + sep) || isAbsolute(value))
    throw new Error('Runtime candidate escaped the owned browser directory');
  return value.split(sep).join('/');
};

// Installed candidates are evidence about bytes, never a claim about the active
// loader or timer policy. This runs once in setup, before any measured child.
export async function captureWebKitRuntimeFiles(
  executable,
  { signal, platform = process.platform } = {},
) {
  const report = {
    format: 'SoloInstalledWebKitCandidatesV1',
    status: 'unavailable',
    scope:
      'Fixed Linux WPE installation candidates only; no loaded-library or timer-policy attestation.',
    actualLoadedIdentity: {
      status: 'unavailable',
      reason: 'No preparation-bound loaded-library witness.',
    },
    limits,
    files: [],
  };
  if (platform !== 'linux' || basename(executable) !== 'pw_run.sh') {
    report.reason = 'Unsupported launcher layout; no engine identity inferred.';
    return report;
  }
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason ?? new Error('Runtime provenance aborted'));
  const timer = setTimeout(
    () => controller.abort(new Error('Runtime provenance exceeded 15000 ms')),
    15000,
  );
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  let totalBytes = 0;
  try {
    controller.signal.throwIfAborted();
    const root = dirname(executable);
    if ((await realpath(root)) !== root || !(await lstat(root)).isDirectory())
      throw new Error('Browser installation root alias or non-directory');
    if ((await realpath(executable)) !== executable || !(await lstat(executable)).isFile())
      throw new Error('Launcher alias or non-file');
    const candidates = [
      'minibrowser-wpe/bin/MiniBrowser',
      'minibrowser-wpe/bin/WPEWebProcess',
      'minibrowser-wpe/bin/WPENetworkProcess',
    ];
    // One fixed directory, streamed with a hard entry cap; no recursive search.
    const libraryDirectory = join(root, 'minibrowser-wpe/lib');
    if ((await realpath(libraryDirectory)) !== libraryDirectory)
      throw new Error('Runtime library directory alias');
    const directory = await opendir(libraryDirectory);
    try {
      let entries = 0;
      for await (const entry of directory) {
        controller.signal.throwIfAborted();
        if (++entries > limits.directoryEntries)
          throw new Error('Runtime library directory entry budget exceeded');
        if (/^lib(?:WPEWebKit|JavaScriptCore)[A-Za-z0-9._-]*\.so(?:\.[0-9]+)*$/.test(entry.name))
          candidates.push('minibrowser-wpe/lib/' + entry.name);
        if (candidates.length > limits.files)
          throw new Error('Runtime candidate file budget exceeded');
      }
    } finally {
      await directory.close().catch((error) => {
        if (error.code !== 'ERR_DIR_CLOSED') throw error;
      });
    }
    const seen = new Set();
    for (const candidate of candidates) {
      controller.signal.throwIfAborted();
      const requested = join(root, candidate);
      const resolved = await realpath(requested);
      const path = inside(root, resolved);
      if (seen.has(path)) continue;
      seen.add(path);
      const handle = await open(resolved, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const before = await handle.stat();
        if (
          !before.isFile() ||
          !Number.isSafeInteger(before.size) ||
          before.size < 4 ||
          before.size > limits.fileBytes ||
          totalBytes + before.size > limits.totalBytes
        )
          throw new Error('Runtime candidate size/type budget exceeded');
        const magic = Buffer.alloc(4);
        if (
          (await handle.read(magic, 0, 4, 0)).bytesRead !== 4 ||
          !magic.equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))
        )
          throw new Error('Runtime candidate is not an ELF file');
        const hash = createHash('sha256');
        let bytes = 0;
        const stream = handle.createReadStream({
          start: 0,
          autoClose: false,
          signal: controller.signal,
        });
        try {
          for await (const chunk of stream) {
            bytes += chunk.length;
            if (bytes > before.size || totalBytes + bytes > limits.totalBytes)
              throw new Error('Runtime candidate grew beyond its admitted byte budget');
            hash.update(chunk);
          }
        } finally {
          stream.destroy();
        }
        const after = await handle.stat();
        const current = await lstat(resolved);
        if (
          bytes !== before.size ||
          after.dev !== before.dev ||
          after.ino !== before.ino ||
          after.size !== before.size ||
          after.mtimeMs !== before.mtimeMs ||
          current.dev !== before.dev ||
          current.ino !== before.ino ||
          current.size !== before.size ||
          current.mtimeMs !== before.mtimeMs ||
          (await realpath(requested)) !== resolved
        )
          throw new Error('Runtime candidate changed during readback');
        totalBytes += bytes;
        report.files.push({ candidate, path, bytes, sha256: hash.digest('hex') });
      } finally {
        await handle.close();
      }
    }
    controller.signal.throwIfAborted();
    if (!report.files.some((entry) => entry.path.includes('/lib/')))
      throw new Error('No WebKit or JavaScriptCore library candidate was identified');
    report.status = 'recorded-candidates';
    report.totalBytes = totalBytes;
  } catch (error) {
    report.status = controller.signal.aborted ? 'aborted' : 'incomplete';
    report.reason = failure(error);
    report.totalBytes = totalBytes;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
  return report;
}

export function requestedMeasurementContext(value) {
  const modes = ['ephemeral', 'persistent'];
  if (!modes.includes(value?.mode) || typeof value.headless !== 'boolean')
    throw new Error('Explicit measurement context mode/headless required');
  const requested = { mode: value.mode, headless: value.headless };
  for (const key of [
    'deviceScaleFactor',
    'isMobile',
    'hasTouch',
    'reducedMotion',
    'serviceWorkers',
  ]) {
    const item = value[key];
    if (item === undefined) continue;
    if (
      (key === 'deviceScaleFactor' && (!Number.isFinite(item) || item <= 0 || item > 10)) ||
      (['isMobile', 'hasTouch'].includes(key) && typeof item !== 'boolean') ||
      (key === 'reducedMotion' && !['reduce', 'no-preference'].includes(item)) ||
      (key === 'serviceWorkers' && !['allow', 'block'].includes(item))
    )
      throw new Error('Invalid requested measurement context field: ' + key);
    requested[key] = item;
  }
  if (value.viewport !== undefined) {
    const { width, height } = value.viewport ?? {};
    if (![width, height].every((n) => Number.isInteger(n) && n > 0 && n <= 16384))
      throw new Error('Invalid measurement viewport');
    requested.viewport = { width, height };
  }
  return requested;
}

// Snapshot once while prepared, before Start or any work probe. The caller must
// fail its observation on error; it must not start while a timed-out RPC remains.
export async function capturePreparedMeasurementContext(
  page,
  requested,
  { timeoutMs = 5000 } = {},
) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 5000)
    throw new Error('Measurement context deadline must be within 5000 ms');
  const declared = requestedMeasurementContext(requested);
  let timer;
  try {
    const observed = await Promise.race([
      page.evaluate(() => {
        const g = globalThis;
        const d = g.document;
        const n = g.navigator;
        const number = (value) => (Number.isFinite(value) ? value : null);
        const flag = (value) => (typeof value === 'boolean' ? value : null);
        const rawPhase = d?.body?.dataset?.flightState;
        const phase = [
          'idle',
          'title',
          'preparing',
          'ready',
          'running',
          'paused',
          'results',
          'hidden',
        ].includes(rawPhase)
          ? rawPhase
          : 'unavailable';
        if (phase === 'running')
          throw new Error('Measurement context snapshot requires preparation');
        return {
          crossOriginIsolated: flag(g.crossOriginIsolated),
          isSecureContext: flag(g.isSecureContext),
          viewport: { width: number(g.innerWidth), height: number(g.innerHeight) },
          devicePixelRatio: number(g.devicePixelRatio),
          maxTouchPoints: number(n?.maxTouchPoints),
          coarsePointer:
            typeof g.matchMedia === 'function'
              ? flag(g.matchMedia('(pointer: coarse)').matches)
              : null,
          reducedMotion:
            typeof g.matchMedia === 'function'
              ? flag(g.matchMedia('(prefers-reduced-motion: reduce)').matches)
              : null,
          phase,
          visibility: ['visible', 'hidden'].includes(d?.visibilityState)
            ? d.visibilityState
            : 'unavailable',
        };
      }),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Prepared measurement context exceeded deadline')),
          timeoutMs,
        );
      }),
    ]);
    return {
      format: 'SoloPreparedMeasurementContextV1',
      status:
        observed.crossOriginIsolated === null || observed.isSecureContext === null
          ? 'unavailable'
          : 'observed',
      stage: 'prepared-before-start',
      requested: declared,
      observed,
      scope:
        'Context observation only; missing values are null, no timer-error or overhead qualification.',
    };
  } finally {
    clearTimeout(timer);
  }
}
