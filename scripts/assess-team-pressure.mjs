#!/usr/bin/env node
// Read-only bounded route reuse. JSONL output, no runtime/content/publication writes.
import { readFile } from 'node:fs/promises';
import { createTeamJourneyCandidates } from '../game/content-design/team-journey-candidates.mjs';
import { compileContentProject, resolveMission } from '../game/content-design/project.mjs';
import { withPressureDifficulty } from '../game/content-design/pressure-candidates.mjs';
import { assessTeamPressureRoute, teamRouteTemplates } from './lib/team-pressure-assessment.mjs';
import { playTeamFoundationRoute } from '../game/test/helpers/team-foundation-route.mjs';
import { teamPressureGoal } from './lib/team-pressure-assessment.mjs';

const project = compileContentProject(createTeamJourneyCandidates());
const next = compileContentProject(withPressureDifficulty(project.source));
const templates = [];
for (const name of ['opening', 'foundation', 'material', 'roamer']) {
  const data = JSON.parse(
    await readFile(new URL(`../game/test/fixtures/team-${name}-routes.json`, import.meta.url)),
  );
  for (const kind of name === 'foundation' ? ['clear', 'mastery'] : ['routes'])
    for (const row of data[kind]) {
      const id = `${name}/${kind}/${row.missionId}/${row.difficulty}`;
      const old = resolveMission(project, row.missionId, {
        mode: 'team',
        difficulty: row.difficulty,
      });
      // The combined review project's identity differs from the historical arc.
      // Runtime recipes do not: reproduce every recorded terminal checkpoint.
      for (const jointCuts of [true, false]) {
        const result = playTeamFoundationRoute(old.level, row.log, {
          jointCuts,
          inspectGoal: teamPressureGoal,
        });
        const expected = row.results?.find((entry) => entry.jointCuts === jointCuts);
        if (
          result.run.status !== 'won' ||
          result.evidence.downs ||
          result.evidence.closed.size !== 2 ||
          (expected && result.checkpoint !== expected.checkpoint)
        )
          throw new Error(`Historical route mismatch: ${id}/${jointCuts}`);
      }
      templates.push({ id, ...row });
    }
}
const chosenMission = process.argv[2] ?? 'all';
if (chosenMission !== 'all' && !project.missions.some((m) => m.id === chosenMission))
  throw new Error('Unknown Team mission.');
for (const mission of project.missions.filter(
  (m) => chosenMission === 'all' || chosenMission === m.id,
))
  for (const difficulty of ['gentle', 'standard', 'expert']) {
    const manifest = resolveMission(next, mission.id, { mode: 'team', difficulty });
    let selected = null,
      lastFailure = null,
      attempts = 0;
    search: for (const template of teamRouteTemplates(templates, mission.id, difficulty))
      for (const delayTicks of [0, 30, 60, 120, 240, 600]) {
        attempts++;
        const outcomes = [];
        for (const jointCuts of [true, false])
          for (const swapped of [false, true]) {
            const result = assessTeamPressureRoute(manifest.level, template.log, {
              jointCuts,
              swapped,
              delayTicks,
            });
            outcomes.push({ jointCuts, swapped, ...result });
            if (result.status !== 'shared-no-loss-clear') break;
          }
        const trial = { templateId: template.id, delayTicks, outcomes };
        if (outcomes.length === 4 && outcomes.every((r) => r.status === 'shared-no-loss-clear')) {
          selected = trial;
          break search;
        }
        lastFailure = trial;
      }
    // A fixed later departure is real timing variation. Stored Team seed does
    // not randomize these actors, so do not inflate coverage with seed labels.
    let timingProbe = null;
    if (difficulty === 'standard') {
      const trial = selected ?? lastFailure;
      const template = templates.find((row) => row.id === trial.templateId);
      const delayTicks = trial.delayTicks + 180;
      timingProbe = { templateId: template.id, delayTicks, outcomes: [] };
      for (const jointCuts of [true, false])
        for (const swapped of [false, true])
          timingProbe.outcomes.push({
            jointCuts,
            swapped,
            ...assessTeamPressureRoute(manifest.level, template.log, {
              jointCuts,
              swapped,
              delayTicks,
            }),
          });
    }
    console.log(
      JSON.stringify({
        missionId: mission.id,
        difficulty,
        simulationIdentity: manifest.simulationIdentity,
        attempts,
        selected,
        lastFailure,
        timingProbe,
      }),
    );
  }
