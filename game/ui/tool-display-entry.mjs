import { mountToolDisplay } from './tool-display.mjs';
import { installThemeHost } from '../presentation/theme-host.mjs';

// Keep reading-policy adoption independent of the tool's application graph.
// This entry owns only host attributes and explicitly marked reading controls.
mountToolDisplay();
installThemeHost({ studio: true });
