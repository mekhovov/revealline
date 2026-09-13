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

/** Administrative still assignments only. No game, profile or Collection API. */
export function attachStillMediaPanel({
  document: doc = document,
  store,
  catalog,
  preview,
  onClose = () => {},
  onSaved = () => {},
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
    value.textContent = text;
    return value;
  };
  const dialog = node('dialog', 'dialog');
  dialog.setAttribute('aria-labelledby', 'still-media-title');
  dialog.className = 'still-media-panel';
  const title = node('h2', 'title', 'Still picture workshop');
  const note = node(
    'p',
    'note',
    'Save exact map/world assignments for fresh flights. Existing saved flights and earned Collection pictures keep their original revision. Original files remain unchanged.',
  );
  const status = node(
    'p',
    'status',
    'Open to verify saved originals and the source game’s installed packs.',
  );
  status.setAttribute('role', 'status');
  const stats = node('p', 'stats');
  const fields = node('div', 'fields');
  const control = (tag, id, label, attrs = {}, parent = fields) => {
    const field = node(tag, id);
    for (const [key, value] of Object.entries(attrs)) field.setAttribute(key, value);
    const wrapper = node('label', `${id}-label`, label);
    wrapper.append(field);
    parent.append(wrapper);
    return field;
  };
  const campaign = control('select', 'campaign', 'Installed chapter');
  const level = control('select', 'level', 'Map');
  const theme = control('select', 'theme', 'World');
  const history = control('select', 'history', 'Saved picture revision');
  const file = control('input', 'file', 'Original PNG or JPEG (4 MiB maximum)', {
    type: 'file',
    accept: 'image/png,image/jpeg',
  });
  const kind = control('select', 'kind', 'Declared source');
  for (const [id, label] of [
    ['user-supplied', 'My uploaded file'],
    ['original', 'Original artwork'],
    ['licensed', 'Licensed artwork'],
  ]) {
    const option = node('option', `source-${id}`, label);
    option.value = id;
    kind.append(option);
  }
  kind.value = 'user-supplied';
  const credit = control('input', 'credit', 'Credit', { type: 'text', maxlength: '512' });
  const source = control('input', 'source', 'Source / provenance note', {
    type: 'text',
    maxlength: '2048',
  });
  const description = control('input', 'description', 'Picture description', {
    type: 'text',
    maxlength: '2048',
  });
  const actions = node('div', 'actions');
  const button = (id, text, fn) => {
    const item = node('button', id, text);
    item.type = 'button';
    item.onclick = fn;
    actions.append(item);
    return item;
  };
  const inspect = button('preview', 'Preview chosen file', () => upload());
  const showSaved = button('show-saved', 'Preview saved revision', () => savedPreview());
  const showAuthored = button('show-authored', 'Preview authored picture', () =>
    savedPreview(true),
  );
  const save = button('save', 'Save assignment', () => commit(false));
  const unassign = button('unassign', 'Use authored picture', () => commit(true));
  const discard = button('discard', 'Discard draft', () => {
    draft = null;
    sync();
    return savedPreview(true);
  });
  const reload = button('reload', 'Reload saved media and installed maps', () => load());
  const cancel = button('cancel', 'Cancel pending work', () => cancelWork());
  const close = button('close', 'Close workshop', () => closePanel());
  const bundleSection = node('section', 'bundles'),
    bundleTitle = node('h3', 'bundle-title', 'Original picture files'),
    bundleNote = node(
      'p',
      'bundle-note',
      'A .rlmedia file includes every referenced still original, retained generic original and exact owner history. Game progress, flights, packs and audio-only files need their separate backups.',
    ),
    bundleFields = node('div', 'bundle-fields');
  const bundleFile = control(
    'input',
    'bundle-file',
    'Originals backup (.rlmedia, at most 256 MiB)',
    { type: 'file', accept: '.rlmedia,application/vnd.revealline.media' },
    bundleFields,
  );
  const bundleMode = control(
    'select',
    'bundle-mode',
    'Assignment restore policy',
    {},
    bundleFields,
  );
  options(
    bundleMode,
    [
      ['preserve', 'Keep current assignments; add missing bindings'],
      ['restore', 'Use the bundle’s exact assignment set'],
    ],
    'preserve',
  );
  const bundlePolicy = node('p', 'bundle-policy'),
    bundleReview = node('p', 'bundle-review', 'No originals backup has been reviewed.'),
    bundleActions = node('div', 'bundle-actions');
  const bundleButton = (id, text, handler) => {
    const item = node('button', id, text);
    item.type = 'button';
    item.onclick = handler;
    bundleActions.append(item);
    return item;
  };
  const prepareOriginals = bundleButton('prepare-originals', 'Prepare originals download', () =>
    prepareDownload(),
  );
  const downloadOriginals = node('a', 'download-originals', 'Download originals');
  downloadOriginals.hidden = true;
  bundleActions.append(downloadOriginals);
  const reviewOriginals = bundleButton('review-originals', 'Review chosen originals backup', () =>
    reviewBundle(),
  );
  const restoreOriginals = bundleButton('restore-originals', 'Restore reviewed originals', () =>
    restoreBundle(),
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
  canvas.setAttribute('aria-label', 'Isolated still picture preview; no gameplay or rewards');
  dialog.append(title, note, stats, fields, canvas, actions, bundleSection, status);
  doc.body.append(dialog);
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
        work: (text, action) =>
          work(text, async (signal, check) => {
            await action(signal, check);
            check();
            status.textContent = story.statusText();
          }),
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
      caption: p ? `${p.description} · revision ${p.revision}` : '',
      assigned: !!p && assignment?.presentationId === p.id && assignment?.revision === p.revision,
      provenance: { kind: kind.value, credit: credit.value, source: source.value },
      description: description.value,
    };
  }
  async function capturedDraft(captured, selected, signal, check) {
    if (!selected.description?.trim() || selected.description.length > 2048)
      throw new Error('Add a picture description before capturing.');
    const shown = await preview.show(view(selected, captured.asset, captured.blob), { signal });
    check();
    if (!shown) throw new Error('Preview cancelled. The prior picture is kept.');
    discardBundles();
    draft = {
      asset: captured.asset,
      blob: captured.blob,
      identity: selected.identity,
      description: selected.description,
    };
    status.textContent =
      'Captured original PNG is a picture draft. Choose Save assignment to retain it.';
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
    bundleReview.textContent = 'No originals backup has been reviewed.';
  }
  function message(error) {
    return error instanceof Error ? error.message : String(error);
  }
  function cancelWork() {
    if (task) ready = false;
    ++serial;
    task?.abort();
    task = null;
    discardBundles();
    story?.cancel();
    status.textContent =
      'Pending work cancelled. Any completed save stays saved; reload to verify.';
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
    bundlePolicy.textContent =
      bundleMode.value === 'restore'
        ? 'Use exactly the assignments in this file, including removing current bindings absent from it. Every retained original and revision stays saved.'
        : 'Keep destination assignments when they conflict, and add only missing bindings. Every retained original and revision stays saved.';
    stats.textContent = saved
      ? `${saved.document.library.assets.length} retained image records · ${saved.document.library.presentations.length} immutable revisions · saved generation ${saved.generation}`
      : 'No verified saved media loaded.';
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
        option.textContent = label;
        return option;
      }),
    );
    select.value = values.some(([id]) => id === selected) ? selected : (values[0]?.[0] ?? '');
  }
  function contexts() {
    const entry = entries.find((e) => e.baseCampaignKey === campaign.value);
    options(
      level,
      (entry?.campaign.levels ?? []).map((l) => [l.id, `${l.name} · ${l.revision}`]),
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
        `${p.description} · revision ${p.revision}`,
      ]),
      assignment ? JSON.stringify([assignment.presentationId, assignment.revision]) : '',
    );
    status.textContent =
      'Exact map/world selected. Preview an original or a saved revision before saving.';
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
  async function work(text, action) {
    if (disposed || task) return false;
    const own = new AbortController(),
      id = ++serial;
    task = own;
    status.textContent = text;
    sync();
    const check = () => {
      if (disposed || id !== serial || own.signal.aborted)
        throw new DOMException('Work cancelled.', 'AbortError');
    };
    try {
      await action(own.signal, check);
      check();
      return true;
    } catch (error) {
      if (!disposed && id === serial) status.textContent = message(error);
      return false;
    } finally {
      if (id === serial) {
        task = null;
        sync();
      }
    }
  }
  async function load() {
    if (task) return false;
    discardBundles();
    return work('Verifying saved originals and installed maps…', async (signal, check) => {
      ready = false;
      const nextContext = await catalog.read({ signal });
      check();
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
      if (story) await story.load({ signal, check });
      status.textContent =
        'Saved originals verified. Fresh flights use the current assignment; existing flights and earned pictures keep their saved revision.';
    });
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
      'Checking the original signature, dimensions, decode and hash…',
      async (signal, check) => {
        const prepared = await prepareStillAsset(
          candidate,
          { id: makeId(), provenance: declared },
          { decodeImage, signal },
        );
        check();
        if (prepared.asset.width > 1920 || prepared.asset.height > 1080)
          throw new Error(
            'This original is retained on your device. Choose a separate poster at most 1920 × 1080; this workshop does not resize originals.',
          );
        if (!caption?.trim() || caption.length > 2048)
          throw new Error('Add a picture description before previewing.');
        const shown = await preview.show(view(selected, prepared.asset, prepared.blob), { signal });
        check();
        if (!shown) throw new Error('Preview cancelled. The prior picture is kept.');
        draft = { ...prepared, identity: selected.identity, description: caption };
        status.textContent = `${prepared.asset.width} × ${prepared.asset.height} · ${prepared.asset.bytes} original bytes verified. Preview only; choose Save assignment to retain them.`;
      },
    );
  }
  async function savedPreview(authored = false) {
    if (!ready || !current()) return false;
    const selected = current();
    discardBundles();
    return work('Loading the selected preview…', async (signal, check) => {
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
        throw new Error('The saved original is unavailable. Prior preview is kept.');
      const shown = await preview.show(view(selected, asset || null, blob || null), { signal });
      check();
      if (!shown) throw new Error('Preview cancelled.');
      draft = p ? { existing: p, identity: selected.identity } : null;
      status.textContent = p
        ? `Saved revision ${p.revision} previewed. Save assignment to select it.`
        : 'Authored picture previewed. Use authored picture removes only the assignment, keeping originals.';
    });
  }
  async function commit(remove) {
    if (!ready || !current() || (!remove && !draft)) return false;
    const selected = current(),
      selectedDraft = draft,
      baseline = saved,
      ticket = context;
    discardBundles();
    return work('Preparing a complete, atomic media save…', async (signal, check) => {
      const library = structuredClone(baseline.document.library),
        assets = [...baseline.assets];
      library.assignments = library.assignments.filter(
        (a) => canonicalJSON(a.identity) !== canonicalJSON(selected.identity),
      );
      if (!remove) {
        if (canonicalJSON(selectedDraft.identity) !== canonicalJSON(selected.identity))
          throw new Error('The selected map changed. Preview again.');
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
      status.textContent = remove
        ? 'Assignment removed; originals and history retained. Choose Preview authored picture to inspect the fallback. Game data was not changed.'
        : 'Assignment saved in local media. Originals retained. Flights, scores, saves and Collection were not changed.';
      try {
        onSaved(saved);
      } catch (error) {
        status.textContent = `Assignment saved, but its notification failed: ${message(error)}. Reload to verify the saved state.`;
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
    status.textContent = 'Review this file and policy before restoring. Saved data is unchanged.';
  };
  downloadOriginals.onclick = (event) => {
    if (!bundleURL || task || disposed) {
      event?.preventDefault();
      return false;
    }
    status.textContent =
      'Originals download requested. Confirm the destination in your browser; this prepared copy remains available to retry.';
  };
  async function prepareDownload() {
    if (!ready || task) return false;
    discardBundles();
    return work('Verifying all retained originals for download…', async (signal, check) => {
      const latest = await store.read({ signal });
      check();
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
      status.textContent = `Originals backup prepared from generation ${latest.generation} (${blob.size} bytes, ${latest.assets.length} distinct originals). Choose Download originals. Preparation has not saved a file to disk.`;
      downloadOriginals.focus();
    });
  }
  async function reviewBundle() {
    if (!ready || task || !bundleFile.files?.[0]) return false;
    const file = bundleFile.files[0],
      assignmentMode = bundleMode.value;
    discardBundles();
    return work(
      'Verifying the complete originals backup and target history…',
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
        bundleReview.textContent = `Reviewed target generation ${review.expectedGeneration}: ${review.originals} distinct retained originals, ${review.originalBytes} bytes, ${review.document.owners.length} exact historical owners, ${review.document.library.presentations.length} immutable picture revisions, ${review.document.library.assignments.length} resulting assignments. ${assignmentMode === 'restore' ? 'The file’s complete assignment set will be selected.' : 'Current assignments win; missing bindings are added.'} No data has been restored yet.`;
        status.textContent =
          'Review complete. Choose Restore reviewed originals to commit this exact policy and target generation.';
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
      status.textContent = 'The reviewed file, policy or installed context changed. Review again.';
      return false;
    }
    reviewedBundle = null;
    return work('Restoring the reviewed originals atomically…', async (signal, check) => {
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
      status.textContent =
        'Originals and the reviewed assignments were restored. Retained history was preserved. Reload saved media and installed maps to verify; game progress and flights were not imported.';
      reload.disabled = false;
      reload.focus();
    });
  }
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    back();
  });
  function back() {
    if (story && task) return cancelWork();
    return closePanel();
  }
  return Object.freeze({
    dialog,
    async open() {
      if (disposed) return false;
      if (!dialog.open) {
        returnFocus = doc.activeElement;
        dialog.showModal();
      }
      reload.focus();
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
      status.textContent =
        'Installed context may have changed. Reload saved media and maps before editing.';
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
      preview.dispose();
      story?.dispose();
      dialog.remove();
    },
  });
}
