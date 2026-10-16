import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { combineArtworkInventories } from './company-artwork-screening.mjs';
import { buildArtworkScreening, artworkScreeningHTML } from './content-artwork-screening.mjs';
import {
  DECODER_PATH,
  DECODER_SHA256,
  sha256,
  thumbnailPNG,
  transformPixels,
  validateArtworkChanges,
} from './artwork-screening.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const baseRecord = {
  id: 'base-art',
  kind: 'original',
  path: 'base.png',
  bytes: 10,
  width: 7,
  height: 5,
  pixelsSha256: 'base-pixels',
};
function fixture({
  baseArt = baseRecord,
  companyArt = { ...baseRecord, id: 'company-art', paths: ['company.png'] },
} = {}) {
  const base = {
    format: 'revealline-content-inventory.v1',
    method: { decoderSha256: DECODER_SHA256 },
    artwork: [baseArt],
    missions: [
      {
        id: 'solo/base',
        name: 'Base',
        mode: 'solo',
        classification: 'current',
        artworks: [{ id: baseArt.id }],
      },
    ],
  };
  const baseBytes = Buffer.from(JSON.stringify(base));
  const instance = {
    id: 'edition/receipt/mission',
    ownerId: 'company/chapter/mission/solo',
    classification: 'current',
    name: 'Company',
    mode: 'solo',
    campaignId: 'chapter',
    artwork: companyArt.id,
    gameplayHash: 'gameplay',
    themeSha256: 'theme',
  };
  const company = {
    format: 'revealline-company-content-inventory.v1',
    inputs: {
      decoder: { sha256: DECODER_SHA256 },
      baseInventory: {
        path: 'docs/content-offline/inventory.json',
        bytes: baseBytes.length,
        sha256: sha256(baseBytes),
      },
    },
    artwork: [companyArt],
    instances: [
      instance,
      { ...instance, id: 'bundle/receipt/mission' },
      { ...instance, id: 'edition/old-receipt/mission', classification: 'compatibility-only' },
    ],
  };
  return {
    baseBytes,
    company,
    combine: () => combineArtworkInventories(baseBytes, Buffer.from(JSON.stringify(company))),
  };
}

test('bundle views collapse for screening while retained presentation ownership stays historical', () => {
  const f = fixture(),
    combined = f.combine();
  assert.equal(combined.missions.length, 3);
  assert.equal(combined.missions.filter((row) => row.classification === 'current').length, 2);
  assert.equal(
    combined.missions.find((row) => row.id === f.company.instances[0].ownerId).inventoryLink.file,
    'company-inventory.html',
  );
  assert.equal(combined.inputs[1].sha256, sha256(Buffer.from(JSON.stringify(f.company))));
  assert.equal(f.company.instances.length, 3, 'Source instances are not mutated.');
});

test('stale input, unsupported decoder, duplicate instances and conflicting bundle variants fail closed', () => {
  for (const mutate of [
    (c) => (c.inputs.baseInventory.sha256 = 'changed'),
    (c) => (c.inputs.decoder.sha256 = 'changed'),
    (c) => c.instances.push(c.instances[0]),
    (c) => (c.instances[1].artwork = null),
    (c) => (c.instances[1].gameplayHash = 'changed'),
    (c) => (c.instances[1].themeSha256 = 'changed'),
  ]) {
    const f = fixture();
    mutate(f.company);
    assert.throws(f.combine);
  }
});

test('same-byte source originals merge without losing distinct base/company owners or accepting conflicting pins', () => {
  const f = fixture({ companyArt: { ...baseRecord, paths: ['company.png'] } });
  assert.equal(f.combine().artwork.length, 1);
  assert.equal(f.combine().missions.filter((row) => row.classification === 'current').length, 2);
  f.company.artwork[0].pixelsSha256 = 'different';
  assert.throws(f.combine, /Conflicting shared original/);
});

test('a rotated company copy of base artwork is detected and strict new-art review cannot approve it', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'revealline-company-screening-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const image = {
    width: 7,
    height: 5,
    pixels: Buffer.from(Array.from({ length: 105 }, (_, i) => (i * 37) % 256)),
  };
  const rotated = transformPixels(image, 'rotate-90');
  const bytes = thumbnailPNG(image),
    otherBytes = thumbnailPNG(rotated);
  const art = (data, picture, relative) => ({
    id: sha256(data),
    kind: 'original',
    path: relative,
    paths: [relative],
    bytes: data.length,
    width: picture.width,
    height: picture.height,
    pixelsSha256: sha256(picture.pixels),
    description: 'Test original',
  });
  const f = fixture({
    baseArt: art(bytes, image, 'base.png'),
    companyArt: art(otherBytes, rotated, 'company.png'),
  });
  for (const file of [DECODER_PATH, 'scripts/artwork-screening.mjs']) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.copyFile(path.join(ROOT, file), path.join(root, file));
  }
  await fs.writeFile(path.join(root, 'base.png'), bytes);
  await fs.writeFile(path.join(root, 'company.png'), otherBytes);
  const { report } = await buildArtworkScreening({
    root,
    inventoryBytes: Buffer.from(JSON.stringify(f.combine())),
  });
  assert.equal(report.exactCurrent.length, 1);
  assert.equal(report.exactCurrent[0].kind, 'exact-rotated-or-reflected-pixels');
  assert.equal(
    report.exactCurrent[0].assignments.length,
    2,
    'Bundle duplicate is not a third owner.',
  );
  assert.equal(report.historicalReuse.length, 1);
  const html = artworkScreeningHTML(report, {
    inventoryFile: 'company-inventory.html',
    reportFile: 'company-artwork-screening.json',
    command: 'node scripts/company-artwork-screening.mjs --check',
  });
  assert.ok(html.includes('company-inventory.html#edition%2Freceipt%2Fmission'));
  assert.ok(html.includes('inventory.html#solo%2Fbase'));
  assert.ok(html.includes('company-artwork-screening.json'));
  const baseline = { ...report, images: report.images.filter((row) => row.id === sha256(bytes)) };
  const result = validateArtworkChanges(report, {
    baseline,
    reviews: {
      format: 'revealline-artwork-visual-review.v1',
      inventorySha256: report.inventorySha256,
      entries: [
        {
          owner: f.company.instances[0].ownerId,
          artwork: sha256(otherBytes),
          decision: 'approved',
          reviewer: 'Test reviewer',
          notes: 'Cannot override exact copies.',
        },
      ],
    },
  });
  assert.equal(result.passed, false);
  assert.equal(result.exactViolations.length, 1);
  assert.equal(result.pendingVisualReview.length, 0);
});
