import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { INDUSTRIAL_ENVIRONMENT_DATA as data } from '../presentation/industrial-environments-data.mjs';
import {
  hasIndustrialEnvironmentSource,
  prepareIndustrialEnvironmentSource,
  prepareIndustrialRoomEnvironmentSource,
  acceptIndustrialEnvironment,
  validateIndustrialEnvironmentPin,
  restoreIndustrialEnvironment,
  resolveIndustrialEnvironment,
} from '../presentation/industrial-environments.mjs';
import {
  industrialTexturePixels,
  getArcadeCollection,
  getArcadePalette,
  createArcadeAdapter,
} from '../presentation/industrial-arcade.mjs';
import { industrialMaterialPixels } from '../presentation/industrial-materials.mjs';
import { INDUSTRIAL_BUILTIN_SPRITES } from '../presentation/industrial-arcade-builtins.mjs';
import {
  collectIndustrialEnvironmentSources,
  assertIndustrialEnvironmentRetention,
} from '../../scripts/produce-industrial-environments.mjs';
const catalogue = await collectIndustrialEnvironmentSources();
const appearance = {
  collection: { id: 'military-field', revision: 'r1' },
  artRevision: 'industrial-roster-v3',
};
const args = (row) => ({
  engine: row.tuple[0],
  mode: row.tuple[1],
  source: row.source,
  origin: {
    kind: 'builtin',
    catalogueId: row.tuple[2],
    catalogueRevision: row.tuple[3],
    sourceForm: row.tuple[4],
  },
});
const ordinary = catalogue.sources.filter((row) => !row.roomCatalogueId);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const prepare = (row) =>
  row.roomCatalogueId
    ? prepareIndustrialRoomEnvironmentSource({
        family: row.tuple[0],
        mode: row.tuple[1],
        catalogueId: row.roomCatalogueId,
        source: row.source,
      })
    : prepareIndustrialEnvironmentSource(args(row));

