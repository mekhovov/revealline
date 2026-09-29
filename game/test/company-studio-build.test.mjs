import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';
import {
  collectBuildFiles,
  readBuildConfig,
  validateBuildReferences,
} from '../../scripts/game-cli.mjs';
import { declaredJSONPaths } from '../../authoring/company-studio/model.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const entries = ['authoring/company-studio/index.html', 'authoring/company-studio/playtest.html'];
const localTarget = (from, value) => {
  if (!value || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value)) return null;
  return path.posix.normalize(path.posix.join(path.posix.dirname(from), value.split(/[?#]/)[0]));
};

test('the default distribution includes Company Studio, transfer practice and their live local links', async () => {
  const files = await collectBuildFiles(root, await readBuildConfig(root));
  const available = new Set(files);
  const admitted = (name) => available.has(name) || available.has(path.posix.join(name, 'index.html'));
  for (const name of [
    ...entries,
    'authoring/company-studio/studio.mjs',
    'authoring/company-studio/operation.mjs',
    'authoring/company-studio/reading.mjs',
    'authoring/company-studio/review-pane.mjs',
    'authoring/company-studio/preview.mjs',
    'authoring/company-studio/playtest.mjs',
    'authoring/company-studio/studio.css',
    'docs/company-editions-playtest.md',
  ])
    assert.ok(available.has(name), `Missing Company destination/dependency: ${name}`);
  for (const entry of entries) {
    const visit = (node) => {
      const attrs = Object.fromEntries((node.attrs || []).map(({ name, value }) => [name, value]));
      for (const reference of [attrs.src, attrs.href, attrs['data-module']]) {
        const target = localTarget(entry, reference);
        if (target) assert.ok(admitted(target), `${entry} cannot reach ${reference}`);
      }
      for (const child of node.childNodes || []) visit(child);
    };
    visit(parse(await readFile(path.join(root, entry), 'utf8')));
  }
  const facilitator = 'docs/company-editions-playtest.md';
  for (const match of (await readFile(path.join(root, facilitator), 'utf8')).matchAll(
    /\]\(([^)]+)\)/g,
  )) {
    const target = localTarget(facilitator, match[1]);
    if (target) assert.ok(admitted(target), `Facilitator packet cannot reach ${match[1]}`);
  }
  assert.equal(
    files.some((name) => name.startsWith('game/test/')),
    false,
  );
  assert.equal((await validateBuildReferences(root, files)).literalReferencesValid, true);
});

test('Company Studio registered source and artwork choices are present in the default package', async () => {
  const files = new Set(await collectBuildFiles(root, await readBuildConfig(root)));
  const catalog = JSON.parse(await readFile(path.join(root, 'game/editions/catalog.json'), 'utf8'));
  for (const name of [
    'game/editions/catalog.json',
    'game/editions/runtime-assets.json',
    ...declaredJSONPaths(catalog),
  ])
    assert.ok(files.has(name), `Missing declared Company JSON: ${name}`);
  for (const asset of catalog.assets)
    assert.ok(files.has(asset.path), `Missing registered Company artwork: ${asset.id}`);
});
