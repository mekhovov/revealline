import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  buildMarkingKit,
  createMarkingAtlas,
  verifyStoredKit,
  validateMarkingSource,
} from '../authoring/fpv-worlds/industrial-markings/generate.mjs';
import { prepareWorldFile } from './fpv-content.mjs';
import * as THREE from '../optional-practice/civilian-fpv/vendor/three.module.js';
import {
  createMarkingLoader,
  requireMarkingColorTexture,
} from '../authoring/fpv-worlds/industrial-markings/loader.mjs';
const require = createRequire(new URL('../authoring/fpv-worlds/package.json', import.meta.url));
const { NodeIO } = await import(pathToFileURL(require.resolve('@gltf-transform/core')).href);
const validator = require('gltf-validator');
const sourceText = await readFile(
  new URL('../authoring/fpv-worlds/industrial-markings/r1/source.json', import.meta.url),
  'utf8',
);
const source = JSON.parse(sourceText);
const geometry = (document) =>
  document
    .getRoot()
    .listNodes()
    .filter((node) => node.getMesh())
    .map((node) => ({
      name: node.getName(),
      matrix: node.getWorldMatrix(),
      primitives: node
        .getMesh()
        .listPrimitives()
        .map((primitive) => ({
          positions: [...primitive.getAttribute('POSITION').getArray()],
          normals: [...primitive.getAttribute('NORMAL').getArray()],
          uv: [...primitive.getAttribute('TEXCOORD_0').getArray()],
          indices: [...primitive.getIndices().getArray()],
        })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

test('actual runtime loader uses the image-element path for the exact embedded PNG and distinguishes decode failures', async (t) => {
  const self = Object.getOwnPropertyDescriptor(globalThis, 'self'),
    bitmap = Object.getOwnPropertyDescriptor(globalThis, 'createImageBitmap'),
    load = THREE.TextureLoader.prototype.load;
  t.after(() => {
    THREE.TextureLoader.prototype.load = load;
    if (self) Object.defineProperty(globalThis, 'self', self);
    else delete globalThis.self;
    if (bitmap) Object.defineProperty(globalThis, 'createImageBitmap', bitmap);
    else delete globalThis.createImageBitmap;
  });
  globalThis.self = globalThis;
  globalThis.createImageBitmap = () => {
    throw Error(
      'The viewer must not use ImageBitmapLoader fetch under the image-only blob policy.',
    );
  };
  const decoded = [];
  THREE.TextureLoader.prototype.load = function (url, onLoad, _progress, onError) {
    assert.ok(url.startsWith('blob:'));
    const texture = new THREE.Texture({ width: 128, height: 128 });
    // Node cannot decode browser images. Capture the real parser's embedded
    // payload while modeling only the final browser image-element callback.
    fetch(url)
      .then((response) => response.arrayBuffer())
      .then((bytes) => {
        decoded.push(Buffer.from(bytes));
        onLoad(texture);
      }, onError);
    return texture;
  };
  const glb = await readFile(
    new URL('../authoring/fpv-worlds/industrial-markings/r1/markings.glb', import.meta.url),
  );
  const result = await createMarkingLoader().parseAsync(
    glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength),
    '',
  );
  assert.equal(decoded.length, 1);
  assert.deepEqual(
    decoded[0],
    await readFile(
      new URL('../authoring/fpv-worlds/industrial-markings/r1/markings.png', import.meta.url),
    ),
  );
  let meshes = 0;
  result.scene.traverse((node) => {
    if (!node.isMesh) return;
    meshes++;
    assert.equal(requireMarkingColorTexture(node.material).colorSpace, THREE.SRGBColorSpace);
    assert.equal(node.material.map.flipY, false);
    node.geometry.dispose();
    node.material.map.dispose();
    node.material.dispose();
  });
  assert.equal(meshes, 6);
  assert.throws(() => requireMarkingColorTexture({}), /Embedded PNG could not be decoded/);
  assert.throws(
    () => requireMarkingColorTexture({ map: { colorSpace: THREE.NoColorSpace } }),
    /not sRGB/,
  );
});

test('stored kit regenerates exactly and passes the actual Khronos standards validator', async () => {
  const stored = await verifyStoredKit();
  assert.equal(stored.validation.validatorVersion, '2.0.0-dev.3.10');
  assert.equal(stored.validation.issues.numErrors, 0);
  assert.equal(stored.validation.issues.numWarnings, 0);
  assert.equal(stored.source.sha256, createHash('sha256').update(sourceText).digest('hex'));
  const first = await buildMarkingKit(sourceText),
    second = await buildMarkingKit(sourceText);
  for (const [name, bytes] of first.files) assert.deepEqual(second.files.get(name), bytes, name);
  const bad = Buffer.from(first.files.get('markings.glb'));
  const length = bad.readUInt32LE(12),
    json = bad.subarray(20, 20 + length).toString();
  const broken = json.replace('"componentType":5126', '"componentType":5125');
  assert.notEqual(broken, json);
  Buffer.from(broken).copy(bad, 20);
  const invalid = await validator.validateBytes(bad, { writeTimestamp: false });
  assert.ok(
    invalid.issues.numErrors > 0,
    'Standards validation must reject incompatible POSITION component type',
  );
});

test('gate marks stay outside their exact aperture; pad pixels retain quiet H/orientation and alpha envelope', async () => {
  const kit = await buildMarkingKit(sourceText),
    doc = await new NodeIO().readBinary(kit.files.get('markings.glb'));
  const gate = doc
    .getRoot()
    .listNodes()
    .find((node) => node.getName() === 'gate');
  for (const plate of gate.listChildren()) {
    const points = plate.getMesh().listPrimitives()[0].getAttribute('POSITION').getArray(),
      [tx, ty] = plate.getTranslation();
    for (let i = 0; i < points.length; i += 3) {
      assert.ok(Math.abs(tx + points[i]) >= source.gate.apertureWidth / 2 + 0.014999);
      assert.ok(
        ty + points[i + 1] >= -1e-6 && ty + points[i + 1] <= source.gate.apertureHeight + 1e-6,
      );
    }
  }
  const { rgba } = createMarkingAtlas(source),
    pixel = (x, y) => [...rgba.subarray((y * 128 + x) * 4, (y * 128 + x) * 4 + 4)];
  const ink = [0x27, 0x32, 0x35, 255];
  assert.deepEqual(pixel(64 + 22, 25), ink);
  assert.deepEqual(pixel(64 + 40, 25), ink);
  assert.deepEqual(pixel(64 + 32, 32), ink);
  assert.deepEqual(pixel(64 + 32, 12), ink);
  assert.equal(pixel(64 + 32, 19)[3], 255);
  assert.notDeepEqual(
    pixel(64 + 32, 19),
    ink,
    'Orientation triangle and H have a quiet separation',
  );
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++)
      if (pixel(x + 64, y)[3])
        assert.ok(
          Math.hypot(((x - 31.5) / 32) * source.pad.radius, ((y - 31.5) / 32) * source.pad.radius) <
            source.pad.hostRadius,
        );
  const png = kit.files.get('markings.png'),
    chunks = [];
  for (let offset = 8; offset < png.length; ) {
    const length = png.readUInt32BE(offset),
      kind = png.subarray(offset + 4, offset + 8).toString();
    if (kind === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const decoded = inflateSync(Buffer.concat(chunks));
  for (let y = 0; y < 128; y++) {
    assert.equal(decoded[y * 513], 0);
    assert.deepEqual(
      decoded.subarray(y * 513 + 1, (y + 1) * 513),
      Buffer.from(rgba.subarray(y * 512, (y + 1) * 512)),
    );
  }
});

test('existing world preparation preserves exact marking geometry and extracts no gameplay or collision authority', async () => {
  const kit = await buildMarkingKit(sourceText),
    folder = await mkdtemp(path.join(tmpdir(), 'industrial-marking-proof-'));
  try {
    const entry = path.join(folder, 'original.glb'),
      output = path.join(folder, 'prepared');
    await writeFile(entry, kit.files.get('markings.glb'));
    const prepared = await prepareWorldFile({
      entry,
      outputDirectory: output,
      id: 'industrial-marking-proof',
    });
    assert.deepEqual(prepared.project.source.anchors, []);
    assert.deepEqual(prepared.project.source.colliders, []);
    assert.deepEqual(prepared.project.courses, []);
    assert.equal(prepared.report.validation.before.issues.numErrors, 0);
    assert.equal(prepared.report.validation.after.issues.numErrors, 0);
    const io = new NodeIO(),
      before = await io.readBinary(kit.files.get('markings.glb')),
      after = await io.read(path.join(output, prepared.project.world.modelAsset));
    assert.deepEqual(geometry(after), geometry(before));
    assert.deepEqual(
      after.getRoot().listTextures()[0].getImage(),
      before.getRoot().listTextures()[0].getImage(),
    );
    assert.deepEqual(
      after
        .getRoot()
        .listNodes()
        .filter((node) => node.getExtras().markingAnchor)
        .map((node) => node.getExtras()),
      before
        .getRoot()
        .listNodes()
        .filter((node) => node.getExtras().markingAnchor)
        .map((node) => node.getExtras()),
    );
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test('portable recoloring keeps geometry while exact missing dependencies and unsafe source metadata fail closed', async () => {
  const baseline = await buildMarkingKit(sourceText),
    variant = structuredClone(source);
  variant.id = 'dos-gate-pad';
  variant.collection = { id: 'dos', revision: 'r1' };
  variant.palette.guidance = '#88dd99';
  const alternate = await buildMarkingKit(variant),
    io = new NodeIO();
  assert.deepEqual(
    geometry(await io.readBinary(baseline.files.get('markings.glb'))),
    geometry(await io.readBinary(alternate.files.get('markings.glb'))),
  );
  assert.notDeepEqual(alternate.files.get('markings.png'), baseline.files.get('markings.png'));
  assert.deepEqual(alternate.manifest.dependency.collection, variant.collection);
  for (const bad of [
    { ...source, code: 'arbitrary' },
    { ...source, collection: { id: 'industrial-workshop', revision: 'r999' } },
    { ...source, pad: { radius: 2, hostRadius: 1.3 } },
    { ...source, palette: { ...source.palette, ink: 'url(secret)' } },
  ])
    assert.throws(() => validateMarkingSource(bad));
  let called = false;
  assert.throws(() =>
    validateMarkingSource({
      get format() {
        called = true;
        return source.format;
      },
    }),
  );
  assert.equal(called, false);
});

test('successor receipts require the exact retained predecessor and refuse changed stored output', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'industrial-marking-history-'));
  try {
    const first = await buildMarkingKit(sourceText);
    const write = async (revision, text, kit) => {
      const directory = path.join(folder, revision);
      await mkdir(directory);
      await writeFile(path.join(directory, 'source.json'), text);
      for (const [name, bytes] of kit.files) await writeFile(path.join(directory, name), bytes);
      return pathToFileURL(directory + path.sep);
    };
    await write('r1', sourceText, first);
    const successor = {
      ...structuredClone(source),
      revision: 'r2',
      previous: createHash('sha256').update(first.files.get('manifest.json')).digest('hex'),
    };
    successor.palette.guidance = '#fac769';
    const text = JSON.stringify(successor, null, 2) + '\n';
    const directory = await write('r2', text, await buildMarkingKit(text));
    assert.equal((await verifyStoredKit(directory)).revision, 'r2');
    await writeFile(
      new URL('source.json', directory),
      JSON.stringify({ ...successor, previous: '0'.repeat(64) }),
    );
    await assert.rejects(verifyStoredKit(directory), /Exact preceding source receipt/);
    await writeFile(new URL('source.json', directory), text);
    await writeFile(new URL('markings.glb', directory), 'substituted');
    await assert.rejects(verifyStoredKit(directory), /Stored markings.glb differs/);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
