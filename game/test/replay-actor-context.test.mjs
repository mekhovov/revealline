import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { createRecorder, recordInput, exportReplay, verifyReplay } from '../replay.mjs';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { PACK_LIBRARY_VERSION, inspectPackLibraryMetadata } from '../packs.mjs';
import { exportReplayPresentation } from '../replay-presentation.mjs';
import { prepareReplayActorContext } from '../replay-actor-context.mjs';
import { prepareCampaignVisualThemeContext } from '../presentation/visual-theme-identities.mjs';
import { createJourneyVisualThemeIdentityAdapter } from '../presentation/journey-visual-theme-identities.mjs';
import { ACTOR_APPEARANCE_RELEASES } from '../presentation/actor-appearance-lease.mjs';
import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';
import { createCandidateSoloHost } from '../content-design/solo-host.mjs';
import { authoredJourneyUsesActorMaterials } from '../content-design/mode-href.mjs';
import { journeyActorThemeCandidates } from '../presentation/journey-actor-materials.mjs';
import { matchReplayInstalledRules } from '../replay-installed-rules.mjs';
import { restoreSession, SESSION_FORMAT } from '../sessions.mjs';

const root = new URL('../../', import.meta.url);
const originals = new Map();
function bytes(path) {
  if (!originals.has(path)) {
    let value;
    try {
      value = readFileSync(new URL(path, root));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      value = execFileSync('git', ['show', `HEAD:${path}`], {
        cwd: root,
        maxBuffer: 25 * 1024 * 1024,
      });
    }
    originals.set(path, value);
  }
  return originals.get(path);
}
const json = (path) => JSON.parse(bytes(path));
const requests = [];
const transport = async (url) => {
  const path = new URL(url).pathname.slice(root.pathname.length);
  requests.push(path);
  return new Response(bytes(path));
};

function recording(level, recipes, { ticks = 5, input = {}, tuning = null } = {}) {
  const actual = tuning ? applyGameplayTuning(level, tuning) : level;
  const options = { seed: 1, turnPolicy: 'immediate', classId: 'scout', classRecipes: recipes };
  const state = createRun(actual, options),
    recorder = createRecorder(actual, options, 'owner-test');
  for (let i = 0; i < ticks && ['running', 'respawning'].includes(state.status); i++) {
    stepRun(state, input, FIXED_DT);
    recordInput(recorder, input);
  }
  return { state, recorder, replay: exportReplay(recorder, state) };
}
function wrapped(entry, level, content, options) {
  return exportReplayPresentation({
    execution: { campaignKey: entry.executionKey, sourcePackId: entry.sourcePackId ?? null },
    actorAppearancePin: {
      format: 'revealline-actor-appearance-pin.v1',
      style: 'fpv',
      rendererPolicy: 'actor-style.v1',
      content,
      presentation: ACTOR_APPEARANCE_RELEASES[0].presentation,
    },
    replay: recording(level, entry.classRecipes, options).replay,
  });
}
async function classic({ packId = null, difficulty = 'standard', ...options } = {}) {
  let wrappers;
  if (packId) {
    const row = json('game/content/mission-library-index.json').missions.find(
      (item) => item.packId === packId,
    );
    const metadata = await inspectPackLibraryMetadata({
      format: PACK_LIBRARY_VERSION,
      packs: [json(row.sourceFile.path)],
    });
    wrappers = metadata.packs[0].entries;
  } else {
    const campaign = json('game/content/campaign.json'),
      recipes = json('game/content/classes.json');
    campaign.classRecipes = recipes;
    wrappers = [
      { campaign, classRecipes: recipes, themes: json('game/content/themes.json').themes },
    ];
  }
  const entry = createExecutionCatalog(wrappers).entries.find(
    (item) => item.difficulty === difficulty,
  );
  const level = entry.campaign.levels[0];
  const content = await prepareCampaignVisualThemeContext({
    entry,
    level,
    association: {
      editionId: 'field-kit',
      contentThemeId: entry.themes[0].id,
      mode: 'solo',
    },
  });
  return { entry, level, content, envelope: wrapped(entry, level, content, options) };
}
async function journey({ routeId = 'opening', difficulty = 'standard', ...options } = {}) {
  const route = await loadAuthoredJourneyRoute(routeId);
  const themes = json('game/content-design/themes.json').themes;
  const host = createCandidateSoloHost(route.source, {
    themes: authoredJourneyUsesActorMaterials(route.id)
      ? journeyActorThemeCandidates(themes, {
          includeOriginals: route.preserveOriginalThemes === true,
        })
      : themes,
    corePackIds: route.corePackIds,
    optionalCampaignIds: route.optionalCampaignIds,
  });
  try {
    const entry = host.entries.find((item) => item.difficulty === difficulty);
    const level = entry.campaign.levels[0];
    const adapter = await createJourneyVisualThemeIdentityAdapter(route.source, { mode: 'solo' });
    const content = await adapter.prepareHostSelection({
      host,
      selection: entry,
      level,
      association: {
        editionId: route.id,
        contentThemeId: entry.manifests[0].presentation.themeId,
        mode: 'solo',
      },
    });
    return { entry, level, content, envelope: wrapped(entry, level, content, options) };
  } finally {
    host.preparer.dispose();
  }
}

