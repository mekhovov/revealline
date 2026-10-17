import { Soundscape } from '../../../game/ui/audio.mjs';
import { createAudioMaster } from '../../../game/ui/audio-master.mjs';
import { importThemeBundle, hashPresentationBytes } from '../../../game/presentation/bundle.mjs';
import {
  captureFromVerifiedBundle,
  captureVoices,
  holdNextDecode,
  observeBufferStarts,
} from './studio-probe-model.mjs';

const input = document.querySelector('#bundle');
const start = document.querySelector('#run');
const cancel = document.querySelector('#cancel');
const status = document.querySelector('#status');
const output = document.querySelector('#result');
const download = document.querySelector('#download');
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let candidate = null,
  active = null,
  importing = null,
  reportURL = null;
const clearReport = () => {
  if (reportURL) URL.revokeObjectURL(reportURL);
  reportURL = null;
  download.hidden = true;
  output.textContent = '';
};
const assertOwned = (owner) => {
  if (owner.aborted || active !== owner) throw new Error('Check cancelled.');
};
function cancelOwned() {
  if (importing) {
    importing.abort();
    status.textContent = 'Import cancelled. Choose the file again.';
  }
  if (!active) return;
  active.aborted = true;
  active.signalCancel();
  active.gates.forEach((gate) => gate.restore());
  active.master.setMuted(true);
  active.cleanup ??= active.sound.dispose();
}
cancel.addEventListener('click', cancelOwned);
window.addEventListener('pagehide', () => {
  cancelOwned();
  clearReport();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) cancelOwned();
});
input.addEventListener('change', async () => {
  cancelOwned();
  clearReport();
  candidate = null;
  start.disabled = true;
  const file = input.files[0];
  if (!file) return;
  const owner = new AbortController();
  importing = owner;
  cancel.disabled = false;
  status.textContent = 'Verifying the Studio bundle and its original bytes…';
  try {
    const bundle = await importThemeBundle(file, { signal: owner.signal });
    const capture = captureFromVerifiedBundle(bundle);
    const sha256 = await hashPresentationBytes(new Uint8Array(await file.arrayBuffer()));
    if (owner.signal.aborted || importing !== owner) return;
    candidate = {
      capture,
      file: { name: file.name, bytes: file.size, sha256 },
      themeRevision: capture.theme.revision,
    };
    status.textContent = `Ready: ${file.name}; capture original ${capture.blob.size} bytes. Choose Run.`;
    start.disabled = false;
  } catch (error) {
    if (importing === owner)
      status.textContent = owner.signal.aborted
        ? 'Import cancelled. Choose the file again.'
        : error.message;
  } finally {
    if (importing === owner) {
      importing = null;
      cancel.disabled = true;
    }
  }
});

async function sourcePins() {
  const paths = [
    'game/ui/audio.mjs',
    'game/ui/audio-master.mjs',
    'game/ui/audio-output.mjs',
    'game/ui/feedback-director.mjs',
    'game/ui/feedback-cues.mjs',
    'game/ui/published-audio.mjs',
    'game/presentation/bundle.mjs',
    'game/presentation/model.mjs',
    'game/presentation/document-codec.mjs',
  ];
  const pins = {};
  for (const path of paths) {
    const response = await fetch(new URL(`../../../${path}`, import.meta.url));
    if (!response.ok) throw new Error(`Unable to identify ${path}.`);
    pins[path] = await hashPresentationBytes(new Uint8Array(await response.arrayBuffer()));
  }
  for (const file of ['studio.html', 'studio-probe.mjs', 'studio-probe-model.mjs']) {
    const response = await fetch(new URL(file, import.meta.url));
    if (!response.ok) throw new Error(`Unable to identify ${file}.`);
    pins[file] = await hashPresentationBytes(new Uint8Array(await response.arrayBuffer()));
  }
  return pins;
}

