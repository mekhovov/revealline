import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { importCompanyArt } from '../../scripts/import-company-art.mjs';
import { COMPANY_MISSIONS, COMPANY_CAMPAIGNS } from '../company-campaigns/catalog.mjs';
import { CURRICULUM_CAMPAIGNS, CURRICULUM_MISSIONS } from '../company-campaigns/curriculum.mjs';
import { createCompanyProject } from '../company-campaigns/content.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { validateRetainedPresentation } from '../editions/retained-presentation.mjs';
import { selectCurrentCompanyArtwork } from '../company-campaigns/artwork.mjs';

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
    'game/editions/art-prompts-droneaid-fpv-workshop-v2.json',
    'game/editions/art-prompts-droneaid-fpv-makers-handoff-v2.json',
    'game/editions/art-prompts-droneaid-fpv-community-v2.json',
    'game/editions/art-prompts-droneaid-fpv-crop-fix-v3.json',
  ].map(json),
);

test('every current and historical mission has a distinct pinned picture with complete bulk provenance', async () => {
  assert.equal(COMPANY_MISSIONS.length, 69);
  const homeIds = [
    ...new Set(CURRICULUM_CAMPAIGNS.map((campaign) => `${campaign.brandId}-home-picture`)),
  ];
  assert.equal(homeIds.length, 4);
  const initialDiscoveryPictures = [
    'social-drone-people-workshop-01-picture',
    'ukraine-threads-03-picture',
    'fpv-meet-aircraft-01-picture',
  ];
  const distinctDiscoveryPictures = CURRICULUM_MISSIONS.map(
    (mission) => `${mission.id}-picture`,
  ).filter((id) => artwork.some((asset) => asset.id === id));
  for (const id of initialDiscoveryPictures) assert.ok(distinctDiscoveryPictures.includes(id), id);
  const campaignKeyIds = CURRICULUM_CAMPAIGNS.map((campaign) => `${campaign.id}-key-picture`);
  assert.equal(campaignKeyIds.length, 18);
  const legacyArtwork = artwork.filter(
    (asset) =>
      !homeIds.includes(asset.id) &&
      !distinctDiscoveryPictures.includes(asset.id) &&
      !campaignKeyIds.includes(asset.id),
  );
  assert.equal(legacyArtwork.length, 106);
  assert.equal(new Set(legacyArtwork.map((asset) => asset.sha256)).size, 106);
  const totalPictures =
    106 + homeIds.length + campaignKeyIds.length + distinctDiscoveryPictures.length;
  assert.equal(artwork.length, totalPictures);
  assert.equal(new Set(artwork.map((asset) => asset.sha256)).size, totalPictures);
  assert.deepEqual(
    artwork
      .filter((asset) => campaignKeyIds.includes(asset.id))
      .map((asset) => asset.id)
      .sort(),
    campaignKeyIds.sort(),
  );
  assert.deepEqual(
    artwork
      .filter((asset) => distinctDiscoveryPictures.includes(asset.id))
      .map((asset) => asset.id)
      .sort(),
    distinctDiscoveryPictures.sort(),
  );
  assert.equal(selectCurrentCompanyArtwork(legacyArtwork).length, 69);
  assert.deepEqual(
    artwork
      .filter((asset) => homeIds.includes(asset.id))
      .map((asset) => asset.id)
      .sort(),
    [...homeIds].sort(),
  );
  for (const mission of COMPANY_MISSIONS)
    assert.ok(
      artwork.find((asset) => asset.id === `${mission.id}-picture`),
      mission.id,
    );
  // Each receipt is a separate authored batch; replaying either historical or
  // current revision must remain idempotent after newer pictures are admitted.
  let count = 0;
  for (const receipt of receipts) {
    const imported = await importCompanyArt({
      receipts: [receipt],
      assets,
      artwork,
      sources,
      read,
    });
    count += imported.imported.length;
    assert.deepEqual(imported.assets, assets);
    assert.deepEqual(imported.artwork, artwork);
    assert.deepEqual(imported.sources, sources);
  }
  assert.equal(count, 94);
  for (const receipt of receipts)
    for (const record of receipt.assets) {
      assert.equal(record.review.status, 'candidate');
      assert.equal(record.review.humanArtworkApproval, 'pending');
      assert.ok(!assets.some((asset) => asset.path === record.original.path));
    }
});

