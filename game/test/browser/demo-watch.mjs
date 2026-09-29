/** Read-only game observation; observer checkpoints use their own database. No game APIs are replaced. */
const { DOMParser } = globalThis;
export const OBSERVATION_LIMITS = Object.freeze({
  intervalMs: 5000,
  longGapMs: 10000,
  samples: 1500,
  events: 1024,
  diagnostics: 64,
  sourceFiles: 768,
  sourceBytes: 64 * 1024 * 1024,
  fileBytes: 8 * 1024 * 1024,
  // The installed bot pack is 11,708,176 bytes, mostly inline level artwork.
  // Retain its full served-byte hash without widening other dependency limits.
  fileByteExceptions: Object.freeze({ 'game/content/packs/fpv-arcade-r5.json': 12 * 1024 * 1024 }),
  storageKeys: 512,
  checkpointMs: 15000,
  checkpointBytes: 8 * 1024 * 1024,
  storageTimeoutMs: 5000,
});

export const OBSERVATION_ROOTS = [
  'game/index.html',
  'game/app.mjs',
  'game/boot.mjs',
  'game/style.css',
  'game/ui/demo.css',
  'game/ui/native-menu.css',
  'game/ui/demo-host.mjs',
  'game/ui/demo-clock.mjs',
  'game/ui/demo-audio.mjs',
  'game/ui/demo-input.mjs',
  'game/ui/demo-picture.mjs',
  'game/ui/render.mjs',
  'game/ui/audio.mjs',
  'game/ui/soundtrack-player.mjs',
  'game/demo-director.mjs',
  'game/demo-sources.mjs',
  'game/demo-library.mjs',
  'game/demo-bot-worker.mjs',
  'game/replay-player.mjs',
  'game/core/index.mjs',
  'game/content/campaign.json',
  'game/content/classes.json',
  'game/content/packs/fpv-arcade-r5.json',
  'game/demo-data/catalog.json',
  'game/demo-data/variant-provenance.json',
  'game/test/browser/demo-watch.html',
  'game/test/browser/demo-watch.mjs',
];

