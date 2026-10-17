import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'acorn';

// Execute the actual host callback so this check cannot drift into a copied policy.
const source = await readFile(
  new URL('../../../optional-practice/civilian-fpv/world-app.mjs', import.meta.url),
  'utf8',
);
let frame;
function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'FunctionDeclaration' && node.id.name === 'advanceFrame') frame = node;
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value?.type) visit(value);
  }
}
visit(parse(source, { ecmaVersion: 'latest', sourceType: 'module' }));
assert(frame);
const advance = new Function(
  'scope',
  `with (scope) { return (${source.slice(frame.start, frame.end)})(now); }`,
);

function fixture({
  status = 'paused',
  ready = true,
  chooser = false,
  settings = false,
  guide = false,
  terminal = false,
} = {}) {
  const events = [];
  const snapshot = { status, ticks: 1, reason: 'prepared' };
  const nodes = {
    'flight-dialog': { open: true, dataset: {} },
    'flight-source': { value: 'keyboard' },
    'flight-camera': { value: 'fpv' },
    'sim-settings': { open: settings },
  };
  const record = (name) => () => {
    events.push(name);
  };
  const scope = {
    now: 40,
    win: { performance: { now: () => 40 } },
    lastExecutionTime: 20,
    lastTime: 20,
    accumulator: 0,
    flight: {
      snapshot: () => snapshot,
      step: () => {
        events.push('step');
        snapshot.ticks++;
      },
    },
    $: (id) => {
      assert(nodes[id], id);
      return nodes[id];
    },
    pollGamepad: record('device'),
    pollMenu: record('menu'),
    replayProof: null,
    replayKind: null,
    current: { regional: true },
    beginnerCoach: { wantsRadioPreview: () => false, blocksArm: () => guide },
    continuousPlay: { advance: record('clock') },
    sceneReady: ready,
    ghostLookup: null,
    input: { sample: record('sample') },
    fire: false,
    recorder: null,
    audio: { update: record('audio') },
    presentation: { pause: record('presentation') },
    missionChooser: { elements: { dialog: { open: chooser } } },
    renderer: {
      observePresentation: record('observe'),
      objectiveScreen: record('objective'),
      aimScreen: record('aim'),
    },
    flightHud: { setWorldCue: record('cue'), setAim: record('aim-hud') },
    drawFlight: record('draw'),
    updateHUD: record('hud'),
    paintInput: record('sticks'),
    paintCoach: record('guide'),
    terminal: () => terminal,
    flightToken: 1,
    finishFlight: () => {
      events.push('finish');
      return Promise.resolve();
    },
    reportError: (error) => {
      throw error;
    },
  };
  return { scope, events, snapshot, nodes };
}
const run = (options) => {
  const f = fixture(options);
  advance(f.scope);
  return f;
};
const observers = ['draw', 'objective', 'aim', 'hud', 'sticks'];
let checks = 0;
for (const status of ['paused', 'disarmed']) {
  for (const cover of ['chooser', 'settings']) {
    const f = run({ status, [cover]: true });
    assert.deepEqual(f.events, ['device', 'menu', 'clock', 'audio']);
    assert.equal(f.snapshot.ticks, 1);
    assert.equal(f.scope.lastTime, 40);
    assert.equal(f.scope.lastExecutionTime, 40);
    if (cover === 'chooser') f.scope.missionChooser.elements.dialog.open = false;
    else f.nodes['sim-settings'].open = false;
    f.events.length = 0;
    advance(f.scope);
    for (const name of observers)
      assert(f.events.includes(name), `${cover} close restores ${name}`);
    checks++;
  }
}
// Menu polling can close the cover in this same callback; redraw is immediate.
{
  const f = fixture({ chooser: true });
  f.scope.pollMenu = () => {
    f.events.push('menu');
    f.scope.missionChooser.elements.dialog.open = false;
  };
  advance(f.scope);
  assert(f.events.includes('draw'));
  checks++;
}
// An ordinary pause has a visible scene; opaque-only suppression must not apply.
for (const options of [
  {},
  { ready: false, chooser: true },
  { status: 'active', chooser: true },
  { terminal: true, settings: true },
  { guide: true, chooser: true },
]) {
  const f = run(options);
  if (options.guide) {
    assert.deepEqual(f.events, ['device', 'menu', 'clock', 'guide']);
  } else {
    assert(f.events.includes('hud'));
    assert(f.events.includes('sticks'));
    assert.equal(f.events.includes('draw'), options.ready !== false);
    assert.equal(f.events.includes('finish'), options.terminal === true);
    assert.equal(f.events.includes('step'), options.status === 'active');
    if (options.status === 'active') assert.equal(f.snapshot.ticks, 2);
  }
  checks++;
}
console.log(
  JSON.stringify(
    {
      checks,
      passed: true,
      productionCallback: 'advanceFrame',
      scope:
        'Opaque chooser/settings observers only; no browser cadence or rendering performance claim',
    },
    null,
    2,
  ),
);
