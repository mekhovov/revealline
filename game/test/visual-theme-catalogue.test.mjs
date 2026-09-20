import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VISUAL_THEME_CATALOGUE_FORMAT,
  createVisualThemeCatalogue,
  snapshotVisualThemeContext,
} from '../presentation/visual-theme-catalogue.mjs';

const sha = (n) => n.repeat(64);
const target = (mode = 'solo') => ({
  editionId: 'fpv',
  contentThemeId: 'fpv',
  mode,
  owner:
    mode === 'team'
      ? { kind: 'team-pack', id: 'relay-rescue-starter', revision: 2, sha256: sha('a') }
      : {
          kind: 'campaign',
          baseCampaignKey: '["xonix-campaign.v2","first-signal","1","authored-hash"]',
        },
  level: {
    id: mode === 'team' ? 'first-connection' : 'first-signal',
    revision: mode === 'team' ? 2 : '1',
    sha256: sha('b'),
  },
});
const recipe = () => ({
  format: VISUAL_THEME_CATALOGUE_FORMAT,
  id: 'reviewed-visual-themes',
  revision: 1,
  entries: [
    {
      id: 'field-kit',
      revision: 1,
      name: 'Field Kit',
      presentation: {
        source: { id: 'field-kit', revision: 32 },
        theme: { id: 'fpv', revision: 32 },
        collection: null,
        sha256: sha('c'),
      },
      coverage: [target(), target('versus'), target('team')],
    },
  ],
});
const selection = { id: 'field-kit', revision: 1 };
const requiredSlots = ['actor.player', 'scene.reveal', 'effect.warning'];
const declaration = (source = recipe()) => ({
  ...structuredClone(source.entries[0].presentation),
  slots: [...requiredSlots],
});

test('campaign style is explicit, compatible themes resolve independently across three modes', () => {
  const catalogue = createVisualThemeCatalogue(recipe());
  for (const mode of ['solo', 'versus', 'team']) {
    const context = target(mode);
    assert.equal(catalogue.resolve(null, context).kind, 'campaign-style');
    const match = catalogue.resolve(selection, context);
    assert.equal(match.kind, 'compatible');
    assert.equal(catalogue.verifyPresentationIdentity(match, declaration(), requiredSlots), match);
  }
});

test('same name or level ID never grants compatibility to another owner, edition, theme, revision or content hash', () => {
  const catalogue = createVisualThemeCatalogue(recipe());
  const changes = [
    (v) => {
      v.editionId = 'droneaid';
    },
    (v) => {
      v.contentThemeId = 'ukraine';
    },
    (v) => {
      v.owner.baseCampaignKey += '-new-content';
    },
    (v) => {
      v.level.revision = '2';
    },
    (v) => {
      v.level.sha256 = sha('d');
    },
  ];
  for (const change of changes) {
    const context = target();
    change(context);
    const result = catalogue.resolve(selection, context);
    assert.equal(result.kind, 'unsupported');
    assert.equal(result.alternative, 'campaign-style');
    assert.equal(Object.hasOwn(result, 'presentation'), false);
  }
  const team = target('team');
  team.owner.sha256 = sha('e');
  assert.equal(catalogue.resolve(selection, team).kind, 'unsupported');
});

test('mode coverage is explicit and new revisions never replace an unavailable retained reference', () => {
  const source = recipe();
  source.entries[0].coverage = [target()];
  const newer = structuredClone(source.entries[0]);
  newer.revision = 2;
  newer.presentation.theme.revision = 33;
  newer.presentation.sha256 = sha('d');
  source.entries.push(newer);
  const catalogue = createVisualThemeCatalogue(source);
  assert.equal(catalogue.resolve(selection, target('versus')).kind, 'unsupported');
  assert.equal(catalogue.resolve(selection, target()).presentation.theme.revision, 32);
  assert.equal(
    catalogue.resolve({ id: 'field-kit', revision: 2 }, target()).presentation.theme.revision,
    33,
  );
  assert.equal(catalogue.resolve({ id: 'field-kit', revision: 3 }, target()).kind, 'unavailable');
  assert.throws(() => catalogue.resolve({ id: 'field-kit' }, target()), /incomplete/);
});

test('wrong declared manifest hash or any exact presentation reference require recovery, not fallback', () => {
  const catalogue = createVisualThemeCatalogue(recipe());
  const match = catalogue.resolve(selection, target());
  for (const change of [
    (v) => {
      v.sha256 = sha('d');
    },
    (v) => {
      v.source.revision++;
    },
    (v) => {
      v.theme.revision++;
    },
    (v) => {
      v.collection = { id: 'another-collection', revision: 1 };
    },
  ]) {
    const loaded = declaration();
    change(loaded);
    assert.throws(
      () => catalogue.verifyPresentationIdentity(match, loaded, requiredSlots),
      /exact declared/,
    );
  }
});

test('required mode roles cannot disappear or be replaced by merely similar slot names', () => {
  const catalogue = createVisualThemeCatalogue(recipe());
  const match = catalogue.resolve(selection, target('team'));
  const loaded = declaration();
  loaded.slots = ['actor.player', 'scene.reveal', 'effect.scan'];
  assert.throws(
    () => catalogue.verifyPresentationIdentity(match, loaded, requiredSlots),
    /effect.warning/,
  );
  assert.throws(() => catalogue.verifyPresentationIdentity(match, declaration(), []), /nonempty/);
  assert.throws(
    () =>
      catalogue.verifyPresentationIdentity(match, declaration(), ['actor.player', 'actor.player']),
    /unique/,
  );
});

