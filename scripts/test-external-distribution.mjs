import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, realpath, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { JOURNEY_ART_CANDIDATES } from '../game/content-design/journey-art.mjs';
import { addOfflineEntries, buildProject, readBuildConfig } from './game-cli.mjs';
import {
  readExternalDistributionEntries,
  validateExternalDistributionConfig,
} from './external-distribution.mjs';
import { EXTERNAL_CATALOG } from '../game/external-chapter-catalog.mjs';
import { SOURCE_EXTERNAL_CHAPTERS } from '../game/external-chapter-source.mjs';
import { downloadFiles } from '../game/download-catalogue.mjs';
import {
  preparePack,
  emptyPackLibrary,
  installPack,
  exportPackLibrary,
  PACK_LIMITS,
} from '../game/packs.mjs';
const source = fileURLToPath(new URL('../', import.meta.url));
const option = {
  format: 'revealline-external-distribution.v1',
  catalog: 'game/content/external-worlds.json',
};
const sha = (b) => createHash('sha256').update(b).digest('hex');
const externalAuthoringSource =
  /^authoring\/library\/(route-worlds|external-chapter-pilot|ukraine-route-art|retro-route-art|spend-route-art|sentinel-circuit|sentinel-circuit-art|sentinel-circuit-external|sentinel-theme-art|sentinel-theme-chapters|fracture-lines|fracture-lines-art|fracture-lines-chapter|fracture-ukraine-art|fracture-retro-art|fracture-coupa-art|fracture-theme-chapters|countercurrent-chapters|countercurrent-art)\//;
async function admittedExternalSourcePins(root, config) {
  const pins = new Map();
  for (const name of config.include.filter((name) => externalAuthoringSource.test(name))) {
    const body = await readFile(path.join(root, name));
    pins.set(name, { path: name, bytes: body.length, sha256: sha(body) });
  }
  return pins;
}
function assertExternalSourceMembers(files, pins) {
  const byPath = (a, b) => a.path.localeCompare(b.path);
  assert.deepEqual(
    files.filter((file) => externalAuthoringSource.test(file.path)).sort(byPath),
    [...pins.values()].sort(byPath),
    'Only exact, explicitly admitted external authoring sources may ship',
  );
}
function assertExternalDownloadOwnership(worker, offline, catalogue, chapters) {
  const match = worker.match(/const CONFIG = (\{[^\n]+\});/);
  assert(match, 'The emitted worker must embed its frozen offline configuration');
  const embedded = JSON.parse(match[1]);
  assert.deepEqual(embedded, offline, 'Worker and loose offline metadata must agree exactly');
  const byPath = (a, b) => a.path.localeCompare(b.path);
  for (const chapter of chapters) {
    const expected = [chapter.pack, chapter.media]
      .map(({ path, bytes, sha256 }) => ({
        path,
        bytes,
        sha256,
        kind: 'gameplay',
      }))
      .sort(byPath);
    const paths = expected.map((file) => file.path);
    for (const pin of expected) {
      assert(
        !embedded.files.some((file) => file.path === pin.path),
        'External bodies stay out of core',
      );
      assert(
        !(embedded.optionalPacks || []).some((file) => file.path === pin.path),
        'External bodies stay out of legacy optional packs',
      );
      assert.deepEqual(
        embedded.downloadFiles.filter((file) => file.path === pin.path),
        [pin],
      );
      assert.deepEqual(
        catalogue.files.filter((file) => file.path === pin.path),
        [pin],
      );
    }
    const owner = `chapter:${chapter.id}`;
    const groups = catalogue.groups.filter((group) => group.id === owner);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].kind, 'gameplay');
    assert.deepEqual([...groups[0].files].sort(), paths);
    assert.deepEqual(groups[0].requires, ['shared']);
    for (const name of paths)
      assert.deepEqual(
        catalogue.groups.filter((group) => group.files.includes(name)).map((group) => group.id),
        [owner],
        'Each external body belongs only to its explicit chapter',
      );
    assert(!downloadFiles(catalogue, ['shared']).some((file) => paths.includes(file.path)));
    assert.deepEqual(
      downloadFiles(catalogue, [owner])
        .filter((file) => paths.includes(file.path))
        .sort(byPath),
      expected,
    );
    const missions = catalogue.missions.filter((mission) => mission.packId === chapter.id);
    assert.equal(missions.length, chapter.levels);
    for (const mission of missions) {
      assert.deepEqual(mission.groups, [owner]);
      assert.deepEqual(
        downloadFiles(catalogue, mission.groups)
          .filter((file) => paths.includes(file.path))
          .sort(byPath),
        expected,
      );
    }
  }
}
function assertZipMemberPins(zip, wanted) {
  const counts = new Map();
  let offset = 0;
  while (zip.readUInt32LE(offset) === 0x04034b50) {
    const method = zip.readUInt16LE(offset + 8);
    assert.ok(method === 0 || method === 8);
    const originalBytes = zip.readUInt32LE(offset + 22);
    const bytes = zip.readUInt32LE(offset + 18),
      n = zip.readUInt16LE(offset + 26),
      extra = zip.readUInt16LE(offset + 28),
      start = offset + 30 + n + extra,
      name = zip.subarray(offset + 30, offset + 30 + n).toString();
    if (wanted.has(name)) {
      counts.set(name, (counts.get(name) || 0) + 1);
      const compressed = zip.subarray(start, start + bytes);
      const body =
        method === 8 ? inflateRawSync(compressed, { maxOutputLength: originalBytes }) : compressed;
      assert.equal(body.length, originalBytes);
      assert.equal(body.length, wanted.get(name).bytes);
      assert.equal(sha(body), wanted.get(name).sha256);
    }
    offset = start + bytes;
  }
  assert.equal(zip.readUInt32LE(offset), 0x02014b50);
  assert.equal(counts.size, wanted.size);
  assert([...counts.values()].every((n) => n === 1));
}
async function directory(t) {
  const p = await realpath(await mkdtemp(path.join(os.tmpdir(), 'revealline-external-build-')));
  t.after(() => rm(p, { recursive: true, force: true }));
  return p;
}

