import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { importCompanyArt } from '../../scripts/import-company-art.mjs';
import { crc32 } from '../../scripts/game-cli.mjs';
import { selectCurrentCompanyArtwork } from '../company-campaigns/artwork.mjs';

const bytes = await readFile(
  new URL('../editions/assets/coupa/bulk-02/listen-then-link-v1.png', import.meta.url),
);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const source = () => ({
  tool: 'image_gen.imagegen',
  assets: [
    {
      missionId: 'example-opening',
      alt: 'A quiet fictional garden.',
      prompt: 'An illustrative fictional garden with quiet spaces and no text.',
      original: {
        path: '$CODEX_HOME/generated_images/example/master.png',
        sha256,
        bytes: bytes.length,
        width: 960,
        height: 480,
      },
      selected: {
        path: 'game/editions/assets/example/garden-v1.png',
        sha256,
        bytes: bytes.length,
        width: 960,
        height: 480,
      },
      derivation: {
        kind: 'mechanical-resize',
        command: [
          'sips',
          '-z',
          '480',
          '960',
          '$CODEX_HOME/generated_images/example/master.png',
          '--out',
          'game/editions/assets/example/garden-v1.png',
        ],
        opaque: true,
      },
      review: {
        status: 'candidate',
        inspections: { original: 'complete', selected: 'complete' },
        original: 'Master inspected.',
        selected: 'Export inspected.',
        humanArtworkApproval: 'pending',
      },
    },
  ],
});
const fixture = source;
const input = (receipt = fixture()) => ({
  receipts: [receipt],
  assets: [],
  artwork: [],
  sources: { assets: [] },
  missions: [{ id: 'example-opening' }],
  read: async () => bytes,
});

test('art receipts register only selected PNGs and preserve exact external master provenance', async () => {
  const initial = input(),
    before = structuredClone(initial.receipts);
  const result = await importCompanyArt(initial);
  assert.deepEqual(initial.receipts, before);
  assert.equal(initial.assets.length, 0);
  assert.equal(result.assets.length, 1);
  assert.equal(result.artwork[0].id, 'example-opening-picture');
  assert.equal(result.artwork[0].review, 'candidate');
  assert.equal(result.sources.assets[0].rights, 'generated-derivative');
  assert.equal(result.sources.assets[0].original.sha256, sha256);
  assert.equal(result.assets[0].sha256, sha256);
  assert.deepEqual(result.assets[0].dependencies, []);
  const repeated = await importCompanyArt({ ...initial, ...result });
  assert.deepEqual(repeated.assets, result.assets);
  assert.deepEqual(repeated.artwork, result.artwork);
  assert.deepEqual(repeated.sources, result.sources);
  for (const executable of ['sips', '/usr/bin/sips']) {
    for (const option of ['-z', '--resampleHeightWidth']) {
      const receipt = fixture();
      receipt.assets[0].derivation.command.splice(0, 2, executable, option);
      const accepted = await importCompanyArt(input(receipt));
      assert.deepEqual(accepted.sources.assets[0].derivation, receipt.assets[0].derivation);
    }
  }
});

test('art import rejects tampered bytes, escaping paths, missing inspection and oversized exports', async () => {
  for (const change of [
    (record) => {
      record.selected.sha256 = 'a'.repeat(64);
    },
    (record) => {
      record.selected.bytes += 1;
    },
    (record) => {
      record.selected.width = 1024;
      record.selected.height = 512;
    },
    (record) => {
      record.selected.bytes = 1024 * 1024 + 1;
    },
    (record) => {
      record.selected.path = 'game/editions/assets/../private.png';
    },
    (record) => {
      record.original.path = '/Users/private/master.png';
    },
    (record) => {
      record.review.selected = '';
    },
    (record) => {
      record.missionId = 'not-authored';
    },
  ]) {
    const receipt = fixture();
    change(receipt.assets[0]);
    await assert.rejects(importCompanyArt(input(receipt)));
  }
});

