import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { verifyFpvR2 } from '../../scripts/verify-fpv-r2.mjs';
import {
  preparePack,
  resolvePackCampaign,
  scenarioFromPack,
  emptyPackLibrary,
  installPack,
  exportPackLibrary,
  importPackLibrary,
} from '../packs.mjs';
import { prepareScenario } from '../imports.mjs';
import { inspectImageDataUrl } from '../content.mjs';
import { campaignKey } from '../library.mjs';
const load = async (name) => JSON.parse(await readFile(new URL(name, import.meta.url), 'utf8'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const proofPath = '../replays/fpv-arcade-r2-routes.json';

test('all three R2 missions win under both turn policies and difficulties with real capture-release commands', async () => {
  const originals = [
    'first-light-routes.json',
    'first-light-gentle-routes.json',
    'classic-lab-routes.json',
  ];
  const before = await Promise.all(
    originals.map(async (name) =>
      hash(await readFile(new URL(`../replays/${name}`, import.meta.url))),
    ),
  );
  const result = await verifyFpvR2();
  assert.equal(result.routes.length, 12);
  for (const route of result.routes) {
    assert.equal(route.won, true);
    assert.equal(route.livesLost, 0);
    assert.equal(route.metrics.neutralTicks, route.metrics.events['capture.stopped'] - 1);
    assert.ok(route.metrics.maxTrailCells > 0);
  }
  for (const control of result.controls) {
    assert.equal(control.straight.summary.won, false);
    assert.equal(control.originalRouteOnRevision.summary.won, false);
  }
  const after = await Promise.all(
    originals.map(async (name) =>
      hash(await readFile(new URL(`../replays/${name}`, import.meta.url))),
    ),
  );
  assert.deepEqual(after, before);
});

test('R2 pack/library and six scenario imports retain independent campaign identity and the exact reused original pictures', async () => {
  const raw = await load('../content/packs/fpv-arcade-r2.json'),
    before = structuredClone(raw);
  const previous = await load('../content/packs/fpv-arcade.json');
  // Exact-original/header boundary for Node transport; no browser pixel decode is claimed.
  const known = new Map(
    previous.levelVisuals.map(({ visualOverrides }) => {
      const data = visualOverrides.background.dataUrl;
      return [data, inspectImageDataUrl(data)];
    }),
  );
  const decodeImage = async (data) => {
    const info = known.get(data);
    assert.ok(info, 'Only an exact original image may cross the test decode boundary.');
    return { naturalWidth: info.width, naturalHeight: info.height };
  };
  const prepared = (await preparePack(raw, { decodeImage })).pack;
  const entry = resolvePackCampaign(prepared, prepared.campaigns[0].id);
  assert.notEqual(
    campaignKey({ ...previous.campaigns[0], classRecipes: previous.classRecipes }),
    campaignKey(entry.campaign),
  );
  assert.deepEqual(prepared.masteries, []);
  const library = installPack(emptyPackLibrary(), prepared);
  assert.deepEqual(await importPackLibrary(exportPackLibrary(library), { decodeImage }), library);
  for (const level of prepared.campaigns[0].levels) {
    assert.equal(level.revision, '2');
    assert.equal(level.rules.stopOnCapture, true);
    for (const turnPolicy of ['immediate', 'grid-center']) {
      const scenario = scenarioFromPack(prepared, prepared.campaigns[0].id, level.id, {
        classId: 'scout',
        turnPolicy,
      });
      const roundTrip = (await prepareScenario(scenario, { decodeImage })).scenario;
      assert.equal(roundTrip.format, 'xonix-playground.v5');
      assert.equal(roundTrip.masteryDefinition, null);
      assert.deepEqual(roundTrip.level, scenario.level);
      assert.deepEqual(roundTrip.visualOverrides, scenario.visualOverrides);
    }
    const artwork = prepared.levelVisuals.find((item) => item.levelId === level.id);
    assert.deepEqual(
      artwork,
      previous.levelVisuals.find((item) => item.levelId === level.id),
    );
    const original = await readFile(
      new URL(`../../authoring/library/fpv-arcade/backgrounds/${level.id}.png`, import.meta.url),
    );
    const copy = await readFile(
      new URL(`../../authoring/library/fpv-arcade-r2/backgrounds/${level.id}.png`, import.meta.url),
    );
    assert.deepEqual(copy, original);
    assert.deepEqual(
      Buffer.from(artwork.visualOverrides.background.dataUrl.split(',')[1], 'base64'),
      original,
    );
  }
  assert.deepEqual(raw, before, 'Public preparation cannot mutate source data.');
});

test('R2 verifier rejects incomplete, duplicate and foreign-authority proof envelopes', async () => {
  const proof = await load(proofPath);
  for (const change of [
    (p) => p.routes.pop(),
    (p) => p.routes.splice(1, 1, structuredClone(p.routes[0])),
    (p) => {
      p.packSha256 = 'wrong';
    },
    (p) => {
      p.routes[0].campaignKey = 'foreign';
    },
    (p) => {
      p.routes[0].levelSha256 = 'wrong';
    },
  ]) {
    const bad = structuredClone(proof);
    change(bad);
    await assert.rejects(verifyFpvR2({ proof: bad }));
  }
  await assert.rejects(verifyFpvR2({ proof: null }));
});

test('R2 verifier rejects an unreleased capture command and fabricated replay evidence', async () => {
  const proof = await load(proofPath);
  const unreleased = structuredClone(proof),
    segments = unreleased.routes[0].segments;
  const index = segments.findIndex((s) => s.input.direction === null);
  assert.ok(index > 0);
  segments.splice(index, 1);
  await assert.rejects(verifyFpvR2({ proof: unreleased }), /released tick/);
  for (const change of [
    (p) => {
      p.routes[0].expected.score++;
    },
    (p) => {
      p.routes[0].checkpoint.hash = 'fabricated';
    },
    (p) => {
      p.routes[0].metrics.events['capture.stopped']++;
    },
    (p) => {
      p.routes[0].segments[0].input.action = true;
    },
  ]) {
    const bad = structuredClone(proof);
    change(bad);
    await assert.rejects(verifyFpvR2({ proof: bad }));
  }
});
