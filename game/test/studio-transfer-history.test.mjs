import test from 'node:test';
import { studioThemeOptions } from '../../authoring/asset-studio/helpers.mjs';
import { canonicalJSON } from '../data-json.mjs';
import assert from 'node:assert/strict';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import {
  FORMATS,
  LIMITS,
  resolvePresentation,
  validateThemeBundle,
} from '../presentation/model.mjs';
import {
  exportThemeBundle,
  importThemeBundle,
  hashPresentationBytes,
  verifyThemeAssets,
} from '../presentation/bundle.mjs';
import {
  adoptStudioBundle,
  reviseStudioTheme,
  replaceStudioCollection,
  studioSlotHistory,
} from '../presentation/studio-session.mjs';
import { iconForSlot } from '../presentation/icons.mjs';
import { encodeSpritePNG } from '../../scripts/produce-field-kit-sprites.mjs';

const ref = (row) => ({ id: row.id, revision: row.revision });
const key = (row) => `${row.id}@${row.revision}`;
const transfer = async (document, assets = new Map()) =>
  importThemeBundle(await exportThemeBundle(document, assets), { decodeImage: null });

async function fixture() {
  const base = createDefaultThemeBundle();
  let document = base;
  const assets = new Map(),
    originals = [],
    derivatives = [];
  for (const [index, shape] of ['icon.play', 'icon.pause'].entries()) {
    const pixels = iconForSlot(shape),
      bytes = encodeSpritePNG(pixels),
      hash = await hashPresentationBytes(bytes);
    assets.set(hash, new Blob([bytes], { type: 'image/png' }));
    const source = {
      ...structuredClone(resolvePresentation(base).assets['icon.play']),
      id: `independent-${index}-source`,
      kind: 'image',
      recipe: null,
      description: `Independent source ${index}`,
      file: {
        sha256: hash,
        bytes: bytes.length,
        mime: 'image/png',
        width: pixels.width,
        height: pixels.height,
      },
      geometry: structuredClone(base.slots.find((slot) => slot.id === 'icon.play').geometry),
    };
    const derivative = {
      ...structuredClone(source),
      id: `independent-${index}-prepared`,
      description: `Prepared ${index}`,
      provenance: { ...source.provenance, parent: ref(source) },
    };
    originals.push(source);
    derivatives.push(derivative);
    document = reviseStudioTheme(document, {
      assets: [source, derivative],
      bindings: { 'icon.play': ref(derivative) },
      tokens: { amber: index ? '#aabbcc' : '#112233' },
    });
  }
  // A same-ID unbound revision must not acquire a slot association on transfer.
  document = reviseStudioTheme(document, {
    assets: [{ ...structuredClone(derivatives[0]), revision: 2, description: 'Never bound' }],
  });
  document = replaceStudioCollection(document, {
    id: 'distinct-kit',
    name: 'Distinct imported kit',
    requiredSlots: ['icon.play'],
    bindings: { 'icon.play': ref(derivatives[1]) },
  });
  return { base, document, assets, originals, derivatives };
}

function importedByDescription(document, original) {
  return document.assets.find((asset) => asset.description === original.description);
}

