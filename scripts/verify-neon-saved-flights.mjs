import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRun, stepRun, FIXED_DT } from '../game/core/index.mjs';
import { createRecorder, recordInput, authoritativeCheckpoint } from '../game/replay.mjs';
import { createDifficultyContext } from '../game/campaign-difficulty.mjs';
import { createExecutionCatalog } from '../game/campaign-contexts.mjs';
import { createMediaIdentityCatalog, validateMediaLibrary } from '../game/media-library.mjs';
import { createPresentationPins } from '../game/presentation-pins.mjs';
import {
  CLASSIC_RULES_CURRENT,
  projectClassicCurrentRulesEntry,
} from '../game/mission-library/classic-current-rules.mjs';
import {
  CLASSIC_RULES_SESSION_FORMAT,
  suspendSession,
  snapshotSession,
  restoreSession,
} from '../game/sessions.mjs';

// End-to-end engine save verification against the shipped map data. No browser
// state, storage, awards or artwork bytes are created by this verifier.
const records = [];
let rejectionChecks = 0;
let expectedRecords = 0;
for (const packId of ['neon-reference-pack', 'neon-mosaic-pack']) {
  const pack = JSON.parse(
    await readFile(new URL(`../game/content/packs/${packId}.json`, import.meta.url)),
  );
  for (const authored of pack.campaigns) {
    expectedRecords += authored.levels.length * 4;
    const original = {
      ...authored,
      classRecipes: pack.classRecipes.filter((recipe) => authored.classIds.includes(recipe.id)),
    };
    const catalog = createExecutionCatalog([{ campaign: original, themes: pack.themes }]);
    const identityCatalog = createMediaIdentityCatalog(catalog);
    const library = validateMediaLibrary(
      { format: 'revealline-media-library.v1', assets: [], presentations: [], assignments: [] },
      { identityCatalog },
    );
    const projected = projectClassicCurrentRulesEntry(
      { campaign: original },
      CLASSIC_RULES_CURRENT,
    );
    for (const difficulty of ['standard', 'gentle']) {
      const execution = createDifficultyContext(projected.campaign, difficulty);
      const owner = createDifficultyContext(original, difficulty);
      for (const turnPolicy of ['grid-center', 'immediate']) {
        for (const level of execution.campaign.levels) {
          const presentationLevel = owner.campaign.levels.find((item) => item.id === level.id);
          const options = {
            classId: 'scout',
            classRecipes: execution.campaign.classRecipes,
            turnPolicy,
          };
          const run = createRun(level, options);
          const recorder = createRecorder(level, options);
          const pins = createPresentationPins({
            library,
            identityCatalog,
            executionKey: owner.campaignKey,
            levelId: level.id,
            levelRevision: presentationLevel.revision,
            themeIds: pack.themes.map((theme) => theme.id),
          });
          for (let tick = 0; tick < 12; tick++) {
            const command = { direction: 'left', boost: false, action: false, pickup: false };
            stepRun(run, command, FIXED_DT);
            recordInput(recorder, command);
          }
          const checkpoint = authoritativeCheckpoint(run);
          const saved = suspendSession({
            run,
            recorder,
            campaign: execution.campaign,
            campaignKey: execution.campaignKey,
            themeId: pack.themes[0].id,
            bodyId: pack.themes[0].player,
            runId: 'neon-save-verification',
            savedAt: '2026-10-15T20:00:00.000Z',
            continuation: { direction: 'left' },
            presentationPins: pins,
            presentationLevel: level,
            classicRulesPictureSource: { campaign: original, difficulty },
          });
          assert.equal(saved.format, CLASSIC_RULES_SESSION_FORMAT);
          assert.deepEqual(snapshotSession(JSON.stringify(saved)), saved);
          const restoreOptions = {
            campaign: execution.campaign,
            campaignKey: execution.campaignKey,
            mediaIdentityCatalog: identityCatalog,
          };
          const restored = await restoreSession(JSON.stringify(saved), restoreOptions);
          assert.deepEqual(authoritativeCheckpoint(restored.run), checkpoint);
          assert.deepEqual(restored.session.presentationPins, pins);
          assert.deepEqual(restored.session.continuation, saved.continuation);
          for (let tick = 0; tick < 12; tick++) {
            const command = { direction: 'left', boost: false, action: false, pickup: false };
            stepRun(run, command, FIXED_DT);
            stepRun(restored.run, command, FIXED_DT);
          }
          assert.deepEqual(authoritativeCheckpoint(restored.run), authoritativeCheckpoint(run));
          if (records.length === 0) {
            for (const mutate of [
              (value) => {
                value.pictureSource.campaign.levels[0].revision = 'wrong-source';
              },
              (value) => {
                value.pictureSource.difficulty = 'gentle';
              },
              (value) => {
                value.presentationPins.executionKey = value.campaignKey;
              },
              (value) => {
                value.presentationPins.levelRevision = 'wrong-picture';
              },
              (value) => {
                value.pictureSource.extra = true;
              },
              (value) => {
                value.format = 'xonix-session.v6';
              },
            ]) {
              const invalid = structuredClone(saved);
              mutate(invalid);
              await assert.rejects(restoreSession(invalid, restoreOptions));
              rejectionChecks++;
            }
            await assert.rejects(
              restoreSession(saved, { ...restoreOptions, mediaIdentityCatalog: undefined }),
            );
            rejectionChecks++;
          }
          records.push({
            packId,
            levelId: level.id,
            difficulty,
            turnPolicy,
            checkpointPreserved: true,
            continuationPreserved: true,
            picturesPreserved: true,
            resumedCheckpointMatches: true,
            bytes: Buffer.byteLength(JSON.stringify(saved)),
          });
        }
      }
    }
  }
}
assert.equal(records.length, expectedRecords);
const report = {
  format: 'revealline-neon-saved-flight-verification.v1',
  cases: records.length,
  rejectionChecks,
  scope:
    'Shipped levels, real core and recorder, exact export/import/replay checkpoints and continued directional input. Original artwork choices use explicit authored-picture fallback pins; decoded image bytes and native storage are qualified separately in the browser.',
  records,
};
const output = process.argv.find((arg) => arg.startsWith('--output='))?.slice(9);
if (output) await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(
  JSON.stringify({
    cases: report.cases,
    rejectionChecks,
    maxBytes: Math.max(...records.map((row) => row.bytes)),
  }),
);
