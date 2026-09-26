import { readInstalledState, validateInstalledEdition } from './installed-app.mjs';
import { localizedText, t } from '../i18n/index.mjs';
const $ = (id) => document.getElementById(id);
const localError = (key, values) =>
  Object.assign(new Error(t(key, values)), { localization: { key, values } });
const errorText = (error) =>
  error?.localization ? t(error.localization.key, error.localization.values) : error.message;
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
    if (!response.ok) throw localError('interface:launcher.checkFailed');
    const current = await response.json();
    const candidate = validateInstalledEdition({
      ...current,
      scope: new URL(current.scope, location.href).href,
    });
    const active = readInstalledState().active;
    localizedText($('edition'), () =>
      t(
        active?.scope === candidate.scope
          ? 'interface:launcher.editionSelected'
          : 'interface:launcher.editionAvailable',
        { version: candidate.version },
      ),
    );
    $('prepare').href = game(candidate, 'downloads.html');
    $('prepare').hidden = false;
  } catch (error) {
    localizedText($('edition'), () =>
      t('interface:launcher.checkError', { error: errorText(error) }),
    );
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
    localizedText($('status'), () =>
      t('interface:launcher.installedEdition', { version: state.active.version }),
    );
    if (!new URL(location.href).searchParams.has('manage')) location.replace(game(state.active));
  } else {
    localizedText($('status'), () => t('interface:launcher.chooseEdition'));
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
        localizedText($('status'), () =>
          t('interface:launcher.preparationFailed', { error: error.message }),
        );
      });
  }
} catch (error) {
  localizedText($('status'), () => errorText(error));
}
