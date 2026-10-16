import { t, localizedText, localizedMessage, localizedAttribute } from '../i18n/index.mjs';
import { createOperationStatus } from '../ui/operation-status.mjs';
import { attachTeamDiscoveryPictures } from './team-discovery-pictures.mjs';

/** Same-page discovery UI. The host owns content validation, staged attempts and
 * exact artwork; opening a card never changes a pack or awards a picture here.
 */
export function attachTeamDiscovery({
  document,
  dialog,
  list,
  status,
  back,
  cancel,
  search = null,
  campaign = null,
  getEntries,
  presentCard = () => false,
  canOpen = () => true,
  activate,
  preparePreview,
  preview,
  onViewChange = () => {},
  onOpen = () => {},
  onClose = () => {},
}) {
  let visit = null,
    visitSequence = 0,
    operation = null,
    selected = null,
    disposed = false;
  const feedback = createOperationStatus(status, { isCurrent: () => !disposed && Boolean(visit) });
  const foreground = () => !document.hidden && document.hasFocus?.() !== false;
  const unclaimed = (element) =>
    !element || element === document.body || element === document.documentElement;
  const visible = (element) =>
    element?.isConnected && !element.disabled && !element.closest('[hidden],[inert]');
  const owns = (owner) => !disposed && visit === owner;
  const live = (owner) => owns(owner) && dialog.open;
  const available = () => {
    const cards = visit?.cards.filter(({ card }) => !card.hidden) ?? [];
    return cards.find(({ row }) => row.key === selected) ?? cards[0];
  };
  const pictures =
    preview && preparePreview
      ? attachTeamDiscoveryPictures({
          document,
          dialog,
          list,
          back,
          preview,
          prepare: preparePreview,
          select: (key) => {
            selected = key;
          },
          onViewChange,
          onReturnFocus: (target) => revealFocused(visit, target, () => !pictures?.primary()),
        })
      : null;
  const primary = () => pictures?.primary() ?? (operation ? cancel : (available()?.button ?? back));
  function describe(owner, message, state = 'ready') {
    if (!owns(owner)) return;
    const display = feedback.begin({ message, stage: 'preparing', isCurrent: () => owns(owner) });
    if (state !== 'preparing' && owns(owner)) display.finish({ message, state });
  }
  function controls(owner, busy) {
    if (!owns(owner)) return;
    for (const { button } of owner.cards) {
      if (!owns(owner)) return;
      button.disabled = busy;
    }
    if (!owns(owner)) return;
    cancel.hidden = !busy;
    if (owns(owner)) list.setAttribute('aria-busy', String(busy));
    if (owns(owner)) pictures?.setBusy(busy);
    if (owns(owner) && search) search.disabled = busy;
    if (owns(owner) && campaign) campaign.disabled = busy;
  }
  function restoreCard(owner, button) {
    if (!live(owner) || operation || !foreground() || !visible(button)) return;
    const active = document.activeElement;
    if (unclaimed(active) || active === dialog || active === cancel || active === button)
      button.focus({ preventScroll: true });
  }
  function cancelPending({ restore = false, announce = true } = {}) {
    const pending = operation;
    if (!pending) return false;
    operation = null;
    pending.controller.abort();
    if (!live(pending.owner) || operation) return true;
    controls(pending.owner, false);
    if (announce && live(pending.owner) && !operation)
      describe(pending.owner, t('interface:preparationCancelledYourCurrentAttemptIsUnchanged'));
    if (restore) restoreCard(pending.owner, pending.button);
    return true;
  }
  async function play(owner, row, button) {
    if (!live(owner) || operation || !foreground() || !visible(button)) return;
    selected = row.key;
    const pending = { owner, row, button, controller: new AbortController() };
    operation = pending;
    const current = () =>
      live(owner) && operation === pending && !pending.controller.signal.aborted;
    try {
      controls(owner, true);
      if (!current()) return;
      describe(
        owner,
        () => t('interface:team.preparingAttemptDestination', { mission: row.title }),
        'preparing',
      );
      if (!current()) return;
      cancel.focus({ preventScroll: true });
      if (!current()) return;
      if (document.activeElement !== cancel) {
        // A newer focus choice made while admitting Play belongs to the player.
        // The host's preparation listeners have not been installed yet.
        cancelPending();
        return;
      }
      const started = await activate(row, {
        signal: pending.controller.signal,
        isCurrent: current,
        opener: button,
        onStatus: (message) => {
          if (current() && typeof message === 'string') describe(owner, message, 'preparing');
        },
      });
      if (!current()) return;
      operation = null;
      if (started) {
        // The host has accepted the prepared attempt. Closing must not abort its
        // successful preparation signal or restore the old lobby/result opener.
        close({ restore: false });
      } else {
        controls(owner, false);
        describe(owner, t('interface:yourCurrentAttemptIsUnchangedChooseAnArenaWhenReady'));
        restoreCard(owner, button);
      }
    } catch (error) {
      if (!current()) return;
      operation = null;
      controls(owner, false);
      describe(
        owner,
        error?.name === 'AbortError'
          ? t('interface:preparationCancelledYourCurrentAttemptIsUnchanged')
          : () => t('interface:team.arenaPreparationFailed', { mission: row.title }),
        error?.name === 'AbortError' ? 'ready' : 'error',
      );
      restoreCard(owner, button);
    }
  }
  function populate(owner) {
    const rows = getEntries();
    if (!Array.isArray(rows)) throw new TypeError(t('interface:teamArenasAreUnavailable'));
    const keys = new Set(),
      packs = [];
    const cards = rows.map((row) => {
      if (!row || typeof row.key !== 'string' || keys.has(row.key))
        throw new TypeError(t('interface:teamArenaIdentitiesAreUnavailable'));
      keys.add(row.key);
      const card = document.createElement('article');
      card.className = 'team-discovery-card field-kit-panel';
      const pack = document.createElement('p');
      pack.className = 'eyebrow';
      localizedText(pack, () => `${row.packName} · ${row.sourceLabel}`);
      const title = document.createElement('h3');
      localizedText(title, () => row.title);
      const goal = document.createElement('p');
      localizedText(goal, () => row.goal);
      const button = document.createElement('button');
      button.type = 'button';
      localizedText(button, () => t('interface:team.playMission', { mission: row.title }));
      localizedAttribute(button, 'aria-label', () =>
        t('interface:team.playMissionLabel', {
          mission: row.title,
          campaign: row.packName,
          source: row.sourceLabel,
        }),
      );
      button.className = 'field-kit-primary team-discovery-play';
      button.onclick = () => play(owner, row, button);
      card.append(pack, title, goal);
      const hasDiagram = presentCard({ document, row, card }) === true;
      card.append(button);
      let group = packs.findIndex((pack) => pack === row.pack);
      if (group < 0) group = packs.push(row.pack) - 1;
      return {
        row,
        button,
        card,
        hasDiagram,
        group: String(group),
        searchText: `${row.levelId} ${card.textContent}`.normalize('NFKC').toLocaleLowerCase(),
      };
    });
    if (!owns(owner)) return;
    owner.cards = cards;
    owner.query = owner.group = '';
    if (search) search.value = '';
    if (campaign) {
      const option = (value, label) => {
        const item = document.createElement('option');
        item.value = value;
        localizedText(item, () => label);
        return item;
      };
      campaign.replaceChildren(
        option('', localizedMessage('interface:allCampaignsAndPacks')),
        ...packs.map((pack, index) => {
          const row = cards.find((card) => card.row.pack === pack).row;
          return option(String(index), `${row.packName} · ${row.sourceLabel}`);
        }),
      );
      campaign.value = '';
    }
    if (!owns(owner)) return;
    list.replaceChildren(...cards.map(({ card }) => card));
    if (!owns(owner)) return;
    pictures?.populate(cards.filter(({ hasDiagram }) => !hasDiagram));
    if (!owns(owner)) return;
    describe(
      owner,
      cards.length
        ? t('interface:chooseAnArenaYourCurrentAttemptStaysAvailableUntilThe')
        : t('interface:noCompatibleTeamArenasAreAvailableBackKeepsYourCurrent'),
    );
    controls(owner, false);
  }
  function filterCards() {
    const owner = visit;
    if (!owner || !live(owner)) return;
    if (operation || pictures?.primary()) {
      if (search) search.value = owner.query;
      if (campaign) campaign.value = owner.group;
      return;
    }
    owner.query = (search?.value ?? '').slice(0, 160);
    owner.group = campaign?.value ?? '';
    const words = owner.query
      .normalize('NFKC')
      .toLocaleLowerCase()
      .trim()
      .split(/\s+/u)
      .filter(Boolean);
    let count = 0;
    for (const entry of owner.cards) {
      if (!live(owner)) return;
      entry.card.hidden =
        Boolean(owner.group && owner.group !== entry.group) ||
        !words.every((word) => entry.searchText.includes(word));
      if (!entry.card.hidden) count++;
    }
    if (!live(owner)) return;
    describe(
      owner,
      count
        ? t('interface:team.filteredMissions', { count, total: owner.cards.length })
        : t('interface:noMatchingTeamMissionsClearSearchOrChooseAllCampaigns'),
    );
    onViewChange();
  }
  if (search) search.oninput = filterCards;
  if (campaign) campaign.onchange = filterCards;
  function revealFocused(owner, target, isTargetCurrent) {
    const current = () =>
      live(owner) &&
      !operation &&
      foreground() &&
      document.activeElement === target &&
      dialog.contains(target) &&
      isTargetCurrent() &&
      visible(target);
    if (!current()) return;
    const rect = target.getBoundingClientRect(),
      bounds = dialog.getBoundingClientRect(),
      width = document.documentElement.clientWidth || document.defaultView?.innerWidth,
      height = document.documentElement.clientHeight || document.defaultView?.innerHeight,
      left = Math.max(0, bounds.left + dialog.clientLeft),
      top = Math.max(0, bounds.top + dialog.clientTop),
      right = Math.min(width, bounds.left + dialog.clientLeft + dialog.clientWidth),
      bottom = Math.min(height, bounds.top + dialog.clientTop + dialog.clientHeight);
    if (
      ![rect.left, rect.top, rect.right, rect.bottom, left, top, right, bottom].every(
        Number.isFinite,
      ) ||
      rect.width <= 0 ||
      rect.height <= 0 ||
      right <= left ||
      bottom <= top ||
      (rect.left >= left && rect.right <= right && rect.top >= top && rect.bottom <= bottom)
    )
      return;
    // Focus and layout callbacks may publish a newer visit or destination.
    if (current())
      target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  }
  function open(opener = document.activeElement) {
    if (disposed || dialog.open || visit || !foreground() || !canOpen()) return false;
    const owner = { opener, cards: [], restore: true, sequence: ++visitSequence };
    visit = owner;
    try {
      onOpen();
      if (!owns(owner)) return false;
      try {
        populate(owner);
      } catch {
        if (!owns(owner)) return false;
        list.replaceChildren();
        describe(
          owner,
          t('interface:teamArenasAreUnavailableBackKeepsYourCurrentAttempt'),
          'error',
        );
        controls(owner, false);
      }
      if (!owns(owner)) return false;
      dialog.showModal();
      if (!live(owner)) return false;
      const active = document.activeElement,
        target = primary();
      if (unclaimed(active) || active === opener || active === dialog || active === back)
        target.focus({ preventScroll: true });
      // Native showModal may already have focused this action. Reveal it without
      // refocusing, but only while the same visit still owns that focus.
      revealFocused(owner, target, () => primary() === target);
      if (live(owner)) pictures?.start();
      return live(owner);
    } catch {
      if (owns(owner)) {
        if (dialog.open) close();
        else {
          visit = null;
          onClose();
        }
      }
      return false;
    }
  }
  function closed() {
    if (dialog.open || !visit) return;
    const owner = visit;
    visit = null;
    // Retire this visit before abort/onClose or native focus callbacks reenter.
    const pending = operation;
    operation = null;
    pending?.controller.abort();
    if (visit || visitSequence !== owner.sequence) return;
    pictures?.close();
    if (visit || visitSequence !== owner.sequence) return;
    onClose();
    if (
      disposed ||
      visit ||
      dialog.open ||
      !owner.restore ||
      !foreground() ||
      !visible(owner.opener)
    )
      return;
    const active = document.activeElement;
    if (unclaimed(active) || active === dialog || dialog.contains(active))
      owner.opener.focus({ preventScroll: true });
  }
  function close({ restore = true } = {}) {
    if (!visit) return;
    const owner = visit;
    owner.restore = restore;
    pictures?.close();
    if (visit !== owner) return;
    if (dialog.open) dialog.close();
    else closed();
  }
  const cancelled = (event) => {
    event.preventDefault();
    goBack();
  };
  const keydown = (event) => {
    if (event.key === 'Escape') event.stopPropagation();
  };
  function goBack() {
    if (!pictures?.back()) close();
  }
  back.onclick = goBack;
  cancel.onclick = () => cancelPending({ restore: true });
  dialog.addEventListener('close', closed);
  dialog.addEventListener('cancel', cancelled);
  dialog.addEventListener('keydown', keydown);
  return {
    open,
    close,
    back: goBack,
    cancel: () => {
      cancelPending();
      pictures?.cancel();
    },
    primary,
    isOpen: () => !disposed && dialog.open,
    dispose() {
      if (disposed) return;
      disposed = true;
      visit = null;
      const pending = operation;
      operation = null;
      pending?.controller.abort();
      pictures?.dispose();
      back.onclick = cancel.onclick = null;
      if (search) search.oninput = null;
      if (campaign) campaign.onchange = null;
      dialog.removeEventListener('close', closed);
      dialog.removeEventListener('cancel', cancelled);
      dialog.removeEventListener('keydown', keydown);
      feedback.dispose();
      if (dialog.open) dialog.close();
    },
  };
}
