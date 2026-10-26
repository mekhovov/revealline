// Actual host mounting and core/controller owners at a modeled DOM boundary.
// Native layout, downloads and physical devices need separate qualification.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';
import { overflightSupportHost } from '../overflight/support-summary.mjs';
import { collectSupportSummary, supportSnapshot } from '../local-support-summary.mjs';
import { attachLocalSupportSummary } from '../ui/local-support-summary.mjs';
import { createOverflightController } from '../overflight/controller.mjs';
import { createOverflightProject, compileOverflightProject } from '../overflight/project.mjs';
import {
  createOverflightRun,
  startOverflight,
  stepOverflight,
  pauseOverflight,
} from '../overflight/core.mjs';
import { createOverflightRiyMode } from '../overflight/riy-mode.mjs';
import { OVERFLIGHT_HUNT_MODE } from '../overflight/raid-mode.mjs';
import { createOverflightRaidVariant } from '../overflight/raid-variants.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

const base = {
  id: 'overflight',
  createProject: () => createOverflightProject({ rulesVersion: 4, seed: 7 }),
  compileProject: compileOverflightProject,
  createRun: createOverflightRun,
  start: startOverflight,
  step: stepOverflight,
  pause: pauseOverflight,
};
const modes = () => [
  [base, 'overflight'],
  [createOverflightRiyMode(base), 'overflight-riy'],
  [OVERFLIGHT_HUNT_MODE, 'overflight-hunt'],
  [
    createOverflightRaidVariant(OVERFLIGHT_HUNT_MODE, { variant: 'time-attack' }),
    'overflight-time-attack',
  ],
  [
    createOverflightRaidVariant(OVERFLIGHT_HUNT_MODE, { variant: 'marathon' }),
    'overflight-marathon',
  ],
];
const clock = { monotonic: 1000, wall: 1792317600000 };
const environment = () => ({
  document: { hidden: false, hasFocus: () => true },
  navigator: {
    getGamepads: () => assert.fail('Support collection must not poll a controller.'),
  },
});

test('all five real operation owners retain paused runs and report precise, bounded host identities', async () => {
  for (const [mode, kind] of modes()) {
    const run = mode.createRun(mode.compileProject(mode.createProject()), { airframes: 3 });
    mode.start(run);
    for (let tick = 0; tick < 30; tick++) mode.step(run, { x: 0.5, y: -0.25 });
    mode.pause(run);
    assert.equal(run.phase, 'paused');
    const before = JSON.stringify(run);
    const report = await collectSupportSummary({
      host: overflightSupportHost({
        mode,
        run,
        version: '0.151.1',
        locale: 'en',
        platform: 'browser',
        offline: { available: true, scope: 'secret-url', messageCode: 'configured' },
      }),
      env: environment(),
      clock,
    });
    assert.equal(report.scope, 'overflight-game-shell');
    assert.equal(report.game.host, kind);
    assert.equal(report.game.state, 'paused');
    assert.equal(report.game.saving.writable, null, 'API availability is not save permission.');
    assert.equal(report.build.version, '0.151.1');
    assert.equal(report.build.sourceRevision, null, 'An unknown source must not be invented.');
    assert.equal(report.offline.files, 'not-verified-here');
    assert.doesNotMatch(JSON.stringify(report), /secret-url|terrain|enemies|seed|profileKey/);
    assert.equal(JSON.stringify(run), before);
  }
});

test('host facts distinguish native phases, development metadata and non-saving review scope', () => {
  for (const [phase, expected] of [
    ['ready', 'idle'],
    ['playing', 'running'],
    ['upgrade', 'paused'],
    ['paused', 'paused'],
    ['won', 'won'],
    ['lost', 'lost'],
  ]) {
    const value = overflightSupportHost({
      mode: base,
      run: { phase },
      version: 'DEV',
      practice: true,
    });
    const report = supportSnapshot(value, environment(), clock);
    assert.equal(report.game.state, expected);
    assert.equal(report.build.version, null);
    assert.equal(report.build.packaged, false);
    assert.equal(report.game.saving.writable, false);
    assert.equal(report.game.saving.reason, 'practice');
  }
  const unknown = supportSnapshot(
    overflightSupportHost({
      mode: { operationId: 'secret-operation' },
      run: { phase: 'secret-state' },
    }),
    environment(),
    clock,
  );
  assert.equal(unknown.game.host, 'unavailable');
  assert.equal(unknown.game.state, 'unavailable');
  assert.equal(unknown.build.packaged, null);
  assert.doesNotMatch(JSON.stringify(unknown), /secret/);
});

