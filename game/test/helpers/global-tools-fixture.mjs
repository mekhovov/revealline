import { mountGlobalSettingsTools } from '../../ui/global-settings-tools.mjs';
import { mountSimGlobalTools } from '../../../optional-practice/civilian-fpv/sim-presentation.mjs';

// Only the module-loading boundary is supplied; the provider, modal lifecycle,
// controls and host input routing are production code.
export function sourceSimGlobalTools(options) {
  return mountSimGlobalTools({
    ...options,
    moduleURL: new URL(
      '/optional-practice/civilian-fpv/sim-presentation.mjs',
      options.window.location.href,
    ).href,
    loadProvider: async () => ({ mountGlobalSettingsTools }),
  });
}
export function menuPad() {
  return {
    index: 0,
    id: 'Shared tool navigation pad',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
}
