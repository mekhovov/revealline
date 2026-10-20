import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';
import {
  OBSERVED_PACKAGES,
  activateOfflineAction,
  boundedOperation,
} from './optional-installation-observer-helpers.mjs';

export const VERIFICATION_CANCEL_IDS = Object.freeze([
  'civilian-flight',
  'civilian-fpv',
  'fpv-worlds',
]);
export function selectFinalVerificationCancel(value, options) {
  if (value === undefined) return false;
  assert.equal(value, 'all');
  assert.equal(
    options.worldSeed,
    true,
    'Final verification cancellation requires populated World data.',
  );
  for (const key of [
    'download',
    'quota',
    'quotaPackages',
    'migration',
    'activeSession',
    'activeWindow',
    'importedWorld',
  ])
    assert.equal(options[key], undefined, `Run final verification separately from ${key}.`);
  return true;
}
export function validateVerificationTarget(expected) {
  assert.deepEqual(Object.keys(expected).sort(), ['id', 'revision', 'scope', 'scriptURL']);
  assert(VERIFICATION_CANCEL_IDS.includes(expected.id));
  const url = new URL(expected.scope);
  assert(
    url.protocol === 'http:' &&
      url.hostname === '127.0.0.1' &&
      url.port &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash,
  );
  assert.equal(
    url.pathname,
    `/revealline/practice/${expected.id}/releases/v0.0.1/site/optional-practice/${expected.id}/`,
  );
  assert.equal(expected.scope, url.href);
  assert.equal(expected.scriptURL, new URL('worker.js', url).href);
  assert.match(expected.revision, /^[a-f0-9]{64}$/);
}
export function assertVerificationOwnership(state, baseline, expected, completeTarget = false) {
  validateVerificationTarget(expected);
  const cacheName = `revealline.optional.${expected.id === 'civilian-flight' ? 'civilian-flight' : 'package'}.v1:${new URL(expected.scope).pathname}:${expected.revision}`;
  assert.deepEqual(
    state.keys,
    baseline.keys,
    'Verification cancellation/removal cannot adopt or change pointers.',
  );
  assert.deepEqual(
    state.caches,
    [...baseline.caches, ...(completeTarget ? [cacheName] : [])].sort(),
  );
  assert.deepEqual(
    state.workers,
    [
      ...baseline.workers,
      ...(completeTarget ? [{ scope: expected.scope, active: 'activated' }] : []),
    ].sort((a, b) => a.scope.localeCompare(b.scope)),
  );
}

/** Serialized page-only scheduling probe. Never edits app/worker bytes or any
 * Fetch/Cache/Crypto API. The original native reply is forwarded unchanged. */
