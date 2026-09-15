import { Soundscape } from '../../../../../game/ui/audio.mjs';
import { createAudioMaster } from '../../../../../game/ui/audio-master.mjs';

const run = document.querySelector('#run');
const cancel = document.querySelector('#cancel');
const status = document.querySelector('#status');
const result = document.querySelector('#result');
let active = null;

function cancelOwned() {
  if (!active) return;
  active.aborted = true;
  active.master.setMuted(true);
  active.cleanup ??= active.sound.dispose();
}
cancel.addEventListener('click', cancelOwned);
window.addEventListener('pagehide', cancelOwned);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) cancelOwned();
});

// Wait for a bounded audio-time window. These waits belong to the signal
// measurement, not application loading or browser automation heuristics.
async function sample(owner, analyser, settle = 0.2, duration = 0.18) {
  const context = owner.sound.context;
  const start = context.currentTime + settle;
  const end = start + duration;
  const deadline = performance.now() + 4000;
  const buffer = new Float32Array(analyser.fftSize);
  let squares = 0;
  let peak = 0;
  let samples = 0;
  let frames = 0;
  while (context.currentTime < end) {
    if (owner.aborted || active !== owner) throw new Error('Check cancelled.');
    if (performance.now() > deadline || context.state !== 'running')
      throw new Error('Audio clock did not advance. Retry with an explicit Run gesture.');
    if (context.currentTime >= start) {
      analyser.getFloatTimeDomainData(buffer);
      for (const value of buffer) {
        squares += value * value;
        peak = Math.max(peak, Math.abs(value));
      }
      samples += buffer.length;
      frames++;
    }
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
  if (owner.aborted || active !== owner) throw new Error('Check cancelled.');
  if (!samples) throw new Error('No audio samples observed.');
  return { rms: Math.sqrt(squares / samples), peak, samples, frames, start, end };
}

run.addEventListener('click', async () => {
  if (active) return;
  const master = createAudioMaster({ muted: true, volume: 1 });
  const sound = new Soundscape({ audioMaster: master });
  const owner = { master, sound, aborted: false };
  active = owner;
  run.disabled = true;
  cancel.disabled = false;
  cancel.focus();
  const report = {
    format: 'revealline.native-master-signal-check.v1',
    startedAt: new Date().toISOString(),
    url: location.href,
    userAgent: navigator.userAgent,
    scope:
      'Actual Soundscape native Web Audio mixer; quiet fixture oscillators at music/sfx bus inputs; analyser after compressor. No native media, listening or physical-device qualification.',
    observations: [],
    checks: [],
  };
  const fixtures = [];
  let analyser;
  let context;
  try {
    status.textContent = 'Enabling the owned test audio context…';
    sound.configure({ master: 1, music: 0.6, sfx: 0.7 });
    const enabling = sound.enable();
    context = sound.context;
    const enabled = await enabling;
    if (owner.aborted || active !== owner) throw new Error('Check cancelled.');
    if (!enabled) throw new Error('Browser denied audio. Choose Run to retry.');
    report.sampleRate = context.sampleRate;
    analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    sound.compressor.connect(analyser);
    // AnalyserNode needs no output connection. The existing Soundscape
    // destination route remains unchanged; this branch only observes it.
    for (const [frequency, bus] of [
      [440, sound.musicBus],
      [660, sound.sfxBus],
    ]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.value = 0.008;
      oscillator.connect(gain);
      gain.connect(bus);
      oscillator.start();
      fixtures.push({ oscillator, gain });
    }
    for (const phase of [
      { id: 'initial-muted', muted: true, volume: 1 },
      { id: 'full', muted: false, volume: 1 },
      { id: 'quarter', muted: false, volume: 0.25 },
      { id: 'zero', muted: false, volume: 0 },
      { id: 'restored', muted: false, volume: 1 },
      { id: 'muted-after-playing', muted: true, volume: 1 },
    ]) {
      master.setMuted(phase.muted);
      master.setVolume(phase.volume);
      status.textContent = `Measuring ${phase.id}…`;
      report.observations.push({ ...phase, ...(await sample(owner, analyser)) });
    }
    const byId = Object.fromEntries(report.observations.map((entry) => [entry.id, entry]));
    const check = (name, pass, actual) => report.checks.push({ name, pass, actual });
    for (const id of ['initial-muted', 'zero', 'muted-after-playing'])
      check(`${id} has no measured signal`, byId[id].peak < 1e-8, byId[id].peak);
    check('unmuted fixture is present', byId.full.rms > 0.0001, byId.full.rms);
    const quarter = byId.quarter.rms / byId.full.rms;
    check('quarter volume applies once', Math.abs(quarter - 0.25) < 0.02, quarter);
    const restored = byId.restored.rms / byId.full.rms;
    check('restored signal matches initial full volume', Math.abs(restored - 1) < 0.05, restored);
    report.passed = report.checks.every((entry) => entry.pass);
  } catch (error) {
    report.passed = false;
    report.error = error.message;
  } finally {
    master.setMuted(true);
    for (const { oscillator, gain } of fixtures) {
      try {
        oscillator.stop();
      } catch {}
      oscillator.disconnect();
      gain.disconnect();
    }
    analyser?.disconnect();
    await (owner.cleanup ?? sound.dispose());
    master.dispose();
    if (owner.aborted) {
      report.passed = false;
      report.error = 'Check cancelled.';
    }
    report.contextStateAfterCleanup = context?.state ?? 'not-created';
    report.ownedContextClosed = !context || context.state === 'closed';
    if (!report.ownedContextClosed) {
      report.passed = false;
      report.error = 'The owned audio context did not close.';
    }
    if (active === owner) active = null;
    run.disabled = false;
    cancel.disabled = true;
    status.textContent =
      report.error ??
      (report.passed
        ? 'Signal checks passed. Owned context closed.'
        : 'Signal check failed; inspect the report.');
    result.textContent = JSON.stringify(report, null, 2);
    run.focus();
  }
});
