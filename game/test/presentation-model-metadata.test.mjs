import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJSON } from '../data-json.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import {
  FORMATS,
  validateThemeBundle,
  resolvePresentation,
  proposeDraft,
} from '../presentation/model.mjs';
import { reviseStudioTheme } from '../presentation/studio-session.mjs';
import {
  encodePresentationDocument,
  decodePresentationDocument,
  PRESENTATION_METADATA_FORMAT,
} from '../presentation/document-codec.mjs';

function history(
  count,
  { unique = false, prompt = 'Repeated authored prompt. '.repeat(100) } = {},
) {
  const document = structuredClone(createDefaultThemeBundle());
  const template = document.assets.find((asset) => asset.kind === 'recipe');
  while (document.assets.length < count) {
    const asset = structuredClone(template);
    asset.id = `metadata.history.${document.assets.length}`;
    asset.provenance.parent = null;
    document.assets.push(asset);
  }
  for (const [index, asset] of document.assets.entries()) {
    asset.provenance.source = unique ? `Authored source ${index}` : 'Repeated authored source';
    asset.provenance.prompt = unique ? `Authored prompt ${index}` : prompt;
  }
  return document;
}
const draft = (document, tokens = {}) => ({
  format: FORMATS.draft,
  baseRevision: document.revision,
  tokens,
  bindings: {},
});

test('valid logical history above 2048 records and 5MiB round-trips through compact model input', () => {
  const source = history(2080),
    before = canonicalJSON(source);
  assert.ok(Buffer.byteLength(before) > 5 * 1024 * 1024);
  assert.ok(Buffer.byteLength(before) < 8 * 1024 * 1024);
  const owned = validateThemeBundle(source),
    encoded = encodePresentationDocument(owned);
  assert.equal(JSON.parse(encoded).format, PRESENTATION_METADATA_FORMAT);
  assert.ok(Buffer.byteLength(encoded) < 5 * 1024 * 1024);
  assert.deepEqual(validateThemeBundle(encoded), owned);
  assert.equal(canonicalJSON(source), before);
  assert.equal(canonicalJSON(owned), before);
  assert.ok(Object.isFrozen(owned.assets[2079].provenance));
  assert.throws(() => validateThemeBundle(before), /byte budget/);
  assert.throws(() => validateThemeBundle(JSON.parse(encoded)), /Invalid metadata document/);
  assert.deepEqual(resolvePresentation(owned).assets, resolvePresentation(source).assets);
});

test('decoded transport still rejects semantic references, executable recipes and unknown fields', () => {
  const wire = JSON.parse(encodePresentationDocument(history(2050, { prompt: 'Short prompt' })));
  for (const [mutate, reason] of [
    [
      (doc) => {
        doc.themes[1].bindings['icon.play'] = { id: 'missing', revision: 1 };
      },
      /Missing slot or asset/,
    ],
    [
      (doc) => {
        doc.assets[0].recipe.id = 'https://example.com/code.mjs';
      },
      /Unregistered/,
    ],
    [
      (doc) => {
        doc.unapproved = true;
      },
      /not supported/,
    ],
  ]) {
    const changed = structuredClone(wire);
    mutate(changed.document);
    const text = canonicalJSON(changed);
    assert.ok(decodePresentationDocument(text));
    assert.throws(() => validateThemeBundle(text), reason);
  }
});

test('compact successor keeps every historical record immutable and checks stale revisions', () => {
  const previous = validateThemeBundle(history(2050, { prompt: 'Short prompt' }));
  const before = canonicalJSON(previous);
  const next = proposeDraft(previous, draft(previous, { textSize: 22 }), { expectedRevision: 1 });
  assert.equal(next.revision, 2);
  assert.deepEqual(next.assets, previous.assets);
  assert.deepEqual(next.themes.slice(0, previous.themes.length), previous.themes);
  assert.equal(canonicalJSON(previous), before);
  const rewritten = structuredClone(next);
  rewritten.assets[2049].provenance.prompt = 'Rewritten history';
  assert.throws(
    () =>
      validateThemeBundle(encodePresentationDocument(rewritten), { previous, expectedRevision: 1 }),
    /Immutable/,
  );
  assert.throws(() => proposeDraft(next, draft(previous), { expectedRevision: 1 }), /Stale/);
});

test('a staged revision that cannot encode is rejected without changing source or incoming assets', () => {
  const previous = validateThemeBundle(history(2048, { unique: true }));
  assert.equal(JSON.parse(encodePresentationDocument(previous)).format, FORMATS.bundle);
  const asset = structuredClone(previous.assets[0]);
  asset.id = 'metadata.unencodable';
  asset.provenance.source = 'One more source';
  asset.provenance.prompt = 'One more prompt';
  asset.provenance.parent = null;
  const before = canonicalJSON(previous),
    incoming = canonicalJSON(asset);
  assert.throws(() => reviseStudioTheme(previous, { assets: [asset] }), /item budget/);
  assert.equal(canonicalJSON(previous), before);
  assert.equal(canonicalJSON(asset), incoming);
  assert.equal(previous.revision, 1);
  assert.deepEqual(validateThemeBundle(previous), previous);
});

test('nonbundle draft and resolve option ownership retain their existing 2048-item boundary', () => {
  const source = createDefaultThemeBundle();
  const valid = draft(source, { textSize: 22 });
  assert.equal(resolvePresentation(source, { draft: valid }).tokens.textSize, 22);
  assert.equal(proposeDraft(source, valid).revision, 2);
  const oversized = { ...valid, unsupported: Array(2049).fill(null) };
  assert.throws(() => proposeDraft(source, oversized), /item budget/);
  assert.throws(
    () => resolvePresentation(source, { unsupported: Array(2049).fill(null) }),
    /item budget/,
  );
  assert.throws(
    () => proposeDraft(source, { ...valid, unsupported: Array(2048).fill(null) }),
    /not supported/,
  );
});
