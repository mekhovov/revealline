import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { canonicalJSON } from '../data-json.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { validateCoopPack } from '../coop/recipes.mjs';
import { prepareTeamVisualThemeContext } from '../presentation/visual-theme-identities.mjs';
import {
  createVisualThemeCatalogue,
  snapshotVisualThemeContext,
  VISUAL_THEME_CATALOGUE_FORMAT,
} from '../presentation/visual-theme-catalogue.mjs';
import {
  snapshotVisualThemePin,
  validateVisualThemePinForContent,
  VISUAL_THEME_PIN_FORMAT,
} from '../presentation/visual-theme-pin.mjs';

const sha = (value) => createHash('sha256').update(canonicalJSON(value)).digest('hex');
const clone = structuredClone;
const association = { editionId: 'fpv', contentThemeId: 'fpv', mode: 'team' };
const request = (pack, level = pack.levels[0]) => ({ pack, level, association });
function fixture() {
  const pack = clone(COOP_STARTER_PACK);
  pack.id = 'historical-team';
  return pack;
}
const presentation = {
  source: { id: 'field-kit', revision: 38 },
  theme: { id: 'fpv', revision: 38 },
  collection: null,
  sha256: 'a'.repeat(64),
};
const selection = { id: 'retained-field-kit', revision: 1 };
function catalogue(content) {
  return createVisualThemeCatalogue({
    format: VISUAL_THEME_CATALOGUE_FORMAT,
    id: 'team-retained',
    revision: 1,
    entries: [{ ...selection, name: 'Retained Field Kit', presentation, coverage: [content] }],
  });
}

test('Team level IDs and revisions retain every accepted boundary without trimming or coercion', async () => {
  for (const id of ['x', ' ', ' Field \n', '\u0000field', 'Політ', 'L'.repeat(100)]) {
    for (const revision of [
      1,
      1000001,
      1e20,
      Number.MAX_VALUE,
      '2',
      ' ',
      '\t',
      ' r ',
      'r'.repeat(100),
    ]) {
      const pack = fixture();
      pack.levels[0].id = id;
      pack.levels[0].revision = revision;
      assert.equal(validateCoopPack(pack).valid, true);
      const before = clone(pack);
      const content = await prepareTeamVisualThemeContext(request(pack));
      assert.deepEqual(content.level, { id, revision, sha256: sha(pack.levels[0]) });
      assert.equal(content.owner.sha256, sha(pack));
      assert.deepEqual(pack, before);
      assert.equal(Object.isFrozen(content.level), true);
    }
  }
});

test('catalogue and retained pin JSON round trips preserve unusual Team identities and exact types', async () => {
  const pack = fixture();
  pack.levels[0].id = ' Field ' + 'x'.repeat(93);
  pack.levels[0].revision = ' '.repeat(100);
  const content = await prepareTeamVisualThemeContext(request(pack));
  const owner = catalogue(content);
  assert.equal(owner.resolve(selection, content).kind, 'compatible');
  const restored = createVisualThemeCatalogue(JSON.parse(JSON.stringify(owner.snapshot())));
  assert.deepEqual(restored.snapshot(), owner.snapshot());
  const pin = snapshotVisualThemePin({
    format: VISUAL_THEME_PIN_FORMAT,
    content,
    selection,
    presentation,
  });
  assert.deepEqual(validateVisualThemePinForContent(JSON.parse(JSON.stringify(pin)), content), pin);
  for (const revision of [2, '2', ' 2 ']) {
    pack.levels[0].revision = revision;
    const other = await prepareTeamVisualThemeContext(request(pack));
    assert.equal(restored.resolve(selection, other).kind, 'unsupported');
    assert.throws(() => validateVisualThemePinForContent(pin, other), /different accepted content/);
  }
});

test('numeric and string Team revisions yield distinct owner and level hashes', async () => {
  const contexts = [];
  for (const revision of [2, '2', ' 2 ']) {
    const pack = fixture();
    pack.levels[0].revision = revision;
    contexts.push(await prepareTeamVisualThemeContext(request(pack)));
  }
  assert.equal(new Set(contexts.map((c) => c.level.sha256)).size, 3);
  assert.equal(new Set(contexts.map((c) => c.owner.sha256)).size, 3);
});

