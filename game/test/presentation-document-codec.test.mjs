import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJSON } from '../data-json.mjs';
import {
  PRESENTATION_METADATA_FORMAT,
  PRESENTATION_METADATA_LIMITS as LIMITS,
  encodePresentationDocument,
  decodePresentationDocument,
  ownPresentationDocument,
} from '../presentation/document-codec.mjs';

// Transport-shape fixtures deliberately do not claim complete model validation.
// Actual immutable production history is qualified separately against pinned inputs.
const fixture = (count = 1, prompt = 'Original prompt') => ({
  format: 'revealline-theme-bundle.v1',
  assets: Array.from({ length: count }, (_, index) => ({
    id: `asset.${index}`,
    revision: 1,
    provenance: { source: 'Original source', prompt },
  })),
});
const byteLength = (value) => new TextEncoder().encode(value).byteLength;
function envelope(document) {
  const strings = [
    ...new Set(document.assets.flatMap((a) => [a.provenance.source, a.provenance.prompt])),
  ].sort();
  const copy = structuredClone(document);
  for (const asset of copy.assets)
    for (const key of ['source', 'prompt'])
      asset.provenance[key] = strings.indexOf(asset.provenance[key]);
  return { format: PRESENTATION_METADATA_FORMAT, strings, document: copy };
}

const nodeCount = (value) =>
  1 +
  (value && typeof value === 'object'
    ? Object.values(value).reduce((count, entry) => count + nodeCount(entry), 0)
    : 0);

function maximumEnvelopeDocument() {
  // 2,049 records force the compact representation; the final record reuses
  // the first pair so the dictionary reaches exactly its independent limit.
  const document = fixture(2049);
  for (const [index, asset] of document.assets.entries()) {
    asset.provenance.source = `Source ${index % 2048}`;
    asset.provenance.prompt = `Prompt ${index % 2048}`;
  }
  document.padding = [];
  let count = nodeCount(document);
  while (count < 100000) {
    const length = Math.min(4096, 100000 - count - 1);
    document.padding.push(Array(length).fill(null));
    count += length + 1;
  }
  return document;
}

test('a maximum logical document admits only the bounded dictionary and wrapper overhead', () => {
  assert.equal(LIMITS.nodes, 100000);
  assert.equal(LIMITS.records, 4096);
  const document = maximumEnvelopeDocument();
  assert.equal(nodeCount(document), 100000);
  const before = canonicalJSON(document);
  const encoded = encodePresentationDocument(document);
  const wire = JSON.parse(encoded);
  assert.equal(wire.format, PRESENTATION_METADATA_FORMAT);
  assert.equal(wire.strings.length, 4096);
  assert.equal(nodeCount(wire), 104099);
  assert.deepEqual(decodePresentationDocument(encoded), document);
  assert.deepEqual(decodePresentationDocument(wire), document);
  assert.equal(encodePresentationDocument(decodePresentationDocument(encoded)), encoded);
  assert.equal(canonicalJSON(document), before);
});

test('envelope overhead cannot authorize another logical node or another dictionary entry', () => {
  const document = maximumEnvelopeDocument();
  document.padding.at(-1).push(null);
  assert.equal(nodeCount(document), 100001);
  assert.throws(() => ownPresentationDocument(document), /structural budget/);
  assert.throws(() => encodePresentationDocument(document), /structural budget/);
  const overEnvelope = envelope(document);
  assert.equal(nodeCount(overEnvelope), 104100);
  for (const input of [overEnvelope, canonicalJSON(overEnvelope)])
    assert.throws(() => decodePresentationDocument(input), /structural budget/);

  // This smaller dictionary fits the wire cap, so decoding must still apply
  // the unchanged logical cap after reconstructing the document.
  for (const asset of document.assets) {
    asset.provenance.source = 'Source';
    asset.provenance.prompt = 'Prompt';
  }
  const overLogical = envelope(document);
  assert.equal(nodeCount(overLogical), 100006);
  for (const input of [overLogical, canonicalJSON(overLogical)])
    assert.throws(() => decodePresentationDocument(input), /structural budget/);

  const overDictionary = maximumEnvelopeDocument();
  overDictionary.assets.at(-1).provenance.source = 'One additional source';
  const tooManyStrings = envelope(overDictionary);
  assert.equal(tooManyStrings.strings.length, 4097);
  assert.throws(() => encodePresentationDocument(overDictionary), /item budget/);
  for (const input of [tooManyStrings, canonicalJSON(tooManyStrings)])
    assert.throws(() => decodePresentationDocument(input), /item budget/);
});

