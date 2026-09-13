import { canonicalJSON } from '../data-json.mjs';
import { createMediaIdentityCatalog, MEDIA_PRESENTATION_FORMAT } from '../media-library.mjs';
import { prepareStillAsset } from '../media-still.mjs';

/** Administrative still assignments only. No game, profile or Collection API. */
export function attachStillMediaPanel({
  document: doc = document,
  store,
  catalog,
  preview,
  onClose = () => {},
  onSaved = () => {},
  decodeImage,
  makeId = () => `still-${crypto.randomUUID()}`,
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
    'Save exact map/world assignments for this workshop. Flights and earned Collection pictures keep their existing artwork. Originals remain unchanged.',
  );
  const status = node(
    'p',
    'status',
    'Open to verify saved originals and the source game’s installed packs.',
  );
  status.setAttribute('role', 'status');
  const stats = node('p', 'stats');
  const fields = node('div', 'fields');
  const control = (tag, id, label, attrs = {}) => {
    const field = node(tag, id);
    for (const [key, value] of Object.entries(attrs)) field.setAttribute(key, value);
    const wrapper = node('label', `${id}-label`, label);
    wrapper.append(field);
    fields.append(wrapper);
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
  const canvas = preview.canvas;
  canvas.id = 'still-media-preview-canvas';
  canvas.setAttribute('aria-label', 'Isolated still picture preview; no gameplay or rewards');
  dialog.append(title, note, stats, fields, canvas, actions, status);
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
    returnFocus = null;
  function message(error) {
    return error instanceof Error ? error.message : String(error);
  }
  function cancelWork() {
    if (task) ready = false;
    ++serial;
    task?.abort();
    task = null;
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
    stats.textContent = saved
      ? `${saved.document.library.assets.length} retained image records · ${saved.document.library.presentations.length} immutable revisions · saved generation ${saved.generation}`
      : 'No verified saved media loaded.';
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
  campaign.onchange = contexts;
  level.onchange = theme.onchange = () => changeContext();
  file.onchange = () => {
    if (file.files?.length) draft = null;
    sync();
  };
  for (const item of [kind, credit, source, description])
    item.oninput = item.onchange = () => {
      draft = null;
      sync();
    };
  history.onchange = () => {
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
      status.textContent =
        'Saved originals verified. Assignments affect this workshop only; live flights and Collection are unchanged.';
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
    onClose();
    if (returnFocus?.isConnected) returnFocus.focus();
  }
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closePanel();
  });
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
      dialog.remove();
    },
  });
}
