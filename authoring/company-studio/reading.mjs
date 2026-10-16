import { mountAuthoringInputHost } from '../../game/ui/authoring-input-host.mjs';
import { setMenuIcon } from '../../game/ui/native-menu-icons.mjs';

/** Local explicit reading controls; the existing page navigation owns scrolling. */
export function attachCompanyReader({ document: doc, id, region, label }) {
  if (!region) return null;
  const host = mountAuthoringInputHost({ document: doc }),
    toolbar = doc.createElement('div'),
    entry = doc.createElement('button'),
    done = doc.createElement('button');
  toolbar.className = 'company-reading-tools';
  entry.id = id;
  entry.type = done.type = 'button';
  entry.textContent = `Read ${label.toLowerCase()}`;
  done.textContent = 'Done reading';
  done.id = `${id}-done`;
  setMenuIcon(entry, 'mission');
  setMenuIcon(done, 'back');
  region.id ||= `${id}-region`;
  region.setAttribute('data-game-reading', '');
  region.setAttribute('aria-label', label);
  region.setAttribute('role', 'region');
  region.tabIndex = 0;
  region.classList.add('company-reading-region');
  toolbar.append(entry, done);
  region.before(toolbar);
  let active = false;
  const refresh = () => {
    const wasActive = active;
    active = region.getAttribute('data-controller-reading') === 'true';
    entry.setAttribute('aria-pressed', String(active));
    done.disabled = !active;
    toolbar.hidden = region.hidden || !region.textContent.trim();
    if (
      wasActive &&
      !active &&
      doc.activeElement === entry &&
      !doc.hidden &&
      doc.hasFocus?.() !== false
    )
      entry.scrollIntoView({ block: 'nearest' });
  };
  entry.onclick = () => host.navigation.beginReading({ region, origin: entry, label, exit: done });
  done.onclick = () => host.navigation.endReading();
  const observer = new doc.defaultView.MutationObserver(refresh);
  observer.observe(region, {
    attributes: true,
    attributeFilter: ['data-controller-reading', 'hidden'],
    childList: true,
    subtree: true,
    characterData: true,
  });
  refresh();
  return {
    entry,
    destroy() {
      if (active) host.navigation.endReading({ restoreFocus: false });
      observer.disconnect();
      entry.onclick = done.onclick = null;
      toolbar.remove();
      region.removeAttribute('data-game-reading');
    },
  };
}