test('raw legacy metadata cannot borrow the compact-envelope node allowance', () => {
  const document = fixture();
  document.padding = Array.from({ length: 50 }, () => Array(1999).fill(null));
  assert.equal(nodeCount(document), 100010);
  for (const input of [document, canonicalJSON(document)])
    assert.throws(() => decodePresentationDocument(input), /structural budget/);
});

test('fitting legacy canonical bytes and independently owned records stay exact', () => {
  const document = fixture(3);
  const raw = canonicalJSON(document);
  assert.equal(encodePresentationDocument(document), raw);
  const decoded = decodePresentationDocument(raw);
  assert.deepEqual(decoded, document);
  decoded.assets[0].provenance.prompt = 'Changed';
  assert.equal(document.assets[0].provenance.prompt, 'Original prompt');
  assert.equal(decoded.assets[1].provenance.prompt, 'Original prompt');
  assert.throws(() => ownPresentationDocument(raw), /owned document object/);
});

test('large repeated provenance uses deterministic lossless metadata without editing input', () => {
  const document = fixture(720, 'Є'.repeat(3800));
  const before = canonicalJSON(document);
  assert.ok(byteLength(before) > LIMITS.encodedBytes);
  assert.ok(byteLength(before) < LIMITS.logicalBytes);
  const encoded = encodePresentationDocument(document);
  assert.equal(JSON.parse(encoded).format, PRESENTATION_METADATA_FORMAT);
  assert.ok(byteLength(encoded) < LIMITS.encodedBytes);
  const decoded = decodePresentationDocument(encoded);
  assert.equal(canonicalJSON(decoded), before);
  assert.equal(encodePresentationDocument(decoded), encoded);
  assert.equal(canonicalJSON(document), before);
  assert.throws(() => decodePresentationDocument(before), /byte budget/);
});

test('raw legacy arrays remain bounded while the explicit envelope admits up to4096', () => {
  const document = fixture(2049);
  assert.ok(byteLength(canonicalJSON(document)) < LIMITS.encodedBytes);
  const encoded = encodePresentationDocument(document);
  assert.equal(JSON.parse(encoded).format, PRESENTATION_METADATA_FORMAT);
  assert.deepEqual(decodePresentationDocument(encoded), document);
  assert.throws(() => decodePresentationDocument(canonicalJSON(document)), /item budget/);
  assert.throws(() => encodePresentationDocument(fixture(4097)), /item budget/);
});

test('only exact sorted used string dictionaries and integer indexes are accepted', () => {
  const valid = envelope(fixture(2));
  assert.deepEqual(decodePresentationDocument(valid), fixture(2));
  const cases = [
    (e) => {
      e.extra = true;
    },
    (e) => {
      delete e.document;
    },
    (e) => {
      delete e.strings;
    },
    (e) => {
      e.format = 'unknown-metadata.v9';
    },
    (e) => {
      e.strings = {};
    },
    (e) => {
      e.strings[0] = 2;
    },
    (e) => {
      e.strings.push(e.strings.at(-1));
    },
    (e) => {
      e.strings.reverse();
    },
    (e) => {
      e.strings.push('zzzz unused');
    },
    ...[-1, 0.5, 2, Number.MAX_SAFE_INTEGER, '0', null, {}, []].map((ref) => (e) => {
      e.document.assets[0].provenance.source = ref;
    }),
    (e) => {
      delete e.document.assets[0].provenance.prompt;
    },
  ];
  for (const change of cases) {
    const malformed = structuredClone(valid);
    change(malformed);
    assert.throws(() => decodePresentationDocument(malformed));
  }
  assert.throws(
    () => decodePresentationDocument('{"__proto__":{},"assets":[]}'),
    /Forbidden JSON key/,
  );
  const accessor = structuredClone(valid);
  Object.defineProperty(accessor, 'document', {
    enumerable: true,
    get() {
      throw new Error('getter ran');
    },
  });
  assert.throws(() => decodePresentationDocument(accessor), /accessors/);
  const cycle = structuredClone(valid);
  cycle.document.assets[0].provenance.source = cycle;
  assert.throws(() => decodePresentationDocument(cycle), /cycles/);
});

