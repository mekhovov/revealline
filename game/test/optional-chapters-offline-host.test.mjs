import test from 'node:test';
import {
  optionalChapterScenarios,
  assertOptionalFetchRestored,
} from './optional-chapters-scenarios.mjs';

const scenario = optionalChapterScenarios.find(
  (item) =>
    item.name ===
    'offline Play of the current chapter preserves its paused cut without replacement',
);
test(scenario.name, scenario.run);
test(
  'Closed chapter page restores the outer fetch after offline-host',
  assertOptionalFetchRestored,
);
