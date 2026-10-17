import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, settle, memoryStorage } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { PNGImage } from './helpers/png-image.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { FIXED_DT, stepRun } from '../core/index.mjs';
import { JOURNEY_PREFERENCES_KEY } from '../journey/preferences.mjs';
import { readFlightInformation } from '../ui/flight-information-host.mjs';

test('accepted capture, victory and public result have bounded witnesses without changing the run', async (t) => {
  const { rows } = JSON.parse(
    await readFile(new URL('./fixtures/candidate-solo-tuned-host-routes.json', import.meta.url)),
  );
  const [levelId, , , , segments] = rows[0];
  const page = await soloPage(t, {
    pictures: { Image: PNGImage },
    fetchResponse: async (path) =>
      String(path).includes('/content-design/assets/')
        ? new Response(await readFile(path))
        : undefined,
    search: '?journey=opening&performance=1',
    storage: memoryStorage({
      [JOURNEY_PREFERENCES_KEY]: JSON.stringify({
        format: 'JourneyPreferencesV1',
        difficulty: 'standard',
      }),
    }),
    journeyIndexedDB: managedIndexedDB().indexedDB,
    browserSetup({ globals }) {
      globals.innerWidth = 1280;
      globals.innerHeight = 720;
    },
  });
  const initialReport = page.win.RevealLineSoloPerformance.export();
  const firstOwner = initialReport.eventWitnesses.recent.find((row) => row.kind === 'run-adopted');
  assert.ok(firstOwner);
  assert.equal(firstOwner.tick, 0);
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running', 'Prepared Start', {
    timeoutMs: 20000,
  });
  page.frame(0);
  const run = page.rendered.run;
  const reference = structuredClone(run);
  let liveCaptureCopies = 0;
  const copyBytes = Uint8Array.from;
  t.mock.method(Uint8Array, 'from', function (source, ...args) {
    if (source === run.cells) liveCaptureCopies++;
    return Reflect.apply(copyBytes, this, [source, ...args]);
  });
  assert.equal(run.levelId, levelId);
  const keys = { up: 'ArrowUp', right: 'ArrowRight', down: 'ArrowDown', left: 'ArrowLeft' };
  const captures = [];
  let insideFrame = false,
    terminalCampaignScans = 0,
    terminalCheckpointSections = 0;
  const map = Array.prototype.map,
    encode = TextEncoder.prototype.encode;
  Array.prototype.map = function (callback, ...args) {
    if (
      insideFrame &&
      callback?.name === 'normalizedLevel' &&
      new Error().stack.includes('/library.mjs:')
    )
      terminalCampaignScans++;
    return Reflect.apply(map, this, [callback, ...args]);
  };
  t.after(() => {
    Array.prototype.map = map;
  });
  t.mock.method(TextEncoder.prototype, 'encode', function (...args) {
    if (
      insideFrame &&
      new Error().stack.includes('checksum (') &&
      new Error().stack.includes('/replay.mjs:')
    )
      terminalCheckpointSections++;
    return Reflect.apply(encode, this, args);
  });
  for (const [direction, ticks] of segments) {
    if (direction !== null) {
      page.key(keys[direction]);
      page.key(keys[direction], false);
    }
    let pending = 0;
    for (let tick = 0; tick < ticks; tick++) {
      stepRun(reference, { direction }, FIXED_DT);
      pending++;
      for (const event of reference.events)
        if (event.type === 'cells.claimed') captures.push(reference.tick);
      const closure = reference.events.some((event) => event.type === 'capture.stopped');
      if (closure || pending === 12 || tick === ticks - 1) {
        insideFrame = true;
        try {
          page.frame(pending * FIXED_DT * 1000);
        } finally {
          insideFrame = false;
        }
        pending = 0;
        if (closure && tick < ticks - 1 && run.status !== 'won') {
          page.key(keys[direction]);
          page.key(keys[direction], false);
        }
      }
    }
  }
  assert.equal(run.status, 'won', 'Only the legal native input route may accept victory');
  t.diagnostic(JSON.stringify({ terminalCampaignScans, terminalCheckpointSections }));
  assert.equal(
    terminalCampaignScans,
    0,
    'the accepted immutable execution key needs no terminal campaign scan',
  );
  assert.equal(
    terminalCheckpointSections,
    0,
    'optional replay checkpoint hashing must leave the frame callback',
  );
  assert.ok(captures.length > 0);
  assert.equal(
    liveCaptureCopies,
    captures.length,
    'The two teaching notices share one frozen board inspection per accepted capture',
  );
  const notices = readFlightInformation(page.$('run-message')).recentNotices;
  const secured = notices.find((notice) => notice.role === 'cells.claimed');
  const stopped = notices.find((notice) => notice.role === 'capture.stopped');
  assert.match(secured.fullText, /Empty regions fill; field enemies retain their regions/);
  assert.ok(stopped.fullText.startsWith(secured.fullText));
  assert.match(stopped.fullText, /Tap a direction to fly again/);
  const checkpoint = authoritativeCheckpoint(reference);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  let report = page.win.RevealLineSoloPerformance.export();
  const rowsForRun = report.eventWitnesses.recent.filter(
    (row) => row.runGeneration === firstOwner.runGeneration,
  );
  assert.deepEqual(
    rowsForRun.filter((row) => row.kind === 'capture-accepted').map((row) => row.tick),
    captures,
  );
  const terminal = rowsForRun.filter((row) =>
    ['victory-accepted', 'terminal-work-begin', 'terminal-work-end'].includes(row.kind),
  );
  assert.deepEqual(
    terminal.map((row) => row.kind),
    ['victory-accepted', 'terminal-work-begin', 'terminal-work-end'],
  );
  assert.ok(terminal.every((row) => row.tick === run.tick));
  assert.ok(terminal[0].atMs <= terminal[1].atMs && terminal[1].atMs <= terminal[2].atMs);
  assert.equal(report.eventWitnesses.byKind['result-overlay-shown'].total, 0);
  if (!page.$('skip-celebration').hidden) page.$('skip-celebration').click();
  page.$('show-result').click();
  assert.equal(page.$('game-overlay').dataset.kind, 'won');
  report = page.win.RevealLineSoloPerformance.export();
  const result = report.eventWitnesses.recent.find((row) => row.kind === 'result-overlay-shown');
  assert.equal(result.runGeneration, firstOwner.runGeneration);
  assert.equal(result.tick, run.tick);
  assert.ok(result.atMs >= terminal[2].atMs);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  page.$('retry-button').click();
  await settle(
    () => page.rendered.run !== run && page.doc.body.dataset.flightState === 'running',
    'Retry must adopt a freshly prepared run',
    { timeoutMs: 20000 },
  );
  page.frame(0);
  page.$('pause-button').click();
  report = page.win.RevealLineSoloPerformance.export();
  const owners = report.eventWitnesses.recent.filter((row) => row.kind === 'run-adopted');
  assert.equal(owners.length, 2);
  assert.ok(owners[1].runGeneration > firstOwner.runGeneration);
  assert.equal(owners[1].tick, 0);
  assert.equal(report.eventWitnesses.rejected, 0);
  assert.equal(report.eventWitnesses.omitted, 0);
  assert.deepEqual(page.errors, []);
});
