import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { format } from 'prettier';
import { canonicalJSON } from '../data-json.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { LIMITS, validateThemeBundle } from '../presentation/model.mjs';
import {
  PRESENTATION_METADATA_FORMAT,
  encodePresentationDocument,
  decodePresentationDocument,
} from '../presentation/document-codec.mjs';
import { createStudioStore } from '../presentation/studio-store.mjs';
import { reviseStudioTheme } from '../presentation/studio-session.mjs';
import { loadPublishedStudio } from '../presentation/published-studio.mjs';
import { importThemeBundle, hashPresentationBytes } from '../presentation/bundle.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { compilePresentation } from '../../scripts/compile-presentation.mjs';
import { compileFieldKitProduction } from '../../scripts/produce-field-kit-theme.mjs';

const encoder = new TextEncoder();
const bytes = (value) => encoder.encode(canonicalJSON(value)).length;
const baseURL = 'https://game.example/site/game/presentation/compiled/';
const clone = structuredClone;
let largeFixture;
function largeDocument() {
  if (largeFixture) return largeFixture;
  const document = clone(createDefaultThemeBundle());
  const original = document.assets.find((asset) => asset.kind === 'recipe');
  for (let index = 0; index < 720; index++) {
    const asset = clone(original);
    asset.id = `metadata.io.${index}`;
    asset.provenance.prompt = 'Original immutable fixture prompt. '.repeat(200);
    document.assets.push(asset);
  }
  document.revision++;
  assert.ok(bytes(document) > LIMITS.manifestBytes);
  largeFixture = validateThemeBundle(document);
  return largeFixture;
}

function addNearLimitRecords(source, target) {
  const document = clone(source);
  const original = document.assets.find((asset) => asset.kind === 'recipe');
  const added = [];
  for (let index = 0; index < 40; index++) {
    const asset = clone(original);
    asset.id = `metadata.capacity.${index}`;
    asset.provenance.prompt = '';
    asset.quality = { stage: 'source', evidence: [] };
    added.push(asset);
    document.assets.push(asset);
  }
  document.revision++;
  let remaining = target - bytes(document);
  assert.ok(remaining > 0);
  for (const asset of added) {
    for (let index = 0; index < 16 && remaining > 0; index++) {
      const overhead = 2 + (index ? 1 : 0);
      const length = Math.min(2048, remaining - overhead);
      assert.ok(length > 0);
      asset.quality.evidence.push(String.fromCharCode(65 + index).padEnd(length, 'x'));
      remaining -= length + overhead;
    }
  }
  assert.equal(remaining, 0, 'Only new fixture evidence may pad metadata');
  assert.equal(bytes(document), target);
  assert.deepEqual(document.assets.slice(0, source.assets.length), source.assets);
  return validateThemeBundle(document);
}

test('Studio saves compact metadata, reads without migration writes and retains CAS history checks', async () => {
  const fixture = managedIndexedDB();
  const store = createStudioStore({ indexedDB: fixture.indexedDB });
  const original = createDefaultThemeBundle();
  await store.save(original, new Map());
  assert.deepEqual(fixture.contents().get('drafts').get('workspace').document, original);
  const document = largeDocument();
  await store.save(document, new Map(), { expectedGeneration: 1 });
  const persisted = clone(fixture.contents().get('drafts').get('workspace'));
  assert.equal(persisted.document.format, PRESENTATION_METADATA_FORMAT);
  assert.ok(bytes(persisted.document) <= LIMITS.manifestBytes);
  const writes = fixture.allPuts.length;
  assert.deepEqual((await store.load()).document, document);
  assert.equal(fixture.allPuts.length, writes);
  assert.deepEqual(fixture.contents().get('drafts').get('workspace'), persisted);
  await assert.rejects(
    store.save(document, new Map(), { expectedGeneration: 1 }),
    /changed in another tab/,
  );
  const changed = reviseStudioTheme(document, { tokens: { cyan: '#eeeeff' } });
  fixture.failAnyPutAt = 1;
  await assert.rejects(store.save(changed, new Map(), { expectedGeneration: 2 }), /write failure/);
  assert.deepEqual((await store.load()).document, document);
  fixture.failAnyPutAt = null;
  const rewritten = clone(changed);
  rewritten.assets[0].description += ' changed ancestor';
  await assert.rejects(
    store.save(rewritten, new Map(), { expectedGeneration: 2 }),
    /Immutable assets history changed/,
  );
  await store.save(changed, new Map(), { expectedGeneration: 2 });
  assert.deepEqual((await store.load()).document, changed);
  assert.equal((await store.load()).generation, 3);
  await store.close();
});

