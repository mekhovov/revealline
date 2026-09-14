import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, readdirSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { decodeRGBA } from '../fpv-role-presentations/png.mjs';
import { validateVariants, wingEnvelopes, BODY_IDS, PARENT_COMMIT } from './model.mjs';
const BASE = new URL('./', import.meta.url),
  ROOT = new URL('../../../', import.meta.url);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const FIXED = [
  {
    classId: 'scout',
    parentOriginal: {
      path: 'authoring/library/ukraine-role-presentations/originals/scout.png',
      bytes: 534913,
      sha256: '2b0261e7eb78d3f5818b8e537fabc148111425c2d3bad2036d2034b4f4152bf2',
    },
    attempts: [
      {
        stage: 'shape-edit',
        mode: 'built-in image edit',
        path: 'originals/scout-v2.png',
        bytes: 1693838,
        sha256: 'bcdc1a90631642a03b4dfe7a688410ad60d4f40103df351ae8cb4461dddfdc32',
        promptSha256: '29220efc31c5f55ccc7b97d09d89383f616d9245319e6c822d54e298ca65c7b4',
        inputImage: 'authoring/library/ukraine-role-presentations/originals/scout.png',
        inputSha256: '2b0261e7eb78d3f5818b8e537fabc148111425c2d3bad2036d2034b4f4152bf2',
        actualIHDR: [1254, 1254, 8, 2, 0, 0, 0],
      },
      {
        stage: 'alpha-edit',
        mode: 'built-in background extraction edit',
        path: 'originals/scout-v2-alpha.png',
        bytes: 1790849,
        sha256: '533055588fb7df9443fa321369521fbb78c1c11350647441f33468c129dac512',
        promptSha256: 'fafa21f772f97d7580dded4a7fb3aa7fff122e928358cd91c9c69939ed4d525f',
        inputImage: 'authoring/library/ukraine-role-wide-variants/originals/scout-v2.png',
        inputSha256: 'bcdc1a90631642a03b4dfe7a688410ad60d4f40103df351ae8cb4461dddfdc32',
        actualIHDR: [1254, 1254, 8, 2, 0, 0, 0],
      },
      {
        stage: 'fresh-original',
        mode: 'built-in original generation without reference input',
        path: 'originals/scout-v3.png',
        bytes: 736862,
        sha256: '25f9a6034a5c20e5cbb9aaa1e225a8deccd56ddd2dbb3bebec15f712fe3fa012',
        promptSha256: 'cb626a25a868350010e664e5389440fbdfccbef5ba6bbdc333038874b1ec0211',
        inputImage: null,
        inputSha256: null,
        actualIHDR: [1254, 1254, 8, 6, 0, 0, 0],
      },
    ],
  },
  {
    classId: 'interceptor',
    parentOriginal: {
      path: 'authoring/library/ukraine-role-presentations/originals/interceptor.png',
      bytes: 598045,
      sha256: 'bd426560dc79f5c9ada759a2a0752ca667b9c5456ee07aa3cbf6541429fb06ca',
    },
    attempts: [
      {
        stage: 'shape-edit',
        mode: 'built-in image edit',
        path: 'originals/interceptor-v2.png',
        bytes: 1706135,
        sha256: '29b675f99fb463227b322c58575587660a826638ff32bb965b8c3def15760e92',
        promptSha256: '658563cb69a85fadb239a3a3e1f7d57a57c205b4fe965099bdd2c68abcb42360',
        inputImage: 'authoring/library/ukraine-role-presentations/originals/interceptor.png',
        inputSha256: 'bd426560dc79f5c9ada759a2a0752ca667b9c5456ee07aa3cbf6541429fb06ca',
        actualIHDR: [1254, 1254, 8, 2, 0, 0, 0],
      },
      {
        stage: 'alpha-edit',
        mode: 'built-in background extraction edit',
        path: 'originals/interceptor-v2-alpha.png',
        bytes: 1646633,
        sha256: '51e539167100d1b14309ef5bfc5e84b14cf3bdc6af4ed02e1fe5928a8f4408b3',
        promptSha256: 'fafa21f772f97d7580dded4a7fb3aa7fff122e928358cd91c9c69939ed4d525f',
        inputImage: 'authoring/library/ukraine-role-wide-variants/originals/interceptor-v2.png',
        inputSha256: '29b675f99fb463227b322c58575587660a826638ff32bb965b8c3def15760e92',
        actualIHDR: [1254, 1254, 8, 2, 0, 0, 0],
      },
      {
        stage: 'fresh-original',
        mode: 'built-in original generation without reference input',
        path: 'originals/interceptor-v3.png',
        bytes: 695081,
        sha256: 'ffee4552c573b9fdc7e041ed94f5827183fc2622ed494a3a105eabbae08670a1',
        promptSha256: '1f407dccb6a949b6ae27c76af233d15294e91fb58184344b27e1ae626d0eddee',
        inputImage: null,
        inputSha256: null,
        actualIHDR: [1254, 1254, 8, 6, 0, 0, 0],
      },
    ],
  },
  {
    classId: 'fiber',
    parentOriginal: {
      path: 'authoring/library/ukraine-role-presentations/originals/fiber.png',
      bytes: 541570,
      sha256: '564a3c32bf941aa5e3acfaddf34e52856489e84b9d47099ec8229a5ba5d35ca2',
    },
    attempts: [
      {
        stage: 'shape-edit',
        mode: 'built-in image edit',
        path: 'originals/fiber-v2.png',
        bytes: 1763130,
        sha256: '89e4f2897f21fbf3a884725ad2ef1619b096c9dd615caa760e774e9b047ae4cf',
        promptSha256: '8f63e1d670d956e33783b988f5ccbe965aa0176d7010d13591e58eb444e8d29e',
        inputImage: 'authoring/library/ukraine-role-presentations/originals/fiber.png',
        inputSha256: '564a3c32bf941aa5e3acfaddf34e52856489e84b9d47099ec8229a5ba5d35ca2',
        actualIHDR: [1254, 1254, 8, 2, 0, 0, 0],
      },
      {
        stage: 'alpha-edit',
        mode: 'built-in background extraction edit',
        path: 'originals/fiber-v2-alpha.png',
        bytes: 2428365,
        sha256: '54310f723cdcafceec10372c251fea0d888f0cdd37c0f5eadacded8df3188234',
        promptSha256: 'fafa21f772f97d7580dded4a7fb3aa7fff122e928358cd91c9c69939ed4d525f',
        inputImage: 'authoring/library/ukraine-role-wide-variants/originals/fiber-v2.png',
        inputSha256: '89e4f2897f21fbf3a884725ad2ef1619b096c9dd615caa760e774e9b047ae4cf',
        actualIHDR: [1254, 1254, 8, 2, 0, 0, 0],
      },
      {
        stage: 'fresh-original',
        mode: 'built-in original generation without reference input',
        path: 'originals/fiber-v3.png',
        bytes: 887360,
        sha256: '50bbcd47f7c4ac2140c54a4c8aebc50a1de7fdf24fe7fb5caccbeb4fbcd2e2ea',
        promptSha256: 'bb4433c5d79e2b69ad09e25926643fc0cf833fac06f0ff3e6b8e3b231dbb9878',
        inputImage: null,
        inputSha256: null,
        actualIHDR: [1254, 1254, 8, 6, 0, 0, 0],
      },
    ],
  },
];
function files(dir, prefix = '') {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      assert.ok(!entry.isSymbolicLink(), 'No source symlinks.');
      return entry.isDirectory()
        ? files(new URL(entry.name + '/', dir), prefix + entry.name + '/')
        : [prefix + entry.name];
    })
    .sort();
}
export function verifyWideVariants({ toolOriginals = false } = {}) {
  const data = validateVariants(readFileSync(new URL('variants.json', BASE), 'utf8'));
  const expected = [
    'README.md',
    'variants.json',
    'model.mjs',
    'verify.mjs',
    'test.mjs',
    'index.html',
    ...FIXED.flatMap((r) => [
      'provenance/' + r.classId + '.json',
      ...r.attempts.map((a) => a.path),
    ]),
  ].sort();
  assert.deepEqual(files(BASE), expected);
  const images = [],
    sourceFiles = expected.map((path) => {
      const p = new URL(path, BASE);
      assert.ok(lstatSync(p).isFile());
      const b = readFileSync(p);
      return { path, bytes: b.length, sha256: sha(b) };
    });
  for (const [i, role] of data.roles.entries()) {
    const fixed = FIXED[i],
      prov = JSON.parse(readFileSync(new URL(role.provenance, BASE), 'utf8'));
    assert.equal(prov.format, 'ukraine-role-wide-lineage.v1');
    assert.equal(prov.classId, role.classId);
    assert.equal(prov.bodyId, BODY_IDS[i]);
    assert.equal(prov.parentCommit, PARENT_COMMIT);
    assert.equal(prov.runtimeBinding, null);
    assert.equal(prov.tool, 'image_gen.imagegen');
    assert.equal(prov.selectedStage, 'fresh-original');
    assert.deepEqual(prov.parentOriginal, fixed.parentOriginal);
    const parent = readFileSync(new URL(prov.parentOriginal.path, ROOT));
    assert.equal(parent.length, fixed.parentOriginal.bytes);
    assert.equal(sha(parent), fixed.parentOriginal.sha256);
    assert.equal(prov.attempts.length, 3);
    for (const [n, attempt] of prov.attempts.entries()) {
      const held = fixed.attempts[n];
      for (const key of Object.keys(held)) assert.deepEqual(attempt[key], held[key]);
      assert.equal(sha(attempt.prompt), held.promptSha256);
      assert.deepEqual(attempt.requestedDimensions, [1024, 1024]);
      assert.deepEqual(attempt.transformations, []);
      const body = readFileSync(new URL(held.path, BASE));
      assert.equal(body.length, held.bytes);
      assert.equal(sha(body), held.sha256);
      assert.equal(body.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      assert.deepEqual(
        [body.readUInt32BE(16), body.readUInt32BE(20), ...body.subarray(24, 29)],
        held.actualIHDR,
      );
      if (toolOriginals) {
        assert.match(
          attempt.defaultToolPath,
          /^\/Users\/oleksandr\.mekhovov\/\.codex\/generated_images\/[0-9a-f-]+\/exec-[0-9a-f-]+\.png$/,
        );
        assert.deepEqual(readFileSync(attempt.defaultToolPath), body);
      }
    }
    const selected = fixed.attempts[2];
    assert.equal(role.body.src, selected.path);
    assert.equal(role.sha256, selected.sha256);
    const { pixels, ...decoded } = decodeRGBA(readFileSync(new URL(role.body.src, BASE)));
    assert.deepEqual([decoded.width, decoded.height], [role.width, role.height]);
    const total = decoded.width * decoded.height;
    assert.ok(decoded.alpha.zero > total / 4, 'Real transparent background.');
    assert.ok(decoded.nearOpaque > total / 10, 'Substantial near-opaque body.');
    const b = decoded.substantialBounds;
    assert.ok(
      b && b.left > 0 && b.top > 0 && b.right < decoded.width - 1 && b.bottom < decoded.height - 1,
      'Full-frame silhouette margin.',
    );
    const roots = role.recipe.components[0].anchors.map(([x, y]) => {
      const px = Math.round((x + 0.5) * decoded.width),
        py = Math.round((y + 0.5) * decoded.height),
        alpha = pixels[(py * decoded.width + px) * 4 + 3];
      assert.ok(alpha >= 128, 'Root overlaps substantial original body.');
      return { x: px, y: py, alpha };
    });
    images.push({
      classId: role.classId,
      bytes: selected.bytes,
      sha256: selected.sha256,
      ...decoded,
      roots,
      wingEnvelopes: wingEnvelopes(role.recipe.components[0]),
    });
  }
  return {
    format: 'ukraine-wide-source-verification.v1',
    parentCommit: PARENT_COMMIT,
    sourceOnly: true,
    toolOriginals,
    images,
    sourceFiles,
    rejectedRGBOutputs: 6,
    limits:
      'Three fresh images fully decoded. Six rejected RGB outputs have byte/header checks only. Root alpha/envelope is not a visual connection or compact-readability score. No runtime or production approval.',
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2),
    record = args.indexOf('--record');
  assert.ok(
    args.filter((a) => a === '--record').length <= 1 &&
      args.filter((a) => a === '--tool-originals').length <= 1,
  );
  assert.ok(
    args.every(
      (a, i) => a === '--record' || a === '--tool-originals' || (record >= 0 && i === record + 1),
    ),
  );
  if (record >= 0) assert.ok(args[record + 1] && !args[record + 1].startsWith('--'));
  const result = verifyWideVariants({ toolOriginals: args.includes('--tool-originals') });
  if (record >= 0)
    writeFileSync(args[record + 1], JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(
    JSON.stringify({
      images: result.images.length,
      rejectedRGBOutputs: result.rejectedRGBOutputs,
      bytes: result.images.reduce((n, r) => n + r.bytes, 0),
    }),
  );
}
