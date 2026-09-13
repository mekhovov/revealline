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
      'Story authoring needs a compatible shared story store.',
    );
  const node = (tag, id, text = '') => {
      const n = doc.createElement(tag);
      n.id = `still-media-story-${id}`;
      n.textContent = text;
      return n;
    },
    section = node('section', 'section'),
    title = node('h3', 'title', 'Optional story'),
    note = node(
      'p',
      'note',
      'Choose a saved picture revision before preparing its story. Saved flights and earned pictures are unchanged.',
    ),
    selected = node('p', 'selected'),
    binding = node('p', 'binding'),
    status = node('p', 'status', 'Reload to read story originals.'),
    fields = node('div', 'fields'),
    actions = node('div', 'actions');
  status.setAttribute('role', 'status');
  const control = (tag, id, label, attrs = {}, parent = fields) => {
      const wrapper = node('label', `${id}-label`, label),
        n = node(tag, id);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
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
  const videoFile = control('input', 'file', 'Owned video (MP4 or WebM, 64 MiB maximum)', {
      type: 'file',
      accept: 'video/mp4,video/webm',
    }),
    start = control('input', 'start', 'Story starts at (seconds)', {
      type: 'number',
      min: '0',
      step: '0.01',
    }),
    end = control('input', 'end', 'Story ends at (seconds)', {
      type: 'number',
      min: '0',
      step: '0.01',
    }),
    frameTime = control('input', 'frame-time', 'Poster frame at (seconds)', {
      type: 'number',
      min: '0',
      step: '0.01',
    }),
    description = control('input', 'description', 'Story description', {
      type: 'text',
      maxlength: '2048',
    }),
    history = control('select', 'history', 'Saved story for this picture');
  const timeRanges = [start, end, frameTime].map((numberField) => {
    const range = node('input', `${numberField.id.slice('still-media-story-'.length)}-range`);
    range.setAttribute('type', 'range');
    range.setAttribute('min', '0');
    range.setAttribute('max', '120');
    range.setAttribute('step', '0.01');
    range.setAttribute('aria-label', `${numberField.closest('label').textContent} slider`);
    numberField.closest('label').append(range);
    return { numberField, range };
  });
  const inspectButton = button('inspect', 'Inspect chosen video', () => inspectVideo()),
    captureButton = button('capture', 'Capture picture draft', () => capture()),
    prepareButton = button('prepare', 'Prepare new story', () => prepare(false)),
    prepareSaved = button('prepare-saved', 'Prepare saved story', () => prepare(true)),
    saveButton = button('save', 'Save prepared story', () => save()),
    clearButton = button('clear', 'Clear story binding', () => clear());
  const sourceFacts = node('p', 'source-facts'),
    frameFacts = node('p', 'frame-facts'),
    image = node('img', 'frame');
  image.hidden = true;
  image.alt = 'Captured picture draft; not a saved assignment';
  const bundleSection = node('section', 'bundle'),
    bundleTitle = node('h4', 'bundle-title', 'Story originals'),
    bundleNote = node(
      'p',
      'bundle-note',
      'Restore picture originals separately with .rlmedia. This file contains story history and video originals; no progress or audio.',
    ),
    bundleFields = node('div', 'bundle-fields'),
    bundleActions = node('div', 'bundle-actions'),
    bundleFile = control(
      'input',
      'bundle-file',
      'Story originals (.rlstory, 256 MiB maximum)',
      { type: 'file', accept: '.rlstory,application/vnd.revealline.story' },
      bundleFields,
    ),
    mode = control('select', 'bundle-mode', 'Story binding restore policy', {}, bundleFields),
    reviewText = node('p', 'bundle-review', 'No story backup reviewed.');
  const options = (select, values, value) => {
    select.replaceChildren(
      ...values.map(([id, text]) => {
        const n = doc.createElement('option');
        n.value = id;
        n.textContent = text;
        return n;
      }),
    );
    select.value = values.some(([id]) => id === value) ? value : (values[0]?.[0] ?? '');
  };
  options(
    mode,
    [
      ['keep', 'Keep current bindings'],
      ['restore', 'Restore incoming bindings'],
    ],
    'keep',
  );
  const downloadPrepare = button(
      'prepare-download',
      'Prepare story download',
      () => prepareDownload(),
      bundleActions,
    ),
    download = node('a', 'download', 'Download story originals');
  download.hidden = true;
  bundleActions.append(download);
  const bundleReview = button(
      'review',
      'Review chosen story backup',
      () => reviewBundle(),
      bundleActions,
    ),
    bundleRestore = button(
      'restore',
      'Restore reviewed stories',
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
    reviewText.textContent = 'No story backup reviewed.';
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
    frameFacts.textContent = '';
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
    selected.textContent = s?.pin
      ? `${s.caption} · ${s.assigned ? 'current assignment' : 'historical revision'}`
      : 'Save or select an exact picture revision to attach a story.';
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
    binding.textContent = current
      ? `Selected story: ${current.description} · revision ${current.revision}${metadata.document.originals.includes(current.source.sha256) ? '' : ' · original unavailable'}`
      : 'Selected story: none.';
    options(
      history,
      [
        ['', 'Choose a saved story…'],
        ...rows.map((r) => [
          JSON.stringify([r.id, r.revision]),
          `${r.description} · revision ${r.revision}`,
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
  function guarded(text, action) {
    if (disposed || busy || !ready) return false;
    const id = serial;
    let key = selectionKey(getSelection());
    return work(text, async (signal, parentCheck) => {
      const check = () => {
        parentCheck();
        if (disposed || id !== serial || key !== selectionKey(getSelection()))
          throw new DOMException('Story work cancelled.', 'AbortError');
      };
      check.adoptCapturedDraft = (selection) => {
        parentCheck();
        const next = selectionKey(selection);
        if (disposed || id !== serial || next !== selectionKey(getSelection()))
          throw new DOMException('Story work cancelled.', 'AbortError');
        key = activeSelection = next;
      };
      try {
        await action(signal, check);
        check();
      } catch (error) {
        check();
        status.textContent = message(error);
        throw error;
      }
    });
  }
  async function load({ signal, check }) {
    invalidate();
    try {
      const next = await storyStore.readMetadata({ signal });
      check();
      metadata = next;
      status.textContent = 'Story history loaded. Preparation does not save a binding.';
    } catch (error) {
      check();
      metadata = null;
      status.textContent = `Story history unavailable: ${message(error)}`;
    }
    sync();
  }
  async function inspectVideo() {
    if (disposed || busy || !ready || !videoFile.files?.[0]) return false;
    invalidate();
    const file = videoFile.files[0];
    return guarded('Inspecting video silently…', async (signal, check) => {
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
        sourceFacts.textContent = `${video.info.width} × ${video.info.height} · ${video.info.durationSeconds} seconds · ${video.info.bytes} original bytes`;
        status.textContent = 'Video inspected. Choose a segment and prepare an optional story.';
      } finally {
        next?.dispose();
      }
    });
  }
  function number(input) {
    required(input.value.trim() !== '', 'Enter an explicit time in seconds.');
    const value = Number(input.value);
    required(Number.isFinite(value), 'Enter a finite time in seconds.');
    return value;
  }
  async function capture() {
    if (disposed || busy || !ready || !video || !getSelection()?.identity) return false;
    invalidate();
    const owned = video,
      s = getSelection();
    return guarded('Capturing the requested frame silently…', async (signal, check) => {
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
        frameFacts.textContent = `Requested ${facts.requestedTime}s · ${facts.observedMediaTime === null ? 'observed timestamp unavailable' : `observed ${facts.observedMediaTime}s`} · playhead ${facts.playheadTime}s (${facts.timingEvidence}).`;
        status.textContent =
          'Captured picture draft. Save its assignment, then prepare its story. The original video is retained in this workshop.';
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
    return guarded('Preparing the exact story and binding…', async (signal, check) => {
      let review = null;
      try {
        if (existing) {
          const chosen = baseline.document.stories.find(
            (p) =>
              JSON.stringify([p.id, p.revision]) === selectedHistory &&
              canonicalJSON(p.picturePin) === canonicalJSON(s.pin),
          );
          required(chosen, 'Choose an exact saved story.');
          review = await storyStore.stageBinding(
            { picturePin: s.pin, story: { id: chosen.id, revision: chosen.revision } },
            { ...inspection, expectedGeneration: baseline.generation, signal },
          );
        } else {
          required(owned, 'Inspect a video first.');
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
          'Story history changed. Reload and prepare again.',
        );
        prepared = { review, selection: selectionKey(s), ticket: s.ticket };
        review = null;
        status.textContent = `Ready to save for ${s.caption}. No binding has changed.`;
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
    status.textContent = 'Story binding saved. Existing flights and earned pictures are unchanged.';
    try {
      await onSaved(result);
    } catch (error) {
      check();
      status.textContent = `Story saved; notification failed: ${message(error)}. Reload to verify.`;
    }
  }
  async function save() {
    if (disposed || busy || !ready || !prepared) return false;
    const chosen = prepared;
    prepared = null;
    return guarded('Saving the reviewed story binding…', async (signal, check) => {
      try {
        required(
          chosen.selection === selectionKey(getSelection()),
          'Picture selection changed. Prepare again.',
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
    return guarded('Clearing this optional story binding…', async (signal, check) => {
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
    return guarded('Verifying story originals for download…', async (signal, check) => {
      const inventory = await storyStore.exportInventory({ signal }),
        still = await store.readMetadata({ signal });
      check();
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
        status.textContent = `Story backup prepared (${blob.size} bytes). Choose Download story originals.`;
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
    status.textContent =
      'Download requested. Check your browser destination; this copy stays available to retry.';
    if (requestDownload) {
      event?.preventDefault();
      const own = downloadBlob,
        id = serial;
      try {
        const result = requestDownload({ blob: own, filename: 'RevealLine-stories.rlstory' });
        Promise.resolve(result).catch((error) => {
          if (!disposed && id === serial)
            status.textContent = `Download request failed: ${message(error)}`;
        });
      } catch (error) {
        status.textContent = `Download request failed: ${message(error)}`;
      }
    }
  };
  async function reviewBundle() {
    if (disposed || busy || !ready || !bundleFile.files?.[0]) return false;
    invalidate();
    const file = bundleFile.files[0],
      restore = mode.value === 'restore',
      ticket = getSelection()?.ticket;
    return guarded('Reviewing complete story originals…', async (signal, check) => {
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
        reviewText.textContent = `${reviewed.review.originals} available originals · ${reviewed.review.document.stories.length} retained stories. ${restore ? 'Incoming bindings will be restored.' : 'Current bindings will be kept.'} Nothing restored yet.`;
        bundleRestore.disabled = false;
        bundleRestore.focus();
        status.textContent =
          'Review complete. Restore explicitly to save this generation and policy.';
      } finally {
        if (review) await cancelStoryBundleRestore(review);
      }
    });
  }
  async function restoreBundle() {
    if (disposed || busy || !ready || !reviewed) return false;
    const chosen = reviewed;
    reviewed = null;
    return guarded('Restoring reviewed story originals…', async (signal, check) => {
      try {
        required(
          chosen.file === bundleFile.files?.[0] && chosen.restore === (mode.value === 'restore'),
          'File or policy changed. Review again.',
        );
        const result = await catalog.withCurrent(
          chosen.ticket,
          () => commitStoryBundleRestore(chosen.review, { signal }),
          { signal },
        );
        await notified(result, check);
        reviewText.textContent =
          'Story originals restored. Picture originals, audio and game data use separate files.';
      } finally {
        await cancelStoryBundleRestore(chosen.review);
      }
    });
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
    sourceFacts.textContent = '';
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
