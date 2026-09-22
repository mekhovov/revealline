import test from 'node:test';
import {
  optionalChapterScenarios,
  assertOptionalFetchRestored,
} from './optional-chapters-scenarios.mjs';

const scenario = optionalChapterScenarios.find(
  (item) =>
    item.name ===
    'keyboard and standard controller enter More chapters with Mode collapsed and return without flying',
);
test(scenario.name, scenario.run);
test(
  'Closed chapter page restores the outer fetch after navigation-host',
  assertOptionalFetchRestored,
);
