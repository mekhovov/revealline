import { t } from '../../game/i18n/index.mjs';
globalThis.RevealLineToolLaunch?.attached();
import { createOperationStatus } from '../../game/ui/operation-status.mjs';
import {
  listProductionSlots,
  summarizeProduction,
  validateProductionRegister,
  THEMES,
  STAGES,
} from './model.mjs';
import { sourceURL } from './preview.mjs';

export function filterProductionSlots(
  rows,
  { domain = '', theme = '', stage = '', search = '', missing = false } = {},
) {
  const text = search.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (!domain || row.kind === domain) &&
      (!theme || (row.themeId ?? row.work?.themeId) === theme) &&
      (!stage || row.stage === stage) &&
      (!missing || !row.binding) &&
      (!text ||
        `${row.id} ${row.work?.title ?? ''} ${row.work?.id ?? ''}`.toLowerCase().includes(text)),
  );
}
const names = {
  picture: 'Pictures',
  presentation: 'Player presentations',
  story: 'Stories',
  reserve: 'Reserves',
  track: 'Tracks',
};
const themes = {
  fpv: 'FPV Front',
  ukraine: 'Ukraine Atlas',
  retro: '1994 Forever',
  coupa: 'Spend Network',
};
const label = (s) => s.replaceAll('-', ' ');