export function installFinalVerificationGate({ expected, owner }) {
  if (typeof owner !== 'string' || !/^[a-f0-9]{32}$/.test(owner))
    throw new Error('Invalid gate owner.');
  if (globalThis.__practiceVerificationReplyGate)
    throw new Error('Verification gate already owned.');
  const scope = new URL(expected.scope);
  if (
    scope.origin !== globalThis.location.origin ||
    globalThis.location.pathname !== scope.pathname + 'index.html'
  )
    throw new Error('Verification gate requires the exact owned app document.');
  const prototype = globalThis.ServiceWorker.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'postMessage');
  if (!descriptor || typeof descriptor.value !== 'function' || !descriptor.configurable)
    throw new Error('Cannot own native worker messaging descriptor.');
  const original = descriptor.value,
    NativeChannel = globalThis.MessageChannel;
  const started = performance.now();
  const matchDeadline = started + 30000;
  const state = {
    format: 'FinalVerificationReplyGate.v1',
    matched: 0,
    targetRequests: 0,
    clicks: 0,
    reply: null,
    held: false,
    forwarded: false,
    closed: false,
    expired: false,
    events: [],
    cleanupErrors: [],
  };
  let timer,
    relay,
    originalPort,
    originalReply,
    holdDeadline,
    restored = false;
  const record = (kind, detail = {}) => {
    if (state.events.length < 32)
      state.events.push({ kind, elapsedMs: performance.now() - started, ...detail });
  };
  const markExpired = () => {
    if (!state.closed && !state.expired && performance.now() >= (holdDeadline ?? matchDeadline)) {
      state.expired = true;
      record('safety-expired');
    }
    return state.expired;
  };
  const checkDeadline = () => {
    if (state.closed) return false;
    if (markExpired()) {
      close('safety-expired');
      return false;
    }
    return true;
  };
  const phase = () => {
    const panel = globalThis.document.querySelector('[data-optional-offline-progress]');
    const status = panel?.querySelector('[role="status"]');
    const button = panel?.querySelector('button');
    const visible = (node) => {
      if (!node) return false;
      const box = node.getBoundingClientRect(),
        css = globalThis.getComputedStyle(node);
      return (
        box.width > 0 && box.height > 0 && css.display !== 'none' && css.visibility !== 'hidden'
      );
    };
    return visible(panel) &&
      visible(status) &&
      visible(button) &&
      !button.disabled &&
      button.textContent.trim() === 'Cancel download' &&
      /^Verifying\s*·\s*100%$/.test(status.textContent.trim())
      ? button
      : null;
  };
  const restore = () => {
    if (restored) return;
    restored = true;
    const current = Object.getOwnPropertyDescriptor(prototype, 'postMessage');
    if (
      current?.value === wrapper &&
      current.configurable === descriptor.configurable &&
      current.enumerable === descriptor.enumerable &&
      current.writable === descriptor.writable
    ) {
      try {
        Object.defineProperty(prototype, 'postMessage', descriptor);
      } catch {
        state.cleanupErrors.push('Worker messaging descriptor restoration failed.');
      }
    } else state.cleanupErrors.push('Worker messaging descriptor ownership changed.');
  };
  const close = (reason = 'observer-cleanup') => {
    if (state.closed) return rawSnapshot();
    markExpired();
    state.closed = true;
    clearTimeout(timer);
    restore();
    globalThis.document.removeEventListener('click', click, true);
    globalThis.removeEventListener('pagehide', hidden);
    if (state.reply) {
      try {
        originalPort.postMessage(originalReply);
        state.forwarded = true;
        record('original-reply-forwarded');
      } catch {
        state.cleanupErrors.push('Original reply forwarding failed.');
      }
    }
    if (relay) {
      relay.port1.onmessage = null;
      relay.port1.onmessageerror = null;
      for (const port of [relay.port1, relay.port2, originalPort]) {
        try {
          port.close();
        } catch {
          state.cleanupErrors.push('Owned reply port cleanup failed.');
        }
      }
    }
    state.held = false;
    record('closed', { reason });
    return rawSnapshot();
  };
  const rawSnapshot = () => JSON.parse(JSON.stringify(state));
  const snapshot = () => {
    checkDeadline();
    return rawSnapshot();
  };
  const expire = () => {
    if (state.closed) return;
    state.expired = true;
    record('safety-expired');
    close('safety-expired');
  };
  const hidden = () => {
    state.cleanupErrors.push('Document hidden before gate disposal.');
    close('pagehide');
  };
  const click = (event) => {
    if (
      checkDeadline() &&
      state.held &&
      event.isTrusted &&
      event.target === phase() &&
      checkDeadline()
    ) {
      state.clicks++;
      record('ordinary-cancel-click', { verifyingVisible: true });
    }
  };
  function wrapper(...args) {
    const [data, ports] = args;
    checkDeadline();
    if (!state.closed && this.scriptURL === expected.scriptURL && data?.type === 'practice-status')
      state.targetRequests++;
    const eligible =
      !state.closed &&
      state.matched === 0 &&
      this.scriptURL === expected.scriptURL &&
      this.state === 'activated' &&
      args.length === 2 &&
      data?.type === 'practice-status' &&
      Object.keys(data).length === 1 &&
      Array.isArray(ports) &&
      ports.length === 1 &&
      phase();
    if (!eligible || !checkDeadline()) return Reflect.apply(original, this, args);
    state.matched++;
    holdDeadline = performance.now() + 10000;
    record('final-verification-request');
    clearTimeout(timer);
    timer = setTimeout(expire, 10000);
    originalPort = ports[0];
    relay = new NativeChannel();
    relay.port1.onmessage = ({ data: reply }) => {
      if (!checkDeadline()) return;
      originalReply = reply;
      state.reply = {
        type: reply?.type === 'practice-status' ? reply.type : null,
        scope: typeof reply?.scope === 'string' && reply.scope.length <= 2048 ? reply.scope : null,
        revision:
          typeof reply?.revision === 'string' && /^[a-f0-9]{64}$/.test(reply.revision)
            ? reply.revision
            : null,
        ready: typeof reply?.ready === 'boolean' ? reply.ready : null,
        status: ['ready', 'unknown', 'unavailable'].includes(reply?.status) ? reply.status : null,
      };
      const valid =
        reply?.type === 'practice-status' &&
        reply.scope === expected.scope &&
        reply.revision === expected.revision &&
        reply.ready === true &&
        reply.status === 'ready';
      if (!valid) {
        state.cleanupErrors.push('Original verification reply did not match admitted ready owner.');
        close('invalid-reply');
        return;
      }
      state.held = true;
      record('native-ready-reply-held');
    };
    relay.port1.onmessageerror = () => {
      state.cleanupErrors.push('Native reply messageerror.');
      close('messageerror');
    };
    try {
      return Reflect.apply(original, this, [data, [relay.port2]]);
    } catch (error) {
      state.cleanupErrors.push('Native status request failed.');
      close('post-error');
      throw error;
    }
  }
  Object.defineProperty(prototype, 'postMessage', { ...descriptor, value: wrapper });
  globalThis.document.addEventListener('click', click, true);
  globalThis.addEventListener('pagehide', hidden);
  timer = setTimeout(expire, 30000);
  record('armed');
  globalThis.__practiceVerificationReplyGate = { owner, snapshot, close };
}

