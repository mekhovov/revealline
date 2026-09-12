import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareScenario, browserDecodeImage, ScenarioImportError } from '../imports.mjs';
import { CONTENT_LIMITS } from '../content.mjs';
const theme = JSON.parse(readFileSync(new URL('../content/themes.json', import.meta.url), 'utf8'))
  .themes[0];
const classes = JSON.parse(
  readFileSync(new URL('../content/classes.json', import.meta.url), 'utf8'),
);
const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
const candidate = () => ({
  format: 'xonix-playground.v1',
  level: {
    version: 'xonix-level.v1',
    id: 'import-test',
    revision: '1',
    name: 'Import test',
    width: 48,
    height: 36,
    spawn: { x: 24.5, y: 0.5 },
    goal: { coverage: 0.5 },
  },
  theme: structuredClone(theme),
  settings: { classId: 'scout', turnPolicy: 'immediate', seed: 1 },
  visualOverrides: {},
});
const dimensions = { naturalWidth: 1, naturalHeight: 1 };
const decode = async () => ({ ...dimensions });
function header(width, height) {
  const bytes = Buffer.from(png.split(',')[1], 'base64');
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return `data:image/png;base64,${bytes.toString('base64')}`;
}

test('optional level arrays and registry normalize on a separate copy without browser allocation', async () => {
  const value = candidate(),
    before = structuredClone(value);
  let calls = 0;
  const result = await prepareScenario(value, {
    decodeImage: async () => {
      calls++;
      return dimensions;
    },
  });
  for (const key of ['walls', 'enemies', 'objectives', 'supplies'])
    assert.deepEqual(result.scenario.level[key], []);
  assert.ok(result.scenario.classRecipes.some((c) => c.id === 'scout'));
  assert.deepEqual(result.warnings, []);
  assert.equal(calls, 0);
  assert.deepEqual(value, before);
  result.scenario.theme.palette.safe = '#000000';
  assert.notEqual(value.theme.palette.safe, '#000000');
});
test('explicit and default fetched class recipes are independently copied', async () => {
  const registry = [{ ...classes[0], id: 'custom-scout' }],
    value = candidate();
  value.settings.classId = 'custom-scout';
  const result = await prepareScenario(value, { classRecipes: registry, decodeImage: decode });
  registry[0].cooldown = 20;
  assert.notEqual(result.scenario.classRecipes[0].cooldown, 20);
  assert.equal(value.classRecipes, undefined);
  const explicit = candidate();
  explicit.classRecipes = structuredClone(classes);
  const prepared = await prepareScenario(explicit, { classRecipes: registry, decodeImage: decode });
  prepared.scenario.classRecipes[0].cooldown = 40;
  assert.notEqual(explicit.classRecipes[0].cooldown, 40);
});
test('the original is validated before clone can invoke getters or discard forbidden data', async () => {
  let reads = 0,
    calls = 0;
  const value = candidate();
  Object.defineProperty(value.theme, 'name', {
    enumerable: true,
    get() {
      reads++;
      return 'should not execute';
    },
  });
  await assert.rejects(
    prepareScenario(value, {
      decodeImage: async () => {
        calls++;
        return dimensions;
      },
    }),
    /ordinary JSON/,
  );
  assert.equal(reads, 0);
  assert.equal(calls, 0);
  const forbidden = candidate();
  forbidden.metadata = JSON.parse('{"__proto__":{}}');
  await assert.rejects(prepareScenario(forbidden, { decodeImage: decode }), /forbidden/);
});
test('all image headers and aggregate budgets pass before any decoder is called', async () => {
  let calls = 0;
  const decoder = async () => {
    calls++;
    return dimensions;
  };
  const malformed = candidate();
  malformed.visualOverrides = {
    player: { dataUrl: png },
    background: { dataUrl: 'data:image/png;base64,AAAA' },
  };
  await assert.rejects(prepareScenario(malformed, { decodeImage: decoder }), /background/);
  assert.equal(calls, 0);
  const oversize = candidate();
  oversize.visualOverrides.background = { dataUrl: header(100000, 1) };
  await assert.rejects(prepareScenario(oversize, { decodeImage: decoder }), /8192/);
  assert.equal(calls, 0);
  const aggregate = candidate();
  for (const role of ['player', 'enemy', 'background'])
    aggregate.visualOverrides[role] = { dataUrl: header(4000, 4000) };
  await assert.rejects(prepareScenario(aggregate, { decodeImage: decoder }), /Combined decoded/);
  assert.equal(calls, 0);
});
test('decoders run one at a time and bytes, metadata, warnings and presentation survive', async () => {
  const value = candidate();
  value.presentation = { style: 'props', showGrid: true };
  value.visualOverrides = {
    player: { dataUrl: png, name: 'player.png', metadata: { rightsStatus: 'Original' } },
    enemy: { dataUrl: png, name: 'enemy.png' },
  };
  const before = structuredClone(value);
  const calls = [],
    gates = [];
  const pending = prepareScenario(value, {
    decodeImage: (url, context) => {
      calls.push({ url, ...context });
      return new Promise((resolve) => gates.push(resolve));
    },
  });
  assert.deepEqual(
    calls.map((c) => c.role),
    ['player'],
  );
  gates[0](dimensions);
  await Promise.resolve();
  assert.deepEqual(
    calls.map((c) => c.role),
    ['player', 'enemy'],
  );
  gates[1](dimensions);
  const result = await pending;
  assert.deepEqual(value, before);
  assert.deepEqual(result.scenario.visualOverrides, before.visualOverrides);
  assert.deepEqual(result.scenario.presentation, before.presentation);
  assert.ok(calls.every((c) => c.url === png));
  assert.match(result.warnings.join(), /anchors/);
});
test('caller edits during decoding cannot modify the in-flight validated snapshot', async () => {
  const value = candidate();
  value.visualOverrides.player = { dataUrl: png, name: 'original.png' };
  let complete;
  const pending = prepareScenario(value, {
    decodeImage: () => new Promise((resolve) => (complete = resolve)),
  });
  value.visualOverrides.player.dataUrl = 'data:text/html;base64,PHNjcmlwdD4=';
  value.theme.name = 'Edited later';
  complete(dimensions);
  const result = await pending;
  assert.equal(result.scenario.visualOverrides.player.dataUrl, png);
  assert.notEqual(result.scenario.theme.name, 'Edited later');
});
test('a failure stops subsequent decodes and leaves the caller current configuration intact', async () => {
  const value = candidate();
  value.visualOverrides = {
    player: { dataUrl: png },
    enemy: { dataUrl: png },
    boss: { dataUrl: png },
  };
  const before = structuredClone(value),
    originalCurrent = candidate();
  let current = originalCurrent;
  const calls = [];
  await assert.rejects(
    (async () => {
      current = (
        await prepareScenario(value, {
          decodeImage: async (_url, { role }) => {
            calls.push(role);
            if (role === 'enemy') throw new Error('Corrupt image');
            return dimensions;
          },
        })
      ).scenario;
    })(),
    (error) =>
      error instanceof ScenarioImportError &&
      error.role === 'enemy' &&
      error.code === 'image-decode-failed',
  );
  assert.deepEqual(calls, ['player', 'enemy']);
  assert.equal(current, originalCurrent);
  assert.deepEqual(value, before);
});
test('decoded natural dimensions must be finite integer dimensions matching the bounded header', async () => {
  const value = candidate();
  value.visualOverrides.background = { dataUrl: png };
  for (const output of [
    null,
    {},
    { width: 1, height: 1 },
    { naturalWidth: 2, naturalHeight: 1 },
    { naturalWidth: NaN, naturalHeight: 1 },
    { naturalWidth: CONTENT_LIMITS.maxImageSide + 1, naturalHeight: 1 },
  ])
    await assert.rejects(
      prepareScenario(value, { decodeImage: async () => output }),
      (error) => error.code === 'image-dimensions-mismatch',
    );
});
test('malformed decoder options and explicitly null arrays reject without normalization', async () => {
  await assert.rejects(
    prepareScenario(candidate(), { decodeImage: null }),
    (error) => error.code === 'invalid-decoder',
  );
  const value = candidate();
  value.level.walls = null;
  await assert.rejects(prepareScenario(value, { decodeImage: decode }), /walls must be an array/);
  assert.equal(value.level.walls, null);
});