/** Standalone read-only DOM host. Services are injected; no game/profile/storage imports. */
export function attachProductionPanel({ root, rootURL, loadRegister, loadPreview }) {
  const doc = root.ownerDocument;
  const make = (tag, text = '', attrs = {}) => {
    const n = doc.createElement(tag);
    n.textContent = text;
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
  };
  const button = (text, fn) => {
    const n = make('button', text, { type: 'button' });
    n.addEventListener('click', fn);
    return n;
  };
  const status = make('p', 'Loading the register…', { role: 'status', 'aria-live': 'polite' });
  const presenters = new WeakMap();
  const report = (target, message, state = 'ready') => {
    let presenter = presenters.get(target);
    if (!presenter) {
      presenter = createOperationStatus(target);
      presenters.set(target, presenter);
    }
    const lease = presenter.begin({ message });
    if (state !== 'busy') lease.finish({ message, state });
    return lease;
  };
  const reload = button('Reload register', () => void refresh());
  const toolbar = make('div', '', { class: 'toolbar' });
  toolbar.append(status, reload);
  const coverage = make('section', '', { class: 'coverage', 'aria-label': 'Registered coverage' });
  const context = make('p', '', { class: 'muted' });
  const filters = make('form', '', { class: 'filters', 'aria-label': 'Filter production slots' });
  filters.addEventListener('submit', (e) => e.preventDefault());
  const choose = (title, entries, value = '') => {
    const wrap = make('label', title),
      select = make('select', '', { 'aria-label': title });
    for (const [key, text] of entries) {
      const option = make('option', text);
      option.value = key;
      select.append(option);
    }
    select.value = value;
    wrap.append(select);
    filters.append(wrap);
    return select;
  };
  const domain = choose('Domain', [['', 'All domains'], ...Object.entries(names)], 'picture');
  const theme = choose('Theme', [['', 'All themes'], ...THEMES.map((t) => [t, themes[t]])]);
  const stage = choose('Stage', [['', 'All stages'], ...STAGES.map((s) => [s, label(s)])]);
  const searchLabel = make('label', 'Find a slot or work'),
    search = make('input', '', {
      type: 'search',
      'aria-label': 'Find a slot or work',
      maxlength: '120',
    });
  searchLabel.append(search);
  filters.append(searchLabel);
  const missingLabel = make('label', 'Unbound only', { class: 'check-filter' }),
    missing = make('input', '', { type: 'checkbox' });
  missingLabel.append(missing);
  filters.append(missingLabel);
  const listHeading = make('h2', 'Production slots', { tabindex: '-1' });
  const matches = make('p', '', { role: 'status', 'aria-live': 'polite' });
  const table = make('table'),
    head = make('thead'),
    headRow = make('tr');
  for (const s of ['Slot and work', 'Theme', 'Stage', 'Missing checks'])
    headRow.append(make('th', s, { scope: 'col' }));
  head.append(headRow);
  const body = make('tbody');
  table.append(head, body);
  const scroll = make('div', '', { class: 'table-scroll' });
  scroll.append(table);
  const previous = button('Previous page', () => turnPage(-1)),
    next = button('Next page', () => turnPage(1));
  const pageLabel = make('span'),
    pager = make('nav', '', { class: 'pager', 'aria-label': 'Slot pages' });
  pager.append(previous, pageLabel, next);
  const detail = make('section', '', {
    id: 'production-detail',
    'aria-label': 'Selected production slot',
  });
  detail.hidden = true;
  root.replaceChildren(
    toolbar,
    coverage,
    context,
    filters,
    listHeading,
    matches,
    scroll,
    pager,
    detail,
  );
  let register = null,
    rows = [],
    filtered = [],
    page = 0,
    origin = null,
    disposed = false;
  let reloadController = null,
    previewController = null,
    previewValue = null,
    previewGeneration = 0;
  let imageHost = null,
    previewStatus = null;
  const cancelPreview = () => {
    previewGeneration++;
    previewController?.abort();
    previewController = null;
    previewValue?.dispose();
    previewValue = null;
    imageHost?.replaceChildren();
  };
  const hideDetail = (returnFocus = false) => {
    cancelPreview();
    detail.hidden = true;
    if (returnFocus) (origin?.isConnected ? origin : listHeading).focus();
  };
  function renderList() {
    filtered = filterProductionSlots(rows, {
      domain: domain.value,
      theme: theme.value,
      stage: stage.value,
      search: search.value,
      missing: missing.checked,
    });
    page = Math.min(page, Math.max(0, Math.ceil(filtered.length / 20) - 1));
    body.replaceChildren();
    for (const row of filtered.slice(page * 20, page * 20 + 20)) {
      const tr = make('tr'),
        cell = make('td');
      const open = button(row.work?.title ?? row.id, () => showSlot(row, open));
      open.append(make('small', row.work ? row.id : 'No work bound'));
      cell.append(open);
      tr.append(cell);
      for (const [name, value] of [
        ['Theme', themes[row.themeId ?? row.work?.themeId] ?? 'Not assigned'],
        ['Stage', label(row.stage)],
        ['Missing checks', String(row.missingChecks.length)],
      ])
        tr.append(make('td', value, { 'data-label': name }));
      body.append(tr);
    }
    matches.textContent = t("tools:matchingSlots", { value1: filtered.length, value2: missing.checked ? ' without a bound work' : '' });
    previous.disabled = page === 0;
    next.disabled = (page + 1) * 20 >= filtered.length;
    pageLabel.textContent = t("tools:pageOf", { value1: page + 1, value2: Math.max(1, Math.ceil(filtered.length / 20)) });
  }
  function turnPage(delta) {
    hideDetail();
    page += delta;
    renderList();
    listHeading.focus();
  }
  const changed = () => {
    hideDetail();
    page = 0;
    renderList();
  };
  for (const input of [domain, theme, stage, missing]) input.addEventListener('change', changed);
  search.addEventListener('input', changed);
  function showSlot(row, from) {
    cancelPreview();
    origin = from;
    detail.hidden = false;
    detail.replaceChildren();
    const heading = make('h2', row.work?.title ?? row.id, { tabindex: '-1' });
    detail.append(
      button('Back to slots', () => hideDetail(true)),
      heading,
      make('p', `${row.id} · ${label(row.stage)}`),
    );
    detail.append(
      make(
        'p',
        row.binding
          ? t("tools:bindingRevisionWorkRevision", { value1: row.binding.revision, value2: row.work.id, value3: row.work.revision })
          : 'This slot has no bound work. Its production checks remain open.',
      ),
    );
    if (row.kind === 'picture' && !row.owners.length)
      detail.append(make('p', 'No exact source owner is declared for this map and theme yet.'));
    detail.append(make('h3', 'Production checklist'));
    const checklist = make('ul');
    if (!row.missingChecks.length)
      checklist.append(make('li', 'No outstanding checks for this exact binding.'));
    for (const check of row.missingChecks)
      checklist.append(
        make('li', `${row.failedChecks.includes(check) ? 'Failed' : 'Open'} · ${label(check)}`),
      );
    detail.append(checklist);
    const reviews = register.assessments.filter((a) => a.slotId === row.id);
    const history = make('details'),
      summary = make('summary', 'Binding history and recorded assessments');
    history.append(
      summary,
      make('pre', JSON.stringify({ bindings: row.history, assessments: reviews }, null, 2)),
    );
    detail.append(history);
    if (row.work) {
      const provenance = make('details');
      provenance.append(
        make('summary', 'Exact source, owners and dependencies'),
        make('pre', JSON.stringify(row.work, null, 2)),
      );
      for (const pin of [row.work.source, ...row.work.dependencies])
        provenance.append(
          make('a', pin.path, {
            href: sourceURL(pin.path, rootURL),
            target: '_blank',
            rel: 'noopener noreferrer',
          }),
          make('p', t("tools:bytesSha256", { value1: pin.bytes, value2: pin.sha256 })),
        );
      detail.append(provenance);
      const entry = row.work.files.find(
        (f) => ['original', 'poster', 'concept'].includes(f.role) && f.file.path.endsWith('.png'),
      );
      const preview = make('div', '', { class: 'preview' });
      previewStatus = make(
        'p',
        entry
          ? 'Preview is optional. No image has been loaded.'
          : 'This work has no PNG preview. Movie and music playback are separate authoring tasks.',
        { role: 'status', 'aria-live': 'polite' },
      );
      imageHost = make('div');
      preview.append(
        make('h3', 'Source preview'),
        make(
          'p',
          'Selected PNG only, up to 8 MiB, 4096 pixels per edge and 8 megapixels. Exact bytes and native decode are checked; visual approval stays unchanged.',
        ),
        previewStatus,
      );
      if (entry) {
        const output = previewStatus,
          container = imageHost;
        preview.append(
          button(t("tools:preview2", { value1: entry.role }), () => void previewEntry(entry, output, container)),
          button('Clear preview', () => {
            cancelPreview();
            report(output, 'Preview cleared.', 'cancelled');
          }),
        );
      }
      preview.append(imageHost);
      detail.append(preview);
    } else {
      previewStatus = null;
      imageHost = null;
    }
    heading.focus();
    heading.scrollIntoView?.({ block: 'nearest' });
  }
  async function previewEntry(entry, output, container) {
    cancelPreview();
    const generation = previewGeneration,
      controller = new AbortController();
    previewController = controller;
    const lease = report(output, 'Checking the selected source and decoding its image…', 'busy');
    const timer = setTimeout(() => {
      controller.abort();
      if (!disposed && generation === previewGeneration)
        lease.finish({
          message: 'Preview timed out. Choose Preview to try again.',
          state: 'error',
        });
    }, 20000);
    try {
      const result = await loadPreview(entry, { signal: controller.signal });
      if (disposed || controller.signal.aborted || generation !== previewGeneration) {
        result.dispose();
        return;
      }
      previewValue = result;
      container.replaceChildren(result.image);
      lease.finish({
        message: `Exact source decoded: ${entry.width} × ${entry.height} · ${entry.file.bytes} bytes. No assessment was added.`,
      });
    } catch (error) {
      if (!disposed && generation === previewGeneration)
        lease.finish({
          state: 'error',
          message: controller.signal.aborted
            ? 'Preview cancelled or timed out. Choose Preview to try again.'
            : `Preview unavailable: ${error.message}`,
        });
    } finally {
      clearTimeout(timer);
      if (previewController === controller) previewController = null;
    }
  }
  async function refresh() {
    if (disposed) return;
    hideDetail();
    reloadController?.abort();
    const controller = new AbortController();
    reloadController = controller;
    const lease = report(
      status,
      register ? 'Reloading; the previous register remains visible.' : 'Loading the register…',
      'busy',
    );
    const timer = setTimeout(() => {
      controller.abort();
      if (!disposed && reloadController === controller)
        lease.finish({
          message: `Register request timed out. ${register ? 'Previous view retained.' : ''} Reload to retry.`,
          state: 'error',
        });
    }, 20000);
    try {
      const loaded = validateProductionRegister(await loadRegister({ signal: controller.signal }));
      if (disposed || controller.signal.aborted || reloadController !== controller) return;
      const summary = summarizeProduction(loaded),
        inventory = listProductionSlots(loaded);
      register = loaded;
      rows = inventory;
      page = 0;
      coverage.replaceChildren();
      for (const [kind, counts] of Object.entries(summary.domains)) {
        const card = make('article');
        card.append(
          make('strong', `${counts.bound} / ${counts.target}`),
          make('span', t("tools:bound", { value1: names[kind] })),
          make(
            'p',
            kind === 'reserve'
              ? t("tools:unboundInspected", { value1: counts.missing, value2: counts.stages.inspected })
              : t("tools:unboundFullyQualified", { value1: counts.missing, value2: counts.stages.released }),
          ),
        );
        coverage.append(card);
      }
      context.textContent = `${summary.uniquePictureWorks} unique pictures · ${summary.maps.proposed} proposed / ${summary.maps.approved} approved layout families · ${summary.sharedPresentationWorks} shared rigs for 56 handles · ${summary.recipeTracks} synth recipes. ${summary.uniqueReserveWorks} unique reserves · ${summary.reserveOverlap} selected-picture reuse excluded. ${summary.uniqueStoryWorks} unique story works. Historical delivery: ${summary.historicalDelivery.pictures} pictures and ${summary.historicalDelivery.stories} story. ${summary.enemyHandles} enemy handles are a separate inventory.`;
      lease.finish({
        message: `Register revision ${register.revision}. Source metadata is declared here; use the CLI to verify all source files.`,
      });
      renderList();
    } catch (error) {
      if (!disposed && reloadController === controller)
        lease.finish({
          state: 'error',
          message: `Register unavailable: ${controller.signal.aborted ? 'request cancelled or timed out' : error.message}. ${register ? 'Previous view retained.' : 'Reload to retry.'}`,
        });
    } finally {
      clearTimeout(timer);
      if (reloadController === controller) reloadController = null;
    }
  }
  const keydown = (event) => {
    if (
      event.key === 'Escape' &&
      !detail.hidden &&
      !['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target?.tagName)
    ) {
      event.preventDefault();
      hideDetail(true);
    }
  };
  root.addEventListener('keydown', keydown);
  void refresh();
  return Object.freeze({
    refresh,
    cancel() {
      reloadController?.abort();
      cancelPreview();
      if (previewStatus) report(previewStatus, 'Preview cleared.', 'cancelled');
      report(status, 'Register loading cancelled. Reload to retry.', 'cancelled');
    },
    dispose() {
      disposed = true;
      reloadController?.abort();
      cancelPreview();
      root.removeEventListener('keydown', keydown);
      root.replaceChildren();
    },
  });
}
