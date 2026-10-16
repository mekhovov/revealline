/** Functional deadline review: deterministic time and a real immutable scene inventory. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { regionalOperationDeadline } from '../../../optional-practice/civilian-fpv/regional-library.mjs';
import {
  prepareRegionalDownload,
  inspectRegionalDownload,
} from '../../../optional-practice/civilian-fpv/regional-delivery.mjs';

function clock() {
  let now = 0,
    next = 0;
  const timers = new Map();
  return {
    setTimeout(fn, ms) {
      const id = ++next;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    advance(ms) {
      const end = now + ms;
      while (true) {
        const due = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        now = due[1].at;
        timers.delete(due[0]);
        due[1].fn();
      }
      now = end;
    },
    get now() {
      return now;
    },
    get pending() {
      return timers.size;
    },
  };
}
function attempt(kind = 'install') {
  const time = clock(),
    controller = new AbortController();
  return { time, controller, deadline: regionalOperationDeadline(time, controller, kind) };
}
const cases = [];
{
  const a = attempt();
  for (let i = 1; i <= 5; i++) {
    a.time.advance(60000);
    a.deadline.progress({ phase: 'download', loadedBytes: i * 100 });
    assert.equal(a.controller.signal.aborted, false);
  }
  a.time.advance(119999);
  assert.equal(a.controller.signal.aborted, false);
  a.time.advance(1);
  assert.equal(a.controller.signal.reason.name, 'TimeoutError');
  assert.equal(a.time.pending, 0);
  cases.push('Five minutes of forward progress survive; a subsequent two-minute stall expires');
}
{
  const a = attempt();
  for (let i = 1; i <= 9; i++) {
    a.time.advance(60000);
    a.deadline.progress({ phase: 'download', loadedBytes: i });
  }
  a.time.advance(60000);
  assert.equal(a.controller.signal.reason.name, 'TimeoutError');
  assert.equal(a.time.pending, 0);
  cases.push('Continued trickle cannot exceed the ten-minute total ceiling');
}
for (const bytes of [0, -1, NaN, Infinity, 0.5]) {
  const a = attempt();
  a.time.advance(119999);
  a.deadline.progress({ phase: 'download', loadedBytes: bytes });
  a.time.advance(1);
  assert.equal(a.controller.signal.reason.name, 'TimeoutError');
}
cases.push('Repeated, decreasing and invalid byte reports do not renew inactivity');
{
  const a = attempt();
  a.deadline.progress({ phase: 'download', loadedBytes: 100 });
  a.time.advance(119999);
  a.deadline.progress({ phase: 'verify', loadedBytes: 100 });
  a.time.advance(1);
  assert.equal(a.controller.signal.reason.name, 'TimeoutError');
}
for (const kind of ['fly', 'refresh', 'review-remove', 'remove']) {
  const a = attempt(kind);
  a.time.advance(119999);
  a.deadline.progress({ phase: 'download', loadedBytes: 100 });
  a.time.advance(1);
  assert.equal(a.controller.signal.reason.name, 'TimeoutError');
}
cases.push('Other actions retain their original two-minute deadline');
for (const reason of ['commit', 'finished', 'navigation']) {
  const a = attempt();
  a.time.advance(119999);
  if (reason === 'commit') a.deadline.progress({ phase: 'commit', loadedBytes: 100 });
  else a.deadline.stop();
  a.time.advance(1000000);
  assert.equal(a.controller.signal.aborted, false);
  assert.equal(a.time.pending, 0);
}
cases.push('Atomic commit and cleanup own their outcome; no late deadline fires');
{
  const a = attempt();
  a.controller.abort(new DOMException('Player cancelled', 'AbortError'));
  a.deadline.progress({ phase: 'download', loadedBytes: 100 });
  a.deadline.stop();
  a.time.advance(1000000);
  assert.equal(a.controller.signal.reason.name, 'AbortError');
  assert.equal(a.time.pending, 0);
  cases.push('Explicit cancellation keeps its reason and clears all timers');
}
// The production downloader consumes exact committed bytes, validates both manifests
// and hashes every payload. Five virtual seconds per response exceeds the old cutoff.
const source = new URL('./urban-bando/delivery-review-r2/', import.meta.url);
const bytes = await readFile(new URL('delivery.json', source));
const descriptor = JSON.parse(bytes);
const pin = {
  url: 'https://deadline-review.invalid/delivery.json',
  bytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
};
const a = attempt();
let responses = 0;
const prepared = await prepareRegionalDownload(pin, {
  pageURL: 'https://deadline-review.invalid/sim',
  signal: a.controller.signal,
  onProgress: (value) => a.deadline.progress(value),
  fetchImpl: async (url, { signal }) => {
    const relative = new URL(url).pathname.slice(1);
    assert(descriptor.files.some((f) => f.path === relative) || relative === 'delivery.json');
    a.time.advance(5000);
    signal.throwIfAborted();
    responses++;
    return new Response(await readFile(new URL(relative, source)));
  },
});
assert(a.time.now > 120000 && a.time.now < 600000);
assert.equal(a.controller.signal.aborted, false);
assert.equal(prepared.assets.size, descriptor.files.length + 1);
assert.equal(responses, descriptor.files.length + 1);
a.deadline.progress({ phase: 'commit', loadedBytes: descriptor.totalBytes });
assert.equal(a.time.pending, 0);
cases.push(
  `Real inventory verifies all ${responses} responses after ${a.time.now / 1000} virtual seconds; no network-speed claim`,
);
// Exercise the actual UI's inspect + install sequence, including both independently
// streaming descriptors. Metadata activity must not rely on payload totals.
const metadata = attempt();
let metadataResponses = 0;
const options = {
  pageURL: 'https://deadline-review.invalid/sim',
  signal: metadata.controller.signal,
  onActivity: metadata.deadline.activity,
  onProgress: metadata.deadline.progress,
  fetchImpl: async (url, { signal }) => {
    const relative = new URL(url).pathname.slice(1);
    assert(descriptor.files.some((f) => f.path === relative) || relative === 'delivery.json');
    metadataResponses++;
    if (relative !== 'delivery.json') {
      metadata.time.advance(5000);
      signal.throwIfAborted();
      return new Response(await readFile(new URL(relative, source)));
    }
    let offset = 0;
    return new Response(
      new ReadableStream({
        pull(controller) {
          metadata.time.advance(10000);
          signal.throwIfAborted();
          const next = Math.min(bytes.length, offset + 600);
          controller.enqueue(bytes.subarray(offset, next));
          offset = next;
          if (offset === bytes.length) controller.close();
        },
      }),
    );
  },
};
await inspectRegionalDownload(pin, options);
const metadataPrepared = await prepareRegionalDownload(pin, options);
assert(metadata.time.now > 360000 && metadata.time.now < 600000);
assert.equal(metadata.controller.signal.aborted, false);
assert.equal(metadataPrepared.assets.size, descriptor.files.length + 1);
assert.equal(metadataResponses, descriptor.files.length + 2);
metadata.deadline.progress({ phase: 'commit', loadedBytes: descriptor.totalBytes });
assert.equal(metadata.time.pending, 0);
cases.push(
  `Both streaming descriptor passes and exact payloads survive ${metadata.time.now / 1000} virtual seconds`,
);

console.log(
  JSON.stringify({ format: 'FPVRegionalLibraryDeadlineReview.v1', passed: true, cases }, null, 2),
);
