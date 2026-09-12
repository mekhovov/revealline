import { Soundscape } from '../../ui/audio.mjs';
export function audioHarness() {
  const sources = [],
    param = () => ({
      value: 0,
      cancelScheduledValues() {},
      setTargetAtTime(v) {
        this.value = v;
      },
      setValueAtTime(v) {
        this.value = v;
      },
      linearRampToValueAtTime() {},
      exponentialRampToValueAtTime() {},
    });
  const node = () => ({
    gain: param(),
    frequency: param(),
    Q: param(),
    threshold: param(),
    knee: param(),
    ratio: param(),
    connect() {},
    disconnect() {},
    start() {},
    stop() {},
  });
  const context = {
    currentTime: 0,
    sampleRate: 8000,
    state: 'suspended',
    destination: {},
    createGain: node,
    createBiquadFilter: node,
    createDynamicsCompressor: node,
    createWaveShaper: node,
    createOscillator() {
      const s = node();
      sources.push(s);
      return s;
    },
    createBufferSource() {
      return this.createOscillator();
    },
    createBuffer: (_, size) => ({ getChannelData: () => new Float32Array(size) }),
    async resume() {
      this.state = 'running';
    },
    async suspend() {
      this.state = 'suspended';
    },
    async close() {
      this.state = 'closed';
    },
  };
  const soundscape = new Soundscape({ persistentMusic: true, contextFactory: () => context }),
    listeners = new Map(),
    revoked = [],
    created = [];
  const media = {
    currentTime: 0,
    duration: NaN,
    readyState: 0,
    currentSrc: '',
    volume: 1,
    paused: true,
    plays: 0,
    rejectPlay: null,
    addEventListener(type, fn) {
      const list = listeners.get(type) ?? new Set();
      list.add(fn);
      listeners.set(type, list);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
    async play() {
      this.plays++;
      if (this.rejectPlay) throw this.rejectPlay;
      this.paused = false;
    },
    pause() {
      this.paused = true;
    },
    load() {
      this.currentSrc = this.src ?? '';
      if (!this.src) {
        this.currentTime = 0;
        this.readyState = 0;
      }
    },
    removeAttribute(key) {
      delete this[key];
    },
    emit(type) {
      for (const fn of [...(listeners.get(type) ?? [])]) fn();
    },
  };
  const URLImpl = {
    createObjectURL(blob) {
      const url = `blob:music-${created.length + 1}`;
      created.push({ url, blob });
      return url;
    },
    revokeObjectURL(url) {
      revoked.push(url);
    },
  };
  return { soundscape, context, media, URLImpl, revoked, created, sources, listeners };
}
export async function settleUntil(predicate) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await new Promise((r) => setImmediate(r));
  }
  throw new Error('Transport did not settle.');
}
