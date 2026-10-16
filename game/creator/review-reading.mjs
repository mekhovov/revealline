import { authoringLabel } from '../ui/authoring-copy.mjs';
import { setMenuIcon } from '../ui/native-menu-icons.mjs';

/** Picture, map and verification text are one bounded reading surface. Leaving
 * it returns to its entry; approval remains a separate deliberate action. */
export function attachCreatorReviewReading({ card, heading, content, index, navigation }) {
  const doc = card.ownerDocument,
    entry = doc.createElement('button'),
    region = doc.createElement('div'),
    done = doc.createElement('button');
  heading.id = `creator-review-title-${index}`;
  entry.id = `creator-review-read-${index}`;
  entry.type = done.type = 'button';
  authoringLabel(entry, 'readPage');
  setMenuIcon(entry, 'content');
  region.id = `creator-review-reading-${index}`;
  region.className = 'creator-review-reading';
  region.tabIndex = 0;
  region.setAttribute('role', 'region');
  region.setAttribute('aria-labelledby', heading.id);
  region.setAttribute('data-game-reading', '');
  entry.setAttribute('aria-controls', region.id);
  region.append(...content);
  done.id = `creator-review-done-${index}`;
  authoringLabel(done, 'back');
  setMenuIcon(done, 'back');
  entry.onclick = () =>
    navigation.beginReading({
      region,
      origin: entry,
      exit: done,
      label: heading.textContent.slice(0, 160),
      getLabel: () => heading.textContent.slice(0, 160),
    });
  done.onclick = () => {
    if (!navigation.endReading()) entry.focus();
  };
  card.append(heading, entry, region, done);
  return { entry, region, done };
}
