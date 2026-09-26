import { readAssetStore } from './storage.mjs';
import { offlineAvailability, prepareOffline, checkOffline } from './offline.mjs';
import { createOfficialDownloads } from './official-downloads.mjs';
import { downloadFiles } from './download-catalogue.mjs';
import {
  gameplaySelection,
  offlineReadinessLabel,
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
  prepareInstalledLauncher,
  checkInstalledLauncher,
  installedPresentation,
} from './installed-app.mjs';

const $ = (id) => document.getElementById(id);
const size = (bytes) => `${(bytes / 1048576).toFixed(1)} MiB`;
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
  panelController = new AbortController();
const embedded = new URL(location.href).searchParams.has('embedded') && window.parent !== window;
const panelProtocol = 'revealline.offline-panel.v1';
const notifyHost = (action, fields = {}) => {
  if (embedded)
    window.parent.postMessage({ format: panelProtocol, action, ...fields }, location.origin);
};
const navigation = attachDownloadsNavigation({
  onBack: () => (embedded ? notifyHost('close') : location.assign('./')),
});
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
const install = captureInstallPrompt();
function refreshInstall() {
  const installed = installedPresentation();
  $('installation-status').textContent = installed ? 'App installed' : 'Playing in the browser';
  $('install-native').hidden = embedded || !install?.available() || installed;
  $('install-guide').hidden = installed;
}
install?.subscribe(refreshInstall);
$('install-native').onclick = () => {
  void install
    .request()
    .then(refreshInstall)
    .catch((error) => {
      $('installation-status').textContent = error.message;
    });
};
const instructions = installInstructions();
for (const step of instructions.steps) {
  const item = document.createElement('li');
  item.textContent = step;
  $('install-steps').append(item);
}
$('install-help').textContent = instructions.note;
refreshInstall();
const source = createSoundtrackSource({
  catalogue: SOUNDTRACK_CATALOGUE,
  archives: SOUNDTRACK_ARCHIVES,
});
const operation = (message) => {
  $(musicJob ? 'music-operation-status' : 'operation-status').textContent = message;
};
const gameIDs = () =>
  gameplaySelection(catalogue, { all: $('all-game').checked, selected: [...selected] });
const gameFiles = () => downloadFiles(catalogue, gameIDs());
function readyMessage() {
  const label = offlineReadinessLabel(catalogue, gameIDs());
  if (!activationResult || activationResult.activated) return label;
  let active;
  try {
    active = readInstalledState().active;
  } catch {}
  return active?.scope === baseURL
    ? label
    : `${label} · ${active ? 'app icon keeps the previous edition' : 'finish app setup from the main menu'}`;
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
  const launcherBytes = core.files
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
    `Up to ${size(totalDownloadBytes + launcherBytes)} including runtime, app launcher and original artwork; ${size(remaining)} remain. Allow ${size(report.requiredBytes + coreRemaining + launcherBytes)} additional storage while keeping an existing edition.${report.availableBytes === null ? ' Free space estimate unavailable.' : ` Estimated free: ${size(report.availableBytes)}.`} Actual network transfer may be smaller with compression.`;
  const setupComplete = ready && activationResult?.paused !== true;
  $('download-game').textContent = setupComplete
    ? 'Offline setup complete'
    : `${savedDownload ? 'Resume' : 'Download selected'} · up to ${size(remaining)}`;
  $('download-game').disabled = Boolean(controller) || setupComplete;
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
  ready = gameplay.ready && runtime.status === 'ready' && launcherHealth.status === 'ready';
  $('game-status').textContent = ready
    ? readyMessage()
    : gameplay.ready && runtime.status === 'ready'
      ? 'Game files saved. Finish preparing the app launcher for offline launch.'
      : 'Choose what to download. Completed files are reused when you resume.';
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
  $('music-size').textContent =
    `${size(musicEstimate.totalBytes)} for all soundtracks · ${size(musicEstimate.remainingBytes)} remaining · allow ${size(musicEstimate.requiredBytes)} additional space.${musicEstimate.availableBytes === null ? '' : ` Estimated free: ${size(musicEstimate.availableBytes)}.`}`;
  $('all-music').textContent =
    `Download all soundtracks · up to ${size(musicEstimate.remainingBytes)}`;
  let count = 0;
  for (const file of catalogue.files.filter((file) => file.kind === 'soundtrack'))
    if ((await store.inspect([file], { verify, signal })).ready) count++;
  signal?.throwIfAborted();
  $('music-status').textContent =
    `Soundtracks: ${count} downloaded of ${catalogue.files.filter((file) => file.kind === 'soundtrack').length}.`;
  for (const [id, element] of albums) {
    const report = await store.estimate(downloadFiles(catalogue, [id]));
    signal?.throwIfAborted();
    element.textContent = `${size(report.totalBytes)} · ${report.ready ? 'Ready offline' : `${size(report.remainingBytes)} remaining`} · allow ${size(report.requiredBytes)} free space`;
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
        operation(`Connection interrupted. Retrying ${attempt}/3 with completed files kept…`),
    });
    operation(
      typeof message === 'string'
        ? message
        : 'Download complete. Verified files are saved on this device.',
    );
  } catch (error) {
    if (error.name === 'AbortError' && !musicJob) {
      activationResult = { activated: false, paused: true };
      $('activate').hidden = true;
    }
    operation(
      error.name === 'AbortError'
        ? yieldedToPlay
          ? 'Download paused during gameplay. The approved download resumes when you return to the menu.'
          : 'Download paused. Resume reuses verified files; only the interrupted file restarts.'
        : error.name === 'QuotaExceededError'
          ? 'Device storage is full. Completed files, saves and your working edition are kept. Free space, then resume.'
          : error.message,
    );
  } finally {
    controller = null;
    musicJob = false;
    busy(false);
    await health().catch((error) => operation(error.message));
    if (requestedPackage && !gameIDs().includes(requestedPackage))
      await selectRequestedPackage(requestedPackage).catch((error) => operation(error.message));
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
  operation(
    `${size(report.remainingBytes)} remaining · ${size(report.readyBytes)} verified and saved`,
  );
}
async function downloadAlbum(group, signal) {
  musicJob = true;
  playing.clear();
  activity?.postMessage({ probe: true });
  if (activity) await new Promise((resolve) => setTimeout(resolve, 100));
  signal.throwIfAborted();
  if (playing.size)
    throw new Error(
      'Soundtrack download paused while a game is active. Return after play to resume.',
    );
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
$('pause').onclick = $('cancel').onclick = pauseGameDownload;
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
  void health().catch((error) => operation(error.message));
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
    operation('Preparing the shared runtime…');
    const report = await prepareOffline({
      signal,
      cancelPreparation: true,
      onStatus: (state) =>
        operation(state.summary || state.message || 'Verifying the shared runtime…'),
    });
    if (report.status !== 'ready')
      throw new Error(
        report.message || 'Close other game windows, reopen, and resume runtime preparation.',
      );
    await store.download({
      edition,
      group: 'gameplay',
      selection: approval.ids,
      files: approval.files,
      baseURL,
      signal,
      onProgress: progress,
    });
    operation('Preparing and verifying the app launcher…');
    launcherHealth = await prepareInstalledLauncher({ signal });
    signal.throwIfAborted();
    await health({ verify: true, signal });
    signal.throwIfAborted();
    if (!ready)
      throw new Error('Offline preparation did not finish. Resume to repair the missing files.');
    await selectEdition({ ids: approval.ids, all: approval.all, signal });
    resumeApprovedGame = null;
    yieldedToPlay = false;
    return 'Your selected game is verified and ready offline. Recorded soundtracks remain optional.';
  });
}
$('verify-game').onclick = () =>
  run(async (signal) => {
    launcherHealth = await checkInstalledLauncher({ timeout: 3000, signal });
    await health({ verify: true, signal });
    if (!ready)
      throw new Error('Missing or damaged game files. Resume the game download to repair them.');
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
      throw new Error(
        'Uncheck All shipped gameplay and choose the chapters to remove. Shared game files stay available.',
      );
    const saved = (await store.states()).find(
      (state) => state.edition === edition && state.group === 'gameplay',
    );
    if (!saved) return 'There is no chapter download to remove.';
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
    return 'Chapter download selection updated. Saves, imported files, shared artwork and bytes referenced by prepared chapters are kept.';
  });
