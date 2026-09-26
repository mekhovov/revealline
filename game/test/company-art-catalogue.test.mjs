import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { importCompanyArt } from '../../scripts/import-company-art.mjs';
import { COMPANY_MISSIONS, COMPANY_CAMPAIGNS } from '../company-campaigns/catalog.mjs';
import { createCompanyProject } from '../company-campaigns/content.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { validateRetainedPresentation } from '../editions/retained-presentation.mjs';

const root = new URL('../../', import.meta.url),
  read = (name) => readFile(new URL(name, root)),
  json = async (name) => JSON.parse(await read(name));
const [assets, artwork, sources, catalog, ...receipts] = await Promise.all(
  [
    'game/editions/assets.json',
    'game/editions/artwork.json',
    'game/editions/asset-sources.json',
    'game/editions/catalog.json',
    'game/editions/art-prompts-coupa-bulk-02.json',
    'game/editions/art-prompts-droneaid-workshop-bulk-02.json',
    'game/editions/art-prompts-droneaid-community-bulk-02.json',
  ].map(json),
);

test('every current and historical mission has a distinct pinned picture with complete bulk provenance', async () => {
  assert.equal(COMPANY_MISSIONS.length, 69);
  assert.equal(artwork.length, 69);
  assert.equal(new Set(artwork.map((asset) => asset.sha256)).size, 69);
  for (const mission of COMPANY_MISSIONS)
    assert.ok(
      artwork.find((asset) => asset.id === `${mission.id}-picture`),
      mission.id,
    );
  const imported = await importCompanyArt({ receipts, assets, artwork, sources, read });
  assert.equal(imported.imported.length, 57);
  assert.deepEqual(imported.assets, assets);
  assert.deepEqual(imported.artwork, artwork);
  assert.deepEqual(imported.sources, sources);
  for (const receipt of receipts)
    for (const record of receipt.assets) {
      assert.equal(record.review.status, 'candidate');
      assert.equal(record.review.humanArtworkApproval, 'pending');
      assert.ok(!assets.some((asset) => asset.path === record.original.path));
    }
});

test('bulk artwork preserves all pre-batch gameplay manifests and exact recoverable source', async () => {
  const selected = catalog.editions.filter((edition) => edition.id !== 'droneaid-community');
  assert.equal(selected.length, 13);
  const originals = new Map();
  for (const edition of selected) {
    const descriptor = edition.presentationHistory.find((item) =>
      item.path.endsWith('-fb207466c.json'),
    );
    assert.ok(descriptor, edition.id);
    const { snapshot } = await validateRetainedPresentation(await json(descriptor.path), {
      edition,
    });
    assert.equal(snapshot.catalog.editions[0].revision + 1, edition.revision);
    for (const campaign of snapshot.catalog.campaigns)
      originals.set(
        campaign.id,
        snapshot.files.find((file) => file.path === campaign.sourcePath).data,
      );
  }
  assert.equal(originals.size, 11);
  for (const definition of COMPANY_CAMPAIGNS.filter((campaign) => originals.has(campaign.id))) {
    const previousSource = originals.get(definition.id),
      currentSource = createCompanyProject({
        brandId: definition.brandId,
        campaignId: definition.id,
        artwork,
      }),
      before = compileContentProject(previousSource),
      after = compileContentProject(currentSource);
    assert.deepEqual(currentSource.packs, previousSource.packs);
    assert.deepEqual(currentSource.campaigns, previousSource.campaigns);
    for (const mission of currentSource.missions)
      for (const difficulty of ['gentle', 'standard', 'expert']) {
        const options = { mode: 'solo', difficulty },
          prior = resolveMission(before, mission.id, options),
          next = resolveMission(after, mission.id, options);
        assert.deepEqual(next.level, prior.level, `${mission.id}/${difficulty}`);
        assert.equal(next.simulationIdentity, prior.simulationIdentity);
      }
  }
});
