import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  classicDemoSourcePaths,
  journeyDemoSourcePaths,
  simDemoSourcePaths,
  SIM_DEMO_INDEX,
  SIM_DEMO_RUNTIME_PATHS,
} from './demo-native-dependencies.mjs';
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

function simFixture() {
  const entries = [
    entry(SIM_DEMO_INDEX, { format: 'SimDemoCatalog.v1', entries: [{ file: 'course-acro.json' }] }),
    entry('optional-practice/civilian-fpv/demo-data/course-acro.json', { recording: 'course' }),
    ...SIM_DEMO_RUNTIME_PATHS.map((name) => ({
      name,
      bytes: Buffer.from(`export const name = ${JSON.stringify(name)};`),
    })),
    entry('optional-practice/civilian-fpv/demo-data/coverage.json', { diagnostic: true }),
    entry('optional-practice/unrelated/large.json', { unrelated: true }),
    entry('optional-practice/fpv-worlds/native.json', { native: true }),
    entry('optional-practice/fpv-worlds/service-worker.js', { worker: true }),
  ];
  const bundledPackages = [
    {
      packageId: 'fpv-worlds',
      files: [{ path: 'optional-practice/fpv-worlds/native.json' }],
      workerPath: 'optional-practice/fpv-worlds/service-worker.js',
    },
  ];
  return { entries, bundledPackages, excluded: new Set(entries.map((item) => item.name)) };
}

test('the visible demo selection owns indexed SIM bodies and its exact bridge while reusing the named simulator', async () => {
  const f = simFixture();
  const excludedBefore = [...f.excluded];
  const catalogue = await buildOfflineContent(f.entries, f.excluded, '1.0.0', {
    bundledPackages: f.bundledPackages,
  });
  const demo = catalogue.groups.find((group) => group.id === 'extras:demo');
  assert.deepEqual(demo.requires, ['shared', 'extras:sim-fpv']);
  assert.equal(demo.hidden, undefined);
  assert.deepEqual(new Set(demo.files), simDemoSourcePaths(f.entries));
  const selected = downloadFiles(catalogue, ['extras:demo']).map((file) => file.path);
  for (const name of [
    ...simDemoSourcePaths(f.entries),
    ...f.bundledPackages[0].files.map((file) => file.path),
    f.bundledPackages[0].workerPath,
  ])
    assert.ok(selected.includes(name), name);
  assert.ok(!selected.includes('optional-practice/unrelated/large.json'));
  assert.ok(!selected.includes('optional-practice/civilian-fpv/demo-data/coverage.json'));
  assert.deepEqual(
    [...f.excluded],
    excludedBefore,
    'The optional demo fix does not promote bodies into core.',
  );
  assert.equal(catalogue.groups.find((group) => group.id === 'extras:practice').hidden, true);
  assert.ok(
    !downloadFiles(catalogue, gameplaySelection(catalogue, { all: true })).some((file) =>
      simDemoSourcePaths(f.entries).has(file.path),
    ),
  );
});

test('SIM demo selection fails closed on missing owners, missing bridge/body, ambiguous entries and unsafe catalog paths', async () => {
  const noOwner = simFixture();
  await assert.rejects(
    buildOfflineContent(noOwner.entries, noOwner.excluded, '1.0.0'),
    /named simulator/,
  );
  for (const path of [
    ...SIM_DEMO_RUNTIME_PATHS,
    'optional-practice/civilian-fpv/demo-data/course-acro.json',
  ]) {
    const f = simFixture();
    assert.throws(
      () => simDemoSourcePaths(f.entries.filter((item) => item.name !== path)),
      /offline dependency/,
    );
  }
  for (const change of [
    (f) => f.entries.push(f.entries[0]),
    (f) => f.entries.push(f.entries[1]),
    (f) => (f.entries[1].bytes = Buffer.alloc(0)),
    (f) =>
      (f.entries[0].bytes = Buffer.from(
        JSON.stringify({ format: 'Other', entries: [{ file: 'course-acro.json' }] }),
      )),
    ...[
      '../outside.json',
      'https://example.test/a.json',
      'index.json',
      'coverage.json',
      'course-acro.json?x=1',
      'course-acro.json#x',
      '',
    ].map(
      (file) => (f) =>
        (f.entries[0].bytes = Buffer.from(
          JSON.stringify({ format: 'SimDemoCatalog.v1', entries: [{ file }] }),
        )),
    ),
    (f) =>
      (f.entries[0].bytes = Buffer.from(
        JSON.stringify({
          format: 'SimDemoCatalog.v1',
          entries: [{ file: 'course-acro.json' }, { file: 'course-acro.json' }],
        }),
      )),
  ]) {
    const f = simFixture();
    change(f);
    assert.throws(() => simDemoSourcePaths(f.entries), /SIM demo/);
  }
  const f = simFixture();
  f.excluded.delete(SIM_DEMO_RUNTIME_PATHS[0]);
  await assert.rejects(
    buildOfflineContent(f.entries, f.excluded, '1.0.0', { bundledPackages: f.bundledPackages }),
    /remain an optional/,
  );
  assert.deepEqual(
    simDemoSourcePaths([]),
    new Set(),
    'Reduced builds do not invent a SIM dependency.',
  );
});

