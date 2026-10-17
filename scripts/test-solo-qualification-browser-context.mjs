import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, mkdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  qualificationContextMode,
  createPersistentQualificationOwner,
} from './solo-qualification-browser-context.mjs';

const fixture = async (t, { failLaunch, failClose, hangClose, contextOnlyClose } = {}) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'solo-context-owner-test-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  let connected = true;
  const calls = [];
  const browser = {
    version: () => 'test-native-version',
    isConnected: () => connected,
    close: async () => {
      calls.push('browser-close');
      connected = false;
    },
  };
  const context = {
    browser: () => browser,
    close: async () => {
      calls.push('context-close');
      if (failClose) throw failClose;
      if (hangClose) await new Promise(() => {});
      if (!contextOnlyClose) connected = false;
    },
  };
  const browserType = {
    launchPersistentContext: async (profile, options) => {
      calls.push({ profile, options });
      await writeFile(join(profile, 'owned-profile-marker'), 'retained until confirmed close');
      if (failLaunch) throw failLaunch;
      return context;
    },
  };
  return { root, calls, browser, context, browserType };
};

test('context mode remains ephemeral by default and persistent requires explicit WebKit selection', () => {
  assert.equal(qualificationContextMode([], 'webkit'), 'ephemeral');
  assert.equal(qualificationContextMode([], 'chromium'), 'ephemeral');
  assert.equal(qualificationContextMode(['--context=ephemeral'], 'webkit'), 'ephemeral');
  assert.equal(qualificationContextMode(['--context=persistent'], 'webkit'), 'persistent');
  for (const flags of [
    ['--context'],
    ['--context='],
    ['--context=private'],
    ['--context=ephemeral', '--context=persistent'],
  ])
    assert.throws(() => qualificationContextMode(flags, 'webkit'));
  assert.throws(() => qualificationContextMode(['--context=persistent'], 'chromium'));
});

test('persistent launch uses a fresh owned profile and preserves the declared browser/display options', async (t) => {
  const f = await fixture(t);
  const contextOptions = {
    viewport: { width: 400, height: 850 },
    deviceScaleFactor: 3,
    serviceWorkers: 'block',
    reducedMotion: 'no-preference',
  };
  const owner = createPersistentQualificationOwner({
    browserType: f.browserType,
    launchOptions: { headless: true },
    contextOptions,
    temporaryRoot: f.root,
  });
  const launched = await owner.launch();
  assert.equal(launched.context, f.context);
  assert.equal(launched.browser.version(), 'test-native-version');
  assert.equal(owner.report.mode, 'persistent');
  assert(owner.report.profileDirectory.startsWith(f.root + '/solo-qualification-webkit-'));
  assert.deepEqual(f.calls[0].options, { headless: true, ...contextOptions, timeout: 30000 });
  assert.equal(f.calls[0].profile, owner.report.profileDirectory);
  await assert.rejects(owner.launch(), /one profile/);
  const first = owner.close(),
    second = owner.close();
  assert.equal(first, second);
  assert.equal((await first).status, 'closed');
  assert.equal(owner.report.cleanup.profileRemoved, true);
  assert.deepEqual(f.calls.slice(1), ['context-close']);
  await assert.rejects(access(owner.report.profileDirectory), { code: 'ENOENT' });
});

test('each persistent observation receives a distinct fresh directory', async (t) => {
  const f = await fixture(t);
  const one = createPersistentQualificationOwner({
    browserType: f.browserType,
    temporaryRoot: f.root,
  });
  const two = createPersistentQualificationOwner({
    browserType: f.browserType,
    temporaryRoot: f.root,
  });
  await one.launch();
  await two.launch();
  assert.notEqual(one.report.profileDirectory, two.report.profileDirectory);
  await one.close();
  await two.close();
});

test('failed persistent launch retains the exact profile and failure for outer ownership cleanup', async (t) => {
  const error = new Error('native launch failed'),
    f = await fixture(t, { failLaunch: error });
  const owner = createPersistentQualificationOwner({
    browserType: f.browserType,
    temporaryRoot: f.root,
  });
  await assert.rejects(owner.launch(), (e) => e === error);
  assert.equal(owner.report.status, 'launch-failed');
  assert.match(owner.report.launchFailure, /native launch failed/);
  assert.equal((await owner.close()).status, 'failed-profile-retained');
  await access(join(owner.report.profileDirectory, 'owned-profile-marker'));
});

test('failed or unresponsive close never deletes a possibly live persistent profile', async (t) => {
  for (const mode of [{ failClose: new Error('native close failed') }, { hangClose: true }]) {
    const f = await fixture(t, mode);
    const owner = createPersistentQualificationOwner({
      browserType: f.browserType,
      temporaryRoot: f.root,
      closeTimeoutMs: 10,
    });
    await owner.launch();
    const result = await owner.close();
    assert.equal(result.status, 'failed-profile-retained');
    assert.equal(result.profileRemoved, false);
    assert.equal(f.browser.isConnected(), true);
    await access(join(owner.report.profileDirectory, 'owned-profile-marker'));
  }
});

test('context close must also disconnect the browser before deleting the profile', async (t) => {
  const f = await fixture(t, { contextOnlyClose: true });
  const owner = createPersistentQualificationOwner({
    browserType: f.browserType,
    temporaryRoot: f.root,
  });
  await owner.launch();
  assert.equal((await owner.close()).status, 'closed');
  assert.deepEqual(f.calls.slice(1), ['context-close', 'browser-close']);
});

test('changed profile identity is retained instead of deleting a replacement directory', async (t) => {
  const f = await fixture(t);
  const owner = createPersistentQualificationOwner({
    browserType: f.browserType,
    temporaryRoot: f.root,
  });
  await owner.launch();
  const path = owner.report.profileDirectory;
  await rename(path, path + '-original');
  await mkdir(path);
  await writeFile(join(path, 'replacement-marker'), 'must remain');
  assert.equal((await owner.close()).status, 'failed-profile-retained');
  await access(join(path, 'replacement-marker'));
});
