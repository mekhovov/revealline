import test from 'node:test';
import assert from 'node:assert/strict';
import { demoRuntimeEngineHint, preferDemoRuntimeCandidates } from '../demo-runtime.mjs';

test('runtime hints distinguish engine identities without treating iOS browser brands as engines', () => {
  for (const [agent, engine] of [
    ['Mozilla/5.0 AppleWebKit/537.36 Chrome/155.0.0.0 Safari/537.36', 'chromium'],
    ['Mozilla/5.0 Gecko/20100101 Firefox/153.0', 'firefox'],
    ['Mozilla/5.0 AppleWebKit/605.1.15 Version/26.0 Safari/605.1.15', 'webkit'],
    ['Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 CriOS/155.0.0.0 Safari/604.1', 'webkit'],
    ['Mozilla/5.0 (iPad) AppleWebKit/605.1.15 FxiOS/153.0 Mobile/15E148', 'webkit'],
    ['Node.js/24', null],
    ['', null],
  ])
    assert.equal(demoRuntimeEngineHint(agent), engine);
});

test('preferred engine partition preserves bounded alternatives and their relative fallback order', () => {
  const variants = ['', 'chromium', 'firefox', 'webkit'];
  assert.deepEqual(
    preferDemoRuntimeCandidates(variants, 'webkit', (variant) => variant),
    ['webkit', '', 'chromium', 'firefox'],
  );
  assert.deepEqual(
    preferDemoRuntimeCandidates(variants, null, (variant) => variant),
    variants,
  );
  assert.deepEqual(
    preferDemoRuntimeCandidates(variants, 'unknown', (variant) => variant),
    variants,
  );
  assert.deepEqual(variants, ['', 'chromium', 'firefox', 'webkit']);
  const records = [
    { id: 'base' },
    { id: 'engine-proof', engine: 'webkit' },
    { id: 'alternate-proof', engine: 'firefox' },
    { id: 'engine-performance', engine: 'webkit' },
  ];
  assert.deepEqual(
    preferDemoRuntimeCandidates(records, 'webkit', (candidate) => candidate.engine).map(
      (candidate) => candidate.id,
    ),
    ['engine-proof', 'engine-performance', 'base', 'alternate-proof'],
  );
});
