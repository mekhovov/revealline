import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { page } from './helpers/coop-host.mjs';
import { COOP_STARTER_PACK, readCoopPack } from '../coop/library.mjs';
import { deferred, waitFor } from './helpers/coop-presentation-fixture.mjs';
import {
  winImported,
  playImportedRoute,
  importedCoverageRoute,
  importedResult,
} from './helpers/coop-import-win.mjs';
import { earnTeamVictory } from './helpers/coop-win.mjs';
import { TEAM_ARENA_PREFERENCE_KEY } from '../couch/team-arena-preference.mjs';

const fixture = JSON.parse(
  await readFile(new URL('./fixtures/coop-import-route.json', import.meta.url)),
);
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('the imported two-core map earns Results, one Next starts coverage, and its final win offers Choose arena', async (t) => {
  const authored = JSON.stringify(fixture.authoredPack);
  assert.equal(hash(fixture.authoredPack), fixture.authoredPackSHA256);
  readCoopPack(authored);
  const f = await page(t, { nativeFocus: true, nativeVisibility: true });
  f.$('coop-pack-file').focus();
  await f.selectFile(authored);
  assert.equal(f.$('coop-level').value, 'boundary-multi-core-stronghold');
  f.$('coop-difficulty').value = 'gentle';
  f.$('coop-experiment').value = 'full';
  f.$('coop-start').focus();
  f.tap('Enter');
  assert.equal(f.$('coop-menu').hidden, true);
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.match(f.$('coop-objective').textContent, /0 \/ 2 secured · Relay 2/);
  const objectives = [f.$('coop-objective').textContent];
  const emit = ({ code, down }) => {
    const key = code.startsWith('Key')
      ? code.slice(3).toLowerCase()
      : code.startsWith('Shift')
        ? 'Shift'
        : code;
    f.doc.activeElement.emit(down ? 'keydown' : 'keyup', { key, code, repeat: false });
  };
  const terminalGestures = (g) =>
    g.reason.startsWith('physical release after ') || g.reason === 'cleanup';
  f.tick(2);
  let replayed = 0;
  for (let row = 0; row < fixture.metrics.ticksReplayed; row++) {
    const gestures = fixture.gestures.filter((g) => g.row === row);
    gestures.filter((g) => !terminalGestures(g)).forEach(emit);
    f.tick();
    replayed++;
    gestures.filter(terminalGestures).forEach(emit);
    const objective = f.$('coop-objective').textContent;
    if (objective !== objectives.at(-1)) objectives.push(objective);
    if (!f.$('coop-overlay').hidden) break;
  }
  for (const code of ['ShiftLeft', 'ShiftRight']) emit({ code, down: false });
  assert.ok(
    objectives.some((text) => /1 \/ 2 secured · Relay 3/.test(text)),
    objectives.join('\n'),
  );
  assert.equal(f.$('coop-objective').textContent, 'Strongholds secured together');
  assert.equal(f.$('coop-overlay-kicker').textContent, 'A WORLD YOU REVEALED TOGETHER');
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.$('coop-resume').hidden, true);
  assert.equal(f.$('coop-discard-dialog').open, false);
  assert.equal(f.visits.length, 0);
  assert.equal(f.$('coop-reserves').textContent, '5 reserves');
  const terminal = [
    'coop-stage',
    'coop-objective',
    'coop-coverage',
    'coop-clock',
    'coop-message',
  ].map((id) => f.$(id).textContent);
  f.tick(120);
  assert.deepEqual(
    ['coop-stage', 'coop-objective', 'coop-coverage', 'coop-clock', 'coop-message'].map(
      (id) => f.$(id).textContent,
    ),
    terminal,
  );
  assert.equal(JSON.stringify(fixture.authoredPack), authored);
  assert.equal(f.doc.activeElement.id, 'coop-next');
  assert.match(f.$('coop-next').textContent, /Imported coverage/);
  const reads = f.artwork.calls.reads.length;
  // Accepted settings govern progression even if an inactive setup draft differs.
  f.$('coop-difficulty').value = 'expert';
  f.$('coop-experiment').value = 'independent';
  f.tap('Enter');
  await waitFor(
    () => f.$('coop-overlay').hidden,
    () => f.$('coop-next-status').textContent,
  );
  assert.equal(f.$('coop-menu').hidden, true);
  assert.equal(f.doc.activeElement.id, 'coop-canvas');
  assert.equal(f.$('coop-level').value, 'boundary-multi-core-coverage');
  assert.equal(f.$('coop-stage').textContent, 'IMPORTED COVERAGE');
  assert.equal(f.$('coop-objective').textContent, 'Reveal 72.4% together');
  assert.equal(f.$('coop-reserves').textContent, '5 reserves');
  assert.equal(f.$('coop-experiment').value, 'full');
  assert.equal(f.$('coop-difficulty').value, 'gentle');
  assert.equal(f.$('coop-clock').textContent, '0:00');
  assert.equal(f.$('coop-coverage').textContent, '0.0%');
  assert.equal(f.$('coop-discard-dialog').open, false);
  assert.equal(f.artwork.calls.reads.length, reads + 1);
  assert.equal(f.visits.length, 0);
  const coverage = playImportedRoute(f, importedCoverageRoute);
  assert.ok(Number.parseFloat(f.$('coop-coverage').textContent) >= 72.4);
  assert.equal(f.$('coop-next').hidden, true);
  assert.match(f.$('coop-overlay-copy').textContent, /Final arena in this pack/);
  assert.equal(f.doc.activeElement.id, 'coop-lobby');
  const final = importedResult(f);
  f.$('coop-next').onclick();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(importedResult(f), final);
  assert.equal(f.$('coop-overlay').hidden, false);
  f.tap('Enter');
  assert.equal(f.$('coop-menu').hidden, false);
  assert.equal(f.$('coop-level').value, 'boundary-multi-core-coverage');
  assert.equal(f.doc.activeElement.id, 'coop-start');
  t.diagnostic(
    JSON.stringify({
      scope:
        'Actual mounted Team host with recorded sparse key events; finite DOM/Canvas, not native or human timing',
      replayed,
      directionTaps: fixture.metrics.directionTaps,
      objectives,
      terminal,
      final,
      coverageInputFrames: coverage.replayed,
    }),
  );
});

