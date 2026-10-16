import { actorFieldGuide } from '../hunt/actor-catalog.mjs';
import { drawHuntActor } from '../hunt/actor-art.mjs';

/** Shared text and previews for runtime pause screens and creator inspectors. */
export function renderEnemyFieldGuide(
  container,
  kinds,
  {
    locale = 'en',
    cast = 'rivals',
    resolveEntry = actorFieldGuide,
    drawActor = drawHuntActor,
  } = {},
) {
  const doc = container.ownerDocument;
  const entries = new Map(
    kinds
      .map((kind) => {
        const entry = resolveEntry(kind, locale);
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
          preview: 'Ракурси та пози',
          direction: 'Напрямок',
          pose: 'Поза',
          frame: 'Наступний кадр',
          directions: ['Угору', 'Праворуч', 'Униз', 'Ліворуч'],
          states: ['Спокій', 'Рух', 'Помітив', 'Попередження', 'Відновлення', 'Перехоплений'],
        }
      : {
          goal: 'Goal',
          tell: 'Tell',
          counter: 'How to catch',
          hazard: 'Hazard: protected contact',
          preview: 'Directions and poses',
          direction: 'Direction',
          pose: 'Pose',
          frame: 'Next frame',
          directions: ['Up', 'Right', 'Down', 'Left'],
          states: ['Idle', 'Running', 'Notice', 'Warning', 'Recovery', 'Caught'],
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
    let frame = 0;
    const preview = doc.createElement('details');
    const summary = doc.createElement('summary');
    summary.textContent = words.preview;
    preview.append(summary);
    const choice = (name, values, labels) => {
      const label = doc.createElement('label');
      label.append(doc.createTextNode(`${name} `));
      const select = doc.createElement('select');
      for (const [index, value] of values.entries()) {
        const option = doc.createElement('option');
        option.value = value;
        option.textContent = labels[index];
        select.append(option);
      }
      label.append(select);
      const row = doc.createElement('p');
      row.append(label);
      preview.append(row);
      return select;
    };
    const direction = choice(words.direction, ['up', 'right', 'down', 'left'], words.directions);
    const state = choice(
      words.pose,
      ['idle', 'walk', 'notice', 'warning', 'recover', 'caught'],
      words.states,
    );
    const nextFrame = doc.createElement('button');
    nextFrame.type = 'button';
    nextFrame.textContent = words.frame;
    preview.append(nextFrame);
    // Deliberately stepped previews never animate a paused game or override
    // Reduced effects. Runtime hosts own the live, simulation-bound clock.
    const paint = () => {
      const ctx = icon.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, 56, 56);
      drawActor(ctx, 0, 0, 56, frame, {
        kind: entry.kind ?? entry.id,
        family: entry.id,
        cast,
        direction: direction.value,
        heading: direction.value,
        state: state.value,
        phase:
          state.value === 'warning' ? 'warning' : state.value === 'recover' ? 'rest' : 'moving',
        timeMs: frame * 130,
        armed: entry.id === 'guard',
        token: false,
      });
    };
    direction.addEventListener('change', paint);
    state.addEventListener('change', paint);
    nextFrame.addEventListener('click', () => {
      frame = (frame + 1) % 12;
      paint();
    });
    paint();
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
    card.append(preview);
    cards.push(card);
  }
  container.replaceChildren(...cards);
}
