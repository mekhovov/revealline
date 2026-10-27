import { t, localizedText, formatNumber } from '../i18n/index.mjs';

const reviews = new WeakMap();
const copy = (key, values) => t(`interface:community.removal.${key}`, values);

/** The caller supplies a capability from the existing storage owner's review.
 * This view only asks for a decision; it never removes or offloads anything. */
export function confirmCommunityRemoval({
  document: doc,
  window: win = doc.defaultView,
  kind,
  edition,
  review,
  opener,
  fallback,
  isCurrent = () => true,
}) {
  if (!['offload', 'download'].includes(kind)) throw new TypeError('Unknown removal review.');
  reviews.get(doc)?.();
  if (!isCurrent() || doc.hidden) return Promise.resolve({ confirmed: false, restoreFocus() {} });
  const element = (tag, id, message) => {
    const node = doc.createElement(tag);
    node.id = `community-removal-${id}`;
    if (message) localizedText(node, message);
    return node;
  };
  const dialog = element('dialog', 'dialog'),
    title = element('h2', 'title', () => copy(`${kind}.title`)),
    identity = element('p', 'identity', () =>
      copy('edition', { title: edition.title, version: edition.version }),
    ),
    details = element('dl', 'details'),
    keep = element('button', 'keep', () => copy('keep')),
    confirm = element('button', 'confirm', () => copy(`${kind}.confirm`)),
    actions = element('div', 'actions');
  dialog.className = 'community-removal-review';
  dialog.setAttribute('aria-labelledby', title.id);
  dialog.setAttribute('aria-describedby', identity.id);
  for (const key of ['content', 'progress', 'recovery'])
    details.append(
      element('dt', `${key}-label`, () => copy(key)),
      element('dd', key, () => copy(`${kind}.${key}`)),
    );
  dialog.append(title, identity, details);
  if (kind === 'offload') {
    dialog.append(
      element('p', 'bytes', () =>
        copy('bytes', { bytes: formatNumber(review.detachableBytes ?? 0) }),
      ),
    );
    if (review.localCopyRetained)
      dialog.append(element('p', 'local-copy', () => copy('localCopy')));
  }
  keep.type = confirm.type = 'button';
  keep.autofocus = true;
  confirm.className = 'secondary';
  actions.className = 'actions';
  actions.append(keep, confirm);
  dialog.append(actions);
  doc.body.append(dialog);
  let settled = false,
    focusOwned = true,
    resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  const removeFocusListeners = () => {
    doc.removeEventListener('focusin', focusChanged, true);
    doc.removeEventListener('pointerdown', interaction, true);
    doc.removeEventListener('keydown', interaction, true);
    win?.removeEventListener('blur', blurred, true);
    win?.removeEventListener('pagehide', departing);
    doc.removeEventListener('visibilitychange', hidden);
  };
  const retireFocus = () => {
    focusOwned = false;
    removeFocusListeners();
  };
  const focusChanged = (event) => {
    if (
      event.target !== opener &&
      event.target !== doc.body &&
      event.target !== doc.documentElement &&
      !dialog.contains(event.target)
    )
      retireFocus();
  };
  const interaction = (event) => {
    if (event.target !== opener && !dialog.contains(event.target)) retireFocus();
  };
  const blurred = (event) => {
    if (event.target === win) retireFocus();
  };
  function finish(confirmed, restore = true) {
    if (settled) return;
    settled = true;
    if (!restore) retireFocus();
    if (reviews.get(doc) === cancel) reviews.delete(doc);
    if (dialog.open) dialog.close();
    dialog.remove();
    resolve({
      confirmed,
      restoreFocus() {
        const target = opener?.isConnected ? opener : fallback?.(),
          active = doc.activeElement,
          allowed =
            focusOwned &&
            !doc.hidden &&
            doc.hasFocus?.() !== false &&
            ([opener, doc.body, doc.documentElement, null].includes(active) ||
              dialog.contains(active)) &&
            target?.isConnected &&
            !target.disabled &&
            !target.closest('[hidden],[inert]');
        retireFocus();
        if (allowed) target.focus({ preventScroll: true });
      },
    });
  }
  const cancel = () => finish(false, false),
    departing = () => {
      retireFocus();
      cancel();
    },
    hidden = () => {
      if (doc.hidden) departing();
    };
  reviews.set(doc, cancel);
  keep.onclick = () => finish(false);
  confirm.onclick = () => finish(isCurrent() && !doc.hidden);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    finish(false);
  });
  dialog.addEventListener('close', () => finish(false));
  doc.addEventListener('focusin', focusChanged, true);
  doc.addEventListener('pointerdown', interaction, true);
  doc.addEventListener('keydown', interaction, true);
  win?.addEventListener('blur', blurred, true);
  win?.addEventListener('pagehide', departing);
  doc.addEventListener('visibilitychange', hidden);
  try {
    dialog.showModal();
    keep.focus({ preventScroll: true });
  } catch (error) {
    finish(false, false);
    throw error;
  }
  return promise;
}