const flush = () => new Promise((resolve) => setImmediate(resolve));
const launchNext = async (f) => {
  f.$('coop-next').focus();
  f.tap('Enter');
  await waitFor(
    () => f.$('coop-overlay').hidden,
    () => f.$('coop-next-status').textContent,
  );
  assert.equal(f.$('coop-stage').textContent, 'IMPORTED COVERAGE');
};

for (const interruption of ['cancel', 'focus', 'hidden']) {
  test(`imported Next ${interruption} retains earned Results until another deliberate action`, async (t) => {
    const f = await winImported(t);
    const result = importedResult(f);
    f.tap('Enter');
    assert.equal(f.$('coop-next-cancel').hidden, false);
    if (interruption === 'cancel') f.$('coop-next-cancel').click();
    if (interruption === 'focus') f.$('coop-retry').focus();
    if (interruption === 'hidden') {
      f.doc.hidden = true;
      f.doc.emit('visibilitychange');
      f.doc.hidden = false;
      f.win.emit('pageshow', { persisted: true });
    }
    await flush();
    assert.equal(f.$('coop-overlay').hidden, false);
    assert.deepEqual(importedResult(f), result);
    assert.equal(f.$('coop-level').value, 'boundary-multi-core-stronghold');
    await launchNext(f);
  });
}

test('failed imported successor paint preserves Results and a fresh Next retries safely', async (t) => {
  const errors = [];
  t.mock.method(console, 'error', (...args) => errors.push(args));
  const f = await winImported(t);
  const result = importedResult(f);
  f.failNextPaint();
  f.tap('Enter');
  await waitFor(() =>
    /Could not start Imported coverage/.test(f.$('coop-next-status').textContent),
  );
  assert.equal(errors.length, 1);
  assert.equal(f.doc.activeElement.id, 'coop-next');
  assert.deepEqual(importedResult(f), result);
  assert.equal(f.$('coop-overlay').hidden, false);
  await launchNext(f);
});

test('a replacement file during imported Next cannot switch the accepted itinerary', async (t) => {
  const f = await winImported(t);
  const replacement = structuredClone(fixture.authoredPack);
  replacement.id = 'replacement-pack';
  replacement.levels.reverse();
  replacement.levels[0].name = 'Replacement must not start';
  f.tap('Enter');
  await f.selectFile(JSON.stringify(replacement));
  await waitFor(() => f.$('coop-overlay').hidden);
  assert.equal(f.$('coop-level').value, 'boundary-multi-core-coverage');
  assert.equal(f.$('coop-stage').textContent, 'IMPORTED COVERAGE');
  assert.equal(f.$('coop-experiment').value, 'full');
  assert.equal(f.$('coop-difficulty').value, 'gentle');
});