test('real PNG bundle transfer retains independent historical bindings, originals, names and rebind/export bytes', async () => {
  const f = await fixture(),
    before = structuredClone(f.document);
  const incoming = await transfer(f.document, f.assets);
  const adopted = adoptStudioBundle(f.base, incoming.document);
  const merged = await verifyThemeAssets(adopted, incoming.assets);
  const history = studioSlotHistory(adopted, 'icon.play');
  for (const item of f.derivatives) {
    const asset = importedByDescription(adopted, item);
    assert.ok(
      history.some((row) => key(row.asset) === key(asset) && row.bindable),
      item.description,
    );
  }
  for (const item of f.originals) {
    const asset = importedByDescription(adopted, item);
    assert.ok(
      history.some((row) => key(row.asset) === key(asset) && !row.bindable),
      item.description,
    );
  }
  assert.ok(!history.some((row) => row.asset.description === 'Never bound'));
  assert.equal(adopted.collections.at(-1).name, 'Distinct imported kit');
  assert.deepEqual(adopted.assets.slice(0, f.base.assets.length), f.base.assets);
  const first = importedByDescription(adopted, f.derivatives[0]);
  const restored = reviseStudioTheme(adopted, { bindings: { 'icon.play': ref(first) } });
  assert.equal(resolvePresentation(restored).assets['icon.play'].description, 'Prepared 0');
  const roundtrip = await transfer(restored, merged);
  assert.deepEqual(roundtrip.document, restored);
  for (const [hash, blob] of f.assets)
    assert.deepEqual(
      new Uint8Array(await roundtrip.assets.get(hash).arrayBuffer()),
      new Uint8Array(await blob.arrayBuffer()),
    );
  assert.deepEqual(f.document, before);
});

test('mapped historical theme parents, tokens and collection bindings remain selectable', async () => {
  const f = await fixture(),
    incoming = await transfer(f.document, f.assets);
  const adopted = adoptStudioBundle(f.base, incoming.document);
  const mappedThemes = new Map();
  const retainedFamilyIds = [...new Set(adopted.themes.map((theme) => theme.id))].filter(
    (id) => !f.base.themes.some((theme) => theme.id === id),
  );
  assert.equal(retainedFamilyIds.length, 1);
  for (const original of incoming.document.themes) {
    const bindings = Object.fromEntries(
      Object.entries(original.bindings).map(([slot, target]) => {
        const asset = incoming.document.assets.find((item) => key(item) === key(target));
        return [slot, ref(adopted.assets.find((item) => item.description === asset.description))];
      }),
    );
    const mapped = adopted.themes.find(
      (theme) =>
        theme.id ===
          (original.id === f.base.selection.base.id ? original.id : retainedFamilyIds[0]) &&
        canonicalJSON(theme.parent) ===
          canonicalJSON(original.parent ? mappedThemes.get(key(original.parent)) : null) &&
        theme.name === original.name &&
        canonicalJSON(theme.tokens) === canonicalJSON(original.tokens) &&
        canonicalJSON(theme.bindings) === canonicalJSON(bindings),
    );
    assert.ok(mapped, `Retained theme ${key(original)}`);
    mappedThemes.set(key(original), ref(mapped));
    const selection = (document, theme) => ({
      ...structuredClone(document),
      selection: { ...document.selection, theme: ref(theme), collection: null },
    });
    const expected = resolvePresentation(selection(incoming.document, original));
    const actual = resolvePresentation(selection(adopted, mapped));
    assert.deepEqual(actual.tokens, expected.tokens);
    assert.equal(actual.assets['icon.play'].description, expected.assets['icon.play'].description);
  }
  const historical = adopted.collections.find((collection) =>
    collection.id.includes('-collection-'),
  );
  assert.equal(historical.name, 'Distinct imported kit');
  assert.deepEqual(historical.requiredSlots, ['icon.play']);
  assert.equal(
    resolvePresentation(adopted, { themeId: historical.themeId, collectionId: historical.id })
      .assets['icon.play'].description,
    'Prepared 1',
  );
});

