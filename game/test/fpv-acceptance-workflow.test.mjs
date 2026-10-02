import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { parse as parseModule } from 'acorn';
import {
  ACCEPTANCE_CASES,
  acceptanceRoute,
  acceptanceFrame,
  compareAcceptanceRuns,
  frameStatistics,
} from '../../authoring/fpv-worlds/acceptance-protocol.mjs';
import {
  acceptanceDependencies,
  prepareAcceptance,
} from '../../scripts/prepare-sim-appearance-acceptance.mjs';

test('calibration initializes a valid course and renders every offered Academy, World and Adventure environment', async () => {
  const [THREE, visuals, catalogue, worlds, themes, { Document, Events }] = await Promise.all([
    import('../../optional-practice/civilian-fpv/vendor/three.module.js'),
    import('../../optional-practice/civilian-fpv/world-visuals.mjs'),
    import('../../optional-practice/civilian-fpv/catalogue.mjs'),
    import('../../optional-practice/civilian-fpv/world-catalogue.mjs'),
    import('../presentation/theme-system.mjs'),
    import('./helpers/couch-dom.mjs'),
  ]);
  let source = await fs.readFile(
    new URL('../../authoring/fpv-worlds/calibration.mjs', import.meta.url),
    'utf8',
  );
  const ast = parseModule(source, { ecmaVersion: 'latest', sourceType: 'module' });
  for (const declaration of ast.body.filter((node) => node.type === 'ImportDeclaration').reverse())
    source = source.slice(0, declaration.start) + source.slice(declaration.end);
  source = source
    .replaceAll('export function ', 'function ')
    .replaceAll('export async function ', 'async function ');
  const document = new Document(),
    window = new Events(),
    installed = [],
    drawn = [];
  const values = {
    collection: 'industrial-workshop',
    specimen: 'industrial-workshop',
    environment: '',
    course: '',
    camera: 'overview',
    quality: 'balanced',
  };
  for (const id of [
    ...Object.keys(values),
    'candidate-status',
    'compare',
    'comparison',
    'scene-stats',
    'flight',
    'materials',
  ]) {
    const element = document.createElement(Object.hasOwn(values, id) ? 'select' : 'div');
    element.id = id;
    element.value = values[id] ?? '';
    element.clientWidth = 800;
    element.clientHeight = 420;
    document.body.append(element);
  }
  let nextFrame,
    selected,
    disposed = false;
  const flight = {
    available: true,
    setPresentation() {},
    setDrone() {},
    setQuality() {},
    setCourse(course) {
      assert.ok(
        course?.spawn && course?.steps,
        'the actual initial setCourse receives a complete course',
      );
      selected = course;
      installed.push(course);
    },
    draw(state) {
      assert.ok(['x', 'y', 'z'].every((axis) => Number.isFinite(state.position[axis])));
      drawn.push(selected.id);
    },
    resources: () => ({
      presentation: { profileId: 'industrial-workshop' },
      renderer: { calls: 1, triangles: 12, textures: 0 },
    }),
    dispose() {
      disposed = true;
    },
  };
  class Renderer {
    capabilities = { getMaxAnisotropy: () => 1 };
    info = { memory: {}, programs: [] };
    setSize() {}
    render() {}
    dispose() {}
    forceContextLoss() {}
  }
  const allCourses = [
      ...catalogue.FLIGHT_COURSES,
      ...worlds.WORLD_COURSES,
      ...worlds.ADVENTURE_COURSES,
    ],
    before = JSON.stringify(allCourses);
  vm.runInNewContext(source, {
    ...catalogue,
    ...worlds,
    ...themes,
    ...visuals,
    FLIGHT_WORLDS: [
      ...worlds.FLIGHT_WORLDS,
      { id: 'empty-test-environment', title: { en: 'No courses' } },
    ],
    THREE: { ...THREE, WebGLRenderer: Renderer },
    document,
    window,
    location: { href: 'https://example.test/authoring/fpv-worlds/calibration.html' },
    URL,
    performance: { now: () => 0 },
    createFlightRenderer: () => flight,
    requestAnimationFrame: (callback) => {
      nextFrame = callback;
      return 1;
    },
    cancelAnimationFrame() {},
  });
  const environment = document.getElementById('environment'),
    courseSelect = document.getElementById('course');
  assert.deepEqual(
    environment.children.map((option) => option.value),
    worlds.FLIGHT_WORLDS.map((world) => world.id),
    'all currently shipped environments are offered; empty additions are not',
  );
  assert.equal(installed[0].environment, worlds.FLIGHT_WORLDS[0].id);
  assert.equal(drawn[0], installed[0].id, 'the initial frame reaches the real page render path');
  for (const world of worlds.FLIGHT_WORLDS) {
    environment.value = world.id;
    environment.emit('change');
    const expected = allCourses.filter((course) => course.environment === world.id);
    assert.deepEqual(
      courseSelect.children.map((option) => option.value),
      expected.map((course) => course.id),
    );
    assert.equal(installed.at(-1).environment, world.id);
    nextFrame();
    assert.equal(drawn.at(-1), installed.at(-1).id);
    courseSelect.value = expected.at(-1).id;
    courseSelect.emit('change');
    document.getElementById('quality').emit('change');
    assert.equal(
      installed.at(-1).id,
      expected.at(-1).id,
      'a valid explicit course survives other control changes',
    );
  }
  environment.value = 'missing';
  courseSelect.value = 'stale';
  environment.emit('change');
  assert.equal(environment.value, worlds.FLIGHT_WORLDS[0].id);
  assert.equal(installed.at(-1).environment, environment.value);
  assert.equal(JSON.stringify(allCourses), before);
  window.emit('pagehide');
  assert.equal(disposed, true);
});

