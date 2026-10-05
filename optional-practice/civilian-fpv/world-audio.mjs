import { DEFAULT_DIALOGUE_VOLUME, DIALOGUE_MIX_GAIN } from '../../game/audio/dialogue-mix.mjs';
import {
  createGameAudioContext,
  createGameAudioOutput,
  requestPlaybackAudioSession,
  releasePlaybackAudioSession,
} from '../../game/ui/audio-output.mjs';
import { createAudioMaster } from '../../game/ui/audio-master.mjs';
import { createAudioPreferences } from '../../game/audio-preferences.mjs';
import { destructionCategory } from '../../game/ui/destruction-audio.mjs';
import { encounterSoundRecipe, actorPhaseSound } from '../../game/ui/encounter-audio.mjs';
import { readMovementAudio, MOVEMENT_AUDIO_KEY } from '../../game/ui/movement-audio.mjs';
import { dialogueChannel } from '../../game/ui/dialogue-channel.mjs';

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
  let lastPlaying = false;
  let lastTick = null;
  let lastStep = null;
  let lastContacts = null;
  let ambience = AMBIENCES.hangar;
  let motorStyle = 'quad';
  let gateStyle = 'chime';
  let dialogue = { enabled: false, volume: DEFAULT_DIALOGUE_VOLUME };
  let dialogueVoice = null;
  const effects = new Set();
  const audioMaster = options.audioMaster ?? createAudioMaster();
  const preferences =
    options.audioPreferences ??
    createAudioPreferences({
      audioMaster,
      getStorage: () => storage,
      window: host,
      fallback: options.audioMaster
        ? { muted: audioMaster.snapshot().muted, volume: audioMaster.snapshot().volume }
        : { muted: !enabled, volume: 0.65 },
    });
  let movement = readMovementAudio(storage);
  let masterState = audioMaster.snapshot();
  enabled = !masterState.muted;
  const applyOutput = () => {
    if (!graph || context.state === 'closed') return;
    graph.master.gain.cancelScheduledValues(context.currentTime);
    graph.master.gain.setValueAtTime(enabled ? masterState.volume : 0, context.currentTime);
    graph.output.movementBus.gain.setTargetAtTime(
      movement.enabled ? movement.volume : 0,
      context.currentTime,
      0.025,
    );
  };
  const releaseMaster = audioMaster.subscribe((value) => {
    masterState = value;
    enabled = !value.muted;
    if (!enabled || value.volume === 0) silence();
    applyOutput();
  });
  const changed = (event) => {
    if (event.key === MOVEMENT_AUDIO_KEY) {
      movement = readMovementAudio(storage);
      applyOutput();
    }
  };
  host.addEventListener?.('storage', changed);
  const recentCues = new Map();
  let actorDefinitions = new Map();
  let actorPositions = new Map();
  let actorPhases = new Map();
  let actorFamilies = new Map();
  let lastFootstep = -Infinity;

  const volume = (value) =>
    typeof value === 'number' && Number.isFinite(value) ? clamp(value, 0, 1) : 1;
  let levels = Object.fromEntries(
    ['interface', 'motor', 'ambience'].map((key) => [key, volume(options.volumes?.[key])]),
  );

  function ramp(parameter, value, seconds = 0.04) {
    parameter.setTargetAtTime(value, context.currentTime, seconds);
  }

  function stopEffects() {
    for (const effect of effects) effect.stop();
    effects.clear();
  }

  function silence() {
    dialogueVoice?.stop();
    if (!graph || context.state === 'closed') return;
    for (const node of [graph.motor, graph.vehicleGain, graph.wind, graph.humGain]) {
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
      candidate = createGameAudioContext(host);
      const output = createGameAudioOutput(candidate);
      const master = output.master;
      master.gain.value = enabled ? masterState.volume : 0;
      output.movementBus.gain.value = movement.enabled ? movement.volume : 0;
      const buses = Object.fromEntries(
        Object.entries(levels).map(([key, level]) => {
          const bus = candidate.createGain();
          bus.gain.value = level;
          bus.connect(key === 'motor' ? output.movementBus : output.sfxBus);
          return [key, bus];
        }),
      );
      const dialogueBus = output.dialogueBus;
      dialogueBus.gain.value = dialogue.enabled ? dialogue.volume * DIALOGUE_MIX_GAIN : 0;
      const motor = candidate.createGain();
      motor.gain.value = 0;
      const motorFilter = candidate.createBiquadFilter();
      motorFilter.type = 'lowpass';
      motorFilter.frequency.value = 1200;
      motor.connect(motorFilter).connect(buses.motor);
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
      noise.connect(windFilter).connect(wind).connect(buses.ambience);
      noise.start();
      const hum = candidate.createOscillator();
      hum.type = 'sine';
      hum.frequency.value = ambience.hum;
      const humGain = candidate.createGain();
      humGain.gain.value = 0;
      hum.connect(humGain).connect(buses.ambience);
      hum.start();
      const vehicleMotor = candidate.createOscillator(),
        vehicleGain = candidate.createGain();
      vehicleMotor.type = 'triangle';
      vehicleMotor.frequency.value = 62;
      vehicleGain.gain.value = 0;
      vehicleMotor.connect(vehicleGain).connect(buses.motor);
      vehicleMotor.start();
      context = candidate;
      graph = {
        vehicleMotor,
        vehicleGain,
        output,
        master,
        buses,
        dialogueBus,
        motor,
        motorFilter,
        rotors,
        noise,
        windFilter,
        wind,
        hum,
        humGain,
      };
      return true;
    } catch {
      candidate?.close().catch(() => {});
      return false;
    }
  }

  function tone({
    from,
    to = from,
    duration = 0.12,
    gain = 0.05,
    delay = 0,
    type = 'sine',
    kind = 'tone',
    destruction = false,
    movementCue = false,
    priority = 2,
  }) {
    if (
      !graph ||
      !enabled ||
      masterState.volume === 0 ||
      !levels.interface ||
      !wanted ||
      context.state !== 'running'
    )
      return;
    if (
      movementCue &&
      (!movement.enabled ||
        movement.volume === 0 ||
        [...effects].some((effect) => effect.priority >= 4))
    )
      return;
    if (priority >= 4) for (const effect of [...effects]) if (effect.movementCue) effect.stop();
    // Crowd feedback cannot use the warning reserve. A warning may reclaim
    // a lower-priority tail, without adding a second output or context.
    if (destruction && [...effects].filter((effect) => effect.destruction).length >= 10) return;
    if (effects.size >= 12) {
      const victim = [...effects].find((effect) => effect.priority < priority);
      if (!victim) return;
      victim.stop();
    }
    const oscillator = kind === 'snare' ? context.createBufferSource() : context.createOscillator();
    const envelope = context.createGain();
    const start = context.currentTime + delay;
    if (kind === 'snare') {
      const samples = Math.max(1, Math.ceil(context.sampleRate * duration));
      const buffer = context.createBuffer(1, samples, context.sampleRate);
      const data = buffer.getChannelData(0);
      let seed = 73471,
        low = 0;
      for (let index = 0; index < data.length; index++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        low = low * 0.65 + (seed / 2147483648 - 1) * 0.35;
        data[index] = low;
      }
      oscillator.buffer = buffer;
    } else {
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(from, start);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);
    }
    envelope.gain.setValueAtTime(0, context.currentTime);
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(gain, start + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator
      .connect(envelope)
      .connect(movementCue ? graph.output.movementBus : graph.buses.interface);
    let stopped = false;
    const effect = {
      priority,
      destruction,
      movementCue,
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

  function actorSoundDetails(event = {}) {
    const actor = actorDefinitions.get(event.actor);
    const machine =
      event.machine ??
      (actor?.type === 'vehicle'
        ? actor.vehicleModel === 'field-tank'
          ? 'tracked'
          : 'wheeled'
        : false);
    const machineFamily =
      actor?.type === 'vehicle'
        ? ({
            'field-utility': 'utility-car',
            'field-tank': 'tracked-tank',
            'relay-truck': 'radar-truck',
          }[actor.vehicleModel] ?? actor.vehicleModel)
        : null;
    return {
      family:
        event.family ??
        machineFamily ??
        actorFamilies.get(event.actor) ??
        (actor?.speed > 0 ? 'patroller' : 'lookout'),
      machine,
      brutal: options.getDestruction?.()?.brutal === true,
    };
  }

  function cue(type, player = true, event = {}) {
    const kind = {
      catch: 'catch',
      'hunt-tail': 'failure',
      objective: 'objective',
      fire: 'fire',
      impact: 'impact',
      defeat: 'catch',
      'protected-contact': 'impact',
      warning: 'warning',
      notice: 'notice',
      burst: 'burst',
      recover: 'recover',
      blocked: 'blocked',
      equipment: 'equipment',
      drive: 'drive',
    }[type];
    if (!kind) return;
    const recipe = encounterSoundRecipe(kind, actorSoundDetails(event));
    const now = context?.currentTime ?? 0;
    const cueKey = kind === 'catch' ? `catch:${recipe.category}` : kind;
    if (now - (recentCues.get(cueKey) ?? -Infinity) < (recipe.cooldown ?? 0.12)) return;
    recentCues.set(cueKey, now);
    if (recipe.priority >= 5 || (type === 'fire' && !player)) dialogueChannel.interrupt();
    const voice = { ...recipe.tone, priority: recipe.priority, movementCue: recipe.movement };
    if (recipe.movement) voice.gain *= levels.interface;
    if (type === 'fire' && !player) voice.gain *= 0.65;
    if (type === 'objective' && gateStyle === 'digital') voice.type = 'triangle';
    tone({ ...voice, destruction: kind === 'catch' });
    for (const layer of recipe.layers ?? [])
      tone({ ...layer, priority: recipe.priority, destruction: kind === 'catch' });
  }

  async function resume() {
    if (!enabled || disposed) return false;
    requestPlaybackAudioSession(host.navigator?.audioSession);
    if (!initialize()) return false;
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
    releasePlaybackAudioSession(host.navigator?.audioSession);
  }

  return {
    get context() {
      return context;
    },
    get menuBus() {
      return graph?.output.menuBus;
    },
    subscribe(listener) {
      return audioMaster.subscribe(() => listener(enabled));
    },
    configureDialogue({ enabled = dialogue.enabled, volume: value = dialogue.volume } = {}) {
      if (typeof enabled !== 'boolean' || !Number.isFinite(value) || value < 0 || value > 1)
        throw new TypeError('Dialogue requires an enabled boolean and volume from zero to one.');
      dialogue = { enabled, volume: value };
      if (!enabled || !value) dialogueVoice?.stop();
      if (graph && context.state !== 'closed')
        ramp(graph.dialogueBus.gain, enabled ? value * DIALOGUE_MIX_GAIN : 0);
    },
    /** Uses the existing flight context and the shared one-line dialogue arbiter. */
    playDialogue(buffer, { onended = () => {} } = {}) {
      if (
        !buffer ||
        disposed ||
        !enabled ||
        !wanted ||
        !dialogue.enabled ||
        !dialogue.volume ||
        !graph ||
        context.state !== 'running'
      )
        return null;
      dialogueVoice?.stop();
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(graph.dialogueBus);
      let ended = false;
      const voice = {
        get ended() {
          return ended;
        },
        stop() {
          if (ended) return;
          ended = true;
          try {
            source.stop();
          } catch {
            /* An ended source is already silent. */
          }
          source.disconnect();
          if (dialogueVoice === voice) dialogueVoice = null;
          dialogueChannel.release(voice);
          try {
            onended();
          } catch {
            /* Presentation callbacks cannot interrupt flight. */
          }
        },
      };
      source.onended = voice.stop;
      dialogueChannel.claim(voice);
      dialogueVoice = voice;
      try {
        source.start();
      } catch {
        voice.stop();
        return null;
      }
      return voice;
    },
    enabled: () => enabled,
    volumes: () => ({ ...levels }),
    setVolumes(values = {}) {
      if (disposed) return;
      levels = Object.fromEntries(
        Object.keys(levels).map((key) => [
          key,
          Object.hasOwn(values, key) ? volume(values[key]) : levels[key],
        ]),
      );
      if (!graph || context.state === 'closed') return;
      for (const [key, bus] of Object.entries(graph.buses)) {
        bus.gain.cancelScheduledValues(context.currentTime);
        ramp(bus.gain, levels[key], 0.025);
      }
      if (!levels.interface) stopEffects();
    },
    status: () => ({
      enabled,
      volumes: { ...levels },
      available: Boolean(AudioContext) && !disposed,
      running: Boolean(wanted && context?.state === 'running'),
    }),
    async setEnabled(value) {
      if (disposed) return false;
      enabled = Boolean(value);
      preferences.setMuted(!enabled);
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
      dialogueVoice?.stop();
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
      lastPlaying = false;
      lastTick = null;
      lastStep = null;
      lastContacts = null;
      recentCues.clear();
      actorPositions.clear();
      actorPhases.clear();
      actorFamilies = new Map(
        (course.pursuit?.actors ?? []).map((policy) => [policy.id, policy.family]),
      );
      lastFootstep = -Infinity;
      actorDefinitions = new Map((course.actors ?? []).map((actor) => [actor.id, actor]));
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
      const fresh = Number.isSafeInteger(tick) && lastTick !== null && tick > lastTick;
      const advanced = Number.isSafeInteger(step) && lastStep !== null && step > lastStep;
      const playing = active && !['paused', 'disarmed'].includes(snapshot.status);
      const finalCue = fresh && lastPlaying && ['complete', 'failed'].includes(snapshot.status);
      if (enabled && wanted && graph && context.state === 'running' && (playing || finalCue)) {
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
          let nearestVehicle = Infinity,
            nearestFoot = Infinity,
            footActor = null,
            startingVehicle = null;
          for (const actor of snapshot.actors ?? []) {
            const previous = actorPositions.get(actor.id),
              position = actor.position;
            if (!position) continue;
            const moving =
              previous && Math.hypot(position.x - previous.x, position.z - previous.z) > 0;
            if (moving && actor.status === 'active') {
              const d = Math.hypot(
                position.x - snapshot.position.x,
                position.y - snapshot.position.y,
                position.z - snapshot.position.z,
              );
              if (actor.type === 'vehicle') {
                nearestVehicle = Math.min(nearestVehicle, d);
                if (
                  !previous.moving &&
                  d < 16000 &&
                  (!startingVehicle || d < startingVehicle.distance)
                )
                  startingVehicle = { actor: actor.id, distance: d };
              } else if (['patrol', 'sentry'].includes(actor.type) && d < nearestFoot) {
                nearestFoot = d;
                footActor = actor;
              }
            }
          }
          ramp(
            graph.vehicleGain.gain,
            flying && nearestVehicle < 16000 ? 0.012 * (1 - nearestVehicle / 16000) : 0,
          );
          if (flying && startingVehicle) cue('drive', false, { actor: startingVehicle.actor });
          const step = encounterSoundRecipe('step', {
            family: footActor?.pursuit?.family ?? actorFamilies.get(footActor?.id),
          });
          if (flying && nearestFoot < 6000 && context.currentTime - lastFootstep >= step.cooldown) {
            lastFootstep = context.currentTime;
            tone({
              ...step.tone,
              gain: step.tone.gain * (1 - nearestFoot / 6000) * levels.interface,
              movementCue: true,
              priority: 0,
            });
          }
          for (const actor of snapshot.actors ?? []) {
            if (!actor.pursuit || actor.status !== 'active') continue;
            const phase = actor.blocked ? 'blocked' : actor.pursuit.phase;
            const sound = actorPhaseSound(actorPhases.get(actor.id), phase);
            if (sound) {
              cue(sound, false, { actor: actor.id, family: actor.pursuit.family });
              if (sound !== 'warning')
                cue('equipment', false, { actor: actor.id, family: actor.pursuit.family });
            }
          }
          const events = snapshot.events ?? [];
          const types = new Set();
          const destructionTypes = new Set();
          // Bound cue overlap independently of simulation actor/projectile counts.
          for (const event of events) {
            if (['catch', 'defeat'].includes(event.type)) {
              const category = destructionCategory(actorSoundDetails(event));
              if (destructionTypes.has(category)) continue;
              destructionTypes.add(category);
            } else if (types.has(event.type)) continue;
            types.add(event.type);
            cue(event.type, event.actor === 'player', event);
          }
          if (advanced && !types.has('objective')) cue('objective');
          if (lastContacts !== null && snapshot.contacts > lastContacts && !types.has('impact'))
            cue('impact');
        }
      } else if (graph && context.state !== 'closed') {
        ramp(graph.motor.gain, 0);
        ramp(graph.vehicleGain.gain, 0);
        ramp(graph.wind.gain, 0);
        ramp(graph.humGain.gain, 0);
      }
      actorPositions = new Map(
        (snapshot.actors ?? []).map((actor) => {
          const previous = actorPositions.get(actor.id);
          return [
            actor.id,
            {
              ...actor.position,
              moving:
                fresh && previous && actor.position
                  ? Math.hypot(actor.position.x - previous.x, actor.position.z - previous.z) > 0
                  : previous?.moving,
            },
          ];
        }),
      );
      actorPhases = new Map(
        (snapshot.actors ?? [])
          .filter((actor) => actor.pursuit)
          .map((actor) => [actor.id, actor.blocked ? 'blocked' : actor.pursuit.phase]),
      );
      lastTick = tick;
      lastStep = step;
      lastContacts = snapshot.contacts ?? null;
      lastPlaying = playing;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      pause();
      releaseMaster();
      host.removeEventListener?.('storage', changed);
      if (!options.audioPreferences) preferences.dispose();
      if (!options.audioMaster) audioMaster.dispose();
      if (!graph) return;
      for (const node of [
        ...graph.rotors.map((rotor) => rotor.oscillator),
        graph.noise,
        graph.hum,
        graph.vehicleMotor,
      ]) {
        node.stop();
        node.disconnect();
      }
      for (const node of [
        graph.motor,
        graph.vehicleGain,
        graph.motorFilter,
        graph.windFilter,
        graph.wind,
        graph.humGain,
        ...Object.values(graph.buses),
        ...Object.values(graph.output).filter(Boolean),
      ])
        node.disconnect();
      context.close().catch(() => {});
      graph = null;
    },
  };
}
