import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { resolvePresentation, validateThemeBundle } from '../presentation/model.mjs';
import {
  reviseStudioTheme,
  replaceStudioCollection,
  adoptStudioBundle,
  studioSlotHistory,
} from '../presentation/studio-session.mjs';

const ref = ({ id, revision }) => ({ id, revision });
const key = ({ id, revision }) => `${id}@${revision}`;
const identities = (rows) => rows.map(({ asset }) => key(asset));
function fixture() {
  const base = createDefaultThemeBundle();
  const original = base.assets.find((asset) => asset.id === 'icon.play.default');
  const first = { ...structuredClone(original), id: 'icon.play.field-kit' };
  let document = reviseStudioTheme(base, {
    assets: [first],
    bindings: { 'icon.play': ref(first) },
  });
  const approved = {
    ...structuredClone(first),
    revision: 2,
    quality: { stage: 'reviewed', evidence: ['Fixture approval of the registered icon recipe.'] },
  };
  document = reviseStudioTheme(document, {
    assets: [approved],
    bindings: { 'icon.play': ref(approved) },
  });
  const source = {
    ...structuredClone(original),
    id: 'original-photograph',
    kind: 'image',
    recipe: null,
    file: { sha256: 'a'.repeat(64), bytes: 256, mime: 'image/png', width: 48, height: 48 },
    geometry: {
      frame: { x: 0, y: 0, width: 48, height: 48 },
      pivot: { x: 0.5, y: 0.5 },
      occupiedBounds: null,
      rotorAnchors: [],
      nineSlice: null,
    },
  };
  const custom = {
    ...structuredClone(source),
    id: 'icon.play.custom',
    file: { ...source.file, sha256: 'b'.repeat(64), width: 24, height: 24 },
    geometry: { ...source.geometry, frame: { x: 0, y: 0, width: 24, height: 24 } },
    provenance: { ...source.provenance, parent: ref(source) },
  };
  document = reviseStudioTheme(document, {
    assets: [source, custom],
    bindings: { 'icon.play': ref(custom) },
  });
  return { base, document, original, first, approved, source, custom };
}

test('exact historical bindings retain approved field-kit assets after a custom upload', () => {
  const f = fixture();
  const before = JSON.stringify(f.document);
  const rows = studioSlotHistory(f.document, 'icon.play');
  assert.deepEqual(identities(rows), [
    key(f.custom),
    key(f.source),
    key(f.approved),
    key(f.first),
    key(f.original),
  ]);
  assert.deepEqual(
    rows.filter((row) => row.bindable).map(({ asset }) => key(asset)),
    [key(f.custom), key(f.approved), key(f.first), key(f.original)],
  );
  assert.equal(JSON.stringify(f.document), before);
  assert.ok(Object.isFrozen(rows) && rows.every(Object.isFrozen));
});

test('unbound same-ID revisions and unrelated slot assets are not guessed into history', () => {
  const f = fixture();
  const unbound = { ...structuredClone(f.approved), revision: 3 };
  const document = reviseStudioTheme(f.document, { assets: [unbound] });
  const history = identities(studioSlotHistory(document, 'icon.play'));
  assert.ok(!history.includes(key(unbound)));
  assert.ok(!history.includes('icon.pause.default@1'));
  assert.deepEqual(history, identities(studioSlotHistory(f.document, 'icon.play')));
});

test('old collection revisions and arbitrary imported asset identities remain reachable', () => {
  const f = fixture();
  const collectionAsset = { ...structuredClone(f.first), id: 'reviewed-community-icon' };
  let document = replaceStudioCollection(f.document, {
    id: 'community-kit',
    name: 'Community fixture',
    requiredSlots: ['icon.play'],
    assets: [collectionAsset],
    bindings: { 'icon.play': ref(collectionAsset) },
  });
  document = replaceStudioCollection(document, {
    id: 'community-kit',
    name: 'Community fixture',
    requiredSlots: ['icon.play'],
    bindings: { 'icon.play': ref(f.custom) },
  });
  const rows = studioSlotHistory(document, 'icon.play');
  assert.ok(rows.find(({ asset, bindable }) => key(asset) === key(collectionAsset) && bindable));
  assert.equal(rows.filter(({ asset }) => key(asset) === key(f.custom)).length, 1);

  const incoming = reviseStudioTheme(f.base, {
    assets: [{ ...structuredClone(f.first), id: 'foreign-icon' }],
    bindings: { 'icon.play': { id: 'foreign-icon', revision: 1 } },
  });
  document = adoptStudioBundle(document, incoming);
  const imported = resolvePresentation(document).assets['icon.play'];
  assert.match(imported.id, /^import-/);
  document = reviseStudioTheme(document, { bindings: { 'icon.play': ref(f.custom) } });
  assert.ok(
    studioSlotHistory(document, 'icon.play').some(({ asset }) => key(asset) === key(imported)),
  );
});

test('source lineage is exact, download-only, and cannot become a binding by naming convention', () => {
  const f = fixture();
  const parent = { ...structuredClone(f.source), id: 'upstream-original' };
  const document = structuredClone(f.document);
  document.assets.push(parent, { ...structuredClone(parent), revision: 2 });
  document.assets.find((asset) => key(asset) === key(f.source)).provenance.parent = ref(parent);
  const accepted = validateThemeBundle(document);
  const rows = studioSlotHistory(accepted, 'icon.play');
  assert.equal(rows.find(({ asset }) => key(asset) === key(parent)).bindable, false);
  assert.ok(!identities(rows).includes('upstream-original@2'));
  assert.equal(rows.find(({ asset }) => key(asset) === key(f.source)).bindable, false);
  assert.throws(
    () => reviseStudioTheme(accepted, { bindings: { 'icon.play': ref(f.source) } }),
    /Wrong image dimensions/,
  );
});

test('a parent that was itself bound remains restorable and shared sources are deduplicated', () => {
  const f = fixture();
  const next = {
    ...structuredClone(f.custom),
    revision: 2,
    provenance: { ...f.custom.provenance, parent: ref(f.custom) },
  };
  const document = reviseStudioTheme(f.document, {
    assets: [next],
    bindings: { 'icon.play': ref(next) },
  });
  const rows = studioSlotHistory(document, 'icon.play');
  assert.equal(rows.find(({ asset }) => key(asset) === key(f.custom)).bindable, true);
  assert.equal(rows.filter(({ asset }) => key(asset) === key(f.source)).length, 1);
});

test('restoring an earlier choice appends a theme revision without rewriting any retained asset', () => {
  const f = fixture();
  const before = structuredClone(f.document);
  const restored = reviseStudioTheme(f.document, { bindings: { 'icon.play': ref(f.approved) } });
  assert.deepEqual(resolvePresentation(restored).bindings['icon.play'], ref(f.approved));
  assert.deepEqual(restored.assets, before.assets);
  assert.deepEqual(restored.themes.slice(0, -1), before.themes);
  assert.equal(restored.themes.at(-1).revision, before.selection.theme.revision + 1);
  assert.deepEqual(f.document, before);
  assert.deepEqual(
    identities(studioSlotHistory(restored, 'icon.play')),
    identities(studioSlotHistory(before, 'icon.play')),
  );
});

test('unknown slots and invalid historical bindings fail through the existing validator', () => {
  const f = fixture();
  assert.throws(() => studioSlotHistory(f.document, 'not-a-slot'), /Unknown Studio asset slot/);
  const malformed = structuredClone(f.document);
  malformed.themes[0].bindings['icon.play'] = { id: 'missing', revision: 1 };
  assert.throws(() => studioSlotHistory(malformed, 'icon.play'), /Missing slot or asset reference/);
});