test('Team pack identities retain exact accepted pack domains, including foundation whitespace revisions', async () => {
  for (const id of ['a', 'a' + '-'.repeat(79)]) {
    const pack = fixture();
    pack.id = id;
    pack.revision = 1000000;
    const content = await prepareTeamVisualThemeContext(request(pack));
    assert.equal(content.owner.id, id);
    assert.equal(content.owner.revision, 1000000);
  }
  for (const revision of [' ', ' r ', 'r'.repeat(80)]) {
    const pack = fixture();
    pack.version = 'revealline-coop-pack.v2';
    pack.ruleset = 'revealline-coop.v4';
    pack.revision = revision;
    for (const level of pack.levels) {
      level.version = 'revealline-coop-level.v2';
      level.journeyDifficulty = 'standard';
    }
    const validation = validateCoopPack(pack);
    assert.equal(validation.valid, true, validation.errors.join('; '));
    const content = await prepareTeamVisualThemeContext(request(pack));
    assert.equal(content.owner.revision, revision);
    assert.equal(content.owner.sha256, sha(pack));
  }
});

test('invalid historical inputs and out-of-domain detached Team contexts remain rejected', async () => {
  for (const [field, values] of [
    ['id', ['', 'x'.repeat(101), null, 1]],
    ['revision', ['', 'r'.repeat(101), 0, -1, 1.5, Infinity, NaN, null]],
  ]) {
    for (const value of values) {
      const pack = fixture();
      pack.levels[0][field] = value;
      assert.equal(validateCoopPack(pack).valid, false);
      await assert.rejects(prepareTeamVisualThemeContext(request(pack)));
    }
  }
  const good = await prepareTeamVisualThemeContext(request(fixture()));
  for (const [field, values] of [
    ['id', ['', 'A', 'a_b', 'a'.repeat(81)]],
    ['revision', ['', 'r'.repeat(81), 0, -1, 1000001, 1.5]],
  ]) {
    for (const value of values) {
      const altered = clone(good);
      altered.owner[field] = value;
      assert.throws(() => snapshotVisualThemeContext(altered));
    }
  }
  const badHistorical = fixture();
  badHistorical.revision = '2';
  await assert.rejects(
    prepareTeamVisualThemeContext(request(badHistorical)),
    /Invalid Team theme owner/,
  );
});

test('same-ID changed levels cannot masquerade as an accepted member and other-level changes alter full ownership', async () => {
  const pack = fixture();
  pack.levels[0].id = ' Imported map ';
  pack.levels[0].revision = 1e20;
  const content = await prepareTeamVisualThemeContext(request(pack));
  const wrong = clone(pack.levels[0]);
  wrong.name += ' changed';
  await assert.rejects(
    prepareTeamVisualThemeContext(request(pack, wrong)),
    /differs from its accepted content owner/,
  );
  const changed = clone(pack);
  changed.levels[1].name += ' changed';
  const next = await prepareTeamVisualThemeContext(request(changed));
  assert.equal(content.level.sha256, next.level.sha256);
  assert.notEqual(content.owner.sha256, next.owner.sha256);
  assert.equal(catalogue(content).resolve(selection, next).kind, 'unsupported');
});

test('Solo, Versus and Journey retain their previous strict level and revision domains', async () => {
  const base = await prepareTeamVisualThemeContext(request(fixture()));
  for (const mode of ['solo', 'versus', 'team']) {
    const context = clone(base);
    context.mode = mode;
    context.owner =
      mode === 'team'
        ? {
            kind: 'journey',
            projectId: 'project',
            projectRevision: 'r1',
            projectSha256: 'b'.repeat(64),
            packId: 'pack',
            campaignId: 'campaign',
            baseCampaignKey: 'base',
            policyId: 'policy',
          }
        : { kind: 'campaign', baseCampaignKey: 'base' };
    if (mode === 'team') context.level.simulationIdentity = 'a'.repeat(16);
    assert.doesNotThrow(() => snapshotVisualThemeContext(context));
    for (const [key, value] of [
      ['id', ' Field '],
      ['revision', ' '],
      ['revision', 'r'.repeat(81)],
      ['revision', 1e20],
    ]) {
      const invalid = clone(context);
      invalid.level[key] = value;
      assert.throws(() => snapshotVisualThemeContext(invalid));
    }
  }
});

test('unusual Team identity copies are owned before async hashing and cancellation remains effective', async () => {
  const pack = fixture();
  pack.levels[0].id = ' Flight ';
  pack.levels[0].revision = ' '.repeat(100);
  const expected = await prepareTeamVisualThemeContext(request(pack));
  const pending = prepareTeamVisualThemeContext(request(pack));
  pack.levels[0].id = 'replaced';
  assert.deepEqual(await pending, expected);
  const controller = new AbortController();
  const cancelled = prepareTeamVisualThemeContext(request(fixture()), {
    signal: controller.signal,
  });
  controller.abort();
  await assert.rejects(cancelled, { name: 'AbortError' });
});
