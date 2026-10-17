import assert from 'node:assert/strict';
import { settle } from './solo-dom.mjs';

/** Click the real host control and join the preparation owned by that action.
 * No readiness state or gameplay event is synthesized by the fixture. */
export async function activateHostAction(button) {
  assert.ok(button?.isConnected, 'The action must be connected.');
  assert.equal(button.hidden, false, 'The action must be visible.');
  assert.equal(button.disabled, false, 'The action must be enabled.');
  const handler = button.onclick;
  assert.equal(typeof handler, 'function', 'The real host action must be bound.');
  let invoked = false,
    pending;
  button.onclick = (...args) => {
    invoked = true;
    return (pending = handler.apply(button, args));
  };
  try {
    button.click();
  } finally {
    button.onclick = handler;
  }
  assert.equal(invoked, true, 'The browser boundary must accept the click.');
  let completed = false;
  Promise.resolve(pending).then(
    () => (completed = true),
    () => (completed = true),
  );
  // A real browser keeps submitting paused frames while the action prepares.
  // settle also establishes the first active zero-time frame before a test
  // advances its explicit simulation clock.
  await settle(() => completed, 'The accepted host action must finish its preparation.');
  await pending;
}
