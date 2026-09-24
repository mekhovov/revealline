import { createJourneyArtworkView } from './journey-artwork.mjs';
import { LIBRARY_COLLECTIONS, LIBRARY_MODES } from '../mission-library/library.mjs';
import { paintMissionThumbnail } from '../content-design/mission-card.mjs';
import { trackMissionLibraryOpening } from '../mission-library/opening-intent.mjs';

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
  launchContext = () => ({}),
  getCurrentId = () => null,
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
  copy.className = 'journey-library-copy';
  const filters = node('div');
  filters.className = 'journey-filters';
  function field(title, id, type = 'select', parent = filters) {
    const label = node('label'),
      caption = node('span', null, title),
      control = node(type, id);
    caption.className = 'journey-filter-label';
    label.append(caption, control);
    parent.append(label);
    return control;
  }
  const search = field('Search all missions', 'journey-search', 'input');
  search.parentElement.className = 'journey-search-field';
  search.type = 'search';
  search.placeholder = 'Mission, campaign, edition or tag';
  const searchControls = node('div');
  searchControls.className = 'journey-search-controls';
  const clearSearch = node('button', 'journey-search-clear', 'Clear search');
  clearSearch.type = 'button';
  clearSearch.className = 'button secondary';
  clearSearch.setAttribute('aria-controls', 'journey-cards');
  search.parentElement.after(searchControls);
  searchControls.append(search.parentElement, clearSearch);
  const filterDetails = node('details', 'journey-filter-details');
  filterDetails.className = 'journey-filter-details';
  const filterSummary = node('summary', 'journey-filter-summary', 'Filters');
  const filterOptions = node('div');
  filterOptions.className = 'journey-filter-options';
  filterDetails.append(filterSummary, filterOptions);
  filters.append(filterDetails);
  const collection = field('Collection', 'journey-collection', 'select', filterOptions);
  const campaign = field('Campaign', 'journey-campaign', 'select', filterOptions);
  const modeFilter = field('Mode', 'journey-mode', 'select', filterOptions);
  const detailLabel = node('label');
  detailLabel.className = 'journey-card-detail-control';
  const detailedCards = node('input', 'journey-detailed-cards');
  detailedCards.type = 'checkbox';
  detailLabel.append(detailedCards, node('span', null, 'Detailed mission cards'));
  filterOptions.append(detailLabel);
  const view = doc.defaultView ?? globalThis;
  const media = view.matchMedia?.('(max-width: 600px), (max-height: 480px)');
  let compact = media?.matches === true;
  filterDetails.open = !compact;
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
    nativeReturnFocus = null,
    selectedId = '',
    savedScroll = 0,
    pendingCampaign = '',
    pendingSelection = null,
    visit = 0,
    destroyed = false,
    resizeFrame = null,
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
    // The caller scopes state by hosting mode. Its browsing filter can point at
    // another mode and must survive a round trip back to this same host.
    if (LIBRARY_MODES.includes(saved.mode)) {
      modeFilter.value = saved.mode;
      selectedId = typeof saved.selectedId === 'string' ? saved.selectedId : '';
      savedScroll = Number.isFinite(saved.scroll) ? Math.max(0, saved.scroll) : 0;
      pendingCampaign = typeof saved.campaign === 'string' ? saved.campaign : '';
    }
  }
  function state() {
    return {
      search: search.value || '',
      collection: collection.value || '',
      campaign: campaign.value || pendingCampaign,
      mode: modeFilter.value,
      selectedId,
      scroll: dialog.open ? list.scrollTop || 0 : savedScroll,
    };
  }
  function remember({ captureFocus = true } = {}) {
    const focusedId = doc.activeElement?.closest('.journey-card')?.dataset.missionId;
    if (captureFocus && focusedId && list.contains(doc.activeElement)) selectedId = focusedId;
    if (dialog.open) savedScroll = list.scrollTop || 0;
    try {
      writeState(state());
    } catch {
      /* Do not block play on browser storage. */
    }
  }
  function rebuildCampaigns(requested = campaign.value || pendingCampaign) {
    const choices = new Map();
    for (const row of library.forMode(modeFilter.value))
      if (!collection.value || row.collection === collection.value)
        choices.set(row.campaignKey, `${row.campaignTitle} · ${row.edition}`);
    campaign.replaceChildren(
      option('All campaigns', ''),
      ...[...choices].map(([key, title]) => option(title, key)),
    );
    campaign.value = choices.has(requested) ? requested : '';
    // Remote metadata arrives only after the deliberate open. Keep a saved
    // campaign pending until that exact option exists, not as a hidden filter.
    if (campaign.value) pendingCampaign = '';
  }
  rebuildCampaigns();
  function retirePendingSelection() {
    const pending = pendingSelection;
    pendingSelection = null;
    pending?.opening.dispose();
  }
  function currentSelectionButton(id) {
    const card = cards.get(id);
    return card?.button.isConnected &&
      !card.button.disabled &&
      list.contains(card.button) &&
      library.find(id) === card.row
      ? card.button
      : null;
  }
  function primary() {
    const selected = currentSelectionButton(selectedId);
    if (selected) return selected;
    // A saved remote selection may arrive after the first render. Keep its
    // opening lease on Search instead of silently selecting another mission.
    if (selectedId && !library.find(selectedId)) return search;
    const current =
      !selectedId && modeFilter.value === mode ? currentSelectionButton(getCurrentId()) : null;
    return current ?? [...list.children].find((button) => !button.disabled) ?? search;
  }
  function restoreSelection() {
    const target = primary();
    target.focus({ preventScroll: true });
    list.scrollTop = savedScroll;
    if (target !== search) target.scrollIntoView?.({ block: 'nearest' });
    if (selectedId && !library.find(selectedId) && !doc.hidden && doc.hasFocus?.() !== false) {
      const opening = trackMissionLibraryOpening({
        document: doc,
        onRetire() {
          if (pendingSelection?.opening === opening) pendingSelection = null;
        },
      });
      pendingSelection = { opening, visit, id: selectedId, scroll: savedScroll };
    }
  }
  function restorePendingSelection() {
    const pending = pendingSelection;
    if (!pending) return;
    if (
      pending.visit !== visit ||
      !dialog.open ||
      doc.hidden ||
      doc.hasFocus?.() === false ||
      !pending.opening.current()
    ) {
      retirePendingSelection();
      return;
    }
    const button = currentSelectionButton(pending.id);
    if (!button && !library.find(pending.id)) return;
    retirePendingSelection();
    const target = button ?? primary();
    target.focus({ preventScroll: true });
    list.scrollTop = pending.scroll;
    if (target !== search) target.scrollIntoView?.({ block: 'nearest' });
  }
  function selectionVisibilityChanged() {
    if (doc.hidden) {
      retirePendingSelection();
      cancelResizeScroll();
    }
  }
  doc.addEventListener('visibilitychange', selectionVisibilityChanged);
  view.addEventListener?.('blur', retirePendingSelection);
  view.addEventListener?.('blur', cancelResizeScroll);
  async function activate(row, button) {
    // Detached cards retain their event handlers. A past view (or a closed
    // chooser) must not launch or prepare content after its intent has ended.
    if (
      destroyed ||
      !dialog.open ||
      doc.hidden ||
      doc.hasFocus?.() === false ||
      cards.get(row.id)?.button !== button ||
      !list.contains(button) ||
      library.find(row.id) !== row ||
      !row.modes.includes(modeFilter.value)
    )
      return;
    retirePendingSelection();
    selectedId = row.id;
    // Touch activation need not move keyboard focus off a different card.
    remember({ captureFocus: false });
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
    remember({ captureFocus: false });
    let context = null,
      closeRetired = false;
    // close() restores native focus and may run reentrant host listeners before
    // the owner's launch lease exists. Admit only this input turn and the
    // browser's expected return targets; a newer action must keep its focus.
    const closingFocus = new Set([
      doc.activeElement,
      nativeReturnFocus,
      doc.body,
      doc.documentElement,
      dialog,
    ]);
    const retireClose = () => {
      closeRetired = true;
    };
    const closingFocusChanged = () => {
      if (!closingFocus.has(doc.activeElement)) retireClose();
    };
    const closingInputs = ['keydown', 'pointerdown', 'click'];
    const mayRestore = () =>
      !closeRetired &&
      ticket === visit &&
      !destroyed &&
      !doc.hidden &&
      doc.hasFocus?.() !== false &&
      context?.isCurrent?.() !== false;
    const mayLaunch = () =>
      mayRestore() &&
      closingFocus.has(doc.activeElement) &&
      modeFilter.value === activeMode &&
      cards.get(row.id)?.button === button &&
      list.contains(button) &&
      library.find(row.id) === row;
    try {
      doc.addEventListener('focusin', closingFocusChanged, true);
      for (const type of closingInputs) doc.addEventListener(type, retireClose, true);
      try {
        context = launchContext(row, { mode: activeMode });
        if (!mayLaunch()) {
          context?.retire?.();
          return;
        }
        dialog.close();
        if (!mayLaunch() || dialog.open) {
          context?.retire?.();
          return;
        }
      } finally {
        doc.removeEventListener('focusin', closingFocusChanged, true);
        for (const type of closingInputs) doc.removeEventListener(type, retireClose, true);
      }
      const accepted = await library.launch(row, { ...context, mode: activeMode });
      if (accepted === false && mayRestore()) {
        message = 'Mission not opened. Your current game is kept.';
        open(opener, { returnLabel: back.textContent });
      }
    } catch (error) {
      if (mayRestore()) {
        message = `Could not open ${row.name}: ${error.message}`;
        open(opener, { returnLabel: back.textContent });
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
    const route = node('span');
    route.className = 'journey-card-route';
    const mastery = node('span');
    mastery.className = 'journey-card-mastery';
    const action = node('span');
    action.className = 'journey-card-action';
    button.append(
      number,
      name,
      campaignName,
      edition,
      tags,
      progress,
      rules,
      route,
      mastery,
      action,
    );
    button.onclick = () => activate(row, button);
    button.addEventListener('focusin', () => {
      selectedId = row.id;
    });
    return {
      row,
      button,
      progress,
      rules,
      route,
      mastery,
      action,
      diagram: null,
      artwork: null,
      completion: null,
    };
  }
  function render() {
    if (destroyed) return;
    clearSearch.hidden = !search.value;
    const focused = doc.activeElement;
    const focusedId = list.contains(focused) ? focused?.dataset.missionId : null;
    const scroll = list.scrollTop || 0;
    const matches = library.search(search.value || '', {
      mode: modeFilter.value,
      collection: collection.value,
      campaign: campaign.value,
    });
    status.textContent = `${matches.length} mission${matches.length === 1 ? '' : 's'} · ${modeLabel(modeFilter.value)}${message ? ` · ${message}` : ''}`;
    const filtersActive = !!collection.value || !!campaign.value || modeFilter.value !== mode;
    filterSummary.textContent = filtersActive ? 'Filters · active' : 'Filters';
    const buttons = matches.map((row) => {
      let card = cards.get(row.id);
      if (card?.row !== row) {
        card = makeCard(row);
        cards.set(row.id, card);
      }
      const availability = library.availability(row, modeFilter.value);
      const details = library.details(row, modeFilter.value);
      card.rules.textContent = details.challenge;
      card.rules.hidden = !details.challenge;
      card.route.textContent = details.route;
      card.route.hidden = !details.route;
      card.mastery.textContent = details.mastery ? `Optional challenge: ${details.mastery}` : '';
      card.mastery.hidden = !details.mastery;
      card.progress.textContent = library.progress(row, modeFilter.value);
      card.completion = library.completion(row, modeFilter.value);
      card.button.dataset.pictureState = card.completion?.state ?? 'unfinished';
      if (card.completion?.state === 'unavailable')
        card.progress.textContent = card.completion.reason;
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
      else primary().focus({ preventScroll: true });
    }
    list.scrollTop = scroll;
    for (const [id, card] of cards)
      if (!library.find(id)) {
        card.button.remove();
        cards.delete(id);
      }
    restorePendingSelection();
    observeDiagrams();
  }
  // Decode only near the viewport. An earned picture owns the same exact
  // descriptor as Collection; release its decoded bytes when it leaves view.
  function hidePreview(card) {
    card.artwork?.release();
    card.artwork = null;
    card.diagram = null;
    card.button.querySelector('.journey-card-map')?.remove();
    card.button.querySelector('.journey-card-picture-status')?.remove();
  }
  function showPreview(card) {
    if (card.diagram || !dialog.open || !list.contains(card.button)) return;
    if (compact && !detailedCards.checked) return;
    card.diagram = true;
    try {
      const canvas = node('canvas');
      canvas.className = 'journey-card-map';
      canvas.width = 288;
      canvas.setAttribute('aria-hidden', 'true');
      if (card.completion?.state === 'earned') {
        const pictureStatus = node('span');
        pictureStatus.className = 'journey-card-picture-status';
        card.button.append(canvas, pictureStatus);
        card.artwork = createJourneyArtworkView({ canvas, status: pictureStatus });
        void card.artwork.show(card.completion.record);
      } else {
        const diagram = library.card(card.row, modeFilter.value);
        if (!diagram) return;
        canvas.height = (288 * diagram.height) / diagram.width;
        paintMissionThumbnail(canvas.getContext('2d'), diagram, canvas.width);
        card.button.append(canvas);
      }
    } catch {
      /* Optional previews cannot prevent a mission launch. */
    }
  }
  const Observer = doc.defaultView?.IntersectionObserver ?? globalThis.IntersectionObserver;
  const observer =
    typeof Observer === 'function'
      ? new Observer(
          (entries) => {
            for (const entry of entries) {
              const card = cards.get(entry.target.dataset.missionId);
              if (!card || library.find(card.row.id) !== card.row) continue;
              if (entry.isIntersecting) showPreview(card);
              else hidePreview(card);
            }
          },
          { root: list, rootMargin: '120px' },
        )
      : null;
  function fallbackPreviews() {
    if (observer || !dialog.open) return;
    const bounds = list.getBoundingClientRect();
    let shown = 0;
    for (const button of list.children) {
      const card = cards.get(button.dataset.missionId),
        rect = button.getBoundingClientRect();
      const near = rect.bottom >= bounds.top - 120 && rect.top <= bounds.bottom + 120;
      // A bounded fallback also works in hosts without layout observation.
      if (near && card.completion?.state === 'earned' && shown < 12) {
        showPreview(card);
        shown++;
      } else hidePreview(card);
    }
  }
  function observeDiagrams() {
    for (const card of cards.values())
      if (!list.contains(card.button)) {
        observer?.unobserve(card.button);
        hidePreview(card);
      }
    if (compact && !detailedCards.checked) return;
    for (const button of list.children) observer?.observe(button);
    fallbackPreviews();
  }
  list.addEventListener('scroll', fallbackPreviews);
  function invalidateDiagrams() {
    observer?.disconnect();
    for (const card of cards.values()) hidePreview(card);
  }
  function cancelResizeScroll() {
    if (resizeFrame !== null) view.cancelAnimationFrame?.(resizeFrame);
    resizeFrame = null;
  }
  function keepFocusedCardVisible() {
    cancelResizeScroll();
    if (destroyed || !dialog.open || doc.hidden || doc.hasFocus?.() === false) return;
    const focused = doc.activeElement,
      ticket = visit;
    if (!focused || currentSelectionButton(focused.dataset.missionId) !== focused) return;
    // Layout can move the selected card outside the scrollport after rotation.
    // Scroll only the focus that owned this resize; never refocus or acquire a
    // newer action after the player has moved to a filter or another screen.
    const scroll = () => {
      resizeFrame = null;
      if (
        destroyed ||
        ticket !== visit ||
        !dialog.open ||
        doc.hidden ||
        doc.hasFocus?.() === false ||
        doc.activeElement !== focused ||
        currentSelectionButton(focused.dataset.missionId) !== focused
      )
        return;
      focused.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    };
    if (view.requestAnimationFrame) resizeFrame = view.requestAnimationFrame(scroll);
    else scroll();
  }
  view.addEventListener?.('resize', keepFocusedCardVisible);
  function resizeFilters(event) {
    compact = event.matches === true;
    // A viewport change must not hide the focused native select inside a
    // collapsed details element. No filter value or browsing state is reset.
    const focused = doc.activeElement;
    filterDetails.open = !compact;
    if (dialog.open && !doc.hidden && doc.hasFocus?.() !== false) {
      if (compact && filterOptions.contains(focused)) filterSummary.focus({ preventScroll: true });
      else if (!compact && (focused === filterSummary || detailLabel.contains(focused)))
        collection.focus({ preventScroll: true });
    }
    if (compact && !detailedCards.checked) invalidateDiagrams();
    else if (dialog.open) observeDiagrams();
    keepFocusedCardVisible();
  }
  media?.addEventListener?.('change', resizeFilters);
  detailedCards.addEventListener('change', () => {
    dialog.classList.toggle('mission-library-detailed', detailedCards.checked);
    if (compact && !detailedCards.checked) invalidateDiagrams();
    else if (dialog.open) observeDiagrams();
  });
  dialog.addEventListener('focusin', (event) => {
    // The compact filters float above cards. Once keyboard/controller focus
    // reaches an action below them, remove that cover without moving focus or
    // changing a filter. Focus and select previews inside the popover stay put.
    if (
      compact &&
      filterDetails.open &&
      (list.contains(event.target) || footer.contains(event.target))
    )
      filterDetails.open = false;
  });
  function close() {
    retirePendingSelection();
    cancelResizeScroll();
    ++visit;
    const wasOpen = dialog.open;
    // Play already saved the visible position before closing. Native hidden
    // layout reports zero; later disposal must not overwrite that position or
    // return focus away from the action that now owns this page.
    if (wasOpen) remember();
    for (const controller of downloads) controller.abort();
    if (!wasOpen) return;
    dialog.close();
    if (onReturn) onReturn(opener);
    else if (opener?.isConnected) opener.focus({ preventScroll: true });
  }
  function open(origin = doc.activeElement, { returnLabel = 'Back to game' } = {}) {
    if (destroyed) return;
    retirePendingSelection();
    cancelResizeScroll();
    ++visit;
    opener = origin;
    back.textContent = returnLabel;
    onPause?.();
    invalidateDiagrams();
    rebuildCampaigns();
    render();
    if (!dialog.open) nativeReturnFocus = doc.activeElement;
    dialog.showModal();
    observeDiagrams();
    restoreSelection();
  }
  search.addEventListener('input', () => {
    retirePendingSelection();
    pendingCampaign = '';
    ++visit; // Late preparation feedback belongs to the view that requested it.
    message = '';
    selectedId = '';
    savedScroll = 0;
    list.scrollTop = 0;
    render();
    remember();
  });
  clearSearch.onclick = () => {
    if (destroyed || !dialog.open || doc.hidden || doc.hasFocus?.() === false || !search.value)
      return;
    const ticket = visit,
      focused = doc.activeElement;
    search.value = '';
    // Use the same bubbling input path as typing, including host-owned lazy
    // loading invalidation. Clearing never changes the other visible filters.
    const EventType = doc.defaultView?.Event || Event;
    search.dispatchEvent(new EventType('input', { bubbles: true }));
    if (
      destroyed ||
      !dialog.open ||
      doc.hidden ||
      doc.hasFocus?.() === false ||
      visit !== ticket + 1 ||
      (doc.activeElement !== focused &&
        !(focused === clearSearch && doc.activeElement === doc.body))
    )
      return;
    const first = [...list.children].find((button) => !button.disabled);
    (first ?? (compact ? filterSummary : collection)).focus({ preventScroll: true });
    remember();
  };
  for (const control of [collection, campaign, modeFilter])
    control.addEventListener('change', () => {
      retirePendingSelection();
      ++visit;
      message = '';
      selectedId = '';
      savedScroll = 0;
      list.scrollTop = 0;
      pendingCampaign = '';
      if (control !== campaign) rebuildCampaigns();
      if (control === modeFilter) invalidateDiagrams();
      render();
      remember();
    });
  back.onclick = close;
  dialog.addEventListener('close', () => {
    retirePendingSelection();
    invalidateDiagrams();
  });
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
    primary,
    restore() {
      open(opener, { returnLabel: back.textContent });
    },
    close,
    state,
    reveal(id) {
      const row = library.find(id);
      if (!row || !row.modes.includes(mode)) return false;
      retirePendingSelection();
      // Exact incoming selections belong to this host, even when its last
      // browsing session was looking at a different mode.
      const modeChanged = modeFilter.value !== mode;
      modeFilter.value = mode;
      pendingCampaign = '';
      if (modeChanged || !list.contains(cards.get(id)?.button)) {
        search.value = '';
        collection.value = '';
        campaign.value = '';
        rebuildCampaigns();
        if (modeChanged) invalidateDiagrams();
        render();
      }
      selectedId = id;
      cards.get(id)?.button.focus({ preventScroll: true });
      cards.get(id)?.button.scrollIntoView?.({ block: 'nearest' });
      remember();
      return true;
    },
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
      media?.removeEventListener?.('change', resizeFilters);
      doc.removeEventListener('visibilitychange', selectionVisibilityChanged);
      view.removeEventListener?.('blur', retirePendingSelection);
      view.removeEventListener?.('blur', cancelResizeScroll);
      view.removeEventListener?.('resize', keepFocusedCardVisible);
      dialog.remove();
    },
  };
}