test('more than 128 incoming theme revisions retain their exact token history within existing limits', async () => {
  const base = createDefaultThemeBundle(),
    source = structuredClone(base);
  for (let i = 0; i < 194; i++) {
    const previous = source.themes.find((theme) => key(theme) === key(source.selection.theme));
    const next = {
      ...structuredClone(previous),
      revision: previous.revision + 1,
      parent: ref(previous),
      bindings: {},
      tokens: { amber: `#${i.toString(16).padStart(6, '0')}` },
    };
    source.themes.push(next);
    source.selection.theme = ref(next);
    source.revision++;
  }
  const incoming = await transfer(validateThemeBundle(source));
  const adopted = adoptStudioBundle(base, incoming.document);
  assert.equal(
    adopted.collections.length,
    1,
    'Theme history does not consume collection capacity.',
  );
  for (let i = 0; i < 194; i++) {
    const color = `#${i.toString(16).padStart(6, '0')}`;
    const archived = adopted.themes.find(
      (theme) => theme.id.includes('-theme-') && theme.tokens.amber === color,
    );
    assert.ok(archived, color);
    assert.equal(
      resolvePresentation({
        ...structuredClone(adopted),
        selection: { ...adopted.selection, theme: ref(archived), collection: null },
      }).tokens.amber,
      color,
    );
    assert.ok(archived.parent, 'Mapped parents stay connected to receiving base.');
  }
  assert.equal(
    new Set(adopted.themes.map((theme) => theme.id)).size,
    new Set(base.themes.map((theme) => theme.id)).size + 1,
  );
  assert.deepEqual((await transfer(adopted)).document, adopted);
});

test('self-import shares exact existing immutable records and namespaces avoid theme collisions', () => {
  const base = createDefaultThemeBundle(),
    once = adoptStudioBundle(base, base),
    twice = adoptStudioBundle(once, once);
  assert.deepEqual(twice.assets, base.assets);
  assert.equal(twice.themes.length, once.themes.length + 1);
  assert.equal(twice.collections.length, once.collections.length + 1);
  const receiver = structuredClone(base);
  receiver.themes.push({ ...structuredClone(base.themes[1]), id: 'import-2-theme-0', revision: 1 });
  const source = structuredClone(base);
  source.themes[1].name = 'Foreign name';
  const result = adoptStudioBundle(validateThemeBundle(receiver), source);
  assert.equal(result.selection.collection.id, 'import-2-1');
  assert.ok(
    result.themes.some(
      (theme) => theme.id.startsWith('import-2-1-theme-') && theme.name === 'Foreign name',
    ),
  );
  assert.deepEqual(result.themes.slice(0, receiver.themes.length), receiver.themes);
});

test('foreign root and conflicting parent assets are mapped without rewriting local identities', () => {
  const base = createDefaultThemeBundle(),
    incoming = structuredClone(base);
  incoming.themes[0].tokens.amber = '#123456';
  incoming.assets[0].description = 'Foreign conflicting root asset';
  incoming.assets[1].provenance.parent = ref(incoming.assets[0]);
  const before = structuredClone({ base, incoming }),
    adopted = adoptStudioBundle(base, incoming);
  const root = adopted.themes.find((theme) => theme.id.includes('-theme-0'));
  assert.deepEqual(root.parent, base.selection.base);
  assert.equal(
    resolvePresentation(adopted, { themeId: root.id, collectionId: null }).tokens.amber,
    '#123456',
  );
  const child = adopted.assets.find(
    (asset) => asset.id.startsWith('import-') && asset.provenance.parent,
  );
  assert.equal(
    adopted.assets.find((asset) => key(asset) === key(child.provenance.parent)).description,
    'Foreign conflicting root asset',
  );
  assert.deepEqual({ base, incoming }, before);
});

test('history capacity rejection leaves both validated inputs unchanged', () => {
  const base = createDefaultThemeBundle();
  for (const field of ['themes', 'collections']) {
    const receiver = structuredClone(base);
    while (receiver[field].length < LIMITS[field]) {
      const id = `capacity-${receiver[field].length}`;
      receiver[field].push(
        field === 'themes'
          ? { ...structuredClone(base.themes[1]), id, revision: 1 }
          : {
              format: FORMATS.collection,
              id,
              revision: 1,
              name: id,
              themeId: base.selection.theme.id,
              requiredSlots: ['icon.play'],
              bindings: { 'icon.play': resolvePresentation(base).bindings['icon.play'] },
            },
      );
    }
    const valid = validateThemeBundle(receiver),
      before = structuredClone(valid);
    assert.throws(() => adoptStudioBundle(valid, base), /Too many (themes|collections)/);
    assert.deepEqual(valid, before);
  }
});