test('absent opt-in leaves old builds byte-identical and never reads external source', async (t) => {
  const dir = await directory(t),
    root = path.join(dir, 'source'),
    out = path.join(dir, 'out');
  await mkdir(path.join(root, 'game'), { recursive: true });
  await writeFile(
    path.join(root, 'game/index.html'),
    '<html><head></head><body>Old source</body></html>',
  );
  await writeFile(
    path.join(root, 'game/build-config.json'),
    JSON.stringify({ version: 'fixture', entry: 'game/index.html', include: ['game'] }),
  );
  await buildProject({ root, out });
  const before = await readFile(path.join(out, 'distribution.zip'));
  await mkdir(path.join(root, 'optional'), { recursive: true });
  await writeFile(path.join(root, 'optional', 'media.rlmedia'), 'excluded malformed source');
  await buildProject({ root, out });
  assert.deepEqual(await readFile(path.join(out, 'distribution.zip')), before);
  assert.deepEqual(await readExternalDistributionEntries('/not-present'), []);
  for (const bad of [
    null,
    {},
    { ...option, format: 'revealline-external-distribution.v2' },
    { ...option, catalog: '../external.json' },
    { ...option, extra: true },
  ])
    assert.throws(() => validateExternalDistributionConfig(bad));
});

test('catalog symlink and missing catalog refuse before source compiler import or output creation', async (t) => {
  const dir = await directory(t),
    root = path.join(dir, 'source');
  await mkdir(path.join(root, 'game/content'), { recursive: true });
  await assert.rejects(readExternalDistributionEntries(root, option), /ENOENT/);
  await symlink(path.join(source, option.catalog), path.join(root, option.catalog));
  await assert.rejects(readExternalDistributionEntries(root, option), /symbolic links/);
});

