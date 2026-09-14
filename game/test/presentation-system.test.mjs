import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDefaultThemeBundle, SCREEN_IDS } from '../presentation/catalog.mjs';
import {
  FORMATS,
  validateThemeBundle,
  resolvePresentation,
  proposeDraft,
  presentationCoverage,
  validateAssetRevision,
} from '../presentation/model.mjs';
import {
  exportThemeBundle,
  importThemeBundle,
  verifyThemeAssets,
  hashPresentationBytes,
} from '../presentation/bundle.mjs';
import {
  presentationCSSVariables,
  canvasPresentation,
  applyPresentation,
  imagePresentation,
} from '../presentation/runtime.mjs';
import {
  compilePresentation,
  inspectProductionAdapter,
  inventoryCurrentPictures,
} from '../../scripts/compile-presentation.mjs';
import { CURRENT_PICTURES } from '../presentation/current-pictures.mjs';
import { pngBytes } from './helpers/media-fixtures.mjs';

const clone = (v) => structuredClone(v);
const execute = promisify(execFile);
const baseline = () => createDefaultThemeBundle();
const draft = (doc, patch = {}) => ({
  format: FORMATS.draft,
  baseRevision: doc.revision,
  tokens: {},
  bindings: {},
  ...patch,
});
function collection(doc, patch = {}) {
  return {
    format: FORMATS.collection,
    id: 'fpv-cyan',
    revision: 1,
    name: 'Cyan icons',
    themeId: 'fpv',
    requiredSlots: ['icon.play', 'icon.pause'],
    bindings: {
      'icon.play': { ...doc.themes[0].bindings['icon.play'] },
      'icon.pause': { ...doc.themes[0].bindings['icon.pause'] },
    },
    ...patch,
  };
}
async function imageFixture() {
  const document = clone(baseline()),
    bytes = pngBytes(),
    sha256 = await hashPresentationBytes(bytes);
  const geometry = {
    frame: { x: 0, y: 0, width: 1, height: 1 },
    pivot: { x: 0.5, y: 0.5 },
    occupiedBounds: null,
    rotorAnchors: [],
    nineSlice: null,
  };
  document.slots.push({
    ...clone(document.slots.find((s) => s.id === 'icon.play')),
    id: 'test.image',
    dimensions: { width: 1, height: 1 },
    geometry,
  });
  document.assets.push({
    format: FORMATS.asset,
    id: 'test.original',
    revision: 1,
    kind: 'image',
    description: 'Injected single-pixel fixture',
    provenance: {
      creator: 'Test',
      source: 'Local test fixture',
      license: 'Test-only',
      prompt: '',
      parent: null,
    },
    file: { sha256, bytes: bytes.length, mime: 'image/png', width: 1, height: 1 },
    recipe: null,
    geometry,
    quality: { stage: 'produced', evidence: [] },
  });
  document.themes[1].bindings['test.image'] = { id: 'test.original', revision: 1 };
  return {
    document: validateThemeBundle(document),
    assets: new Map([[sha256, new Blob([bytes])]]),
    bytes,
    sha256,
  };
}
const decodeImage = async () => ({ naturalWidth: 1, naturalHeight: 1 });

test('the complete semantic registry covers every screen and resolves procedural baselines', () => {
  const doc = baseline(),
    resolved = resolvePresentation(doc);
  assert.ok(doc.slots.length >= 130);
  assert.deepEqual(new Set(doc.slots.flatMap((s) => s.screens)), new Set(SCREEN_IDS));
  assert.equal(Object.keys(resolved.assets).length, doc.slots.length);
  assert.equal(resolved.assets['font.ui'].recipe.id, 'font.exo2.v1');
  assert.equal(resolved.assets['player.carrier.rotors'].recipe.id, 'actor.rotors.v1');
  assert.equal(resolved.tokens.text, '#f3f0db');
  assert.ok(Object.isFrozen(doc.assets[0].provenance));
  assert.equal('campaign' in resolved, false);
});

test('future theme IDs inherit a complete base without enumerating four worlds', () => {
  const doc = clone(baseline());
  doc.themes.push({
    ...clone(doc.themes[1]),
    id: 'future-moon',
    name: 'Future Moon',
    tokens: { cyan: '#ffffff' },
  });
  const result = resolvePresentation(doc, { themeId: 'future-moon' });
  assert.equal(result.tokens.cyan, '#ffffff');
  assert.equal(result.assets['player.scout.compact'].kind, 'recipe');
});

