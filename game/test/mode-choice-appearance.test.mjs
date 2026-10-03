import test from 'node:test';
import assert from 'node:assert/strict';
import { mountModeChoices } from '../ui/mode-choice.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { reviseStudioTheme } from '../presentation/studio-session.mjs';
import { createThemeCandidate } from '../presentation/theme-preview.mjs';
import {
  saveAcceptedAppearance,
  loadAppearanceContext,
  THEME_PREFERENCES_KEY,
} from '../presentation/theme-system.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';

const initial = createThemeCandidate(createDefaultThemeBundle());
const recent = createThemeCandidate(
  reviseStudioTheme(createDefaultThemeBundle(), { tokens: { amber: '#ddbb77' } }),
);
const memory = () => {
  const values = new Map(),
    writes = [];
  return {
    values,
    writes,
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      values.set(key, value);
      writes.push([key, value]);
    },
    removeItem: (key) => values.delete(key),
  };
};
const entry = () =>
  new Response(
    '<html data-fpv-worlds="true"><script src="../civilian-fpv/world-app.mjs"></script></html>',
  );

function fixture(context, current, { getAppearanceDefault } = {}) {
  const document = new Document(),
    root = document.createElement('nav'),
    local = memory(),
    session = memory(),
    requests = [],
    visits = [],
    deferred = [];
  document.body.append(root);
  document.documentElement.lang = 'uk';
  const href =
    'https://example.test/project/game/' +
    (current === 'team' ? 'couch/relay-rescue.html' : current === 'versus' ? 'couch/' : '');
  Object.assign(document.defaultView, {
    sessionStorage: session,
    localStorage: local,
    location: { href, assign: (url) => visits.push(url) },
  });
  local.values.set(
    THEME_PREFERENCES_KEY,
    JSON.stringify({ format: 'AppearancePreferences.v2', familyId: 'follow-game' }),
  );
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (url, options) => {
    requests.push({ url, options });
    return new Promise((resolve) => deferred.push(resolve));
  };
  context.after(() => {
    globalThis.fetch = originalFetch;
  });
  let pauses = 0;
  const actions = Object.fromEntries(
    ['solo', 'versus', 'team']
      .filter((id) => id !== current)
      .map((id) => [id, document.createElement('a')]),
  );
  saveAcceptedAppearance(session, initial);
  const before = structuredClone([local.writes, session.writes]);
  const controls = mountModeChoices({
    root,
    current,
    actions,
    pause: () => {
      pauses++;
    },
    ...(getAppearanceDefault ? { getAppearanceDefault } : {}),
  });
  context.after(() => controls.dispose());
  const button = document.getElementById(`${current}-fpv-sim`);
  assert.deepEqual(
    [local.writes, session.writes],
    before,
    'Mounting never writes appearance storage.',
  );
  assert.deepEqual(requests, [], 'Mounting does not preflight or navigate.');
  return {
    document,
    root,
    controls,
    local,
    session,
    requests,
    visits,
    deferred,
    button,
    paused: () => pauses,
    href,
  };
}

