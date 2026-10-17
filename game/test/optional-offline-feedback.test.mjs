import test from 'node:test';
import assert from 'node:assert/strict';
import {
  optionalOfflineFailureCode,
  optionalOfflineFailureMessage,
  prepareOptionalOffline,
} from '../../optional-practice/install-context.mjs';

const cases = [
  ['idle-timeout', '30 seconds', '30 секунд'],
  ['overall-timeout', 'five minutes', 'п’ять хвилин'],
  ['verification-incomplete', 'without removing', 'не видаляючи'],
  ['needs-repair', 'files are missing', 'файли відсутні'],
  ['operation-pending', 'still stopping', 'ще зупиняється'],
  ['registration-stalled', 'registration stalled', 'офлайн-службу'],
  ['update-pending', 'Close this version', 'Закрийте вкладки'],
  ['unsupported', 'service-worker support', 'сервісних воркерів'],
  ['download-failed', 'verification failed', 'перевірити файли'],
  ['storage', 'storage is unavailable', 'Сховище браузера'],
  ['cancelled', 'download cancelled', 'завантаження скасовано'],
];
test('fixed failure codes provide safe distinct English/Ukrainian guidance', () => {
  for (const [offlineCode, en, uk] of cases) {
    const error = {
      offlineCode,
      message: 'UNTRUSTED https://secret.test/token',
    };
    assert.equal(optionalOfflineFailureCode(error), offlineCode);
    assert(optionalOfflineFailureMessage(error, 'en').includes(en));
    assert(optionalOfflineFailureMessage(error, 'uk').includes(uk));
    assert(!optionalOfflineFailureMessage(error, 'uk').includes('UNTRUSTED'));
  }
});
test('older plain errors remain supported without parsing unknown prose', () => {
  for (const message of [
    'Download stalled for 30 seconds. Retry online.',
    'Download exceeded five minutes. Retry on a faster connection.',
    'Offline verification could not finish. Retry without removing your saved copy.',
    'Another offline operation is still stopping. Retry shortly.',
  ]) {
    const code = optionalOfflineFailureCode(new Error(message));
    assert.notEqual(code, 'unknown');
    assert(!optionalOfflineFailureMessage(new Error(message), 'uk').includes(message));
  }
  assert.equal(
    optionalOfflineFailureCode(new Error('Download stalled for 30 seconds. EXTERNAL')),
    'unknown',
  );
});
test('unknown/storage/cancel errors cannot leak arbitrary text or become timeout claims', () => {
  for (const error of [
    new Error('<script>token</script>'),
    { offlineCode: '__proto__', message: 'token' },
    {
      get message() {
        throw new Error('token');
      },
    },
    null,
  ]) {
    assert.equal(optionalOfflineFailureCode(error), 'unknown');
    for (const locale of ['en', 'uk']) {
      assert(!optionalOfflineFailureMessage(error, locale).includes('token'));
      assert(!optionalOfflineFailureMessage(error, locale, 'remove').includes('token'));
    }
  }
  assert.equal(
    optionalOfflineFailureCode(new DOMException('sensitive', 'QuotaExceededError')),
    'storage',
  );
  const cancelled = new DOMException('sensitive', 'AbortError');
  assert.equal(optionalOfflineFailureMessage(cancelled, 'en'), 'Offline download cancelled.');
  assert(!/30|five|stalled/i.test(optionalOfflineFailureMessage(cancelled, 'en')));
  assert.match(optionalOfflineFailureMessage(cancelled, 'uk', 'remove'), /Видалення.*скасовано/);
  assert.equal(
    optionalOfflineFailureMessage(null, 'other'),
    optionalOfflineFailureMessage(null, 'en'),
  );
});
test('unsupported service preserves legacy Error text and adds a typed code', async () => {
  await assert.rejects(
    prepareOptionalOffline({ packageId: 'civilian-flight', navigator: {} }),
    (error) =>
      error.message === 'Service workers unavailable' && error.offlineCode === 'unsupported',
  );
});
test('registration security and permission failures do not imply a storage failure', async () => {
  for (const name of ['SecurityError', 'NotAllowedError']) {
    const failure = new DOMException('private registration details', name);
    await assert.rejects(
      prepareOptionalOffline({
        packageId: 'civilian-flight',
        navigator: {
          serviceWorker: {
            register: async () => {
              throw failure;
            },
          },
        },
        location: {
          href: 'https://example.test/optional-practice/civilian-flight/index.html',
        },
      }),
      (error) => error === failure && optionalOfflineFailureCode(error) === 'unknown',
    );
    for (const locale of ['en', 'uk']) {
      assert.equal(
        optionalOfflineFailureMessage(failure, locale),
        optionalOfflineFailureMessage(null, locale),
      );
      assert(!optionalOfflineFailureMessage(failure, locale).includes('private'));
    }
  }
});
test('caller cancellation preserves AbortError identity with an additive cancellation code', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    prepareOptionalOffline({
      packageId: 'civilian-flight',
      navigator: { serviceWorker: {} },
      signal: controller.signal,
      location: {
        href: 'https://example.test/optional-practice/civilian-flight/index.html',
      },
    }),
    (error) =>
      error.name === 'AbortError' &&
      error.message === 'Cancelled' &&
      error.offlineCode === 'cancelled',
  );
});
test('fixed code classification reads hostile properties once and rejects non-string codes', () => {
  let reads = 0;
  const error = {
    get offlineCode() {
      return ++reads === 1 ? 'overall-timeout' : 'secret';
    },
  };
  assert.match(optionalOfflineFailureMessage(error, 'en'), /five minutes/);
  assert.equal(reads, 1);
  assert.equal(
    optionalOfflineFailureCode({
      offlineCode: { toString: () => 'overall-timeout' },
    }),
    'unknown',
  );
});
