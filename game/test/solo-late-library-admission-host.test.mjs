import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

function openMissions(page) {
  const button = page.$('shell-play'),
    previous = button.onclick;
  let pending;
  button.onclick = function (...args) {
    return (pending = previous.apply(this, args));
  };
  try {
    button.focus();
    button.click();
  } finally {
    button.onclick = previous;
  }
  assert(pending instanceof Promise, 'The public Missions handler owns the request.');
  return pending;
}
async function heldLibrary(t) {
  let release,
    requests = 0;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  t.after(() => release());
  const reads = [];
  const page = await soloPage(t, {
    titleScreen: true,
    fetchResponse: async (path, options) => {
      reads.push(String(path));
      if (path !== 'content/mission-library-index.json') return;
      // The separate optional played-level link supplies its own AbortSignal.
      // Count only this public catalogue's existing request, not that owner.
      if (!options?.signal && ++requests === 1) await gate;
      return new Response(
        await readFile(new URL('../content/mission-library-index.json', import.meta.url)),
      );
    },
  });
  const pending = openMissions(page);
  await settle(() => requests === 1);
  return { page, pending, reads, release, requests: () => requests };
}
function noCatalogue(page) {
  assert.equal(
    !!page.$('journey-collection'),
    false,
    'Retired work must not construct the catalogue.',
  );
  assert.equal(!!page.$('journey-chooser')?.open, false);
}

test('late catalogue cannot resume during play or revive after Pause; explicit Missions retries', async (t) => {
  const { page, pending, release, reads, requests } = await heldLibrary(t);
  page.$('shell-featured').focus();
  page.$('shell-featured').click();
  await page.waitUntilRunning();
  const run = page.rendered.run,
    checkpoint = authoritativeCheckpoint(run),
    before = reads.length;
  page.$('pause-button').click();
  release();
  await pending;
  noCatalogue(page);
  assert.deepEqual(
    reads.slice(before).filter((path) => path.includes('content-design/')),
    [],
  );
  assert.equal(page.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  page.$('shell-menu').click();
  await openMissions(page);
  assert.equal(page.$('journey-chooser').open, true);
  assert.equal(requests(), 2, 'A fresh public action owns a fresh admitted attempt.');
  assert.equal(page.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assert.deepEqual(page.errors, []);
});

test('releasing retired metadata while running does no later catalogue work', async (t) => {
  const { page, pending, release, reads } = await heldLibrary(t);
  page.$('shell-featured').focus();
  page.$('shell-featured').click();
  await page.waitUntilRunning();
  const run = page.rendered.run,
    checkpoint = authoritativeCheckpoint(run),
    before = reads.length;
  release();
  await pending;
  noCatalogue(page);
  assert.equal(page.doc.body.dataset.flightState, 'running');
  assert.deepEqual(
    reads.slice(before).filter((path) => path.includes('content-design/')),
    [],
  );
  assert.equal(page.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assert.deepEqual(page.errors, []);
});

test('late catalogue cannot construct after page teardown', async (t) => {
  const { page, pending, release, reads } = await heldLibrary(t);
  const before = reads.length;
  page.win.emit('pagehide', { persisted: false });
  release();
  await pending;
  noCatalogue(page);
  assert.deepEqual(reads.slice(before), []);
  assert.deepEqual(page.errors, []);
});

test('hidden then visible does not restore a retired catalogue request', async (t) => {
  const { page, pending, release, reads } = await heldLibrary(t);
  page.doc.hidden = true;
  page.doc.emit('visibilitychange');
  page.doc.hidden = false;
  page.doc.emit('visibilitychange');
  const before = reads.length;
  release();
  await pending;
  noCatalogue(page);
  assert.deepEqual(reads.slice(before), []);
  assert.deepEqual(page.errors, []);
});

test('a current replacement joins admitted metadata and retains its own focus owner', async (t) => {
  const { page, pending, release, requests } = await heldLibrary(t);
  const replacement = openMissions(page);
  release();
  await Promise.all([pending, replacement]);
  assert.equal(requests(), 1, 'Current menu requests coalesce without a duplicate fetch.');
  assert.equal(page.$('journey-chooser').open, true);
  assert.equal(page.$('journey-chooser').contains(page.doc.activeElement), true);
  const count = page.$('journey-cards').children.length;
  assert(count > 0);
  page.$('journey-chooser').close();
  await openMissions(page);
  assert.equal(requests(), 1, 'A completed catalogue remains reusable.');
  assert.equal(page.$('journey-cards').children.length, count);
  assert.deepEqual(page.errors, []);
});
