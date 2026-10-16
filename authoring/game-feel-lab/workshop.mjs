import {
  CUES,
  SEQUENCE_FPS,
  SEQUENCE_TICKS,
  createSequenceClock,
  sequenceFrame,
} from './sequence.mjs';
import { canvasPixelBytes, drawBenchmark, measureRenderCost } from './render.mjs';
import { createPreviewLifecycle, retainControlFocus } from './lifecycle.mjs';
import { createBackgroundSelection, PHOTO_CHOICE } from './background.mjs';

const byId = (id) => document.getElementById(id);
const clock = createSequenceClock();
const canvases = [byId('reference'), byId('comparison')];
const contexts = canvases.map((canvas) => canvas.getContext('2d'));
const reducedPreference = matchMedia('(prefers-reduced-motion: reduce)');
byId('reduced').checked = reducedPreference.matches;
let measuring = false;
let last = null;
let cancelledMeasurement = false;
const backgrounds = createBackgroundSelection({
  onChange(selected) {
    byId('background').value = selected.key;
    byId('photo-attribution').hidden = !selected.photo;
    byId('photo-memory').hidden = !selected.photo;
    byId('photo-memory').textContent = selected.photo
      ? `Decoded photograph estimate: ${selected.photo.decodedBytes.toLocaleString()} bytes (${selected.photo.image.width} × ${selected.photo.image.height} × 4 RGBA). Separate from the canvases; excludes decoder, browser and GPU copies.`
      : '';
    if (!measuring) refresh();
  },
  onStatus(message) {
    byId('background-status').textContent = message;
  },
});
const settings = () => ({
  capture: byId('capture').checked,
  actors: byId('actors').checked,
  trail: byId('trail').checked,
  reduced: byId('reduced').checked,
  background: backgrounds.current.key === 'light' ? 'light' : 'dark',
  photo: backgrounds.current.photo?.image ?? null,
});
function paint(tick, options) {
  const scene = sequenceFrame(tick, options);
  drawBenchmark(contexts[0], scene, {
    reduced: options.reduced,
    background: options.background,
    photo: options.photo,
  });
  drawBenchmark(contexts[1], scene, options);
}
function refresh() {
  const options = settings();
  paint(clock.tick, options);
  byId('timeline').value = String(clock.tick);
  byId('time').textContent = `${(clock.tick / SEQUENCE_FPS).toFixed(2)} / 6.00 s`;
  byId('cue').textContent = sequenceFrame(clock.tick, options).phase;
  byId('play').textContent = clock.playing ? 'Pause' : 'Play';
}
byId('play').onclick = () => {
  if (clock.playing) clock.pause();
  else clock.play();
  last = null;
  refresh();
};
byId('restart').onclick = () => {
  clock.restart();
  refresh();
};
byId('step').onclick = () => {
  clock.step();
  refresh();
};
byId('timeline').oninput = () => {
  clock.seek(Number(byId('timeline').value));
  refresh();
};
for (const id of ['capture', 'actors', 'trail', 'reduced']) byId(id).onchange = refresh;
byId('background').onchange = () => {
  byId('photo-attribution').hidden = byId('background').value !== PHOTO_CHOICE;
  void backgrounds.select(byId('background').value);
};
for (const cue of CUES) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = cue.label;
  button.onclick = () => {
    clock.seek(cue.tick);
    refresh();
  };
  byId('cues').append(button);
}
const pixelBytes = canvasPixelBytes(canvases);
byId('memory').textContent =
  `Canvas pixel estimate: ${pixelBytes.toLocaleString()} bytes for two 384 × 224 RGBA surfaces. Excludes JavaScript data, compositing and GPU/browser copies; this is not total memory.`;
byId('measure').onclick = async () => {
  if (measuring || !lifecycle.active) return;
  const task = lifecycle.beginTask();
  measuring = true;
  clock.pause();
  refresh();
  const options = settings();
  // Prepare both history-dependent frame caches before timing any drawing.
  const measuredBackground = options.photo
    ? 'Synevyr photograph'
    : `${options.background} background`;
  sequenceFrame(0, options);
  const controls = [...document.querySelectorAll('button, input, select')];
  const restoreFocus = retainControlFocus(byId('measure'), document);
  controls.forEach((control) => {
    control.disabled = true;
  });
  byId('measurement').textContent = 'Measuring two-view draw calls…';
  try {
    const result = await measureRenderCost(
      (index) => paint((index * 3) % SEQUENCE_TICKS, options),
      { signal: task.signal },
    );
    if (task.current())
      byId('measurement').textContent =
        `Two-view draw cost with ${measuredBackground}: median ${result.medianMs.toFixed(2)} ms; p95 ${result.p95Ms.toFixed(2)} ms (${result.samples} samples after ${result.warmup} warmups). Excludes DOM layout and sequence preparation. This is not measured FPS or device performance certification.`;
  } catch (error) {
    if (task.current())
      byId('measurement').textContent = `Measurement unavailable: ${error.message}`;
  } finally {
    if (task.current()) {
      measuring = false;
      controls.forEach((control) => {
        control.disabled = false;
      });
      last = null;
      refresh();
    }
    restoreFocus(task.current());
    task.finish();
  }
};
function hold() {
  clock.pause();
  last = null;
  if (!measuring && lifecycle.active) refresh();
}
function loop(now) {
  if (!measuring && clock.playing && !document.hidden) {
    if (last !== null) clock.advance(Math.min((now - last) / 1000, 0.1));
    refresh();
  }
  last = now;
}
const lifecycle = createPreviewLifecycle({
  requestFrame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (id) => cancelAnimationFrame(id),
  initialActive: !document.hidden,
  onFrame: loop,
  onSuspend() {
    clock.pause();
    last = null;
    cancelledMeasurement ||= measuring;
    measuring = false;
    backgrounds.suspend();
  },
  onResume() {
    clock.pause();
    last = null;
    document.querySelectorAll('button, input, select').forEach((control) => {
      control.disabled = false;
    });
    if (cancelledMeasurement) {
      byId('measurement').textContent =
        'Measurement cancelled when the page was left. Measure again when ready.';
      cancelledMeasurement = false;
    }
    backgrounds.resume();
    refresh();
  },
});
function visibility() {
  if (document.hidden) lifecycle.suspend();
  else lifecycle.resume();
}
function pagehide(event) {
  if (event.persisted) lifecycle.suspend();
  else {
    lifecycle.dispose();
    backgrounds.dispose();
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('blur', hold);
    window.removeEventListener('pagehide', pagehide);
    window.removeEventListener('pageshow', pageshow);
  }
}
function pageshow(event) {
  if (event.persisted && !document.hidden) lifecycle.resume();
}
document.addEventListener('visibilitychange', visibility);
window.addEventListener('blur', hold);
window.addEventListener('pagehide', pagehide);
window.addEventListener('pageshow', pageshow);
if (document.hidden) backgrounds.suspend();
refresh();
