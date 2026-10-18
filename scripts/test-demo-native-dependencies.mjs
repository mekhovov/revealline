import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { classicDemoSourcePaths } from './demo-native-dependencies.mjs';
import { buildOfflineContent } from './offline-content.mjs';
import { applyPublicationProfile } from './game-cli.mjs';
import { downloadFiles } from '../game/download-catalogue.mjs';
import { gameplaySelection } from '../game/offline-download-session.mjs';

const entry = (name, value) => ({ name, bytes: Buffer.from(JSON.stringify(value)) });
function fixture() {
  const pack = entry('game/content/packs/old.json', { campaign: 'old' });
  const unused = entry('game/content/packs/unrelated.json', { campaign: 'unrelated' });
  const mission = (item, id) => ({
    id,
    source: 'archived',
    packId: id,
    campaignKey: `${id}/1/identity`,
    levelId: `${id}-level`,
    modes: ['solo', 'versus'],
    sourceFile: {
      path: item.name,
      bytes: item.bytes.length,
      sha256: createHash('sha256').update(item.bytes).digest('hex'),
    },
  });
  const oldMission = mission(pack, 'old');
  return [
    pack,
    unused,
    entry('game/content/packs/archive-catalog.json', {
      packs: [{ id: 'old' }, { id: 'unrelated' }],
    }),
    entry('game/content/mission-library-index.json', {
      missions: [oldMission, mission(unused, 'unrelated')],
    }),
    entry('game/demo-data/catalog.json', {
      clips: [
        {
          id: 'old-demo',
          campaignKey: oldMission.campaignKey,
          levelId: oldMission.levelId,
        },
      ],
    }),
    entry('game/demo-data/old.replay.json', { recording: true }),
  ];
}

test('demo ownership retains exact native archive sources without exposing or installing archives', async () => {
  const entries = fixture();
  const excluded = new Set([
    'game/content/packs/old.json',
    'game/content/packs/unrelated.json',
    'game/demo-data/old.replay.json',
  ]);
  const catalogue = await buildOfflineContent(entries, excluded, '1.0.0');
  const demo = catalogue.groups.find((group) => group.id === 'extras:demo');
  assert.ok(demo.files.includes('game/content/packs/old.json'));
  assert.ok(!demo.files.includes('game/content/packs/unrelated.json'));
  assert.deepEqual(demo.requires, ['shared']);
  assert.ok(
    !downloadFiles(catalogue, gameplaySelection(catalogue, { all: true })).some((file) =>
      file.path.includes('/packs/'),
    ),
    'Optional demo ownership cannot add archived packs to ordinary all-current downloads.',
  );
  applyPublicationProfile(entries, catalogue, 'main-pages', null);
  assert.ok(entries.some((item) => item.name === 'game/content/packs/old.json'));
  assert.ok(!entries.some((item) => item.name === 'game/content/packs/unrelated.json'));
  assert.ok(catalogue.groups.every((group) => group.category !== 'archive'));
  assert.equal(catalogue.missions.length, 0, 'Archived ordinary discovery remains omitted.');
  assert.deepEqual(
    downloadFiles(catalogue, ['extras:demo'])
      .map((file) => file.path)
      .sort(),
    ['game/content/packs/old.json', 'game/demo-data/old.replay.json'],
  );
});

test('native dependency matching rejects missing, ambiguous, altered and unavailable source identities', () => {
  for (const change of [
    'missing-index',
    'missing-match',
    'duplicate-match',
    'altered-body',
    'absent-body',
  ]) {
    let entries = fixture();
    const index = entries.find((item) => item.name.endsWith('mission-library-index.json'));
    const data = JSON.parse(index.bytes);
    if (change === 'missing-index') entries = entries.filter((item) => item !== index);
    if (change === 'missing-match') {
      data.missions[0].campaignKey = 'another';
      index.bytes = Buffer.from(JSON.stringify(data));
    }
    if (change === 'duplicate-match') {
      data.missions.push(data.missions[0]);
      index.bytes = Buffer.from(JSON.stringify(data));
    }
    if (change === 'altered-body') entries[0].bytes = Buffer.from('different');
    if (change === 'absent-body') entries = entries.slice(1);
    assert.throws(() => classicDemoSourcePaths(entries), /Demo|demo/, change);
  }
});

test('recordings without the ordinary demo catalog do not invent native dependencies', () => {
  assert.deepEqual(
    classicDemoSourcePaths([entry('game/demo-data/fixture.replay.json', {})]),
    new Set(),
  );
});

test('current reviewed and qualified catalogs resolve the exact authored native pack inventory', async () => {
  const read = async (name) => ({
    name,
    bytes: await readFile(new URL(`../${name}`, import.meta.url)),
  });
  const index = await read('game/content/mission-library-index.json');
  const catalog = await read('game/demo-data/catalog.json');
  const missions = JSON.parse(index.bytes).missions;
  const clips = JSON.parse(catalog.bytes).clips;
  const matched = clips.map((clip) =>
    missions.find(
      (mission) => mission.campaignKey === clip.campaignKey && mission.levelId === clip.levelId,
    ),
  );
  assert.ok(matched.every(Boolean));
  const paths = [...new Set(matched.map((mission) => mission.sourceFile.path))];
  const entries = [index, catalog, ...(await Promise.all(paths.map(read)))];
  assert.deepEqual([...classicDemoSourcePaths(entries)].sort(), paths.sort());
  const requiredArchivePaths = matched
    .filter((mission) => mission.source === 'archived')
    .map((mission) => mission.sourceFile.path);
  assert.ok(requiredArchivePaths.length > 0);
  assert.ok(requiredArchivePaths.every((name) => classicDemoSourcePaths(entries).has(name)));
});
