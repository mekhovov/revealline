import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  CURRICULUM_LISTENING_CAMPAIGN,
  CURRICULUM_LISTENING_FILES,
  CURRICULUM_LISTENING_ASSET_IDS,
  createCurriculumListeningContent,
} from '../company-campaigns/curriculum-listening.mjs';
import { inspectMP3 } from '../mp3.mjs';
import { inspectRewardMediaBytes } from '../rewards/media-format.mjs';
import {
  validateCompletionReward,
  completionRewardAssetReferences,
  projectRewardProgress,
  reconcileEarnedRewards,
  validateRewardState,
} from '../rewards/model.mjs';
import { validateRetainedPresentation } from '../editions/retained-presentation.mjs';
import { createRewardMissionBindings } from '../rewards/bindings.mjs';
import { dataIdentity } from '../data-json.mjs';
import { rewardPresentationItems } from '../rewards/audio-groups.mjs';

const root = new URL('../../', import.meta.url);
const json = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const files = CURRICULUM_LISTENING_FILES.map((row) => ({
  ...row,
  approved: true,
  publication: 'public',
  dependencies: [],
}));
const content = () => createCurriculumListeningContent(CURRICULUM_LISTENING_CAMPAIGN, files);

test('the listening pair reuses exact cleared game audio with bounded MP3 frames and bilingual text bytes', async () => {
  const soundtrack = await json('game/content/soundtrack-catalogue.json');
  let total = 0;
  for (const file of files) {
    const bytes = await readFile(new URL(file.path, root));
    assert.equal(bytes.length, file.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
    total += bytes.length;
    if (file.path.endsWith('.mp3')) {
      const track = soundtrack.tracks.find((row) => row.asset.sha256 === file.sha256);
      assert(track, 'Each recording is already in the game soundtrack catalogue.');
      assert.equal(track.policy.redistribute, 'allowed');
      assert.equal(track.policy.offlineCache, 'allowed');
      assert.equal(track.rights.license, 'CC0 1.0 Universal');
      assert.equal(track.artist, '3xBlast');
      const metadata = await inspectMP3(new Blob([bytes], { type: 'audio/mpeg' }));
      assert.deepEqual(metadata, track.asset);
      assert(metadata.durationSeconds < 120);
      assert.equal(metadata.channels, 2);
    } else {
      inspectRewardMediaBytes(file, 'transcript', bytes);
      const text = bytes.toString('utf8');
      assert.match(text, /3xBlast/);
      assert.match(text, /CC0 1.0 Universal/);
      assert.match(text, /https:\/\/opengameart.org\/content\/7-pop-punk-chiptune-tracks/);
      assert.match(text, /Social Drone UA/);
      assert(
        file.id.endsWith('-uk')
          ? /Інструментальна музика/.test(text)
          : /Instrumental music/.test(text),
      );
    }
  }
  assert.equal(total, 3208961);
  assert.equal(files.filter((file) => file.path.endsWith('.mp3')).length, 2);
  assert.equal(files.filter((file) => file.path.endsWith('.txt')).length, 4);
});

test('only the selected campaign gains the optional pair; exact admission and original six-win requirements remain authoritative', async () => {
  const { payloads, audioGroups } = content();
  assert.deepEqual(createCurriculumListeningContent('social-drone-people-workshop', []), {
    payloads: [],
    audioGroups: [],
  });
  assert.throws(
    () => createCurriculumListeningContent(CURRICULUM_LISTENING_CAMPAIGN, files.slice(1)),
    /exact admitted/,
  );
  for (const mutate of [
    (row) => {
      row.sha256 = '0'.repeat(64);
    },
    (row) => {
      row.approved = false;
    },
    (row) => {
      row.publication = 'private';
    },
    (row) => {
      row.path = 'game/unrelated.mp3';
    },
    (row) => {
      row.bytes += 1;
    },
  ]) {
    const wrong = structuredClone(files);
    mutate(wrong[0]);
    assert.throws(
      () => createCurriculumListeningContent(CURRICULUM_LISTENING_CAMPAIGN, wrong),
      /exact admitted/,
    );
  }
  const originals = await json(
    'game/content/company-campaigns/social-drone-community-connections.rewards.json',
  );
  const original = originals.find((row) => row.scope.kind === 'campaign');
  const candidate = validateCompletionReward({
    ...original,
    payloads: [
      ...original.payloads.filter((p) => !payloads.some((next) => next.id === p.id)),
      ...payloads,
    ],
    audioGroups,
  });
  assert.deepEqual(candidate.requirements, original.requirements);
  assert.equal(candidate.requirements.missions.length, 6);
  assert.equal(candidate.requirements.learning.length, 0);
  assert.equal(candidate.id, original.id);
  assert.equal(audioGroups.length, 1);
  const group = rewardPresentationItems(candidate).find((item) => item.kind === 'audio-group');
  assert.deepEqual(
    group.payloads.map((row) => row.id),
    audioGroups[0].payloadIds,
  );
  assert.equal(group.payloads.length, 2);
  assert.equal(Object.hasOwn(audioGroups[0], 'autoplay'), false);
  for (const id of CURRICULUM_LISTENING_ASSET_IDS)
    assert(completionRewardAssetReferences([candidate]).some((ref) => ref.assetId === id));
  for (const locale of ['en', 'uk']) {
    const guide = payloads.find((p) => p.type === 'knowledge').locales[locale];
    assert(guide.paragraphs.some((text) => text.includes('3xBlast')));
    assert(guide.paragraphs.some((text) => text.includes('Social Drone UA')));
  }
});

test('the exact selected Social Drone asset closure plus the pair stays within the existing edition budget', async () => {
  const catalog = await json('game/editions/catalog.json');
  const edition = catalog.editions.find((row) => row.id === 'social-drone-ua');
  const brand = catalog.brands.find((row) => row.id === edition.brandId);
  const assets = new Map([...catalog.assets, ...files].map((row) => [row.id, row]));
  const selected = new Set();
  const add = (id) => {
    if (!id || selected.has(id)) return;
    selected.add(id);
    const asset = assets.get(id);
    assert(asset, 'Every selected dependency must exist: ' + id);
    for (const dependency of asset.dependencies ?? []) add(dependency);
  };
  for (const id of [
    ...brand.assetIds,
    brand.logoAssetId,
    brand.heroAssetId,
    brand.iconAssetId,
    brand.fontAssetId,
  ])
    add(id);
  for (const campaign of catalog.campaigns.filter((row) => edition.campaignIds.includes(row.id)))
    for (const id of campaign.assetIds) add(id);
  CURRICULUM_LISTENING_ASSET_IDS.forEach(add);
  const total = [...selected].reduce((sum, id) => sum + assets.get(id).bytes, 0);
  assert(
    total < 32 * 1024 * 1024,
    `Selected asset bytes ${total} exceed the unchanged 32 MiB cap.`,
  );
});

test('the Social Drone listening update preserves its exact old promise and six distinct wins without a listening requirement', async () => {
  const catalog = await json('game/editions/catalog.json');
  const edition = catalog.editions.find((row) => row.id === 'social-drone-ua');
  const historical = edition.presentationHistory.find(
    (row) => row.path === 'game/editions/retained/social-drone-ua-before-listening-room.json',
  );
  const expectedHash = 'd1637bf018f2197a6e10e6df5a13fe2e8cff807d4c19165258bff331ccc30528';
  assert.equal(
    historical.sha256,
    expectedHash,
    'The frozen pre-listening source cannot be regenerated from newer rewards.',
  );
  const bytes = await readFile(new URL(historical.path, root));
  assert.equal(bytes.length, historical.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expectedHash);
  const { snapshot } = await validateRetainedPresentation(bytes.toString('utf8'), { edition });
  assert.equal(snapshot.catalog.editions[0].revision, 5);
  assert.equal(edition.revision, 6);
  for (const id of CURRICULUM_LISTENING_ASSET_IDS)
    assert.equal(
      snapshot.catalog.assets.some((asset) => asset.id === id),
      false,
    );
  let beforeFinale, afterFinale;
  for (const descriptor of snapshot.catalog.campaigns) {
    const beforeSource = snapshot.files.find((row) => row.path === descriptor.sourcePath).data;
    const afterSource = await json(descriptor.sourcePath);
    assert.deepEqual(
      createRewardMissionBindings(afterSource),
      createRewardMissionBindings(beforeSource),
    );
    const beforeRewards = snapshot.files.find((row) => row.path === descriptor.rewardPath).data;
    const afterRewards = await json(descriptor.rewardPath);
    assert.deepEqual(
      afterRewards.map((row) => row.id),
      beforeRewards.map((row) => row.id),
    );
    for (const before of beforeRewards) {
      const after = afterRewards.find((row) => row.id === before.id);
      if (before.id === CURRICULUM_LISTENING_CAMPAIGN + '-finale') {
        beforeFinale = before;
        afterFinale = after;
        assert.equal(beforeSource.packs[0].revision, '5');
        assert.equal(afterSource.packs[0].revision, '6');
        assert.equal(dataIdentity(before), 'cca8fbfa4d264aa5');
        assert.equal(before.revision, '5');
        assert.equal(after.revision, '6');
        assert.deepEqual(after.payloads.slice(0, before.payloads.length), before.payloads);
        assert.deepEqual(after.payloads.slice(before.payloads.length), content().payloads);
        assert.deepEqual(after.audioGroups, content().audioGroups);
        assert.equal(before.audioGroups, undefined);
        assert.deepEqual(after.requirements, before.requirements);
      } else
        assert.deepEqual(after, before, 'The listening room changes only the selected finale.');
    }
  }
  assert.ok(beforeFinale);
  assert.ok(afterFinale);
  assert.deepEqual(afterFinale.requirements.learning, []);
  assert.deepEqual(afterFinale.requirements.mastery, []);
  assert.deepEqual(
    afterFinale.requirements.missions.map((row) => row.missionId),
    Array.from({ length: 6 }, (_, i) => CURRICULUM_LISTENING_CAMPAIGN + '-0' + (i + 1)),
  );
  const context = {
    editionId: edition.id,
    brandId: edition.brandId,
    campaignIds: [CURRICULUM_LISTENING_CAMPAIGN],
    clears: {},
    learning: [],
    mastery: [],
  };
  const promise = reconcileEarnedRewards([beforeFinale], context).state;
  assert.deepEqual(promise.promises, [beforeFinale]);
  assert.equal(promise.receipts.length, 0);
  const upgrade = reconcileEarnedRewards(
    [afterFinale],
    context,
    validateRewardState(JSON.parse(JSON.stringify(promise)), { editionId: edition.id }),
  );
  assert.deepEqual(upgrade.state.promises, [beforeFinale]);
  for (const mission of afterFinale.requirements.missions)
    context.clears[mission.missionId] = {
      runId: 'accepted-' + mission.missionId,
      ...mission.bindings.find((binding) => binding.difficulty === 'standard'),
    };
  for (const missing of afterFinale.requirements.missions) {
    const partial = structuredClone(context);
    delete partial.clears[missing.missionId];
    assert.equal(projectRewardProgress(afterFinale, partial).eligible, false, missing.missionId);
  }
  const lastOnly = structuredClone(context);
  lastOnly.clears = {
    [afterFinale.requirements.missions.at(-1).missionId]: Object.values(context.clears).at(-1),
  };
  assert.equal(projectRewardProgress(afterFinale, lastOnly).eligible, false);
  assert.equal(projectRewardProgress(afterFinale, context).eligible, true);
  const earned = reconcileEarnedRewards([afterFinale], context, upgrade.state);
  assert.equal(earned.granted.length, 1);
  assert.deepEqual(earned.granted[0].definition, beforeFinale);
  const restored = validateRewardState(JSON.parse(JSON.stringify(earned.state)), {
    editionId: edition.id,
  });
  assert.deepEqual(reconcileEarnedRewards([afterFinale], context, restored).state, restored);
  assert.equal(reconcileEarnedRewards([afterFinale], context, restored).granted.length, 0);
  const newPlayer = reconcileEarnedRewards([afterFinale], context);
  assert.equal(newPlayer.granted.length, 1);
  assert.deepEqual(newPlayer.granted[0].definition, afterFinale);
  assert.deepEqual(newPlayer.granted[0].definition.audioGroups[0].payloadIds, [
    'social-community-listening-jellyfish',
    'social-community-listening-thanks',
  ]);
});
