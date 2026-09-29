import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  buildCompanyInventory,
  companyInventoryHTML,
  companyOwnerId,
} from './company-content-inventory.mjs';

const report = buildCompanyInventory();

test('every registered current and retained edition is inventoried without multiplying bundle owners', async () => {
  const result = await report;
  const catalog = JSON.parse(
    await fs.readFile(new URL('../game/editions/catalog.json', import.meta.url)),
  );
  assert.equal(result.summary.editions, catalog.editions.length);
  assert.equal(
    result.summary.retainedPresentations,
    catalog.editions.reduce((sum, edition) => sum + (edition.presentationHistory ?? []).length, 0),
  );
  const expectedOwners = new Set();
  for (const campaign of catalog.campaigns) {
    const source = JSON.parse(
      await fs.readFile(new URL(`../${campaign.sourcePath}`, import.meta.url)),
    );
    for (const mission of source.missions)
      for (const mode of mission.modes)
        expectedOwners.add(
          companyOwnerId({ campaignId: campaign.id, missionId: mission.id, mode }),
        );
  }
  assert.deepEqual(
    result.owners
      .filter((row) => row.currentInstances.length)
      .map((row) => row.id)
      .sort(),
    [...expectedOwners].sort(),
  );
  const bundled = result.owners.find(
    (row) => row.id === 'company/coupa-spend-in-motion/coupa-spend-in-motion-01/solo',
  );
  assert.equal(bundled.currentInstances.length, 2);
  assert.deepEqual(result.comparisons.currentOwnerVariants, []);
  assert.equal(result.summary.currentSharedPixelGroups, 0);
  const contexts = new Map(result.contexts.map((row) => [row.id, row]));
  const instanceById = new Map(result.instances.map((row) => [row.id, row]));
  const profileKeys = bundled.currentInstances.map(
    (id) => contexts.get(instanceById.get(id).contextId).profileKey,
  );
  assert.equal(new Set(profileKeys).size, 2, 'Review deduplication must not alias profiles.');
  for (const group of result.comparisons.currentSharedOriginals)
    assert.ok(new Set(group.owners.map((id) => instanceById.get(id).ownerId)).size > 1);
});

test('historical originals retain their exact source, presentation, campaign and save dependencies', async () => {
  const result = await report;
  const current = result.instances.filter((row) => row.classification === 'current');
  const historical = result.instances.filter((row) => row.classification === 'compatibility-only');
  assert.ok(
    historical.some((old) =>
      current.some((now) => now.ownerId === old.ownerId && now.artwork !== old.artwork),
    ),
    'Must retain actual replaced pictures.',
  );
  const artById = new Map(result.artwork.map((row) => [row.id, row]));
  for (const context of result.contexts) {
    assert.ok(context.sessionKey.endsWith('.solo-v2'));
    assert.equal(
      context.dependencyBytes,
      context.dependencies.reduce((sum, file) => sum + file.bytes, 0),
    );
    if (context.retainedDescriptor)
      assert.ok(
        context.dependencies.some(
          (file) =>
            file.sha256 === context.retainedDescriptor.sha256 &&
            file.path === context.retainedDescriptor.path,
        ),
      );
    for (const instance of result.instances.filter((row) => row.contextId === context.id)) {
      assert.ok(instance.originalIdentity.campaignKey);
      assert.ok(instance.originalIdentity.simulationIdentity);
      if (instance.artwork) {
        const art = artById.get(instance.artwork);
        assert.ok(art.pixelsSha256);
        assert.ok(
          context.dependencies.some((file) => file.sha256 === art.id && file.bytes === art.bytes),
        );
      } else assert.equal(instance.backgroundKind, 'procedural-theme');
    }
  }
  const html = companyInventoryHTML(result);
  assert.ok(html.includes('Historical original reuse'));
  assert.ok(html.includes('Edition dependencies and preservation identities'));
  for (const art of result.artwork) assert.ok(html.includes(`id="art-${art.id}"`));
});

test('local inventory rejects corrupted declared assets before producing evidence', async () => {
  const catalog = JSON.parse(
    await fs.readFile(new URL('../game/editions/catalog.json', import.meta.url)),
  );
  await assert.rejects(
    buildCompanyInventory({
      readFile: async (file) =>
        file.endsWith(catalog.assets[0].path) ? Buffer.from('corrupt') : fs.readFile(file),
    }),
    /Inventory dependency differs/,
  );
});

test('committed company evidence exactly reproduces from current source and pinned originals', async () => {
  const result = await report;
  const saved = JSON.parse(
    await fs.readFile(new URL('../docs/content-offline/company-inventory.json', import.meta.url)),
  );
  assert.deepEqual(result, saved);
  assert.equal(
    companyInventoryHTML(result),
    await fs.readFile(
      new URL('../docs/content-offline/company-inventory.html', import.meta.url),
      'utf8',
    ),
  );
});
