/** Offline exact-tick diagnostics reuse native engines without loading a renderer. */
const loaders = Object.freeze({
  solo: () => import('./demo-tick-adapters/solo.mjs'),
  snake: () => import('./demo-tick-adapters/snake.mjs'),
  sim: () => import('./demo-tick-adapters/sim.mjs'),
  survival: () => import('./demo-tick-adapters/survival.mjs'),
});

export async function createDemoTickAdapter({ modeId, ...options } = {}) {
  if (!Object.hasOwn(loaders, modeId)) throw new TypeError('Unknown demo diagnostic mode.');
  const { createAdapter } = await loaders[modeId]();
  return createAdapter(options);
}
