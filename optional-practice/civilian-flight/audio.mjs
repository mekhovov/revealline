import { createWorldAudio } from '../civilian-fpv/world-audio.mjs';
import { PRACTICE_HZ } from './model.mjs';

/** Centimetres and assisted motion remain native model facts. This adapter only
 * supplies the shared flight mixer with its millimetre presentation vocabulary. */
export function practiceAudioState(state, previous, command = {}) {
  const advanced = previous && state.ticks > previous.ticks;
  const speed = (key) => (advanced ? (state[key] - previous[key]) * 10 * PRACTICE_HZ : 0);
  const moving = Math.max(
    Math.abs(command.pitch ?? 0),
    Math.abs(command.roll ?? 0),
    Math.abs(command.throttle ?? 0),
  );
  return {
    ticks: state.ticks,
    step: state.checkpoint,
    status: state.status === 'ready' ? 'disarmed' : state.status,
    position: { x: state.x * 10, y: state.altitude * 10, z: state.z * 10 },
    velocity: { x: speed('x'), y: speed('altitude'), z: speed('z') },
    // This is an acoustic activity envelope, not a new throttle or motor model.
    lastInput: { throttle: state.status === 'active' ? 250 + moving * 350 : 0 },
    events: [],
  };
}

export function createPracticeAudio({ window, createAudio = createWorldAudio } = {}) {
  const audio = createAudio({ window });
  let previous = null;
  return Object.freeze({
    enabled: audio.enabled,
    setEnabled: audio.setEnabled,
    subscribe: audio.subscribe,
    masterSnapshot: audio.masterSnapshot,
    subscribeMaster: audio.subscribeMaster,
    setMasterVolume: audio.setMasterVolume,
    get context() {
      return audio.context;
    },
    get menuBus() {
      return audio.menuBus;
    },
    get movementSettings() {
      return audio.movementSettings;
    },
    set movementSettings(value) {
      audio.movementSettings = value;
    },
    applyVolumes: audio.applyVolumes,
    resume: audio.resume,
    pause: audio.pause,
    update(state, command) {
      audio.update(practiceAudioState(state, previous, command), {
        active: state.status === 'active',
      });
      previous = { ...state };
    },
    reset() {
      audio.pause();
      audio.setCourse({ theme: 'academy' });
      previous = null;
    },
    dispose: audio.dispose,
  });
}
