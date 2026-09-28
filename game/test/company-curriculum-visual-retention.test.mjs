import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dataIdentity } from '../data-json.mjs';
import { validateRetainedPresentation } from '../editions/retained-presentation.mjs';
import { createRewardMissionBindings } from '../rewards/bindings.mjs';
import { reconcileEarnedRewards, validateRewardState } from '../rewards/model.mjs';
const root = new URL('../../', import.meta.url);
const json = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const catalog = await json('game/editions/catalog.json');
const originals = [
  {
    editionId: 'fpv-learning',
    campaignId: 'fpv-meet-aircraft',
    oldEditionRevision: 6,
    snapshotSha256: '03035e3f1eaefd245d5ad54706055456205ba26c003fd25c1a6f0ab25dce6a4e',
    rewardIdentity: '857304c74f9d6e40',
    addedPayloadIds: ['fpv-meet-aircraft-01-structure-exploration'],
  },
  {
    editionId: 'ukraine-culture',
    campaignId: 'ukraine-threads',
    oldEditionRevision: 5,
    snapshotSha256: 'fb63b425bdc90769bdb9a5f7bbb8a3d4a3c18086bee0d87f4187712398e4dcb0',
    rewardIdentity: 'a87a029bafb6ea54',
    addedPayloadIds: [
      'reference-ukraine-met-shirt-fragment-image',
      'reference-ukraine-met-shirt-fragment-credit',
      'ukraine-threads-01-object-exploration',
    ],
  },
];
for (const fixture of originals)
  test(`${fixture.editionId}: exact pre-visual promises and earned payloads survive the additive image atlas update`, async () => {
    const edition = catalog.editions.find((item) => item.id === fixture.editionId);
    const retained = edition.presentationHistory.find(
      (item) => item.path === `game/editions/retained/${edition.id}-before-visual-atlas.json`,
    );
    assert.ok(retained);
    const raw = await readFile(new URL(retained.path, root));
    assert.equal(
      retained.sha256,
      fixture.snapshotSha256,
      'This immutable historical snapshot must never be regenerated from current rewards.',
    );
    assert.equal(createHash('sha256').update(raw).digest('hex'), fixture.snapshotSha256);
    assert.equal(raw.length, retained.bytes);
    const { snapshot } = await validateRetainedPresentation(raw.toString('utf8'), { edition });
    assert.equal(snapshot.catalog.editions[0].revision, fixture.oldEditionRevision);
    assert.equal(
      edition.revision,
      fixture.oldEditionRevision + 1,
      'The diagram batch receives a new edition revision.',
    );
    const changed = [];
    for (const descriptor of snapshot.catalog.campaigns) {
      const beforeSource = snapshot.files.find((file) => file.path === descriptor.sourcePath).data;
      const afterSource = await json(descriptor.sourcePath);
      assert.deepEqual(
        createRewardMissionBindings(afterSource),
        createRewardMissionBindings(beforeSource),
        descriptor.id,
      );
      const beforeRewards = snapshot.files.find((file) => file.path === descriptor.rewardPath).data;
      const afterRewards = await json(descriptor.rewardPath);
      assert.deepEqual(
        afterRewards.map((item) => item.id),
        beforeRewards.map((item) => item.id),
      );
      for (const before of beforeRewards) {
        const after = afterRewards.find((item) => item.id === before.id);
        assert.deepEqual(
          after.requirements,
          before.requirements,
          'No mission, learning or finale finish line moves.',
        );
        if (before.id === fixture.campaignId + '-01-discovery') {
          changed.push(before.id);
          assert.equal(dataIdentity(before), fixture.rewardIdentity);
          assert.equal(before.revision, '4');
          assert.equal(after.revision, '5');
          assert.deepEqual(after.payloads.slice(0, before.payloads.length), before.payloads);
          assert.deepEqual(
            after.payloads.slice(before.payloads.length).map((item) => item.id),
            fixture.addedPayloadIds,
          );
          assert.equal(
            before.payloads.some((item) => item.type === 'exploration'),
            false,
          );
        } else {
          assert.deepEqual(
            after.payloads,
            before.payloads,
            `${before.id}: only the named pilot payload may change`,
          );
          if (before.scope.kind === 'campaign')
            assert.equal(before.requirements.missions.length, 6);
        }
      }
    }
    assert.deepEqual(changed, [fixture.campaignId + '-01-discovery']);
    const descriptor = snapshot.catalog.campaigns.find((item) => item.id === fixture.campaignId);
    const old = snapshot.files.find((file) => file.path === descriptor.rewardPath).data;
    const current = await json(descriptor.rewardPath);
    const rewardIds = [fixture.campaignId + '-01-discovery', fixture.campaignId + '-finale'];
    const oldPromised = old.filter((item) => rewardIds.includes(item.id));
    const newDefinitions = current.filter((item) => rewardIds.includes(item.id));
    const context = {
      editionId: edition.id,
      brandId: edition.brandId,
      campaignIds: [fixture.campaignId],
      clears: {},
      learning: [],
      mastery: [],
    };
    const promised = reconcileEarnedRewards(oldPromised, context);
    assert.equal(promised.granted.length, 0);
    const upgraded = reconcileEarnedRewards(
      newDefinitions,
      context,
      validateRewardState(JSON.parse(JSON.stringify(promised.state)), { editionId: edition.id }),
    );
    assert.deepEqual(
      upgraded.state.promises,
      oldPromised,
      'Backup/import and revision selection preserve the exact original promise.',
    );
    assert.deepEqual(upgraded.state.receipts, []);
    const finale = oldPromised.find((item) => item.scope.kind === 'campaign');
    for (const mission of finale.requirements.missions)
      context.clears[mission.missionId] = {
        runId: `accepted-${mission.missionId}`,
        ...mission.bindings.find((binding) => binding.difficulty === 'standard'),
      };
    const earned = reconcileEarnedRewards(newDefinitions, context, upgraded.state);
    assert.equal(earned.granted.length, 2);
    for (const receipt of earned.granted)
      assert.deepEqual(
        receipt.definition,
        oldPromised.find((item) => item.id === receipt.definition.id),
      );
    const restored = validateRewardState(JSON.parse(JSON.stringify(earned.state)), {
      editionId: edition.id,
    });
    assert.deepEqual(reconcileEarnedRewards(newDefinitions, context, restored).state, restored);
    assert.equal(reconcileEarnedRewards(newDefinitions, context, restored).granted.length, 0);
    const newcomer = reconcileEarnedRewards(newDefinitions, context);
    assert.equal(newcomer.granted.length, 2);
    assert.deepEqual(
      newcomer.granted.find((item) => item.definition.scope.kind === 'mission').definition,
      newDefinitions.find((item) => item.scope.kind === 'mission'),
    );
  });
