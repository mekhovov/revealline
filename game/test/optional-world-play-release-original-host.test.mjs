import test from 'node:test';
import {
  approvedReleasePictureScenario,
  assertWorldPlayFetchRestored,
} from './optional-world-play-scenarios.mjs';
test(
  'an unassigned shipped chapter plays the exact approved release original',
  approvedReleasePictureScenario,
);
test('Closed release-original page restores fetch ownership', assertWorldPlayFetchRestored);
