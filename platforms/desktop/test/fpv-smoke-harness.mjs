/* global window, document, navigator, localStorage */
/** Test-only native fixture. Never admitted to ordinary FPV or game releases. */
import { mountWorldApp } from '../../../optional-practice/civilian-fpv/world-app.mjs';
import { createEnduranceFixture } from '../../../authoring/fpv-worlds/regions/endurance-fixture.mjs';
import { regionalReviewEntry } from '../../../optional-practice/civilian-fpv/regional-session.mjs';
import { exportJSONFile } from '../../../game/platform.mjs';
import {
  TUNING_LIBRARY_KEY,
  validateTuningLibrary,
} from '../../../optional-practice/civilian-fpv/tuning-library.mjs';

const evidence = {
  format: 'FpvNativeRuntimeSmoke.v1',
  scope:
    'Explicit test fixture: production World host, renderer, worker and native shell; production access pages unchanged. This does not qualify authentication, signed distribution, iOS or other devices.',
  started: new Date().toISOString(),
  userAgent: navigator.userAgent,
  origin: window.location.origin,
  capabilities: {
    secureContext: window.isSecureContext,
    webLocks: typeof navigator.locks?.request === 'function',
    indexedDB: Boolean(window.indexedDB),
  },
  errors: [],
  samples: [],
  lifecycle: [],
  workers: { created: 0, terminated: 0, live: 0 },
};
const NativeWorker = window.Worker;
window.Worker = class extends NativeWorker {
  constructor(...args) {
    super(...args);
    evidence.workers.created++;
    evidence.workers.live++;
    this.qualificationClosed = false;
  }
  terminate() {
    if (!this.qualificationClosed) {
      this.qualificationClosed = true;
      evidence.workers.terminated++;
      evidence.workers.live--;
    }
    return super.terminate();
  }
};
window.addEventListener('error', (event) => evidence.errors.push(event.message));
window.addEventListener('unhandledrejection', (event) =>
  evidence.errors.push(String(event.reason?.stack ?? event.reason)),
);

const panel = document.createElement('details');
panel.id = 'native-smoke-panel';
panel.style.cssText =
  'position:fixed;bottom:0;left:0;right:0;z-index:2147483647;max-height:32vh;overflow:auto;background:#18252b;color:#fff;padding:8px 14px;font:14px/1.4 system-ui;border-top:3px solid #fbbf24';
const summary = document.createElement('summary');
summary.textContent = 'TEST FIXTURE · Native runtime qualification · Loading';
panel.append(summary);
const note = document.createElement('p');
note.textContent = evidence.scope;
panel.append(note);
const controls = document.createElement('div');
controls.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
panel.append(controls);
const output = document.createElement('pre');
output.style.cssText = 'white-space:pre-wrap;font-size:12px';
panel.append(output);
document.body.append(panel);
let app,
  disposed = false;

function library() {
  const text = localStorage.getItem(TUNING_LIBRARY_KEY);
  return text ? validateTuningLibrary(JSON.parse(text)) : null;
}
function sample(label) {
  const entry = {
    label,
    at: new Date().toISOString(),
    visible: document.visibilityState,
    focused: document.hasFocus(),
    state: app?.snapshot(),
    library: library(),
    workers: { ...evidence.workers },
  };
  evidence.samples.push(entry);
  if (evidence.samples.length > 200) evidence.samples.shift();
  return entry;
}
function show() {
  // Native <dialog> makes siblings inert. Keep test observability in the same
  // top-layer surface without closing or bypassing any production menu.
  const surface = [...document.querySelectorAll('dialog:modal')].at(-1) ?? document.body;
  if (panel.parentNode !== surface) surface.append(panel);
  const state = app?.snapshot()?.state;
  const saved = library();
  const value = {
    status: disposed ? 'disposed' : (state?.status ?? 'menu'),
    reason: state?.reason,
    ticks: state?.ticks,
    advanced: state?.advanced ?? false,
    backend: state?.advancedTelemetry?.backend,
    workers: evidence.workers,
    profiles: saved?.profiles.map(({ name, revision }) => ({ name, revision })) ?? [],
    revision: saved?.revision ?? null,
    samples: evidence.samples.length,
    errors: evidence.errors,
    storageProbe: evidence.storageProbe,
  };
  summary.textContent = `TEST FIXTURE · ${value.status} · ${value.advanced ? 'Advanced' : 'Legacy'} · tick ${value.ticks ?? '—'} · workers ${value.workers.live} · errors ${value.errors.length}`;
  output.textContent = JSON.stringify(value, null, 2);
}
function button(label, action) {
  const node = document.createElement('button');
  node.type = 'button';
  node.textContent = label;
  node.addEventListener('click', () => {
    Promise.resolve()
      .then(action)
      .then(show)
      .catch((error) => {
        evidence.errors.push(String(error.stack ?? error));
        show();
      });
  });
  controls.append(node);
  return node;
}
button('Prepare Regional fixture', async () => {
  if (disposed) throw new Error('Reload to start another fixture');
  const { terrain } = await createEnduranceFixture();
  await app.startFlight(
    regionalReviewEntry({ manifest: terrain.manifest, source: terrain.source }),
  );
  sample('regional-prepared');
  panel.open = false;
});
button('Capture native state', () => sample('manual-capture'));
button('Export native evidence', async () => {
  sample('evidence-export');
  await exportJSONFile(evidence, 'fpv-native-runtime-smoke.json');
});
button('Dispose native fixture', async () => {
  await app.dispose();
  disposed = true;
  sample('disposed');
});
for (const [target, event] of [
  [window, 'blur'],
  [window, 'focus'],
  [document, 'visibilitychange'],
])
  target.addEventListener(event, () => {
    evidence.lifecycle.push({ event, ...sample(`lifecycle:${event}`) });
    window.setTimeout(() => {
      sample(`after:${event}`);
      show();
    }, 300);
  });
document.addEventListener('click', (event) => {
  const button = event.target.closest?.('button');
  if (button && !panel.contains(button)) {
    const label = button.textContent.trim().slice(0, 100);
    window.setTimeout(() => sample(`ui:${label}`), 300);
  }
});
window.addEventListener('keydown', (event) => {
  if (['Escape', 'p', 'r'].includes(event.key))
    window.setTimeout(() => sample(`key:${event.key}`), 300);
});
try {
  if (!navigator.locks?.request || !window.indexedDB)
    throw new Error('Required native Web Locks / IndexedDB capability unavailable');
  evidence.storageProbe = await navigator.locks.request(
    'fpv-native-qualification-probe',
    async () => {
      const database = await new Promise((resolve, reject) => {
        const request = window.indexedDB.open('fpv-native-qualification-probe', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('receipts');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('Native qualification storage probe blocked'));
      });
      try {
        return await new Promise((resolve, reject) => {
          const transaction = database.transaction('receipts', 'readwrite');
          const store = transaction.objectStore('receipts');
          const request = store.get('visits');
          let previous;
          request.onsuccess = () => {
            previous = request.result ?? 0;
            store.put(previous + 1, 'visits');
          };
          transaction.oncomplete = () =>
            resolve({
              lockAcquired: true,
              transactionComplete: true,
              previousVisits: previous,
              visits: previous + 1,
            });
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () =>
            reject(transaction.error ?? new Error('Native storage probe aborted'));
        });
      } finally {
        database.close();
      }
    },
  );
  app = mountWorldApp();
  await app.ready;
  sample('ready');
  show();
  window.setInterval(show, 500);
} catch (error) {
  evidence.errors.push(String(error.stack ?? error));
  show();
}
