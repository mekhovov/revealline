#!/usr/bin/env node
/** Measure a built edition; do not rebuild or infer bytes from source files. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { downloadFiles } from '../game/download-catalogue.mjs';

const sum = (files) => files.reduce((total, file) => total + file.bytes, 0);
const distinct = (files) => [...new Map(files.map((file) => [file.sha256, file])).values()];
const mib = (bytes) => `${(bytes / 1024 ** 2).toFixed(2)} MiB`;

/** Core stores URL copies, official downloads store hashes, launcher owns its scope. */
export function packageMeasurement(core, official, launcher = []) {
  const owners = {
    editionRuntime: {
      files: core.length,
      uniqueHashes: distinct(core).length,
      decodedTransferBytes: sum(distinct(core)),
      storedPayloadBytes: sum(core),
    },
    officialContent: {
      files: distinct(official).length,
      uniqueHashes: distinct(official).length,
      decodedTransferBytes: sum(distinct(official)),
      storedPayloadBytes: sum(distinct(official)),
    },
    installedLauncher: {
      files: launcher.length,
      uniqueHashes: distinct(launcher).length,
      decodedTransferBytes: sum(launcher),
      storedPayloadBytes: sum(launcher),
    },
  };
  const decodedTransferBytes = Object.values(owners).reduce(
    (total, owner) => total + owner.decodedTransferBytes,
    0,
  );
  const storedPayloadBytes = Object.values(owners).reduce(
    (total, owner) => total + owner.storedPayloadBytes,
    0,
  );
  return {
    owners,
    decodedTransferBytes,
    // A conservative user-facing upper bound also counts runtime URL copies.
    maximumDecodedTransferBytes: storedPayloadBytes,
    storedPayloadBytes,
    crossOwnerDuplicateBytes:
      decodedTransferBytes - sum(distinct([...core, ...official, ...launcher])),
    largestFileBytes: Math.max(0, ...[...core, ...official, ...launcher].map((file) => file.bytes)),
  };
}

export function buildPackageReport({ catalogue, core, manifest, launcher, archiveSHA256 }) {
  const current = catalogue.groups.filter(
    (group) =>
      group.kind === 'gameplay' &&
      group.current !== false &&
      !['archive', 'tooling'].includes(group.category),
  );
  const measure = (ids, runtime = true) =>
    packageMeasurement(
      runtime ? core.files : [],
      downloadFiles(catalogue, ids),
      runtime ? launcher.files : [],
    );
  const starterFiles = downloadFiles(catalogue, ['base']);
  const currentFiles = downloadFiles(
    catalogue,
    current.map((group) => group.id),
  );
  const starterHashes = new Set(starterFiles.map((file) => file.sha256));
  const currentHashes = new Set(currentFiles.map((file) => file.sha256));
  const chapterSnapshot = (file) => /\/runtime\/chapter-[^/]+\.json$/.test(file.path);
  const groupRows = catalogue.groups.map((group) => {
    const files = downloadFiles(catalogue, [group.id]);
    return {
      id: group.id,
      title: group.title,
      kind: group.kind,
      category: group.category || 'soundtrack',
      current: group.current ?? null,
      requires: group.requires,
      ownBytes: sum(distinct(catalogue.files.filter((file) => group.files.includes(file.path)))),
      closureBytes: sum(files),
      additionalAfterStarterBytes: sum(files.filter((file) => !starterHashes.has(file.sha256))),
      additionalAfterAllCurrentBytes: sum(files.filter((file) => !currentHashes.has(file.sha256))),
    };
  });
  const byExtension = new Map();
  for (const file of core.files) {
    const extension = path.extname(file.path) || '(none)';
    byExtension.set(extension, (byExtension.get(extension) || 0) + file.bytes);
  }
  return {
    format: 'revealline-package-measurement.v1',
    version: catalogue.version,
    sourceRevision: manifest.sourceRevision,
    buildId: core.buildId,
    distributionSHA256: archiveSHA256,
    distributionPayloadBytes: manifest.totalBytes,
    units:
      'Decoded file bytes. MiB = 1,048,576 bytes. HTTP compression and protocol overhead are not measured.',
    ownership:
      'Runtime URL copies, official hashes and stable launcher URLs are separate owners. Matching bytes are not assumed reusable across owners.',
    packages: {
      starter: measure(['base']),
      allCurrent: measure(current.map((group) => group.id)),
      allGameplayArchivesAndTools: measure(
        catalogue.groups.filter((group) => group.kind === 'gameplay').map((group) => group.id),
      ),
      soundtracks: measure(
        catalogue.groups.filter((group) => group.kind === 'soundtrack').map((group) => group.id),
        false,
      ),
    },
    starter: {
      group: 'base',
      chapter: 'solo:horizon-starter',
      missions: catalogue.missions
        .filter((mission) => mission.groups.includes('solo:horizon-starter'))
        .map((mission) => mission.missionId),
      officialFiles: starterFiles,
      soundtrackFiles: starterFiles.filter((file) => file.kind === 'soundtrack').length,
      coreChapterSnapshots: core.files.filter(chapterSnapshot).map((file) => file.path),
      coreModeEntries: core.files
        .filter((file) =>
          [
            'game/couch/index.html',
            'game/couch/relay-rescue.html',
            'game/couch/couch.mjs',
            'game/couch/relay-rescue.mjs',
          ].includes(file.path),
        )
        .map((file) => file.path),
      currentMetadataSnapshots: core.files.filter(
        (file) => /\/runtime\/[^/]+\.json$/.test(file.path) && !chapterSnapshot(file),
      ),
    },
    sharedRuntime: {
      storedBytesByExtension: Object.fromEntries([...byExtension].sort((a, b) => b[1] - a[1])),
      largestFiles: [...core.files].sort((a, b) => b.bytes - a.bytes).slice(0, 15),
    },
    groups: groupRows,
    limitations: [
      'This is a development build measurement, not a frozen release or physical-device certification.',
      'The starter has nine Horizon original pictures and no recorded music. Full current navigation metadata remains available.',
      'Solo uses navigation metadata and one opening-chapter runtime. Other executable chapters, Versus/Team host entry points and historical route sources are separate packages; shared compiler, replay, controller and presentation helpers remain in core.',
      'Versus and Team runtimes still include complete route sources needed by their existing browsers. Further mode-internal chapter splitting remains unqualified.',
      'Original PNG bytes are unchanged. These numbers do not assume new artwork or promise a final optimized image budget.',
      'Browser cache overhead, temporary verification buffers, imports, saves and retained previous editions require additional space beyond stored payload bytes.',
    ],
  };
}