test('small wire dictionaries cannot bypass expanded bytes, strings, nodes or depth', () => {
  const amplified = envelope(fixture(1100, 'Є'.repeat(4000)));
  assert.ok(byteLength(canonicalJSON(amplified)) < LIMITS.encodedBytes);
  assert.throws(() => decodePresentationDocument(amplified), /byte budget/);
  const longString = envelope(fixture(1, 'x'.repeat(8193)));
  assert.throws(() => decodePresentationDocument(longString), /string exceeds/);
  const nodes = fixture(4096);
  for (const asset of nodes.assets) asset.detail = Array(20).fill(null);
  assert.throws(() => decodePresentationDocument(envelope(nodes)), /structural budget/);
  const deep = fixture();
  let at = deep;
  for (let i = 0; i < 20; i++) at = at.child = {};
  assert.throws(() => encodePresentationDocument(deep), /structural budget/);
});

test('logical8MiB and encoded5MiB ceilings are exact and independent', () => {
  const document = fixture(1050, 'x'.repeat(7900));
  let remaining = LIMITS.logicalBytes - byteLength(canonicalJSON(document));
  assert.ok(remaining > 0);
  for (const asset of document.assets) {
    const extra = Math.min(8192 - asset.provenance.prompt.length, remaining);
    asset.provenance.prompt += 'x'.repeat(extra);
    remaining -= extra;
  }
  assert.equal(remaining, 0);
  assert.equal(byteLength(canonicalJSON(document)), LIMITS.logicalBytes);
  const encoded = encodePresentationDocument(document);
  assert.deepEqual(decodePresentationDocument(encoded), document);
  document.assets.at(-1).provenance.source += 'x';
  assert.throws(() => encodePresentationDocument(document), /byte budget/);
  const noSavings = fixture(700);
  for (const asset of noSavings.assets) asset.description = 'd'.repeat(7800);
  assert.ok(byteLength(canonicalJSON(noSavings)) < LIMITS.logicalBytes);
  assert.throws(() => encodePresentationDocument(noSavings), /byte budget/);
});

test('serialized raw and compact metadata accept exactly5MiB and reject the next byte', () => {
  const raw = fixture(700, 'p'.repeat(7300));
  let left = LIMITS.encodedBytes - byteLength(canonicalJSON(raw));
  for (const asset of raw.assets) {
    const add = Math.min(8192 - asset.provenance.prompt.length, left);
    asset.provenance.prompt += 'p'.repeat(add);
    left -= add;
  }
  assert.equal(left, 0);
  const rawBytes = encodePresentationDocument(raw);
  assert.equal(byteLength(rawBytes), LIMITS.encodedBytes);
  assert.equal(JSON.parse(rawBytes).format, raw.format);
  assert.deepEqual(decodePresentationDocument(rawBytes), raw);
  raw.assets.at(-1).provenance.source += 'x';
  assert.throws(() => decodePresentationDocument(canonicalJSON(raw)), /byte budget/);
  const document = fixture(700);
  for (const asset of document.assets) asset.description = 'd'.repeat(7000);
  let remaining = LIMITS.encodedBytes - byteLength(canonicalJSON(envelope(document)));
  for (const asset of document.assets) {
    const add = Math.min(8192 - asset.description.length, remaining);
    asset.description += 'd'.repeat(add);
    remaining -= add;
  }
  assert.equal(remaining, 0);
  const compact = encodePresentationDocument(document);
  assert.equal(JSON.parse(compact).format, PRESENTATION_METADATA_FORMAT);
  assert.equal(byteLength(compact), LIMITS.encodedBytes);
  assert.deepEqual(decodePresentationDocument(compact), document);
  document.assets.at(-1).description += 'x';
  assert.throws(() => encodePresentationDocument(document), /byte budget/);
});

test('codec never invokes toJSON or accepts custom prototypes and bounds dictionary cardinality', () => {
  let called = false;
  const document = fixture();
  document.toJSON = () => {
    called = true;
    return fixture();
  };
  assert.throws(() => encodePresentationDocument(document), /plain JSON/);
  assert.equal(called, false);
  const customPrototype = fixture();
  Object.setPrototypeOf(customPrototype.assets[0].provenance, { hidden: 'value' });
  assert.throws(() => encodePresentationDocument(customPrototype), /plain JSON/);
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    const value = envelope(fixture());
    Object.defineProperty(value.document.assets[0].provenance, key, {
      value: 'blocked',
      enumerable: true,
    });
    assert.throws(() => decodePresentationDocument(value), /Forbidden JSON key/);
  }
  const manyStrings = fixture(2050);
  for (const [index, asset] of manyStrings.assets.entries()) {
    asset.provenance.source = `Source ${index}`;
    asset.provenance.prompt = `Prompt ${index}`;
  }
  assert.equal(ownPresentationDocument(manyStrings).assets.length, 2050);
  assert.throws(() => encodePresentationDocument(manyStrings), /item budget/);
});
