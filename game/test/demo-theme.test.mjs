import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDemoTheme } from '../ui/demo-host.mjs';

const themes = [
  { id: 'fpv', player: 'fpv-body', classBodies: { scout: 'fpv-scout-v1' } },
  { id: 'ukraine', player: 'ukrainian-bird', classBodies: { scout: 'atlas-swallow-v3' } },
  { id: 'retro', player: 'retro-craft', classBodies: { scout: 'retro-vector' } },
];

test('demo uses the selected world character theme unless the real level pins one', () => {
  const entry = { campaign: { themeId: null }, themes };
  assert.equal(resolveDemoTheme(entry, { themeId: null }, 'ukraine'), themes[1]);
  assert.equal(resolveDemoTheme(entry, { themeId: 'retro' }, 'ukraine'), themes[2]);
  entry.campaign.themeId = 'fpv';
  assert.equal(resolveDemoTheme(entry, { themeId: null }, 'ukraine'), themes[0]);
});

test('demo theme fallback remains deterministic when an old preference is unavailable', () => {
  const entry = { campaign: { themeId: null }, themes };
  assert.equal(resolveDemoTheme(entry, {}, 'removed-theme'), themes[0]);
});