function fakeImage(t, { fail = false, decodeFailure = false } = {}) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'Image'),
    instances = [];
  class FakeImage {
    constructor() {
      this.naturalWidth = 1;
      this.naturalHeight = 1;
      this.decodeCalls = 0;
      this.removed = false;
      instances.push(this);
    }
    set src(value) {
      this.source = value;
      queueMicrotask(() => (fail ? this.onerror?.() : this.onload?.()));
    }
    async decode() {
      this.decodeCalls++;
      if (decodeFailure) throw new Error('decode failed');
    }
    removeAttribute(name) {
      if (name === 'src') this.removed = true;
    }
  }
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: FakeImage });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'Image', original);
    else delete globalThis.Image;
  });
  return instances;
}
test('browser decoder validates headers before allocating Image and clears its temporary surface', async (t) => {
  const images = fakeImage(t);
  await assert.rejects(browserDecodeImage('https://example.test/image.png'));
  assert.equal(images.length, 0);
  assert.deepEqual(await browserDecodeImage(png), dimensions);
  assert.equal(images.length, 1);
  assert.equal(images[0].source, png);
  assert.equal(images[0].decodeCalls, 1);
  assert.equal(images[0].removed, true);
  assert.equal(images[0].onload, null);
  assert.equal(images[0].onerror, null);
});
test('browser load failure rejects and cleans callbacks', async (t) => {
  const images = fakeImage(t, { fail: true });
  await assert.rejects(browserDecodeImage(png), (error) => error.code === 'image-decode-failed');
  assert.equal(images[0].removed, true);
  assert.equal(images[0].onerror, null);
});
test('browser complete-decode failure rejects after load', async (t) => {
  const images = fakeImage(t, { decodeFailure: true });
  await assert.rejects(browserDecodeImage(png), (error) => error.code === 'image-decode-failed');
  assert.equal(images[0].decodeCalls, 1);
  assert.equal(images[0].removed, true);
});
test('browser load still works without the optional Image.decode API', async (t) => {
  const images = fakeImage(t);
  delete globalThis.Image.prototype.decode;
  assert.deepEqual(await browserDecodeImage(png), dimensions);
  assert.equal(images[0].removed, true);
});
test('a non-browser environment receives a clear decoder-unavailable error', async (t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: undefined });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'Image', original);
    else delete globalThis.Image;
  });
  await assert.rejects(browserDecodeImage(png), (error) => error.code === 'decoder-unavailable');
});
