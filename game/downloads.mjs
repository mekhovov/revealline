import { readAssetStore } from './storage.mjs';
import { offlineAvailability, prepareOffline, checkOffline } from './offline.mjs';
import { createOfficialDownloads } from './official-downloads.mjs';
import { downloadFiles } from './download-catalogue.mjs';
import {
  readOfflineDestination,
  continueOfflineDestination,
  downloadOfflineDestination,
} from './offline-navigation-recovery.mjs';
import {
  downloadErrorMessage,
  gameplaySelection,
  offlineReadinessKey,
  offlineMessage,
  installedResultMessage,
  finishOfflineSelection,
  runApprovedDownload,
} from './offline-download-session.mjs';
import { captureInstallPrompt, installInstructions } from './ui/pwa-install.mjs';
import { attachDownloadsNavigation } from './ui/downloads-navigation.mjs';
import { createSoundtrackSource } from './soundtrack-source.mjs';
import { createManagedMediaStore } from './managed-media-store.mjs';
import { SOUNDTRACK_CATALOGUE, SOUNDTRACK_ARCHIVES } from './content/soundtrack-catalogue.mjs';
import {
  installedAppURL,
  readInstalledState,
  stageInstalledEdition,
  activateInstalledEdition,
  updateInstalledSelection,
  rememberInstalledPackages,
  prepareInstalledLauncher,
  checkInstalledLauncher,
  installedPresentation,
} from './installed-app.mjs';
import { formatNumber, localizedText, onLocaleChange, t } from './i18n/index.mjs';

const $ = (id) => document.getElementById(id);
localizedText($('game-title'), () => t('interface:downloads.gameHeading'));
localizedText($('game-status'), () => t('interface:downloads.checkingEdition'));
localizedText($('cancel'), () => t('interface:downloads.cancel'));
localizedText($('retention-status'), () => t('interface:downloads.storageWarning'));
localizedText($('music-status'), () => t('interface:downloads.checkingSoundtracks'));
localizedText($('all-music'), () => t('interface:downloads.downloadAllMusic'));
const size = (bytes) =>
  t('interface:downloads.sizeMiB', {
    size: formatNumber(bytes / 1048576, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  });
const groupTitle = (group) => (group.titleKey ? t(group.titleKey) : group.title);
const localError = (key, values) =>
  Object.assign(new Error(t(key, values)), { localization: { key, values } });
const errorText = (error) => downloadErrorMessage(error, t);
const available = offlineAvailability();
const store = createOfficialDownloads();
let controller,
  catalogue,
  core,
  runtimeHealth,
  launcherHealth = { status: 'missing' },
  ready = false,
  estimateSequence = 0,
  healthSequence = 0,
  musicJob = false,
  requestedPackage = null,
  lastEstimate = null,
  savedDownload = false,
  resumeApprovedGame = null,
  yieldedToPlay = false,
  activationResult = null,
  navigationRequest = null,
  panelController = new AbortController();
const embedded = new URL(location.href).searchParams.has('embedded') && window.parent !== window;
const panelProtocol = 'revealline.offline-panel.v1';
const notifyHost = (action, fields = {}) => {
  if (embedded)
    window.parent.postMessage({ format: panelProtocol, action, ...fields }, location.origin);
};
onLocaleChange(() =>
  queueMicrotask(() => notifyHost('status', { text: $('game-status').textContent })),
);
const navigation = attachDownloadsNavigation({
  onBack: () => (embedded ? notifyHost('close') : leaveDownloads()),
});
function leaveDownloads() {
  panelController.abort();
  pauseGameDownload();
  location.assign('./');
}
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
    if (event.data?.active && controller && !musicJob && resumeApprovedGame) {
      yieldedToPlay = true;
      controller.abort();
    }
    if (
      event.data?.active === false &&
      !playing.size &&
      yieldedToPlay &&
      !controller &&
      resumeApprovedGame &&
      !document.hidden
    ) {
      yieldedToPlay = false;
      void resumeApprovedGame();
    }
  };
