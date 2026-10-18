import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloDemoInventory, qualifySoloPerformance } from '../../scripts/qualify-solo-demos.mjs';
import { diagnoseDemoReplay } from '../demo-replay-diagnostics.mjs';
import { demoReplayMatchesEntry, validateDemoCatalog } from '../demo-catalog.mjs';
import { loadDemoSources, demoRuntimeEngineHint } from '../demo-sources.mjs';

test('Solo required coverage comes from base, active and archived authored catalogs', async () => {
  const inventory = await soloDemoInventory();
  assert.equal(new Set(inventory.map((entry) => entry.id)).size, inventory.length);
  assert.equal(new Set(inventory.map((entry) => entry.levelKey)).size, inventory.length);
  for (const group of ['base', 'current', 'archive', 'journey-current', 'journey-archive'])
    assert.ok(inventory.some((entry) => entry.catalogGroup === group));
  assert.ok(
    inventory.every(
      (entry) => entry.variantId === 'standard' && entry.entry.difficulty === 'standard',
    ),
  );
  const target = inventory.find((entry) => entry.levelId === 'signal-08');
  const replay = JSON.parse(
    await readFile(new URL(`../demo-data/${target.id}.replay.json`, import.meta.url), 'utf8'),
  );
  assert.ok(demoReplayMatchesEntry(replay, target.entry));
  const metrics = qualifySoloPerformance(replay);
  assert.ok(metrics.captures > 0);
  assert.ok(['won', 'lost'].includes(metrics.outcome));
  assert.equal(metrics.diagnostics.checkpoints.length, Math.floor(replay.ticks / 600));
});

test('Solo sparse diagnostics identify the first mismatching checkpoint without replacing full verification', async () => {
  const inventory = await soloDemoInventory({ includeJourney: false });
  const target = inventory.find((entry) => entry.levelId === 'signal-08');
  const replay = JSON.parse(
    await readFile(new URL(`../demo-data/${target.id}.replay.json`, import.meta.url), 'utf8'),
  );
  const { diagnostics } = qualifySoloPerformance(replay);
  assert.equal(await diagnoseDemoReplay(replay, diagnostics), null);
  diagnostics.checkpoints[1].hash = '0000000000000000';
  assert.deepEqual(
    (await diagnoseDemoReplay(replay, diagnostics)).firstMismatchingCheckpointTick,
    1200,
  );
  diagnostics.inputTraceIdentity = 'wrong';
  await assert.rejects(diagnoseDemoReplay(replay, diagnostics), /do not belong/);
});

test('independent browser performances bind their own exact trace and cannot relax native verification', async () => {
  const inventory = await soloDemoInventory({ includeJourney: false });
  const target = inventory.find((entry) => entry.levelId === 'signal-11');
  const complete = JSON.parse(
    await readFile(new URL(`../demo-data/${target.id}.replay.json`, import.meta.url), 'utf8'),
  );
  const damaged = structuredClone(complete);
  damaged.checkpoint.hash = '0000000000000000';
  const all = JSON.parse(
    await readFile(new URL('../demo-data/catalog.json', import.meta.url), 'utf8'),
  );
  const clip = structuredClone(all.clips.find((clip) => clip.id === target.id));
  const performance = {
    engine: 'chromium',
    replayURL: `./demo-data/${target.id}.chromium.replay.json`,
    recordingIdentity: clip.recordingIdentity,
    inputTraceIdentity: clip.inputTraceIdentity,
    durationSeconds: clip.durationSeconds,
    turnPolicy: clip.turnPolicy,
    outcome: complete.summary.status,
  };
  clip.runtimePerformances = [performance];
  const catalog = { format: all.format, clips: [clip] };
  validateDemoCatalog(catalog);
  const wrongContent = structuredClone(catalog);
  wrongContent.clips[0].runtimePerformances[0].recordingIdentity = '0000000000000000';
  assert.throws(() => validateDemoCatalog(wrongContent), /exact installed content/);
  const duplicate = structuredClone(catalog);
  duplicate.clips[0].runtimePerformances.push(performance);
  assert.throws(() => validateDemoCatalog(duplicate), /distinct supported engines/);
  const urls = [];
  const sources = await loadDemoSources({
    entries: [target.entry],
    library: { list: async () => [] },
    WorkerClass: null,
    fetch: async (url) => {
      urls.push(url.href);
      if (url.pathname.endsWith('catalog.json'))
        return { ok: true, text: async () => JSON.stringify(catalog) };
      if (url.pathname.endsWith('.diagnostics.json')) return { ok: false };
      return {
        ok: true,
        text: async () =>
          JSON.stringify(url.pathname.endsWith('.chromium.replay.json') ? complete : damaged),
      };
    },
  });
  const source = sources.find((source) => source.id === target.id);
  assert.equal(urls.length, 1, 'Metadata enumeration cannot eagerly load runtime bodies.');
  const player = await source.create({});
  assert.equal(player.state.tick, 0);
  assert.equal(player.info.recordedStatus, complete.summary.status);
  assert.ok(urls.some((url) => url.endsWith('.chromium.replay.json')));
  player.dispose();
});

