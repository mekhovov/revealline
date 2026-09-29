import { attachProductionPanel } from './panel.mjs';
import { loadProductionImage, readSourceBytes } from './preview.mjs';
import { mountProductionInput } from './input.mjs';

const rootURL = new URL('../../', import.meta.url).href;
const snapshot = new URL(window.location.href).searchParams.get('snapshot');
const registerFile =
  snapshot === 'sentinel-themes' ? './register-sentinel-themes.json' : './register.json';
document
  .querySelector(snapshot === 'sentinel-themes' ? '#snapshot-sentinel' : '#snapshot-baseline')
  ?.setAttribute('aria-current', 'page');
const input = mountProductionInput();
const panel = attachProductionPanel({
  root: document.getElementById('production-panel'),
  rootURL,
  loadRegister: async ({ signal }) =>
    JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(
        await readSourceBytes(new URL(registerFile, import.meta.url).href, 2 * 1024 * 1024, {
          signal,
        }),
      ),
    ),
  loadPreview: (entry, { signal }) => loadProductionImage(entry, { rootURL, signal }),
  navigation: input.navigation,
});
input.attach(panel);
const cancel = () => panel.cancel();
const visibility = () => {
  if (document.hidden) cancel();
};
const pagehide = (event) => {
  cancel();
  if (event.persisted) return;
  panel.dispose();
  input.destroy();
  window.removeEventListener('blur', cancel);
  window.removeEventListener('pagehide', pagehide);
  document.removeEventListener('visibilitychange', visibility);
};
window.addEventListener('blur', cancel);
window.addEventListener('pagehide', pagehide);
document.addEventListener('visibilitychange', visibility);
