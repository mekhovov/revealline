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

test('native Overflight and Snake use the main PWA core and share one recorded-effects download', () => {
  const core = new Set([
    'game/overflight/play.html',
    'game/overflight/raid.html',
    'game/snake/play.html',
    'game/snake/index.html',
  ]);
  const effects = ['rotor-start.wav', 'human-reaction-1.wav', 'destroy-heavy.wav'].map(
    (name, index) => file(`game/audio/effects/${name}`, index + 1),
  );
  const groups = [
    group('base'),
    group('shared'),
    group(
      'extras:spatial-audio',
      effects.map(({ path }) => path),
      { current: false },
    ),
    group('tooling:workshop', [], { category: 'tooling', current: false }),
    { id: 'music:one', kind: 'soundtrack', current: false, files: [], requires: [] },
  ];
  addOfflineExperiences(groups, effects, [], core);
  const catalogue = { format: 'revealline-offline-content.v2', groups, files: effects };
  const experiences = groups.filter((item) => item.category === 'experience');
  assert.deepEqual(
    experiences.map(({ id }) => id),
    ['extras:overflight', 'extras:snake'],
  );
  assert.deepEqual(
    experiences.map(({ launchPath }) => launchPath),
    ['game/overflight/play.html', 'game/snake/play.html'],
  );
  for (const experience of experiences) {
    assert.deepEqual(experience.files, [], 'core files keep one verified owner');
    assert.deepEqual(experience.requires, ['shared', 'extras:spatial-audio']);
    assert.equal(experience.current, true);
    assert.ok(experience.titleKey);
    assert.deepEqual(downloadFiles(catalogue, [experience.id]), effects);
  }
  const ids = gameplaySelection(catalogue, { all: true });
  assert.ok(experiences.every(({ id }) => ids.includes(id)));
  assert.deepEqual(downloadFiles(catalogue, ids), effects, 'recordings downloaded once');
  assert.ok(!ids.includes('tooling:workshop'));
  assert.ok(!ids.includes('music:one'));
  assert.deepEqual(
    restoredGameplaySelection(catalogue, {
      edition: 'https://example.test/',
      updating: true,
      active: { scope: 'https://example.test/', selection: ['extras:overflight', 'extras:snake'] },
    }).selected,
    ['extras:overflight', 'extras:snake'],
  );
});

test('native experience admission rejects partial or optional player hosts and omits absent modes', () => {
  for (const name of [
    'game/overflight/play.html',
    'game/overflight/raid.html',
    'game/snake/play.html',
  ]) {
    assert.throws(
      () => addOfflineExperiences([group('shared')], [], [], new Set([name])),
      /Incomplete native offline experience/,
    );
    assert.throws(
      () => addOfflineExperiences([group('shared')], [file(name, 1)], [], new Set()),
      /Incomplete native offline experience/,
    );
  }
  const groups = [group('shared')];
  addOfflineExperiences(groups, [], [], new Set(['game/index.html']));
  assert.equal(groups.length, 1);
});

test('legacy flight-practice selections do not silently acquire unrelated native modes', () => {
  const files = [
    file('optional-practice/fpv-worlds/index.html', 1),
    file('optional-practice/fpv-worlds/worker.js', 2),
  ];
  const groups = [group('shared'), group('extras:practice')];
  addOfflineExperiences(
    groups,
    files,
    [{ packageId: 'fpv-worlds', files: files.slice(0, 1), workerPath: files[1].path }],
    new Set([
      'game/overflight/play.html',
      'game/overflight/raid.html',
      'game/snake/play.html',
      'game/snake/index.html',
    ]),
  );
  assert.deepEqual(groups.find(({ id }) => id === 'extras:practice').requires, ['extras:sim-fpv']);
});
