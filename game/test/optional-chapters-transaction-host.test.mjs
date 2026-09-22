import test from 'node:test';
import {
  optionalChapterScenarios,
  assertOptionalFetchRestored,
} from './optional-chapters-scenarios.mjs';

const scenario = optionalChapterScenarios.find(
  (item) =>
    item.name ===
    'a failed asset transaction keeps the installed library and current run; Download & play retries',
);
test(scenario.name, scenario.run);
test(
  'Closed chapter page restores the outer fetch after transaction-host',
  assertOptionalFetchRestored,
);
