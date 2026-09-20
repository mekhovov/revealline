import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createStarterProject } from '../content-design/starter.mjs';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';
import { createContentExecutionCatalog } from '../content-design/execution.mjs';
import { canonicalJSON } from '../data-json.mjs';
import { createJourneyVisualThemeIdentityAdapter as adapter } from '../presentation/journey-visual-theme-identities.mjs';
import {
  createVisualThemeCatalogue,
  snapshotVisualThemeContext,
  VISUAL_THEME_CATALOGUE_FORMAT,
} from '../presentation/visual-theme-catalogue.mjs';

const clone = (value) => structuredClone(value);
const sha = (value) => createHash('sha256').update(canonicalJSON(value)).digest('hex');
function shared() {
  const source = createStarterProject('theme-journey');
  source.maps[0].spawns.push({ id: 'island', x: 32.5, y: 17.5 });
  source.missions[0].modes = ['solo', 'versus', 'team'];
  source.missions[0].team = { format: 'TeamMissionV1', spawnIds: ['home', 'island'] };
  source.missions[0].design.difficulty.coordination = 1;
  return source;
}
const association = (mode) => ({ editionId: 'field-kit', contentThemeId: 'fpv', mode });
const request = (entry, mode = 'solo', index = 0) => ({
  entry,
  level: entry.campaign.levels[index],
  association: association(mode),
});

function catalogue(content) {
  return createVisualThemeCatalogue({
    format: VISUAL_THEME_CATALOGUE_FORMAT,
    id: 'journey-themes',
    revision: 1,
    entries: [
      {
        id: 'field-kit',
        revision: 1,
        name: 'Field Kit',
        presentation: {
          source: { id: 'studio', revision: 1 },
          theme: { id: 'fpv', revision: 32 },
          collection: null,
          sha256: 'a'.repeat(64),
        },
        coverage: [content],
      },
    ],
  });
}

test('real compiled Journey authority supplies all three modes and presets without Legacy projection', async () => {
  const source = shared();
  for (const mode of ['solo', 'versus', 'team']) {
    const owner = await adapter(source, { mode });
    const executions = createContentExecutionCatalog(source, { mode });
    const standard = executions.entries.find((entry) => entry.difficulty === 'standard');
    const expected = await owner.prepare(request(standard, mode));
    for (const entry of executions.entries) {
      const context = await owner.prepare(request(entry, mode));
      assert.deepEqual(context, expected);
      assert.equal(context.owner.kind, 'journey');
      assert.equal(context.owner.projectSha256, sha(source));
      assert.equal(context.owner.baseCampaignKey, entry.baseCampaignKey);
      assert.equal(context.owner.policyId, entry.policyVersion);
      assert.equal(context.level.simulationIdentity, standard.manifests[0].simulationIdentity);
      assert.equal(context.level.sha256, sha(standard.campaign.levels[0]));
      assert(Object.isFrozen(context.owner));
      assert.equal(entry.officialProgressEligible, false);
    }
  }
});

test('real opening candidates keep exact pack membership for shared campaigns', async () => {
  const source = createOpeningCandidates();
  source.packs[1].campaignIds = ['prologue'];
  const executions = createContentExecutionCatalog(source);
  const owner = await adapter(source, { mode: 'solo' });
  const a = executions.select('journey-opening', 'prologue');
  const b = executions.select('opening-remixes', 'prologue');
  assert.equal(a.executionKey, b.executionKey);
  const first = await owner.prepare(request(a));
  const other = await owner.prepare(request(b));
  assert.equal(first.owner.baseCampaignKey, other.owner.baseCampaignKey);
  assert.notEqual(first.owner.packId, other.owner.packId);
  assert.equal(
    catalogue(first).resolve({ id: 'field-kit', revision: 1 }, other).kind,
    'unsupported',
  );
  for (const entry of executions.entries)
    for (let index = 0; index < entry.campaign.levels.length; index++)
      assert.equal(
        (await owner.prepare(request(entry, 'solo', index))).level.id,
        entry.campaign.levels[index].id,
      );
});

test('changed mission, map, registered policy or presentation cannot reuse old content coverage', async () => {
  const source = shared();
  const original = createContentExecutionCatalog(source).entries[0];
  const originalOwner = await adapter(source, { mode: 'solo' });
  const context = await originalOwner.prepare(request(original));
  const themes = catalogue(context);
  for (const modify of [
    (project) => {
      project.missions[0].coverage = 0.55;
    },
    (project) => {
      project.maps[0].name += ' changed';
    },
    (project) => {
      project.policyId = 'journey-v1';
    },
    (project) => {
      project.missions[0].name += ' changed';
    },
    (project) => {
      project.revision = 'draft-2';
    },
  ]) {
    const changed = clone(source);
    modify(changed);
    const owner = await adapter(changed, { mode: 'solo' });
    const [entry] = createContentExecutionCatalog(changed).entries;
    const next = await owner.prepare(request(entry));
    assert.notEqual(next.owner.projectSha256, context.owner.projectSha256);
    assert.equal(themes.resolve({ id: 'field-kit', revision: 1 }, next).kind, 'unsupported');
    // Pure map-label/project-revision changes need not alter existing execution
    // identity. The exact source hash still prevents prior visual coverage.
    if (entry.executionKey !== original.executionKey)
      await assert.rejects(originalOwner.prepare(request(entry)));
  }
});