test('fixed acceptance routes cover every current environment without changing course data', () => {
  assert.equal(ACCEPTANCE_CASES.length, 14);
  for (const { course } of ACCEPTANCE_CASES) {
    const before = JSON.stringify(course),
      first = acceptanceRoute(course),
      second = acceptanceRoute(course);
    assert.deepEqual(first, second);
    assert.ok(first.views.some((view) => view.id === 'near'));
    assert.ok(first.views.some((view) => view.id === 'far'));
    assert.ok(first.views.some((view) => view.id === 'grazing'));
    for (let tick = 0; tick < 240; tick++) {
      const frame = acceptanceFrame(course, first, tick);
      for (const axis of ['x', 'z']) {
        assert.ok(frame.state.position[axis] >= course.bounds.min[axis]);
        assert.ok(frame.state.position[axis] <= course.bounds.max[axis]);
      }
      const length = Math.hypot(...frame.state.orientation.map((value) => value / 1000000));
      assert.ok(Math.abs(length - 1) < 0.000002);
      assert.deepEqual(frame, acceptanceFrame(course, first, tick));
    }
    assert.equal(JSON.stringify(course), before);
    assert.throws(() => acceptanceFrame(course, first, -1));
    assert.throws(() => acceptanceFrame(course, first, 0, 'missing'));
  }
});
test('paired comparison rejects changed conditions or incomplete runs and retains both directional results', () => {
  const row = {
    quality: 'balanced',
    courseId: 'course',
    viewport: [800, 600],
    routeSha256: 'route',
    sourceSha256: 'source',
    samples: 240,
  };
  const runs = ['authored', 'industrial-workshop', 'industrial-workshop', 'authored'].map(
    (collectionId) => ({ ...row, collectionId, frame: { p95Ms: 16 } }),
  );
  assert.equal(compareAcceptanceRuns(runs, 'industrial-workshop').browserFrameGate, 'pass');
  runs[2].frame = { p95Ms: 20 };
  const failed = compareAcceptanceRuns(runs, 'industrial-workshop');
  assert.equal(failed.browserFrameGate, 'review');
  assert.equal(failed.physicalDeviceQualified, false);
  assert.throws(() => compareAcceptanceRuns(runs.slice(0, 3), 'industrial-workshop'), /complete/);
  assert.throws(
    () =>
      compareAcceptanceRuns(
        runs.map((r, i) => (i === 1 ? { ...r, quality: 'low' } : r)),
        'industrial-workshop',
      ),
    /conditions/,
  );
});
test('percentiles use bounded actual samples and reject missing timing data', () => {
  assert.equal(frameStatistics(Array.from({ length: 240 }, (_, i) => i + 1)).p95Ms, 228);
  assert.throws(() => frameStatistics([16]), /120/);
  assert.throws(() => frameStatistics(Array(240).fill(NaN)), /finite/);
});
test('snapshot closure discovers loader imports and styles but refuses external or escaping dependencies', async () => {
  assert.deepEqual(
    acceptanceDependencies(
      'authoring/fpv-worlds/a.mjs',
      Buffer.from(
        "import '../../game/data-json.mjs'; export * from './b.mjs'; const load=()=>import('./c.mjs');",
      ),
    ).sort(),
    ['authoring/fpv-worlds/b.mjs', 'authoring/fpv-worlds/c.mjs', 'game/data-json.mjs'],
  );
  assert.deepEqual(
    acceptanceDependencies(
      'game/a.css',
      Buffer.from("@import url('./b.css'); .test { background: url('data:image/svg+xml,test'); }"),
    ),
    ['game/b.css'],
  );
  assert.deepEqual(acceptanceDependencies('game/a.css', Buffer.from("@import './b.css' screen;")), [
    'game/b.css',
  ]);
  assert.throws(
    () => acceptanceDependencies('game/a.mjs', Buffer.from('import(computedPath);')),
    /computed fixture import/,
  );
  assert.throws(
    () =>
      acceptanceDependencies('game/a.mjs', Buffer.from("import 'https://example.com/module.mjs';")),
    /Unsupported/,
  );
  assert.throws(
    () => acceptanceDependencies('game/a.mjs', Buffer.from("import '../../outside.mjs';")),
    /escapes/,
  );
  await assert.rejects(() => prepareAcceptance({ name: '../overwrite' }), /snapshot name/);
  const result = await prepareAcceptance({ verifyOnly: true });
  assert.equal(result.writes, 0);
  assert.ok(result.files > 10 && result.files <= 128);
  assert.ok(result.bytes < 32 * 1024 * 1024);
});

