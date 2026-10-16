import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dataIdentity } from '../data-json.mjs';
import { validateRetainedPresentation } from '../editions/retained-presentation.mjs';
import { createRewardMissionBindings } from '../rewards/bindings.mjs';
import { createCurriculumTextileLighting } from '../company-campaigns/curriculum-textile-lighting.mjs';
import { createCurriculumMotionMakersContent } from '../company-campaigns/curriculum-motion-makers.mjs';
import {
  completionRewardAssetReferences,
  reconcileEarnedRewards,
  validateRewardState,
} from '../rewards/model.mjs';

const root = new URL('../../', import.meta.url);
const json = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const catalog = await json('game/editions/catalog.json');
const originals = [
  {
    editionId: 'social-drone-ua',
    snapshotSuffix: 'before-mission-alt',
    campaignId: 'social-drone-people-workshop',
    missionId: 'social-drone-people-workshop-01',
    oldEditionRevision: 6,
    oldRewardRevision: '4',
    snapshotSha256: '13d119e2e5aa67bd6636a2d83d9e1374d792a05edc33c462654f19d965efe409',
    rewardIdentity: 'f8564c86daefc950',
    addedPayloads: [],
    createAdditions: () => [],
  },
  {
    editionId: 'ukraine-culture',
    snapshotSuffix: 'before-textile-and-motion',
    campaignId: 'ukraine-threads',
    missionId: 'ukraine-threads-03',
    oldEditionRevision: 6,
    oldRewardRevision: '4',
    snapshotSha256: 'c7122ae0c8f17932986df03fc636c02900d83a30c235529789f0a90f253c7555',
    rewardIdentity: '28284eadd0135d60',
    addedPayloads: [{ id: 'ukraine-threads-03-lighting-comparison', type: 'exploration' }],
    createAdditions: (assets) => createCurriculumTextileLighting('ukraine-threads-03', assets),
  },
  {
    editionId: 'fpv-learning',
    snapshotSuffix: 'before-textile-and-motion',
    campaignId: 'fpv-meet-aircraft',
    missionId: 'fpv-meet-aircraft-02',
    oldEditionRevision: 7,
    oldRewardRevision: '5',
    snapshotSha256: 'e50b6a3c0197f4944756942af314e31a76a2db559b505a23d310185e834a0289',
    rewardIdentity: '41fb52e592a4ee2a',
    addedPayloads: [
      { id: 'fpv-meet-aircraft-02-motion-guide', type: 'knowledge' },
      { id: 'fpv-meet-aircraft-02-motion-video', type: 'video' },
    ],
    createAdditions: (assets) =>
      createCurriculumMotionMakersContent('fpv-meet-aircraft-02', assets),
  },
];

// The only permitted edit to an existing payload is removal of the obsolete
// shared-home fallback caption. Specific image descriptions stay byte-exact.
function correctedIllustrationCaption(payload) {
  const result = structuredClone(payload);
  if (result.type !== 'image') return result;
  result.locales.en.alt = result.locales.en.alt.replace(
    ' — original campaign illustration; a shared home scene may be reused.',
    ' — original mission illustration.',
  );
  result.locales.uk.alt = result.locales.uk.alt.replace(
    ' — оригінальна ілюстрація кампанії; спільна домашня сцена може повторюватися.',
    ' — оригінальна ілюстрація місії.',
  );
  return result;
}

