import { rotorAnchors } from './animation.mjs';
import { validateAssetSlotSpec } from '../../game/presentation/model.mjs';

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
      if (anchor.length < 3) fail('missingRadius');
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

function envelopeContext(body, { recipe, image } = {}) {
  return JSON.stringify({
    source: body.src,
    pivot: body.presentationPivot,
    width: image?.naturalWidth ?? image?.width,
    height: image?.naturalHeight ?? image?.height,
    components: recipe?.components.filter((component) => component.type === 'rotors'),
  });
}

export function createRotorDraft(characterId, body, context) {
  return {
    characterId,
    source: rotorRigJSON(body.rotors || []),
    context: envelopeContext(body, context),
  };
}

function requireCurrentDraft(draft, characterId, body, context) {
  if (
    draft?.characterId !== characterId ||
    draft.source !== rotorRigJSON(body.rotors || []) ||
    draft.context !== envelopeContext(body, context)
  )
    fail('stale');
}

export function readRotorDraft(draft, text, characterId, body, context) {
  requireCurrentDraft(draft, characterId, body, context);
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
    Object.keys(patch).some(
      (key) => !['x', 'y', 'radiusScale', 'direction', 'phaseDegrees'].includes(key),
    )
  )
    fail();
  // Converting only an edited legacy tuple retains its historical index defaults.
  source[index] = { ...rotorAnchors({ rotors: source })[index], ...patch };
  return validateRotorRig(source);
}

// A validation-only slot invokes the same geometry checks as production assets.
// No asset, invented file identity or new serialization format is produced.
const envelopeSlot = {
  format: 'revealline-asset-slot.v1',
  id: 'motion-lab.rotor-envelope',
  revision: 1,
  label: 'Motion Lab rotor envelope',
  group: 'authoring',
  screens: [],
  kinds: ['image'],
  recipes: [],
  required: false,
  dimensions: { width: 1, height: 1 },
  alpha: 'required',
  sampling: 'nearest',
  states: ['default'],
  requirements: [],
  prompt: 'Validate the existing source-image rotor envelope.',
  budget: { maxBytes: 1 },
  palette: [],
  dependencies: [],
  owner: null,
};

/** Motion radius is width-relative; a non-square image's circular sweep has a
 * different height-normalized extent. Production occupiedBounds validates each
 * full sweep rectangle, while rotorAnchors validates centers/counts/duplicates.
 * The inscribed normalized circle is only a validation projection, never paint. */
