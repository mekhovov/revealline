import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  DESTRUCTION_CATEGORIES,
  destructionSoundRecipe,
} from '../../../game/ui/destruction-audio.mjs';

const rate = 48000;
function maximum50ms(samples) {
  const window = rate / 20;
  let energy = 0,
    maximum = 0;
  for (let index = 0; index < samples.length; index++) {
    energy += samples[index] ** 2;
    if (index >= window) energy -= samples[index - window] ** 2;
    maximum = Math.max(maximum, energy);
  }
  return 10 * Math.log10(Math.max(1e-24, maximum / window));
}

function noiseAccent() {
  // Same deterministic white-noise source and standard bandpass coefficients
  // as Soundscape's snare path: 1600 Hz, Q0.7. Browser DSP is checked separately.
  let seed = 0x17a2,
    x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;
  const omega = (2 * Math.PI * 1600) / rate;
  const alpha = Math.sin(omega) / (2 * 0.7);
  const a0 = 1 + alpha,
    a1 = (-2 * Math.cos(omega)) / a0,
    a2 = (1 - alpha) / a0;
  return Float64Array.from({ length: rate / 4 }, () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const x = seed / 0x80000000 - 1;
    const y = (alpha / a0) * (x - x2) - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    return y;
  });
}

function fallback(recipe) {
  const output = new Float64Array(Math.ceil(recipe.maxDuration * rate));
  const noise = noiseAccent();
  for (const layer of [recipe.tone, ...recipe.layers]) {
    const attack = Math.min(0.005, layer.duration / 3);
    const pitchRate = Math.log(layer.to / layer.from) / layer.duration;
    const offset = Math.round((layer.delay ?? 0) * rate);
    for (let index = 0; index < Math.round(layer.duration * rate); index++) {
      const time = index / rate;
      const phase = (2 * Math.PI * layer.from * (Math.exp(pitchRate * time) - 1)) / pitchRate;
      const signal =
        layer.kind === 'snare'
          ? (noise[index] ?? 0)
          : layer.type === 'sine'
            ? Math.sin(phase)
            : (2 / Math.PI) * Math.asin(Math.sin(phase));
      const envelope =
        time < attack
          ? 0.0001 + ((layer.gain - 0.0001) * time) / attack
          : layer.gain *
            Math.exp((Math.log(0.0001 / layer.gain) * (time - attack)) / (layer.duration - attack));
      if (index + offset < output.length) output[index + offset] += signal * envelope;
    }
  }
  return output;
}

export async function inspectDestructionFallbackLevels() {
  const rows = [];
  for (const category of DESTRUCTION_CATEGORIES) {
    for (const brutal of [false, true]) {
      const recipe = destructionSoundRecipe({ category, brutal });
      const bytes = await readFile(
        new URL(`../../../game/audio/effects/${recipe.name}.wav`, import.meta.url),
      );
      const frames = bytes.readUInt32LE(40) / 2;
      const recorded = Float64Array.from({ length: frames }, (_, index) => {
        const envelope = Math.min(1, index / (0.006 * rate), (frames - 1 - index) / (0.025 * rate));
        return (bytes.readInt16LE(44 + index * 2) / 32768) * recipe.gain * envelope;
      });
      const sampleMax50msDbfs = maximum50ms(recorded);
      const fallbackMax50msDbfs = maximum50ms(fallback(recipe));
      rows.push({
        category,
        brutal,
        sampleMax50msDbfs,
        fallbackMax50msDbfs,
        differenceDb: fallbackMax50msDbfs - sampleMax50msDbfs,
      });
    }
  }
  return {
    method:
      'Numerical 48 kHz model: actual base WAV with director gain/fades, exponential-frequency sine/triangle plus deterministic noise through standard 1600 Hz Q 0.7 bandpass and Soundscape envelopes. Excludes master bus, browser oscillator bandlimiting, music and hardware. A regression bound, not native playback or listening qualification.',
    rows,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(await inspectDestructionFallbackLevels(), null, 2));