// Overlapping analyser windows measure digital presence and sampled headroom;
// they are not unique PCM samples, true peak, loudness or audible assessment.
async function measure(owner, analysers, duration = 0.35) {
  const context = owner.sound.context;
  const until = context.currentTime + duration,
    deadline = performance.now() + 5000;
  const data = analysers.map((analyser) => new Float32Array(analyser.fftSize));
  let sum = 0,
    monoSum = 0,
    count = 0,
    peak = 0,
    windows = 0;
  while (context.currentTime < until) {
    assertOwned(owner);
    if (context.state !== 'running' || performance.now() > deadline)
      throw new Error('Audio clock stopped. Retry while this page is visible.');
    analysers.forEach((analyser, i) => analyser.getFloatTimeDomainData(data[i]));
    for (let i = 0; i < data[0].length; i++) {
      const left = data[0][i],
        right = data[1][i];
      sum += (left * left + right * right) / 2;
      monoSum += ((left + right) / 2) ** 2;
      peak = Math.max(peak, Math.abs(left), Math.abs(right));
      count++;
    }
    windows++;
    await pause(12);
  }
  return { rms: Math.sqrt(sum / count), monoRms: Math.sqrt(monoSum / count), peak, windows };
}

start.addEventListener('click', async () => {
  if (!candidate || active) return;
  clearReport();
  const selected = candidate;
  const master = createAudioMaster({ muted: false, volume: 0.65 });
  const sound = new Soundscape({ persistentMusic: true, audioMaster: master });
  const owner = { sound, master, gates: [], aborted: false };
  owner.cancelled = new Promise((resolve) => {
    owner.signalCancel = resolve;
  });
  active = owner;
  const waitOwned = async (operation) => {
    let timer;
    try {
      const result = await Promise.race([
        operation,
        owner.cancelled.then(() => {
          throw new Error('Check cancelled.');
        }),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Check timed out. Retry.')), 20000);
        }),
      ]);
      assertOwned(owner);
      return result;
    } finally {
      clearTimeout(timer);
    }
  };
  start.disabled = input.disabled = true;
  cancel.disabled = false;
  cancel.focus();
  const report = {
    format: 'revealline.studio-restored-native-cue-check.v1',
    startedAt: new Date().toISOString(),
    url: location.href,
    userAgent: navigator.userAgent,
    file: selected.file,
    themeRevision: selected.themeRevision,
    capture: selected.capture.asset,
    scope:
      'Read-only production .rltheme import; native AudioContext decoding; actual Soundscape, PublishedCues and FeedbackDirector. Controlled delay holds the real decoder result. No Studio persistence, listening, physical speaker or public edition certification.',
    checks: [],
    observations: [],
  };
  const check = (name, pass, actual) => {
    report.checks.push({ name, pass, actual });
  };
  let context, splitter, starts;
  const analysers = [];
  try {
    sound.configure({ master: 1 });
    // Keep unlock on the direct user gesture, ahead of all asynchronous work.
    const enabling = sound.enable();
    context = sound.context;
    if (!(await waitOwned(enabling)) || context?.state !== 'running')
      throw new Error('Audio did not start. Choose Run again.');
    report.sourcePins = await waitOwned(sourcePins());
    await waitOwned(Promise.all(sound.feedbackDirector.pending.values()));
    if (!sound.feedbackDirector.buffers.has('reveal-small'))
      throw new Error('Recorded capture bank did not load. Retry with the server available.');
    report.recordedBank = [...sound.feedbackDirector.buffers.keys()].sort();
    report.sampleRate = context.sampleRate;
    sound.feedbackDirector.load = () => {}; // All recorded inputs are settled before decode gates.
    sound.pauseMusic();
    starts = observeBufferStarts(context);
    splitter = context.createChannelSplitter(2);
    sound.compressor.connect(splitter);
    for (let i = 0; i < 2; i++) {
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      splitter.connect(analyser, i);
      analysers.push(analyser);
    }
    const gateDecode = () => {
      const gate = holdNextDecode(context);
      owner.gates.push(gate);
      return gate;
    };
    const readAudio = selected.capture.readAudio;
    sound.setPublishedAudio(readAudio);
    const gate = gateDecode();
    const preparing = sound.publishedAudio.prepare(['capture']);
    const decoded = await waitOwned(gate.entered);
    gate.restore();
    await waitOwned(preparing);
    report.decodedCapture = {
      duration: decoded.duration,
      frames: decoded.length,
      channels: decoded.numberOfChannels,
      sampleRate: decoded.sampleRate,
    };
    check(
      'Imported capture decoded and cached',
      sound.publishedAudio.has('capture'),
      report.decodedCapture,
    );
    let tick = 0;
    const dispatch = (board = 'team') => {
      const run = {
        width: 40,
        height: 30,
        cells: new Uint8Array(1200),
        totalClaimable: 1200,
        status: 'running',
        players: [
          { id: 0, x: 6, y: 5 },
          { id: 1, x: 34, y: 5 },
        ],
        enemies: [],
      };
      sound.events(
        [
          {
            type: 'cells.claimed',
            player: 0,
            indices: [41, 42],
            tick: ++tick,
            time: context.currentTime,
          },
        ],
        run,
        {},
        {
          mode: board === 'team' ? 'team' : 'versus',
          board,
          placement: board === 'team' ? undefined : { left: board / 2, width: 0.5 },
        },
      );
    };
    const reset = async () => {
      sound.reset();
      master.setMuted(false);
      master.setVolume(0.65);
      await waitOwned(sound.resume());
      sound.pauseMusic();
      await waitOwned(pause(160));
    };
    await reset();
    status.textContent = 'Measuring the restored capture alone…';
    const isolatedBefore = starts.count;
    sound.publishedAudio.play('capture', { board: 'probe-isolated', feedback: true, priority: 4 });
    const isolatedVoices = captureVoices(sound, decoded);
    check(
      'Isolated capture: exact buffer is the only scheduled cue',
      isolatedVoices.exactDecodedBuffer &&
        isolatedVoices.custom === 1 &&
        sound.voices.size === 1 &&
        starts.count === isolatedBefore + 1,
      { ...isolatedVoices, bufferStarts: starts.count - isolatedBefore },
    );
    const isolatedReading = await measure(owner, analysers);
    report.observations.push({ id: 'capture-isolated', ...isolatedReading });
    check(
      'Isolated capture: digital and mono output present',
      isolatedReading.rms > 0.00001 && isolatedReading.monoRms > 0.00001,
      isolatedReading,
    );
    check('Isolated capture: sampled headroom', isolatedReading.peak < 0.98, isolatedReading.peak);
    for (const boards of [['team'], [0, 1]]) {
      await reset();
      const label = boards.length === 1 ? 'Team' : 'Duel';
      status.textContent = `Measuring restored capture: ${label}…`;
      boards.forEach(dispatch);
      const voices = captureVoices(sound, decoded);
      check(
        `${label}: exact restored buffer and owners`,
        voices.exactDecodedBuffer && JSON.stringify(voices.owners) === JSON.stringify(boards),
        voices,
      );
      check(
        `${label}: no recorded capture duplicate`,
        voices.nativeReveal === 0,
        voices.nativeReveal,
      );
      const reading = await measure(owner, analysers);
      report.observations.push({ id: label, voices, ...reading });
      check(
        `${label}: digital and mono output present`,
        reading.rms > 0.00001 && reading.monoRms > 0.00001,
        reading,
      );
      check(`${label}: sampled headroom`, reading.peak < 0.98, reading.peak);
    }
    for (const control of ['mute', 'zero-master', 'gameplay-pause']) {
      await reset();
      status.textContent = `Checking restored capture: ${control}…`;
      dispatch();
      const hadActiveCapture = captureVoices(sound, decoded).custom === 1;
      if (control === 'mute') master.setMuted(true);
      else if (control === 'zero-master') master.setVolume(0);
      else sound.pause();
      check(
        `${control}: retires active cue`,
        hadActiveCapture && sound.voices.size === 0,
        sound.voices.size,
      );
      const startsWhileBlocked = starts.count;
      // Exceed the 160 ms routine cooldown so a rejected event exercises the
      // actual mute/pause gate instead of merely matching the prior cue.
      await waitOwned(pause(200));
      dispatch();
      check(
        `${control}: rejects fresh cue after cooldown`,
        sound.voices.size === 0 && starts.count === startsWhileBlocked,
        { bufferStarts: starts.count - startsWhileBlocked, activeVoices: sound.voices.size },
      );
      const startsBeforeRestore = starts.count;
      if (control === 'mute') master.setMuted(false);
      else if (control === 'zero-master') master.setVolume(0.65);
      else await waitOwned(sound.resume());
      await waitOwned(pause(160));
      const reading = await measure(owner, analysers, 0.22);
      const restoredStarts = starts.count - startsBeforeRestore;
      report.observations.push({
        id: `${control}-restored`,
        bufferStarts: restoredStarts,
        ...reading,
      });
      check(
        `${control}: restoration does not replay`,
        restoredStarts === 0 && sound.voices.size === 0 && reading.peak < 1e-8,
        { bufferStarts: restoredStarts, ...reading },
      );
      dispatch();
      check(
        `${control}: fresh event still uses restored cue`,
        captureVoices(sound, decoded).exactDecodedBuffer,
        captureVoices(sound, decoded),
      );
    }
    for (const action of ['late-completion', 'cancel-pending', 'close-owner']) {
      await reset();
      status.textContent = `Checking native decode: ${action}…`;
      sound.setPublishedAudio(readAudio);
      const published = sound.publishedAudio,
        held = gateDecode();
      let preparation;
      if (action === 'late-completion') {
        dispatch();
        const before = captureVoices(sound, decoded);
        check(
          'Cold capture uses ready recorded fallback once',
          before.nativeReveal === 1 && before.custom === 0,
          before,
        );
        preparation = published.prepare(['capture']);
      } else preparation = published.prepare(['capture']);
      const actualDecoded = await waitOwned(held.entered);
      check(
        `${action}: actual native decode completed while delivery held`,
        actualDecoded.length > 0 && !published.has('capture'),
        { frames: actualDecoded.length, cached: published.has('capture') },
      );
      if (action === 'cancel-pending') published.cancelPending();
      if (action === 'close-owner') sound.setPublishedAudio(null);
      // Retire the expired fallback before releasing decode delivery. A late
      // completion must neither schedule a source nor resurrect that event.
      sound.reset();
      const startsBeforeDelivery = starts.count;
      held.restore();
      await waitOwned(preparation);
      await waitOwned(pause(160));
      const reading = await measure(owner, analysers, 0.22);
      const deliveredStarts = starts.count - startsBeforeDelivery;
      report.observations.push({
        id: action,
        cached: published.has('capture'),
        bufferStarts: deliveredStarts,
        ...reading,
      });
      check(
        `${action}: no late replay`,
        deliveredStarts === 0 && sound.voices.size === 0 && reading.peak < 1e-8,
        { bufferStarts: deliveredStarts, ...reading },
      );
      check(
        `${action}: cache ownership`,
        published.has('capture') === (action === 'late-completion'),
        published.has('capture'),
      );
      if (action === 'late-completion') {
        dispatch();
        check(
          'After late readiness only a fresh event uses custom capture',
          captureVoices(sound, actualDecoded).exactDecodedBuffer &&
            captureVoices(sound, actualDecoded).nativeReveal === 0,
          captureVoices(sound, actualDecoded),
        );
      }
    }
    report.passed = report.checks.every((entry) => entry.pass);
  } catch (error) {
    report.passed = false;
    report.error = error.message;
  } finally {
    owner.gates.forEach((gate) => gate.restore());
    master.setMuted(true);
    splitter?.disconnect();
    analysers.forEach((analyser) => analyser.disconnect());
    await (owner.cleanup ?? sound.dispose());
    master.dispose();
    starts?.restore();
    if (owner.aborted) {
      report.passed = false;
      report.error = 'Check cancelled.';
    }
    report.contextStateAfterCleanup = context?.state ?? 'not-created';
    if (context && context.state !== 'closed') {
      report.passed = false;
      report.error = 'Owned audio context did not close.';
    }
    if (active === owner) active = null;
    start.disabled = !candidate;
    input.disabled = false;
    cancel.disabled = true;
    status.textContent =
      report.error ??
      (report.passed
        ? 'Restored cue checks passed. Owned context closed.'
        : 'A restored cue check failed. Inspect the report.');
    const json = JSON.stringify(report, null, 2);
    output.textContent = json;
    reportURL = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    download.href = reportURL;
    download.download = 'revealline-studio-restored-audio-check.json';
    download.hidden = false;
    start.focus();
  }
});
