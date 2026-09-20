import test from 'node:test';
import assert from 'node:assert/strict';
import { missionBriefing } from '../mission-brief.mjs';
import { createPhaseCandidates } from '../content-design/phase-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';

test('all Phaseworks ready cards distinguish selective carrier grace from immediate trail threats', () => {
  const project = compileContentProject(createPhaseCandidates());
  for (const mission of project.missions) {
    const level = resolveMission(project, mission.id).level;
    const before = structuredClone(level);
    const card = missionBriefing(level);
    assert.match(card.copy, /Only bolts send sparks/);
    assert.match(card.copy, /other trail hits are instant/);
    assert.match(card.copy, /Closing a cut stops your craft/);
    assert(card.copy.length <= 240, `${mission.id}: ${card.copy.length}`);
    assert.deepEqual(level, before);
  }
});

test('historical global impact and absent impact briefings retain their existing contract', () => {
  const base = { name: 'Historical fixture', goal: { coverage: 0.7 }, rules: {} };
  const global = { ...base, classic: { lineImpact: { version: 'line-impact.v1', speed: 24 } } };
  assert.equal(
    missionBriefing(global).copy,
    'Reveal 70%.\nLine hit? Close your cut before the travelling spark reaches you.',
  );
  assert.equal(missionBriefing(base).copy, 'Reveal 70%.');
});
