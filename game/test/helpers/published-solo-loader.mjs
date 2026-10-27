// Model only the publisher's rewritten module and the browser's module URL.
// All host actions, ownership checks and runtime validators remain real.
let publishedLoader, legacyLoader, observation;
export function initialize({ loader, legacy, state }) {
  publishedLoader = loader;
  legacyLoader = legacy;
  observation = state ? new Int32Array(state) : null;
}
export async function resolve(specifier, context, nextResolve) {
  const appImport = context.parentURL?.includes('/game/app.mjs?');
  if (appImport && specifier.endsWith('/mission-library/multiplayer-expeditions.mjs')) {
    Atomics.add(observation, 1, 1);
    if (Atomics.load(observation, 0) === 0)
      throw new Error('Complete published navigation must not import native expedition compilers.');
  }
  const result = await nextResolve(specifier, context);
  if (result.url.endsWith('/game/content-design/route-loader.mjs') && appImport)
    return {
      ...result,
      url: `${result.url}?published-solo-host=${Atomics.load(observation, 0) === 1 ? 'legacy' : 'complete'}`,
    };
  return result;
}
export async function load(url, context, nextLoad) {
  if (url.includes('/game/content-design/route-loader.mjs?published-solo-host='))
    return {
      format: 'module',
      source:
        new URL(url).searchParams.get('published-solo-host') === 'legacy'
          ? legacyLoader
          : publishedLoader,
      shortCircuit: true,
    };
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
