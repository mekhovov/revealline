import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { reviseStudioTheme } from '../presentation/studio-session.mjs';
import {
  createThemeCandidate,
  validateThemeCandidate,
  saveThemePreview,
  loadThemePreview,
  THEME_PREVIEW_LIMIT,
  candidateFromPresentation,
} from '../presentation/theme-preview.mjs';
import {
  resolvePresentation,
  BUILTIN_THEME_FAMILIES,
  getInterfaceTheme,
} from '../presentation/theme-system.mjs';
import {
  compileStudioRuntime,
  validateRuntimeEnvelope,
} from '../presentation/runtime-transfer.mjs';

const id1 = '10000000-0000-4000-8000-000000000001';
const id2 = '10000000-0000-4000-8000-000000000002';
const prefix = 'revealline.theme-preview.v1.';
const memory = () => {
  const values = new Map([['revealline.theme-preferences.v1', 'untouched']]);
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};

test('all registered candidate families pin exact interface revisions and edited paired colors', () => {
  const source = reviseStudioTheme(createDefaultThemeBundle(), {
    tokens: { amber: '#ffffff', ink: '#ffffff', text: '#111111' },
  });
  for (const family of BUILTIN_THEME_FAMILIES) {
    const candidate = createThemeCandidate(source, { familyId: family.id });
    assert.equal(candidate.format, 'ThemeCandidate.v2');
    assert.equal(candidate.basis.familyRevision, family.revision);
    assert.equal(candidate.basis.interfaceRevision, family.interface.revision);
    assert.deepEqual(validateThemeCandidate(candidate), candidate);
    if (candidate.interfaceTheme.format === 'InterfaceTheme.v2') {
      assert.equal(candidate.interfaceTheme.tokens.onAccent, '#17191b');
      assert.equal(candidate.interfaceTheme.tokens.input, '#ffffff');
      assert.equal(candidate.interfaceTheme.tokens.inputText, '#111111');
      assert.equal(
        candidate.interfaceTheme.materialStyle,
        getInterfaceTheme(family.interface.id, family.interface.revision).materialStyle,
      );
    }
  }
});

test('original candidate envelopes retain their r1 interface after the builtin upgrade', () => {
  const presentation = compileStudioRuntime(createDefaultThemeBundle());
  for (const interfaceId of ['industrial-workshop', 'windows-classic', 'dos']) {
    const candidate = candidateFromPresentation(presentation, {
      familyId: 'industrial-workshop',
      interfaceId,
      format: 'ThemeCandidate.v1',
    });
    assert.equal(candidate.interfaceTheme.format, 'InterfaceTheme.v1');
    assert.equal(candidate.basis.familyRevision, undefined);
    assert.deepEqual(
      validateRuntimeEnvelope({ format: 'RuntimeTheme.v2', presentation, candidate }).candidate,
      candidate,
    );
  }
  const current = createThemeCandidate(createDefaultThemeBundle());
  assert.equal(current.basis.interfaceRevision, 'r2');
  const unavailable = structuredClone(current);
  unavailable.basis.interfaceRevision = 'r999';
  assert.throws(() => validateThemeCandidate(unavailable), /Unavailable candidate basis/);
});

test('candidate preview and runtime interface derive the same source tokens with separate immutable identities', () => {
  const source = reviseStudioTheme(createDefaultThemeBundle(), {
    tokens: { amber: '#ddbb77', panel: '#233123' },
  });
  const candidate = createThemeCandidate(source),
    unchanged = structuredClone(source);
  assert.deepEqual(candidate.source, { id: source.id, revision: source.revision });
  assert.equal(candidate.interfaceTheme.tokens.accent, '#ddbb77');
  assert.equal(candidate.family.interface.id, candidate.interfaceTheme.id);
  assert.notEqual(candidate.family.id, 'industrial-workshop');
  assert.ok(Object.isFrozen(candidate.simDependency.collection.materials));
  assert.deepEqual(validateThemeCandidate(candidate), candidate);
  const rendered = resolvePresentation({
    themeFamily: candidate.family,
    interfaceTheme: candidate.interfaceTheme,
  });
  assert.equal(rendered.tokens.panel, '#233123');
  assert.match(decodeURIComponent(rendered.materials.panel.source), /#233123/);
  assert.deepEqual(source, unchanged);
  assert.notEqual(
    createThemeCandidate(reviseStudioTheme(source, { tokens: { amber: '#ffffff' } })).family.id,
    candidate.family.id,
  );
});

test('one bounded same-tab payload hands off the candidate once without touching player preferences', () => {
  const storage = memory(),
    candidate = createThemeCandidate(createDefaultThemeBundle());
  assert.equal(saveThemePreview(storage, candidate, { id: id1, now: 1000 }), id1);
  assert.ok(
    new TextEncoder().encode(storage.getItem(`${prefix}${id1}`)).byteLength < THEME_PREVIEW_LIMIT,
  );
  saveThemePreview(storage, candidate, { id: id2, now: 1100 });
  assert.equal(storage.getItem(`${prefix}${id1}`), null);
  assert.deepEqual(loadThemePreview(storage, id2, { now: 1200 }), candidate);
  assert.equal(storage.values.size, 1);
  assert.equal(storage.getItem('revealline.theme-preferences.v1'), 'untouched');
  assert.throws(() => loadThemePreview(storage, id2, { now: 1300 }), /unavailable/);
});

test('malformed, oversized, expired and substituted resource payloads fail closed and are consumed', () => {
  const candidate = createThemeCandidate(createDefaultThemeBundle());
  for (const mutate of [
    (value) => {
      value.candidate.simDependency.collection.assets.drone = 'https://example.test/drone.glb';
    },
    (value) => {
      value.candidate.interfaceTheme.tokens.panel = 'url(javascript:alert(1))';
    },
    (value) => {
      value.candidate.interfaceTheme.tokens.panel = '#ffffff';
    },
    (value) => {
      value.candidate.css = 'body{}';
    },
    (value) => {
      value.expires = 1000;
    },
  ]) {
    const storage = memory();
    saveThemePreview(storage, candidate, { id: id1, now: 1000 });
    const value = JSON.parse(storage.getItem(`${prefix}${id1}`));
    mutate(value);
    storage.setItem(`${prefix}${id1}`, JSON.stringify(value));
    assert.throws(() => loadThemePreview(storage, id1, { now: 2000 }));
    assert.equal(storage.getItem(`${prefix}${id1}`), null);
  }
  const storage = memory();
  storage.setItem(`${prefix}${id1}`, ' '.repeat(THEME_PREVIEW_LIMIT + 1));
  assert.throws(() => loadThemePreview(storage, id1, { now: 2000 }), /budget/);
  assert.throws(() => loadThemePreview(storage, '../other-storage'), /preview key/);
  let executed = false;
  assert.throws(() =>
    validateThemeCandidate({
      get format() {
        executed = true;
        return 'ThemeCandidate.v1';
      },
    }),
  );
  assert.equal(executed, false);
});

test('failed handoff preserves the previous usable candidate', () => {
  const storage = memory(),
    candidate = createThemeCandidate(createDefaultThemeBundle());
  saveThemePreview(storage, candidate, { id: id1, now: 1000 });
  const setItem = storage.setItem;
  storage.setItem = (key, value) => {
    if (key === `${prefix}latest`) throw new Error('quota');
    setItem(key, value);
  };
  assert.throws(() => saveThemePreview(storage, candidate, { id: id2, now: 1100 }), /quota/);
  assert.equal(storage.getItem(`${prefix}${id2}`), null);
  assert.deepEqual(loadThemePreview(storage, id1, { now: 1200 }), candidate);
});