test('browser engine hints only prioritize fully verified qualified performances and retain fallbacks', async () => {
  assert.equal(
    demoRuntimeEngineHint('Mozilla/5.0 AppleWebKit/537.36 Chrome/155.0.0.0'),
    'chromium',
  );
  assert.equal(demoRuntimeEngineHint('Mozilla/5.0 Gecko/20100101 Firefox/153.0'), 'firefox');
  assert.equal(
    demoRuntimeEngineHint('Mozilla/5.0 AppleWebKit/605.1.15 Version/26.5 Safari/605.1.15'),
    'webkit',
  );
  assert.equal(
    demoRuntimeEngineHint('Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 FxiOS/153.0'),
    'webkit',
  );
  assert.equal(demoRuntimeEngineHint('unknown runtime'), null);
  const inventory = await soloDemoInventory({ includeJourney: false });
  const target = inventory.find((entry) => entry.levelId === 'signal-11');
  const complete = JSON.parse(
    await readFile(new URL(`../demo-data/${target.id}.replay.json`, import.meta.url), 'utf8'),
  );
  const damaged = structuredClone(complete);
  damaged.checkpoint.hash = '0000000000000000';
  const catalog = JSON.parse(
    await readFile(new URL('../demo-data/catalog.json', import.meta.url), 'utf8'),
  );
  const clip = structuredClone(catalog.clips.find((entry) => entry.id === target.id));
  clip.replayVariants = [];
  clip.runtimePerformances = [
    {
      engine: 'webkit',
      replayURL: `./demo-data/${target.id}.webkit.replay.json`,
      recordingIdentity: clip.recordingIdentity,
      inputTraceIdentity: clip.inputTraceIdentity,
      durationSeconds: clip.durationSeconds,
      turnPolicy: clip.turnPolicy,
      outcome: complete.summary.status,
    },
  ];
  for (const corruptHintedBody of [false, true]) {
    const requested = [];
    const [source] = await loadDemoSources({
      entries: [target.entry],
      catalogs: [{ format: catalog.format, clips: [clip] }],
      library: { list: async () => [] },
      WorkerClass: null,
      engineHint: 'webkit', // Deliberately spoofed: this test actually runs in Node.
      fetch: async (url) => {
        requested.push(url.pathname);
        if (url.pathname.endsWith('.diagnostics.json')) return { ok: false };
        const preferred = url.pathname.endsWith('.webkit.replay.json');
        return {
          ok: true,
          text: async () => JSON.stringify(preferred && corruptHintedBody ? damaged : complete),
        };
      },
    });
    assert.deepEqual(requested, [], 'A hint cannot cause eager replay loading.');
    const player = await source.create({});
    const bodies = requested.filter((url) => url.endsWith('.replay.json'));
    assert.ok(bodies[0].endsWith('.webkit.replay.json'));
    assert.equal(bodies.length, corruptHintedBody ? 2 : 1);
    if (corruptHintedBody) assert.ok(bodies[1].endsWith(`/${target.id}.replay.json`));
    assert.equal(player.info.recordedStatus, complete.summary.status);
    assert.equal(player.state.tick, 0);
    player.dispose();
  }
});