function bookmarkFixture() {
  const initial = JSON.stringify({
    version: 'revealline-team-arena.v1',
    packId: COOP_STARTER_PACK.id,
    packRevision: COOP_STARTER_PACK.revision,
    levelId: 'relay-yard',
  });
  let saved = initial;
  const writes = [];
  return {
    initial,
    writes,
    saved: () => saved,
    beforeImport({ install }) {
      install('localStorage', {
        value: {
          getItem: (key) => (key === TEAM_ARENA_PREFERENCE_KEY ? saved : null),
          setItem(key, value) {
            if (key === TEAM_ARENA_PREFERENCE_KEY) {
              saved = value;
              writes.push(value);
            }
          },
        },
      });
    },
  };
}

test('imported levels reusing built-in IDs leave both the saved and in-visit built-in choice unchanged', async (t) => {
  const bookmark = bookmarkFixture();
  const pack = structuredClone(fixture.authoredPack);
  pack.levels[0].id = 'relay-yard';
  pack.levels[1].id = 'first-connection';
  const f = await winImported(t, { pack, beforeImport: bookmark.beforeImport });
  await launchNext(f);
  assert.equal(f.$('coop-level').value, 'first-connection');
  assert.equal(bookmark.saved(), bookmark.initial);
  assert.deepEqual(bookmark.writes, []);
  f.$('coop-pause').click();
  f.$('coop-lobby').click();
  assert.equal(f.$('coop-discard-dialog').open, true);
  f.$('coop-discard-confirm').click();
  f.$('coop-pack-reset').click();
  await waitFor(() => f.$('coop-picture-status').dataset.state === 'ready');
  assert.equal(f.$('coop-level').value, 'relay-yard');
  assert.equal(bookmark.saved(), bookmark.initial);
});

test('an exact imported starter copy keeps strict picture bindings and never owns the built-in bookmark', async (t) => {
  const bookmark = bookmarkFixture();
  const f = await page(t, {
    nativeFocus: true,
    nativeVisibility: true,
    beforeImport: bookmark.beforeImport,
  });
  f.$('coop-pack-file').focus();
  await f.selectFile(JSON.stringify(COOP_STARTER_PACK));
  f.$('coop-difficulty').value = 'standard';
  f.$('coop-start').focus();
  f.tap('Enter');
  earnTeamVictory(t, f);
  const reads = f.artwork.calls.reads.length;
  f.tap('Enter');
  await waitFor(() => f.$('coop-overlay').hidden);
  assert.equal(f.$('coop-stage').textContent, 'RELAY YARD');
  assert.equal(f.artwork.calls.reads.length, reads + 1);
  assert.equal(bookmark.saved(), bookmark.initial);
  assert.deepEqual(bookmark.writes, []);
});

test('an imported pack waits for required shared artwork without replacing the current arena', async (t) => {
  const gate = deferred();
  t.after(() => gate.resolve());
  const f = await page(t, {
    nativeFocus: true,
    nativeVisibility: true,
    waitPicture: false,
    presentation: { load: () => gate.promise },
  });
  await waitFor(() => f.artwork.calls.loads === 1);
  f.$('coop-picture-cancel').click();
  const pending = f.selectFile(JSON.stringify(fixture.authoredPack));
  await waitFor(() => f.$('coop-pack-status').dataset.stage === 'preparing');
  assert.equal(f.$('coop-start').disabled, true);
  assert.equal(f.$('coop-level').value, 'first-connection');
  assert.equal(f.artwork.calls.reads.length, 0);
  gate.resolve();
  await pending;
  assert.equal(f.$('coop-level').value, 'boundary-multi-core-stronghold');
  assert.equal(f.$('coop-start').disabled, false);
  assert.equal(f.artwork.calls.reads.length, 1);
  f.$('coop-difficulty').value = 'gentle';
  f.$('coop-start').focus();
  f.tap('Enter');
  playImportedRoute(f);
  await launchNext(f);
  assert.equal(f.artwork.calls.reads.length, 2);
  assert.equal(f.$('coop-level').value, 'boundary-multi-core-coverage');
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.equal(f.doc.activeElement.id, 'coop-canvas');
});
