import { localizedMessage, localizedText, t, localizedAttribute } from '../i18n/index.mjs';
import { discoverProfileTransfers, prepareProfileTransfer } from '../profile-transfer.mjs';

/** Explicit same-origin release copy. Source validation is read-only; all target
 * mutations use the library panel's existing complete-backup transaction. */
export function attachProfileTransferPanel({ api, container, backupOptions, task, applyPrepared }) {
  if (!api.profileTransfer) return null;
  const node = (tag, text, attrs = {}) => {
    const element = document.createElement(tag);
    if (text) localizedText(element, () =>text);
    for (const [key, value] of Object.entries(attrs)) {
      if (['aria-label', 'title', 'placeholder', 'alt'].includes(key)) localizedAttribute(element, key, value);
      else element.setAttribute(key, value);
    }
    return element;
  };
  const details = node('details', null, { id: 'profile-transfer' });
  const summary = node('summary', localizedMessage("interface:bringProgressFromAnEarlierRelease"));
  const explanation = node(
    'p',
    localizedMessage("interface:copyACollectionSavedByAnEarlierReleaseInThis"),
    { class: 'micro-note' },
  );
  const source = node('select', null, { id: 'transfer-source', 'aria-label': localizedMessage("interface:earlierRelease") });
  const review = node('button', localizedMessage("interface:reviewSavedProgress"), {
    id: 'transfer-review',
    type: 'button',
    class: 'button secondary',
  });
  const copy = node('button', localizedMessage("interface:copyReviewedProgress"), {
    id: 'transfer-copy',
    type: 'button',
    class: 'button primary',
  });
  const cancel = node('button', localizedMessage("interface:cancelCheck"), {
    id: 'transfer-cancel',
    type: 'button',
    class: 'button secondary',
    hidden: '',
  });
  const preview = node('p', null, { id: 'transfer-preview' });
  const status = node('p', null, { id: 'transfer-status', role: 'status' });
  const fallback = node(
    'p',
    localizedMessage("interface:anotherBrowserAddressDeviceOrNativeAppNeedsExportGame"),
    { class: 'micro-note' },
  );
  details.append(summary, explanation, source, review, copy, cancel, preview, status, fallback);
  container.append(details);
  let reviewed = null,
    checking = false,
    controller = null;

  function showPreview(value) {
    const p = value.preview;
    localizedText(preview, () =>t("gameplay:completedMapsPicturesScoreRecordsCampaignsPacks", { value1: value.source.version, value2: api.profileTransfer.currentVersion, value3: p.completedLevels, value4: p.pictures, value5: p.scores, value6: p.campaigns, value7: p.packs, value8: p.hasSession ? 'one saved flight' : 'no saved flight', value9: p.profileAbsent ? ("" + t("interface:thisReleaseHasASavedFlightButNoSavedPlayer") + " ") : '', value10: p.missingPackIds.length ? t("gameplay:someCollectedPicturesNeedRemovedPacksTheirRecordsWillBe", { value1: p.missingPackIds.join(', ') }) : '' }));
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
            localizedMessage("gameplay:needsReview", { value1: candidate.version, value2: candidate.legacy ? ' (legacy)' : candidates.filter((c) => c.version === candidate.version).length > 1 ? ` (${candidate.channel})` : '' }),
          );
          option.value = candidate.id;
          return option;
        }),
      );
      if (candidates.some((c) => c.id === selected)) source.value = selected;
      if (reviewed?.source.id !== source.value) {
        reviewed = null;
        localizedText(preview, () =>'');
      }
      source.disabled = review.disabled = !candidates.length;
      copy.disabled = !reviewed;
      if (!candidates.length)
        localizedText(status, () =>t("interface:noCompatibleEarlierCollectionWasFoundAtThisAddressUse"));
    } catch (error) {
      source.disabled = review.disabled = copy.disabled = true;
      localizedText(status, () =>error.message);
    }
  }
  source.onchange = () => {
    reviewed = null;
    localizedText(preview, () =>'');
    localizedText(status, () =>t("interface:reviewThisSourceBeforeCopying"));
    copy.disabled = true;
  };
  cancel.onclick = () => controller?.abort();
  async function check(andCopy) {
    await task('transfer-status', async () => {
      checking = true;
      controller = new AbortController();
      cancel.hidden = false;
      cancel.disabled = false;
      localizedText(status, () =>t("interface:checkingTheEarlierCollectionImagesAndSavedFlight"));
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
          localizedText(status, () =>andCopy
            ? t("interface:theSourceChangedSinceYourReviewTheSummaryIsUpdated")
            : t("interface:verifiedCopyReplacesThisReleaseSCollectionWithTheReviewed"));
          return;
        }
        controller = null;
        cancel.disabled = true;
        cancel.hidden = true;
        localizedText(status, () =>t("interface:copyingTheVerifiedCollection"));
        const result = await applyPrepared(fresh.prepared);
        localizedText(status, () =>t("gameplay:copiedFrom", { value1: fresh.source.version, value2: result.undo ? t("interface:undoGameDataImportRestoresThePreviousCollection") : t("interface:thePreviousCollectionCouldNotFormAVerifiedBackupUndo"), value3: fresh.preview.hasSession ? t("interface:yourSavedFlightIsReadyToLoadPaused") : '', value4: result.warning || '' }));
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
