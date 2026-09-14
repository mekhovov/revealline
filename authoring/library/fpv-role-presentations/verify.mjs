import assert from 'node:assert/strict';
import { readFileSync, readdirSync, lstatSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { decodeRGBA } from './png.mjs';
import { validatePresentations, BODY_IDS } from './model.mjs';

const fixed = [
  {
    classId: 'scout',
    sha256: '5d0b29fc773e08e8fdbed1e6a03726c7a16e2c5c06e89e163ab211d032cac957',
    promptSha256: 'a2dc2f9d70958bcf308fc36dc28ce80b3ffb5625b17ef00665ce4017ab07ed55',
  },
  {
    classId: 'bomber',
    sha256: '88d9a0fac33a45e8cac2dd752df042735deebb21ff172ae0ecf86d81e47826ca',
    promptSha256: '7b57509e7714f739c2bbdc53cd9681e2ad24b997ecd2a8d04ce1b7543bd9cafd',
  },
  {
    classId: 'carrier',
    sha256: '01ed2610a94fa9675d26a618647b8128d3443e111c941199012c72510ad40ad7',
    promptSha256: '62867a9d7ac801f8482112f67162b6be3a499d07e18bb6ab405fe674b1697080',
  },
  {
    classId: 'interceptor',
    sha256: '548431d87442a009fdc81b7561927eaaece164fbc2ade0c834ebd6d5f51f1a5b',
    promptSha256: '239061d65383de7efb68290d45934e5104185093d542449e38caf96c7d279568',
  },
  {
    classId: 'fiber',
    sha256: '6dd3f61124d17a262ee3cef747ea250e6828d5b69a244a13883d575cc97ddce8',
    promptSha256: 'bba7786db895b61dd7853a2564dafc95486d72cdc58d43343f55a7bb635974a3',
  },
  {
    classId: 'impact',
    sha256: '0999ede773d3cc70176347f39a19a96f05fc0dd96ac12b7fbd0d51304636d7ed',
    promptSha256: 'a020237b44ade66e2e5ef6b3f3a81f574d7e8ad9455b81dcba8dbce854f30f2e',
  },
  {
    classId: 'trapper',
    sha256: '13e4aec02c72bf2f4a7cd26eee43c0a5e963de6bee3af3dd62dd22498831c869',
    promptSha256: '73ba260b3dcaa502de1f7829b664c5b62fb616c02456ec9ed1c581cd8f60e2df',
  },
];
const root = new URL('./', import.meta.url);
const read = (name) => readFileSync(new URL(name, root));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const objectKeys = (value, expected) =>
  assert.deepEqual(Object.keys(value).sort(), expected.split(' ').sort());
const sourceNames = [
  'README.md',
  'PROMPTS.md',
  'index.html',
  'model.mjs',
  'png.mjs',
  'presentations.json',
  'preview.mjs',
  'test.mjs',
  'verify.mjs',
];

export function verifyBatch({ toolOriginals = false } = {}) {
  const data = validatePresentations(read('presentations.json').toString());
  assert.equal(data.baseCommit, '297cceb696fb75cc5e3a94426a3bed12e60c606a');
  assert.deepEqual(
    readdirSync(root).sort(),
    [...sourceNames, 'originals', 'provenance'].sort(),
    'Exact owned source inventory.',
  );
  const files = [...sourceNames];
  for (const dir of ['originals', 'provenance']) {
    assert.equal(lstatSync(new URL(dir, root)).isDirectory(), true);
    const names = fixed.map((r) => `${r.classId}.${dir === 'originals' ? 'png' : 'json'}`);
    assert.deepEqual(readdirSync(new URL(dir, root)).sort(), names.sort());
    files.push(...names.map((name) => `${dir}/${name}`));
  }
  const pins = files.sort().map((path) => {
    assert.ok(lstatSync(new URL(path, root)).isFile(), 'Ordinary files only.');
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
    assert.equal(prov.format, 'fpv-role-original.v1');
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
      'Author inspected original; independent source and visual review pending.',
    );
    assert.equal(prov.original.path, role.body.src);
    assert.equal(prov.original.bytes, original.length);
    assert.equal(sha(original), fixed[i].sha256);
    assert.equal(role.sha256, fixed[i].sha256);
    assert.equal(prov.original.sha256, fixed[i].sha256);
    assert.match(
      prov.original.defaultToolPath,
      /^\/Users\/oleksandr\.mekhovov\/\.codex\/generated_images\/01a09357-2b06-77f1-b001-1afd50d8bc73\/exec-[0-9a-f-]+\.png$/,
    );
    if (toolOriginals) {
      assert.ok(lstatSync(prov.original.defaultToolPath).isFile());
      assert.deepEqual(readFileSync(prov.original.defaultToolPath), original);
    }
    const { pixels, ...decoded } = decodeRGBA(original);
    assert.deepEqual([decoded.width, decoded.height], [role.width, role.height]);
    assert.ok(
      decoded.alpha.zero > (decoded.width * decoded.height) / 4,
      'Actual transparent background, not just color type6.',
    );
    assert.ok(
      decoded.nearOpaque > (decoded.width * decoded.height) / 10,
      'Substantial near-opaque craft pixels.',
    );
    const b = decoded.substantialBounds;
    assert.ok(
      b.left > 0 && b.top > 0 && b.right < decoded.width - 1 && b.bottom < decoded.height - 1,
      'Substantial silhouette has a margin.',
    );
    const hubs = role.body.rotors.map((anchor) => {
      const x = Math.round((anchor.x + 0.5) * decoded.width),
        y = Math.round((anchor.y + 0.5) * decoded.height);
      const alpha = pixels[(y * decoded.width + x) * 4 + 3];
      assert.ok(alpha >= 128, 'Authored hub is on the visible original.');
      return { x, y, alpha };
    });
    images.push({
      classId: role.classId,
      bytes: original.length,
      sha256: sha(original),
      ...decoded,
      hubs,
      toolOriginalEqual: toolOriginals ? true : null,
    });
  }
  const game = readFileSync(new URL('../../../game/ui/render.mjs', root), 'utf8');
  const renderer = read('preview.mjs').toString();
  const extract = (source) =>
    source.slice(
      source.indexOf('function playerPaintSize('),
      source.indexOf('\n}', source.indexOf('function playerPaintSize(')) + 2,
    );
  assert.ok(extract(game).startsWith('function playerPaintSize('));
  assert.equal(
    extract(renderer),
    extract(game),
    'Preview uses the exact current pure sizing function.',
  );
  return {
    format: 'fpv-role-verification.v1',
    baseCommit: data.baseCommit,
    sourceOnly: true,
    toolOriginals,
    imageCount: images.length,
    imageBytes: images.reduce((n, r) => n + r.bytes, 0),
    independentRecipes: 7,
    rotorHubs: images.reduce((n, r) => n + r.hubs.length, 0),
    images,
    files: pins,
    limits:
      'No runtime adoption, gameplay, physical-device, atlas/action-state or production approval claim. Low-alpha source fringes are retained and measured.',
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2),
    toolOriginals = args.includes('--tool-originals'),
    recordIndex = args.indexOf('--record');
  assert.ok(
    args.every(
      (arg, i) =>
        arg === '--tool-originals' ||
        arg === '--record' ||
        (i === recordIndex + 1 && recordIndex >= 0),
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
      hubs: result.rotorHubs,
      sourceFiles: result.files.length,
      toolOriginals,
      script: fileURLToPath(import.meta.url),
    }),
  );
}
