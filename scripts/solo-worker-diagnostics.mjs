/* global document, window */
import assert from 'node:assert/strict';

export const WORKER_DIAGNOSTIC_WINDOW_MS = 12000;
export function parseWorkerOptions(flags) {
  assert.equal(new Set(flags).size, flags.length, 'Duplicate MP3 smoke option.');
  const engine = flags.find((flag) => flag.startsWith('--browser='))?.slice(10) ?? 'chromium';
  assert(['chromium', 'webkit'].includes(engine), 'Invalid MP3 smoke browser.');
  const allowed = new Set([
    '--fixture-access',
    `--browser=${engine}`,
    '--diagnostics',
    '--idle-control',
  ]);
  assert(
    flags.every((flag) => allowed.has(flag)),
    'Invalid MP3 smoke options.',
  );
  const diagnostics = flags.includes('--diagnostics'),
    idleControl = flags.includes('--idle-control');
  assert(!idleControl || diagnostics, 'Idle control requires the separate diagnostic mode.');
  return { engine, diagnostics, idleControl, fixtureAccess: flags.includes('--fixture-access') };
}

// This is called only after the prospective observation window has closed.
// The ordinary public Menu forces Pause even if an interruption already paused
// the game between observation and click. The Pause button itself toggles Resume.
export async function exportWorkerDiagnostics(page, evidence) {
  evidence.postWindow = await page.evaluate(() => {
    const message = document.getElementById('run-message');
    return {
      atMs: performance.now(),
      flightState: document.body.dataset.flightState,
      visibilityState: document.visibilityState,
      hidden: document.hidden,
      hasFocus: document.hasFocus(),
      message: message?.textContent?.slice(0, 1000) ?? null,
      cue: message?.dataset.cue?.slice(0, 80) ?? null,
    };
  });
  evidence.stateBeforeExport = evidence.postWindow.flightState;
  evidence.publicPauseRequested = evidence.stateBeforeExport === 'running';
  evidence.postWindowAction = evidence.publicPauseRequested ? 'public-menu-forced-pause' : 'none';
  if (evidence.publicPauseRequested) {
    await page.locator('#shell-menu').click({ timeout: 10000 });
    await page.waitForFunction(() => document.body.dataset.flightState === 'paused', null, {
      timeout: 10000,
    });
  }
  evidence.application = await page.evaluate(() => {
    if (document.body.dataset.flightState === 'running')
      throw new Error('Worker diagnostic export requires stopped gameplay.');
    if (!window.RevealLineSoloPerformance)
      throw new Error('Bounded application performance session unavailable.');
    return window.RevealLineSoloPerformance.export();
  });
  assert(
    Buffer.byteLength(JSON.stringify(evidence.application)) <= 1024 * 1024,
    'Worker diagnostic export exceeds fixed bound.',
  );
}
