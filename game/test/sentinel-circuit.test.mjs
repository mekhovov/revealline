import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, mkdtemp, symlink, lstat, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  buildSentinelCircuit,
  exportSentinelCircuit,
  IDS,
} from '../../authoring/library/sentinel-circuit/build.mjs';
import { verifySentinelCircuit, ROUTES } from '../../authoring/library/sentinel-circuit/verify.mjs';
import { ROOT, digest, writeProof } from '../../authoring/library/sentinel-circuit/files.mjs';
import { collectBuildFiles } from '../../scripts/game-cli.mjs';
import { preparePack } from '../packs.mjs';
import { prepareScenario } from '../imports.mjs';

const source = await buildSentinelCircuit();
const proofFile = new URL('../../authoring/library/sentinel-circuit/routes.json', import.meta.url);
const proof = JSON.parse(await readFile(proofFile));
const noImage = async () => {
  throw new Error('Procedural candidate must not allocate an image decoder.');
};

test('three independent new wide Tactical layouts retain the stock roster and two final boss schedules', async () => {
  const { pack, scenarios } = source;
  assert.equal(pack.format, 'xonix-pack.v5');
  assert.equal(pack.engine, 'xonix-core.v5');
  assert.equal(pack.classRecipes.length, 7);
  assert.deepEqual(
    scenarios.map((s) => s.level.id),
    IDS,
  );
  assert.deepEqual(
    scenarios.map((s) => s.settings.classId),
    ['scout', 'bomber', 'fiber'],
  );
  const geometry = (l) =>
    digest({ width: l.width, height: l.height, walls: l.walls, spawn: l.spawn });
  const shapes = scenarios.map((s) => geometry(s.level));
  assert.equal(new Set(shapes).size, 3);
  const historical = JSON.parse(
    await readFile(new URL('../content/campaign.json', import.meta.url)),
  ).levels;
  for (const name of await readdir(new URL('../content/packs/', import.meta.url))) {
    if (!name.endsWith('.json')) continue;
    const old = JSON.parse(await readFile(new URL(`../content/packs/${name}`, import.meta.url)));
    historical.push(...(old.campaigns ?? []).flatMap((c) => c.levels));
  }
  for (const level of historical) {
    assert.ok(!IDS.includes(level.id));
    assert.ok(!shapes.includes(geometry(level)), 'Do not relabel a registered historical layout.');
  }
  for (const scenario of scenarios) {
    assert.equal(scenario.level.width, 72);
    assert.equal(scenario.level.height, 36);
    assert.equal(scenario.level.version, 'xonix-level.v4');
    assert.equal(scenario.level.classic.arcadeActions, undefined);
    assert.equal(scenario.level.rules.stopOnCapture, true);
    assert.deepEqual(scenario.visualOverrides, {});
    await prepareScenario(scenario, { decodeImage: noImage });
  }
  assert.equal(scenarios.filter((s) => s.level.encounter).length, 1);
  const boss = scenarios[2].level.encounter;
  assert.equal(boss.kind, 'relay-sentinel');
  assert.equal(boss.minReleaseCutCells, 12);
  assert.deepEqual(
    Object.keys(boss).filter((k) => ['shielded', 'exposed', 'phase3'].includes(k)),
    ['shielded', 'exposed'],
  );
  assert.match(scenarios[0].level.metadata.description, /Scan reveals/);
  assert.match(scenarios[1].level.metadata.description, /temporary field/);
  assert.match(scenarios[2].level.metadata.description, /live cable can still break/);
  assert.equal((await preparePack(pack, { decodeImage: noImage })).pack.id, 'sentinel-circuit');
});

test('all 56 actual contexts replay and restore exact unfinished v4 cuts with qualified control outcomes', async () => {
  const actual = await verifySentinelCircuit();
  assert.equal(actual.summary.contexts, 56);
  assert.equal(actual.summary.wins, 32);
  assert.equal(actual.summary.lifeLossControls, 16);
  assert.equal(actual.summary.unfinishedClosureControls, 8);
  assert.equal(actual.summary.ticks, 101713);
  assert.equal(actual.summary.savedContinuations, 56);
  assert.equal(new Set(actual.routes.map((r) => r.executionKey)).size, 2);
  for (const r of actual.routes) {
    assert.equal(r.savedPrefix.format, 'xonix-session.v4');
    assert.equal(r.savedPrefix.player.cutting, true);
    assert.ok(r.savedPrefix.trailCells >= 6);
    assert.ok(r.savedPrefix.bytes < 2 * 1024 * 1024);
    assert.equal(r.savedPrefix.presentationPins.choices[0].picture.kind, 'legacy');
    assert.equal(r.savedPrefix.presentationPins.choices[0].story, null);
    assert.equal(
      r.savedPrefix.presentationPins.choices[0].picture.identity.baseCampaignKey,
      r.authoredKey,
    );
    assert.deepEqual(r.savedPrefix.restoredFinalCheckpoint, r.checkpoint);
    if (r.route === 'yard-field')
      assert.equal(r.metrics.stunnedEnemyTicks, r.difficulty === 'gentle' ? 285 : 300);
    if (r.route === 'yard-early') {
      assert.ok(r.metrics.fieldTicks > 0);
      assert.equal(
        r.metrics.stunnedEnemyTicks,
        0,
        'Misplaced active field is not an expired-field claim.',
      );
    }
    if (r.route === 'court-blocked')
      assert.equal(
        r.expected.failureCause,
        r.difficulty === 'gentle' ? 'enemy-trail' : 'cut-timeout',
      );
    if (r.route === 'boss-recovered') assert.equal(r.expected.livesLost, 1);
    if (r.route === 'boss-missed')
      assert.ok(
        r.metrics.events.filter((e) => e.type === 'encounter.phaseChanged' && e.phase === 'open')
          .length >= 2,
      );
  }
});

