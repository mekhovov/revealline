import { contentText } from '../i18n/content.mjs';
import { t, localizedText, localizedAttribute, localizedMessage } from '../i18n/index.mjs';
import { createOperationStatus } from './operation-status.mjs';
import { captureOperationFocus } from './operation-focus.mjs';
import { attachFocusClearance } from './focus-clearance.mjs';
import { canonicalJSON } from '../data-json.mjs';
import { createMediaIdentityCatalog, MEDIA_PRESENTATION_FORMAT } from '../media-library.mjs';
import { prepareStillAsset } from '../media-still.mjs';
import { snapshotPictureChoice } from '../presentation-pins.mjs';
import { createStillStoryPanel } from './still-story-panel.mjs';
import {
  exportMediaBundle,
  importMediaBundle,
  prepareMediaBundleRestore,
  commitMediaBundleRestore,
} from '../media-bundle.mjs';

/** Administrative still/story assignments. No game, profile or Collection API. */
export function attachStillMediaPanel({
  document: doc = document,
  store,
  catalog,
  preview,
  onClose = () => {},
  onSaved = () => {},
  onLoaded = () => {},
  decodeImage,
  URLImpl = globalThis.URL,
  makeId = () => `still-${crypto.randomUUID()}`,
  storyStore,
  storyInspection,
  onStorySaved,
  makeStoryId = () => `story-${crypto.randomUUID()}`,
  requestStoryDownload,
}) {
  const node = (tag, id, text = '') => {
    const value = doc.createElement(tag);
    value.id = `still-media-${id}`;
    localizedText(value, () => text);
    return value;
  };
  const dialog = node('dialog', 'dialog');
  dialog.setAttribute('aria-labelledby', 'still-media-title');
  dialog.className = 'still-media-panel';
  const title = node('h2', 'title', localizedMessage('interface:stillPictureWorkshop'));
  const note = node(
    'p',
    'note',
    localizedMessage('interface:saveExactMapWorldAssignmentsForFreshFlightsExistingSaved'),
  );
  const status = node(
    'p',
    'status',
    localizedMessage('interface:openToVerifySavedOriginalsAndTheSourceGameS'),
  );
  status.setAttribute('role', 'status');
  const initialStatus = status.textContent;
  const feedback = createOperationStatus(status);
  let activity = null;
  function setStatus(message, state = 'ready') {
    if (activity) activity.update({ message, progress: null });
    else feedback.begin({ message }).finish({ message, state });
  }
  setStatus(initialStatus);

  const stats = node('p', 'stats');
  const fields = node('div', 'fields');
  const control = (tag, id, label, attrs = {}, parent = fields) => {
    const field = node(tag, id);
    for (const [key, value] of Object.entries(attrs)) {
      if (['aria-label', 'title', 'placeholder', 'alt'].includes(key))
        localizedAttribute(field, key, value);
      else field.setAttribute(key, value);
    }
    const wrapper = node('label', `${id}-label`, label);
    wrapper.append(field);
    parent.append(wrapper);
    return field;
  };
  const campaign = control('select', 'campaign', t('interface:installedChapter'));
  const level = control('select', 'level', t('interface:map'));
  const theme = control('select', 'theme', t('interface:world'));
  const history = control('select', 'history', t('interface:savedPictureRevision'));
  const file = control('input', 'file', t('interface:originalPngOrJpeg4MibMaximum'), {
    type: 'file',
    accept: 'image/png,image/jpeg',
  });
  const kind = control('select', 'kind', t('interface:declaredSource'));
  for (const [id, label] of [
    ['user-supplied', t('interface:myUploadedFile')],
    ['original', t('interface:originalArtwork')],
    ['licensed', t('interface:licensedArtwork')],
  ]) {
    const option = node('option', `source-${id}`, label);
    option.value = id;
    kind.append(option);
  }
  kind.value = 'user-supplied';
  const credit = control('input', 'credit', t('interface:credit'), {
    type: 'text',
    maxlength: '512',
  });
  const source = control('input', 'source', t('interface:sourceProvenanceNote'), {
    type: 'text',
    maxlength: '2048',
  });
  const description = control('input', 'description', t('interface:pictureDescription'), {
    type: 'text',
    maxlength: '2048',
  });
  const operations = node('div', 'operations');
  operations.append(status);
  const actions = node('div', 'actions');
  const button = (id, text, fn, parent = actions) => {
    const item = node('button', id, text);
    item.type = 'button';
    item.onclick = fn;
    parent.append(item);
    return item;
  };
  const inspect = button('preview', localizedMessage('interface:previewChosenFile'), () =>
    upload(),
  );
  const showSaved = button('show-saved', localizedMessage('interface:previewSavedRevision'), () =>
    savedPreview(false, showSaved),
  );
  const showAuthored = button(
    'show-authored',
    localizedMessage('interface:previewAuthoredPicture'),
    () => savedPreview(true, showAuthored),
  );
  const save = button('save', localizedMessage('interface:saveAssignment'), () => commit(false));
  const unassign = button('unassign', localizedMessage('interface:useAuthoredPicture'), () =>
    commit(true),
  );
  const discard = button('discard', localizedMessage('interface:discardDraft'), () => {
    draft = null;
    sync();
    return savedPreview(true);
  });
  const reload = button(
    'reload',
    localizedMessage('interface:reloadSavedMediaAndInstalledMaps'),
    () => load(),
  );
  const cancel = button(
    'cancel',
    localizedMessage('interface:cancelPendingWork'),
    () => cancelWork(),
    operations,
  );
  const close = button(
    'close',
    localizedMessage('interface:closeWorkshop'),
    () => closePanel(),
    operations,
  );
  const bundleSection = node('section', 'bundles'),
    bundleTitle = node('h3', 'bundle-title', localizedMessage('interface:originalPictureFiles')),
    bundleNote = node(
      'p',
      'bundle-note',
      localizedMessage('interface:aRlmediaFileIncludesEveryReferencedStillOriginalRetainedGeneric'),
    ),
    bundleFields = node('div', 'bundle-fields');
  const bundleFile = control(
    'input',
    'bundle-file',
    t('interface:originalsBackupRlmediaAtMost256Mib'),
    { type: 'file', accept: '.rlmedia,application/vnd.revealline.media' },
    bundleFields,
  );
  const bundleMode = control(
    'select',
    'bundle-mode',
    t('interface:assignmentRestorePolicy'),
    {},
    bundleFields,
  );
  options(
    bundleMode,
    [
      ['preserve', t('interface:keepCurrentAssignmentsAddMissingBindings')],
      ['restore', t('interface:useTheBundleSExactAssignmentSet')],
    ],
    'preserve',
  );
  const bundlePolicy = node('p', 'bundle-policy'),
    bundleReview = node(
      'p',
      'bundle-review',
      localizedMessage('interface:noOriginalsBackupHasBeenReviewed'),
    ),
    bundleActions = node('div', 'bundle-actions');
  const bundleButton = (id, text, handler) => {
    const item = node('button', id, text);
    item.type = 'button';
    item.onclick = handler;
    bundleActions.append(item);
    return item;
  };
  const prepareOriginals = bundleButton(
    'prepare-originals',
    t('interface:prepareOriginalsDownload'),
    () => prepareDownload(),
  );
  const downloadOriginals = node(
    'a',
    'download-originals',
    localizedMessage('interface:downloadOriginals'),
  );
  downloadOriginals.hidden = true;
  bundleActions.append(downloadOriginals);
  const reviewOriginals = bundleButton(
    'review-originals',
    t('interface:reviewChosenOriginalsBackup'),
    () => reviewBundle(),
  );
  const restoreOriginals = bundleButton(
    'restore-originals',
    t('interface:restoreReviewedOriginals'),
    () => restoreBundle(),
  );
  bundleSection.append(
    bundleTitle,
    bundleNote,
    bundleFields,
    bundlePolicy,
    bundleReview,
    bundleActions,
  );
  const canvas = preview.canvas;
  canvas.id = 'still-media-preview-canvas';
  canvas.setAttribute('aria-label', t('interface:isolatedStillPicturePreviewNoGameplayOrRewards'));
  dialog.append(title, operations, note, stats, fields, canvas, actions, bundleSection);
  doc.body.append(dialog);
  const clearance = attachFocusClearance({
    container: dialog,
    heading: operations,
    includeControlLabel: true,
    document: doc,
  });
  let saved = null,
    context = null,
    identityCatalog = null,
    entries = [],
    draft = null,
    task = null,
    serial = 0,
    disposed = false,
    ready = false,
    returnFocus = null,
    bundleURL = null,
    reviewedBundle = null;
  const story = storyStore
    ? createStillStoryPanel({
        doc,
        store,
        storyStore,
        work: (text, action, focusOptions) =>
          work(
            text,
            async (signal, check) => {
              await action(signal, check);
              check();
              setStatus(story.statusText());
            },
            focusOptions,
          ),
        cancelWork,
        getSelection: storySelection,
        catalog,
        URLImpl,
        inspection: storyInspection,
        onCaptured: capturedDraft,
        onSaved: onStorySaved,
        makeId: makeStoryId,
        requestDownload: requestStoryDownload,
      })
    : null;
  if (story) dialog.append(story.section);

  function storySelection() {
    const selected = current();
    if (!selected) return { ticket: context, saved };
    const p =
      (!draft || draft.existing) &&
      saved.document.library.presentations.find(
        (p) =>
          JSON.stringify([p.id, p.revision]) === history.value &&
          canonicalJSON(p.identity) === canonicalJSON(selected.identity),
      );
    const asset = p && saved.document.library.assets.find((a) => a.id === p.poster.assetId);
    const assignment = saved.document.library.assignments.find(
      (a) => canonicalJSON(a.identity) === canonicalJSON(selected.identity),
    );
    return {
      ...selected,
      saved,
      ticket: context,
      pin: asset
        ? snapshotPictureChoice({
            kind: 'still',
            identity: p.identity,
            presentationId: p.id,
            presentationRevision: p.revision,
            assetId: asset.id,
            sha256: asset.sha256,
          })
        : null,
      caption: p
        ? t('gameplay:revision', { value1: contentText(p, 'description'), value2: p.revision })
        : '',
      assigned: !!p && assignment?.presentationId === p.id && assignment?.revision === p.revision,
      provenance: { kind: kind.value, credit: credit.value, source: source.value },
      description: description.value,
    };
  }
  async function capturedDraft(captured, selected, signal, check) {
    if (!selected.description?.trim() || selected.description.length > 2048)
      throw new Error(t('interface:addAPictureDescriptionBeforeCapturing'));
    const shown = await preview.show(view(selected, captured.asset, captured.blob), { signal });
    check();
    if (!shown) throw new Error(t('interface:previewCancelledThePriorPictureIsKept'));
    discardBundles();
    draft = {
      asset: captured.asset,
      blob: captured.blob,
      identity: selected.identity,
      description: selected.description,
    };
    setStatus(t('interface:capturedOriginalPngIsAPictureDraftChooseSaveAssignment'));
    // The child deliberately adopts this one verified selection transition only
    // after its stale guard has passed; ordinary changes still cancel it.
    return storySelection();
  }
  function discardBundles() {
    if (bundleURL !== null) URLImpl.revokeObjectURL(bundleURL);
    bundleURL = null;
    reviewedBundle = null;
    downloadOriginals.hidden = true;
    downloadOriginals.removeAttribute('href');
    downloadOriginals.removeAttribute('download');
    localizedText(bundleReview, () => t('interface:noOriginalsBackupHasBeenReviewed'));
  }
  function message(error) {
    return error instanceof Error ? error.message : String(error);
  }
  function cancelWork() {
    feedback.clear();
    activity = null;
    if (task) ready = false;
    ++serial;
    task?.abort();
    task = null;
    discardBundles();
    story?.cancel();
    setStatus(t('interface:pendingWorkCancelledAnyCompletedSaveStaysSavedReloadTo'), 'cancelled');
    sync();
  }
  function sync() {
    const busy = !!task;
    for (const item of [campaign, level, theme, history, file, kind, credit, source, description])
      item.disabled = busy || !ready;
    inspect.disabled = busy || !ready || !file.files?.length;
    showSaved.disabled = busy || !ready || !history.value;
    showAuthored.disabled = busy || !ready || !current();
    save.disabled = busy || !ready || !draft;
    unassign.disabled = busy || !ready || !current();
    discard.disabled = busy || !ready || !draft;
    reload.disabled = busy;
    cancel.disabled = !busy;
    close.disabled = false;
    bundleFile.disabled = bundleMode.disabled = busy || !ready;
    prepareOriginals.disabled = busy || !ready;
    reviewOriginals.disabled = busy || !ready || !bundleFile.files?.[0];
    restoreOriginals.disabled = busy || !ready || !reviewedBundle;
    downloadOriginals.hidden = !bundleURL || busy;
    localizedText(bundlePolicy, () =>
      bundleMode.value === 'restore'
        ? t('interface:useExactlyTheAssignmentsInThisFileIncludingRemovingCurrent')
        : t('interface:keepDestinationAssignmentsWhenTheyConflictAndAddOnlyMissing'),
    );
    localizedText(stats, () =>
      saved
        ? t('gameplay:retainedImageRecordsImmutableRevisionsSavedGeneration', {
            value1: saved.document.library.assets.length,
            value2: saved.document.library.presentations.length,
            value3: saved.generation,
          })
        : t('interface:noVerifiedSavedMediaLoaded'),
    );
    story?.sync({ ready, busy });
  }
  function current() {
    const entry = entries.find((e) => e.baseCampaignKey === campaign.value);
    const map = entry?.campaign.levels.find((l) => l.id === level.value);
    const world = entry?.themes.find((t) => t.id === theme.value);
    if (!entry || !map || !world) return null;
    const request = {
      executionKey: entry.executionKey,
      levelId: map.id,
      levelRevision: map.revision,
      themeId: world.id,
    };
    return { entry, map, world, request, identity: identityCatalog.resolve(request) };
  }
  function options(select, values, selected) {
    select.replaceChildren(
      ...values.map(([value, label]) => {
        const option = doc.createElement('option');
        option.value = value;
        localizedText(option, () => label);
        return option;
      }),
    );
    select.value = values.some(([id]) => id === selected) ? selected : (values[0]?.[0] ?? '');
  }
  function contexts() {
    const entry = entries.find((e) => e.baseCampaignKey === campaign.value);
    options(
      level,
      (entry?.campaign.levels ?? []).map((l) => [
        l.id,
        `${contentText(l, 'name')} · ${l.revision}`,
      ]),
      level.value,
    );
    options(
      theme,
      (entry?.themes ?? []).map((t) => [t.id, t.name ?? t.id]),
      theme.value,
    );
    changeContext();
  }
  function changeContext(keepPreview = false) {
    discardBundles();
    draft = null;
    if (!keepPreview) preview.clear();
    const selected = current();
    const rows = selected
      ? saved.document.library.presentations.filter(
          (p) => canonicalJSON(p.identity) === canonicalJSON(selected.identity),
        )
      : [];
    const assignment =
      selected &&
      saved.document.library.assignments.find(
        (a) => canonicalJSON(a.identity) === canonicalJSON(selected.identity),
      );
    options(
      history,
      rows.map((p) => [
        JSON.stringify([p.id, p.revision]),
        t('gameplay:revision', { value1: contentText(p, 'description'), value2: p.revision }),
      ]),
      assignment ? JSON.stringify([assignment.presentationId, assignment.revision]) : '',
    );
    setStatus(t('interface:exactMapWorldSelectedPreviewAnOriginalOrASaved'));
    sync();
  }
  campaign.onchange = () => {
    if (task) return cancelWork();
    contexts();
  };
  level.onchange = theme.onchange = () => {
    if (task) return cancelWork();
    changeContext();
  };
  file.onchange = () => {
    if (story && task) return cancelWork();
    story?.invalidate();
    discardBundles();
    if (file.files?.length) draft = null;
    sync();
  };
  for (const item of [kind, credit, source, description])
    item.oninput = item.onchange = () => {
      if (story && task) return cancelWork();
      story?.invalidate();
      discardBundles();
      draft = null;
      sync();
    };
  history.onchange = () => {
    if (story && task) return cancelWork();
    story?.invalidate();
    discardBundles();
    draft = null;
    sync();
  };
  async function work(text, action, { opener, restoreTo = opener } = {}) {
    if (disposed || task) return false;
    const own = new AbortController(),
      id = ++serial,
      focus = opener ? captureOperationFocus(opener, { document: doc, restoreTo }) : null;
    if (focus) own.signal.addEventListener('abort', focus.cancel, { once: true });
    task = own;
    const lease = feedback.begin({ message: text, isCurrent: () => !disposed && id === serial });
    activity = lease;
    sync();
    const check = () => {
      if (disposed || id !== serial || own.signal.aborted)
        throw new DOMException(t('interface:workCancelled'), 'AbortError');
    };
    try {
      await action(own.signal, check, lease);
      check();
      lease.finish({ message: status.textContent });
      return true;
    } catch (error) {
      if (!disposed && id === serial)
        lease.finish({
          message: message(error),
          state: error?.name === 'AbortError' ? 'cancelled' : 'error',
        });
      return false;
    } finally {
      try {
        if (activity === lease) activity = null;
        if (id === serial) {
          task = null;
          sync();
        }
        // Enabling controls may itself retire this operation or move focus.
        if (!disposed && id === serial && !own.signal.aborted) focus?.restore();
      } finally {
        focus?.cancel();
        if (focus) own.signal.removeEventListener('abort', focus.cancel);
      }
    }
  }
  async function load() {
    if (task) return false;
    discardBundles();
    return work(
      t('interface:verifyingSavedOriginalsAndInstalledMaps'),
      async (signal, check, progress) => {
        ready = false;
        const nextContext = await catalog.read({ signal });
        check();
        progress.update({
          message: t('interface:readingAndVerifyingSavedPictureOriginals'),
          stage: 'verifying',
        });
        const next = await store.read({ signal });
        check();
        context = nextContext;
        saved = next;
        draft = null;
        identityCatalog = createMediaIdentityCatalog(context.executionCatalog);
        entries = context.executionCatalog.entries.filter((e) => e.difficulty === 'standard');
        options(
          campaign,
          entries.map((e) => [e.baseCampaignKey, e.campaign.title ?? e.campaign.id]),
          campaign.value,
        );
        ready = true;
        contexts();
        if (story) {
          progress.update({
            message: t('interface:readingOptionalStoryHistory'),
            stage: 'reading',
          });
          await story.load({ signal, check });
        }
        check();
        setStatus(t('interface:savedOriginalsVerifiedFreshFlightsUseTheCurrentAssignmentExisting'));
        try {
          onLoaded();
        } catch (error) {
          setStatus(`Saved originals verified, but its notification failed: ${message(error)}.`);
        }
      },
      { opener: reload },
    );
  }
  const view = (selected, asset, blob) => ({
    theme: selected.world,
    level: selected.map,
    seed: 1,
    asset,
    blob,
    legacyBackground: {
      ...selected.entry.visualOverrides,
      ...selected.entry.levelVisuals?.find((v) => v.levelId === selected.map.id)?.visualOverrides,
    }.background,
  });
  async function upload() {
    if (!ready || !file.files?.[0] || !current()) return false;
    const selected = current(),
      candidate = file.files[0];
    const declared = { kind: kind.value, credit: credit.value, source: source.value },
      caption = description.value;
    discardBundles();
    return work(
      t('interface:checkingTheOriginalSignatureDimensionsDecodeAndHash'),
      async (signal, check) => {
        const prepared = await prepareStillAsset(
          candidate,
          { id: makeId(), provenance: declared },
          { decodeImage, signal },
        );
        check();
        if (prepared.asset.width > 1920 || prepared.asset.height > 1080)
          throw new Error(t('interface:thisOriginalIsRetainedOnYourDeviceChooseASeparate'));
        if (!caption?.trim() || caption.length > 2048)
          throw new Error(t('interface:addAPictureDescriptionBeforePreviewing'));
        activity?.update({
          message: t('interface:decodingTheVerifiedPicturePreview'),
          stage: 'decoding',
        });
        const shown = await preview.show(view(selected, prepared.asset, prepared.blob), { signal });
        check();
        if (!shown) throw new Error(t('interface:previewCancelledThePriorPictureIsKept'));
        draft = { ...prepared, identity: selected.identity, description: caption };
        setStatus(
          `${prepared.asset.width} × ${prepared.asset.height} · ${prepared.asset.bytes} original bytes verified. Preview only; choose Save assignment to retain them.`,
        );
      },
      { opener: inspect },
    );
  }
  async function savedPreview(authored = false, opener = null) {
    if (!ready || !current()) return false;
    const selected = current();
    discardBundles();
    return work(
      t('interface:loadingTheSelectedPreview'),
      async (signal, check) => {
        const p =
          !authored &&
          saved.document.library.presentations.find(
            (p) =>
              JSON.stringify([p.id, p.revision]) === history.value &&
              canonicalJSON(p.identity) === canonicalJSON(selected.identity),
          );
        const asset = p && saved.document.library.assets.find((a) => a.id === p.poster.assetId);
        const blob = asset && saved.assets.find((a) => a.sha256 === asset.sha256)?.blob;
        if (asset && !blob)
          throw new Error(t('interface:theSavedOriginalIsUnavailablePriorPreviewIsKept'));
        const shown = await preview.show(view(selected, asset || null, blob || null), { signal });
        check();
        if (!shown) throw new Error(t('interface:previewCancelled'));
        draft = p ? { existing: p, identity: selected.identity } : null;
        setStatus(
          p
            ? `Saved revision ${p.revision} previewed. Save assignment to select it.`
            : t('interface:authoredPicturePreviewedUseAuthoredPictureRemovesOnlyTheAssignment'),
        );
      },
      { opener },
    );
  }
  async function commit(remove) {
    if (!ready || !current() || (!remove && !draft)) return false;
    const selected = current(),
      selectedDraft = draft,
      baseline = saved,
      ticket = context;
    discardBundles();
    return work(t('interface:preparingACompleteAtomicMediaSave'), async (signal, check) => {
      const library = structuredClone(baseline.document.library),
        assets = [...baseline.assets];
      library.assignments = library.assignments.filter(
        (a) => canonicalJSON(a.identity) !== canonicalJSON(selected.identity),
      );
      if (!remove) {
        if (canonicalJSON(selectedDraft.identity) !== canonicalJSON(selected.identity))
          throw new Error(t('interface:theSelectedMapChangedPreviewAgain'));
        let p = selectedDraft.existing;
        if (!p) {
          const prior = library.presentations.filter(
            (p) => canonicalJSON(p.identity) === canonicalJSON(selected.identity),
          );
          p = {
            format: MEDIA_PRESENTATION_FORMAT,
            id: prior[0]?.id ?? makeId(),
            revision: Math.max(0, ...prior.map((p) => p.revision)) + 1,
            identity: selected.identity,
            poster: { assetId: selectedDraft.asset.id, fit: 'contain', sampling: 'nearest' },
            story: null,
            description: selectedDraft.description,
          };
          library.assets.push(selectedDraft.asset);
          library.presentations.push(p);
          if (!assets.some((a) => a.sha256 === selectedDraft.asset.sha256))
            assets.push({ sha256: selectedDraft.asset.sha256, blob: selectedDraft.blob });
        }
        library.assignments.push({
          identity: selected.identity,
          presentationId: p.id,
          revision: p.revision,
        });
      }
      const prepared = await store.prepare(library, assets, {
        previous: baseline.document,
        executionCatalog: ticket.executionCatalog,
        signal,
      });
      check();
      activity?.update({
        message: t('interface:savingTheVerifiedPictureAssignment'),
        stage: 'saving',
      });
      const result = await catalog.withCurrent(
        ticket,
        () => store.commit(prepared, { expectedGeneration: baseline.generation, signal }),
        { signal },
      );
      // A committed operation remains success even if Close/Cancel raced its
      // completion. Prevent another save until a fresh verified read.
      check();
      saved = { generation: result.generation, document: result.library, assets: prepared.assets };
      draft = null;
      ready = true;
      changeContext(true);
      setStatus(
        remove
          ? t('interface:assignmentRemovedOriginalsAndHistoryRetainedChoosePreviewAuthoredPicture')
          : t('interface:assignmentSavedInLocalMediaOriginalsRetainedFlightsScoresSaves'),
      );
      try {
        onSaved(saved);
      } catch (error) {
        setStatus(
          `Assignment saved, but its notification failed: ${message(error)}. Reload to verify the saved state.`,
        );
      }
    });
  }
  function closePanel() {
    cancelWork();
    ready = false;
    dialog.close();
    preview.clear();
    story?.close();
    onClose();
    if (returnFocus?.isConnected) returnFocus.focus();
  }
  bundleFile.onchange = bundleMode.onchange = () => {
    if (task) return cancelWork();
    discardBundles();
    sync();
    setStatus(t('interface:reviewThisFileAndPolicyBeforeRestoringSavedDataIs'));
  };
  downloadOriginals.onclick = (event) => {
    if (!bundleURL || task || disposed) {
      event?.preventDefault();
      return false;
    }
    setStatus(t('interface:originalsDownloadRequestedConfirmTheDestinationInYourBrowserThis'));
  };
  async function prepareDownload() {
    if (!ready || task) return false;
    discardBundles();
    return work(t('interface:verifyingAllRetainedOriginalsForDownload'), async (signal, check) => {
      const latest = await store.read({ signal });
      check();
      activity?.update({
        message: t('interface:verifyingAndPackingPictureOriginals'),
        stage: 'exporting',
      });
      const blob = await exportMediaBundle(latest.document, latest.assets, { signal, decodeImage });
      check();
      let candidate = null;
      try {
        candidate = URLImpl.createObjectURL(blob);
        check();
        bundleURL = candidate;
        candidate = null;
      } finally {
        if (candidate !== null) URLImpl.revokeObjectURL(candidate);
      }
      downloadOriginals.href = bundleURL;
      downloadOriginals.download = 'RevealLine-originals.rlmedia';
      downloadOriginals.hidden = false;
      setStatus(
        `Originals backup prepared from generation ${latest.generation} (${blob.size} bytes, ${latest.assets.length} distinct originals). Choose Download originals. Preparation has not saved a file to disk.`,
      );
      downloadOriginals.focus();
    });
  }
  async function reviewBundle() {
    if (!ready || task || !bundleFile.files?.[0]) return false;
    const file = bundleFile.files[0],
      assignmentMode = bundleMode.value;
    discardBundles();
    return work(
      t('interface:verifyingTheCompleteOriginalsBackupAndTargetHistory'),
      async (signal, check) => {
        const imported = await importMediaBundle(file, { signal, decodeImage });
        check();
        const review = await prepareMediaBundleRestore(imported, {
          store,
          assignmentMode,
          signal,
          decodeImage,
        });
        check();
        reviewedBundle = { review, context, file, assignmentMode };
        localizedText(
          bundleReview,
          () =>
            `Reviewed target generation ${review.expectedGeneration}: ${review.originals} distinct retained originals, ${review.originalBytes} bytes, ${review.document.owners.length} exact historical owners, ${review.document.library.presentations.length} immutable picture revisions, ${review.document.library.assignments.length} resulting assignments. ${assignmentMode === 'restore' ? t('interface:theFileSCompleteAssignmentSetWillBeSelected') : t('interface:currentAssignmentsWinMissingBindingsAreAdded')} No data has been restored yet.`,
        );
        setStatus(t('interface:reviewCompleteChooseRestoreReviewedOriginalsToCommitThisExact'));
        restoreOriginals.disabled = false;
        restoreOriginals.focus();
      },
    );
  }
  async function restoreBundle() {
    if (!ready || task || !reviewedBundle) return false;
    const chosen = reviewedBundle;
    if (
      chosen.file !== bundleFile.files?.[0] ||
      chosen.assignmentMode !== bundleMode.value ||
      chosen.context !== context
    ) {
      discardBundles();
      sync();
      setStatus(t('interface:theReviewedFilePolicyOrInstalledContextChangedReviewAgain'));
      return false;
    }
    reviewedBundle = null;
    return work(t('interface:restoringTheReviewedOriginalsAtomically'), async (signal, check) => {
      await catalog.withCurrent(
        chosen.context,
        () => commitMediaBundleRestore(chosen.review, { signal }),
        { signal },
      );
      // A completed transaction stays completed even if lifecycle cancellation
      // raced its result. cancelWork already tells the user to reload to verify.
      check();
      discardBundles();
      draft = null;
      ready = false;
      setStatus(t('interface:originalsAndTheReviewedAssignmentsWereRestoredRetainedHistoryWas'));
      reload.disabled = false;
      reload.focus();
    });
  }
  dialog.addEventListener('cancel', (event) => {
    if (event.target !== dialog) return;
    event.preventDefault();
    back();
  });
  function back() {
    if (story && task) return cancelWork();
    return closePanel();
  }
  return Object.freeze({
    dialog,
    async open({ returnFocus: opener = doc.activeElement } = {}) {
      if (disposed) return false;
      if (!dialog.open) {
        returnFocus = opener;
        dialog.showModal();
      }
      reload.focus();
      clearance.refresh();
      return load();
    },
    close: closePanel,
    back,
    invalidateContext() {
      if (disposed) return;
      cancelWork();
      ready = false;
      draft = null;
      preview.clear();
      sync();
      setStatus(t('interface:installedContextMayHaveChangedReloadSavedMediaAndMaps'));
    },
    snapshot() {
      return Object.freeze({
        ready,
        busy: !!task,
        generation: saved?.generation ?? null,
        hasDraft: !!draft,
      });
    },
    dispose() {
      if (disposed) return;
      closePanel();
      disposed = true;
      clearance.destroy();
      feedback.dispose();
      preview.dispose();
      story?.dispose();
      dialog.remove();
    },
  });
}