function journeyFixture(row) {
  const picture = {
    name: 'game/content-design/assets/demo.png',
    bytes: Buffer.from('exact picture'),
  };
  const unused = {
    name: 'game/content-design/assets/unrelated.png',
    bytes: Buffer.from('unrelated picture'),
  };
  const asset = (item, id) => ({
    id,
    path: item.name.slice(5),
    bytes: item.bytes.length,
    sha256: createHash('sha256').update(item.bytes).digest('hex'),
  });
  return [
    entry('game/demo-modes/solo-builtins-index.mjs', { codeOwnedIndex: row }),
    entry(`game/demo-data/catalog.${row.catalogGroup}.json`, {
      clips: [{ id: row.id, campaignKey: row.campaignKey, levelId: row.levelId }],
    }),
    entry(`game/content-design/runtime/${row.routeId}.json`, {
      id: row.routeId,
      source: {
        missions: [{ id: row.levelId, presentation: { backgroundAssetId: 'shown' } }],
        assets: [asset(picture, 'shown'), asset(unused, 'unused')],
      },
    }),
    picture,
    unused,
  ];
}

test('Journey demos share only exact referenced route and picture bodies, without archive or Versus package dependencies', async () => {
  const { SOLO_BUILTIN_DEMO_INDEX: index } = await import(
    '../game/demo-modes/solo-builtins-index.mjs'
  );
  const row = index[0],
    entries = journeyFixture(row);
  const paths = await journeyDemoSourcePaths(entries);
  assert.deepEqual(
    [...paths].sort(),
    entries
      .filter((item) => !item.name.endsWith('/unrelated.png'))
      .map((item) => item.name)
      .sort(),
  );
  const excluded = new Set(
    entries
      .filter((item) => item.name.includes('/runtime/') || item.name.endsWith('.png'))
      .map((item) => item.name),
  );
  const catalogue = await buildOfflineContent(entries, excluded, '1.0.0');
  const demo = catalogue.groups.find((group) => group.id === 'extras:demo');
  assert.deepEqual(demo.requires, ['shared']);
  assert.deepEqual(
    demo.files.sort(),
    [
      `game/content-design/runtime/${row.routeId}.json`,
      'game/content-design/assets/demo.png',
    ].sort(),
  );
  assert.ok(
    !downloadFiles(catalogue, ['extras:demo']).some((file) => file.path.endsWith('/unrelated.png')),
  );
  for (const mutate of [
    (items) => items.splice(2, 1),
    (items) => items.splice(3, 1),
    (items) => (items[3].bytes = Buffer.from('altered')),
    (items) => items.push(items[3]),
    (items) =>
      (items[2].bytes = Buffer.from(JSON.stringify({ id: 'other', source: { missions: [] } }))),
  ]) {
    const items = journeyFixture(row);
    mutate(items);
    await assert.rejects(journeyDemoSourcePaths(items), /Journey demo/);
  }
  await assert.rejects(
    journeyDemoSourcePaths(entries, { index: [row, row] }),
    /unique authored route/,
  );
  await assert.rejects(journeyDemoSourcePaths(entries, { index: [] }), /unique authored route/);
  assert.deepEqual(await journeyDemoSourcePaths([]), new Set());
});