export function literalDependencies(source) {
  const dependencies = new Set();
  for (const pattern of [
    /\b(?:import|export)\s+(?:[^;"'`]*?\s+from\s*)?["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']/g,
  ])
    for (const match of source.matchAll(pattern))
      if (/^\.{1,2}\//.test(match[1])) dependencies.add(match[1]);
  return [...dependencies];
}

export function compareHashes(before, after, identity = 'path') {
  const left = new Map(before.map((row) => [row[identity], row.sha256]));
  const right = new Map(after.map((row) => [row[identity], row.sha256]));
  return {
    changed: [...left]
      .filter(([key, value]) => right.has(key) && right.get(key) !== value)
      .map(([key]) => key),
    removed: [...left.keys()].filter((key) => !right.has(key)),
    added: [...right.keys()].filter((key) => !left.has(key)),
  };
}

/** Missing intervals deliberately contribute no observed activity. */
export function createObservationLog(startMs, startCalendarMs) {
  const samples = [],
    events = [];
  let lastMs = startMs,
    lastCalendarMs = startCalendarMs;
  const totals = {
    elapsedSeconds: 0,
    sampledIntervalSeconds: 0,
    unobservedLongGapSeconds: 0,
    calendarDiscontinuitySeconds: 0,
    longGaps: 0,
    maxGapSeconds: 0,
    droppedSamples: 0,
    droppedEvents: 0,
  };
  return {
    samples,
    events,
    totals,
    event(type, ms, detail = {}) {
      if (events.length >= OBSERVATION_LIMITS.events) {
        totals.droppedEvents++;
        return;
      }
      events.push({ type, elapsedSeconds: Math.max(0, (ms - startMs) / 1000), ...detail });
    },
    sample(ms, calendarMs, state) {
      const monotonicMs = Math.max(lastMs, ms),
        gapMs = monotonicMs - lastMs;
      const calendarGapMs = calendarMs - lastCalendarMs;
      totals.elapsedSeconds = (monotonicMs - startMs) / 1000;
      totals.maxGapSeconds = Math.max(totals.maxGapSeconds, gapMs / 1000);
      const longGap = gapMs > OBSERVATION_LIMITS.longGapMs;
      if (longGap) {
        totals.longGaps++;
        totals.unobservedLongGapSeconds += gapMs / 1000;
      } else totals.sampledIntervalSeconds += gapMs / 1000;
      if (Math.abs(calendarGapMs - gapMs) > OBSERVATION_LIMITS.longGapMs)
        totals.calendarDiscontinuitySeconds += Math.abs(calendarGapMs - gapMs) / 1000;
      lastMs = monotonicMs;
      lastCalendarMs = calendarMs;
      if (samples.length >= OBSERVATION_LIMITS.samples) {
        totals.droppedSamples++;
        return;
      }
      samples.push({
        elapsedSeconds: totals.elapsedSeconds,
        gapSeconds: gapMs / 1000,
        longGap,
        calendarGapSeconds: calendarGapMs / 1000,
        ...state,
      });
    },
  };
}

/** Use the target document's realm: iframe Nodes need not be parent instanceof Node. */
export function observationTargets(doc, { required = false } = {}) {
  const NodeClass = doc?.defaultView?.Node;
  if (typeof NodeClass !== 'function' || !(doc instanceof NodeClass))
    throw new TypeError('Observer child document is not a native Node.');
  return ['demo-dialog', 'demo-watch-pause', 'demo-level', 'demo-source', 'demo-actions']
    .map((id) => {
      const node = doc.getElementById(id);
      if (node == null && !required) return null;
      if (!(node instanceof NodeClass) || node.ownerDocument !== doc)
        throw new TypeError(`Observer target #${id} is missing or is not a Node of this document.`);
      return { id, node };
    })
    .filter(Boolean);
}

export function observationDiagnostic(error, details = {}) {
  return {
    ...details,
    name: boundedText(error?.name, 128),
    message: boundedText(error?.message ?? error, 1024),
    stack: boundedText(error?.stack, 4096),
  };
}

const sha256 = async (bytes) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
const textBytes = (value) => new TextEncoder().encode(value);
const boundedText = (value, size = 512) => String(value ?? '').slice(0, size);

async function sourceInventory(root, paths = null, signal) {
  const pending = [...(paths ?? OBSERVATION_ROOTS)],
    seen = new Set(),
    files = [];
  let totalBytes = 0;
  while (pending.length) {
    const batch = [];
    while (pending.length && batch.length < 6) {
      const path = pending.shift();
      if (!seen.has(path)) {
        seen.add(path);
        batch.push(path);
      }
    }
    if (seen.size > OBSERVATION_LIMITS.sourceFiles)
      throw new Error('Source inventory file limit exceeded.');
    const entries = await Promise.all(
      batch.map(async (path) => {
        const url = new URL(path, root);
        const fileLimit =
          OBSERVATION_LIMITS.fileByteExceptions[path] ?? OBSERVATION_LIMITS.fileBytes;
        if (
          url.origin !== root.origin ||
          !url.pathname.startsWith(root.pathname) ||
          url.search ||
          url.hash
        )
          throw new Error('Inventory reference escaped this distribution.');
        const response = await fetch(url, {
          cache: 'no-store',
          redirect: 'error',
          credentials: 'same-origin',
          signal,
        });
        if (!response.ok || response.redirected || response.url !== url.href)
          throw new Error(`Inventory fetch failed: ${path}`);
        const reader = response.body.getReader(),
          chunks = [];
        let size = 0;
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            totalBytes += value.byteLength;
            if (size > fileLimit)
              throw new Error(
                `Inventory file limit: ${path} read ${size} bytes; limit ${fileLimit}.`,
              );
            if (totalBytes > OBSERVATION_LIMITS.sourceBytes)
              throw new Error(
                `Inventory total limit while reading ${path}: ${totalBytes} bytes; limit ${OBSERVATION_LIMITS.sourceBytes}.`,
              );
            chunks.push(value);
          }
        } finally {
          await reader.cancel().catch(() => {});
          reader.releaseLock();
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.length;
        }
        const source =
            /\.(?:mjs|css|html)$/.test(path) || path === 'game/demo-data/catalog.json'
              ? new TextDecoder().decode(bytes)
              : '',
          dependencies = [];
        // The app itself is pinned, not expanded into every unrelated game feature.
        // This is a bounded literal-import inventory, not a coverage/complete-graph claim.
        if (
          !paths &&
          path.endsWith('.mjs') &&
          !['game/app.mjs', 'game/test/browser/demo-watch.mjs'].includes(path)
        )
          dependencies.push(...literalDependencies(source));
        if (!paths && path.endsWith('.css'))
          for (const match of source.matchAll(/@import\s+(?:url\(\s*)?["']([^"']+)["']/g))
            dependencies.push(match[1]);
        if (!paths && path === 'game/index.html') {
          const html = new DOMParser().parseFromString(source, 'text/html');
          for (const node of html.querySelectorAll('script[src], link[rel="stylesheet"]')) {
            const reference =
              node.getAttribute('src') ??
              node.getAttribute('href') ??
              node.getAttribute('data-boot-href');
            if (reference) dependencies.push(reference);
          }
        }
        if (!paths && path === 'game/demo-data/catalog.json')
          for (const clip of JSON.parse(source).clips)
            for (const reference of [clip.replayURL, ...(clip.replayVariants ?? [])])
              dependencies.push(new URL(reference, new URL('game/index.html', root)).href);
        const resolved = dependencies.map((reference) => {
          const target = new URL(reference, url);
          if (target.origin !== root.origin || !target.pathname.startsWith(root.pathname))
            throw new Error(`Nonlocal inventory dependency in ${path}`);
          return target.pathname.slice(root.pathname.length);
        });
        return { file: { path, bytes: size, sha256: await sha256(bytes) }, resolved };
      }),
    );
    for (const { file, resolved } of entries) {
      files.push(file);
      pending.push(...resolved);
    }
  }
  return {
    files: files.sort((a, b) => a.path.localeCompare(b.path)),
    totalBytes,
    scope:
      'Served-byte inventory of explicit roots, literal local imports, shared HTML scripts/styles and frozen clips. Not runtime execution coverage; computed imports/media are not exhaustive.',
  };
}

async function storageSnapshot(win) {
  try {
    const storage = win.localStorage,
      count = storage.length;
    if (count > OBSERVATION_LIMITS.storageKeys) throw new Error('Storage key limit exceeded.');
    // Capture synchronously, then digest; no raw values or keys leave this function.
    const values = [];
    let totalBytes = 0;
    for (let i = 0; i < count; i++) {
      const key = storage.key(i),
        value = storage.getItem(key),
        bytes = textBytes(value ?? '');
      totalBytes += bytes.length;
      if (totalBytes > 16 * 1024 * 1024) throw new Error('Storage snapshot byte limit exceeded.');
      values.push({ key, bytes });
    }
    const entries = await Promise.all(
      values.map(async ({ key, bytes }) => ({
        keyHash: await sha256(textBytes(key)),
        bytes: bytes.length,
        sha256: await sha256(bytes),
      })),
    );
    return {
      available: true,
      entries: entries.sort((a, b) => a.keyHash.localeCompare(b.keyHash)),
      totalBytes,
    };
  } catch (error) {
    return { available: false, error: boundedText(error.message) };
  }
}

export const OBSERVATION_DATABASE = 'revealline-demo-watch-observer-v1';
const REPORT_FORMAT = 'revealline-demo-browser-observation.v1';

/** Observer-only storage: two bounded slots, never a game/profile database. */
export function createObservationCheckpointStore({
  indexedDB = globalThis.indexedDB,
  setTimeout = globalThis.setTimeout,
  clearTimeout = globalThis.clearTimeout,
} = {}) {
  let connection = null,
    opening = null,
    closed = false;
  const pending = new Set();
  function operation(perform) {
    return new Promise((resolve, reject) => {
      let settled = false,
        cancel = () => {};
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        pending.delete(stop);
        if (error) reject(error);
        else resolve(value);
      };
      const stop = () => {
        finish(new Error('Observer checkpoint storage closed.'));
        cancel();
      };
      const timer = setTimeout(() => {
        finish(new Error('Observer checkpoint storage timed out.'));
        cancel();
      }, OBSERVATION_LIMITS.storageTimeoutMs);
      pending.add(stop);
      try {
        if (closed) throw new Error('Observer checkpoint storage closed.');
        cancel = perform(finish, () => settled) ?? cancel;
      } catch (error) {
        finish(error);
      }
    });
  }
  async function open() {
    if (closed) throw new Error('Observer checkpoint storage closed.');
    if (connection) return connection;
    if (!opening)
      opening = operation((finish, settled) => {
        if (!indexedDB) throw new Error('IndexedDB is unavailable for observer checkpoints.');
        const request = indexedDB.open(OBSERVATION_DATABASE, 1);
        request.onupgradeneeded = () => {
          if (settled()) {
            request.transaction.abort();
            return;
          }
          request.result.createObjectStore('reports');
        };
        request.onerror = () =>
          finish(request.error ?? new Error('Observer database open failed.'));
        request.onsuccess = () => {
          const db = request.result;
          if (closed || settled()) {
            db.close();
            return;
          }
          connection = db;
          db.onversionchange = () => {
            db.close();
            if (connection === db) connection = null;
          };
          finish(null, db);
        };
      }).finally(() => {
        opening = null;
      });
    return opening;
  }
  async function transaction(mode, action) {
    const db = await open();
    return operation((finish) => {
      const tx = db.transaction(['reports'], mode);
      let result;
      tx.oncomplete = () => finish(null, result);
      tx.onabort = () => finish(tx.error ?? new Error('Observer checkpoint transaction aborted.'));
      tx.onerror = () => {}; // The abort owns rejection and rollback.
      action(tx.objectStore('reports'), (value) => {
        result = value;
      });
      return () => {
        try {
          tx.abort();
        } catch {
          /* Already committed. */
        }
      };
    });
  }
  function decode(text) {
    if (text == null) return null;
    if (typeof text !== 'string' || textBytes(text).length > OBSERVATION_LIMITS.checkpointBytes)
      throw new Error('Observer checkpoint exceeds its byte limit.');
    const report = JSON.parse(text);
    if (
      report.format !== REPORT_FORMAT ||
      !Array.isArray(report.initialInventory?.files) ||
      report.initialInventory.files.length > OBSERVATION_LIMITS.sourceFiles ||
      !Array.isArray(report.samples) ||
      report.samples.length > OBSERVATION_LIMITS.samples ||
      !Array.isArray(report.events) ||
      report.events.length > OBSERVATION_LIMITS.events ||
      !Array.isArray(report.diagnostics) ||
      report.diagnostics.length > OBSERVATION_LIMITS.diagnostics
    )
      throw new Error('Observer checkpoint is not a bounded observation report.');
    return report;
  }
  return {
    async read() {
      const values = await transaction('readonly', (store, result) => {
        const rows = {};
        for (const slot of ['checkpoint', 'final']) {
          const request = store.get(slot);
          request.onsuccess = () => {
            rows[slot] = request.result;
          };
        }
        result(rows);
      });
      return { checkpoint: decode(values.checkpoint), final: decode(values.final) };
    },
    async write(slot, text) {
      if (!['checkpoint', 'final'].includes(slot)) throw new Error('Unknown observer slot.');
      decode(text); // Check before opening a transaction or retaining a second queued copy.
      await transaction('readwrite', (store) => {
        store.put(text, slot);
      });
    },
    async clear() {
      await transaction('readwrite', (store) => {
        store.delete('checkpoint');
        store.delete('final');
      });
    },
    close() {
      closed = true;
      for (const cancel of [...pending]) cancel();
      connection?.close();
      connection = null;
    },
  };
}

/** Mount the actual observer; dependency injection only supplies browser boundaries in tests. */
export function mountObserver({
  environment = globalThis,
  readInventory = sourceInventory,
  readStorage = storageSnapshot,
  checkpointStore = null,
  moduleURL = import.meta.url,
} = {}) {
  const {
    document,
    location,
    window,
    navigator,
    performance,
    MutationObserver,
    setTimeout,
    clearTimeout,
  } = environment;
  const calendarNow = () => (environment.Date ?? Date).now();
  const $ = (id) => document.getElementById(id),
    frame = $('observed-game');
  const root = new URL('../../../', moduleURL),
    childURL = new URL('../../index.html?journey=legacy', moduleURL);
  if (
    root.origin !== location.origin ||
    childURL.origin !== location.origin ||
    !/^https?:$/.test(root.protocol)
  )
    throw new Error('This observer requires a same-origin HTTP(S) development server.');
  let report = null,
    log = null,
    timer = null,
    running = false,
    preparing = false,
    finishing = false,
    preparationCancelled = false,
    requestController = null,
    observer = null,
    phaseKey = '',
    startMs = 0,
    durationSeconds = 7200,
    scratch = null,
    scratchContext = null,
    frameLoads = 0,
    observerHealth = { attached: false, targets: 0, failures: 0, error: null },
    diagnostics = [],
    droppedDiagnostics = 0,
    removeChildDiagnostics = () => {};
  let disposed = false,
    recovering = true,
    clearing = false,
    recovered = null,
    storedFinal = null,
    checkpointText = '',
    recoveryText = '',
    finalText = '',
    queuedSave = null,
    saving = null,
    lastCheckpointMs = -Infinity,
    persistenceFailed = false;
  const store =
    checkpointStore ??
    createObservationCheckpointStore({
      indexedDB: environment.indexedDB,
      setTimeout,
      clearTimeout,
    });
  const cleanupListeners = [];
  const listen = (target, type, listener) => {
    target.addEventListener(type, listener);
    cleanupListeners.push(() => target.removeEventListener(type, listener));
  };
  function diagnostic(scope, type, error, details = {}) {
    const entry = observationDiagnostic(error, {
      scope,
      type,
      at: new Date(calendarNow()).toISOString(),
      elapsedSeconds: running ? Math.max(0, (performance.now() - startMs) / 1000) : null,
      ...details,
    });
    if (diagnostics.length < OBSERVATION_LIMITS.diagnostics) diagnostics.push(entry);
    else droppedDiagnostics++;
    return entry;
  }
  function captureErrors(target, scope) {
    const onError = (event) => {
      // Resource-load errors lack a JS Error/message; do not invent a JS failure.
      if (!event.message && !event.error) return;
      diagnostic(scope, 'error', event.error ?? event.message, {
        filename: boundedText(event.filename, 1024),
        line: Number(event.lineno) || null,
        column: Number(event.colno) || null,
      });
    };
    const onRejection = (event) => diagnostic(scope, 'unhandledrejection', event.reason);
    target.addEventListener('error', onError);
    target.addEventListener('unhandledrejection', onRejection);
    return () => {
      target.removeEventListener('error', onError);
      target.removeEventListener('unhandledrejection', onRejection);
    };
  }
  cleanupListeners.push(captureErrors(window, 'observer-window'));
  const status = (value) => {
    $('observer-status').textContent = value;
  };
  const persistenceStatus = (text) => {
    $('observation-checkpoint-status').textContent = text;
  };
  function storageFailure(error) {
    if (!persistenceFailed) diagnostic('observer-window', 'checkpoint-storage-unavailable', error);
    persistenceFailed = true;
    queuedSave = null;
    persistenceStatus(
      `Automatic recovery unavailable: ${boundedText(error.message)} Download JSON while this page remains open. Observation can continue.`,
    );
  }
  function queueSave(slot, text) {
    if (persistenceFailed || disposed) return saving;
    queuedSave = { slot, text }; // At most one in-flight and one newest bounded serialization.
    if (!saving)
      saving = (async () => {
        while (queuedSave && !persistenceFailed) {
          const next = queuedSave;
          queuedSave = null;
          try {
            await store.write(next.slot, next.text);
            if (!disposed)
              persistenceStatus(
                `Saved ${next.slot === 'final' ? 'finalized report' : 'incomplete checkpoint'} to the observer-only database. Last successful save: ${new Date(calendarNow()).toISOString()}.`,
              );
          } catch (error) {
            storageFailure(error);
          }
        }
      })().finally(() => {
        saving = null;
      });
    return saving;
  }
  function serialize(value) {
    let text = JSON.stringify(value, null, 2);
    // A pathological sequence of long DOM labels must not create unbounded storage or DOM output.
    for (const key of ['samples', 'events', 'diagnostics']) {
      while (textBytes(text).length > OBSERVATION_LIMITS.checkpointBytes && value[key]?.length) {
        const count = Math.max(1, Math.ceil(value[key].length / 2));
        value[key] = value[key].slice(count);
        value.reportTruncation ??= {};
        value.reportTruncation[key] = (value.reportTruncation[key] ?? 0) + count;
        text = JSON.stringify(value, null, 2);
      }
    }
    if (textBytes(text).length > OBSERVATION_LIMITS.checkpointBytes)
      throw new Error('Observer report exceeds its byte budget even without samples/events.');
    return text;
  }
  function publishCheckpoint(reason = 'periodic', force = false) {
    if (!report || !log || disposed) return;
    const value = {
      ...report,
      status: 'incomplete',
      checkpointAt: new Date(calendarNow()).toISOString(),
      checkpointReason: reason,
      finishedAt: null,
      stopReason: null,
      timing: { ...log.totals },
      samples: [...log.samples],
      events: [...log.events],
      childNavigationsDuringObservation: frameLoads,
      observerHealth: { ...observerHealth },
      diagnostics: [...diagnostics],
      droppedDiagnostics,
      terminalChecks: { sourceInventory: 'pending', storage: 'pending' },
      sourceInventoryStable: null,
      observationValidForPinnedSources: false,
      observationComplete: false,
      requestedDurationReached: log.totals.elapsedSeconds >= durationSeconds,
      releaseQualified: false,
      checkpointLimitations:
        'Incomplete checkpoint only. Terminal source/storage comparisons have not run. Time after this checkpoint is unobserved. Recovery never resumes a run or operates the game.',
    };
    try {
      checkpointText = serialize(value);
      $('observation-report').value = checkpointText;
      $('observation-download').disabled = false;
      const now = performance.now();
      if (force || now - lastCheckpointMs >= OBSERVATION_LIMITS.checkpointMs) {
        lastCheckpointMs = now;
        queueSave('checkpoint', checkpointText);
      }
    } catch (error) {
      storageFailure(error);
    }
  }
  function showRecovered() {
    const kind = $('observation-recovered-kind').value;
    const value = kind === 'final' ? storedFinal : recovered;
    recoveryText = value ? JSON.stringify(value, null, 2) : '';
    $('observation-recovered-report').value = recoveryText;
    $('observation-recovered-download').disabled = !value;
    $('observation-recovered-status').textContent = value
      ? `Previous run — ${kind === 'final' ? 'finalized report' : 'INCOMPLETE checkpoint; terminal source/storage checks missing'}. Started ${value.startedAt}; captured ${value.timing?.elapsedSeconds ?? 0}s, ${value.samples?.length ?? 0} samples. No observation was resumed and the game was not operated.`
      : `No saved ${kind === 'final' ? 'finalized report' : 'incomplete checkpoint'} from a previous run.`;
  }
  function download(text) {
    if (!text) return;
    const value = JSON.parse(text);
    const URLClass = environment.URL ?? URL;
    const url = URLClass.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `demo-browser-${value.status ?? 'finalized'}-${value.mode}-${value.startedAt.replaceAll(':', '-')}.json`;
    link.click();
    setTimeout(() => URLClass.revokeObjectURL(url), 1000);
  }
  const ready = (async () => {
    $('observation-start').disabled = true;
    persistenceStatus('Reading the observer-only checkpoint database…');
    try {
      const prior = await store.read();
      if (disposed) return;
      recovered = prior.checkpoint;
      storedFinal = prior.final;
      if (!recovered && storedFinal) $('observation-recovered-kind').value = 'final';
      showRecovered();
      persistenceStatus(
        'Automatic checkpoint recovery is available. Only the latest incomplete checkpoint and last finalized report are kept; a new observation replaces the incomplete slot.',
      );
    } catch (error) {
      if (!disposed) storageFailure(error);
    } finally {
      recovering = false;
      if (!disposed) $('observation-start').disabled = false;
    }
  })();
  const memory = () => {
    const value = frame.contentWindow?.performance?.memory;
    return value
      ? {
          supported: true,
          usedJSHeapSize: value.usedJSHeapSize,
          totalJSHeapSize: value.totalJSHeapSize,
          jsHeapSizeLimit: value.jsHeapSizeLimit,
        }
      : { supported: false };
  };
  function state() {
    try {
      if (frame.contentWindow.location.origin !== location.origin)
        throw new Error('The game navigated outside this origin.');
      const doc = frame.contentDocument,
        get = (id) => doc.getElementById(id),
        text = (id) => boundedText(get(id)?.textContent?.trim()),
        dialog = get('demo-dialog');
      const button = (id) => ({
        label: text(id),
        disabled: get(id)?.disabled ?? null,
        hidden: get(id)?.hidden ?? null,
        pressed: get(id)?.getAttribute('aria-pressed') ?? null,
      });
      return {
        available: true,
        observerHealth: { ...observerHealth },
        diagnosticCount: diagnostics.length,
        parentVisibility: document.visibilityState,
        childVisibility: doc.visibilityState,
        parentFocused: document.hasFocus(),
        childFocused: doc.hasFocus(),
        bootState: doc.documentElement.dataset.bootState ?? null,
        buildLabel: doc.documentElement.dataset.buildVersion ?? null,
        demoOpen: !!dialog?.open,
        practice: dialog?.classList.contains('is-practice') ?? false,
        level: text('demo-level'),
        source: text('demo-source'),
        caption: text('demo-caption'),
        statusAndTimer: text('demo-status'),
        demoPause: button('demo-watch-pause'),
        actionsShown: get('demo-actions') ? !get('demo-actions').hidden : null,
        practicePause: button('demo-pause'),
        practiceResume: button('demo-resume'),
        audio: {
          title: text('demo-audio-title'),
          artist: text('demo-audio-artist'),
          transport: button('demo-audio-toggle'),
          mute: button('demo-audio-mute'),
          status: text('demo-audio-status'),
          volume: get('demo-audio-volume')?.value ?? null,
        },
        memory: memory(),
      };
    } catch (error) {
      return {
        available: false,
        error: boundedText(error.message),
        parentVisibility: document.visibilityState,
      };
    }
  }
  function showControls() {
    try {
      const doc = frame.contentDocument;
      $('observer-controls').textContent = [
        'shell-demo',
        'demo-button',
        'demo-watch-pause',
        'demo-next',
        'demo-interrupt',
        'demo-back',
        'demo-audio-mute',
        'demo-audio-toggle',
        'demo-audio-next',
        'demo-resume',
        'demo-return',
        'demo-fresh',
      ]
        .map((id) => {
          const node = doc.getElementById(id);
          return node
            ? `${id}: ${boundedText(node.textContent.trim())}${node.disabled ? ' [disabled]' : ''}${node.hidden ? ' [hidden attribute]' : ''}`
            : null;
        })
        .filter(Boolean)
        .join('\n');
    } catch {
      $('observer-controls').textContent = 'Same-origin game controls are unavailable.';
    }
  }
  function phaseChanged() {
    showControls();
    if (!running) return;
    const s = state(),
      phase = {
        available: s.available,
        demoOpen: s.demoOpen,
        practice: s.practice,
        level: s.level,
        source: s.source,
        demoPause: s.demoPause,
        actionsShown: s.actionsShown,
        music: s.audio?.transport,
        title: s.audio?.title,
      };
    const next = JSON.stringify(phase);
    if (next !== phaseKey) {
      phaseKey = next;
      log.event('observed-dom-state-change', performance.now(), { phase });
    }
  }
  function attachChild() {
    observer?.disconnect();
    observer = null;
    removeChildDiagnostics();
    removeChildDiagnostics = () => {};
    observerHealth = { ...observerHealth, attached: false, targets: 0 };
    try {
      const doc = frame.contentDocument;
      const targets = observationTargets(doc, { required: running });
      removeChildDiagnostics = captureErrors(doc.defaultView, 'game-window');
      const ObserverClass = doc.defaultView.MutationObserver ?? MutationObserver;
      observer = new ObserverClass((records) => {
        if (
          records.some(
            (record) =>
              record.type !== 'attributes' ||
              record.oldValue !== record.target.getAttribute(record.attributeName),
          )
        )
          phaseChanged();
      });
      for (const { id, node } of targets)
        observer.observe(node, {
          attributes: true,
          attributeOldValue: true,
          attributeFilter: ['open', 'class', 'hidden', 'aria-pressed', 'disabled'],
          childList: true,
          characterData: true,
          subtree: id !== 'demo-dialog',
        });
      observerHealth = { ...observerHealth, attached: true, targets: targets.length, error: null };
      phaseChanged();
    } catch (error) {
      observer?.disconnect();
      observer = null;
      const detail = diagnostic('observer-window', 'observer-attachment-failed', error);
      observerHealth = {
        attached: false,
        targets: 0,
        failures: observerHealth.failures + 1,
        error: detail,
      };
      if (running) log.event('observer-attachment-failed', performance.now(), { detail });
    }
  }
  function canvasSample() {
    if (document.hidden) return { sampled: false, reason: 'hidden-page' };
    try {
      const doc = frame.contentDocument,
        canvas = doc.getElementById('demo-canvas'),
        bounds = frame.getBoundingClientRect();
      if (
        doc.hidden ||
        !doc.getElementById('demo-dialog')?.open ||
        !canvas?.width ||
        !canvas?.height ||
        bounds.bottom <= 0 ||
        bounds.top >= window.innerHeight ||
        bounds.right <= 0 ||
        bounds.left >= window.innerWidth
      )
        return { sampled: false, reason: 'canvas-not-visible' };
      scratch ??= document.createElement('canvas');
      scratch.width = 12;
      scratch.height = 8;
      scratchContext ??= scratch.getContext('2d', { willReadFrequently: true });
      scratchContext.clearRect(0, 0, 12, 8);
      scratchContext.drawImage(canvas, 0, 0, 12, 8);
      const pixels = scratchContext.getImageData(0, 0, 12, 8).data;
      let hash = 2166136261;
      for (const byte of pixels) hash = Math.imul(hash ^ byte, 16777619);
      return {
        sampled: true,
        algorithm: 'fnv1a32-scaled-rgba-12x8',
        checksum: (hash >>> 0).toString(16).padStart(8, '0'),
        width: canvas.width,
        height: canvas.height,
      };
    } catch (error) {
      return { sampled: false, reason: 'read-unavailable', error: boundedText(error.message) };
    }
  }
  function sample() {
    if (!running) return;
    const current = state();
    log.sample(performance.now(), calendarNow(), { ...current, canvas: canvasSample() });
    phaseChanged();
    status(
      `Observing ${log.totals.elapsedSeconds.toFixed(1)} / ${durationSeconds} seconds\nSamples ${log.samples.length}; long gaps ${log.totals.longGaps}; unobserved gap time ${log.totals.unobservedLongGapSeconds.toFixed(1)}s\n${current.source ?? ''} · ${current.level ?? ''}\n${current.statusAndTimer ?? current.error ?? ''}\nDOM observer ${observerHealth.attached ? 'attached' : 'UNAVAILABLE'}; attachment failures ${observerHealth.failures}; JS diagnostics ${diagnostics.length}${droppedDiagnostics ? ` (+${droppedDiagnostics} dropped)` : ''}`,
    );
    publishCheckpoint();
  }
  function wake() {
    timer = null;
    if (!running) return;
    sample();
    if (log.totals.elapsedSeconds >= durationSeconds) void stop('requested-duration');
    else if (log.samples.length >= OBSERVATION_LIMITS.samples - 1) void stop('sample-limit');
    else timer = setTimeout(wake, OBSERVATION_LIMITS.intervalMs);
  }
  async function inventory(paths = null) {
    requestController = new AbortController();
    const timeout = setTimeout(() => requestController?.abort(), 60000);
    try {
      return await readInventory(root, paths, requestController.signal);
    } finally {
      clearTimeout(timeout);
      requestController = null;
    }
  }
  function releaseObservation() {
    clearTimeout(timer);
    timer = null;
    observer?.disconnect();
    observer = null;
    if (scratch) {
      scratch.width = 0;
      scratch.height = 0;
      scratch = null;
      scratchContext = null;
    }
  }
  async function start() {
    if (disposed || recovering || clearing || running || preparing || finishing) return;
    const current = state();
    if (!current.available || current.bootState !== 'ready' || !current.demoOpen) {
      status('Open Watch demo in the game below before starting observation.');
      return;
    }
    preparing = true;
    preparationCancelled = false;
    $('observation-start').disabled = true;
    $('observation-stop').disabled = false;
    $('observation-download').disabled = true;
    $('observation-duration').disabled = true;
    $('observation-report').value = '';
    $('observation-clear-saved').disabled = true;
    checkpointText = '';
    finalText = '';
    lastCheckpointMs = -Infinity;
    report = null;
    log = null;
    phaseKey = '';
    frameLoads = 0;
    observerHealth = { attached: false, targets: 0, failures: 0, error: null };
    status('Hashing served sources. The observation clock has not started.');
    try {
      const initialInventory = await inventory();
      if (preparationCancelled || disposed)
        throw new DOMException('Observation preparation cancelled.', 'AbortError');
      const initialStorage = await readStorage(frame.contentWindow);
      if (preparationCancelled || disposed)
        throw new DOMException('Observation preparation cancelled.', 'AbortError');
      durationSeconds = Number($('observation-duration').value);
      startMs = performance.now();
      const calendar = calendarNow();
      log = createObservationLog(startMs, calendar);
      report = {
        format: REPORT_FORMAT,
        startedAt: new Date(calendar).toISOString(),
        intendedDurationSeconds: durationSeconds,
        mode: durationSeconds < 7200 ? 'short-smoke-not-qualification' : 'two-hour-observation',
        gameURL: childURL.href,
        userAgent: navigator.userAgent,
        language: navigator.language,
        limits: OBSERVATION_LIMITS,
        initialInventory,
        initialStorage,
        serviceWorkerControlled: !!frame.contentWindow.navigator.serviceWorker?.controller,
        evidenceScope:
          'Read-only DOM, visible canvas checksums, sampled timing and optional reported memory in the actual same-origin iframe. Served hashes are an inventory, not proof every module executed or a reconstruction of cached loaded bytes.',
        limitations: [
          'No synthetic gameplay or direct internal playback access.',
          'DOM music state is not proof of physical audio output.',
          'Bounded error listeners preserve ordinary browser reporting; opaque, worker or earlier errors may not be observable.',
          'Long gaps and clock discontinuities are unobserved, not proof of OS freeze/recovery or continued playback.',
          'A completed duration does not certify physical inputs, native devices, human comprehension, absence of leaks or release acceptance.',
          'The embedded frame has its measured viewport; it is not top-level or fullscreen qualification.',
        ],
      };
      preparing = false;
      running = true;
      attachChild();
      sample();
      timer = setTimeout(wake, OBSERVATION_LIMITS.intervalMs);
    } catch (error) {
      preparing = false;
      releaseObservation();
      if (disposed) return;
      $('observation-clear-saved').disabled = false;
      status(`Observation did not start: ${boundedText(error.message)}`);
      $('observation-start').disabled = false;
      $('observation-stop').disabled = true;
      $('observation-duration').disabled = false;
    }
  }
  async function stop(reason = 'manual-stop') {
    if (preparing) {
      preparationCancelled = true;
      requestController?.abort();
      status('Cancelling observation preparation…');
      return;
    }
    if (disposed || !running || finishing) return;
    sample();
    publishCheckpoint('finalizing', true);
    running = false;
    finishing = true;
    releaseObservation();
    $('observation-stop').disabled = true;
    report.finishedAt = new Date(calendarNow()).toISOString();
    report.stopReason = reason;
    report.timing = {
      ...log.totals,
      calendarElapsedSeconds: (Date.parse(report.finishedAt) - Date.parse(report.startedAt)) / 1000,
    };
    report.samples = log.samples;
    report.events = log.events;
    report.childNavigationsDuringObservation = frameLoads;
    status('Observation stopped. Comparing final served source and storage hashes…');
    report.finalStorage = await readStorage(frame.contentWindow);
    if (disposed) return;
    report.storageChanges =
      report.initialStorage.available && report.finalStorage.available
        ? compareHashes(report.initialStorage.entries, report.finalStorage.entries, 'keyHash')
        : null;
    try {
      report.finalInventory = await inventory(
        report.initialInventory.files.map((file) => file.path),
      );
      if (disposed) return;
      report.sourceChanges = compareHashes(
        report.initialInventory.files,
        report.finalInventory.files,
      );
      report.sourceInventoryStable = Object.values(report.sourceChanges).every(
        (values) => values.length === 0,
      );
    } catch (error) {
      if (disposed) return;
      report.sourceInventoryStable = false;
      report.finalInventoryError = boundedText(error.message);
    }
    report.observerHealth = { ...observerHealth };
    report.diagnostics = [...diagnostics];
    report.droppedDiagnostics = droppedDiagnostics;
    report.observerComplete = observerHealth.failures === 0;
    report.observationValidForPinnedSources =
      report.sourceInventoryStable && frameLoads === 0 && report.observerComplete;
    report.requestedDurationReached = report.timing.elapsedSeconds >= durationSeconds;
    report.releaseQualified = false;
    report.status = 'finalized';
    report.terminalChecks = {
      sourceInventory: report.finalInventory
        ? report.sourceInventoryStable
          ? 'complete'
          : 'changed'
        : 'failed',
      storage:
        report.initialStorage.available && report.finalStorage.available
          ? 'complete'
          : 'unavailable',
    };
    report.observationComplete =
      report.requestedDurationReached &&
      report.observationValidForPinnedSources &&
      report.terminalChecks.storage === 'complete';
    try {
      finalText = serialize(report);
      $('observation-report').value = finalText;
      await queueSave('final', finalText);
    } catch (error) {
      storageFailure(error);
    }
    if (disposed) return;
    $('observation-clear-saved').disabled = false;
    $('observation-download').disabled = false;
    $('observation-start').disabled = false;
    $('observation-duration').disabled = false;
    finishing = false;
    status(
      `${report.mode}: ${report.timing.elapsedSeconds.toFixed(1)} elapsed seconds, ${report.samples.length} samples.\nServed source inventory ${report.sourceInventoryStable ? 'unchanged' : 'CHANGED OR UNVERIFIED — invalid'}; game navigations ${frameLoads}; DOM observer failures ${observerHealth.failures}; JS diagnostics ${diagnostics.length}.\nLong unobserved gaps: ${report.timing.unobservedLongGapSeconds.toFixed(1)}s. Download the JSON; release acceptance remains separate.`,
    );
  }
  listen($('observation-start'), 'click', () => void start());
  listen($('observation-stop'), 'click', () => void stop());
  listen($('observation-download'), 'click', () => {
    if (running) {
      sample();
      publishCheckpoint('manual-export', true);
    }
    download(finalText || checkpointText);
  });
  listen($('observation-recovered-kind'), 'change', showRecovered);
  listen($('observation-recovered-download'), 'click', () => download(recoveryText));
  listen($('observation-clear-saved'), 'click', () => void clearSaved());
  async function clearSaved() {
    if (disposed || recovering || clearing || running || preparing || finishing) return;
    clearing = true;
    $('observation-start').disabled = true;
    $('observation-clear-saved').disabled = true;
    try {
      await saving;
      await store.clear();
      if (disposed) return;
      recovered = null;
      storedFinal = null;
      showRecovered();
      persistenceFailed = false;
      persistenceStatus(
        'Cleared only the two saved observer reports. Game saves/profiles and the current in-memory export were untouched.',
      );
    } catch (error) {
      if (!disposed) storageFailure(error);
    } finally {
      clearing = false;
      if (!disposed) {
        $('observation-clear-saved').disabled = false;
        $('observation-start').disabled = false;
      }
    }
  }
  listen(frame, 'load', () => {
    if (running) {
      frameLoads++;
      log.event('child-load', performance.now());
    }
    attachChild();
  });
  for (const event of ['visibilitychange', 'freeze', 'resume'])
    listen(document, event, () => {
      if (running) {
        log.event(event, performance.now(), { visibility: document.visibilityState });
        sample();
        publishCheckpoint(event, true);
      }
    });
  for (const event of ['focus', 'blur'])
    listen(window, event, () => {
      if (running) log.event(event, performance.now(), { visibility: document.visibilityState });
    });
  function dispose() {
    if (disposed) return saving ?? Promise.resolve();
    if (running) {
      sample();
      log.event('observer-pagehide', performance.now());
      publishCheckpoint('pagehide-best-effort', true);
    }
    disposed = true;
    running = false;
    preparing = false;
    preparationCancelled = true;
    requestController?.abort();
    releaseObservation();
    removeChildDiagnostics();
    for (const remove of cleanupListeners) remove();
    $('observation-start').disabled = true;
    $('observation-stop').disabled = true;
    status(
      'Observer stopped. Reload to recover its latest saved checkpoint; a pagehide write is best effort only.',
    );
    return (saving ?? Promise.resolve()).finally(() => store.close());
  }
  listen(window, 'pagehide', () => void dispose());
  attachChild();
  return { ready, dispose, flush: () => saving ?? Promise.resolve() };
}

if (globalThis.document?.documentElement?.hasAttribute('data-demo-watch-observer')) mountObserver();
