import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { constants } from 'node:fs';
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  statfs,
  writeFile,
} from 'node:fs/promises';
import { arch, cpus, release, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { AUDIO_RECORDINGS, verifyAudioFixtureBytes } from './prepare-solo-audio-fixtures.mjs';

export const MP3_CONTROL = Object.freeze({
  format: 'SoloNativeMP3ControlV1',
  predecessorTools: 'c9e637ad81fadf49caec884155d1bd0c2496c59c',
  predecessorRun: 38998342774,
  predecessorSource: '3adcd53792043ef02459e86168c6b33a66d6ef00',
  playwright: '1.62.1',
  webkitRevision: '2336',
  browserVersion: '26.5',
  arms: ['bossa-blob', 'bossa-http', 'party-blob', 'party-http'],
  passiveMs: 5000,
  playbackMs: 10000,
  sampleMs: 500,
  armTimeoutMs: 60000,
  commandTimeoutMs: 300000,
  preparationTimeoutMs: 180000,
  operationTimeoutMs: 5000,
  maximumRecords: 64,
  maximumRequests: 32,
  maximumRanges: 8,
  maximumReportBytes: 1024 * 1024,
  maximumEvidenceBytes: 16 * 1024 * 1024,
  maximumScratchBytes: 512 * 1024 * 1024,
  minimumFreeBytes: 1024 * 1024 * 1024,
  maximumLogBytes: 4 * 1024 * 1024,
});
// A separate observation, never a reinterpretation of the saturated V1 records.
export const MP3_BACKEND_CONTROL = Object.freeze({
  ...MP3_CONTROL,
  format: 'SoloNativeMP3BackendControlV1',
  predecessorTools: 'cce49c81d82b79aefc24898f32eeebc609e569fb',
  predecessorRun: 39001646076,
  predecessorSource: 'cce49c81d82b79aefc24898f32eeebc609e569fb',
  arms: Object.freeze(['bossa-blob']),
  captureMode: 'independent-events-samples-v1',
  maximumSamples: 32,
  backendEnvironment: Object.freeze({
    GST_DEBUG: '2,webkitmediaplayer:6',
    GST_DEBUG_NO_COLOR: '1',
    DEBUG: 'pw:browser',
  }),
});
// Native Cocoa counterpart only: same original bytes and passive/trusted-play
// protocol, with an independent fail-closed process-owner preflight.
export const MP3_COCOA_CONTROL = Object.freeze({
  ...MP3_CONTROL,
  format: 'SoloNativeMP3CocoaControlV1',
  predecessorTools: 'adb1c0c7b7dd1a526a0693917f2012d1dbc08b22',
  predecessorRun: 39004951647,
  predecessorSource: 'adb1c0c7b7dd1a526a0693917f2012d1dbc08b22',
  arms: Object.freeze(['bossa-blob']),
  captureMode: 'independent-events-samples-v1',
  maximumSamples: 32,
  maximumRecords: 128,
  eventCapacityMode: 'cocoa-128-v1',
  ownerPreflightTimeoutMs: 120000,
  hostPlatform: 'darwin',
  hostArchitecture: 'x64',
  hostDarwinMajor: '24',
  runner: 'macos-15-intel',
});
export function nativeCocoaEnvironment(environment) {
  const result = { ...environment, DEBUG: 'pw:browser' };
  for (const key of ['GST_DEBUG', 'GST_DEBUG_NO_COLOR', 'GST_DEBUG_FILE', 'GST_DEBUG_DUMP_DOT_DIR'])
    delete result[key];
  return result;
}
export function nativeOwnerPreflightComplete(report, command) {
  return Boolean(
    report?.format === 'SoloNativeCocoaOwnerPreflightV1' &&
      report.status === 'closed' &&
      report.browserVersion === MP3_CONTROL.browserVersion &&
      report.platform === 'darwin' &&
      report.architecture === 'x64' &&
      report.documentURL === 'about:blank' &&
      report.mediaElements === 0 &&
      report.owner?.cleanup?.status === 'closed' &&
      report.owner.cleanup.browserClosed &&
      report.owner.cleanup.profileRemoved &&
      command?.status === 'closed' &&
      command.exitCode === 0 &&
      command.processInventory?.platform === 'darwin' &&
      !command.violation &&
      !command.forcedCleanup &&
      !command.cleanupUnconfirmed &&
      command.ambiguous?.length === 0 &&
      command.survivors?.length === 0 &&
      command.tracked?.some((row) => /(?:MiniBrowser|Playwright)\.app\//.test(row.argv)) &&
      command.tracked.some((row) => /(?:WebKit.*WebContent|WebProcess)/.test(row.argv)),
  );
}
function requirePlan(plan) {
  assert(
    [MP3_CONTROL, MP3_BACKEND_CONTROL, MP3_COCOA_CONTROL].includes(plan),
    'Unknown native control plan',
  );
}
export function nativeBackendEnvironment(environment) {
  const result = { ...environment, ...MP3_BACKEND_CONTROL.backendEnvironment };
  // Route all backend output through the existing bounded process log only.
  delete result.GST_DEBUG_FILE;
  delete result.GST_DEBUG_DUMP_DOT_DIR;
  return result;
}
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const failure = (error) => String(error?.stack ?? error).slice(0, 4096);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pinFor = (id) =>
  AUDIO_RECORDINGS.find((pin) =>
    pin.id.endsWith(id.startsWith('bossa') ? '.bossa-nova' : '.party-sector'),
  );

async function save(path, value) {
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n');
  assert(bytes.length <= MP3_CONTROL.maximumReportBytes, 'Diagnostic report exceeds its bound');
  await writeFile(`${path}.partial`, bytes);
  await rename(`${path}.partial`, path);
}
async function bounded(label, run, ms = MP3_CONTROL.operationTimeoutMs) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(run),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error(`${label} deadline (${ms} ms)`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// This function is the complete external script of the native control page. It
// does not import the application, patch native methods or replace media values.
export function installNativeMP3Control(captureMode = null, eventCapacityMode = null) {
  if (captureMode !== null && captureMode !== 'independent-events-samples-v1')
    throw Error('Unknown native observation mode');
  if (
    eventCapacityMode !== null &&
    (eventCapacityMode !== 'cocoa-128-v1' || captureMode !== 'independent-events-samples-v1')
  )
    throw Error('Unknown native event capacity mode');
  const plan = {
    maximumRecords: eventCapacityMode === 'cocoa-128-v1' ? 128 : 64,
    maximumRanges: 8,
    sampleMs: 500,
  };
  const records = [],
    samples = [],
    eventCounts = {};
  let audio,
    timer,
    ownedURL,
    identity,
    started,
    phase = 'setup',
    droppedRecords = 0,
    droppedSamples = 0,
    droppedRanges = 0;
  let playResult = { status: 'not-requested' },
    gesture = null,
    preCleanup = null,
    passiveBoundary = null;
  const errors = [];
  const number = (value) =>
    Number.isFinite(value)
      ? { kind: 'finite', value }
      : { kind: Number.isNaN(value) ? 'NaN' : value === Infinity ? 'Infinity' : '-Infinity' };
  const ranges = (value) => {
    const result = [];
    for (let i = 0; i < Math.min(value.length, plan.maximumRanges); i++)
      result.push([value.start(i), value.end(i)]);
    droppedRanges += Math.max(0, value.length - plan.maximumRanges);
    return result;
  };
  const state = () => ({
    atMs: performance.now() - started,
    phase,
    duration: number(audio.duration),
    currentTime: number(audio.currentTime),
    readyState: audio.readyState,
    networkState: audio.networkState,
    error: audio.error
      ? { code: audio.error.code, message: String(audio.error.message).slice(0, 512) }
      : null,
    paused: audio.paused,
    ended: audio.ended,
    seeking: audio.seeking,
    playbackRate: audio.playbackRate,
    muted: audio.muted,
    volume: audio.volume,
    sourceMatches: audio.currentSrc === (ownedURL ?? identity.url),
    currentSrc: audio.currentSrc.slice(0, 512),
    buffered: ranges(audio.buffered),
    seekable: ranges(audio.seekable),
    played: ranges(audio.played),
  });
  const record = (kind) => {
    if (captureMode && kind === 'sample') {
      if (samples.length >= 32) droppedSamples++;
      else samples.push({ kind, ...state() });
      return;
    }
    if (records.length >= plan.maximumRecords) {
      droppedRecords++;
      return;
    }
    records.push({ kind, ...state() });
  };
  const snapshot = () => ({
    ...(captureMode ? { captureMode, samples, droppedSamples } : {}),
    ...(eventCapacityMode ? { eventCapacityMode } : {}),
    identity,
    records,
    eventCounts,
    droppedRecords,
    droppedRanges,
    playResult,
    gesture,
    passiveBoundary,
    preCleanup,
    errors,
  });
  const button = globalThis.document.querySelector('button');
  button.addEventListener('click', (event) => {
    if (!audio || playResult.status !== 'not-requested') return;
    phase = 'playback';
    gesture = {
      isTrusted: event.isTrusted,
      userActivation: navigator.userActivation?.isActive ?? null,
    };
    record('user-play');
    playResult = { status: 'pending' };
    try {
      // Never await this promise: a pending native play must not extend the window.
      const result = audio.play();
      result.then(
        () => {
          playResult = { status: 'fulfilled' };
          record('play-fulfilled');
        },
        (error) => {
          playResult = {
            status: 'rejected',
            name: error.name,
            message: String(error.message).slice(0, 512),
          };
          record('play-rejected');
        },
      );
    } catch (error) {
      playResult = {
        status: 'threw',
        name: error.name,
        message: String(error.message).slice(0, 512),
      };
      record('play-threw');
    }
  });
  globalThis.nativeMP3Control = {
    async prepare(pin) {
      if (audio) throw Error('One source per fresh context');
      if (!['blob', 'http'].includes(pin.transport)) throw Error('Unknown transport');
      const url = new URL(pin.file, globalThis.location.href).href;
      if (new URL(url).origin !== globalThis.location.origin)
        throw Error('Only the owned loopback origin is admitted');
      const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
      if (
        !response.ok ||
        response.headers.get('content-type') !== 'audio/mpeg' ||
        Number(response.headers.get('content-length')) !== pin.bytes
      )
        throw Error('Recording transport identity differs');
      const bytes = await response.arrayBuffer();
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
        .map((n) => n.toString(16).padStart(2, '0'))
        .join('');
      if (bytes.byteLength !== pin.bytes || hash !== pin.sha256)
        throw Error('Original recording bytes differ');
      identity = {
        ...pin,
        url,
        verifiedBytes: bytes.byteLength,
        verifiedSha256: hash,
        mime: 'audio/mpeg',
      };
      if (pin.transport === 'blob')
        ownedURL = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
      audio = globalThis.document.createElement('audio');
      identity.nativeMPEGSupport = audio.canPlayType('audio/mpeg');
      audio.preload = 'auto';
      audio.controls = true;
      const events = [
        'loadstart',
        'durationchange',
        'loadedmetadata',
        'loadeddata',
        'canplay',
        'canplaythrough',
        'playing',
        'waiting',
        'stalled',
        'suspend',
        'error',
        'pause',
        'ended',
        'seeking',
        'seeked',
        'emptied',
        'abort',
      ];
      for (const event of events)
        audio.addEventListener(event, () => {
          eventCounts[event] = (eventCounts[event] ?? 0) + 1;
          record(event);
        });
      audio.addEventListener('timeupdate', () => {
        eventCounts.timeupdate = (eventCounts.timeupdate ?? 0) + 1;
      });
      globalThis.document.body.append(audio);
      started = performance.now();
      phase = 'passive';
      audio.src = ownedURL ?? url;
      record('load-before');
      audio.load();
      record('load-after');
      timer = setInterval(() => record('sample'), plan.sampleMs);
      button.disabled = false;
      return snapshot();
    },
    passiveBoundary() {
      passiveBoundary = state();
      record('passive-boundary');
      return snapshot();
    },
    snapshot,
    cleanup() {
      if (!audio) return snapshot();
      preCleanup = state();
      clearInterval(timer);
      phase = 'cleanup';
      record('cleanup-before');
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      if (ownedURL) URL.revokeObjectURL(ownedURL);
      record('cleanup-after');
      button.disabled = true;
      return snapshot();
    },
  };
}

export function playbackObservation(data) {
  let previous = null,
    continuous = 0,
    maximum = 0,
    discontinuities = 0;
  const records =
    data.captureMode === MP3_BACKEND_CONTROL.captureMode
      ? [...(data.records ?? []), ...(data.samples ?? [])].sort((a, b) => a.atMs - b.atMs)
      : (data.records ?? []);
  for (const item of records) {
    if (['seeking', 'seeked', 'emptied', 'abort'].includes(item.kind)) {
      previous = null;
      continuous = 0;
      continue;
    }
    if (item.kind !== 'sample' || item.phase !== 'playback') continue;
    const current = item.currentTime?.kind === 'finite' ? item.currentTime.value : NaN;
    if (
      item.seeking ||
      item.playbackRate !== 1 ||
      !item.sourceMatches ||
      !Number.isFinite(current)
    ) {
      previous = null;
      continuous = 0;
      continue;
    }
    if (previous) {
      const delta = current - previous.current,
        elapsed = (item.atMs - previous.atMs) / 1000;
      if (elapsed > 0 && elapsed <= 1.5 && delta >= 0 && delta <= elapsed * 1.5 + 0.1)
        continuous += delta;
      else {
        discontinuities++;
        continuous = 0;
      }
      maximum = Math.max(maximum, continuous);
    }
    previous = { current, atMs: item.atMs };
  }
  const finitePositive = (value) => value?.kind === 'finite' && value.value > 0;
  return {
    largestContinuousProgressSeconds: maximum,
    discontinuities,
    firstDuration:
      data.records?.find((row) => row.kind === 'durationchange' || row.kind === 'loadedmetadata')
        ?.duration ?? null,
    firstFinitePositive: data.records?.find((row) => finitePositive(row.duration)) ?? null,
    passiveDuration: data.passiveBoundary?.duration ?? null,
    terminalDuration: data.preCleanup?.duration ?? null,
    nativeProgressObserved:
      maximum > 1 && data.playResult?.status === 'fulfilled' && data.gesture?.isTrusted === true,
    nativePositiveDurationObserved: finitePositive(data.preCleanup?.duration),
    nativeDurationMatchesFrames:
      finitePositive(data.preCleanup?.duration) &&
      data.preCleanup.duration.value <= 720 &&
      Number.isFinite(data.identity?.durationSeconds) &&
      Math.abs(data.preCleanup.duration.value - data.identity.durationSeconds) <=
        Math.max(0.5, data.identity.durationSeconds * 0.01),
    qualificationEligible: false,
  };
}

export function attachRequestReceipts(server, rows, limit = MP3_CONTROL.maximumRequests) {
  let dropped = 0;
  const onRequest = (request, response) => {
    if (rows.length >= limit) {
      dropped++;
      return;
    }
    const row = {
      method: request.method,
      url: String(request.url).slice(0, 512),
      range: request.headers.range ?? null,
      destination: request.headers['sec-fetch-dest'] ?? null,
      completed: false,
    };
    rows.push(row);
    response.once('finish', () => {
      Object.assign(row, {
        completed: true,
        status: response.statusCode,
        type: response.getHeader('content-type') ?? null,
        length: response.getHeader('content-length') ?? null,
        contentRange: response.getHeader('content-range') ?? null,
      });
    });
    response.once('close', () => {
      if (!row.completed) row.closedBeforeFinish = true;
    });
  };
  server.on('request', onRequest);
  return {
    close() {
      server.off('request', onRequest);
    },
    get dropped() {
      return dropped;
    },
  };
}

export async function createNativeControlRoot(destination, assets, plan = MP3_CONTROL) {
  requirePlan(plan);
  await mkdir(destination);
  await mkdir(join(destination, 'game'));
  const include = ['index.html', 'control.mjs'];
  for (const { file, bytes } of assets) {
    assert(/^[a-f0-9]{64}\.mp3$/.test(file));
    await writeFile(join(destination, file), bytes);
    include.push(file);
  }
  await writeFile(
    join(destination, 'game/build-config.json'),
    JSON.stringify({ version: '0.0.1', entry: 'index.html', include }),
  );
  await writeFile(
    join(destination, 'index.html'),
    '<!doctype html><html lang="en"><meta charset="utf-8"><title>Native MP3 control</title><link rel="icon" href="data:,"><body><h1>Native MP3 control</h1><button disabled>Play recording</button><script type="module" src="control.mjs"></script></body></html>',
  );
  await writeFile(
    join(destination, 'control.mjs'),
    `(${installNativeMP3Control.toString()})(${JSON.stringify(plan.captureMode ?? null)}${plan === MP3_COCOA_CONTROL ? `,${JSON.stringify(plan.eventCapacityMode)}` : ''});\n`,
  );
}

export async function observeNativeArm({ id, owner, preview, pin, record, plan = MP3_CONTROL }) {
  requirePlan(plan);
  assert(plan.arms.includes(id));
  const row = {
    id,
    status: 'running',
    identity: pin,
    requests: [],
    owner: owner.report,
    startedAt: new Date().toISOString(),
    qualificationEligible: false,
  };
  const start = performance.now();
  const receipt = attachRequestReceipts(preview.server, row.requests);
  let page;
  const remaining = () => MP3_CONTROL.armTimeoutMs - 11000 - (performance.now() - start);
  const operation = (label, run) => {
    assert(remaining() > 0, 'Arm cleanup reservation reached');
    return bounded(label, run, Math.min(MP3_CONTROL.operationTimeoutMs, remaining()));
  };
  try {
    // The owner already bounds launch at 30 seconds. Do not race launch against
    // another timer that could leave a late context outside its cleanup path.
    const launched = await owner.launch();
    row.browserVersion = launched.browser.version();
    assert.equal(row.browserVersion, MP3_CONTROL.browserVersion);
    page =
      launched.context.pages()[0] ??
      (await operation('new-page', () => launched.context.newPage()));
    row.pageErrors = [];
    page.on('pageerror', (error) => {
      if (row.pageErrors.length < 8) row.pageErrors.push(failure(error));
      else row.droppedPageErrors = (row.droppedPageErrors ?? 0) + 1;
    });
    await operation('control-navigation', () =>
      page.goto(`${preview.url}index.html`, {
        waitUntil: 'load',
        timeout: MP3_CONTROL.operationTimeoutMs,
      }),
    );
    row.environment = await operation('native-environment', () =>
      page.evaluate(() => ({
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        devicePixelRatio: globalThis.devicePixelRatio,
        viewport: { width: globalThis.innerWidth, height: globalThis.innerHeight },
      })),
    );
    row.data = await operation('prepare-original-source', () =>
      page.evaluate((pin) => globalThis.nativeMP3Control.prepare(pin), pin),
    );
    await record(row);
    assert(
      remaining() >= MP3_CONTROL.passiveMs,
      'Insufficient time for the unchanged passive window',
    );
    await sleep(MP3_CONTROL.passiveMs);
    row.data = await operation('passive-boundary', () =>
      page.evaluate(() => globalThis.nativeMP3Control.passiveBoundary()),
    );
    await record(row);
    await operation('user-play-button', () =>
      page
        .getByRole('button', { name: 'Play recording', exact: true })
        .click({ timeout: MP3_CONTROL.operationTimeoutMs }),
    );
    assert(
      remaining() >= MP3_CONTROL.playbackMs,
      'Insufficient time for the unchanged playback window',
    );
    await sleep(MP3_CONTROL.playbackMs);
    assert(remaining() >= 0, 'Arm observation exceeded its cleanup reservation');
    row.status = 'observed';
  } catch (error) {
    row.status = 'failed';
    row.failure = failure(error);
  } finally {
    if (page) {
      try {
        row.data =
          (await bounded(
            'native-source-cleanup',
            () => page.evaluate(() => globalThis.nativeMP3Control?.cleanup()),
            1000,
          )) ?? row.data;
        row.mediaCleanup = 'submitted';
      } catch (error) {
        row.status = 'failed';
        row.mediaCleanupFailure = failure(error);
      }
    }
    await owner.close();
    receipt.close();
    row.droppedRequests = receipt.dropped;
    row.elapsedMs = performance.now() - start;
    if (row.elapsedMs > MP3_CONTROL.armTimeoutMs) {
      row.status = 'failed';
      row.deadlineExceeded = true;
    }
    if (owner.report.cleanup?.status !== 'closed') row.status = 'failed';
    row.observation = playbackObservation(row.data ?? {});
    row.transportComplete = row.requests.every(
      (request) => request.completed && [200, 206].includes(request.status),
    );
    if (
      !row.transportComplete ||
      row.droppedRequests ||
      row.data?.droppedRecords ||
      row.data?.droppedSamples ||
      row.data?.droppedRanges ||
      row.pageErrors?.length ||
      row.droppedPageErrors
    )
      row.status = 'failed';
    await record(row);
  }
  return row;
}

export function nativeControlComplete(report, command, plan = MP3_CONTROL) {
  requirePlan(plan);
  return (
    report?.format === plan.format &&
    report.status === 'completed-diagnostic' &&
    report.qualificationEligible === false &&
    report.firstEightAllCorrectnessPassed === false &&
    (plan !== MP3_BACKEND_CONTROL ||
      Object.entries(plan.backendEnvironment).every(
        ([key, value]) => report.backendEnvironment?.[key] === value,
      )) &&
    (plan !== MP3_COCOA_CONTROL ||
      (report.host?.platform === 'darwin' &&
        report.host.architecture === 'x64' &&
        report.host.release?.split('.')[0] === MP3_COCOA_CONTROL.hostDarwinMajor &&
        report.backendEnvironment?.DEBUG === 'pw:browser')) &&
    report.playwrightVersion === MP3_CONTROL.playwright &&
    report.serverClosed === true &&
    report.rows?.length === plan.arms.length &&
    report.rows.every(
      (row, index) =>
        row.id === plan.arms[index] &&
        row.status === 'observed' &&
        row.browserVersion === MP3_CONTROL.browserVersion &&
        row.owner?.cleanup?.status === 'closed' &&
        row.owner.cleanup.browserClosed &&
        row.owner.cleanup.profileRemoved &&
        row.data?.identity?.verifiedSha256 === pinFor(row.id).sha256 &&
        row.data?.identity?.verifiedBytes === pinFor(row.id).bytes &&
        row.data?.gesture?.isTrusted === true &&
        row.data?.passiveBoundary?.atMs >= MP3_CONTROL.passiveMs &&
        row.data?.preCleanup?.atMs -
          row.data?.records?.find((event) => event.kind === 'user-play')?.atMs >=
          MP3_CONTROL.playbackMs &&
        !row.droppedRequests &&
        !row.data?.droppedRecords &&
        (plan === MP3_COCOA_CONTROL
          ? row.data?.eventCapacityMode === plan.eventCapacityMode
          : row.data?.eventCapacityMode === undefined) &&
        (plan === MP3_CONTROL ||
          (row.data?.captureMode === plan.captureMode &&
            Array.isArray(row.data.samples) &&
            row.data.samples.some((sample) => sample.phase === 'passive') &&
            row.data.samples.filter((sample) => sample.phase === 'playback').length >= 2 &&
            row.data.samples.length <= plan.maximumSamples &&
            row.data.records.length <= plan.maximumRecords &&
            row.data.droppedSamples === 0)) &&
        !row.data?.droppedRanges &&
        row.transportComplete &&
        row.mediaCleanup === 'submitted',
    ) &&
    command?.status === 'closed' &&
    command.exitCode === 0 &&
    !command.violation &&
    !command.forcedCleanup &&
    !command.cleanupUnconfirmed &&
    command.ambiguous?.length === 0 &&
    command.survivors?.length === 0
  );
}

async function child(output, scratch, previewRoot, plan = MP3_CONTROL) {
  requirePlan(plan);
  if (plan === MP3_COCOA_CONTROL) {
    assert.equal(process.platform, plan.hostPlatform);
    assert.equal(arch(), plan.hostArchitecture);
    assert.equal(release().split('.')[0], plan.hostDarwinMajor);
    assert.equal(process.env.DEBUG, 'pw:browser');
    for (const key of [
      'GST_DEBUG',
      'GST_DEBUG_NO_COLOR',
      'GST_DEBUG_FILE',
      'GST_DEBUG_DUMP_DOT_DIR',
    ])
      assert.equal(process.env[key], undefined, 'Unexpected Linux backend environment');
  }
  if (plan === MP3_BACKEND_CONTROL)
    for (const [key, value] of Object.entries(plan.backendEnvironment))
      assert.equal(process.env[key], value, 'Backend logging declaration differs');
  if (plan === MP3_BACKEND_CONTROL) {
    assert.equal(process.env.GST_DEBUG_FILE, undefined, 'Unowned backend log destination');
    assert.equal(
      process.env.GST_DEBUG_DUMP_DOT_DIR,
      undefined,
      'Unowned backend graph destination',
    );
  }
  const { startProductionPreview } = await import('./serve-production-preview.mjs');
  const { createPersistentQualificationOwner } = await import(
    './solo-qualification-browser-context.mjs'
  );
  const modulePath = process.env.SOLO_PLAYWRIGHT_MODULE;
  assert(modulePath && resolve(modulePath) === modulePath);
  const packageInfo = JSON.parse(await readFile(join(dirname(modulePath), 'package.json'), 'utf8'));
  assert.equal(packageInfo.version, MP3_CONTROL.playwright);
  const { webkit } = await import(pathToFileURL(modulePath).href);
  assert(webkit.executablePath().includes(`/webkit-${MP3_CONTROL.webkitRevision}/`));
  const registry = await readFile(join(dirname(modulePath), '../playwright-core/browsers.json'));
  const registryWebKit = JSON.parse(registry).browsers.find((item) => item.name === 'webkit');
  assert.equal(registryWebKit.revision, MP3_CONTROL.webkitRevision);
  assert.equal(registryWebKit.browserVersion, MP3_CONTROL.browserVersion);
  if (plan !== MP3_CONTROL)
    assert((await lstat(webkit.executablePath())).size <= 65536, 'Launcher source bound');
  const launcher = await readFile(webkit.executablePath());
  if (plan !== MP3_CONTROL) {
    assert(launcher.length <= 65536, 'Launcher source bound');
    await writeFile(join(output, 'webkit-launcher.txt'), launcher);
  }
  const report = {
    format: plan.format,
    ...(plan === MP3_BACKEND_CONTROL ? { backendEnvironment: plan.backendEnvironment } : {}),
    ...(plan === MP3_COCOA_CONTROL ? { backendEnvironment: { DEBUG: 'pw:browser' } } : {}),
    sourceRevision: process.env.SOLO_TOOLING_REVISION,
    status: 'running',
    qualificationEligible: false,
    firstEightAllCorrectnessPassed: false,
    performanceGateStatus: 'excluded-native-codec-control',
    playwrightVersion: packageInfo.version,
    playwrightRegistry: {
      bytes: registry.length,
      sha256: sha256(registry),
      webkit: registryWebKit,
    },
    executable: webkit.executablePath(),
    executableSha256: sha256(launcher),
    ...(plan !== MP3_CONTROL
      ? {
          launcherSource: {
            file: 'webkit-launcher.txt',
            bytes: launcher.length,
            sha256: sha256(launcher),
            headless: true,
          },
        }
      : {}),
    host: {
      platform: process.platform,
      release: release(),
      architecture: arch(),
      node: process.version,
      cpu: cpus()[0]?.model,
      cpuThrottle: 1,
    },
    rows: [],
    serverClosed: false,
  };
  report.hostPackageInventory = [];
  for (const [command, args] of plan === MP3_COCOA_CONTROL
    ? [
        ['sw_vers', []],
        ['sysctl', ['-n', 'machdep.cpu.brand_string']],
      ]
    : [
        [
          'dpkg-query',
          ['-W', '-f=${binary:Package}\t${Version}\n', '*gstreamer*', '*wpe*', '*webkit*'],
        ],
        ['gst-inspect-1.0', ['--version']],
      ]) {
    try {
      report.hostPackageInventory.push({
        command,
        args,
        status: 'observed-host-only',
        output: execFileSync(command, args, { encoding: 'utf8', timeout: 5000, maxBuffer: 65536 }),
      });
    } catch (error) {
      report.hostPackageInventory.push({
        command,
        args,
        status: 'unavailable-or-incomplete',
        failure: failure(error),
        stdout: String(error.stdout ?? '').slice(0, 65536),
        stderr: String(error.stderr ?? '').slice(0, 4096),
      });
    }
  }
  const reportPath = join(output, 'report.json');
  let preview;
  try {
    const provenance = JSON.parse(await readFile(join(output, 'fixture-provenance.json'), 'utf8'));
    preview = await startProductionPreview({ root: previewRoot, port: 0, cache: 'no-store' });
    assert.equal(preview.mode, 'source');
    report.server = {
      url: preview.url,
      mode: preview.mode,
      headers: preview.headers,
      cache: preview.cache,
    };
    for (const id of plan.arms) {
      const original = pinFor(id);
      const durationSeconds = provenance.recordings.find((item) => item.sha256 === original.sha256)
        ?.asset?.durationSeconds;
      assert(Number.isFinite(durationSeconds) && durationSeconds > 0 && durationSeconds <= 720);
      const owner = createPersistentQualificationOwner({
        browserType: webkit,
        temporaryRoot: scratch,
        launchOptions: { headless: true },
        contextOptions: {
          viewport: { width: 1280, height: 800 },
          deviceScaleFactor: 1,
          locale: 'en-US',
          acceptDownloads: false,
          serviceWorkers: 'block',
        },
      });
      const row = await observeNativeArm({
        plan,
        id,
        owner,
        preview,
        pin: {
          ...original,
          durationSeconds,
          file: `${original.sha256}.mp3`,
          transport: id.endsWith('blob') ? 'blob' : 'http',
        },
        record: async (row) => {
          const index = report.rows.findIndex((item) => item.id === id);
          if (index < 0) report.rows.push(row);
          else report.rows[index] = row;
          await save(reportPath, report);
        },
      });
      if (row.owner.cleanup?.status !== 'closed')
        throw Error('Unconfirmed context ownership closure; remaining controls are not observed');
    }
    for (const pin of AUDIO_RECORDINGS)
      verifyAudioFixtureBytes(await readFile(join(previewRoot, `${pin.sha256}.mp3`)), pin);
    report.status = report.rows.every((row) => row.status === 'observed')
      ? 'completed-diagnostic'
      : 'failed';
  } catch (error) {
    report.status = 'failed';
    report.failure = failure(error);
  } finally {
    if (preview) {
      try {
        await bounded(
          'server-close',
          () =>
            new Promise((resolve, reject) => {
              preview.server.close((error) => (error ? reject(error) : resolve()));
              preview.server.closeAllConnections();
            }),
        );
        report.serverClosed = true;
      } catch (error) {
        report.status = 'failed';
        report.serverFailure = failure(error);
      }
    }
    report.notObserved = plan.arms.filter((id) => !report.rows.some((row) => row.id === id));
    await save(reportPath, report);
    if (report.status !== 'completed-diagnostic') process.exitCode = 1;
  }
}

async function treeBytes(directory) {
  let bytes = 0,
    members = 0;
  const walk = async (path) => {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      assert(++members <= 5000, 'Owned tree member limit');
      const file = join(path, entry.name);
      try {
        if (entry.isDirectory()) await walk(file);
        else if (entry.isFile()) bytes += (await lstat(file)).size;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
  };
  await walk(directory);
  return bytes;
}
export function backendLogObservation(bytes) {
  assert(Buffer.isBuffer(bytes), 'Bounded original log bytes required');
  assert(bytes.length <= MP3_BACKEND_CONTROL.maximumLogBytes, 'Backend log cap exceeded');
  const lines = bytes.toString('utf8').split('\n');
  const nativeLines = lines.filter((line) => /\bwebkitmediaplayer\b.*\.cpp:\d+/.test(line));
  return {
    bytes: bytes.length,
    sha256: sha256(bytes),
    category: 'webkitmediaplayer',
    categoryLines: nativeLines.length,
    durationQueryLines: nativeLines.filter((line) => /Duration query/.test(line)).length,
    status: nativeLines.length ? 'observed-category' : 'unavailable-category',
    qualificationEligible: false,
  };
}
// Raw failure evidence is useful even when the writer produced partial JSON.
// This never turns failed preparation into admission for a media observation.
export async function retainCocoaPreparationProvenance(source, destination) {
  let handle;
  try {
    const before = await lstat(source);
    assert(before.isFile() && !before.isSymbolicLink(), 'Unsafe preparation provenance');
    assert(before.size <= MP3_CONTROL.maximumReportBytes, 'Preparation provenance cap');
    handle = await open(source, constants.O_RDONLY | constants.O_NOFOLLOW);
    const identity = await handle.stat();
    assert(
      identity.dev === before.dev && identity.ino === before.ino,
      'Preparation source replaced',
    );
    const buffer = Buffer.alloc(before.size + 1);
    let count = 0;
    while (count < buffer.length) {
      const read = await handle.read(buffer, count, buffer.length - count, count);
      if (!read.bytesRead) break;
      count += read.bytesRead;
    }
    const after = await handle.stat(),
      path = await lstat(source);
    assert(
      count === before.size &&
        after.size === before.size &&
        after.mtimeMs === before.mtimeMs &&
        after.ctimeMs === before.ctimeMs &&
        path.isFile() &&
        !path.isSymbolicLink() &&
        path.dev === before.dev &&
        path.ino === before.ino,
      'Preparation provenance changed during retention',
    );
    const bytes = buffer.subarray(0, count);
    await writeFile(destination, bytes, { flag: 'wx' });
    let jsonStatus = 'partial-or-invalid',
      sourceStatus = null;
    try {
      const parsed = JSON.parse(bytes);
      jsonStatus = 'parsed';
      if (typeof parsed?.status === 'string') sourceStatus = parsed.status.slice(0, 128);
    } catch {
      /* Preserve the exact original bytes, including partial failure JSON. */
    }
    return {
      status: 'retained-original',
      bytes: bytes.length,
      sha256: sha256(bytes),
      jsonStatus,
      sourceStatus,
    };
  } catch (error) {
    return {
      status: error.code === 'ENOENT' ? 'unavailable' : 'retention-failed',
      failure: failure(error),
    };
  } finally {
    await handle?.close();
  }
}
async function parent(output, plan = MP3_CONTROL) {
  requirePlan(plan);
  assert.equal(process.platform, plan === MP3_COCOA_CONTROL ? 'darwin' : 'linux');
  if (plan === MP3_COCOA_CONTROL) {
    assert.equal(arch(), plan.hostArchitecture);
    assert.equal(release().split('.')[0], plan.hostDarwinMajor);
  }
  const source = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  assert.equal(source, process.env.SOLO_TOOLING_REVISION);
  assert(/^[a-f0-9]{40}$/.test(source));
  assert.equal(
    execFileSync('git', ['diff', 'HEAD', '--name-only'], { cwd: root, encoding: 'utf8' }).trim(),
    '',
  );
  await mkdir(output);
  const scratch = await mkdtemp(
    join(plan === MP3_COCOA_CONTROL ? await realpath('/tmp') : tmpdir(), 'sm-'),
  );
  assert(Buffer.byteLength(scratch) <= 34, 'Short owned root required for WebKit sockets');
  const identity = await lstat(scratch);
  const inspect = async () => {
    const current = await lstat(scratch);
    assert(current.dev === identity.dev && current.ino === identity.ino);
    const space = await statfs(scratch);
    assert(Number(space.bavail) * Number(space.bsize) >= MP3_CONTROL.minimumFreeBytes);
    assert((await treeBytes(scratch)) <= MP3_CONTROL.maximumScratchBytes);
    assert(
      (await treeBytes(output)) <= MP3_CONTROL.maximumEvidenceBytes - 4 * 1024 * 1024,
      'Evidence reservation exceeded',
    );
  };
  const sources = {};
  for (const file of [
    'solo-native-mp3-control.mjs',
    'prepare-solo-audio-fixtures.mjs',
    'solo-qualification-browser-context.mjs',
    'serve-production-preview.mjs',
    'run-solo-remote-correctness.mjs',
    ...(plan === MP3_COCOA_CONTROL
      ? ['solo-darwin-process-inventory.c', 'solo-darwin-process-inventory.mjs']
      : []),
  ]) {
    const bytes = await readFile(join(here, file));
    sources[file] = { bytes: bytes.length, sha256: sha256(bytes) };
  }
  await save(join(output, 'admission.json'), {
    sourceRevision: source,
    plan,
    sources,
    scratch: { path: scratch, dev: identity.dev, ino: identity.ino },
    automaticRetries: 0,
  });
  const { ownedCommand } = await import('./run-solo-remote-correctness.mjs');
  const options = {
    cwd: root,
    env: { ...process.env, TMPDIR: scratch },
    rssBytes: 6 * 1024 ** 3,
    outputBytes: MP3_CONTROL.maximumLogBytes,
    inspect,
  };
  let preparation, command, report, preflight;
  const cocoaEnvironment = plan === MP3_COCOA_CONTROL ? nativeCocoaEnvironment(options.env) : null;
  const summary = {
    format: plan.format,
    sourceRevision: source,
    status: 'failed',
    qualificationEligible: false,
    firstEightAllCorrectnessPassed: false,
    performanceGateStatus: 'excluded-native-codec-control',
  };
  try {
    await inspect();
    if (plan === MP3_COCOA_CONTROL) {
      const { admitDarwinBuildReceipt } = await import('./solo-darwin-process-inventory.mjs');
      const build = admitDarwinBuildReceipt(process.env, source);
      await writeFile(join(output, 'process-inventory-build.json'), build.bytes, { flag: 'wx' });
      const ownerCommand = await ownedCommand(
        [process.execPath, fileURLToPath(import.meta.url), 'child-cocoa-owner', output, scratch],
        {
          ...options,
          env: cocoaEnvironment,
          timeoutMs: plan.ownerPreflightTimeoutMs,
          log: join(output, 'owner-preflight.log'),
          receipt: join(output, 'owner-preflight-command.json'),
          ...(cocoaEnvironment.SOLO_DARWIN_AMBIGUITY_EVIDENCE === 'identity-maps-v2'
            ? { retainAmbiguityInventories: 'identity-maps-v2' }
            : {}),
        },
      );
      const bytes = await readFile(join(output, 'owner-preflight.json'));
      assert(bytes.length <= plan.maximumReportBytes, 'Owner preflight report cap');
      preflight = JSON.parse(bytes);
      assert.equal(preflight.sourceRevision, source);
      assert(
        nativeOwnerPreflightComplete(preflight, ownerCommand),
        'Cocoa process ownership is uncertain; media observation withheld',
      );
    }
    const fixtures = join(scratch, 'originals');
    preparation = await ownedCommand(
      [
        process.execPath,
        join(here, 'prepare-solo-audio-fixtures.mjs'),
        fixtures,
        '--creator-download',
      ],
      {
        ...options,
        timeoutMs: MP3_CONTROL.preparationTimeoutMs,
        log: join(output, 'preparation.log'),
        receipt: join(output, 'preparation-command.json'),
      },
    );
    if (plan === MP3_COCOA_CONTROL)
      summary.fixtureProvenance = await retainCocoaPreparationProvenance(
        join(fixtures, 'provenance.json'),
        join(output, 'fixture-provenance.json'),
      );
    assert(
      preparation.status === 'closed' &&
        preparation.exitCode === 0 &&
        !preparation.violation &&
        !preparation.forcedCleanup &&
        !preparation.cleanupUnconfirmed &&
        preparation.survivors?.length === 0 &&
        preparation.ambiguous?.length === 0,
      'Original fixture preparation/ownership failed',
    );
    if (plan === MP3_COCOA_CONTROL)
      assert.equal(
        summary.fixtureProvenance.status,
        'retained-original',
        'Preparation evidence unavailable',
      );
    const bundle = await readFile(join(fixtures, 'recorded-music.rlsound'));
    assert.equal(bundle.length, 3124928);
    assert.equal(
      sha256(bundle),
      'aa25ae643608cfa9a2dd6aac1a3dcd7ba65d667f998144d0927c194df7c1e99f',
    );
    if (plan !== MP3_COCOA_CONTROL)
      await copyFile(join(fixtures, 'provenance.json'), join(output, 'fixture-provenance.json'));
    const assets = [];
    for (const pin of AUDIO_RECORDINGS)
      assets.push({
        file: `${pin.sha256}.mp3`,
        bytes: verifyAudioFixtureBytes(await readFile(join(fixtures, `${pin.sha256}.mp3`)), pin),
      });
    const previewRoot = join(scratch, 'control');
    await createNativeControlRoot(previewRoot, assets, plan);
    command = await ownedCommand(
      [
        process.execPath,
        fileURLToPath(import.meta.url),
        plan === MP3_COCOA_CONTROL
          ? 'child-cocoa'
          : plan === MP3_BACKEND_CONTROL
            ? 'child-backend'
            : 'child',
        output,
        scratch,
        previewRoot,
      ],
      {
        ...options,
        env:
          cocoaEnvironment ??
          (plan === MP3_BACKEND_CONTROL ? nativeBackendEnvironment(options.env) : options.env),
        timeoutMs: MP3_CONTROL.commandTimeoutMs,
        log: join(output, 'browser.log'),
        receipt: join(output, 'browser-command.json'),
      },
    );
    const data = await readFile(join(output, 'report.json'));
    assert(data.length <= MP3_CONTROL.maximumReportBytes);
    report = JSON.parse(data);
    assert.equal(report.sourceRevision, source);
    if (plan === MP3_BACKEND_CONTROL) {
      const logPath = join(output, 'browser.log');
      assert((await lstat(logPath)).size <= plan.maximumLogBytes, 'Backend log cap exceeded');
      summary.backendLog = backendLogObservation(await readFile(logPath));
      await save(join(output, 'backend-log-summary.json'), summary.backendLog);
    }
    summary.status =
      nativeControlComplete(report, command, plan) &&
      (plan !== MP3_BACKEND_CONTROL || summary.backendLog.status === 'observed-category')
        ? 'completed-diagnostic'
        : 'failed';
  } catch (error) {
    summary.failure = failure(error);
  } finally {
    if (plan === MP3_COCOA_CONTROL) summary.ownerPreflightStatus = preflight?.status ?? 'not-run';
    summary.preparationStatus = preparation?.status ?? 'not-run';
    summary.commandStatus = command?.status ?? 'not-run';
    summary.observations =
      report?.rows?.map((row) => ({
        id: row.id,
        status: row.status,
        observation: row.observation,
        failure: row.failure,
      })) ?? [];
    summary.scope =
      'Native codec/delivery observations only; no game, Safari/iPhone, speaker, full-recording or performance qualification. Hosted scratch is retained until job teardown.';
    await save(join(output, 'summary.json'), summary);
    assert((await treeBytes(output)) <= MP3_CONTROL.maximumEvidenceBytes);
    if (summary.status !== 'completed-diagnostic') process.exitCode = 1;
  }
}
async function cocoaOwnerPreflight(output, scratch) {
  const report = {
    format: 'SoloNativeCocoaOwnerPreflightV1',
    sourceRevision: process.env.SOLO_TOOLING_REVISION,
    platform: process.platform,
    architecture: arch(),
    status: 'failed',
    qualificationEligible: false,
  };
  let owner;
  try {
    assert.equal(process.platform, 'darwin');
    assert.equal(arch(), 'x64');
    assert.equal(release().split('.')[0], MP3_COCOA_CONTROL.hostDarwinMajor);
    const modulePath = process.env.SOLO_PLAYWRIGHT_MODULE;
    assert(modulePath && resolve(modulePath) === modulePath);
    const info = JSON.parse(await readFile(join(dirname(modulePath), 'package.json'), 'utf8'));
    assert.equal(info.version, MP3_CONTROL.playwright);
    const { webkit } = await import(pathToFileURL(modulePath).href);
    assert(webkit.executablePath().includes(`/webkit-${MP3_CONTROL.webkitRevision}/`));
    const { createPersistentQualificationOwner } = await import(
      './solo-qualification-browser-context.mjs'
    );
    owner = createPersistentQualificationOwner({
      browserType: webkit,
      temporaryRoot: scratch,
      launchOptions: { headless: true },
      contextOptions: {
        viewport: { width: 1280, height: 800 },
        locale: 'en-US',
        serviceWorkers: 'block',
      },
    });
    report.owner = owner.report;
    const { context, browser } = await owner.launch();
    report.browserVersion = browser.version();
    assert.equal(report.browserVersion, MP3_CONTROL.browserVersion);
    const page = context.pages()[0] ?? (await context.newPage());
    await page.setContent('<!doctype html><title>Owned blank context</title>', { timeout: 5000 });
    const state = await bounded('owner-blank-page', () =>
      page.evaluate(() => ({
        documentURL: globalThis.location.href,
        mediaElements: globalThis.document.querySelectorAll('audio,video').length,
      })),
    );
    Object.assign(report, state);
    await sleep(1000);
  } catch (error) {
    report.failure = failure(error);
  } finally {
    if (owner) await owner.close();
    if (!report.failure && owner?.report.cleanup?.status === 'closed') report.status = 'closed';
    await save(join(output, 'owner-preflight.json'), report);
    if (report.status !== 'closed') process.exitCode = 1;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const plans = {
    run: MP3_CONTROL,
    'run-backend': MP3_BACKEND_CONTROL,
    'run-cocoa': MP3_COCOA_CONTROL,
    child: MP3_CONTROL,
    'child-backend': MP3_BACKEND_CONTROL,
    'child-cocoa': MP3_COCOA_CONTROL,
  };
  const mode = process.argv[2];
  if (mode === 'child-cocoa-owner') {
    assert.equal(process.argv.length, 5);
    await cocoaOwnerPreflight(...process.argv.slice(3).map((path) => resolve(path)));
  } else if (mode?.startsWith('run')) {
    assert.equal(process.argv.length, 4);
    requirePlan(plans[mode]);
    await parent(resolve(process.argv[3]), plans[mode]);
  } else {
    assert.equal(process.argv.length, 6);
    requirePlan(plans[mode]);
    await child(...process.argv.slice(3).map((path) => resolve(path)), plans[mode]);
  }
}
