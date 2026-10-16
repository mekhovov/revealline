import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { prepareWorldFile, inspectWorldFile } from './fpv-content.mjs';
test('pinned offline tools validate, optimize and preserve the semantic sidecar', async () => {
  const output = await mkdtemp(path.join(os.tmpdir(), 'rl-fpv-tool-test-'));
  try {
    const result = await prepareWorldFile({
      entry: new URL('../authoring/fpv-worlds/fixtures/starter.gltf', import.meta.url),
      outputDirectory: output,
      id: 'offline-test',
    });
    assert.equal(result.report.validation.before.issues.numErrors, 0);
    assert.equal(result.report.validation.after.issues.numErrors, 0);
    assert.equal(result.project.source.anchors.length, 2);
    assert.equal(result.project.source.colliders.length, 1);
    const imported = await inspectWorldFile(path.join(output, result.project.world.modelAsset));
    assert.equal(imported.sourceHash, result.project.source.hash);
    assert.ok(
      (await readFile(path.join(output, 'project.json'), 'utf8')).includes('FPVWorldProject.v1'),
    );
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
test('offline source loading rejects network resources before invoking a toolchain reader', async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'rl-fpv-invalid-'));
  try {
    const file = path.join(folder, 'world.gltf');
    await writeFile(
      file,
      JSON.stringify({
        asset: { version: '2.0' },
        buffers: [{ uri: 'https://example.org/model.bin', byteLength: 32 }],
      }),
    );
    await assert.rejects(inspectWorldFile(file), /relative local paths/);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
