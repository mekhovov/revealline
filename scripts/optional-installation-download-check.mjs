/** Native C6 checks; all faults are confined to an owned local server. */
import assert from 'node:assert/strict';
import { setTimeout as pause } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';
import { attachPracticeDownloadFault } from './practice-download-fault.mjs';
import { activateOfflineAction } from './optional-installation-observer-helpers.mjs';

export function selectInstallationDownloadFaults(value) {
  if (value === undefined) return false;
  assert(
    ['all-short', 'overall-civilian-flight', 'overall-civilian-fpv', 'overall-fpv-worlds'].includes(
      value,
    ),
    'Use all-short or one explicitly named overall package.',
  );
  return true;
}

export function installationDownloadFaultMatrix(value) {
  if (!selectInstallationDownloadFaults(value)) return null;
  return Object.freeze({
    selection: value,
    ids: Object.freeze(
      value === 'all-short'
        ? ['civilian-flight', 'civilian-fpv', 'fpv-worlds']
        : [value.slice('overall-'.length)],
    ),
    modes: Object.freeze(value === 'all-short' ? ['idle', 'cancel-hold'] : ['overall-trickle']),
    minimumRemainingMs: value === 'all-short' ? 0 : 390000,
  });
}

export function requireInstallationDownloadFaultBudget(matrix, remainingMs) {
  assert(matrix && Number.isFinite(remainingMs));
  assert(
    remainingMs >= matrix.minimumRemainingMs,
    'Insufficient existing observation time before fault.',
  );
}

export function assertDownloadFaultTiming(receipt, statusSelector) {
  if (receipt.mode === 'idle') {
    assert(
      receipt.heldMs >= 28500 && receipt.heldMs < 40000,
      'Require the real approximately 30-second inactivity limit, not the server safety limit.',
    );
    assert(!/cancelled|canceled/i.test(receipt.status), 'Idle failure cannot be a cancellation.');
  } else if (receipt.mode === 'overall-trickle') {
    const fault = receipt.fault;
    assert(
      receipt.heldMs >= 295000 && receipt.heldMs <= 315000,
      'Require the real approximately five-minute client limit.',
    );
    assert(!/cancelled|canceled/i.test(receipt.status) && !receipt.cancelAction);
    assert(
      /failed|timed out|exceeded five minutes/i.test(receipt.status),
      'Require failure feedback.',
    );
    assert(['client-disconnect', 'request-aborted'].includes(fault?.outcome));
    assert.equal(fault.delegatedTargetRequests, 0);
    const writes = fault.events.filter((event) => event.kind === 'body-byte-written');
    const ended = fault.events.find((event) => event.kind === 'ended');
    assert(
      writes.length >= 55 &&
        writes.length === fault.bytesSent &&
        fault.bytesSent < fault.dependency.bytes,
    );
    assert(ended && ended.elapsedMs - writes[0].elapsedMs === receipt.heldMs);
    for (let index = 0; index < writes.length; index++) {
      assert.equal(writes[index].offset, index);
      assert.equal(writes[index].bytesSent, index + 1);
      const gap = (writes[index + 1] ?? ended).elapsedMs - writes[index].elapsedMs;
      assert(gap >= 0 && gap < 30000, 'Continuing writes must not cross the inactivity boundary.');
    }
  } else {
    assert.equal(receipt.mode, 'cancel-hold');
    assert(
      Number.isFinite(receipt.cancelAfterPrefixMs) &&
        receipt.cancelAfterPrefixMs >= 0 &&
        receipt.cancelAfterPrefixMs < 20000,
      'Cancel must start well before the inactivity deadline.',
    );
    assert(
      Number.isFinite(receipt.cancelLatencyMs) &&
        receipt.cancelLatencyMs >= 0 &&
        receipt.cancelLatencyMs < 5000,
      'A no-op Cancel followed by the inactivity timeout cannot pass.',
    );
    assert(
      /cancelled|canceled/i.test(receipt.status) ||
        (statusSelector === '#package-status' &&
          /^Offline preparation failed\. Online practice remains available\.$/.test(
            receipt.status,
          )),
      'Require explicit cancellation feedback or the exact legacy Gym generic copy with prompt native abort.',
    );
  }
  return true;
}

