import { t, localizedText } from '../i18n/index.mjs';
import { attachOptionalChaptersPanel } from '../ui/optional-chapters-panel.mjs';
import { loadOptionalCatalog } from '../optional-chapters.mjs';
import { emptyPackLibrary } from '../packs.mjs';
import { createCouchChapterInstaller } from './couch-chapter-install.mjs';

/** Catalogue navigation owns pending work; the host alone adopts or starts a race. */
export function attachCouchCatalogue({
  document: doc = globalThis.document,
  button,
  channel,
  registeredEntries,
  getAttempt,
  isAttemptCurrent,
  stage,
  onOpen = () => {},
  onClose = () => {},
  onRead = ({ region }) => region.focus(),
} = {}) {
  let inventory = { library: emptyPackLibrary(), usage: null },
    disposed = false,
    visit = 0,
    ticket = null,
    decision = null,
    opener = null;
  const baseURL = new URL('../../', globalThis.location.href);
  const installer = createCouchChapterInstaller({ channel, registeredEntries, baseURL });
  const foreground = () => !doc.hidden && doc.hasFocus?.() !== false;
  const modal = doc.createElement('dialog');
  modal.id = 'race-chapter-replace';
  modal.className = 'race-chapter-replace field-kit-panel';
  modal.setAttribute('aria-labelledby', 'race-chapter-replace-title');
  const heading = doc.createElement('h2');
  heading.id = 'race-chapter-replace-title';
  localizedText(heading, () => t('interface:startAnotherChapter'));
  const description = doc.createElement('p');
  localizedText(description, () => t('interface:bothBoardsArePausedStayKeepsThisRaceAndSeries'));
  const actions = doc.createElement('div');
  actions.className = 'race-menu-actions';
  const stay = doc.createElement('button');
  stay.id = 'race-chapter-stay';
  stay.type = 'button';
  localizedText(stay, () => t('interface:stay'));
  const replace = doc.createElement('button');
  replace.id = 'race-chapter-play';
  replace.type = 'button';
  replace.className = 'field-kit-primary';
  localizedText(replace, () => t('interface:replacePlay'));
  actions.append(stay, replace);
  modal.append(heading, description, actions);
  doc.body.append(modal);
  const intents = new WeakMap();
  const current = (intent) =>
    !disposed &&
    ticket === intent &&
    visit === intent.visit &&
    !intent.signal.aborted &&
    !intent.moved &&
    foreground() &&
    isAttemptCurrent(intent.attempt) &&
    intent.launch.isCurrent();
  function settleDecision(accepted) {
    const pending = decision;
    if (!pending) return;
    decision = null;
    if (modal.open) modal.close();
    pending.resolve(accepted && current(pending.intent));
  }
  stay.onclick = () => settleDecision(false);
  replace.onclick = () => settleDecision(true);
  modal.addEventListener('cancel', (event) => {
    event.preventDefault();
    settleDecision(false);
  });
  modal.addEventListener('close', () => {
    if (!modal.open) settleDecision(false);
  });
  function releaseIntent(intent) {
    if (!intent) return;
    doc.removeEventListener('focusin', intent.focus);
    intent.signal.removeEventListener('abort', intent.abort);
    if (ticket === intent) ticket = null;
  }
  function capture({ launch, signal }) {
    releaseIntent(ticket);
    const intent = {
      launch,
      signal,
      visit,
      attempt: getAttempt(),
      moved: false,
      focus: null,
      abort: null,
    };
    intent.focus = (event) => {
      const target = event.target;
      if (
        ![
          launch.opener,
          doc.body,
          doc.documentElement,
          doc.getElementById('optional-worlds-dialog'),
          doc.getElementById('optional-worlds-cancel'),
        ].includes(target) &&
        !modal.contains(target)
      )
        intent.moved = true;
    };
    intent.abort = () => {
      if (decision?.intent === intent) settleDecision(false);
    };
    ticket = intent;
    intents.set(launch, intent);
    doc.addEventListener('focusin', intent.focus);
    signal.addEventListener('abort', intent.abort, { once: true });
    // Touch need not focus Play, and it is already disabled during preparation.
    // The open catalogue can own initial focus and the nested decision's return.
    // Recheck after focusing: callbacks and later user choices retire this lease.
    const dialog = doc.getElementById('optional-worlds-dialog'),
      cancel = doc.getElementById('optional-worlds-cancel');
    // The panel has already transferred a disabled Play opener to Cancel.
    // Keep that actionable focus; touch from another control still admits
    // through the dialog and must pass the existing post-focus lease check.
    const ownsCancel =
      current(intent) &&
      dialog?.open &&
      dialog.getAttribute('aria-busy') === 'true' &&
      dialog.contains(cancel) &&
      doc.activeElement === cancel &&
      cancel?.isConnected &&
      !cancel.disabled &&
      !cancel.closest('[hidden],[inert],[aria-hidden="true"]') &&
      (typeof cancel.getClientRects !== 'function' || cancel.getClientRects().length > 0);
    if (doc.activeElement !== launch.opener && !ownsCancel) {
      try {
        if (!current(intent) || !dialog?.open)
          throw new DOMException(t('interface:chapterActivationIsNoLongerCurrent'), 'AbortError');
        dialog.focus({ preventScroll: true });
        if (!current(intent) || doc.activeElement !== dialog)
          throw new DOMException(t('interface:chapterActivationIsNoLongerCurrent'), 'AbortError');
      } catch (error) {
        releaseIntent(intent);
        throw error;
      }
    }
  }
  async function playPack(pack, { signal, onStatus, launch }) {
    const intent = intents.get(launch);
    const check = () => {
      if (!intent || !current(intent))
        throw new DOMException(
          t('interface:chapterPreparationCancelledTheCurrentRaceIsKept'),
          'AbortError',
        );
    };
    check();
    let candidate;
    try {
      candidate = await stage(pack, {
        signal,
        onStatus,
        attempt: intent.attempt,
        isCurrent: () => current(intent),
      });
      check();
      if (intent.attempt.match.status === 'paused') {
        const accepted = await new Promise((resolve) => {
          decision = { intent, resolve };
          modal.showModal();
          stay.focus();
          if (!current(intent)) settleDecision(false);
        });
        if (!accepted) {
          if (current(intent)) launch.onCancelled({ dialog: modal });
          return false;
        }
      }
      await candidate.confirm();
      check();
      const adopted = candidate.adopt(() => current(intent));
      if (!adopted)
        throw new DOMException(
          t('interface:chapterPreparationCancelledTheCurrentRaceIsKept'),
          'AbortError',
        );
      // The new attempt owns its pictures before panel close aborts pending work.
      // Closing may reenter the host; it never supplies start authority by itself.
      releaseIntent(intent);
      if (!adopted.current() || !launch.isCurrent()) return false;
      launch.onStarted();
      if (adopted.current() && !root() && foreground()) return adopted.start();
      return false;
    } finally {
      if (decision?.intent === intent) settleDecision(false);
      releaseIntent(intent);
      candidate?.dispose();
    }
  }
  const panel = attachOptionalChaptersPanel({
    document: doc,
    heading: t('interface:chaptersCouchVersus'),
    backLabel: t('interface:backToVersus'),
    attemptLabel: 'race',
    showManage: false,
    getLibrary: () => inventory.library,
    getUsage: () => inventory.usage,
    async refreshLibrary({ signal, onStatus }) {
      const next = await installer.inspect({ signal, onStatus });
      if (!disposed && !signal.aborted) inventory = next;
    },
    loadCatalog: ({ signal }) => loadOptionalCatalog({ baseURL, signal }),
    async install(item, options) {
      const next = await installer.install(item, options);
      if (!disposed && !options.signal.aborted) inventory = next;
    },
    play(item, options) {
      const pack = inventory.library.packs.find((entry) => entry.id === item.id);
      if (!pack) throw new Error(t('interface:refreshChaptersBeforePlayingThisEdition'));
      return playPack(pack, options);
    },
    playInstalled: playPack,
    onPlayActivation: capture,
    onOpen() {
      ++visit;
      opener = button;
      onOpen();
    },
    onClose() {
      const closingVisit = ++visit,
        closingOpener = opener;
      settleDecision(false);
      releaseIntent(ticket);
      const focused = doc.activeElement,
        dialog = doc.getElementById('optional-worlds-dialog');
      const ownsFocus =
        [doc.body, doc.documentElement, closingOpener, modal, dialog].includes(focused) ||
        modal.contains(focused) ||
        dialog?.contains(focused);
      onClose();
      if (
        !disposed &&
        visit === closingVisit &&
        !root() &&
        ownsFocus &&
        doc.activeElement === focused &&
        foreground() &&
        closingOpener?.isConnected &&
        !closingOpener.disabled &&
        !closingOpener.closest('[hidden],[inert],[aria-hidden="true"]') &&
        (typeof closingOpener.getClientRects !== 'function' ||
          closingOpener.getClientRects().length)
      )
        closingOpener.focus({ preventScroll: true });
    },
    onChosen: () => onClose(),
    onRead,
  });
  function root() {
    if (modal.open) return modal;
    const dialog = doc.getElementById('optional-worlds-dialog');
    return dialog?.open ? dialog : null;
  }
  function cancel() {
    ++visit;
    settleDecision(false);
    releaseIntent(ticket);
    panel.cancel({ restoreFocus: false });
    installer.cancel();
  }
  function close() {
    settleDecision(false);
    panel.close();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    cancel();
    panel.dispose();
    installer.dispose();
    modal.remove();
  }
  return Object.freeze({
    open: () => panel.open(),
    close,
    back: () => (modal.open ? settleDecision(false) : close()),
    cancel,
    root,
    primary: () => (modal.open ? stay : doc.getElementById('optional-worlds-top-back')),
    dispose,
  });
}
