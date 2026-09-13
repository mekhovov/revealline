import { discoverProfileTransfers, prepareProfileTransfer } from '../profile-transfer.mjs';

/** Explicit same-origin release copy. Source validation is read-only; all target
 * mutations use the library panel's existing complete-backup transaction. */
export function attachProfileTransferPanel({ api, container, backupOptions, task, applyPrepared }) {
  if (!api.profileTransfer) return null;
  const node = (tag, text, attrs = {}) => {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
    return element;
  };
  const details = node('details', null, { id: 'profile-transfer' });
  const summary = node('summary', 'Bring progress from an earlier release');
  const explanation = node(
    'p',
    'Copy a collection saved by an earlier release in this browser on this site. This replaces this release’s pictures, scores, preferences, installed packs and saved flight together. Export your current game-data backup first to keep both. The earlier release stays unchanged.',
    { class: 'micro-note' },
  );
  const source = node('select', null, { id: 'transfer-source', 'aria-label': 'Earlier release' });
  const review = node('button', 'Review saved progress', {
    id: 'transfer-review',
    type: 'button',
    class: 'button secondary',
  });
  const copy = node('button', 'Copy reviewed progress', {
    id: 'transfer-copy',
    type: 'button',
    class: 'button primary',
  });
  const cancel = node('button', 'Cancel check', {
    id: 'transfer-cancel',
    type: 'button',
    class: 'button secondary',
    hidden: '',
  });
  const preview = node('p', null, { id: 'transfer-preview' });
  const status = node('p', null, { id: 'transfer-status', role: 'status' });
  const fallback = node(
    'p',
    'Another browser, address, device or native app needs Export game data in the old game, then Import here. Keep picture originals in .rlmedia, stories in .rlstory and custom music in .rlsound alongside it; restore originals before game data. Close earlier game tabs before reviewing or copying.',
    { class: 'micro-note' },
  );
  details.append(summary, explanation, source, review, copy, cancel, preview, status, fallback);
  container.append(details);
  let reviewed = null,
    checking = false,
    controller = null;

  function showPreview(value) {
    const p = value.preview;
    preview.textContent = `${value.source.version} → ${api.profileTransfer.currentVersion}: ${p.completedLevels} completed maps · ${p.pictures} pictures · ${p.scores} score records · ${p.campaigns} campaigns · ${p.packs} packs · ${p.hasSession ? 'one saved flight' : 'no saved flight'}. ${p.profileAbsent ? 'This release has a saved flight but no saved player profile. Copy includes an empty collection and default preferences. ' : ''}${p.missingPackIds.length ? `Some collected pictures need removed packs: ${p.missingPackIds.join(', ')}. Their records will be preserved.` : ''}`;
  }
  function refresh() {
    if (checking) return;
    try {
      const selected = source.value;
      const candidates = discoverProfileTransfers(api.profileTransfer);
      source.replaceChildren(
        ...candidates.map((candidate) => {
          const option = node(
            'option',
            `${candidate.version}${candidate.legacy ? ' (legacy)' : candidates.filter((c) => c.version === candidate.version).length > 1 ? ` (${candidate.channel})` : ''} · needs review`,
          );
          option.value = candidate.id;
          return option;
        }),
      );
      if (candidates.some((c) => c.id === selected)) source.value = selected;
      if (reviewed?.source.id !== source.value) {
        reviewed = null;
        preview.textContent = '';
      }
      source.disabled = review.disabled = !candidates.length;
      copy.disabled = !reviewed;
      if (!candidates.length)
        status.textContent =
          'No compatible earlier collection was found at this address. Use a game-data backup file to transfer from another location.';
    } catch (error) {
      source.disabled = review.disabled = copy.disabled = true;
      status.textContent = error.message;
    }
  }
  source.onchange = () => {
    reviewed = null;
    preview.textContent = '';
    status.textContent = 'Review this source before copying.';
    copy.disabled = true;
  };
  cancel.onclick = () => controller?.abort();
  async function check(andCopy) {
    await task('transfer-status', async () => {
      checking = true;
      controller = new AbortController();
      cancel.hidden = false;
      cancel.disabled = false;
      status.textContent = 'Checking the earlier collection, images and saved flight…';
      try {
        const fresh = await prepareProfileTransfer(source.value, {
          ...api.profileTransfer,
          ...(await backupOptions()),
          signal: controller.signal,
        });
        const unchanged =
          reviewed &&
          reviewed.source.id === fresh.source.id &&
          reviewed.fingerprint === fresh.fingerprint;
        reviewed = fresh;
        showPreview(fresh);
        if (!andCopy || !unchanged) {
          status.textContent = andCopy
            ? 'The source changed since your review. The summary is updated; review it before choosing Copy again. This release has not changed.'
            : 'Verified. Copy replaces this release’s collection with the reviewed source. Undo is offered when the current collection can be verified.';
          return;
        }
        controller = null;
        cancel.disabled = true;
        cancel.hidden = true;
        status.textContent = 'Copying the verified collection…';
        const result = await applyPrepared(fresh.prepared);
        status.textContent = `Copied from ${fresh.source.version}. ${result.undo ? 'Undo game-data import restores the previous collection.' : 'The previous collection could not form a verified backup; Undo is unavailable.'} ${fresh.preview.hasSession ? 'Your saved flight is ready to load, paused.' : ''} ${result.warning || ''}`;
        reviewed = null;
      } finally {
        controller = null;
        cancel.hidden = true;
        cancel.disabled = true;
        checking = false;
      }
    });
  }
  review.onclick = () => check(false);
  copy.onclick = () => check(true);
  refresh();
  return { refresh };
}
