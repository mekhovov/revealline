import { rotorAnchors } from './animation.mjs';

const fields = new Set(['x', 'y', 'radiusScale', 'direction', 'phaseDegrees', 'bladeCount']);
const finite = (value, low, high) => Number.isFinite(value) && value >= low && value <= high;
const fail = (code = 'invalid') => {
  throw new Error(code);
};

/** The existing character.rotors fragment, never a new preset/save format. */
export function validateRotorRig(value) {
  if (!Array.isArray(value) || value.length > 8) fail();
  for (const anchor of value) {
    if (Array.isArray(anchor)) {
      if (anchor.length !== 3 || !finite(anchor[2], 0.016, 0.32)) fail();
    } else if (
      !anchor ||
      typeof anchor !== 'object' ||
      Object.keys(anchor).some((key) => !fields.has(key)) ||
      !Object.hasOwn(anchor, 'x') ||
      !Object.hasOwn(anchor, 'y') ||
      (Object.hasOwn(anchor, 'radiusScale') && !finite(anchor.radiusScale, 0.1, 2)) ||
      (Object.hasOwn(anchor, 'direction') && ![1, -1].includes(anchor.direction)) ||
      (Object.hasOwn(anchor, 'phaseDegrees') && !finite(anchor.phaseDegrees, -360, 360)) ||
      (Object.hasOwn(anchor, 'bladeCount') && ![2, 3, 4].includes(anchor.bladeCount))
    )
      fail();
  }
  const normalized = rotorAnchors({ rotors: value });
  if (normalized.some((anchor) => !finite(anchor.x, -0.6, 0.6) || !finite(anchor.y, -0.6, 0.6)))
    fail();
  return structuredClone(value);
}

export function rotorRigJSON(rotors) {
  return JSON.stringify(validateRotorRig(rotors), null, 2);
}

export function createRotorDraft(characterId, body) {
  return { characterId, source: rotorRigJSON(body.rotors || []) };
}

function requireCurrentDraft(draft, characterId, body) {
  if (draft?.characterId !== characterId || draft.source !== rotorRigJSON(body.rotors || []))
    fail('stale');
}

export function readRotorDraft(draft, text, characterId, body) {
  requireCurrentDraft(draft, characterId, body);
  if (typeof text !== 'string' || text.length > 16384) fail();
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    fail();
  }
  return validateRotorRig(value);
}

export function editRotorHub(rotors, index, patch) {
  const source = validateRotorRig(rotors);
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= source.length ||
    Object.keys(patch).some((key) => !['direction', 'phaseDegrees'].includes(key))
  )
    fail();
  // Converting only an edited legacy tuple retains its historical index defaults.
  source[index] = { ...rotorAnchors({ rotors: source })[index], ...patch };
  return validateRotorRig(source);
}

export function rotorHubReview(body, recipe) {
  return rotorAnchors({ rotors: validateRotorRig(body.rotors || []) }).map((anchor, index) => ({
    ...anchor,
    index,
    components: recipe.components
      .filter((component) => component.type === 'rotors')
      .map((component) => ({
        id: component.id,
        direction: anchor.direction * component.direction,
        phaseDegrees: anchor.phaseDegrees + component.phaseDegrees,
        bladeCount: anchor.bladeCount ?? component.bladeCount,
      })),
  }));
}

// Sampling uses the densest repeating hub; rendering still uses each hub's
// authored count and the unchanged component fallback for omitted counts.
export function rotorSamplingRecipe(body, recipe) {
  const blades = Math.max(0, ...rotorAnchors(body).map((anchor) => anchor.bladeCount ?? 0));
  return {
    ...recipe,
    components: recipe.components.map((component) =>
      component.type === 'rotors' && blades > component.bladeCount
        ? { ...component, bladeCount: blades }
        : component,
    ),
  };
}

/** All edits are synchronous, per-character presentation drafts. The host owns
 * clocks, pause/reduction, disposal and the unchanged source definitions. */
export function createRotorEditor({
  elements,
  getSelection,
  apply,
  listen,
  text,
  download,
  review,
}) {
  let draft = null,
    index = 0,
    status = 'hint';
  const message = (key) => {
    status = key;
    elements.status.textContent = text(key);
  };
  function refresh() {
    const { id, body, recipe } = getSelection(),
      next = createRotorDraft(id, body),
      rows = rotorHubReview(body, recipe);
    if (!draft || draft.characterId !== next.characterId || draft.source !== next.source) {
      if (draft?.characterId !== next.characterId) index = 0;
      draft = next;
      elements.json.value = next.source;
      message('hint');
    }
    elements.root.hidden = !recipe.components.some((component) => component.type === 'rotors');
    index = Math.min(index, Math.max(0, rows.length - 1));
    elements.hub.replaceChildren();
    for (const row of rows) {
      const option = elements.hub.ownerDocument.createElement('option');
      option.value = String(row.index);
      option.textContent = text('hubOption', { number: row.index + 1, x: row.x, y: row.y });
      elements.hub.append(option);
    }
    elements.hub.value = String(index);
    for (const key of ['hub', 'direction', 'phase']) elements[key].disabled = !rows.length;
    const row = rows[index];
    elements.direction.value = String(row?.direction ?? 1);
    elements.phase.value = String(row?.phaseDegrees ?? 0);
    elements.summary.textContent = row
      ? row.components
          .map((component) =>
            text('review', {
              component: component.id,
              direction: text(component.direction === 1 ? 'cw' : 'ccw'),
              phase: component.phaseDegrees,
              blades: component.bladeCount,
            }),
          )
          .join(' · ')
      : text('empty');
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
  listen(elements.hub, 'change', () => {
    index = Number(elements.hub.value);
    refresh();
    review();
  });
  for (const [key, field] of [
    ['direction', 'direction'],
    ['phase', 'phaseDegrees'],
  ])
    listen(elements[key], 'change', () =>
      attempt(() => {
        if (!elements[key].value.trim()) fail();
        const { id, body } = getSelection();
        requireCurrentDraft(draft, id, body);
        apply(editRotorHub(body.rotors || [], index, { [field]: Number(elements[key].value) }));
      }),
    );
  listen(elements.apply, 'click', () =>
    attempt(() => {
      const { id, body } = getSelection();
      apply(readRotorDraft(draft, elements.json.value, id, body));
    }),
  );
  listen(elements.reset, 'click', () =>
    attempt(() => {
      const { id, body } = getSelection();
      requireCurrentDraft(draft, id, body);
      apply(null);
      draft = null;
    }, 'reset'),
  );
  listen(elements.export, 'click', () =>
    attempt(() => {
      const { id, body } = getSelection();
      download(rotorRigJSON(body.rotors || []), `${id}.rotors.json`);
    }, 'exported'),
  );
  return { refresh, selectedHub: () => index };
}
