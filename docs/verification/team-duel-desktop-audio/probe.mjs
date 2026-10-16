import { Soundscape } from '../../../game/ui/audio.mjs';
import { createAudioMaster } from '../../../game/ui/audio-master.mjs';

const start = document.querySelector('#run');
const cancel = document.querySelector('#cancel');
const status = document.querySelector('#status');
const result = document.querySelector('#result');
const download = document.querySelector('#download');
let active = null;
let reportURL = null;
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const state = () => ({
  width: 40,
  height: 30,
  tick: 1,
  time: 1 / 60,
  status: 'running',
  cells: new Uint8Array(1200),
  totalClaimable: 1200,
  players: [
    { id: 0, x: 6, y: 5 },
    { id: 1, x: 34, y: 5 },
  ],
  enemies: [],
});
const fixtures = [
  ['warning', [{ type: 'emitter.warning' }]],
  ['support', [{ type: 'support.pulse', player: 0 }]],
  [
    'recovery',
    [
      { type: 'player.revived', player: 1 },
      { type: 'rescue.completed', player: 0, target: 1 },
    ],
  ],
  ['relay', [{ type: 'objective.captured', kind: 'relay' }, { type: 'shield.disabled' }]],
  ['stage', [{ type: 'objective.captured', kind: 'stage' }]],
  ['erosion', [{ type: 'environment.eroded', cells: [41] }]],
  [
    'overlap',
    [
      { type: 'support.pulse', player: 0 },
      { type: 'emitter.warning' },
      { type: 'rescue.completed', player: 0, target: 1 },
      { type: 'shield.disabled' },
    ],
  ],
  [
    'crowded-overlap',
    [
      'support.pulse',
      'rescue.completed',
      'shield.disabled',
      'objective.captured',
      'environment.eroded',
      'enemy.commit',
      'cells.claimed',
      'enemy.recovery',
    ].map((type) => ({ type, player: 0, indices: [41, 42] })),
  ],
  ['victory', [{ type: 'run.completed', status: 'won', tick: 1 }]],
];
const assertOwned = (owner) => {
  if (owner.aborted || active !== owner) throw new Error('Check cancelled.');
};
function cancelOwned() {
  if (!active) return;
  active.aborted = true;
  active.signalCancel();
  active.master.setMuted(true);
  active.cleanup ??= active.sound.dispose();
}
cancel.addEventListener('click', cancelOwned);
window.addEventListener('pagehide', () => {
  cancelOwned();
  if (reportURL) URL.revokeObjectURL(reportURL);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) cancelOwned();
});

async function sourcePins() {
  const pins = {};
  for (const file of [
    'audio.mjs',
    'audio-output.mjs',
    'feedback-director.mjs',
    'feedback-cues.mjs',
  ]) {
    const response = await fetch(new URL(`../../../game/ui/${file}`, import.meta.url));
    if (!response.ok) throw new Error(`Unable to identify ${file}.`);
    const bytes = await response.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    pins[file] = [...new Uint8Array(hash)].map((n) => n.toString(16).padStart(2, '0')).join('');
  }
  return pins;
}

// Overlapping native analyser windows establish presence/peak and a mono
// downmix, not unique PCM counts, true-peak, LUFS or perceived intelligibility.
async function measure(owner, analysers, { duration = 0.72, music = false } = {}) {
  const context = owner.sound.context;
  const end = context.currentTime + duration;
  const deadline = performance.now() + 5000;
  const channels = analysers.map((analyser) => new Float32Array(analyser.fftSize));
  let squares = 0,
    monoSquares = 0,
    peak = 0,
    monoPeak = 0,
    samples = 0,
    windows = 0;
  while (context.currentTime < end) {
    assertOwned(owner);
    if (context.state !== 'running' || performance.now() > deadline)
      throw new Error('The audio clock stopped. Retry with an explicit Run gesture.');
    if (music) owner.sound.update(true, { family: 'fpv' }, { status: 'running' });
    analysers.forEach((analyser, i) => analyser.getFloatTimeDomainData(channels[i]));
    for (let i = 0; i < channels[0].length; i++) {
      const left = channels[0][i],
        right = channels[1][i],
        mono = (left + right) / 2;
      squares += (left * left + right * right) / 2;
      monoSquares += mono * mono;
      peak = Math.max(peak, Math.abs(left), Math.abs(right));
      monoPeak = Math.max(monoPeak, Math.abs(mono));
    }
    samples += channels[0].length;
    windows++;
    await pause(12);
  }
  assertOwned(owner);
  if (!samples) throw new Error('No native output samples observed.');
  return {
    rms: Math.sqrt(squares / samples),
    peak,
    monoRms: Math.sqrt(monoSquares / samples),
    monoPeak,
    windows,
  };
}

