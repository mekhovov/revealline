import { mountHostDisplay } from './host-display.mjs';

// Independent of tool initialization so loading/error chrome retains the
// current reading policy even when the tool's own module graph cannot start.
mountHostDisplay();
