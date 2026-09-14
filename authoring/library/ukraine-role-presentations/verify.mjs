import assert from 'node:assert/strict';
import { readFileSync, readdirSync, lstatSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { decodeRGBA } from '../fpv-role-presentations/png.mjs';
import { validatePresentations, BODY_IDS, BASE_COMMIT, wingEnvelopes } from './model.mjs';

const fixed = [
  {
    classId: 'scout',
    sha256: '2b0261e7eb78d3f5818b8e537fabc148111425c2d3bad2036d2034b4f4152bf2',
    promptSha256: 'e45a42a8c8df496e10f9e5c27deed2fa0536babe2bdd245793d4555034ae34f8',
  },
  {
    classId: 'bomber',
    sha256: 'b6bde2c3e46a26f941e4abf61e03105d3b51c58633eaad979574ec1fbc70f698',
    promptSha256: '8bd6d3504c4dcd2a84b64f559b951da8b417b1a82d0663df9ff658ed7bd0b6e5',
  },
  {
    classId: 'carrier',
    sha256: 'e6b7e8f95aecd9adcadb3c550510d47368797d80b25dbeee78fae787c1461298',
    promptSha256: '8d28229d6ed2ac59920ea2a7240e4fec91fc8682550c55eaf9ba52b12064f8d2',
  },
  {
    classId: 'interceptor',
    sha256: 'bd426560dc79f5c9ada759a2a0752ca667b9c5456ee07aa3cbf6541429fb06ca',
    promptSha256: '146693231cfcebfcb756b84fc214e20f33214c730e2b9d80916f8cb050a5e2f4',
  },
  {
    classId: 'fiber',
    sha256: '564a3c32bf941aa5e3acfaddf34e52856489e84b9d47099ec8229a5ba5d35ca2',
    promptSha256: '6cbb8eea3e29eed63fcec46dcc736a1d8b7cf608acfb32c511e264b1c646cefe',
  },
  {
    classId: 'impact',
    sha256: 'f95bfe4337782a1ed459effa90c6785ae642e57e6525796b7e3fb8be3f3b284f',
    promptSha256: '9f3f734f5a6c5390334cad7c38eb8a491fb04e216000911f21b75193ee5da8cb',
  },
  {
    classId: 'trapper',
    sha256: 'b1b233045b71f277a0afea06650c173e358c3b0a05921ea2cc24fd3bab4e5b25',
    promptSha256: 'b4fbf7aacf4a69f0e6aac31df59cfa1943b54b53cdd57439142054ed32ea4ea7',
  },
];
const sourceNames = [
  'README.md',
  'PROMPTS.md',
  'index.html',
  'model.mjs',
  'presentations.json',
  'preview.mjs',
  'test.mjs',
  'verify.mjs',
];
const root = new URL('./', import.meta.url);
const read = (name) => readFileSync(new URL(name, root));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const objectKeys = (value, expected) =>
  assert.deepEqual(Object.keys(value).sort(), expected.split(' ').sort());

/** A hollow socket may have transparent pixels at its exact center. Record that
 * alpha honestly, and require nearby substantial original pixels at the rim.
 */
function attachmentWitness(pixels, width, height, [ax, ay, side]) {
  const x = Math.round((ax + 0.5) * width),
    y = Math.round((ay + 0.5) * height);
  const radius = Math.ceil(Math.min(width, height) * 0.04);
  let closest = null;
  for (let py = Math.max(0, y - radius); py <= Math.min(height - 1, y + radius); py++)
    for (let px = Math.max(0, x - radius); px <= Math.min(width - 1, x + radius); px++) {
      const alpha = pixels[(py * width + px) * 4 + 3],
        distance = Math.hypot(px - x, py - y);
      if (alpha >= 128 && distance <= radius && (!closest || distance < closest.distance))
        closest = { x: px, y: py, alpha, distance };
    }
  assert.ok(closest, 'Wing pivot must attach near the visible original, not float in empty space.');
  return {
    x,
    y,
    side,
    alpha: pixels[(y * width + x) * 4 + 3],
    maximumWitnessDistance: radius,
    closest,
  };
}

export function verifyBatch({ toolOriginals = false } = {}) {
  const data = validatePresentations(read('presentations.json').toString());
  assert.equal(data.baseCommit, BASE_COMMIT);
  assert.deepEqual(
    readdirSync(root).sort(),
    [...sourceNames, 'originals', 'provenance'].sort(),
    'Exact owned source inventory.',
  );
  const files = [...sourceNames];
  for (const dir of ['originals', 'provenance']) {
    assert.ok(lstatSync(new URL(dir, root)).isDirectory());
    const names = fixed.map((r) => `${r.classId}.${dir === 'originals' ? 'png' : 'json'}`);
    assert.deepEqual(readdirSync(new URL(dir, root)).sort(), names.sort());
    files.push(...names.map((name) => `${dir}/${name}`));
  }
  const pins = files.sort().map((path) => {
    assert.ok(lstatSync(new URL(path, root)).isFile(), 'Ordinary source files only.');
    const bytes = read(path);
    return { path, bytes: bytes.length, sha256: sha(bytes) };
  });
  const images = [];
  for (const [i, role] of data.roles.entries()) {
    const original = read(role.body.src),
      provBytes = read(role.provenance);
    assert.ok(provBytes.length < 16 * 1024);
    const prov = JSON.parse(provBytes);
    objectKeys(
      prov,
      'format classId bodyId title tool generationMode prompt promptSha256 requestedDimensions actualDimensions original transformations visualObservations referenceUse runtimeBinding reviewStatus',
    );
    objectKeys(prov.original, 'path bytes sha256 defaultToolPath');
    assert.equal(prov.format, 'ukraine-role-original.v1');
    assert.equal(prov.classId, role.classId);
    assert.equal(prov.bodyId, BODY_IDS[i]);
    assert.equal(prov.title, role.title);
    assert.equal(prov.tool, 'image_gen.imagegen');
    assert.equal(prov.generationMode, 'built-in original generation; no reference image uploaded');
    assert.equal(prov.promptSha256, fixed[i].promptSha256);
    assert.equal(sha(prov.prompt), fixed[i].promptSha256);
    assert.deepEqual(prov.requestedDimensions, [1024, 1024]);
    assert.deepEqual(prov.actualDimensions, [role.width, role.height]);
    assert.deepEqual(prov.transformations, []);
    assert.equal(prov.runtimeBinding, null);
    assert.ok(
      Array.isArray(prov.visualObservations) &&
        prov.visualObservations.length === 3 &&
        prov.visualObservations.every((s) => typeof s === 'string' && s.length < 500),
    );
    assert.ok(
      typeof prov.referenceUse === 'string' && prov.referenceUse.includes('No reference pixels'),
    );
    assert.equal(
      prov.reviewStatus,
      'Author inspected original; assembled motion and independent source review pending.',
    );
    assert.equal(prov.original.path, role.body.src);
    assert.equal(prov.original.bytes, original.length);
    assert.equal(sha(original), fixed[i].sha256);
    assert.equal(role.sha256, fixed[i].sha256);
    assert.equal(prov.original.sha256, fixed[i].sha256);
    assert.match(
      prov.original.defaultToolPath,
      /^\/Users\/oleksandr\.mekhovov\/\.codex\/generated_images\/[0-9a-f-]+\/exec-[0-9a-f-]+\.png$/,
    );
    if (toolOriginals) {
      assert.ok(lstatSync(prov.original.defaultToolPath).isFile());
      assert.deepEqual(readFileSync(prov.original.defaultToolPath), original);
    }
    const { pixels, ...decoded } = decodeRGBA(original);
    assert.deepEqual([decoded.width, decoded.height], [role.width, role.height]);
    assert.ok(
      decoded.alpha.zero > (decoded.width * decoded.height) / 4,
      'Actual transparent background, not just a type6 header.',
    );
    assert.ok(
      decoded.nearOpaque > (decoded.width * decoded.height) / 10,
      'Substantial near-opaque original pixels.',
    );
    const b = decoded.substantialBounds;
    assert.ok(
      b && b.left > 0 && b.top > 0 && b.right < decoded.width - 1 && b.bottom < decoded.height - 1,
      'Substantial silhouette has a margin.',
    );
    const component = role.recipe.components[0];
    images.push({
      classId: role.classId,
      bytes: original.length,
      sha256: sha(original),
      ...decoded,
      attachments: component.anchors.map((a) =>
        attachmentWitness(pixels, decoded.width, decoded.height, a),
      ),
      wingEnvelopes: wingEnvelopes(component),
      toolOriginalEqual: toolOriginals ? true : null,
    });
  }
  return {
    format: 'ukraine-role-verification.v1',
    baseCommit: data.baseCommit,
    sourceOnly: true,
    toolOriginals,
    imageCount: images.length,
    imageBytes: images.reduce((n, r) => n + r.bytes, 0),
    independentRecipes: 7,
    images,
    files: pins,
    limits:
      'Original-byte, alpha, source-model and attachment verification only. Actual-size motion, ability, gameplay, device and runtime adoption remain separate; no fourteen-treatment or production approval claim.',
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2),
    toolOriginals = args.includes('--tool-originals'),
    recordIndex = args.indexOf('--record');
  assert.ok(
    args.filter((a) => a === '--record').length <= 1 &&
      args.filter((a) => a === '--tool-originals').length <= 1,
  );
  assert.ok(
    args.every(
      (a, i) =>
        a === '--tool-originals' || a === '--record' || (recordIndex >= 0 && i === recordIndex + 1),
    ),
    'Only --tool-originals and --record PATH are supported.',
  );
  if (recordIndex >= 0)
    assert.ok(
      args[recordIndex + 1] && !args[recordIndex + 1].startsWith('--'),
      'Record path required.',
    );
  const result = verifyBatch({ toolOriginals });
  if (recordIndex >= 0)
    writeFileSync(args[recordIndex + 1], JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(
    JSON.stringify({
      images: result.imageCount,
      bytes: result.imageBytes,
      rigs: result.independentRecipes,
      sourceFiles: result.files.length,
      toolOriginals,
      script: fileURLToPath(import.meta.url),
    }),
  );
}
