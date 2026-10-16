#!/usr/bin/env node
// Functional graph qualification with an instrumented Web Audio boundary.
// Exercises the production presentation/audio modules; this is not listening QA.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  createSimAudioMix,
  mountSimAudioControls,
  mountSimPresentation,
} from '../optional-practice/civilian-fpv/sim-presentation.mjs';
import { createWorldAudio } from '../optional-practice/civilian-fpv/world-audio.mjs';

const require = (condition, message) => {
  if (!condition) throw new Error(message);
};
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
class Surface {
  constructor() {
    this.listeners = new Map();
    this.children = [];
    this.attributes = new Map();
  }
  addEventListener(name, callback) {
    const callbacks = this.listeners.get(name) ?? new Set();
    callbacks.add(callback);
    this.listeners.set(name, callbacks);
  }
  removeEventListener(name, callback) {
    this.listeners.get(name)?.delete(callback);
  }
  emit(name, event = {}) {
    for (const callback of this.listeners.get(name) ?? []) callback(event);
  }
  append(...children) {
    this.children.push(...children);
  }
  replaceChildren(...children) {
    this.children = children;
  }
  setAttribute(key, value) {
    this.attributes.set(key, String(value));
  }
  getAttribute(key) {
    return this.attributes.get(key);
  }
  querySelectorAll() {
    return [];
  }
}
class Parameter {
  constructor() {
    this.value = 0;
  }
  cancelScheduledValues() {}
  setValueAtTime(value) {
    this.value = value;
  }
  setTargetAtTime(value) {
    this.value = value;
  }
  linearRampToValueAtTime(value) {
    this.value = value;
  }
  exponentialRampToValueAtTime(value) {
    this.value = value;
  }
}
class AudioNode {
  constructor(kind) {
    this.kind = kind;
    this.gain = new Parameter();
    this.frequency = new Parameter();
    this.outputs = [];
    this.started = false;
    this.disconnected = false;
  }
  connect(node) {
    this.outputs.push(node);
    return node;
  }
  disconnect() {
    this.disconnected = true;
  }
  start() {
    this.started = true;
  }
  stop() {
    this.stopped = true;
  }
}
const contexts = [];
class AudioContext {
  constructor() {
    this.nodes = [];
    this.state = 'suspended';
    this.currentTime = 1;
    this.sampleRate = 8000;
    this.destination = { kind: 'destination' };
    contexts.push(this);
  }
  node(kind) {
    const node = new AudioNode(kind);
    this.nodes.push(node);
    return node;
  }
  createGain() {
    return this.node('gain');
  }
  createBiquadFilter() {
    return this.node('filter');
  }
  createOscillator() {
    return this.node('oscillator');
  }
  createBufferSource() {
    return this.node('source');
  }
  createBuffer(channels, length) {
    const samples = new Float32Array(length);
    return { getChannelData: () => samples };
  }
  async decodeAudioData(bytes) {
    return { decodedBytes: bytes.byteLength };
  }
  async resume() {
    this.state = 'running';
  }
  async suspend() {
    this.state = 'suspended';
  }
  async close() {
    this.state = 'closed';
  }
}
const stored = new Map();
const storage = {
  getItem: (key) => stored.get(key) ?? null,
  setItem: (key, value) => stored.set(key, value),
};
const doc = new Surface();
doc.nodeType = 9;
doc.hasFocus = () => true;
doc.createElement = () => new Surface();
const win = new Surface();
let clock = 1000;
Object.assign(win, {
  AudioContext,
  localStorage: storage,
  navigator: { userActivation: { isActive: true } },
  performance: { now: () => clock },
  atob: (value) => Buffer.from(value, 'base64').toString('binary'),
});
const menu = mountSimPresentation({ root: doc, window: win });
const world = createWorldAudio({ window: win, storage });
const root = new Surface();
root.ownerDocument = doc;
root.id = 'qualification-audio';
let language = 'en';
const controls = mountSimAudioControls({
  root,
  window: win,
  locale: () => language,
  onChange(levels) {
    menu.setVolume(levels.interface);
    world.setVolumes(levels);
  },
});
const slide = (index, value) => {
  const input = root.children[index].children[1];
  input.value = String(value);
  input.emit('input');
};
slide(0, 23);
slide(1, 41);
slide(2, 67);
const selected = { interface: 0.23, motor: 0.41, ambience: 0.67 };
require(equal(controls.snapshot(), selected), 'Sliders must retain each independent level');
require(contexts.length === 0, 'Changing levels while muted must not construct audio contexts');
require(!world.enabled() && !menu.soundEnabled(), 'Sliders must not change the master mute');
require(equal(
  createSimAudioMix({ storage }).snapshot(),
  selected,
), 'Mix must survive a new instance');
const academyRoot = new Surface();
academyRoot.ownerDocument = doc;
academyRoot.id = 'qualification-academy';
const academy = mountSimAudioControls({ root: academyRoot, window: win, channels: ['interface'] });
require(academyRoot.children.length === 1 &&
  academyRoot.children[0].children[1].value ===
    '23', 'Academy exposes its effective shared interface volume');
