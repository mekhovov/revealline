import test from 'node:test';
import {
  optionalChapterScenarios,
  assertOptionalFetchRestored,
} from './optional-chapters-scenarios.mjs';

const scenario = optionalChapterScenarios.find(
  (item) =>
    item.name ===
    'More worlds early Stay restores its exact Play; late verification respects moved focus',
);
test(scenario.name, scenario.run);
test(
  'Closed chapter page restores the outer fetch after stay-focus-host',
  assertOptionalFetchRestored,
);
