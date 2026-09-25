import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { attachJourneyModePictures } from '../ui/journey-mode-pictures.mjs';

const asset = Object.freeze({
  format: 'AssetRevisionV1',
  id: 'team-one',
  revision: 'r1',
  kind: 'reveal-background',
  path: 'content-design/assets/test/team-one.png',
  sha256: 'a'.repeat(64),
  bytes: 128,
  width: 1152,
  height: 576,
  alt: 'Team original',
  review: 'candidate',
});
const record = (mode, editionId, missionId) => ({
  mode,
  editionId,
  missionId,
  campaignKey: 'campaign/exact',
  levelId: 'team-one',
  levelRevision: '1',
  runId: `${mode}-${editionId}-${missionId}`,
  gameplayId: '0123456789abcdef',
  difficulty: 'standard',
  name: 'Team one',
  campaignTitle: 'Shared route',
  themeId: 'fpv',
  asset,
});

test('mode picture surface admits only its exact mode/edition and restores its opener', async () => {
  const document = new Document(),
    opener = document.createElement('button'),
    missions = [
      { id: 'team-one', name: 'Team one', campaignTitle: 'Shared route' },
      { id: 'team-two', name: 'Team two', campaignTitle: 'Shared route' },
    ],
    reads = { profile: 0, pictures: 0 },
    profile = {
      snapshot() {
        reads.profile++;
        return {
          clears: {
            solo: { 'solo-one': {} },
            versus: { 'versus-one': {} },
            team: { 'team-one': {}, 'team-two': {}, 'team-earlier': {} },
          },
        };
      },
      pictures() {
        reads.pictures++;
        return {
          records: [
            record('team', 'team-edition', 'team-one'),
            record('team', 'older-edition', 'team-one'),
            record('versus', 'team-edition', 'team-one'),
          ],
        };
      },
    };
  opener.textContent = 'Journey pictures';
  document.body.append(opener);
  const view = attachJourneyModePictures({
    document,
    button: opener,
    mode: 'team',
    editionId: 'team-edition',
    catalog: { forMode: (mode) => (mode === 'team' ? missions : []) },
    profile,
  });
  opener.focus();
  opener.click();
  await Promise.resolve();
  const dialog = view.root(),
    cards = dialog.querySelectorAll('.journey-mode-picture-card');
  assert.equal(dialog.open, true);
  assert.equal(cards.length, 3);
  assert.match(dialog.textContent, /1 earned Team original/);
  assert.match(dialog.textContent, /Team two.*Earlier edition.*original unavailable/);
  assert.match(dialog.textContent, /Earlier Journey mission.*Earlier edition/);
  assert.doesNotMatch(dialog.textContent, /earned Solo|earned Versus|older-edition/);
  assert.deepEqual(reads, { profile: 1, pictures: 1 });
  dialog.querySelector('header').querySelector('button').click();
  assert.equal(view.root(), null);
  assert.equal(document.activeElement, opener);
  assert.deepEqual(reads, { profile: 1, pictures: 1 });
  view.dispose();
});
