import { required } from '../data-json.mjs';
import { t } from '../i18n/index.mjs';
import {
  DISCOVERY_DIAGRAM_RECIPE,
  DISCOVERY_EXPLORATION_RECIPE,
  validateExplorationPayload,
} from '../rewards/exploration.mjs';

/** Guided coordinates stage a bounded data draft. The existing parent Apply
 * remains the only source/reward edit authority. */
export function createExplorationDiagramEditor({
  container,
  getDraft,
  setDraft,
  getLocale = () => 'en',
}) {
  const document = container.ownerDocument,
    tr = (key) => t('tools:studio.exploration.diagram.' + key),
    node = (tag, text) => {
      const value = document.createElement(tag);
      if (text !== undefined) value.textContent = text;
      return value;
    },
    root = node('fieldset'),
    rows = node('div'),
    status = node('p'),
    fields = {},
    controls = [];
  root.setAttribute('data-exploration-diagram-editor', 'true');
  root.append(node('legend', tr('title')), node('p', tr('help')));
  for (const key of ['assetId', 'sha256', 'enAlt', 'ukAlt', 'enCaption', 'ukCaption']) {
    const label = node('label', tr(key)),
      input = node('input');
    input.setAttribute('data-diagram-field', key);
    input.maxLength = key === 'sha256' ? 64 : 2048;
    label.append(input);
    root.append(label);
    fields[key] = input;
  }
  let disposed = false;
  const points = new Map();
  const button = (key, action) => {
    const value = node('button', tr(key));
    value.type = 'button';
    value.setAttribute('data-diagram-action', key);
    value.onclick = () => {
      if (disposed) return;
      try {
        action();
        status.textContent = tr('staged');
      } catch (error) {
        status.textContent = error.message;
      }
    };
    controls.push(value);
    root.append(value);
  };
  root.append(rows);
  button('stage', () => {
    const payload = structuredClone(validateExplorationPayload(getDraft()));
    payload.recipe.id = DISCOVERY_DIAGRAM_RECIPE.id;
    payload.recipe.revision = DISCOVERY_DIAGRAM_RECIPE.revision;
    payload.recipe.diagram = {
      asset: { assetId: fields.assetId.value.trim(), sha256: fields.sha256.value.trim() },
      locales: {
        en: { alt: fields.enAlt.value.trim(), caption: fields.enCaption.value.trim() },
        uk: { alt: fields.ukAlt.value.trim(), caption: fields.ukCaption.value.trim() },
      },
      hotspots: [...points]
        .filter(([, fields]) => fields.selected.checked)
        .map(([cardId, fields]) => {
          required(
            fields.x.value.trim() && fields.y.value.trim(),
            'Choose both diagram coordinates.',
          );
          return { cardId, x: Number(fields.x.value) / 100, y: Number(fields.y.value) / 100 };
        }),
    };
    setDraft(validateExplorationPayload(payload));
  });
  button('remove', () => {
    const payload = structuredClone(validateExplorationPayload(getDraft()));
    payload.recipe.id = DISCOVERY_EXPLORATION_RECIPE.id;
    payload.recipe.revision = DISCOVERY_EXPLORATION_RECIPE.revision;
    delete payload.recipe.diagram;
    setDraft(validateExplorationPayload(payload));
    sync();
  });
  status.setAttribute('role', 'status');
  root.append(status);
  container.append(root);
  function sync() {
    if (disposed) return;
    let payload;
    try {
      payload = validateExplorationPayload(getDraft());
    } catch {
      payload = null;
    }
    const diagram = payload?.recipe.diagram;
    fields.assetId.value = diagram?.asset.assetId ?? '';
    fields.sha256.value = diagram?.asset.sha256 ?? '';
    for (const locale of ['en', 'uk']) {
      fields[locale + 'Alt'].value = diagram?.locales[locale].alt ?? '';
      fields[locale + 'Caption'].value = diagram?.locales[locale].caption ?? '';
    }
    rows.replaceChildren();
    points.clear();
    for (const card of payload?.recipe.cards ?? []) {
      const group = node('fieldset'),
        legend = node('legend', card.locales[getLocale()].title),
        selected = node('input'),
        label = node('label', tr('include'));
      selected.type = 'checkbox';
      selected.setAttribute('data-diagram-include', card.id);
      const point = diagram?.hotspots.find((point) => point.cardId === card.id);
      selected.checked = !!point;
      label.append(selected);
      group.append(legend, label);
      const row = { selected };
      for (const axis of ['x', 'y']) {
        const label = node('label', tr(axis)),
          input = node('input');
        input.type = 'number';
        input.min = '0';
        input.max = '100';
        input.step = '0.1';
        input.value = String((point?.[axis] ?? 0.5) * 100);
        input.setAttribute('data-diagram-' + axis, card.id);
        row[axis] = input;
        label.append(input);
        group.append(label);
      }
      points.set(card.id, row);
      rows.append(group);
    }
    controls.forEach((button) => (button.disabled = !payload));
  }
  sync();
  return {
    sync,
    dispose() {
      disposed = true;
      controls.forEach((button) => (button.onclick = null));
      points.clear();
      root.remove();
    },
  };
}
