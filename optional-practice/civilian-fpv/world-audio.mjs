/** Optional presentation-only sound. No media requests or gameplay clocks. */
const PREFERENCE = 'revealline.fpv.world-audio.v1';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const AMBIENCES = {
  hangar: { filter: 380, gain: 0.013, hum: 74, humGain: 0.006 },
  woodland: { filter: 1250, gain: 0.023, hum: 156, humGain: 0.002 },
  stadium: { filter: 730, gain: 0.016, hum: 110, humGain: 0.008 },
  industrial: { filter: 220, gain: 0.024, hum: 58, humGain: 0.009 },
};

export function createWorldAudio(options = {}) {
  const host = options.window ?? globalThis.window ?? globalThis;
  let storage;
  try {
    storage = options.storage ?? host.localStorage;
  } catch {
    // Sound works for this visit even when browser preferences are unavailable.
  }
  const AudioContext = host.AudioContext ?? host.webkitAudioContext;
  let enabled = false;
  try {
    enabled = storage?.getItem(PREFERENCE) === 'on';
  } catch {
    // Muted is the default when preferences cannot be read.
  }
  let context;
  let graph;
  let disposed = false;
  let wanted = false;
  let transition = 0;
  let lastTick = null;
  let lastStep = null;
  let ambience = AMBIENCES.hangar;
  let motorStyle = 'quad';
  let gateStyle = 'chime';
  const effects = new Set();

  function ramp(parameter, value, seconds = 0.04) {
    parameter.setTargetAtTime(value, context.currentTime, seconds);
  }

  function stopEffects() {
    for (const effect of effects) effect.stop();
    effects.clear();
  }

  function silence() {
    if (!graph || context.state === 'closed') return;
    for (const node of [graph.motor, graph.wind, graph.humGain]) {
      node.gain.cancelScheduledValues(context.currentTime);
      node.gain.setValueAtTime(0, context.currentTime);
    }
    stopEffects();
  }

  function initialize() {
    if (context) return true;
    if (!AudioContext || disposed) return false;
    let candidate;
    try {
      candidate = new AudioContext({ latencyHint: 'interactive' });
      const master = candidate.createGain();
      master.gain.value = 0.7;
      master.connect(candidate.destination);
      const motor = candidate.createGain();
      motor.gain.value = 0;
      const motorFilter = candidate.createBiquadFilter();
      motorFilter.type = 'lowpass';
      motorFilter.frequency.value = 1200;
      motor.connect(motorFilter).connect(master);
      const rotors = [1, 1.013, 2.007].map((ratio, index) => {
        const oscillator = candidate.createOscillator();
        oscillator.type = index === 2 ? 'sine' : 'triangle';
        oscillator.frequency.value = 90 * ratio;
        oscillator.connect(motor);
        oscillator.start();
        return { oscillator, ratio };
      });

      // A small, locally synthesized loop avoids remote media and autoplay fetches.
      const buffer = candidate.createBuffer(1, candidate.sampleRate * 2, candidate.sampleRate);
      const samples = buffer.getChannelData(0);
      let seed = 73471;
      let low = 0;
      for (let i = 0; i < samples.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        low = 0.985 * low + 0.015 * (seed / 2147483648 - 1);
        samples[i] = low * 4;
      }
      const noise = candidate.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const windFilter = candidate.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.value = ambience.filter;
      const wind = candidate.createGain();
      wind.gain.value = 0;
      noise.connect(windFilter).connect(wind).connect(master);
      noise.start();
      const hum = candidate.createOscillator();
      hum.type = 'sine';
      hum.frequency.value = ambience.hum;
      const humGain = candidate.createGain();
      humGain.gain.value = 0;
      hum.connect(humGain).connect(master);
      hum.start();
      context = candidate;
      graph = { master, motor, motorFilter, rotors, noise, windFilter, wind, hum, humGain };
      return true;
    } catch {
      candidate?.close().catch(() => {});
      return false;
    }
  }

  function tone({ from, to = from, duration = 0.12, gain = 0.05, delay = 0, type = 'sine' }) {
    if (!graph || effects.size >= 12 || !wanted || context.state !== 'running') return;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const start = context.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);
    envelope.gain.setValueAtTime(0, context.currentTime);
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(gain, start + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope).connect(graph.master);
    let stopped = false;
    const effect = {
      stop() {
        if (stopped) return;
        stopped = true;
        try {
          oscillator.stop();
        } catch {
          // The one-shot may already have ended before a pause.
        }
        oscillator.disconnect();
        envelope.disconnect();
        effects.delete(effect);
      },
    };
    effects.add(effect);
    oscillator.onended = () => effect.stop();
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  function cue(type, player = true) {
    if (type === 'objective') {
      const frequency = gateStyle === 'bell' ? 660 : gateStyle === 'radio' ? 440 : 740;
      const wave = gateStyle === 'digital' ? 'triangle' : 'sine';
      tone({ from: frequency, duration: 0.2, gain: 0.07, type: wave });
      tone({ from: frequency * 1.5, duration: 0.25, delay: 0.09, gain: 0.055, type: wave });
    } else if (type === 'fire') {
      tone({
        from: player ? 750 : 410,
        to: 150,
        duration: 0.08,
        gain: player ? 0.048 : 0.024,
        type: 'triangle',
      });
    } else if (type === 'impact') {
      tone({ from: 170, to: 38, duration: 0.15, gain: 0.075, type: 'triangle' });
    } else if (type === 'defeat') {
      tone({ from: 430, to: 95, duration: 0.24, gain: 0.05, type: 'sine' });
    }
  }

  async function resume() {
    if (!enabled || disposed || !initialize()) return false;
    wanted = true;
    const epoch = ++transition;
    try {
      await context.resume();
      if (disposed || !enabled || !wanted) {
        if (context.state !== 'closed') await context.suspend();
        return false;
      }
      return epoch === transition && context.state === 'running';
    } catch {
      return false;
    }
  }

  function pause() {
    wanted = false;
    transition++;
    silence();
    if (context && context.state !== 'closed') context.suspend().catch(() => {});
  }

  return {
    enabled: () => enabled,
    status: () => ({
      enabled,
      available: Boolean(AudioContext) && !disposed,
      running: Boolean(wanted && context?.state === 'running'),
    }),
    async setEnabled(value) {
      if (disposed) return false;
      enabled = Boolean(value);
      try {
        storage?.setItem(PREFERENCE, enabled ? 'on' : 'off');
      } catch {
        // A privacy setting must not interrupt flight or the mute control.
      }
      if (enabled) return resume();
      pause();
      return true;
    },
    resume,
    pause,
    setCourse(course = {}) {
      const theme = course.world?.theme ?? course.theme ?? 'academy';
      const profile = course.world?.themeProfile?.audio ?? course.themeProfile?.audio ?? {};
      const fallback =
        theme === 'ukrainian'
          ? 'woodland'
          : theme === 'pixel'
            ? 'stadium'
            : theme === 'operations'
              ? 'industrial'
              : 'hangar';
      ambience = AMBIENCES[profile.ambience] ?? AMBIENCES[fallback];
      motorStyle =
        profile.motor ??
        (theme === 'pixel' ? 'arcade' : theme === 'operations' ? 'utility' : 'quad');
      gateStyle =
        profile.gate ?? (theme === 'pixel' ? 'digital' : theme === 'ukrainian' ? 'bell' : 'chime');
      lastTick = null;
      lastStep = null;
      stopEffects();
      if (graph && context.state !== 'closed') {
        ramp(graph.windFilter.frequency, ambience.filter);
        ramp(graph.hum.frequency, ambience.hum);
      }
    },
    update(snapshot, { active = true } = {}) {
      if (disposed || !snapshot) return;
      const tick = snapshot.ticks;
      const step = snapshot.step;
      const fresh = Number.isSafeInteger(tick) && tick !== lastTick;
      const advanced = Number.isSafeInteger(step) && lastStep !== null && step > lastStep;
      const playing = active && !['paused', 'disarmed'].includes(snapshot.status);
      if (enabled && wanted && graph && context.state === 'running' && playing) {
        const flying = snapshot.status === 'active';
        const throttle = clamp((snapshot.lastInput?.throttle ?? 0) / 1000, 0, 1);
        const velocity = snapshot.velocity ?? {};
        const speed = Math.hypot(velocity.x ?? 0, velocity.y ?? 0, velocity.z ?? 0);
        const airflow = clamp(speed / 16000, 0, 1);
        const fundamental =
          (motorStyle === 'utility' ? 65 : motorStyle === 'arcade' ? 125 : 95) +
          throttle * 230 +
          airflow * 35;
        for (const rotor of graph.rotors)
          ramp(rotor.oscillator.frequency, fundamental * rotor.ratio);
        ramp(graph.motorFilter.frequency, 850 + throttle * 2400);
        ramp(graph.motor.gain, flying ? 0.009 + throttle * 0.025 : 0);
        ramp(graph.wind.gain, ambience.gain + (flying ? airflow * 0.028 : 0));
        ramp(graph.humGain.gain, ambience.humGain);
        if (fresh) {
          const events = snapshot.events ?? [];
          const types = new Set();
          // Bound cue overlap independently of simulation actor/projectile counts.
          for (const event of events) {
            if (types.has(event.type)) continue;
            types.add(event.type);
            cue(event.type, event.actor === 'player');
          }
          if (advanced && !types.has('objective')) cue('objective');
        }
      } else if (graph && context.state !== 'closed') {
        ramp(graph.motor.gain, 0);
        ramp(graph.wind.gain, 0);
        ramp(graph.humGain.gain, 0);
      }
      lastTick = tick;
      lastStep = step;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      pause();
      if (!graph) return;
      for (const node of [
        ...graph.rotors.map((rotor) => rotor.oscillator),
        graph.noise,
        graph.hum,
      ]) {
        node.stop();
        node.disconnect();
      }
      for (const node of [
        graph.motor,
        graph.motorFilter,
        graph.windFilter,
        graph.wind,
        graph.humGain,
        graph.master,
      ])
        node.disconnect();
      context.close().catch(() => {});
      graph = null;
    },
  };
}
