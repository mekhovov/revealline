import test from 'node:test';
import assert from 'node:assert/strict';
import { resultContinuationLabel } from '../ui/result-continuation.mjs';

const t = (key, values = {}) =>
  ({
    'interface:browseMissions': 'Browse missions',
    'interface:browseMissions2': 'Browse missions →',
    'interface:nextMission2': 'Next mission',
    'interface:nextMissionNamed': `Next: ${values.mission}`,
    'interface:nextCampaignNamed': `Next campaign: ${values.campaign}`,
  })[key];

test('known result destinations name a mission or campaign and final results browse', () => {
  assert.equal(resultContinuationLabel(t, { mission: 'Relay Orchard' }), 'Next: Relay Orchard');
  assert.equal(
    resultContinuationLabel(t, {
      mission: 'Behind the patrol',
      campaign: 'Border Bloom',
      crossesCampaign: true,
    }),
    'Next campaign: Border Bloom',
  );
  assert.equal(resultContinuationLabel(t, { browse: true }), 'Browse missions');
  assert.equal(
    resultContinuationLabel(t, { browse: true, browseKey: 'interface:browseMissions2' }),
    'Browse missions →',
  );
});

test('an unresolved catalogue successor stays truthful instead of inventing a destination', () => {
  assert.equal(resultContinuationLabel(t), 'Next mission');
  assert.equal(
    resultContinuationLabel(t, { mission: 'Known mission', crossesCampaign: true }),
    'Next: Known mission',
  );
});
