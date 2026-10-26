import test from 'node:test';
import assert from 'node:assert/strict';
import { collectSupportSummary, supportSnapshot } from '../local-support-summary.mjs';
import { attachLocalSupportSummary } from '../ui/local-support-summary.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { deferred } from './helpers/media-fixtures.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

const clock = { monotonic: 1000, wall: 1792317600000 };
const host = () => ({
  version: '0.151.1',
  sourceRevision: 'a'.repeat(40),
  packaged: true,
  kind: 'journey',
  state: 'paused',
  locale: 'en',
  writable: true,
  writerReason: 'owned',
  platform: 'browser',
  offline: 'configured',
  controller: {
    sampledAt: 900,
    status: 'waiting-neutral',
    assigned: true,
    neutral: false,
    blocked: true,
    reason: 'waiting-neutral',
  },
});
const environment = () => ({
  navigator: {},
  document: { hidden: false, hasFocus: () => true },
  performance: { now: () => 1000 },
});

test('support capture allowlists bounded observations without reading inputs, storage contents or identity', async () => {
  const env = environment(),
    value = host(),
    reads = [];
  Object.assign(value, { playerName: 'secret-player', url: 'secret-url', token: 'secret-token' });
  Object.assign(value.controller, { id: 'secret-device', buttons: ['secret-input'] });
  Object.defineProperties(env, {
    location: { get: () => assert.fail('Must not read URLs.') },
    localStorage: { get: () => assert.fail('Must not read storage contents.') },
  });
  env.navigator.getGamepads = () => assert.fail('Must not sample gamepads.');
  env.navigator.storage = {
    persisted: async () => {
      reads.push('retention');
      return true;
    },
    estimate: async () => {
      reads.push('estimate');
      return { usage: 1024 * 1024 + 1, quota: 32 * 1024 * 1024, secret: 'secret-storage' };
    },
    persist: () => assert.fail('Must not request persistence.'),
  };
  const report = await collectSupportSummary({ host: value, env, clock }),
    text = JSON.stringify(report);
  assert.deepEqual(reads.sort(), ['estimate', 'retention']);
  assert.doesNotMatch(text, /secret|buttons|url|token|playerName/i);
  assert(text.length < 4096);
  assert.equal(report.controller.freshness, 'recent');
  assert.equal(report.controller.status, 'waiting-neutral');
  assert.equal(report.storage.retention, 'granted');
  assert.deepEqual(report.storage.estimate, { status: 'observed', usageMiB: 2, quotaMiB: 32 });
  assert.equal(report.offline.files, 'not-verified-here');
});

test('missing, throwing and invalid APIs remain unavailable rather than negative results', async () => {
  const env = environment();
  const missing = await collectSupportSummary({ host: {}, env, clock });
  assert.equal(missing.environment.secureContext, null);
  assert.equal(missing.environment.onlineHint, 'unavailable');
  assert.equal(missing.environment.capabilities.gamepad, 'unavailable');
  assert.equal(missing.game.saving.writable, null);
  assert.equal(missing.controller.freshness, 'unavailable');
  assert.equal(missing.storage.retention, 'unavailable');
  assert.equal(missing.storage.estimate.status, 'unavailable');
  env.navigator.storage = {
    persisted: async () => {
      throw new Error('secret storage error');
    },
    estimate: async () => ({ usage: -1, quota: Infinity }),
  };
  const unavailable = await collectSupportSummary({ host: host(), env, clock });
  assert.equal(unavailable.storage.retention, 'unavailable');
  assert.equal(unavailable.storage.estimate.status, 'unavailable');
  assert.doesNotMatch(JSON.stringify(unavailable), /secret/);
});

