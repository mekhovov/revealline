import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HISTORICAL_INSTALLATION_MODE,
  selectHistoricalInstallationMode,
  revealHistoricalAcademyControl,
} from './practice-historical-ui.mjs';

const settings = 'academy-shell-settings-dialog',
  expert = 'academy-shell-expert-dialog',
  home = 'academy-shell-home-dialog';
function pageFixture(initial = [home], { disabled = [], invisible = [], transition = true } = {}) {
  const dialogs = new Set(initial),
    events = [];
  const page = {
    dialogs,
    events,
    evaluate: async () => {
      events.push('read-open-dialogs');
      return [...dialogs];
    },
    waitForFunction: async (fn, { dialog, expected }) => {
      assert(fn.toString().includes("hasAttribute('open')"));
      assert.equal(dialogs.has(dialog.slice(1)), expected, 'Native open attribute did not change');
      events.push(`wait-open:${dialog}:${expected}`);
    },
    locator: (selector) => ({
      waitFor: async ({ state, timeout }) => {
        assert.equal(state, 'visible');
        assert(timeout > 0 && timeout <= 30000);
        assert(!invisible.includes(selector), 'Invisible historical control');
        events.push(`visible:${selector}`);
      },
      isEnabled: async () => {
        events.push(`enabled:${selector}`);
        return !disabled.includes(selector);
      },
      press: async (key, { timeout }) => {
        assert.equal(key, 'Enter');
        assert(timeout > 0 && timeout <= 30000);
        events.push(`press:${selector}`);
        if (!transition) return;
        if (selector === '#academy-shell-action-settings') dialogs.add(settings);
        if (selector === '#academy-shell-action-expert') dialogs.add(expert);
        if (selector === '#academy-shell-action-expert-back') dialogs.delete(expert);
      },
    }),
  };
  return page;
}
const presses = (page) =>
  page.events.filter((value) => value.startsWith('press:')).map((value) => value.slice(6));

test('historical mode is explicit and one-snapshot-only', () => {
  assert.equal(selectHistoricalInstallationMode(undefined), false);
  assert.equal(selectHistoricalInstallationMode(HISTORICAL_INSTALLATION_MODE), true);
  for (const value of ['', 'true', 'v0.142.4', 'latest', true])
    assert.throws(() => selectHistoricalInstallationMode(value));
});

test('setup is revealed in native Settings and never activated by the adapter', async () => {
  const page = pageFixture();
  const result = await revealHistoricalAcademyControl(page, '#setup', { category: 'controls' });
  assert.deepEqual(presses(page), ['#academy-shell-action-settings']);
  assert.equal(result.selector, '#setup');
  assert.equal(result.activated, false);
  assert.deepEqual(result.route, presses(page));
  assert(page.events.includes('visible:#setup'));
  assert(page.events.includes('enabled:#setup'));
});

test('notebook requires Settings then Expert and final button remains unactivated', async () => {
  const page = pageFixture();
  const result = await revealHistoricalAcademyControl(page, '#notebook-button', {
    category: 'data',
  });
  assert.deepEqual(presses(page), [
    '#academy-shell-action-settings',
    '#academy-shell-action-expert',
  ]);
  assert.equal(result.selector, '#notebook-button');
  assert.equal(result.activated, false);
  assert(page.dialogs.has(settings) && page.dialogs.has(expert));
});

test('help uses the Settings shell action and closes stacked Expert first', async () => {
  const page = pageFixture([home, settings, expert]);
  const result = await revealHistoricalAcademyControl(page, '#help', { category: 'extras' });
  assert.deepEqual(presses(page), ['#academy-shell-action-expert-back']);
  assert.equal(result.selector, '#academy-shell-action-help');
  assert.equal(result.activated, false);
  assert(
    page.events.indexOf('wait-open:#academy-shell-expert-dialog:false') <
      page.events.indexOf('visible:#academy-shell-action-help'),
  );
});

test('already-open native target dialogs do not trigger duplicate navigation', async () => {
  for (const [selector, dialogs] of [
    ['#setup', [home, settings]],
    ['#notebook-button', [home, settings, expert]],
    ['#help', [home, settings]],
  ]) {
    const page = pageFixture(dialogs);
    await revealHistoricalAcademyControl(page, selector);
    assert.deepEqual(presses(page), []);
  }
  const page = pageFixture([home, settings, expert]);
  await revealHistoricalAcademyControl(page, '#setup');
  assert.deepEqual(presses(page), ['#academy-shell-action-expert-back']);
});

test('disabled or hidden navigation and final controls never receive Enter', async () => {
  for (const options of [
    { disabled: ['#academy-shell-action-settings'] },
    { invisible: ['#academy-shell-action-settings'] },
    { disabled: ['#setup'] },
    { invisible: ['#setup'] },
  ]) {
    const page = pageFixture([home], options);
    await assert.rejects(revealHistoricalAcademyControl(page, '#setup'));
    assert(!presses(page).includes('#setup'));
    if (
      options.disabled?.includes('#academy-shell-action-settings') ||
      options.invisible?.includes('#academy-shell-action-settings')
    )
      assert.deepEqual(presses(page), []);
  }
});

test('open native overlays and failed dialog transitions fail closed instead of pressing background UI', async () => {
  const blocked = pageFixture([home, settings, 'setup-dialog']);
  await assert.rejects(
    revealHistoricalAcademyControl(blocked, '#notebook-button'),
    /Unexpected native dialog/,
  );
  assert.deepEqual(presses(blocked), []);
  const failed = pageFixture([home, settings, expert], { transition: false });
  await assert.rejects(revealHistoricalAcademyControl(failed, '#setup'), /open attribute/);
  assert.deepEqual(presses(failed), ['#academy-shell-action-expert-back']);
});

test('unsupported selector/category/bounds and pre-abort perform no page operation', async () => {
  for (const [selector, options] of [
    ['#other', {}],
    ['#setup', { category: 'data' }],
    ['#setup', { timeoutMs: 30001 }],
    ['#setup', { timeoutMs: 0 }],
  ]) {
    const page = pageFixture();
    await assert.rejects(revealHistoricalAcademyControl(page, selector, options));
    assert.deepEqual(page.events, []);
  }
  const controller = new AbortController();
  controller.abort();
  const page = pageFixture();
  await assert.rejects(
    revealHistoricalAcademyControl(page, '#setup', { signal: controller.signal }),
  );
  assert.deepEqual(page.events, []);
});

test('stalled read or aborted navigation cannot continue to a final activation', async () => {
  const stalled = pageFixture();
  stalled.evaluate = () => new Promise(() => {});
  await assert.rejects(
    revealHistoricalAcademyControl(stalled, '#setup', { timeoutMs: 10 }),
    /timed out/,
  );
  assert.deepEqual(presses(stalled), []);
  const controller = new AbortController(),
    page = pageFixture();
  page.evaluate = async () => {
    controller.abort();
    return [home];
  };
  await assert.rejects(
    revealHistoricalAcademyControl(page, '#setup', { signal: controller.signal }),
  );
  assert.deepEqual(presses(page), []);
});
