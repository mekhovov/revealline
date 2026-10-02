import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { prepareWorldTextureAcceptance } from './prepare-world-texture-acceptance.mjs';

test('texture inspection closes over actual bounded optional-package bytes and the retained GLB', async () => {
  const result = await prepareWorldTextureAcceptance({ verifyOnly: true });
  assert.equal(result.writes, 0);
  assert.equal(result.packageQualification, 'development-only');
  assert.ok(result.packageFiles <= result.limits.files);
  assert.ok(result.packageBytes <= result.limits.bytes);
  assert.equal(result.limits.files, 104);
  assert.equal(result.limits.bytes, 16 * 1024 * 1024);
  assert.equal(result.packageEntry, 'optional-practice/fpv-worlds/index.html');
  assert.ok(result.inspectionChromeFiles > 0 && result.inspectionChromeFiles <= 24);
  assert.ok(result.inspectionChromeBytes > 0 && result.inspectionChromeBytes <= 2 * 1024 * 1024);
  for (const path of [
    result.packageEntry,
    result.inspectionEntry,
    'optional-practice/civilian-fpv/world-assets.mjs',
    'optional-practice/civilian-fpv/world-editor.mjs',
    'optional-practice/civilian-fpv/world-content.mjs',
    'optional-practice/civilian-fpv/vendor/addons/loaders/GLTFLoader.js',
    'optional-practice/civilian-fpv/renderer.mjs',
    'game/presentation/theme-bootstrap.mjs',
    'game/presentation/industrial-workshop.css',
    'game/ui/field-kit-fonts.css',
    'game/ui/fonts/departure-mono/DepartureMono-Regular.woff2',
    'game/ui/fonts/departure-mono/LICENSE',
    'authoring/fpv-worlds/industrial-markings/r1/markings.glb',
  ]) {
    const pin = result.files.find((row) => row.path === path);
    assert.ok(pin, path);
    const bytes = await readFile(new URL('../' + path, import.meta.url));
    assert.equal(pin.bytes, bytes.length, path);
    assert.equal(pin.sha256, createHash('sha256').update(bytes).digest('hex'), path);
  }
  assert.equal(
    result.files.some((row) => row.path.endsWith('.zip')),
    false,
  );
  assert.equal(
    result.files.some((row) => row.path.endsWith('/generate.mjs')),
    false,
  );
});

test('texture acceptance output names cannot escape the isolated fixture directory', async () => {
  for (const name of ['../other', '/tmp/other', 'a/b', 'x'.repeat(65)])
    await assert.rejects(prepareWorldTextureAcceptance({ name }), /short lowercase/);
});
