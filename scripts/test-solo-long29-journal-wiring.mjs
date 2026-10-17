import assert from 'node:assert/strict';
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import * as hitchModule from './solo-qualification-hitch-journal.mjs';

const source = await readFile(new URL('./qualify-solo-runtime.mjs', import.meta.url), 'utf8');
const marker = 'const hitchStore = ';
const start = source.indexOf(marker);
assert(start > 0);
const statement = source.slice(start, source.indexOf('if (hitchStore)', start));
const recipeBytes = await readFile(
  new URL(
    '../docs/performance/fixtures/solo-remote-sustained/long29.qualification.fixture',
    import.meta.url,
  ),
);
const hitchOptions = hitchModule.qualificationHitchJournalOptions(
  ['--hitch-journal', '--work-probe', '--hitch-journal-active-document=first-before-reload-v1'],
  JSON.parse(recipeBytes),
  recipeBytes,
);

async function observe(t, text, { restoredActive = false, omitRestored = false } = {}) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'solo-actual-long29-wiring-')));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const url = new URL('http://127.0.0.1:4321/game/?journey=opening');
  const store = runInNewContext(text + '\nhitchStore;', {
    output: join(directory, 'report.json'),
    url,
    hitchOptions,
    hitchModule,
  });
  for (let index = 0; index < (omitRestored ? 1 : 2); index++) {
    const allocation = store.beginDocument({
      url: url.href,
      action: index ? 'reload-8' : 'initial',
    });
    let now = 0;
    const journal = hitchModule.createBrowserHitchJournal(
      {},
      {
        performance: { now: () => now, timeOrigin: 1700000000000 + index * 1000 },
        location: { origin: url.origin, pathname: url.pathname },
        document: { hidden: false, hasFocus: () => true, addEventListener() {} },
        addEventListener() {},
        btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
      },
    );
    journal.configure(allocation);
    journal.first(0, 0);
    journal.subscribe(0);
    const phase = index === 0 || restoredActive ? 2 : 3;
    journal.phase(phase, 0);
    journal.frame(0, 40.125, phase, phase);
    journal.beginWork(1, phase);
    journal.endWork(55.25, phase);
    journal.phase(3, 60);
    now = 100;
    await store.retain(
      journal.seal('paused'),
      index ? 'final-existing-public-boundary' : 'before-reload-8',
    );
  }
  return store.finish();
}

test('the actual qualifier constructor forwards declared first-active policy into the real binary store', async (t) => {
  const report = await observe(t, statement);
  assert.equal(report.status, 'complete');
  assert.equal(report.activeDocumentPolicy, 'first-before-reload-v1');
  assert.equal(report.activePlayCoverage, 'observed-first-solo-before-reload');
  assert.equal(report.documents.length, 2);
  assert.equal(report.documents[0].header.activeFrames, 1);
  assert.equal(report.documents[1].header.activeFrames, 0);
  assert(report.documents.every((d) => d.status === 'complete' && d.readbackVerified));
});
test('the retained original omission reproduces aggregate failure despite complete individual documents', async (t) => {
  const omitted = statement.replace(
    /^\s*activeDocumentPolicy: hitchOptions\.activeDocumentPolicy,\n/m,
    '\n',
  );
  assert.notEqual(omitted, statement, 'The test must exercise the real forwarding line');
  const report = await observe(t, omitted);
  assert.equal(report.status, 'incomplete');
  assert(report.documents.every((d) => d.status === 'complete'));
  assert.deepEqual(report.failures, ['No positive final Solo frame/work coverage']);
});
test('forwarding does not waive missing or newly active restoration', async (t) => {
  for (const options of [{ restoredActive: true }, { omitRestored: true }]) {
    const report = await observe(t, statement, options);
    assert.equal(report.status, 'incomplete');
    assert(
      report.failures.includes(
        'Missing active recording or paused zero-active restoration coverage',
      ),
    );
  }
});
