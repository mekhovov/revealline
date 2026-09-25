import { contentText } from '../i18n/content.mjs';
import { t, localizedText, localizedAttribute, localizedMessage } from '../i18n/index.mjs';
import { createOperationStatus } from './operation-status.mjs';
import { canonicalJSON, required } from '../data-json.mjs';
import { openVideoPosterSource } from '../video-poster.mjs';
import { VICTORY_STORY_FORMAT } from '../victory-story.mjs';
import { changeStoredStoryBinding } from '../story-storage-record.mjs';
import {
  exportStoryBundle,
  importStoryBundle,
  prepareStoryBundleRestore,
  commitStoryBundleRestore,
  cancelStoryBundleRestore,
} from '../story-bundle.mjs';

/** Optional child of the existing workshop. No manager, navigation router or awards. */
export function createStillStoryPanel({
  doc,
  store,
  storyStore,
  work,
  cancelWork,
  getSelection,
  catalog,
  URLImpl,
  inspection = {},
  onCaptured,
  onSaved = () => {},
  makeId,
  requestDownload,
}) {
  for (const method of [
    'readMetadata',
    'stageRestore',
    'stageBinding',
    'commit',
    'cancel',
    'exportInventory',
  ])
    required(
      typeof storyStore?.[method] === 'function',
      t("interface:storyAuthoringNeedsACompatibleSharedStoryStore"),
    );
  const node = (tag, id, text = '') => {
      const n = doc.createElement(tag);
      n.id = `still-media-story-${id}`;
      localizedText(n, () =>text);
      return n;
    },
    section = node('section', 'section'),
    title = node('h3', 'title', localizedMessage("interface:optionalStory")),
    note = node(
      'p',
      'note',
      localizedMessage("interface:chooseASavedPictureRevisionBeforePreparingItsStorySaved"),
    ),
    selected = node('p', 'selected'),
    binding = node('p', 'binding'),
    status = node('p', 'status', localizedMessage("interface:reloadToReadStoryOriginals")),
    fields = node('div', 'fields'),
    actions = node('div', 'actions');
  status.setAttribute('role', 'status');
  const initialStatus = status.textContent;
  const feedback = createOperationStatus(status);
  let activity = null;
  function setStatus(message, state = 'ready') {
    if (activity) activity.update({ message, progress: null });
    else feedback.begin({ message }).finish({ message, state });
  }
  setStatus(initialStatus);

  const control = (tag, id, label, attrs = {}, parent = fields) => {
      const wrapper = node('label', `${id}-label`, label),
        n = node(tag, id);
      for (const [k, v] of Object.entries(attrs)) {
        if (['aria-label', 'title', 'placeholder', 'alt'].includes(k)) localizedAttribute(n, k, v);
        else n.setAttribute(k, v);
      }
      wrapper.append(n);
      parent.append(wrapper);
      return n;
    },
    button = (id, label, fn, parent = actions) => {
      const n = node('button', id, label);
      n.type = 'button';
      n.onclick = fn;
      parent.append(n);
      return n;
    };
  const videoFile = control('input', 'file', t("interface:ownedVideoMp4OrWebm64MibMaximum"), {
      type: 'file',
      accept: 'video/mp4,video/webm',
    }),
    start = control('input', 'start', t("interface:storyStartsAtSeconds"), {
      type: 'number',
      min: '0',
      step: '0.01',
    }),
    end = control('input', 'end', t("interface:storyEndsAtSeconds"), {
      type: 'number',
      min: '0',
      step: '0.01',
    }),
    frameTime = control('input', 'frame-time', t("interface:posterFrameAtSeconds"), {
      type: 'number',
      min: '0',
      step: '0.01',
    }),
    description = control('input', 'description', t("interface:storyDescription"), {
      type: 'text',
      maxlength: '2048',
    }),
    history = control('select', 'history', t("interface:savedStoryForThisPicture"));
  const timeRanges = [start, end, frameTime].map((numberField) => {
    const range = node('input', `${numberField.id.slice('still-media-story-'.length)}-range`);
    range.setAttribute('type', 'range');
    range.setAttribute('min', '0');
    range.setAttribute('max', '120');
    range.setAttribute('step', '0.01');
    localizedAttribute(range, "aria-label", () => t("gameplay:slider", { value1: numberField.closest('label').textContent }));
    numberField.closest('label').append(range);
    return { numberField, range };
  });
  const inspectButton = button('inspect', localizedMessage("interface:inspectChosenVideo"), () => inspectVideo()),
    captureButton = button('capture', localizedMessage("interface:capturePictureDraft"), () => capture()),
    prepareButton = button('prepare', localizedMessage("interface:prepareNewStory"), () => prepare(false)),
    prepareSaved = button('prepare-saved', localizedMessage("interface:prepareSavedStory"), () => prepare(true)),
    saveButton = button('save', localizedMessage("interface:savePreparedStory"), () => save()),
    clearButton = button('clear', localizedMessage("interface:clearStoryBinding"), () => clear());
  const sourceFacts = node('p', 'source-facts'),
    frameFacts = node('p', 'frame-facts'),
    image = node('img', 'frame');
  image.hidden = true;
  image.alt = t("interface:capturedPictureDraftNotASavedAssignment");
  const bundleSection = node('section', 'bundle'),
    bundleTitle = node('h4', 'bundle-title', localizedMessage("interface:storyOriginals")),
    bundleNote = node(
      'p',
      'bundle-note',
      localizedMessage("interface:restorePictureOriginalsSeparatelyWithRlmediaThisFileContainsStory"),
    ),
    bundleFields = node('div', 'bundle-fields'),
    bundleActions = node('div', 'bundle-actions'),
    bundleFile = control(
      'input',
      'bundle-file',
      t("interface:storyOriginalsRlstory256MibMaximum"),
      { type: 'file', accept: '.rlstory,application/vnd.revealline.story' },
      bundleFields,
    ),
    mode = control('select', 'bundle-mode', t("interface:storyBindingRestorePolicy"), {}, bundleFields),
    reviewText = node('p', 'bundle-review', localizedMessage("interface:noStoryBackupReviewed"));
  const options = (select, values, value) => {
    select.replaceChildren(
      ...values.map(([id, text]) => {
        const n = doc.createElement('option');
        n.value = id;
        localizedText(n, () =>text);
        return n;
      }),
    );
    select.value = values.some(([id]) => id === value) ? value : (values[0]?.[0] ?? '');
  };
  options(
    mode,
    [
      ['keep', t("interface:keepCurrentBindings")],
      ['restore', t("interface:restoreIncomingBindings")],
    ],
    'keep',
  );
  const downloadPrepare = button(
      'prepare-download',
      localizedMessage("interface:prepareStoryDownload"),
      () => prepareDownload(),
      bundleActions,
    ),
    download = node('a', 'download', localizedMessage("interface:downloadStoryOriginals"));
  download.hidden = true;
  bundleActions.append(download);
  const bundleReview = button(
      'review',
      localizedMessage("interface:reviewChosenStoryBackup"),
      () => reviewBundle(),
      bundleActions,
    ),
    bundleRestore = button(
      'restore',
      localizedMessage("interface:restoreReviewedStories"),
      () => restoreBundle(),
      bundleActions,
    );
  bundleSection.append(bundleTitle, bundleNote, bundleFields, reviewText, bundleActions);
  section.append(
    title,
    note,
    selected,
    binding,
    fields,
    sourceFacts,
    actions,
    image,
    frameFacts,
    bundleSection,
    status,
  );
  let metadata = null,
    video = null,
    capturedURL = null,
    prepared = null,
    reviewed = null,
    downloadURL = null,
    downloadBlob = null,
    activeSelection = '',
    activeIdentity = '',
    serial = 0,
    disposed = false,
    ready = false,
    busy = false;
  const message = (error) => (error instanceof Error ? error.message : String(error));
  const selectionKey = (s) =>
    canonicalJSON({
      identity: s?.identity ?? null,
      pin: s?.pin ?? null,
      generation: s?.saved?.generation ?? null,
    });
  function releasePrepared() {
    const old = prepared;
    prepared = null;
    if (old) void storyStore.cancel(old.review).catch(() => {});
  }
  function releaseReview() {
    const old = reviewed;
    reviewed = null;
    if (old) void cancelStoryBundleRestore(old.review).catch(() => {});
    localizedText(reviewText, () =>t("interface:noStoryBackupReviewed"));
  }
  function releaseDownload() {
    if (downloadURL !== null) URLImpl.revokeObjectURL(downloadURL);
    downloadURL = null;
    downloadBlob = null;
    download.hidden = true;
    download.removeAttribute('href');
    download.removeAttribute('download');
  }
  function invalidate() {
    feedback.clear();
    activity = null;
    ++serial;
    releasePrepared();
    releaseReview();
    releaseDownload();
  }
  function releaseFrame() {
    if (capturedURL !== null) URLImpl.revokeObjectURL(capturedURL);
    capturedURL = null;
    image.removeAttribute('src');
    image.hidden = true;
    localizedText(frameFacts, () =>'');
  }
  function sync(state = { ready, busy }) {
    ready = state.ready;
    busy = state.busy;
    const s = getSelection(),
      key = selectionKey(s),
      identity = canonicalJSON(s?.identity ?? null);
    if (identity !== activeIdentity) {
      activeIdentity = identity;
      releaseFrame();
    }
    if (key !== activeSelection) {
      activeSelection = key;
      invalidate();
    }
    localizedText(selected, () =>s?.pin
      ? `${s.caption} · ${s.assigned ? 'current assignment' : 'historical revision'}`
      : t("interface:saveOrSelectAnExactPictureRevisionToAttachA"));
    const bound =
        s?.pin &&
        metadata?.document.bindings?.find(
          (b) => canonicalJSON(b.picturePin) === canonicalJSON(s.pin),
        ),
      current =
        bound?.story &&
        metadata.document.stories.find(
          (p) => p.id === bound.story.id && p.revision === bound.story.revision,
        ),
      rows = s?.pin
        ? (metadata?.document.stories.filter(
            (p) => canonicalJSON(p.picturePin) === canonicalJSON(s.pin),
          ) ?? [])
        : [];
    localizedText(binding, () =>current
      ? t("gameplay:selectedStoryRevision", { value1: contentText(current, 'description'), value2: current.revision, value3: metadata.document.originals.includes(current.source.sha256) ? '' : ' · original unavailable' })
      : t("interface:selectedStoryNone"));
    options(
      history,
      [
        ['', t("interface:chooseASavedStory")],
        ...rows.map((r) => [
          JSON.stringify([r.id, r.revision]),
          t("gameplay:revision", { value1: contentText(r, 'description'), value2: r.revision }),
        ]),
      ],
      history.value,
    );
    for (const field of [videoFile, start, end, frameTime, description, history, bundleFile, mode])
      field.disabled = busy || !ready;
    for (const { range } of timeRanges) range.disabled = busy || !ready || !video;
    inspectButton.disabled = busy || !ready || !videoFile.files?.[0];
    captureButton.disabled = busy || !ready || !video || !s?.identity;
    prepareButton.disabled = busy || !ready || !metadata || !video || !s?.pin;
    prepareSaved.disabled = busy || !ready || !metadata || !s?.pin || !history.value;
    saveButton.disabled = busy || !ready || !prepared;
    clearButton.disabled = busy || !ready || !metadata || !s?.pin;
    downloadPrepare.disabled = busy || !ready || !metadata;
    bundleReview.disabled = busy || !ready || !bundleFile.files?.[0];
    bundleRestore.disabled = busy || !ready || !reviewed;
    download.hidden = !downloadURL || busy;
  }
  function guarded(text, action, focusOptions) {
    if (disposed || busy || !ready) return false;
    const id = serial;
    let key = selectionKey(getSelection());
    return work(
      text,
      async (signal, parentCheck) => {
        const lease = feedback.begin({
          message: text,
          isCurrent: () => !disposed && id === serial && !signal.aborted,
        });
        activity = lease;
        const check = () => {
          parentCheck();
          if (disposed || id !== serial || key !== selectionKey(getSelection()))
            throw new DOMException(t("interface:storyWorkCancelled"), 'AbortError');
        };
        check.adoptCapturedDraft = (selection) => {
          parentCheck();
          const next = selectionKey(selection);
          if (disposed || id !== serial || next !== selectionKey(getSelection()))
            throw new DOMException(t("interface:storyWorkCancelled"), 'AbortError');
          key = activeSelection = next;
        };
        try {
          await action(signal, check);
          check();
          lease.finish({ message: status.textContent });
        } catch (error) {
          check();
          lease.finish({ message: message(error), state: 'error' });
          throw error;
        } finally {
          if (activity === lease) activity = null;
        }
      },
      focusOptions,
    );
  }
  async function load({ signal, check }) {
    invalidate();
    try {
      const next = await storyStore.readMetadata({ signal });
      check();
      metadata = next;
      setStatus(t("interface:storyHistoryLoadedPreparationDoesNotSaveABinding"));
    } catch (error) {
      check();
      metadata = null;
      setStatus(`Story history unavailable: ${message(error)}`, 'error');
    }
    sync();
  }
  async function inspectVideo() {
    if (disposed || busy || !ready || !videoFile.files?.[0]) return false;
    invalidate();
    const file = videoFile.files[0];
    return guarded(t("interface:inspectingVideoSilently"), async (signal, check) => {
      let next = null;
      try {
        next = await openVideoPosterSource(file, { ...inspection, URLImpl, signal });
        check();
        video?.dispose();
        video = next;
        next = null;
        releaseFrame();
        start.value = '0';
        end.value = String(Math.min(video.info.durationSeconds, 30));
        frameTime.value = '0';
        for (const n of [start, end, frameTime]) n.max = String(video.info.durationSeconds);
        for (const { numberField, range } of timeRanges) {
          range.max = String(video.info.durationSeconds);
          range.value = numberField.value;
        }
        localizedText(sourceFacts, () =>`${video.info.width} × ${video.info.height} · ${video.info.durationSeconds} seconds · ${video.info.bytes} original bytes`);
        setStatus(t("interface:videoInspectedChooseASegmentAndPrepareAnOptionalStory"));
      } finally {
        next?.dispose();
      }
    });
  }
  function number(input) {
    required(input.value.trim() !== '', t("interface:enterAnExplicitTimeInSeconds"));
    const value = Number(input.value);
    required(Number.isFinite(value), t("interface:enterAFiniteTimeInSeconds"));
    return value;
  }
  async function capture() {
    if (disposed || busy || !ready || !video || !getSelection()?.identity) return false;
    invalidate();
    const owned = video,
      s = getSelection();
    return guarded(t("interface:capturingTheRequestedFrameSilently"), async (signal, check) => {
      const captured = await owned.capture(
        number(frameTime),
        { id: makeId(), provenance: s.provenance },
        { signal },
      );
      check();
      let url = null;
      try {
        url = URLImpl.createObjectURL(captured.blob);
        check();
        const adopted = await onCaptured(captured, s, signal, check);
        check.adoptCapturedDraft(adopted);
        check();
        releaseFrame();
        capturedURL = url;
        url = null;
        image.src = capturedURL;
        image.hidden = false;
        const facts = captured.capture;
        localizedText(frameFacts, () =>`Requested ${facts.requestedTime}s · ${facts.observedMediaTime === null ? 'observed timestamp unavailable' : `observed ${facts.observedMediaTime}s`} · playhead ${facts.playheadTime}s (${facts.timingEvidence}).`);
        setStatus(
          t("interface:capturedPictureDraftSaveItsAssignmentThenPrepareItsStory"),
        );
      } finally {
        if (url !== null) URLImpl.revokeObjectURL(url);
      }
    });
  }
  async function prepare(existing) {
    if (disposed || busy || !ready) return false;
    invalidate();
    const s = getSelection();
    if (!s?.pin || !metadata) return false;
    const baseline = metadata,
      owned = video,
      caption = description.value,
      selectedHistory = history.value;
    return guarded(t("interface:preparingTheExactStoryAndBinding"), async (signal, check) => {
      let review = null;
      try {
        if (existing) {
          const chosen = baseline.document.stories.find(
            (p) =>
              JSON.stringify([p.id, p.revision]) === selectedHistory &&
              canonicalJSON(p.picturePin) === canonicalJSON(s.pin),
          );
          required(chosen, t("interface:chooseAnExactSavedStory"));
          review = await storyStore.stageBinding(
            { picturePin: s.pin, story: { id: chosen.id, revision: chosen.revision } },
            { ...inspection, expectedGeneration: baseline.generation, signal },
          );
        } else {
          required(owned, t("interface:inspectAVideoFirst"));
          const descriptor = {
            format: VICTORY_STORY_FORMAT,
            id: makeId(),
            revision: 1,
            picturePin: s.pin,
            source: owned.info,
            segment: { startSeconds: number(start), endSeconds: number(end) },
            description: caption,
          };
          const incoming = await changeStoredStoryBinding(
            {
              format: 'revealline-story-storage.v1',
              stories: [descriptor],
              originals: [owned.info.sha256],
            },
            { picturePin: s.pin, story: { id: descriptor.id, revision: descriptor.revision } },
            s.saved.document,
            { signal },
          );
          check();
          review = await storyStore.stageRestore(
            { document: incoming, assets: [{ sha256: owned.info.sha256, blob: owned.original }] },
            { ...inspection, restoreBindings: true, signal },
          );
        }
        check();
        required(
          review.expectedGeneration === baseline.generation,
          t("interface:storyHistoryChangedReloadAndPrepareAgain"),
        );
        prepared = { review, selection: selectionKey(s), ticket: s.ticket };
        review = null;
        setStatus(`Ready to save for ${s.caption}. No binding has changed.`);
        saveButton.disabled = false;
        saveButton.focus();
      } finally {
        if (review) await storyStore.cancel(review);
      }
    });
  }
  async function notified(result, check) {
    check();
    metadata = result;
    setStatus(t("interface:storyBindingSavedExistingFlightsAndEarnedPicturesAreUnchanged"));
    try {
      await onSaved(result);
    } catch (error) {
      check();
      setStatus(`Story saved; notification failed: ${message(error)}. Reload to verify.`);
    }
  }
  async function save() {
    if (disposed || busy || !ready || !prepared) return false;
    const chosen = prepared;
    prepared = null;
    return guarded(t("interface:savingTheReviewedStoryBinding"), async (signal, check) => {
      try {
        required(
          chosen.selection === selectionKey(getSelection()),
          t("interface:pictureSelectionChangedPrepareAgain"),
        );
        const result = await catalog.withCurrent(
          chosen.ticket,
          () => storyStore.commit(chosen.review, { signal }),
          { signal },
        );
        await notified(result, check);
        releaseDownload();
      } finally {
        await storyStore.cancel(chosen.review);
      }
    });
  }
  async function clear() {
    if (disposed || busy || !ready) return false;
    invalidate();
    const s = getSelection();
    if (!s?.pin || !metadata) return false;
    const generation = metadata.generation;
    return guarded(t("interface:clearingThisOptionalStoryBinding"), async (signal, check) => {
      let review = null;
      try {
        review = await storyStore.stageBinding(
          { picturePin: s.pin, story: null },
          { ...inspection, expectedGeneration: generation, signal },
        );
        check();
        const result = await catalog.withCurrent(
          s.ticket,
          () => storyStore.commit(review, { signal }),
          { signal },
        );
        review = null;
        await notified(result, check);
      } finally {
        if (review) await storyStore.cancel(review);
      }
    });
  }
  async function prepareDownload() {
    if (disposed || busy || !ready || !metadata) return false;
    invalidate();
    return guarded(t("interface:verifyingStoryOriginalsForDownload"), async (signal, check) => {
      const inventory = await storyStore.exportInventory({ signal }),
        still = await store.readMetadata({ signal });
      check();
      activity?.update({ message: t("interface:verifyingAndPackingStoryOriginals"), stage: 'exporting' });
      const blob = await exportStoryBundle(inventory.document, inventory.assets, {
        still: still.document,
        signal,
      });
      check();
      let url = null;
      try {
        url = URLImpl.createObjectURL(blob);
        check();
        downloadURL = url;
        downloadBlob = blob;
        url = null;
        download.href = downloadURL;
        download.download = 'RevealLine-stories.rlstory';
        download.hidden = false;
        setStatus(`Story backup prepared (${blob.size} bytes). Choose Download story originals.`);
        download.focus();
      } finally {
        if (url !== null) URLImpl.revokeObjectURL(url);
      }
    });
  }
  download.onclick = (event) => {
    if (!downloadURL || busy || disposed) {
      event?.preventDefault();
      return false;
    }
    setStatus(
      t("interface:downloadRequestedCheckYourBrowserDestinationThisCopyStaysAvailable"),
    );
    if (requestDownload) {
      event?.preventDefault();
      const own = downloadBlob,
        id = serial;
      try {
        const result = requestDownload({ blob: own, filename: 'RevealLine-stories.rlstory' });
        Promise.resolve(result).catch((error) => {
          if (!disposed && id === serial) setStatus(`Download request failed: ${message(error)}`);
        });
      } catch (error) {
        setStatus(`Download request failed: ${message(error)}`);
      }
    }
  };
  async function reviewBundle() {
    if (disposed || busy || !ready || !bundleFile.files?.[0]) return false;
    invalidate();
    const file = bundleFile.files[0],
      restore = mode.value === 'restore',
      ticket = getSelection()?.ticket;
    return guarded(t("interface:reviewingCompleteStoryOriginals"), async (signal, check) => {
      let review = null;
      try {
        const imported = await importStoryBundle(file, { ...inspection, signal });
        check();
        review = await prepareStoryBundleRestore(imported, {
          store: storyStore,
          ...inspection,
          restoreBindings: restore,
          signal,
        });
        check();
        reviewed = { review, file, restore, ticket };
        review = null;
        localizedText(reviewText, () =>t("gameplay:availableOriginalsRetainedStoriesNothingRestoredYet", { value1: reviewed.review.originals, value2: reviewed.review.document.stories.length, value3: restore ? t("interface:incomingBindingsWillBeRestored") : t("interface:currentBindingsWillBeKept") }));
        bundleRestore.disabled = false;
        bundleRestore.focus();
        setStatus(t("interface:reviewCompleteRestoreExplicitlyToSaveThisGenerationAndPolicy"));
      } finally {
        if (review) await cancelStoryBundleRestore(review);
      }
    });
  }
  async function restoreBundle() {
    if (disposed || busy || !ready || !reviewed) return false;
    const chosen = reviewed;
    reviewed = null;
    return guarded(
      t("interface:restoringReviewedStoryOriginals"),
      async (signal, check) => {
        try {
          required(
            chosen.file === bundleFile.files?.[0] && chosen.restore === (mode.value === 'restore'),
            t("interface:fileOrPolicyChangedReviewAgain"),
          );
          const result = await catalog.withCurrent(
            chosen.ticket,
            () => commitStoryBundleRestore(chosen.review, { signal }),
            { signal },
          );
          await notified(result, check);
          localizedText(reviewText, () =>t("interface:storyOriginalsRestoredPictureOriginalsAudioAndGameDataUse"));
        } finally {
          await cancelStoryBundleRestore(chosen.review);
        }
      },
      { opener: bundleRestore, restoreTo: bundleReview },
    );
  }
  function changed() {
    if (busy) {
      cancelWork();
      return;
    }
    invalidate();
    sync();
  }
  videoFile.onchange = () => {
    changed();
    video?.dispose();
    video = null;
    releaseFrame();
    localizedText(sourceFacts, () =>'');
    sync();
  };
  for (const field of [start, end, frameTime, description, history, bundleFile, mode])
    field.oninput = field.onchange = changed;
  for (const { numberField, range } of timeRanges) {
    numberField.oninput = numberField.onchange = () => {
      range.value = numberField.value;
      changed();
    };
    range.oninput = range.onchange = () => {
      numberField.value = range.value;
      changed();
    };
  }
  return Object.freeze({
    section,
    statusText: () => status.textContent,
    sync,
    load,
    invalidate,
    cancel() {
      invalidate();
    },
    close() {
      invalidate();
      video?.dispose();
      video = null;
      releaseFrame();
      metadata = null;
    },
    dispose() {
      disposed = true;
      invalidate();
      video?.dispose();
      video = null;
      releaseFrame();
      feedback.dispose();
      section.remove();
    },
    snapshot() {
      return {
        hasVideo: !!video,
        hasPrepared: !!prepared,
        hasReviewed: !!reviewed,
        generation: metadata?.generation ?? null,
      };
    },
  });
}
