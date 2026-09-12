import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import {
  inspectGoals,
  validatePacks,
  parseArguments,
  buildProject,
  PROJECT_ROOT,
} from './game-cli.mjs';
import { PACK_LIMITS, preparePack, resolvePackCampaign } from '../game/packs.mjs';
import { createMasteryCatalog } from '../game/mastery-catalog.mjs';
import { campaignKey } from '../game/library.mjs';

const packPath = path.join(PROJECT_ROOT, 'game/content/packs/equipment-workshop.json');
const originalBytes = await fs.readFile(packPath);
const candidate = JSON.parse(originalBytes);
async function temporary(t) {
  const directory = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'goal-inspection-')));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}
async function file(t, value) {
  const target = path.join(await temporary(t), 'example.json');
  await fs.writeFile(target, JSON.stringify(value));
  return target;
}
const run = (args) =>
  spawnSync(process.execPath, ['scripts/game-cli.mjs', ...args], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    maxBuffer: 2 * 1024 * 1024,
  });
async function fixture(t) {
  const root = await temporary(t);
  await fs.mkdir(path.join(root, 'game/content/packs'), { recursive: true });
  // Use real validators. These small entry shims let index tests own only local JSON.
  for (const module of [
    'packs.mjs',
    'mastery-catalog.mjs',
    'library.mjs',
    'core/level.mjs',
    'core/registry.mjs',
    'core/index.mjs',
    'data-json.mjs',
  ]) {
    const destination = path.join(root, 'game', module);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(
      destination,
      `export * from ${JSON.stringify(pathToFileURL(path.join(PROJECT_ROOT, 'game', module)).href)};\n`,
    );
  }
  await fs.copyFile(packPath, path.join(root, 'game/content/packs/equipment-workshop.json'));
  const index = path.join(root, 'game/content/packs/index.json');
  const setIndex = (entries) =>
    fs.writeFile(index, JSON.stringify({ format: 'xonix-pack-index.v1', packs: entries }));
  await setIndex([{ id: 'equipment-workshop', path: 'equipment-workshop.json' }]);
  return { root, setIndex };
}

test('inspect-goals accepts only explicit bounded command options', async () => {
  assert.deepEqual(
    parseArguments(['inspect-goals', '--pack', 'my pack.json', '--out', 'report.json']),
    {
      action: 'inspect-goals',
      options: { pack: 'my pack.json', out: 'report.json' },
    },
  );
  for (const args of [
    ['inspect-goals', '--pack'],
    ['inspect-goals', '--pack', 'a', '--pack', 'b'],
    ['inspect-goals', '--unsafe', 'true'],
    ['inspect-goals', '--out', '--pack', 'a'],
  ])
    assert.throws(() => parseArguments(args));
  await assert.rejects(inspectGoals(), /requires --pack/);
  assert.notEqual(run(['inspect-goals']).status, 0);
});

test('inspection matches prepared filtered campaign and authored catalog identities without images or awards', async () => {
  const report = await inspectGoals({ packPath });
  const pack = (await preparePack(candidate, { decodeImage: async () => assert.fail('No images') }))
    .pack;
  const resolved = resolvePackCampaign(pack, 'equipment-workshop');
  const catalog = createMasteryCatalog([
    {
      campaign: resolved.campaign,
      sourcePackId: pack.id,
      sourcePackFormat: pack.format,
      masteries: resolved.masteries,
    },
  ]);
  assert.equal(report.format, 'xonix-goal-inspection.v1');
  assert.equal(report.pack.bytes, originalBytes.length);
  assert.equal(report.pack.sha256, createHash('sha256').update(originalBytes).digest('hex'));
  assert.deepEqual(report.checks, {
    structure: 'valid',
    references: 'valid',
    installedLibrary: 'not-checked',
    imageDecoding: 'not-run',
    solvability: 'not-tested',
    awardAuthority: false,
  });
  assert.equal(report.campaigns[0].campaignKey, campaignKey(resolved.campaign));
  for (const map of report.campaigns[0].maps) {
    const registration = catalog.get(report.campaigns[0].campaignKey, map.id);
    assert.equal(map.goalSource, 'authored');
    assert.equal(map.levelIdentity, registration.levelIdentity);
    assert.equal(map.definitionIdentity, registration.definitionIdentity);
    assert.deepEqual(map.definition, registration.definition);
  }
  assert.equal(JSON.stringify(report).includes('data:image'), false);
  assert.ok(JSON.stringify(report).length < 8192);
  assert.deepEqual(await fs.readFile(packPath), originalBytes);
});

test('v1 exact fallback and explicit v2 no-goal remain distinguishable', async (t) => {
  const fallback = await inspectGoals({
    packPath: path.join(PROJECT_ROOT, 'game/content/packs/homeward-skies.json'),
  });
  assert.equal(fallback.campaigns[0].maps.length, 3);
  assert.ok(fallback.campaigns[0].maps.every((map) => map.goalSource === 'built-in-fallback'));
  assert.equal(JSON.stringify(fallback).includes('base64'), false);
  const none = await inspectGoals({ packPath: await file(t, { ...candidate, masteries: [] }) });
  assert.ok(
    none.campaigns[0].maps.every(
      (map) =>
        map.definition === null && map.definitionIdentity === null && map.goalSource === 'none',
    ),
  );
});

test('invalid goal references and unsupported custom predicates fail inspection', async (t) => {
  for (const mutate of [
    (pack) => {
      pack.masteries[0].all[1].zoneId = 'missing-zone';
    },
    (pack) => {
      pack.masteries[0].all[1].type = 'scripted-win';
    },
  ]) {
    const bad = structuredClone(candidate);
    mutate(bad);
    await assert.rejects(inspectGoals({ packPath: await file(t, bad) }), /Invalid pack/);
  }
});