const selected = new Set();
const albums = new Map();
const albumDownloads = new Map();
const baseURL = new URL('../', import.meta.url).href;
const edition = baseURL;
const appURL = installedAppURL(location);
$('install-app').href = appURL;
if (embedded) $('back-to-game').hidden = true;
else
  $('back-to-game').onclick = (event) => {
    event.preventDefault();
    leaveDownloads();
  };
const install = captureInstallPrompt();
function refreshInstall() {
  const installed = installedPresentation();
  localizedText($('installation-status'), () =>
    t(
      installed
        ? 'interface:downloads.installationInstalled'
        : 'interface:downloads.installationBrowser',
    ),
  );
  $('install-native').hidden = embedded || !install?.available() || installed;
  $('install-guide').hidden = installed;
}
install?.subscribe(refreshInstall);
$('install-native').onclick = () => {
  void install
    .request()
    .then(refreshInstall)
    .catch((error) => {
      localizedText($('installation-status'), () => errorText(error));
    });
};
const instructions = installInstructions();
const instructionKeys = {
  'apple-mobile': [
    'interface:downloads.install.appleMobileStep1',
    'interface:downloads.install.appleMobileStep2',
    'interface:downloads.install.appleMobileStep3',
  ],
  'safari-desktop': [
    'interface:downloads.install.safariDesktopStep1',
    'interface:downloads.install.safariDesktopStep2',
  ],
  browser: [
    'interface:downloads.install.browserInstallStep1',
    'interface:downloads.install.browserInstallStep2',
  ],
};
for (const key of instructionKeys[instructions.platform]) {
  const item = document.createElement('li');
  localizedText(item, () => t(key));
  $('install-steps').append(item);
}
const instructionNotes = {
  'apple-mobile': 'interface:downloads.install.appleMobileNote',
  'safari-desktop': 'interface:downloads.install.safariDesktopNote',
  browser: 'interface:downloads.install.browserNote',
};
localizedText($('install-help'), () => t(instructionNotes[instructions.platform]));
refreshInstall();
const source = createSoundtrackSource({
  catalogue: SOUNDTRACK_CATALOGUE,
  archives: SOUNDTRACK_ARCHIVES,
});
const operation = (message) => {
  localizedText($(musicJob ? 'music-operation-status' : 'operation-status'), message);
};
const gameIDs = () =>
  navigationRequest?.groups ||
  gameplaySelection(catalogue, { all: $('all-game').checked, selected: [...selected] });
