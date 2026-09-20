import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createPresentationHost } from '../presentation/host.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { FORMATS } from '../presentation/model.mjs';
import { compilePresentation } from '../../scripts/compile-presentation.mjs';
import { hashPresentationBytes } from '../presentation/bundle.mjs';
import {
  createVisualThemeCatalogue,
  VISUAL_THEME_CATALOGUE_FORMAT,
} from '../presentation/visual-theme-catalogue.mjs';
import {
  prepareVisualThemeLease,
  prepareRetainedVisualThemeLease,
} from '../presentation/visual-theme-lease.mjs';

const baseURL = 'https://game.test/releases/v1/game/presentation/compiled/';
let fixturePromise;
function fixture() {
  fixturePromise ??= (async () => {
    const document = structuredClone(createDefaultThemeBundle());
    const bytes = new Uint8Array(
      await fs.readFile(
        new URL('../assets/field-kit/sprites/player-scout-compact.png', import.meta.url),
      ),
    );
    const hash = await hashPresentationBytes(bytes);
    const slot = document.slots.find((s) => s.id === 'player.scout.compact');
    const asset = {
      format: FORMATS.asset,
      id: 'host.test.sprite',
      revision: 1,
      kind: 'image',
      description: 'Exact generated native pixel sprite used as a host fixture.',
      provenance: {
        creator: 'Test',
        source: 'Field Kit pixel source',
        license: 'Project artwork',
        prompt: '',
        parent: null,
      },
      file: { sha256: hash, bytes: bytes.length, mime: 'image/png', width: 32, height: 32 },
      geometry: structuredClone(slot.geometry),
      recipe: null,
      quality: { stage: 'produced', evidence: [] },
    };
    document.assets.push(asset);
    document.themes[1].bindings[slot.id] = { id: asset.id, revision: 1 };
    const compiled = await compilePresentation(document, new Map([[hash, new Blob([bytes])]]));
    return {
      ...compiled,
      hash,
      bytes,
      manifest: JSON.parse(new TextDecoder().decode(compiled.files.get('runtime.json'))),
    };
  })();
  return fixturePromise;
}
function environment(f, overrides = {}) {
  const requests = [],
    decoded = [],
    urls = [],
    revoked = [];
  let serial = 0;
  const host = createPresentationHost({
    baseURL,
    fetch: async (url, options) => {
      requests.push({ url, options });
      const key = url.slice(baseURL.length),
        bytes = f.files.get(key);
      return bytes ? new Response(bytes) : new Response(null, { status: 404 });
    },
    decodeImage: async () => {
      const image = {
        width: 32,
        height: 32,
        closes: 0,
        close() {
          this.closes++;
        },
      };
      decoded.push(image);
      return image;
    },
    createObjectURL: (blob) => {
      const url = `blob:host-${serial++}`;
      urls.push({ url, blob });
      return url;
    },
    revokeObjectURL: (url) => revoked.push(url),
    ...overrides,
  });
  return { host, requests, decoded, urls, revoked };
}

const content = {
  editionId: 'field-kit',
  contentThemeId: 'fpv',
  mode: 'solo',
  owner: { kind: 'campaign', baseCampaignKey: 'accepted/1/original' },
  level: { id: 'first-signal', revision: '1', sha256: 'b'.repeat(64) },
};
async function setup(change = () => {}) {
  const f = await fixture();
  const compiled = f.manifest;
  const source = {
    format: VISUAL_THEME_CATALOGUE_FORMAT,
    id: 'approved',
    revision: 1,
    entries: [
      {
        id: 'field-kit',
        revision: 1,
        name: 'Field Kit',
        coverage: [content],
        presentation: {
          source: compiled.source,
          theme: { id: compiled.resolved.theme.id, revision: compiled.resolved.theme.revision },
          collection: compiled.resolved.collection,
          sha256: await hashPresentationBytes(f.files.get('runtime.json')),
        },
      },
    ],
  };
  change(source);
  return {
    f,
    request: {
      catalogue: createVisualThemeCatalogue(source),
      selection: { id: 'field-kit', revision: 1 },
      content,
      requiredSlots: ['player.scout.compact'],
    },
  };
}

import {
  snapshotVisualThemePin,
  validateVisualThemePinForContent,
  VISUAL_THEME_PIN_FORMAT,
} from '../presentation/visual-theme-pin.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { createContentExecutionCatalog } from '../content-design/execution.mjs';
import { createJourneyVisualThemeIdentityAdapter } from '../presentation/journey-visual-theme-identities.mjs';

async function accepted() {
  const { f, request } = await setup(),
    env = environment(f);
  const lease = await prepareVisualThemeLease(request, { createHost: () => env.host });
  return { f, request, env, lease, pin: lease.pin() };
}