let input = academyRoot.children[0].children[1];
input.value = '31';
input.emit('input');
win.emit('storage', { key: 'revealline.fpv.audio-mix.v1' });
require(world.volumes().interface === 0.31 &&
  world.volumes().motor === 0.41, 'Cross-view updates preserve other channels');
language = 'uk';
controls.refresh();
require(root.children[0].children[0].textContent ===
  'Інтерфейс і сигнали', 'Slider label must localize');
for (const label of root.children) {
  const [name, slider] = label.children;
  require(slider.getAttribute('aria-labelledby') === name.id &&
    slider
      .getAttribute('aria-valuetext')
      .endsWith('%'), 'Sliders need explicit names and current values');
}
await world.setEnabled(true);
const graph = contexts[0];
require(graph?.state === 'running', 'Explicit sound activation enables world graph');
const master = graph.nodes.find((node) => node.outputs.includes(graph.destination));
const buses = graph.nodes.filter((node) => node.outputs.includes(master));
require(buses.length ===
  3, 'Each world audio family must have a separate master-connected gain bus');
const [feedback, motor, ambience] = buses;
require(equal(
  buses.map((bus) => bus.gain.value),
  [0.31, 0.41, 0.67],
), 'Existing levels must apply before first audio frame');
const state = {
  status: 'active',
  ticks: 1,
  step: 0,
  lastInput: { throttle: 700 },
  velocity: { x: 5000, y: 0, z: 0 },
  events: [],
};
world.update(state);
const reaches = (node, target) =>
  node === target || node.outputs.some((next) => reaches(next, target));
const oscillators = graph.nodes.filter((node) => node.kind === 'oscillator');
require(oscillators.length === 4 &&
  oscillators
    .slice(0, 3)
    .every((node) => reaches(node, motor)), 'All rotor sources must route through motor volume');
require(reaches(oscillators[3], ambience), 'Background hum must route through ambience volume');
require(graph.nodes
  .filter((node) => node.kind === 'source')
  .every((node) => reaches(node, ambience)), 'Wind must route through ambience volume');
world.update({
  ...state,
  ticks: 2,
  step: 1,
  events: [{ type: 'objective' }, { type: 'impact' }, { type: 'fire', actor: 'player' }],
});
const effects = graph.nodes.filter((node) => node.kind === 'oscillator').slice(4);
require(effects.length === 4 &&
  effects.every((node) =>
    reaches(node, feedback),
  ), 'Objective, impact and fire cues must share feedback volume');
world.setVolumes({ motor: 0 });
require(motor.gain.value === 0 &&
  ambience.gain.value === 0.67 &&
  feedback.gain.value === 0.31, 'Motor mute must leave ambience and cues independent');
world.setVolumes({ interface: 0 });
require(effects.every(
  (node) => node.stopped && node.disconnected,
), 'Zero feedback stops existing one-shots');
const count = graph.nodes.length;
world.update({ ...state, ticks: 3, events: [{ type: 'fire', actor: 'player' }] });
require(graph.nodes.length === count, 'Zero feedback does not allocate new cue voices');
world.pause();
require(graph.state === 'suspended' &&
  graph.nodes
    .filter((node) => node.outputs.includes(ambience))
    .every(
      (node) => node.gain.value === 0,
    ), 'Pause must suspend context and silence ambience source gains');
