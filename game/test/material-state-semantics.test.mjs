import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePresentation } from '../presentation/theme-system.mjs';
import { evaluateControlStateSemantics } from './fixtures/appearance-materials.mjs';

const fieldSamples = (tokens) =>
  [false, true].flatMap((twin) =>
    ['input-invalid', 'input-invalid-focus', 'input-disabled', 'select-disabled'].map((id) => {
      const invalid = id.startsWith('input-invalid');
      return {
        id: `sample-${id}${twin ? '-twin' : ''}`,
        foreground: invalid ? tokens.inputText : tokens.muted,
        background: invalid ? tokens.input : tokens.panel,
        borderColor: invalid ? tokens.hazard : tokens.line,
        finish: 'none',
        shadow: 'none',
        outlineStyle: 'solid',
        outlineWidth: '3px',
        outline: `3px solid ${tokens.focus}`,
      };
    }),
  );
test('rendered control audit catches unreadable validation, missing focus, and disabled material leakage', () => {
  const tokens = resolvePresentation({ familyId: 'industrial-workshop' }).tokens,
    samples = fieldSamples(tokens);
  assert.equal(evaluateControlStateSemantics(samples, tokens).status, 'passed');
  for (const [id, property, value] of [
    ['sample-input-invalid', 'foreground', tokens.hazard],
    ['sample-input-invalid-twin', 'borderColor', tokens.controlLine],
    ['sample-input-invalid-focus', 'outlineStyle', 'none'],
    ['sample-input-invalid-focus-twin', 'outlineWidth', '0px'],
    ['sample-select-disabled', 'finish', 'linear-gradient(white, transparent)'],
    ['sample-input-disabled-twin', 'shadow', '0px 2px 0px black'],
  ]) {
    const changed = samples.map((sample) =>
      sample.id === id ? { ...sample, [property]: value } : sample,
    );
    assert.equal(
      evaluateControlStateSemantics(changed, tokens).status,
      'failed',
      `${id}.${property}`,
    );
  }
  assert.equal(
    evaluateControlStateSemantics(samples.slice(1), tokens).status,
    'failed',
    'missing captured controls fail closed',
  );
  assert.equal(
    evaluateControlStateSemantics(samples, tokens, { forcedColors: true }).status,
    'skipped',
    'system colors are evaluated separately',
  );
});

test('rendered loading audit requires a visible progress rail with relief, selection, and focus', () => {
  const tokens = resolvePresentation({ familyId: 'industrial-workshop' }).tokens,
    loadingSamples = [false, true].flatMap((twin) =>
      ['loading', 'selected-loading', 'loading-focus', 'loading-disabled'].map((id) => {
        const foreground = id === 'selected-loading' ? tokens.onSelection : tokens.text;
        return {
          id: `sample-${id}${twin ? '-twin' : ''}`,
          foreground,
          loadingRail: 3,
          shadow:
            id === 'loading-disabled'
              ? 'none'
              : `inset 0px -3px 0px 0px ${foreground}, rgba(0, 0, 0, 0) 0px 0px 0px 0px`,
          outlineStyle: 'solid',
          outlineWidth: '3px',
          outline: `3px solid ${tokens.focus}`,
        };
      }),
    ),
    samples = [...fieldSamples(tokens), ...loadingSamples];
  assert.equal(evaluateControlStateSemantics(samples, tokens).status, 'passed');
  for (const [id, property, value] of [
    ['sample-loading', 'shadow', 'none'],
    ['sample-selected-loading-twin', 'shadow', `inset 0px -2px 0px 0px ${tokens.onSelection}`],
    ['sample-loading', 'shadow', `inset 0px -3px 0px 0px ${tokens.ink}`],
    ['sample-loading-focus', 'outlineStyle', 'none'],
    ['sample-loading-focus-twin', 'shadow', 'none'],
    ['sample-loading-disabled', 'shadow', `inset 0px -3px 0px 0px ${tokens.text}`],
  ]) {
    const changed = samples.map((sample) =>
      sample.id === id ? { ...sample, [property]: value } : sample,
    );
    assert.equal(
      evaluateControlStateSemantics(changed, tokens).status,
      'failed',
      `${id}.${property}`,
    );
  }
  assert.equal(
    evaluateControlStateSemantics(
      samples.filter((sample) => sample.id !== 'sample-loading-twin'),
      tokens,
    ).status,
    'failed',
    'missing loading capture fails closed',
  );
  const chromiumSerialization = samples.map((sample) =>
    sample.id === 'sample-loading'
      ? {
          ...sample,
          foreground: 'rgb(244, 241, 235)',
          shadow: 'rgb(244, 241, 235) 0px -3px 0px 0px inset, rgba(0, 0, 0, 0) 0px 0px 0px 0px',
        }
      : sample,
  );
  assert.equal(evaluateControlStateSemantics(chromiumSerialization, tokens).status, 'passed');
});
