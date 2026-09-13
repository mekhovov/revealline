import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  buildRouteChoices,
  distributionFor,
  ROOT,
  PACK_FILE,
  CHAPTER_ROOT,
  ASSIGNMENTS,
  sha,
} from '../../authoring/library/fpv-route-choices/build.mjs';
import { decodeOriginalPNG } from '../../authoring/library/four-worlds-chapters/verify-images.mjs';
import { verifyRouteChoices, PROOF_FILE } from '../../scripts/verify-route-choices.mjs';
import {
  preparePack,
  scenarioFromPack,
  PACK_LIMITS,
  emptyPackLibrary,
  installPack,
  exportPackLibrary,
  importPackLibrary,
} from '../packs.mjs';
import { CONTENT_LIMITS } from '../content.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { arcadeActionCapabilities } from '../core/arcade-actions.mjs';
import { createDifficultyContext } from '../campaign-difficulty.mjs';
import { readBuildConfig, collectBuildFiles } from '../../scripts/game-cli.mjs';

const source = await buildRouteChoices(),
  proof = JSON.parse(await readFile(path.join(ROOT, PROOF_FILE), 'utf8'));
const decoded = new Map();
const decodeImage = async (url) => {
  if (!decoded.has(url)) decoded.set(url, decodeOriginalPNG(url));
  return decoded.get(url);
};
const prepared = (await preparePack(source.pack, { decodeImage })).pack;
const physical = (level) =>
  Object.fromEntries(
    Object.entries(level).filter(
      ([key]) => !['id', 'name', 'revision', 'metadata', 'themeId'].includes(key),
    ),
  );

test('optional Tactical pack binds each original PNG exactly to one distinct newly identified map', async () => {
  const distribution = JSON.parse(
    await readFile(path.join(ROOT, CHAPTER_ROOT, 'distribution.json'), 'utf8'),
  );
  assert.deepEqual(distribution, distributionFor(source));
  assert.equal(distribution.mode, 'Tactical');
  assert.equal(distribution.includedInDefaultBuild, false);
  assert.equal(new Set(ASSIGNMENTS.map((a) => a.levelId)).size, 3);
  assert.equal(new Set(proof.images.map((i) => i.sourceSha256)).size, 3);
  assert.deepEqual(prepared.classRecipes, source.scenarios[0].classRecipes);
  assert.equal(prepared.classRecipes.length, 7);
  assert.equal(prepared.themes[0].id, 'fpv');
  assert.match(prepared.themes[0].subtitle, /Tactical/);
  assert.deepEqual(prepared.music, []);
  for (const [index, assignment] of ASSIGNMENTS.entries()) {
    const scenario = scenarioFromPack(prepared, prepared.campaigns[0].id, assignment.levelId, {
      classId: assignment.classId,
    });
    const original = source.scenarios[index],
      expected = structuredClone(physical(original.level));
    if (index === 0) delete expected.classic.arcadeActions;
    assert.deepEqual(physical(scenario.level), expected);
    assert.notEqual(scenario.level.id, original.level.id);
    assert.equal(scenario.level.revision, '1');
    assert.match(scenario.level.metadata.description, /Tactical challenge/);
    assert.equal(arcadeActionCapabilities(scenario.level).manualAbility, true);
    const background = scenario.visualOverrides.background,
      bytes = Buffer.from(background.dataUrl.slice(22), 'base64');
    assert.deepEqual(bytes, await readFile(path.join(ROOT, source.images[index].file)));
    assert.equal(sha(bytes), source.images[index].record.sha256);
    assert.equal(background.fit, 'contain');
    assert.equal(decoded.get(background.dataUrl).pixelBytes, 1774 * 887 * 3);
  }
  assert.equal(
    source.scenarios[0].level.classic.arcadeActions.version,
    'arcade-actions.v1',
    'Separate source Arcade study is unchanged.',
  );
});

