#!/usr/bin/env node
import { readFile, stat } from 'node:fs/promises';
import { compileContentProject, resolveMission } from '../game/content-design/project.mjs';
import { resolveContentJourney } from '../game/content-design/journey.mjs';
import { inspectContentPacing } from '../game/content-design/pacing.mjs';
import {
  inspectMissionAcceptance,
  readPlaytestLedger,
} from '../game/content-design/acceptance-evidence.mjs';

const limit = 4 * 1024 * 1024;
async function input(path, maxBytes = limit, label = 'Project') {
  if (path !== '-') {
    const info = await stat(path);
    if (!info.isFile() || info.size > maxBytes)
      throw new Error(`${label} input exceeds ${maxBytes / 1024 / 1024} MiB or is not a file.`);
    return readFile(path, 'utf8');
  }
  const chunks = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    bytes += chunk.length;
    if (bytes > maxBytes) throw new Error(`${label} input exceeds ${maxBytes / 1024 / 1024} MiB.`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}
async function main() {
  const [path, ...args] = process.argv.slice(2);
  if (!path)
    throw new Error(
      'Usage: compile-content-project.mjs <project.json|-> [--check | --mission ID | --journey | --pacing | --acceptance --mission ID --source-commit SHA] [--pack ID] [--mode solo|versus|team] [--difficulty gentle|standard|expert] [--exclude-campaigns ID,ID (pacing only)] [--evidence-ledger FILE (acceptance only)]',
    );
  const options = {},
    seen = new Set();
  let check = false,
    journey = false,
    pacing = false,
    acceptance = false,
    evidencePath,
    sourceCommit,
    excludedCampaignIds,
    packId,
    missionId;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (seen.has(arg)) throw new Error(`Duplicate option: ${arg}`);
    seen.add(arg);
    if (arg === '--check') {
      check = true;
      continue;
    }
    if (arg === '--journey') {
      journey = true;
      continue;
    }
    if (arg === '--pacing') {
      pacing = true;
      continue;
    }
    if (arg === '--acceptance') {
      acceptance = true;
      continue;
    }
    if (
      ![
        '--mission',
        '--pack',
        '--mode',
        '--difficulty',
        '--exclude-campaigns',
        '--source-commit',
        '--evidence-ledger',
      ].includes(arg) ||
      !args[i + 1] ||
      args[i + 1].startsWith('--')
    )
      throw new Error(`Invalid option: ${arg}`);
    const value = args[++i];
    if (arg === '--mission') missionId = value;
    else if (arg === '--pack') packId = value;
    else if (arg === '--exclude-campaigns') excludedCampaignIds = value.split(',');
    else if (arg === '--source-commit') sourceCommit = value;
    else if (arg === '--evidence-ledger') evidencePath = value;
    else options[arg.slice(2)] = value;
  }
  if (
    acceptance &&
    (!missionId || !sourceCommit || check || journey || pacing || packId || excludedCampaignIds)
  )
    throw new Error(
      '--acceptance requires --mission and --source-commit; do not combine it with other report selections.',
    );
  if (!acceptance && (sourceCommit || evidencePath))
    throw new Error('--source-commit and --evidence-ledger require --acceptance.');
  if (evidencePath === '-')
    throw new Error('Use a named evidence-ledger file; stdin is reserved for the project.');
  if (
    check &&
    (missionId || journey || pacing || packId || excludedCampaignIds || Object.keys(options).length)
  )
    throw new Error('--check cannot resolve a specific mission.');
  if (journey && missionId) throw new Error('--journey cannot select a single mission.');
  if (pacing && (journey || missionId || options.difficulty))
    throw new Error(
      '--pacing inspects authored ratings; do not combine it with a mission, Journey or preset.',
    );
  if (excludedCampaignIds && !pacing) throw new Error('--exclude-campaigns requires --pacing.');
  if (packId && !journey && !pacing) throw new Error('--pack requires --journey or --pacing.');
  if (!check && !missionId && !journey && !pacing)
    throw new Error('Choose --check, --mission ID, --journey or --pacing.');
  const source = await input(path);
  if (acceptance) {
    const result = inspectMissionAcceptance(source, missionId, {
      ...options,
      sourceCommit,
      ...(evidencePath
        ? {
            ledger: readPlaytestLedger(
              await input(evidencePath, 8 * 1024 * 1024, 'Evidence ledger'),
            ),
          }
        : {}),
    });
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  if (pacing) {
    const result = inspectContentPacing(source, {
      ...options,
      ...(packId ? { packIds: [packId] } : {}),
      ...(excludedCampaignIds ? { excludedCampaignIds } : {}),
    });
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  if (journey) {
    const result = resolveContentJourney(source, {
      ...options,
      ...(packId ? { packIds: [packId] } : {}),
    });
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  const project = compileContentProject(source);
  const result = check
    ? {
        format: 'ContentProjectCheckV1',
        projectId: project.source.id,
        maps: project.maps.length,
        missions: project.missions.length,
        campaigns: project.campaigns.length,
        packs: project.packs.length,
        validation: 'compiled-candidate-not-playtested',
        readyForRelease: false,
      }
    : resolveMission(project, missionId, options);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}
main().catch((error) => {
  process.stderr.write(error.message + '\n');
  process.exitCode = 1;
});
