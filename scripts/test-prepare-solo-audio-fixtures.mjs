import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  AUDIO_RECORDINGS,
  AUDIO_SPEECH,
  prepareAudioFixtures,
  speechFixtureProvenance,
  verifyAudioFixtureBytes,
} from './prepare-solo-audio-fixtures.mjs';

test('audio fixture integrity rejects equal-length substituted bytes', () => {
  const bytes = Buffer.from('exact source');
  const pin = {
    id: 'integrity-fixture',
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
  assert.equal(verifyAudioFixtureBytes(bytes, pin), bytes);
  assert.throws(() => verifyAudioFixtureBytes(Buffer.from('other source'), pin), /SHA256 differs/);
  assert.throws(() => verifyAudioFixtureBytes(bytes.subarray(1), pin), /byte count differs/);
});

test('speech pin matches unchanged shipped bytes and retains generated pilot provenance', async () => {
  const receipt = await speechFixtureProvenance();
  assert.equal(receipt.sha256, AUDIO_SPEECH.sha256);
  assert.equal(receipt.bytes, AUDIO_SPEECH.bytes);
  assert.equal(receipt.locale, 'en');
  assert.equal(receipt.provenance.kind, 'generated');
  assert.equal(receipt.provenance.releaseStatus, 'pilot-review-required');
});

test('failed archived audio intake remains explicit and cannot overwrite an earlier attempt', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'solo-audio-preparation-'));
  const output = join(parent, 'failed-attempt');
  const urls = [];
  try {
    await assert.rejects(
      prepareAudioFixtures(output, {
        download: true,
        fetcher: async (url) => {
          urls.push(url);
          return new Response(new Uint8Array([1]), { status: 200 });
        },
      }),
      /byte count differs/,
    );
    const receipt = JSON.parse(await readFile(join(output, 'provenance.json')));
    assert.equal(receipt.status, 'failed');
    assert.match(receipt.failure, /byte count differs/);
    assert.equal(receipt.bundle, null);
    assert.equal(receipt.recordings.length, 1);
    assert.equal(receipt.recordings[0].sha256, AUDIO_RECORDINGS[0].sha256);
    assert.equal(receipt.recordings[0].status, 'failed');
    assert.equal(urls.length, 1);
    assert.equal(
      urls[0],
      `https://mekhovov.github.io/revealline-soundtracks/objects/${AUDIO_RECORDINGS[0].sha256}.mp3`,
    );
    await writeFile(join(output, 'retained.txt'), 'do not overwrite');
    await assert.rejects(prepareAudioFixtures(output, { download: true }), { code: 'EEXIST' });
    assert.equal(await readFile(join(output, 'retained.txt'), 'utf8'), 'do not overwrite');
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});
