import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { preparePack, resolvePackCampaign } from '../packs.mjs';
import { customLibrarySources } from '../mission-library/custom-source.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { createDifficultyContext } from '../campaign-difficulty.mjs';

const recipe = JSON.parse(
  await readFile(new URL('../content/packs/night-shift.json', import.meta.url), 'utf8'),
);
const makeOwner = async (mutate = () => {}) => {
  const source = structuredClone(recipe);
  mutate(source);
  const { pack } = await preparePack(source, {
    decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }),
  });
  return {
    pack,
    entries: pack.campaigns.map((campaign) => resolvePackCampaign(pack, campaign.id)),
  };
};
const adapters = {
  compatibility: () => ['solo', 'versus'],
  describe: ({ level }) => ({
    rules: `${level.goal.coverage * 100}% · ${level.rules.lives} lives`,
    tags: [],
  }),
  availability: () => ({ state: 'ready' }),
  launch: () => true,
};

test('Custom launches and all adapters receive exact original pack, campaign entry and level objects', async () => {
  const owner = await makeOwner();
  const seen = [];
  const sources = await customLibrarySources([owner], {
    ...adapters,
    compatibility: (binding) => {
      seen.push(binding);
      return ['versus'];
    },
    describe: (binding) => {
      seen.push(binding);
      return adapters.describe(binding);
    },
    availability: (binding, mode) => {
      seen.push(binding);
      assert.equal(mode, 'versus');
      return { state: 'ready' };
    },
    progress: (binding, mode) => {
      seen.push(binding);
      assert.equal(mode, 'versus');
      return '';
    },
    card: (binding, mode) => {
      seen.push(binding);
      assert.equal(mode, 'versus');
      return null;
    },
    launch: (binding, context) => {
      seen.push(binding);
      assert.equal(context.mode, 'versus');
      return binding;
    },
  });
  const library = createMissionLibrary(sources),
    row = library.missions[0];
  assert.deepEqual(row.modes, ['versus']);
  assert.equal(library.progress(row, 'versus'), '');
  library.card(row, 'versus');
  const selected = library.launch(row, { mode: 'versus' });
  assert.equal(selected.pack, owner.pack);
  assert.equal(selected.entry, owner.entries[0]);
  assert.equal(selected.level, owner.entries[0].campaign.levels[0]);
  assert.ok(
    seen.every((binding) => binding.pack === owner.pack && binding.entry === owner.entries[0]),
  );
  assert.ok(Object.isFrozen(selected));
  assert.throws(() => library.launch(row, { mode: 'solo' }), /support/);
});

test('same names do not deduplicate packs or reorder the authored campaign and mission sequence', async () => {
  const a = await makeOwner(),
    b = await makeOwner((pack) => {
      pack.id = 'another-upload';
    });
  const sources = await customLibrarySources([a, b], adapters);
  const library = createMissionLibrary(sources);
  assert.equal(library.missions.length, 6);
  assert.equal(new Set(library.missions.map((row) => row.id)).size, 6);
  assert.deepEqual(
    library.missions.map((row) => row.runtimeId),
    [...a.entries[0].campaign.levels, ...b.entries[0].campaign.levels].map((level) => level.id),
  );
  assert.equal(library.next, undefined);
  assert.ok(library.missions.every((row) => row.collection === 'Custom'));
});

test('official exclusion is explicit and exact: modified same-ID/version packs remain Custom', async () => {
  const official = await makeOwner();
  const modified = await makeOwner((pack) => {
    pack.campaigns[0].levels[0].rules.lives++;
  });
  const isOfficial = async (pack) => pack === official.pack;
  assert.equal((await customLibrarySources([official], { ...adapters, isOfficial })).length, 0);
  assert.equal((await customLibrarySources([modified], { ...adapters, isOfficial })).length, 1);
  assert.equal(
    (await customLibrarySources([official], adapters)).length,
    1,
    'No inferred official classification.',
  );
  await assert.rejects(
    customLibrarySources([official], { ...adapters, isOfficial: () => 'yes' }),
    /boolean/,
  );
});

