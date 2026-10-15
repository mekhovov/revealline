/** Real paired manifests and presentation identity; no browser/store writes. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { regionalLibraryEntry, createRegionalSession } from '../../../optional-practice/civilian-fpv/regional-session.mjs';
const root = new URL('./tropical-coast/', import.meta.url);
const results = [];
for (const [folder, sha256] of [
  ['settlement-delivery-review-r2', 'dab4be6dd5b782d38c6c01f510137d048b9646d1f14e80c4dc40c6d848720f49'],
  ['harbour-delivery-r3', '44aa0de26f4b4aa79fb0ca8f4b6c7d39bdd62debbdc5e4c51a3a12368a0f42ce'],
]) {
  const base = new URL(`${folder}/`, root);
  const descriptor = JSON.parse(await readFile(new URL('delivery.json', base)));
  const manifest = JSON.parse(await readFile(new URL('terrain/region.json', base)));
  const configuration = { manifest, source: { baseURL: 'https://invalid.example/', fetchImpl: () => { throw Error('No fetch expected'); } } };
  const before = JSON.stringify(configuration.manifest);
  const oldEntry = regionalLibraryEntry(configuration, { sha256 });
  const entry = regionalLibraryEntry(configuration, { sha256, descriptor });
  for (const locale of ['en', 'uk']) assert.equal(entry.course.locales[locale].title, descriptor.title[locale]);
  assert.equal(entry.installedRevision, descriptor.revision);
  assert.equal(entry.packIdentity, oldEntry.packIdentity);
  assert.equal(JSON.stringify(configuration.manifest), before);
  assert.equal(oldEntry.course.locales.en.title, manifest.title.en);
  assert.throws(() => regionalLibraryEntry(configuration, { sha256, descriptor: { ...descriptor, id: 'wrong-region' } }), /identity/);
  assert.throws(() => regionalLibraryEntry(configuration, { sha256, descriptor: { ...descriptor, title: { en: 12, uk: 'x' } } }), /identity/);
  assert.throws(() => regionalLibraryEntry(configuration, { sha256, descriptor: { ...descriptor, revision: 'not a revision' } }), /identity/);
  const session = createRegionalSession(entry.configuration);
  try {
    assert.equal(session.snapshot().status, 'paused');
    assert.equal(session.snapshot().ticks, 0);
    assert.equal(session.arm(), false);
  } finally { await session.dispose(); }
  results.push({ sha256, installedTitle: entry.course.locales.en.title, installedRevision: entry.installedRevision, retainedSourceTitle: manifest.title.en });
}
assert.notEqual(results[0].installedTitle, results[1].installedTitle);
assert.notEqual(results[0].installedRevision, results[1].installedRevision);
console.log(JSON.stringify({ scope: 'Presentation-only exact installed titles; no source identity, arming or store mutation', results }, null, 2));
