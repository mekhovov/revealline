import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { format } from 'prettier';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { compilePresentation } from '../../scripts/compile-presentation.mjs';
import { preparePresentationOutput } from '../../scripts/prepare-presentation-output.mjs';
import { readPresentation, writePresentation } from '../../scripts/write-presentation.mjs';

const own = (files) => new Map([...files].map(([name, bytes]) => [name, Buffer.from(bytes)]));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const archive = (files) => `runtime.${hash(files.get('runtime.json'))}.json`;
let pending;
function fixture() {
  return (pending ??= (async () => {
    const source = structuredClone(createDefaultThemeBundle());
    const prior = (await compilePresentation(source)).files;
    source.revision = 2;
    const next = (await compilePresentation(source)).files;
    source.revision = 3;
    const later = (await compilePresentation(source)).files;
    return { prior: own(prior), next: own(next), later: own(later) };
  })());
}

test('format new current output while preserving exact unformatted original archive bytes', async () => {
  const { prior, next } = await fixture();
  const beforePrior = own(prior),
    beforeNext = own(next);
  const result = await preparePresentationOutput(next, { previous: prior });
  assert.deepEqual(result.get(archive(prior)), prior.get('runtime.json'));
  assert.notEqual(
    prior.get('runtime.json').toString(),
    await format(prior.get('runtime.json').toString(), { parser: 'json' }),
  );
  assert.equal(
    result.get('runtime.json').toString(),
    await format(next.get('runtime.json').toString(), { parser: 'json' }),
  );
  assert.equal(JSON.parse(result.get('runtime.json')).source.revision, 2);
  assert.deepEqual(prior, beforePrior);
  assert.deepEqual(next, beforeNext);
});

test('initial formatting creates no archive and repeated generation with identical output is byte-idempotent', async () => {
  const { prior } = await fixture();
  const initial = await preparePresentationOutput(prior);
  assert.deepEqual(Object.keys(JSON.parse(initial.get('manifest.json'))), [
    'format',
    'source',
    'files',
  ]);
  assert(![...initial.keys()].some((name) => /^runtime\./.test(name) && name !== 'runtime.json'));
  assert.deepEqual(await preparePresentationOutput(prior, { previous: initial }), initial);
});

test('subsequent generation retains the entire original chain without formatting any historical runtime', async () => {
  const { prior, next, later } = await fixture();
  const second = await preparePresentationOutput(next, { previous: prior });
  const third = await preparePresentationOutput(later, { previous: second });
  assert.deepEqual(third.get(archive(prior)), prior.get('runtime.json'));
  assert.deepEqual(third.get(archive(second)), second.get('runtime.json'));
  assert.deepEqual(await preparePresentationOutput(later, { previous: third }), third);
});

test('prepared output writes once and reproduces through the real reader and check-only writer', async (t) => {
  const { prior, next } = await fixture();
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rl-prepared-output-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const out = path.join(directory, 'compiled');
  const result = await preparePresentationOutput(next, { previous: prior });
  await writePresentation(result, out);
  const again = await preparePresentationOutput(next, { previous: await readPresentation(out) });
  await writePresentation(again, out, { check: true });
  assert.deepEqual(await readPresentation(out), result);
  assert.deepEqual(await fs.readdir(directory), ['compiled']);
});

test('retained trees are rejected as fresh compiler input instead of reformatting their original manifests', async () => {
  const { prior, next } = await fixture();
  const prepared = await preparePresentationOutput(next, { previous: prior });
  const original = own(prepared);
  await assert.rejects(preparePresentationOutput(prepared), /fresh compiler output/);
  assert.deepEqual(prepared, original);
});

test('changed current or historical owned bytes fail without mutating either input', async () => {
  const { prior, next } = await fixture();
  for (const which of ['fresh', 'prior']) {
    const fresh = own(next),
      previous = own(prior);
    const target = which === 'fresh' ? fresh : previous;
    target.set('theme.css', Buffer.from('manual edit'));
    const beforeFresh = own(fresh),
      beforePrevious = own(previous);
    await assert.rejects(
      preparePresentationOutput(fresh, { previous }),
      /does not match its manifest/,
    );
    assert.deepEqual(fresh, beforeFresh);
    assert.deepEqual(previous, beforePrevious);
  }
});

test('preparation owns input bytes before async formatting and returns detached bytes', async () => {
  const { prior, next } = await fixture();
  const expected = await preparePresentationOutput(next, { previous: prior });
  const fresh = own(next),
    previous = own(prior);
  const pending = preparePresentationOutput(fresh, { previous });
  fresh.get('runtime.json')[0] ^= 1;
  previous.get('runtime.json')[0] ^= 1;
  const result = await pending;
  assert.deepEqual(result, expected);
  result.get(archive(prior))[0] ^= 1;
  assert.equal(hash(prior.get('runtime.json')), archive(prior).slice(8, -5));
});

test('format preferences affect only current output and ownership metadata, never retained original bytes', async () => {
  const { prior, next } = await fixture();
  const formatOptions = { useTabs: true, tabWidth: 4 };
  const result = await preparePresentationOutput(next, { previous: prior, formatOptions });
  assert.deepEqual(result.get(archive(prior)), prior.get('runtime.json'));
  assert.equal(
    result.get('runtime.json').toString(),
    await format(next.get('runtime.json').toString(), { ...formatOptions, parser: 'json' }),
  );
  assert.deepEqual(
    await preparePresentationOutput(next, { previous: result, formatOptions }),
    result,
  );
});
