import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  assertPrivateAudioBinding,
  assertSharedPortableAudio,
  AUDIO_ENTRY_PATH,
  PORTABLE_BANK_PATH,
} from './fpv-audio-shared-data.mjs';

const digest = createHash('sha256').update('sample').digest('hex');
const data = {
  format: 'revealline-portable-destruction.v1',
  release: { id: 'test', revision: 1 },
  bytes: 6,
  clips: {
    clip: {
      mime: 'audio/wav',
      bytes: 6,
      sha256: digest,
      source: { kind: 'core', recordingSha256: digest },
      base64: Buffer.from('sample').toString('base64'),
    },
  },
};
const canonical = `const bank = ${JSON.stringify(data)};
for (const clip of Object.values(bank.clips)) { Object.freeze(clip.source); Object.freeze(clip); }
Object.freeze(bank.release); Object.freeze(bank.clips);
export const PORTABLE_DESTRUCTION_AUDIO = Object.freeze(bank);`;
const assignment = `_a[${JSON.stringify(PORTABLE_BANK_PATH)}] = (() => { ${canonical.replace('export const', 'const')} return {PORTABLE_DESTRUCTION_AUDIO: PORTABLE_DESTRUCTION_AUDIO}; })();`;
const projection = `export const [createSimFlightAudio, PORTABLE_DESTRUCTION_AUDIO] = (() => {
const sourceHashes = Object.freeze({}); const _a = Object.create(null);
${assignment}
_a[${JSON.stringify(AUDIO_ENTRY_PATH)}] = (() => { const createWorldAudio = () => {}; return {createWorldAudio}; })();
return [_a[${JSON.stringify(AUDIO_ENTRY_PATH)}].createWorldAudio, _a[${JSON.stringify(PORTABLE_BANK_PATH)}].PORTABLE_DESTRUCTION_AUDIO];
})();`;

test('admits only the exact frozen canonical bank in the existing audio projection', () => {
  assert.deepEqual(assertSharedPortableAudio(canonical, projection), { clips: 1, bytes: 6 });
});
test('rejects changed recording bytes even when both copies agree', () => {
  assert.throws(
    () =>
      assertSharedPortableAudio(
        canonical.replace('c2FtcGxl', 'c2FtcGxk'),
        projection.replace('c2FtcGxl', 'c2FtcGxk'),
      ),
    /recording bytes/,
  );
});
test('rejects embedded data that differs from the canonical source', () => {
  assert.throws(
    () => assertSharedPortableAudio(canonical, projection.replace('"revision":1', '"revision":2')),
    /differs from canonical/,
  );
});
test('rejects removal of any deep-freeze step', () => {
  for (const operation of [
    'Object.freeze(clip.source);',
    'Object.freeze(clip);',
    'Object.freeze(bank.release);',
    'Object.freeze(bank.clips);',
  ]) {
    assert.throws(
      () =>
        assertSharedPortableAudio(
          canonical.replace(operation, ''),
          projection.replace(operation, ''),
        ),
      /freeze ownership/,
    );
  }
});
test('rejects executable bank properties and injected canonical statements', () => {
  assert.throws(
    () =>
      assertSharedPortableAudio(
        canonical.replace('"revision":1', '"revision":sideEffect()'),
        projection,
      ),
    /literal/,
  );
  assert.throws(
    () => assertSharedPortableAudio(canonical + '\nsideEffect();', projection),
    /freeze ownership/,
  );
});
test('rejects alias retargeting and non-data exports', () => {
  assert.throws(
    () =>
      assertSharedPortableAudio(
        canonical,
        projection.replaceAll('PORTABLE_DESTRUCTION_AUDIO];', 'createWorldAudio];'),
      ),
    /ownership/,
  );
  assert.throws(
    () =>
      assertSharedPortableAudio(
        canonical,
        projection.replace(
          '[createSimFlightAudio, PORTABLE_DESTRUCTION_AUDIO]',
          '[createSimFlightAudio, arbitraryFactory]',
        ),
      ),
    /export changed/,
  );
});
test('rejects missing or duplicate bank assignments', () => {
  assert.throws(
    () => assertSharedPortableAudio(canonical, projection.replace(assignment, '')),
    /missing/,
  );
  assert.throws(
    () =>
      assertSharedPortableAudio(canonical, projection.replace(assignment, assignment + assignment)),
    /duplicate/,
  );
});
test('rejects bank return objects with additional mutable owners', () => {
  assert.throws(
    () =>
      assertSharedPortableAudio(
        canonical,
        projection.replace(
          '{PORTABLE_DESTRUCTION_AUDIO: PORTABLE_DESTRUCTION_AUDIO}',
          '{PORTABLE_DESTRUCTION_AUDIO: PORTABLE_DESTRUCTION_AUDIO, cache: {}}',
        ),
      ),
    /differs from canonical/,
  );
});
test('rejects private identifier collisions but permits strings and comments', () => {
  assert.throws(() => assertPrivateAudioBinding('const _a = {};', 'collision'), /reserved/);
  assert.throws(() => assertPrivateAudioBinding('function nested(_a) {}', 'nested'), /reserved/);
  assert.doesNotThrow(() => assertPrivateAudioBinding('const label = "_a"; // _a\n', 'literal'));
});
test('current generated projection retains every real canonical recording without evaluation', async () => {
  const root = new URL('../', import.meta.url);
  const [bank, academy] = await Promise.all([
    readFile(new URL(PORTABLE_BANK_PATH, root), 'utf8'),
    readFile(new URL('optional-practice/civilian-fpv/sim-presentation.mjs', root), 'utf8'),
  ]);
  assert.deepEqual(assertSharedPortableAudio(bank, academy), { clips: 13, bytes: 232892 });
});

test('retains original recording provenance for compact derivatives', () => {
  const revised = canonical
    .replace('"kind":"core"', '"kind":"core-compact"')
    .replaceAll('"recordingSha256":"' + digest + '"', '"recordingSha256":"' + 'a'.repeat(64) + '"');
  const output = projection.replace(
    canonical.replace('export const', 'const'),
    revised.replace('export const', 'const'),
  );
  assert.deepEqual(assertSharedPortableAudio(revised, output), { clips: 1, bytes: 6 });
});
