#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createClassicUniquenessPilots,
  createHorizonVersusUniquenessPilot,
  createUniquenessPilotControls,
  UNIQUENESS_PILOT_VERSION,
} from '../game/content-design/uniqueness-pilot.mjs';
import { compileContentProject, resolveMission } from '../game/content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../game/core/index.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../game/gameplay-tuning.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../game/replay.mjs';
import { boardSVG } from './content-inventory.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

/** Public input only, stopped at first return/failure. This is neither a win
 * nor a human difficulty assessment. No run state is modified by the probe. */
export function probePilotOpening(
  level,
  { seed = 17, column = level.spawn.x, depth = null, side = 'left', maxTicks = 1200 } = {},
) {
  const tuned = applyGameplayTuning(level, resolveGameplayTuning('standard'));
  const options = { seed, classId: 'scout', turnPolicy: 'immediate' };
  const run = createRun(tuned, options),
    recorder = createRecorder(tuned, options),
    segments = [],
    failures = [];
  let closure = null;
  function step(direction) {
    recordInput(recorder, { direction });
    stepRun(run, { direction }, FIXED_DT);
    if (segments.at(-1)?.direction === direction) segments.at(-1).ticks++;
    else segments.push({ direction, ticks: 1 });
    for (const event of run.events) {
      if (event.type === 'cut.closed') closure = { tick: run.tick, coverage: run.coverage };
      if (event.type === 'player.failed')
        failures.push({ tick: run.tick, cause: event.cause ?? null });
    }
  }
  const direction = column < run.player.x ? 'left' : 'right';
  while (
    Math.abs(run.player.x - column) > 0.15 &&
    run.tick < maxTicks &&
    run.status === 'running' &&
    !run.classic.livesLost
  ) {
    const previous = run.player.x;
    step(direction);
    if ((previous - column) * (run.player.x - column) <= 0) break;
  }
  while (run.tick < maxTicks && run.status === 'running' && !run.classic.livesLost && !closure)
    step(depth !== null && run.player.y >= depth ? side : 'down');
  const replay = exportReplay(recorder, run);
  if (!verifyReplay(replay).match) throw new Error('Pilot public-input replay differs.');
  return {
    seed,
    column,
    depth,
    side,
    status: run.status,
    ticks: run.tick,
    seconds: run.tick * FIXED_DT,
    livesLost: run.classic.livesLost,
    coverage: run.coverage,
    closure,
    failures,
    checkpoint: authoritativeCheckpoint(run).hash,
    replayVerified: true,
    segments,
  };
}

export function pilotOpeningEvidence(level) {
  const attempts = [level.spawn.x, 6.5, 12.5, 24.5, 48.5, 60.5, 66.5]
    .filter((value, index, all) => all.indexOf(value) === index)
    .map((column) => probePilotOpening(level, { column }));
  for (const column of [12.5, 24.5, level.spawn.x, 48.5, 60.5])
    for (const depth of [4.5, 7.5])
      for (const side of ['left', 'right'])
        attempts.push(probePilotOpening(level, { column, depth, side }));
  const successful = attempts
    .filter((row) => row.closure && row.livesLost === 0)
    .sort((a, b) => b.coverage - a.coverage || a.ticks - b.ticks);
  return {
    scope:
      'First bank only; full clear, alternate-route balance and human approval remain pending.',
    attempts,
    seedChecks: successful
      .slice(0, 2)
      .flatMap(({ column, depth, side }) =>
        [1, 2].map((seed) => probePilotOpening(level, { seed, column, depth, side })),
      ),
    successfulOpenings: successful.length,
  };
}

export function buildUniquenessPilotReport() {
  const classic = createClassicUniquenessPilots();
  const project = createHorizonVersusUniquenessPilot();
  const versus = resolveMission(compileContentProject(project), project.missions[0].id, {
    mode: 'versus',
    difficulty: 'standard',
  });
  const controls = createUniquenessPilotControls();
  return {
    format: UNIQUENESS_PILOT_VERSION,
    status: 'Design review pending; no current content or reward assignments changed.',
    controls: { solo: controls.solo, team: controls.team },
    horizonProject: project,
    pilots: [
      ...classic.map((row) => ({ ...row, evidence: pilotOpeningEvidence(row.level) })),
      {
        id: versus.missionId,
        classification: 'tooling',
        approval: 'pending-human-playtest',
        mode: 'versus',
        level: versus.level,
        brief: {
          name: versus.level.name,
          decision: versus.design.routeDecision,
          difference:
            'Replaces the Solo opening’s open rectangle/one keeper with two staging foundations, a central obstacle and two watched approaches; distinct competitive routing without copying the Solo course.',
          durationSeconds: versus.design.durationSeconds,
          artBrief:
            'A low view from a seaside cable-ferry platform, with two raised landing shelters, taut cables crossing turquoise water, distant angular cliffs and an overcast silver sky. Avoid the Solo sandstone observatory composition.',
        },
        evidence: pilotOpeningEvidence(versus.level),
      },
    ],
    reviewCriteria: [
      'Play each candidate with neutral artwork using its exact runtime level; compare two viable openings and finish complete runs.',
      'Record route choices, failures and completion times across Standard, Gentle and Expert; confirm the intended decision is observable.',
      'Verify cooperative Twin landings remains a distinct shared-return decision. It is a control, not a redesign request.',
      'Review the five artwork composition briefs before image generation. No commissioned image or automatic hash difference counts as design approval.',
      'Keep these tooling identities outside current catalogues until full route evidence and human review are recorded.',
    ],
  };
}

