import { attachProductionPanel } from './panel.mjs';
import { loadProductionImage, readSourceBytes } from './preview.mjs';

const rootURL = new URL('../../', import.meta.url).href;
const panel = attachProductionPanel({
  root: document.getElementById('production-panel'),
  rootURL,
  loadRegister: async ({ signal }) =>
    JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(
        await readSourceBytes(new URL('./register.json', import.meta.url).href, 2 * 1024 * 1024, {
          signal,
        }),
      ),
    ),
  loadPreview: (entry, { signal }) => loadProductionImage(entry, { rootURL, signal }),
});
window.addEventListener('pagehide', () => panel.cancel());
