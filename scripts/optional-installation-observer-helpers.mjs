// These are public-UI adapters, not simulator training or completion hooks.
import { validateFlightResponse } from '../optional-practice/civilian-fpv/radio-profile.mjs';

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
export const OBSERVATION_TIMEOUT_MS = 600_000;

// Ownership outlives a timed-out Promise.race. Pending or failed acquisition
// means cleanup must retain the profile instead of claiming it was removed.
export async function trackObservedResource(state, name, operation) {
  state.pending.add(name);
  try {
    return await operation();
  } catch (error) {
    state.errors.push({ resource: name, error: error.message });
    throw error;
  } finally {
    state.pending.delete(name);
  }
}

export function resourceCleanupIssues(state) {
  return [
    ...state.errors,
    ...[...state.pending].map((resource) => ({
      resource,
      error: 'Resource startup or late cleanup is still pending; profile retained.',
    })),
  ];
}

export async function activateOfflineAction(page, { button, status, expected }) {
  // Locator.press itself can target hidden controls. Require the ordinary
  // visible surface before witnessing a new user action.
  await page.locator(button).waitFor({ state: 'visible' });
  // Observe DOM changes only; never clear app statuses or invoke app functions.
  // A previously displayed "Ready offline" must not satisfy a new operation.
  await page.evaluate(
    ({ status }) => {
      const node = globalThis.document.querySelector(status);
      if (!node) throw new Error('Offline status is missing.');
      const witness = { statusChanged: false, progressShown: false };
      witness.observer = new globalThis.MutationObserver((records) => {
        for (const record of records) {
          if (record.target === node || node.contains(record.target)) witness.statusChanged = true;
          for (const added of record.addedNodes)
            if (
              added.nodeType === 1 &&
              (added.matches('[data-optional-offline-progress]') ||
                added.querySelector('[data-optional-offline-progress]'))
            )
              witness.progressShown = true;
        }
      });
      witness.observer.observe(globalThis.document.body, {
        childList: true,
        characterData: true,
        subtree: true,
      });
      globalThis.__optionalInstallationWitness = witness;
    },
    { status },
  );
  try {
    await page.locator(button).press('Enter');
    await page.waitForFunction(
      () => {
        const witness = globalThis.__optionalInstallationWitness;
        return witness?.statusChanged || witness?.progressShown;
      },
      null,
      { timeout: OPERATION_TIMEOUT_MS },
    );
    await page.waitForFunction(
      ({ button, status, expected }) => {
        const witness = globalThis.__optionalInstallationWitness;
        if (!witness?.statusChanged) return false;
        const text = globalThis.document.querySelector(status)?.textContent ?? '';
        if (new RegExp(expected, 'i').test(text))
          return (
            !globalThis.document.querySelector(button)?.disabled &&
            !globalThis.document.querySelector('[data-optional-offline-progress]')
          );
        if (
          /failed|timed out|stalled|exceeded five minutes|needs repair|cancelled|denied|quota|not available|not supported/i.test(
            text,
          )
        )
          throw new Error(`Offline action failed: ${text}`);
        // A fault control can be ineffective. Treat a fresh successful terminal
        // status as an unexpected outcome, not a stalled transfer/deadline.
        if (
          /ready offline|ready for offline|prepared offline|offline runtime preparation completed/i.test(
            text,
          ) &&
          !globalThis.document.querySelector(button)?.disabled &&
          !globalThis.document.querySelector('[data-optional-offline-progress]')
        )
          throw new Error(`Unexpected offline action result: ${text}`);
        return false;
      },
      { button, status, expected: expected.source },
      { timeout: TRANSFER_TIMEOUT_MS },
    );
  } finally {
    await page
      .evaluate(() => {
        globalThis.__optionalInstallationWitness?.observer.disconnect();
        delete globalThis.__optionalInstallationWitness;
      })
      .catch(() => {});
  }
}

export async function revealFPVOffline(page, openHelp) {
  if (!(await page.locator('#help-dialog').isVisible())) await openHelp();
  const summary = page.locator('summary[data-sim-copy="workshopAndOffline"]');
  // Exercise the native keyboard route. Pointer stability has a separate
  // qualification matrix; this observer cannot supply that evidence.
  if ((await summary.locator('..').getAttribute('open')) === null) await summary.press('Enter');
  await page.locator('#install-offline').waitFor({ state: 'visible' });
  await page.locator('#remove-offline').waitFor({ state: 'visible' });
}

export async function revealFPVProfiles(page, openSetup) {
  if (!(await page.locator('#setup-dialog').isVisible())) await openSetup();
  const summary = page
    .locator('#setup-dialog summary')
    .filter({ hasText: /^Back up or import a profile$/ });
  // Radio setup deliberately keeps transfer tools collapsed. Use its ordinary
  // disclosure instead of forcing hidden fields or changing application state.
  if ((await summary.locator('..').getAttribute('open')) === null) await summary.press('Enter');
  await page
    .getByRole('textbox', { name: 'Profile JSON', exact: true })
    .waitFor({ state: 'visible' });
}

export function expectedImportedProfileExport(format, fixture, options = {}) {
  if (!['FlightProfiles.v1', 'FlightProfiles.v2'].includes(format))
    throw new Error(`Unsupported observed profile export format: ${format}`);
  if (
    !options ||
    typeof options !== 'object' ||
    Array.isArray(options) ||
    Object.keys(options).some((key) => !['ratesOwner', 'priorExport', 'importNotice'].includes(key))
  )
    throw new Error('Invalid observed profile import policy.');
  const { ratesOwner = false, priorExport = null, importNotice = '' } = options;
  if (typeof ratesOwner !== 'boolean') throw new Error('Rates ownership must be explicit.');
  const expected = structuredClone(fixture);
  if (ratesOwner) {
    if (
      priorExport?.format !== format ||
      priorExport.radio !== null ||
      (format === 'FlightProfiles.v2' &&
        (!Array.isArray(priorExport.radios) || priorExport.radios.length !== 0)) ||
      typeof importNotice !== 'string' ||
      importNotice.length > 4096 ||
      !importNotice.includes(
        'Included flight response settings were not applied. Rates & throttle profiles remain unchanged.',
      )
    )
      throw new Error(
        'Require the fresh public export and explicit calibration-only import notice.',
      );
    expected.response = validateFlightResponse(priorExport.response);
  } else if (priorExport !== null || importNotice !== '')
    throw new Error('Legacy profile import cannot silently opt into response preservation.');
  if (format === 'FlightProfiles.v1') return expected;
  if (format === 'FlightProfiles.v2')
    return { ...expected, format, radios: expected.radio ? [expected.radio] : [] };
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

// Persistent-context close shuts down its owned browser, not just its pages.
// Require the close event before the caller may relaunch the same disk profile.
export async function closeBrowserForRestart(context) {
  const closedPageCount = await closeAllPages(context);
  let contextClosed = false;
  const onClose = () => {
    contextClosed = true;
  };
  context.once('close', onClose);
  try {
    await boundedOperation('Close persistent browser for offline restart', () => context.close());
    if (!contextClosed) throw new Error('Persistent browser did not confirm closure.');
  } finally {
    context.off('close', onClose);
  }
  return { closedPageCount, contextClosed };
}
