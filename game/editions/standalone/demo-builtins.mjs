/** A compiled edition admits only its selected runtime provider. Default-game
 * Journey recordings are not part of that provider or its offline package. */
export async function loadBuiltinSoloDemoSources() {
  return [];
}
export function mergeBuiltinSoloDemoSources(existing) {
  return existing;
}
