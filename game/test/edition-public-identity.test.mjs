import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  editionIdentityId,
  editionPublicSlug,
  editionIdFromLocation,
  editionAppIdentity,
  validateCompanyInstallationReference,
} from '../edition-context.mjs';
import { resolveEditionSelection } from '../editions/model.mjs';
import { loadRuntimeContentProvider } from '../runtime-content-provider.mjs';
import { companyEntryHref } from '../company-entry.mjs';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import { selectEditionClosure } from '../../scripts/compile-edition.mjs';
import { createContentExecutionCatalog } from '../content-design/execution.mjs';

const stableId = 'droneaid-nl-community';
const catalog = JSON.parse(await readFile(new URL('../editions/catalog.json', import.meta.url)));

test('DroneAid is one edition with a canonical public alias and stable stored identity', () => {
  assert.equal(editionIdentityId('droneaid'), stableId);
  assert.equal(editionIdentityId(stableId), stableId);
  assert.equal(editionPublicSlug(stableId), 'droneaid');
  for (const slug of ['droneaid', stableId]) {
    assert.equal(
      editionIdFromLocation({ href: `https://example.test/editions/${slug}/app/` }),
      stableId,
    );
    assert.equal(resolveEditionSelection(catalog, { editionId: slug }).edition.id, stableId);
    const selected = selectEditionClosure(catalog, [slug]);
    assert.equal(selected.defaultEditionId, stableId);
    assert.deepEqual(
      selected.editions.map((edition) => edition.id),
      [stableId],
    );
  }
  assert.throws(() => selectEditionClosure(catalog, ['droneaid', stableId]), /unique/);
  assert.equal(catalog.editions.filter((edition) => edition.id === stableId).length, 1);
  assert.equal(
    catalog.editions.some((edition) => edition.id === 'droneaid'),
    false,
  );
  assert.equal(
    resolveEditionSelection(catalog, { editionId: 'droneaid-community' }).brand.id,
    'droneaid',
  );
  assert.equal(resolveEditionSelection(catalog, { editionId: 'droneaid' }).brand.id, 'droneaid-nl');
  assert.equal(
    resolveEditionSelection(catalog, { editionId: 'droneaid' }).brand.logoAssetId,
    'droneaid-nl-propeller',
  );
  assert.equal(
    resolveEditionSelection(catalog, { editionId: 'droneaid' }).edition.name,
    'DroneAid / LINE',
  );
  assert.ok(catalog.editions.every((edition) => edition.name.endsWith(' / LINE')));
});

test('canonical and legacy selectors resume the same profile, execution, and presentation', async () => {
  const fixture = await editionProviderFixture();
  const current = structuredClone(fixture.catalog);
  current.defaultEditionId = stableId;
  current.editions[0].id = stableId;
  current.editions[0].name = 'DroneAid Netherlands';
  fixture.files.set('game/editions/catalog.json', current);
  fixture.files.set('edition-catalog.json', current);
  const load = (selector, compiled = false) =>
    loadRuntimeContentProvider({
      locationRef: { href: `https://example.test/game/index.html?edition=${selector}` },
      documentRef: { documentElement: { dataset: compiled ? { editionId: stableId } : {} } },
      fetcher: fixture.fetcher,
    });
  const old = await load(stableId);
  const saved = new Map([[old.context('0.142.1').profileKey, 'existing progress']]);
  current.editions[0].name = 'DroneAid / LINE';
  for (const selector of ['droneaid', stableId]) {
    const renamed = await load(selector, true);
    assert.equal(renamed.editionId, stableId);
    assert.equal(renamed.route.profileKey, old.route.profileKey);
    assert.equal(renamed.route.sessionKey, old.route.sessionKey);
    assert.equal(renamed.authoredPresentationSha256, old.authoredPresentationSha256);
    assert.equal(saved.get(renamed.context('0.142.1').profileKey), 'existing progress');
    assert.deepEqual(
      createContentExecutionCatalog(renamed.route.source, { mode: 'solo' }).entries,
      createContentExecutionCatalog(old.route.source, { mode: 'solo' }).entries,
    );
    for (const parameters of [{}, { edition: stableId }, { edition: 'droneaid' }])
      assert.equal(new URL(renamed.href(parameters)).searchParams.get('edition'), 'droneaid');
  }
  const href = new URL(
    companyEntryHref(
      `https://example.test/game/company.html?edition=${stableId}&mission=first#details`,
    ),
  );
  assert.equal(href.searchParams.get('edition'), 'droneaid');
  assert.equal(href.searchParams.get('mission'), 'first');
  assert.equal(href.hash, '#details');
  await assert.rejects(load('droneaid-community', true), /another audience/);
});

test('new launcher address preserves installed PWA identity and accepts only exact old/new roots', () => {
  const base = 'https://example.test/revealline/editions/';
  assert.deepEqual(editionAppIdentity({ editionId: stableId, basePath: '/revealline/' }), {
    id: `/revealline/editions/${stableId}/`,
    start_url: '/revealline/editions/droneaid/app/',
    scope: '/revealline/editions/droneaid/',
  });
  const options = {
    editionId: stableId,
    baseURL: `${base}droneaid/app/`,
    editionRoot: '/revealline/editions/droneaid/',
  };
  const reference = (scope) => ({
    editionId: stableId,
    version: '0.142.1',
    scope,
    entry: 'game/company.html',
  });
  for (const slug of ['droneaid', stableId]) {
    const value = reference(`${base}${slug}/releases/v0.142.1/site/`);
    assert.deepEqual(validateCompanyInstallationReference(value, options), value);
  }
  for (const scope of [
    `${base}droneaid-community/releases/v0.142.1/site/`,
    `${base}droneaid/releases/v0.141.0/site/`,
    'https://elsewhere.test/revealline/editions/droneaid/releases/v0.142.1/site/',
    'https://example.test/other/editions/droneaid/releases/v0.142.1/site/',
  ])
    assert.throws(
      () => validateCompanyInstallationReference(reference(scope), options),
      /matching/,
    );
  assert.throws(
    () =>
      validateCompanyInstallationReference(
        { ...reference('../releases/v0.142.1/site/'), editionId: 'droneaid' },
        options,
      ),
    /identity/,
  );
});
