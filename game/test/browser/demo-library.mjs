import {
  createDemoLibrary,
  createDemoIndexedDBStorage,
  demoRecordingQuality,
  DEMO_LIBRARY_LIMITS,
} from '../../demo-library.mjs';
import {
  loadDemoCatalog,
  resolveDemoCatalog,
  loadDemoRecording,
  demoDescriptor,
} from '../../demo-catalog.mjs';
import {
  createRecorder,
  recordInput,
  recordRelease,
  exportReplay,
  verifyReplayAsync,
} from '../../replay.mjs';
import { createRun, stepRun, releaseInputs, FIXED_DT } from '../../core/index.mjs';

const { document, location, history, indexedDB, Option, window } = globalThis;
const PREFIX = 'revealline-demo-qualification-';
const OWNED_NAME = /^revealline-demo-qualification-[a-f0-9]{32}$/;
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const checkAbort = (signal) => signal?.throwIfAborted();
const yieldTask = () => new Promise((resolve) => setTimeout(resolve, 0));
const jsonEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sha256 = async (data) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
const digestDocument = (value) => sha256(new TextEncoder().encode(JSON.stringify(value)));

/** The same legal input trace on the same installed map, with a different seed.
 * No level, checkpoint or terminal-state mutation and no authored-outcome rewrite. */
export async function recordSeededTrace(source, seed, { signal } = {}) {
  const options = { ...source.options, seed };
  const run = createRun(source.level, options);
  const recorder = createRecorder(source.level, options, 'browser-demo-library-qualification');
  for (const segment of source.segments) {
    if (segment.releaseBefore) {
      releaseInputs(run);
      recordRelease(recorder);
    }
    for (let tick = 0; tick < segment.ticks; tick++) {
      checkAbort(signal);
      if (['won', 'lost'].includes(run.status)) break;
      stepRun(run, segment.input, FIXED_DT);
      recordInput(recorder, segment.input);
      if (run.tick % 600 === 0) await yieldTask();
    }
    if (['won', 'lost'].includes(run.status)) break;
  }
  if (source.releaseAfter) {
    releaseInputs(run);
    recordRelease(recorder);
  }
  return exportReplay(recorder, run);
}

function nativeConnection(name) {
  assert(OWNED_NAME.test(name), 'Refusing an unowned database name.');
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Test database open is blocked.'));
    request.onsuccess = () => resolve(request.result);
  });
}

async function queuedAbort(storage, name, signal) {
  const before = await storage.read({ signal });
  const database = await nativeConnection(name);
  let holding = true;
  const transaction = database.transaction('library', 'readwrite');
  const store = transaction.objectStore('library');
  const held = new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onabort = transaction.onerror = () => reject(transaction.error);
  });
  const keepAlive = () => {
    const request = store.get('current');
    request.onsuccess = () => {
      if (holding) keepAlive();
    };
  };
  keepAlive();
  const controller = new AbortController();
  let transformed = false;
  const operation = storage
    .update(
      () => {
        transformed = true;
        return { ...before, items: [] };
      },
      { signal: controller.signal },
    )
    .then(
      () => ({ saved: true }),
      (error) => ({ error }),
    );
  try {
    await yieldTask();
    controller.abort();
    holding = false;
    await held;
    const outcome = await operation;
    assert(outcome.error?.name === 'AbortError', 'Queued write did not reject with AbortError.');
    assert(!transformed, 'Cancelled queued write unexpectedly ran its transform.');
    assert(
      jsonEqual(await storage.read({ signal }), before),
      'Aborted write changed stored bytes.',
    );
    return {
      boundary: 'Native readwrite transaction queued behind another connection',
      unchanged: true,
    };
  } finally {
    holding = false;
    database.close();
  }
}

