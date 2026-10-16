// Real dedicated Worker executes the exact staged production installer.
// Diagnostic transport serves named immutable bytes, never production publication.
let config;
const post = self.postMessage.bind(self);
self.fetch = async (url, options) => {
  post({
    compatibilityDiagnostic: true,
    request: {
      url: String(url),
      credentials: options.credentials,
      redirect: options.redirect,
      cache: options.cache,
    },
  });
  if (url === config.indexURL) return new Response(JSON.stringify(config.index));
  if (Object.hasOwn(config.packs, String(url))) return new Response(config.packs[String(url)]);
  throw Error('Unexpected diagnostic transport target');
};
self.addEventListener('message', (event) => {
  if (!event.data?.compatibilityConfig) return;
  event.stopImmediatePropagation();
  if (config) throw Error('Worker configured twice');
  config = event.data.compatibilityConfig;
  const payload = new URL(config.payload);
  if (payload.origin !== location.origin) throw Error('Local production payload required');
  importScripts(payload.href);
  post({ compatibilityDiagnostic: true, ready: true, payload: payload.href });
});
