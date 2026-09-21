import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm, symlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import {
  buildOriginalSoundtrackCatalogue,
  resolveOriginalProduction,
  compileReadyOriginals,
  ORIGINAL_READY_FORMAT,
  ORIGINAL_REVIEW_GATES,
} from '../../authoring/library/revealline-original-soundtrack/build.mjs';
import { silenceBytes } from './helpers/soundtrack-fixtures.mjs';

const production = JSON.parse(
  await readFile(
    new URL(
      '../../authoring/library/revealline-original-soundtrack/production.json',
      import.meta.url,
    ),
  ),
);
const sha = (body) => createHash('sha256').update(body).digest('hex');

test('the 36 complete planned briefs have correct roles and six fusions but publish no recordings', async () => {
  const resolved = resolveOriginalProduction(production);
  assert.equal(resolved.tracks.length, 36);
  const references = JSON.parse(
    await readFile(
      new URL(
        '../../authoring/library/revealline-original-soundtrack/references.json',
        import.meta.url,
      ),
    ),
  );
  const known = new Set(references.sources.map((source) => source.id));
  assert.ok(resolved.tracks.every((track) => track.referenceIds.every((id) => known.has(id))));
  const ledger = JSON.parse(
    await readFile(
      new URL(
        '../../authoring/library/revealline-original-soundtrack/review-ledger.json',
        import.meta.url,
      ),
    ),
  );
  assert.deepEqual(
    ledger.tracks.map((track) => track.id),
    resolved.tracks.map((track) => track.id),
  );
  assert.ok(
    ledger.tracks.every(
      (track) =>
        track.status === 'planned' &&
        track.attempts.length === 0 &&
        Object.values(track.reviews).every((review) => review.status === 'pending'),
    ),
  );
  const built = await buildOriginalSoundtrackCatalogue();
  assert.equal(built.catalogue.tracks.length, 0);
  assert.equal(built.files.length, 0);
  assert.equal(built.catalogue.format, 'revealline-soundtrack-catalogue.v2');
  const falselyReady = structuredClone(production);
  falselyReady.tracks[0].status = 'ready';
  assert.throws(() => resolveOriginalProduction(falselyReady), /cannot declare ready/);
});

