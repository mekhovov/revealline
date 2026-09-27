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
  return (
    all
      ? currentGameplayGroups(catalogue)
      : catalogue.groups.filter((group) => group.kind === 'gameplay' && choices.has(group.id))
  ).map((group) => group.id);
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
export function offlineReadinessLabel(catalogue, ids) {
  return {
    gameReady: 'Game ready offline',
    chaptersReady: 'Selected chapters ready offline',
    soloStarterReady: 'Solo starter ready offline',
    baseReady: 'Base game ready offline',
  }[offlineReadinessCode(catalogue, ids)];
}

const OFFLINE_MESSAGE_CODES = new Set([
  'bundled',
  'development',
  'unsupported',
  'connecting',
  'checking',
  'downloading',
  'saving',
  'verifying',
  'stillRunning',
  'unconfirmed',
  'differentBuild',
  'unconfirmedBuild',
  'downloadFailed',
  'workerChanged',
  'workerMismatch',
  'verificationFailed',
  'prepareFirst',
  'waiting',
  'ready',
  'coreVerified',
]);
export function offlineMessage(value, translate) {
  const code = value?.offlineCode ?? value?.messageCode;
  const detail = value?.summary ?? value?.message ?? '';
  if (OFFLINE_MESSAGE_CODES.has(code)) return translate('interface:downloads.offline.' + code);
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
