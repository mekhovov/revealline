import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { canonicalJSON } from '../game/data-json.mjs';
import { DECODER_SHA256, sha256 } from './artwork-screening.mjs';
import { buildArtworkScreening, runArtworkScreening } from './content-artwork-screening.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const BASE = 'docs/content-offline/inventory.json';
const COMPANY = 'docs/content-offline/company-inventory.json';
const COMPOSER = 'scripts/company-artwork-screening.mjs';

/** Combine review ownership only. Edition saves and artwork identities are never
 * aliased: every historical instance remains separate in its source inventory. */
export function combineArtworkInventories(baseBytes, companyBytes) {
  const base = JSON.parse(baseBytes),
    company = JSON.parse(companyBytes);
  assert.equal(base.format, 'revealline-content-inventory.v1');
  assert.equal(company.format, 'revealline-company-content-inventory.v1');
  assert.equal(base.method.decoderSha256, DECODER_SHA256);
  assert.equal(company.inputs.decoder.sha256, DECODER_SHA256);
  assert.equal(company.inputs.baseInventory.path, BASE);
  assert.equal(company.inputs.baseInventory.bytes, baseBytes.length);
  assert.equal(
    company.inputs.baseInventory.sha256,
    sha256(baseBytes),
    'Company inventory is stale against the base inventory; regenerate ownership first.',
  );
  const artwork = new Map(base.artwork.map((art) => [art.id, { ...art }]));
  for (const art of company.artwork) {
    assert.ok(art.paths.length > 0, 'Company original has no source path.');
    const existing = artwork.get(art.id);
    if (existing) {
      for (const key of ['bytes', 'width', 'height', 'pixelsSha256'])
        assert.equal(existing[key], art[key], `Conflicting shared original ${art.id}: ${key}`);
      assert.equal(existing.kind, 'original');
    } else artwork.set(art.id, { ...art, kind: 'original', path: art.paths[0] });
  }
  const missions = base.missions.map((mission) => ({ ...mission }));
  const ids = new Set(missions.map((mission) => mission.id));
  const current = new Map();
  const instances = new Set();
  for (const instance of company.instances) {
    assert.ok(!instances.has(instance.id), `Duplicate company instance: ${instance.id}`);
    instances.add(instance.id);
    assert.ok(['current', 'compatibility-only'].includes(instance.classification));
    if (instance.artwork) assert.ok(artwork.has(instance.artwork), 'Company artwork is missing.');
    // Same current mission in an all-chapters bundle is one owner. Retained
    // presentations keep their exact instance IDs and cannot become current.
    const id = instance.classification === 'current' ? instance.ownerId : instance.id;
    if (instance.classification === 'current' && current.has(id)) {
      const previous = current.get(id);
      assert.equal(
        previous.artwork,
        instance.artwork,
        'Current bundle views disagree on artwork; resolve ownership before screening.',
      );
      assert.equal(
        previous.gameplayHash,
        instance.gameplayHash,
        'Current bundle views disagree on gameplay; resolve ownership before screening.',
      );
      assert.equal(
        previous.themeSha256,
        instance.themeSha256,
        'Current bundle views disagree on presentation; resolve ownership before screening.',
      );
      continue;
    }
    assert.ok(!ids.has(id), `Conflicting inventory owner: ${id}`);
    ids.add(id);
    if (instance.classification === 'current') current.set(id, instance);
    missions.push({
      id,
      name: instance.name,
      mode: instance.mode,
      route: 'company',
      chapter: instance.campaignId,
      classification: instance.classification,
      artworks: instance.artwork ? [{ id: instance.artwork }] : [],
      inventoryLink: { file: 'company-inventory.html', anchor: instance.id },
    });
  }
  // Bind the full source records, not just the projected rows used by screening.
  return {
    format: base.format,
    method: { decoderSha256: DECODER_SHA256 },
    inputs: [
      { path: BASE, bytes: baseBytes.length, sha256: sha256(baseBytes) },
      { path: COMPANY, bytes: companyBytes.length, sha256: sha256(companyBytes) },
    ],
    artwork: [...artwork.values()].sort((a, b) => a.id.localeCompare(b.id, 'en')),
    missions: missions.sort((a, b) => a.id.localeCompare(b.id, 'en')),
  };
}

export async function buildCompanyArtworkScreening({ root = ROOT, onProgress } = {}) {
  const [baseBytes, companyBytes] = await Promise.all(
    [BASE, COMPANY].map((file) => fs.readFile(path.join(root, file))),
  );
  const combined = combineArtworkInventories(baseBytes, companyBytes);
  const result = await buildArtworkScreening({
    root,
    onProgress,
    inventoryBytes: Buffer.from(canonicalJSON(combined)),
  });
  result.report.method.inventoryInputs = combined.inputs;
  result.report.method.inventoryComposer = COMPOSER;
  result.report.method.inventoryComposerSha256 = sha256(
    await fs.readFile(path.join(root, COMPOSER)),
  );
  result.report.method.limitations.push(
    'Company bundle listings collapse to one current mission owner; exact historical presentation instances remain separate. Owner links open a source instance in the company inventory. Decorative RGBA logos/body assets and procedural themes are not original-picture screening candidates.',
  );
  const companyIds = new Set(JSON.parse(companyBytes).artwork.map((art) => art.id));
  result.report.summary.companyOriginals = companyIds.size;
  result.report.summary.exactGroupsInvolvingCompany = result.report.exactCurrent.filter((group) =>
    group.artwork.some((id) => companyIds.has(id)),
  ).length;
  result.report.summary.nearestPairsInvolvingCompany = result.report.pairs.filter(
    (pair) => companyIds.has(pair.left) || companyIds.has(pair.right),
  ).length;
  result.report.summary.suspectedPairsInvolvingCompany = result.report.pairs.filter(
    (pair) => pair.suspected && (companyIds.has(pair.left) || companyIds.has(pair.right)),
  ).length;
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  runArtworkScreening({
    build: buildCompanyArtworkScreening,
    output: 'docs/content-offline/company-artwork-screening.json',
    html: 'docs/content-offline/company-artwork-screening.html',
    htmlOptions: {
      inventoryFile: 'company-inventory.html',
      reportFile: 'company-artwork-screening.json',
      command: 'node scripts/company-artwork-screening.mjs --check',
    },
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
