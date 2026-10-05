/** Manual mounted-app functional probe; uses the existing lightweight DOM boundary. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { parse } from 'parse5';
import { IDBFactory } from 'fake-indexeddb';
import { Document, Events } from '../../../game/test/helpers/couch-dom.mjs';
import { mountWorldApp } from '../../../optional-practice/civilian-fpv/world-app.mjs';
import { resolveSimThemeProfile } from '../../../optional-practice/civilian-fpv/world-themes.mjs';
import {
  worldRecordIdentity,
  exportProofParts,
  openWorldRecords,
} from '../../../optional-practice/civilian-fpv/world-records.mjs';
import { inspectPack } from '../../../optional-practice/civilian-fpv/world-content.mjs';
import {
  worldFlightIdentity,
  createWorldFlight,
  initWorldRuntime,
  validateWorldCourse,
} from '../../../optional-practice/civilian-fpv/world-model.mjs';
import { WORLD_CATALOGUE } from '../../../optional-practice/civilian-fpv/world-catalogue.mjs';
import { openWorldStore } from '../../../optional-practice/civilian-fpv/world-store.mjs';
const html = parse(
  fs.readFileSync(
    new URL('../../../optional-practice/fpv-worlds/index.html', import.meta.url),
    'utf8',
  ),
);
function fixture(t, indexedDB = new IDBFactory()) {
  const doc = new Document(),
    win = new Events(),
    storage = new Map(),
    frames = new Map(),
    rendered = [];
  let frameId = 0,
    now = 0,
    rendererDisposals = 0;
  const createElement = doc.createElement.bind(doc);
  doc.createElement = (tag) => {
    const element = createElement(tag);
    Object.defineProperty(element, 'previousElementSibling', {
      get() {
        const siblings = this.parentElement?.children.filter((child) => child.nodeType === 1);
        return siblings?.[siblings.indexOf(this) - 1] ?? null;
      },
    });
    return element;
  };
  const priorOption = globalThis.Option;
  globalThis.Option = function (text, value) {
    const option = doc.createElement('option');
    option.textContent = text;
    option.value = value;
    return option;
  };
  t.after(() => {
    if (priorOption) globalThis.Option = priorOption;
    else delete globalThis.Option;
  });
  doc.createElementNS = (_namespace, name) => doc.createElement(name);
  function copy(source, parent) {
    if (!source.tagName) return;
    const element = doc.createElement(source.tagName);
    for (const { name, value } of source.attrs ?? []) {
      element.setAttribute(name, value);
      if (name === 'class') element.className = value;
      if (name === 'hidden') element.hidden = true;
      if (name === 'value') element.value = value;
      if (['min', 'max'].includes(name)) element[name] = value;
    }
    parent.append(element);
    for (const child of source.childNodes ?? []) copy(child, element);
    if (source.tagName === 'select') {
      element.value = element.children[0]?.value ?? '';
      Object.defineProperty(element, 'selectedOptions', {
        get: () => element.options.filter((option) => option.value === element.value),
      });
    }
  }
  const body = html.childNodes
    .find((node) => node.tagName === 'html')
    .childNodes.find((node) => node.tagName === 'body');
  for (const child of body.childNodes) copy(child, doc.body);
  Object.assign(win, {
    location: new URL('https://example.test/optional-practice/fpv-worlds/index.html'),
    performance: { now: () => now },
    navigator: { getGamepads: () => [] },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    indexedDB,
    requestAnimationFrame(callback) {
      frames.set(++frameId, callback);
      return frameId;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
    matchMedia: () => ({ matches: false }),
    setTimeout,
    clearTimeout,
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
  });
  const renderer = {
    available: true,
    setPresentation(value) {
      this.presentation = value;
    },
    setCourse(course) {
      rendered.push({
        course,
        presentation: this.presentation,
        profile: resolveSimThemeProfile(course, this.presentation),
      });
    },
    setQuality() {},
    setDrone(drone) {
      if (rendered.length) rendered.at(-1).drone = drone;
    },
    setGhost() {},
    setPath() {},
    async loadScene() {},
    draw() {},
    dispose() {
      rendererDisposals++;
    },
  };
  const app = mountWorldApp({ document: doc, window: win, rendererFactory: () => renderer });
  t.after(() => app.dispose());
  return {
    app,
    doc,
    win,
    rendered,
    pendingFrames: () => frames.size,
    rendererDisposals: () => rendererDisposals,
    $: (id) => doc.getElementById(id),
    tick(count = 1) {
      for (let i = 0; i < count; i++) {
        const [id, callback] = frames.entries().next().value;
        frames.delete(id);
        callback(now);
        now += 20;
      }
    },
  };
}

const root = new URL('./', import.meta.url);
const packBytes = fs.readFileSync(new URL('momentum-contact-practice.rlpack', root));
const proofBytes = fs.readFileSync(new URL('momentum-contact-practice.proofs.json', root));
const archive = JSON.parse(proofBytes);
const pack = await inspectPack(packBytes);
const source = pack.project.courses[0];
const modes = ['self-level', 'acro'];
const rows = [];
let checks = 0;
const check = (condition, message) => {
  checks++;
  assert.ok(condition, message);
};
const equal = (actual, expected, message) => {
  checks++;
  assert.deepEqual(actual, expected, message);
};
const waitFor = async (condition, message) => {
  const deadline = Date.now() + 15000;
  while (!condition() && Date.now() < deadline)
    await new Promise((resolve) => setTimeout(resolve, 1));
  check(condition(), message);
};
const mixed = structuredClone(source);
delete mixed.steps.acro[0].contactPolicy;
const plain = WORLD_CATALOGUE.find(
  (entry) =>
    !entry.legacy &&
    entry.course.format === 'FlightCourse.v2' &&
    Object.values(entry.course.steps).every((steps) =>
      steps.every((step) => step.type === 'survive'),
    ),
)?.course;
const archetypes = [
  ['momentum', source],
  ['mixed-mode', mixed],
  ['ordinary-Hunt', WORLD_CATALOGUE.find((entry) => entry.id === 'snake-hunt-chase-01').course],
  [
    'pursuit-v1',
    WORLD_CATALOGUE.find((entry) => entry.course.pursuit?.format === 'FlightPursuit.v1').course,
  ],
  [
    'pursuit-v2',
    WORLD_CATALOGUE.find((entry) => entry.course.pursuit?.format === 'FlightPursuit.v2').course,
  ],
  [
    'ordinary',
    plain ?? {
      ...source,
      steps: {
        'self-level': [{ type: 'survive', ticks: 1 }],
        acro: [{ type: 'survive', ticks: 1 }],
      },
    },
  ],
];
// These calls precede physics initialization and must remain pure metadata reads.
const identities = archetypes.flatMap(([kind, course]) =>
  modes.map((mode) => ({
    kind,
    course,
    mode,
    identity: worldFlightIdentity({ course, mode }),
  })),
);
equal(
  worldFlightIdentity({ course: mixed, mode: 'self-level' }).model,
  'civilian-world-hunt.v2',
  'Selected momentum mode resolves its exact model',
);
equal(
  worldFlightIdentity({ course: mixed, mode: 'acro' }).model,
  'civilian-world-hunt.v1',
  'Other mode keeps the legacy Hunt contract',
);
await initWorldRuntime();
for (const item of identities) {
  const flight = createWorldFlight(item);
  try {
    equal(
      flight.identity,
      item.identity,
      `${item.kind}/${item.mode}: metadata and actual flight identities agree`,
    );
  } finally {
    flight.dispose();
  }
}
rows.push({
  kind: 'read-only-runtime-identity',
  beforePhysicsInitialization: true,
  variants: identities.map(({ kind, mode, identity }) => ({ kind, mode, model: identity.model })),
});

const wrong = structuredClone(archive.records[0]);
wrong.proof.model = 'civilian-world-hunt.v1';
wrong.id = worldRecordIdentity(wrong);
const wrongParts = await exportProofParts([wrong]);
const createHost = (idb) => {
  const cleanups = [];
  const host = fixture({ after: (fn) => cleanups.push(fn) }, idb);
  host.close = async () => {
    for (const fn of cleanups.reverse()) await fn();
  };
  return host;
};
const choosePractice = (host) => {
  host.$('search').value = 'Keep moving after the catch';
  host.$('search').emit('input');
};
const watchButton = (host) => host.$('world-grid').querySelector('.watch-example');
const importFile = async (host, id, bytes, name, done) => {
  const file = Object.assign(new Blob([bytes]), { name });
  host.$(id).files = [file];
  host.$(id).emit('change');
  await waitFor(done, `${name}: mounted import finishes`);
};
const host = createHost();
try {
  await host.app.ready;
  const before = host.app.snapshot().catalogue;
  await importFile(
    host,
    'import-pack',
    packBytes,
    'momentum-contact-practice.rlpack',
    () => host.app.snapshot().catalogue === before + 1,
  );
  choosePractice(host);
  equal(watchButton(host), null, 'A pack without a recording does not advertise Watch');
  await importFile(
    host,
    'import-proofs',
    JSON.stringify(wrongParts[0]),
    'wrong-model.proofs.json',
    () => host.app.snapshot().records.length === 1,
  );
  equal(
    host.app.snapshot().records[0].status,
    'invalid',
    'Wrong-model native import fails replay verification',
  );
  equal(watchButton(host), null, 'Wrong model does not advertise Watch');
  await importFile(
    host,
    'import-proofs',
    proofBytes,
    'momentum-contact-practice.proofs.json',
    () => host.app.snapshot().records.filter((record) => record.status === 'verified').length === 2,
  );
  for (const mode of modes) {
    host.$('flight-mode').value = mode;
    host.$('flight-mode').emit('change');
    check(!!watchButton(host), `${mode}: imported verified example exposes Watch`);
  }
  rows.push({
    kind: 'mounted-import',
    packInstalled: true,
    wrongModelRejected: true,
    verifiedExamples: 2,
    watchModes: modes,
  });
} finally {
  await host.close();
}

// Even stale verified metadata cannot bless an incompatible runtime model.
const idb = new IDBFactory();
const worlds = await openWorldStore({ indexedDB: idb });
await worlds.install({ ...pack, expectedGeneration: await worlds.generation() });
worlds.close();
const records = await openWorldRecords(idb);
await records.put({
  course: wrong.course,
  proof: wrong.proof,
  packIdentity: wrong.packIdentity,
  status: 'verified',
  diagnostic: 'complete',
});
records.close();
const stale = createHost(idb);
try {
  await stale.app.ready;
  choosePractice(stale);
  equal(
    stale.app.snapshot().records[0].status,
    'verified',
    'Probe reaches the exact runtime guard after saved status admission',
  );
  equal(watchButton(stale), null, 'Stale verified wrong-model record remains unavailable');
  rows.push({ kind: 'mounted-stale-metadata', wrongModelWatchUnavailable: true });
} finally {
  await stale.close();
}

const receipt = {
  format: 'fpv-hunt-momentum-catalogue.v1',
  sourceFiles: ['world-app.mjs', 'world-model.mjs'].map((name) => ({
    path: `optional-practice/civilian-fpv/${name}`,
    sha256: crypto
      .createHash('sha256')
      .update(
        fs.readFileSync(
          new URL(`../../../optional-practice/civilian-fpv/${name}`, import.meta.url),
        ),
      )
      .digest('hex'),
  })),
  passed: true,
  checks,
  rows,
  boundary:
    'Mounted production app with DOM and renderer boundaries; native browser review remains separate.',
};
if (process.argv.includes('--write'))
  fs.writeFileSync(
    new URL('evidence/catalogue.json', root),
    JSON.stringify(receipt, null, 2) + '\n',
  );
console.log(JSON.stringify(receipt, null, 2));