export function validateRotorEnvelope(body, recipe, image) {
  const rig = validateRotorRig(body.rotors || []),
    anchors = rotorAnchors({ rotors: rig }),
    components = recipe.components.filter((component) => component.type === 'rotors');
  if (!anchors.length || !components.length) return rig;
  const width = image?.naturalWidth ?? image?.width,
    height = image?.naturalHeight ?? image?.height;
  if (!finite(width, 1, Number.MAX_SAFE_INTEGER) || !finite(height, 1, Number.MAX_SAFE_INTEGER))
    fail('dimensions');
  const pivot = body.presentationPivot || { x: 0.5, y: 0.5 };
  try {
    for (const component of components) {
      const sweeps = anchors.map((anchor) => {
        const rx = component.radius * anchor.radiusScale,
          ry = (rx * width) / height,
          x = anchor.x + pivot.x,
          y = anchor.y + pivot.y;
        return {
          anchor: {
            x,
            y,
            radius: Math.min(rx, ry),
            blades: anchor.bladeCount ?? component.bladeCount,
          },
          bounds: { x: x - rx, y: y - ry, width: rx * 2, height: ry * 2 },
        };
      });
      const geometry = {
        frame: { x: 0, y: 0, width: 1, height: 1 },
        pivot,
        occupiedBounds: null,
        rotorAnchors: sweeps.map((sweep) => sweep.anchor),
        nineSlice: null,
      };
      validateAssetSlotSpec({ ...envelopeSlot, geometry });
      for (const sweep of sweeps)
        validateAssetSlotSpec({
          ...envelopeSlot,
          geometry: { ...geometry, occupiedBounds: sweep.bounds },
        });
    }
  } catch {
    fail('envelope');
  }
  return rig;
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
        radius: component.radius * anchor.radiusScale,
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
    const { id, body, recipe, image } = getSelection(),
      next = createRotorDraft(id, body, { recipe, image }),
      rows = rotorHubReview(body, recipe);
    if (!draft || draft.characterId !== next.characterId || draft.source !== next.source) {
      if (draft?.characterId !== next.characterId) index = 0;
      draft = next;
      elements.json.value = next.source;
      message('hint');
    }
    draft.context = next.context;
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
    elements.x.value = String(row?.x ?? 0);
    elements.y.value = String(row?.y ?? 0);
    const pivot = body.presentationPivot || { x: 0.5, y: 0.5 };
    for (const key of ['x', 'y']) {
      elements[key].min = String(Math.max(-0.6, -pivot[key]));
      elements[key].max = String(Math.min(0.6, 1 - pivot[key]));
    }
    elements.radius.value = String(row?.components[0]?.radius ?? 0);
    const radius = recipe.components.find((component) => component.type === 'rotors')?.radius;
    elements.radius.min = String((radius ?? 0) * 0.1);
    elements.radius.max = String(Math.min((radius ?? 0) * 2, 0.5));
    for (const key of ['x', 'y', 'radius']) elements[key].disabled = !row || !image;
    let envelope = 'envelopeFits';
    try {
      validateRotorEnvelope(body, recipe, image);
    } catch (error) {
      envelope = error.message === 'dimensions' ? 'dimensions' : 'historicalEnvelope';
    }
    elements.envelope.textContent = text(envelope);
    elements.limits.textContent = text(
      Array.isArray(body.rotors?.[index]) ? 'legacyRadius' : 'radiusLimit',
      {
        min: (radius ?? 0) * 0.1,
        max: Math.min((radius ?? 0) * 2, 0.5),
      },
    );
    elements.summary.textContent = row
      ? row.components
          .map((component) =>
            text('review', {
              component: component.id,
              direction: text(component.direction === 1 ? 'cw' : 'ccw'),
              phase: component.phaseDegrees,
              blades: component.bladeCount,
              x: row.x,
              y: row.y,
              radius: component.radius,
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
      message(
        ['stale', 'envelope', 'dimensions', 'missingRadius', 'radiusRejected'].includes(
          error.message,
        )
          ? error.message
          : 'invalid',
      );
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
    ['x', 'x'],
    ['y', 'y'],
    ['radius', 'radiusScale'],
  ])
    listen(elements[key], 'change', () =>
      attempt(() => {
        if (!elements[key].value.trim()) fail();
        const { id, body, recipe, image } = getSelection();
        requireCurrentDraft(draft, id, body, { recipe, image });
        let value = Number(elements[key].value);
        if (key === 'radius') {
          value /= recipe.components.find((component) => component.type === 'rotors')?.radius;
          if (!finite(value, 0.1, 2)) fail('radiusRejected');
        }
        const rotors = editRotorHub(body.rotors || [], index, { [field]: value });
        if (['x', 'y', 'radius'].includes(key))
          validateRotorEnvelope({ ...body, rotors }, recipe, image);
        apply(rotors);
      }),
    );
  listen(elements.apply, 'click', () =>
    attempt(() => {
      const { id, body, recipe, image } = getSelection();
      const rotors = readRotorDraft(draft, elements.json.value, id, body, { recipe, image });
      validateRotorEnvelope({ ...body, rotors }, recipe, image);
      apply(rotors);
    }),
  );
  listen(elements.reset, 'click', () =>
    attempt(() => {
      const { id, body, recipe, image } = getSelection();
      requireCurrentDraft(draft, id, body, { recipe, image });
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