test('unencodable edits fail before opening storage and malformed persisted dictionaries never write', async () => {
  const fixture = managedIndexedDB();
  const store = createStudioStore({ indexedDB: fixture.indexedDB });
  const document = clone(createDefaultThemeBundle());
  const original = document.assets.find((asset) => asset.kind === 'recipe');
  for (let index = 0; index < 240; index++) {
    const asset = clone(original);
    asset.id = `metadata.unencodable.${index}`;
    asset.provenance.prompt = '';
    asset.quality = {
      stage: 'source',
      evidence: Array.from({ length: 12 }, (_, entry) =>
        String.fromCharCode(65 + entry).padEnd(2000, 'x'),
      ),
    };
    document.assets.push(asset);
  }
  await assert.rejects(store.save(document, new Map()), /byte budget/);
  assert.equal(fixture.openCount, 0);
  assert.deepEqual(fixture.allPuts, []);
  await store.save(largeDocument(), new Map());
  const record = fixture.contents().get('drafts').get('workspace');
  record.document.document.assets[0].provenance.source = record.document.strings.length;
  const writes = fixture.allPuts.length;
  await assert.rejects(store.load(), /dictionary reference/);
  assert.equal(fixture.allPuts.length, writes);
  await store.close();
});

test('compiler and published Studio preserve compact logical history and validate before asset requests', async () => {
  const small = createDefaultThemeBundle();
  const old = await compilePresentation(small);
  assert.equal(new TextDecoder().decode(old.files.get('studio.json')), canonicalJSON(small) + '\n');
  const document = largeDocument();
  const compiled = await compilePresentation(document);
  const metadata = compiled.files.get('studio.json');
  assert.ok(metadata.length <= LIMITS.manifestBytes);
  assert.equal(JSON.parse(new TextDecoder().decode(metadata)).format, PRESENTATION_METADATA_FORMAT);
  assert.deepEqual(decodePresentationDocument(new TextDecoder().decode(metadata)), document);
  const manifest = JSON.parse(new TextDecoder().decode(compiled.files.get('manifest.json')));
  const entry = manifest.files.find((row) => row.path === 'studio.json');
  assert.equal(entry.bytes, metadata.length);
  assert.equal(entry.sha256, await hashPresentationBytes(metadata));
  const requested = [];
  const loaded = await loadPublishedStudio({
    baseURL,
    fetch: async (url) => {
      requested.push(url);
      return new Response(compiled.files.get(url.slice(baseURL.length)));
    },
  });
  assert.deepEqual(loaded.document, document);
  assert.deepEqual(requested, [baseURL + 'studio.json']);
  const malformed = JSON.parse(new TextDecoder().decode(metadata));
  malformed.document.assets[0].provenance.prompt = -1;
  requested.length = 0;
  await assert.rejects(
    loadPublishedStudio({
      baseURL,
      fetch: async (url) => {
        requested.push(url);
        return new Response(JSON.stringify(malformed));
      },
    }),
    /dictionary reference/,
  );
  assert.deepEqual(requested, [baseURL + 'studio.json']);
  await assert.rejects(
    loadPublishedStudio({
      baseURL,
      fetch: async () => new Response(' '.repeat(LIMITS.manifestBytes + 1)),
    }),
    /byte budget/,
  );
});

test('current production bytes stay exact and over-budget pretty Studio output retains bounded canonical bytes', async () => {
  const source = await readFile(
    new URL('../../authoring/library/fpv-field-kit/production.rltheme', import.meta.url),
  );
  const production = await importThemeBundle(new Blob([source]), { decodeImage: null });
  const read = (relative) => readFile(new URL('../../' + relative, import.meta.url));
  const current = await compileFieldKitProduction(production, {
    read,
    config: { singleQuote: true, printWidth: 100 },
  });
  for (const [name, body] of current.files)
    assert.deepEqual(
      new Uint8Array(body),
      new Uint8Array(await readFile(new URL('../presentation/compiled/' + name, import.meta.url))),
      name,
    );
  const document = addNearLimitRecords(production.document, LIMITS.manifestBytes - 1);
  const compiled = await compilePresentation(document, production.assets);
  assert.equal(compiled.files.get('studio.json').length, LIMITS.manifestBytes);
  assert.equal(compiled.files.get('studio.json').at(-1), 10);
  const pretty = await format(new TextDecoder().decode(compiled.files.get('studio.json')), {
    parser: 'json',
  });
  assert.ok(encoder.encode(pretty).length > LIMITS.manifestBytes);
  const formatted = await compileFieldKitProduction(
    { document, assets: production.assets },
    { read },
  );
  assert.equal(
    Buffer.compare(formatted.files.get('studio.json'), compiled.files.get('studio.json')),
    0,
    'Retained compiler output must preserve the exact canonical Studio bytes',
  );
  const exact = clone(document);
  exact.assets.at(-1).provenance.prompt += 'x';
  assert.equal(bytes(exact), LIMITS.manifestBytes);
  const atLimit = await compilePresentation(exact, production.assets);
  assert.equal(atLimit.files.get('studio.json').length, LIMITS.manifestBytes);
  assert.notEqual(atLimit.files.get('studio.json').at(-1), 10);
  assert.equal(
    encodePresentationDocument(exact),
    new TextDecoder().decode(atLimit.files.get('studio.json')),
  );
});
