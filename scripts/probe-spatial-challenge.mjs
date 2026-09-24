#!/usr/bin/env node
// JSONL evidence only: no content edits, fixture writes, publication, or claims
// of human balance. Defaults intentionally qualify one bounded configuration.
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { relative, resolve } from 'node:path';
import { compileContentProject } from '../game/content-design/project.mjs';
import { createSpatialChallengeJourney } from '../game/content-design/spatial-challenge-journey.mjs';
import {
  prepareSpatialMission,
  assessSpatialRoute,
  searchSpatialRoute,
} from './lib/spatial-challenge-assessment.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const missionIds = [
  'two-bays',
  'neon-remix',
  'broken-yard',
  'read-the-arrows',
  'crossing-complete',
  'twin-receivers',
];
const argv = process.argv.slice(2);
if (argv.includes('--help')) {
  console.log(
    'node scripts/probe-spatial-challenge.mjs [mission|all] [--presets=standard] [--controls=immediate] [--seeds=1] [--search=ordinary|efficient] [--budget=60000] [--candidates=16] [--max-cuts=12] [--delay-ticks=0] [--route=JSON-or-JSONL-file | --resume=JSON-or-JSONL-file] [--approach=name]',
  );
  process.exit(0);
}
const allowed = [
  'presets',
  'controls',
  'seeds',
  'search',
  'budget',
  'candidates',
  'max-cuts',
  'delay-ticks',
  'route',
  'resume',
  'approach',
];
const settings = new Map();
let mission = 'two-bays';
for (const [index, arg] of argv.entries()) {
  if (index === 0 && !arg.startsWith('--')) {
    mission = arg;
    continue;
  }
  const match = /^--([a-z-]+)=(.+)$/.exec(arg);
  if (!match || !allowed.includes(match[1]) || settings.has(match[1]))
    throw new Error(`Unknown or duplicate option: ${arg}`);
  settings.set(match[1], match[2]);
}
if (mission !== 'all' && !missionIds.includes(mission))
  throw new Error('Choose a supported spatial mission.');
const list = (name, fallback, available) => {
  const entries = (settings.get(name) ?? fallback).split(',');
  if (
    !entries.length ||
    new Set(entries).size !== entries.length ||
    entries.some((v) => !available.includes(v))
  )
    throw new Error(`Invalid ${name} selection.`);
  return entries;
};
const difficulties = list('presets', 'standard', ['gentle', 'standard', 'expert']);
const controls = list('controls', 'immediate', ['immediate', 'grid-center']);
const seeds = (settings.get('seeds') ?? '1').split(',').map(Number);
if (
  seeds.length > 8 ||
  new Set(seeds).size !== seeds.length ||
  seeds.some((n) => !Number.isSafeInteger(n) || n < 1 || n > 2147483647)
)
  throw new Error('Choose up to eight unique positive int32 seeds.');

const git = (...args) =>
  execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
const sourceFiles = [];
function collect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    if (entry.name === 'test') continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) collect(path);
    else if (entry.isFile() && entry.name.endsWith('.mjs')) sourceFiles.push(path);
  }
}
collect(resolve(root, 'game'));
sourceFiles.push(
  resolve(root, 'scripts/probe-spatial-challenge.mjs'),
  resolve(root, 'scripts/lib/spatial-challenge-assessment.mjs'),
  resolve(root, 'scripts/lib/bent-route-search.mjs'),
);
sourceFiles.sort();
function sourceDigest() {
  const hash = createHash('sha256');
  for (const path of sourceFiles) {
    hash.update(relative(root, path));
    hash.update('\0');
    hash.update(readFileSync(path));
    hash.update('\0');
  }
  return hash.digest('hex');
}
const sourceIdentity = {
  gitRevision: git('rev-parse', 'HEAD').trim(),
  dirty: Boolean(git('status', '--porcelain', '--untracked-files=normal').trim()),
  sourceFiles: sourceFiles.length,
  sourceSha256: sourceDigest(),
  digestScope:
    'All non-test game .mjs files, this CLI, spatial assessment, and bent-route proposal helper; includes untracked candidate code.',
};
const project = compileContentProject(createSpatialChallengeJourney());
if (settings.has('route') && settings.has('resume'))
  throw new Error('Choose route assessment or resumed search.');
const routePath = settings.get('route') ?? settings.get('resume');
if (settings.has('approach') && !routePath)
  throw new Error('Choose a route file before selecting an approach.');
let input = null;
if (routePath) {
  const raw = readFileSync(resolve(routePath), 'utf8');
  try {
    input = JSON.parse(raw);
  } catch {
    input = raw
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
  }
}
const rows = input
  ? Array.isArray(input)
    ? input
    : Array.isArray(input.rows)
      ? [...input.rows, ...(input.incompleteSearches ?? [])]
      : [input]
  : [];
for (const id of missionIds.filter((id) => mission === 'all' || id === mission))
  for (const difficulty of difficulties)
    for (const turnPolicy of controls)
      for (const seed of seeds) {
        const prepared = prepareSpatialMission(project, id, { difficulty });
        let evidence;
        let prefix = [];
        if (input) {
          const matching = rows.filter(
            (row) =>
              row.missionId === id &&
              row.difficulty === difficulty &&
              row.turnPolicy === turnPolicy &&
              row.seed === seed &&
              (!settings.has('approach') || row.approach === settings.get('approach')),
          );
          if (matching.length > 1)
            throw new Error('Ambiguous route configuration: choose --approach=name.');
          const route = matching[0];
          if (!route || route.simulationIdentity !== prepared.simulationIdentity)
            throw new Error(`Missing or stale route: ${id}/${difficulty}/${turnPolicy}/${seed}`);
          prefix = route.segments.map((segment) =>
            Array.isArray(segment) ? { direction: segment[0], ticks: segment[1] } : segment,
          );
          evidence = assessSpatialRoute(prepared, {
            ...route,
            segments: prefix,
            seed,
            turnPolicy,
          });
          if (route.checkpoint && route.checkpoint !== evidence.checkpoint)
            throw new Error('Route checkpoint changed.');
        }
        if (!input || settings.has('resume')) {
          evidence = searchSpatialRoute(prepared, {
            seed,
            turnPolicy,
            policy: settings.get('search') ?? 'ordinary',
            simulationTickBudget: Number(settings.get('budget') ?? 60000),
            candidateLimit: Number(settings.get('candidates') ?? 16),
            maxCuts: Number(settings.get('max-cuts') ?? 12),
            initialDelayTicks: Number(settings.get('delay-ticks') ?? 0),
            initialSegments: prefix,
          });
        }
        console.log(
          JSON.stringify({
            ...evidence,
            ...(settings.has('approach') ? { approach: settings.get('approach') } : {}),
            sourceIdentity: {
              ...sourceIdentity,
              stableDuringProbe: sourceDigest() === sourceIdentity.sourceSha256,
            },
          }),
        );
      }
