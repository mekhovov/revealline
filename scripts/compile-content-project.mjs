#!/usr/bin/env node
import { readFile, stat } from 'node:fs/promises';
import { compileContentProject, resolveMission } from '../game/content-design/project.mjs';
import { resolveContentJourney } from '../game/content-design/journey.mjs';

const limit = 4 * 1024 * 1024;
async function input(path) {
  if (path !== '-') {
    const info = await stat(path);
    if (!info.isFile() || info.size > limit)
      throw new Error('Project input exceeds 4 MiB or is not a file.');
    return readFile(path, 'utf8');
  }
  const chunks = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    bytes += chunk.length;
    if (bytes > limit) throw new Error('Project input exceeds 4 MiB.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}
async function main() {
  const [path, ...args] = process.argv.slice(2);
  if (!path)
    throw new Error(
      'Usage: compile-content-project.mjs <project.json|-> [--check | --mission ID | --journey [--pack ID]] [--mode solo|versus --difficulty gentle|standard|expert]',
    );
  const options = {},
    seen = new Set();
  let check = false,
    journey = false,
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
    if (
      !['--mission', '--pack', '--mode', '--difficulty'].includes(arg) ||
      !args[i + 1] ||
      args[i + 1].startsWith('--')
    )
      throw new Error(`Invalid option: ${arg}`);
    const value = args[++i];
    if (arg === '--mission') missionId = value;
    else if (arg === '--pack') packId = value;
    else options[arg.slice(2)] = value;
  }
  if (check && (missionId || journey || packId || Object.keys(options).length))
    throw new Error('--check cannot resolve a specific mission.');
  if (journey && missionId) throw new Error('--journey cannot select a single mission.');
  if (packId && !journey) throw new Error('--pack requires --journey.');
  if (!check && !missionId && !journey)
    throw new Error('Choose --check, --mission ID or --journey.');
  const source = await input(path);
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
