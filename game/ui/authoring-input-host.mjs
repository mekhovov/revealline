import { mountPageInputHost } from './page-input-host.mjs';
import { createAuthoringSourcePicker } from './authoring-sources.mjs';

export { attachAuthoringPreview } from './page-input-host.mjs';

/** Existing authoring API retains the source chooser and shared single owner. */
export function mountAuthoringInputHost(options = {}) {
  return mountPageInputHost({ ...options, createSourcePicker: createAuthoringSourcePicker });
}
