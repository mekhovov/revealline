import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage } from './helpers/solo-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const prefix = 'RevealLineMissionsStageV1 ';
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const until = (condition) => waitFor(condition, { timeoutMs: 15000 });
function activate(page) {
  const button = page.$('shell-play');
  const original = button.onclick;
  let result;
  button.onclick = function (...args) {
    return (result = original.apply(this, args));
  };
  try {
    button.focus();
    button.click();
  } finally {
    button.onclick = original;
  }
  assert(result instanceof Promise);
  return result;
}
async function host(t, { enabled = true, fetchResponse, throwingSink = false } = {}) {
  const records = [];
  const page = await soloPage(t, {
    titleScreen: true,
    search: enabled ? '?performance=1' : '',
    fetchResponse,
    browserSetup: ({ globals }) => {
      globals.innerWidth = 1280;
      globals.innerHeight = 720;
      if (enabled) globals.performance.timeOrigin = 123456;
      else
        Object.defineProperty(globals.performance, 'timeOrigin', {
          get() {
            throw new Error('disabled Missions must not read its diagnostic time origin');
          },
        });
      globals.console = {
        ...console,
        debug(text) {
          assert(text.startsWith(prefix));
          records.push(JSON.parse(text.slice(prefix.length)));
          if (throwingSink) throw new Error('modeled diagnostic delivery failure');
        },
      };
    },
  });
  return { page, records };
}
const kinds = (records) => records.map((row) => row[3]);

test('actual ordinary Missions remains uninstrumented with the same paused run and no diagnostic sink', async (t) => {
  const { page, records } = await host(t, { enabled: false });
  const run = page.rendered.run;
  const checkpoint = authoritativeCheckpoint(run);
  await activate(page);
  assert.equal(page.$('journey-chooser').open, true);
  assert.deepEqual(records, []);
  assert.equal(page.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assert.deepEqual(page.errors, []);
});

test('actual first-open sources, render and reopen produce bounded stage records without granting runtime authority', async (t) => {
  const { page, records } = await host(t, { throwingSink: true });
  const run = page.rendered.run;
  const checkpoint = authoritativeCheckpoint(run);
  await activate(page);
  assert.equal(page.$('journey-chooser').open, true);
  const first = records[0][0],
    rows = records.filter((row) => row[0] === first);
  for (const stage of [
    'imports',
    'data',
    'sources',
    'supplemental-imports',
    'hunt',
    'duel',
    'installed',
    'chooser-build',
    'refresh',
    'campaigns',
    'render',
    'modal',
  ]) {
    assert(kinds(rows).includes('missions-' + stage + '-begin'), stage);
    assert(kinds(rows).includes('missions-' + stage + '-end'), stage);
    assert(
      kinds(rows).indexOf('missions-' + stage + '-begin') <
        kinds(rows).indexOf('missions-' + stage + '-end'),
      stage,
    );
  }
  assert.equal(rows[0][3], 'missions-opening');
  assert.equal(rows.at(-1)[3], 'missions-complete');
  assert(rows.length < 64);
  assert.deepEqual(
    rows.map((row) => row[2]),
    rows.map((_, index) => index + 1),
  );
  assert(rows.every((row) => row[7] === 123456 && Number.isFinite(row[6])));
  assert.equal(page.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  page.$('journey-back').click();
  await activate(page);
  const second = records.filter((row) => row[0] !== first);
  assert.equal(second[0][3], 'missions-opening');
  assert(kinds(second).includes('missions-build-cached'));
  assert(!kinds(second).includes('missions-imports-begin'));
  assert(kinds(second).includes('missions-render-begin'));
  assert.equal(second.at(-1)[3], 'missions-complete');
  assert.deepEqual(page.errors, []);
});

test('actual cancelled first-open cannot stamp a newer overlapping open when its held fetch resolves', async (t) => {
  const gate = deferred();
  t.after(() => gate.resolve());
  let hold = false,
    reads = 0;
  const { page, records } = await host(t, {
    fetchResponse: async (path) => {
      if (hold && String(path).endsWith('/content/mission-library-index.json')) {
        reads++;
        await gate.promise;
      }
    },
  });
  hold = true;
  const firstTask = activate(page);
  await until(() => reads === 1);
  const first = records[0][0];
  // A second real click retires the first opener while its metadata read is pending.
  const secondTask = activate(page);
  await until(() => reads === 2);
  const cancelled = records.filter((row) => row[0] === first);
  assert.equal(cancelled.at(-1)[3], 'missions-cancelled');
  const before = JSON.stringify(cancelled);
  gate.resolve();
  await Promise.all([firstTask, secondTask]);
  assert.equal(JSON.stringify(records.filter((row) => row[0] === first)), before);
  const second = records.filter((row) => row[0] !== first);
  assert.equal(second[0][2], 1);
  assert.equal(second.at(-1)[3], 'missions-complete');
  assert.equal(page.$('journey-chooser').open, true);
  assert.deepEqual(page.errors, []);
});

test('actual metadata failure retains a failed prefix and the existing public Retry path', async (t) => {
  let fail = false;
  const { page, records } = await host(t, {
    fetchResponse: async (path) => {
      if (fail && String(path).endsWith('/content/mission-library-index.json'))
        throw new Error('modeled metadata failure');
    },
  });
  fail = true;
  await activate(page);
  assert(kinds(records).includes('missions-data-begin'));
  assert(!kinds(records).includes('missions-data-end'));
  assert.equal(records.at(-1)[3], 'missions-failed');
  assert.match(page.$('mission-library-opening-status').textContent, /retry/i);
  assert.equal(!!page.$('journey-chooser'), false);
  fail = false;
  const before = records.length;
  await activate(page);
  assert.equal(records[before][3], 'missions-opening');
  assert.equal(records.at(-1)[3], 'missions-complete');
  assert.equal(page.$('journey-chooser').open, true);
});