const gameFiles = () => downloadFiles(catalogue, gameIDs());
function readyMessage() {
  if (navigationRequest) return () => t('interface:downloads.requestedReady');
  const key = offlineReadinessKey(catalogue, gameIDs());
  return () => {
    const label = t(key);
    if (!activationResult || activationResult.activated) return label;
    let active;
    try {
      active = readInstalledState().active;
    } catch {}
    return t(
      active?.scope === baseURL
        ? 'interface:downloads.readyLabel'
        : active
          ? 'interface:downloads.readyPreviousEdition'
          : 'interface:downloads.readyFinishSetup',
      { label },
    );
  };
}
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
async function estimates({ signal } = {}) {
  signal?.throwIfAborted();
  const sequence = ++estimateSequence;
  lastEstimate = null;
  $('download-game').disabled = true;
  const files = gameFiles();
  const report = await store.estimate(files, await store.inspect(files, { verify: true, signal }));
  signal?.throwIfAborted();
  if (sequence !== estimateSequence) return;
  const coreBytes = core.files.reduce((sum, file) => sum + file.bytes, 0);
  const launcherBytes = navigationRequest
    ? 0
    : core.files
        .filter((file) => file.path.startsWith('app/'))
        .reduce((sum, file) => sum + file.bytes, 0);
  // The edition worker caches URL entries, while official content deduplicates by
  // hash. The stable launcher is a separate scope. Count each actual transfer owner.
  const totalDownloadBytes = coreBytes + report.totalBytes;
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
  const remaining =
    report.remainingBytes + coreRemaining + (launcherHealth.status === 'ready' ? 0 : launcherBytes);
  lastEstimate = { ...report, remainingBytes: remaining };
  $('game-size').textContent =
    `Up to ${size(totalDownloadBytes + launcherBytes)} including runtime, ${navigationRequest ? '' : 'app launcher and '}original artwork; ${size(remaining)} remain. Allow ${size(report.requiredBytes + coreRemaining + launcherBytes)} additional storage while keeping an existing edition.${report.availableBytes === null ? ' Free space estimate unavailable.' : ` Estimated free: ${size(report.availableBytes)}.`} Actual network transfer may be smaller with compression.`;
  const setupComplete = ready && activationResult?.paused !== true;
  $('download-game').textContent = navigationRequest
    ? ready
      ? 'Open requested mode'
      : `${savedDownload ? 'Resume download' : 'Download'} and open · up to ${size(remaining)}`
    : setupComplete
      ? 'Offline setup complete'
      : `${savedDownload ? 'Resume' : 'Download selected'} · up to ${size(remaining)}`;
  $('download-game').disabled = Boolean(controller) || (!navigationRequest && setupComplete);
}
async function health({ verify = true, signal } = {}) {
  signal?.throwIfAborted();
  const sequence = ++healthSequence;
  const ids = gameIDs();
  const gameplay = await store.inspect(downloadFiles(catalogue, ids), { verify, signal });
  const runtime = await checkOffline({ signal });
  signal?.throwIfAborted();
  if (sequence !== healthSequence || JSON.stringify(ids) !== JSON.stringify(gameIDs())) return;
  runtimeHealth = runtime;
  ready =
    gameplay.ready &&
    runtime.status === 'ready' &&
    (Boolean(navigationRequest) || launcherHealth.status === 'ready');
  localizedText(
    $('game-status'),
    ready
      ? readyMessage()
      : gameplay.ready && runtime.status === 'ready'
        ? () => t('interface:downloads.launcherPending')
        : () => t('interface:downloads.chooseDownload'),
  );
  notifyHost('status', { text: $('game-status').textContent });
  $('details').textContent = JSON.stringify(
    { runtime, gameplay, launcher: launcherHealth },
    null,
    2,
  );
  const musicEstimate = await store.estimate(
    catalogue.files.filter((file) => file.kind === 'soundtrack'),
  );
  signal?.throwIfAborted();
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
  localizedText(
    $('all-music'),
    `Download all soundtracks · up to ${size(musicEstimate.remainingBytes)}`,
  );
  let count = 0;
  for (const file of catalogue.files.filter((file) => file.kind === 'soundtrack'))
    if ((await store.inspect([file], { verify, signal })).ready) count++;
  signal?.throwIfAborted();
  localizedText($('music-status'), () =>
    t('interface:downloads.soundtracksDownloaded', {
      count,
      total: catalogue.files.filter((file) => file.kind === 'soundtrack').length,
    }),
  );
  for (const [id, element] of albums) {
    const report = await store.estimate(downloadFiles(catalogue, [id]));
    signal?.throwIfAborted();
    localizedText(element, () =>
      t('interface:downloads.albumSize', {
        total: size(report.totalBytes),
        state: report.ready
          ? t('interface:downloads.readyOffline')
          : t('interface:downloads.remaining', { size: size(report.remainingBytes) }),
        required: size(report.requiredBytes),
      }),
    );
    albumDownloads.get(id).textContent =
      `${report.ready ? 'Downloaded' : 'Download / resume'} · up to ${size(report.remainingBytes)}`;
    albumDownloads.get(id).disabled = Boolean(controller) || report.ready;
  }
  if (sequence !== healthSequence) return;
  await estimates({ signal });
}
async function run(task, { music = false } = {}) {
  if (controller) return;
  controller = new AbortController();
  musicJob = music;
  busy(true);
  try {
    const message = await runApprovedDownload(task, {
      signal: controller.signal,
      onRetry: ({ attempt }) =>
        operation(() => t('interface:downloads.retrying', { attempt, total: 3 })),
    });
    operation(message ?? (() => t('interface:downloads.complete')));
  } catch (error) {
    if (error.name === 'AbortError' && !musicJob) {
      activationResult = { activated: false, paused: true };
      $('activate').hidden = true;
    }
    operation(
      error.name === 'AbortError'
        ? yieldedToPlay
          ? () => t('interface:downloads.pausedDuringGameplay')
          : () => t('interface:downloads.pausedMessage')
        : error.name === 'QuotaExceededError'
          ? () => t('interface:downloads.storageFull')
          : () => errorText(error),
    );
  } finally {
    controller = null;
    musicJob = false;
    busy(false);
    await health().catch((error) => operation(() => errorText(error)));
    if (requestedPackage && !gameIDs().includes(requestedPackage))
      await selectRequestedPackage(requestedPackage).catch((error) =>
        operation(() => errorText(error)),
      );
    if (yieldedToPlay && !playing.size && resumeApprovedGame && !document.hidden) {
      yieldedToPlay = false;
      void resumeApprovedGame();
    }
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
function pauseGameDownload() {
  resumeApprovedGame = null;
  yieldedToPlay = false;
  controller?.abort();
}
$('pause').onclick = pauseGameDownload;
$('cancel').onclick = () => (navigationRequest ? leaveDownloads() : pauseGameDownload());
$('pause-music').onclick = $('cancel-music').onclick = () => controller?.abort();
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    panelController.abort();
    pauseGameDownload();
  } else if (panelController.signal.aborted) panelController = new AbortController();
});
window.addEventListener('pagehide', (event) => {
  panelController.abort();
  pauseGameDownload();
  if (!event.persisted) {
    activity?.close();
    navigation.dispose();
  }
});
$('all-game').onchange = () => {
  resumeApprovedGame = null;
  yieldedToPlay = false;
  ready = false;
  lastEstimate = null;
  $('download-game').disabled = true;
  $('activate').hidden = true;
  void health().catch((error) => operation(() => errorText(error)));
};
$('download-game').onclick = () => {
  if (!lastEstimate || controller) return;
  const approval = { ids: [...gameIDs()], files: gameFiles(), all: $('all-game').checked };
  // This click approves exactly the displayed selection for this page session.
  savedDownload = true;
  void navigator.storage?.persist?.().catch(() => false);
  resumeApprovedGame = () => downloadApprovedGame(approval);
  return resumeApprovedGame();
};
function downloadApprovedGame(approval) {
  return run(async (signal) => {
    playing.clear();
    activity?.postMessage({ probe: true });
    if (activity) await new Promise((resolve) => setTimeout(resolve, 100));
    if (playing.size) {
      yieldedToPlay = true;
      throw new DOMException('Download yielded to gameplay.', 'AbortError');
    }
    signal.throwIfAborted();
    activity?.postMessage({ gameplayDownload: true });
    operation(() => t('interface:downloads.preparingRuntime'));
    const report = await prepareOffline({
      signal,
      cancelPreparation: true,
      onStatus: (state) => operation(() => offlineMessage(state, t)),
    });
    if (report.status !== 'ready')
      throw report.message
        ? Object.assign(new Error(report.message), { offlineCode: report.messageCode })
        : localError('interface:downloads.closeOtherWindows');
    const download = {
      edition,
      group: 'gameplay',
      selection: approval.ids,
      files: approval.files,
      baseURL,
      signal,
      onProgress: progress,
    };
    if (navigationRequest)
      await downloadOfflineDestination(store, { request: navigationRequest, ...download });
    else await store.download(download);
    if (navigationRequest) {
      operation(() => t('interface:downloads.verifyingDestination'));
      await continueOfflineDestination({
        request: navigationRequest,
        signal,
        verify: async (groups, options) => {
          const gameplay = await store.inspect(downloadFiles(catalogue, groups), {
            verify: true,
            ...options,
          });
          const runtime = await checkOffline(options);
          return { ready: gameplay.ready && runtime.status === 'ready' };
        },
        remember: (groups, options) => rememberInstalledPackages(baseURL, groups, options),
        navigate: (href) => location.assign(href),
      });
      resumeApprovedGame = null;
      yieldedToPlay = false;
      return () => t('interface:downloads.destinationVerified');
    }
    operation(() => t('interface:downloads.preparingLauncher'));
    launcherHealth = await prepareInstalledLauncher({ signal });
    signal.throwIfAborted();
    await health({ verify: true, signal });
    signal.throwIfAborted();
    if (!ready) throw localError('interface:downloads.preparationIncomplete');
    await selectEdition({ ids: approval.ids, all: approval.all, signal });
    resumeApprovedGame = null;
    yieldedToPlay = false;
    return () => t('interface:downloads.selectionReady');
  });
}
$('verify-game').onclick = () =>
  run(async (signal) => {
    launcherHealth = await checkInstalledLauncher({ timeout: 3000, signal });
    await health({ verify: true, signal });
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
    localizedText($('retention-status'), () => errorText(error));
  }
};
async function selectEdition({
  ids = gameIDs(),
  all = $('all-game').checked,
  signal = panelController.signal,
} = {}) {
  return finishOfflineSelection({
    signal,
    activate: async () => {
      const candidate = {
        version: catalogue.version,
        scope: baseURL,
        selection: ids,
        allGameplay: all,
      };
      await stageInstalledEdition(candidate);
      signal.throwIfAborted();
      const result = embedded
        ? await new Promise((resolve, reject) => {
            const channel = new MessageChannel();
            const cleanup = () => {
              clearTimeout(timer);
              signal.removeEventListener('abort', abort);
              channel.port1.close();
            };
            const abort = () => {
              cleanup();
              reject(signal.reason || new DOMException('App selection paused.', 'AbortError'));
            };
            const timer = setTimeout(() => {
              cleanup();
              resolve({
                activated: false,
                message:
                  'Game is downloaded. Reopen Offline play from the main menu to finish app selection.',
              });
            }, 10000);
            channel.port1.onmessage = (event) => {
              cleanup();
              resolve(event.data);
            };
            signal.addEventListener('abort', abort, { once: true });
            window.parent.postMessage(
              { format: panelProtocol, action: 'activate', candidate },
              location.origin,
              [channel.port2],
            );
          })
        : await activateInstalledEdition(candidate, {
            readAsset: readAssetStore,
            restorePrevious: new URL(location.href).searchParams.has('rollback'),
          });
      return result;
    },
    onReady(result) {
      activationResult = result;
      localizedText($('activation-status'), () => installedResultMessage(result, t));
      $('activate').hidden = result.activated;
      $('transfer-progress').hidden = result.activated || result.deferred === true;
      if (ready) {
        localizedText($('game-status'), readyMessage());
        notifyHost('status', { text: $('game-status').textContent });
      }
      if (ready && requestedPackage && ids.includes(requestedPackage)) {
        requestedPackage = null;
        notifyHost('packages-ready', { groups: ids });
      }
    },
  });
}
$('activate').onclick = () =>
  run(async (signal) => {
    await health({ verify: true, signal });
    signal.throwIfAborted();
    if (!ready) throw localError('interface:downloads.repairBeforeSelecting');
    const result = await selectEdition({ signal });
    return () => installedResultMessage(result, t);
  });
