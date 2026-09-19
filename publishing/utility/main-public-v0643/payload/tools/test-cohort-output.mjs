import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { summarizeCatalogCohorts } from './catalog-cohorts.mjs';
const output = (current, retained) => JSON.parse(JSON.stringify(summarizeCatalogCohorts(current, retained)));
const row = (version) => ({ version });
assert.deepEqual(output([row('v0.64.3')], []), {
  retainedCatalogAuthorities: 0, newCatalogAuthorities: 1, totalCatalogAuthorities: 1,
  retainedCatalogVersions: [], newCatalogVersions: ['v0.64.3'], historicalHTTPBodyPreservationClaimed: false,
});
assert.deepEqual(output([row('v0.64.3'), row('v0.61.4'), row('v0.61.5')], [row('v0.61.5'), row('v0.61.4')]), {
  retainedCatalogAuthorities: 2, newCatalogAuthorities: 1, totalCatalogAuthorities: 3,
  retainedCatalogVersions: ['v0.61.4', 'v0.61.5'], newCatalogVersions: ['v0.64.3'], historicalHTTPBodyPreservationClaimed: false,
});
const retained = JSON.parse(await readFile(new URL('./retained-catalog.json', import.meta.url))).releases;
const exact = output([...retained, row('v0.64.3')], retained);
assert.equal(exact.retainedCatalogAuthorities, retained.length);
assert.equal(exact.totalCatalogAuthorities, retained.length + 1);
assert.equal(exact.newCatalogAuthorities, 1);
assert.deepEqual(exact.newCatalogVersions, ['v0.64.3']);
assert.equal(exact.historicalHTTPBodyPreservationClaimed, false);
assert.throws(() => output([row('v0.64.3')], [row('v0.61.5')]), /missing/);
assert.throws(() => output([row('v0.64.3'), row('v0.64.3')], []), /unique/);
assert.throws(() => output([row('v0.64.3')], [row('v0.64.3'), row('v0.64.3')]), /unique/);
assert.throws(() => output([row('unknown')], []), /valid/);
console.log(JSON.stringify({ status: 'CATALOG_COHORT_OUTPUT_CHECK_PASS', initialPriorAuthorities: 0,
  actualRetainedAuthorities: retained.length, syntheticAddedAuthorities: exact.newCatalogAuthorities,
  actualPublisherConfigurationCreated: false, realNetworkRequests: 0, publicAcceptance: false }));
