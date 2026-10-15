import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateDownloadCatalogue } from '../game/download-catalogue.mjs';
import {
  createTeamExpansionCandidates,
  createDuelExpansionCandidates,
} from '../game/content-design/multiplayer-expansion.mjs';
import { createTeamHuntTrainingCandidates } from '../game/content-design/team-hunt-training-candidates.mjs';
import { createHuntTrainingCandidates } from '../game/content-design/hunt-training-candidates.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function multiplayerDeliveryExpectations() {
  return [
    ['team-expedition-v1', 'team', createTeamExpansionCandidates(), 12],
    ['duel-expedition-v1', 'versus', createDuelExpansionCandidates(), 12],
    ['humanoid-hunt-v1', 'team', createTeamHuntTrainingCandidates(), null],
    ['humanoid-hunt-v1', 'versus', createHuntTrainingCandidates({ artwork: true }), null],
  ].map(([routeId, mode, source, chapters]) => ({
    routeId,
    mode,
    chapters,
    missions: source.missions.map((mission) => {
      const original = source.assets.find(
        (asset) => asset.id === mission.presentation.backgroundAssetId,
      );
      assert(original, `Missing authored original for ${mission.id}`);
      return { id: mission.id, picture: `game/${original.path}`, sha256: original.sha256 };
    }),
  }));
}

/** Keep path aliases: the player's URL must work even when another path has the same bytes. */
function groupClosure(catalogue, ids) {
  const groups = new Map(catalogue.groups.map((group) => [group.id, group]));
  const visited = new Set(),
    files = new Set(),
    pending = [...ids];
  while (pending.length) {
    const id = pending.pop();
    if (visited.has(id)) continue;
    const group = groups.get(id);
    assert(group, `Missing offline group ${id}`);
    visited.add(id);
    for (const file of group.files) files.add(file);
    pending.push(...group.requires);
  }
  return { files, groups: visited };
}

export function multiplayerDeliveryFiles(manifest, catalogue, expectations) {
  validateDownloadCatalogue(catalogue);
  assert.equal(catalogue.version, manifest.version, 'Package and catalogue versions agree');
  const manifestFiles = new Map(manifest.files.map((file) => [file.path, file]));
  assert.equal(manifestFiles.size, manifest.files.length, 'Manifest paths are unique');
  const catalogueFiles = new Map(catalogue.files.map((file) => [file.path, file]));
  const paths = new Set(),
    rows = [];
  for (const expected of expectations) {
    const missions = catalogue.missions.filter(
      (mission) => mission.routeId === expected.routeId && mission.modes.includes(expected.mode),
    );
    assert.deepEqual(
      missions.map((mission) => mission.missionId).sort(),
      expected.missions.map((mission) => mission.id).sort(),
      `Exact mission inventory for ${expected.mode}/${expected.routeId}`,
    );
    const chapters = new Set();
    for (const mission of missions) {
      assert.equal(mission.current, true, `${mission.missionId} remains current`);
      const required = groupClosure(catalogue, mission.groups);
      const authored = expected.missions.find((item) => item.id === mission.missionId);
      assert(required.files.has(authored.picture), `${mission.missionId} includes its original`);
      assert.equal(
        catalogueFiles.get(authored.picture)?.sha256,
        authored.sha256,
        `${mission.missionId} retains the authored original bytes`,
      );
      for (const id of mission.groups) chapters.add(id);
      for (const file of required.files) paths.add(file);
      assert(
        catalogue.destinations.some((destination) => {
          if (destination.routeId !== expected.routeId || destination.mode !== expected.mode)
            return false;
          const owned = groupClosure(catalogue, destination.groups);
          return (
            [...required.groups].every((id) => owned.groups.has(id)) &&
            [...required.files].every((name) => owned.files.has(name))
          );
        }),
        `${mission.missionId} has an owned offline destination`,
      );
    }
    if (expected.chapters !== null)
      assert.equal(chapters.size, expected.chapters, `${expected.routeId} chapter count`);
    rows.push({
      routeId: expected.routeId,
      mode: expected.mode,
      missions: missions.length,
      groups: [...chapters].sort(),
    });
  }
  const files = [...paths].sort().map((name) => {
    const file = catalogueFiles.get(name),
      published = manifestFiles.get(name);
    assert(published, `Missing manifest dependency ${name}`);
    assert.equal(published.bytes, file.bytes, `Manifest length for ${name}`);
    assert.equal(published.sha256, file.sha256, `Manifest digest for ${name}`);
    return file;
  });
  return { rows, files };
}

