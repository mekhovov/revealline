import test from "node:test";
import assert from "node:assert/strict";
import { missionBriefing } from "../mission-brief.mjs";
import { createSpatialChallengeJourney } from "../content-design/spatial-challenge-journey.mjs";
import {
  compileContentProject,
  resolveMission,
} from "../content-design/project.mjs";

test("protected first wall inspection has nonmodal return-surface guidance", () => {
  const project = compileContentProject(createSpatialChallengeJourney());
  const level = resolveMission(project, "broken-yard").level;
  const before = structuredClone(level);
  const brief = missionBriefing(level);
  assert.match(
    brief.status,
    /Walls block craft and enemies; they never close a cut/,
  );
  assert.match(brief.status, /Return to reclaimed ground/);
  assert.match(brief.copy, /Red crosshatched fields damage on contact/);
  assert.deepEqual(level, before);
  assert.doesNotMatch(
    missionBriefing(resolveMission(project, "two-bays").level).status,
    /Walls/,
  );
});