start.addEventListener('click', async () => {
  if (active) return;
  if (reportURL) URL.revokeObjectURL(reportURL);
  reportURL = null;
  download.hidden = true;
  result.textContent = '';
  const master = createAudioMaster({ muted: false, volume: 0.65 });
  const sound = new Soundscape({ persistentMusic: true, audioMaster: master });
  const owner = { sound, master, aborted: false };
  owner.cancelled = new Promise((resolve) => {
    owner.signalCancel = resolve;
  });
  const waitOwned = async (operation) => {
    let timer;
    try {
      return await Promise.race([
        operation,
        owner.cancelled.then(() => {
          throw new Error('Check cancelled.');
        }),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Audio preparation timed out. Retry online.')),
            20000,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
  active = owner;
  start.disabled = true;
  cancel.disabled = false;
  cancel.focus();
  const report = {
    format: 'revealline.team-duel-native-cue-check.v1',
    startedAt: new Date().toISOString(),
    url: location.href,
    userAgent: navigator.userAgent,
    scope:
      'Native Soundscape/FeedbackDirector dispatch and mixer. Default local music/effects gains; explicit 65% shared master. Recorded WAV bank and deliberately unavailable-bank fallback. No MP3, uploaded replacements, acoustic output or subjective listening qualification.',
    observations: [],
    checks: [],
  };
  const check = (name, pass, actual) => report.checks.push({ name, pass, actual });
  let context, splitter;
  const analysers = [];
  try {
    status.textContent = 'Preparing the game’s audio effects…';
    sound.configure({ master: 1 });
    const enabling = sound.enable(); // Direct activation turn, before source/network preparation.
    context = sound.context;
    if (!(await waitOwned(enabling))) throw new Error('Browser denied audio. Choose Run to retry.');
    assertOwned(owner);
    report.sourcePins = await waitOwned(sourcePins());
    await waitOwned(Promise.all(sound.feedbackDirector.pending.values()));
    assertOwned(owner);
    const decoded = new Map(sound.feedbackDirector.buffers);
    report.decodedRecordings = decoded.size;
    for (const cue of [
      'focus',
      'warning',
      'deploy',
      'respawn',
      'gate',
      'pickup',
      'erosion',
      'reveal-small',
    ])
      if (!decoded.has(cue)) throw new Error(`The recorded test requires ${cue}; retry online.`);
    report.sampleRate = context.sampleRate;
    report.baseLatency = context.baseLatency ?? null;
    splitter = context.createChannelSplitter(2);
    sound.compressor.connect(splitter);
    for (let channel = 0; channel < 2; channel++) {
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      splitter.connect(analyser, channel);
      analysers.push(analyser);
    }
    // All effects were decoded above. Freeze readiness to exercise the exact
    // same event path when only an unrelated menu recording is available.
    sound.feedbackDirector.load = () => {};
    const dispatch = (events, options = {}) => {
      const snapshot = state();
      sound.events(
        events.map((event) => ({ tick: 1, time: 1, ...event })),
        snapshot,
        { family: 'fpv' },
        { board: 'team', mode: 'team', ...options },
      );
      return snapshot;
    };
    const reset = async () => {
      sound.reset();
      sound.pauseMusic();
      sound.gameplayPaused = false;
      master.setMuted(false);
      master.setVolume(0.65);
      // The analyser and compressor retain a short previous window.
      await pause(160);
      assertOwned(owner);
    };
    for (const bank of ['recorded', 'partial-fallback']) {
      sound.feedbackDirector.buffers =
        bank === 'recorded' ? new Map(decoded) : new Map([['focus', decoded.get('focus')]]);
      for (const [id, events] of fixtures) {
        await reset();
        status.textContent = `Measuring ${bank}: ${id}…`;
        dispatch(events);
        const voices = [...sound.voices].map(({ name, board, priority }) => ({
          name,
          board,
          priority,
        }));
        const reading = await measure(owner, analysers, {
          duration: id === 'victory' ? 2.45 : 0.72,
        });
        report.observations.push({ bank, id, voices, ...reading });
        if (id === 'crowded-overlap')
          check(`${bank}/crowded: feedback budget`, voices.length <= 16, voices.length);
        check(
          `${bank}/${id}: output and mono presence`,
          reading.rms > 0.00001 && reading.monoRms > 0.00001,
          { rms: reading.rms, monoRms: reading.monoRms },
        );
        check(`${bank}/${id}: sampled headroom`, reading.peak < 0.98, reading.peak);
      }
      await reset();
      status.textContent = `Measuring ${bank}: both Duel boards…`;
      for (const board of [0, 1])
        dispatch([{ type: 'cells.claimed', indices: [41, 42] }], {
          mode: 'versus',
          board,
          placement: { left: board / 2, width: 0.5 },
        });
      const boards = [...new Set([...sound.voices].map((voice) => voice.board))];
      const reading = await measure(owner, analysers);
      report.observations.push({ bank, id: 'duel-both-boards', boards, ...reading });
      check(`${bank}/Duel: both owners retained`, boards.includes(0) && boards.includes(1), boards);
      check(
        `${bank}/Duel: output, mono and sampled headroom`,
        reading.rms > 0.00001 && reading.monoRms > 0.00001 && reading.peak < 0.98,
        reading,
      );
      await reset();
      status.textContent = `Measuring ${bank}: zero master and volume restoration…`;
      master.setVolume(0);
      dispatch([{ type: 'emitter.warning' }]);
      const voicesAtZero = sound.voices.size;
      master.setVolume(0.65);
      const restored = await measure(owner, analysers, { duration: 0.45 });
      report.observations.push({ bank, id: 'zero-master-expired', voicesAtZero, ...restored });
      check(`${bank}/zero master: no pending one-shot`, voicesAtZero === 0, voicesAtZero);
      check(
        `${bank}/volume restoration: expired cue stays silent`,
        restored.peak < 1e-8,
        restored.peak,
      );
    }
    for (const mode of [
      'music-only',
      'music-and-warning',
      'music-paused-warning',
      'master-muted',
      'master-zero',
      'gameplay-paused',
    ]) {
      await reset();
      status.textContent = `Measuring ${mode}…`;
      const music = ['music-only', 'music-and-warning', 'master-muted', 'master-zero'].includes(
        mode,
      );
      if (music) sound.resumeMusic();
      if (mode === 'master-muted') master.setMuted(true);
      if (mode === 'master-zero') master.setVolume(0);
      if (mode === 'gameplay-paused') sound.pause();
      if (mode !== 'music-only') dispatch([{ type: 'emitter.warning' }]);
      const warningScheduled = [...sound.voices].some((voice) => voice.name === 'warning');
      if (['music-and-warning', 'music-paused-warning'].includes(mode))
        check(`${mode}: warning remains scheduled`, warningScheduled, warningScheduled);
      const reading = await measure(owner, analysers, { music });
      report.observations.push({
        bank: 'partial-fallback',
        id: mode,
        musicTransportPaused: sound.musicTransportPaused,
        warningScheduled,
        ...reading,
      });
      const silent = ['master-muted', 'master-zero', 'gameplay-paused'].includes(mode);
      check(
        `${mode}: ${silent ? 'silent' : 'output present'}`,
        silent ? reading.peak < 1e-8 : reading.rms > 0.00001,
        reading.peak,
      );
      check(`${mode}: sampled headroom`, reading.peak < 0.98, reading.peak);
    }
    report.passed = report.checks.every((entry) => entry.pass);
  } catch (error) {
    report.passed = false;
    report.error = error.message;
  } finally {
    master.setMuted(true);
    splitter?.disconnect();
    analysers.forEach((analyser) => analyser.disconnect());
    await (owner.cleanup ?? sound.dispose());
    master.dispose();
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
    start.disabled = false;
    cancel.disabled = true;
    status.textContent =
      report.error ??
      (report.passed
        ? 'Cue checks passed. Owned context closed.'
        : 'Cue check failed. Inspect the report.');
    const json = JSON.stringify(report, null, 2);
    result.textContent = json;
    reportURL = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    download.href = reportURL;
    download.download = 'revealline-team-duel-audio-check.json';
    download.hidden = false;
    start.focus();
  }
});