test('38 exact full-campaign contexts run actual wins/failures and saved-prefix continuations including Gentle', async () => {
  const before = sha(JSON.stringify({ pack: source.pack, proof }));
  const checked = await verifyRouteChoices({ candidate: { pack: source.pack, proof } });
  assert.equal(checked.routes.length, 38);
  assert.equal(checked.routes.filter((r) => r.expected.won).length, 28);
  assert.equal(checked.routes.filter((r) => !r.expected.won).length, 10);
  assert.equal(checked.routes.filter((r) => r.difficulty === 'standard').length, 24);
  assert.equal(checked.routes.filter((r) => r.difficulty === 'gentle').length, 14);
  assert.equal(
    checked.routes.reduce((sum, r) => sum + r.expected.tick, 0),
    30540,
  );
  for (const route of checked.routes) {
    assert.equal(route.packId, 'fpv-route-choices');
    assert.ok(route.savedPrefix.tick < route.expected.tick);
    assert.deepEqual(route.savedPrefix.restoredCheckpoint, route.checkpoint);
  }
  assert.equal(sha(JSON.stringify({ pack: source.pack, proof })), before);
});

test('Tactical Scout can use manual Scan; recommended carrier/Fiber roles remain real stock choices', () => {
  for (const turnPolicy of ['immediate', 'grid-center']) {
    const level = prepared.campaigns[0].levels[0],
      run = createRun(level, {
        classId: 'scout',
        classRecipes: prepared.classRecipes,
        turnPolicy,
        seed: 1,
      });
    stepRun(run, { action: true }, FIXED_DT);
    assert.ok(run.events.some((e) => e.type === 'ability.used' && e.primitive === 'scan'));
    assert.equal(run.claimedCount, 0);
  }
  const standard = proof.routes.filter((r) => r.difficulty === 'standard');
  assert.ok(
    standard.some(
      (r) => r.classId === 'bomber' && r.metrics.stunnedEnemyTicks === 300 && r.expected.won,
    ),
  );
  assert.ok(
    standard.some(
      (r) => r.classId === 'bomber' && r.metrics.stunnedEnemyTicks === 0 && r.expected.won,
    ),
  );
  assert.ok(
    standard.some((r) => r.classId === 'fiber' && r.expected.failureCause === 'cable-limit'),
  );
  assert.ok(
    standard.some((r) => r.classId === 'scout' && r.expected.failureCause === 'cut-timeout'),
  );
});

test('Gentle has distinct full campaign identity and honestly removes authored cut limits', () => {
  const base = { ...prepared.campaigns[0], classRecipes: prepared.classRecipes };
  const standard = createDifficultyContext(base, 'standard'),
    gentle = createDifficultyContext(base, 'gentle');
  assert.notEqual(standard.campaignKey, gentle.campaignKey);
  assert.equal(gentle.baseCampaignKey, standard.campaignKey);
  for (const [index, level] of gentle.campaign.levels.entries()) {
    assert.equal(level.rules.cutTimeLimitSeconds, 0);
    assert.equal(level.rules.maxTrailCells, 0);
    assert.equal(level.rules.lives, 5);
    assert.notEqual(level.revision, standard.campaign.levels[index].revision);
  }
  assert.match(
    prepared.campaigns[0].levels[2].metadata.description,
    /On Standard.*eight-second and 76-cell.*Gentle removes/,
  );
  const west = proof.routes.filter((r) => r.sourceRouteId.endsWith('/immediate/west-exit-clear'));
  assert.notEqual(
    west[0].expected.coverage,
    west[1].expected.coverage,
    'Gentle outcomes are measured rather than copied from Standard.',
  );
});

