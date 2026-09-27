import { t, setLocale, getLocale } from '../i18n/index.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  gameplaySelection,
  finishOfflineSelection,
  downloadErrorMessage,
  installedResultMessage,
  offlineMessage,
  offlineReadinessCode,
  offlineReadinessLabel,
  runApprovedDownload,
} from '../offline-download-session.mjs';

const catalogue = {
  groups: [
    { id: 'base', kind: 'gameplay' },
    { id: 'shared', kind: 'gameplay' },
    { id: 'solo:horizon-starter', kind: 'gameplay' },
    { id: 'solo:border', kind: 'gameplay' },
    { id: 'versus:border', kind: 'gameplay' },
    { id: 'archive:old', kind: 'gameplay', category: 'archive', current: false },
    { id: 'tool:studio', kind: 'gameplay', category: 'tooling' },
    { id: 'music:one', kind: 'soundtrack' },
  ],
};
test('base is the default; all current gameplay never selects archive, creator tools or music', () => {
  assert.deepEqual(gameplaySelection(catalogue), ['base']);
  const all = gameplaySelection(catalogue, { all: true });
  assert.deepEqual(all, ['base', 'shared', 'solo:horizon-starter', 'solo:border', 'versus:border']);
  assert.equal(offlineReadinessCode(catalogue, ['base']), 'baseReady');
  assert.equal(offlineReadinessLabel(catalogue, ['base']), 'Base game ready offline');
  assert.equal(
    offlineReadinessLabel({ ...catalogue, format: 'revealline-offline-content.v2' }, ['base']),
    'Solo starter ready offline',
  );
  assert.equal(offlineReadinessLabel(catalogue, all), 'Game ready offline');
  assert.equal(
    offlineReadinessLabel(catalogue, ['base', 'solo:border']),
    'Selected chapters ready offline',
  );
});
test('semantic offline and installed results keep known states translatable and unknown detail intact', () => {
  const translate = (key, values = {}) => key + (values.detail ? ':' + values.detail : '');
  assert.equal(
    offlineMessage({ messageCode: 'verifying', message: 'old English' }, translate),
    'interface:downloads.offline.verifying',
  );
  assert.equal(
    offlineMessage({ offlineCode: 'new-code', message: 'Exact diagnostic' }, translate),
    'interface:downloads.unknownDetail:Exact diagnostic',
  );
  const known = new Set([
    'interface:downloads.repairBeforeSelecting',
    'interface:downloads.unknownDetail',
  ]);
  const catalogTranslate = (key, values = {}) =>
    known.has(key)
      ? key + (values.detail ? ':' + values.detail : '')
      : (values.defaultValue ?? key);
  assert.equal(
    downloadErrorMessage(
      {
        localization: { key: 'interface:downloads.repairBeforeSelecting' },
        message: 'old English',
      },
      catalogTranslate,
    ),
    'interface:downloads.repairBeforeSelecting',
  );
  assert.equal(
    downloadErrorMessage(
      { localization: { key: 'interface:future.missing' }, message: 'Exact authored detail' },
      catalogTranslate,
    ),
    'interface:downloads.unknownDetail:Exact authored detail',
  );
  assert.equal(
    installedResultMessage({ activated: true, message: 'old English' }, translate),
    'interface:downloads.activationReady',
  );
  assert.equal(
    installedResultMessage({ deferred: true, message: 'old English' }, translate),
    'interface:downloads.activationDeferred',
  );
  assert.equal(
    installedResultMessage(
      {
        activated: false,
        message: 'Open Flight library to Bring progress from an earlier release.',
      },
      translate,
    ),
    'interface:downloads.transferInstructions',
  );
  assert.equal(
    installedResultMessage({ activated: false, message: 'Exact diagnostic' }, translate),
    'interface:downloads.activationFailedDetail:Exact diagnostic',
  );
});

