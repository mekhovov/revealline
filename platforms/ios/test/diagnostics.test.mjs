import test from 'node:test';
import assert from 'node:assert/strict';
import { capabilities, probeRuntime } from '../diagnostics/probe.mjs';

test('capability detection reports absent native APIs without certifying browser parity', () => {
  const result = capabilities({
    location: { href: 'capacitor://localhost/game/index.html', origin: 'null' },
  });
  assert.equal(result.secureContext, false);
  assert.equal(result.webLocks, false);
  assert.equal(result.indexedDB, false);
  assert.equal(result.origin, 'null');
  assert.equal(result.platform, 'browser-or-unidentified');
});
test('scratch probes are explicit, clean their own keys and reject unavailable locks/storage', async () => {
  const data = new Map([['revealline.library.dev.v1', 'untouched']]);
  const calls = [];
  const env = {
    localStorage: {
      setItem(key, value) {
        calls.push(key);
        data.set(key, value);
      },
      getItem(key) {
        calls.push(key);
        return data.get(key);
      },
      removeItem(key) {
        calls.push(key);
        data.delete(key);
      },
    },
  };
  const report = await probeRuntime(env);
  assert.equal(report.localStorageRoundtrip.passed, true);
  assert.equal(report.webLockExclusion.passed, false);
  assert.equal(report.indexedDBRoundtrip.passed, false);
  assert.deepEqual([...data], [['revealline.library.dev.v1', 'untouched']]);
  assert.equal(
    calls.every((key) => key.startsWith('revealline.ios-diagnostics.v1.')),
    true,
  );
});
test('lock probe verifies exclusion and release, rather than just API presence', async () => {
  const held = new Set();
  const locks = {
    async request(key, _options, action) {
      if (held.has(key)) return action(null);
      held.add(key);
      try {
        return await action({ name: key });
      } finally {
        held.delete(key);
      }
    },
  };
  const report = await probeRuntime({ navigator: { locks } });
  assert.equal(report.webLocks, true);
  assert.equal(report.webLockExclusion.passed, true);
  assert.equal(held.size, 0);
  const unsafe = await probeRuntime({
    navigator: { locks: { request: (key, _options, action) => action({ name: key }) } },
  });
  assert.equal(unsafe.webLockExclusion.passed, false);
});
