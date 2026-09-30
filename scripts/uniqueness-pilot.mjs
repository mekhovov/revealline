#!/usr/bin/env node
import { createHash } from 'node:crypto';
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
import { createRecorder, recordInput, exportReplay, verifyReplay } from '../game/replay.mjs';
import { boardSVG } from './content-inventory.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

const PORTABLE_PILOT_EVIDENCE_FORMAT = 'revealline-pilot-proof.v1';

function portablePilotEvidence(proof) {
  return {
    seed: proof.seed,
    column: proof.column,
    depth: proof.depth,
    side: proof.side,
    status: proof.status,
    ticks: proof.ticks,
    seconds: proof.seconds,
    livesLost: proof.livesLost,
    coverage: proof.coverage,
    closure: proof.closure,
    failures: proof.failures,
    replayVerified: proof.replayVerified,
    segments: proof.segments,
  };
}

export function pilotEvidenceIdentity(proof) {
  const digest = createHash('sha256')
    .update(JSON.stringify(portablePilotEvidence(proof)))
    .digest('hex');
  return PORTABLE_PILOT_EVIDENCE_FORMAT + ':' + digest;
}

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
  const replayVerification = verifyReplay(replay);
  if (!replayVerification.match) throw new Error('Pilot public-input replay differs.');
  const proof = {
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
    replayVerified: replayVerification.match,
    segments,
  };
  return { ...proof, evidenceIdentity: pilotEvidenceIdentity(proof) };
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
    evidenceContract: {
      format: 'revealline-pilot-proof.v1',
      portableFields: [
        'seed',
        'column',
        'depth',
        'side',
        'status',
        'ticks',
        'seconds',
        'livesLost',
        'coverage',
        'closure',
        'failures',
        'replayVerified',
        'segments',
      ],
      historicalExactCheckpoint: {
        reportFormat: 'revealline-uniqueness-pilot.v1',
        retainedInGitHistory: true,
        purpose:
          'Architecture-specific runtime diagnostic; excluded from portable design-proof identity.',
        knownEquivalentExample: {
          pilotId: 'uniqueness-pilot-arcade-delivery',
          darwinArm64: 'e8e4e128969b3aba',
          linuxX64: '83f58b12fcadafda',
          difference:
            'A single-ULP enemy-velocity substitution reproduces the historical Linux hash; the exact Linux field difference remains inferred. Reported route, closure, coverage, failures, segments and replay verification are identical.',
        },
      },
    },
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
  const ids = {
    'uniqueness-pilot-illustrated-orchard': 'orchardReturnLanes',
    'uniqueness-pilot-woven-crossings': 'wovenCrossingBands',
    'uniqueness-pilot-arcade-delivery': 'lastDeliveryCircuit',
    'uniqueness-pilot-shared-branches': 'sharedMarketBranches',
    'uniqueness-pilot-horizon-race': 'horizonTwoBankRace',
  };
  const control = (titleKey, title, decisionKey, manifest) =>
    `<section><h2 data-i18n="${titleKey}">${title}</h2>${boardSVG(manifest.level)}<p data-i18n="${decisionKey}">${escape(manifest.design.routeDecision)}</p><p data-control-identity="${escape(manifest.simulationIdentity)}">Unchanged gameplay control. Simulation ${escape(manifest.simulationIdentity)}.</p></section>`;
  const table = (evidence) =>
    `<table><tr><th data-i18n="tools:neutralPilot.report.openingColumn">Opening column</th><th data-i18n="tools:neutralPilot.report.seed">Seed</th><th data-i18n="tools:neutralPilot.report.seconds">Seconds</th><th data-i18n="tools:neutralPilot.report.banked">Banked</th><th data-i18n="tools:neutralPilot.report.livesLost">Lives lost</th><th data-i18n="tools:neutralPilot.report.coverage">Coverage</th></tr>${[
      ...evidence.attempts,
      ...evidence.seedChecks,
    ]
      .map(
        (row) =>
          `<tr><td data-number="${row.column}" data-digits="1">${row.column}</td><td data-number="${row.seed}" data-digits="0">${row.seed}</td><td data-number="${row.seconds}" data-digits="2">${row.seconds.toFixed(2)}</td><td data-boolean="${Boolean(row.closure)}">${row.closure ? 'Yes' : 'No'}</td><td data-number="${row.livesLost}" data-digits="0">${row.livesLost}</td><td data-percent="${row.coverage * 100}">${(row.coverage * 100).toFixed(1)}%</td></tr>`,
      )
      .join('')}</table>`;
  const pilots = report.pilots
    .map((row) => {
      const id = ids[row.id];
      if (!id) throw new Error(`Unregistered localized pilot: ${row.id}`);
      const prefix = `tools:neutralPilot.report.pilots.${id}`;
      return `<section><h2 data-i18n="tools:neutralPilot.missions.${id}">${escape(row.brief.name)}</h2>${boardSVG(row.level)}<p><strong data-i18n="tools:neutralPilot.report.decision">Decision:</strong> <span data-i18n="tools:neutralPilot.decisions.${id}">${escape(row.brief.decision)}</span></p><p><strong data-i18n="tools:neutralPilot.report.change">Change:</strong> <span data-i18n="${prefix}.difference">${escape(row.brief.difference)}</span></p><p data-duration-min="${row.brief.durationSeconds[0]}" data-duration-max="${row.brief.durationSeconds[1]}">Intended complete-run duration: ${row.brief.durationSeconds.join('–')} seconds (unverified).</p><p><strong data-i18n="tools:neutralPilot.report.artworkBrief">Artwork brief:</strong> <span data-i18n="${prefix}.artBrief">${escape(row.brief.artBrief)}</span></p><p data-successful-openings="${row.evidence.successfulOpenings}">${row.evidence.successfulOpenings} sampled openings banked without losing a life. Full clears and difficulty review remain pending.</p>${table(row.evidence)}</section>`;
    })
    .join('');
  const review = report.reviewCriteria
    .map(
      (item, index) =>
        `<li data-i18n="tools:neutralPilot.report.review.${index + 1}">${escape(item)}</li>`,
    )
    .join('');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title data-i18n="tools:neutralPilot.report.title">Unique mission pilot review</title><link rel="stylesheet" href="../../game/i18n/style.css"><script src="../../game/vendor/i18next-26.4.2.min.js"></script><script src="../../game/i18n/catalogs.mjs"></script><script src="../../game/i18n/bootstrap.mjs"></script><style>body{font:16px/1.5 system-ui;max-width:1000px;margin:2rem auto;padding:1rem;background:#121722;color:#e7eef8}section{border-top:1px solid #596473;padding:1rem 0}svg{width:100%;max-width:650px}table{border-collapse:collapse}td,th{padding:.4rem;text-align:left;border-bottom:1px solid #586273}a{color:#8fdbff}</style><div data-language-control></div><noscript><p>JavaScript is required to switch languages.</p><p lang="uk">Для перемикання мов потрібен JavaScript.</p></noscript><h1 data-i18n="tools:neutralPilot.report.heading">Unique mission pilot</h1><p data-i18n="tools:neutralPilot.report.status">${escape(report.status)}</p><p data-i18n="tools:neutralPilot.report.summary">Grey diagrams deliberately contain no replacement artwork. The cyan start, grey obstacles, amber terrain, red threats and yellow objectives show the proposed decisions. First-return probes are portable public-input design evidence, not completed missions or human approval. Exact runtime checkpoint hashes from the v1 report remain architecture-specific diagnostics in Git history and are excluded from the portable evidence identity.</p><p><a href="pilot-player.html" data-i18n="tools:neutralPilot.report.play">Play the neutral pilot</a> · <a href="pilot.json" data-i18n="tools:neutralPilot.report.evidence">Exact levels, source project, briefs and public-input evidence</a></p>${control('tools:neutralPilot.report.soloControl', 'Solo control: First return', 'tools:neutralPilot.decisions.controlSoloFirstReturn', report.controls.solo)}${pilots}${control('tools:neutralPilot.report.teamControl', 'Team control: Twin landings', 'tools:neutralPilot.decisions.controlTeamTwinLandings', report.controls.team)}<h2 data-i18n="tools:neutralPilot.report.reviewGate">Review gate</h2><ol>${review}</ol><script>(()=>{const {t,localizedText,formatNumber}=RevealLineI18n;for(const node of document.querySelectorAll('[data-control-identity]'))localizedText(node,()=>t('tools:neutralPilot.report.unchangedControl',{identity:node.dataset.controlIdentity}));for(const node of document.querySelectorAll('[data-duration-min]'))localizedText(node,()=>t('tools:neutralPilot.report.duration',{min:formatNumber(Number(node.dataset.durationMin)),max:formatNumber(Number(node.dataset.durationMax))}));for(const node of document.querySelectorAll('[data-successful-openings]'))localizedText(node,()=>t('tools:neutralPilot.report.successfulOpenings',{count:Number(node.dataset.successfulOpenings)}));for(const node of document.querySelectorAll('[data-number]'))localizedText(node,()=>{const digits=Number(node.dataset.digits);return formatNumber(Number(node.dataset.number),{minimumFractionDigits:digits,maximumFractionDigits:digits})});for(const node of document.querySelectorAll('[data-boolean]'))localizedText(node,()=>t(node.dataset.boolean==='true'?'tools:neutralPilot.report.yes':'tools:neutralPilot.report.no'));for(const node of document.querySelectorAll('[data-percent]'))localizedText(node,()=>t('tools:neutralPilot.report.percent',{value:formatNumber(Number(node.dataset.percent),{minimumFractionDigits:1,maximumFractionDigits:1})}))})()</script></html>\n`;
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
