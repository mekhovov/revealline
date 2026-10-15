import { Soundscape } from '../../../game/ui/audio.mjs';
import { createAudioMaster } from '../../../game/ui/audio-master.mjs';
import { importThemeBundle, hashPresentationBytes } from '../../../game/presentation/bundle.mjs';
import { holdNextDecode, observeBufferStarts } from './studio-probe-model.mjs';
import {
  codecFixtures,
  codecsFromVerifiedBundle,
  inspectCueVoices,
  dispatchCodecEvent,
  truncatedCueReader,
  waitForFallbackEnd,
} from './studio-codecs-model.mjs';

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
    const slots = codecsFromVerifiedBundle(bundle);
    const sha256 = await hashPresentationBytes(new Uint8Array(await file.arrayBuffer()));
    if (owner.signal.aborted || importing !== owner) return;
    candidate = {
      slots,
      file: { name: file.name, bytes: file.size, sha256 },
      themeRevision: slots.theme.revision,
    };
    status.textContent = `Ready: ${file.name}; failure WAV, pickup OGG and victory MP3 verified. Choose Run.`;
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
    'game/couch/couch.mjs',
    'game/media-audio.mjs',
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
  for (const file of [
    'studio-codecs.html',
    'studio-codecs.mjs',
    'studio-codecs-model.mjs',
    'studio-probe-model.mjs',
  ]) {
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
    format: 'revealline.studio-native-codecs-check.v1',
    startedAt: new Date().toISOString(),
    url: location.href,
    userAgent: navigator.userAgent,
    file: selected.file,
    themeRevision: selected.themeRevision,
    assets: Object.fromEntries(
      [...selected.slots.selected].map(([slot, value]) => [slot, value.asset]),
    ),
    scope:
      'Read-only production import of a normally exported Studio bundle; exact retained WAV, Vorbis OGG and MP3 fixtures; actual native decoding and game audio owners. Controlled event dispatch, delayed delivery and truncated-read fault injection. No subjective listening, physical speakers, natural gameplay, universal codec support or public edition certification.',
    checks: [],
    observations: [],
    decoded: {},
  };
  const check = (name, pass, actual) => report.checks.push({ name, pass: !!pass, actual });
  let context,
    splitter,
    starts,
    tick = 0;
  const analysers = [];
  try {
    sound.configure({ master: 1 });
    const enabling = sound.enable(); // Direct user gesture precedes asynchronous preparation.
    context = sound.context;
    if (!(await waitOwned(enabling)) || context?.state !== 'running')
      throw new Error('Audio did not start. Choose Run again.');
    report.sourcePins = await waitOwned(sourcePins());
    await waitOwned(Promise.all(sound.feedbackDirector.pending.values()));
    for (const name of ['impact', 'loss', 'pickup'])
      if (!sound.feedbackDirector.buffers.has(name))
        throw new Error(`Recorded ${name} did not load.`);
    report.recordedBank = [...sound.feedbackDirector.buffers.keys()].sort();
    report.sampleRate = context.sampleRate;
    sound.feedbackDirector.load = () => {}; // Only after all recorded decodes settle.
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
    const dispatch = (type, board = 'team', lost = false) =>
      dispatchCodecEvent(sound, { type, board, lost, tick: ++tick });
    const reset = async () => {
      sound.reset();
      master.setMuted(false);
      master.setVolume(0.65);
      await waitOwned(sound.resume());
      sound.pauseMusic();
      await waitOwned(pause(160));
    };
    const inspect = (fixture, buffer) => inspectCueVoices(sound, fixture.cue, buffer);
    const expectOwners = (label, fixture, buffer, boards, before) => {
      const voices = inspect(fixture, buffer),
        scheduled = starts.count - before;
      check(
        label,
        voices.exact === boards.length &&
          voices.other === 0 &&
          JSON.stringify(voices.owners) === JSON.stringify(boards) &&
          scheduled === boards.length,
        { ...voices, bufferStarts: scheduled },
      );
    };
    for (const fixture of codecFixtures) {
      const { cue } = fixture;
      const readAudio = selected.slots.readAudio;
      await reset();
      status.textContent = `Checking ${cue}: native ${fixture.mime} decoding…`;
      sound.setPublishedAudio(readAudio);
      const gate = gateDecode(),
        preparation = sound.publishedAudio.prepare([cue]);
      const decoded = await waitOwned(gate.entered);
      gate.restore();
      await waitOwned(preparation);
      report.decoded[cue] = {
        duration: decoded.duration,
        frames: decoded.length,
        channels: decoded.numberOfChannels,
        sampleRate: decoded.sampleRate,
      };
      check(
        `${cue}: retained original decodes and caches`,
        sound.publishedAudio.has(cue) &&
          decoded.length > 0 &&
          decoded.numberOfChannels === fixture.channels &&
          decoded.duration >= fixture.duration[0] &&
          decoded.duration <= fixture.duration[1],
        report.decoded[cue],
      );
      await reset();
      let before = starts.count;
      sound.publishedAudio.play(cue, { board: 'isolated', feedback: true, priority: 4 });
      expectOwners(
        `${cue}: isolated exact buffer, no additional cue`,
        fixture,
        decoded,
        ['isolated'],
        before,
      );
      const reading = await measure(owner, analysers, decoded.duration + 0.15);
      report.observations.push({ id: `${cue}-isolated`, ...reading });
      check(
        `${cue}: isolated digital and mono output`,
        reading.rms > 1e-5 && reading.monoRms > 1e-5,
        reading,
      );
      check(`${cue}: sampled headroom`, reading.peak < 0.98, reading.peak);
      await reset();
      before = starts.count;
      dispatch(fixture.event);
      expectOwners(`${cue}: Team event owns exact replacement`, fixture, decoded, ['team'], before);
      if (cue !== 'victory') {
        await reset();
        before = starts.count;
        dispatch(fixture.event, 0);
        dispatch(fixture.event, 1);
        expectOwners(
          `${cue}: both Duel boards own exact replacements`,
          fixture,
          decoded,
          [0, 1],
          before,
        );
      }
      if (cue === 'pickup') {
        await reset();
        before = starts.count;
        dispatch('powerup.collected');
        expectOwners(
          'pickup: Team powerup owns exact replacement',
          fixture,
          decoded,
          ['team'],
          before,
        );
        await reset();
        before = starts.count;
        dispatch('powerup.collected', 0);
        dispatch('powerup.collected', 1);
        expectOwners(
          'pickup: powerup events preserve both Duel owners',
          fixture,
          decoded,
          [0, 1],
          before,
        );
      }
      if (cue !== 'pickup') {
        await reset();
        before = starts.count;
        dispatch('run.completed', 0, cue === 'failure');
        dispatch('run.completed', 1, cue === 'failure');
        check(
          `${cue}: Duel board endings schedule nothing`,
          starts.count === before && sound.voices.size === 0,
          { bufferStarts: starts.count - before, activeVoices: sound.voices.size },
        );
        dispatch('run.completed', 'duel-result', cue === 'failure');
        expectOwners(
          `${cue}: single Duel host result owns exact replacement`,
          fixture,
          decoded,
          ['duel-result'],
          before,
        );
        if (cue === 'failure') {
          await reset();
          before = starts.count;
          dispatch('run.completed', 'team', true);
          expectOwners(
            'failure: Team defeat owns exact replacement',
            fixture,
            decoded,
            ['team'],
            before,
          );
        }
      }
      for (const control of ['mute', 'zero-master', 'gameplay-pause']) {
        await reset();
        status.textContent = `Checking ${cue}: ${control}…`;
        dispatch(fixture.event);
        const hadActive = inspect(fixture, decoded).exact === 1;
        if (control === 'mute') master.setMuted(true);
        else if (control === 'zero-master') master.setVolume(0);
        else sound.pause();
        check(
          `${cue}/${control}: retires active cue`,
          hadActive && sound.voices.size === 0,
          sound.voices.size,
        );
        before = starts.count;
        await waitOwned(pause(200)); // Beyond routine/failure cooldowns; result tick is fresh.
        dispatch(fixture.event);
        check(
          `${cue}/${control}: rejects fresh event`,
          starts.count === before && sound.voices.size === 0,
          { bufferStarts: starts.count - before, activeVoices: sound.voices.size },
        );
        before = starts.count;
        if (control === 'mute') master.setMuted(false);
        else if (control === 'zero-master') master.setVolume(0.65);
        else await waitOwned(sound.resume());
        await waitOwned(pause(160));
        const restored = await measure(owner, analysers, 0.22);
        check(
          `${cue}/${control}: restoration never replays`,
          starts.count === before && sound.voices.size === 0 && restored.peak < 1e-8,
          { bufferStarts: starts.count - before, ...restored },
        );
        before = starts.count;
        dispatch(fixture.event);
        expectOwners(
          `${cue}/${control}: fresh event recovers exact replacement`,
          fixture,
          decoded,
          ['team'],
          before,
        );
      }
      for (const action of ['late-completion', 'cancel-pending', 'close-owner']) {
        await reset();
        status.textContent = `Checking ${cue}: ${action}…`;
        sound.setPublishedAudio(readAudio);
        const published = sound.publishedAudio,
          held = gateDecode();
        if (action === 'late-completion') {
          dispatch(fixture.event);
          const voices = inspect(fixture, decoded);
          check(
            `${cue}: cold event uses fallback without custom cue`,
            voices.exact === 0 && voices.other > 0,
            voices,
          );
        }
        const pending = published.prepare([cue]);
        const actual = await waitOwned(held.entered);
        check(
          `${cue}/${action}: native decode held before adoption`,
          actual.length > 0 && !published.has(cue),
          { frames: actual.length, cached: published.has(cue) },
        );
        if (action === 'cancel-pending') published.cancelPending();
        if (action === 'close-owner') sound.setPublishedAudio(null);
        if (action === 'late-completion') {
          // Keep normal event identity and the live decode owner intact. The
          // native fallback ends by its own scheduled source.onended callback.
          const generation = sound.feedbackDirector.generation;
          before = starts.count;
          const ended = await waitOwned(
            waitForFallbackEnd(sound, {
              wait: pause,
              assertOwned: () => assertOwned(owner),
            }),
          );
          check(
            `${cue}: fallback finishes naturally before late delivery`,
            sound.feedbackDirector.generation === generation &&
              sound.publishedAudio === published &&
              !published.has(cue) &&
              starts.count === before,
            {
              ...ended,
              generationBefore: generation,
              generationAfter: sound.feedbackDirector.generation,
              bufferStarts: starts.count - before,
            },
          );
        } else {
          // These distinct cases intentionally retire the canceled/closed
          // event before releasing its now-unowned decoder result.
          sound.reset();
          before = starts.count;
        }
        held.restore();
        await waitOwned(pending);
        await waitOwned(pause(160));
        const delivered = await measure(owner, analysers, 0.22);
        check(
          `${cue}/${action}: no expired event replays`,
          starts.count === before && sound.voices.size === 0 && delivered.peak < 1e-8,
          { bufferStarts: starts.count - before, ...delivered },
        );
        check(
          `${cue}/${action}: exact cache ownership`,
          published.has(cue) === (action === 'late-completion'),
          published.has(cue),
        );
        if (action === 'late-completion') {
          before = starts.count;
          dispatch(fixture.event);
          expectOwners(
            `${cue}: only fresh event uses late-ready buffer`,
            fixture,
            actual,
            ['team'],
            before,
          );
        }
      }
      await reset();
      status.textContent = `Checking ${cue}: rejected truncated decoder input…`;
      // Fault injection affects only this temporary reader. The imported bundle
      // and its verified originals are unchanged; this does not test import rejection.
      sound.setPublishedAudio(truncatedCueReader(selected.slots, cue));
      const originalDecode = context.decodeAudioData;
      let attempts = 0,
        rejection = null;
      context.decodeAudioData = async (...args) => {
        attempts++;
        try {
          return await originalDecode.apply(context, args);
        } catch (error) {
          rejection = { name: error.name, message: error.message };
          throw error;
        }
      };
      before = starts.count;
      try {
        await waitOwned(sound.publishedAudio.prepare([cue]));
      } finally {
        context.decodeAudioData = originalDecode;
      }
      check(
        `${cue}: native decoder rejects nine-byte truncation`,
        attempts === 1 && rejection && !sound.publishedAudio.has(cue) && starts.count === before,
        {
          attempts,
          rejection,
          cached: sound.publishedAudio.has(cue),
          bufferStarts: starts.count - before,
        },
      );
      dispatch(fixture.event);
      const fallback = inspect(fixture, decoded);
      check(
        `${cue}: rejected custom decode retains fallback`,
        fallback.exact === 0 && fallback.other > 0,
        fallback,
      );
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
        ? 'Codec checks passed. Owned context closed.'
        : 'A codec check failed. Inspect the report.');
    const json = JSON.stringify(report, null, 2);
    output.textContent = json;
    reportURL = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    download.href = reportURL;
    download.download = 'revealline-studio-codecs-check.json';
    download.hidden = false;
    start.focus();
  }
});