// Exercise the actual authoring controller around delayed source verification and renderer failures.
// DOM/WebGL boundaries are stubbed; these tests do not claim visual or GPU qualification.
async function controllerFixture() {
  const source = await fs.readFile(
    new URL('../../authoring/fpv-worlds/acceptance.mjs', import.meta.url),
    'utf8',
  );
  const ast = parseModule(source, { ecmaVersion: 'latest', sourceType: 'module' });
  let executable = source;
  for (const item of ast.body.filter((item) => item.type === 'ImportDeclaration').reverse())
    executable = executable.slice(0, item.start) + executable.slice(item.end);
  executable = executable
    .replace('import.meta.url', "'https://example.test/authoring/fpv-worlds/acceptance.mjs'")
    .replace('export function acceptanceReport', 'function acceptanceReport');
  const elements = new Map(),
    windowEvents = new Map();
  class Element {
    constructor(id) {
      this.id = id;
      this.value = { quality: 'balanced', verdict: 'pass', notes: '' }[id] ?? '';
      this.disabled = false;
      this.listeners = new Map();
      this.clientWidth = this.width = 800;
      this.clientHeight = this.height = 450;
    }
    add(option) {
      if (!this.value) this.value = option.value;
    }
    replaceChildren(...options) {
      this.value = options[0]?.value ?? '';
    }
    addEventListener(event, callback) {
      this.listeners.set(event, callback);
    }
    fire(event) {
      return this.listeners.get(event)?.();
    }
    getContext() {
      return {
        getExtension: () => null,
        getParameter: () => 'Test graphics',
        isContextLost: () => false,
      };
    }
    toBlob() {
      throw new Error('Unexpected capture before scene readiness');
    }
  }
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, new Element(id));
    return elements.get(id);
  };
  let releaseFetch;
  const initialFetch = new Promise((resolve) => {
    releaseFetch = resolve;
  });
  const state = { installs: 0, prepared: true, failDigest: false, disposed: false };
  const renderer = {
    available: true,
    setPresentation: () => {
      state.installs++;
    },
    setQuality() {},
    setCourse() {},
    setDrone() {},
    draw() {},
    prepare: async () => state.prepared,
    dispose: () => {
      state.disposed = true;
    },
  };
  const scope = {
    document: { getElementById: element, visibilityState: 'visible', hasFocus: () => true },
    window: { addEventListener: (event, callback) => windowEvents.set(event, callback) },
    navigator: { userAgent: 'test', platform: 'test' },
    devicePixelRatio: 1,
    innerWidth: 800,
    innerHeight: 600,
    URL,
    Blob,
    TextEncoder,
    TextDecoder,
    Uint8Array,
    structuredClone,
    setTimeout,
    performance: { now: () => 0 },
    crypto: {
      subtle: {
        digest: async (...args) => {
          if (state.failDigest) throw new Error('Digest unavailable');
          return webcrypto.subtle.digest(...args);
        },
      },
    },
    fetch: () => initialFetch,
    Option: class {
      constructor(text, value) {
        this.text = text;
        this.value = value;
      }
    },
    createFlightRenderer: () => renderer,
    builtinWorldScene: () => null,
    SIM_VISUAL_COLLECTIONS: { 'industrial-workshop': {} },
    ACCEPTANCE_PROTOCOL: 'SIMAppearanceAcceptance.v1',
    ACCEPTANCE_CASES: [
      { id: 'gym', title: 'Gym', renderer: 'academy', course: { id: 'test-course' } },
    ],
    acceptanceRoute: () => ({ views: [{ id: 'near', title: 'Near' }], gate: true }),
    acceptanceFrame: () => ({ state: {}, options: {} }),
  };
  const boot = vm.runInNewContext(
    `(async () => { ${executable}; return acceptanceReport; })()`,
    scope,
  );
  return {
    element,
    state,
    scope,
    boot,
    rejectSource: () => releaseFetch({ ok: false }),
    acceptSource: () => {
      const bytes = new TextEncoder().encode(
        JSON.stringify({ format: 'SIMAppearanceSource.v1', files: [], revision: 'test-only' }),
      );
      releaseFetch({ ok: true, arrayBuffer: async () => bytes.buffer });
    },
    pagehide: () => windowEvents.get('pagehide')(),
  };
}

