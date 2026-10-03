import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { compactContentRegistry } from './localization.mjs';
import {
  projectDefaultContentRegistry,
  projectDefaultRuntimeMetadata,
} from './default-runtime-metadata.mjs';
import { isOptionalReactionVoiceBody, selectOfflineCore } from './offline-core-closure.mjs';

const root = new URL('../', import.meta.url).pathname;
const codec = await fs.readFile(new URL('../game/vendor/lz-string-1.5.0.min.js', import.meta.url));
const license = await fs.readFile(new URL('../game/vendor/LZ-STRING-LICENSE.txt', import.meta.url));

test('default content registry preserves all identity mappings, scripts and shared fields', async () => {
  const fixture = {
    'route/one@1': {
      fields: {
        name: { source: 'Сигнал', key: 'content:signal' },
        hint: { source: 'Keep "left"\nthen right.', key: 'content:hint' },
      },
    },
    'route/one@2': {
      fields: {
        name: { source: 'Сигнал', key: 'content:signal' },
        hint: { source: 'Keep "left"\nthen right.', key: 'content:hint' },
      },
    },
  };
  const source = Buffer.from(compactContentRegistry(fixture));
  const projected = projectDefaultContentRegistry(source, { codec, license });
  const module = await import(`data:text/javascript;base64,${projected.toString('base64')}`);
  assert.deepEqual(module.default, fixture);
  assert.equal(module.default['route/one@1'], module.default['route/one@2']);
  assert.throws(
    () =>
      projectDefaultContentRegistry(Buffer.concat([source, Buffer.from('\nalert(1);')]), {
        codec,
        license,
      }),
    /wrapper changed/,
  );
  assert.throws(
    () => projectDefaultContentRegistry(source, { codec: Buffer.from('different'), license }),
    /pinned/,
  );
});

test('default transport projection preserves pinned recovery and mission-source descriptors', async () => {
  const mission = { path: 'game/one.json', bytes: 123, sha256: 'a'.repeat(64) };
  const index = {
    format: 'revealline-mission-library-index.v1',
    missions: [{ sourceFile: mission }],
  };
  const original = Buffer.from(JSON.stringify(index, null, 2));
  const recovery = Buffer.from('{\n  "keep": "exact pinned bytes"\n}\n');
  const entries = [
    { name: 'game/content/mission-library-index.json', bytes: original },
    { name: 'game/content/recovery-catalogs.json', bytes: recovery },
  ];
  await projectDefaultRuntimeMetadata(root, entries);
  assert.deepEqual(JSON.parse(entries[0].bytes), index);
  assert.ok(entries[0].bytes.length < original.length);
  assert.equal(entries[1].bytes, recovery);
  assert.deepEqual(JSON.parse(entries[0].bytes).missions[0].sourceFile, mission);
});

test('default host packing changes only its verified whitespace and leaves other code exact', async () => {
  const source = Buffer.from(
    '// Original license and comment spacing  stay.\n' +
      'export const text = "two  spaces";\n' +
      'export function value() {\n  return\n    7;\n}\n' +
      'export const template = `first\n  second`;\n',
  );
  const entries = [
    { name: 'game/app.mjs', bytes: source },
    { name: 'game/core.mjs', bytes: source },
  ];
  await projectDefaultRuntimeMetadata(root, entries);
  assert.ok(entries[0].bytes.length < source.length);
  assert.equal(entries[1].bytes, source);
  assert.deepEqual(
    entries[0].bytes.toString().match(/\r\n|[\n\r\u2028\u2029]/g),
    source.toString().match(/\r\n|[\n\r\u2028\u2029]/g),
  );
  assert.match(entries[0].bytes.toString(), /Original license and comment spacing  stay/);
  const module = await import(`data:text/javascript;base64,${entries[0].bytes.toString('base64')}`);
  assert.equal(module.text, 'two  spaces');
  assert.equal(module.template, 'first\n  second');
  assert.equal(module.value(), undefined, 'Automatic semicolon insertion stays intact.');
});

