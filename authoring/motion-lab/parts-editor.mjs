import { validateAnimationRecipes } from './animation.mjs';

const fields = {
  wings: [
    'span',
    'chord',
    'frequencyHz',
    'speedFrequencyGain',
    'amplitudeDegrees',
    'foldFraction',
    'tipColor',
  ],
  thruster: ['length', 'width', 'speedGain', 'flickerHz', 'innerColor'],
  pulse: ['radius', 'amplitude', 'frequencyHz', 'opacity'],
  blink: ['frequencyHz', 'dutyCycle', 'size'],
};
const fail = (code = 'invalid') => {
  throw new Error(code);
};

export function attachmentComponents(recipe) {
  return recipe.components.filter((component) => component.type !== 'rotors');
}

/** Existing recipe fragments only. No component registration, new states or
 * changes to the historical reader. The existing validator owns numeric limits. */
export function validateAttachments(value, recipe) {
  const source = attachmentComponents(recipe);
  if (!Array.isArray(value) || value.length !== source.length || value.length > 8) fail();
  for (const [index, component] of value.entries()) {
    if (
      !component ||
      typeof component !== 'object' ||
      Array.isArray(component) ||
      component.id !== source[index].id ||
      component.type !== source[index].type ||
      !Object.hasOwn(fields, component.type)
    )
      fail();
    const known = new Set(['id', 'type', 'anchors', 'color', ...fields[component.type]]);
    if (
      Object.keys(component).some((key) => !known.has(key)) ||
      !Array.isArray(component.anchors) ||
      component.anchors.some((anchor) => !Array.isArray(anchor) || ![2, 3].includes(anchor.length))
    )
      fail();
  }
  try {
    validateAnimationRecipes({
      animationRecipes: { draft: { components: value } },
      characters: {},
    });
  } catch {
    fail();
  }
  return structuredClone(value);
}

export function attachmentJSON(value, recipe) {
  return JSON.stringify(validateAttachments(value, recipe), null, 2);
}

export function createAttachmentDraft(characterId, recipe) {
  return { characterId, context: JSON.stringify(recipe) };
}

function requireCurrent(draft, characterId, recipe) {
  if (draft?.characterId !== characterId || draft.context !== JSON.stringify(recipe)) fail('stale');
}

export function readAttachmentDraft(draft, text, characterId, recipe) {
  requireCurrent(draft, characterId, recipe);
  if (typeof text !== 'string' || text.length > 16384) fail();
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    fail();
  }
  return validateAttachments(value, recipe);
}

export function attachmentRate(component) {
  return component.type === 'thruster'
    ? { key: 'flickerHz', min: 0.1, max: 12 }
    : { key: 'frequencyHz', min: 0.1, max: component.type === 'wings' ? 5 : 2 };
}

export function editAttachment(recipe, index, { anchor = 0, x, y, rate }) {
  const parts = validateAttachments(attachmentComponents(recipe), recipe);
  if (!Number.isInteger(index) || !parts[index]) fail();
  const part = parts[index];
  if (x !== undefined || y !== undefined) {
    if (!Number.isInteger(anchor) || !part.anchors[anchor]) fail();
    if (x !== undefined) part.anchors[anchor][0] = x;
    if (y !== undefined) part.anchors[anchor][1] = y;
  }
  if (rate !== undefined) part[attachmentRate(part).key] = rate;
  return validateAttachments(parts, recipe);
}

/** Synchronous drafts use the host's existing listener, redraw and lifetime
 * ownership. Applying a fragment cannot advance or reset either preview clock. */
export function createPartsEditor({
  elements,
  getSelection,
  apply,
  listen,
  text,
  componentName,
  download,
}) {
  let draft = null,
    componentIndex = 0,
    anchorIndex = 0,
    status = 'hint';
  const message = (key) => {
    status = key;
    elements.status.textContent = text(key);
  };
  const option = (select, value, label) => {
    const node = select.ownerDocument.createElement('option');
    node.value = String(value);
    node.textContent = label;
    select.append(node);
  };
  function refresh() {
    const { id, recipe } = getSelection(),
      next = createAttachmentDraft(id, recipe),
      parts = attachmentComponents(recipe);
    if (!draft || draft.characterId !== next.characterId || draft.context !== next.context) {
      if (!draft || draft.characterId !== next.characterId) {
        componentIndex = 0;
        anchorIndex = 0;
      }
      draft = next;
      elements.json.value = attachmentJSON(parts, recipe);
      status = 'hint';
    }
    elements.root.hidden = !parts.length;
    componentIndex = Math.min(componentIndex, Math.max(0, parts.length - 1));
    const part = parts[componentIndex];
    elements.component.replaceChildren();
    parts.forEach((value, index) =>
      option(
        elements.component,
        index,
        text('componentOption', { type: componentName(value.type), id: value.id }),
      ),
    );
    elements.component.value = String(componentIndex);
    anchorIndex = Math.min(anchorIndex, Math.max(0, (part?.anchors.length ?? 0) - 1));
    elements.anchor.replaceChildren();
    part?.anchors.forEach(([x, y], index) =>
      option(elements.anchor, index, text('anchorOption', { number: index + 1, x, y })),
    );
    elements.anchor.value = String(anchorIndex);
    const anchor = part?.anchors[anchorIndex];
    for (const [key, index] of [
      ['x', 0],
      ['y', 1],
    ]) {
      elements[key].value = String(anchor?.[index] ?? 0);
      elements[key].disabled = !anchor;
    }
    elements.anchor.disabled = !part?.anchors.length;
    elements.component.disabled = !part;
    elements.rate.disabled = !part;
    if (part) {
      const { key, min, max } = attachmentRate(part);
      elements.rate.min = String(min);
      elements.rate.max = String(max);
      elements.rate.value = String(part[key]);
      elements.limits.textContent = text('rateRange', { min, max });
    } else elements.limits.textContent = '';
    message(status);
  }
  function attempt(operation, success = 'applied') {
    try {
      operation();
      refresh();
      message(success);
    } catch (error) {
      message(error.message === 'stale' ? 'stale' : 'invalid');
    }
  }
  listen(elements.component, 'change', () => {
    componentIndex = Number(elements.component.value);
    anchorIndex = 0;
    refresh();
  });
  listen(elements.anchor, 'change', () => {
    anchorIndex = Number(elements.anchor.value);
    refresh();
  });
  for (const key of ['x', 'y', 'rate'])
    listen(elements[key], 'change', () =>
      attempt(() => {
        if (!elements[key].value.trim()) fail();
        const { id, recipe } = getSelection();
        requireCurrent(draft, id, recipe);
        apply(
          editAttachment(recipe, componentIndex, {
            anchor: anchorIndex,
            [key]: Number(elements[key].value),
          }),
        );
      }),
    );
  listen(elements.apply, 'click', () =>
    attempt(() => {
      const { id, recipe } = getSelection();
      apply(readAttachmentDraft(draft, elements.json.value, id, recipe));
    }),
  );
  listen(elements.reset, 'click', () =>
    attempt(() => {
      const { id, recipe } = getSelection();
      requireCurrent(draft, id, recipe);
      apply(null);
      draft = null;
    }, 'reset'),
  );
  listen(elements.export, 'click', () =>
    attempt(() => {
      const { id, recipe } = getSelection();
      requireCurrent(draft, id, recipe);
      download(attachmentJSON(attachmentComponents(recipe), recipe), `${id}.attachments.json`);
    }, 'exported'),
  );
  return { refresh };
}
