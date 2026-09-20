import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createPresentationDOMOwner } from '../presentation/dom-ownership.mjs';
import { createPresentationHost } from '../presentation/host.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { compilePresentation } from '../../scripts/compile-presentation.mjs';
import { hashPresentationBytes } from '../presentation/bundle.mjs';
import { FORMATS } from '../presentation/model.mjs';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';
import { createCandidateSoloHost } from '../content-design/solo-host.mjs';
import { createCandidateVersusHost } from '../content-design/versus-host.mjs';
import { createJourneyVisualThemeIdentityAdapter } from '../presentation/journey-visual-theme-identities.mjs';
import themesDocument from '../content-design/themes.json' with { type: 'json' };

function element() {
  const values = new Map(),
    attrs = new Map();
  return {
    values,
    attrs,
    children: [],
    style: {
      getPropertyValue: (key) => values.get(key)?.value ?? '',
      getPropertyPriority: (key) => values.get(key)?.priority ?? '',
      setProperty: (key, value, priority = '') => values.set(key, { value, priority }),
      removeProperty: (key) => values.delete(key),
    },
    getAttribute: (key) => attrs.get(key) ?? null,
    setAttribute: (key, value) => attrs.set(key, value),
    removeAttribute: (key) => attrs.delete(key),
  };
}

test('equal styles and attributes retain the live owner through either release order', () => {
  for (const order of [
    [0, 1],
    [1, 0],
  ]) {
    const el = element();
    el.style.setProperty('--test', 'original', 'important');
    el.setAttribute('data-icon', 'before');
    const owners = [createPresentationDOMOwner(), createPresentationDOMOwner()];
    for (const owner of owners) {
      owner.style(el, '--test', 'shared');
      owner.attribute(el, 'data-icon', 'play');
    }
    owners[order[0]].release();
    assert.equal(el.style.getPropertyValue('--test'), 'shared');
    assert.equal(el.getAttribute('data-icon'), 'play');
    owners[order[1]].release();
    assert.equal(el.style.getPropertyValue('--test'), 'original');
    assert.equal(el.style.getPropertyPriority('--test'), 'important');
    assert.equal(el.getAttribute('data-icon'), 'before');
  }
});

test('different overlapping values restore only still-live layers, never retired themes', () => {
  for (const first of ['old', 'new']) {
    const el = element(),
      a = createPresentationDOMOwner(),
      b = createPresentationDOMOwner();
    a.style(el, '--color', 'cyan');
    b.style(el, '--color', 'gold');
    (first === 'old' ? a : b).release();
    assert.equal(el.style.getPropertyValue('--color'), first === 'old' ? 'gold' : 'cyan');
    (first === 'old' ? b : a).release();
    assert.equal(el.style.getPropertyValue('--color'), '');
  }
});

test('external overrides survive cleanup and become the baseline of a later application', () => {
  const el = element(),
    a = createPresentationDOMOwner(),
    b = createPresentationDOMOwner();
  a.style(el, '--color', 'cyan');
  a.attribute(el, 'data-icon', 'play');
  el.style.setProperty('--color', 'user', 'important');
  el.setAttribute('data-icon', 'custom');
  b.style(el, '--color', 'gold');
  b.attribute(el, 'data-icon', 'pause');
  a.release();
  b.release();
  assert.equal(el.style.getPropertyValue('--color'), 'user');
  assert.equal(el.style.getPropertyPriority('--color'), 'important');
  assert.equal(el.getAttribute('data-icon'), 'custom');
});

test('old observer updates cannot steal a current layer or create repeated ownership', () => {
  const el = element(),
    a = createPresentationDOMOwner(),
    b = createPresentationDOMOwner();
  a.attribute(el, 'data-icon', 'play');
  b.attribute(el, 'data-icon', 'pause');
  for (let i = 0; i < 20; i++) a.attribute(el, 'data-icon', 'retry');
  assert.equal(el.getAttribute('data-icon'), 'pause');
  b.release();
  assert.equal(el.getAttribute('data-icon'), 'retry');
  a.release();
  a.release();
  assert.equal(el.getAttribute('data-icon'), null);
});

