import { mountAuthoringInputHost } from '../../game/ui/authoring-input-host.mjs';

const hosts = new WeakMap();

/** The register supplies page Back; the shared owner retains every input device. */
export function mountProductionInput({ document: doc = globalThis.document, ...options } = {}) {
  if (hosts.has(doc)) return hosts.get(doc);
  let panel = null;
  const owner = mountAuthoringInputHost({
    ...options,
    document: doc,
    onPageBack: () => {
      if (!panel?.back()) owner.navigation.handle({ menu: true });
    },
  });
  const input = {
    navigation: owner.navigation,
    attach(next) {
      panel = next;
    },
    destroy() {
      panel = null;
      owner.destroy();
      hosts.delete(doc);
    },
  };
  hosts.set(doc, input);
  return input;
}
