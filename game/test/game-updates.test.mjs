import test from 'node:test';
import assert from 'node:assert/strict';
import {
  gameUpdatesURL,
  readGameUpdateContext,
  restoredGameplaySelection,
  updateReturnURL,
} from '../game-updates.mjs';
import { validateInstalledEdition } from '../installed-app.mjs';
import { offlineAvailability } from '../offline.mjs';

const root = 'https://game.example/revealline/';
const old = root + 'releases/v1.0.0/site/';
const current = root + 'releases/v2.0.0/site/';
const buildId = 'a'.repeat(64);
const page = new URL(root + 'app/update.html');
const catalogue = {
  groups: [
    { id: 'base', kind: 'gameplay' },
    { id: 'new-chapter', kind: 'gameplay' },
    { id: 'extras:demo', kind: 'gameplay', current: false },
    { id: 'album:one', kind: 'soundtrack' },
  ],
};

test('all-current intent includes newly published chapters despite an older checkpoint', () => {
  const active = { scope: old, selection: ['base'], allGameplay: true };
  const saved = { selection: ['base'] };
  assert.deepEqual(restoredGameplaySelection(catalogue, { active, saved, edition: old }), {
    selected: ['base'],
    all: true,
  });
  assert.deepEqual(
    restoredGameplaySelection(catalogue, {
      active,
      saved: { ...saved, allGameplay: false },
      edition: old,
    }),
    { selected: ['base'], all: false },
  );
});

test('only an explicit update carries selections between editions; music is never selected', () => {
  const active = {
    scope: old,
    selection: ['base', 'extras:demo', 'album:one', 'removed'],
    allGameplay: false,
  };
  assert.deepEqual(restoredGameplaySelection(catalogue, { active, edition: current }), {
    selected: [],
    all: false,
  });
  assert.deepEqual(
    restoredGameplaySelection(catalogue, { active, edition: current, updating: true }),
    { selected: ['base', 'extras:demo'], all: false },
  );
});

test('update entry is the stable app, with an allowlisted same-edition return', () => {
  const game = new URL(old + 'game/couch/relay-rescue.html');
  const update = gameUpdatesURL(game);
  assert.equal(update.pathname, '/revealline/app/update.html');
  assert.equal(updateReturnURL(update, current, { version: '1.0.0', scope: old }).href, game.href);
  update.searchParams.set('return', 'https://unrelated.example/');
  assert.equal(updateReturnURL(update, current, null).href, current + 'game/');
});

test('frozen update marker is accepted only on the publisher update document and matching build', () => {
  const config = {
    format: 'revealline-offline.v1',
    version: '2.0.0',
    buildId,
    scope: current,
    worker: current + 'service-worker.js',
  };
  const update = { format: 'revealline-app-update.v1', scope: current, buildId };
  const documentRef = {
    querySelector: (selector) => ({
      content: JSON.stringify(selector.includes('revealline-update') ? update : config),
    }),
  };
  assert.equal(readGameUpdateContext(documentRef, page).scope, current);
  assert.equal(
    offlineAvailability({
      documentRef,
      locationRef: page,
      navigatorRef: { serviceWorker: {} },
      secure: true,
    }).available,
    true,
  );
  assert.equal(readGameUpdateContext(documentRef, new URL(root + 'game/')), null);
  update.buildId = 'b'.repeat(64);
  assert.equal(readGameUpdateContext(documentRef, page), null);
  assert.equal(
    offlineAvailability({
      documentRef,
      locationRef: page,
      navigatorRef: { serviceWorker: {} },
      secure: true,
    }).available,
    false,
  );
});

test('installed build identity distinguishes different builds at the same version and URL', () => {
  const value = { version: '2.0.0', scope: root, buildId, selection: ['base'] };
  assert.equal(validateInstalledEdition(value, page).buildId, buildId);
  assert.throws(() => validateInstalledEdition({ ...value, buildId: 'broken' }, page));
  assert.equal(
    validateInstalledEdition({ version: '2.0.0', scope: root }, page).buildId,
    undefined,
  );
});

test('successful updates remap the verified previous game route while Back keeps the old edition', () => {
  const sourceActive = { version: '1.0.0', scope: old };
  const active = { version: '2.0.0', scope: current };
  for (const route of [
    'game/couch/relay-rescue.html?campaign=first#menu',
    'game/index.html?edition=coupa-culture&presentation=earned',
    'game/communities/coupa/?edition=coupa-culture',
  ]) {
    const update = gameUpdatesURL(new URL(old + route));
    assert.equal(updateReturnURL(update, current, sourceActive).href, old + route);
    assert.equal(
      updateReturnURL(update, current, active, { sourceActive, remap: true }).href,
      current + route,
    );
  }
  for (const address of [
    'https://outside.example/game/',
    root + 'releases/v9.0.0/site/game/',
    old + 'game/playground/',
    old + 'game/communities/coupa/?edition=droneaid-community',
  ]) {
    const update = gameUpdatesURL(new URL(address));
    update.href = page.href;
    update.searchParams.set('return', address);
    assert.equal(
      updateReturnURL(update, current, active, { sourceActive, remap: true }).href,
      current + 'game/',
    );
  }
});
