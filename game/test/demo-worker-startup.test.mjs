import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';
import { DATA_JSON_DEFAULT_MESSAGES } from '../data-json.mjs';

test('standalone planner loads without bootstrapping UI translations and retains validation errors', async () => {
  const planner = new URL('../demo-bot.mjs', import.meta.url).href;
  const boundary = new URL('../data-json.mjs', import.meta.url).href;
  const worker = new Worker(
    new URL(
      `data:text/javascript,${encodeURIComponent(`
    import { parentPort } from 'node:worker_threads';
    await import(${JSON.stringify(planner)});
    const { boundedJSON, exactKeys } = await import(${JSON.stringify(boundary)});
    const errors = [];
    for (const run of [() => boundedJSON('{'), () => exactKeys({ extra: 1 }, [], 'Run')])
      try { run(); } catch (error) { errors.push(error.message); }
    parentPort.postMessage({ uiBooted: !!globalThis.RevealLineI18n, errors });
  `)}`,
    ),
    { type: 'module' },
  );
  try {
    const result = await new Promise((resolve, reject) => {
      worker.once('message', resolve);
      worker.once('error', reject);
    });
    assert.equal(result.uiBooted, false);
    assert.deepEqual(result.errors, [
      DATA_JSON_DEFAULT_MESSAGES.invalid,
      DATA_JSON_DEFAULT_MESSAGES.unsupportedField.replace('{{path}}', 'Run.extra'),
    ]);
  } finally {
    await worker.terminate();
  }
});

test('lightweight defaults stay identical to the English catalogue', async () => {
  const source = JSON.parse(await readFile(new URL('../locales/en/errors.json', import.meta.url)));
  assert.deepEqual(
    DATA_JSON_DEFAULT_MESSAGES,
    Object.fromEntries(
      Object.entries(source)
        .filter(([key]) => key.startsWith('dataJson.'))
        .map(([key, value]) => [key.slice(9), value]),
    ),
  );
});

test('a booted validator follows live Ukrainian/English locale changes', async () => {
  const { boundedJSON } = await import('../data-json.mjs');
  const { t, setLocale, getLocale } = await import('../i18n/index.mjs');
  const before = getLocale();
  try {
    for (const locale of ['uk', 'en']) {
      setLocale(locale);
      assert.throws(() => boundedJSON('{'), { message: t('errors:dataJson.invalid') });
    }
  } finally {
    setLocale(before);
  }
});