test('cross-mode entries, forged policy/progress and changed selected map are rejected', async () => {
  const source = shared();
  const owner = await adapter(source, { mode: 'solo' });
  const [entry] = createContentExecutionCatalog(source).entries;
  for (const change of [
    (value) => {
      value.policyVersion = 'journey-v1';
    },
    (value) => {
      value.officialProgressEligible = true;
    },
    (value) => {
      value.sourcePackId = 'wrong-pack';
    },
    (value) => {
      value.manifests[0].simulationIdentity = '0'.repeat(16);
    },
    (value) => {
      value.baseCampaignKey = 'wrong/1/key';
    },
  ]) {
    const forged = clone(entry);
    change(forged);
    await assert.rejects(owner.prepare(request(forged)), /accepted source project/);
  }
  const [teamEntry] = createContentExecutionCatalog(source, { mode: 'team' }).entries;
  await assert.rejects(owner.prepare(request(teamEntry)));
  await assert.rejects(owner.prepare(request(entry, 'team')));
  const selected = clone(entry.campaign.levels[0]);
  selected.name += ' altered';
  await assert.rejects(owner.prepare({ ...request(entry), level: selected }), /execution owner/);
});

test('owned project and entry snapshots resist mutation during async hashing', async () => {
  const source = shared();
  const before = clone(source);
  const creating = adapter(source, { mode: 'solo' });
  source.name = 'changed after creation';
  const owner = await creating;
  const entry = clone(createContentExecutionCatalog(before).entries[0]);
  const preparing = owner.prepare(request(entry));
  entry.manifests[0].simulationIdentity = '0'.repeat(16);
  const context = await preparing;
  assert.equal(context.owner.projectSha256, sha(before));
  assert.notEqual(context.level.simulationIdentity, entry.manifests[0].simulationIdentity);
});

test('cancelled creation and preparation never return an accepted context', async () => {
  const source = shared();
  const early = new AbortController();
  early.abort();
  await assert.rejects(adapter(source, { mode: 'solo', signal: early.signal }), {
    name: 'AbortError',
  });
  const late = new AbortController();
  const pending = adapter(source, { mode: 'solo', signal: late.signal });
  late.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  const owner = await adapter(source, { mode: 'solo' });
  const [entry] = createContentExecutionCatalog(source).entries;
  const stop = new AbortController();
  const context = owner.prepare(request(entry), { signal: stop.signal });
  stop.abort();
  await assert.rejects(context, { name: 'AbortError' });
});

test('Journey schema cannot masquerade as Legacy/Team; missing hashes and simulated latest fail', async () => {
  const source = shared();
  const owner = await adapter(source, { mode: 'team' });
  const [entry] = createContentExecutionCatalog(source, { mode: 'team' }).entries;
  const valid = await owner.prepare(request(entry, 'team'));
  for (const change of [
    (value) => {
      value.owner.kind = 'team-pack';
    },
    (value) => {
      value.owner.kind = 'campaign';
    },
    (value) => {
      delete value.owner.projectSha256;
    },
    (value) => {
      value.level.simulationIdentity = 'latest';
    },
    (value) => {
      delete value.level.simulationIdentity;
    },
  ]) {
    const bad = clone(valid);
    change(bad);
    assert.throws(() => snapshotVisualThemeContext(bad));
  }
  const invalid = shared();
  invalid.policyId = 'unknown-policy';
  await assert.rejects(adapter(invalid, { mode: 'team' }));
  await assert.rejects(adapter(source));
});

test('registered policy and approved-art metadata changes retain existing simulation and execution authority', async () => {
  const source = createOpeningCandidates({ artwork: true });
  const baseline = createContentExecutionCatalog(source).entries[0];
  const owner = await adapter(source, { mode: 'solo' });
  const content = await owner.prepare(request(baseline));
  const artwork = clone(source);
  artwork.assets[0].sha256 = '0'.repeat(64);
  const changedOwner = await adapter(artwork, { mode: 'solo' });
  const changed = createContentExecutionCatalog(artwork).entries[0];
  const alternate = await changedOwner.prepare(request(changed));
  assert.equal(alternate.level.simulationIdentity, content.level.simulationIdentity);
  assert.notEqual(alternate.owner.projectSha256, content.owner.projectSha256);
  assert.notEqual(alternate.owner.baseCampaignKey, content.owner.baseCampaignKey);
  await assert.rejects(owner.prepare(request(changed)));
  const policy = clone(source);
  policy.policyId = 'journey-v1';
  const policyOwner = await adapter(policy, { mode: 'solo' });
  const policyEntry = createContentExecutionCatalog(policy).entries[0];
  const policyContent = await policyOwner.prepare(request(policyEntry));
  assert.notEqual(policyContent.owner.policyId, content.owner.policyId);
  assert.notEqual(policyContent.level.simulationIdentity, content.level.simulationIdentity);
});
