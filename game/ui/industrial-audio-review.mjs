import { Soundscape } from './audio.mjs';
import { createGameAudioContext } from './audio-output.mjs';
import { createAudioMaster } from './audio-master.mjs';
import { createAudioPreferences } from '../audio-preferences.mjs';
import { createDestructionPreferences } from '../hunt/preferences.mjs';
import { readMovementAudio, MOVEMENT_AUDIO_KEY } from './movement-audio.mjs';

const sample = (id, label, description) =>
  Object.freeze({ id, label: Object.freeze(label), description: Object.freeze(description) });
export const INDUSTRIAL_AUDIO_SAMPLES = Object.freeze([
  sample(
    'runner',
    { en: 'Runner', uk: 'Бігун' },
    {
      en: 'Light footsteps, cloth movement and a contact accent.',
      uk: 'Легкі кроки, шелест одягу та звук контакту.',
    },
  ),
  sample(
    'courier',
    { en: 'Courier', uk: 'Кур’єр' },
    {
      en: 'Quick steps, a rattling satchel and a contact accent.',
      uk: 'Швидкі кроки, брязкіт сумки та звук контакту.',
    },
  ),
  sample(
    'guard',
    { en: 'Guard', uk: 'Вартовий' },
    {
      en: 'Heavy boots, equipment movement and a contact accent.',
      uk: 'Важкі кроки, брязкіт спорядження та звук контакту.',
    },
  ),
  sample(
    'shield-bearer',
    { en: 'Shield bearer', uk: 'Щитоносець' },
    {
      en: 'Measured boots, a shield rattle and a metal impact.',
      uk: 'Розмірені кроки, брязкіт щита та металевий удар.',
    },
  ),
  sample(
    'car',
    { en: 'Utility car', uk: 'Службова машина' },
    {
      en: 'A short wheel and engine accent, then a metal impact.',
      uk: 'Короткий звук коліс і двигуна, потім металевий удар.',
    },
  ),
  sample(
    'tank',
    { en: 'Tracked tank', uk: 'Гусеничний танк' },
    {
      en: 'A low track rattle, then a heavy metal impact.',
      uk: 'Низький брязкіт гусениць, потім важкий металевий удар.',
    },
  ),
]);

/** Deliberate listening only: one existing mixer, no autoplay, no gameplay clock.
 * The factory injection keeps lifecycle regressions independent of browser audio. */
export function createIndustrialAudioReview({
  window: host = globalThis,
  document = host.document,
  soundFactory = (options) => new Soundscape(options),
} = {}) {
  const master = createAudioMaster(),
    preferences = createAudioPreferences({
      audioMaster: master,
      window: host,
      getStorage: () => host.localStorage,
    }),
    destruction = createDestructionPreferences({
      window: host,
      getStorage: () => host.localStorage,
    }),
    sound = soundFactory({
      audioMaster: master,
      contextFactory: () => createGameAudioContext(host),
    }),
    timers = new Set();
  let generation = 0,
    disposed = false,
    playing = false,
    currentSample = null;
  sound.configure({ master: 1, music: 0 });
  sound.setDestructionPreferences(destruction.snapshot);
  const movement = () => {
    let storage;
    try {
      storage = host.localStorage;
    } catch {
      /* A blocked store uses the shared default. */
    }
    sound.movementSettings = readMovementAudio(storage);
    sound.applyVolumes();
  };
  movement();
  function release() {
    generation++;
    for (const timer of timers) host.clearTimeout(timer);
    timers.clear();
    playing = false;
    currentSample = null;
    sound.suspend();
    sound.reset();
  }
  const unsubscribe = master.subscribe((state) => {
    if (state.muted || state.volume === 0) release();
  });
  const later = (token, delay, action) => {
    const timer = host.setTimeout(() => {
      timers.delete(timer);
      if (!disposed && token === generation && !document?.hidden) action();
    }, delay);
    timers.add(timer);
  };
  const hidden = () => {
    if (document?.hidden) release();
  };
  const storage = (event) => {
    if (event.key === MOVEMENT_AUDIO_KEY) movement();
  };
  const hide = (event) => {
    if (event.persisted) release();
    else void dispose();
  };
  document?.addEventListener?.('visibilitychange', hidden);
  host.addEventListener?.('pagehide', hide);
  host.addEventListener?.('storage', storage);
  host.addEventListener?.('pageshow', movement);
  async function dispose() {
    if (disposed) return;
    disposed = true;
    release();
    document?.removeEventListener?.('visibilitychange', hidden);
    host.removeEventListener?.('pagehide', hide);
    host.removeEventListener?.('storage', storage);
    host.removeEventListener?.('pageshow', movement);
    unsubscribe();
    preferences.dispose();
    destruction.dispose();
    master.dispose();
    await sound.dispose();
  }
  return Object.freeze({
    async play(id, { treatment = 'clean' } = {}) {
      if (!INDUSTRIAL_AUDIO_SAMPLES.some((entry) => entry.id === id))
        return { played: false, reason: 'unavailable' };
      release();
      if (disposed || document?.hidden) return { played: false, reason: 'cancelled' };
      if (master.snapshot().muted || master.snapshot().volume === 0)
        return { played: false, reason: 'muted' };
      const token = generation;
      let enabled = false;
      try {
        enabled = await sound.enable();
      } catch {
        // An unavailable browser/device must leave the review controls usable.
      }
      if (disposed || token !== generation || document?.hidden)
        return { played: false, reason: 'cancelled' };
      if (!enabled) return { played: false, reason: 'unavailable' };
      playing = true;
      currentSample = id;
      const machine = id === 'car' ? 'wheeled' : id === 'tank' ? 'tracked' : false,
        details = {
          family: id,
          machine,
          material: machine || id === 'shield-bearer' ? 'metal' : undefined,
          brutal: treatment !== 'clean',
          board: 'industrial-review',
        };
      sound.encounter(machine ? 'drive' : 'step', details);
      if (!machine) later(token, 180, () => sound.encounter('equipment', details));
      later(token, 520, () => sound.encounter('catch', details));
      later(token, 1000, release);
      return { played: true, reason: null };
    },
    release,
    dispose,
    snapshot() {
      const { muted, volume } = master.snapshot();
      return { muted, volume, playing, sample: currentSample };
    },
    setMuted: (value) => preferences.setMuted(value),
  });
}
