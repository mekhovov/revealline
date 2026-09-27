import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { validateCompiledPresentation } from '../presentation/host.mjs';
import { hashPresentationBytes } from '../presentation/bundle.mjs';
import { compilePresentation } from '../../scripts/compile-presentation.mjs';
import { FORMATS } from '../presentation/model.mjs';
import { pngBytes } from './helpers/media-fixtures.mjs';

test('player files include the bound image and exclude unselected immutable image history', async () => {
  const source = structuredClone(createDefaultThemeBundle()),
    first = pngBytes();
  const payload = Buffer.from('fixture\0unselected'),
    chunk = Buffer.alloc(payload.length + 12);
  chunk.writeUInt32BE(payload.length, 0);
  chunk.write('tEXt', 4);
  payload.copy(chunk, 8);
  let crc = 0xffffffff;
  for (const byte of chunk.subarray(4, -4)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  chunk.writeUInt32BE((crc ^ 0xffffffff) >>> 0, chunk.length - 4);
  const second = Buffer.concat([first.subarray(0, -12), chunk, first.subarray(-12)]);
  const hashes = await Promise.all([first, second].map(hashPresentationBytes));
  const geometry = {
    frame: { x: 0, y: 0, width: 1, height: 1 },
    pivot: { x: 0.5, y: 0.5 },
    occupiedBounds: null,
    rotorAnchors: [],
    nineSlice: null,
  };
  source.slots.push({
    ...structuredClone(source.slots.find((slot) => slot.id === 'icon.play')),
    id: 'test.image',
    dimensions: { width: 1, height: 1 },
    geometry,
  });
  [first, second].forEach((image, index) =>
    source.assets.push({
      format: FORMATS.asset,
      id: `test.image-${index}`,
      revision: 1,
      kind: 'image',
      description: 'A source image',
      provenance: {
        creator: 'Original artist',
        source: 'Private image source',
        license: 'CC0',
        prompt: 'Private production notes',
        parent: null,
      },
      file: { sha256: hashes[index], bytes: image.length, mime: 'image/png', width: 1, height: 1 },
      recipe: null,
      geometry,
      quality: { stage: 'produced', evidence: [] },
    }),
  );
  source.themes[1].bindings['test.image'] = { id: 'test.image-0', revision: 1 };
  const assets = new Map(hashes.map((hash, index) => [hash, new Blob([[first, second][index]])]));
  const legacy = await compilePresentation(source, assets),
    player = await compilePresentation(source, assets, { playerOnly: true });
  assert.ok(legacy.files.has(`assets/${hashes[1]}.png`));
  assert.ok(player.files.has(`assets/${hashes[0]}.png`));
  assert.ok(!player.files.has(`assets/${hashes[1]}.png`));
  assert.equal(player.dependencies.files.length, 1);
});

test('player projection omits studio and private provenance without altering authoring records', async () => {
  const source = structuredClone(createDefaultThemeBundle());
  source.assets[0].provenance.source = 'private-drive-sentinel';
  source.assets[0].provenance.prompt = 'unpublished-prompt-sentinel';
  source.assets[0].description = 'private-description-sentinel';
  const legacy = await compilePresentation(source);
  const player = await compilePresentation(source, new Map(), { playerOnly: true });
  assert.ok(legacy.files.has('studio.json'));
  assert.ok(!player.files.has('studio.json'));
  const serialized = [...player.files.values()]
    .map((value) => new TextDecoder().decode(value))
    .join('\n');
  for (const secret of [
    'private-drive-sentinel',
    'unpublished-prompt-sentinel',
    'private-description-sentinel',
  ])
    assert.ok(!serialized.includes(secret));
  assert.equal(source.assets[0].provenance.source, 'private-drive-sentinel');
  const compiled = validateCompiledPresentation(
    new TextDecoder().decode(player.files.get('runtime.json')),
  );
  assert.deepEqual(compiled.resolved.bindings, legacy.resolved.bindings);
  assert.equal(
    compiled.resolved.assets['font.ui'].provenance.license,
    legacy.resolved.assets['font.ui'].provenance.license,
  );
});

test('player output retains only explicitly requested original safe runtime hashes', async () => {
  const source = structuredClone(createDefaultThemeBundle());
  const old = await compilePresentation(source, new Map(), { playerOnly: true });
  const pin = await hashPresentationBytes(old.files.get('runtime.json'));
  source.revision += 1;
  source.themes[0].tokens.cyan = '#abcdef';
  const next = await compilePresentation(source, new Map(), {
    playerOnly: true,
    previousOutput: old.files,
  });
  assert.ok(!next.files.has(`runtime.${pin}.json`));
  const retained = await compilePresentation(source, new Map(), {
    playerOnly: true,
    previousOutput: old.files,
    retainedRuntimeHashes: [pin],
  });
  assert.deepEqual(retained.files.get(`runtime.${pin}.json`), old.files.get('runtime.json'));
  assert.ok(!retained.files.has('studio.json'));
  const authoring = await compilePresentation(source);
  const privatePin = await hashPresentationBytes(authoring.files.get('runtime.json'));
  await assert.rejects(
    compilePresentation(source, new Map(), {
      playerOnly: true,
      previousOutput: authoring.files,
      retainedRuntimeHashes: [privatePin],
    }),
    /provenance/,
  );
  await assert.rejects(
    compilePresentation(source, new Map(), {
      playerOnly: true,
      previousOutput: old.files,
      retainedRuntimeHashes: ['a'.repeat(64)],
    }),
    /hash differs/,
  );
});
