import { LIBRARY_COLLECTIONS, LIBRARY_MODES } from '../mission-library/library.mjs';
import { paintMissionThumbnail } from '../content-design/mission-card.mjs';

const modeLabel = (mode) => ({ solo: 'Solo', versus: 'Versus', team: 'Team' })[mode];
const sizeLabel = (bytes) =>
  bytes < 1024 * 1024
    ? `${Math.ceil(bytes / 1024)} KiB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;

/** Same flat mission surface across hosts. Owner adapters, not this UI, validate
 * launches, prepare pictures, award progress and decide the next mission. */
export function attachMissionLibraryChooser({
  document: doc = globalThis.document,
  library,
  mode = 'solo',
  onPause,
  onReturn,
  readState = () => null,
  writeState = () => {},
}) {
  if (!LIBRARY_MODES.includes(mode)) throw new TypeError('Unknown mission library mode.');
  const node = (tag, id, text) => {
    const result = doc.createElement(tag);
    if (id) result.id = id;
    if (text !== undefined) result.textContent = text;
    return result;
  };
  const dialog = node('dialog', 'journey-chooser');
  dialog.className = 'journey-chooser mission-library-chooser';
  dialog.setAttribute('aria-labelledby', 'journey-chooser-title');
  const heading = node('h2', 'journey-chooser-title', 'Find your next line');
  const copy = node(
    'p',
    null,
    'All missions, one library. Journey, Classic and Custom keep their own rules and progression.',
  );
  const filters = node('div');
  filters.className = 'journey-filters';
  function field(title, id, type = 'select') {
    const label = node('label', null, title),
      control = node(type, id);
    label.append(control);
    filters.append(label);
    return control;
  }
  const search = field('Search all missions', 'journey-search', 'input');
  search.type = 'search';
  search.placeholder = 'Mission, campaign, edition or tag';
  const collection = field('Collection', 'journey-collection');
  const campaign = field('Campaign', 'journey-campaign');
  const modeFilter = field('Mode', 'journey-mode');
  const option = (title, value) => {
    const result = node('option', null, title);
    result.value = value;
    return result;
  };
  collection.append(option('All', ''), ...LIBRARY_COLLECTIONS.map((value) => option(value, value)));
  collection.value = '';
  modeFilter.append(...LIBRARY_MODES.map((value) => option(modeLabel(value), value)));
  modeFilter.value = mode;
  const status = node('p', 'journey-chooser-status');
  status.setAttribute('role', 'status');
  const list = node('div', 'journey-cards');
  list.className = 'journey-cards';
  const footer = node('div');
  footer.className = 'journey-footer';
  const back = node('button', 'journey-back', 'Back to game');
  back.type = 'button';
  back.className = 'button secondary';
  footer.append(back);
  dialog.append(heading, copy, filters, status, list, footer);
  doc.body.append(dialog);
  const cards = new Map(),
    downloads = new Set();
  let opener = null,
    selectedId = '',
    savedScroll = 0,
    visit = 0,
    destroyed = false,
    message = '';
  let saved = null;
  try {
    saved = readState();
  } catch {
    /* Session-only browsing still works. */
  }
  if (saved && typeof saved === 'object') {
    if (typeof saved.search === 'string') search.value = saved.search.slice(0, 512);
    if (LIBRARY_COLLECTIONS.includes(saved.collection)) collection.value = saved.collection;
    // Opening another host starts in that host's mode; same-mode handoffs restore.
    if (saved.mode === mode) {
      selectedId = typeof saved.selectedId === 'string' ? saved.selectedId : '';
      savedScroll = Number.isFinite(saved.scroll) ? Math.max(0, saved.scroll) : 0;
    }
  }
  function state() {
    return {
      search: search.value || '',
      collection: collection.value || '',
      campaign: campaign.value || '',
      mode: modeFilter.value,
      selectedId,
      scroll: list.scrollTop || 0,
    };
  }
  function remember() {
    const focusedId = doc.activeElement?.closest('.journey-card')?.dataset.missionId;
    if (focusedId && list.contains(doc.activeElement)) selectedId = focusedId;
    savedScroll = list.scrollTop || 0;
    try {
      writeState(state());
    } catch {
      /* Do not block play on browser storage. */
    }
  }
  function rebuildCampaigns(requested = campaign.value) {
    const choices = new Map();
    for (const row of library.forMode(modeFilter.value))
      if (!collection.value || row.collection === collection.value)
        choices.set(row.campaignKey, `${row.campaignTitle} · ${row.edition}`);
    campaign.replaceChildren(
      option('All campaigns', ''),
      ...[...choices].map(([key, title]) => option(title, key)),
    );
    campaign.value = choices.has(requested) ? requested : '';
  }
  rebuildCampaigns(saved?.mode === mode ? saved.campaign : '');
  function restoreSelection() {
    const button = cards.get(selectedId)?.button;
    if (button?.isConnected && !button.disabled && list.contains(button))
      button.focus({ preventScroll: true });
    else search.focus({ preventScroll: true });
    list.scrollTop = savedScroll;
  }
  async function activate(row) {
    selectedId = row.id;
    remember();
    const activeMode = modeFilter.value;
    let availability;
    try {
      availability = library.availability(row, activeMode);
    } catch (error) {
      message = error.message;
      render();
      return;
    }
    if (availability.state === 'preparing') {
      library.cancel(row, { mode: activeMode });
      return;
    }
    if (availability.state === 'download' || availability.retry) {
      const ticket = visit;
      const controller = new AbortController();
      downloads.add(controller);
      message = '';
      try {
        const result = await library.prepare(row, { mode: activeMode, signal: controller.signal });
        if (ticket === visit)
          message =
            result.state === 'cancelled'
              ? 'Download cancelled. Your current game is kept.'
              : result.state === 'ready'
                ? `${row.name} is ready. Choose Play when you want to start.`
                : '';
      } catch (error) {
        if (ticket === visit) message = `Could not prepare ${row.name}: ${error.message}`;
      } finally {
        downloads.delete(controller);
        if (dialog.open && ticket === visit) render();
      }
      return;
    }
    if (availability.state !== 'ready') return;
    // Existing hosts must leave the picker before taking their atomic attempt
    // ticket. Keep filters/focus for an unsuccessful or cancelled handoff.
    const ticket = ++visit;
    remember();
    dialog.close();
    try {
      const accepted = await library.launch(row, { mode: activeMode });
      if (accepted === false && ticket === visit && !destroyed) {
        message = 'Mission not opened. Your current game is kept.';
        open(opener);
      }
    } catch (error) {
      if (ticket === visit && !destroyed) {
        message = `Could not open ${row.name}: ${error.message}`;
        open(opener);
      }
    }
  }
  function makeCard(row) {
    const button = node('button');
    button.type = 'button';
    button.className = 'journey-card';
    button.dataset.missionId = row.id;
    const number = node('span', null, String(row.levelIndex + 1).padStart(2, '0'));
    number.className = 'journey-card-number';
    const name = node('strong', null, row.name);
    const campaignName = node('span', null, row.campaignTitle);
    const edition = node('span', null, row.edition);
    edition.className = 'journey-card-edition';
    const tags = node('span', null, row.tags.join(' · '));
    tags.className = 'journey-card-tags';
    const progress = node('span');
    progress.className = 'journey-card-progress';
    const rules = node('span', null, row.rules);
    rules.className = 'journey-card-challenge';
    rules.hidden = !row.rules;
    const action = node('span');
    action.className = 'journey-card-action';
    button.append(number, name, campaignName, edition, tags, progress, rules, action);
    button.onclick = () => void activate(row);
    button.addEventListener('focus', () => {
      selectedId = row.id;
    });
    return { row, button, progress, action, diagram: null };
  }
  function render() {
    if (destroyed) return;
    const focused = doc.activeElement;
    const focusedId = list.contains(focused) ? focused?.dataset.missionId : null;
    const scroll = list.scrollTop || 0;
    const matches = library.search(search.value || '', {
      mode: modeFilter.value,
      collection: collection.value,
      campaign: campaign.value,
    });
    status.textContent = `${matches.length} mission${matches.length === 1 ? '' : 's'} · ${modeLabel(modeFilter.value)}${message ? ` · ${message}` : ''}`;
    const buttons = matches.map((row) => {
      let card = cards.get(row.id);
      if (card?.row !== row) {
        card = makeCard(row);
        cards.set(row.id, card);
      }
      const availability = library.availability(row, modeFilter.value);
      card.progress.textContent = library.progress(row, modeFilter.value);
      card.progress.hidden = !card.progress.textContent;
      card.action.textContent =
        availability.state === 'ready'
          ? 'Play'
          : availability.state === 'download'
            ? `Download · ${sizeLabel(availability.bytes)}`
            : availability.state === 'preparing'
              ? 'Preparing · Cancel'
              : `Unavailable · ${availability.reason}${availability.retry ? ' · Retry' : ''}`;
      card.button.disabled = availability.state === 'unavailable' && !availability.retry;
      card.button.setAttribute('aria-busy', String(availability.state === 'preparing'));
      return card.button;
    });
    // Reuse buttons across status changes instead of throwing away keyboard focus.
    if (
      buttons.length !== list.children.length ||
      buttons.some((button, index) => list.children[index] !== button)
    )
      list.replaceChildren(...buttons);
    if (focusedId && !doc.hidden && doc.hasFocus?.() !== false) {
      const replacement = cards.get(focusedId)?.button;
      if (replacement?.isConnected && list.contains(replacement) && !replacement.disabled)
        replacement.focus({ preventScroll: true });
      else search.focus({ preventScroll: true });
    }
    list.scrollTop = scroll;
    for (const [id, card] of cards)
      if (!library.find(id)) {
        card.button.remove();
        cards.delete(id);
      }
    observeDiagrams();
  }
  // Only visible starting-map diagrams are built. Never request/decode reward
  // pictures for browsing. The fallback is text cards, not eager canvas work.
  const Observer = doc.defaultView?.IntersectionObserver ?? globalThis.IntersectionObserver;
  const observer =
    typeof Observer === 'function'
      ? new Observer(
          (entries) => {
            for (const entry of entries)
              if (entry.isIntersecting) {
                const card = cards.get(entry.target.dataset.missionId);
                observer.unobserve(entry.target);
                if (
                  !card ||
                  card.diagram ||
                  !dialog.open ||
                  !list.contains(card.button) ||
                  library.find(card.row.id) !== card.row
                )
                  continue;
                card.diagram = true;
                try {
                  const diagram = library.card(card.row, modeFilter.value);
                  if (!diagram) continue;
                  const canvas = node('canvas');
                  canvas.className = 'journey-card-map';
                  canvas.width = 288;
                  canvas.height = (288 * diagram.height) / diagram.width;
                  canvas.setAttribute('aria-hidden', 'true');
                  paintMissionThumbnail(canvas.getContext('2d'), diagram, canvas.width);
                  card.button.append(canvas);
                } catch {
                  /* An optional diagram cannot block a launch. */
                }
              }
          },
          { root: list, rootMargin: '120px' },
        )
      : null;
  function observeDiagrams() {
    for (const button of list.children)
      if (!cards.get(button.dataset.missionId).diagram) observer?.observe(button);
  }
  function invalidateDiagrams() {
    observer?.disconnect();
    for (const card of cards.values()) {
      card.diagram = null;
      card.button.querySelector('.journey-card-map')?.remove();
    }
  }
  function close() {
    ++visit;
    remember();
    for (const controller of downloads) controller.abort();
    dialog.close();
    if (onReturn) onReturn(opener);
    else if (opener?.isConnected) opener.focus({ preventScroll: true });
  }
  function open(origin = doc.activeElement, { returnLabel = 'Back to game' } = {}) {
    if (destroyed) return;
    ++visit;
    opener = origin;
    back.textContent = returnLabel;
    onPause?.();
    invalidateDiagrams();
    rebuildCampaigns();
    render();
    dialog.showModal();
    restoreSelection();
  }
  search.addEventListener('input', () => {
    ++visit; // Late preparation feedback belongs to the view that requested it.
    message = '';
    selectedId = '';
    savedScroll = 0;
    list.scrollTop = 0;
    render();
    remember();
  });
  for (const control of [collection, campaign, modeFilter])
    control.addEventListener('change', () => {
      ++visit;
      message = '';
      selectedId = '';
      savedScroll = 0;
      list.scrollTop = 0;
      if (control !== campaign) rebuildCampaigns();
      if (control === modeFilter) invalidateDiagrams();
      render();
      remember();
    });
  back.onclick = close;
  dialog.addEventListener('cancel', (event) => {
    if (event.target === dialog) {
      event.preventDefault();
      close();
    }
  });
  const unsubscribe = library.subscribe(() => {
    if (dialog.open) {
      rebuildCampaigns();
      render();
    }
  });
  return {
    open,
    close,
    state,
    refresh() {
      if (dialog.open) {
        invalidateDiagrams();
        rebuildCampaigns();
        render();
      }
    },
    destroy() {
      close();
      destroyed = true;
      unsubscribe();
      observer?.disconnect();
      dialog.remove();
    },
  };
}