// Coded silence and approval assertions are test fixtures, not listening or composition evidence.
async function approvedFixture(t, { sampleRate = 48000, bits = 24, encoding = 'pcm' } = {}) {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'revealline-original-test-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const pin = async (name, body) => {
    const bytes = typeof body === 'string' ? Buffer.from(body) : body;
    await writeFile(path.join(folder, name), bytes);
    return { path: name, bytes: bytes.length, sha256: sha(bytes) };
  };
  const repetitions = 575,
    duration = (repetitions * 10 * 1152) / 44100;
  const mp3 = await pin(
    'fixture.mp3',
    Buffer.concat(Array.from({ length: repetitions }, () => silenceBytes)),
  );
  const alignment = (2 * bits) / 8;
  const dataBytes = Math.round(duration * sampleRate) * alignment;
  const wav = Buffer.alloc(44 + dataBytes);
  wav.write('RIFF');
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(encoding === 'float' ? 3 : 1, 20);
  wav.writeUInt16LE(2, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * alignment, 28);
  wav.writeUInt16LE(alignment, 32);
  wav.writeUInt16LE(bits, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataBytes, 40);
  let master;
  if (encoding === 'flac') {
    // Container fixture only: injected review claims are not codec/listening evidence.
    const flac = Buffer.alloc(48);
    flac.write('fLaC');
    flac[4] = 0x80;
    flac.writeUIntBE(34, 5, 3);
    flac.writeUInt16BE(4096, 8);
    flac.writeUInt16BE(4096, 10);
    flac.writeBigUInt64BE(
      (BigInt(sampleRate) << 44n) |
        (1n << 41n) |
        (BigInt(bits - 1) << 36n) |
        BigInt(Math.round(duration * sampleRate)),
      18,
    );
    flac[42] = 0xff;
    flac[43] = 0xf8;
    master = await pin('fixture.flac', flac);
  } else {
    master = await pin('fixture.wav', wav);
  }
  const evidence = await pin(
    'evidence.txt',
    'Synthetic test-only claims; no production recording or actual review.',
  );
  const brief = production.tracks[0];
  const review = {
    format: 'revealline-original-approval.v1',
    id: brief.id,
    reviewer: 'Test reviewer',
    reviewedAt: '2026-09-21T12:00:00Z',
    masterSha256: master.sha256,
    mp3Sha256: mp3.sha256,
    gates: Object.fromEntries(ORIGINAL_REVIEW_GATES.map((gate) => [gate, true])),
    measurements: {
      durationSeconds: duration,
      integratedLUFS: -16,
      truePeakDbTP: -1.2,
      fullDecode: true,
      method: 'Injected test evidence, not a real measurement',
    },
    production: {
      method: 'test',
      tool: 'fixture',
      version: '1',
      promptId: brief.promptId,
      rightsEvidence: evidence,
      sessionEvidence: evidence,
    },
  };
  const ready = {
    format: ORIGINAL_READY_FORMAT,
    edition: production.edition,
    tracks: [
      {
        id: brief.id,
        artist: 'Test fixture',
        master,
        mp3,
        rights: {
          kind: 'original',
          credit: 'Fixture only',
          license: 'Test fixture permission',
          source: 'https://example.test/fixture',
        },
        review: await pin('review.json', JSON.stringify(review)),
        policy: {
          id: `builtin.catalog.${brief.id}`,
          sha256: mp3.sha256,
          webPlayback: 'allowed',
          offlineCache: 'allowed',
          redistribute: 'allowed',
          modify: 'allowed',
          gameplayVideo: 'allowed',
          contentId: 'not-registered',
        },
      },
    ],
  };
  return { folder, pin, review, ready };
}

test('approved originals require exact master, MP3, rights and review pins before runtime publication', async (t) => {
  const f = await approvedFixture(t);
  const result = await compileReadyOriginals(production, f.ready, { baseDirectory: f.folder });
  assert.equal(result.catalogue.tracks.length, 1);
  assert.equal(result.catalogue.tracks[0].id, 'builtin.catalog.original.idle-frequency');
  assert.equal(result.catalogue.tracks[0].tags.role, 'menu');
  assert.equal(result.files[0].name, result.catalogue.tracks[0].path);
  assert.equal(sha(result.files[0].bytes), f.ready.tracks[0].mp3.sha256);
  assert.equal(result.receipts[0].masterFormat.sampleRate, 48000);
  assert.equal(result.receipts[0].masterFormat.bitsPerSample, 24);
  f.review.gates.fullListening = false;
  f.ready.tracks[0].review = await f.pin('review.json', JSON.stringify(f.review));
  await assert.rejects(
    compileReadyOriginals(production, f.ready, { baseDirectory: f.folder }),
    /Every original review gate/,
  );
  f.review.gates.fullListening = true;
  f.review.measurements.truePeakDbTP = 0.2;
  f.ready.tracks[0].review = await f.pin('review.json', JSON.stringify(f.review));
  await assert.rejects(
    compileReadyOriginals(production, f.ready, { baseDirectory: f.folder }),
    /mix or duration targets/,
  );
  f.review.measurements.truePeakDbTP = -1.2;
  f.review.measurements.integratedLUFS = -14;
  f.ready.tracks[0].review = await f.pin('review.json', JSON.stringify(f.review));
  await assert.rejects(
    compileReadyOriginals(production, f.ready, { baseDirectory: f.folder }),
    /mix or duration targets/,
  );
  f.review.measurements.integratedLUFS = -16;
  f.ready.tracks[0].review = await f.pin('review.json', JSON.stringify(f.review));
  await writeFile(path.join(f.folder, 'evidence.txt'), 'Changed evidence');
  await assert.rejects(
    compileReadyOriginals(production, f.ready, { baseDirectory: f.folder }),
    /file size differs|hash differs/,
  );
});

