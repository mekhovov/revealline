import test from 'node:test';
import {
  optionalChapterScenarios,
  assertOptionalFetchRestored,
} from './optional-chapters-scenarios.mjs';

const scenario = optionalChapterScenarios.find(
  (item) =>
    item.name ===
    'retained More chapters supports keyboard and standard controller with Mode collapsed and returns without flying',
);
test(scenario.name, scenario.run);
test(
  'Closed chapter page restores the outer fetch after navigation-host',
  assertOptionalFetchRestored,
);
