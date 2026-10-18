// Gate only the real Solo owner's optional import. Production module bytes and
// cache identity are unchanged; every unrelated resolution uses Node's loader.
let port;
let gate = null;
const panelURL = new URL('../../ui/optional-chapters-panel.mjs', import.meta.url).href;
const appURL = new URL('../../app.mjs', import.meta.url).href;
export function initialize({ channel }) {
  port = channel;
  port.on('message', ({ action, id, fail = false }) => {
    if (action === 'hold') {
      if (gate) throw new Error('The prior Worlds import gate must be released.');
      gate = { id, requests: [] };
    } else if (action === 'release' && gate?.id === id) {
      const previous = gate;
      gate = null;
      for (const { resolve, reject } of previous.requests)
        fail ? reject(new Error('Modeled optional module transport failure.')) : resolve();
      port.postMessage({ type: 'released', id, count: previous.requests.length });
    } else if (action === 'dispose') {
      for (const request of gate?.requests ?? []) request.resolve();
      gate = null;
    }
    port.postMessage({ type: 'ack', action, id });
  });
  port.unref();
}
export async function resolve(specifier, context, nextResolve) {
  const result = await nextResolve(specifier, context);
  if (result.url !== panelURL || context.parentURL?.split('?')[0] !== appURL || !gate)
    return result;
  const current = gate;
  port.postMessage({ type: 'entered', id: current.id });
  await new Promise((resolve, reject) => current.requests.push({ resolve, reject }));
  return result;
}
