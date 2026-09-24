import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';
import { createContentExecutionCatalog } from '../content-design/execution.mjs';
import { createJourneyVisualThemeIdentityAdapter } from '../presentation/journey-visual-theme-identities.mjs';
import { createRun, CLASSES } from '../core/index.mjs';
import { createRecorder, authoritativeCheckpoint } from '../replay.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { suspendSession, snapshotSession, restoreSession } from '../sessions.mjs';
import { validateActorAppearancePinForContent } from '../presentation/actor-appearance-pin.mjs';

const project = createOpeningCandidates();
const catalog = createContentExecutionCatalog(project);
const adapter = await createJourneyVisualThemeIdentityAdapter(project, { mode: 'solo' });
async function fixture(difficulty = 'standard', style = 'fpv') {
  const entry = catalog.entries.find((row) => row.difficulty === difficulty),
    level = entry.campaign.levels[0],
    content = await adapter.prepare({
      entry,
      level,
      association: { editionId: 'actor-style-v1', contentThemeId: 'ukraine', mode: 'solo' },
    }),
    options = { classId: 'scout', classRecipes: CLASSES },
    run = createRun(applyGameplayTuning(level, resolveGameplayTuning(difficulty)), options),
    pin = {
      format: 'revealline-actor-appearance-pin.v1',
      style,
      rendererPolicy: 'actor-style.v1',
      content,
      presentation:
        style === 'campaign'
          ? null
          : {
              source: { id: 'field-kit', revision: 62 },
              theme: { id: 'fpv', revision: 62 },
              collection: null,
              sha256: 'b'.repeat(64),
            },
    };
  const saved = suspendSession({
    run,
    recorder: createRecorder(run.level, options),
    campaignKey: entry.executionKey,
    themeId: 'ukraine',
    bodyId: 'fpv-body',
    runId: 'journey-actor-save',
    savedAt: '2026-09-24T12:00:00.000Z',
    continuation: { direction: null },
    presentationLevel: level,
    actorAppearancePin: pin,
  });
  return { entry, level, run, pin, saved };
}
for (const difficulty of ['gentle', 'standard', 'expert'])
  for (const style of ['fpv', 'campaign'])
    test(`authored ${difficulty}/${style} retains actors without inventing managed picture pins`, async () => {
      const f = await fixture(difficulty, style);
      assert.equal(f.saved.format, 'xonix-session.v6');
      assert.equal(f.saved.presentationPins, null);
      assert.equal(f.saved.visualThemePin, null);
      assert.deepEqual(snapshotSession(f.saved), f.saved);
      const restored = await restoreSession(f.saved, {
        campaign: f.entry.campaign,
        campaignKey: f.entry.executionKey,
      });
      assert.deepEqual(authoritativeCheckpoint(restored.run), authoritativeCheckpoint(f.run));
      assert.deepEqual(restored.session.actorAppearancePin, f.pin);
      assert.deepEqual(
        validateActorAppearancePinForContent(restored.session.actorAppearancePin, f.pin.content),
        f.pin,
      );
    });

test('null pictures are closed to Solo Journey actors and cannot conceal a Classic owner', async () => {
  const f = await fixture();
  for (const mutate of [
    (save) => {
      save.actorAppearancePin.content.mode = 'versus';
    },
    (save) => {
      save.actorAppearancePin.content.level.id = 'different-map';
    },
    (save) => {
      save.themeId = 'retro';
    },
    (save) => {
      save.visualThemePin = {};
    },
    (save) => {
      save.actorAppearancePin.content.owner = {
        kind: 'campaign',
        baseCampaignKey: f.entry.baseCampaignKey,
      };
      delete save.actorAppearancePin.content.level.simulationIdentity;
    },
  ]) {
    const changed = structuredClone(f.saved);
    mutate(changed);
    assert.throws(() => snapshotSession(changed));
  }
  const changed = structuredClone(f.saved);
  changed.actorAppearancePin.content.level.revision = 'other-edition';
  await assert.rejects(
    restoreSession(changed, {
      campaign: f.entry.campaign,
      campaignKey: f.entry.executionKey,
    }),
    /authored Journey context/,
  );
  const changedProject = structuredClone(f.pin);
  changedProject.content.owner.projectSha256 = 'a'.repeat(64);
  assert.throws(
    () => validateActorAppearancePinForContent(changedProject, f.pin.content),
    /different accepted content/,
  );
});
