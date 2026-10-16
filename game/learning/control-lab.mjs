import { boundedJSON, exactKeys, required, stableId, canonicalJSON } from '../data-json.mjs';

export const CONTROL_LAB_FORMAT = 'revealline-control-lab.v1';
export const CONTROL_LAB_CONTROLS = Object.freeze([
  Object.freeze({
    id: 'throttle',
    stick: 'left',
    axis: 'vertical',
    min: 0,
    max: 1,
    reset: 0,
    view: 'thrust',
  }),
  Object.freeze({
    id: 'yaw',
    stick: 'left',
    axis: 'horizontal',
    min: -1,
    max: 1,
    reset: 0,
    view: 'top',
  }),
  Object.freeze({
    id: 'pitch',
    stick: 'right',
    axis: 'vertical',
    min: -1,
    max: 1,
    reset: 0,
    view: 'side',
  }),
  Object.freeze({
    id: 'roll',
    stick: 'right',
    axis: 'horizontal',
    min: -1,
    max: 1,
    reset: 0,
    view: 'front',
  }),
]);
const byId = new Map(CONTROL_LAB_CONTROLS.map((item) => [item.id, item]));
const text = (value, label, max = 1200) =>
  required(
    typeof value === 'string' && value.trim().length > 0 && value.length <= max,
    `${label}: bounded text required`,
  );
function locales(value, fields, label) {
  exactKeys(value, ['en', 'uk'], label);
  for (const language of ['en', 'uk']) {
    exactKeys(value[language], fields, `${label}.${language}`);
    for (const field of fields) text(value[language][field], `${label}.${language}.${field}`);
  }
}

/** Educational copy and citations only. Authors cannot change control mappings,
 * invoke code, add hardware commands or define progress/earning conditions. */
export function validateControlLabFixture(input) {
  const value = boundedJSON(input, {
    maxBytes: 64 * 1024,
    maxNodes: 512,
    maxDepth: 8,
    maxArray: 16,
    maxString: 1500,
  });
  exactKeys(
    value,
    ['format', 'id', 'revision', 'scenario', 'layout', 'locales', 'controls', 'sources'],
    'control lab',
  );
  required(value.format === CONTROL_LAB_FORMAT, 'Unsupported control lab format');
  required(stableId(value.id) && stableId(value.revision), 'Control lab identity required');
  required(value.scenario === 'civilian-training', 'Control lab requires civilian training');
  required(value.layout === 'mode-2', 'Control lab supports the labelled Mode 2 model');
  locales(value.locales, ['title', 'summary'], 'control lab.locales');
  required(
    Array.isArray(value.sources) && value.sources.length > 0 && value.sources.length <= 12,
    'Control lab sources required',
  );
  const sources = new Set();
  for (const source of value.sources) {
    exactKeys(source, ['id', 'title', 'url'], 'source');
    required(stableId(source.id) && !sources.has(source.id), 'Unique source identity required');
    sources.add(source.id);
    text(source.title, 'source.title', 240);
    text(source.url, 'source.url', 1500);
    let url;
    try {
      url = new URL(source.url);
    } catch {
      /* handled below */
    }
    required(
      /^https:\/\//.test(source.url) &&
        url?.protocol === 'https:' &&
        !url.username &&
        !url.password &&
        !/[\s\u0000-\u001f\\]/.test(source.url),
      'Source must be a public HTTPS URL',
    );
  }
  required(
    Array.isArray(value.controls) && value.controls.length === 4,
    'Exactly four controls required',
  );
  const controls = new Set();
  for (const control of value.controls) {
    exactKeys(control, ['id', 'locales', 'sourceIds'], 'control');
    required(byId.has(control.id) && !controls.has(control.id), 'Each control must occur once');
    controls.add(control.id);
    locales(
      control.locales,
      ['title', 'explanation', 'negative', 'neutral', 'positive'],
      `control.${control.id}.locales`,
    );
    required(
      Array.isArray(control.sourceIds) &&
        control.sourceIds.length > 0 &&
        control.sourceIds.length <= 12 &&
        new Set(control.sourceIds).size === control.sourceIds.length &&
        control.sourceIds.every((id) => sources.has(id)),
      'Each control must cite declared sources',
    );
  }
  return value;
}
export function exportControlLabFixture(input) {
  return canonicalJSON(validateControlLabFixture(input));
}

/** A position-to-diagram projection, deliberately without time, inertia,
 * telemetry, hardware access, game events or a completion callback. */
export function createControlLabModel(input) {
  const fixture = validateControlLabFixture(input);
  const values = Object.fromEntries(CONTROL_LAB_CONTROLS.map((item) => [item.id, item.reset]));
  return {
    set(id, inputValue) {
      const definition = byId.get(id);
      required(
        definition && typeof inputValue === 'number' && Number.isFinite(inputValue),
        'Finite known control value required',
      );
      values[id] =
        Math.round(Math.max(definition.min, Math.min(definition.max, inputValue)) * 100) / 100;
      return values[id];
    },
    reset() {
      for (const definition of CONTROL_LAB_CONTROLS) values[definition.id] = definition.reset;
    },
    snapshot(locale = 'en', reducedMotion = false) {
      return {
        values: { ...values },
        title: (fixture.locales[locale] ?? fixture.locales.en).title,
        summary: (fixture.locales[locale] ?? fixture.locales.en).summary,
        controls: CONTROL_LAB_CONTROLS.map((definition) => {
          const authored = fixture.controls.find((item) => item.id === definition.id);
          const copy = authored.locales[locale] ?? authored.locales.en;
          const value = values[definition.id];
          return {
            ...definition,
            value,
            copy: { ...copy },
            description: value === 0 ? copy.neutral : value < 0 ? copy.negative : copy.positive,
            // Cosmetic diagrams use illustrative angles, never aircraft units.
            diagramAngle:
              reducedMotion || definition.id === 'throttle'
                ? 0
                : value * (definition.id === 'yaw' ? 45 : 25),
          };
        }),
      };
    },
    export: () => exportControlLabFixture(fixture),
    fixture: () => validateControlLabFixture(fixture),
  };
}
