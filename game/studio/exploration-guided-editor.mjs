import { validateExplorationPayload } from '../rewards/exploration.mjs';
import { guidedFields } from './guided-fields.mjs';

const COPY = {
  en: {
    title: 'Guided discovery and later application',
    help: 'Edit what players notice, compare and apply in a different fixture. Image identities and diagram positions stay exact; use the diagram editor to change them. Stage updates the JSON draft only.',
    empty: 'Load a discovery or use the example to begin.',
    stale: 'The advanced draft changed. Reload it before staging these guided fields.',
    add: 'Add a later-application question',
    choose: 'Choose the supported answer…',
    titleField: 'Title',
    objective: 'Objective / what to notice',
    body: 'Evidence and explanation',
    sourceNote: 'Source, interpretation and uncertainty',
    alt: 'Image description',
    source: 'Source',
    sourceTitle: 'Source title',
    url: 'Source URL',
    prompt: 'Later application: a different situation',
    explanation: 'Why the distinction matters',
    choice: 'Choice',
    feedback: 'Consequence / useful feedback',
    expected: 'Supported choice',
    stage: 'Stage guided discovery',
    staged: 'Guided fields validated and staged. Preview or Apply the draft.',
  },
  uk: {
    title: 'Кероване відкриття й подальше застосування',
    help: 'Опишіть, що гравці помічають, порівнюють і застосовують до іншого прикладу. Точні зображення й позиції схеми зберігаються; змінюйте їх у редакторі схеми. Ця дія змінює лише чернетку JSON.',
    empty: 'Завантажте відкриття або почніть із прикладу.',
    stale: 'Розширена чернетка змінилася. Завантажте її знову перед підготовкою цих полів.',
    add: 'Додати запитання для подальшого застосування',
    choose: 'Виберіть обґрунтовану відповідь…',
    titleField: 'Назва',
    objective: 'Мета / на що звернути увагу',
    body: 'Свідчення й пояснення',
    sourceNote: 'Джерело, тлумачення й невизначеність',
    alt: 'Опис зображення',
    source: 'Джерело',
    sourceTitle: 'Назва джерела',
    url: 'URL джерела',
    prompt: 'Подальше застосування: інша ситуація',
    explanation: 'Чому ця відмінність важлива',
    choice: 'Варіант',
    feedback: 'Наслідок / корисний відгук',
    expected: 'Обґрунтований варіант',
    stage: 'Підготувати відкриття',
    staged: 'Поля перевірено й додано до чернетки. Перегляньте або застосуйте її.',
  },
};

