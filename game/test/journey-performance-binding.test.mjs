import test from 'node:test';
import assert from 'node:assert/strict';
import { retainedEditionFixture } from './helpers/retained-edition-fixture.mjs';
import { createCandidateSoloHost } from '../content-design/solo-host.mjs';
import { createSoloPerformanceBinding } from '../journey/performance-binding.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { createRun } from '../core/index.mjs';
import { dataIdentity } from '../data-json.mjs';

const hostFor = (provider) =>
  createCandidateSoloHost(provider.route.source, {
    themes: provider.themes,
    corePackIds: provider.route.corePackIds,
  });
function attempt(host) {
  const mission = host.catalog.missions[0],
    entry = host.select(mission, 'standard');
  const state = createRun(
    applyGameplayTuning(entry.campaign.levels[0], resolveGameplayTuning('standard')),
  );
  const record = {
    mode: 'solo',
    missionId: mission.id,
    runId: 'accepted',
    difficulty: 'standard',
    gameplayId: dataIdentity({
      ruleset: state.ruleset,
      level: state.level,
      classes: state.classRecipes,
    }),
  };
  return { state, record };
}

test('presentation-only updates compare the same exact current gameplay without loading history or media', async () => {
  const f = await retainedEditionFixture({ originalArtwork: true });
  const prior = attempt(hostFor(f.original));
  f.replacePicture();
  const provider = await f.load(),
    host = hostFor(provider),
    current = attempt(host);
  assert.equal(current.record.gameplayId, prior.record.gameplayId);
  assert.equal(
    await createSoloPerformanceBinding({
      host,
      provider,
      fetcher: () => assert.fail('Current gameplay needs no history or media fetch.'),
    })(prior.record, prior.state),
    true,
  );
});

test('historical comparisons require an exact registered selected snapshot and reject omitted mission identities', async () => {
  const f = await retainedEditionFixture(),
    prior = attempt(hostFor(f.original));
  f.source.maps[0].foundations = [];
  const provider = await f.load(),
    host = hostFor(provider),
    current = attempt(host),
    fetched = [];
  assert.notEqual(current.record.gameplayId, prior.record.gameplayId);
  const admit = createSoloPerformanceBinding({
    host,
    provider,
    fetcher: (url, options) => {
      fetched.push(new URL(url).pathname.slice(1));
      return f.fetcher(url, options);
    },
  });
  assert.equal(await admit(prior.record, prior.state), true);
  assert.deepEqual(fetched, [f.descriptor.path]);
  assert.equal(
    await admit({ ...prior.record, missionId: 'candidate/foreign/route/missing' }, prior.state),
    false,
  );
  const catalog = structuredClone(provider.currentCatalog ?? provider.catalog);
  catalog.editions[0].presentationHistory = [];
  assert.equal(
    await createSoloPerformanceBinding({
      host,
      provider: { ...provider, currentCatalog: catalog },
      fetcher: () => assert.fail('Unregistered history must never be fetched.'),
    })(prior.record, prior.state),
    false,
  );
});

test('a stalled retained lookup is bounded and cancels its fetch lifetime', async () => {
  const f = await retainedEditionFixture(),
    prior = attempt(hostFor(f.original));
  f.source.maps[0].foundations = [];
  const provider = await f.load();
  let signal;
  const admit = createSoloPerformanceBinding({
    host: hostFor(provider),
    provider,
    timeoutMs: 5,
    fetcher: (_url, options) => {
      signal = options.signal;
      return new Promise(() => {});
    },
  });
  await assert.rejects(admit(prior.record, prior.state), { name: 'AbortError' });
  assert.equal(signal.aborted, true);
});
