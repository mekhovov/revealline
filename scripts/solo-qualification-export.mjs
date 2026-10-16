import assert from 'node:assert/strict';

// File upload APIs can bypass an inert page. Visibility alone is insufficient
// when the tool has not yet installed its ordinary event handlers.
export function qualificationControlReady(element) {
  return Boolean(
    element &&
      !element.disabled &&
      !element.closest('[inert], [hidden], [aria-busy="true"]') &&
      element.getClientRects().length &&
      element.getAttribute('aria-disabled') !== 'true',
  );
}

export async function waitQualificationControl(page, selector, timeout) {
  await page.waitForFunction(
    `(selector) => (${qualificationControlReady.toString()})(document.querySelector(selector))`,
    selector,
    { timeout },
  );
}

// Observe native upload events without replacing handlers or modifying the
// control. This owner is retired before gameplay and retains at most eight events.
export function installQualificationUploadWitness(element, now = () => performance.now()) {
  const events = [];
  let disposed = false;
  const observe = (event) => {
    if (disposed || events.length >= 8) return;
    events.push({
      type: event.type,
      atMs: now(),
      isTrusted: event.isTrusted,
      selectedFiles: element.files?.length ?? null,
      changeHandlerPresent: typeof element.onchange === 'function',
    });
  };
  for (const type of ['input', 'change']) element.addEventListener(type, observe, true);
  const snapshot = () => events.map((event) => ({ ...event }));
  return {
    snapshot,
    dispose() {
      if (!disposed) {
        disposed = true;
        for (const type of ['input', 'change']) element.removeEventListener(type, observe, true);
      }
      return snapshot();
    },
  };
}

// Read an ordinary public export only after gameplay has stopped. Do not inspect
// or mutate application state, and never make an unavailable control available.
export async function readPublicQualificationReplay(page, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  const remaining = () => {
    const timeout = deadline - Date.now();
    assert(timeout > 0, 'Public replay export deadline exceeded');
    return timeout;
  };
  assert.notEqual(
    await page.locator('body').getAttribute('data-flight-state'),
    'running',
    'Export only after measured gameplay',
  );
  const click = async (selector) => {
    const control = page.locator(selector);
    await control.waitFor({ state: 'visible', timeout: remaining() });
    assert(await control.isEnabled(), `Public replay control is disabled: ${selector}`);
    await control.click({ timeout: remaining() });
  };
  await click('#shell-menu');
  await click('#shell-options');
  await click('#settings-tab-extras');
  await click('#shell-workshop');
  if (!(await page.locator('#export-replay').isVisible()))
    await click('details:has(#export-replay) > summary');
  await click('#export-replay');
  await page.locator('#replay-dialog').waitFor({ state: 'visible', timeout: remaining() });
  const text = await page.locator('#replay-json').inputValue();
  assert(Buffer.byteLength(text) <= 32 * 1024 * 1024, 'Replay exceeds public byte bound');
  return text;
}