for (const current of ['versus', 'team']) {
  test(`${current} SIM uses the current compiled pin ahead of accepted context after its entry check`, async (context) => {
    const state = fixture(context, current);
    Object.assign(state.document.documentElement.dataset, {
      appearanceFamily: 'dnipro',
      appearanceRevision: 'r1',
    });
    const before = structuredClone([state.local.writes, state.session.writes]);
    state.button.click();
    assert.equal(state.paused(), 1);
    assert.equal(state.requests.length, 1);
    assert.equal(state.requests[0].options.redirect, 'error');
    assert.equal(state.requests[0].options.credentials, 'omit');
    assert.deepEqual(state.visits, []);
    assert.deepEqual([state.local.writes, state.session.writes], before);
    state.document.documentElement.dataset.appearanceFamily = 'tryzub';
    state.deferred.shift()(entry());
    await waitFor(() => state.visits.length === 1);
    const target = new URL(state.visits[0]);
    assert.equal(target.searchParams.get('appearanceFamily'), 'tryzub');
    assert.equal(target.searchParams.get('appearanceRevision'), 'r1');
    assert.equal(target.searchParams.get('game-return'), new URL(state.href).pathname);
    assert.equal(target.searchParams.get('lang'), 'uk');
    assert.equal(target.hash, '#learn');
    assert.deepEqual(
      [state.local.writes, state.session.writes],
      before,
      'A built-in pin needs no candidate transfer.',
    );
  });

  test(`${current} SIM transfers the latest accepted custom candidate without changing player preferences`, async (context) => {
    const state = fixture(context, current);
    Object.assign(state.document.documentElement.dataset, {
      appearanceFamily: '../invalid',
      appearanceRevision: 'r1',
    });
    state.button.click();
    saveAcceptedAppearance(state.session, recent);
    const before = structuredClone([state.local.writes, state.session.writes]);
    const preferences = state.local.values.get(THEME_PREFERENCES_KEY);
    assert.deepEqual(state.visits, []);
    state.deferred.shift()(entry());
    await waitFor(() => state.visits.length === 1);
    const target = new URL(state.visits[0]);
    const pin = {
      familyId: target.searchParams.get('appearanceFamily'),
      revision: target.searchParams.get('appearanceRevision'),
    };
    assert.deepEqual(pin, { familyId: recent.family.id, revision: recent.family.revision });
    assert.deepEqual(loadAppearanceContext(state.session, pin), recent);
    assert.deepEqual(loadAppearanceContext(state.local, pin, { consume: true }), recent);
    assert.equal(state.local.values.get(THEME_PREFERENCES_KEY), preferences);
    assert.equal(state.local.writes.length, before[0].length + 1);
    assert.equal(state.session.writes.length, before[1].length + 1);
  });
}

test('the explicit Solo context getter remains primary over compiled and accepted defaults', async (context) => {
  const state = fixture(context, 'solo', {
    getAppearanceDefault: () => ({ familyId: 'dos', revision: 'r1' }),
  });
  Object.assign(state.document.documentElement.dataset, {
    appearanceFamily: recent.family.id,
    appearanceRevision: recent.family.revision,
  });
  saveAcceptedAppearance(state.session, recent);
  state.button.click();
  state.deferred.shift()(entry());
  await waitFor(() => state.visits.length === 1);
  assert.equal(new URL(state.visits[0]).searchParams.get('appearanceFamily'), 'dos');
});

for (const block of ['cancelled', 'hidden'])
  test(`${block} entry checks cannot navigate or transfer an accepted custom theme`, async (context) => {
    const state = fixture(context, 'team');
    const before = structuredClone([state.local.writes, state.session.writes]);
    state.button.click();
    if (block === 'cancelled') state.controls.closeSimulator();
    else state.root.hidden = true;
    state.deferred.shift()(entry());
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(state.visits, []);
    assert.deepEqual([state.local.writes, state.session.writes], before);
  });

for (const current of ['solo', 'versus', 'team'])
  test(`${current} Snake link preserves seats and resolves the appearance at activation`, (context) => {
    const state = fixture(context, current);
    const link = state.document.getElementById(`${current}-snake`);
    assert.equal(link.tagName, 'A');
    assert.equal(new URL(link.href).searchParams.get('mode'), current);
    assert.equal(new URL(link.href).searchParams.has('appearanceFamily'), false);
    Object.assign(state.document.documentElement.dataset, {
      appearanceFamily: 'tryzub',
      appearanceRevision: 'r1',
    });
    const before = structuredClone([state.local.writes, state.session.writes]);
    link.click();
    const target = new URL(link.href);
    assert.equal(target.pathname, '/project/game/snake/play.html');
    assert.equal(target.searchParams.get('mode'), current);
    assert.equal(target.searchParams.get('lang'), 'uk');
    assert.equal(target.searchParams.get('appearanceFamily'), 'tryzub');
    assert.equal(state.paused(), 1);
    assert.deepEqual(state.requests, [], 'The bundled Snake entry needs no simulator preflight.');
    assert.deepEqual([state.local.writes, state.session.writes], before);
    state.controls.dispose();
    assert.equal(link.isConnected, false);
  });
