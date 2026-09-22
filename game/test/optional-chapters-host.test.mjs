import test from 'node:test';
import {
  optionalChapterScenarios,
  assertOptionalFetchRestored,
} from './optional-chapters-scenarios.mjs';

const scenario = optionalChapterScenarios.find(
  (item) =>
    item.name ===
    'More worlds discovers Tactical and one Download & play retains the old run until preparation finishes',
);
test(scenario.name, scenario.run);
test('Closed chapter page restores the outer fetch after host', assertOptionalFetchRestored);