test('all current indexed SIM recordings have offline bodies and the bridge is the only addition to native package module ownership', async () => {
  const { OPTIONAL_PACKAGE_POLICIES } = await import('../publishing/optional-package-policy.mjs');
  const { parse } = await import('../publishing/vendor/acorn-8.18.0.mjs');
  const { posix } = await import('node:path');
  const policy = OPTIONAL_PACKAGE_POLICIES['fpv-worlds'];
  const native = new Set([
    ...policy.localFiles.map((name) => policy.root + name),
    ...policy.sharedFiles,
  ]);
  const read = async (name) => ({
    name,
    bytes: await readFile(new URL('../' + name, import.meta.url)),
  });
  const index = await read(SIM_DEMO_INDEX),
    catalog = JSON.parse(index.bytes);
  const entries = [
    index,
    ...(await Promise.all(
      [
        ...SIM_DEMO_RUNTIME_PATHS,
        ...catalog.entries.map((row) => 'optional-practice/civilian-fpv/demo-data/' + row.file),
      ].map(read),
    )),
  ];
  assert.equal(
    simDemoSourcePaths(entries).size,
    catalog.entries.length + SIM_DEMO_RUNTIME_PATHS.length + 1,
  );
  const queue = ['game/demo-modes/sim.mjs'],
    seen = new Set(),
    additional = new Set();
  while (queue.length) {
    const name = queue.shift();
    if (seen.has(name) || native.has(name)) continue;
    seen.add(name);
    if (name.startsWith('optional-practice/')) additional.add(name);
    if (name !== 'game/demo-modes/sim.mjs' && !name.startsWith('optional-practice/')) continue;
    const ast = parse((await read(name)).bytes.toString(), {
      ecmaVersion: 'latest',
      sourceType: 'module',
    });
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (
        [
          'ImportDeclaration',
          'ExportNamedDeclaration',
          'ExportAllDeclaration',
          'ImportExpression',
        ].includes(node.type) &&
        typeof node.source?.value === 'string' &&
        node.source.value.startsWith('.')
      )
        queue.push(posix.normalize(posix.join(posix.dirname(name), node.source.value)));
      for (const value of Object.values(node))
        if (Array.isArray(value)) value.forEach(walk);
        else if (value && typeof value === 'object') walk(value);
    };
    walk(ast);
  }
  assert.deepEqual([...additional].sort(), [...SIM_DEMO_RUNTIME_PATHS].sort());
  assert.ok(
    SIM_DEMO_RUNTIME_PATHS.every((name) => !native.has(name)),
    'The standalone simulator dependency policy remains unchanged.',
  );
});

test('the complete shipped Journey demo inventory resolves exact full-source snapshots and all selected pictures', async () => {
  const { SOLO_BUILTIN_DEMO_INDEX: index } = await import(
    '../game/demo-modes/solo-builtins-index.mjs'
  );
  const { loadAuthoredJourneyRoute } = await import('../game/content-design/route-loader.mjs');
  const read = async (name) => ({
    name,
    bytes: await readFile(new URL('../' + name, import.meta.url)),
  });
  const entries = await Promise.all(
    [
      'game/demo-modes/solo-builtins-index.mjs',
      'game/demo-data/catalog.journey-current.json',
      'game/demo-data/catalog.journey-archive.json',
    ].map(read),
  );
  const pictures = new Set();
  const routeIds = [...new Set(index.map((row) => row.routeId))];
  for (const id of routeIds) {
    const route = await loadAuthoredJourneyRoute(id, { fullSource: true });
    entries.push(entry(`game/content-design/runtime/${id}.json`, route));
    for (const row of index.filter((row) => row.routeId === id)) {
      const mission = route.source.missions.find((mission) => mission.id === row.levelId);
      assert.ok(mission);
      const assetId = mission.presentation?.backgroundAssetId;
      if (assetId) {
        const asset = route.source.assets.find((asset) => asset.id === assetId);
        assert.ok(asset);
        pictures.add('game/' + asset.path);
      }
    }
  }
  entries.push(...(await Promise.all([...pictures].map(read))));
  const paths = await journeyDemoSourcePaths(entries);
  assert.equal(paths.size, 3 + routeIds.length + pictures.size);
  assert.deepEqual(paths, new Set(entries.map((item) => item.name)));
  const clips = entries
    .filter((item) => item.name.startsWith('game/demo-data/'))
    .flatMap((item) => JSON.parse(item.bytes).clips);
  assert.equal(clips.length, index.length);
});
