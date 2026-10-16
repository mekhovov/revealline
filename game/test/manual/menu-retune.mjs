/* global document, window, requestAnimationFrame, cancelAnimationFrame */
import { attachMenuRetune, commitMenuRetune } from '../../ui/menu-retune.mjs';

const $ = (id) => document.getElementById(id);
const landing = $('landing'),
  chooser = $('chooser'),
  status = $('status');
const owner = attachMenuRetune({ root: landing });
let frame = null;
function navigate(from, to, focus) {
  if (frame !== null) cancelAnimationFrame(frame);
  from.hidden = true;
  to.hidden = false;
  const played = commitMenuRetune(from, to);
  focus.focus();
  status.textContent = played
    ? 'Retuning for 220 ms. Text, focus and buttons remain immediately usable.'
    : 'Immediate menu change. Motion preference or rapid-navigation cooldown suppressed the burst.';
  if (played && $('hold').checked) {
    frame = requestAnimationFrame(() => {
      frame = null;
      const layer = to.querySelector('.menu-retune-layer');
      // Inspection only: sample the production CSS without changing its timing
      // in the game. The retained clone is inert and cleared on navigation.
      const snapshot = layer.cloneNode(true);
      snapshot.classList.add('inspection-frame');
      snapshot.style.animationPlayState = 'paused';
      snapshot.style.animationDelay = '-77ms';
      layer.after(snapshot);
      status.textContent = 'Held production CSS at 77 ms. Game transitions finish automatically.';
    });
  }
}
function clearInspection() {
  document.querySelectorAll('.inspection-frame').forEach((node) => node.remove());
}
$('choose').onclick = () => {
  clearInspection();
  navigate(landing, chooser, $('search'));
};
$('back').onclick = () => {
  clearInspection();
  navigate(chooser, landing, $('choose'));
};
$('hold').onchange = clearInspection;
$('reduced').onchange = () => {
  clearInspection();
  document.body.dataset.effects = $('reduced').checked ? 'reduced' : 'full';
};
window.addEventListener('pagehide', () => {
  if (frame !== null) cancelAnimationFrame(frame);
  owner.dispose();
});
