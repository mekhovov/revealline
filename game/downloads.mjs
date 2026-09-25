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

const $ = (id) => document.getElementById(id);
const size = (bytes) => `${(bytes / 1048576).toFixed(1)} MiB`;
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
  $(musicJob ? 'music-operation-status' : 'operation-status').textContent = message;
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
  $('game-size').textContent =
    `${size(totalDownloadBytes)} download, including the shared runtime and original artwork; up to ${size(report.totalBytes + coreBytes)} stored on this device. Up to ${size(report.remainingBytes + coreRemaining)} remain. Allow ${size(report.requiredBytes + coreRemaining)} additional storage while keeping an existing edition.${report.availableBytes === null ? ' Free space estimate unavailable.' : ` Estimated free: ${size(report.availableBytes)}.`}`;
}
async function health({ verify = true } = {}) {
  const gameplay = await store.inspect(gameFiles(), { verify });
  const runtime = await checkOffline();
  runtimeHealth = runtime;
  ready = gameplay.ready && runtime.status === 'ready';
  $('game-status').textContent = ready
    ? $('all-game').checked
      ? 'Game ready offline'
      : 'Selected chapters ready offline'
    : 'Game download is incomplete. Resume downloads or verify to repair missing files.';
  $('activate').hidden = !ready;
  $('details').textContent = JSON.stringify({ runtime, gameplay }, null, 2);
  const musicEstimate = await store.estimate(
    catalogue.files.filter((file) => file.kind === 'soundtrack'),
  );
  $('music-size').textContent =
    `${size(musicEstimate.totalBytes)} for all soundtracks · ${size(musicEstimate.remainingBytes)} remaining · allow ${size(musicEstimate.requiredBytes)} additional space.${musicEstimate.availableBytes === null ? '' : ` Estimated free: ${size(musicEstimate.availableBytes)}.`}`;
  let count = 0;
  for (const file of catalogue.files.filter((file) => file.kind === 'soundtrack'))
    if ((await store.inspect([file], { verify })).ready) count++;
  $('music-status').textContent =
    `Soundtracks: ${count} downloaded of ${catalogue.files.filter((file) => file.kind === 'soundtrack').length}.`;
  for (const [id, element] of albums) {
    const report = await store.estimate(downloadFiles(catalogue, [id]));
    element.textContent = `${size(report.totalBytes)} · ${report.ready ? 'Ready offline' : `${size(report.remainingBytes)} remaining`} · allow ${size(report.requiredBytes)} free space`;
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
    operation(
      typeof message === 'string'
        ? message
        : 'Download complete. Verified files are saved on this device.',
    );
  } catch (error) {
    operation(
      error.name === 'AbortError'
        ? 'Download paused. Resume reuses verified files; only the interrupted file restarts.'
        : error.name === 'QuotaExceededError'
          ? 'Device storage is full. Completed files, saves and your working edition are kept. Free space, then resume.'
          : error.message,
    );
  } finally {
    controller = null;
    musicJob = false;
    busy(false);
    await health().catch((error) => operation(error.message));
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
    operation('Preparing the shared runtime…');
    const report = await prepareOffline({
      signal,
      cancelPreparation: true,
      onStatus: (state) => operation(state.message || 'Verifying the shared runtime…'),
    });
    if (report.status !== 'ready')
      throw new Error(
        report.message || 'Close other game windows, reopen, and resume runtime preparation.',
      );
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
$('activate').onclick = () =>
  run(async () => {
    await health({ verify: true });
    if (!ready) throw new Error('Verify and repair gameplay before selecting this edition.');
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
    if (!worker) throw new Error('Launcher installation has not started. Retry preparation.');
    if (worker?.state !== 'activated')
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          worker?.removeEventListener('statechange', changed);
          reject(new Error('Close the launcher window and retry after its update activates.'));
        }, 30000);
        const changed = () => {
          if (worker.state === 'activated' || worker.state === 'redundant') {
            clearTimeout(timer);
            worker.removeEventListener('statechange', changed);
            worker.state === 'activated'
              ? resolve()
              : reject(new Error('Launcher installation failed.'));
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
    $('activation-status').textContent = result.activated
      ? result.message
      : 'Edition downloaded. Open Classic using the link below, then More → Scores & saves → Saves & loads → Bring progress from an earlier release. Review and copy, then return here to switch. An incompatible saved flight or a busy profile keeps your working edition selected.';
    $('transfer-progress').hidden = result.activated;
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
      label.append(input, document.createTextNode(group.title));
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
      actions.append(download, remove);
      row.append(title, status, actions);
      $('albums').append(row);
    }
  }
  busy(false);
  await health();
}
void initialize().catch((error) => {
  $('game-status').textContent = error.message;
});
