// These are public-UI adapters, not simulator training or completion hooks.
export const OBSERVED_PACKAGES = Object.freeze({
  'civilian-flight': Object.freeze({
    settingsPrefix: 'gym',
    mounted: '#gym-shell-action-settings',
    panel: '#gym-settings-tab-content',
    prepare: '#offline',
    status: '#package-status',
    close: '#gym-shell-action-settings-back',
  }),
  'civilian-fpv': Object.freeze({
    settingsPrefix: 'academy',
    mounted: '#academy-shell-action-settings',
    panel: '#help',
    prepare: '#install-offline',
    status: '#transfer-status',
    close: '[data-close="help-dialog"]',
  }),
  'fpv-worlds': Object.freeze({
    settingsPrefix: 'worlds',
    mounted: '#worlds-shell-action-settings',
    panel: '#worlds-settings-tab-content',
    prepare: '#prepare-runtime',
    status: '#runtime-offline-status',
    close: '#close-sim-settings',
  }),
});

// The app owns a five-minute transfer limit. Allow its final verification/error
// UI to settle rather than reinstating the observer's old 20-second deadline.
export const TRANSFER_TIMEOUT_MS = 315_000;
export const OPERATION_TIMEOUT_MS = 30_000;

export async function revealFPVOffline(page, openHelp) {
  if (!(await page.locator('#help-dialog').isVisible())) await openHelp();
  const summary = page.locator('summary[data-sim-copy="workshopAndOffline"]');
  // Exercise the native keyboard route. A first pointer press currently shifts
  // this dialog before mouseup; do not misreport that separate pointer issue.
  if ((await summary.locator('..').getAttribute('open')) === null) await summary.press('Enter');
  await page.locator('#install-offline').waitFor({ state: 'visible' });
  await page.locator('#remove-offline').waitFor({ state: 'visible' });
}

export function matchesLaunchedAppURL(actual, expectedEntry, locale = 'en') {
  if (!['en', 'uk'].includes(locale)) return false;
  const target = new URL(expectedEntry);
  const observed = new URL(actual);
  return (
    observed.origin === target.origin &&
    observed.pathname === target.pathname &&
    observed.hash === '' &&
    [...observed.searchParams].length === 1 &&
    observed.searchParams.get('lang') === locale
  );
}

export async function unlockObservedPage(page, password) {
  const state = await page.locator('html').getAttribute('data-access-state');
  if (state !== 'locked') return false;
  if (!password)
    throw new Error(
      'This admitted package requires a password. Set OPTIONAL_INSTALLATION_PASSWORD to an authorized test credential; the observer will use the ordinary unlock form, never bypass it.',
    );
  // Do not propagate Playwright fill diagnostics: they can include typed secrets.
  try {
    await page.locator('#access-gate input[type="password"]').fill(password);
    await page.locator('#access-gate button[type="submit"]').click();
    await page.waitForFunction(
      () => globalThis.document.documentElement.dataset.accessState === 'unlocked',
    );
  } catch {
    throw new Error('The access form did not unlock with the supplied test credential.');
  }
  return true;
}

export async function boundedOperation(label, operation, timeoutMs = OPERATION_TIMEOUT_MS) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function closeAllPages(context) {
  const pages = context.pages();
  await boundedOperation('Close all app windows and tabs', () =>
    Promise.all(pages.map((page) => page.close())),
  );
  if (context.pages().length !== 0)
    throw new Error('Offline relaunch requires zero surviving pages.');
  return pages.length;
}