test('explicit Production originals retain exact source pins without shipping neighboring authoring inputs', async (t) => {
  const dir = await directory(t),
    root = path.join(dir, 'source'),
    out = path.join(dir, 'out');
  const admitted = [
    'authoring/library/route-worlds/descriptors/retro.json',
    'authoring/library/retro-route-art/provenance.json',
    'authoring/library/retro-route-art/originals/crosswind-courier.png',
  ];
  const production = await readBuildConfig(source);
  for (const name of admitted) {
    assert(production.include.includes(name));
    await mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await writeFile(path.join(root, name), await readFile(path.join(source, name)));
  }
  const unselected = [
    'authoring/library/route-worlds/build.mjs',
    'authoring/library/route-worlds/descriptors/not-selected.json',
    'authoring/library/retro-route-art/originals/not-selected.png',
    'authoring/library/retro-route-art/.private',
  ];
  for (const name of unselected) await writeFile(path.join(root, name), 'unselected neighbor');
  await mkdir(path.join(root, 'game'), { recursive: true });
  await writeFile(
    path.join(root, 'game/index.html'),
    '<html><head></head><body>Fixture</body></html>',
  );
  await writeFile(
    path.join(root, 'game/build-config.json'),
    JSON.stringify({
      version: 'fixture',
      entry: 'game/index.html',
      include: ['game', ...admitted],
    }),
  );
  const expected = await admittedExternalSourcePins(root, await readBuildConfig(root));
  await buildProject({ root, out });
  const manifest = JSON.parse(await readFile(path.join(out, 'manifest.json')));
  assertExternalSourceMembers(manifest.files, expected);
  const zip = await readFile(path.join(out, 'distribution.zip'));
  assertZipMemberPins(zip, expected);
  for (const name of admitted)
    assert.deepEqual(await readFile(path.join(out, name)), await readFile(path.join(source, name)));
  for (const name of unselected) {
    assert(!manifest.files.some((file) => file.path === name));
    await assert.rejects(readFile(path.join(out, name)), /ENOENT/);
    assert.throws(() =>
      assertExternalSourceMembers(
        [...manifest.files, { path: name, bytes: 1, sha256: sha(Buffer.from('x')) }],
        expected,
      ),
    );
  }
  const missing = admitted[0];
  assert.throws(() =>
    assertExternalSourceMembers(
      manifest.files.filter((file) => file.path !== missing),
      expected,
    ),
  );
  assert.throws(() =>
    assertExternalSourceMembers([...manifest.files, expected.get(missing)], expected),
  );
  const original = await readFile(path.join(source, admitted[2])),
    altered = Buffer.from(original);
  altered[altered.length - 1] ^= 1;
  assert.equal(altered.length, original.length);
  assert.throws(() =>
    assertExternalSourceMembers(
      manifest.files.map((file) =>
        file.path === admitted[2] ? { ...file, sha256: sha(altered) } : file,
      ),
      expected,
    ),
  );
  // The optional fixture uses the original STORE contract, so changing one
  // payload byte leaves offsets and lengths valid while violating the source pin.
  const originalOffset = zip.indexOf(original);
  assert(originalOffset >= 0);
  const alteredZip = Buffer.from(zip);
  alteredZip[originalOffset + original.length - 1] ^= 1;
  assert.throws(() => assertZipMemberPins(alteredZip, expected));
  assert.throws(() =>
    assertZipMemberPins(
      zip,
      new Map([...expected, [unselected[0], { bytes: 1, sha256: '0'.repeat(64) }]]),
    ),
  );
});

