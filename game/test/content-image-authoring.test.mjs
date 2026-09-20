import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  loadMapReference,
  validateReferenceCrop,
  inspectManualImageMap,
} from '../content-design/image-authoring.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createDraftHistory } from '../content-design/drafts.mjs';
import { createImageWorkbench } from '../studio/image-workbench.mjs';

const png = await readFile(
  new URL('../content-design/assets/horizon-r1/first-return.png', import.meta.url),
);
const file = () => ({
  name: 'Original picture.png',
  type: 'image/png',
  size: png.length,
  arrayBuffer: async () => png,
});
function imageFactory({ mismatch = false, fail = false, never = false } = {}) {
  const image = {
    naturalWidth: mismatch ? 1 : png.readUInt32BE(16),
    naturalHeight: png.readUInt32BE(20),
    decode: async () => {
      if (fail) throw new Error('decode failure');
    },
    removeAttribute: () => {
      image.disposed = true;
    },
    set src(value) {
      image.url = value;
      if (!never) queueMicrotask(() => image.onload?.());
    },
  };
  return image;
}

test('image reference loading checks bounded original bytes, then decoded dimensions, without saving', async () => {
  const image = imageFactory();
  const result = await loadMapReference(file(), { createImage: () => image });
  assert.equal(result.width, 1774);
  assert.equal(result.height, 887);
  assert(image.url.startsWith('data:image/png;base64,'));
  assert.equal(image.onload, null);
  assert.equal(image.disposed, undefined);
  result.dispose();
  result.dispose();
  assert.equal(image.disposed, true);
});

test('hostile, malformed, oversized, mismatched and stalled references cannot become usable images', async () => {
  let allocations = 0;
  const createImage = () => {
    allocations++;
    return imageFactory();
  };
  for (const bad of [
    { ...file(), type: 'image/svg+xml' },
    { ...file(), size: 4 * 1024 * 1024 + 1 },
    { ...file(), size: 0 },
    { ...file(), size: png.length + 1 },
    { ...file(), size: 10, arrayBuffer: async () => new Uint8Array(10) },
  ])
    await assert.rejects(loadMapReference(bad, { createImage }));
  assert.equal(allocations, 0);
  for (const options of [{ mismatch: true }, { fail: true }, { never: true }]) {
    const image = imageFactory(options);
    await assert.rejects(loadMapReference(file(), { createImage: () => image, timeoutMs: 20 }));
    assert.equal(image.disposed, true);
    assert.equal(image.onload, null);
  }
  await assert.rejects(
    loadMapReference({ ...file(), arrayBuffer: () => new Promise(() => {}) }, { timeoutMs: 5 }),
    /timed out/,
  );
});

test('crop inspection rejects fractional, out-of-bounds, empty, hostile and non-finite input', () => {
  const crop = { x: 5, y: 10, w: 100, h: 50 };
  assert.deepEqual(validateReferenceCrop(crop, 200, 100), crop);
  for (const invalid of [
    { ...crop, x: -1 },
    { ...crop, x: 0.5 },
    { ...crop, w: 0 },
    { ...crop, w: 200 },
    { ...crop, h: Infinity },
    { ...crop, code: 'anything' },
    {},
  ])
    assert.throws(() => validateReferenceCrop(invalid, 200, 100));
  assert.throws(
    () =>
      validateReferenceCrop(
        {
          get x() {
            throw new Error('getter invoked');
          },
        },
        200,
        100,
      ),
    /accessors/,
  );
});

