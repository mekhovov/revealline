import test from 'node:test';
import {
  optionalChapterScenarios,
  assertOptionalFetchRestored,
} from './optional-chapters-scenarios.mjs';

const scenario = optionalChapterScenarios.find(
  (item) =>
    item.name ===
    'cancelled optional download cannot change the flight or install after Back and a late network response',
);
test(scenario.name, scenario.run);
test('Closed chapter page restores the outer fetch after cancel-host', assertOptionalFetchRestored);
