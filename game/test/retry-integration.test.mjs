import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createRun,
  stepRun,
  releaseInputs,
  validateLevel,
  getSummary,
  CLASSES,
  FIXED_DT,
} from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  recordRelease,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';
import { suspendSession, restoreSession, SESSION_FORMAT } from '../sessions.mjs';
import {
  campaignKey,
  emptyLibrary,
  exportLibrary,
  recordLibraryCompletion,
  withMasteryRecords,
} from '../library.mjs';
import { retryExplanation } from '../ui/retry-view.mjs';
import { RETRY_CAUSES, retryFixture } from './fixtures/retry-scenarios.mjs';

const STAMP = '2026-09-12T12:00:00.000Z';
const copy = (value) => structuredClone(value);
const json = async (name) => JSON.parse(await readFile(new URL(name, import.meta.url), 'utf8'));
const archived = await json('./fixtures/compatibility-v060.json');
const retainedSeal = (await json('./fixtures/mastery-v070.json')).cases.find(
  (entry) => entry.record,
).record;

function fresh(level, turnPolicy, classId = 'scout') {
  assert.equal(validateLevel(level).valid, true, validateLevel(level).errors.join('; '));
  const options = { turnPolicy, classId, seed: 120 };
  const campaign = {
    version: 'xonix-campaign.v1',
    id: 'retry-integration',
    revision: '1',
    title: 'Retry integration',
    themeId: 'fpv',
    levels: [copy(level)],
    classRecipes: copy(CLASSES),
  };
  return {
    run: createRun(level, options),
    recorder: createRecorder(level, options, 'retry-integration'),
    level,
    options,
    campaign,
    campaignKey: campaignKey(campaign),
    themeId: 'fpv',
    bodyId: 'fpv-body',
    runId: `retry-${level.id}-${turnPolicy}-${classId}`,
    savedAt: STAMP,
    events: [],
  };
}
function advance(source, input, ticks) {
  for (let i = 0; i < ticks; i++) {
    assert.ok(
      ['running', 'respawning'].includes(source.run.status),
      'Never step a terminal attempt.',
    );
    stepRun(source.run, input, FIXED_DT);
    recordInput(source.recorder, input);
    source.events.push(...source.run.events);
  }
}
function until(source, predicate, input = {}, maxTicks = 1000) {
  for (let i = 0; i < maxTicks && !predicate(source.run); i++) advance(source, input, 1);
  assert.ok(predicate(source.run), `Expected state within ${maxTicks} normal fixed ticks.`);
}
function route(source, segments) {
  for (const segment of segments) advance(source, segment.input, segment.ticks);
}
function checkReplay(source) {
  const before = authoritativeCheckpoint(source.run),
    replay = exportReplay(source.recorder, source.run);
  const checked = verifyReplay(replay);
  assert.equal(checked.match, true, checked.diagnostics.join('; '));
  assert.deepEqual(checked.actual.summary, getSummary(source.run));
  assert.deepEqual(authoritativeCheckpoint(checked.state), before);
  return { replay, checked };
}
async function restore(source) {
  const saved = suspendSession(source),
    original = copy(saved);
  const restored = await restoreSession(saved, {
    campaign: source.campaign,
    campaignKey: source.campaignKey,
  });
  assert.deepEqual(
    saved,
    original,
    'Verification owns its input and preserves the caller envelope.',
  );
  assert.deepEqual(authoritativeCheckpoint(restored.run), authoritativeCheckpoint(source.run));
  return { ...source, run: restored.run, recorder: restored.recorder, events: [] };
}
function finishRecovery(source) {
  until(source, (run) => run.status === 'running');
  // Grace is simulation time, so wait using ordinary neutral commands as well.
  until(source, (run) => run.time >= run.player.graceUntil);
}
function award(library, source, id) {
  return recordLibraryCompletion(library, {
    campaign: source.campaign,
    result: getSummary(source.run),
    runId: id,
    themeId: 'fpv',
    bodyId: 'fpv-body',
    completedAt: STAMP,
  });
}