async function main() {
  const $ = (id) => document.getElementById(id);
  const address = new URL(location.href);
  const existing = address.searchParams.get('db');
  const name = existing ?? PREFIX + crypto.randomUUID().replaceAll('-', '');
  assert(OWNED_NAME.test(name), 'Invalid test database name in URL.');
  address.searchParams.set('db', name);
  history.replaceState(null, '', address);
  $('database').textContent = name;
  const browser = {
    userAgent: navigator.userAgent,
    brands: navigator.userAgentData?.brands ?? null,
    platform: navigator.userAgentData?.platform ?? navigator.platform,
    vendor: navigator.vendor,
    navigationType: performance.getEntriesByType('navigation')[0]?.type ?? 'unknown',
  };
  $('environment').textContent = `${browser.userAgent} · navigation: ${browser.navigationType}`;
  let report = null;
  let busy = false;
  let active = null;
  const owners = new Set();
  const sources = new Map();
  const roots = [
    new URL('./demo-library.mjs', import.meta.url),
    new URL('../../demo-library.mjs', import.meta.url),
    new URL('../../demo-catalog.mjs', import.meta.url),
    new URL('../../replay.mjs', import.meta.url),
    new URL('../../core/index.mjs', import.meta.url),
  ];
  const fetchSource = async (url, options = {}) => {
    const target = new URL(url, import.meta.url);
    assert(target.origin === location.origin, 'Qualification only fetches same-origin sources.');
    const response = await fetch(target, { ...options, cache: 'no-store' });
    assert(response.ok, `Could not load ${target.pathname}: ${response.status}`);
    const bytes = await response.clone().arrayBuffer();
    sources.set(target.href, {
      url: target.href,
      bytes: bytes.byteLength,
      sha256: await sha256(bytes),
    });
    return response;
  };
  // Record the served local static-import graph used by this harness. No build
  // revision is inferred from the current Git checkout or a stale build stamp.
  const seen = new Set();
  async function hashModule(url) {
    if (seen.has(url.href)) return;
    seen.add(url.href);
    const source = await (await fetchSource(url)).text();
    const expressions = /\b(?:import|export)\s+(?:[^;]*?\sfrom\s*)?['"](\.{1,2}\/[^'"]+)['"]/g;
    for (const match of source.matchAll(expressions)) {
      const child = new URL(match[1], url);
      if (child.pathname.endsWith('.mjs')) await hashModule(child);
    }
  }
  const [campaign, classRecipes] = await Promise.all(
    ['campaign', 'classes'].map(async (id) =>
      (await fetchSource(new URL(`../../content/${id}.json`, import.meta.url))).json(),
    ),
  );
  campaign.classRecipes = classRecipes;
  const entry = { campaign, classRecipes };
  const catalog = await loadDemoCatalog({ fetch: fetchSource });
  const clips = resolveDemoCatalog(catalog, [entry]);
  assert(clips.length > 0, 'No bundled recordings match the actual installed campaign.');
  $('clip').replaceChildren(
    ...clips.map((clip) => new Option(`${clip.title} — ${clip.id}`, clip.id)),
  );
  const selected = address.searchParams.get('clip');
  if (clips.some((clip) => clip.id === selected)) $('clip').value = selected;
  for (const root of roots) await hashModule(root);
  const closeAll = () => {
    for (const { library } of owners) library.dispose();
    owners.clear();
  };
  const openOwner = () => {
    const storage = createDemoIndexedDBStorage({ indexedDB, name });
    const owner = { storage, library: createDemoLibrary({ storage }) };
    owners.add(owner);
    return owner;
  };
  const closeOwner = (owner) => {
    owner.library.dispose();
    owners.delete(owner);
  };
  const show = () => {
    $('output').textContent = report ? JSON.stringify(report, null, 2) : 'No checks have run.';
    $('download').disabled = !report;
  };
  const controls = (value) => {
    busy = value;
    for (const id of ['run', 'reopen', 'reload', 'cleanup', 'clip']) $(id).disabled = value;
  };
  async function runOperation(kind, work) {
    if (busy) return;
    controls(true);
    active = new AbortController();
    report = {
      format: 'revealline-demo-library-browser-qualification.v1',
      kind,
      startedAt: new Date().toISOString(),
      browser,
      url: location.href,
      database: name,
      boundary: 'Production library + native IndexedDB; not ordinary win/Keep UI integration',
      concurrency: 'Two native connections in this page, not separate browser tabs/processes',
      ordinaryStorage: 'No ordinary game database or localStorage API is opened by the harness',
      checks: [],
      pass: false,
    };
    const started = performance.now();
    const check = async (label, operation) => {
      checkAbort(active.signal);
      $('status').textContent = label;
      const beginning = performance.now();
      try {
        const details = await operation();
        report.checks.push({
          label,
          pass: true,
          durationMs: performance.now() - beginning,
          details,
        });
      } catch (error) {
        report.checks.push({
          label,
          pass: false,
          durationMs: performance.now() - beginning,
          error: String(error.stack ?? error),
        });
        throw error;
      } finally {
        show();
      }
    };
    try {
      await work(check, active.signal);
      report.pass = true;
      $('status').textContent = 'PASS. Review the boundaries in the JSON report.';
    } catch (error) {
      report.error = String(error.stack ?? error);
      $('status').textContent = `FAILED: ${error.message}`;
    } finally {
      report.finishedAt = new Date().toISOString();
      report.durationMs = performance.now() - started;
      report.sources = [...sources.values()].sort((a, b) => a.url.localeCompare(b.url));
      closeAll();
      active = null;
      controls(false);
      show();
    }
  }
  async function verifiedClip(signal) {
    const clip = clips.find((candidate) => candidate.id === $('clip').value);
    for (const replayURL of [clip.replayURL, ...(clip.replayVariants ?? [])]) {
      const replay = await loadDemoRecording(
        { ...clip, replayURL },
        { fetch: fetchSource, signal },
      );
      const verification = await verifyReplayAsync(replay, { signal });
      if (verification.match) {
        assert(demoRecordingQuality(replay).eligible, 'Bundled replay is not eligible.');
        report.recording = {
          id: clip.id,
          replayURL,
          checkpoint: replay.checkpoint.hash,
          campaignId: campaign.id,
          levelId: replay.level.id,
          seed: replay.options.seed,
        };
        return replay;
      }
    }
    throw new Error('No shipped runtime variant strictly verifies in this browser.');
  }
  async function generatedFixtures(replay, signal) {
    const result = [];
    const ids = new Set([demoDescriptor(replay, entry).id]);
    for (let offset = 1; offset <= 192 && result.length < 13; offset++) {
      $('status').textContent =
        `Recording legal seeded fixtures: ${result.length}/13 (seed attempt ${offset})…`;
      const candidate = await recordSeededTrace(replay, (replay.options.seed + offset) >>> 0, {
        signal,
      });
      if (!demoRecordingQuality(candidate).eligible) continue;
      const id = demoDescriptor(candidate, entry).id;
      if (ids.has(id)) continue;
      assert(
        (await verifyReplayAsync(candidate, { signal })).match,
        'Generated replay did not verify.',
      );
      ids.add(id);
      result.push(candidate);
    }
    assert(
      result.length === 13,
      `Only ${result.length}/13 distinct eligible seeded recordings; try another clip.`,
    );
    report.generated = result.map((recording) => ({
      seed: recording.options.seed,
      checkpoint: recording.checkpoint.hash,
      id: demoDescriptor(recording, entry).id,
    }));
    return result;
  }
  $('run').onclick = () =>
    runOperation('checks', async (check, signal) => {
      const replay = await verifiedClip(signal);
      const fixtures = await generatedFixtures(replay, signal);
      let owner = openOwner();
      const keep = (recording, manual = false, library = owner.library) =>
        library.keep(recording, { entry, practice: false, manual, signal });
      await check('Manual Keep is independent of automatic opt-in', async () => {
        await owner.library.clear({ signal });
        const before = await owner.storage.read({ signal });
        assert(
          (await keep(replay)).reason === 'disabled',
          'Automatic collection was enabled by default.',
        );
        assert(
          jsonEqual(before, await owner.storage.read({ signal })),
          'Disabled automatic collection wrote data.',
        );
        assert((await keep(replay, true)).saved, 'Manual Keep failed.');
        assert(!owner.library.enabled, 'Manual Keep enabled automatic collection.');
        assert(
          (await owner.library.list([entry], { signal })).length === 1,
          'Manual Keep was not listed.',
        );
      });
      await check('Close/reopen preserves exact native IndexedDB document bytes', async () => {
        const before = await owner.storage.read({ signal });
        closeOwner(owner);
        owner = openOwner();
        assert(
          jsonEqual(await owner.storage.read({ signal }), before),
          'Reopen changed stored document.',
        );
        assert(!owner.library.enabled, 'New library owner inherited an unsupported preference.');
      });
      await check(
        'Explicit opt-in permits automatic collection; opt-out preserves existing recordings',
        async () => {
          owner.library.setEnabled(true);
          assert((await keep(fixtures[0])).saved, 'Opted-in automatic collection failed.');
          owner.library.setEnabled(false);
          const before = await owner.storage.read({ signal });
          assert((await keep(fixtures[1])).reason === 'disabled', 'Opt-out failed.');
          assert(
            jsonEqual(await owner.storage.read({ signal }), before),
            'Opt-out erased or rewrote recordings.',
          );
        },
      );
      await check('Concurrent native writers preserve both verified recordings', async () => {
        await owner.library.clear({ signal });
        const other = openOwner();
        try {
          const results = await Promise.all([
            keep(fixtures[0], true),
            keep(fixtures[1], true, other.library),
          ]);
          assert(
            results.every((result) => result.saved),
            'A concurrent Keep failed.',
          );
          const ids = (await owner.library.list([entry], { signal })).map((item) => item.id).sort();
          assert(
            jsonEqual(
              ids,
              fixtures
                .slice(0, 2)
                .map((item) => demoDescriptor(item, entry).id)
                .sort(),
            ),
            'Concurrent write lost or replaced an unrelated recording.',
          );
          return { connections: 2, retained: ids };
        } finally {
          closeOwner(other);
        }
      });
      await check('Aborting a queued native write retains exact prior bytes', () =>
        queuedAbort(owner.storage, name, signal),
      );
      await check('Thirteen distinct verified wins retain the newest twelve', async () => {
        await owner.library.clear({ signal });
        for (const recording of fixtures)
          assert((await keep(recording, true)).saved, 'Eviction fixture Keep failed.');
        const ids = (await owner.library.list([entry], { signal })).map((item) => item.id);
        const expected = fixtures
          .slice(1)
          .reverse()
          .map((item) => demoDescriptor(item, entry).id);
        assert(
          ids.length === DEMO_LIBRARY_LIMITS.recordings && jsonEqual(ids, expected),
          'Capacity eviction lost ordering or retained the oldest record.',
        );
        return { capacity: DEMO_LIBRARY_LIMITS.recordings, saved: fixtures.length, retained: ids };
      });
      await check('Clear persists across a new connection', async () => {
        await owner.library.clear({ signal });
        closeOwner(owner);
        owner = openOwner();
        assert(
          (await owner.library.list([entry], { signal })).length === 0,
          'Clear did not persist.',
        );
      });
      await check('Leave one manual recording for the explicit page-reload check', async () => {
        assert((await keep(replay, true)).saved, 'Could not keep the reload witness.');
        const expected = await digestDocument(await owner.storage.read({ signal }));
        const url = new URL(location.href);
        url.searchParams.set('expected', expected);
        url.searchParams.set('clip', $('clip').value);
        history.replaceState(null, '', url);
        report.reloadWitness = {
          expectedDocumentSha256: expected,
          checkpoint: replay.checkpoint.hash,
          url: url.href,
          next: 'Reload page, then Verify persisted recording',
        };
      });
    });
  $('reopen').onclick = () =>
    runOperation('persisted-reopen', async (check, signal) => {
      await check('Verify retained bytes and strict replay after navigation/reload', async () => {
        const expected = new URL(location.href).searchParams.get('expected');
        assert(
          /^[a-f0-9]{64}$/.test(expected ?? ''),
          'Run checks first to establish an expected reload witness.',
        );
        const owner = openOwner();
        const actual = await digestDocument(await owner.storage.read({ signal }));
        assert(actual === expected, 'Persisted document differs from the pre-reload byte digest.');
        const records = await owner.library.list([entry], { signal });
        assert(records.length === 1, 'Expected exactly one compatible recording after reload.');
        assert(
          (await verifyReplayAsync(records[0].replay, { signal })).match,
          'Persisted replay no longer verifies.',
        );
        return {
          documentSha256: actual,
          checkpoint: records[0].replay.checkpoint.hash,
          navigationType: browser.navigationType,
          witnessedPageReload: browser.navigationType === 'reload',
        };
      });
    });
  $('reload').onclick = () => location.reload();
  $('cleanup').onclick = () =>
    runOperation('explicit-cleanup', async (check) => {
      await check('Delete only this test-owned database', async () => {
        closeAll();
        assert(OWNED_NAME.test(name), 'Refusing an unowned database.');
        await new Promise((resolve, reject) => {
          const request = indexedDB.deleteDatabase(name);
          request.onsuccess = resolve;
          request.onerror = () => reject(request.error);
          request.onblocked = () =>
            reject(new Error('Close other tabs using this exact test database before deleting.'));
        });
        const url = new URL(location.href);
        url.searchParams.delete('expected');
        history.replaceState(null, '', url);
        return { deleted: name };
      });
    });
  $('download').onclick = () => {
    if (!report) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `demo-library-${report.kind}-${Date.now()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  window.addEventListener('pagehide', () => {
    active?.abort();
    closeAll();
  });
  controls(false);
  $('status').textContent = 'Ready. Run checks creates data only in the named test database.';
}

if (globalThis.document?.querySelector('[data-demo-library-qualification]'))
  void main().catch((error) => {
    document.getElementById('status').textContent =
      `Could not initialize qualification: ${error.message}`;
    document.getElementById('output').textContent = String(error.stack ?? error);
  });