export async function verifyMultiplayerDelivery({
  read,
  expectations = multiplayerDeliveryExpectations(),
}) {
  const manifestBytes = await read('manifest.json');
  const manifest = JSON.parse(manifestBytes);
  assert.match(manifest.sourceRevision, /^[a-f0-9]{40}$/, 'Exact committed source is required');
  const catalogueBytes = await read('offline-content.json');
  const catalogueEntry = manifest.files.find((file) => file.path === 'offline-content.json');
  assert(catalogueEntry, 'Catalogue is bound by the manifest');
  assert.equal(catalogueBytes.length, catalogueEntry.bytes);
  assert.equal(hash(catalogueBytes), catalogueEntry.sha256, 'Catalogue matches the exact manifest');
  const catalogue = JSON.parse(catalogueBytes);
  const { rows, files } = multiplayerDeliveryFiles(manifest, catalogue, expectations);
  const results = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (next < files.length) {
        const file = files[next++];
        try {
          const bytes = await read(file.path);
          assert.equal(bytes.length, file.bytes, 'Byte length');
          assert.equal(hash(bytes), file.sha256, 'SHA-256');
          results.push({
            path: file.path,
            bytes: bytes.length,
            sha256: file.sha256,
            status: 'passed',
          });
        } catch (error) {
          results.push({ path: file.path, status: 'failed', error: error.message });
        }
      }
    }),
  );
  const finalManifest = await read('manifest.json');
  const sourceStable = hash(finalManifest) === hash(manifestBytes);
  const failures = results.filter((result) => result.status === 'failed');
  return {
    format: 'revealline-multiplayer-delivery-check.v1',
    observedAt: new Date().toISOString(),
    sourceRevision: manifest.sourceRevision,
    version: manifest.version,
    manifestSha256: hash(manifestBytes),
    sourceStable,
    passed: sourceStable && failures.length === 0,
    inventory: rows,
    files: results.sort((a, b) => a.path.localeCompare(b.path)),
    verifiedBytes: results.reduce((sum, row) => sum + (row.bytes ?? 0), 0),
    failures,
    scope:
      'Exact public or packaged bytes and offline dependency ownership. Browser progression, cache upgrades, listening and devices require separate observations.',
  };
}

async function main(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    assert(
      ['--root', '--base', '--report'].includes(key) && args[index + 1],
      'Usage: --root DIRECTORY | --base URL, with --report FILE',
    );
    assert(!options[key], `Duplicate argument ${key}`);
    options[key] = args[index + 1];
  }
  assert(Boolean(options['--root']) !== Boolean(options['--base']), 'Choose one root or base URL');
  assert(options['--report'], 'An evidence report path is required');
  const base = options['--base'] ? new URL(options['--base']) : null;
  if (base) assert(base.pathname.endsWith('/') && ['http:', 'https:'].includes(base.protocol));
  const read = base
    ? async (name) => {
        const url = new URL(name, base);
        const response = await fetch(url, {
          cache: 'no-store',
          signal: AbortSignal.timeout(45000),
        });
        assert(response.ok, `${response.status}: ${name}`);
        assert.equal(response.url, url.href, `Unexpected redirect for ${name}`);
        return Buffer.from(await response.arrayBuffer());
      }
    : (name) => readFile(path.join(options['--root'], name));
  const report = await verifyMultiplayerDelivery({ read });
  report.target = base?.href ?? path.resolve(options['--root']);
  await mkdir(path.dirname(path.resolve(options['--report'])), { recursive: true });
  await writeFile(options['--report'], `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        passed: report.passed,
        sourceRevision: report.sourceRevision,
        files: report.files.length,
        verifiedBytes: report.verifiedBytes,
        sourceStable: report.sourceStable,
        failures: report.failures,
      },
      null,
      2,
    ),
  );
  if (!report.passed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
