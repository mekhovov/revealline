import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  validateArtworkCollection,
  exportArtworkCollection,
  importArtworkCollection,
} from '../../authoring/asset-studio/artwork-collection.mjs';

const directory = new URL('../../authoring/library/community-art-cohort-v1/', import.meta.url);
const hashes = {
  'workshop-original': '8782c3642af6866d09e441891b34876e0c8fa3197a018d9e0cef562699a79cf8',
  'poltava-original': '6e528a622b5bcd1fa2ed0b0ddf50404ecf7a433fee0a71ef400ae9f309dc13c5',
  'synevyr-original': 'e4e66fcd65d54c560353ad8f08c42454a7b9ea187a81998dece04a6bd165d5c1',
};

test('C5 source cohort retains all three exact originals and prompts through the Studio packet', async () => {
  const packet = validateArtworkCollection(
    await readFile(new URL('collection.json', directory), 'utf8'),
  );
  assert.equal(packet.treatment, 'pixel-art');
  assert.equal(packet.revision, 1);
  assert.deepEqual(packet.artworks.map((entry) => entry.id).sort(), Object.keys(hashes).sort());
  assert.ok(packet.sources.every((source) => source.use === 'reference-only'));
  const files = new Map();
  for (const entry of packet.artworks) {
    const bytes = await readFile(new URL(entry.file.name, directory));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hashes[entry.id]);
    assert.equal(entry.file.sha256, hashes[entry.id]);
    assert.equal(entry.file.bytes, bytes.length);
    assert.equal(entry.role, 'reveal');
    assert.equal(entry.medium, 'pixel-art');
    assert.equal(entry.provenance.origin, 'generated');
    assert.equal(entry.provenance.derivative, null);
    assert.deepEqual([entry.file.width, entry.file.height], [1774, 887]);
    assert.equal(
      entry.provenance.prompt,
      (
        await readFile(new URL(entry.id.replace('-original', '-prompt.txt'), directory), 'utf8')
      ).trim(),
    );
    files.set(entry.file.name, new Blob([bytes]));
  }
  // Native decoding is exercised separately in Asset Studio browser evidence.
  // Here the callback reads the PNG header; it is not browser pixel proof.
  const options = {
    decodeImage: async (blob) => {
      const bytes = Buffer.from(await blob.arrayBuffer());
      return { naturalWidth: bytes.readUInt32BE(16), naturalHeight: bytes.readUInt32BE(20) };
    },
  };
  const blob = await exportArtworkCollection(packet, files, options);
  const imported = await importArtworkCollection(blob, options);
  assert.deepEqual(imported.document, packet);
  for (const [name, original] of files)
    assert.deepEqual(await imported.assets.get(name).arrayBuffer(), await original.arrayBuffer());
  assert.equal(
    [...files.values()].reduce((sum, file) => sum + file.size, 0),
    7633598,
  );
});
