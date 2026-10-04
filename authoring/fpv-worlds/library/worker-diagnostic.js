/* Manual fixture only. The real native Worker loads the frozen generated installer.
 * Only named fetch faults and observations are added; no private host/clock writes. */
const nativeFetch = self.fetch.bind(self),
  nativePost = self.postMessage.bind(self),
  nativeCancel = ReadableStreamDefaultReader.prototype.cancel;
let config, held, entry;
const report = (value) => nativePost({ fixtureWorker: true, ...value });
ReadableStreamDefaultReader.prototype.cancel = function (...args) {
  report({ event: 'reader-cancel' });
  return nativeCancel.apply(this, args);
};
self.fetch = async (input, options = {}) => {
  const url = String(input),
    isIndex = url === config.indexURL;
  entry = {
    url,
    kind: isIndex ? 'index' : 'pack',
    mode: config.mode,
    cache: options.cache,
    credentials: options.credentials,
    redirect: options.redirect,
    aborted: false,
  };
  report({ event: 'request', entry });
  options.signal.addEventListener('abort', () => report({ event: 'abort' }), { once: true });
  const rejectedBody = () =>
    new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1]));
      },
      cancel() {
        report({ event: 'body-cancel' });
      },
    });
  if (config.mode === 'http') return new Response(rejectedBody(), { status: 503 });
  if (config.mode === 'reject') throw new TypeError('Fixture network unavailable');
  if (config.mode === 'hold') {
    const bytes = isIndex ? new TextEncoder().encode(JSON.stringify(config.index)) : config.pack;
    return new Response(
      new ReadableStream({
        start(controller) {
          const first = Math.min(64, bytes.length);
          controller.enqueue(bytes.subarray(0, first));
          held = () => {
            controller.enqueue(bytes.subarray(first));
            controller.close();
            held = null;
            report({ event: 'released' });
          };
          report({ event: 'held' });
          options.signal.addEventListener(
            'abort',
            () => {
              controller.error(new DOMException('Cancelled', 'AbortError'));
              held = null;
            },
            { once: true },
          );
        },
      }),
    );
  }
  if (isIndex)
    return new Response(
      typeof config.index === 'string' ? config.index : JSON.stringify(config.index),
    );
  if (config.mode === 'oversize-header')
    return new Response(rejectedBody(), {
      headers: { 'content-length': String(config.pack.length + 1) },
    });
  if (config.mode === 'short') return new Response(config.pack.subarray(0, config.pack.length - 1));
  if (config.mode === 'long') return new Response(new Uint8Array(config.pack.length + 1));
  if (config.mode === 'corrupt') {
    const bytes = config.pack.slice();
    bytes[bytes.length - 1] ^= 1;
    return new Response(bytes);
  }
  if (config.mode === 'invalid-pack') return new Response(config.invalid);
  if (config.mode === 'prepared-pack') return new Response(config.pack);
  const response = await nativeFetch(input, options);
  report({ event: 'native-response', status: response.status, responseURL: response.url });
  return response;
};
self.postMessage = (data, transfer) => {
  if (data?.type === 'world-done')
    report({
      event: 'transfer',
      byteLength: data.bytes.byteLength,
      exactBuffer: transfer?.length === 1 && transfer[0] === data.bytes.buffer,
    });
  return nativePost(data, transfer);
};
self.addEventListener('message', (event) => {
  if (event.data?.type === 'fixture-release') {
    event.stopImmediatePropagation();
    held?.();
    return;
  }
  if (event.data?.type !== 'fixture-config') return;
  event.stopImmediatePropagation();
  if (config) throw new Error('Fixture worker already configured');
  config = event.data.config;
  const payload = new URL(config.payload, self.location.href);
  if (payload.origin !== self.location.origin) throw new Error('Fixture payload must be local');
  importScripts(payload.href);
  report({ event: 'ready', nativeWorker: true, payload: payload.href });
});
