import test from 'node:test';
import {
  optionalChapterScenarios,
  assertOptionalFetchRestored,
} from './optional-chapters-scenarios.mjs';

const scenario = optionalChapterScenarios.find(
  (item) =>
    item.name ===
    'failed published checksum leaves native retry and keyboard Back available without changing saved progress',
);
test(scenario.name, scenario.run);
test(
  'Closed chapter page restores the outer fetch after checksum-host',
  assertOptionalFetchRestored,
);
