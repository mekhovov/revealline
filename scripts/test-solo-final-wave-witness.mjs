import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  FINAL_WAVE_WITNESS_PATH,
  assertFinalWaveBindings,
  validateFinalWaveWitness,
} from './solo-final-wave-witness.mjs';
const root = new URL('../', import.meta.url);
const bytes = await readFile(new URL(FINAL_WAVE_WITNESS_PATH, root));

test('dispatched wave preserves thirteen exact Git workflow and declaration bindings', async () => {
  const witness = validateFinalWaveWitness(bytes);
  const files = new Map(witness.files.map((file) => [file.path, file]));
  for (const release of witness.releases) {
    for (const [manifestPath, paths] of Object.entries(release.manifests)) {
      await assertFinalWaveBindings(
        manifestPath,
        paths.map((path) => files.get(path)),
        release.workflow,
      );
    }
  }
});

test('changed witness, declaration membership, size and digest cannot rewrite dispatched provenance', async () => {
  const changed = Buffer.from(bytes);
  changed[changed.length - 2] ^= 1;
  assert.throws(() => validateFinalWaveWitness(changed));
  const witness = validateFinalWaveWitness(bytes);
  const release = witness.releases.find((entry) => Object.keys(entry.manifests).length);
  const manifestPath = Object.keys(release.manifests)[0];
  const ref = witness.files.find((f) => f.path === release.manifests[manifestPath][0]);
  for (const change of [
    { ...ref, bytes: ref.bytes + 1 },
    { ...ref, sha256: '0'.repeat(64) },
    { ...ref, path: 'scripts/not-in-execution.mjs' },
  ]) {
    await assert.rejects(assertFinalWaveBindings(manifestPath, [change], release.workflow));
  }
  await assert.rejects(assertFinalWaveBindings(manifestPath, [ref], 'unwitnessed.yml'));
});
