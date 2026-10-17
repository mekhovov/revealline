import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, webcrypto } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import {
  MP3_CONTROL as plan,
  attachRequestReceipts,
  createNativeControlRoot,
  installNativeMP3Control,
  nativeControlComplete,
  observeNativeArm,
  playbackObservation,
} from './solo-native-mp3-control.mjs';
import { AUDIO_RECORDINGS } from './prepare-solo-audio-fixtures.mjs';
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
  runInNewContext(`(${installNativeMP3Control.toString()})();`, sandbox);
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