test('declarations cannot qualify unsupported, forged or another catalogue’s matches', () => {
  const a = createVisualThemeCatalogue(recipe());
  const b = createVisualThemeCatalogue(recipe());
  const match = a.resolve(selection, target());
  assert.throws(
    () => b.verifyPresentationIdentity(match, declaration(), requiredSlots),
    /this catalogue/,
  );
  assert.throws(
    () => a.verifyPresentationIdentity(structuredClone(match), declaration(), requiredSlots),
    /this catalogue/,
  );
  assert.throws(
    () => a.verifyPresentationIdentity(a.resolve(null, target()), declaration(), requiredSlots),
    /this catalogue/,
  );
});

test('input ownership, immutable snapshots and exact numeric/string revisions survive caller edits', () => {
  const source = recipe();
  const catalogue = createVisualThemeCatalogue(source);
  source.entries[0].presentation.sha256 = sha('f');
  source.entries[0].coverage.length = 0;
  const request = target('team');
  const match = catalogue.resolve(selection, request);
  request.level.revision = 9;
  assert.equal(match.content.level.revision, 2);
  assert.equal(match.presentation.sha256, sha('c'));
  assert.throws(() => {
    catalogue.snapshot().entries[0].coverage.length = 0;
  }, TypeError);
  const stringRevision = target('team');
  stringRevision.level.revision = '2';
  assert.equal(catalogue.resolve(selection, stringRevision).kind, 'unsupported');
});

test('catalogue updates retain exact historical entries and introduce changes under new revisions', () => {
  const source = recipe();
  const previous = createVisualThemeCatalogue(source);
  assert.throws(() => createVisualThemeCatalogue(source, { previous }), /Advance/);
  source.revision++;
  const second = structuredClone(source.entries[0]);
  second.revision = 2;
  second.presentation.sha256 = sha('d');
  source.entries.push(second);
  const current = createVisualThemeCatalogue(source, { previous });
  assert.equal(current.resolve(selection, target()).presentation.sha256, sha('c'));
  source.entries[0].name = 'Rewritten history';
  assert.throws(() => createVisualThemeCatalogue(source, { previous }), /historical/);
  source.entries.shift();
  assert.throws(() => createVisualThemeCatalogue(source, { previous }), /historical/);
  assert.throws(
    () => createVisualThemeCatalogue(recipe(), { previous: previous.snapshot() }),
    /validated owner/,
  );
});

test('closed schemas reject ambiguity, empty coverage and incompatible identity kinds', () => {
  const changes = [
    (v) => {
      v.entries.push(structuredClone(v.entries[0]));
    },
    (v) => {
      v.entries[0].coverage.push(target());
    },
    (v) => {
      v.entries[0].coverage = [];
    },
    (v) => {
      delete v.entries[0].presentation.collection;
    },
    (v) => {
      v.entries[0].presentation.sha256 = 'latest';
    },
    (v) => {
      v.entries[0].coverage[0].owner = target('team').owner;
    },
    (v) => {
      v.entries[0].coverage[2].owner = target().owner;
    },
    (v) => {
      v.entries[0].coverage[0].level.sha256 = 'same-name';
    },
    (v) => {
      v.entries[0].approved = true;
    },
    (v) => {
      v.entries[0].presentation.url = 'https://unreviewed.test/theme';
    },
  ];
  for (const change of changes) {
    const source = recipe();
    change(source);
    assert.throws(() => createVisualThemeCatalogue(source));
  }
  assert.throws(
    () => snapshotVisualThemeContext({ ...target(), mode: 'deathmatch' }),
    /Unsupported/,
  );
});

test('hostile JSON, getters and oversize catalogues fail before executing or retaining caller data', () => {
  let called = false;
  const hostile = {
    get format() {
      called = true;
      return VISUAL_THEME_CATALOGUE_FORMAT;
    },
  };
  assert.throws(() => createVisualThemeCatalogue(hostile), /accessors/);
  assert.equal(called, false);
  assert.throws(() => createVisualThemeCatalogue('{"__proto__":{}}'), /Forbidden/);
  const source = recipe();
  source.entries = Array.from({ length: 129 }, () => source.entries[0]);
  assert.throws(() => createVisualThemeCatalogue(source), /Too many/);
  const empty = recipe();
  empty.entries = [];
  assert.equal(createVisualThemeCatalogue(empty).resolve(selection, target()).kind, 'unavailable');
});

test('accepted legacy identity text is preserved exactly, never trimmed into another owner', () => {
  const source = recipe();
  source.entries[0].coverage[0].owner.baseCampaignKey = ' exact legacy owner ';
  source.entries[0].coverage[0].level.revision = ' 1 ';
  const expected = structuredClone(source.entries[0].coverage[0]);
  const catalogue = createVisualThemeCatalogue(source);
  assert.equal(catalogue.resolve(selection, expected).kind, 'compatible');
  expected.owner.baseCampaignKey = expected.owner.baseCampaignKey.trim();
  assert.equal(catalogue.resolve(selection, expected).kind, 'unsupported');
});
