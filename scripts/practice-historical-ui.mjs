/** Public UI navigation for the single reviewed 98ad851 historical Academy.
 * Caller MUST also bind the opt-in to its admitted prior version/URL. This is
 * not a generic version detector and does not activate the returned control.
 */
import assert from 'node:assert/strict';

export const HISTORICAL_INSTALLATION_MODE = 'v0.142.4-98ad851';
export function selectHistoricalInstallationMode(value) {
  if (value === undefined) return false;
  assert.equal(
    value,
    HISTORICAL_INSTALLATION_MODE,
    'Historical installation mode must be omitted or v0.142.4-98ad851.',
  );
  return true;
}
const SETTINGS = '#academy-shell-settings-dialog';
const EXPERT = '#academy-shell-expert-dialog';
const SHELL_DIALOGS = new Set(['academy-shell-home-dialog', SETTINGS.slice(1), EXPERT.slice(1)]);
const CONTROLS = Object.freeze({
  '#setup': { category: 'controls', selector: '#setup', expert: false },
  '#notebook-button': { category: 'data', selector: '#notebook-button', expert: true },
  '#help': { category: 'extras', selector: '#academy-shell-action-help', expert: false },
});

export async function revealHistoricalAcademyControl(
  page,
  selector,
  { category = CONTROLS[selector]?.category, signal, timeoutMs = 10000 } = {},
) {
  assert(Object.hasOwn(CONTROLS, selector), 'Unsupported historical Academy control.');
  const control = CONTROLS[selector];
  assert.equal(category, control.category, 'Unexpected historical Academy category.');
  assert(
    Number.isInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 30000,
    'Invalid historical navigation bound.',
  );
  const end = Date.now() + timeoutMs,
    route = [];
  const check = () => {
    signal?.throwIfAborted();
    assert(Date.now() < end, 'Historical Academy navigation deadline exceeded.');
  };
  async function bounded(operation) {
    check();
    let timer, listener;
    try {
      const value = await Promise.race([
        Promise.resolve().then(() => {
          check();
          return operation();
        }),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Historical Academy navigation timed out.')),
            Math.max(1, end - Date.now()),
          );
          if (signal) {
            listener = () => reject(new Error('Historical Academy navigation aborted.'));
            signal.addEventListener('abort', listener, { once: true });
            if (signal.aborted) listener();
          }
        }),
      ]);
      check();
      return value;
    } finally {
      clearTimeout(timer);
      if (listener) signal.removeEventListener('abort', listener);
    }
  }
  async function state() {
    const dialogs = await bounded(() =>
      page.evaluate(() =>
        [...globalThis.document.querySelectorAll('dialog[open]')].map((node) => node.id),
      ),
    );
    assert(
      Array.isArray(dialogs) && dialogs.length <= 3 && dialogs.every((id) => SHELL_DIALOGS.has(id)),
      'Unexpected native dialog blocks historical Academy navigation.',
    );
    return {
      settings: dialogs.includes(SETTINGS.slice(1)),
      expert: dialogs.includes(EXPERT.slice(1)),
    };
  }
  async function ready(button) {
    const target = page.locator(button);
    await bounded(() =>
      target.waitFor({ state: 'visible', timeout: Math.max(1, end - Date.now()) }),
    );
    assert(
      await bounded(() => target.isEnabled()),
      `Historical Academy control is disabled: ${button}`,
    );
    return target;
  }
  async function press(button) {
    const target = await ready(button);
    await bounded(() => target.press('Enter', { timeout: Math.max(1, end - Date.now()) }));
    route.push(button);
  }
  async function waitOpen(dialog, expected) {
    await bounded(() =>
      page.waitForFunction(
        ({ dialog, expected }) =>
          globalThis.document.querySelector(dialog)?.hasAttribute('open') === expected,
        { dialog, expected },
        { timeout: Math.max(1, end - Date.now()) },
      ),
    );
  }
  let current = await state();
  if (current.expert && !control.expert) {
    await press('#academy-shell-action-expert-back');
    await waitOpen(EXPERT, false);
    current = await state();
  }
  if (!current.settings && !current.expert) {
    await press('#academy-shell-action-settings');
    await waitOpen(SETTINGS, true);
    current = await state();
  }
  if (control.expert && !current.expert) {
    assert(current.settings, 'Historical Settings did not open.');
    await press('#academy-shell-action-expert');
    await waitOpen(EXPERT, true);
    current = await state();
  }
  assert(
    control.expert ? current.expert : current.settings && !current.expert,
    'Requested historical control is behind a different dialog.',
  );
  await ready(control.selector);
  return {
    requested: selector,
    selector: control.selector,
    category,
    route,
    activated: false,
    mode: HISTORICAL_INSTALLATION_MODE,
  };
}
