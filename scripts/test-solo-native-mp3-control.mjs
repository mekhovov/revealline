import assert from 'node:assert/strict';
import test from 'node:test';
import { parse } from 'acorn';
import { createHash, webcrypto } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import {
  MP3_CONTROL as plan,
  MP3_BACKEND_CONTROL as backendPlan,
  MP3_COCOA_CONTROL as cocoaPlan,
  nativeCocoaEnvironment,
  nativeOwnerPreflightComplete,
  retainCocoaPreparationProvenance,
  attachRequestReceipts,
  backendLogObservation,
  createNativeControlRoot,
  installNativeMP3Control,
  nativeControlComplete,
  nativeBackendEnvironment,
  observeNativeArm,
  playbackObservation,
} from './solo-native-mp3-control.mjs';
import { AUDIO_RECORDINGS, speechFixtureProvenance } from './prepare-solo-audio-fixtures.mjs';
import { startProductionPreview } from './serve-production-preview.mjs';

const tagged = (value) => ({ kind: 'finite', value });
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const normalize = (value) => JSON.parse(JSON.stringify(value));

function nativePage({
  transport = 'blob',
  playback = 'pending',
  badHash = false,
  type = 'audio/mpeg',
  ranges = 0,
  captureMode = null,
  eventCapacityMode = null,
} = {}) {
  const bytes = Buffer.from('exact test bytes'),
    calls = [],
    listeners = new Map();
  let clock = 0,
    callback,
    click;
  const media = {
    canPlayType: () => 'probably',
    duration: NaN,
    currentTime: 0,
    readyState: 0,
    networkState: 3,
    error: null,
    paused: true,
    ended: false,
    seeking: false,
    playbackRate: 1,
    muted: false,
    volume: 1,
    currentSrc: '',
    buffered: { length: ranges, start: (i) => i, end: (i) => i + 0.5 },
    seekable: { length: 0 },
    played: { length: 0 },
    addEventListener(name, fn) {
      listeners.set(name, fn);
    },
    load() {
      calls.push('load');
      if (!this.src) {
        this.duration = NaN;
        this.readyState = 0;
        this.currentSrc = '';
      }
    },
    pause() {
      calls.push('pause');
      this.paused = true;
    },
    removeAttribute(name) {
      assert.equal(name, 'src');
      calls.push('remove-src');
      this.src = '';
    },
    play() {
      calls.push('play');
      if (playback === 'throws')
        throw Object.assign(Error('native throw'), { name: 'NotSupportedError' });
      if (playback === 'rejects')
        return Promise.reject(
          Object.assign(Error('native rejection'), { name: 'NotAllowedError' }),
        );
      if (playback === 'fulfills') return Promise.resolve();
      return new Promise(() => {});
    },
  };
  const url = class extends URL {};
  url.createObjectURL = (blob) => {
    calls.push(['blob', blob.type, blob.size]);
    return 'blob:owned-control';
  };
  url.revokeObjectURL = (value) => calls.push(['revoke', value]);
  const button = {
    disabled: true,
    addEventListener(name, fn) {
      assert.equal(name, 'click');
      click = fn;
    },
  };
  const sandbox = {
    URL: url,
    Blob,
    crypto: webcrypto,
    AbortSignal,
    navigator: { userActivation: { isActive: true } },
    performance: { now: () => clock },
    setInterval(fn, ms) {
      assert.equal(ms, plan.sampleMs);
      callback = fn;
      return 7;
    },
    clearInterval(id) {
      assert.equal(id, 7);
      callback = null;
      calls.push('clear-timer');
    },
    location: { href: 'http://127.0.0.1:1234/index.html', origin: 'http://127.0.0.1:1234' },
    document: {
      querySelector: () => button,
      createElement: (name) => {
        assert.equal(name, 'audio');
        return media;
      },
      body: { append: (value) => assert.equal(value, media) },
    },
    fetch: async () => ({
      ok: true,
      headers: new Map([
        ['content-type', type],
        ['content-length', String(bytes.length)],
      ]),
      arrayBuffer: async () =>
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
    }),
  };
  runInNewContext(
    `(${installNativeMP3Control.toString()})(${JSON.stringify(captureMode)},${JSON.stringify(eventCapacityMode)});`,
    sandbox,
  );
  return {
    api: sandbox.nativeMP3Control,
    media,
    calls,
    button,
    pin: {
      id: 'test',
      file: 'recording.mp3',
      transport,
      bytes: bytes.length,
      sha256: badHash ? '0'.repeat(64) : hash(bytes),
    },
    event(name) {
      listeners.get(name)?.();
    },
    click: () => click({ isTrusted: true }),
    sample(atMs) {
      clock = atMs;
      callback?.();
    },
    advance(atMs) {
      clock = atMs;
    },
  };
}