test('unknown fields, executable recipes, CSS injection and accessor data are refused', () => {
  const doc = clone(baseline());
  doc.script = 'javascript:alert(1)';
  assert.throws(() => validateThemeBundle(doc), /not supported/);
  delete doc.script;
  doc.assets[0].recipe.id = 'https://example.com/code.mjs';
  assert.throws(() => validateThemeBundle(doc), /Unregistered/);
  const color = clone(baseline());
  color.themes[1].tokens.cyan = 'red; background:url(https://example.com)';
  assert.throws(() => validateThemeBundle(color), /color token/);
  let calls = 0;
  Object.defineProperty(color, 'dangerous', {
    enumerable: true,
    get() {
      calls++;
      return true;
    },
  });
  assert.throws(() => validateThemeBundle(color), /accessors/);
  assert.equal(calls, 0);
});

test('missing references, mismatched kinds and incomplete base coverage are refused', () => {
  const missing = clone(baseline());
  missing.themes[1].bindings['icon.play'] = { id: 'unknown', revision: 1 };
  assert.throws(() => validateThemeBundle(missing), /Missing slot or asset/);
  const wrong = clone(baseline());
  wrong.themes[1].bindings['font.ui'] = { ...wrong.themes[0].bindings['icon.play'] };
  assert.throws(() => validateThemeBundle(wrong), /Wrong registered recipe/);
  const incomplete = clone(baseline());
  delete incomplete.themes[0].bindings['icon.play'];
  assert.throws(() => validateThemeBundle(incomplete), /Missing required slot/);
});

test('inheritance and derivative cycles cannot enter a resolved theme', () => {
  const cycle = clone(baseline());
  cycle.themes[1].parent = { id: 'fpv', revision: 1 };
  assert.throws(() => validateThemeBundle(cycle), /inheritance cycle/);
  const derivative = clone(baseline());
  derivative.assets[0].provenance.parent = { id: derivative.assets[0].id, revision: 1 };
  assert.throws(() => validateThemeBundle(derivative), /derivative cycle/);
});

test('collections replace their declared set atomically and drafts override them last', () => {
  const doc = clone(baseline()),
    set = collection(doc);
  doc.collections.push(set);
  doc.selection.collection = { id: set.id, revision: 1 };
  const accepted = validateThemeBundle(doc),
    before = JSON.stringify(accepted);
  const bad = clone(doc);
  delete bad.collections[0].bindings['icon.pause'];
  assert.throws(() => validateThemeBundle(bad), /required binding/);
  assert.equal(JSON.stringify(accepted), before);
  const local = draft(accepted, {
    tokens: { amber: '#abcdef' },
    bindings: { 'icon.play': accepted.themes[0].bindings['icon.check'] },
  });
  const resolved = resolvePresentation(accepted, { draft: local });
  assert.equal(resolved.tokens.amber, '#abcdef');
  assert.equal(resolved.assets['icon.play'].id, 'icon.check.default');
  const next = proposeDraft(accepted, local, { expectedRevision: 1 });
  assert.equal(next.selection.collection, null);
  assert.equal(resolvePresentation(next).assets['icon.play'].id, 'icon.check.default');
  assert.deepEqual(next.collections[0], accepted.collections[0]);
});

test('collections cannot silently cross world identity', () => {
  const doc = clone(baseline());
  doc.themes.push({ ...clone(doc.themes[1]), id: 'future-world' });
  doc.collections.push(collection(doc, { themeId: 'future-world' }));
  doc.selection.collection = { id: 'fpv-cyan', revision: 1 };
  assert.throws(() => validateThemeBundle(doc), /different theme/);
});

test('compare-and-swap and immutable revision history reject stale or destructive successors', () => {
  const previous = baseline(),
    next = proposeDraft(previous, draft(previous, { tokens: { textSize: 22 } }), {
      expectedRevision: 1,
    });
  assert.equal(next.revision, 2);
  assert.equal(next.selection.theme.revision, 2);
  assert.equal(previous.themes[1].revision, 1);
  assert.throws(() => proposeDraft(next, draft(previous), { expectedRevision: 1 }), /Stale/);
  const rewritten = clone(next);
  rewritten.assets[0].description = 'Overwritten history';
  assert.throws(
    () => validateThemeBundle(rewritten, { previous, expectedRevision: 1 }),
    /Immutable/,
  );
  const skipped = clone(next);
  skipped.themes[2].revision = 4;
  skipped.selection.theme.revision = 4;
  assert.throws(() => validateThemeBundle(skipped, { previous }), /next revision/);
});