let fixturePromise;
function fixture() {
  return (fixturePromise ??= (async () => {
    const source = structuredClone(createDefaultThemeBundle());
    const bytes = new Uint8Array(
      await fs.readFile(
        new URL('../assets/field-kit/sprites/player-scout-compact.png', import.meta.url),
      ),
    );
    const sha256 = await hashPresentationBytes(bytes);
    const shape = source.slots.find((slot) => slot.id === 'player.scout.compact');
    // This test collection gives the action icon the same native sprite frame.
    const slot = source.slots.find((slot) => slot.id === 'icon.play');
    slot.dimensions = structuredClone(shape.dimensions);
    slot.geometry = { ...structuredClone(shape.geometry), rotorAnchors: [] };
    const asset = {
      format: FORMATS.asset,
      id: 'test.owned.icon',
      revision: 1,
      kind: 'image',
      description: 'Ownership fixture',
      provenance: {
        creator: 'Test',
        source: 'Field Kit',
        license: 'Project artwork',
        prompt: '',
        parent: null,
      },
      file: { sha256, bytes: bytes.length, mime: 'image/png', width: 32, height: 32 },
      geometry: structuredClone(slot.geometry),
      recipe: null,
      quality: { stage: 'produced', evidence: [] },
    };
    source.assets.push(asset);
    source.themes[1].bindings['icon.play'] = { id: asset.id, revision: 1 };
    return compilePresentation(source, new Map([[sha256, new Blob([bytes])]]));
  })());
}
async function loaded(accent = null) {
  const f = await fixture();
  let closes = 0;
  const files = new Map(f.files);
  if (accent) {
    const manifest = JSON.parse(new TextDecoder().decode(files.get('runtime.json')));
    manifest.resolved.tokens.cyan = accent;
    files.set('runtime.json', new TextEncoder().encode(JSON.stringify(manifest)));
  }
  const host = createPresentationHost({
    baseURL: 'https://test.invalid/compiled/',
    fetch: async (url) => new Response(files.get(url.split('/compiled/')[1])),
    decodeImage: async () => ({
      width: 32,
      height: 32,
      close() {
        closes++;
      },
    }),
    createObjectURL: () => 'blob:owned',
    revokeObjectURL() {},
  });
  await host.load();
  return { host, closes: () => closes };
}
function controls() {
  const root = element(),
    button = element();
  root.children = [button];
  root.querySelectorAll = (selector) => (selector.includes('#start-button') ? [button] : []);
  return { root, button };
}

test('real host replacement preserves all tokens and equal icon attributes when the old host closes', async () => {
  for (const order of [
    [0, 1],
    [1, 0],
  ]) {
    const pair = [await loaded(), await loaded()],
      { root, button } = controls();
    pair[0].host.apply(root);
    pair[1].host.apply(root);
    const before = new Map(root.values);
    assert.equal(button.getAttribute('data-presentation-icon'), 'play');
    pair[order[0]].host.close();
    assert.deepEqual(root.values, before);
    assert.equal(button.getAttribute('data-presentation-icon'), 'play');
    assert.equal(pair[order[1]].closes(), 0);
    pair[order[1]].host.close();
    assert.equal(root.values.size, 0);
    assert.equal(button.getAttribute('data-presentation-icon'), null);
  }
});

test('failed new token or attribute application rolls back without retiring the live host', async () => {
  for (const point of ['token', 'after-token', 'attribute']) {
    const a = await loaded(),
      b = await loaded(),
      { root, button } = controls();
    a.host.apply(root);
    const before = new Map(root.values);
    const originalStyle = root.style.setProperty,
      originalAttribute = button.setAttribute;
    // Force one changed field so the write must happen even with shared values.
    if (point.includes('token')) {
      root.style.removeProperty('--fk-font-ui');
      before.delete('--fk-font-ui');
      let count = 0;
      root.style.setProperty = (...args) => {
        if (++count === 1) {
          if (point === 'after-token') originalStyle(...args);
          throw new Error('token failure');
        }
        return originalStyle(...args);
      };
    } else {
      button.removeAttribute('data-presentation-icon');
      button.setAttribute = () => {
        throw new Error('attribute failure');
      };
    }
    assert.throws(() => b.host.apply(root), /failure/);
    root.style.setProperty = originalStyle;
    button.setAttribute = originalAttribute;
    assert.deepEqual(root.values, before);
    assert.equal(a.closes(), 0);
    assert.equal(b.closes(), 0);
    b.host.close();
    a.host.close();
  }
});