test('ready promotion rejects unknown songs, personal rights and source-path escapes without creating output', async () => {
  const ready = {
    format: ORIGINAL_READY_FORMAT,
    edition: production.edition,
    tracks: [{ id: 'original.missing', artist: 'X', master: {}, mp3: {}, rights: {}, review: {} }],
  };
  await assert.rejects(compileReadyOriginals(production, ready), /no composition brief/);
  ready.tracks[0].id = production.tracks[0].id;
  ready.tracks[0].mp3 = { bytes: 1 };
  ready.tracks[0].rights = {
    kind: 'personal',
    credit: 'Mine',
    license: 'Personal use',
    source: 'https://example.test/',
  };
  await assert.rejects(compileReadyOriginals(production, ready), /explicit rights/);
});

test('native 44.1 kHz PCM16 and float32 masters retain their actual format without upsampling', async (t) => {
  for (const format of [
    { sampleRate: 44100, bits: 16, encoding: 'pcm' },
    { sampleRate: 48000, bits: 32, encoding: 'float' },
    { sampleRate: 48000, bits: 24, encoding: 'flac' },
  ]) {
    const f = await approvedFixture(t, format);
    const result = await compileReadyOriginals(production, f.ready, { baseDirectory: f.folder });
    assert.equal(result.receipts[0].masterFormat.sampleRate, format.sampleRate);
    assert.equal(result.receipts[0].masterFormat.bitsPerSample, format.bits);
    assert.equal(result.receipts[0].masterFormat.encoding, format.encoding);
  }
});

test('a planned six-track volume cannot exceed its download budget', async () => {
  const ready = {
    format: ORIGINAL_READY_FORMAT,
    edition: production.edition,
    tracks: production.tracks
      .slice(0, 6)
      .map((track) => ({ id: track.id, mp3: { bytes: 12 * 1024 * 1024 } })),
  };
  await assert.rejects(compileReadyOriginals(production, ready), /volume exceeds 64 MiB/);
});

test('review references cannot escape their source tree or follow links', async (t) => {
  const f = await approvedFixture(t);
  f.ready.tracks[0].review.path = '../review.json';
  await assert.rejects(
    compileReadyOriginals(production, f.ready, { baseDirectory: f.folder }),
    /bounded production file/,
  );
  f.ready.tracks[0].review.path = 'linked.json';
  await symlink(path.join(f.folder, 'review.json'), path.join(f.folder, 'linked.json'));
  await assert.rejects(
    compileReadyOriginals(production, f.ready, { baseDirectory: f.folder }),
    /links are not accepted/,
  );
});

test('original v2 policy cannot silently acquire rights or bind another recording', async (t) => {
  const f = await approvedFixture(t);
  f.ready.tracks[0].policy.webPlayback = 'unknown';
  await assert.rejects(
    compileReadyOriginals(production, f.ready, { baseDirectory: f.folder }),
    /web playback rights/,
  );
  f.ready.tracks[0].policy.webPlayback = 'allowed';
  f.ready.tracks[0].policy.redistribute = 'denied';
  const result = await compileReadyOriginals(production, f.ready, { baseDirectory: f.folder });
  assert.equal(result.catalogue.format, 'revealline-soundtrack-catalogue.v2');
  assert.equal(result.catalogue.tracks[0].policy.redistribute, 'denied');
  assert.equal(result.catalogue.tracks[0].fileName, 'fixture.mp3');
  assert.equal(result.catalogue.tracks[0].websites[0].url, 'https://example.test/fixture');
  f.ready.tracks[0].policy.sha256 = '0'.repeat(64);
  await assert.rejects(
    compileReadyOriginals(production, f.ready, { baseDirectory: f.folder }),
    /exact track/,
  );
});
