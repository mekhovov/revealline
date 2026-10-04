// Authored regressions; automated suites remain waived by publishing/test-policy.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';
import { prepareSnakeStudioPlay } from '../studio/snake-play-launch.mjs';
import { captureStudioActionFocus } from '../studio/action-focus.mjs';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import {
  CLASSIC_PACKAGE_FORMAT,
  classicSnakePackageIdentity,
  classicSnakePackageEntries,
  exportClassicSnakePackage,
  importClassicSnakePackage,
} from '../snake/classic-community.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';

const defer = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
function source() {
  return {
    format: CLASSIC_PACKAGE_FORMAT,
    title: { en: 'Launch ownership', uk: 'Власність запуску' },
    entries: CLASSIC_SNAKE_LEVELS.filter(
      (entry) => entry.level.version === 'classic-snake-level.v3',
    )
      .slice(0, 2)
      .map(({ title, description, level }) => structuredClone({ title, description, level })),
  };
}
const installed = (pack) => ({
  identity: classicSnakePackageIdentity(pack),
  entries: classicSnakePackageEntries(pack),
});
const settings = () => ({
  source: source(),
  selectedIndex: 1,
  mode: 'solo',
  locale: 'uk',
  baseURL: 'https://game.example/revealline/game/studio/snake.html?lang=uk',
  isCurrent: () => true,
});

test('Studio Play pins the exact portable package and selected mission before installation yields', async () => {
  for (const mode of ['solo', 'versus', 'team']) {
    const setup = { ...settings(), mode },
      before = structuredClone(setup.source),
      gate = defer();
    let accepted;
    const pending = prepareSnakeStudioPlay({
      ...setup,
      install: async (pack, options) => {
        assert.deepEqual(options, { owner: 'studio' });
        accepted = pack;
        await gate.promise;
        // The same native portable validator is used by a real import/install.
        const roundTrip = await importClassicSnakePackage(exportClassicSnakePackage(pack));
        assert.deepEqual(roundTrip, before);
        return installed(roundTrip);
      },
    });
    setup.selectedIndex = 0;
    setup.source.entries.reverse();
    setup.source.entries[0].level.goal++;
    assert.deepEqual(accepted, before, 'The installed edition owns an immutable native snapshot.');
    gate.resolve();
    const url = new URL(await pending),
      result = installed(before);
    assert.equal(url.pathname, '/revealline/game/snake/play.html');
    assert.equal(url.searchParams.get('level'), result.entries[1].id);
    assert.equal(url.searchParams.get('community'), result.identity);
    assert.equal(url.searchParams.get('mode'), mode);
    assert.equal(url.searchParams.get('lang'), 'uk');
    assert.equal(url.searchParams.get('studio'), 'snake');
  }
});

test('invalid or retired selections never start a Studio installation', async () => {
  let calls = 0;
  const setup = { ...settings(), install: () => calls++ };
  for (const selectedIndex of [-1, 2, 0.5, NaN])
    await assert.rejects(prepareSnakeStudioPlay({ ...setup, selectedIndex }), /Choose a Snake/);
  await assert.rejects(prepareSnakeStudioPlay({ ...setup, mode: 'unknown' }), /Invalid Snake/);
  assert.equal(await prepareSnakeStudioPlay({ ...setup, isCurrent: () => false }), null);
  assert.equal(calls, 0);
});

test('newer Play or draft ownership retires earlier success and failure without undoing installation', async () => {
  let revision = 0;
  const launches = [];
  const start = () => {
    const ticket = ++revision,
      gate = defer(),
      promise = prepareSnakeStudioPlay({
        ...settings(),
        isCurrent: () => revision === ticket,
        install: async (pack) => {
          await gate.promise;
          return installed(pack);
        },
      });
    launches.push({ gate, promise });
  };
  start();
  start();
  launches[1].gate.resolve();
  assert.match(await launches[1].promise, /\/snake\/play\.html\?/);
  launches[0].gate.resolve();
  assert.equal(await launches[0].promise, null);
  start();
  revision++; // A draft edit or page retirement invalidates the pending owner.
  launches[2].gate.reject(new Error('Retired storage failure'));
  assert.equal(await launches[2].promise, null);
  start();
  launches[3].gate.reject(new Error('Current storage failure'));
  await assert.rejects(launches[3].promise, /Current storage failure/);
});

test('the shared Studio foreground lease prevents late navigation after input, blur or pagehide', async () => {
  for (const retirement of [
    'focus',
    'pointerdown',
    'keydown',
    'wheel',
    'blur',
    'hidden',
    'pagehide',
  ]) {
    const document = new Document(),
      play = document.createElement('button'),
      other = document.createElement('select');
    document.body.append(play, other);
    play.focus();
    const focus = captureStudioActionFocus(play),
      gate = defer(),
      pending = prepareSnakeStudioPlay({
        ...settings(),
        isCurrent: focus.current,
        install: async (pack) => {
          await gate.promise;
          return installed(pack);
        },
      });
    assert.equal(focus.current(), true);
    if (retirement === 'focus') other.focus();
    else if (retirement === 'hidden') {
      document.hidden = true;
      document.emit('visibilitychange');
      document.hidden = false;
    } else if (retirement === 'blur' || retirement === 'pagehide')
      document.defaultView.emit(retirement);
    else document.emit(retirement);
    // Returning focus does not restore authorization from the old gesture.
    play.focus();
    gate.resolve();
    assert.equal(await pending, null, retirement);
    focus.cancel();
    const freshFocus = captureStudioActionFocus(play);
    const fresh = await prepareSnakeStudioPlay({
      ...settings(),
      isCurrent: freshFocus.current,
      install: async (pack) => installed(pack),
    });
    assert.match(fresh, /\/snake\/play\.html\?/, retirement);
    freshFocus.cancel();
  }
});

test('actual Studio pagehide retires Play but preserves storage owners for a cached Back return', async () => {
  const source = await readFile(new URL('../studio/snake.mjs', import.meta.url), 'utf8'),
    ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' }),
    binding = ast.body.find(
      (node) =>
        node.type === 'ExpressionStatement' &&
        node.expression.callee?.object?.name === 'window' &&
        node.expression.callee?.property?.name === 'addEventListener' &&
        node.expression.arguments[0]?.value === 'pagehide',
    );
  assert.ok(binding);
  const window = new Events();
  let retired = 0,
    draftClosed = false,
    libraryClosed = false;
  runInNewContext(source.slice(binding.start, binding.end), {
    window,
    retirePlay: () => retired++,
    drafts: { close: () => (draftClosed = true) },
    library: { close: () => (libraryClosed = true) },
  });
  window.emit('pagehide', { persisted: true });
  assert.equal(retired, 1);
  assert.equal(draftClosed, false);
  assert.equal(libraryClosed, false);
  window.emit('pageshow', { persisted: true });
  assert.equal(draftClosed || libraryClosed, false, 'A cached page retains usable storage.');
  window.emit('pagehide', { persisted: false });
  assert.equal(retired, 2);
  assert.equal(draftClosed, true);
  assert.equal(libraryClosed, true);
});
