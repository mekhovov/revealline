import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';
import {
  collectBuildFiles,
  readBuildConfig,
  validateBuildReferences,
} from '../../scripts/game-cli.mjs';
import { selectOfflineCore } from '../../scripts/offline-core-closure.mjs';
import { collectEditionEngineFiles } from '../../scripts/compile-edition.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const directory = 'authoring/viewport-lab/';
const guides = [
  'authoring/README.md',
  'docs/flight-controls.md',
  'docs/verification/round-47/couch-native-shell.md',
  'docs/couch-installed-chapters.md',
];
const read = (name) => fs.readFile(path.join(root, name));
const local = (owner, value) => {
  if (!value || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value)) return null;
  return path.posix.normalize(path.posix.join(path.posix.dirname(owner), value.split(/[?#]/)[0]));
};

test('the default package includes Viewport Lab, its delayed entry and immediate local guide links', async () => {
  const files = await collectBuildFiles(root, await readBuildConfig(root));
  const available = new Set(files);
  const admitted = (name) =>
    available.has(name) || available.has(path.posix.join(name, 'index.html'));
  for (const name of [
    directory + 'index.html',
    directory + 'browser.mjs',
    directory + 'lab.css',
    directory + 'README.md',
    'authoring/shared/host-display-entry.mjs',
    'authoring/shared/host-display.mjs',
    ...guides,
  ])
    assert.ok(available.has(name), `Missing Viewport resource: ${name}`);

  const entry = directory + 'index.html';
  let delayedEntry = null;
  const visit = (node) => {
    const attrs = Object.fromEntries((node.attrs || []).map(({ name, value }) => [name, value]));
    if (attrs['data-module']) delayedEntry = local(entry, attrs['data-module']);
    for (const reference of [attrs.src, attrs.href, attrs['data-module']]) {
      const target = local(entry, reference);
      if (target) assert.ok(admitted(target), `${entry} cannot reach ${reference}`);
    }
    for (const child of node.childNodes || []) visit(child);
  };
  visit(parse((await read(entry)).toString()));
  assert.equal(delayedEntry, directory + 'browser.mjs');

  // Only the Lab's immediate guide links are its local reference contract.
  // Historical links inside those guides do not recursively admit archives.
  const guide = directory + 'README.md';
  for (const match of (await read(guide)).toString().matchAll(/\]\(([^)]+)\)/g)) {
    const target = local(guide, match[1]);
    if (target) assert.ok(admitted(target), `Missing direct Lab guide: ${target}`);
  }
  assert.equal((await validateBuildReferences(root, files)).literalReferencesValid, true);
  assert.equal(
    files.some((name) => name.startsWith('game/test/')),
    false,
  );
  assert.equal(available.has('authoring/library/route-worlds/build.mjs'), false);
  assert.equal(available.has('authoring/production/cli.mjs'), false);
});

test('Viewport remains optional Workshop tooling, while its real Couch preview requires the Versus runtime', async () => {
  const files = await collectBuildFiles(root, await readBuildConfig(root));
  const tooling = [...files.filter((name) => name.startsWith(directory)), ...guides];
  assert.ok(tooling.length >= 8, 'Include the current Lab and bounded direct references');
  for (const target of ['game/index.html', 'game/couch/index.html'])
    assert.ok(files.includes(target), `Missing real preview destination: ${target}`);
  // Only textual references drive this selector. This asserts dependency
  // ownership, not emitted package bytes or a prepared offline installation.
  const entries = await Promise.all(
    files.map(async (name) => ({
      name,
      bytes: /\.(?:m?js|json|html|css)$/.test(name) ? await read(name) : Buffer.alloc(0),
    })),
  );
  const closures = new Map();
  for (const mode of ['solo', 'versus', 'team']) {
    const closure = selectOfflineCore(entries, new Set(), { mode });
    closures.set(mode, closure);
    const optional = new Set(closure.optional);
    for (const name of tooling) {
      assert.ok(optional.has(name), `${mode} must leave ${name} for optional Workshop tooling`);
      assert.equal(closure.retained.has(name), false, `${mode} startup includes ${name}`);
    }
  }
  assert.equal(closures.get('solo').retained.has('game/index.html'), true);
  assert.equal(closures.get('solo').retained.has('game/couch/index.html'), false);
  assert.equal(closures.get('versus').retained.has('game/couch/index.html'), true);
  // The unchanged publisher puts non-mode optional candidates into Workshop.
  // Admitting the Lab must neither make Couch startup eager nor add a company
  // editor surface to any of the standalone Solo edition engine closures.
  const engine = await collectEditionEngineFiles({ root });
  for (const name of tooling) assert.equal(engine.has(name), false, name);
});