test('manual geometry is inspected atomically through all presets and preserves shared maps and history', () => {
  const source = createStarterProject();
  source.missions.push({ ...structuredClone(source.missions[0]), id: 'shared-copy' });
  const before = JSON.stringify(source);
  const result = inspectManualImageMap(source, 'nearby-shore', [
    { surface: 'foundations', x: 12, y: 12, w: 4, h: 3 },
    { surface: 'slow', x: 44, y: 20, w: 4, h: 3 },
  ]);
  assert.equal(JSON.stringify(source), before);
  assert.equal(result.candidate.maps.length, 2);
  assert.deepEqual(result.candidate.maps[0], source.maps[0]);
  assert.deepEqual(result.candidate.missions[1].map, source.missions[1].map);
  const compiled = compileContentProject(result.candidate);
  for (const preset of ['gentle', 'standard', 'expert']) {
    for (const mode of ['solo', 'versus']) {
      const manifest = resolveMission(compiled, 'nearby-shore', { difficulty: preset, mode });
      assert.equal(manifest.level.foundations.length, 2);
    }
  }
  const history = createDraftHistory(source);
  history.replace(result.candidate);
  assert.deepEqual(history.undo(), source);
  assert.deepEqual(history.redo(), result.candidate);
  assert.equal(JSON.stringify(result.candidate).includes('data:image'), false);
});

test('invalid queued geometry cannot partially apply or bypass the compiler', () => {
  const source = createStarterProject(),
    before = JSON.stringify(source);
  for (const rows of [
    [],
    [{ surface: 'spawn', x: 1, y: 1, w: 1, h: 1 }],
    [{ surface: 'walls', x: 30, y: 15, w: 5, h: 5 }],
    [{ surface: 'foundations', x: 0, y: 2, w: 3, h: 3 }],
    [{ surface: 'lethal', x: 12.5, y: 12, w: 4, h: 3 }],
    Array.from({ length: 129 }, () => ({ surface: 'slow', x: 12, y: 12, w: 4, h: 3 })),
  ])
    assert.throws(() => inspectManualImageMap(source, 'nearby-shore', rows));
  assert.equal(JSON.stringify(source), before);
});

function workbenchFixture(
  loadReference = (file) => loadMapReference(file, { createImage: () => imageFactory() }),
) {
  let source = createStarterProject(),
    applied = 0,
    played = null,
    difficulty = 'expert';
  const elements = new Map();
  const context = new Proxy(
    {},
    {
      get: (target, key) => target[key] ?? (() => {}),
      set: (target, key, value) => {
        target[key] = value;
        return true;
      },
    },
  );
  const $ = (id) => {
    if (!elements.has(id))
      elements.set(id, {
        value: '',
        checked: false,
        disabled: false,
        width: 1008,
        hidden: false,
        textContent: '',
        files: [],
        getContext: () => context,
      });
    return elements.get(id);
  };
  const api = createImageWorkbench({
    loadReference,
    document: { getElementById: $ },
    getSource: () => source,
    getMission: () => source.missions[0],
    getDifficulty: () => difficulty,
    redraw: () => {},
    apply: (candidate) => {
      applied++;
      source = candidate;
      api.sync();
      return true;
    },
    play: (candidate, missionId, difficulty) => {
      played = { candidate, missionId, difficulty };
    },
  });
  api.sync();
  return {
    $,
    api,
    getSource: () => source,
    mutate: () => {
      source.name = 'Changed after inspection';
    },
    replace: (next) => {
      source = structuredClone(next);
      api.sync();
    },
    difficulty: (next) => {
      difficulty = next;
      api.sync();
    },
    applied: () => applied,
    played: () => played,
  };
}

test('Studio requires exact inspection and explicit apply; edited crop/draft invalidates prior permission', async () => {
  const fixture = workbenchFixture(),
    { $, api } = fixture;
  $('reference-file').files = [file()];
  await $('reference-file').onchange();
  assert(api.underlay());
  assert.equal(fixture.applied(), 0);
  $('surface').value = 'foundations';
  for (const [id, value] of Object.entries({ x: 12, y: 12, w: 4, h: 3 })) $(id).value = value;
  await $('reference-queue-add').onclick();
  assert(api.hasPending());
  await $('reference-apply').onclick();
  assert.equal(fixture.applied(), 0);
  await $('reference-inspect').onclick();
  assert.equal($('reference-apply').disabled, false);
  await $('reference-play').onclick();
  assert.equal(fixture.played().difficulty, 'expert');
  assert.equal(fixture.applied(), 0);
  $('crop-w').value = 100;
  $('crop-w').oninput();
  await $('reference-inspect').onclick();
  assert.match($('reference-status').textContent, /Preview the edited crop/);
  assert.equal($('reference-apply').disabled, true);
  await $('reference-crop').onclick();
  await $('reference-inspect').onclick();
  fixture.mutate();
  await $('reference-apply').onclick();
  assert.equal(fixture.applied(), 0);
  await $('reference-inspect').onclick();
  await $('reference-apply').onclick();
  assert.equal(fixture.applied(), 1);
  assert.equal(api.hasPending(), false);
  assert.equal(fixture.getSource().maps.length, 2);
  api.dispose();
  assert.equal(api.underlay(), null);
});