test('actual host mount prepares and exports the same report without polling, writing or advancing a paused flight', async (t) => {
  const source = await readFile(new URL('../overflight/app.mjs', import.meta.url), 'utf8');
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const declaration = (name) =>
    ast.body.find((node) => node.declarations?.some((item) => item.id.name === name));
  const start = declaration('supportRoot'),
    end = declaration('supportSummary');
  const doc = new Document(),
    win = new Events();
  doc.hidden = false;
  doc.hasFocus = () => true;
  const settings = doc.createElement('dialog'),
    data = doc.createElement('section');
  settings.open = true;
  settings.append(data);
  doc.body.append(settings);
  const pad = {
    index: 0,
    id: 'secret-controller-name',
    mapping: 'standard',
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 24 }, () => ({ value: 0, pressed: false })),
  };
  let polls = 0,
    pads = [pad];
  const controller = createOverflightController({
    window: win,
    readPads: () => {
      polls++;
      return pads;
    },
  });
  t.after(() => controller.destroy());
  controller.sample({ scope: 'menu:settings', timeMs: 900 });
  controller.sample({ scope: 'menu:settings', timeMs: 920 });
  const run = base.createRun(base.compileProject(base.createProject()), { airframes: 3 });
  base.start(run);
  for (let tick = 0; tick < 30; tick++) base.step(run, { x: 1, y: 0 });
  base.pause(run);
  const before = JSON.stringify(run),
    exports = [];
  const previous = getLocale();
  t.after(() => setLocale(previous, { persist: false }));
  setLocale('en', { persist: false });
  const env = { ...environment(), document: doc };
  Object.defineProperty(env, 'localStorage', {
    get: () => assert.fail('No storage-content read.'),
  });
  const ui = runInNewContext(`${source.slice(start.start, end.end)}; supportSummary`, {
    doc,
    win,
    el: (tag) => doc.createElement(tag),
    settingsView: { panels: { data } },
    settingsRoot: settings,
    mode: base,
    run,
    controller,
    controllerBuildVersion: '0.151.1',
    getLocale,
    offlineAvailability: () => ({ available: false, messageCode: 'development' }),
    nativePlatform: () => null,
    overflightSupportHost,
    studio: false,
    fixture: null,
    reviewBuild: null,
    attachLocalSupportSummary: (options) =>
      attachLocalSupportSummary({
        ...options,
        collect: (input) => collectSupportSummary({ ...input, env, clock }),
        exportFile: (value) => {
          exports.push(value);
          return { status: 'requested' };
        },
      }),
  });
  t.after(() => ui.destroy());
  const button = doc.getElementById('support-summary-prepare');
  button.focus();
  const beforePolls = polls;
  assert.equal(await ui.refresh(), true);
  const report = JSON.parse(doc.getElementById('support-summary-json').textContent);
  assert.equal(report.controller.freshness, 'recent');
  assert.equal(report.controller.status, 'connected');
  assert.equal(report.game.host, 'overflight');
  assert.equal(report.game.state, 'paused');
  assert.equal(doc.activeElement, button);
  await ui.download();
  assert.deepEqual(exports, [report]);
  assert.equal(polls, beforePolls);
  assert.equal(JSON.stringify(run), before);
  assert.doesNotMatch(JSON.stringify(report), /secret-controller-name|buttons|axes|profileKey/);
  pads = [];
  controller.sample({ scope: 'menu:settings', timeMs: 950 });
  setLocale('uk', { persist: false });
  assert.equal(await ui.refresh(), true);
  assert.equal(
    doc.getElementById('support-summary-title').textContent,
    'Локальний звіт для підтримки',
  );
  assert.equal(
    JSON.parse(doc.getElementById('support-summary-json').textContent).controller.status,
    'disconnected',
  );
  settings.close();
  assert.equal(doc.getElementById('support-summary-json').textContent, '');
  assert.equal(doc.getElementById('support-summary-download').disabled, true);
  assert.equal(JSON.stringify(run), before);
  // The actual teardown owns the adapter before its settings DOM is dismantled.
  const disposal = ast.body.find(
    (node) => node.type === 'FunctionDeclaration' && node.id.name === 'dispose',
  );
  const body = source.slice(disposal.start, disposal.end);
  assert(body.indexOf('supportSummary.destroy()') < body.indexOf('settingsView?.destroy()'));
});