test('inspection respects selected recipe order and rejects a missing required capability', async (t) => {
  const filtered = structuredClone(candidate);
  filtered.campaigns[0].classIds = ['impact', 'fiber', 'carrier', 'bomber'];
  const report = await inspectGoals({ packPath: await file(t, filtered) });
  assert.deepEqual(report.campaigns[0].classIds, ['bomber', 'carrier', 'fiber', 'impact']);
  assert.notEqual(report.campaigns[0].rosterHash, 'roster-v1-e159e435');
  filtered.campaigns[0].classIds = ['impact', 'carrier', 'bomber'];
  await assert.rejects(inspectGoals({ packPath: await file(t, filtered) }), /signal-resistant/);
});

test('input file is regular, bounded, parseable JSON', async (t) => {
  const directory = await temporary(t),
    link = path.join(directory, 'link.json'),
    huge = path.join(directory, 'huge.json');
  await fs.symlink(packPath, link);
  await assert.rejects(inspectGoals({ packPath: link }), /regular file/);
  await assert.rejects(inspectGoals({ packPath: directory }), /regular file/);
  await fs.writeFile(huge, '{');
  await assert.rejects(inspectGoals({ packPath: huge }), SyntaxError);
  await fs.truncate(huge, PACK_LIMITS.maxBytes + 1);
  await assert.rejects(inspectGoals({ packPath: huge }), /exceeds/);
});

test('CLI report writes a new file once and cannot overwrite source or an existing report', async (t) => {
  const target = path.join(await temporary(t), 'nested/report.json');
  const first = run(['inspect-goals', '--pack', packPath, '--out', target]);
  assert.equal(first.status, 0, first.stderr);
  assert.deepEqual(JSON.parse(first.stdout), JSON.parse(await fs.readFile(target, 'utf8')));
  const before = await fs.readFile(target);
  assert.notEqual(run(['inspect-goals', '--pack', packPath, '--out', target]).status, 0);
  assert.deepEqual(await fs.readFile(target), before);
  assert.notEqual(run(['inspect-goals', '--pack', packPath, '--out', packPath]).status, 0);
  assert.deepEqual(await fs.readFile(packPath), originalBytes);
});

test('all indexed packs include the new workshop and retain old fallback registrations', async () => {
  assert.deepEqual(await validatePacks(), { packs: 6, packLevels: 17, packGoals: 6 });
});

test('index validation rejects traversal, duplicate IDs, mismatches and bad local references', async (t) => {
  const { root, setIndex } = await fixture(t);
  assert.deepEqual(await validatePacks(root), { packs: 1, packLevels: 3, packGoals: 3 });
  for (const entries of [
    [{ id: 'escape', path: '../outside.json' }],
    [
      { id: 'equipment-workshop', path: 'equipment-workshop.json' },
      { id: 'equipment-workshop', path: 'second.json' },
    ],
    [{ id: 'wrong-id', path: 'equipment-workshop.json' }],
  ]) {
    await setIndex(entries);
    await assert.rejects(validatePacks(root));
  }
  await setIndex([{ id: 'equipment-workshop', path: 'equipment-workshop.json' }]);
  const bad = structuredClone(candidate);
  bad.masteries[1].all[2].hangarId = 'missing-hangar';
  await fs.writeFile(
    path.join(root, 'game/content/packs/equipment-workshop.json'),
    JSON.stringify(bad),
  );
  await assert.rejects(validatePacks(root), /Invalid pack/);
});

test('current build includes the compact pack and its index in inventory and offline cache', async (t) => {
  const out = path.join(await temporary(t), 'site');
  await buildProject({ out, version: 'equipment-workshop-test' });
  assert.deepEqual(
    await fs.readFile(path.join(out, 'game/content/packs/equipment-workshop.json')),
    originalBytes,
  );
  const offline = JSON.parse(await fs.readFile(path.join(out, 'offline-cache.json'), 'utf8'));
  assert.ok(
    offline.files.some((entry) => entry.path === 'game/content/packs/equipment-workshop.json'),
  );
  assert.ok(offline.files.some((entry) => entry.path === 'game/content/packs/index.json'));
});

test('base campaign conflict fails indexed build before replacing its previously valid output', async (t) => {
  const { root } = await fixture(t);
  await fs.writeFile(
    path.join(root, 'game/index.html'),
    '<!doctype html><title>CLI fixture</title>',
  );
  await fs.writeFile(
    path.join(root, 'game/build-config.json'),
    JSON.stringify({
      version: 'goal-test',
      entry: 'game/index.html',
      include: ['game'],
    }),
  );
  const out = path.join(root, 'output');
  await buildProject({ root, out });
  const marker = await fs.readFile(path.join(out, '.xonix-build.json'), 'utf8');
  // The permanent base registers the same board with no optional goal. Pack-only
  // inspection is still valid, but the complete application context must reject it.
  await fs.writeFile(
    path.join(root, 'game/content/campaign.json'),
    JSON.stringify(candidate.campaigns[0]),
  );
  await fs.writeFile(
    path.join(root, 'game/content/classes.json'),
    JSON.stringify(candidate.classRecipes),
  );
  await assert.rejects(validatePacks(root), /Conflicting/);
  await assert.rejects(buildProject({ root, out }), /Conflicting/);
  assert.equal(await fs.readFile(path.join(out, '.xonix-build.json'), 'utf8'), marker);
  assert.equal(
    await fs.readFile(path.join(out, 'game/content/packs/equipment-workshop.json'), 'utf8'),
    originalBytes.toString(),
  );
});
