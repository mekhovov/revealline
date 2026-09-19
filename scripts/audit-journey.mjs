import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRun } from '../game/core/index.mjs';
import { inspectCaptureSnapshot } from '../game/core/capture-regions.mjs';
import { dataIdentity } from '../game/data-json.mjs';
import { readExternalDistributionEntries } from './external-distribution.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const readJSON = async (file) => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Static inspection is a queue for redesign, never a human enjoyment score. */
export function auditJourneyLevel(level, campaign, packId, source, classes) {
  const run = createRun(level, { seed: 1, classRecipes: campaign.classRecipes || classes });
  const capture = inspectCaptureSnapshot(run);
  const speeds = run.enemies.map((enemy) => ({
    id: enemy.id,
    type: enemy.type,
    cellsPerSecond:
      Math.round((enemy.speed ?? Math.hypot(enemy.vx || 0, enemy.vy || 0)) * 1000) / 1000,
  }));
  return {
    packId,
    campaignId: campaign.id,
    levelId: level.id,
    name: level.name,
    source,
    runtimeSchema: level.version,
    revision: level.revision,
    contentIdentity: dataIdentity({ level: run.level, classes: run.classRecipes }),
    board: [run.width, run.height],
    player: {
      speed: run.rules.moveSpeed,
      boost: run.rules.boostMultiplier,
      lives: run.rules.lives,
      recoverySeconds: run.rules.respawnSeconds,
    },
    goal: run.level.goal,
    requiredObjectives: run.objectives.filter((objective) => objective.required).length,
    threats: speeds,
    threatRoles: [...new Set(speeds.map((enemy) => enemy.type))],
    terrain: run.level.terrain ?? null,
    timeLimitSeconds: run.rules.timeLimitSeconds,
    initialFieldComponents: capture.components.map(({ id, cells, enemyIds }) => ({
      id,
      size: cells.length,
      retainingEnemies: enemyIds,
    })),
    initiallyUnretainedCells: capture.filledCells.length,
    findings: [
      ...(run.rules.lives !== 3 ? ['standard-lives-differ-from-journey-policy'] : []),
      ...(run.rules.timeLimitSeconds ? ['timed-mission-review-required'] : []),
      ...(capture.filledCells.length
        ? ['first-closure-may-auto-fill-remote-or-empty-regions']
        : []),
      ...(new Set(speeds.map((enemy) => enemy.type)).size > 3
        ? ['dense-role-combination-needs-mastery-evidence']
        : []),
      'authored-foundations-unavailable-in-this-runtime-schema',
      'route-choice-cleanup-and-human-playtest-pending',
    ],
    disposition: { decision: 'review-for-replacement', final: false, successor: null },
  };
}

export async function auditJourney({ referenceDirectory = null } = {}) {
  const classes = await readJSON('game/content/classes.json');
  const base = await readJSON('game/content/campaign.json');
  const campaigns = [{ campaign: base, packId: null, source: 'game/content/campaign.json' }];
  for (const index of ['index.json', 'archive-index.json']) {
    for (const item of (await readJSON(`game/content/packs/${index}`)).packs) {
      const source = `game/content/packs/${item.path}`,
        pack = await readJSON(source);
      for (const campaign of pack.campaigns) campaigns.push({ campaign, packId: pack.id, source });
    }
  }
  for (const source of [
    'authoring/library/fpv-route-choices/packs/fpv-route-choices.json',
    ...['fpv-pressure', 'ukraine-atlas', 'retro-1994', 'spend-network'].map(
      (id) => `authoring/library/four-worlds-chapters/packs/original-${id}.json`,
    ),
  ]) {
    const pack = await readJSON(source);
    for (const campaign of pack.campaigns) campaigns.push({ campaign, packId: pack.id, source });
  }
  const external = await readExternalDistributionEntries(root, {
    format: 'revealline-external-distribution.v1',
    catalog: 'game/content/external-worlds.json',
  });
  for (const item of external.filter((entry) => entry.name.endsWith('/pack.json'))) {
    const pack = JSON.parse(item.bytes);
    for (const campaign of pack.campaigns)
      campaigns.push({ campaign, packId: pack.id, source: `compiled:${item.name}` });
  }
  const levels = campaigns.flatMap(({ campaign, packId, source }) =>
    campaign.levels.map((level) => auditJourneyLevel(level, campaign, packId, source, classes)),
  );
  const ledger = await readJSON('docs/research/xposed-journey-ledger.json');
  const references = [];
  for (const reference of ledger.references) {
    let verified = false;
    if (referenceDirectory) {
      if (path.basename(reference.source.file) !== reference.source.file)
        throw new Error('Reference filename is not local.');
      const bytes = await readFile(path.join(referenceDirectory, reference.source.file));
      if (bytes.length !== reference.source.bytes || sha(bytes) !== reference.source.sha256)
        throw new Error(`Reference original changed: ${reference.source.file}`);
      verified = true;
    }
    references.push({
      key: reference.designKey,
      file: reference.source.file,
      sha256: reference.source.sha256,
      bytes: reference.source.bytes,
      originalBytesVerified: verified,
      visualInspection: 'inherited; not repeated by this audit',
    });
  }
  return {
    format: 'revealline-journey-audit.v1',
    scope:
      'All base, active, archived, optional source and registered external Solo missions. Excludes classic-lab development fixtures and old duplicate pack-source files.',
    evidence: 'Static compiled-data audit, not native playtesting or difficulty certification.',
    counts: {
      missions: levels.length,
      referenceFiles: references.length,
      numberedReferences: ledger.references.filter((row) => row.kind === 'mission-layout-reference')
        .length,
    },
    policyFindings: {
      playerSpeedValues: [...new Set(levels.map((level) => level.player.speed))].sort(
        (a, b) => a - b,
      ),
      startingLivesValues: [...new Set(levels.map((level) => level.player.lives))].sort(
        (a, b) => a - b,
      ),
      timedMissions: levels.filter((level) => level.timeLimitSeconds > 0).length,
      fieldAutoFillCandidates: levels.filter((level) => level.initiallyUnretainedCells > 0).length,
    },
    levels,
    references,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const index = process.argv.indexOf('--reference-dir');
  console.log(
    JSON.stringify(
      await auditJourney({ referenceDirectory: index < 0 ? null : process.argv[index + 1] }),
      null,
      2,
    ),
  );
}
