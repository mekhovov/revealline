import test from 'node:test';
import assert from 'node:assert/strict';
import {
  optionalWorldPlayScenarios,
  assertWorldPlayFetchRestored,
} from './optional-world-play-scenarios.mjs';

assert.equal(
  optionalWorldPlayScenarios.length,
  16,
  'Every world-play scenario needs an isolated wrapper.',
);
const scenario = optionalWorldPlayScenarios[2];
test(scenario.name, scenario.run);
test(
  'Closed world-play page restores the outer fetch after current-host',
  assertWorldPlayFetchRestored,
);
