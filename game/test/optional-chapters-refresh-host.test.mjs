import test from 'node:test';
import {
  optionalChapterScenarios,
  assertOptionalFetchRestored,
} from './optional-chapters-scenarios.mjs';

const scenario = optionalChapterScenarios.find(
  (item) =>
    item.name ===
    'cancelling a refreshed catalog during installed-art inspection retains a coherent old menu',
);
test(scenario.name, scenario.run);
test(
  'Closed chapter page restores the outer fetch after refresh-host',
  assertOptionalFetchRestored,
);
