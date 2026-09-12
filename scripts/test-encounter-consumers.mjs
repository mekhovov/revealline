import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { inspectGoals, validatePacks, buildProject, PROJECT_ROOT } from './game-cli.mjs';
import { preparePack, resolvePackCampaign } from '../game/packs.mjs';
import { campaignKey } from '../game/library.mjs';
import { dataIdentity } from '../game/data-json.mjs';
import { normalizedLevel } from '../game/core/level.mjs';

const packPath = path.join(PROJECT_ROOT, 'game/content/packs/sentinel-relay.json');
const original = await fs.readFile(packPath),
  source = JSON.parse(original);
async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'encounter-cli-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'game/content/packs'), { recursive: true });
  for (const name of [
    'packs.mjs',
    'mastery-catalog.mjs',
    'library.mjs',
    'core/level.mjs',
    'core/registry.mjs',
    'core/index.mjs',
    'data-json.mjs',
  ]) {
    const file = path.join(root, 'game', name);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(
      file,
      `export * from ${JSON.stringify(pathToFileURL(path.join(PROJECT_ROOT, 'game', name)).href)};\n`,
    );
  }
  await fs.copyFile(packPath, path.join(root, 'game/content/packs/sentinel-relay.json'));
  await fs.copyFile(
    path.join(PROJECT_ROOT, 'game/content/packs/equipment-workshop.json'),
    path.join(root, 'game/content/packs/equipment-workshop.json'),
  );
  await fs.copyFile(
    path.join(PROJECT_ROOT, 'game/content/campaign.json'),
    path.join(root, 'game/content/campaign.json'),
  );
  await fs.copyFile(
    path.join(PROJECT_ROOT, 'game/content/classes.json'),
    path.join(root, 'game/content/classes.json'),
  );
  await fs.writeFile(
    path.join(root, 'game/content/packs/index.json'),
    JSON.stringify({
      format: 'xonix-pack-index.v1',
      packs: [
        { id: 'equipment-workshop', path: 'equipment-workshop.json' },
        { id: 'sentinel-relay', path: 'sentinel-relay.json' },
      ],
    }),
  );
  await fs.writeFile(
    path.join(root, 'game/index.html'),
    '<!doctype html><title>Encounter CLI test fixture</title>',
  );
  await fs.writeFile(
    path.join(root, 'game/build-config.json'),
    JSON.stringify({ version: 'encounter-cli-test', entry: 'game/index.html', include: ['game'] }),
  );
  return root;
}
test('v3 inspector identifies the new level namespace and explicit absence of optional goals', async () => {
  const report = await inspectGoals({ packPath });
  const { pack } = await preparePack(source, { decodeImage: async () => assert.fail('No media') });
  const { campaign } = resolvePackCampaign(pack, source.campaigns[0].id);
  assert.equal(report.campaigns[0].campaignKey, campaignKey(campaign));
  const map = report.campaigns[0].maps[0];
  assert.equal(map.levelIdentity, `level-v2-${dataIdentity(normalizedLevel(campaign.levels[0]))}`);
  assert.equal(map.definition, null);
  assert.equal(map.definitionIdentity, null);
  assert.equal(map.goalSource, 'none');
  assert.equal(report.checks.imageDecoding, 'not-run');
  assert.equal(report.checks.solvability, 'not-tested');
  assert.equal(report.checks.awardAuthority, false);
  assert.deepEqual(await fs.readFile(packPath), original);
});
test('mixed indexed old-goal and encounter packs pass preflight and appear in the build inventory', async (t) => {
  const root = await fixture(t),
    out = path.join(root, 'output');
  assert.deepEqual(await validatePacks(root), { packs: 2, packLevels: 4, packGoals: 3 });
  await buildProject({ root, out });
  assert.deepEqual(
    await fs.readFile(path.join(out, 'game/content/packs/sentinel-relay.json')),
    original,
  );
  const manifest = JSON.parse(await fs.readFile(path.join(out, 'manifest.json')));
  assert.ok(
    manifest.files.some((entry) => entry.path === 'game/content/packs/sentinel-relay.json'),
  );
});
test('invalid indexed encounter versions fail before replacing the existing build', async (t) => {
  const root = await fixture(t),
    out = path.join(root, 'output');
  await buildProject({ root, out });
  const marker = await fs.readFile(path.join(out, '.xonix-build.json'));
  const invalid = structuredClone(source);
  invalid.engine = 'xonix-core.v2';
  await fs.writeFile(
    path.join(root, 'game/content/packs/sentinel-relay.json'),
    JSON.stringify(invalid),
  );
  await assert.rejects(validatePacks(root), /different engine/);
  await assert.rejects(buildProject({ root, out }), /different engine/);
  assert.deepEqual(await fs.readFile(path.join(out, '.xonix-build.json')), marker);
  assert.deepEqual(
    await fs.readFile(path.join(out, 'game/content/packs/sentinel-relay.json')),
    original,
  );
});
