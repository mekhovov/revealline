/** Earned-state simulation comparison. Run only after native measurements end.
 * No rendering, native-menu, performance, human balance or enjoyment claim.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const root = '/Users/oleksandr.mekhovov/.codex/worktrees/fpv-survivals-recovery/go_test';
const moduleAt = (name) => import(pathToFileURL(`${root}/game/overflight/${name}`).href);
const { OVERFLIGHT_HUNT_MODE } = await moduleAt('raid-mode.mjs');
const { createOverflightRaidVariant } = await moduleAt('raid-variants.mjs');
const { createOverflightHuntReviewPilot } = await moduleAt('raid-review-pilot.mjs');
const { overflightHuntInvestedRanks, legalOverflightHuntRefits } = await moduleAt('raid-upgrades.mjs');
const mode = createOverflightRaidVariant(OVERFLIGHT_HUNT_MODE, { variant: 'marathon' });
const config = Object.freeze({
  rulesVersion: 4,
  layout: 'relay-ruins-receiver-gardens',
  seed: 17031991,
  difficulty: 'standard',
  airframes: 3,
  slowResume: false,
  route: 'objectives',
  build: 'pursuer',
  maxContractSeconds: 300,
  maxContracts: 5,
});
const policy = Object.freeze({
  checkpoint: 'First naturally earned capped draft containing two legal refits and one useful field reward; no reroll or seed search.',
  prefix: 'Public review pilot ordinary steering/boost and earned Pursuer draft choices; continue each won contract.',
  retain: 'Choose the offered field reward; subsequent capped drafts also choose the offered field reward, preserving the earned build.',
  replacement: 'Choose an actually offered refit by fixed destination preference, then fixed sacrificed-family preference; subsequent capped drafts choose offered field reward.',
  destinationPreference: ['heavy-exposure', 'guard-interrupt', 'recovery-shield', 'strike-width', 'slow-wake', 'rush-charge', 'boost-duration', 'boost-cooldown', 'chain-window', 'plating'],
  sourcePreference: ['chain-window', 'rush-charge', 'slow-wake', 'strike-width', 'guard-interrupt', 'recovery-shield', 'plating', 'boost-duration', 'boost-cooldown', 'heavy-exposure'],
  fieldRewards: 'Only naturally offered repair/reroll/score is applied through mode.choose. No direct hull, upgrade, placement, score or resource writes.',
  pilotRestart: 'Both branches start with fresh identical objective/Pursuer pilot state, also reset naturally between contracts.',
});
const sourcePaths = readdirSync(`${root}/game/overflight`).filter((p) => p.endsWith('.mjs')).sort();
const hashes = () => Object.fromEntries(sourcePaths.map((p) => [p, createHash('sha256').update(readFileSync(`${root}/game/overflight/${p}`)).digest('hex')]));
const before = hashes();
const commit = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
const dirty = execFileSync('git', ['status', '--short'], {cwd: root, encoding: 'utf8'}).trim();
const out = process.argv[2] ?? '/tmp/overflight-marathon-refit-20261016.json.gz';
const pilot = () => createOverflightHuntReviewPilot({route: config.route, build: config.build});
const summary = (run) => ({
  contract: run.raidVariant.contract,
  layout: run.compiled.battlefield?.id,
  seed: run.seed,
  time: run.time,
  phase: run.phase,
  status: run.raidVariant.status,
  hull: run.player.hull,
  airframes: run.airframesRemaining,
  damage: run.stats.damageTaken,
  damageCauses: structuredClone(run.stats.damageCauses ?? run.stats.damageByCause ?? null),
  kills: run.stats.kills,
  score: run.hunt.score,
  escrow: run.raidVariant.escrow,
  forfeited: run.raidVariant.forfeited,
  totalTime: run.raidVariant.totalTime,
  campaignTotals: structuredClone(run.raidVariant.totals),
  objectives: run.hunt.objectivesCompleted,
  ranks: structuredClone(run.build.hunt),
  invested: overflightHuntInvestedRanks(run.build),
  choices: run.progression.choices,
  history: structuredClone(run.progression.history),
  rerolls: run.progression.rerolls,
  shield: run.player.shield,
  blockedContacts: run.stats.blockedContacts,
  armorHits: run.hunt.armorHits,
  routeDistance: run.stats.distanceFlown,
  noTargetSeconds: run.stats.noTargetSeconds,
});
const sample = (run) => ({time: run.time, x: run.player.x, y: run.player.y, hull: run.player.hull, airframes: run.airframesRemaining, objectives: run.hunt.objectivesCompleted, damage: run.stats.damageTaken});
const eligible = (run) => run.phase === 'upgrade' && overflightHuntInvestedRanks(run.build) === 8 && run.offers.filter((o) => o.kind === 'refit').length === 2 && run.offers.some((o) => o.kind === 'field');
const choose = (run, offer, events) => {
  if (!offer || !run.offers.some((o) => o.id === offer.id)) throw Error('Choice is not actually offered.');
  const event = {contract: run.raidVariant.contract, time: run.time, offered: run.offers.map((o) => o.id), selected: structuredClone(offer), before: summary(run)};
  if (!mode.choose(run, offer.id)) throw Error(`Illegal choice ${offer.id}`);
  event.after = summary(run);
  events.push(event);
};
const project = mode.createProject(config);
const run = mode.createRun(mode.compileProject(project), config);
let driver = pilot();
mode.start(run);
const prefix = {contracts: [], choices: [], samples: []};
let checkpoint = null;
let nextSample = 0;
while (run.raidVariant.contract <= config.maxContracts) {
  if (eligible(run)) { checkpoint = structuredClone(run); break; }
  if (run.phase === 'upgrade') {
    choose(run, driver.choose(run), prefix.choices);
    continue;
  }
  if (run.phase === 'playing' && run.time < config.maxContractSeconds) {
    mode.step(run, driver.input(run));
    if (run.time >= nextSample) { prefix.samples.push({contract: run.raidVariant.contract, ...sample(run)}); nextSample += 5; }
    continue;
  }
  prefix.contracts.push(summary(run));
  if (run.phase !== 'won' || !mode.continueContract(run)) break;
  driver = pilot(); nextSample = 0; mode.start(run);
}
const report = {kind: 'Earned checkpoint deterministic public-input Marathon refit comparison; no native/renderer/performance/player claim.', commit, dirty, config, policy, sourceBefore: before, prefix, checkpoint: checkpoint ? summary(checkpoint) : null, branches: [], verdict: null};
if (!checkpoint) {
  report.verdict = 'No eligible naturally earned rank-eight refit checkpoint reached; no branch comparison, no seed fishing.';
  report.final = summary(run);
} else {
  const rank = (id, list) => {const n = list.indexOf(id); return n < 0 ? list.length : n;};
  const refit = checkpoint.offers.filter((o) => o.kind === 'refit').sort((a,b) => rank(a.system, policy.destinationPreference) - rank(b.system, policy.destinationPreference) || rank(a.fromSystem, policy.sourcePreference) - rank(b.fromSystem, policy.sourcePreference) || a.id.localeCompare(b.id))[0];
  const field = checkpoint.offers.find((o) => o.kind === 'field');
  const legal = legalOverflightHuntRefits(checkpoint).find((o) => o.id === refit.id);
  if (!legal) throw Error('Earned checkpoint refit is not legal.');
  report.selectedBeforeBranchOutcomes = {retain: structuredClone(field), replacement: structuredClone(refit)};
  // Selection is written before outcomes to document the predeclared comparison.
  writeFileSync(out.replace(/\.json\.gz$/, '.selection.json'), JSON.stringify({commit, config, policy, checkpoint: report.checkpoint, selection: report.selectedBeforeBranchOutcomes}, null, 2));
  for (const [name, selection] of [['retain-earned-build', field], ['offered-replacement', refit]]) {
    const branch = structuredClone(checkpoint);
    const receipt = {name, start: summary(branch), initialChoice: structuredClone(selection), choices: [], contracts: [], samples: []};
    choose(branch, selection, receipt.choices);
    receipt.rankDelta = Object.fromEntries(Object.entries(branch.build.hunt).filter(([key,value]) => value !== checkpoint.build.hunt[key]).map(([key,value]) => [key, {before: checkpoint.build.hunt[key], after: value, delta: value-checkpoint.build.hunt[key]}]));
    let branchPilot = pilot(), next = Math.ceil(branch.time / 5) * 5;
    while (branch.raidVariant.contract <= config.maxContracts) {
      if (branch.phase === 'upgrade') {
        const offer = branch.offers.find((o) => o.kind === 'field') ?? branchPilot.choose(branch);
        choose(branch, offer, receipt.choices);
        if (overflightHuntInvestedRanks(branch.build) !== 8) throw Error('Invested rank budget changed after checkpoint.');
        continue;
      }
      if (branch.phase === 'playing' && branch.time < config.maxContractSeconds) {
        mode.step(branch, branchPilot.input(branch));
        if (branch.time >= next) { receipt.samples.push({contract: branch.raidVariant.contract, ...sample(branch)}); next += 5; }
        continue;
      }
      receipt.contracts.push(summary(branch));
      if (branch.phase !== 'won' || !mode.continueContract(branch)) break;
      branchPilot = pilot(); next = 0; mode.start(branch);
    }
    receipt.final = summary(branch);
    receipt.completedFive = branch.phase === 'won' && branch.raidVariant.contract === 5 && branch.raidVariant.status === 'banked';
    report.branches.push(receipt);
    console.log(JSON.stringify({branch: name, completedFive: receipt.completedFive, outcome: receipt.final, rankDelta: receipt.rankDelta}));
  }
  report.verdict = 'Two earned branches measured. Outcomes demonstrate this fixed pilot/configuration only; no player preference or general balance claim.';
}
report.sourceAfter = hashes();
report.sourceStable = JSON.stringify(report.sourceBefore) === JSON.stringify(report.sourceAfter);
if (!report.sourceStable) report.verdict = 'INVALID: runtime source changed during simulation.';
writeFileSync(out, gzipSync(JSON.stringify(report)));
console.log(JSON.stringify({output: out, checkpoint: report.checkpoint, branches: report.branches.map((b) => ({name:b.name, completedFive:b.completedFive, final:b.final})), sourceStable:report.sourceStable, verdict:report.verdict}));
