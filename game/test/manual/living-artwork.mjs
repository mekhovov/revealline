/* global document, window, Option */
import { attachMenuScene } from '../../ui/menu-scenes.mjs';
import { MENU_SCENES } from '../../ui/menu-scene-catalog.mjs';

const root = document.getElementById('landing');
const context = { themeId: 'fpv', active: true, reduced: false };
let owner = attachMenuScene({ root, getContext: () => context });
const theme = document.getElementById('theme');
for (const id of Object.keys(MENU_SCENES)) theme.add(new Option(id, id));
const status = document.getElementById('status');
const report = () => {
  const scene = root.querySelector('.menu-scene');
  status.textContent =
    scene.dataset.loaded !== 'true'
      ? 'Loading the original artwork…'
      : scene.dataset.motion === 'off'
        ? 'Original still image · motion preference respected'
        : scene.dataset.renderer === 'webgl'
          ? 'Six-second arrival, then a fixed camera · painted scenery moves · occasional receiver dropouts.'
          : 'Static picture fallback · one six-second zoom, then hold · occasional receiver dropouts.';
};
const observer = new window.MutationObserver(report);
observer.observe(root.querySelector('.menu-scene'), { attributes: true });
theme.onchange = () => {
  context.themeId = theme.value;
  owner.update();
};
document.getElementById('pause').onclick = (event) => {
  context.active = !context.active;
  owner.update();
  event.target.textContent = context.active ? 'Pause animation' : 'Resume animation';
};
document.getElementById('reduced').onchange = (event) => {
  context.reduced = event.target.checked;
  owner.update();
};
document.getElementById('fallback').onchange = (event) => {
  observer.disconnect();
  owner.dispose();
  // Inspection only: exercise the real CSS fallback without changing WebGL
  // availability for the game or writing any shared preference.
  const options = event.target.checked
    ? {
        createMotion: ({ onReady }) => {
          onReady(false);
          return { update() {}, setRunning() {}, dispose() {} };
        },
      }
    : {};
  owner = attachMenuScene({ root, getContext: () => context, ...options });
  observer.observe(root.querySelector('.menu-scene'), { attributes: true });
  report();
};
window.addEventListener(
  'pagehide',
  () => {
    observer.disconnect();
    owner.dispose();
  },
  { once: true },
);
report();
