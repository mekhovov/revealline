// Passive native-download qualification probe. Never focuses or activates a
// control; the only source is an explicitly selected same-origin Creator draft.
const frame = globalThis.document.querySelector('iframe'),
  report = globalThis.document.getElementById('probe-report'),
  entries = [];
let sequence = 0,
  detach = () => {};
const write = (entry) => {
  entries.push({ sequence: ++sequence, ...entry });
  if (entries.length > 100) entries.shift();
  report.textContent = JSON.stringify(entries, null, 2);
};
const identify = (element) =>
  element?.id || element?.getAttribute?.('aria-label') || element?.tagName || null;
function observe() {
  detach();
  if (!frame.contentDocument) {
    write({ type: 'outside-probe-scope', message: 'The frame left this origin.' });
    return;
  }
  const win = frame.contentWindow,
    doc = frame.contentDocument,
    listeners = [],
    api = win.URL,
    original = api.createObjectURL;
  const state = () => ({
    focused: identify(doc.activeElement),
    hasFocus: doc.hasFocus(),
    hidden: doc.hidden,
    userActivation: {
      active: win.navigator.userActivation?.isActive,
      everActive: win.navigator.userActivation?.hasBeenActive,
    },
  });
  const listen = (type, callback) => {
    win.addEventListener(type, callback, { capture: true, passive: true });
    listeners.push(() => win.removeEventListener(type, callback, { capture: true }));
  };
  for (const type of ['keydown', 'keyup', 'click', 'focusin'])
    listen(type, (event) => {
      const before = state(),
        target = event.target,
        observed = {
          type,
          key: event.key,
          trusted: event.isTrusted,
          target: identify(target),
          download: target?.download || null,
          hrefProtocol: target?.href?.split(':')[0] || null,
          before,
        };
      // Window capture runs before document guards. Read cancellation only once
      // their handlers and native default processing have had a chance to run.
      setTimeout(
        () => write({ ...observed, prevented: event.defaultPrevented, after: state() }),
        0,
      );
    });
  const observedCreate = function (blob) {
    const url = original.call(this, blob);
    write({
      type: 'blob-created',
      bytes: blob.size,
      mime: blob.type,
      protocol: url.split(':')[0],
      ...state(),
    });
    return url;
  };
  api.createObjectURL = observedCreate;
  let pads;
  try {
    pads = [...win.navigator.getGamepads()].filter(Boolean).map((pad) => ({
      index: pad.index,
      connected: pad.connected,
      mapping: pad.mapping,
      pressed: pad.buttons.flatMap((button, index) => (button.pressed ? [index] : [])),
    }));
  } catch (error) {
    pads = { error: error.name };
  }
  write({
    type: 'observing',
    route: win.location.pathname + win.location.search,
    pads,
    ...state(),
  });
  detach = () => {
    listeners.forEach((remove) => remove());
    if (api.createObjectURL === observedCreate) api.createObjectURL = original;
  };
}
const draft = new URL(globalThis.window.location.href).searchParams.get('draft');
if (!draft || !/^[a-z][a-z0-9-]{0,59}$/.test(draft)) {
  write({
    type: 'configuration-required',
    message:
      'Pass ?draft= followed by an existing Creator draft ID on this same origin. No editor was opened.',
  });
} else {
  const source = new URL('../../creator/', import.meta.url);
  source.searchParams.set('draft', draft);
  frame.addEventListener('load', observe);
  frame.hidden = false;
  frame.src = source.href;
}
globalThis.window.addEventListener('pagehide', () => detach(), { once: true });