test('a verified live lease emits a bounded immutable exact pin that survives JSON serialization', async () => {
  const { lease, pin } = await accepted();
  assert.equal(pin.format, VISUAL_THEME_PIN_FORMAT);
  assert.equal(pin.presentation.sha256, lease.snapshot.manifestSha256);
  assert.deepEqual(pin.content, lease.match.content);
  assert.deepEqual(pin.selection, lease.match.selection);
  assert.deepEqual(snapshotVisualThemePin(JSON.stringify(pin)), pin);
  assert(Object.isFrozen(pin.presentation.theme));
  assert(Object.isFrozen(pin.content.owner));
  assert.throws(() => {
    pin.presentation.theme.revision++;
  }, TypeError);
  lease.release();
  assert.throws(() => lease.pin(), /released/);
});

test('restoration uses the retained selection and rechecks original manifest bytes', async () => {
  const { f, request, lease, pin } = await accepted();
  lease.release();
  const env = environment(f);
  const restored = await prepareRetainedVisualThemeLease(
    {
      pin: JSON.stringify(pin),
      catalogue: request.catalogue,
      content,
      requiredSlots: request.requiredSlots,
    },
    { createHost: () => env.host },
  );
  assert.equal(restored.kind, 'prepared-presentation');
  assert.deepEqual(restored.pin(), pin);
  assert.equal(env.decoded[0].closes, 0);
  restored.release();
  assert.equal(env.decoded[0].closes, 1);
});

test('changed accepted owner, mission, revision, hash or mode fails before acquiring any host', async () => {
  const { lease, pin, request } = await accepted();
  lease.release();
  for (const change of [
    (value) => {
      value.owner.baseCampaignKey = 'other/1/key';
    },
    (value) => {
      value.level.id = 'other-mission';
    },
    (value) => {
      value.level.revision = '2';
    },
    (value) => {
      value.level.sha256 = 'c'.repeat(64);
    },
    (value) => {
      value.mode = 'versus';
    },
    (value) => {
      value.editionId = 'another-edition';
    },
  ]) {
    const actual = structuredClone(content);
    change(actual);
    await assert.rejects(
      prepareRetainedVisualThemeLease(
        {
          pin,
          catalogue: request.catalogue,
          content: actual,
          requiredSlots: request.requiredSlots,
        },
        {
          createHost: () => {
            throw new Error('Must not acquire.');
          },
        },
      ),
      /different accepted content/,
    );
  }
});

test('a same-reference catalogue rewrite cannot override a retained presentation declaration', async () => {
  const { lease, pin, request } = await accepted();
  lease.release();
  for (const change of [
    (p) => {
      p.sha256 = '0'.repeat(64);
    },
    (p) => {
      p.theme.revision++;
    },
    (p) => {
      p.source.revision++;
    },
    (p) => {
      p.collection = { id: 'another', revision: 1 };
    },
  ]) {
    const source = structuredClone(request.catalogue.snapshot());
    change(source.entries[0].presentation);
    const catalogue = createVisualThemeCatalogue(source);
    await assert.rejects(
      prepareRetainedVisualThemeLease(
        { pin, catalogue, content, requiredSlots: request.requiredSlots },
        {
          createHost: () => {
            throw new Error('Must not acquire.');
          },
        },
      ),
      /exact catalogue revision/,
    );
  }
});

test('missing or unsupported exact retained selections never fall forward to another revision', async () => {
  const { lease, pin, request } = await accepted();
  lease.release();
  const source = structuredClone(request.catalogue.snapshot());
  source.entries[0].revision = 2;
  const createHost = () => {
    throw new Error('Must not acquire.');
  };
  const missing = await prepareRetainedVisualThemeLease(
    {
      pin,
      catalogue: createVisualThemeCatalogue(source),
      content,
      requiredSlots: request.requiredSlots,
    },
    { createHost },
  );
  assert.equal(missing.kind, 'unavailable');
  assert.deepEqual(missing.selection, pin.selection);
  source.entries[0].revision = 1;
  source.entries[0].coverage[0].level.revision = 'other';
  const unsupported = await prepareRetainedVisualThemeLease(
    {
      pin,
      catalogue: createVisualThemeCatalogue(source),
      content,
      requiredSlots: request.requiredSlots,
    },
    { createHost },
  );
  assert.equal(unsupported.kind, 'unsupported');
});

test('retained byte failure cannot replace another independently owned live attempt', async () => {
  const { f, lease, pin, request, env } = await accepted();
  const files = new Map(f.files);
  files.set('runtime.json', new TextEncoder().encode(JSON.stringify(f.manifest, null, 2)));
  const stage = environment({ ...f, files });
  await assert.rejects(
    prepareRetainedVisualThemeLease(
      { pin, catalogue: request.catalogue, content, requiredSlots: request.requiredSlots },
      { createHost: () => stage.host },
    ),
    /pinned release/,
  );
  assert.equal(env.host.current(), lease.snapshot);
  assert.equal(env.decoded[0].closes, 0);
  assert.equal(stage.decoded.length, 0);
  lease.release();
});