for (const difficulty of ['standard', 'gentle'])
  test(`Base Classic ${difficulty} resolves actual content and never decodes pictures`, async () => {
    const { envelope, content } = await classic({ difficulty });
    const before = requests.length;
    const actual = await prepareReplayActorContext(envelope, { fetcher: transport });
    assert.deepEqual(actual, { content, scope: 'builtin' });
    assert(Object.isFrozen(actual));
    assert(Object.isFrozen(actual.content.level));
    assert.deepEqual(
      new Set(requests.slice(before)),
      new Set([
        'game/content/mission-library-index.json',
        'game/content/campaign.json',
        'game/content/classes.json',
        'game/content/themes.json',
      ]),
    );
  });

for (const difficulty of ['gentle', 'standard', 'expert'])
  test(`registered Journey ${difficulty} reconstructs gp4 exactly once via actual host ownership`, async () => {
    const { envelope, content } = await journey({
      difficulty,
      tuning: resolveGameplayTuning(difficulty, {
        enemySpeed: 1.15,
        playerSpeed: 1.1,
        enemyDensity: 1,
      }),
    });
    const actual = await prepareReplayActorContext(envelope, { fetcher: transport });
    assert.deepEqual(actual, { content, scope: 'journey' });
    assert.equal(verifyReplay(envelope.replay).match, true);
  });

for (const packId of ['night-shift', 'original-fpv-pressure'])
  test(`indexed ${packId} resolves exact source and full normalized pack identity without decoding`, async () => {
    const { envelope, content } = await classic({ packId });
    const before = requests.length;
    assert.deepEqual(await prepareReplayActorContext(envelope, { fetcher: transport }), {
      content,
      scope: 'trusted-pack',
    });
    assert.equal(requests.length - before, 2);
  });

test('a genuinely finished registered Journey replay is accepted; historical session restore still rejects ended attempts', async () => {
  const fixture = await journey({ ticks: 1000, input: { direction: 'down' } });
  const checked = verifyReplay(fixture.envelope.replay);
  assert.equal(checked.match, true);
  assert.equal(checked.state.status, 'won');
  assert.equal(
    (await prepareReplayActorContext(fixture.envelope, { fetcher: transport })).scope,
    'journey',
  );
  const flight = recording(fixture.level, fixture.entry.classRecipes, {
    ticks: 1000,
    input: { direction: 'down' },
  });
  const saved = {
    format: SESSION_FORMAT,
    replay: flight.replay,
    campaignKey: fixture.entry.executionKey,
    themeId: fixture.content.contentThemeId,
    bodyId: 'fpv-body',
    runId: 'ended-owner-test',
    savedAt: '2026-09-24T10:00:00.000Z',
  };
  await assert.rejects(
    restoreSession(saved, {
      campaign: fixture.entry.campaign,
      campaignKey: fixture.entry.executionKey,
    }),
    /already ended/,
  );
});

test('current whole-spatial-v5 uses the same authored/material theme catalogue as Solo', async () => {
  const { envelope, content } = await journey({
    routeId: 'whole-spatial-v5',
    tuning: resolveGameplayTuning('standard'),
  });
  assert.equal(
    (await prepareReplayActorContext(envelope, { fetcher: transport })).scope,
    'journey',
  );
  assert.equal(content.editionId, 'whole-spatial-v5');
  assert.notEqual(content.contentThemeId, 'fpv');
});

test('same-ID changed level or changed equipment cannot gain accepted source ownership', async () => {
  const { entry, level, content } = await classic();
  const changedLevel = structuredClone(level);
  changedLevel.goal.coverage += 0.01;
  await assert.rejects(
    prepareReplayActorContext(wrapped(entry, changedLevel, content), { fetcher: transport }),
    /rules differ/,
  );
  const changedEntry = structuredClone(entry);
  changedEntry.classRecipes[0].cooldown += 0.1;
  await assert.rejects(
    prepareReplayActorContext(wrapped(changedEntry, level, content), { fetcher: transport }),
    /rules differ/,
  );
});