test('image bindings require the slot exact dimensions', async () => {
  const fixture = await imageFixture(),
    bad = clone(fixture.document);
  bad.themes[1].bindings['icon.play'] = { id: 'test.original', revision: 1 };
  assert.throws(() => validateThemeBundle(bad), /Wrong image dimensions/);
});

test('theme transfer retains exact bytes and produces deterministic output', async () => {
  const { document, assets, bytes, sha256 } = await imageFixture();
  const a = await exportThemeBundle(document, assets),
    b = await exportThemeBundle(document, assets);
  assert.deepEqual(new Uint8Array(await a.arrayBuffer()), new Uint8Array(await b.arrayBuffer()));
  const restored = await importThemeBundle(a, { decodeImage });
  assert.deepEqual(restored.document, document);
  assert.deepEqual(
    new Uint8Array(await restored.assets.get(sha256).arrayBuffer()),
    new Uint8Array(bytes),
  );
  assert.equal(restored.imagesDecoded, true);
});

test('invalid hash, corrupt image bytes and extra payloads fail before adoption', async () => {
  const fixture = await imageFixture();
  await assert.rejects(
    exportThemeBundle(fixture.document, new Map([[fixture.sha256, new Blob(['bad'])]])),
    /hash/,
  );
  await assert.rejects(exportThemeBundle(fixture.document, new Map()), /exactly match/);
  const bundle = await exportThemeBundle(fixture.document, fixture.assets);
  await assert.rejects(
    importThemeBundle(bundle.slice(0, bundle.size - 1), { decodeImage }),
    /Truncated/,
  );
  await assert.rejects(importThemeBundle(new Blob([bundle, 'extra']), { decodeImage }), /trailing/);
  const corrupt = new Uint8Array(fixture.bytes);
  corrupt[0] = 0;
  const bad = clone(fixture.document),
    hash = await hashPresentationBytes(corrupt);
  bad.assets.at(-1).file.sha256 = hash;
  await assert.rejects(
    verifyThemeAssets(bad, new Map([[hash, new Blob([corrupt])]])),
    /image header/,
  );
});

test('failed decoding and cancellation never return an accepted candidate', async () => {
  const fixture = await imageFixture(),
    bundle = await exportThemeBundle(fixture.document, fixture.assets);
  await assert.rejects(
    importThemeBundle(bundle, { decodeImage: async () => ({ naturalWidth: 2, naturalHeight: 1 }) }),
    /Decoded image/,
  );
  await assert.rejects(
    importThemeBundle(bundle, {
      decodeImage: async () => {
        throw new Error('decode failed');
      },
    }),
    /decode failed/,
  );
  const controller = new AbortController();
  await assert.rejects(
    importThemeBundle(bundle, {
      signal: controller.signal,
      decodeImage: async () => {
        controller.abort();
        return decodeImage();
      },
    }),
    { name: 'AbortError' },
  );
});

test('runtime tokens map to shared Field Kit styles and preserve gameplay palette vocabulary', () => {
  const resolved = resolvePresentation(baseline()),
    css = presentationCSSVariables(resolved),
    canvas = canvasPresentation(resolved);
  assert.equal(css['--fk-bg'], '#070b12');
  assert.equal(css['--fk-control-line'], '#647786');
  assert.equal(css['--safe'], css['--fk-cyan']);
  assert.equal(canvas.palette.safe, css['--fk-cyan']);
  assert.equal(css['--fk-font-ui'], "'Field Kit UI', 'Field Kit Mono', sans-serif");
  assert.equal('rules' in canvas, false);
  const values = new Map([['--fk-bg', 'old']]);
  const element = {
    style: {
      getPropertyValue: (k) => values.get(k) ?? '',
      getPropertyPriority: () => '',
      setProperty: (k, v) => values.set(k, v),
      removeProperty: (k) => values.delete(k),
    },
  };
  const restore = applyPresentation(element, resolved);
  values.set('--fk-panel', '#ffffff');
  restore();
  assert.equal(values.get('--fk-bg'), 'old');
  assert.equal(values.get('--fk-panel'), '#ffffff');
  assert.equal(values.has('--fk-text'), false);
});