test('native controls preserve finite zero, passive lifetime, original byte identity and pending play', async () => {
  const host = nativePage();
  await host.api.prepare(host.pin);
  assert.equal(host.media.preload, 'auto');
  assert.equal(host.media.src, 'blob:owned-control');
  assert.deepEqual(host.calls, [['blob', 'audio/mpeg', 16], 'load']);
  host.media.currentSrc = host.media.src;
  host.media.duration = 0;
  host.media.readyState = 4;
  host.event('durationchange');
  host.event('loadedmetadata');
  host.advance(plan.passiveMs);
  host.api.passiveBoundary();
  assert.equal(host.calls.filter((call) => call === 'load').length, 1);
  host.click();
  host.advance(plan.passiveMs + plan.playbackMs);
  const data = normalize(host.api.cleanup());
  assert.deepEqual(data.passiveBoundary.duration, tagged(0));
  assert.deepEqual(data.preCleanup.duration, tagged(0));
  assert.equal(data.playResult.status, 'pending');
  assert.equal(data.records.at(-1).duration.kind, 'NaN');
  assert.equal(data.identity.verifiedSha256, host.pin.sha256);
  assert.equal(data.identity.verifiedBytes, host.pin.bytes);
  assert.deepEqual(host.calls.slice(-5), [
    'clear-timer',
    'pause',
    'remove-src',
    'load',
    ['revoke', 'blob:owned-control'],
  ]);
  assert.equal(playbackObservation(data).nativePositiveDurationObserved, false);
  assert.equal(playbackObservation(data).qualificationEligible, false);
});

test('HTTP uses the same verified bytes and no Blob URL; native play outcomes remain original', async () => {
  for (const [playback, expected] of [
    ['fulfills', 'fulfilled'],
    ['rejects', 'rejected'],
    ['throws', 'threw'],
  ]) {
    const host = nativePage({ transport: 'http', playback });
    await host.api.prepare(host.pin);
    assert.equal(host.media.src, 'http://127.0.0.1:1234/recording.mp3');
    host.click();
    await Promise.resolve();
    const data = normalize(host.api.cleanup());
    assert.equal(data.playResult.status, expected);
    assert.equal(data.gesture.isTrusted, true);
    assert.equal(
      host.calls.some((call) => Array.isArray(call)),
      false,
    );
    if (expected === 'rejected') assert.equal(data.playResult.name, 'NotAllowedError');
    if (expected === 'threw') assert.equal(data.playResult.name, 'NotSupportedError');
  }
});

test('byte, MIME and origin mismatch rejects before creating native media', async () => {
  for (const options of [{ badHash: true }, { type: 'application/octet-stream' }]) {
    const host = nativePage(options);
    await assert.rejects(host.api.prepare(host.pin), /differ/);
    assert.equal(host.calls.length, 0);
  }
  const host = nativePage();
  await assert.rejects(
    host.api.prepare({ ...host.pin, file: 'https://unowned.example/a.mp3' }),
    /owned loopback/,
  );
  assert.equal(host.calls.length, 0);
});

test('records/ranges remain bounded with explicit saturation and timeupdate counts', async () => {
  const host = nativePage({ ranges: 9 });
  await host.api.prepare(host.pin);
  for (let i = 0; i < 80; i++) {
    host.sample(i * 500);
    host.event('timeupdate');
  }
  const data = normalize(host.api.cleanup());
  assert.equal(data.records.length, plan.maximumRecords);
  assert(data.droppedRecords > 0 && data.droppedRanges > 0);
  assert(data.records.every((row) => row.buffered.length <= plan.maximumRanges));
  assert.equal(data.eventCounts.timeupdate, 80);
});

test('explicit backend capture preserves samples through the observed native duration burst', async () => {
  const host = nativePage({ captureMode: backendPlan.captureMode, playback: 'fulfills' });
  await host.api.prepare(host.pin);
  host.media.currentSrc = host.media.src;
  host.media.duration = 0;
  host.event('loadedmetadata');
  for (let i = 1; i <= 10; i++) host.sample(i * 500);
  host.api.passiveBoundary();
  host.click();
  await Promise.resolve();
  for (let i = 0; i < 42; i++) host.event('durationchange');
  for (let i = 1; i <= 20; i++) {
    host.media.currentTime = i * 0.5;
    host.sample(5000 + i * 500);
  }
  const data = normalize(host.api.cleanup());
  assert.equal(data.samples.length, 30);
  assert.equal(data.droppedSamples, 0);
  assert.equal(data.droppedRecords, 0);
  assert.equal(data.records.filter((row) => row.kind === 'sample').length, 0);
  assert.equal(data.records.at(-1).kind, 'cleanup-after');
  assert.equal(data.preCleanup.currentTime.value, 10);
  assert.equal(playbackObservation(data).nativeProgressObserved, true);
  assert.equal(playbackObservation(data).nativeDurationMatchesFrames, false);
  assert.deepEqual(data.preCleanup.duration, tagged(0));
});

test('backend sample and event limits are independent and each saturation remains explicit', async () => {
  for (const saturated of ['samples', 'events']) {
    const host = nativePage({ captureMode: backendPlan.captureMode });
    await host.api.prepare(host.pin);
    for (let i = 0; i < 80; i++) {
      if (saturated === 'samples') host.sample(i * 500);
      else host.event('durationchange');
    }
    if (saturated === 'samples') host.event('loadedmetadata');
    else host.sample(500);
    const data = normalize(host.api.cleanup());
    assert.equal(data.samples.length, saturated === 'samples' ? 32 : 1);
    assert.equal(data.droppedSamples > 0, saturated === 'samples');
    assert.equal(data.droppedRecords > 0, saturated === 'events');
    assert.equal(data.records.length <= 64, true);
    assert.equal(Boolean(data.preCleanup), true);
  }
  assert.throws(() => nativePage({ captureMode: 'invented' }), /Unknown native/);
});

