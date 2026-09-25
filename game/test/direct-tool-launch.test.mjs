import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Script, createContext, constants } from 'node:vm';
import { Document, Events } from './helpers/couch-dom.mjs';
import { deferred } from './helpers/media-fixtures.mjs';
import { waitFor } from './helpers/wait-for.mjs';

const source = await readFile(new URL('../ui/direct-tool-launch.js', import.meta.url), 'utf8');
const settle = async () => {
  for (let i = 0; i < 10; i++) await new Promise((resolve) => setImmediate(resolve));
};
async function fixture(t, moduleSource) {
  const directory = await mkdtemp(join(tmpdir(), 'revealline-tool-launch-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, 'tool.mjs'), moduleSource);
  const doc = new Document(),
    events = new Events(),
    timers = new Map();
  doc.baseURI = pathToFileURL(join(directory, 'index.html')).href;
  doc.readyState = 'complete';
  doc.currentScript = { dataset: { module: './tool.mjs', status: 'status' } };
  const status = doc.createElement('p'),
    label = doc.createElement('span'),
    control = doc.createElement('button');
  status.id = 'status';
  status.className = 'operation-status';
  status.dataset.state = 'busy';
  label.className = 'operation-status-label';
  label.textContent = 'Loading tools…';
  status.append(label);
  control.setAttribute('data-tool-control', '');
  doc.body.append(status, control);
  let sequence = 0;
  const context = createContext({
    document: doc,
    URL,
    String,
    Object,
    setTimeout: (fn) => {
      timers.set(++sequence, fn);
      return sequence;
    },
    clearTimeout: (id) => timers.delete(id),
    addEventListener: events.addEventListener.bind(events),
  });
  const run = () =>
    new Script(source, {
      filename: 'direct-tool-launch.js',
      importModuleDynamically: constants.USE_MAIN_CONTEXT_DEFAULT_LOADER,
    }).runInContext(context);
  return { doc, status, label, control, context, timers, run };
}

test('a missing static dependency reports module failure and leaves a same-page Reload link', async (t) => {
  const h = await fixture(t, "import './missing-dependency.mjs';\n");
  h.run();
  await waitFor(() => h.status.dataset.state === 'error', {
    message: 'Missing tool dependency did not report its module failure.',
  });
  assert.equal(h.status.dataset.state, 'error');
  assert.equal(h.doc.documentElement.dataset.toolState, 'error');
  assert.match(h.label.textContent, /could not start.*missing-dependency/s);
  const reload = h.doc.body.querySelector('a');
  assert.equal(reload.href, h.doc.baseURI);
  assert.equal(reload.hidden, false);
  assert.equal(h.control.disabled, true);
  assert.equal(h.timers.size, 0);
});

test('slow module observation is truthful and cannot overwrite a later attached host', async (t) => {
  const gate = deferred(),
    started = deferred(),
    key = `toolLaunch${Date.now()}`;
  let h,
    starts = 0;
  globalThis[key] = async () => {
    starts++;
    started.resolve();
    await gate.promise;
    h.context.RevealLineToolLaunch.attached();
    h.label.textContent = 'Host data ready';
    h.status.dataset.state = 'ready';
  };
  t.after(() => delete globalThis[key]);
  h = await fixture(t, `await globalThis[${JSON.stringify(key)}]();\n`);
  h.run();
  await started.promise;
  const notifySlow = [...h.timers.values()][0];
  notifySlow();
  assert.equal(h.status.dataset.state, 'busy');
  assert.match(h.label.textContent, /Still loading/);
  assert.equal(h.doc.body.querySelector('a').hidden, false);
  h.run();
  assert.equal(starts, 1);
  gate.resolve();
  await settle();
  notifySlow();
  assert.equal(h.status.dataset.state, 'ready');
  assert.equal(h.label.textContent, 'Host data ready');
  assert.equal(h.doc.body.querySelector('a').hidden, true);
});

test('classic launch recovery uses localized bindings and keeps error details on live switch', async (t) => {
  const h = await fixture(t, "import './missing-localized-dependency.mjs';\n"),
    bindings = [];
  let locale = 'uk';
  const messages = {
    en: {
      'tools:toolLaunch.reload': 'Reload this tool',
      'tools:toolLaunch.startFailed':
        'This tool could not start: {{error}}. Reload to try again, or use the page’s Back link.',
    },
    uk: {
      'tools:toolLaunch.reload': 'Перезавантажити цей інструмент',
      'tools:toolLaunch.startFailed':
        'Не вдалося запустити цей інструмент: {{error}}. Перезавантажте сторінку.',
    },
  };
  h.context.RevealLineI18n = {
    message:
      (key, values = {}) =>
      () =>
        messages[locale][key].replace('{{error}}', values.error ?? ''),
    localizedText: (target, producer) => {
      const update = () => {
        target.textContent = typeof producer === 'function' ? producer() : producer;
      };
      bindings.push(update);
      update();
    },
  };
  h.run();
  await waitFor(() => h.status.dataset.state === 'error');
  assert.match(h.label.textContent, /Не вдалося запустити.*missing-localized-dependency/s);
  assert.equal(h.doc.body.querySelector('a').textContent, 'Перезавантажити цей інструмент');
  locale = 'en';
  for (const update of bindings) update();
  assert.match(h.label.textContent, /could not start.*missing-localized-dependency/s);
  assert.equal(h.doc.body.querySelector('a').textContent, 'Reload this tool');
});