test('newer uploads win, failed replacements preserve the old reference, and mission changes dispose late decodes', async () => {
  const pending = [];
  const fixture = workbenchFixture(
    () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
  );
  const { $, api } = fixture;
  const loaded = () => ({
    image: {},
    width: 120,
    height: 60,
    disposed: false,
    dispose() {
      this.disposed = true;
    },
  });
  $('reference-file').files = [file()];
  const first = $('reference-file').onchange();
  const second = $('reference-file').onchange();
  const early = loaded(),
    latest = loaded();
  pending[1].resolve(latest);
  await second;
  pending[0].resolve(early);
  await first;
  assert.equal(early.disposed, true);
  assert.equal(latest.disposed, false);
  assert(api.underlay());
  const failed = $('reference-file').onchange();
  assert.equal($('reference-tools').disabled, true);
  assert.equal($('reference-apply').disabled, true);
  pending[2].reject(new Error('Malformed picture'));
  await failed;
  assert(api.underlay());
  assert.equal($('reference-tools').disabled, false);
  assert.match($('reference-status').textContent, /Malformed picture/);
  const late = $('reference-file').onchange();
  fixture.getSource().missions[0].id = 'another-mission';
  api.sync();
  assert.equal(latest.disposed, true);
  const afterSwitch = loaded();
  pending[3].resolve(afterSwitch);
  await late;
  assert.equal(afterSwitch.disposed, true);
  assert.equal(api.underlay(), null);
});

test('Undo retires the Applied message even after the accepted tracing queue is empty', async () => {
  const fixture = workbenchFixture(),
    { $, api } = fixture,
    original = structuredClone(fixture.getSource());
  $('reference-file').files = [file()];
  await $('reference-file').onchange();
  $('surface').value = 'foundations';
  for (const [id, value] of Object.entries({ x: 12, y: 12, w: 4, h: 3 })) $(id).value = value;
  await $('reference-queue-add').onclick();
  await $('reference-inspect').onclick();
  await $('reference-apply').onclick();
  assert.match($('reference-status').textContent, /Applied as a private map revision/);
  api.sync();
  assert.match($('reference-status').textContent, /Applied as a private map revision/);
  fixture.replace(original);
  assert.doesNotMatch($('reference-status').textContent, /Applied as/);
  assert.match($('reference-status').textContent, /No geometry is queued/);
  assert.equal($('reference-apply').disabled, true);
  assert.equal(api.hasPending(), false);
  assert.deepEqual(fixture.getSource(), original);
  api.dispose();
});

test('changing difficulty retires the frozen inspected preview but preserves the queued proposal', async () => {
  const fixture = workbenchFixture(),
    { $, api } = fixture;
  $('reference-file').files = [file()];
  await $('reference-file').onchange();
  $('surface').value = 'foundations';
  for (const [id, value] of Object.entries({ x: 12, y: 12, w: 4, h: 3 })) $(id).value = value;
  await $('reference-queue-add').onclick();
  await $('reference-inspect').onclick();
  assert.equal($('reference-preview').hidden, false);
  fixture.difficulty('gentle');
  assert.equal($('reference-preview').hidden, true);
  assert.equal($('reference-apply').disabled, true);
  assert.equal($('reference-play').disabled, true);
  assert.equal(api.hasPending(), true);
  await $('reference-play').onclick();
  assert.equal(fixture.played(), null);
  await $('reference-inspect').onclick();
  await $('reference-play').onclick();
  assert.equal(fixture.played().difficulty, 'gentle');
  assert.equal(fixture.applied(), 0);
  api.dispose();
});
