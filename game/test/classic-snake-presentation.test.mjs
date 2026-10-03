import test from 'node:test';
import assert from 'node:assert/strict';
import { classicAppearanceContext } from '../snake/classic-presentation.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { createThemeCandidate } from '../presentation/theme-preview.mjs';
import { saveAcceptedAppearance } from '../presentation/theme-system.mjs';

function context(href = 'https://example.test/game/snake/play.html', dataset = {}) {
  const values = new Map(),
    writes = [];
  const sessionStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      writes.push(key);
      values.set(key, value);
    },
    removeItem: (key) => {
      writes.push(key);
      values.delete(key);
    },
  };
  const candidate = createThemeCandidate(createDefaultThemeBundle());
  saveAcceptedAppearance(sessionStorage, candidate);
  writes.length = 0;
  return {
    candidate,
    writes,
    window: { location: { href }, document: { documentElement: { dataset } }, sessionStorage },
  };
}

test('Classic keeps the accepted cosmetic context on an unpinned direct link without writing preferences', () => {
  const state = context();
  assert.deepEqual(classicAppearanceContext(state.window), {
    appearanceDefault: {
      familyId: state.candidate.family.id,
      revision: state.candidate.family.revision,
    },
    appearanceThemes: [state.candidate],
  });
  assert.deepEqual(state.writes, []);
});

test('Classic uses the same query then compiled then accepted precedence as first-paint bootstrap', () => {
  const compiled = { appearanceFamily: 'orchard-workshop', appearanceRevision: 'r1' };
  const state = context('https://example.test/game/snake/play.html', compiled);
  assert.deepEqual(classicAppearanceContext(state.window), {
    appearanceDefault: { familyId: 'orchard-workshop', revision: 'r1' },
    appearanceThemes: [],
  });
  state.window.location.href += '?appearanceFamily=tryzub&appearanceRevision=r1';
  assert.deepEqual(classicAppearanceContext(state.window), {
    appearanceDefault: { familyId: 'tryzub', revision: 'r1' },
    appearanceThemes: [],
  });
  state.window.location.href += '&appearanceFamily=dos';
  assert.equal(
    classicAppearanceContext(state.window).appearanceDefault.familyId,
    'orchard-workshop',
  );
  assert.deepEqual(state.writes, []);
});

test('unreadable context storage cannot erase a valid direct-launch pin', () => {
  const window = {
    location: {
      href: 'https://example.test/game/snake/?appearanceFamily=tryzub&appearanceRevision=r1',
    },
  };
  Object.defineProperty(window, 'sessionStorage', {
    get() {
      throw new Error('Denied');
    },
  });
  assert.deepEqual(classicAppearanceContext(window), {
    appearanceDefault: { familyId: 'tryzub', revision: 'r1' },
    appearanceThemes: [],
  });
});
