import test from 'node:test';
import {
  optionalChapterScenarios,
  assertOptionalFetchRestored,
} from './optional-chapters-scenarios.mjs';

const scenario = optionalChapterScenarios.find(
  (item) =>
    item.name ===
    'a valid imported chapter with substituted artwork is a conflict, never an installed original',
);
test(scenario.name, scenario.run);
test(
  'Closed chapter page restores the outer fetch after conflict-host',
  assertOptionalFetchRestored,
);