test('controller snapshots distinguish readiness, inactive/stale sampling and missing samples', () => {
  const env = environment();
  for (const status of ['disconnected', 'unsupported', 'waiting-neutral', 'connected']) {
    const value = host();
    value.controller.status = status;
    assert.equal(supportSnapshot(value, env, clock).controller.status, status);
  }
  assert.equal(
    supportSnapshot(host(), env, { ...clock, monotonic: 4000 }).controller.freshness,
    'stale',
  );
  env.document.hidden = true;
  assert.equal(supportSnapshot(host(), env, clock).controller.freshness, 'stale');
  env.document.hidden = false;
  env.document.hasFocus = () => false;
  assert.equal(supportSnapshot(host(), env, clock).controller.freshness, 'stale');
  delete env.document.hasFocus;
  assert.equal(supportSnapshot(host(), env, clock).controller.freshness, 'unavailable');
  assert.equal(supportSnapshot(host(), env, clock).environment.focused, null);
  const invalid = host();
  invalid.controller.sampledAt = 2000;
  invalid.controller.status = 'secret-status';
  invalid.version = 'secret version with spaces';
  assert.equal(supportSnapshot(invalid, env, clock).controller.freshness, 'unavailable');
  assert.equal(supportSnapshot(invalid, env, clock).controller.status, 'unavailable');
  assert.equal(supportSnapshot(invalid, env, clock).build.version, null);
});

test('Snake host scopes and terminal states stay bounded without inventing neutral-input readiness', () => {
  for (const kind of ['snake-solo', 'snake-versus', 'snake-team']) {
    const report = supportSnapshot(
      {
        kind,
        state: 'finished',
        writerReason: 'released',
        writable: false,
        controller: { sampledAt: 900, status: 'observed', assigned: true },
      },
      environment(),
      clock,
    );
    assert.equal(report.scope, 'snake-game-shell');
    assert.equal(report.game.host, kind);
    assert.equal(report.game.state, 'finished');
    assert.equal(report.game.saving.reason, 'released');
    assert.equal(report.controller.status, 'observed');
    assert.equal(report.controller.neutral, null);
    assert.equal(report.controller.confirmBlocked, null);
    assert.equal(report.controller.confirmReason, 'unavailable');
  }
  const invalid = supportSnapshot(
    { kind: 'snake-secret', state: 'private-result' },
    environment(),
    clock,
  );
  assert.equal(invalid.game.host, 'unavailable');
  assert.equal(invalid.game.state, 'unavailable');
});

test('hanging storage observations have a bounded deadline and cancellation settles promptly', async () => {
  const env = environment(),
    wait = deferred();
  env.navigator.storage = { persisted: () => wait.promise, estimate: () => wait.promise };
  const timed = await collectSupportSummary({ host: host(), env, clock, timeoutMs: 5 });
  assert.equal(timed.storage.retention, 'timeout');
  assert.equal(timed.storage.estimate.status, 'timeout');
  const controller = new AbortController(),
    pending = collectSupportSummary({ host: host(), env, clock, signal: controller.signal });
  controller.abort();
  const cancelled = await pending;
  assert.equal(cancelled.storage.retention, 'cancelled');
  assert.equal(cancelled.storage.estimate.status, 'cancelled');
  wait.resolve(false);
});

function panel({ collect, exportFile, getSettingsOpen } = {}) {
  const doc = new Document(),
    win = new Events(),
    settings = doc.createElement('dialog'),
    root = doc.createElement('section'),
    exports = [];
  settings.open = true;
  settings.append(root);
  doc.body.append(settings);
  const ui = attachLocalSupportSummary({
    document: doc,
    window: win,
    root,
    settings,
    getHost: host,
    getSettingsOpen,
    collect:
      collect ?? ((options) => collectSupportSummary({ ...options, env: environment(), clock })),
    exportFile:
      exportFile ??
      ((value, name) => {
        exports.push({ value, name });
        return { status: 'requested' };
      }),
  });
  return {
    doc,
    win,
    settings,
    root,
    ui,
    exports,
    $: (id) => doc.getElementById(`support-summary-${id}`),
  };
}

