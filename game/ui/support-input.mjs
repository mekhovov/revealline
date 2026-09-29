import { mountAuthoringInputHost } from './authoring-input-host.mjs';

/** Support screens use the existing menu/field owner. Controller Practice keeps
 * its session-checked child handoff; no second preview bridge is installed. */
export function mountSupportInput({
  document: doc = globalThis.document,
  window: win = doc.defaultView,
  ...options
} = {}) {
  return mountAuthoringInputHost({
    ...options,
    document: doc,
    window: win,
    managePreviews: false,
    onPageBack: () => {
      const home = doc.querySelector('[data-support-return]');
      if (home && !home.closest('[hidden],[inert]')) home.click();
    },
  });
}