const source = createOpeningCandidates({ artwork: true });
const association = (mode) => ({ editionId: 'journey', contentThemeId: 'horizon', mode });

test('actual Solo and Versus selections resolve immutable raw owners through the guarded bridge', async () => {
  for (const mode of ['solo', 'versus']) {
    const host = (mode === 'solo' ? createCandidateSoloHost : createCandidateVersusHost)(source, {
      themes: themesDocument.themes,
    });
    const adapter = await createJourneyVisualThemeIdentityAdapter(source, { mode });
    for (const selection of mode === 'solo' ? host.entries : host.rows) {
      const level = mode === 'solo' ? selection.campaign.levels[0] : selection.level;
      const context = await adapter.prepareHostSelection({
        host,
        selection,
        level,
        association: association(mode),
      });
      const raw = host.visualThemeSelection(selection, level);
      assert(Object.isFrozen(raw));
      assert(Object.isFrozen(raw.entry));
      assert.equal(context.owner.baseCampaignKey, raw.entry.baseCampaignKey);
      assert.equal(context.owner.packId, raw.entry.sourcePackId);
      assert.throws(() => {
        raw.entry.policyVersion = 'wrong';
      }, TypeError);
    }
    host.preparer?.dispose();
  }
});

test('bridges reject foreign/cloned selections, wrong row levels and wrong-mode adapters', async () => {
  for (const mode of ['solo', 'versus']) {
    const make = mode === 'solo' ? createCandidateSoloHost : createCandidateVersusHost;
    const a = make(source, { themes: themesDocument.themes }),
      b = make(source, { themes: themesDocument.themes });
    const selection = (a.entries ?? a.rows)[0],
      level = selection.level ?? selection.campaign.levels[0];
    const adapter = await createJourneyVisualThemeIdentityAdapter(source, { mode });
    for (const foreign of [structuredClone(selection), (b.entries ?? b.rows)[0]])
      await assert.rejects(
        adapter.prepareHostSelection({
          host: a,
          selection: foreign,
          level,
          association: association(mode),
        }),
        /owned Journey/,
      );
    await assert.rejects(
      adapter.prepareHostSelection({
        host: a,
        selection,
        level: structuredClone(level),
        association: association(mode),
      }),
      /selected level/,
    );
    const other = await createJourneyVisualThemeIdentityAdapter(source, {
      mode: mode === 'solo' ? 'versus' : 'solo',
    });
    await assert.rejects(
      other.prepareHostSelection({ host: a, selection, level, association: association(mode) }),
    );
    a.preparer?.dispose();
    b.preparer?.dispose();
  }
});

test('shared campaigns preserve source-pack ownership when selected through real hosts', async () => {
  const shared = structuredClone(source);
  shared.packs[1].campaignIds = ['prologue'];
  const host = createCandidateVersusHost(shared, { themes: themesDocument.themes });
  const adapter = await createJourneyVisualThemeIdentityAdapter(shared, { mode: 'versus' });
  const a = host.rows.find(
    (row) => row.mission.packId === 'journey-opening' && row.mission.campaignId === 'prologue',
  );
  const b = host.rows.find(
    (row) =>
      row.mission.packId === 'opening-remixes' &&
      row.level.id === a.level.id &&
      row.difficulty === a.difficulty,
  );
  const prepare = (row) =>
    adapter.prepareHostSelection({
      host,
      selection: row,
      level: row.level,
      association: association('versus'),
    });
  const [first, second] = await Promise.all([prepare(a), prepare(b)]);
  assert.equal(first.owner.baseCampaignKey, second.owner.baseCampaignKey);
  assert.notEqual(first.owner.packId, second.owner.packId);
});

test('partially different real host themes keep shared values and new colors when old resources retire', async () => {
  const a = await loaded(),
    b = await loaded('#ffcc00'),
    { root, button } = controls();
  a.host.apply(root);
  const old = new Map(root.values);
  b.host.apply(root);
  const current = new Map(root.values);
  assert.notDeepEqual(current, old);
  a.host.close();
  assert.deepEqual(root.values, current);
  assert.equal(button.getAttribute('data-presentation-icon'), 'play');
  b.host.close();
  assert.equal(root.values.size, 0);
});