test('expanded default UI packing stays bounded to reviewed hosts and preserves source text', async () => {
  const hosts = [
    'game/couch/relay-rescue.mjs',
    'game/couch/couch.mjs',
    'game/ui/soundtrack-panel.mjs',
    'game/ui/library-panel.mjs',
    'game/ui/soundtrack-player.mjs',
    'game/couch/coop-view.mjs',
    'game/ui/optional-chapters-panel.mjs',
    'game/ui/render.mjs',
    'game/ui/controller-navigation.mjs',
    'game/snake/classic-app.mjs',
    'game/ui/mission-library-chooser.mjs',
    'game/ui/actor-presentation.mjs',
    'game/ui/edition-rewards.mjs',
    'game/ui/audio.mjs',
    'game/ui/still-media-panel.mjs',
    'game/studio/studio.mjs',
    'game/ui/classic-view.mjs',
    'game/couch/couch-installed-chapters.mjs',
    'game/ui/demo-host.mjs',
    'game/ui/still-story-panel.mjs',
  ];
  const exact = [
    'game/core.mjs',
    'game/coop/core.mjs',
    'game/snake/classic-core-v3.mjs',
    'game/presentation/current-art-sources.mjs',
    'game/ui/future-host.mjs',
  ];
  const source = Buffer.from(
    '// Keep  licensed comment.\r\n' +
      'export const caption = "Сигнал  збережено";\r\n' +
      'export const body = `row\n  second row`;\r\n' +
      'export function result() {\r\n    return\r\n      9;\r\n}\r\n',
  );
  const before = Buffer.from(source);
  const entries = [...hosts, ...exact].map((name) => ({ name, bytes: source }));
  await projectDefaultRuntimeMetadata(root, entries);
  assert.deepEqual(source, before, 'Canonical input buffers are never mutated.');
  for (const entry of entries) {
    if (exact.includes(entry.name)) {
      assert.equal(entry.bytes, source, entry.name);
      continue;
    }
    assert.ok(entry.bytes.length < source.length, entry.name);
    const module = await import(`data:text/javascript;base64,${entry.bytes.toString('base64')}`);
    assert.equal(module.caption, 'Сигнал  збережено');
    assert.equal(module.body, 'row\n  second row');
    assert.equal(module.result(), undefined);
    assert.match(entry.bytes.toString(), /Keep  licensed comment/);
    assert.deepEqual(entry.bytes.toString().match(/[\r\n]/g), source.toString().match(/[\r\n]/g));
  }
  const mapped = Buffer.from(`${source}//# sourceMappingURL=host.mjs.map\n`);
  const mappedEntry = { name: hosts[0], bytes: mapped };
  await projectDefaultRuntimeMetadata(root, [mappedEntry]);
  assert.equal(mappedEntry.bytes, mapped, 'Source-map columns retain their exact bytes.');
});

test('versioned actor voices remain optional in every core while catalogs and captions stay available', () => {
  for (const locale of ['en', 'uk']) {
    const path = `game/audio/reactions/actors-v1/runner-alert-${locale}.m4a`;
    assert.ok(isOptionalReactionVoiceBody(path));
    const entries = [
      {
        name: 'game/index.html',
        bytes: Buffer.from('<script type="module" src="audio/reactions/actors.mjs"></script>'),
      },
      ...['game/couch/index.html', 'game/couch/relay-rescue.html'].map((name) => ({
        name,
        bytes: Buffer.from('<script type="module" src="../audio/reactions/actors.mjs"></script>'),
      })),
      {
        name: 'game/audio/reactions/actors.mjs',
        bytes: Buffer.from(`export const original = './actors-v1/runner-alert-${locale}.m4a';`),
      },
      { name: path, bytes: Buffer.from('voice original') },
    ];
    for (const mode of ['solo', 'versus', 'team']) {
      const core = selectOfflineCore(entries, new Set(), { mode });
      assert.ok(core.retained.has('game/audio/reactions/actors.mjs'), mode);
      assert.ok(!core.retained.has(path), mode);
      assert.ok(core.optional.includes(path), mode);
    }
  }
  for (const path of [
    'game/audio/reactions/actors-v0/a-en.m4a',
    'game/audio/reactions/actors-v1/../a-en.m4a',
    'game/audio/reactions/unreviewed/a-en.m4a',
    'game/audio/reactions/actors-v1/a-fr.m4a',
  ])
    assert.equal(isOptionalReactionVoiceBody(path), false, path);
});