export function assertFinalVerificationCancellation(receipt) {
  const gate = receipt.gate;
  assert.equal(gate.matched, 1);
  assert.equal(gate.clicks, 1);
  assert.equal(gate.targetRequests, 1);
  assert.equal(gate.expired, false);
  assert.equal(gate.closed, true);
  assert.equal(gate.forwarded, true);
  assert.deepEqual(gate.cleanupErrors, []);
  assert(!receipt.cleanupUnavailable);
  assert.equal(receipt.operationSettled, true);
  assert.equal(receipt.gateInstalled, true);
  assert.equal(receipt.cancelAction, 'one ordinary pointer click on visible Cancel download');
  assert(/^Verifying\s*·\s*100%$/.test(receipt.visibleStatus));
  assert(/cancelled|canceled/i.test(receipt.status));
  assert(!/timed out|stalled|five minutes/i.test(receipt.status));
  assert(receipt.cancelLatencyMs >= 0 && receipt.cancelLatencyMs < 5000);
  const kinds = gate.events.map((row) => row.kind);
  assert(kinds.indexOf('native-ready-reply-held') > kinds.indexOf('final-verification-request'));
  assert(kinds.indexOf('ordinary-cancel-click') > kinds.indexOf('native-ready-reply-held'));
  assert(kinds.indexOf('original-reply-forwarded') > kinds.indexOf('ordinary-cancel-click'));
  assert(
    gate.events.every(
      (row, index) =>
        Number.isFinite(row.elapsedMs) &&
        row.elapsedMs >= 0 &&
        (index === 0 || row.elapsedMs >= gate.events[index - 1].elapsedMs),
    ),
    'Require monotonic bounded event evidence.',
  );
  const event = (kind) => {
    const matches = gate.events.filter((row) => row.kind === kind);
    assert.equal(matches.length, 1, `Require exactly one ${kind}.`);
    return matches[0].elapsedMs;
  };
  const requestAt = event('final-verification-request');
  assert(requestAt <= 30000, 'Request must occur within the match deadline.');
  const readyAt = event('native-ready-reply-held'),
    clickAt = event('ordinary-cancel-click'),
    flushAt = event('original-reply-forwarded');
  assert(readyAt >= requestAt && clickAt >= readyAt && flushAt >= clickAt);
  assert(
    clickAt - requestAt < 10000 && flushAt - requestAt < 10000,
    'Cancel and original-reply forwarding must occur before the real hold deadline.',
  );
  assert(receipt.screenshot && /^[a-f0-9]{64}$/.test(receipt.screenshot.sha256));
  return true;
}

