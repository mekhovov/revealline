import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';
import {
  collectBuildFiles,
  readBuildConfig,
  validateBuildReferences,
} from '../../scripts/game-cli.mjs';
import { selectOfflineCore } from '../../scripts/offline-core-closure.mjs';
import { collectEditionEngineFiles } from '../../scripts/compile-edition.mjs';
import { listProductionSlots } from '../../authoring/production/model.mjs';
import { productionSourceDocumentPath } from '../../authoring/production/source-documents.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const runtime = [
  'authoring/production/index.html',
  'authoring/production/browser.mjs',
  'authoring/production/panel.mjs',
  'authoring/production/panel.css',
  'authoring/production/model.mjs',
  'authoring/production/preview.mjs',
  'authoring/production/input-entry.mjs',
  'authoring/production/input.mjs',
  'authoring/production/reading.mjs',
  'authoring/production/source-documents.mjs',
  'authoring/shared/host-display-entry.mjs',
  'authoring/shared/host-display.mjs',
];
const registers = [
  'authoring/production/register.json',
  'authoring/production/register-sentinel-themes.json',
];
const guides = [
  'authoring/production/README.md',
  'authoring/prompts/production-intake.md',
  'docs/content-production-register.md',
  'authoring/media/README.md',
  'authoring/production/history/index.json',
  'authoring/production/history/source-index.json',
  'authoring/production/source-documents/README.md',
  'authoring/production/source-documents/manifest.json',
];
const read = (name) => fs.readFile(path.join(root, name));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const local = (owner, value) => {
  if (!value || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value)) return null;
  return path.posix.normalize(path.posix.join(path.posix.dirname(owner), value.split(/[?#]/)[0]));
};

async function selectedSources() {
  const previews = new Map(),
    sources = new Map();
  for (const name of registers) {
    for (const row of listProductionSlots(JSON.parse(await read(name)))) {
      if (!row.work) continue;
      const preview = row.work.files.find(
        (item) =>
          ['original', 'poster', 'concept'].includes(item.role) && item.file.path.endsWith('.png'),
      );
      if (preview) {
        const previous = previews.get(preview.file.path);
        if (previous) assert.deepEqual(previous, preview, 'Repeated preview identity must agree');
        previews.set(preview.file.path, preview);
      }
      for (const pin of [row.work.source, ...row.work.dependencies]) {
        const previous = sources.get(pin.path);
        if (previous) assert.deepEqual(previous, pin, 'Repeated source identity must agree');
        sources.set(pin.path, pin);
      }
    }
  }
  return { previews, sources };
}

test('the default package contains the two Production views, local input owners and literal resources', async () => {
  const files = await collectBuildFiles(root, await readBuildConfig(root));
  const available = new Set(files);
  const admitted = (name) =>
    available.has(name) || available.has(path.posix.join(name, 'index.html'));
  for (const name of [...runtime, ...registers, ...guides]) assert.ok(available.has(name), name);
  const entry = 'authoring/production/index.html';
  let foundModule = false;
  const visit = (node) => {
    const attrs = Object.fromEntries((node.attrs || []).map(({ name, value }) => [name, value]));
    if (attrs['data-module'] === './browser.mjs') foundModule = true;
    for (const ref of [attrs.src, attrs.href, attrs['data-module']]) {
      const target = local(entry, ref);
      if (target) assert.ok(admitted(target), `${entry} cannot reach ${ref}`);
    }
    for (const child of node.childNodes || []) visit(child);
  };
  visit(parse((await read(entry)).toString()));
  assert.ok(foundModule, 'The delayed browser entry is part of the checked HTML closure');
  for (const guide of guides.slice(0, 2)) {
    for (const match of (await read(guide)).toString().matchAll(/\]\(([^)]+)\)/g)) {
      const target = local(guide, match[1]);
      if (target) assert.ok(admitted(target), `Direct guide reference missing: ${target}`);
    }
  }
  assert.equal((await validateBuildReferences(root, files)).literalReferencesValid, true);
  for (const name of [
    'authoring/production/cli.mjs',
    'authoring/production/sources.mjs',
    'authoring/production/register-fracture-themes.json',
    'authoring/production/register-countercurrent.json',
    'authoring/library/route-worlds/build.mjs',
    'authoring/library/sentinel-circuit-external/build.mjs',
    'authoring/library/sentinel-circuit/build.mjs',
    'authoring/library/four-worlds-chapters/verify-images.mjs',
  ])
    assert.equal(available.has(name), false, `Unrelated executable/history was admitted: ${name}`);
  assert.deepEqual(
    files.filter((name) => name.startsWith('authoring/production/history/')),
    ['authoring/production/history/index.json', 'authoring/production/history/source-index.json'],
  );
  assert.equal(
    files.some((name) => name.startsWith('game/test/')),
    false,
  );
});

test('all 43 selected PNG previews ship unchanged with their recorded byte, hash and dimensions', async () => {
  const files = new Set(await collectBuildFiles(root, await readBuildConfig(root)));
  const { previews, sources } = await selectedSources();
  assert.equal(previews.size, 43);
  assert.equal(sources.size, 34);
  for (const [name, entry] of previews) {
    assert.ok(files.has(name), name);
    const bytes = await read(name);
    assert.equal(bytes.length, entry.file.bytes, name);
    assert.equal(hash(bytes), entry.file.sha256, name);
    assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    assert.equal(bytes.toString('ascii', 12, 16), 'IHDR');
    assert.equal(bytes.readUInt32BE(16), entry.width, name);
    assert.equal(bytes.readUInt32BE(20), entry.height, name);
    assert.ok(bytes.length <= 8 * 1024 * 1024 && entry.width <= 4096 && entry.height <= 4096);
    assert.ok(entry.width * entry.height <= 8 * 1024 * 1024);
  }
  for (const name of sources.keys()) {
    assert.ok(files.has(productionSourceDocumentPath(name)), `Missing displayed source: ${name}`);
  }
});

test('the two inert producer documents retain exact original and registered identities without changing other links', async () => {
  const { sources } = await selectedSources();
  const manifest = JSON.parse(await read('authoring/production/source-documents/manifest.json'));
  assert.equal(manifest.format, 'fpv-line-production-source-documents.v1');
  assert.equal(manifest.documents.length, 2);
  for (const item of manifest.documents) {
    const pin = sources.get(item.sourcePath);
    assert.ok(pin, 'Only a displayed register source can have a document alias');
    assert.equal(item.documentPath, productionSourceDocumentPath(item.sourcePath));
    assert.equal(item.documentPath, `authoring/production/source-documents/${pin.sha256}.txt`);
    const bytes = await read(item.documentPath);
    assert.equal(bytes.length, pin.bytes);
    assert.equal(hash(bytes), pin.sha256);
    assert.equal(bytes.length, item.bytes);
    assert.equal(hash(bytes), item.sha256);
    assert.deepEqual(
      bytes,
      await read(item.sourcePath),
      'The reference is not rewritten or formatted',
    );
    assert.doesNotThrow(() => new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  }
  for (const name of [...sources.keys(), '__proto__', 'constructor', '../other.mjs']) {
    if (!manifest.documents.some((item) => item.sourcePath === name))
      assert.equal(productionSourceDocumentPath(name), name);
  }
});

test('executable producer files still fail ordinary browser dependency validation', async () => {
  const files = await collectBuildFiles(root, await readBuildConfig(root));
  await assert.rejects(
    validateBuildReferences(root, [
      ...files,
      'authoring/library/route-worlds/build.mjs',
      'authoring/library/sentinel-circuit-external/build.mjs',
    ]),
    (error) =>
      /Missing distribution references/.test(error.message) &&
      /four-worlds-chapters\/verify-images\.mjs/.test(error.message) &&
      /sentinel-circuit\/build\.mjs/.test(error.message),
  );
});

test('the Production additions are Workshop optional candidates in every mode and absent from standalone company engines', async () => {
  const files = await collectBuildFiles(root, await readBuildConfig(root));
  const { previews, sources } = await selectedSources();
  // These six rig images and seven existing runtime source links are already
  // shared dependencies. New Production admission must not pull any other
  // original, reader or reference document into a player startup graph.
  const tooling = new Set([
    ...runtime,
    ...registers,
    ...guides,
    ...[...previews.keys()].filter((name) => !name.startsWith('authoring/motion-lab/assets/')),
    ...[...sources.keys()]
      .filter(
        (name) =>
          !name.startsWith('game/') &&
          !name.startsWith('authoring/motion-lab/') &&
          !name.startsWith('authoring/still-media/'),
      )
      .map(productionSourceDocumentPath),
  ]);
  assert.equal(tooling.size, 86, 'Only the reviewed, bounded Production addition is optional');
  // The selector reads text references, never binary image bodies. Their exact
  // real bytes are independently verified above; this is graph qualification.
  const entries = await Promise.all(
    files.map(async (name) => ({
      name,
      bytes: /\.(?:m?js|json|html|css)$/.test(name) ? await read(name) : Buffer.alloc(0),
    })),
  );
  for (const mode of ['solo', 'versus', 'team']) {
    const closure = selectOfflineCore(entries, new Set(), { mode });
    const optional = new Set(closure.optional);
    for (const name of tooling) {
      assert.ok(optional.has(name), `${mode} must leave ${name} for optional Workshop tooling`);
      assert.equal(closure.retained.has(name), false, `${mode} core unexpectedly includes ${name}`);
    }
  }
  // The unchanged offline publisher assigns non-mode optional paths to
  // tooling:workshop. These paths cannot add a mode or a self dependency.
  const engine = await collectEditionEngineFiles({ root });
  for (const name of tooling) assert.equal(engine.has(name), false, name);
});