test('existing image/pack/library caps accept this pack and refuse addition to all four original worlds without eviction', async () => {
  assert.equal(CONTENT_LIMITS.maxImageBytes, 4 * 1024 * 1024);
  assert.equal(PACK_LIMITS.maxBytes, 24 * 1024 * 1024);
  assert.equal(PACK_LIMITS.libraryBytes, 48 * 1024 * 1024);
  for (const image of source.images) assert.ok(image.record.bytes < CONTENT_LIMITS.maxImageBytes);
  assert.ok((await readFile(path.join(ROOT, PACK_FILE))).length < PACK_LIMITS.maxBytes);
  const empty = emptyPackLibrary(),
    installed = installPack(empty, prepared),
    bytes = exportPackLibrary(installed);
  assert.equal(Buffer.byteLength(bytes), source.libraryBytes);
  assert.equal(exportPackLibrary(await importPackLibrary(bytes, { decodeImage })), bytes);
  assert.equal(empty.packs.length, 0);
  const names = [
    'original-fpv-pressure',
    'original-ukraine-atlas',
    'original-retro-1994',
    'original-spend-network',
  ];
  const oldPacks = await Promise.all(
    names.map(async (name) =>
      JSON.parse(
        await readFile(
          path.join(ROOT, 'authoring/library/four-worlds-chapters/packs', `${name}.json`),
          'utf8',
        ),
      ),
    ),
  );
  const old = await importPackLibrary(
    { format: 'xonix-pack-library.v1', packs: oldPacks },
    { decodeImage },
  );
  const before = sha(exportPackLibrary(old));
  assert.throws(() => installPack(old, prepared));
  assert.equal(sha(exportPackLibrary(old)), before);
  assert.deepEqual(
    old.packs.map((p) => p.id),
    names,
  );
});

test('new optional body and raw art remain outside the current build includes and catalogs', async () => {
  const files = await collectBuildFiles(ROOT, await readBuildConfig(ROOT));
  assert.ok(
    !files.some(
      (f) =>
        f.startsWith('authoring/library/fpv-route-choices/') ||
        f.startsWith('authoring/library/challenge-chapter-art/'),
    ),
  );
  for (const name of [
    'packs/index.json',
    'packs/archive-index.json',
    'packs/catalog.json',
    'packs/archive-catalog.json',
    'optional-worlds.json',
  ]) {
    const raw = await readFile(path.join(ROOT, 'game/content', name), 'utf8');
    assert.ok(!raw.includes('fpv-route-choices'));
  }
});

test('verifier refuses different valid image assignments, changed Tactical policy, missing routes and false context/verdict', async () => {
  const art = structuredClone(source.pack);
  [art.levelVisuals[0].visualOverrides, art.levelVisuals[1].visualOverrides] = [
    art.levelVisuals[1].visualOverrides,
    art.levelVisuals[0].visualOverrides,
  ];
  await assert.rejects(
    verifyRouteChoices({ candidate: { pack: art, proof } }),
    /Exact compiled art/,
  );
  const policy = structuredClone(source.pack);
  policy.campaigns[0].levels[0].classic.arcadeActions = { version: 'arcade-actions.v1' };
  await assert.rejects(
    verifyRouteChoices({ candidate: { pack: policy, proof } }),
    /Exact compiled art/,
  );
  for (const kind of ['missing', 'context', 'verdict', 'saved']) {
    const changed = structuredClone(proof);
    if (kind === 'missing') changed.routes.pop();
    else if (kind === 'context') changed.routes[0].campaignKey = 'foreign/1/context';
    else if (kind === 'verdict') changed.routes[0].expected.score++;
    else changed.routes[0].savedPrefix.sessionSha256 = '0'.repeat(64);
    await assert.rejects(verifyRouteChoices({ candidate: { pack: source.pack, proof: changed } }));
  }
});

test('explicit malformed verifier candidates cannot silently select local defaults or write output', async () => {
  for (const candidate of [
    null,
    false,
    {},
    { pack: null, proof: null },
    { pack: {} },
    { proof: {} },
    { pack: [], proof: {} },
  ]) {
    await assert.rejects(verifyRouteChoices({ candidate }), /Explicit Route Choices candidate/);
  }
  for (const candidate of [null, false, {}]) {
    await assert.rejects(
      verifyRouteChoices({ candidate, write: true }),
      /Explicit candidate cannot write/,
    );
  }
  await assert.rejects(verifyRouteChoices({ write: 'yes' }), /write flag must be boolean/);
  await assert.rejects(buildRouteChoices({ write: 'yes' }), /write flag must be boolean/);
});
