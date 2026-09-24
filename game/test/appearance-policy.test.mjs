import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_UI_SKIN,
  UI_SKINS,
  resolveAppearanceForBoundary,
} from '../presentation/appearance-policy.mjs';

test('appearance defaults are Neon Arcade chrome with FPV actors', () => {
  const resolved = resolveAppearanceForBoundary({ boundary: 'launch' });
  assert.deepEqual(UI_SKINS, ['neon-arcade', 'fpv-field-kit']);
  assert.equal(DEFAULT_UI_SKIN, 'neon-arcade');
  assert.deepEqual(resolved, {
    uiSkin: 'neon-arcade',
    menuPalette: 'neon',
    ornaments: 'subtle',
    actorStyle: 'fpv',
    actorSource: 'preference',
    actorDeferred: false,
  });
  assert.equal(Object.isFrozen(resolved), true);
});

test('UI skin and actor choice are orthogonal at fresh boundaries', () => {
  for (const boundary of ['launch', 'next'])
    for (const [palette, uiSkin] of [
      ['auto', 'neon-arcade'],
      ['ukrainian', 'fpv-field-kit'],
    ])
      for (const actorStyle of ['fpv', 'campaign']) {
        const resolved = resolveAppearanceForBoundary({
          menuPreference: { palette, ornaments: 'rich' },
          actorPreference: { actorStyle },
          boundary,
          retainedActorStyle: actorStyle === 'fpv' ? 'campaign' : 'fpv',
        });
        assert.equal(resolved.uiSkin, uiSkin);
        assert.equal(resolved.actorStyle, actorStyle);
        assert.equal(resolved.actorSource, 'preference');
        assert.equal(resolved.ornaments, 'rich');
      }
});

test('Retry, Continue and replay retain actors while chrome changes immediately', () => {
  for (const boundary of ['retry', 'continue', 'replay']) {
    const resolved = resolveAppearanceForBoundary({
      menuPreference: { palette: 'ukrainian', ornaments: 'off' },
      actorPreference: { actorStyle: 'campaign' },
      boundary,
      retainedActorStyle: 'fpv',
    });
    assert.deepEqual(resolved, {
      uiSkin: 'fpv-field-kit',
      menuPalette: 'field-kit',
      ornaments: 'off',
      actorStyle: 'fpv',
      actorSource: 'retained',
      actorDeferred: true,
    });
  }
});

test('historical pin absence stays absent and invalid records fail closed', () => {
  assert.equal(
    resolveAppearanceForBoundary({
      boundary: 'continue',
      actorPreference: { actorStyle: 'fpv' },
    }).actorStyle,
    null,
  );
  for (const input of [
    {},
    { boundary: 'launch', menuPreference: { palette: 'blue', ornaments: 'subtle' } },
    { boundary: 'launch', actorPreference: { actorStyle: 'latest' } },
    { boundary: 'retry', retainedActorStyle: 'latest' },
  ])
    assert.throws(() => resolveAppearanceForBoundary(input), TypeError);
});
