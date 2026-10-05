import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createCreatorPackageValidator, readCreatorPreview } from '../src/validator.mjs';
import { toPublicEdition } from '../src/domain.mjs';
import { createOverflightProject } from '../../../game/overflight/project.mjs';
import { createOverflightPackage } from '../../../game/overflight/community.mjs';

const validate = createCreatorPackageValidator({
  decodeImage() {
    assert.fail('Overflight must use admitted shared artwork, not decode uploaded assets');
  },
  inspectVideo() {
    assert.fail('Overflight does not admit embedded media');
  },
});
async function submit(source) {
  const bytes = Buffer.from(JSON.stringify(source, null, 2));
  return validate({
    body: [bytes],
    validatorVersion: 'overflight-test',
    submission: {
      actualSize: bytes.length,
      packageSha256: createHash('sha256').update(bytes).digest('hex'),
    },
  });
}

test('service admits exact Overflight closure as compiled content without claiming play qualification', async () => {
  const source = createOverflightPackage(createOverflightProject());
  const result = await submit(source);
  assert.equal(result.accepted, true);
  assert.equal(result.report.family, 'overflight');
  assert.equal(result.report.format, 'revealline-overflight-package.v1');
  assert.equal(result.report.compiler, 'passed');
  assert.equal(result.report.replay, 'not-play-qualified');
  assert.equal(result.report.media, 'shared-runtime-assets');
  assert.equal(result.report.assets, 0);
  const metadata = toPublicEdition({ validationReport: result.report });
  assert.equal(metadata.family, 'overflight');
  assert.equal(metadata.previewAvailable, false, 'no fabricated game preview is advertised');
});

test('service rejects unknown or incomplete Overflight dependencies even when submitted bytes match their hash', async () => {
  for (const alter of [
    (pack) => {
      pack.dependencies.effects.revision++;
    },
    (pack) => {
      pack.dependencies.soldiers.pop();
    },
    (pack) => {
      pack.project.resources.effects.id = 'unregistered';
      pack.dependencies.effects.id = 'unregistered';
    },
    (pack) => {
      pack.project.encounters[0].families = ['unknown'];
    },
    (pack) => {
      pack.project.sourceURL = 'https://example.invalid/run.js';
    },
  ]) {
    const pack = structuredClone(createOverflightPackage(createOverflightProject()));
    alter(pack);
    const result = await submit(pack);
    assert.equal(result.accepted, false);
    assert.equal(result.rejectionCode, 'package_validation_failed');
  }
});

test('existing native families retain their catalogue preview capability', () => {
  for (const family of ['creator', 'classic', 'team', 'fpv'])
    assert.equal(toPublicEdition({ validationReport: { family } }).previewAvailable, true);
  assert.equal(typeof readCreatorPreview, 'function');
});