export function uniquenessPilotHTML(report) {
  const control = (title, manifest) =>
    `<section><h2>${title}</h2>${boardSVG(manifest.level)}<p>${escape(manifest.design.routeDecision)}</p><p>Unchanged gameplay control. Simulation ${escape(manifest.simulationIdentity)}.</p></section>`;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Unique mission pilot review</title><style>body{font:16px/1.5 system-ui;max-width:1000px;margin:2rem auto;padding:1rem;background:#121722;color:#e7eef8}section{border-top:1px solid #596473;padding:1rem 0}svg{width:100%;max-width:650px}table{border-collapse:collapse}td,th{padding:.4rem;text-align:left;border-bottom:1px solid #586273}a{color:#8fdbff}</style><h1>Unique mission pilot</h1><p>${escape(report.status)}</p><p>Grey diagrams deliberately contain no replacement artwork. The cyan start, grey obstacles, amber terrain, red threats and yellow objectives show the proposed decisions. First-return probes are deterministic engine evidence, not completed missions or human approval.</p><p><a href="pilot-player.html">Play the neutral pilot</a> · <a href="pilot.json">Exact levels, source project, briefs and public-input evidence</a></p>${control('Solo control: First return', report.controls.solo)}${report.pilots.map((row) => `<section><h2>${escape(row.brief.name)}</h2>${boardSVG(row.level)}<p><strong>Decision:</strong> ${escape(row.brief.decision)}</p><p><strong>Change:</strong> ${escape(row.brief.difference)}</p><p><strong>Intended complete-run duration:</strong> ${row.brief.durationSeconds.join('–')} seconds (unverified).</p><p><strong>Artwork brief:</strong> ${escape(row.brief.artBrief)}</p><p>${row.evidence.successfulOpenings} sampled openings banked without losing a life. Full clears and difficulty review remain pending.</p><table><tr><th>Opening column</th><th>Seed</th><th>Seconds</th><th>Banked</th><th>Lives lost</th><th>Coverage</th></tr>${[...row.evidence.attempts, ...row.evidence.seedChecks].map((p) => `<tr><td>${p.column}</td><td>${p.seed}</td><td>${p.seconds.toFixed(2)}</td><td>${p.closure ? 'Yes' : 'No'}</td><td>${p.livesLost}</td><td>${(p.coverage * 100).toFixed(1)}%</td></tr>`).join('')}</table></section>`).join('')}${control('Team control: Twin landings', report.controls.team)}<h2>Review gate</h2><ol>${report.reviewCriteria.map((item) => `<li>${escape(item)}</li>`).join('')}</ol></html>\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 3 || !['--write', '--check'].includes(process.argv[2] ?? '--check'))
    throw new Error('Usage: uniqueness-pilot.mjs [--write|--check]');
  const report = buildUniquenessPilotReport();
  for (const [relative, body] of [
    ['docs/content-offline/pilot.json', JSON.stringify(report, null, 2) + '\n'],
    ['docs/content-offline/pilot.html', uniquenessPilotHTML(report)],
    [
      'docs/content-offline/pilot-horizon-project.json',
      JSON.stringify(report.horizonProject, null, 2) + '\n',
    ],
  ]) {
    if (process.argv[2] === '--write') await fs.writeFile(path.join(ROOT, relative), body);
    else if ((await fs.readFile(path.join(ROOT, relative), 'utf8')) !== body)
      throw new Error(`Pilot report drift: ${relative}`);
  }
  console.log(
    JSON.stringify(
      report.pilots.map(({ id, evidence }) => ({
        id,
        successfulOpenings: evidence.successfulOpenings,
        fullClear: 'pending',
        humanReview: 'pending',
      })),
      null,
      2,
    ),
  );
}
