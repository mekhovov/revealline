import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function qualificationContextMode(flags, engine) {
  if (flags.includes('--context')) throw new Error('Context mode value required');
  const values = flags.filter((value) => value.startsWith('--context='));
  if (values.length > 1) throw new Error('Declare one context mode');
  const mode = values[0]?.slice('--context='.length) ?? 'ephemeral';
  if (!['ephemeral', 'persistent'].includes(mode)) throw new Error('Unknown context mode');
  if (mode === 'persistent' && engine !== 'webkit')
    throw new Error('Persistent qualification is currently WebKit-only');
  return mode;
}

async function bounded(label, run, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(run),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} exceeded ${timeoutMs} ms`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Fresh profile per observation. Outer runners still own process-deadline cleanup.
 * A failed/uncertain close retains this exact directory for that owner to inspect. */
export function createPersistentQualificationOwner({
  browserType,
  launchOptions,
  contextOptions,
  temporaryRoot = tmpdir(),
  closeTimeoutMs = 5000,
}) {
  assert(Number.isFinite(closeTimeoutMs) && closeTimeoutMs > 0 && closeTimeoutMs <= 5000);
  const report = {
    mode: 'persistent',
    engine: 'webkit',
    profilePolicy: 'fresh task-owned profile per observation under the scoped temporary directory',
    status: 'not-launched',
    profileDirectory: null,
    cleanup: null,
  };
  let context, browser, profile, identity, closing;
  return {
    report,
    async launch() {
      assert.equal(report.status, 'not-launched', 'An observation has one profile/launch');
      report.status = 'launching';
      profile = await mkdtemp(join(await realpath(temporaryRoot), 'solo-qualification-webkit-'));
      report.profileDirectory = profile;
      identity = await stat(profile);
      try {
        context = await browserType.launchPersistentContext(profile, {
          ...launchOptions,
          ...contextOptions,
          timeout: 30000,
        });
        browser = context.browser();
        assert(browser, 'Persistent context must expose its actual browser version');
        report.status = 'launched';
        return { browser, context };
      } catch (error) {
        report.status = 'launch-failed';
        report.launchFailure = String(error.stack ?? error);
        throw error;
      }
    },
    close() {
      closing ??= (async () => {
        const cleanup = (report.cleanup = { status: 'closing', profileRemoved: false });
        try {
          assert(context && browser, 'No completed persistent launch; retain profile');
          await bounded('Persistent context close', () => context.close(), closeTimeoutMs);
          if (browser.isConnected())
            await bounded('Persistent browser close', () => browser.close(), closeTimeoutMs);
          assert.equal(browser.isConnected(), false, 'Persistent browser is still connected');
          cleanup.browserClosed = true;
          assert.equal(await realpath(profile), profile, 'Owned profile path changed');
          const current = await stat(profile);
          assert(
            current.isDirectory() && current.dev === identity.dev && current.ino === identity.ino,
            'Owned profile directory identity changed',
          );
          await rm(profile, { recursive: true });
          cleanup.profileRemoved = true;
          cleanup.status = 'closed';
        } catch (error) {
          cleanup.status = 'failed-profile-retained';
          cleanup.failure = String(error.stack ?? error);
        }
        cleanup.completedAt = new Date().toISOString();
        return cleanup;
      })();
      return closing;
    },
  };
}
