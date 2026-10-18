/** Optional game engines are separately installed outside compiled editions.
 * Metadata enumeration reports absence without downloading or starting them. */
function unavailable(modeId) {
  return {
    id: modeId,
    modeId,
    enumerateSources() {
      throw Object.assign(new Error('This demo engine is not included in the selected edition.'), {
        code: 'demo-mode-unavailable',
        modeId,
      });
    },
  };
}
export const createSimDemoAdapter = () => unavailable('sim');
export const createSurvivalDemoAdapter = () => unavailable('survival');