for (const turnPolicy of ['immediate', 'grid-center']) {
  for (const cause of RETRY_CAUSES)
    test(`${turnPolicy}/${cause}: real terminal input, summary, replay and Retry agree`, async () => {
      const fixture = retryFixture(cause),
        source = fresh(fixture.level, turnPolicy);
      route(source, fixture.segments);
      assert.equal(source.run.tick, fixture.terminalTick);
      assert.equal(source.run.status, 'lost');
      assert.equal(source.run.failureCause, cause);
      assert.equal(source.run.result.failureCause, cause);
      const before = authoritativeCheckpoint(source.run);
      const explanation = retryExplanation(source.run);
      assert.equal(explanation.cause, cause);
      assert.ok(explanation.reason.length > 0 && explanation.tip.length > 0);
      assert.notEqual(
        explanation.footnote,
        retryExplanation(source.run, { practice: true }).footnote,
      );
      assert.deepEqual(retryExplanation(getSummary(source.run)), explanation);
      assert.deepEqual(authoritativeCheckpoint(source.run), before);
      const { replay, checked } = checkReplay(source);
      assert.deepEqual(retryExplanation(checked.state), explanation);
      assert.equal(replay.version, cause === 'boss-lane' ? 'xonix-replay.v4' : 'xonix-replay.v3');
      if (cause === 'enemy-player') {
        assert.equal(source.run.claimedCount, 0);
        assert.equal(
          source.run.player.cutting,
          false,
          'A patrol can reach a player on safe ground.',
        );
      }
      const changed = copy(replay);
      changed.summary.failureCause =
        cause === 'mission-timeout' ? 'enemy-player' : 'mission-timeout';
      assert.equal(
        verifyReplay(changed).match,
        false,
        'A different terminal reason is not an equivalent replay.',
      );
      assert.deepEqual(replay, exportReplay(source.recorder, source.run));
      assert.throws(() => suspendSession(source), /unfinished/);
      const terminal = {
        format: SESSION_FORMAT,
        campaignKey: source.campaignKey,
        themeId: 'fpv',
        bodyId: 'fpv-body',
        runId: source.runId,
        savedAt: STAMP,
        replay,
      };
      await assert.rejects(
        restoreSession(terminal, { campaign: source.campaign, campaignKey: source.campaignKey }),
        /already ended/,
      );
    });

  test(`${turnPolicy}: retained contact stays suppressed through recovery, restore and a later genuine win`, async () => {
    const fixture = retryFixture('self-contact');
    fixture.level.rules.lives = 2;
    fixture.level.goal.coverage = 0.1;
    let source = fresh(fixture.level, turnPolicy);
    route(source, fixture.segments);
    assert.equal(source.run.status, 'respawning');
    assert.equal(source.run.failureCause, 'self-contact');
    assert.equal(retryExplanation(source.run), null);
    source = await restore(source);
    assert.equal(source.run.failureCause, 'self-contact');
    assert.equal(retryExplanation(source.run), null);
    finishRecovery(source);
    assert.equal(retryExplanation(source.run), null);
    advance(source, { direction: 'right' }, 270);
    until(source, (run) => run.status === 'won', { direction: 'down' }, 530);
    assert.equal(source.run.failureCause, 'self-contact');
    assert.equal(source.run.lives, 1);
    assert.equal(retryExplanation(source.run), null);
    assert.equal(retryExplanation(getSummary(source.run)), null);
    checkReplay(source);
  });

  test(`${turnPolicy}: a mission deadline during restored recovery supersedes the earlier contact`, async () => {
    const fixture = retryFixture('self-contact');
    fixture.level.rules = { lives: 2, timeLimitSeconds: 0.35, respawnSeconds: 0.65 };
    let source = fresh(fixture.level, turnPolicy);
    route(source, fixture.segments);
    assert.equal(source.run.status, 'respawning');
    assert.equal(source.run.failureCause, 'self-contact');
    source = await restore(source);
    until(source, (run) => run.status === 'lost', {}, 20);
    assert.equal(
      source.run.lives,
      1,
      'The clock ends the attempt without requiring another life loss.',
    );
    assert.equal(source.events.filter((event) => event.type === 'player.failed').length, 0);
    assert.equal(retryExplanation(source.run).cause, 'mission-timeout');
    checkReplay(source);
  });

  test(`${turnPolicy}: shield absorption is a recoverable prefix, never a terminal retry reason`, async () => {
    const fixture = retryFixture('enemy-trail');
    let source = fresh(fixture.level, turnPolicy, 'interceptor');
    advance(source, { action: true }, 1);
    until(source, (run) => run.status === 'respawning', { direction: 'down' }, 60);
    assert.ok(source.events.some((event) => event.type === 'shield.absorbed'));
    assert.equal(source.run.lives, 1);
    assert.equal(source.run.failureCause, 'enemy-trail');
    assert.equal(retryExplanation(source.run), null);
    source = await restore(source);
    assert.equal(source.run.failureCause, 'enemy-trail');
    finishRecovery(source);
    assert.equal(retryExplanation(source.run), null);
    assert.equal(source.run.lives, 1);
    checkReplay(source);
  });

  test(`${turnPolicy}: restored Impact redeployment retains an earlier cause without relabeling it as loss`, async () => {
    const fixture = retryFixture('self-contact');
    fixture.level.rules.lives = 2;
    let source = fresh(fixture.level, turnPolicy, 'impact');
    route(source, fixture.segments);
    finishRecovery(source);
    advance(source, { direction: 'down' }, 30);
    assert.ok(source.run.trail.length >= 2);
    advance(source, { action: true }, 1);
    assert.ok(source.events.some((event) => event.type === 'craft.redeployed'));
    assert.equal(source.run.status, 'respawning');
    assert.equal(source.run.lives, 1);
    assert.equal(source.run.failureCause, 'self-contact');
    assert.equal(retryExplanation(source.run), null);
    source = await restore(source);
    assert.equal(source.run.failureCause, 'self-contact');
    finishRecovery(source);
    assert.equal(retryExplanation(source.run), null);
    assert.equal(source.run.claimedCount, 0);
    checkReplay(source);
  });

  test(`${turnPolicy}: loss and explicit fresh-run recreation preserve earlier pictures, scores, seals and clears`, () => {
    const fixture = retryFixture('self-contact');
    fixture.level.rules.lives = 2;
    fixture.level.goal.coverage = 0.1;
    const completed = fresh(fixture.level, turnPolicy);
    advance(completed, { direction: 'right' }, 270);
    until(completed, (run) => run.status === 'won', { direction: 'down' }, 530);
    const library = withMasteryRecords(award(emptyLibrary(), completed, 'earlier-win'), [
      retainedSeal,
    ]);
    assert.equal(library.gallery.length, 1);
    assert.equal(library.scores.length, 1);
    assert.equal(
      library.masteries.length,
      1,
      'Existing archived metadata is retained; no new seal is inferred.',
    );
    const before = exportLibrary(library),
      failed = fresh(fixture.level, turnPolicy);
    route(failed, fixture.segments);
    finishRecovery(failed);
    route(failed, fixture.segments);
    assert.equal(failed.run.status, 'lost');
    assert.equal(award(library, failed, 'lost-attempt'), library);
    assert.equal(
      award(library, completed, 'earlier-win'),
      library,
      'Duplicate earlier completion stays idempotent.',
    );
    const retry = fresh(failed.level, turnPolicy);
    assert.equal(retry.run.status, 'running');
    assert.equal(retry.run.failureCause, null);
    assert.equal(retry.run.tick, 0);
    assert.equal(retry.run.claimedCount, 0);
    assert.deepEqual(retry.run.player, createRun(failed.level, failed.options).player);
    assert.equal(retryExplanation(retry.run), null);
    assert.equal(exportLibrary(library), before);
    checkReplay(failed);
  });

  test(`${turnPolicy}: reading the projection every tick preserves the original frozen v0.6 route oracle`, () => {
    const proof = archived.cases.find(
      (entry) => entry.level.id === 'signal-01' && entry.options.turnPolicy === turnPolicy,
    );
    assert.ok(proof);
    const run = createRun(proof.level, proof.options),
      recorder = createRecorder(proof.level, proof.options, 'retry-old-route');
    for (const segment of proof.segments) {
      if (segment.releaseBefore) {
        releaseInputs(run);
        recordRelease(recorder);
      }
      for (let i = 0; i < segment.ticks; i++) {
        stepRun(run, segment.input, FIXED_DT);
        recordInput(recorder, segment.input);
        assert.equal(retryExplanation(run), null);
      }
    }
    if (proof.releaseAfter) {
      releaseInputs(run);
      recordRelease(recorder);
    }
    const replay = exportReplay(recorder, run);
    assert.deepEqual(replay.summary, proof.summary);
    assert.deepEqual(
      replay.checkpoint,
      proof.checkpoint,
      'The existing archived expectation is never regenerated.',
    );
    assert.equal(verifyReplay(replay).match, true);
  });
}
