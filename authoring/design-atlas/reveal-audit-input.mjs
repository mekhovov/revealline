import { mountAuthoringInputHost } from '../../game/ui/authoring-input-host.mjs';
import { authoringLabel, authoringText } from '../../game/ui/authoring-copy.mjs';
import { localizedAttribute, onLocaleChange } from '../../game/i18n/index.mjs';
import { setMenuIcon } from '../../game/ui/native-menu-icons.mjs';

/** The audit owns only its disclosures. The existing host owns every input device. */
export function mountRevealAuditInput(doc, win, onBack) {
  const owner = mountAuthoringInputHost({
    document: doc,
    window: win,
    onPageBack: () => {
      if (onBack()) return;
      const details = doc.activeElement?.closest?.('details[open]');
      if (details?.id.startsWith('reveal-owners-')) {
        details.open = false;
        details.querySelector('summary')?.focus();
      } else owner.navigation.handle({ menu: true });
    },
  });
  return owner;
}

/** Bounded readers share the host's focus, lifecycle and Confirm transaction. */
export function attachRevealAuditReader({ navigation, region, id, label }) {
  const doc = region.ownerDocument;
  const tools = doc.createElement('div');
  tools.className = 'reveal-reading-tools';
  const entry = doc.createElement('button'),
    done = doc.createElement('button');
  entry.type = done.type = 'button';
  entry.id = `reveal-read-${id}`;
  done.id = `${entry.id}-done`;
  authoringLabel(entry, 'readPage');
  authoringLabel(done, 'back');
  setMenuIcon(entry, 'missions');
  setMenuIcon(done, 'back');
  localizedAttribute(entry, 'aria-label', () => `${authoringText('readPage')}: ${label()}`);
  region.tabIndex = 0;
  region.setAttribute('data-game-reading', '');
  region.setAttribute('role', 'region');
  region.classList.add('reveal-reading-region');
  localizedAttribute(region, 'aria-label', label);
  tools.append(entry, done);
  region.before(tools);
  let disposed = false;
  const refresh = () => {
    entry.setAttribute('aria-pressed', String(navigation.readingState()?.regionId === region.id));
    done.disabled = navigation.readingState()?.regionId !== region.id;
  };
  const observer = new doc.defaultView.MutationObserver(refresh);
  observer.observe(region, { attributes: true, attributeFilter: ['data-controller-reading'] });
  const finish = () => {
    navigation.endReading();
    refresh();
  };
  entry.onclick = () => {
    navigation.beginReading({ region, origin: entry, label: label(), getLabel: label, exit: done });
    refresh();
  };
  done.onclick = finish;
  // Heading bindings may register after this reader; derive names after all locale callbacks.
  const unsubscribe = onLocaleChange(
    () => () => {
      if (disposed) return;
      entry.setAttribute('aria-label', `${authoringText('readPage')}: ${label()}`);
      region.setAttribute('aria-label', label());
    },
    { before: true },
  );
  refresh();
  return {
    entry,
    destroy() {
      disposed = true;
      if (navigation.readingState()?.regionId === region.id)
        navigation.endReading({ restoreFocus: false });
      observer.disconnect();
      unsubscribe();
      entry.onclick = done.onclick = null;
      tools.remove();
      region.removeAttribute('data-game-reading');
    },
  };
}