export async function readPreparedCacheFingerprints(page, inventories) {
  assert(Array.isArray(inventories) && inventories.length > 0 && inventories.length <= 16);
  let total = 0;
  const names = new Set();
  for (const inventory of inventories) {
    assert(/^revealline\.optional\./.test(inventory.name) && inventory.name.length <= 1024);
    assert(!names.has(inventory.name));
    names.add(inventory.name);
    assert(
      Array.isArray(inventory.files) && inventory.files.length > 0 && inventory.files.length <= 512,
    );
    const urls = new Set();
    for (const file of inventory.files) {
      const url = new URL(file.url);
      assert(
        ['http:', 'https:'].includes(url.protocol) &&
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash &&
          file.url.length <= 2048 &&
          !urls.has(file.url),
      );
      urls.add(file.url);
      assert(Number.isSafeInteger(file.bytes) && file.bytes >= 0 && file.bytes <= 64 * 1024 * 1024);
      assert.match(file.sha256, /^[a-f0-9]{64}$/);
      total += file.bytes;
      assert(total <= 256 * 1024 * 1024, 'Cache observation exceeds bound.');
    }
  }
  return page.evaluate(async (inventories) => {
    const result = [];
    const existing = await globalThis.caches.keys();
    for (const { name, files: expected } of inventories) {
      if (!existing.includes(name)) throw new Error('Prepared cache disappeared.');
      const files = [];
      for (const pin of expected) {
        // CacheStorage.match never creates a cache if eviction races the read.
        const response = await globalThis.caches.match(pin.url, { cacheName: name });
        const reader = response?.body?.getReader();
        if (!reader) throw new Error('Prepared response disappeared.');
        const bytes = new Uint8Array(pin.bytes);
        let length = 0;
        try {
          for (;;) {
            const chunk = await reader.read();
            if (chunk.done) break;
            if (length + chunk.value.byteLength > pin.bytes)
              throw new Error('Prepared response exceeds its admitted bound.');
            bytes.set(chunk.value, length);
            length += chunk.value.byteLength;
          }
        } finally {
          await reader.cancel().catch(() => {});
        }
        if (length !== pin.bytes) throw new Error('Prepared response size changed.');
        const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
        const sha256 = [...new Uint8Array(digest)]
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        if (sha256 !== pin.sha256) throw new Error('Prepared response hash changed.');
        files.push({
          url: pin.url,
          bytes: bytes.byteLength,
          sha256,
        });
      }
      files.sort((a, b) => a.url.localeCompare(b.url));
      result.push({ name, files });
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, inventories);
}

export async function observeInstallationDownloadFault({
  page,
  server,
  origin,
  dependency,
  body,
  mode,
  prepare,
  status,
  receipt,
}) {
  assert(
    ['idle', 'cancel-hold', 'overall-trickle'].includes(mode),
    'Unknown fixed fault procedure.',
  );
  assert(receipt && typeof receipt === 'object');
  receipt.passed = false;
  const fault = attachPracticeDownloadFault({ server, origin, dependency, body, mode });
  const attachedAt = performance.now();
  let operation, operationError, cancelAt;
  try {
    fault.arm();
    operation = activateOfflineAction(page, {
      button: prepare,
      status,
      expected:
        /failed|timed out|stalled|exceeded five minutes|cancelled|canceled|not available|not supported/i,
    });
    // Join immediately; a UI failure must never become an unhandled rejection.
    void operation.catch((error) => {
      operationError = error;
    });
    const end = Date.now() + 15000;
    while (!fault.snapshot().matched) {
      if (operationError) throw operationError;
      assert(Date.now() < end, 'Pinned dependency request was not observed.');
      await pause(25);
    }
    const panel = page.locator('[data-optional-offline-progress]');
    await panel.waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForFunction(
      () =>
        /^Downloading\s*·/.test(
          globalThis.document.querySelector('[data-optional-offline-progress] [role="status"]')
            ?.textContent ?? '',
        ),
      null,
      { timeout: 10000 },
    );
    receipt.visibleProgress = await panel.innerText();
    if (mode === 'cancel-hold') {
      const cancel = panel.getByRole('button', { name: 'Cancel download', exact: true });
      await cancel.waitFor({ state: 'visible' });
      assert(await cancel.isEnabled());
      const first = fault.snapshot().events.find((event) => event.kind === 'body-byte-written');
      assert(first, 'Require the held response before cancellation.');
      receipt.cancelAfterPrefixMs = performance.now() - attachedAt - first.elapsedMs;
      assert(
        receipt.cancelAfterPrefixMs < 20000,
        'Cancel must start well before the inactivity deadline.',
      );
      cancelAt = performance.now();
      await cancel.click({ timeout: 5000 });
      receipt.cancelAction = 'one ordinary pointer click on visible Cancel download';
    }
    await operation;
    await panel.waitFor({ state: 'hidden', timeout: 10000 });
    receipt.status = await page.locator(status).textContent();
    const endAbort = Date.now() + 5000;
    while (!fault.snapshot().outcome) {
      assert(Date.now() < endAbort, 'Held dependency was not aborted by the app.');
      await pause(25);
    }
    const observed = fault.snapshot();
    assert(
      ['client-disconnect', 'request-aborted'].includes(observed.outcome),
      `Fault ended at the server rather than the app: ${observed.outcome}`,
    );
    if (mode !== 'overall-trickle') assert.equal(observed.bytesSent, 1);
    assert.equal(observed.delegatedTargetRequests, 0, 'No silent request retry is permitted.');
    const first = observed.events.find((event) => event.kind === 'body-byte-written'),
      last = observed.events.find((event) => event.kind === 'ended');
    assert(first && last);
    receipt.heldMs = last.elapsedMs - first.elapsedMs;
    receipt.mode = mode;
    receipt.fault = observed;
    if (mode === 'cancel-hold') {
      receipt.cancelLatencyMs = performance.now() - cancelAt;
      receipt.cancelFeedback = /cancelled|canceled/i.test(receipt.status)
        ? 'explicit cancelled status'
        : 'Gym legacy generic failure; prompt native request abort required';
    }
    assertDownloadFaultTiming(receipt, status);
    receipt.passed = true;
  } finally {
    receipt.fault = fault.close();
    // Destroy the owned response independently of any UI/browser cleanup.
    if (operation) await Promise.race([operation.catch(() => {}), pause(1000)]);
    if (receipt.fault.cleanupErrors.length || receipt.fault.activeTimers) receipt.passed = false;
  }
}