export function packageReportMarkdown(
  report,
  { site = '.cache/offline-package-check', output = 'docs/content-offline/packages' } = {},
) {
  const rows = Object.entries(report.packages).map(
    ([name, value]) =>
      `| ${name} | ${mib(value.decodedTransferBytes)} | ${mib(value.maximumDecodedTransferBytes)} | ${mib(value.storedPayloadBytes)} |`,
  );
  const starter = report.packages.starter;
  return `# Offline package measurements\n\nGenerated from the built distribution, version ${report.version}, build ID \`${report.buildId}\`. Source revision: ${report.sourceRevision || 'not frozen (development build)'}. Distribution SHA-256: \`${report.distributionSHA256}\`.\n\nReproduce after building with:\n\n\`\`\`sh\nnode scripts/report-offline-packages.mjs --site ${site} --out ${output}\n\`\`\`\n\n${report.units}\n\n| Selection | Decoded transfer by owner | Conservative transfer upper bound | Stored payload |\n| --- | ---: | ---: | ---: |\n${rows.join('\n')}\n\nAll gameplay selections include the edition runtime and the stable installed launcher. Soundtracks are an independent additional download. Archive and tooling packages are excluded from all-current. The complete shipped distribution payload is ${mib(report.distributionPayloadBytes)}; this is not the starter download.\n\n## Starter composition\n\nThe Solo Horizon starter contains ${report.starter.missions.length} core missions, ${report.starter.officialFiles.filter((file) => file.path.endsWith('.png')).length} original PNG pictures, the Horizon chapter snapshot, and no recordings. The remix is a separate package.\n\n| Owner | Decoded transfer | Stored payload |\n| --- | ---: | ---: |\n${Object.entries(
    starter.owners,
  )
    .map(
      ([name, owner]) =>
        `| ${name} | ${mib(owner.decodedTransferBytes)} | ${mib(owner.storedPayloadBytes)} |`,
    )
    .join(
      '\n',
    )}\n\n${report.ownership} Runtime deduplication saves transfer when identical files exist at multiple URLs; these URLs still occupy separate cache entries. The conservative UI estimate counts those copies. The launcher owns ${starter.owners.installedLauncher.storedPayloadBytes.toLocaleString('en-US')} additional bytes. These figures describe a fresh cache; already verified files reduce subsequent downloads.\n\n${report.starter.coreChapterSnapshots.length} standalone chapter snapshots are in core. Current navigation metadata is ${report.starter.currentMetadataSnapshots.reduce((total, file) => total + file.bytes, 0).toLocaleString('en-US')} bytes; keeping it allows future chapters and existing progress to remain visible.\n\n## Shared runtime composition\n\n| File type | Stored payload |\n| --- | ---: |\n${Object.entries(
    report.sharedRuntime.storedBytesByExtension,
  )
    .map(([extension, bytes]) => `| ${extension} | ${mib(bytes)} |`)
    .join(
      '\n',
    )}\n\n## Remaining work and interpretation\n\n${report.limitations.map((item) => `- ${item}`).join('\n')}\n\nThe JSON companion records every group, its dependency closure, and the additional bytes after the starter or after all current gameplay. Shared images therefore contribute zero additional bytes when an already installed group owns the same official hash, while archived missions remain distinct navigation entries.\n`;
}

async function main(args) {
  const option = (name) => {
    const index = args.indexOf(name);
    if (index < 0 || !args[index + 1]) throw new Error(`Required option: ${name}`);
    return args[index + 1];
  };
  const site = option('--site');
  const output = option('--out');
  const readJSON = async (name) => JSON.parse(await fs.readFile(path.join(site, name), 'utf8'));
  const [catalogue, core, manifest, worker, archive] = await Promise.all([
    readJSON('offline-content.json'),
    readJSON('offline-cache.json'),
    readJSON('manifest.json'),
    fs.readFile(path.join(site, 'app/service-worker.js'), 'utf8'),
    fs.readFile(path.join(site, 'distribution.zip.sha256'), 'utf8'),
  ]);
  const config = worker.match(/^const CONFIG = (\{.*\});$/m)?.[1];
  if (!config) throw new Error('Cannot read exact built launcher files.');
  const report = buildPackageReport({
    catalogue,
    core,
    manifest,
    launcher: JSON.parse(config),
    archiveSHA256: archive.trim().split(/\s+/)[0],
  });
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(`${output}.json`, `${JSON.stringify(report, null, 2)}\n`);
  await fs.writeFile(`${output}.md`, packageReportMarkdown(report, { site, output }));
  console.log(
    `Measured ${report.buildId}: starter ${mib(report.packages.starter.maximumDecodedTransferBytes)} maximum decoded transfer.`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main(process.argv.slice(2));