test('local preview matches the explicit export and remains truthful in EN/UK', async () => {
  const locale = getLocale();
  try {
    setLocale('en', { persist: false });
    const h = panel();
    assert.equal(h.exports.length, 0);
    assert.equal(h.$('download').disabled, true);
    h.$('prepare').focus();
    assert.equal(await h.ui.refresh(), true);
    assert.equal(h.doc.activeElement, h.$('prepare'));
    assert.equal(h.exports.length, 0);
    assert.match(h.$('controller').textContent, /release its buttons/);
    assert.match(h.$('offline').textContent, /not verified here/);
    await h.ui.download();
    assert.deepEqual(h.exports[0].value, JSON.parse(h.$('json').textContent));
    assert.equal(h.exports[0].name, 'revealline-local-support-summary.json');
    assert.match(h.$('status').textContent, /Download requested/);
    setLocale('uk', { persist: false });
    assert.match(h.$('controller').textContent, /відпустіть кнопки/);
    assert.match(h.$('status').textContent, /Завантаження запитано/);
    assert.doesNotMatch(h.root.textContent, /interface:|supportSummary\.|\{\{/);
    h.ui.destroy();
  } finally {
    setLocale(locale, { persist: false });
  }
});

test('refresh replacement, closing and hidden panels reject stale asynchronous observations', async () => {
  const first = deferred(),
    report = await collectSupportSummary({ host: host(), env: environment(), clock });
  let calls = 0;
  const h = panel({ collect: () => (++calls === 1 ? first.promise : Promise.resolve(report)) });
  const older = h.ui.refresh();
  await h.ui.refresh();
  first.resolve({ ...report, build: { version: 'old' } });
  await older;
  assert.equal(JSON.parse(h.$('json').textContent).build.version, '0.151.1');
  h.settings.open = false;
  h.settings.emit('close');
  assert.equal(h.$('download').disabled, true);
  assert.equal(h.$('json').textContent, '');
  h.settings.open = true;
  const next = h.ui.refresh();
  h.root.hidden = true;
  await next;
  assert.equal(h.$('download').disabled, true);
  assert.match(h.$('status').textContent, /No summary/);
  h.root.hidden = false;
  await h.ui.refresh();
  h.doc.hidden = true;
  h.doc.emit('visibilitychange');
  assert.equal(h.$('download').disabled, true);
  h.ui.destroy();
});

test('native export cancellation/failure and bfcache return keep useful local controls', async () => {
  let status = 'cancelled';
  const h = panel({ exportFile: () => ({ status }) });
  await h.ui.refresh();
  await h.ui.download();
  assert.match(h.$('status').textContent, /without a confirmed destination/);
  status = 'shared';
  await h.ui.download();
  assert.match(h.$('status').textContent, /Check that destination/);
  h.win.emit('pagehide', { persisted: true });
  assert.equal(h.$('download').disabled, true);
  assert.equal(await h.ui.refresh(), true);
  h.ui.destroy();
  const failed = panel({ exportFile: () => Promise.reject(new Error('secret error')) });
  await failed.ui.refresh();
  await failed.ui.download();
  assert.match(failed.$('status').textContent, /Export did not finish/);
  assert.doesNotMatch(failed.root.textContent, /secret/);
  assert.equal(failed.$('download').disabled, false);
  failed.ui.destroy();
});

test('refreshing or reopening while a native export waits cannot start a second export or publish its stale result', async () => {
  const wait = deferred();
  let exports = 0;
  const h = panel({
    exportFile: () => {
      exports++;
      return wait.promise;
    },
  });
  await h.ui.refresh();
  const previous = h.ui.download();
  h.settings.open = false;
  h.settings.emit('close');
  h.settings.open = true;
  await h.ui.refresh();
  assert.equal(h.$('download').disabled, true);
  assert.match(h.$('status').textContent, /earlier export is still waiting/);
  assert.equal(await h.ui.download(), false);
  assert.equal(exports, 1);
  wait.resolve({ status: 'shared' });
  await previous;
  assert.equal(h.$('download').disabled, false);
  assert.match(h.$('status').textContent, /Summary prepared below/);
  assert.doesNotMatch(h.$('status').textContent, /Shared with/);
  h.ui.destroy();
});

test('explicit section visibility and invalidation retire a pending visit even after away/back', async () => {
  let open = true;
  const held = deferred(),
    report = await collectSupportSummary({ host: host(), env: environment(), clock });
  let calls = 0;
  const h = panel({
    getSettingsOpen: () => open,
    collect: () => (++calls === 1 ? held.promise : Promise.resolve(report)),
  });
  delete h.settings.open;
  const old = h.ui.refresh();
  open = false;
  h.ui.invalidate();
  assert.equal(await h.ui.refresh(), false);
  open = true;
  held.resolve(report);
  await old;
  assert.equal(h.$('json').textContent, '');
  await h.ui.refresh();
  assert.equal(h.$('download').disabled, false);
  h.ui.destroy();
  h.ui.invalidate();
  assert.equal(await h.ui.refresh(), false);
});

test('explicit owner invalidation preserves an outstanding export lease across reopen and newer preparation', async () => {
  const held = deferred();
  let open = true,
    exports = 0;
  const h = panel({
    getSettingsOpen: () => open,
    exportFile: () => {
      exports++;
      return held.promise;
    },
  });
  delete h.settings.open;
  await h.ui.refresh();
  const previous = h.ui.download();
  open = false;
  h.ui.invalidate();
  open = true;
  await h.ui.refresh();
  assert.equal(h.$('download').disabled, true);
  assert.equal(await h.ui.download(), false);
  assert.equal(exports, 1);
  held.resolve({ status: 'shared' });
  await previous;
  assert.equal(h.$('download').disabled, false);
  assert.doesNotMatch(h.$('status').textContent, /Shared with/);
  h.ui.destroy();
});

test('Team support accepts only its aggregate scalar observation and does not invent readiness or save permission', () => {
  const value = supportSnapshot(
    {
      kind: 'capture-team',
      state: 'paused',
      writable: null,
      controller: {
        sampledAt: 900,
        status: 'connected',
        assigned: true,
        seats: ['private-seat'],
        devices: ['private-device'],
        buttons: [1],
        axes: [0.2],
      },
    },
    environment(),
    clock,
  );
  assert.equal(value.scope, 'team-game-shell');
  assert.equal(value.game.host, 'capture-team');
  assert.equal(value.game.state, 'paused');
  assert.equal(value.game.saving.writable, null);
  assert.equal(value.game.saving.reason, 'unavailable');
  assert.equal(value.controller.assigned, true);
  assert.equal(value.controller.neutral, null);
  assert.equal(value.controller.confirmBlocked, null);
  assert.equal(value.controller.confirmReason, 'unavailable');
  assert.doesNotMatch(JSON.stringify(value), /private|seats|devices|buttons|axes/);
  for (const kind of ['solo', 'journey', 'installed-edition', 'practice']) {
    const primary = supportSnapshot({ kind }, environment(), clock);
    assert.equal(primary.scope, 'primary-game-shell');
    assert.equal(primary.game.host, kind);
  }

});

test('Versus finished is an observed round state and preserves primary and Team scopes', () => {
  const value = supportSnapshot(
    { kind: 'capture-versus', state: 'finished' },
    environment(),
    clock,
  );
  assert.equal(value.scope, 'versus-game-shell');
  assert.equal(value.game.host, 'capture-versus');
  assert.equal(value.game.state, 'finished');
  assert.equal(value.game.saving.writable, null);
  assert.equal(
    supportSnapshot({ kind: 'capture-team' }, environment(), clock).scope,
    'team-game-shell',
  );
  assert.equal(supportSnapshot({ kind: 'solo' }, environment(), clock).scope, 'primary-game-shell');
});
