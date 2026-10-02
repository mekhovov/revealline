import test from 'node:test';
import assert from 'node:assert/strict';
import { addOfflineExperiences } from '../../scripts/offline-experiences.mjs';
import { COMMUNITY_ROUTES } from '../community-routes.mjs';
import { downloadFiles } from '../download-catalogue.mjs';
import { gameplaySelection } from '../offline-download-session.mjs';
import { restoredGameplaySelection } from '../game-updates.mjs';

const file = (path, index) => ({
  path,
  kind: 'gameplay',
  bytes: 1,
  sha256: index.toString(16).padStart(64, '0'),
});
const group = (id, files = [], more = {}) => ({
  id,
  title: id,
  kind: 'gameplay',
  modes: ['solo', 'versus', 'team'],
  requires: [],
  files,
  ...more,
});
test('every public community owns complete mode dependencies with shared hash reuse', () => {
  const files = [file('versus.mjs', 1), file('team.mjs', 2), file('picture.png', 3)];
  const groups = [
    group('shared'),
    group('runtime:versus', ['versus.mjs']),
    group('runtime:team', ['team.mjs']),
  ];
  for (const route of COMMUNITY_ROUTES)
    for (const id of route.editionIds) groups.push(group(`company:${id}`, ['picture.png']));
  addOfflineExperiences(groups, files);
  const catalogue = { format: 'revealline-offline-content.v2', groups, files };
  const communities = groups.filter((item) => item.category === 'community');
  assert.equal(communities.length, COMMUNITY_ROUTES.length);
  for (const item of communities) assert.equal(downloadFiles(catalogue, [item.id]).length, 3);
  assert.equal(
    downloadFiles(
      catalogue,
      communities.map((item) => item.id),
    ).length,
    3,
  );
  assert.throws(() => addOfflineExperiences([group('company:coupa-all')], []), /Incomplete/);
});
test('SIM follows admitted dependencies outside its directory and fails for a missing dependency', () => {
  const files = [
    file('optional-practice/fpv-worlds/index.html', 1),
    file('game/optional-helper.mjs', 2),
    file('optional-practice/fpv-worlds/worker.js', 3),
  ];
  const packages = [
    {
      packageId: 'fpv-worlds',
      files: [...files.slice(0, 2), file('core.mjs', 4)],
      workerPath: files[2].path,
    },
  ];
  const groups = [group('shared'), group('extras:practice')];
  addOfflineExperiences(groups, files, packages, new Set(['core.mjs']));
  const catalogue = { format: 'revealline-offline-content.v2', groups, files };
  assert.deepEqual(
    downloadFiles(catalogue, ['extras:sim-fpv']).map((item) => item.path),
    files.map((item) => item.path),
  );
  assert.equal(downloadFiles(catalogue, ['extras:practice']).length, 3);
  assert.throws(
    () => addOfflineExperiences([group('shared')], files, packages, new Set()),
    /Incomplete/,
  );
});
test('all gameplay preserves explicit SIM and community choices through an update without music', () => {
  const catalogue = {
    groups: [
      group('base'),
      group('shared'),
      group('extras:sim-fpv', [], { current: false }),
      group('community:coupa', [], { current: false }),
      { id: 'music:one', kind: 'soundtrack' },
    ],
  };
  const ids = gameplaySelection(catalogue, {
    all: true,
    selected: ['extras:sim-fpv', 'community:coupa', 'music:one'],
  });
  assert.deepEqual(ids, ['base', 'shared', 'extras:sim-fpv', 'community:coupa']);
  const retained = restoredGameplaySelection(catalogue, {
    edition: 'https://example.test/',
    updating: true,
    active: { scope: 'https://example.test/', selection: ids, allGameplay: true },
  });
  assert.deepEqual(gameplaySelection(catalogue, retained), ids);
});
