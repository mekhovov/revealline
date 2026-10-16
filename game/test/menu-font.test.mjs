import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const directory = new URL('../ui/fonts/departure-mono/', import.meta.url);

// Read the real Unicode cmap of the upstream OTF, independently of metadata claims.
function glyphFor(bytes, codepoint) {
  const tables = new Map();
  for (let i = 0; i < bytes.readUInt16BE(4); i++) {
    const offset = 12 + i * 16;
    tables.set(bytes.toString('ascii', offset, offset + 4), bytes.readUInt32BE(offset + 8));
  }
  const cmap = tables.get('cmap');
  for (let i = 0; i < bytes.readUInt16BE(cmap + 2); i++) {
    const record = cmap + 4 + i * 8;
    const platform = bytes.readUInt16BE(record),
      encoding = bytes.readUInt16BE(record + 2);
    if (!(platform === 0 || (platform === 3 && [1, 10].includes(encoding)))) continue;
    const start = cmap + bytes.readUInt32BE(record + 4);
    if (bytes.readUInt16BE(start) !== 4) continue;
    const count = bytes.readUInt16BE(start + 6) / 2;
    const endCodes = start + 14,
      startCodes = endCodes + 2 * count + 2;
    const deltas = startCodes + 2 * count,
      ranges = deltas + 2 * count;
    for (let segment = 0; segment < count; segment++) {
      const low = bytes.readUInt16BE(startCodes + 2 * segment);
      const high = bytes.readUInt16BE(endCodes + 2 * segment);
      if (codepoint < low || codepoint > high) continue;
      const range = bytes.readUInt16BE(ranges + 2 * segment),
        delta = bytes.readUInt16BE(deltas + 2 * segment);
      if (!range) return (codepoint + delta) % 65536;
      const glyph = bytes.readUInt16BE(ranges + 2 * segment + range + 2 * (codepoint - low));
      return glyph ? (glyph + delta) % 65536 : 0;
    }
  }
  return 0;
}

test('Departure Mono pins the unmodified upstream font, WOFF2 and distributable license', async () => {
  const manifest = JSON.parse(await readFile(new URL('provenance.json', directory), 'utf8'));
  assert.equal(manifest.family, 'Departure Mono');
  assert.equal(manifest.version, '1.500');
  assert.equal(manifest.unmodified, true);
  for (const file of manifest.files) {
    const bytes = await readFile(new URL(file.file, directory));
    assert.equal(bytes.length, file.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
    if (file.file.endsWith('.woff2')) {
      assert.equal(bytes.toString('ascii', 0, 4), 'wOF2');
      assert.ok(bytes.length < 32 * 1024);
    }
  }
  assert.match(
    await readFile(new URL('LICENSE', directory), 'utf8'),
    /SIL OPEN FONT LICENSE Version 1.1/,
  );
});

test('actual menu font cmap covers English, all Ukrainian letters, apostrophes and UI punctuation', async () => {
  const bytes = await readFile(new URL('DepartureMono-Regular.otf', directory));
  const alphabet = 'АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯабвгґдеєжзиіїйклмнопрстуфхцчшщьюя';
  const punctuation = "'’ʼ‘“”«»–—−…•·×÷°€₴↑↓←→";
  const characters = [
    ...Array.from({ length: 95 }, (_, i) => String.fromCodePoint(i + 32)),
    ...alphabet,
    ...punctuation,
  ];
  for (const character of characters)
    assert.notEqual(
      glyphFor(bytes, character.codePointAt(0)),
      0,
      `${character}: U+${character.codePointAt(0).toString(16)}`,
    );
});