world.setVolumes(selected);
require(graph.state === 'suspended', 'Paused volume changes cannot resume sound');
await world.resume();
world.update({ ...state, ticks: 4 });
require(world.status().running &&
  motor.gain.value === 0.41, 'Explicit resume keeps independent chosen mix');
await world.setEnabled(false);
require(graph.state === 'suspended' &&
  !world.enabled(), 'Master mute must suspend the whole world graph');
require(equal(world.volumes(), selected), 'Master mute preserves mix levels');
// Instrumented trusted activation exercises production unlock conditions. This
// is not a browser autoplay qualification; actual browser checks are separate.
const button = {
  dataset: {},
  closest() {
    return this;
  },
  getAttribute() {
    return null;
  },
};
doc.emit('pointerdown', { isTrusted: true, target: button });
await menu.setSoundEnabled(true);
await Promise.resolve();
const ui = contexts[1];
const uiMaster = ui.nodes.find((node) => node.outputs.includes(ui.destination));
require(Math.abs(uiMaster.gain.value - 0.3 * 0.31) <
  1e-9, 'Interface level must scale the shared menu audio gain');
clock += 100;
doc.emit('click', { isTrusted: true, target: button });
require(ui.nodes.some(
  (node) => node.kind === 'source' && node.started,
), 'Enabled shared menu cue reaches the output bus');
menu.setVolume(0);
require(ui.nodes
  .filter((node) => node.kind === 'source')
  .every((node) => node.stopped), 'Interface zero stops already-playing menu cues');
win.emit('blur');
menu.setVolume(0.8);
require(ui.state === 'suspended', 'Volume change during focus loss cannot resume menu sound');
await menu.setSoundEnabled(false);
win.emit('focus');
require(ui.state === 'suspended', 'Regaining focus while muted cannot resume menu sound');
const denied = createSimAudioMix({
  storage: {
    getItem: () => null,
    setItem: () => {
      throw new Error('quota');
    },
  },
});
denied.set('interface', 0.2);
denied.set('motor', 0.4);
require(equal(denied.snapshot(), {
  interface: 0.2,
  motor: 0.4,
  ambience: 1,
}), 'Storage failure must preserve independent values during this visit');
controls.dispose();
academy.dispose();
world.dispose();
menu.dispose();
require(contexts.every(
  (context) => context.state === 'closed' && context.nodes.every((node) => node.disconnected),
), 'Disposal releases every audio node and context');
const sources = {};
for (const path of [
  'optional-practice/civilian-fpv/sim-presentation.mjs',
  'optional-practice/civilian-fpv/world-audio.mjs',
  'optional-practice/civilian-fpv/world-app.mjs',
  'optional-practice/civilian-fpv/app.mjs',
])
  sources[path] = createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
const evidence = {
  format: 'FPVAudioMixEvidence.v1',
  method:
    'Production modules exercised through their public APIs and rendered slider callbacks with an instrumented Web Audio boundary. Graph routing, parameter writes and lifecycle transitions are observed.',
  sources,
  checks: {
    slidersDoNotCreateOrUnlockAudio: true,
    sharedPersistentMix: true,
    crossViewChangePreservesOtherChannels: true,
    enUkAccessibleSliders: true,
    separateMotorAmbienceFeedbackBuses: true,
    allSourcesRoutedThroughTheirBus: true,
    zeroFeedbackStopsAndPreventsVoices: true,
    mutePreservesMix: true,
    pauseAndFocusLossStaySilent: true,
    menuGainScalesByInterfaceLevel: true,
    deniedStorageRetainsSessionMix: true,
    allAudioNodesAndContextsDisposed: true,
  },
  limitations: [
    'Instrumented graph verification is not an acoustic listening assessment or actual browser autoplay qualification.',
    'Actual browser UI verification is performed separately. Physical hardware sound quality is unmeasured.',
    'No new unit-test suite added; additional unit coverage remains deferred.',
  ],
};
const args = process.argv.slice(2);
if (args[0] === '--output' && args[1])
  await writeFile(args[1], `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));