test('compiler emits deterministic allowlisted local assets without source paths or code', async () => {
  const fixture = await imageFixture(),
    a = await compilePresentation(fixture.document, fixture.assets),
    b = await compilePresentation(fixture.document, fixture.assets);
  assert.deepEqual([...a.files], [...b.files]);
  assert.deepEqual([...a.files.keys()].sort(), [
    `assets/${fixture.sha256}.png`,
    'manifest.json',
    'runtime.json',
    'studio.json',
    'theme.css',
  ]);
  const runtime = JSON.parse(new TextDecoder().decode(a.files.get('runtime.json')));
  assert.equal(runtime.urls[fixture.sha256], `./assets/${fixture.sha256}.png`);
  assert.equal(a.imagesDecoded, false, 'Header/hash compilation is not browser decode evidence.');
});

test('production adapter preserves the exact v1 document and read-only binding history', async () => {
  const text = await fs.readFile(
    new URL('../../authoring/production/register.json', import.meta.url),
    'utf8',
  );
  const source = JSON.parse(text),
    snapshot = JSON.stringify(source);
  const adapted = await inspectProductionAdapter(source);
  assert.equal(JSON.stringify(source), snapshot);
  assert.deepEqual(adapted.document, source);
  assert.ok(adapted.slots.length > 100);
  assert.equal(adapted.document.format, 'revealline-production-register.v1');
  assert.ok(Object.isFrozen(adapted.slots));
});

test('frame, occupied bounds, rotor envelopes, nine-slice center and slot budgets are checked', async () => {
  const fixture = await imageFixture();
  for (const change of [
    (asset) => {
      asset.geometry.frame.x = 1;
    },
    (asset) => {
      asset.geometry.pivot.x = 2;
    },
    (asset) => {
      asset.geometry.occupiedBounds = { x: 0, y: 0, width: 2, height: 1 };
    },
    (asset) => {
      asset.geometry.rotorAnchors = [{ x: 0, y: 0, radius: 0.2, blades: 3 }];
    },
    (asset) => {
      asset.geometry.nineSlice = { left: 1, right: 1, top: 1, bottom: 1 };
    },
  ]) {
    const asset = clone(fixture.document.assets.at(-1));
    change(asset);
    assert.throws(() => validateAssetRevision(asset), /bounds|pivot|frame|center/);
  }
  const tooLarge = clone(fixture.document);
  tooLarge.slots.at(-1).budget.maxBytes = 1;
  assert.throws(() => validateThemeBundle(tooLarge), /slot byte budget/);
  const cycle = clone(baseline());
  cycle.slots[0].dependencies = [cycle.slots[0].id];
  assert.throws(() => validateThemeBundle(cycle), /dependency cycle/);
  const missing = clone(baseline());
  missing.slots[0].dependencies = ['unknown'];
  assert.throws(() => validateThemeBundle(missing), /Missing slot dependency/);
});

test('frame-local rig conversion preserves pivot and leaves source and physics untouched', async () => {
  const fixture = await imageFixture(),
    asset = clone(fixture.document.assets.at(-1));
  asset.geometry.rotorAnchors = [{ x: 0.25, y: 0.25, radius: 0.1, blades: 3 }];
  const before = JSON.stringify(asset),
    result = imagePresentation(asset);
  assert.equal(result.rotors[0].x, -0.25);
  assert.equal(result.rotors[0].radiusScale, 0.625);
  assert.equal(result.rotors[0].bladeCount, 3);
  assert.equal(JSON.stringify(asset), before);
  assert.equal('radius' in result, false);
});