test('art import requires explicit inspections, bounded master dimensions and a bound native resize', async () => {
  const changes = [
    (record) => delete record.review.inspections,
    (record) => delete record.review.inspections.original,
    (record) => delete record.review.inspections.selected,
    (record) => (record.review.inspections.original = 'pending'),
    (record) => (record.review.inspections.selected = 'pending'),
    (record) => (record.review.humanArtworkApproval = 'complete'),
    (record) => delete record.original.width,
    (record) => delete record.original.height,
    (record) => (record.original.width = 0),
    (record) => (record.original.height = -1),
    (record) => (record.original.width = 1.5),
    (record) => (record.original.width = 8193),
    (record) => (record.original.width = record.original.height = 8192),
    (record) => (record.derivation.command[0] = 'not-a-resize'),
    (record) => (record.derivation.command[0] = '/other/sips'),
    (record) => (record.derivation.command[1] = '--cropToHeightWidth'),
    (record) => (record.derivation.command[2] = '960'),
    (record) => (record.derivation.command[3] = '480'),
    (record) => (record.derivation.command[4] = '$CODEX_HOME/generated_images/other/master.png'),
    (record) => (record.derivation.command[5] = '--other-output'),
    (record) => (record.derivation.command[6] = 'game/editions/assets/example/other.png'),
    (record) => record.derivation.command.push('--extra'),
  ];
  for (const change of changes) {
    const receipt = fixture();
    change(receipt.assets[0]);
    // Prose cannot stand in for explicit inspection status or operation metadata.
    const initial = input(receipt);
    let reads = 0;
    initial.read = async () => {
      reads += 1;
      return bytes;
    };
    await assert.rejects(importCompanyArt(initial));
    assert.equal(reads, 0);
    assert.deepEqual(initial.assets, []);
    assert.deepEqual(initial.sources, { assets: [] });
  }
});

test('art import refuses replacement or duplicate mission registration without partial mutation', async () => {
  const initial = input(),
    result = await importCompanyArt(initial);
  const occupied = structuredClone(result.artwork);
  occupied[0].alt = 'A conflicting replacement.';
  await assert.rejects(importCompanyArt({ ...initial, artwork: occupied }), /replace/);
  assert.equal(initial.assets.length, 0);
  const duplicated = fixture();
  duplicated.assets.push(structuredClone(duplicated.assets[0]));
  await assert.rejects(importCompanyArt(input(duplicated)), /repeated/);
});

test('new art appends immutable revisions while authoring selects the newest picture', async () => {
  const first = await importCompanyArt(input());
  const receipt = fixture(),
    record = receipt.assets[0];
  record.revision = 2;
  record.selected.path = 'game/editions/assets/example/garden-v2.png';
  record.derivation.command[6] = record.selected.path;
  const second = await importCompanyArt({ ...input(receipt), ...first });
  assert.equal(second.assets.length, 2);
  assert.deepEqual(second.artwork[0], first.artwork[0]);
  assert.equal(second.artwork[1].revision, '2');
  assert.equal(second.sources.assets[1].revision, 2);
  assert.equal(second.assets[1].id, 'example-opening-reveal-v2');
  assert.deepEqual(selectCurrentCompanyArtwork(second.artwork), [second.artwork[1]]);
  assert.deepEqual(selectCurrentCompanyArtwork([...second.artwork].reverse()), [second.artwork[1]]);
  for (const replay of [fixture(), receipt]) {
    const repeated = await importCompanyArt({ ...input(replay), ...second });
    assert.deepEqual(repeated.artwork, second.artwork);
    assert.deepEqual(repeated.sources, second.sources);
  }
  const reusedPath = fixture();
  reusedPath.assets[0].revision = 2;
  await assert.rejects(importCompanyArt({ ...input(reusedPath), ...first }), /path/);
  for (const revision of [0, -1, 1.5, '2', 3, Number.MAX_SAFE_INTEGER + 1]) {
    record.revision = revision;
    await assert.rejects(importCompanyArt({ ...input(receipt), ...first }), /revision/);
  }
  assert.throws(
    () => selectCurrentCompanyArtwork([...second.artwork, second.artwork[1]]),
    /Repeated/,
  );
  assert.throws(
    () => selectCurrentCompanyArtwork([{ ...second.artwork[1], revision: 'v2' }]),
    /positive integers/,
  );
});

test('self-consistent receipts cannot admit truncated or transparent PNGs', async () => {
  const chunk = (type, data) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length);
    out.write(type, 4);
    out.set(data, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(2);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 6;
  const alpha = Buffer.concat([
    bytes.subarray(0, 8),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.from([0, 255, 255, 255, 255, 0, 0, 0, 0]))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  const transparencyChunk = Buffer.concat([
    bytes.subarray(0, 33),
    chunk('tRNS', Buffer.alloc(6)),
    bytes.subarray(33),
  ]);
  for (const invalid of [bytes.subarray(0, 33), alpha, transparencyChunk]) {
    const receipt = fixture(),
      selected = receipt.assets[0].selected;
    selected.bytes = invalid.length;
    selected.sha256 = createHash('sha256').update(invalid).digest('hex');
    selected.width = invalid.readUInt32BE(16);
    selected.height = invalid.readUInt32BE(20);
    receipt.assets[0].derivation.command[2] = String(selected.height);
    receipt.assets[0].derivation.command[3] = String(selected.width);
    const initial = { ...input(receipt), read: async () => invalid };
    await assert.rejects(importCompanyArt(initial));
    assert.deepEqual(initial.assets, []);
    assert.deepEqual(initial.artwork, []);
    assert.deepEqual(initial.sources, { assets: [] });
  }
});
