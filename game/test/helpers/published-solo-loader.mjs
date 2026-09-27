// Model only the publisher's rewritten module and the browser's module URL.
// All host actions, ownership checks and runtime validators remain real.
let publishedLoader;
export function initialize({ loader }) {
  publishedLoader = loader;
}
export async function resolve(specifier, context, nextResolve) {
  const result = await nextResolve(specifier, context);
  if (
    result.url.endsWith('/game/content-design/route-loader.mjs') &&
    context.parentURL?.includes('/game/app.mjs?')
  )
    return { ...result, url: `${result.url}?published-solo-host` };
  return result;
}
export async function load(url, context, nextLoad) {
  if (url.endsWith('/game/content-design/route-loader.mjs?published-solo-host'))
    return { format: 'module', source: publishedLoader, shortCircuit: true };
  const result = await nextLoad(url, context);
  if (url.includes('/game/app.mjs?'))
    return {
      ...result,
      source: result.source
        .toString()
        .replace(
          "downloadsURL: new URL('./downloads.html', import.meta.url)",
          "downloadsURL: new URL('./downloads.html', location.href)",
        ),
    };
  return result;
}