test('bindings reject geometry controls that their renderer cannot apply', async () => {
  const fixture = await imageFixture();
  for (const [mutate, message] of [
    [
      (asset) => {
        asset.geometry.pivot.x = 0.25;
      },
      /fixed centered pivot/,
    ],
    [
      (asset) => {
        asset.geometry.rotorAnchors = [{ x: 0.5, y: 0.5, radius: 0.1, blades: 3 }];
      },
      /Rotor anchors are not supported/,
    ],
    [
      (asset) => {
        asset.geometry.nineSlice = { left: 0, top: 0, right: 0, bottom: 0 };
      },
      /Nine-slice geometry is not supported/,
    ],
  ]) {
    const candidate = clone(fixture.document);
    mutate(candidate.assets.at(-1));
    assert.throws(() => validateThemeBundle(candidate), message);
  }
  const terrain = clone(fixture.document);
  terrain.slots.at(-1).group = 'terrain';
  terrain.assets.at(-1).geometry.pivot.x = 0.25;
  assert.equal(validateThemeBundle(terrain).assets.at(-1).geometry.pivot.x, 0.25);
});

test('rotor geometry permits only blade counts supported by the registered renderer', async () => {
  const fixture = await imageFixture();
  for (const blades of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const asset = clone(fixture.document.assets.at(-1));
    asset.geometry.rotorAnchors = [{ x: 0.5, y: 0.5, radius: 0.1, blades }];
    if ([2, 3, 4].includes(blades))
      assert.equal(imagePresentation(asset).rotors[0].bladeCount, blades);
    else assert.throws(() => validateAssetRevision(asset), /rotor anchor/);
  }
});

test('source recipe coverage is not a completed production-art claim', () => {
  const doc = baseline(),
    report = presentationCoverage(doc);
  assert.equal(report.counts.source, doc.slots.length);
  assert.equal(report.counts.produced, 0);
  assert.equal(report.counts.reviewed, 0);
  assert.equal(report.requiredReady, false);
  const bad = clone(doc);
  bad.assets[0].quality.stage = 'produced';
  assert.throws(() => validateThemeBundle(bad), /not produced artwork/);
  const unreviewed = clone(doc);
  unreviewed.assets[0].quality.stage = 'reviewed';
  assert.throws(() => validateThemeBundle(unreviewed), /review evidence|recorded evidence/);
});

test('portable bundles compile through the CLI without rewriting their asset bytes', async (t) => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const cache = path.join(root, '.cache');
  await fs.mkdir(cache, { recursive: true });
  const workspace = await fs.mkdtemp(path.join(cache, 'presentation-cli-test-'));
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  const fixture = await imageFixture();
  const bundle = await exportThemeBundle(fixture.document, fixture.assets);
  const input = path.join(workspace, 'candidate.rltheme');
  await fs.writeFile(input, new Uint8Array(await bundle.arrayBuffer()));
  const output = path.join(workspace, 'compiled');
  const cli = path.join(root, 'scripts/compile-presentation.mjs');
  const result = await execute(process.execPath, [cli, '--bundle', input, '--out', output]);
  assert.equal(JSON.parse(result.stdout).files, 5);
  assert.deepEqual(
    new Uint8Array(await fs.readFile(path.join(output, 'assets', fixture.sha256 + '.png'))),
    new Uint8Array(fixture.bytes),
  );
  const manifest = JSON.parse(await fs.readFile(path.join(output, 'manifest.json')));
  assert.equal(manifest.files.find((file) => file.path.endsWith('.png')).sha256, fixture.sha256);
  await assert.rejects(
    execute(process.execPath, [cli, '--bundle', input, '--out', output]),
    /EEXIST/,
  );
  await assert.rejects(
    execute(process.execPath, [cli, '--bundle', input, '--manifest', input]),
    /Choose a portable bundle/,
  );
  await fs.appendFile(input, new Uint8Array([0]));
  await assert.rejects(execute(process.execPath, [cli, '--bundle', input]), /trailing/i);
});

test('every current base, playable archive, optional and external picture owner has a stable slot', async () => {
  const current = await inventoryCurrentPictures();
  assert.deepEqual(current, CURRENT_PICTURES);
  assert.equal(CURRENT_PICTURES.length, 155);
  assert.equal(CURRENT_PICTURES.filter((row) => row.owner.themeId === 'fpv').length, 56);
  const doc = baseline();
  assert.deepEqual(
    doc.slots.filter((slot) => slot.owner).map((slot) => slot.owner),
    CURRENT_PICTURES.map((row) => row.owner),
  );
  assert.ok(doc.slots.some((slot) => slot.id === 'screen.title.portrait'));
  assert.ok(
    doc.slots
      .filter((slot) => slot.owner && slot.owner.themeId !== 'fpv')
      .every((slot) => !slot.required),
  );
});