test('pin parser rejects ambiguous revisions, omitted fields, hostile records and unsupported versions', async () => {
  const { lease, pin } = await accepted();
  lease.release();
  for (const change of [
    (p) => {
      p.format = 'revealline-flight-pictures.v2';
    },
    (p) => {
      p.selection = null;
    },
    (p) => {
      p.selection.revision = 'latest';
    },
    (p) => {
      p.presentation.sha256 = 'A'.repeat(64);
    },
    (p) => {
      delete p.presentation.collection;
    },
    (p) => {
      p.presentation.url = 'https://other.example/';
    },
    (p) => {
      p.unsupported = true;
    },
  ]) {
    const bad = structuredClone(pin);
    change(bad);
    assert.throws(() => snapshotVisualThemePin(bad));
  }
  let invoked = false;
  const bad = structuredClone(pin);
  Object.defineProperty(bad, 'selection', {
    enumerable: true,
    get() {
      invoked = true;
      return pin.selection;
    },
  });
  assert.throws(() => snapshotVisualThemePin(bad));
  assert.equal(invoked, false);
  assert.throws(() => snapshotVisualThemePin(' '.repeat(17000)));
});

test('Retry retains standard authored Journey identity across all modes and difficulty presets', async () => {
  const source = createStarterProject('retained-theme-journey');
  source.maps[0].spawns.push({ id: 'island', x: 32.5, y: 17.5 });
  source.missions[0].modes = ['solo', 'versus', 'team'];
  source.missions[0].team = { format: 'TeamMissionV1', spawnIds: ['home', 'island'] };
  source.missions[0].design.difficulty.coordination = 1;
  const { f, request } = await setup();
  for (const mode of ['solo', 'versus', 'team']) {
    const identity = await createJourneyVisualThemeIdentityAdapter(source, { mode });
    const executions = createContentExecutionCatalog(source, { mode });
    const standard = executions.entries.find((e) => e.difficulty === 'standard');
    const association = { editionId: 'field-kit', contentThemeId: 'fpv', mode };
    const current = await identity.prepare({
      entry: standard,
      level: standard.campaign.levels[0],
      association,
    });
    const catalogSource = structuredClone(request.catalogue.snapshot());
    catalogSource.entries[0].coverage = [current];
    const catalogue = createVisualThemeCatalogue(catalogSource),
      env = environment(f);
    const lease = await prepareVisualThemeLease(
      { ...request, catalogue, content: current },
      { createHost: () => env.host },
    );
    const pin = lease.pin();
    lease.release();
    for (const entry of executions.entries) {
      const context = await identity.prepare({
        entry,
        level: entry.campaign.levels[0],
        association,
      });
      assert.deepEqual(validateVisualThemePinForContent(pin, context), pin);
      const stage = environment(f);
      const retry = await prepareRetainedVisualThemeLease(
        { pin, catalogue, content: context, requiredSlots: request.requiredSlots },
        { createHost: () => stage.host },
      );
      assert.deepEqual(retry.pin(), pin);
      retry.release();
    }
  }
});

test('aborted restoration has no host side effect and parsed pins own caller data', async () => {
  const { lease, pin, request } = await accepted();
  lease.release();
  const source = structuredClone(pin),
    owned = snapshotVisualThemePin(source);
  source.presentation.theme.id = 'another-theme';
  assert.equal(owned.presentation.theme.id, pin.presentation.theme.id);
  const stop = new AbortController();
  stop.abort();
  await assert.rejects(
    prepareRetainedVisualThemeLease(
      { pin, catalogue: request.catalogue, content, requiredSlots: request.requiredSlots },
      {
        signal: stop.signal,
        createHost: () => {
          throw new Error('Must not acquire.');
        },
      },
    ),
    { name: 'AbortError' },
  );
});

test('historical Team pack and level revisions remain numeric in the portable pin', async () => {
  const { COOP_STARTER_PACK } = await import('../coop/library.mjs');
  const { prepareTeamVisualThemeContext } = await import(
    '../presentation/visual-theme-identities.mjs'
  );
  const actual = await prepareTeamVisualThemeContext({
    pack: COOP_STARTER_PACK,
    level: COOP_STARTER_PACK.levels[0],
    association: { editionId: 'field-kit', contentThemeId: 'fpv', mode: 'team' },
  });
  const { f, request } = await setup();
  const source = structuredClone(request.catalogue.snapshot());
  source.entries[0].coverage = [actual];
  const catalogue = createVisualThemeCatalogue(source),
    env = environment(f);
  const lease = await prepareVisualThemeLease(
    { ...request, catalogue, content: actual },
    { createHost: () => env.host },
  );
  const pin = snapshotVisualThemePin(JSON.stringify(lease.pin()));
  assert.equal(pin.content.owner.revision, 2);
  assert.equal(pin.content.level.revision, 2);
  assert.deepEqual(validateVisualThemePinForContent(pin, actual), pin);
  lease.release();
});