test('authoring controls cannot bypass pending or failed source verification', async () => {
  const fixture = await controllerFixture();
  for (const id of [
    'environment',
    'collection',
    'quality',
    'view',
    'measure',
    'record-review',
    'capture',
  ])
    assert.equal(fixture.element(id).disabled, true, id);
  await fixture.element('quality').fire('change');
  await fixture.element('measure').fire('click');
  fixture.element('record-review').fire('click');
  fixture.element('capture').fire('click');
  assert.equal(fixture.state.installs, 0);
  fixture.rejectSource();
  const report = await fixture.boot;
  await fixture.element('environment').fire('change');
  assert.equal(fixture.state.installs, 0);
  assert.equal(report().reviews.length, 0);
  assert.equal(fixture.element('measure').disabled, true);
  assert.equal(fixture.element('cancel').disabled, true);
});

test('failed scene changes block mislabeled reviews and recover only after a successful install', async () => {
  const fixture = await controllerFixture();
  fixture.acceptSource();
  const report = await fixture.boot;
  fixture.element('record-review').fire('click');
  const first = report().reviews[0];
  assert.deepEqual(first.device.viewport, [800, 600]);
  fixture.scope.innerWidth = 390;
  assert.deepEqual(report().reviews[0].device.viewport, [800, 600]);
  fixture.state.prepared = false;
  fixture.element('quality').value = 'high';
  await fixture.element('quality').fire('change');
  fixture.element('record-review').fire('click');
  fixture.element('capture').fire('click');
  assert.equal(report().reviews.length, 1);
  assert.equal(fixture.element('record-review').disabled, true);
  assert.equal(fixture.element('measure').disabled, true);
  assert.equal(fixture.element('quality').disabled, false, 'selectors can retry a failed scene');
  fixture.state.prepared = true;
  await fixture.element('quality').fire('change');
  fixture.element('record-review').fire('click');
  assert.equal(report().reviews[1].quality, 'high');
  assert.deepEqual(report().reviews[1].device.viewport, [390, 600]);
});

test('closing the page while source verification waits never installs into a disposed renderer', async () => {
  const fixture = await controllerFixture();
  fixture.pagehide();
  fixture.acceptSource();
  const report = await fixture.boot;
  assert.equal(fixture.state.disposed, true);
  assert.equal(fixture.state.installs, 0);
  assert.equal(fixture.element('measure').disabled, true);
  assert.equal(fixture.element('quality').disabled, true);
  assert.equal(report().reviews.length, 0);
});

test('measurement hashing failures release controls and disposal cannot reactivate them', async () => {
  const fixture = await controllerFixture();
  fixture.acceptSource();
  const report = await fixture.boot;
  fixture.state.failDigest = true;
  await fixture.element('measure').fire('click');
  assert.match(fixture.element('status').textContent, /Digest unavailable/);
  assert.equal(fixture.element('measure').disabled, false);
  assert.equal(fixture.element('cancel').disabled, true);
  assert.equal(report().comparisons.length, 0);
  fixture.pagehide();
  await fixture.element('quality').fire('change');
  fixture.element('record-review').fire('click');
  assert.equal(fixture.state.disposed, true);
  assert.equal(fixture.element('measure').disabled, true);
  assert.equal(fixture.element('quality').disabled, true);
  assert.equal(report().reviews.length, 0);
});
