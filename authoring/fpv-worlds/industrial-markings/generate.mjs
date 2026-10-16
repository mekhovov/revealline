/** Offline original mechanical motifs; no runtime registry or collision mutation. */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Document, NodeIO, getBounds, VERSION } from '@gltf-transform/core';
import validator from 'gltf-validator';
import { boundedJSON, exactKeys, required } from '../../../game/data-json.mjs';
import { resolveSimVisualCollection } from '../../../game/presentation/theme-system.mjs';
import { inspectImport } from '../../../optional-practice/civilian-fpv/world-content.mjs';
import { encodeSpritePNG } from '../../../scripts/produce-field-kit-sprites.mjs';

const base = new URL('./', import.meta.url);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const encode = (value) => Buffer.from(JSON.stringify(value, null, 2) + '\n');
export const MARKING_LIMITS = Object.freeze({
  glbBytes: 32768,
  atlasBytes: 8192,
  triangles: 12,
  textures: 1,
});
export function validateMarkingSource(input) {
  const source = boundedJSON(input, { maxBytes: 4096, maxDepth: 4, maxNodes: 96 });
  exactKeys(
    source,
    [
      'format',
      'id',
      'revision',
      'previous',
      'author',
      'license',
      'collection',
      'palette',
      'atlasSize',
      'gate',
      'pad',
      'motifs',
    ],
    'Marking source',
  );
  required(
    source.format === 'IndustrialMarkingSource.v1' &&
      /^[a-z][a-z0-9-]{2,63}$/.test(source.id) &&
      /^r[1-9][0-9]{0,3}$/.test(source.revision),
    'Invalid marking identity.',
  );
  required(
    source.previous === null || /^[a-f0-9]{64}$/.test(source.previous),
    'Invalid retained predecessor.',
  );
  required(
    typeof source.author === 'string' &&
      source.author.length <= 100 &&
      source.license === 'CC0-1.0',
    'Original source attribution required.',
  );
  exactKeys(source.collection, ['id', 'revision'], 'Collection dependency');
  const selection = resolveSimVisualCollection({
    collectionId: source.collection.id,
    revision: source.collection.revision,
  });
  required(
    !selection.fallbackReason && selection.collection?.id === source.collection.id,
    'Exact installed collection dependency unavailable.',
  );
  exactKeys(source.palette, ['ink', 'steel', 'enamel', 'guidance'], 'Palette');
  required(
    Object.values(source.palette).every((color) => /^#[a-f0-9]{6}$/i.test(color)),
    'Palette needs sRGB RGB colors.',
  );
  required(source.atlasSize === 128, 'Marking atlas must stay 128×128.');
  exactKeys(
    source.gate,
    ['apertureWidth', 'apertureHeight', 'plateWidth', 'plateHeight', 'clearance'],
    'Gate',
  );
  const g = source.gate;
  required(
    Object.values(g).every(Number.isFinite) &&
      g.apertureWidth >= 1 &&
      g.apertureWidth <= 8 &&
      g.apertureHeight >= 1 &&
      g.apertureHeight <= 8 &&
      g.plateWidth >= 0.1 &&
      g.plateWidth <= 0.3 &&
      g.plateHeight >= 0.2 &&
      g.plateHeight <= 0.6 &&
      g.clearance >= 0.01 &&
      g.clearance <= 0.05,
    'Marking dimensions exceed the bounded reference kit.',
  );
  exactKeys(source.pad, ['radius', 'hostRadius'], 'Pad');
  required(
    source.pad.hostRadius === 1.3 && source.pad.radius > 1 && source.pad.radius <= 1.28,
    'Pad marks must stay inside the existing 1.3m radius.',
  );
  exactKeys(source.motifs, ['gate', 'pad', 'swatches'], 'Motifs');
  required(
    source.motifs.gate === 'inward-chevron-v1' &&
      source.motifs.pad === 'h-ring-north-v1' &&
      source.motifs.swatches === 'srgb-step-wedge-v1',
    'Unknown registered mechanical motif.',
  );
  return source;
}
export function createMarkingAtlas(input) {
  const source = validateMarkingSource(input),
    rgba = new Uint8Array(128 * 128 * 4);
  const color = (value) => [1, 3, 5].map((at) => parseInt(value.slice(at, at + 2), 16));
  const colors = Object.fromEntries(
    Object.entries(source.palette).map(([key, value]) => [key, color(value)]),
  );
  const pixel = (x, y, c, alpha = 255) => rgba.set([...c, alpha], (y * 128 + x) * 4);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      // Quiet steel plate with four-pixel bevel; mechanical chevrons remain away from its edge.
      const border = x < 4 || x > 59 || y < 4 || y > 59;
      let c = border ? colors.ink : colors.steel;
      const chevron = x >= 14 && x <= 49 && y >= 12 && y <= 51 && (y + Math.abs(x - 32)) % 16 < 6;
      if (chevron) c = colors.guidance;
      if ((x === 8 || x === 55) && (y === 8 || y === 55)) c = colors.enamel;
      pixel(x, y, c);
      const dx = x - 31.5,
        dy = y - 31.5,
        radius = Math.hypot(dx, dy);
      if (radius > 30) {
        pixel(x + 64, y, colors.enamel, 0);
        continue;
      }
      c = colors.enamel;
      const ring = radius >= 24 && radius <= 27;
      const h =
        (((x >= 21 && x <= 25) || (x >= 38 && x <= 42)) && y >= 22 && y <= 43) ||
        (x >= 25 && x <= 38 && y >= 30 && y <= 35);
      const north = y >= 8 && y <= 16 && Math.abs(dx) <= (y - 8) * 0.8;
      const tick =
        (Math.abs(dx) <= 1 && Math.abs(dy) >= 27) || (Math.abs(dy) <= 1 && Math.abs(dx) >= 27);
      if (ring || h || north || tick) c = colors.ink;
      if (radius >= 28 && radius <= 29 && y < 15) c = colors.guidance;
      pixel(x + 64, y, c);
    }
  // A texture-based neutral wedge is compared to linear-factor material swatches in the viewer.
  const wedge = [0, 64, 118, 192, 255];
  for (let y = 64; y < 128; y++)
    for (let x = 0; x < 128; x++) {
      if (x < 64) {
        const value = wedge[Math.min(4, Math.floor(x / 12.8))];
        pixel(x, y, [value, value, value]);
      } else
        pixel(
          x,
          y,
          colors[['ink', 'steel', 'enamel', 'guidance'][Math.min(3, Math.floor((x - 64) / 16))]],
        );
    }
  return { width: 128, height: 128, rgba };
}
const corners = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];
export async function buildMarkingKit(input) {
  const source = validateMarkingSource(input);
  const sourceBytes = typeof input === 'string' ? Buffer.from(input) : encode(source);
  required(
    VERSION === 'v4.5.1' && validator.version() === '2.0.0-dev.3.10',
    'Use the pinned authoring toolchain.',
  );
  const atlas = createMarkingAtlas(source),
    png = encodeSpritePNG(atlas),
    document = new Document();
  const scene = document.createScene('Industrial gate and landing marking kit');
  document.getRoot().setDefaultScene(scene);
  const buffer = document.createBuffer(),
    texture = document
      .createTexture('Original sRGB markings')
      .setImage(png)
      .setMimeType('image/png');
  const material = document
    .createMaterial('Matte enamel markings')
    .setBaseColorTexture(texture)
    .setMetallicFactor(0)
    .setRoughnessFactor(0.86)
    .setAlphaMode('MASK')
    .setAlphaCutoff(0.5);
  material
    .getBaseColorTextureInfo()
    .setMagFilter(9729)
    .setMinFilter(9987)
    .setWrapS(33071)
    .setWrapT(33071);
  const groups = {};
  function group(role, translation, extras) {
    const node = document
      .createNode(role)
      .setTranslation(translation)
      .setExtras({
        markingAnchor: {
          format: 'IndustrialMarkingAnchor.v1',
          role,
          visualOnly: true,
          units: 'metres',
          ...extras,
        },
      });
    scene.addChild(node);
    groups[role] = node;
    return node;
  }
  function plane(parent, name, width, height, position, tile, horizontal = false) {
    const positions = [],
      normals = [],
      uv = [];
    for (const [x, y] of corners) {
      positions.push(
        ...(horizontal
          ? [(x * width) / 2, 0, (-y * height) / 2]
          : [(x * width) / 2, (y * height) / 2, 0]),
      );
      normals.push(...(horizontal ? [0, 1, 0] : [0, 0, 1]));
      uv.push(tile[0] + ((x + 1) * tile[2]) / 2, tile[1] + ((1 - y) * tile[3]) / 2);
    }
    const attribute = (name, type, array) =>
      document.createAccessor(name).setType(type).setArray(array).setBuffer(buffer);
    const primitive = document
      .createPrimitive()
      .setAttribute('POSITION', attribute(name + ' positions', 'VEC3', new Float32Array(positions)))
      .setAttribute('NORMAL', attribute(name + ' normals', 'VEC3', new Float32Array(normals)))
      .setAttribute('TEXCOORD_0', attribute(name + ' UVs', 'VEC2', new Float32Array(uv)))
      .setIndices(attribute(name + ' indices', 'SCALAR', new Uint16Array([0, 1, 2, 0, 2, 3])))
      .setMaterial(material);
    parent.addChild(
      document
        .createNode(name)
        .setTranslation(position)
        .setMesh(document.createMesh(name).addPrimitive(primitive)),
    );
  }
  const g = source.gate,
    gate = group('gate', [-2.6, 0, 0], {
      aperture: { width: g.apertureWidth, height: g.apertureHeight },
      clearance: g.clearance,
    });
  for (const x of [-1, 1])
    for (const y of [0, 1])
      plane(
        gate,
        `gate-plate-${x}-${y}`,
        g.plateWidth,
        g.plateHeight,
        [
          x * (g.apertureWidth / 2 + g.clearance + g.plateWidth / 2),
          y ? g.apertureHeight - g.plateHeight / 2 : g.plateHeight / 2,
          0,
        ],
        [0, 0, 0.5, 0.5],
      );
  const pad = group('landing-pad', [2, 0, 0], {
    hostRadius: source.pad.hostRadius,
    visibleRadius: source.pad.radius,
    direction: '-Z',
  });
  plane(
    pad,
    'landing-h-ring',
    source.pad.radius * 2,
    source.pad.radius * 2,
    [0, 0.002, 0],
    [0.5, 0, 0.5, 0.5],
    true,
  );
  const wedge = group('calibration', [-0.5, 0.15, 1.5], { notForRuntime: true });
  plane(wedge, 'neutral-srgb-wedge', 1.6, 0.4, [0, 0, 0], [0, 0.5, 0.5, 0.5]);
  const io = new NodeIO(),
    glb = await io.writeBinary(document);
  const validation = await validator.validateBytes(glb, {
    uri: 'markings.glb',
    writeTimestamp: false,
    maxIssues: 100,
  });
  required(
    validation.issues.numErrors === 0 && validation.issues.numWarnings === 0,
    'Khronos Validator rejected the marking kit.',
  );
  required(
    glb.length <= MARKING_LIMITS.glbBytes && png.length <= MARKING_LIMITS.atlasBytes,
    'Marking kit exceeds its production proof budget.',
  );
  const imported = await inspectImport({
    files: { 'markings.glb': glb },
    entry: 'markings.glb',
    id: 'industrial-marking-kit',
  });
  required(
    imported.metadata.anchors.length === 0 && imported.metadata.colliders.length === 0,
    'Visual kit introduced gameplay semantics.',
  );
  const readback = await io.readBinary(glb);
  required(
    readback.getRoot().listTextures().length === 1 &&
      Buffer.from(readback.getRoot().listTextures()[0].getImage()).equals(png),
    'Embedded texture changed on GLB readback.',
  );
  const primitives = readback
    .getRoot()
    .listMeshes()
    .flatMap((mesh) => mesh.listPrimitives());
  const triangles = primitives.reduce(
    (sum, primitive) => sum + primitive.getIndices().getCount() / 3,
    0,
  );
  required(triangles <= MARKING_LIMITS.triangles, 'Marking geometry exceeds triangle budget.');
  const files = new Map([
    ['markings.png', png],
    ['markings.glb', Buffer.from(glb)],
  ]);
  const manifest = {
    format: 'IndustrialMarkingProof.v1',
    id: source.id,
    revision: source.revision,
    previous: source.previous,
    stage: 'produced',
    source: {
      path: 'source.json',
      sha256: hash(sourceBytes),
      encoding: typeof input === 'string' ? 'original-utf8' : 'canonical-json',
      author: source.author,
      license: source.license,
    },
    generator: {
      path: 'authoring/fpv-worlds/industrial-markings/generate.mjs',
      sha256: hash(await readFile(new URL('./generate.mjs', base))),
      pngEncoderSha256: hash(
        await readFile(new URL('../../../scripts/produce-field-kit-sprites.mjs', base)),
      ),
    },
    toolchain: {
      gltfTransform: VERSION,
      gltfValidator: validator.version(),
      lockfileSha256: hash(await readFile(new URL('../package-lock.json', base))),
    },
    dependency: { kind: 'installed-engine-builtin', collection: source.collection },
    color: {
      baseColor: 'sRGB',
      roughness: 'linear scalar 0.86',
      metalness: 'linear scalar 0',
      alpha: 'MASK 0.5',
      magFilter: 'LINEAR',
      minFilter: 'LINEAR_MIPMAP_LINEAR',
      wrap: 'CLAMP_TO_EDGE',
      normalMap: null,
      neutralSrgb: [0, 64, 118, 192, 255],
    },
    geometry: {
      units: 'metres',
      triangles,
      primitives: primitives.length,
      semanticAnchors: 0,
      colliders: 0,
      roles: Object.fromEntries(
        Object.entries(groups).map(([role, node]) => [
          role,
          {
            ...node.getExtras().markingAnchor,
            translation: node.getTranslation(),
            bounds: getBounds(node),
          },
        ]),
      ),
    },
    files: [...files].map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: hash(bytes) })),
    validation,
    review: {
      browser: 'pending',
      independentViewer: 'not-run',
      runtimeAdoption: 'not-installed',
      physics: 'no semantic nodes; existing course/proof source untouched',
    },
  };
  files.set('manifest.json', encode(manifest));
  return { source, atlas, files, manifest };
}
async function storedSource(directory) {
  const sourceText = await readFile(new URL('source.json', directory), 'utf8');
  const source = validateMarkingSource(sourceText);
  const revision = path.basename(fileURLToPath(directory));
  required(source.revision === revision, 'Source revision must match its retained directory.');
  const number = Number(revision.slice(1));
  if (number === 1)
    required(source.previous === null, 'First revision cannot invent a predecessor.');
  else {
    const previousBytes = await readFile(new URL(`../r${number - 1}/manifest.json`, directory));
    const previous = JSON.parse(previousBytes);
    required(
      source.previous === hash(previousBytes) &&
        previous.id === source.id &&
        previous.revision === `r${number - 1}`,
      'Exact preceding source receipt is required.',
    );
  }
  return sourceText;
}
export async function verifyStoredKit(directory = new URL('./r1/', base)) {
  const result = await buildMarkingKit(await storedSource(directory));
  for (const [name, bytes] of result.files)
    required(
      Buffer.from(await readFile(new URL(name, directory))).equals(bytes),
      `Stored ${name} differs; preserve prior revisions and produce a successor.`,
    );
  return result.manifest;
}
async function main() {
  const [action, revision = 'r1', ...extra] = process.argv.slice(2);
  required(
    extra.length === 0 &&
      ['--write', '--check'].includes(action) &&
      /^r[1-9][0-9]{0,3}$/.test(revision),
    'Use --write or --check with an optional retained revision, e.g. r2.',
  );
  const directory = new URL(`./${revision}/`, base);
  if (action === '--check') {
    const manifest = await verifyStoredKit(directory);
    console.log(
      JSON.stringify({
        status: 'verified-byte-identical',
        files: manifest.files,
        errors: manifest.validation.issues.numErrors,
        warnings: manifest.validation.issues.numWarnings,
      }),
    );
    return;
  }
  const result = await buildMarkingKit(await storedSource(directory));
  for (const [name, bytes] of result.files) {
    let old;
    try {
      old = await readFile(new URL(name, directory));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    required(
      !old || old.equals(bytes),
      `Refusing to replace immutable ${name}; create a new revision.`,
    );
  }
  for (const [name, bytes] of result.files)
    await writeFile(new URL(name, directory), bytes, { flag: 'wx' }).catch((error) => {
      if (error.code !== 'EEXIST') throw error;
    });
  console.log(JSON.stringify({ status: 'produced-not-reviewed', files: result.manifest.files }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main();
