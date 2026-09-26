import { t } from '../i18n/index.mjs';

const exactKeys = Object.freeze({
  'Soundtrack store is closed.': 'errors:soundtrack.storeClosed',
  'This browser does not provide soundtrack storage.': 'errors:soundtrack.storageUnavailable',
  'Soundtrack storage could not open.': 'errors:soundtrack.storageOpenFailed',
  'Close older game tabs to open soundtrack storage.': 'errors:soundtrack.closeOlderTabs',
  'Soundtrack transaction failed.': 'errors:soundtrack.transactionFailed',
  'Network cleanup is still pending. Late album data will be discarded; no draft was added.':
    'errors:soundtrack.album.cleanupPending',
  'Album downloads need a version-local HTTP origin.': 'errors:soundtrack.album.localOrigin',
  'Album download escaped its version path.': 'errors:soundtrack.album.versionPath',
  'Album download needs direct HTTP 200 at its declared URL.':
    'errors:soundtrack.album.directResponse',
  'Album download size header differs or exceeds its limit.': 'errors:soundtrack.album.sizeHeader',
  'Album download requires bounded streaming.': 'errors:soundtrack.album.boundedStreaming',
  'Album download returned invalid bytes.': 'errors:soundtrack.album.invalidBytes',
  'Album download exceeded its declared size.': 'errors:soundtrack.album.sizeExceeded',
  'Album download was truncated.': 'errors:soundtrack.album.truncated',
  'Invalid album cleanup deadline.': 'errors:soundtrack.album.cleanupDeadline',
  'Invalid album download deadline.': 'errors:soundtrack.album.downloadDeadline',
  'Album download or verification timed out. Try again.': 'errors:soundtrack.album.timeout',
  'Album download hash differs from its catalog.': 'errors:soundtrack.album.hashMismatch',
  'Album metadata differs from its catalog.': 'errors:soundtrack.album.metadataMismatch',
  'This recording is missing locally. Restore its complete soundtrack backup.':
    'errors:soundtrack.recordingMissing',
  'Installed only is on. Download this album before listening offline.':
    'errors:soundtrack.installedOnly',
  'Downloaded recording differs from its pinned catalogue original.':
    'errors:soundtrack.recordingMismatch',
  'This album is not in the library. Add it to the draft first.':
    'errors:soundtrack.album.notInLibrary',
  'This album has a conflicting recording identity; its existing tracks were preserved.':
    'errors:soundtrack.album.identityConflict',
  'Combined soundtrack exceeds the managed byte limit.': 'errors:soundtrack.storageLimit',
  'Some recordings are unavailable. Use Download again for permitted albums or restore their originals.':
    'errors:soundtrack.recordingsUnavailable',
  'No tracks in this playlist are installed. Download its recordings first.':
    'errors:soundtrack.playlistNotInstalled',
  'Album recordings are not downloaded. Use Download again in Community soundtracks.':
    'errors:soundtrack.album.notDownloaded',
});

export function soundtrackErrorText(error) {
  if (error?.localization?.key)
    return t(error.localization.key, error.localization.values ?? Object.create(null));
  if (error?.name === 'AbortError') return t('interface:cancelled');
  const fallback = error?.message || String(error);
  const key = exactKeys[fallback];
  return key ? t(key) : fallback;
}