test('explicit malformed candidates cannot fall back to source or request proof writes', async () => {
  for (const candidate of [
    null,
    false,
    0,
    [],
    {},
    { pack: null, proof: null },
    { pack: source.pack },
    { proof },
    { pack: source.pack, proof, extra: true },
  ])
    await assert.rejects(verifySentinelCircuit({ candidate }));
  for (const record of [null, 1, 'true']) await assert.rejects(verifySentinelCircuit({ record }));
  await assert.rejects(
    verifySentinelCircuit({ candidate: { pack: source.pack, proof }, record: true }),
    /cannot record/,
  );
  let read = false;
  await assert.rejects(
    verifySentinelCircuit({
      candidate: {
        get pack() {
          read = true;
          return source.pack;
        },
        proof,
      },
    }),
    /accessors/,
  );
  assert.equal(read, false);
});

test('changed source authority and omitted difficulty/control coverage reject before route execution', async () => {
  const pack = structuredClone(source.pack);
  pack.campaigns[0].levels[0].rules.lives++;
  await assert.rejects(
    verifySentinelCircuit({ candidate: { pack, proof } }),
    /Exact new source pack/,
  );
  const missing = structuredClone(proof);
  missing.routes.pop();
  await assert.rejects(
    verifySentinelCircuit({ candidate: { pack: source.pack, proof: missing } }),
    /Exact difficulty/,
  );
  assert.equal(ROUTES.length, 14);
});

test('fabricated outcome, signal metric and saved-prefix checkpoint cannot pass the real route comparison', async () => {
  const changed = structuredClone(proof);
  changed.routes[0].expected.score++;
  changed.routes[0].metrics.signalTicks++;
  changed.routes[0].savedPrefix.trailCells++;
  await assert.rejects(
    verifySentinelCircuit({ candidate: { pack: source.pack, proof: changed } }),
    /Exact recorded routes/,
  );
});

test('CLI producer emits exact four importable files only into a new ordinary cache directory', async (t) => {
  const cache = path.join(ROOT, '.cache');
  await mkdir(cache, { recursive: true });
  const parent = await mkdtemp(path.join(cache, 'sentinel-export-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const out = path.relative(ROOT, path.join(parent, 'candidate'));
  const result = await exportSentinelCircuit(out);
  assert.equal(result.files.length, 4);
  assert.deepEqual(
    (await readdir(result.directory)).sort(),
    result.files.map((f) => f.name).sort(),
  );
  for (const pin of result.files) {
    const bytes = await readFile(path.join(result.directory, pin.name));
    assert.equal(bytes.length, pin.bytes);
    assert.equal(digest(bytes), pin.sha256);
    const data = JSON.parse(bytes);
    if (pin.name === 'sentinel-circuit.json') assert.deepEqual(data, source.pack);
    else
      assert.deepEqual(
        data,
        source.scenarios.find((s) => pin.name === `${s.level.id}.json`),
      );
  }
  await assert.rejects(exportSentinelCircuit(out), /EEXIST/);
  const before = await readFile(proofFile);
  await assert.rejects(writeProof(proofFile, { fabricated: true }), /EEXIST/);
  assert.deepEqual(await readFile(proofFile), before);
});

test('symlink ancestors and foreign destinations refuse before creating any outside output', async (t) => {
  const cache = path.join(ROOT, '.cache');
  await mkdir(cache, { recursive: true });
  const local = await mkdtemp(path.join(cache, 'sentinel-link-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'sentinel-owned-outside-'));
  t.after(async () => {
    await rm(local, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  });
  await symlink(outside, path.join(local, 'link'));
  await assert.rejects(
    exportSentinelCircuit(path.relative(ROOT, path.join(local, 'link', 'candidate'))),
    /Symlink/,
  );
  await assert.rejects(lstat(path.join(outside, 'candidate')), { code: 'ENOENT' });
  for (const output of [outside, 'authoring/candidate', '.cache/../escape', '.cache//bad'])
    await assert.rejects(exportSentinelCircuit(output));
  assert.deepEqual(await readdir(outside), []);
});

test('new source candidate remains absent from published catalogs and ordinary build output', async () => {
  for (const name of [
    'packs/catalog.json',
    'packs/archive-catalog.json',
    'packs/index.json',
    'packs/archive-index.json',
    'optional-worlds.json',
  ]) {
    const raw = await readFile(new URL(`../content/${name}`, import.meta.url), 'utf8');
    assert.ok(!raw.includes('sentinel-circuit'));
  }
  const files = await collectBuildFiles(ROOT);
  assert.ok(!files.some((f) => (typeof f === 'string' ? f : f.path).includes('sentinel-circuit')));
  assert.equal(path.basename(fileURLToPath(proofFile)), 'routes.json');
});
