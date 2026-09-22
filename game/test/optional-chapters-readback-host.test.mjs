import test from 'node:test';
import {
  optionalChapterScenarios,
  assertOptionalFetchRestored,
} from './optional-chapters-scenarios.mjs';

const scenario = optionalChapterScenarios.find(
  (item) =>
    item.name === 'More worlds readback save keeps a paused flight until explicit Replace & play',
);
test(scenario.name, scenario.run);
test(
  'Closed chapter page restores the outer fetch after readback-host',
  assertOptionalFetchRestored,
);
