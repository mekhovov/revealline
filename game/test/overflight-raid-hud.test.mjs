import test from 'node:test';
import assert from 'node:assert/strict';
import i18next from 'i18next';
import { Document } from './helpers/couch-dom.mjs';
import {
  createOverflightHuntProject,
  compileOverflightHuntProject,
} from '../overflight/raid-project.mjs';
import { createOverflightHuntRun } from '../overflight/raid-core.mjs';
import { overflightHuntText } from '../overflight/raid-copy.mjs';
import { localizedOverflight } from '../overflight/copy.mjs';

// The browser provides i18next through the bundled classic-script adapter.
// Node uses its equivalent package while importing the native mode descriptor.
globalThis.i18next = i18next;
const { updateOverflightHuntHUD, overflightHuntPreviewRequest } = await import(
  '../overflight/raid-mode.mjs'
);
function fixture() {
  const document = new Document();
  document.documentElement.lang = 'en';
  for (const id of [
    'hud-objective',
    'hud-chain',
    'hud-score',
    'hud-rush',
    'raid-rush-meter',
    'raid-rush-fill',
    'xp-fill',
    'raid-event-status',
  ]) {
    const element = document.createElement('div');
    element.id = id;
    document.body.append(element);
  }
  const compiled = compileOverflightHuntProject(createOverflightHuntProject());
  const run = createOverflightHuntRun(compiled);
  run.phase = 'playing';
  const paint = () =>
    updateOverflightHuntHUD({
      run,
      compiled,
      document,
      text: (key) => overflightHuntText('en', key),
      local: localizedOverflight,
    });
  return { run, document, paint };
}

test('Rush instrument describes charge, stored activation and remaining time without stale accessible values', () => {
  const { run, document, paint } = fixture();
  const meter = document.getElementById('raid-rush-meter'),
    fill = document.getElementById('raid-rush-fill');
  run.hunt.rushCharge = 10;
  paint();
  assert.equal(meter.getAttribute('aria-valuenow'), '10');
  assert.equal(meter.getAttribute('aria-valuemax'), '20');
  assert.equal(fill.style.width, '50%');
  run.hunt.rushCharge = 20;
  paint();
  assert.match(meter.getAttribute('aria-valuetext'), /RUSH READY/);
  run.hunt.rushCharge = 0;
  run.hunt.rushRemaining = 2.5;
  paint();
  assert.equal(meter.getAttribute('aria-valuemax'), '5');
  assert.equal(meter.getAttribute('aria-valuenow'), '2.5');
  assert.equal(fill.style.width, '50%');
  assert.match(meter.getAttribute('aria-valuetext'), /2.5s/);
  run.hunt.rushRemaining = 0;
  paint();
  assert.equal(meter.getAttribute('aria-valuemax'), '20');
  assert.equal(meter.getAttribute('aria-valuenow'), '0');
});

test('polite status announces milestones once rather than streaming score and countdown changes', () => {
  const { run, document, paint } = fixture(),
    status = document.getElementById('raid-event-status');
  status.textContent = 'RUSH ACTIVE 5.0s'; // Reused document after Retry.
  paint();
  assert.equal(status.textContent, '');
  run.hunt.rushCharge = 20;
  paint();
  assert.match(status.textContent, /RUSH READY/);
  run.hunt.rushRemaining = 5;
  run.hunt.rushCharge = 0;
  paint();
  const announcement = status.textContent;
  run.hunt.rushRemaining = 4.8;
  run.hunt.score += 500;
  paint();
  assert.equal(status.textContent, announcement);
  run.hunt.objectivesCompleted = 1;
  paint();
  assert.match(status.textContent, /Targets 1\/7/);
});

test('Raid Studio messages require the exact parent, origin, protocol and request identity', () => {
  const window = {},
    parent = {},
    origin = 'https://game.example';
  const event = {
    source: parent,
    origin,
    data: { type: 'overflight-hunt:preview', version: 1, requestId: 4, project: {} },
  };
  assert.equal(overflightHuntPreviewRequest(event, { window, parent, origin }), event.data);
  for (const value of [
    { ...event, source: {} },
    { ...event, origin: 'https://elsewhere.example' },
    { ...event, data: { ...event.data, type: 'overflight:preview' } },
    { ...event, data: { ...event.data, version: 2 } },
    { ...event, data: { ...event.data, requestId: -1 } },
  ])
    assert.equal(overflightHuntPreviewRequest(value, { window, parent, origin }), null);
});
