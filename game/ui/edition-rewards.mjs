import { getLocale, onLocaleChange, t } from '../i18n/index.mjs';
import { required } from '../data-json.mjs';
import { createRewardMissionBindings } from '../rewards/bindings.mjs';
import { rewardContext } from '../rewards/context.mjs';
import { createRewardBackend, createRewardStore } from '../rewards/store.mjs';
import { verifyEditionAssets } from '../editions/assets.mjs';
import { resolveRewardAsset } from '../rewards/media.mjs';

/** A presentation of accepted Journey evidence. No simulation, completion,
 * mission launch or scoring authority is passed into this view. */
export async function mountEditionRewards({
  provider,
  document: doc,
  window: win,
  writer,
  pause,
  getRun,
  getJourneyProfile,
  getJourneyRevision,
  getJourneyDurable,
  getReducedMotion = () => false,
}) {
  if (!provider.rewards?.length) return { refresh() {}, dispose() {} };
  const tr = (key, values) => t(`interface:completionRewards.${key}`, values);
  const localized = (value) => value.locales[getLocale()] ?? value.locales.en;
  const node = (tag, text, className) => {
    const element = doc.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  const button = (text, action) => {
    const value = node('button', text, 'button secondary');
    value.type = 'button';
    value.onclick = action;
    return value;
  };
  const link = (title, url) => {
    const value = node('a', title);
    value.href = url;
    value.target = '_blank';
    value.rel = 'noopener noreferrer';
    return value;
  };
  const bindings = createRewardMissionBindings(provider.route.source);
  let disposed = false,
    dirty = true,
    revision,
    durable,
    lastRun,
    lastKind,
    lastMotion;
  let context,
    progress = [],
    state,
    viewing = null,
    opener = null,
    mediaVisit = 0;
  let mediaRequest = null;
  const objectURLs = new Set(),
    played = new WeakSet(),
    celebrated = new WeakSet();
  const result = node('section', undefined, 'completion-reward-result');
  result.id = 'completion-reward-result';
  result.hidden = true;
  doc.getElementById('overlay-reading').append(result);
  const shelf = node('section', undefined, 'completion-reward-shelf');
  shelf.id = 'completion-reward-shelf';
  const pictureCollection = doc.getElementById('journey-pictures');
  if (pictureCollection) pictureCollection.before(shelf);
  else doc.getElementById('collection-dialog').append(shelf);
  const dialog = node('dialog', undefined, 'completion-reward-dialog');
  dialog.id = 'completion-reward-dialog';
  dialog.setAttribute('aria-labelledby', 'completion-reward-title');
  const reading = node('div');
  reading.setAttribute('data-game-reading', '');
  reading.tabIndex = 0;
  const closeButton = button('', () => dialog.close());
  dialog.append(reading, closeButton);
  doc.body.append(dialog);
  const data = node('section', undefined, 'completion-reward-data');
  const status = node('p');
  status.id = 'completion-reward-save-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  const dataTitle = node('h3'),
    dataNote = node('p'),
    exportButton = button('', download);
  const retrySave = button('', async () => {
    retrySave.disabled = true;
    await store.flush();
    if (!disposed) {
      dirty = true;
      refresh();
    }
  });
  retrySave.id = 'completion-reward-retry-save';
  const importLabel = node('label'),
    upload = node('input'),
    labelText = node('span');
  upload.type = 'file';
  upload.accept = 'application/json,.json';
  importLabel.append(labelText, upload);
  data.append(dataTitle, dataNote, exportButton, retrySave, importLabel, status);
  doc.getElementById('settings-panel-data').append(data);
  const store = createRewardStore({
    editionId: provider.editionId,
    backend: createRewardBackend({
      editionId: provider.editionId,
      indexedDB: win.indexedDB,
      canWrite: () => writer.writable,
    }),
    onStatus: () => {
      dirty = true;
    },
  });
  await store.load();

  function releaseMedia() {
    mediaVisit++;
    mediaRequest?.abort();
    mediaRequest = null;
    for (const url of objectURLs) win.URL.revokeObjectURL(url);
    objectURLs.clear();
  }
  function saveStatus() {
    const saved = store.status();
    status.textContent = tr(saved.durable ? 'saved' : 'sessionOnly');
    status.dataset.durable = String(saved.durable);
    retrySave.textContent = t('interface:retrySave');
    retrySave.disabled = saved.durable;
  }
  function download() {
    const url = win.URL.createObjectURL(new Blob([store.export()], { type: 'application/json' }));
    const anchor = node('a');
    anchor.href = url;
    anchor.download = `${provider.editionId}-discoveries.v1.json`;
    anchor.click();
    win.setTimeout(() => win.URL.revokeObjectURL(url), 1000);
  }
  let importVisit = 0;
  upload.onchange = async () => {
    const visit = ++importVisit;
    try {
      const file = upload.files?.[0];
      if (!file) return;
      required(file.size <= 16 * 1024 * 1024, tr('tooLarge'));
      const text = await file.text();
      if (disposed || visit !== importVisit) return;
      await store.restore(JSON.parse(text));
      if (!disposed) {
        revision = undefined;
        dirty = true;
        refresh();
      }
    } catch (error) {
      if (!disposed && visit === importVisit)
        status.textContent = `${tr('importFailed')} ${error.message}`;
    } finally {
      if (!disposed && visit === importVisit) upload.value = '';
    }
  };
  function count(definition) {
    const item = progress.find((entry) => entry.rewardId === definition.id);
    return tr('progress', {
      completed: item?.completed ?? 0,
      total: item?.total ?? definition.requirements.missions.length,
    });
  }
  function earned(id) {
    return state.receipts.find((receipt) => receipt.definition.id === id);
  }
  function exploreButton(receipt, surface, label = 'explore') {
    const open = button(tr(label), () => openReward(receipt, open));
    open.dataset.rewardId = receipt.definition.id;
    open.dataset.rewardSurface = surface;
    return open;
  }
  function restoreFocus(previous) {
    if (!previous?.dataset.rewardId) return;
    const replacement = doc.querySelector(
      `[data-reward-id="${previous.dataset.rewardId}"][data-reward-surface="${previous.dataset.rewardSurface}"]`,
    );
    replacement?.focus({ preventScroll: true });
  }
  function availableDefinitions() {
    return state.promises.filter((definition) =>
      context.campaignIds.includes(definition.campaignId),
    );
  }
  function renderShelf() {
    const focused = shelf.contains(doc.activeElement) ? doc.activeElement : null;
    const title = node('h3', tr('collection'));
    const grid = node('div', undefined, 'completion-reward-grid');
    for (const definition of availableDefinitions()) {
      const receipt = earned(definition.id),
        copy = localized(definition);
      const card = node('article', undefined, 'completion-reward-card');
      card.dataset.earned = String(!!receipt);
      card.append(
        node('p', tr(receipt ? 'collected' : 'promise'), 'completion-reward-eyebrow'),
        node('h4', copy.title),
      );
      // Locked cards use only the public teaser: no payload, image fetch or link.
      card.append(node('p', copy.teaser), node('p', receipt ? tr('collected') : count(definition)));
      if (receipt) {
        card.append(exploreButton(receipt, 'collection'));
      }
      grid.append(card);
    }
    shelf.replaceChildren(title, grid);
    restoreFocus(focused);
  }
  function renderResult(animate = false) {
    const focused = result.contains(doc.activeElement) ? doc.activeElement : null;
    const run = getRun(),
      kind = doc.getElementById('game-overlay').dataset.kind;
    const definition = availableDefinitions().find(
      (item) => item.scope.kind === 'mission' && item.scope.id === run?.levelId,
    );
    result.hidden = !definition || !['ready', 'won', 'campaign-complete'].includes(kind);
    if (result.hidden) {
      result.replaceChildren();
      return;
    }
    const receipt = earned(definition.id),
      copy = localized(definition);
    const won = run?.status === 'won' && !!receipt;
    if (animate && won && !getReducedMotion()) result.classList.add('completion-reward-arrive');
    else if (!won || getReducedMotion() || lastRun !== run)
      result.classList.remove('completion-reward-arrive');
    result.dataset.reducedMotion = String(getReducedMotion());
    const firstWin = won && celebrated.has(run);
    const title = node('h3', won ? tr(firstWin ? 'discovery' : 'collected') : tr('promise'));
    const content = node('p', copy.title);
    const discovery = won
      ? receipt.definition.payloads.find((item) => item.type === 'knowledge')
      : null;
    result.replaceChildren(title, content);
    if (!won || firstWin)
      result.append(node('p', discovery ? localized(discovery).paragraphs[0] : copy.teaser));
    if (won) {
      result.append(exploreButton(receipt, 'result'));
    }
    const finale = availableDefinitions().find(
      (item) => item.campaignId === definition.campaignId && item.scope.kind === 'campaign',
    );
    if (finale) {
      const finaleReceipt = earned(finale.id);
      result.append(
        node(
          'p',
          `${localized(finale).title} · ${finaleReceipt ? tr('collected') : count(finale)}`,
          'completion-reward-finale',
        ),
      );
      if (finaleReceipt && won) {
        result.append(exploreButton(finaleReceipt, 'result-finale', 'exhibit'));
      }
    }
    restoreFocus(focused);
  }
  async function loadImage(payload, container, signal, visit) {
    try {
      const { bootstrap, asset } = await resolveRewardAsset(provider, payload.asset, { signal });
      await verifyEditionAssets(bootstrap, {
        baseURL: provider.rootURL,
        ids: [asset.id],
        signal,
        onVerifiedAsset({ asset: verified, bytes }) {
          if (verified.id !== asset.id || disposed || visit !== mediaVisit) return;
          const type = /\.webp$/i.test(asset.path)
            ? 'image/webp'
            : /\.jpe?g$/i.test(asset.path)
              ? 'image/jpeg'
              : 'image/png';
          const url = win.URL.createObjectURL(new Blob([bytes], { type }));
          objectURLs.add(url);
          const image = node('img');
          image.alt = localized(payload).alt;
          image.src = url;
          const download = node('a', tr('saveImage'));
          download.href = url;
          download.download = asset.path.split('/').at(-1);
          container.replaceChildren(image, download);
        },
      });
    } catch {
      if (!disposed && visit === mediaVisit && !signal.aborted)
        container.replaceChildren(node('p', tr('missingMedia')));
    }
  }
  function renderViewer() {
    if (!viewing) return;
    releaseMedia();
    const visit = mediaVisit;
    mediaRequest = new AbortController();
    const definition = viewing.definition,
      copy = localized(definition);
    const title = node('h2', copy.title);
    title.id = 'completion-reward-title';
    reading.replaceChildren(node('p', tr('collected'), 'completion-reward-eyebrow'), title);
    closeButton.textContent = tr('back');
    for (const payload of definition.payloads) {
      const text = localized(payload),
        section = node('section');
      section.append(node('h3', text.title));
      if (payload.type === 'knowledge') {
        for (const paragraph of text.paragraphs) section.append(node('p', paragraph));
        for (const source of text.sources ?? []) {
          const p = node('p');
          p.append(link(source.title, source.url));
          section.append(p);
        }
      } else if (payload.type === 'image') {
        const media = node('figure');
        media.append(node('p', tr('loadingMedia')));
        section.append(media);
        void loadImage(payload, media, mediaRequest.signal, visit);
      } else if (payload.type === 'url') {
        section.append(node('p', payload.url), link(tr('openResource'), payload.url));
      } else if (payload.type === 'public-code') {
        section.append(
          node('p', payload.issuer),
          node('code', payload.code),
          node('p', text.terms),
        );
        if (payload.expiresOn)
          section.append(node('p', tr('expires', { date: payload.expiresOn })));
        if (payload.termsUrl) section.append(link(tr('terms'), payload.termsUrl));
        section.append(node('p', tr('publicCode')));
      } else section.append(node('p', tr('missingMedia')));
      reading.append(section);
    }
  }
  function openReward(receipt, from) {
    if (disposed) return;
    pause();
    opener = from;
    viewing = receipt;
    renderViewer();
    dialog.showModal();
    closeButton.focus({ preventScroll: true });
  }
  const onClose = () => {
    viewing = null;
    releaseMedia();
    reading.replaceChildren();
    if (opener?.isConnected) opener.focus({ preventScroll: true });
    else restoreFocus(opener);
  };
  dialog.addEventListener('close', onClose);
  const stopReveal = () => result.classList.remove('completion-reward-arrive');
  result.addEventListener('animationend', stopReveal);
  result.addEventListener('click', stopReveal);
  function refresh() {
    if (disposed) return;
    const nextRevision = getJourneyRevision(),
      nextDurable = getJourneyDurable();
    const run = getRun(),
      kind = doc.getElementById('game-overlay').dataset.kind;
    if (run?.status === 'running') played.add(run);
    let animate = false;
    if (revision !== nextRevision || durable !== nextDurable || !state) {
      context = rewardContext(provider, bindings, getJourneyProfile());
      const update = store.reconcile(provider.rewards, context, { persist: nextDurable });
      state = update.state;
      progress = update.progress;
      animate =
        !!run &&
        run.status === 'won' &&
        played.has(run) &&
        !celebrated.has(run) &&
        update.granted.some(
          (receipt) =>
            receipt.definition.scope.kind === 'mission' &&
            receipt.definition.scope.id === run.levelId,
        );
      if (animate) celebrated.add(run);
      revision = nextRevision;
      durable = nextDurable;
      dirty = true;
    }
    if (dirty) {
      state = store.snapshot();
      dataTitle.textContent = tr('backupTitle');
      dataNote.textContent = tr('backupNote');
      exportButton.textContent = tr('export');
      labelText.textContent = tr('import');
      saveStatus();
      renderShelf();
    }
    if (dirty || lastRun !== run || lastKind !== kind || lastMotion !== getReducedMotion())
      renderResult(animate);
    lastRun = run;
    lastKind = kind;
    lastMotion = getReducedMotion();
    dirty = false;
  }
  const stopLocale = onLocaleChange(() => {
    dirty = true;
    refresh();
    if (viewing) renderViewer();
  });
  refresh();
  return {
    refresh,
    dispose() {
      disposed = true;
      importVisit++;
      releaseMedia();
      stopLocale();
      result.removeEventListener('animationend', stopReveal);
      result.removeEventListener('click', stopReveal);
      dialog.removeEventListener('close', onClose);
      dialog.remove();
      result.remove();
      shelf.remove();
      data.remove();
      void store.close();
    },
  };
}
