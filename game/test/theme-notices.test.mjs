import test from 'node:test';
import assert from 'node:assert/strict';
import { getLocale, setLocale, t } from '../i18n/index.mjs';
import { installThemeHost } from '../presentation/theme-host.mjs';
import { THEME_PREFERENCES_KEY } from '../presentation/theme-system.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';

function fixture(context, options = {}) {
  const values = new Map(),
    writes = [],
    notifications = [],
    storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem(key, value) {
        if (options.rejectWrite?.(key)) throw new Error('Storage denied');
        writes.push([key, value]);
        values.set(key, value);
      },
    },
    host = installThemeHost({
      document: new Document(),
      window: new Events(),
      getStorage: () => storage,
      prepareStyles: () => Promise.resolve(),
      onWarning: (message) => notifications.push(message),
      ...options,
    });
  context.after(() => host.dispose());
  return { host, values, writes, notifications };
}

for (const scenario of [
  {
    name: 'unavailable exact family revision',
    key: 'themeUnavailable',
    values: { theme: 'industrial-workshop@r999' },
    options: { appearanceDefault: { familyId: 'industrial-workshop', revision: 'r999' } },
  },
  {
    name: 'failed stylesheet load',
    key: 'stylesheetUnavailable',
    options: {
      prepareStyles: () => Promise.reject(new Error('Theme stylesheet unavailable.')),
    },
  },
  {
    name: 'read-only preferences',
    key: 'readOnly',
    options: { writable: () => false },
    apply: (host) => host.set({ highContrast: true }),
  },
  {
    name: 'denied appearance storage',
    key: 'saveFailed',
    options: { rejectWrite: (key) => key === THEME_PREFERENCES_KEY },
    apply: (host) => host.set({ highContrast: true }),
  },
  {
    name: 'denied SIM appearance storage',
    key: 'simSaveFailed',
    options: { rejectWrite: (key) => key === 'revealline.fpv.appearance.v1' },
    apply: (host) => host.applyComplete('industrial-workshop'),
  },
])
  test(`${scenario.name} reports EN/UK at the UI boundary without changing accepted presentation`, async (context) => {
    const originalLocale = getLocale();
    context.after(() => setLocale(originalLocale, { persist: false }));
    setLocale('en', { persist: false });
    const { host, writes, notifications } = fixture(context, scenario.options);
    await host.ready;
    if (scenario.apply) {
      await scenario.apply(host);
      await host.ready;
    }
    const presentation = host.snapshot(),
      preferences = host.preferences.snapshot(),
      written = structuredClone(writes),
      statuses = [];
    const stop = host.subscribeStatus((message) => statuses.push(message));
    context.after(stop);
    const key = `interface:workshop.notice.${scenario.key}`;
    assert.equal(host.getWarning(), t(key, scenario.values));
    if (scenario.key !== 'themeUnavailable')
      assert.equal(notifications.at(-1), t(key, scenario.values));
    for (const locale of ['uk', 'en', 'uk']) {
      setLocale(locale, { persist: false });
      assert.equal(host.getWarning(), t(key, scenario.values));
      assert.equal(statuses.at(-1), host.getWarning());
      if (locale === 'uk') assert.match(host.getWarning(), /[А-ЯІЇЄҐа-яіїєґ]/);
      assert.equal(host.snapshot(), presentation, 'Language does not reload appearance assets.');
      assert.equal(host.preferences.snapshot(), preferences);
      assert.deepEqual(writes, written, 'Language changes do not write appearance preferences.');
    }
    const statusCount = statuses.length;
    host.dispose();
    setLocale('en', { persist: false });
    assert.equal(statuses.length, statusCount, 'Disposed hosts release locale listeners.');
  });

test('unknown validator diagnostics remain exact instead of changing pure contract error text', async (context) => {
  const previousLocale = getLocale();
  context.after(() => setLocale(previousLocale, { persist: false }));
  const { host } = fixture(context, {
    prepareStyles: () => Promise.reject(new Error('Exact validator diagnostic: r41')),
  });
  await host.ready;
  for (const locale of ['en', 'uk']) {
    setLocale(locale, { persist: false });
    assert.equal(host.getWarning(), 'Exact validator diagnostic: r41');
  }
});
