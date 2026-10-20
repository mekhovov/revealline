// Gate only the real Soundtrack owner's optional view import. Production module bytes and
// cache identity are unchanged; every unrelated resolution uses Node's loader.
let port;
let gate = null;
let pendingResolutions = 0;
const panelURL = new URL('../../ui/soundtrack-authoring-view.mjs', import.meta.url).href;
const appURL = new URL('../../ui/soundtrack-panel.mjs', import.meta.url).href;
export function initialize({ channel }) {
  port = channel;
  port.on('message', ({ action, id, fail = false }) => {
    if (action === 'hold') {
      if (gate) throw new Error('The prior Soundtrack import gate must be released.');
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
  const fromApp = context.parentURL?.split('?')[0] === appURL;
  let retained = false;
  // A candidate's delegated resolution can also be asynchronous. Retain the
  // loader before yielding; an exhausted worker reports a never-settling import.
  if (fromApp && gate) {
    retained = true;
    if (pendingResolutions++ === 0) port.ref();
  }
  try {
    const result = await nextResolve(specifier, context);
    if (result.url !== panelURL || !fromApp || !gate) return result;
    // A gate may have been armed while delegated resolution was pending.
    if (!retained) {
      retained = true;
      if (pendingResolutions++ === 0) port.ref();
    }
    const current = gate;
    port.postMessage({ type: 'entered', id: current.id });
    await new Promise((resolve, reject) => current.requests.push({ resolve, reject }));
    return result;
  } finally {
    if (retained && --pendingResolutions === 0) port.unref();
  }
}
