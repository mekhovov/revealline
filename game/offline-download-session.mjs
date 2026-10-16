/** Download consent lives only in this page session, never in persisted checkpoints. */
export function currentGameplayGroups(catalogue) {
  return catalogue.groups.filter(
    (group) =>
      group.kind === 'gameplay' &&
      group.current !== false &&
      !['archive', 'tooling'].includes(group.category),
  );
}
export function gameplaySelection(catalogue, { all = false, selected = [] } = {}) {
  const choices = new Set(['base', ...selected]);
  // All-current intent adds new current packages without dropping previously
  // chosen extras (SIM, archived chapters, tools). Music has its own consent.
  if (all) for (const group of currentGameplayGroups(catalogue)) choices.add(group.id);
  return catalogue.groups
    .filter((group) => group.kind === 'gameplay' && choices.has(group.id))
    .map((group) => group.id);
}
export function offlineReadinessCode(catalogue, ids) {
  const selected = new Set(ids);
  if (currentGameplayGroups(catalogue).every((group) => selected.has(group.id))) return 'gameReady';
  const extra = ids.filter((id) => !['base', 'shared', 'solo:horizon-starter'].includes(id));
  return extra.length
    ? 'chaptersReady'
    : catalogue.format === 'revealline-offline-content.v2'
      ? 'soloStarterReady'
      : 'baseReady';
}
const OFFLINE_READINESS_KEYS = Object.freeze({
  gameReady: 'interface:downloads.gameReady',
  chaptersReady: 'interface:downloads.chaptersReady',
  soloStarterReady: 'interface:downloads.soloStarterReady',
  baseReady: 'interface:downloads.baseReady',
});
export function offlineReadinessKey(catalogue, ids) {
  return OFFLINE_READINESS_KEYS[offlineReadinessCode(catalogue, ids)];
}
export function offlineReadinessLabel(catalogue, ids) {
  return {
    gameReady: 'Game ready offline',
    chaptersReady: 'Selected chapters ready offline',
    soloStarterReady: 'Solo starter ready offline',
    baseReady: 'Base game ready offline',
  }[offlineReadinessCode(catalogue, ids)];
}

const OFFLINE_MESSAGE_KEYS = Object.freeze({
  bundled: 'interface:downloads.offline.bundled',
  development: 'interface:downloads.offline.development',
  unsupported: 'interface:downloads.offline.unsupported',
  connecting: 'interface:downloads.offline.connecting',
  checking: 'interface:downloads.offline.checking',
  downloading: 'interface:downloads.offline.downloading',
  saving: 'interface:downloads.offline.saving',
  verifying: 'interface:downloads.offline.verifying',
  stillRunning: 'interface:downloads.offline.stillRunning',
  unconfirmed: 'interface:downloads.offline.unconfirmed',
  differentBuild: 'interface:downloads.offline.differentBuild',
  unconfirmedBuild: 'interface:downloads.offline.unconfirmedBuild',
  downloadFailed: 'interface:downloads.offline.downloadFailed',
  workerChanged: 'interface:downloads.offline.workerChanged',
  workerMismatch: 'interface:downloads.offline.workerMismatch',
  verificationFailed: 'interface:downloads.offline.verificationFailed',
  prepareFirst: 'interface:downloads.offline.prepareFirst',
  waiting: 'interface:downloads.offline.waiting',
  ready: 'interface:downloads.offline.ready',
  coreVerified: 'interface:downloads.offline.coreVerified',
});
export function offlineMessage(value, translate) {
  const code = value?.offlineCode ?? value?.messageCode;
  const detail = value?.summary ?? value?.message ?? '';
  const key =
    typeof code === 'string' && Object.hasOwn(OFFLINE_MESSAGE_KEYS, code)
      ? OFFLINE_MESSAGE_KEYS[code]
      : null;
  if (typeof key === 'string') return translate(key);
  if (detail) return translate('interface:downloads.unknownDetail', { detail });
  return translate('interface:downloads.unknownError');
}
export function downloadErrorMessage(error, translate) {
  const localization = error?.localization;
  if (typeof localization?.key === 'string') {
    const [namespace, messageKey, extra] = localization.key.split(':');
    const catalog = globalThis.RevealLineTranslations?.en?.[namespace];
    // Empty defaults are not a missing-key sentinel: the runtime rejects empty
    // translations. Only registered messages may replace an authored diagnostic.
    if (
      extra === undefined &&
      catalog &&
      Object.hasOwn(catalog, messageKey) &&
      typeof catalog[messageKey] === 'string'
    )
      return translate(localization.key, localization.values ?? Object.create(null));
  }
  if (error?.offlineCode || error?.messageCode) return offlineMessage(error, translate);
  const detail = error?.message;
  return detail
    ? translate('interface:downloads.unknownDetail', { detail })
    : translate('interface:downloads.unknownError');
}
export function installedResultMessage(result, translate) {
  if (result?.activated) return translate('interface:downloads.activationReady');
  if (result?.deferred) return translate('interface:downloads.activationDeferred');
  if (
    typeof result?.message === 'string' &&
    (result.message.includes('Bring progress from an earlier release') ||
      result.message.includes('Flight library'))
  )
    return translate('interface:downloads.transferInstructions');
  if (result?.message)
    return translate('interface:downloads.activationFailedDetail', { detail: result.message });
  return translate('interface:downloads.activationFailed');
}
/** Keep the requesting mission paused until safe icon selection has settled. */
export async function finishOfflineSelection({ activate, onReady, signal }) {
  signal?.throwIfAborted();
  let result;
  try {
    result = await activate(signal);
  } catch (error) {
    signal?.throwIfAborted();
    if (error?.name === 'AbortError') throw error;
    result = { activated: false, message: error.message };
  }
  signal?.throwIfAborted();
  onReady(result);
  return result;
}
export function transientDownloadFailure(error) {
  if (['AbortError', 'QuotaExceededError'].includes(error?.name)) return false;
  return (
    error?.name === 'TypeError' ||
    /network|failed to fetch|\bload failed\b|HTTP (408|429|5\d\d)/i.test(error?.message || '')
  );
}
const sleep = (delay, signal) =>
  new Promise((resolve, reject) => {
    const finish = () => {
      signal?.removeEventListener('abort', abort);
      resolve();
    };
    const timer = setTimeout(finish, delay);
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      reject(new DOMException('Download paused.', 'AbortError'));
    };
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
  });
/** The caller snapshots the approved selection. Retries only reuse that selection. */
export async function runApprovedDownload(
  work,
  { signal, onRetry = () => {}, delays = [1000, 3000, 7000], wait = sleep } = {},
) {
  for (let attempt = 0; ; attempt++) {
    signal?.throwIfAborted();
    try {
      return await work(signal);
    } catch (error) {
      if (!transientDownloadFailure(error) || attempt >= delays.length) throw error;
      onRetry({ attempt: attempt + 1, delay: delays[attempt] });
      await wait(delays[attempt], signal);
    }
  }
}
