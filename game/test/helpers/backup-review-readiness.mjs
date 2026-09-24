import assert from 'node:assert/strict';

/** Observe the modeled DOM's real confirmation-handler installation.
 * The caller must still inspect and deliberately accept the replacement review. */
export function beginBackupReplacement(page, activate, { timeoutMs = 180000 } = {}) {
  const confirm = page.$('library-operation-confirm');
  const previous = Object.getOwnPropertyDescriptor(confirm, 'onclick');
  assert.ok(!previous || (previous.configurable && Object.hasOwn(previous, 'value')));
  assert.equal(confirm.hidden, true, 'No earlier replacement review may own this observation.');
  let value = confirm.onclick;
  let observing = true;
  let resolveReady, rejectReady, timer;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const restore = () => {
    if (!observing) return;
    observing = false;
    clearTimeout(timer);
    Object.defineProperty(confirm, 'onclick', {
      ...(previous || { configurable: true, enumerable: true, writable: true }),
      value,
    });
  };
  const fail = (reason) => {
    if (!observing) return;
    restore();
    rejectReady(reason);
  };
  Object.defineProperty(confirm, 'onclick', {
    configurable: true,
    enumerable: previous?.enumerable ?? true,
    get: () => value,
    set(next) {
      value = next;
      if (typeof next === 'function' && !confirm.hidden && !confirm.disabled) {
        restore();
        resolveReady();
      }
    },
  });
  timer = setTimeout(() => {
    fail(
      new Error(
        `Replacement review did not become ready: ${JSON.stringify({
          status: page.$('save-status').textContent,
          hidden: confirm.hidden,
          disabled: confirm.disabled,
          errors: page.errors.map(String),
        })}`,
      ),
    );
    const cancel = page.$('library-operation-cancel');
    if (!cancel.hidden && !cancel.disabled) cancel.click();
  }, timeoutMs);
  void ready.catch(() => {});
  let operation;
  try {
    operation = activate();
    assert.equal(typeof operation?.then, 'function', 'The actual import owns its pending work.');
  } catch (error) {
    restore();
    throw error;
  }
  operation.then(
    () =>
      fail(
        new Error(`Import ended before replacement review: ${page.$('save-status').textContent}`),
      ),
    fail,
  );
  return { operation, ready };
}
