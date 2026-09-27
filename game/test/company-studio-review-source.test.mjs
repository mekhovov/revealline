import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readStudioJSON,
  STUDIO_SOURCE_BYTES,
} from '../../authoring/company-studio/source-reader.mjs';

test('bounded source reads retain immutable JSON whitespace and UTF-8 bytes', async () => {
  const original = '  { "greeting": "Слава Україні", "revision": 2 }\n\n';
  const fetcher = async () => new Response(original);
  assert.equal(
    await readStudioJSON('http://localhost/source.json', { fetcher, originalText: true }),
    original,
  );
  assert.deepEqual(
    await readStudioJSON('http://localhost/source.json', { fetcher }),
    JSON.parse(original),
  );
});

test('oversized declared and undeclared source streams are cancelled before decoding', async () => {
  for (const declared of [false, true]) {
    let cancelled = false;
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(STUDIO_SOURCE_BYTES + 1));
        },
        cancel() {
          cancelled = true;
        },
      }),
      { headers: declared ? { 'content-length': String(STUDIO_SOURCE_BYTES + 1) } : {} },
    );
    await assert.rejects(
      readStudioJSON('http://localhost/source.json', { fetcher: async () => response }),
      /4 MiB/,
    );
    assert.equal(cancelled, true);
  }
});

test('cancellation ends a stalled source-body read and rejects late text', async () => {
  let cancelled = false,
    started;
  const entered = new Promise((resolve) => {
    started = resolve;
  });
  const response = new Response(
    new ReadableStream({
      pull() {
        started();
      },
      cancel() {
        cancelled = true;
      },
    }),
  );
  const controller = new AbortController();
  const operation = readStudioJSON('http://localhost/source.json', {
    fetcher: async () => response,
    signal: controller.signal,
  });
  await entered;
  controller.abort();
  await assert.rejects(operation, (error) => error.name === 'AbortError');
  assert.equal(cancelled, true);
});

test('budget and abort failures settle even when transport cancellation never resolves', async () => {
  for (const mode of ['declared', 'streamed', 'abort']) {
    let cancelled = false,
      entered;
    const started = new Promise((resolve) => {
      entered = resolve;
    });
    const response = new Response(
      new ReadableStream({
        start(controller) {
          if (mode === 'streamed') controller.enqueue(new Uint8Array(STUDIO_SOURCE_BYTES + 1));
        },
        pull() {
          entered();
        },
        cancel() {
          cancelled = true;
          return new Promise(() => {});
        },
      }),
      { headers: mode === 'declared' ? { 'content-length': String(STUDIO_SOURCE_BYTES + 1) } : {} },
    );
    const controller = new AbortController();
    const operation = readStudioJSON('http://localhost/source.json', {
      fetcher: async () => response,
      signal: controller.signal,
    });
    if (mode === 'abort') {
      await started;
      controller.abort();
    }
    let timer;
    try {
      await assert.rejects(
        Promise.race([
          operation,
          new Promise((_resolve, reject) => {
            timer = setTimeout(
              () => reject(new Error('Source failure did not settle promptly.')),
              1000,
            );
          }),
        ]),
        mode === 'abort' ? (error) => error.name === 'AbortError' : /4 MiB/,
      );
    } finally {
      clearTimeout(timer);
    }
    assert.equal(cancelled, true);
    assert.equal(response.body.locked, false);
  }
});

test('invalid UTF-8 and absent streaming responses cannot become source data', async () => {
  await assert.rejects(
    readStudioJSON('http://localhost/source.json', {
      fetcher: async () => new Response(new Uint8Array([0xff])),
    }),
    /encoded data/i,
  );
  await assert.rejects(
    readStudioJSON('http://localhost/source.json', {
      fetcher: async () => ({ ok: true, text: async () => '{}' }),
    }),
    /streaming/,
  );
});