test('backend observations keep seeks ordered across independent samples and native events', () => {
  const sample = (atMs, time) => ({
    kind: 'sample',
    phase: 'playback',
    atMs,
    currentTime: tagged(time),
    playbackRate: 1,
    sourceMatches: true,
  });
  const data = {
    captureMode: backendPlan.captureMode,
    records: [{ kind: 'seeking', atMs: 750 }],
    samples: [sample(0, 0), sample(500, 0.5), sample(1000, 10), sample(1500, 10.5)],
    gesture: { isTrusted: true },
    playResult: { status: 'fulfilled' },
  };
  assert.equal(playbackObservation(data).nativeProgressObserved, false);
  assert.equal(playbackObservation({ ...data, records: [] }).discontinuities, 1);
});

test('bounded backend log identity distinguishes actual category lines from a launch declaration', () => {
  const bytes = Buffer.from(
    'pw:browser GST_DEBUG=2,webkitmediaplayer:6\n' +
      '[pid=12][err] 0:00:01 LOG webkitmediaplayer MediaPlayerPrivateGStreamer.cpp:1294: Duration query: 0\n',
  );
  const result = backendLogObservation(bytes);
  assert.equal(result.bytes, bytes.length);
  assert.equal(result.sha256, hash(bytes));
  assert.equal(result.categoryLines, 1);
  assert.equal(result.durationQueryLines, 1);
  assert.equal(result.status, 'observed-category');
  assert.equal(
    backendLogObservation(Buffer.from('GST_DEBUG=2,webkitmediaplayer:6')).status,
    'unavailable-category',
  );
  assert.throws(() => backendLogObservation(Buffer.alloc(backendPlan.maximumLogBytes + 1)), /cap/);
});

test('backend logging keeps one bounded destination without mutating the inherited environment', () => {
  const source = {
    PATH: '/original',
    GST_DEBUG: '9',
    GST_DEBUG_FILE: '/unowned',
    GST_DEBUG_DUMP_DOT_DIR: '/unowned-graphs',
    DEBUG: '*',
  };
  const result = nativeBackendEnvironment(source);
  assert.equal(result.PATH, source.PATH);
  assert.equal(result.GST_DEBUG_FILE, undefined);
  assert.equal(result.GST_DEBUG_DUMP_DOT_DIR, undefined);
  for (const [key, value] of Object.entries(backendPlan.backendEnvironment))
    assert.equal(result[key], value);
  assert.equal(source.GST_DEBUG_FILE, '/unowned');
  assert.equal(source.GST_DEBUG, '9');
});

test('progress excludes seeks, resets, jumps, stale samples and untrusted input', () => {
  const sample = (atMs, value, extra = {}) => ({
    kind: 'sample',
    phase: 'playback',
    atMs,
    currentTime: tagged(value),
    duration: tagged(0),
    playbackRate: 1,
    seeking: false,
    sourceMatches: true,
    ...extra,
  });
  const data = {
    records: [sample(0, 0), sample(500, 0.5), sample(1000, 1), sample(1500, 1.5)],
    playResult: { status: 'fulfilled' },
    gesture: { isTrusted: true },
    preCleanup: { duration: tagged(0) },
  };
  assert.equal(playbackObservation(data).nativeProgressObserved, true);
  assert.equal(playbackObservation(data).nativePositiveDurationObserved, false);
  for (const records of [
    [sample(0, 0), sample(500, 100)],
    [sample(0, 0), sample(5000, 5)],
    [sample(0, 3), sample(500, 0), sample(1000, 0.5)],
    [sample(0, 0), { kind: 'seeking' }, sample(500, 10), sample(1000, 10.5)],
    [sample(0, 0), sample(500, 0.5, { sourceMatches: false }), sample(1000, 1)],
  ])
    assert.equal(playbackObservation({ ...data, records }).nativeProgressObserved, false);
  assert.equal(
    playbackObservation({ ...data, gesture: { isTrusted: false } }).nativeProgressObserved,
    false,
  );
});