export async function observeFinalVerificationCancel({
  page,
  expectedWorker,
  receipt,
  capture,
  requireActive = () => {},
}) {
  validateVerificationTarget(expectedWorker);
  assert(typeof capture === 'function');
  const adapter = OBSERVED_PACKAGES[expectedWorker.id];
  receipt.passed = false;
  const owner = randomUUID().replaceAll('-', '');
  receipt.gateOwner = owner;
  let operation,
    operationError,
    operationSettled = false,
    gateInstalled = false;
  const read = () =>
    page.evaluate((owner) => {
      const gate = globalThis.__practiceVerificationReplyGate;
      return gate?.owner === owner ? gate.snapshot() : null;
    }, owner);
  try {
    requireActive();
    await boundedOperation('Install final-verification reply probe', () =>
      page.evaluate(installFinalVerificationGate, { expected: expectedWorker, owner }),
    );
    gateInstalled = true;
    requireActive();
    operation = activateOfflineAction(page, {
      button: adapter.prepare,
      status: adapter.status,
      expected: /cancelled|canceled/i,
    });
    void operation.then(
      () => {
        operationSettled = true;
      },
      (error) => {
        operationSettled = true;
        operationError = error;
      },
    );
    const deadline = Date.now() + 30000;
    for (;;) {
      requireActive();
      if (operationError) throw operationError;
      const state = await boundedOperation('Read verification probe', read, 2000);
      assert(
        state && !state.closed && !state.expired && !state.cleanupErrors.length,
        'Verification probe ended before native cancellation.',
      );
      if (state.held) break;
      assert(Date.now() < deadline, 'No final verification reply was observed.');
      await pause(25);
    }
    const panel = page.locator('[data-optional-offline-progress]'),
      status = panel.locator('[role="status"]');
    await panel.waitFor({ state: 'visible', timeout: 2000 });
    receipt.visibleStatus = (await status.innerText()).trim();
    assert(/^Verifying\s*·\s*100%$/.test(receipt.visibleStatus));
    receipt.screenshot = await boundedOperation(
      'Capture actual final verification UI',
      capture,
      2000,
    );
    requireActive();
    assert.equal((await status.innerText()).trim(), receipt.visibleStatus);
    const cancel = panel.getByRole('button', { name: 'Cancel download', exact: true });
    assert(await cancel.isVisible());
    assert(await cancel.isEnabled());
    const beforeClick = await boundedOperation(
      'Recheck held native verification reply',
      read,
      2000,
    );
    assert(beforeClick.held && !beforeClick.closed && !beforeClick.expired);
    const clickedAt = performance.now();
    requireActive();
    await cancel.click({ timeout: 2000 });
    receipt.cancelAction = 'one ordinary pointer click on visible Cancel download';
    await boundedOperation('Native verification cancellation', () => operation, 5000);
    receipt.cancelLatencyMs = performance.now() - clickedAt;
    receipt.status = await page.locator(adapter.status).textContent();
  } finally {
    // Attempt cleanup even if injection timed out: it may have completed late.
    try {
      receipt.gate = await boundedOperation(
        'Restore verification reply probe',
        () =>
          page.evaluate((owner) => {
            const gate = globalThis.__practiceVerificationReplyGate;
            if (!gate || gate.owner !== owner) return null;
            const result = gate.close();
            delete globalThis.__practiceVerificationReplyGate;
            return result;
          }, owner),
        2000,
      );
    } catch {
      receipt.cleanupUnavailable = true;
    }
    if (operation) await Promise.race([operation.catch(() => {}), pause(1000)]);
    receipt.operationSettled = operationSettled;
    receipt.gateInstalled = gateInstalled;
    if (!gateInstalled || receipt.cleanupUnavailable) receipt.passed = false;
  }
  assertFinalVerificationCancellation(receipt);
  receipt.passed = true;
}