test('sparse foreign theme and collection families remap contiguous revisions and exact parent references', () => {
  const base = createDefaultThemeBundle(),
    source = structuredClone(base);
  const first = {
    ...structuredClone(base.themes[1]),
    id: 'sparse',
    revision: 4,
    name: 'Sparse family',
    parent: ref(base.themes[0]),
    tokens: { amber: '#111111' },
    bindings: {},
  };
  const last = {
    ...structuredClone(first),
    revision: 9,
    parent: ref(first),
    tokens: { amber: '#222222' },
  };
  source.themes.push(first, last);
  source.selection.theme = ref(last);
  const collection = {
    format: FORMATS.collection,
    id: 'sparse-kit',
    revision: 3,
    name: 'Earlier kit',
    themeId: 'sparse',
    requiredSlots: ['icon.play'],
    bindings: { 'icon.play': resolvePresentation(base).bindings['icon.play'] },
  };
  source.collections.push(collection, {
    ...structuredClone(collection),
    revision: 8,
    name: 'Current kit',
  });
  source.selection.collection = { id: 'sparse-kit', revision: 8 };
  const accepted = validateThemeBundle(source),
    before = structuredClone(accepted),
    adopted = adoptStudioBundle(base, accepted);
  const themes = adopted.themes.filter((theme) => theme.name === 'Sparse family');
  assert.deepEqual(
    themes.map((theme) => theme.revision),
    [1, 2],
  );
  assert.equal(new Set(themes.map((theme) => theme.id)).size, 1);
  assert.deepEqual(themes[1].parent, ref(themes[0]));
  assert.deepEqual(
    themes.map((theme) => theme.tokens),
    [first.tokens, last.tokens],
  );
  const collections = adopted.collections.filter((item) => item.id.includes('-collection-'));
  assert.deepEqual(
    collections.map((item) => item.revision),
    [1, 2],
  );
  assert.equal(new Set(collections.map((item) => item.id)).size, 1);
  assert.deepEqual(
    collections.map((item) => item.name),
    ['Earlier kit', 'Current kit'],
  );
  assert.ok(collections.every((item) => item.themeId === themes[0].id));
  assert.equal(adopted.collections.at(-1).name, 'Current kit');
  assert.deepEqual(accepted, before);
});

test('atomic transition accepts contiguous immutable batches but rejects gaps, duplicates and rewrites', () => {
  const base = createDefaultThemeBundle();
  const next = structuredClone(base);
  next.revision++;
  const one = {
    ...structuredClone(base.themes[1]),
    id: 'batch',
    revision: 1,
    parent: ref(base.themes[0]),
    bindings: {},
    tokens: { amber: '#111111' },
  };
  const two = {
    ...structuredClone(one),
    revision: 2,
    parent: ref(one),
    tokens: { amber: '#222222' },
  };
  next.themes.push(two, one); // Input order cannot disguise a gap or forbid a valid batch.
  next.selection.theme = ref(two);
  const accepted = validateThemeBundle(next, { previous: base, expectedRevision: base.revision });
  assert.equal(resolvePresentation(accepted).tokens.amber, '#222222');
  for (const mutate of [
    (value) => {
      value.themes.find((item) => item.id === 'batch' && item.revision === 2).revision = 3;
      value.selection.theme.revision = 3;
    },
    (value) => value.themes.push(structuredClone(one)),
    (value) => {
      value.themes[0].name = 'Rewritten immutable name';
    },
  ]) {
    const invalid = structuredClone(next);
    mutate(invalid);
    assert.throws(
      () => validateThemeBundle(invalid, { previous: base, expectedRevision: base.revision }),
      /next revision|Duplicate|Immutable/,
    );
  }
  const continuation = structuredClone(accepted);
  continuation.revision++;
  continuation.themes.push(
    { ...structuredClone(two), revision: 3, parent: ref(two) },
    { ...structuredClone(two), revision: 4, parent: { id: 'batch', revision: 3 } },
  );
  validateThemeBundle(continuation, { previous: accepted, expectedRevision: accepted.revision });
  assert.throws(
    () =>
      validateThemeBundle(continuation, {
        previous: accepted,
        expectedRevision: accepted.revision - 1,
      }),
    /Stale/,
  );
});

