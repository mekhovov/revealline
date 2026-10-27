import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  parseArtQualificationOptions,
  artworkOmissionPaths,
  writeNewArtQualificationReport,
} from './qualify-authoring-art-fallback-browser.mjs';

test('authoring browser qualifier preserves paths containing spaces and rejects ambiguous options', () => {
  const options = parseArtQualificationOptions([
    '--runtime=/installed runtime/playwright/index.mjs',
    '--executable=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '--report=/tmp/new receipt.json',
  ]);
  assert.equal(options.executable, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  assert.equal(options.report, '/tmp/new receipt.json');
  assert.throws(() => parseArtQualificationOptions(['--runtime=/a']), /required/);
  assert.throws(() => parseArtQualificationOptions(['--runtime=/a', '--runtime=/b']), /unique/);
  assert.throws(() => parseArtQualificationOptions(['--arbitrary=/a']), /unique/);
});

test('committed omission evidence must still match every current code-owned image identity', async () => {
  const proof = JSON.parse(
    await readFile(
      new URL(
        '../docs/qualification/shared-demos/current-art-fallback-proof-final.json',
        import.meta.url,
      ),
    ),
  );
  const paths = artworkOmissionPaths(proof);
  assert.equal(paths.size, proof.uniqueOriginals);
  assert(paths.size > 0);
  const changed = structuredClone(proof);
  changed.loads[0].sha256 = '0'.repeat(64);
  assert.throws(() => artworkOmissionPaths(changed));
  changed.loads[0].sha256 = proof.loads[0].sha256;
  changed.loads[0].path = 'authoring/arbitrary.png';
  assert.throws(() => artworkOmissionPaths(changed));
  assert.throws(() => artworkOmissionPaths({ ...proof, allExact: false }));
});

test('atomic authoring receipts never replace an earlier outcome, including a late competing receipt', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'authoring-art-report-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const output = path.join(directory, 'receipt.json');
  await writeNewArtQualificationReport(output, { complete: true, marker: 'original' });
  const before = await readFile(output);
  await assert.rejects(
    writeNewArtQualificationReport(output, { complete: false, marker: 'replacement' }),
    { code: 'EEXIST' },
  );
  assert.deepEqual(await readFile(output), before);
});
