import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPreviewTheme } from '../content-design/preview-loader.mjs';

test('preview loading settles when transport or JSON body stalls', async () => {
  for (const fetchTheme of [
    () => new Promise(() => {}),
    async () => ({ ok: true, json: () => new Promise(() => {}) }),
  ])
    await assert.rejects(loadPreviewTheme({ fetchTheme, timeoutMs: 5 }), /did not load in time/);
});

test('close/replacement cancels loading even if a transport ignores abort', async () => {
  const controller = new AbortController();
  const loading = loadPreviewTheme({
    fetchTheme: () => new Promise(() => {}),
    signal: controller.signal,
  });
  controller.abort();
  await assert.rejects(loading, { name: 'AbortError' });
  let called = false;
  await assert.rejects(
    loadPreviewTheme({
      signal: controller.signal,
      fetchTheme: () => {
        called = true;
      },
    }),
    { name: 'AbortError' },
  );
  assert.equal(called, false);
});

test('load and unavailable-theme errors remain explicit; success returns the exact theme', async () => {
  await assert.rejects(
    loadPreviewTheme({ fetchTheme: async () => ({ ok: false }) }),
    /failed to load/,
  );
  await assert.rejects(
    loadPreviewTheme({
      fetchTheme: async () => ({ ok: true, json: async () => ({ themes: [] }) }),
    }),
    /unavailable/,
  );
  const theme = { id: 'horizon', revision: 7 };
  assert.equal(
    await loadPreviewTheme({
      fetchTheme: async () => ({ ok: true, json: async () => ({ themes: [theme] }) }),
    }),
    theme,
  );
});

test('preview requests the authored theme and refuses to substitute another campaign identity', async () => {
  const horizon = { id: 'horizon' },
    another = { id: 'another' };
  const fetchTheme = async () => ({ ok: true, json: async () => ({ themes: [horizon, another] }) });
  assert.equal(await loadPreviewTheme({ themeId: 'another', fetchTheme }), another);
  await assert.rejects(loadPreviewTheme({ themeId: 'retro', fetchTheme }), /unavailable/);
  let called = false;
  await assert.rejects(
    loadPreviewTheme({ themeId: ['horizon'], fetchTheme: () => (called = true) }),
    /Invalid/,
  );
  assert.equal(called, false);
});
