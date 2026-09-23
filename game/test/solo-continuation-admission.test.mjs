import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { librarySuccessor } from '../mission-library/continuous-next.mjs';

// Production boundary function, controlled async owner-admission boundary.
// Full host navigation is covered separately; no simulated gameplay-clear claim.
const source = await readFile(new URL('../app.mjs', import.meta.url), 'utf8');
const start = source.indexOf('async function nextLibraryMission()');
const code = source.slice(start, source.indexOf('async function prepareResultAttempt(', start));

for (const action of ['cancel', 'failure', 'ready'])
  test(`Solo async launch-adapter admission remains owned until ${action}`, async () => {
    let resolve,
      reject,
      entered = false,
      adopted = false;
    const gate = new Promise((yes, no) => {
      resolve = yes;
      reject = no;
    });
    const run = { status: 'won' },
      entry = {},
      elements = new Map();
    const document = {
      hidden: false,
      hasFocus: () => true,
      addEventListener() {},
      removeEventListener() {},
    };
    const $ = (id) => {
      if (!elements.has(id))
        elements.set(id, {
          id,
          disabled: false,
          hidden: false,
          focus() {
            document.activeElement = this;
          },
        });
      return elements.get(id);
    };
    let cancel,
      status = '';
    const owner = (id, collection, mission, launch = () => true) => ({
      id,
      collection,
      editionId: 'edition',
      edition: 'Edition',
      entries: [mission],
      describe: (row) => ({
        id: row.id,
        name: row.id,
        campaignKey: row.id,
        campaignTitle: row.id,
        levelIndex: 0,
        modes: ['solo'],
        rules: 'Authored',
      }),
      availability: () => ({ state: 'ready' }),
      launch,
    });
    const library = createMissionLibrary([
      owner('journey', 'Journey', { id: 'finished' }),
      owner('classic', 'Classic', { id: 'next' }, async (_row, context) => {
        entered = true;
        await gate;
        if (!context.isCurrent()) return false;
        if (!context.transferContinuation()) return false;
        adopted = true;
        return true;
      }),
    ]);
    const ctx = {
      $,
      document,
      window: { addEventListener() {}, removeEventListener() {} },
      AbortController,
      libraryNextOperation: null,
      resultAttempt: null,
      run,
      activeEntry: entry,
      levelIndex: 0,
      resultAttemptEpoch: 0,
      practice: false,
      scenario: null,
      courseSession: null,
      dialogOpen: () => false,
      journeyEnabled: true,
      journeyMission: () => ({ id: 'finished' }),
      authoredRoute: { id: 'edition' },
      librarySuccessor,
      getUnifiedMissionLibrary: async () => ({ library, refreshInstalled: async () => {} }),
      libraryActivationContext: () => ({ isCurrent: () => true }),
      beginPreparation(_text, onCancel) {
        cancel = onCancel;
        return {
          update() {},
          finish(text = '') {
            status = text;
          },
        };
      },
    };
    const next = runInNewContext(`${code}\nnextLibraryMission`, ctx);
    const pending = next();
    while (!entered) await Promise.resolve();
    assert(ctx.libraryNextOperation, 'Cancel remains owned during adapter verification.');
    assert.equal(ctx.run, run);
    if (action === 'cancel') cancel({ restoreFocus: true });
    if (action === 'failure') reject(new Error('Picture unavailable'));
    else resolve();
    await pending;
    assert.equal(adopted, action === 'ready');
    if (action === 'cancel') assert.match(status, /cancelled.*result is kept/);
    if (action === 'failure') assert.match(status, /Picture unavailable.*result is kept/);
    assert.equal($('next-button').disabled, false);
    assert.equal(ctx.libraryNextOperation, null);
  });
