import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { projectEditionDemoCatalog, editionDemoResources } from '../../scripts/edition-runtime.mjs';
import { compileEdition } from '../../scripts/compile-edition.mjs';
import { createContentExecutionCatalog } from '../content-design/execution.mjs';
import { demoIdentity, resolveDemoCatalog } from '../demo-catalog.mjs';
import { campaignKey } from '../library.mjs';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import { retainedEditionFixture } from './helpers/retained-edition-fixture.mjs';

const mainCatalog = JSON.parse(
  await readFile(new URL('../demo-data/catalog.json', import.meta.url)),
);
const template = mainCatalog.clips.find(
  (clip) => clip.id.startsWith('solo-qualified-') && clip.runtimePerformances?.length,
);
function metadata(entry, suffix) {
  const clip = structuredClone(template),
    level = entry.campaign.levels[0];
  const id = 'solo-qualified-' + suffix;
  return {
    ...clip,
    id,
    campaignId: entry.campaign.id,
    campaignKey: campaignKey(entry.campaign),
    levelId: level.id,
    levelRevision: level.revision,
    identity: demoIdentity(level, entry.classRecipes ?? entry.campaign.classRecipes),
    replayURL: './demo-data/' + id + '.replay.json',
    ...(clip.replayVariants
      ? {
          replayVariants: clip.replayVariants.map(
            (_, i) => './demo-data/' + id + '.variant-' + i + '.replay.json',
          ),
        }
      : {}),
    runtimePerformances: clip.runtimePerformances.map((performance, i) => ({
      ...performance,
      replayURL: './demo-data/' + id + '.runtime-' + i + '.replay.json',
    })),
  };
}
const standard = (source) =>
  createContentExecutionCatalog(source, { mode: 'solo' }).entries.find(
    (entry) => entry.difficulty === 'standard',
  );

test('selected Company demo metadata uses execution campaign identity and preserves retained keys', async () => {
  const f = await retainedEditionFixture();
  const old = standard(f.original.route.source);
  f.replacePicture();
  const current = standard((await f.load()).route.source);
  const retained = standard((await f.load(f.descriptor.id)).route.source);
  const selectedId = f.catalog.campaigns[0].id;
  assert.notEqual(old.sourcePackId, selectedId, 'The pack ID cannot substitute for campaign ID.');
  assert.equal(old.campaign.id, selectedId);
  assert.equal(current.campaign.id, selectedId);
  assert.equal(retained.campaign.id, selectedId);
  assert.notEqual(campaignKey(old.campaign), campaignKey(current.campaign));
  assert.equal(campaignKey(retained.campaign), campaignKey(old.campaign));
  // Only metadata is needed for selection. Recording verification is a separate gate.
  const clips = [metadata(old, 'retained-fixture'), metadata(current, 'current-fixture')];
  const catalog = { format: mainCatalog.format, clips };
  const projected = projectEditionDemoCatalog(
    catalog,
    f.catalog.campaigns.map((row) => row.id),
  );
  assert.deepEqual(projected.clips, clips);
  assert.deepEqual(
    resolveDemoCatalog(projected, [current]).map((clip) => clip.id),
    [clips[1].id],
  );
  assert.deepEqual(
    resolveDemoCatalog(projected, [retained]).map((clip) => clip.id),
    [clips[0].id],
  );
  assert.deepEqual(projectEditionDemoCatalog(catalog, [old.sourcePackId]).clips, []);
  const resources = editionDemoResources(projected);
  for (const clip of clips)
    for (const url of [
      clip.replayURL,
      ...(clip.replayVariants ?? []),
      ...clip.runtimePerformances.map((item) => item.replayURL),
    ]) {
      assert.ok(resources.includes('game/' + url.slice(2)));
      assert.ok(
        resources.includes('game/' + url.slice(2).replace(/\.replay\.json$/, '.diagnostics.json')),
      );
    }
  assert.deepEqual(catalog.clips, clips, 'The original metadata remains unchanged.');
});

test('Company projection accepts an empty catalog but still rejects malformed excluded clips', () => {
  assert.deepEqual(projectEditionDemoCatalog(mainCatalog, []).clips, []);
  const bad = structuredClone(mainCatalog);
  bad.clips[0].replayURL = './demo-data/../outside.replay.json';
  assert.throws(() => projectEditionDemoCatalog(bad, []), /bundled relative URLs/);
  assert.throws(() => projectEditionDemoCatalog(mainCatalog, [null]), /selected campaign IDs/);
});

test('compiler derives selected demo bodies from its supplied catalog and keeps Snake resources', async () => {
  const f = await editionProviderFixture(),
    entry = standard(f.source);
  const selected = metadata(entry, 'selected-fixture');
  const foreign = { ...metadata(entry, 'foreign-fixture'), campaignId: 'another-company' };
  const catalog = { format: mainCatalog.format, clips: [selected, foreign] };
  const original = Buffer.from(JSON.stringify(catalog));
  const files = new Map(
    [...f.files].map(([name, value]) => [name, Buffer.from(JSON.stringify(value))]),
  );
  files.set(
    'game/company.html',
    Buffer.from('<!doctype html><html><head></head><body>Game</body></html>'),
  );
  for (const name of editionDemoResources(catalog)) files.set(name, Buffer.from('{}'));
  files.set('game/demo-data/catalog.json', original);
  const snake = 'game/demo-data/snake/fixture.replay.json';
  files.set(snake, Buffer.from('{"snake":"kept"}'));
  const compiled = await compileEdition({
    catalog: f.catalog,
    editionIds: [f.catalog.editions[0].id],
    files,
    enginePaths: ['game/company.html', ...editionDemoResources(catalog), snake],
  });
  assert.deepEqual(JSON.parse(compiled.files.get('game/demo-data/catalog.json')).clips, [selected]);
  for (const name of editionDemoResources({ format: catalog.format, clips: [selected] }))
    assert.ok(compiled.files.has(name), name);
  for (const name of editionDemoResources({ format: catalog.format, clips: [foreign] }).filter(
    (name) =>
      !['game/demo-data/catalog.json', 'game/demo-data/variant-provenance.json'].includes(name),
  ))
    assert.equal(compiled.files.has(name), false, name);
  assert.deepEqual(compiled.files.get(snake), files.get(snake));
  assert.deepEqual(files.get('game/demo-data/catalog.json'), original);
});