for (const fixture of originals)
  test(`${fixture.editionId}: exact old rewards survive optional discovery media and caption corrections`, async () => {
    const edition = catalog.editions.find((item) => item.id === fixture.editionId);
    const afterDescriptor = edition.presentationHistory.find((entry) =>
      entry.path.endsWith(`${edition.id}-before-showcase-learning.json`),
    );
    assert.ok(afterDescriptor);
    const afterRaw = await readFile(new URL(afterDescriptor.path, root));
    assert.equal(createHash('sha256').update(afterRaw).digest('hex'), afterDescriptor.sha256);
    const { snapshot: afterSnapshot } = await validateRetainedPresentation(
      afterRaw.toString('utf8'),
      { edition },
    );
    assert.equal(afterSnapshot.catalog.editions[0].revision, fixture.oldEditionRevision + 1);
    const afterFiles = new Map(afterSnapshot.files.map((file) => [file.path, file.data]));
    const retained = edition.presentationHistory.find(
      (item) => item.path === `game/editions/retained/${edition.id}-${fixture.snapshotSuffix}.json`,
    );
    assert.ok(retained, 'The exact previously published presentation remains selectable.');
    const raw = await readFile(new URL(retained.path, root));
    assert.equal(retained.sha256, fixture.snapshotSha256);
    assert.equal(createHash('sha256').update(raw).digest('hex'), fixture.snapshotSha256);
    assert.equal(raw.length, retained.bytes);
    const { snapshot } = await validateRetainedPresentation(raw.toString('utf8'), { edition });
    assert.equal(snapshot.catalog.editions[0].revision, fixture.oldEditionRevision);
    const changedPayloads = [];
    for (const descriptor of snapshot.catalog.campaigns) {
      const beforeSource = snapshot.files.find((file) => file.path === descriptor.sourcePath).data;
      const afterSource = afterFiles.get(descriptor.sourcePath);
      assert.deepEqual(
        createRewardMissionBindings(afterSource),
        createRewardMissionBindings(beforeSource),
        `${descriptor.id}: every authored route and difficulty keeps its exact gameplay identity.`,
      );
      const oldRewards = snapshot.files.find((file) => file.path === descriptor.rewardPath).data;
      const currentRewards = afterFiles.get(descriptor.rewardPath);
      assert.deepEqual(
        currentRewards.map((item) => item.id),
        oldRewards.map((item) => item.id),
      );
      for (const before of oldRewards) {
        const after = currentRewards.find((item) => item.id === before.id);
        const oldPayloads = before.payloads.map(correctedIllustrationCaption);
        assert.deepEqual(
          after.requirements,
          before.requirements,
          `${before.id}: no finish line moves.`,
        );
        assert.deepEqual(after.payloads.slice(0, oldPayloads.length), oldPayloads);
        const additions = after.payloads.slice(oldPayloads.length);
        if (before.id === fixture.missionId + '-discovery') {
          assert.equal(dataIdentity(before), fixture.rewardIdentity);
          assert.equal(before.revision, fixture.oldRewardRevision);
          assert.equal(after.revision, String(Number(before.revision) + 1));
          assert.deepEqual(
            additions.map(({ id, type }) => ({ id, type })),
            fixture.addedPayloads,
          );
          assert.deepEqual(additions, fixture.createAdditions(afterSnapshot.catalog.assets));
          changedPayloads.push(...additions.map((item) => item.id));
          const addedRefs = additions.length
            ? completionRewardAssetReferences([{ ...after, payloads: additions }])
            : [];
          const currentDescriptor = afterSnapshot.catalog.campaigns.find(
            (item) => item.id === descriptor.id,
          );
          for (const ref of addedRefs) {
            assert(
              currentDescriptor.assetIds.includes(ref.assetId),
              'Added media is explicitly selected.',
            );
            const asset = afterSnapshot.catalog.assets.find((item) => item.id === ref.assetId);
            assert.equal(asset?.sha256, ref.sha256);
            assert.equal(asset?.approved, true);
            assert.equal(asset?.publication, 'public');
          }
        } else assert.deepEqual(additions, [], `${before.id}: no unrelated payload was appended.`);
        const payloadsChanged = dataIdentity(after.payloads) !== dataIdentity(before.payloads);
        assert.equal(
          after.revision,
          payloadsChanged ? String(Number(before.revision) + 1) : before.revision,
          `${before.id}: changed payloads advance exactly once; untouched definitions retain their revisions.`,
        );
        assert.deepEqual(
          { ...after, revision: before.revision, payloads: before.payloads },
          before,
          `${before.id}: scope, teaser, requirements and other authored promises stay exact.`,
        );
      }
    }
    assert.deepEqual(
      changedPayloads,
      fixture.addedPayloads.map((item) => item.id),
    );

    const descriptor = snapshot.catalog.campaigns.find((item) => item.id === fixture.campaignId);
    const rewardIds = [fixture.missionId + '-discovery', fixture.campaignId + '-finale'];
    const oldDefinitions = snapshot.files
      .find((file) => file.path === descriptor.rewardPath)
      .data.filter((item) => rewardIds.includes(item.id));
    const currentDefinitions = afterFiles
      .get(descriptor.rewardPath)
      .filter((item) => rewardIds.includes(item.id));
    const context = {
      editionId: edition.id,
      brandId: edition.brandId,
      campaignIds: [fixture.campaignId],
      clears: {},
      learning: [],
      mastery: [],
    };
    const promised = reconcileEarnedRewards(oldDefinitions, context);
    const upgraded = reconcileEarnedRewards(
      currentDefinitions,
      context,
      validateRewardState(JSON.parse(JSON.stringify(promised.state)), { editionId: edition.id }),
    );
    assert.deepEqual(upgraded.state.promises, oldDefinitions);
    assert.deepEqual(upgraded.granted, []);
    const finale = oldDefinitions.find((item) => item.scope.kind === 'campaign');
    assert.equal(finale.requirements.missions.length, 6);
    const accept = (mission) => {
      context.clears[mission.missionId] = {
        runId: `accepted-${mission.missionId}`,
        ...mission.bindings.find((binding) => binding.difficulty === 'standard'),
      };
    };
    finale.requirements.missions
      .filter((item) => item.missionId !== fixture.missionId)
      .forEach(accept);
    assert.equal(
      reconcileEarnedRewards(currentDefinitions, context, upgraded.state).granted.length,
      0,
      'The finale and pilot reward remain locked while the required pilot mission is missing.',
    );
    accept(finale.requirements.missions.find((item) => item.missionId === fixture.missionId));
    const earned = reconcileEarnedRewards(currentDefinitions, context, upgraded.state);
    assert.equal(earned.granted.length, 2);
    for (const receipt of earned.granted)
      assert.deepEqual(
        receipt.definition,
        oldDefinitions.find((item) => item.id === receipt.definition.id),
      );
    const restored = validateRewardState(JSON.parse(JSON.stringify(earned.state)), {
      editionId: edition.id,
    });
    assert.deepEqual(reconcileEarnedRewards(currentDefinitions, context, restored).state, restored);
    assert.equal(reconcileEarnedRewards(currentDefinitions, context, restored).granted.length, 0);
    const newcomer = reconcileEarnedRewards(currentDefinitions, context);
    assert.equal(newcomer.granted.length, 2);
    assert.deepEqual(
      newcomer.granted.find((item) => item.definition.scope.kind === 'mission').definition,
      currentDefinitions.find((item) => item.scope.kind === 'mission'),
    );
  });
