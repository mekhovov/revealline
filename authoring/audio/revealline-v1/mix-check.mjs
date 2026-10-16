import { FeedbackDirector } from '../../../game/ui/feedback-director.mjs';

// Native offline rendering through the real director. Full bus/master levels,
// no compressor: conservative SFX headroom evidence, not a listening certificate.
export async function inspectMixedEffects(buffers) {
  const Offline = globalThis.OfflineAudioContext ?? globalThis.webkitOfflineAudioContext;
  if (!Offline) throw new Error('This browser does not support offline audio rendering.');
  const scenarios = {
    actions: ['impact', 'deploy', 'attack', 'interference', 'erosion', 'gate', 'warning'],
    materials: ['contact-metal', 'contact-wood', 'contact-glass', 'contact-soft', 'gate', 'impact'],
    routine: ['focus', 'confirm', 'cancel', 'paper', 'pickup', 'closure', 'switch', 'reveal-large'],
    endings: [
      'start',
      'retry',
      'loss',
      'respawn',
      'win',
      'neutralized',
      'reactivated',
      'esc-start',
    ],
    newMaterials: ['contact-glass', 'contact-wood', 'erosion', 'esc-start', 'warning'],
    radioEnglish: ['radio-armed-en'],
    radioUkrainian: ['radio-armed-uk'],
  };
  const results = [];
  for (const [name, cues] of Object.entries(scenarios)) {
    const offline = new Offline(2, 48000 * 3, 48000);
    const bus = offline.createGain();
    bus.connect(offline.destination);
    const context = {
      currentTime: 0,
      state: 'running',
      createBufferSource: () => offline.createBufferSource(),
      createGain: () => offline.createGain(),
      createStereoPanner: () => offline.createStereoPanner(),
    };
    const sound = {
      context,
      enabled: true,
      paused: false,
      gameplayPaused: false,
      audioMaster: { muted: false },
      voices: new Set(),
      sfxBus: bus,
      menuBus: bus,
      movementBus: bus,
      radioBus: bus,
      menuSettings: { enabled: true },
      radioSettings: { enabled: true, volume: 1 },
      movementSettings: { enabled: true, volume: 1 },
    };
    const director = new FeedbackDirector(sound);
    director.buffers = new Map(buffers);
    const movement =
      name === 'newMaterials'
        ? ['ceramic', 'wood', 'ratchet', 'bell']
        : ['rotor', 'motor', 'wheels', 'wings'];
    for (const [index, cue] of movement.entries()) {
      const voice = director.play(cue, {
        loop: true,
        movement: true,
        priority: 0,
        pan: index % 2 ? 0.6 : -0.6,
      });
      if (!voice) throw new Error(`Missing movement buffer: ${cue}`);
      voice.set(0.3, index % 2 ? 0.6 : -0.6);
    }
    for (const cue of cues) {
      if (
        !director.play(cue, {
          priority: 3,
          gain: cue.startsWith('radio-') ? 0.7 : 0.55,
          radio: cue.startsWith('radio-'),
        })
      )
        throw new Error(`Missing scenario cue: ${cue}`);
    }
    const voices = sound.voices.size;
    const output = await offline.startRendering();
    let stereoPeak = 0,
      monoPeak = 0,
      energy = 0;
    const left = output.getChannelData(0),
      right = output.getChannelData(1);
    for (let i = 0; i < left.length; i++) {
      stereoPeak = Math.max(stereoPeak, Math.abs(left[i]), Math.abs(right[i]));
      const mono = (left[i] + right[i]) / 2;
      monoPeak = Math.max(monoPeak, Math.abs(mono));
      energy += mono * mono;
    }
    const db = (value) => 20 * Math.log10(Math.max(value, 1e-12));
    results.push({
      name,
      voices,
      stereoPeakDbfs: db(stereoPeak),
      monoPeakDbfs: db(monoPeak),
      monoRmsDbfs: db(Math.sqrt(energy / left.length)),
      unclipped: stereoPeak < 1 && monoPeak < 1,
    });
    director.close();
  }
  return {
    method:
      'Native OfflineAudioContext, real FeedbackDirector, seven overlapping SFX scenarios with four movement layers, full buses and no compressor; no music or physical listening claim.',
    sampleRate: 48000,
    results,
  };
}
