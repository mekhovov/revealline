/** Preserve live localization getters while adding trusted mode identity. */
export function identifyDemoSource(source, modeId) {
  return Object.defineProperties(
    {},
    {
      ...Object.getOwnPropertyDescriptors(source),
      modeId: { value: modeId, enumerable: true, configurable: true },
    },
  );
}
