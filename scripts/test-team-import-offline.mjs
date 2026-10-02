import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  OPTIONAL_TEAM_IMPORT_MANIFESTS,
  isOptionalTeamImportManifest,
  selectOfflineCore,
} from './offline-core-closure.mjs';
import { buildOfflineContent } from './offline-content.mjs';
import { downloadFiles } from '../game/download-catalogue.mjs';
import { gameplaySelection } from '../game/offline-download-session.mjs';

const root = new URL('../', import.meta.url);
const entry = (name, source) => ({ name, bytes: Buffer.from(source) });

test('only the two exact historical Team manifests leave every mode core', () => {
  const other = `game/presentation/compiled/runtime.${'f'.repeat(64)}.json`;
  const body = `game/presentation/compiled/assets/${'a'.repeat(64)}.png`;
  const entries = [
    entry('game/index.html', '<script type="module" src="shared.mjs"></script>'),
    entry('game/couch/index.html', '<script type="module" src="../shared.mjs"></script>'),
    entry('game/couch/relay-rescue.html', '<script type="module" src="../shared.mjs"></script>'),
    entry(
      'game/shared.mjs',
      `export const imports = ${JSON.stringify(OPTIONAL_TEAM_IMPORT_MANIFESTS)};`,
    ),
    ...[...OPTIONAL_TEAM_IMPORT_MANIFESTS, other].map((name) => entry(name, '{}')),
    entry(body, 'retained original'),
  ];
  for (const mode of ['solo', 'versus', 'team']) {
    const closure = selectOfflineCore(entries, new Set(), { mode });
    for (const name of OPTIONAL_TEAM_IMPORT_MANIFESTS) {
      assert.equal(closure.retained.has(name), false, `${mode}: ${name}`);
      assert.equal(closure.optional.includes(name), true, `${mode}: ${name}`);
    }
    assert.equal(closure.retained.has(other), true);
    assert.equal(closure.retained.has(body), true);
    assert.equal(closure.retained.has('game/shared.mjs'), true);
  }
  assert.equal(isOptionalTeamImportManifest(other), false);
  assert.equal(isOptionalTeamImportManifest(`prefix/${OPTIONAL_TEAM_IMPORT_MANIFESTS[0]}`), false);
});

async function retainedEntries() {
  const files = new Map();
  for (const name of OPTIONAL_TEAM_IMPORT_MANIFESTS) {
    const bytes = await readFile(new URL(name, root));
    files.set(name, bytes);
    for (const relative of Object.values(JSON.parse(bytes).urls)) {
      const path = `game/presentation/compiled/${relative.slice(2)}`;
      if (!files.has(path)) files.set(path, await readFile(new URL(path, root)));
    }
  }
  return [...files].map(([name, bytes]) => ({ name, bytes }));
}

test('older Team themes are explicit archives with exact original bodies retained by the core', async () => {
  const runtime = 'game/couch/relay-rescue.mjs';
  const entries = [...(await retainedEntries()), entry(runtime, 'export const team = true;')];
  const before = entries.map(({ name, bytes }) => [name, Buffer.from(bytes)]);
  // Historical metadata-free builds keep Team runtime in shared rather than
  // defining current navigation's separate runtime:team package.
  const excluded = new Set([runtime]);
  const catalogue = await buildOfflineContent(entries, excluded, '1.0.0');
  const group = catalogue.groups.find((item) => item.id === 'archive:team-import-themes');
  assert.deepEqual(group, {
    id: 'archive:team-import-themes',
    title: 'Older Team import themes',
    titleKey: 'content:offlineOlderTeamImportThemes',
    kind: 'gameplay',
    category: 'archive',
    current: false,
    modes: ['team'],
    requires: ['shared'],
    files: [...OPTIONAL_TEAM_IMPORT_MANIFESTS],
  });
  const current = downloadFiles(catalogue, gameplaySelection(catalogue, { all: true }));
  assert.deepEqual(
    current.map((file) => file.path),
    [runtime],
  );
  const selected = downloadFiles(catalogue, [group.id]);
  assert.deepEqual(
    selected.map((file) => file.path).sort(),
    [runtime, ...OPTIONAL_TEAM_IMPORT_MANIFESTS].sort(),
  );
  for (const name of OPTIONAL_TEAM_IMPORT_MANIFESTS) {
    assert.equal(excluded.has(name), true);
    assert.deepEqual(
      catalogue.groups.filter((item) => item.files.includes(name)).map((item) => item.id),
      [group.id],
      'No implicit shared or Workshop copy may opt players into older import themes.',
    );
  }
  for (const item of entries.filter((item) => item.name.includes('/assets/')))
    assert.equal(excluded.has(item.name), false, item.name);
  assert.deepEqual(
    entries.map(({ name, bytes }) => [name, bytes]),
    before,
  );
});

test('older Team archive rejects replaced manifests, missing bodies and ambiguous paths', async () => {
  const entries = await retainedEntries();
  const source = entries.find((item) => isOptionalTeamImportManifest(item.name));
  await assert.rejects(
    buildOfflineContent(
      entries.map((item) => (item === source ? entry(item.name, '{}') : item)),
      new Set(),
      '1.0.0',
    ),
    /differs from its exact shipped manifest/,
  );
  await assert.rejects(
    buildOfflineContent([...entries, source], new Set(), '1.0.0'),
    /differs from its exact shipped manifest/,
  );
  const body = entries.find((item) => item.name.includes('/assets/'));
  await assert.rejects(
    buildOfflineContent(
      entries.filter((item) => item !== body),
      new Set(),
      '1.0.0',
    ),
    /no exact shipped asset/,
  );
});
