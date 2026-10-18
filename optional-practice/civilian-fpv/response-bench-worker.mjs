import { boundedJSON, exactKeys, required } from '../../game/data-json.mjs';
import { runResponseComparison, suggestResponseTune } from './response-bench.mjs';

/** Exported for deterministic worker-boundary tests. The browser client creates
 * one owner per job and terminates it on completion or cancellation. */
export function createResponseBenchWorkerHandler(
  postMessage,
  { compare = runResponseComparison, suggest = suggestResponseTune } = {},
) {
  let active = null,
    used = false;
  return {
    async receive(source) {
      let id = null,
        owner = null;
      try {
        const message = boundedJSON(source, {
          maxBytes: 256 * 1024,
          maxNodes: 10000,
          maxDepth: 24,
        });
        exactKeys(message, ['id', 'type', 'request'], 'Response bench request');
        required(
          typeof message.id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(message.id),
          'Invalid response job',
        );
        id = message.id;
        required(!used, 'A response worker accepts one immutable job');
        required(['compare', 'suggest'].includes(message.type), 'Unknown response bench action');
        used = true;
        owner = new AbortController();
        active = owner;
        const result = await (message.type === 'compare' ? compare : suggest)(message.request, {
          signal: owner.signal,
          onProgress: (progress) => {
            if (active === owner && !owner.signal.aborted) postMessage({ id, progress });
          },
        });
        if (active === owner && !owner.signal.aborted) {
          active = null;
          postMessage({ id, result });
        }
      } catch (error) {
        if (active === owner) active = null;
        if (id !== null && !owner?.signal.aborted)
          postMessage({ id, error: error?.message || 'Simulation comparison failed.' });
      }
    },
    dispose() {
      active?.abort();
      active = null;
    },
  };
}
if (typeof self !== 'undefined' && typeof document === 'undefined') {
  const handler = createResponseBenchWorkerHandler((message) => self.postMessage(message));
  self.addEventListener('message', ({ data }) => {
    void handler.receive(data);
  });
}
