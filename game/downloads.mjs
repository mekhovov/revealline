import { readAssetStore } from './storage.mjs';
import { offlineAvailability, prepareOffline, checkOffline } from './offline.mjs';
import { createOfficialDownloads } from './official-downloads.mjs';
import { downloadFiles } from './download-catalogue.mjs';
import { createSoundtrackSource } from './soundtrack-source.mjs';
import { createManagedMediaStore } from './managed-media-store.mjs';
import { SOUNDTRACK_CATALOGUE, SOUNDTRACK_ARCHIVES } from './content/soundtrack-catalogue.mjs';
import {
  installedAppURL,
  readInstalledState,
  stageInstalledEdition,
  activateInstalledEdition,
  updateInstalledSelection,
} from './installed-app.mjs';
import { formatNumber, localizedText, t } from './i18n/index.mjs';

const $ = (id) => document.getElementById(id);
const size = (bytes) =>
  t('interface:downloads.sizeMiB', {
    size: formatNumber(bytes / 1048576, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  });
const groupTitle = (group) => (group.titleKey ? t(group.titleKey) : group.title);
const localError = (key, values) =>
  Object.assign(new Error(t(key, values)), { localization: { key, values } });
const errorText = (error) =>
  error?.localization ? t(error.localization.key, error.localization.values) : error.message;
const available = offlineAvailability();
const store = createOfficialDownloads();
let controller,
  catalogue,
  core,
  runtimeHealth,
  ready = false,
  estimateSequence = 0,
  musicJob = false;
const activity = globalThis.BroadcastChannel
  ? new BroadcastChannel('revealline.game-activity.v1')
  : null;
const playing = new Set();
if (activity)
  activity.onmessage = (event) => {
    if (event.data?.owner) {
      if (event.data.active) playing.add(event.data.owner);
      else playing.delete(event.data.owner);
    }
    if ((event.data?.active || event.data?.gameplayDownload) && musicJob) controller?.abort();
  };
const selected = new Set();
const albums = new Map();
const baseURL = new URL('../', import.meta.url).href;
const edition = baseURL;
const appURL = installedAppURL(location);
$('install-app').href = appURL;
const source = createSoundtrackSource({
  catalogue: SOUNDTRACK_CATALOGUE,
  archives: SOUNDTRACK_ARCHIVES,
});
const operation = (message) => {
  localizedText($(musicJob ? 'music-operation-status' : 'operation-status'), message);
};
const gameIDs = () =>
  catalogue.groups
    .filter(
      (group) =>
        group.kind === 'gameplay' &&
        ($('all-game').checked || selected.has(group.id) || group.id === 'base'),
    )
    .map((group) => group.id);
const gameFiles = () => downloadFiles(catalogue, gameIDs());
function busy(value) {
  for (const id of ['download-game', 'verify-game', 'remove-chapters', 'all-music', 'all-game'])
    $(id).disabled = value;
  for (const button of document.querySelectorAll('#albums button, #chapters input'))
    button.disabled = value;
  $('pause').disabled = $('cancel').disabled = !value || musicJob;
  $('pause-music').disabled = $('cancel-music').disabled = !value || !musicJob;
  $('progress').hidden = !value || musicJob;
  $('music-progress').hidden = !value || !musicJob;
}
async function estimates() {
  const sequence = ++estimateSequence;
  const report = await store.estimate(gameFiles());
  if (sequence !== estimateSequence) return;
  const coreBytes = core.files.reduce((sum, file) => sum + file.bytes, 0);
  const totalDownloadBytes = [
    ...new Map([...core.files, ...gameFiles()].map((file) => [file.sha256, file])).values(),
  ].reduce((sum, file) => sum + file.bytes, 0);
  const coreMissing = new Set([
    ...(runtimeHealth?.missing || []),
    ...(runtimeHealth?.corrupt || []),
  ]);
  const coreRemaining = ['ready', 'waiting'].includes(runtimeHealth?.status)
    ? 0
    : coreMissing.size
      ? core.files
          .filter((file) => coreMissing.has(file.path))
          .reduce((sum, file) => sum + file.bytes, 0)
      : coreBytes;
  localizedText($('game-size'), () =>
    t('interface:downloads.gameSize', {
      download: size(totalDownloadBytes),
      stored: size(report.totalBytes + coreBytes),
      remaining: size(report.remainingBytes + coreRemaining),
      required: size(report.requiredBytes + coreRemaining),
      free:
        report.availableBytes === null
          ? t('interface:downloads.freeUnavailable')
          : t('interface:downloads.freeEstimate', { size: size(report.availableBytes) }),
    }),
  );
}
async function health({ verify = true } = {}) {
  const gameplay = await store.inspect(gameFiles(), { verify });
  const runtime = await checkOffline();
  runtimeHealth = runtime;
  ready = gameplay.ready && runtime.status === 'ready';
  localizedText($('game-status'), () =>
    ready
      ? t(
          $('all-game').checked
            ? 'interface:downloads.gameReady'
            : 'interface:downloads.chaptersReady',
        )
      : t('interface:downloads.gameIncomplete'),
  );
  $('activate').hidden = !ready;
  $('details').textContent = JSON.stringify({ runtime, gameplay }, null, 2);
  const musicEstimate = await store.estimate(
    catalogue.files.filter((file) => file.kind === 'soundtrack'),
  );
  localizedText($('music-size'), () =>
    t('interface:downloads.musicSize', {
      total: size(musicEstimate.totalBytes),
      remaining: size(musicEstimate.remainingBytes),
      required: size(musicEstimate.requiredBytes),
      free:
        musicEstimate.availableBytes === null
          ? ''
          : t('interface:downloads.freeEstimate', { size: size(musicEstimate.availableBytes) }),
    }),
  );
  let count = 0;
  for (const file of catalogue.files.filter((file) => file.kind === 'soundtrack'))
    if ((await store.inspect([file], { verify })).ready) count++;
  localizedText($('music-status'), () =>
    t('interface:downloads.soundtracksDownloaded', {
      count,
      total: catalogue.files.filter((file) => file.kind === 'soundtrack').length,
    }),
  );
  for (const [id, element] of albums) {
    const report = await store.estimate(downloadFiles(catalogue, [id]));
    localizedText(element, () =>
      t('interface:downloads.albumSize', {
        total: size(report.totalBytes),
        state: report.ready
          ? t('interface:downloads.readyOffline')
          : t('interface:downloads.remaining', { size: size(report.remainingBytes) }),
        required: size(report.requiredBytes),
      }),
    );
  }
  await estimates();
}
async function run(task, { music = false } = {}) {
  if (controller) return;
  controller = new AbortController();
  musicJob = music;
  busy(true);
  try {
    const message = await task(controller.signal);
    operation(message ?? (() => t('interface:downloads.complete')));
  } catch (error) {
    operation(
      error.name === 'AbortError'
        ? () => t('interface:downloads.pausedMessage')
        : error.name === 'QuotaExceededError'
          ? () => t('interface:downloads.storageFull')
          : () => errorText(error),
    );
  } finally {
    controller = null;
    musicJob = false;
    busy(false);
    await health().catch((error) => operation(() => errorText(error)));
  }
}
function progress(report) {
  const bar = $(musicJob ? 'music-progress' : 'progress');
  bar.max = report.totalBytes || 1;
  bar.value = report.readyBytes + (report.currentBytes || 0);
  operation(() =>
    t('interface:downloads.progress', {
      remaining: size(report.remainingBytes),
      ready: size(report.readyBytes),
    }),
  );
}
async function downloadAlbum(group, signal) {
  musicJob = true;
  playing.clear();
  activity?.postMessage({ probe: true });
  if (activity) await new Promise((resolve) => setTimeout(resolve, 100));
  signal.throwIfAborted();
  if (playing.size) throw localError('interface:downloads.musicPausedForGame');
  const imported = createManagedMediaStore({ soundtrackCatalogue: true });
  try {
    await store.download({
      edition: 'soundtracks',
      group: group.id,
      files: downloadFiles(catalogue, [group.id]),
      baseURL,
      signal,
      acquire: (file, options) => source.readAsset(file.sha256, { ...options, download: true }),
      readExisting: (file) => imported.readSelectedBlob(file.sha256, { signal }),
      onProgress: progress,
    });
  } finally {
    imported.close();
  }
}
$('pause').onclick = $('cancel').onclick = () => controller?.abort();
$('pause-music').onclick = $('cancel-music').onclick = () => controller?.abort();
document.addEventListener('visibilitychange', () => {
  if (document.hidden) controller?.abort();
});
window.addEventListener('pagehide', (event) => {
  controller?.abort();
  if (!event.persisted) activity?.close();
});
$('all-game').onchange = () => {
  ready = false;
  $('activate').hidden = true;
  void estimates();
};
$('download-game').onclick = () =>
  run(async (signal) => {
    activity?.postMessage({ gameplayDownload: true });
    operation(() => t('interface:downloads.preparingRuntime'));
    const report = await prepareOffline({
      signal,
      cancelPreparation: true,
      onStatus: (state) =>
        operation(state.message || (() => t('interface:downloads.verifyingRuntime'))),
    });
    if (report.status !== 'ready')
      throw report.message
        ? new Error(report.message)
        : localError('interface:downloads.closeOtherWindows');
    await store.download({
      edition,
      group: 'gameplay',
      selection: gameIDs(),
      files: gameFiles(),
      baseURL,
      signal,
      onProgress: progress,
    });
  });
$('verify-game').onclick = () =>
  run(async () => {
    await health({ verify: true });
    if (!ready) throw localError('interface:downloads.missingFiles');
  });
$('all-music').onclick = () =>
  run(
    async (signal) => {
      for (const group of catalogue.groups.filter((item) => item.kind === 'soundtrack'))
        await downloadAlbum(group, signal);
    },
    { music: true },
  );
$('remove-chapters').onclick = () =>
  run(async () => {
    if ($('all-game').checked || !selected.size)
      throw localError('interface:downloads.chooseRemoval');
    const saved = (await store.states()).find(
      (state) => state.edition === edition && state.group === 'gameplay',
    );
    if (!saved) return () => t('interface:downloads.nothingToRemove');
    const selection = (saved.selection || []).filter(
      (id) => id === 'base' || id === 'shared' || !selected.has(id),
    );
    await store.retain({
      edition,
      group: 'gameplay',
      selection,
      files: downloadFiles(catalogue, selection),
    });
    await updateInstalledSelection(baseURL, selection);
    selected.clear();
    selection.forEach((id) => selected.add(id));
    for (const input of document.querySelectorAll('#chapters input'))
      input.checked = selected.has(input.dataset.group);
    return () => t('interface:downloads.removalUpdated');
  });
$('retain').onclick = async () => {
  try {
    const granted = await navigator.storage?.persist?.();
    localizedText($('retention-status'), () =>
      t(
        granted
          ? 'interface:downloads.persistenceGranted'
          : 'interface:downloads.persistenceDenied',
      ),
    );
  } catch (error) {
    localizedText($('retention-status'), () => error.message);
  }
};
$('activate').onclick = () =>
  run(async () => {
    await health({ verify: true });
    if (!ready) throw localError('interface:downloads.verifyBeforeSelecting');
    const candidate = {
      version: catalogue.version,
      scope: baseURL,
      selection: gameIDs(),
      allGameplay: $('all-game').checked,
    };
    const registration = await navigator.serviceWorker.register(
      new URL('service-worker.js', appURL),
      { scope: appURL, updateViaCache: 'none' },
    );
    const worker = registration.installing || registration.waiting || registration.active;
    if (!worker) throw localError('interface:downloads.launcherNotStarted');
    if (worker?.state !== 'activated')
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          worker?.removeEventListener('statechange', changed);
          reject(localError('interface:downloads.closeLauncher'));
        }, 30000);
        const changed = () => {
          if (worker.state === 'activated' || worker.state === 'redundant') {
            clearTimeout(timer);
            worker.removeEventListener('statechange', changed);
            worker.state === 'activated'
              ? resolve()
              : reject(localError('interface:downloads.launcherFailed'));
          }
        };
        worker?.addEventListener('statechange', changed);
        changed();
      });
    await stageInstalledEdition(candidate);
    const result = await activateInstalledEdition(candidate, {
      readAsset: readAssetStore,
      restorePrevious: new URL(location.href).searchParams.has('rollback'),
    });
    localizedText($('activation-status'), () =>
      result.activated ? result.message : t('interface:downloads.transferInstructions'),
    );
    $('transfer-progress').hidden = result.activated;
  });