async function selectRequestedPackage(groupId) {
  const signal = panelController.signal;
  signal.throwIfAborted();
  if (!catalogue || controller) {
    requestedPackage = groupId;
    if (controller && musicJob) controller.abort();
    return;
  }
  const group = catalogue.groups.find((item) => item.id === groupId && item.kind === 'gameplay');
  if (!group) return;
  requestedPackage = groupId;
  selected.add(groupId);
  $('all-game').checked = false;
  for (const input of document.querySelectorAll('#chapters input'))
    input.checked = selected.has(input.dataset.group);
  ready = false;
  await health({ verify: true, signal });
  signal.throwIfAborted();
  if (ready) await selectEdition({ signal });
  else
    operation(() => t('interface:downloads.packageDownloadRequired', { title: groupTitle(group) }));
}
window.addEventListener('message', (event) => {
  if (
    !embedded ||
    event.origin !== location.origin ||
    event.source !== window.parent ||
    event.data?.format !== panelProtocol
  )
    return;
  if (event.data.action === 'select-package' && typeof event.data.groupId === 'string')
    void selectRequestedPackage(event.data.groupId).catch((error) => {
      if (error.name !== 'AbortError') operation(() => errorText(error));
    });
  if (event.data.action === 'host-ready') refreshInstall();
  if (event.data.action === 'panel-closed') {
    navigation.setVisible(false);
    requestedPackage = null;
    panelController.abort();
    pauseGameDownload();
  }
  if (event.data.action === 'panel-opened') {
    navigation.setVisible(true);
    if (panelController.signal.aborted) panelController = new AbortController();
  }
  if (event.data.action === 'panel-opened' && ready && !controller)
    void selectEdition().catch((error) => {
      localizedText($('activation-status'), () => errorText(error));
    });
});
async function initialize() {
  if (!available.available)
    throw Object.assign(new Error(available.reason), { offlineCode: available.messageCode });
  if (new URL(location.href).searchParams.has('rollback'))
    localizedText($('activate'), () => t('interface:downloads.restorePrevious'));
  [catalogue, core] = await Promise.all(
    ['offline-content.json', 'offline-cache.json'].map(async (path) => {
      const response = await fetch(new URL(path, baseURL));
      if (!response.ok) throw localError('interface:downloads.catalogueMissing');
      return response.json();
    }),
  );
  navigationRequest = readOfflineDestination({
    pageURL: location.href,
    scope: baseURL,
    catalogue,
    version: available.version,
  });
  if (navigationRequest) {
    if (embedded || !available.packageConsent)
      throw localError('interface:downloads.destinationUnavailable');
    $('destination-recovery').hidden = false;
    $('destination-title').textContent = navigationRequest.title;
    localizedText($('game-title'), () => t('interface:downloads.prepareRequestedMode'));
    $('starter-choice').hidden = true;
    $('all-game').parentElement.hidden = true;
    $('chapter-choices').hidden = true;
    $('remove-chapters').hidden = true;
    localizedText($('cancel'), () => t('interface:downloads.cancelReturn'));
  }
  const saved = (await store.states()).find(
    (state) =>
      state.edition === edition && state.group === (navigationRequest?.checkpoint || 'gameplay'),
  );
  savedDownload = Boolean(saved);
  const active = navigationRequest ? null : readInstalledState().active;
  const retained = saved || (active?.scope === baseURL ? active : null);
  if (retained?.selection) {
    retained.selection.forEach((id) => selected.add(id));
    $('all-game').checked =
      retained.allGameplay === true ||
      catalogue.groups
        .filter(
          (group) =>
            group.kind === 'gameplay' &&
            group.current !== false &&
            !['archive', 'tooling'].includes(group.category),
        )
        .every((group) => selected.has(group.id));
  }
  for (const group of catalogue.groups) {
    if (
      group.kind === 'gameplay' &&
      group.category !== 'destination' &&
      !['shared', 'base'].includes(group.id)
    ) {
      const label = document.createElement('label'),
        input = document.createElement('input');
      input.type = 'checkbox';
      input.dataset.group = group.id;
      input.checked = selected.has(group.id);
      input.onchange = () => {
        resumeApprovedGame = null;
        yieldedToPlay = false;
        if (input.checked) selected.add(group.id);
        else selected.delete(group.id);
        $('all-game').checked = false;
        ready = false;
        lastEstimate = null;
        $('download-game').disabled = true;
        $('activate').hidden = true;
        void health().catch((error) => operation(() => errorText(error)));
      };
      const caption = document.createElement('span');
      localizedText(caption, () =>
        group.category === 'archive'
          ? t('interface:downloads.archiveGroup', { title: groupTitle(group) })
          : group.category === 'tooling'
            ? t('interface:downloads.toolGroup', { title: groupTitle(group) })
            : groupTitle(group),
      );
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
      albumDownloads.set(group.id, download);
      actions.append(download, remove);
      row.append(title, status, actions);
      $('albums').append(row);
    }
  }
  busy(false);
  if (!navigationRequest) launcherHealth = await checkInstalledLauncher({ timeout: 1500 });
  if (requestedPackage) await selectRequestedPackage(requestedPackage);
  await health();
  if (savedDownload && !ready) operation(() => t('interface:downloads.previousIncomplete'));
  if (ready && !navigationRequest) await selectEdition();
}
void initialize().catch((error) => {
  localizedText($('game-status'), () => errorText(error));
});