test('all fourteen chapters and exact local/native-room source forms admit', async () => {
  assert.equal(catalogue.chapters.length, 14);
  assert.equal(ordinary.length, 324);
  assert.equal(catalogue.sources.filter((row) => row.roomCatalogueId).length, 276);
  assert.equal(catalogue.roomAliases.length, 756);
  const engines = new Set(),
    chapters = new Set();
  for (const row of catalogue.sources) {
    const candidate = await prepare(row);
    assert.ok(candidate, row.sourceKey);
    const pin = acceptIndustrialEnvironment(candidate, appearance);
    assert.equal(pin.sourceKey, row.sourceKey);
    assert.equal(pin.contentSha256, row.contentSha256);
    assert.equal(resolveIndustrialEnvironment(pin).id, `industrial-env-${row.chapterId}`);
    engines.add(row.tuple[0]);
    chapters.add(row.chapterId);
  }
  assert.deepEqual([...engines].sort(), ['capture', 'sim', 'snake']);
  assert.equal(chapters.size, 14);
});
test('full native content and exact owner/form are required; custom copied IDs grant nothing', async () => {
  for (const engine of ['capture', 'snake', 'sim']) {
    const row = ordinary.find((r) => r.tuple[0] === engine),
      value = args(row);
    assert.ok(
      hasIndustrialEnvironmentSource({
        engine,
        mode: value.mode,
        id: value.source.id,
        revision: value.source.revision,
      }),
    );
    assert.equal(
      await prepareIndustrialEnvironmentSource({
        ...value,
        source: { ...value.source, description: 'Changed authored content' },
      }),
      null,
    );
    for (const origin of [
      { ...value.origin, kind: 'company' },
      { ...value.origin, kind: 'custom' },
      { ...value.origin, catalogueRevision: 'unregistered' },
      { ...value.origin, sourceForm: 'unregistered' },
    ])
      assert.equal(await prepareIndustrialEnvironmentSource({ ...value, origin }), null);
  }
});
test('source is snapshotted before asynchronous hashing and rejects executable structures', async () => {
  const row = ordinary.find((r) => r.tuple[0] === 'snake'),
    value = args(row),
    source = structuredClone(value.source);
  const pending = prepareIndustrialEnvironmentSource({ ...value, source });
  source.id = 'changed-after-request';
  assert.ok(await pending);
  let executed = 0;
  const origin = { ...value.origin };
  Object.defineProperty(origin, 'kind', {
    get() {
      executed++;
      return 'builtin';
    },
    enumerable: true,
  });
  await assert.rejects(prepareIndustrialEnvironmentSource({ ...value, origin }), /accessors/);
  assert.equal(executed, 0);
  const hostile = { ...value.source };
  Object.defineProperty(hostile, 'id', {
    get() {
      executed++;
      return row.source.id;
    },
    enumerable: true,
  });
  await assert.rejects(
    prepareIndustrialEnvironmentSource({ ...value, source: hostile }),
    /accessors/,
  );
  assert.equal(executed, 0);
});
test('cancellation retires both preparation and later synchronous acceptance', async () => {
  const value = args(ordinary[0]),
    controller = new AbortController();
  controller.abort();
  await assert.rejects(
    prepareIndustrialEnvironmentSource({ ...value, signal: controller.signal }),
    { name: 'AbortError' },
  );
  const later = new AbortController(),
    candidate = await prepareIndustrialEnvironmentSource({ ...value, signal: later.signal });
  later.abort();
  assert.throws(() => acceptIndustrialEnvironment(candidate, appearance), { name: 'AbortError' });
});
test('only matching accepted appearance activates; copied candidate and pin are not authority', async () => {
  const candidate = await prepare(ordinary[0]);
  assert.equal(acceptIndustrialEnvironment(candidate, { ...appearance, artRevision: null }), null);
  assert.equal(
    acceptIndustrialEnvironment(candidate, {
      ...appearance,
      collection: { id: 'industrial-workshop', revision: 'r1' },
    }),
    null,
  );
  assert.throws(() => acceptIndustrialEnvironment({ ...candidate }, appearance), /authority/);
  const pin = acceptIndustrialEnvironment(candidate, appearance),
    copy = validateIndustrialEnvironmentPin(pin);
  assert.notEqual(copy, pin);
  assert.deepEqual(copy, pin);
  assert.ok(Object.isFrozen(copy));
  assert.throws(() => resolveIndustrialEnvironment(copy), /accepted or restored/);
  assert.throws(
    () => resolveIndustrialEnvironment(JSON.parse(JSON.stringify(pin))),
    /accepted or restored/,
  );
  assert.equal(resolveIndustrialEnvironment(null), null);
});
test('historical absence remains absent; malformed or mismatched restore rejects', async () => {
  const first = await prepare(ordinary[0]),
    second = await prepare(ordinary[1]),
    pin = acceptIndustrialEnvironment(first, appearance);
  assert.equal(restoreIndustrialEnvironment(null, null), null);
  assert.equal(restoreIndustrialEnvironment(undefined, null), null);
  assert.throws(
    () => restoreIndustrialEnvironment({ ...pin, appearanceSha256: '0'.repeat(64) }, first),
    /Unknown or changed/,
  );
  assert.throws(() => restoreIndustrialEnvironment(pin, second), /does not match/);
  assert.throws(() => validateIndustrialEnvironmentPin({ ...pin, executable: 'no' }), /fields/);
  const restored = restoreIndustrialEnvironment(JSON.parse(JSON.stringify(pin)), first);
  assert.notEqual(restored, pin);
  assert.equal(resolveIndustrialEnvironment(restored), resolveIndustrialEnvironment(pin));
});
test('room labels cannot admit modified state or incompatible paired mode', async () => {
  const row = catalogue.sources.find((r) => r.roomCatalogueId && r.tuple[0] === 'snake'),
    value = {
      family: 'snake',
      mode: row.tuple[1],
      catalogueId: row.roomCatalogueId,
      source: row.source,
    };
  assert.ok(await prepareIndustrialRoomEnvironmentSource(value));
  assert.equal(
    await prepareIndustrialRoomEnvironmentSource({
      ...value,
      source: { ...row.source, revision: 'changed' },
    }),
    null,
  );
  assert.equal(
    await prepareIndustrialRoomEnvironmentSource({ ...value, catalogueId: 'network-owned-custom' }),
    null,
  );
  assert.equal(await prepareIndustrialRoomEnvironmentSource({ ...value, mode: 'solo' }), null);
});
test('producer rejects in-place source/definition/preparation mutations and removals', () => {
  assertIndustrialEnvironmentRetention(data, structuredClone(data));
  for (const mutate of [
    (next) => (next.sources[0][5] = 'f'.repeat(64)),
    (next) => next.sources.shift(),
    (next) => (next.owners[next.sources[0][1]][4] = 'changed-form'),
    (next) => (next.definitions[0].arcade['terrain.wall'].variant = 3),
    (next) => (next.roomAliases[0][4] = '0'.repeat(64)),
    (next) => {
      next.definitions.push({ ...next.definitions[0], revision: 2 });
      next.sources[0][6] = next.definitions.length - 1;
    },
  ]) {
    const changed = structuredClone(data);
    mutate(changed);
    assert.throws(() => assertIndustrialEnvironmentRetention(data, changed), /Retained|retained/);
  }
  const successor = structuredClone(data);
  successor.sources.push(['new-identity', ...successor.sources[0].slice(1)]);
  assert.doesNotThrow(() => assertIndustrialEnvironmentRetention(data, successor));
});
test('opaque chapter materials use unchanged v3 pixels at actual sizes and all six families', async () => {
  const families = new Set();
  for (const definition of data.definitions)
    for (const binding of Object.values(definition.arcade)) families.add(binding.material);
  assert.deepEqual([...families].sort(), [
    'concrete',
    'damaged',
    'earth',
    'masonry',
    'metal',
    'timber',
  ]);
  for (const row of ordinary.filter(
    (r, index, list) => list.findIndex((other) => other.chapterId === r.chapterId) === index,
  )) {
    const pin = acceptIndustrialEnvironment(await prepare(row), appearance),
      def = resolveIndustrialEnvironment(pin);
    for (const size of [16, 24, 32])
      for (const [slot, binding] of Object.entries(def.arcade)) {
        const frame = { width: size, height: size, rgba: new Uint8ClampedArray(size * size * 4) },
          pixels = industrialTexturePixels(
            frame,
            slot,
            getArcadeCollection('military-field', 'r1'),
            { reviewRevision: appearance.artRevision, environment: pin },
          );
        assert.deepEqual(
          pixels,
          industrialMaterialPixels(frame, binding.material, {
            revision: def.materialRevision,
            variant: binding.variant,
          }),
        );
        for (let i = 3; i < pixels.rgba.length; i += 4) assert.equal(pixels.rgba[i], 255);
        assert.equal(
          hash(pixels.rgba),
          def.assets
            .find((a) => a.material === binding.material && a.variant === binding.variant)
            .frames.find((f) => f.size === size).sha256,
        );
      }
  }
});
test('adapter preserves custom artwork and retires only owned chapter texture caches', async () => {
  const pin = acceptIndustrialEnvironment(await prepare(ordinary[0]), appearance),
    slot = 'terrain.wall',
    canvases = [];
  const adapter = createArcadeAdapter({
    reviewRevision: appearance.artRevision,
    canvasFactory() {
      const canvas = {
        getContext: () => ({
          drawImage() {},
          getImageData: () => ({ data: new Uint8ClampedArray(16 * 16 * 4) }),
          putImageData() {},
        }),
      };
      canvases.push(canvas);
      return canvas;
    },
  });
  const asset = {
      id: `${slot}.field-kit`,
      file: { sha256: INDUSTRIAL_BUILTIN_SPRITES[slot][0], width: 16, height: 16 },
    },
    image = { width: 16, height: 16 },
    frame = { image, asset, geometry: {} },
    base = { canvas: {}, image: () => frame };
  assert.equal(adapter.setEnvironment(pin), true);
  const derived = adapter.resolve(base, getArcadeCollection('military-field', 'r1')).image(slot);
  assert.notEqual(derived.image, image);
  assert.equal(adapter.setEnvironment(pin), false);
  assert.equal(canvases[0].width, 16);
  assert.throws(() => adapter.setEnvironment({ ...pin }), /accepted or restored/);
  assert.equal(canvases[0].width, 16);
  assert.equal(adapter.setEnvironment(null), true);
  assert.equal(canvases[0].width, 0);
  assert.equal(image.width, 16);
  adapter.setEnvironment(pin);
  const custom = { ...frame, asset: { ...asset, file: { ...asset.file, sha256: 'a'.repeat(64) } } };
  assert.equal(
    adapter
      .resolve({ canvas: {}, image: () => custom }, getArcadeCollection('military-field', 'r1'))
      .image(slot),
    custom,
  );
  adapter.clear();
  assert.ok(canvases.every((canvas) => canvas.width === 0));
});

test('accepted palettes require exact installed collection authority and are immutable', () => {
  const military = getArcadeCollection('military-field', 'r1');
  const palette = getArcadePalette(military);
  assert.ok(Object.isFrozen(palette));
  for (const role of ['paper', 'field', 'grid', 'ink', 'muted', 'accent', 'safe', 'danger'])
    assert.match(palette[role], /^#[a-f0-9]{6}$/i);
  assert.deepEqual(getArcadePalette(military), palette);
  for (const unknown of [
    null,
    {},
    { id: 'military-field', revision: 'r1' },
    { ...military },
    getArcadeCollection('military-field', 'r99'),
  ])
    assert.throws(() => getArcadePalette(unknown), /collection authority/);
  assert.notDeepEqual(getArcadePalette(getArcadeCollection('industrial-workshop', 'r1')), palette);
});