test('external chapter worker metadata preserves exact optional download ownership', async () => {
  const chapter = EXTERNAL_CATALOG.chapters[0];
  const { buildExternalPilot } = await import(
    '../authoring/library/external-chapter-pilot/build.mjs'
  );
  const { payloads } = await buildExternalPilot();
  const index = JSON.parse(
    await readFile(path.join(source, 'game/content/mission-library-index.json')),
  );
  index.missions = index.missions.filter((mission) => mission.packId === chapter.id);
  assert.equal(index.missions.length, 3);
  const entries = [
    { name: 'game/offline.mjs', bytes: Buffer.from('export {};') },
    {
      name: 'game/index.html',
      bytes: Buffer.from('<html><head></head><body>Fixture</body></html>'),
    },
    { name: 'game/content/mission-library-index.json', bytes: Buffer.from(JSON.stringify(index)) },
    {
      name: option.catalog,
      bytes: Buffer.from(JSON.stringify({ ...EXTERNAL_CATALOG, chapters: [chapter] })),
    },
  ];
  for (const kind of ['pack', 'media']) {
    const bytes = Buffer.from(await payloads[kind].arrayBuffer());
    assert.equal(bytes.length, chapter[kind].bytes);
    assert.equal(sha(bytes), chapter[kind].sha256);
    entries.push({ name: chapter[kind].path, bytes });
  }
  await addOfflineEntries(
    source,
    entries,
    { version: 'external-ownership-fixture', sourceRevision: 'a'.repeat(40) },
    { optionalOffline: [] },
    [],
    [chapter.pack.path, chapter.media.path],
  );
  const output = new Map(entries.map((entry) => [entry.name, entry.bytes]));
  const offline = JSON.parse(output.get('offline-cache.json'));
  const catalogue = JSON.parse(output.get('offline-content.json'));
  const worker = output.get('service-worker.js').toString();
  assertExternalDownloadOwnership(worker, offline, catalogue, [chapter]);
  const pin = offline.downloadFiles.find((file) => file.path === chapter.media.path);
  const owner = `chapter:${chapter.id}`;
  // Mutate both worker and loose metadata together, so these probes must fail
  // on the ownership/pin boundary rather than merely a serialization mismatch.
  for (const [label, mutate] of [
    ['core leak', (config) => config.files.push(pin)],
    [
      'legacy leak',
      (config) => {
        config.optionalPacks = [pin];
      },
    ],
    [
      'missing worker pin',
      (config) => {
        config.downloadFiles = config.downloadFiles.filter((file) => file.path !== pin.path);
      },
    ],
    ['duplicate worker pin', (config) => config.downloadFiles.push(pin)],
    [
      'same-length tampered pin',
      (config, content) => {
        const altered = Buffer.from(output.get(pin.path));
        altered[altered.length - 1] ^= 1;
        assert.equal(altered.length, pin.bytes);
        config.downloadFiles.find((file) => file.path === pin.path).sha256 = sha(altered);
        content.files.find((file) => file.path === pin.path).sha256 = sha(altered);
      },
    ],
    [
      'missing catalogue pin',
      (_config, content) => {
        content.files = content.files.filter((file) => file.path !== pin.path);
      },
    ],
    [
      'missing chapter member',
      (_config, content) => {
        content.groups.find((group) => group.id === owner).files = [chapter.pack.path];
      },
    ],
    [
      'shared owner leak',
      (_config, content) =>
        content.groups.find((group) => group.id === 'shared').files.push(pin.path),
    ],
    [
      'wrong mission selection',
      (_config, content) => {
        content.missions[0].groups = ['shared'];
      },
    ],
  ]) {
    const config = structuredClone(offline),
      content = structuredClone(catalogue);
    mutate(config, content);
    const changedWorker = worker.replace(
      /const CONFIG = (\{[^\n]+\});/,
      `const CONFIG = ${JSON.stringify(config)};`,
    );
    assert.throws(
      () => assertExternalDownloadOwnership(changedWorker, config, content, [chapter]),
      assert.AssertionError,
      label,
    );
  }
  assert.throws(
    () =>
      assertExternalDownloadOwnership(worker, { ...offline, buildId: '0'.repeat(64) }, catalogue, [
        chapter,
      ]),
    assert.AssertionError,
  );
});