test('forged Journey project/map identity fails actual adapter equality; unknown edition requests no uploaded URL', async () => {
  const { envelope } = await journey();
  for (const mutate of [
    (value) => {
      value.actorAppearancePin.content.owner.projectSha256 = 'a'.repeat(64);
    },
    (value) => {
      value.actorAppearancePin.content.level.sha256 = 'a'.repeat(64);
    },
    (value) => {
      value.actorAppearancePin.content.owner.policyId = 'invented-policy';
    },
  ]) {
    const changed = structuredClone(envelope);
    mutate(changed);
    await assert.rejects(
      prepareReplayActorContext(changed, { fetcher: transport }),
      /different accepted content/,
    );
  }
  const changed = structuredClone(envelope);
  changed.actorAppearancePin.content.editionId = 'unregistered-edition';
  await assert.rejects(
    prepareReplayActorContext(changed, {
      fetcher: () => {
        throw new Error('must not fetch');
      },
    }),
    /owner is unavailable/,
  );
});

test('execution owner and theme hints do not authorize Custom or another campaign', async () => {
  const { envelope } = await classic();
  for (const mutate of [
    (value) => {
      value.execution.sourcePackId = 'uploaded-custom-pack';
    },
    (value) => {
      value.execution.campaignKey = 'uninstalled/1/rules';
    },
    (value) => {
      value.actorAppearancePin.content.contentThemeId = 'unknown-theme';
    },
    (value) => {
      value.actorAppearancePin.content.owner.baseCampaignKey = 'forged/1/owner';
    },
  ]) {
    const changed = structuredClone(envelope);
    mutate(changed);
    await assert.rejects(
      prepareReplayActorContext(changed, { fetcher: transport }),
      /unavailable|different accepted content/,
    );
  }
});

test('trusted source hash mismatch, missing response, redirects and oversized stream fail closed', async () => {
  const { envelope } = await classic();
  for (const response of [
    () => new Response(' '.repeat(bytes('game/content/campaign.json').length)),
    () => new Response('', { status: 503 }),
    () => ({ ok: true, redirected: true, body: new ReadableStream() }),
    () => new Response(' '.repeat(bytes('game/content/campaign.json').length + 1)),
  ]) {
    const fetcher = (url) => (url.endsWith('/campaign.json') ? response() : transport(url));
    await assert.rejects(
      prepareReplayActorContext(envelope, { fetcher }),
      /bytes differ|unavailable|byte budget/,
    );
  }
});

test('caller mutation after the first await cannot replace the snapshotted source or pin', async () => {
  const { envelope } = await classic(),
    mutable = structuredClone(envelope);
  let resume;
  const waiting = new Promise((resolve) => {
    resume = resolve;
  });
  const pending = prepareReplayActorContext(mutable, {
    fetcher: async (url) => {
      await waiting;
      return transport(url);
    },
  });
  mutable.execution.sourcePackId = 'changed';
  mutable.actorAppearancePin.content.level.sha256 = 'a'.repeat(64);
  resume();
  assert.equal((await pending).scope, 'builtin');
});

test('abort before transport and while reading cancels the bounded stream without returning authority', async () => {
  const { envelope } = await classic(),
    early = new AbortController();
  early.abort();
  await assert.rejects(
    prepareReplayActorContext(envelope, {
      signal: early.signal,
      fetcher: () => assert.fail('unexpected fetch'),
    }),
    { name: 'AbortError' },
  );
  const later = new AbortController();
  let cancelCount = 0,
    started;
  const ready = new Promise((resolve) => {
    started = resolve;
  });
  const pending = prepareReplayActorContext(envelope, {
    signal: later.signal,
    fetcher: async () =>
      new Response(
        new ReadableStream({
          pull() {
            started();
          },
          cancel() {
            cancelCount++;
          },
        }),
      ),
  });
  await ready;
  later.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(cancelCount, 1);
});

test('shared installed-rules matcher retains exact missing-map and changed-rule messages', async () => {
  const { entry, level } = await classic();
  const { state, replay } = recording(level, entry.classRecipes);
  assert.equal(matchReplayInstalledRules({ campaign: entry.campaign, replay, state }), level);
  assert.throws(
    () => matchReplayInstalledRules({ campaign: { ...entry.campaign, levels: [] }, replay, state }),
    /Install the matching campaign pack/,
  );
  const changed = structuredClone(entry.campaign);
  changed.levels[0].goal.coverage += 0.01;
  assert.throws(
    () => matchReplayInstalledRules({ campaign: changed, replay, state }),
    /Saved rules differ from the installed campaign/,
  );
});