$('retain').onclick = async () => {
  try {
    $('retention-status').textContent = (await navigator.storage?.persist?.())
      ? 'Persistent storage granted. Keep backups of your progress.'
      : 'Persistence was not granted. Downloads still work; keep a backup and verify before travelling.';
  } catch (error) {
    $('retention-status').textContent = error.message;
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
      $('activation-status').textContent = result.message;
      $('activate').hidden = result.activated;
      $('transfer-progress').hidden = result.activated || result.deferred === true;
      if (ready) {
        $('game-status').textContent = readyMessage();
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
    if (!ready) throw new Error('Repair gameplay before selecting this edition.');
    return (await selectEdition({ signal })).message;
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
    operation(
      `${group.title} needs its chapter download. Review the size, then choose Download selected to continue.`,
    );
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
      if (error.name !== 'AbortError') operation(error.message);
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
      $('activation-status').textContent = error.message;
    });
});
async function initialize() {
  if (!available.available) throw new Error(available.reason);
  if (new URL(location.href).searchParams.has('rollback'))
    $('activate').textContent = 'Restore previous edition and its earlier progress';
  [catalogue, core] = await Promise.all(
    ['offline-content.json', 'offline-cache.json'].map(async (path) => {
      const response = await fetch(new URL(path, baseURL));
      if (!response.ok)
        throw new Error('This edition does not include an offline download catalogue.');
      return response.json();
    }),
  );
  const saved = (await store.states()).find(
    (state) => state.edition === edition && state.group === 'gameplay',
  );
  savedDownload = Boolean(saved);
  const active = readInstalledState().active;
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
    if (group.kind === 'gameplay' && !['shared', 'base'].includes(group.id)) {
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
        void health().catch((error) => operation(error.message));
      };
      label.append(
        input,
        document.createTextNode(
          `${group.title}${group.category === 'archive' ? ' · Archive (optional)' : group.category === 'tooling' ? ' · Extra tool (optional)' : ''}`,
        ),
      );
      $('chapters').append(label);
    } else if (group.kind === 'soundtrack') {
      const row = document.createElement('div'),
        title = document.createElement('h3'),
        status = document.createElement('p'),
        actions = document.createElement('div');
      row.className = 'album';
      actions.className = 'actions';
      title.textContent = group.title;
      const download = document.createElement('button'),
        remove = document.createElement('button');
      download.textContent = 'Download / resume';
      remove.textContent = 'Remove download';
      download.onclick = () => run((signal) => downloadAlbum(group, signal), { music: true });
      remove.onclick = () =>
        run(
          async () => {
            await store.remove('soundtracks', group.id);
            return 'Soundtrack download removed. Playlists, imported copies and gameplay are kept.';
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
  launcherHealth = await checkInstalledLauncher({ timeout: 1500 });
  if (requestedPackage) await selectRequestedPackage(requestedPackage);
  await health();
  if (savedDownload && !ready)
    operation(
      'A previous download is unfinished. Review the remaining size and tap Resume. Nothing downloads until you choose it.',
    );
  if (ready) await selectEdition();
}
void initialize().catch((error) => {
  $('game-status').textContent = error.message;
});