export function createExplorationGuidedEditor({
  container,
  getDraft,
  setDraft,
  getLocale = () => 'en',
}) {
  const root = container.ownerDocument.createElement('fieldset');
  root.setAttribute('data-exploration-guided', 'true');
  container.append(root);
  let active = true;
  function sync(pending = null) {
    if (!active) return;
    root.replaceChildren();
    const c = COPY[getLocale()] ?? COPY.en,
      form = guidedFields(root, 'exploration-guided');
    root.append(form.node('legend', c.title), form.node('p', c.help));
    let draft, base;
    try {
      const source = validateExplorationPayload(getDraft());
      base = JSON.stringify(source);
      draft = pending ?? source;
    } catch {
      root.append(form.node('p', c.empty));
      return;
    }
    for (const locale of ['en', 'uk']) {
      const group = form.node('fieldset');
      group.append(form.node('legend', locale.toUpperCase()));
      for (const [key, label] of [
        ['title', c.titleField],
        ['intro', c.objective],
      ])
        form.field(group, label, ['locales', locale, key], draft.locales[locale][key], {
          lines: key === 'intro',
        });
      for (const [i, card] of draft.recipe.cards.entries()) {
        const section = form.node('fieldset');
        section.append(form.node('legend', card.id));
        for (const [key, label] of [
          ['title', c.titleField],
          ['body', c.body],
          ['sourceNote', c.sourceNote],
          ...(card.asset ? [['alt', c.alt]] : []),
        ])
          form.field(
            section,
            label,
            ['recipe', 'cards', i, 'locales', locale, key],
            card.locales[locale][key],
            { lines: key !== 'title' },
          );
        group.append(section);
      }
      for (const [i, prediction] of draft.recipe.predictions.entries()) {
        const section = form.node('fieldset');
        section.append(form.node('legend', prediction.id));
        for (const [key, label] of [
          ['prompt', c.prompt],
          ['explanation', c.explanation],
        ])
          form.field(
            section,
            label,
            ['recipe', 'predictions', i, 'locales', locale, key],
            prediction.locales[locale][key],
            { lines: true },
          );
        for (const [j, choice] of prediction.choices.entries())
          for (const [key, label] of [
            ['label', c.choice],
            ['feedback', c.feedback],
          ])
            form.field(
              section,
              `${choice.id} · ${label}`,
              ['recipe', 'predictions', i, 'choices', j, 'locales', locale, key],
              choice.locales[locale][key],
              { lines: key === 'feedback' },
            );
        group.append(section);
      }
      root.append(group);
    }
    for (const [i, prediction] of draft.recipe.predictions.entries())
      form.field(
        root,
        `${prediction.id} · ${c.expected}`,
        ['recipe', 'predictions', i, 'expectedChoiceId'],
        prediction.expectedChoiceId,
        {
          options: [
            { value: '', label: c.choose },
            ...prediction.choices.map((choice) => ({
              value: choice.id,
              label: choice.locales[getLocale()]?.label || choice.id,
            })),
          ],
        },
      );
    for (const [i, source] of draft.recipe.sources.entries()) {
      const section = form.node('fieldset');
      section.append(form.node('legend', `${c.source} · ${source.id}`));
      form.field(section, c.sourceTitle, ['recipe', 'sources', i, 'title'], source.title);
      form.field(section, c.url, ['recipe', 'sources', i, 'url'], source.url);
      root.append(section);
    }
    const button = form.node('button', c.stage),
      status = form.node('p');
    const add = form.node('button', c.add);
    add.type = 'button';
    add.setAttribute('data-exploration-guided-action', 'add');
    add.disabled = draft.recipe.predictions.length >= 4;
    add.onclick = () => {
      if (!active || add.disabled) return;
      try {
        if (JSON.stringify(getDraft()) !== base) throw new Error(c.stale);
        const next = form.read(structuredClone(draft));
        let ordinal = 1;
        while (next.recipe.predictions.some((item) => item.id === `application-${ordinal}`))
          ordinal++;
        next.recipe.predictions.push({
          id: `application-${ordinal}`,
          cardIds: next.recipe.cards.map((card) => card.id),
          expectedChoiceId: '',
          locales: { en: { prompt: '', explanation: '' }, uk: { prompt: '', explanation: '' } },
          choices: ['choice-a', 'choice-b'].map((id) => ({
            id,
            locales: { en: { label: '', feedback: '' }, uk: { label: '', feedback: '' } },
          })),
        });
        sync(next);
      } catch (error) {
        status.textContent = error.message;
      }
    };
    button.type = 'button';
    button.setAttribute('data-exploration-guided-action', 'stage');
    status.setAttribute('role', 'status');
    button.onclick = () => {
      if (!active) return;
      try {
        // Advanced edits must be loaded first; never replace a newer JSON draft.
        if (JSON.stringify(getDraft()) !== base) throw new Error(c.stale);
        const next = validateExplorationPayload(form.read(structuredClone(draft)));
        setDraft(next);
        draft = next;
        base = JSON.stringify(next);
        status.textContent = c.staged;
      } catch (error) {
        status.textContent = error.message;
      }
    };
    root.append(add, button, status);
  }
  return {
    sync,
    dispose() {
      active = false;
      root.remove();
    },
  };
}