async function initialize() {
  if (!available.available) throw new Error(available.reason);
  if (new URL(location.href).searchParams.has('rollback'))
    localizedText($('activate'), () => t('interface:downloads.restorePrevious'));
  [catalogue, core] = await Promise.all(
    ['offline-content.json', 'offline-cache.json'].map(async (path) => {
      const response = await fetch(new URL(path, baseURL));
      if (!response.ok) throw localError('interface:downloads.catalogueMissing');
      return response.json();
    }),
  );
  const saved = (await store.states()).find(
    (state) => state.edition === edition && state.group === 'gameplay',
  );
  const retained = saved || readInstalledState().active;
  if (retained?.selection) {
    retained.selection.forEach((id) => selected.add(id));
    $('all-game').checked =
      retained.allGameplay === true ||
      catalogue.groups
        .filter((group) => group.kind === 'gameplay')
        .every((group) => selected.has(group.id));
  }
  for (const group of catalogue.groups) {
    if (group.kind === 'gameplay' && !['shared', 'base'].includes(group.id)) {
      const label = document.createElement('label'),
        input = document.createElement('input');
      input.type = 'checkbox';
      input.dataset.group = group.id;
      input.checked = selected.has(group.id);
      input.onchange = () => {
        if (input.checked) selected.add(group.id);
        else selected.delete(group.id);
        $('all-game').checked = false;
        ready = false;
        $('activate').hidden = true;
        void estimates();
      };
      const caption = document.createElement('span');
      localizedText(caption, () => groupTitle(group));
      label.append(input, caption);
      $('chapters').append(label);
    } else if (group.kind === 'soundtrack') {
      const row = document.createElement('div'),
        title = document.createElement('h3'),
        status = document.createElement('p'),
        actions = document.createElement('div');
      row.className = 'album';
      actions.className = 'actions';
      localizedText(title, () => groupTitle(group));
      const download = document.createElement('button'),
        remove = document.createElement('button');
      localizedText(download, () => t('interface:downloads.downloadResume'));
      localizedText(remove, () => t('interface:downloads.removeDownload'));
      download.onclick = () => run((signal) => downloadAlbum(group, signal), { music: true });
      remove.onclick = () =>
        run(
          async () => {
            await store.remove('soundtracks', group.id);
            return () => t('interface:downloads.soundtrackRemoved');
          },
          { music: true },
        );
      albums.set(group.id, status);
      actions.append(download, remove);
      row.append(title, status, actions);
      $('albums').append(row);
    }
  }
  busy(false);
  await health();
}
void initialize().catch((error) => {
  localizedText($('game-status'), () => errorText(error));
});
