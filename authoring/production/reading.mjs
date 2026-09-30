import { localizedAttribute } from '../../game/i18n/index.mjs';
import { authoringLabel, authoringText } from '../../game/ui/authoring-copy.mjs';
import { setMenuIcon } from '../../game/ui/native-menu-icons.mjs';

/** Local controls for the shared, bounded text reader. No extra input polling. */
export function attachProductionReader({ navigation, region, id, label }) {
  if (!navigation) return null;
  const doc = region.ownerDocument,
    toolbar = doc.createElement('div'),
    entry = doc.createElement('button'),
    done = doc.createElement('button');
  toolbar.className = 'production-reading-tools';
  entry.id = `production-read-${id}`;
  done.id = `${entry.id}-done`;
  entry.type = done.type = 'button';
  authoringLabel(entry, 'readPage');
  authoringLabel(done, 'back');
  localizedAttribute(entry, 'aria-label', () => `${authoringText('readPage')}: ${label}`);
  setMenuIcon(entry, 'missions');
  setMenuIcon(done, 'back');
  region.id = `production-${id}-region`;
  region.tabIndex = 0;
  region.setAttribute('data-game-reading', '');
  region.setAttribute('role', 'region');
  region.setAttribute('aria-label', label);
  region.classList.add('production-reading-region');
  toolbar.append(entry, done);
  region.before(toolbar);
  let active = false;
  const refresh = () => {
    active = navigation.readingState()?.regionId === region.id;
    entry.setAttribute('aria-pressed', String(active));
    done.disabled = !active;
  };
  entry.onclick = () => {
    navigation.beginReading({ region, origin: entry, label, exit: done });
    refresh();
  };
  done.onclick = () => {
    navigation.endReading();
    refresh();
  };
  const observer = new doc.defaultView.MutationObserver(refresh);
  observer.observe(region, { attributes: true, attributeFilter: ['data-controller-reading'] });
  refresh();
  return {
    entry,
    destroy() {
      if (navigation.readingState()?.regionId === region.id)
        navigation.endReading({ restoreFocus: false });
      observer.disconnect();
      entry.onclick = done.onclick = null;
      toolbar.remove();
      region.removeAttribute('data-game-reading');
    },
  };
}
