/* Native dedicated Worker; only the exact pending catalogue response is replaced. */
const nativeFetch = self.fetch.bind(self);
const nativePost = self.postMessage.bind(self);
const report = (data) => nativePost({ fixtureWorker: true, ...data });
let config;
self.fetch = async (input, options = {}) => {
  const url = input instanceof Request ? input.url : String(input);
  const isIndex = url === config.indexURL;
  report({
    event: 'request',
    url,
    intercepted: isIndex,
    cache: options.cache,
    credentials: options.credentials,
    redirect: options.redirect,
  });
  if (isIndex)
    return new Response(config.indexText, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(new TextEncoder().encode(config.indexText).byteLength),
      },
    });
  const response = await nativeFetch(input, options);
  report({ event: 'native-response', url, status: response.status, responseURL: response.url });
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
  if (event.data?.type !== 'festival-fixture-config') return;
  event.stopImmediatePropagation();
  if (config) throw new Error('Festival fixture was already configured');
  config = event.data;
  const payload = new URL(config.payload, self.location.href);
  if (
    payload.origin !== self.location.origin ||
    payload.pathname !== '/optional-practice/fpv-worlds/worker.js'
  )
    throw new Error('Unexpected Festival fixture payload');
  importScripts(payload.href);
  report({ event: 'ready', nativeWorker: true, payload: payload.href });
});
