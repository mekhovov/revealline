import test from 'node:test';
import assert from 'node:assert/strict';
import { setLocale, t } from '../i18n/index.mjs';
import { describeAuthoringError } from '../content-design/authoring-error.mjs';
import {
  assetStudioErrorText,
  assetStudioErrorMessage,
} from '../../authoring/asset-studio/error-copy.mjs';

test('unknown or malformed descriptors retain exact authored details in both locales', (context) => {
  context.after(() => setLocale('en', { persist: false }));
  const detail = 'My {{filename}} failed: preserve the original detail.';
  for (const locale of ['en', 'uk']) {
    setLocale(locale, { persist: false });
    for (const key of [
      'tools:studio.pictureContext.futureError',
      'missing:futureError',
      'tools:constructor',
      '__proto__:toString',
      'tools:studio.pictureContext.unavailable:extra',
      'studio.pictureContext.unavailable',
      ['tools:studio.pictureContext.unavailable'],
      null,
    ]) {
      const error = describeAuthoringError(new Error(detail), key, { filename: 'changed' });
      assert.equal(assetStudioErrorText(error), detail);
      assert.equal(error.message, detail);
    }
    assert.equal(assetStudioErrorText(detail), detail);
    assert.equal(assetStudioErrorText(new Error(detail)), detail);
  }
});

test('known picture diagnostics remain live without changing canonical error identity', (context) => {
  context.after(() => setLocale('en', { persist: false }));
  const error = describeAuthoringError(
    new TypeError('Canonical unavailable detail.'),
    'tools:studio.pictureContext.unavailable',
    { status: 404 },
  );
  const producer = assetStudioErrorMessage(error);
  setLocale('en', { persist: false });
  const english = producer();
  assert.match(english, /HTTP 404/);
  setLocale('uk', { persist: false });
  assert.match(producer(), /HTTP 404/);
  assert.notEqual(producer(), english);
  setLocale('en', { persist: false });
  assert.equal(producer(), english);
  assert.equal(error.message, 'Canonical unavailable detail.');
  assert.equal(error instanceof TypeError, true);
});

test('shared authoring descriptors outside picture context still translate', (context) => {
  context.after(() => setLocale('en', { persist: false }));
  const error = describeAuthoringError(
    new Error('Reference loading expired.'),
    'errors:studio.image.expired',
  );
  for (const locale of ['en', 'uk']) {
    setLocale(locale, { persist: false });
    assert.equal(assetStudioErrorText(error), t('errors:studio.image.expired'));
  }
  assert.equal(error.message, 'Reference loading expired.');
});