test('explicit real-source build ships thirty-two exact generated bodies once in loose/ZIP/manifest and excludes them from all core metadata', async (t) => {
  const dir = await directory(t),
    out = path.join(dir, 'out');
  await buildProject({
    root: source,
    out,
    version: 'external-check',
    sourceRevision: 'd'.repeat(40),
  });
  const manifest = JSON.parse(await readFile(path.join(out, 'manifest.json'))),
    offline = JSON.parse(await readFile(path.join(out, 'offline-cache.json'))),
    zip = await readFile(path.join(out, 'distribution.zip'));
  const coreConfig = await readBuildConfig(source),
    sourcePins = await admittedExternalSourcePins(source, coreConfig);
  // Production ships selected descriptors, provenance and originals. Comparing
  // the entire matching subtree still rejects unselected compiler/private inputs.
  assertExternalSourceMembers(manifest.files, sourcePins);
  for (const name of sourcePins.keys())
    assert.deepEqual(await readFile(path.join(out, name)), await readFile(path.join(source, name)));
  const wanted = new Map(
      EXTERNAL_CATALOG.chapters.flatMap((c) => ['pack', 'media'].map((k) => [c[k].path, c[k]])),
    ),
    bodies = new Map(),
    bodySizes = [];
  assert.equal(SOURCE_EXTERNAL_CHAPTERS.length, 16);
  assert.equal(wanted.size, 32);
  for (const [name, pin] of wanted) {
    const records = manifest.files.filter((f) => f.path === name);
    assert.equal(records.length, 1);
    assert.equal(records[0].bytes, pin.bytes);
    assert.equal(records[0].sha256, pin.sha256);
    const bytes = await readFile(path.join(out, name));
    bodySizes.push(bytes.length);
    if (name.endsWith('/pack.json')) bodies.set(name, bytes);
    assert.equal(bytes.length, pin.bytes);
    assert.equal(sha(bytes), pin.sha256);
    assert(!offline.files.some((f) => f.path === name));
    assert(!offline.optionalPacks.some((f) => f.path === name));
  }
  assert.equal(bodySizes.length, 32);
  assert.equal(bodies.size, 16);
  // Journey originals remain exact release bodies but do not make preparation
  // promise that the online-only authored preview works without a connection.
  if (offline.optionalArtwork) {
    assert.equal(offline.optionalArtwork.availability, 'online-only');
    assert.equal(offline.optionalArtwork.count, JOURNEY_ART_CANDIDATES.length);
    assert.equal(
      offline.optionalArtwork.bytes,
      JOURNEY_ART_CANDIDATES.reduce((sum, asset) => sum + asset.bytes, 0),
    );
    for (const pin of offline.optionalArtwork.files) {
      assert.deepEqual(
        manifest.files.find((file) => file.path === pin.path),
        pin,
      );
      assert(!offline.files.some((file) => file.path === pin.path));
      assert.deepEqual(sha(await readFile(path.join(out, pin.path))), pin.sha256);
    }
  }
  // The approved complete-source target is 72 MiB, below the builder/worker's
  // 80 MiB hard limit. Check it once for every source, including no-artwork builds.
  assert(offline.files.length <= 2000);
  assert(offline.files.reduce((total, file) => total + file.bytes, 0) <= 72 * 1024 * 1024);
  // Preserve the exact historical cohorts formerly recompiled by each chapter test.
  // These are actual loose bytes already authenticated above, in catalog order.
  for (const [start, end, expected] of [
    [0, 32, 130442755],
    [0, 24, 98674097],
    [24, 32, 31768658],
    [0, 16, 64546929],
    [16, 24, 34127168],
    [0, 10, 41373627],
  ])
    assert.equal(
      bodySizes.slice(start, end).reduce((total, bytes) => total + bytes, 0),
      expected,
    );
  assertZipMemberPins(zip, new Map([...wanted, ...sourcePins]));
  const legacy = JSON.parse(await readFile(path.join(source, 'game/content/optional-worlds.json')));
  for (const old of legacy.packs) {
    assert(offline.optionalPacks.some((f) => f.path === old.path));
    assert.equal(manifest.files.find((f) => f.path === old.path).sha256, old.sha256);
  }
  assert.equal(
    offline.optionalPacks.length,
    coreConfig.optionalOffline.length + legacy.packs.length,
  );
  const arcadePath = 'game/content/packs/fpv-arcade-r5.json';
  assert(offline.optionalPacks.some((entry) => entry.path === arcadePath));
  assert(!offline.files.some((entry) => entry.path === arcadePath));
  assert.equal(
    manifest.files.find((entry) => entry.path === arcadePath).sha256,
    sha(await readFile(path.join(source, arcadePath))),
  );
  assert(offline.files.some((f) => f.path === option.catalog));
  // The illustrated Workshop remains exact shipped content with explicit chapter
  // download ownership; only small bundled packs belong in every core install.
  const equipmentPath = 'game/content/packs/equipment-workshop.json';
  const equipmentBytes = await readFile(path.join(source, equipmentPath));
  const equipmentPin = {
    path: equipmentPath,
    bytes: equipmentBytes.length,
    sha256: sha(equipmentBytes),
  };
  assert.deepEqual(await readFile(path.join(out, equipmentPath)), equipmentBytes);
  assert.deepEqual(
    manifest.files.filter((entry) => entry.path === equipmentPath),
    [equipmentPin],
  );
  assert(!offline.files.some((entry) => entry.path === equipmentPath));
  assert(!offline.optionalPacks.some((entry) => entry.path === equipmentPath));
  assert.deepEqual(
    offline.downloadFiles.filter((entry) => entry.path === equipmentPath),
    [{ ...equipmentPin, kind: 'gameplay' }],
  );
  const catalogue = JSON.parse(await readFile(path.join(out, 'offline-content.json')));
  const equipmentOwner = 'chapter:equipment-workshop';
  const equipmentGroups = catalogue.groups.filter((group) => group.id === equipmentOwner);
  assert.equal(equipmentGroups.length, 1);
  assert.deepEqual(equipmentGroups[0].files, [equipmentPath]);
  assert.deepEqual(equipmentGroups[0].requires, ['shared']);
  assert(!downloadFiles(catalogue, ['shared']).some((entry) => entry.path === equipmentPath));
  const equipmentMissions = catalogue.missions.filter((row) => row.packId === 'equipment-workshop');
  assert.equal(equipmentMissions.length, 3);
  for (const mission of equipmentMissions) {
    assert.deepEqual(mission.groups, [equipmentOwner]);
    assert.deepEqual(
      downloadFiles(catalogue, mission.groups).filter((entry) => entry.path === equipmentPath),
      [{ ...equipmentPin, kind: 'gameplay' }],
    );
  }
  assert(offline.files.some((entry) => entry.path === 'game/content/packs/index.json'));
  const worker = await readFile(path.join(out, 'service-worker.js'), 'utf8');
  // URLs are deliberately registered for verified chapter downloads. Their
  // presence must never turn optional bodies into automatic core/legacy work.
  assertExternalDownloadOwnership(worker, offline, catalogue, EXTERNAL_CATALOG.chapters);
  await t.test(
    'sixteen external choices plus five embedded choices do not relax twelve installed packs or evict owners',
    async () => {
      assert.equal(legacy.packs.length, 5);
      assert.equal(EXTERNAL_CATALOG.chapters.length + legacy.packs.length, 21);
      assert.equal(PACK_LIMITS.installed, 12);
      assert.equal(PACK_LIMITS.libraryBytes, 48 * 1024 * 1024);
      let installed = emptyPackLibrary();
      for (const item of EXTERNAL_CATALOG.chapters.slice(0, 12))
        installed = installPack(
          installed,
          (await preparePack(bodies.get(item.pack.path).toString())).pack,
        );
      const source = JSON.parse(bodies.get(EXTERNAL_CATALOG.chapters[5].pack.path));
      const value = structuredClone(source);
      value.id = 'capacity-control-thirteenth';
      value.campaigns[0].id = value.id;
      const { pack: refused } = await preparePack(value);
      const before = exportPackLibrary(installed);
      assert.throws(() => installPack(installed, refused), /At most 12/);
      assert.equal(exportPackLibrary(installed), before);
      assert.deepEqual(
        installed.packs.map((p) => p.id),
        SOURCE_EXTERNAL_CHAPTERS.slice(0, 12).map((d) => d.id),
      );
    },
  );
});
