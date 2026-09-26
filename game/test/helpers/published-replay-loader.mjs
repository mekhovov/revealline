let source;
export function initialize(data) {
  source = data.source;
}
export async function resolve(specifier, context, nextResolve) {
  const result = await nextResolve(specifier, context);
  return result.url.endsWith('/game/content-design/route-loader.mjs') &&
    context.parentURL?.endsWith('/game/replay-actor-context.mjs')
    ? { ...result, url: `${result.url}?published-replay` }
    : result;
}
export async function load(url, context, nextLoad) {
  return url.endsWith('/game/content-design/route-loader.mjs?published-replay')
    ? { format: 'module', source, shortCircuit: true }
    : nextLoad(url, context);
}
