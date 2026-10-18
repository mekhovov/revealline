import { getLocale } from './i18n/index.mjs';
import { identifyDemoSource } from './demo-source-metadata.mjs';
import { withDemoLoadingDeadline } from './demo-loading.mjs';

/**
 * @typedef {Object} DemoPlayer
 * @property {Object} state Native, isolated simulation state.
 * @property {string} phase paused | playing | complete | error | disposed.
 * @property {Function} play
 * @property {Function} pause
 * @property {Function} advance Consumes at most 0.25 seconds at the native timestep.
 * @property {Function} forkForPractice Reconstructs the displayed checkpoint without writes.
 * @property {Function} dispose Idempotent; may return a promise.
 *
 * @typedef {Object} DemoModeAdapter
 * @property {string} modeId The registry key is the authoritative mode identity.
 * @property {Function} enumerateSources Lightweight source metadata with create({signal,payload}).
 * @property {Function} createPractice Adopts an isolated native fork.
 * @property {Function} [mountScene] Owns its renderer/assets; paint never advances gameplay.
 * @property {Function} [prepare] Legacy Solo scene preparation through the same player contract.
 * @property {Function} [presentation] Current localized title, goal, status, and control hints.
 * @property {Function} [semanticEvents] Actual native events translated into caption cues.
 * @property {Function} [attachInput] Optional native controls with fresh-input ownership.
 *
 * Sources identify mode, level/variant, exact content, and ordinary launchURL.
 * Optional loadPayload supports one bounded prefetch without constructing a player.
 * Adapters never open ordinary game writers or install missing packages.
 */

const builtins = {
  snake: () =>
    import('./demo-modes/snake.mjs').then((m) => m.createSnakeDemoAdapter({ locale: getLocale })),
  sim: () =>
    import('./demo-modes/sim.mjs').then((m) => m.createSimDemoAdapter({ locale: getLocale })),
  survival: () =>
    import('./demo-modes/survival.mjs').then((m) =>
      m.createSurvivalDemoAdapter({ locale: getLocale }),
    ),
};

/** Engine modules are loaded only when requested. Enumeration must return small
 * metadata; a source's create() owns decoding and full native verification. */
export function createDemoRegistry(adapters = {}, { metadataLoading = {} } = {}) {
  const factories = { ...builtins, ...adapters };
  const loaded = new Map();
  async function adapter(modeId, { signal } = {}) {
    signal?.throwIfAborted();
    if (!loaded.has(modeId)) {
      const factory = factories[modeId];
      if (!factory)
        throw Object.assign(new Error(`Unavailable demo mode: ${modeId}`), {
          code: 'demo-mode-unavailable',
        });
      const promise = Promise.resolve().then(() =>
        typeof factory === 'function' ? factory() : factory,
      );
      loaded.set(modeId, promise);
      promise.catch(() => loaded.delete(modeId));
    }
    try {
      const value = await loaded.get(modeId);
      signal?.throwIfAborted();
      return value;
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      throw Object.assign(new Error(`Demo engine unavailable: ${modeId}`, { cause: error }), {
        code: 'demo-mode-unavailable',
      });
    }
  }
  return {
    adapter,
    async enumerateSources({ modeId = 'solo', scope = 'current', signal } = {}) {
      const ids = scope === 'all' ? Object.keys(factories) : [modeId];
      // These calls enumerate metadata only. Each has a smaller deadline than
      // the host's 15-second enumeration budget, so a hung optional import cannot
      // discard already available modes. No recording, physics or renderer is prepared.
      const outcomes = await Promise.allSettled(
        ids.map((id) =>
          withDemoLoadingDeadline(
            async (metadataSignal) => {
              const engine = await adapter(id, { signal: metadataSignal });
              const entries = await engine.enumerateSources({ signal: metadataSignal });
              metadataSignal.throwIfAborted();
              return entries.map((source) => identifyDemoSource(source, id));
            },
            { timeoutMs: 12000, ...metadataLoading, signal },
          ),
        ),
      );
      signal?.throwIfAborted();
      if (scope !== 'all' && outcomes[0].status === 'rejected') throw outcomes[0].reason;
      // Missing packages remain session availability failures, never coverage success.
      return outcomes.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
    },
  };
}
