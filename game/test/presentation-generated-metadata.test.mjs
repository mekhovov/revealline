import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { format } from 'prettier';
import { checkPresentationMetadata } from '../../scripts/check-presentation-metadata.mjs';
import { canonicalJSON } from '../data-json.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { LIMITS, validateThemeBundle } from '../presentation/model.mjs';
import { encodePresentationDocument } from '../presentation/document-codec.mjs';

const bytes = (value) => Buffer.from(canonicalJSON(value));
const hash = (value) => createHash('sha256').update(value).digest('hex');
function inventory(document, studio) {
  return bytes({
    format: 'revealline-presentation-build.v1',
    source: { id: document.id, revision: document.revision },
    files: [{ path: 'studio.json', bytes: studio.length, sha256: hash(studio) }],
  });
}

function exactCeiling() {
  const document = structuredClone(createDefaultThemeBundle());
  let remaining = LIMITS.manifestBytes - bytes(document).length;
  for (const asset of document.assets) {
    for (let index = asset.quality.evidence.length; index < 16 && remaining > 0; index++) {
      const overhead = 2 + (index ? 1 : 0);
      const length = Math.min(2048, remaining - overhead);
      assert.ok(length > 0);
      asset.quality.evidence.push(String(index).padEnd(length, 'x'));
      remaining -= length + overhead;
    }
    if (!remaining) break;
  }
  assert.equal(remaining, 0);
  assert.equal(bytes(document).length, LIMITS.manifestBytes);
  return validateThemeBundle(document);
}

test('the committed generated Studio metadata passes its exact format and inventory binding unchanged', async () => {
  const [studio, manifest, config] = await Promise.all([
    fs.readFile(new URL('../presentation/compiled/studio.json', import.meta.url)),
    fs.readFile(new URL('../presentation/compiled/manifest.json', import.meta.url)),
    fs.readFile(new URL('../../.prettierrc.json', import.meta.url), 'utf8').then(JSON.parse),
  ]);
  const before = new Uint8Array(studio);
  const result = await checkPresentationMetadata(studio, manifest, { config: config ?? {} });
  assert.equal(result.formatting, 'prettier');
  assert.equal(result.sha256, hash(studio));
  assert.deepEqual(new Uint8Array(studio), before);
});

test('format validation refuses arbitrary valid JSON whitespace even with matching inventory, malformed metadata and stale file facts', async () => {
  const document = createDefaultThemeBundle();
  const canonical = Buffer.from(encodePresentationDocument(document));
  const pretty = Buffer.from(await format(canonical.toString(), { parser: 'json' }));
  await checkPresentationMetadata(pretty, inventory(document, pretty));
  await assert.rejects(
    checkPresentationMetadata(canonical, inventory(document, canonical)),
    /formatting is stale/,
  );
  const malformed = Buffer.from('{');
  await assert.rejects(
    checkPresentationMetadata(malformed, inventory(document, malformed)),
    /valid JSON/,
  );
  const invalid = structuredClone(document);
  invalid.assets[0].unknown = true;
  const invalidBytes = Buffer.from(await format(canonicalJSON(invalid), { parser: 'json' }));
  await assert.rejects(
    checkPresentationMetadata(invalidBytes, inventory(document, invalidBytes)),
    /not supported/,
  );
  for (const field of ['bytes', 'sha256']) {
    const stale = JSON.parse(inventory(document, pretty));
    stale.files[0][field] = field === 'bytes' ? pretty.length + 1 : '0'.repeat(64);
    await assert.rejects(
      checkPresentationMetadata(pretty, bytes(stale)),
      /bytes or hash are stale/,
    );
  }
  const staleSource = JSON.parse(inventory(document, pretty));
  staleSource.source.revision++;
  await assert.rejects(
    checkPresentationMetadata(pretty, bytes(staleSource)),
    /source does not match/,
  );
  const duplicate = JSON.parse(inventory(document, pretty));
  duplicate.files.push({ ...duplicate.files[0] });
  await assert.rejects(checkPresentationMetadata(pretty, bytes(duplicate)), /exactly once/);
});

test('when pretty output exceeds the budget only exact bounded canonical bytes pass, with no newline at the ceiling', async () => {
  const document = exactCeiling();
  const canonical = Buffer.from(encodePresentationDocument(document));
  assert.equal(canonical.length, LIMITS.manifestBytes);
  const pretty = Buffer.from(await format(canonical.toString(), { parser: 'json' }));
  assert.ok(pretty.length > LIMITS.manifestBytes);
  const result = await checkPresentationMetadata(canonical, inventory(document, canonical));
  assert.equal(result.formatting, 'bounded-canonical');
  assert.equal(result.bytes, LIMITS.manifestBytes);
  const newline = Buffer.concat([canonical, Buffer.from('\n')]);
  await assert.rejects(
    checkPresentationMetadata(newline, inventory(document, newline)),
    /encoded byte budget/,
  );
  await assert.rejects(
    checkPresentationMetadata(pretty, inventory(document, pretty)),
    /encoded byte budget/,
  );
  const short = structuredClone(document);
  short.assets[0].quality.evidence[0] = short.assets[0].quality.evidence[0].slice(0, -1);
  const shorterCanonical = Buffer.from(encodePresentationDocument(short));
  assert.equal(shorterCanonical.length, LIMITS.manifestBytes - 1);
  await assert.rejects(
    checkPresentationMetadata(shorterCanonical, inventory(short, shorterCanonical)),
    /formatting is stale/,
  );
  const requiredNewline = Buffer.concat([shorterCanonical, Buffer.from('\n')]);
  assert.equal(
    (await checkPresentationMetadata(requiredNewline, inventory(short, requiredNewline)))
      .formatting,
    'bounded-canonical',
  );
});

test('compact generated metadata is decoded before complete schema validation', async () => {
  const document = structuredClone(createDefaultThemeBundle());
  const recipe = document.assets.find((asset) => asset.kind === 'recipe');
  while (document.assets.length <= 2048) {
    const next = structuredClone(recipe);
    next.id = `format.history.${document.assets.length}`;
    next.provenance.parent = null;
    document.assets.push(next);
  }
  const canonical = encodePresentationDocument(validateThemeBundle(document));
  const envelope = JSON.parse(canonical);
  assert.notEqual(envelope.format, document.format);
  const pretty = Buffer.from(await format(canonical, { parser: 'json' }));
  assert.ok(pretty.length <= LIMITS.manifestBytes);
  assert.equal(
    (await checkPresentationMetadata(pretty, inventory(document, pretty))).formatting,
    'prettier',
  );
  envelope.document.assets[0].unknown = true;
  const invalid = Buffer.from(await format(canonicalJSON(envelope), { parser: 'json' }));
  await assert.rejects(
    checkPresentationMetadata(invalid, inventory(document, invalid)),
    /not supported/,
  );
});