test('actual reused server preserves bytes, MIME, source CSP and explicit supported ranges', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mp3-control-test-'));
  const bytes = Buffer.from('0123456789'),
    file = `${hash(bytes)}.mp3`;
  let preview, receipt;
  try {
    const publicRoot = join(directory, 'public');
    await createNativeControlRoot(publicRoot, [{ file, bytes }]);
    await writeFile(join(publicRoot, 'not-public.txt'), 'private');
    preview = await startProductionPreview({ root: publicRoot, port: 0, cache: 'no-store' });
    assert.equal(preview.mode, 'source');
    const rows = [];
    receipt = attachRequestReceipts(preview.server, rows);
    const response = await fetch(`${preview.url}${file}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'audio/mpeg');
    assert.equal(response.headers.get('content-length'), '10');
    assert.match(response.headers.get('content-security-policy'), /media-src 'self' data: blob:/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
    for (const [range, body, contentRange] of [
      ['bytes=2-4', '234', 'bytes 2-4/10'],
      ['bytes=7-', '789', 'bytes 7-9/10'],
      ['bytes=-3', '789', 'bytes 7-9/10'],
    ]) {
      const result = await fetch(`${preview.url}${file}`, { headers: { Range: range } });
      assert.equal(result.status, 206);
      assert.equal(result.headers.get('content-range'), contentRange);
      assert.equal(result.headers.get('content-length'), String(body.length));
      assert.equal(await result.text(), body);
    }
    for (const range of ['bytes=0-1,3-4', 'bytes=a-b', 'bytes=20-', 'bytes=-0']) {
      const result = await fetch(`${preview.url}${file}`, { headers: { Range: range } });
      assert.equal(result.status, 416);
      await result.arrayBuffer();
    }
    assert.equal((await fetch(`${preview.url}not-public.txt`)).status, 403);
    assert.equal((await fetch(`${preview.url}game/build-config.json`)).status, 403);
    assert.equal((await fetch(`${preview.url}${file}`, { method: 'POST' })).status, 405);
    assert.equal(receipt.dropped, 0);
    assert(rows.every((row) => row.completed));
    assert(rows.some((row) => row.status === 416));
  } finally {
    receipt?.close();
    if (preview)
      await new Promise((resolve) => {
        preview.server.close(resolve);
        preview.server.closeAllConnections();
      });
    await rm(directory, { recursive: true, force: true });
  }
});

test('HTTP request saturation and incomplete transport are explicit', () => {
  const server = new EventEmitter(),
    rows = [],
    receipt = attachRequestReceipts(server, rows, 1);
  const response = new EventEmitter();
  server.emit('request', { method: 'GET', url: '/audio', headers: {} }, response);
  server.emit('request', { method: 'GET', url: '/audio', headers: {} }, new EventEmitter());
  response.emit('close');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].closedBeforeFinish, true);
  assert.equal(rows[0].completed, false);
  assert.equal(receipt.dropped, 1);
  receipt.close();
  assert.equal(server.listenerCount('request'), 0);
});

test('failed source setup still closes the owned context and records failure without playing', async () => {
  const server = new EventEmitter(),
    calls = [],
    saved = [];
  const owner = {
    report: {},
    async launch() {
      return {
        browser: { version: () => plan.browserVersion },
        context: {
          pages: () => [
            {
              on() {},
              async goto() {},
              async evaluate(fn) {
                if (fn.toString().includes('.prepare(')) throw Error('source failure');
                if (fn.toString().includes('cleanup')) calls.push('cleanup');
                return {};
              },
            },
          ],
        },
      };
    },
    async close() {
      calls.push('close');
      this.report.cleanup = { status: 'closed', browserClosed: true, profileRemoved: true };
    },
  };
  const result = await observeNativeArm({
    id: 'bossa-blob',
    owner,
    preview: { server, url: 'http://127.0.0.1/' },
    pin: {},
    record: async (row) => saved.push(structuredClone(row)),
  });
  assert.equal(result.status, 'failed');
  assert.match(result.failure, /source failure/);
  assert.deepEqual(calls, ['cleanup', 'close']);
  assert.equal(server.listenerCount('request'), 0);
  assert.equal(saved.at(-1).owner.cleanup.status, 'closed');
});

function completed() {
  return {
    format: plan.format,
    status: 'completed-diagnostic',
    qualificationEligible: false,
    firstEightAllCorrectnessPassed: false,
    playwrightVersion: plan.playwright,
    serverClosed: true,
    rows: plan.arms.map((id) => {
      const pin = AUDIO_RECORDINGS.find((pin) =>
        pin.id.endsWith(id.startsWith('bossa') ? '.bossa-nova' : '.party-sector'),
      );
      return {
        id,
        status: 'observed',
        browserVersion: plan.browserVersion,
        owner: { cleanup: { status: 'closed', browserClosed: true, profileRemoved: true } },
        data: {
          identity: { verifiedSha256: pin.sha256, verifiedBytes: pin.bytes },
          gesture: { isTrusted: true },
          passiveBoundary: { atMs: 5000 },
          preCleanup: { atMs: 15000 },
          records: [{ kind: 'user-play', atMs: 5000 }],
          droppedRecords: 0,
          droppedRanges: 0,
        },
        droppedRequests: 0,
        transportComplete: true,
        mediaCleanup: 'submitted',
      };
    }),
  };
}
test('diagnostic completeness rejects missing identity, windows, closure and saturation without requiring playback success', () => {
  const command = { status: 'closed', exitCode: 0, ambiguous: [], survivors: [] };
  assert.equal(nativeControlComplete(completed(), command), true);
  for (const mutate of [
    (r) => {
      r.firstEightAllCorrectnessPassed = true;
    },
    (r) => {
      r.serverClosed = false;
    },
    (r) => {
      r.rows.pop();
    },
    (r) => {
      r.rows[0].data.identity.verifiedSha256 = '0'.repeat(64);
    },
    (r) => {
      r.rows[0].data.preCleanup.atMs = 14999;
    },
    (r) => {
      r.rows[0].data.passiveBoundary.atMs = 4999;
    },
    (r) => {
      r.rows[0].owner.cleanup.browserClosed = false;
    },
    (r) => {
      r.rows[0].droppedRequests = 1;
    },
    (r) => {
      r.rows[0].data.droppedRecords = 1;
    },
    (r) => {
      r.rows[0].transportComplete = false;
    },
  ]) {
    const report = completed();
    mutate(report);
    assert.equal(nativeControlComplete(report, command), false);
  }
  assert.equal(nativeControlComplete(completed(), { ...command, survivors: [{ pid: 1 }] }), false);
  assert.equal(nativeControlComplete(completed(), { ...command, forcedCleanup: true }), false);
});

test('one-shot workflow and source-specific scope retain all failed evidence and no gameplay credit', async () => {
  const text = await readFile(
    new URL('../.github/workflows/solo-native-mp3-control-temporary.yml', import.meta.url),
    'utf8',
  );
  assert(text.includes(`github.event.before == '${plan.predecessorTools}'`));
  assert.match(text, /cancel-in-progress: false/);
  assert.match(text, /install --with-deps webkit/);
  assert.match(text, /if: always\(\)/);
  assert.match(text, /timeout-minutes: 22/);
  assert.match(text, /solo-native-mp3-control\.mjs run/);
  assert.doesNotMatch(text, /game-cli\.mjs build|qualify-solo\.mjs/);
  assert.equal(plan.armTimeoutMs, 60000);
  assert.equal(plan.commandTimeoutMs, 300000);
});

test('backend completeness is separate, exact-arm and fails closed on independent sample loss', () => {
  const command = { status: 'closed', exitCode: 0, ambiguous: [], survivors: [] };
  const make = () => {
    const report = completed();
    report.format = backendPlan.format;
    report.backendEnvironment = { ...backendPlan.backendEnvironment };
    report.rows = report.rows.slice(0, 1);
    Object.assign(report.rows[0].data, {
      captureMode: backendPlan.captureMode,
      samples: [
        { kind: 'sample', phase: 'passive', atMs: 1000 },
        { kind: 'sample', phase: 'playback', atMs: 10000 },
        { kind: 'sample', phase: 'playback', atMs: 10500 },
      ],
      droppedSamples: 0,
    });
    return report;
  };
  assert.equal(nativeControlComplete(make(), command, backendPlan), true);
  assert.equal(nativeControlComplete(make(), command), false);
  assert.equal(nativeControlComplete(completed(), command, backendPlan), false);
  for (const mutate of [
    (r) => {
      r.backendEnvironment.GST_DEBUG = '9';
    },
    (r) => {
      r.rows[0].data.droppedSamples = 1;
    },
    (r) => {
      r.rows[0].data.samples = [];
    },
    (r) => {
      r.rows[0].data.samples = Array(33).fill({});
    },
    (r) => {
      r.rows[0].data.captureMode = null;
    },
    (r) => {
      r.rows[0].data.records = Array(65).fill({});
    },
    (r) => {
      r.rows[0].id = 'bossa-http';
    },
  ]) {
    const report = make();
    mutate(report);
    assert.equal(nativeControlComplete(report, command, backendPlan), false);
  }
  assert.equal(
    nativeControlComplete(make(), { ...command, violation: 'log-limit' }, backendPlan),
    false,
  );
  assert.throws(() => nativeControlComplete(make(), command, { ...backendPlan }), /Unknown/);
});

test('backend workflow is a single declared WPE arm without changing legacy delivery controls', async () => {
  const text = await readFile(
    new URL('../.github/workflows/solo-native-mp3-backend-temporary.yml', import.meta.url),
    'utf8',
  );
  assert(text.includes(`github.event.before == '${backendPlan.predecessorTools}'`));
  assert.match(text, /cancel-in-progress: false/);
  assert.match(text, /install --with-deps webkit/);
  assert.match(text, /if: always\(\)/);
  assert.match(text, /timeout-minutes: 22/);
  assert.match(text, /solo-native-mp3-control\.mjs run-backend/);
  assert.doesNotMatch(text, /headed|xvfb|game-cli\.mjs build|qualify-solo\.mjs/);
  assert.deepEqual(backendPlan.arms, ['bossa-blob']);
  for (const key of [
    'passiveMs',
    'playbackMs',
    'sampleMs',
    'armTimeoutMs',
    'commandTimeoutMs',
    'preparationTimeoutMs',
    'maximumRecords',
    'maximumLogBytes',
    'maximumEvidenceBytes',
  ])
    assert.equal(backendPlan[key], plan[key]);
  assert.deepEqual(backendPlan.backendEnvironment, {
    GST_DEBUG: '2,webkitmediaplayer:6',
    GST_DEBUG_NO_COLOR: '1',
    DEBUG: 'pw:browser',
  });
});

test('Cocoa counterpart preserves original protocol and withholds media for uncertain native owners', () => {
  const report = {
    format: 'SoloNativeCocoaOwnerPreflightV1',
    status: 'closed',
    browserVersion: '26.5',
    platform: 'darwin',
    architecture: 'x64',
    documentURL: 'about:blank',
    mediaElements: 0,
    owner: { cleanup: { status: 'closed', browserClosed: true, profileRemoved: true } },
  };
  const command = {
    status: 'closed',
    exitCode: 0,
    processInventory: { platform: 'darwin' },
    ambiguous: [],
    survivors: [],
    tracked: [
      { argv: '/owned/Playwright.app/Contents/MacOS/Playwright' },
      { argv: '/owned/Frameworks/WebKit.framework/XPCServices/com.apple.WebKit.WebContent' },
    ],
  };
  assert.equal(nativeOwnerPreflightComplete(report, command), true);
  for (const change of [
    { status: 'failed' },
    { documentURL: 'https://unowned.example/' },
    { mediaElements: 1 },
    { browserVersion: '26.4' },
    { architecture: 'arm64' },
    { platform: 'linux' },
    { owner: { cleanup: { status: 'failed-profile-retained' } } },
  ])
    assert.equal(nativeOwnerPreflightComplete({ ...report, ...change }, command), false);
  for (const change of [
    { status: 'failed' },
    { exitCode: 1 },
    { forcedCleanup: true },
    { cleanupUnconfirmed: true },
    { violation: 'unattributed-new-browser' },
    { ambiguous: [{ pid: 1 }] },
    { survivors: [{ pid: 2 }] },
    { tracked: command.tracked.slice(0, 1) },
    { tracked: command.tracked.slice(1) },
    { processInventory: {} },
  ])
    assert.equal(nativeOwnerPreflightComplete(report, { ...command, ...change }), false);
  for (const key of [
    'passiveMs',
    'playbackMs',
    'sampleMs',
    'maximumLogBytes',
    'armTimeoutMs',
    'commandTimeoutMs',
    'preparationTimeoutMs',
    'maximumEvidenceBytes',
  ])
    assert.equal(cocoaPlan[key], backendPlan[key]);
  assert.deepEqual(cocoaPlan.arms, ['bossa-blob']);
  assert.equal(cocoaPlan.maximumSamples, 32);
  assert.equal(cocoaPlan.maximumRecords, 128);
  assert.equal(backendPlan.maximumRecords, 64);
});

test('Cocoa parent retains the command failure before a missing or partial preflight report', async () => {
  const source = await readFile(new URL('./solo-native-mp3-control.mjs', import.meta.url), 'utf8');
  const parent = parse(source, { ecmaVersion: 'latest', sourceType: 'module' }).body.find(
    (node) => node.type === 'FunctionDeclaration' && node.id.name === 'parent',
  );
  const boundary = parent.body.body.find((node) => node.type === 'TryStatement');
  const variables = parent.body.body.find(
    (node) =>
      node.type === 'VariableDeclaration' &&
      node.declarations.some((d) => d.id.name === 'preflight'),
  );
  // Execute the actual parent try/catch/finally. Only native/filesystem boundaries
  // are modeled: no browser, owner process, server or fixture producer is launched.
  const body = source
    .slice(boundary.start, boundary.end)
    .replace("await import('./solo-darwin-process-inventory.mjs')", 'await loadInventory()')
    .replaceAll('import.meta.url', JSON.stringify('file:///scripts/solo-native-mp3-control.mjs'));
  const partial = Buffer.from('{"status":"closed","owner":');
  const original = Buffer.from(partial);
  const clean = {
    status: 'closed',
    exitCode: 0,
    signal: null,
    violation: null,
    forcedCleanup: false,
    cleanupUnconfirmed: false,
    survivors: [],
    ambiguous: [],
  };
  for (const change of [
    {
      status: 'failed',
      violation: 'unattributed-new-browser',
      forcedCleanup: true,
      exitCode: null,
      signal: 'SIGTERM',
    },
    { exitCode: 1 },
    { violation: 'deadline' },
    { forcedCleanup: true },
    { cleanupUnconfirmed: true },
    { ambiguous: [{ pid: 3527 }] },
    { survivors: [{ pid: 3524 }] },
  ])
    for (const report of [null, partial, Buffer.from('{"status":"closed"}')]) {
      const ownerCommand = { ...clean, ...change };
      const calls = [],
        summary = { status: 'failed' },
        process = { env: {}, execPath: '/node' };
      const result = await runInNewContext(
        `(async () => { ${source.slice(variables.start, variables.end)} ${body}; return summary; })()`,
        {
          assert,
          Buffer,
          process,
          summary,
          MP3_CONTROL: plan,
          MP3_COCOA_CONTROL: cocoaPlan,
          plan: cocoaPlan,
          source: 'a'.repeat(40),
          options: {},
          cocoaEnvironment: {},
          output: '/evidence',
          scratch: '/scratch',
          here: '/scripts',
          fileURLToPath: () => '/scripts/solo-native-mp3-control.mjs',
          join,
          inspect: async () => {},
          loadInventory: async () => ({
            admitDarwinBuildReceipt: () => ({ bytes: Buffer.from('{}') }),
          }),
          writeFile: async () => {},
          ownedCommand: async () => ownerCommand,
          readFile: async () => {
            calls.push('read');
            if (report) return report;
            throw Object.assign(Error('missing final'), { code: 'ENOENT' });
          },
          save: async () => {},
          treeBytes: async () => 0,
          failure: (error) => String(error.stack ?? error),
          nativeOwnerPreflightComplete,
        },
        {
          importModuleDynamically: () => {
            throw Error('Unexpected module import');
          },
        },
      );
      assert.match(result.failure, /Cocoa owner preflight command failed/);
      if (ownerCommand.violation) assert(result.failure.includes(ownerCommand.violation));
      assert.doesNotMatch(result.failure, /ENOENT|missing final/);
      assert.equal(result.ownerPreflightStatus, 'failed');
      assert.equal(result.ownerPreflightCommandStatus, ownerCommand.status);
      assert.equal(result.ownerPreflightCommandViolation, ownerCommand.violation);
      assert.equal(result.ownerPreflightCommandExitCode, ownerCommand.exitCode);
      assert.equal(result.ownerPreflightCommandSignal, ownerCommand.signal);
      assert.equal(result.preparationStatus, 'not-run');
      assert.equal(result.commandStatus, 'not-run');
      assert.equal(process.exitCode, 1);
      assert.deepEqual(calls, []);
      assert.deepEqual(partial, original);
    }
});

test('Cocoa is a distinct diagnostic format and cannot inherit a Linux backend result', () => {
  const result = completed();
  result.format = cocoaPlan.format;
  result.rows = result.rows.slice(0, 1);
  result.host = { platform: 'darwin', architecture: 'x64', release: '24.6.0' };
  result.backendEnvironment = { DEBUG: 'pw:browser' };
  Object.assign(result.rows[0].data, {
    captureMode: cocoaPlan.captureMode,
    eventCapacityMode: cocoaPlan.eventCapacityMode,
    droppedSamples: 0,
    samples: [{ phase: 'passive' }, { phase: 'playback' }, { phase: 'playback' }],
  });
  const command = { status: 'closed', exitCode: 0, ambiguous: [], survivors: [] };
  assert.equal(nativeControlComplete(result, command, cocoaPlan), true);
  const missingCapacity = structuredClone(result);
  delete missingCapacity.rows[0].data.eventCapacityMode;
  assert.equal(nativeControlComplete(missingCapacity, command, cocoaPlan), false);
  assert.equal(nativeControlComplete(result, command, backendPlan), false);
  assert.equal(nativeControlComplete(result, command), false);
  for (const patch of [{ platform: 'linux' }, { release: '23.6.0' }, { architecture: 'arm64' }])
    assert.equal(
      nativeControlComplete({ ...result, host: { ...result.host, ...patch } }, command, cocoaPlan),
      false,
    );
  result.rows[0].data.droppedRecords = 1;
  assert.equal(nativeControlComplete(result, command, cocoaPlan), false);
  const environment = {
    PATH: '/owned',
    GST_DEBUG: '9',
    GST_DEBUG_NO_COLOR: '1',
    GST_DEBUG_FILE: '/unowned',
    GST_DEBUG_DUMP_DOT_DIR: '/unowned',
    DEBUG: '*',
  };
  assert.deepEqual(nativeCocoaEnvironment(environment), { PATH: '/owned', DEBUG: 'pw:browser' });
  assert.equal(environment.GST_DEBUG_FILE, '/unowned');
});

test('macOS control admits only its declared predecessor edge with finite bounds and no package work', async () => {
  const workflow = await readFile(
    new URL('../.github/workflows/solo-native-mp3-cocoa-temporary.yml', import.meta.url),
    'utf8',
  );
  const guard = workflow.match(/^    if: (.+)$/m)?.[1];
  assert.equal(
    guard,
    [
      'github.event.pull_request.number == 1544',
      'github.event.pull_request.head.repo.full_name == github.repository',
      "github.event.action == 'synchronize'",
      "github.event.before == 'a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4'",
    ].join(' && '),
  );
  assert.match(workflow, /SOLO_TOOLING_REVISION: \$\{\{ github.event.pull_request.head.sha \}\}/);
  assert.match(workflow, /ref: \$\{\{ github.event.pull_request.head.sha \}\}/);
  assert.doesNotMatch(workflow, /workflow_dispatch/);
  assert.match(workflow, /runs-on: macos-15-intel/);
  assert.match(workflow, /timeout-minutes: 28/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /SOLO_RUN_DARWIN_OWNER_TESTS: '1'/);
  assert.match(workflow, /solo-native-mp3-control\.mjs run-cocoa/);
  assert.match(workflow, /if: always\(\)/);
  assert.doesNotMatch(workflow, /--with-deps|game-cli\.mjs build|qualify-solo\.mjs/);
});

test('Cocoa preparation retains bounded original failure and partial provenance without admitting media', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'cocoa-failed-fixture-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const source = join(directory, 'source.json');
  const failed = {
    status: 'failed',
    recordings: [
      {
        status: 'failed',
        requestedURL: 'https://creator.example/original.mp3',
        responseURL: 'https://cdn.example/original.mp3',
        httpStatus: 503,
      },
    ],
    failure: 'HTTP 503',
  };
  for (const [name, bytes, expectedJSON] of [
    ['failed', Buffer.from(JSON.stringify(failed)), 'parsed'],
    ['partial', Buffer.from('{"status":"preparing","recordings":['), 'partial-or-invalid'],
  ]) {
    await writeFile(source, bytes);
    const destination = join(directory, `${name}.json`);
    const result = await retainCocoaPreparationProvenance(source, destination);
    assert.equal(result.status, 'retained-original');
    assert.equal(result.jsonStatus, expectedJSON);
    assert.equal(result.sha256, hash(bytes));
    assert.deepEqual(await readFile(destination), bytes);
    assert.equal(result.sourceStatus, name === 'failed' ? 'failed' : null);
    assert.equal(
      nativeControlComplete(
        { status: 'failed', fixtureProvenance: result },
        { status: 'closed', exitCode: 1 },
        cocoaPlan,
      ),
      false,
    );
  }
  assert.equal(
    (
      await retainCocoaPreparationProvenance(
        join(directory, 'missing.json'),
        join(directory, 'missing-copy.json'),
      )
    ).status,
    'unavailable',
  );
  await writeFile(source, Buffer.alloc(plan.maximumReportBytes + 1));
  assert.equal(
    (await retainCocoaPreparationProvenance(source, join(directory, 'oversized.json'))).status,
    'retention-failed',
  );
  const alias = join(directory, 'alias.json');
  await symlink(source, alias);
  assert.equal(
    (await retainCocoaPreparationProvenance(alias, join(directory, 'alias-copy.json'))).status,
    'retention-failed',
  );
  await writeFile(source, '{}');
  assert.equal(
    (await retainCocoaPreparationProvenance(source, join(directory, 'failed.json'))).status,
    'retention-failed',
  );
  assert.deepEqual(JSON.parse(await readFile(join(directory, 'failed.json'))), failed);
});

test('declared Cocoa128 retention keeps the observed87 attempts while legacy64 still truncates', async () => {
  for (const expanded of [false, true]) {
    const host = nativePage({
      captureMode: backendPlan.captureMode,
      eventCapacityMode: expanded ? cocoaPlan.eventCapacityMode : null,
    });
    await host.api.prepare(host.pin);
    // Two setup records +83 injected native events +two cleanup records =87.
    for (let i = 0; i < 83; i++) host.event('durationchange');
    const result = normalize(host.api.cleanup());
    assert.equal(result.records.length, expanded ? 87 : 64);
    assert.equal(result.droppedRecords, expanded ? 0 : 23);
    assert.equal(result.eventCapacityMode, expanded ? 'cocoa-128-v1' : undefined);
  }
  const host = nativePage({
    captureMode: cocoaPlan.captureMode,
    eventCapacityMode: cocoaPlan.eventCapacityMode,
  });
  await host.api.prepare(host.pin);
  for (let i = 0; i < 140; i++) host.event('durationchange');
  const result = normalize(host.api.cleanup());
  assert.equal(result.records.length, 128);
  assert(result.droppedRecords > 0);
  assert.throws(
    () => nativePage({ eventCapacityMode: cocoaPlan.eventCapacityMode }),
    /Unknown native event capacity/,
  );
  assert.throws(
    () => nativePage({ captureMode: cocoaPlan.captureMode, eventCapacityMode: 'arbitrary-256' }),
    /Unknown native event capacity/,
  );
});

test('Cocoa sparse checkout contains its complete static, used dynamic and fixture closure', async () => {
  const root = new URL('../', import.meta.url);
  const workflowPath = '.github/workflows/solo-native-mp3-cocoa-temporary.yml';
  const workflow = await readFile(new URL(workflowPath, root), 'utf8');
  const lines = workflow.match(/          sparse-checkout: \|\n((?:            .+\n)+)/)?.[1];
  assert(lines, 'Cocoa checkout must explicitly select the verified source closure');
  const paths = lines
    .trim()
    .split('\n')
    .map((line) => line.trim());
  assert.equal(new Set(paths).size, paths.length);
  for (const path of paths) assert.match(path, /^\/[A-Za-z0-9_.\/-]+$/);
  assert.match(workflow, /sparse-checkout-cone-mode: false/);
  assert.match(workflow, /fetch-depth: 1/);
  assert.doesNotMatch(workflow, /\n +filter:/); // Pinned checkout supplies blob:none itself.
  assert.match(
    workflow,
    /- timeout-minutes: 2\n +uses: actions\/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09/,
  );
  assert.equal(cocoaPlan.predecessorTools, 'adb1c0c7b7dd1a526a0693917f2012d1dbc08b22');
  // The protocol's historical predecessor stays fixed; only the separate, once-only
  // source-checkout release edge changes after its zero-observation failure.
  const roots = [
    'scripts/solo-native-mp3-control.mjs',
    'scripts/serve-production-preview.mjs',
    'scripts/run-solo-remote-correctness.mjs',
    'scripts/solo-qualification-browser-context.mjs',
    'scripts/solo-darwin-process-inventory.mjs',
    ...[
      'solo-darwin-process-inventory',
      'solo-native-mp3-control',
      'solo-qualification-browser-context',
      'solo-remote-correctness',
    ].map((name) => `scripts/test-${name}.mjs`),
  ];
  // These are the actual Cocoa dynamic entry points. The imported CLI's build
  // functions and common runner's other cohort dispatchers are never executed.
  const speech = await speechFixtureProvenance();
  const data = [
    'package.json',
    'package-lock.json',
    'scripts/solo-darwin-process-inventory.c',
    'scripts/solo-remote-archive.py',
    'game/vendor/lz-string-1.5.0.min.js',
    'game/vendor/LZ-STRING-LICENSE.txt',
    'authoring/library/licensed-audio/provenance/expansion-downloads.json',
    speech.path,
    ...['control', 'backend', 'cocoa'].map(
      (mode) => `.github/workflows/solo-native-mp3-${mode}-temporary.yml`,
    ),
  ];
  const declared = new Set(paths.map((path) => path.slice(1)));
  const required = new Set(data),
    visited = new Set();
  const visit = async (path) => {
    if (visited.has(path)) return;
    visited.add(path);
    required.add(path);
    assert(declared.has(path), `Missing Cocoa source dependency: ${path}`);
    const url = new URL(path, root);
    const tree = parse(await readFile(url, 'utf8'), {
      ecmaVersion: 'latest',
      sourceType: 'module',
    });
    for (const node of tree.body) {
      if (
        !['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(
          node.type,
        ) ||
        !node.source?.value.startsWith('.')
      )
        continue;
      const dependency = new URL(node.source.value, url);
      assert(dependency.href.startsWith(root.href), 'Cocoa source escaped its exact checkout');
      await visit(decodeURIComponent(dependency.href.slice(root.href.length)));
    }
  };
  for (const path of roots) await visit(path);
  const assertComplete = (selection) => {
    assert.deepEqual([...selection].sort(), [...required].sort());
  };
  assertComplete(declared);
  for (const removed of ['game/core/index.mjs', speech.path, data[6]]) {
    const incomplete = new Set(declared);
    assert(incomplete.delete(removed));
    assert.throws(() => assertComplete(incomplete));
  }
  for (const path of data) assert((await readFile(new URL(path, root))).length > 0);
  assert.equal(speech.bytes, 16018);
  assert.equal(speech.sha256, '8cec12f5da013e765a6b056384ff520a9ec82244060e962f4f515fbb4e32419c');
});
