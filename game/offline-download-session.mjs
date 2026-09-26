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
export function offlineReadinessLabel(catalogue, ids) {
  const selected = new Set(ids);
  if (currentGameplayGroups(catalogue).every((group) => selected.has(group.id)))
    return 'Game ready offline';
  const extra = ids.filter((id) => !['base', 'shared', 'solo:horizon-starter'].includes(id));
  return extra.length
    ? 'Selected chapters ready offline'
    : catalogue.format === 'revealline-offline-content.v2'
      ? 'Solo starter ready offline'
      : 'Base game ready offline';
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