test('presentation-only replacement changes edition identity and rejects stale runtime rows', async () => {
  const a = await makeOwner(),
    b = await makeOwner((pack) => {
      pack.themes[0].palette.accent = '#112233';
    });
  const first = (await customLibrarySources([a], adapters))[0];
  const replacement = (await customLibrarySources([b], adapters))[0];
  assert.equal(first.id, replacement.id);
  assert.notEqual(first.editionId, replacement.editionId);
  assert.match(first.editionId, /^[a-f0-9]{64}$/);
  const library = createMissionLibrary([first]),
    old = library.missions[0];
  library.register(replacement);
  assert.throws(() => library.launch(old), /stale/);
  assert.notEqual(library.missions[0].id, old.id);
  assert.equal(library.launch(library.missions[0]), true);
  await assert.rejects(
    customLibrarySources([{ pack: b.pack, entries: a.entries }], adapters),
    /presentation or equipment/,
  );
});

test('campaign entry lookup preserves pack-authored order, not caller lookup order', async () => {
  const owner = await makeOwner((pack) => {
    const second = structuredClone(pack.campaigns[0]);
    second.id = 'second-campaign';
    for (const level of second.levels) level.id += '-second';
    pack.campaigns.push(second);
  });
  const sources = await customLibrarySources(
    [{ pack: owner.pack, entries: [...owner.entries].reverse() }],
    adapters,
  );
  const library = createMissionLibrary(sources);
  assert.deepEqual(
    library.missions.map((row) => row.runtimeId),
    owner.entries.flatMap((entry) => entry.campaign.levels.map((level) => level.id)),
  );
});

test('immutable selection prevents mutable entry clones from retargeting an existing card', async () => {
  const owner = await makeOwner();
  let calls = 0;
  const sources = await customLibrarySources([owner], {
    ...adapters,
    launch: () => {
      calls++;
    },
  });
  const binding = sources[0].entries[0];
  const originalTarget = structuredClone(binding.selection);
  assert.ok(Object.isFrozen(binding.selection));
  assert.throws(() => {
    binding.selection.levelId = 'another-map';
  }, TypeError);
  const library = createMissionLibrary(sources),
    row = library.missions[0];
  binding.level.id = owner.entries[0].campaign.levels[1].id;
  assert.deepEqual(binding.selection, originalTarget);
  assert.equal(row.runtimeId, originalTarget.levelId);
  assert.throws(() => library.launch(row), /Custom mission changed/);
  assert.equal(calls, 0);
});

test('post-registration rule, presentation and reference changes cannot reach host launch', async () => {
  for (const mutate of [
    (binding) => {
      binding.level.rules.lives++;
    },
    (binding) => {
      binding.entry.themes[0].palette.accent = '#112233';
    },
    (binding) => {
      binding.entry.campaign.levels[0] = structuredClone(binding.level);
    },
    (binding) => {
      binding.entry.campaign.id = 'another-campaign';
    },
    (binding) => {
      binding.entry.campaign = null;
    },
  ]) {
    const owner = await makeOwner();
    const sources = await customLibrarySources([owner], {
      ...adapters,
      launch: () => assert.fail('Changed binding must not reach the host'),
    });
    const library = createMissionLibrary(sources);
    mutate(sources[0].entries[0]);
    assert.throws(() => library.launch(library.missions[0]), /Custom mission changed/);
  }
});

test('asynchronous official verification cannot register a retargeted mutable clone', async () => {
  const owner = await makeOwner();
  await assert.rejects(
    customLibrarySources([owner], {
      ...adapters,
      isOfficial: async () => {
        await Promise.resolve();
        owner.entries[0].campaign.levels[0].id = 'changed-during-check';
        return false;
      },
    }),
    /Custom mission changed/,
  );
});

test('preparation rechecks mutable bindings before reporting a ready result', async () => {
  const owner = await makeOwner();
  let ready = false;
  const sources = await customLibrarySources([owner], {
    ...adapters,
    availability: () => (ready ? { state: 'ready' } : { state: 'download', bytes: 123 }),
    prepare: async (binding) => {
      await Promise.resolve();
      binding.level.id = 'changed-during-prepare';
      ready = true;
    },
  });
  const library = createMissionLibrary(sources),
    row = library.missions[0];
  await assert.rejects(library.prepare(row), /Custom mission changed/);
  assert.equal(library.availability(row).state, 'unavailable');
});