test('bulk artwork preserves all pre-batch gameplay manifests and exact recoverable source', async () => {
  const legacyBrands = new Set(COMPANY_CAMPAIGNS.map((campaign) => campaign.brandId));
  const selected = catalog.editions.filter(
    (edition) => legacyBrands.has(edition.brandId) && edition.id !== 'droneaid-community',
  );
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
    assert.ok(snapshot.catalog.editions[0].revision < edition.revision);
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

test('all 36 current Dutch pictures advance without changing gameplay or losing their original presentation', async () => {
  const current = selectCurrentCompanyArtwork(artwork);
  const editions = catalog.editions.filter((edition) => edition.brandId === 'droneaid-nl');
  assert.equal(editions.length, 7);
  const projects = new Map();
  for (const edition of editions) {
    const descriptor = edition.presentationHistory.find((item) =>
      item.path.endsWith('-475bccde4.json'),
    );
    assert.ok(descriptor, edition.id);
    const { snapshot } = await validateRetainedPresentation(await json(descriptor.path), {
      edition,
    });
    assert.equal(
      snapshot.catalog.editions[0].revision +
        (['droneaid-nl-community', 'droneaid-nl-parts-in-motion'].includes(edition.id) ? 2 : 1) +
        // Discovery rewards advance these exact presentation editions once more;
        // their retained originals and every gameplay comparison below still apply.
        (['droneaid-nl-community', 'droneaid-nl-workshop-lights'].includes(edition.id) ? 1 : 0),
      edition.revision,
    );
    for (const campaign of snapshot.catalog.campaigns)
      projects.set(
        campaign.id,
        snapshot.files.find((file) => file.path === campaign.sourcePath).data,
      );
  }
  assert.equal(projects.size, 6);
  let compared = 0;
  for (const [campaignId, oldSource] of projects) {
    const newSource = createCompanyProject({ brandId: 'droneaid-nl', campaignId, artwork }),
      before = compileContentProject(oldSource),
      after = compileContentProject(newSource);
    assert.deepEqual(oldSource.maps, newSource.maps);
    for (const mission of newSource.missions) {
      const picture = current.find((asset) => asset.id === `${mission.id}-picture`),
        oldPicture = oldSource.assets.find((asset) => asset.id === picture.id);
      assert.equal(picture.revision, mission.id === 'droneaid-nl-parts-in-motion-03' ? '3' : '2');
      assert.equal(oldPicture.revision, '1');
      assert.notEqual(picture.sha256, oldPicture.sha256);
      assert.ok(picture.bytes <= 384 * 1024);
      assert.ok([576, 640].includes(picture.width));
      assert.equal(picture.height * 2, picture.width);
      for (const difficulty of ['gentle', 'standard', 'expert']) {
        const prior = resolveMission(before, mission.id, { difficulty }),
          next = resolveMission(after, mission.id, { difficulty });
        assert.deepEqual(next.level, prior.level);
        assert.equal(next.simulationIdentity, prior.simulationIdentity);
        compared++;
      }
    }
  }
  assert.equal(compared, 108);
});

test('the corrected FPV crop advances only its campaign and combined edition with exact v2 recovery', async () => {
  const affected = ['droneaid-nl-community', 'droneaid-nl-parts-in-motion'];
  for (const editionId of affected) {
    const edition = catalog.editions.find((entry) => entry.id === editionId);
    const descriptor = edition.presentationHistory.find((entry) =>
      entry.path.endsWith('-38d320f48.json'),
    );
    assert.ok(descriptor, editionId);
    const bytes = await read(descriptor.path);
    assert.equal(bytes.length, descriptor.bytes);
    const { snapshot } = await validateRetainedPresentation(JSON.parse(bytes), { edition });
    assert.equal(snapshot.authoredPresentationSha256, descriptor.id);
    assert.equal(
      snapshot.catalog.editions[0].revision + 1 + (editionId === 'droneaid-nl-community' ? 1 : 0),
      edition.revision,
    );
    const prior = snapshot.catalog.assets.find(
      (asset) => asset.id === 'droneaid-nl-parts-in-motion-03-reveal-v2',
    );
    assert.equal(prior?.sha256, '196aad09cc2e99b5bdd53f45fcd434f3bcab3352a31345de6bf73055f953f721');
    assert.equal(
      snapshot.catalog.assets.some(
        (asset) => asset.id === 'droneaid-nl-parts-in-motion-03-reveal-v3',
      ),
      false,
    );
  }
  for (const edition of catalog.editions.filter((entry) => !affected.includes(entry.id)))
    assert.equal(
      edition.presentationHistory?.some((entry) => entry.path.endsWith('-38d320f48.json')) ?? false,
      false,
      edition.id,
    );
});