test('requested mission stays pending until safe edition activation settles', async () => {
  let settle,
    continued = false;
  const waiting = finishOfflineSelection({
    activate: () =>
      new Promise((resolve) => {
        settle = resolve;
      }),
    onReady: () => {
      continued = true;
    },
  });
  await Promise.resolve();
  assert.equal(continued, false);
  settle({ activated: true });
  assert.deepEqual(await waiting, { activated: true });
  assert.equal(continued, true);
});
test('deferred or blocked icon selection preserves usable verified mission files', async () => {
  let result;
  await finishOfflineSelection({
    activate: async () => {
      throw new Error('A saved flight prevents edition switching.');
    },
    onReady: (value) => {
      result = value;
    },
  });
  assert.equal(result.activated, false);
  assert.match(result.message, /saved flight/);
});
test('cancellation after verification never begins edition activation or a mission', async () => {
  const controller = new AbortController();
  let finishVerification,
    activations = 0,
    continued = 0;
  const verification = new Promise((resolve) => {
    finishVerification = resolve;
  });
  const waiting = verification.then(() =>
    finishOfflineSelection({
      signal: controller.signal,
      activate: () => activations++,
      onReady: () => continued++,
    }),
  );
  controller.abort();
  finishVerification();
  await assert.rejects(waiting, { name: 'AbortError' });
  assert.equal(activations, 0);
  assert.equal(continued, 0);
});
for (const outcome of ['activated', 'deferred', 'failed'])
  test(`cancellation during ${outcome} edition selection never resumes the requesting mission`, async () => {
    const controller = new AbortController();
    let settle,
      continued = 0;
    const waiting = finishOfflineSelection({
      signal: controller.signal,
      activate: () =>
        new Promise((resolve, reject) => {
          settle = () =>
            outcome === 'failed'
              ? reject(new Error('Switch is unavailable.'))
              : resolve({ activated: outcome === 'activated' });
        }),
      onReady: () => continued++,
    });
    controller.abort();
    settle();
    await assert.rejects(waiting, { name: 'AbortError' });
    assert.equal(continued, 0);
  });
test('aborted edition selection is not treated as a usable deferred result', async () => {
  let continued = 0;
  await assert.rejects(
    finishOfflineSelection({
      activate: async () => {
        throw new DOMException('App selection paused.', 'AbortError');
      },
      onReady: () => continued++,
    }),
    { name: 'AbortError' },
  );
  assert.equal(continued, 0);
});
test('approved session retries transient failures with the same files and stops at the bound', async () => {
  const waits = [],
    selected = Object.freeze(['base', 'solo:border']);
  let attempts = 0;
  await runApprovedDownload(
    async () => {
      assert.deepEqual(selected, ['base', 'solo:border']);
      if (++attempts < 3) throw new TypeError('Load failed');
    },
    { wait: async (delay) => waits.push(delay) },
  );
  assert.equal(attempts, 3);
  assert.deepEqual(waits, [1000, 3000]);
  attempts = 0;
  await assert.rejects(
    runApprovedDownload(
      async () => {
        attempts++;
        throw new TypeError('Failed to fetch');
      },
      { wait: async () => {} },
    ),
    /fetch/,
  );
  assert.equal(attempts, 4);
});
test('pausing or integrity/quota errors never restart work automatically', async () => {
  for (const error of [
    new DOMException('full', 'QuotaExceededError'),
    new Error('Downloaded file does not match its published hash and size.'),
    new Error('Download failed: missing (HTTP 404).'),
  ]) {
    let attempts = 0;
    await assert.rejects(
      runApprovedDownload(async () => {
        attempts++;
        throw error;
      }),
      (actual) => actual === error,
    );
    assert.equal(attempts, 1);
  }
  const controller = new AbortController();
  controller.abort();
  let called = false;
  await assert.rejects(
    runApprovedDownload(
      async () => {
        called = true;
      },
      { signal: controller.signal },
    ),
    { name: 'AbortError' },
  );
  assert.equal(called, false);
});

test('download error fallback survives the actual EN/UK translator missing-key behavior', async () => {
  const previous = getLocale();
  try {
    for (const language of ['en', 'uk']) {
      await setLocale(language);
      const detail = 'Exact authored diagnostic';
      // i18next returnEmptyString:false does not honor an empty fallback sentinel.
      assert.equal(t('interface:future.missing', { defaultValue: '' }), 'future.missing');
      for (const key of [
        'interface:future.missing',
        'interface:constructor',
        'interface:bad:extra',
      ]) {
        assert.equal(
          downloadErrorMessage({ localization: { key }, message: detail }, t),
          t('interface:downloads.unknownDetail', { detail }),
        );
        assert.ok(
          downloadErrorMessage({ localization: { key }, message: detail }, t).includes(detail),
        );
      }
      const key = 'interface:downloads.repairBeforeSelecting';
      assert.equal(
        downloadErrorMessage({ localization: { key }, message: 'stale English' }, t),
        t(key),
      );
      assert.equal(
        offlineMessage({ messageCode: 'verifying', message: 'stale English' }, t),
        t('interface:downloads.offline.verifying'),
      );
    }
  } finally {
    await setLocale(previous);
  }
});