test('raw packs, wrong owners, altered campaigns and Gentle projections are rejected', async () => {
  const owner = await makeOwner();
  await assert.rejects(
    customLibrarySources([{ pack: structuredClone(owner.pack), entries: owner.entries }], adapters),
    /prepared/,
  );
  const wrong = { ...owner.entries[0], sourcePackId: 'another-pack' };
  await assert.rejects(customLibrarySources([{ ...owner, entries: [wrong] }], adapters), /owner/);
  const changed = structuredClone(owner.entries[0]);
  changed.campaign.levels[0].rules.lives++;
  await assert.rejects(
    customLibrarySources([{ ...owner, entries: [changed] }], adapters),
    /differs/,
  );
  const gentle = {
    ...owner.entries[0],
    campaign: createDifficultyContext(owner.entries[0].campaign, 'gentle').campaign,
  };
  await assert.rejects(
    customLibrarySources([{ ...owner, entries: [gentle] }], adapters),
    /differs/,
  );
  await assert.rejects(customLibrarySources([owner, owner], adapters), /once/);
});

test('host compatibility and descriptions are mandatory, never inferred from labels', async () => {
  const owner = await makeOwner();
  await assert.rejects(
    customLibrarySources([owner], { ...adapters, compatibility: undefined }),
    /adapters/,
  );
  for (const modes of [['online'], ['solo', 'solo'], true, Promise.resolve(['solo'])])
    await assert.rejects(
      customLibrarySources([owner], { ...adapters, compatibility: () => modes }),
      /compatibility/,
    );
  assert.deepEqual(
    await customLibrarySources([owner], { ...adapters, compatibility: () => [] }),
    [],
  );
  await assert.rejects(
    customLibrarySources([owner], { ...adapters, describe: () => ({ tags: ['FPV'] }) }),
    /actual rules/,
  );
  await assert.rejects(
    customLibrarySources([owner], {
      ...adapters,
      describe: () => ({ rules: 'Rules', tags: ['Journey'] }),
    }),
    /tags/,
  );
});

test('download preparation preserves the bound originals and never changes authored progress', async () => {
  const owner = await makeOwner();
  let prepared,
    ready = false;
  const library = createMissionLibrary(
    await customLibrarySources([owner], {
      ...adapters,
      availability: () => (ready ? { state: 'ready' } : { state: 'download', bytes: 123 }),
      prepare: (binding, context) => {
        prepared = binding;
        assert.equal(context.mode, 'solo');
        ready = true;
      },
    }),
  );
  const row = library.missions[0];
  await library.prepare(row);
  assert.equal(prepared.pack, owner.pack);
  assert.equal(prepared.entry, owner.entries[0]);
  assert.equal(prepared.level, owner.entries[0].campaign.levels[0]);
  assert.equal(library.progress(row, 'solo'), '');
});

test('artwork-bearing pack identities stay bounded and fingerprints include exact presentation', async () => {
  // Retained artwork fixture; the preparation decoder below is a header-only
  // test double. The browsing adapter must not request any further decoding.
  const source = JSON.parse(
    await readFile(new URL('../content/packs/fpv-arcade-r5.json', import.meta.url), 'utf8'),
  );
  const { inspectImageDataUrl } = await import('../content.mjs');
  const { pack } = await preparePack(source, {
    decodeImage: async (dataUrl) => {
      const image = inspectImageDataUrl(dataUrl);
      return { naturalWidth: image.width, naturalHeight: image.height };
    },
  });
  assert.ok(JSON.stringify(pack).length > 1000000);
  const owner = {
    pack,
    entries: pack.campaigns.map((campaign) => resolvePackCampaign(pack, campaign.id)),
  };
  const first = await customLibrarySources([owner], adapters),
    second = await customLibrarySources([owner], adapters);
  assert.equal(first[0].editionId, second[0].editionId);
  const library = createMissionLibrary(first);
  assert.ok(
    library.missions.every((row) => row.id.length <= 2048 && !row.id.includes('data:image')),
  );
});