test('asset and collection batches enforce contiguous append-only records; slots remain unique', () => {
  const base = createDefaultThemeBundle();
  for (const field of ['assets', 'collections']) {
    const one =
      field === 'assets'
        ? { ...structuredClone(base.assets[0]), id: 'batch-asset', revision: 1 }
        : {
            format: FORMATS.collection,
            id: 'batch-collection',
            revision: 1,
            name: 'First collection',
            themeId: base.selection.theme.id,
            requiredSlots: ['icon.play'],
            bindings: { 'icon.play': resolvePresentation(base).bindings['icon.play'] },
          };
    const two = { ...structuredClone(one), revision: 2 };
    const next = structuredClone(base);
    next.revision++;
    next[field].push(two, one);
    const accepted = validateThemeBundle(next, { previous: base, expectedRevision: base.revision });
    for (const mutate of [
      (value) => {
        value[field].find((row) => row.id === one.id && row.revision === 2).revision = 3;
      },
      (value) => value[field].push(structuredClone(one)),
    ]) {
      const invalid = structuredClone(next);
      mutate(invalid);
      assert.throws(
        () => validateThemeBundle(invalid, { previous: base, expectedRevision: base.revision }),
        /next revision|Duplicate/,
      );
    }
    const rewritten = structuredClone(accepted);
    rewritten.revision++;
    rewritten[field].find((row) => row.id === one.id && row.revision === 1)[
      field === 'assets' ? 'description' : 'name'
    ] = 'Changed saved identity';
    assert.throws(
      () =>
        validateThemeBundle(rewritten, { previous: accepted, expectedRevision: accepted.revision }),
      /Immutable/,
    );
  }
  const duplicateSlot = structuredClone(base);
  duplicateSlot.revision++;
  duplicateSlot.slots.push(structuredClone(base.slots[0]));
  assert.throws(
    () => validateThemeBundle(duplicateSlot, { previous: base }),
    /Duplicate|unique stable IDs/,
  );
  const rewrittenSlot = structuredClone(base);
  rewrittenSlot.revision++;
  rewrittenSlot.slots[0].label = 'Changed slot';
  assert.throws(() => validateThemeBundle(rewrittenSlot, { previous: base }), /Immutable/);
});

test('theme choices distinguish imported and local family names without per-revision choices', () => {
  const base = createDefaultThemeBundle();
  const incoming = reviseStudioTheme(base, { tokens: { amber: '#abcdef' } });
  const adopted = adoptStudioBundle(base, incoming),
    before = structuredClone(adopted);
  const options = studioThemeOptions([...adopted.themes].reverse());
  assert.equal(options.length, 3);
  const original = options.find((option) => option.id === 'fpv');
  const imported = options.find((option) => option.id !== 'fpv' && option.name === original.name);
  assert.equal(original.label, `${original.name} (fpv)`);
  assert.equal(imported.label, `${imported.name} (${imported.id})`);
  assert.notEqual(original.label, imported.label);
  assert.equal(options.find((option) => option.id === 'base').label, base.themes[0].name);
  assert.equal(
    imported.revision,
    Math.max(
      ...adopted.themes.filter((theme) => theme.id === imported.id).map((theme) => theme.revision),
    ),
  );
  assert.equal(
    resolvePresentation(adopted, { themeId: imported.id, collectionId: null }).tokens.amber,
    '#abcdef',
  );
  assert.deepEqual(adopted, before);
});
