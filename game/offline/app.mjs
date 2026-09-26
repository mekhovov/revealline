import { readInstalledState, validateInstalledEdition } from './installed-app.mjs';
const $ = (id) => document.getElementById(id);
let installPrompt;
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
  $('install').hidden = false;
});
$('install').onclick = async () => {
  await installPrompt?.prompt();
  installPrompt = null;
  $('install').hidden = true;
};
const game = (edition, page = '') =>
  new URL(`game/${page}`, validateInstalledEdition(edition).scope).href;
async function check() {
  $('updates').disabled = true;
  try {
    const response = await fetch('./current.json', { cache: 'no-store' });
    if (!response.ok)
      throw new Error('Could not check for an edition. Your installed game is kept.');
    const current = await response.json();
    const candidate = validateInstalledEdition({
      ...current,
      scope: new URL(current.scope, location.href).href,
    });
    const active = readInstalledState().active;
    $('edition').textContent =
      active?.scope === candidate.scope
        ? `Edition ${candidate.version} is selected.`
        : `Edition ${candidate.version} is available. Downloads and progress transfer are optional.`;
    $('prepare').href = game(candidate, 'downloads.html');
    $('prepare').hidden = false;
  } catch (error) {
    $('edition').textContent =
      `${error.message} Open your installed game without checking for updates.`;
  } finally {
    $('updates').disabled = false;
  }
}
$('updates').onclick = check;
try {
  const state = readInstalledState();
  if (state.active) {
    $('play').href = game(state.active);
    $('play').hidden = false;
    $('status').textContent = `Installed edition ${state.active.version}.`;
    if (!new URL(location.href).searchParams.has('manage')) location.replace(game(state.active));
  } else {
    $('status').textContent = 'Choose an edition and download the game before going offline.';
    // Only the first preparation needs the server. An installed launch never waits for it.
    void check();
  }
  if (state.previous) {
    $('previous').hidden = false;
    $('previous').onclick = () => location.assign(game(state.previous, 'downloads.html?rollback'));
  }
  if (!state.active || new URL(location.href).searchParams.has('manage')) {
    void navigator.serviceWorker
      ?.register('./service-worker.js', { scope: './', updateViaCache: 'none' })
      .catch((error) => {
        $('status').textContent = `Launcher preparation failed: ${error.message}`;
      });
  }
} catch (error) {
  $('status').textContent = error.message;
}
