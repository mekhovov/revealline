import { actorFieldGuide } from '../hunt/actor-catalog.mjs';
import { drawHuntActor } from '../hunt/actor-art.mjs';

/** Shared text and previews for runtime pause screens and creator inspectors. */
export function renderEnemyFieldGuide(container, kinds, { locale = 'en', cast = 'rivals' } = {}) {
  const doc = container.ownerDocument;
  const entries = new Map(
    kinds
      .map((kind) => {
        const entry = actorFieldGuide(kind, locale);
        return [entry?.id, entry];
      })
      .filter(([id]) => id),
  );
  const words =
    locale === 'uk'
      ? {
          goal: 'Мета',
          tell: 'Ознака',
          counter: 'Як перехопити',
          hazard: 'Обережно: захищений контакт',
        }
      : {
          goal: 'Goal',
          tell: 'Tell',
          counter: 'How to catch',
          hazard: 'Hazard: protected contact',
        };
  const cards = [];
  for (const entry of entries.values()) {
    const card = doc.createElement('article');
    card.className = 'enemy-guide-card';
    const heading = doc.createElement('h3');
    const icon = doc.createElement('canvas');
    icon.className = 'enemy-guide-icon';
    icon.width = icon.height = 56;
    icon.setAttribute('aria-hidden', 'true');
    drawHuntActor(icon.getContext('2d'), 0, 0, 56, 0, {
      family: entry.id,
      cast,
      reducedEffects: true,
    });
    heading.textContent = entry.name;
    card.append(icon, heading);
    if (entry.specialist) {
      const warning = doc.createElement('strong');
      warning.className = 'enemy-hazard';
      warning.textContent = `◇ ${words.hazard}`;
      card.append(warning);
    }
    for (const key of ['goal', 'tell', 'counter']) {
      const paragraph = doc.createElement('p');
      const label = doc.createElement('b');
      label.textContent = `${words[key]}: `;
      paragraph.append(label, doc.createTextNode(entry[key]));
      card.append(paragraph);
    }
    cards.push(card);
  }
  container.replaceChildren(...cards);
}
