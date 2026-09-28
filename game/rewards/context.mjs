import { completionLearningReference } from './learning.mjs';

/** Translate only selected authored missions from the Journey authority. Skips,
 * practice results and unknown mission IDs never become reward evidence. */
export function rewardContext(
  provider,
  bindings,
  profile,
  acceptedLearning = [],
  acceptedMastery = [],
) {
  const clears = {};
  const clearAlternatives = {};
  for (const mission of bindings) {
    for (const id of mission.journeyMissionIds) {
      const clear = profile?.clears?.solo?.[id];
      // The reward model checks its promised revision. Current bindings must
      // not discard historical accepted clears from a retained promise.
      if (!clear) continue;
      const accepted = {
        runId: clear.runId,
        gameplayId: clear.gameplayId,
        difficulty: clear.difficulty,
      };
      if (!clears[mission.missionId]) {
        clears[mission.missionId] = accepted;
      } else {
        const candidates = [
          clears[mission.missionId],
          ...(clearAlternatives[mission.missionId] ?? []),
        ];
        if (
          !candidates.some(
            (candidate) =>
              candidate.runId === accepted.runId &&
              candidate.gameplayId === accepted.gameplayId &&
              candidate.difficulty === accepted.difficulty,
          )
        )
          (clearAlternatives[mission.missionId] ??= []).push(accepted);
      }
    }
  }
  // Only the lesson host's replay-verified projection is passed here. The exact
  // selected lesson and mission must still match; raw attempts never qualify.
  const selectedMissions = new Set(bindings.map((mission) => mission.missionId));
  const selectedLessons = (provider.lessons ?? [])
    .filter(
      (lesson) =>
        provider.selection.edition.campaignIds.includes(lesson.campaignId) &&
        selectedMissions.has(lesson.missionId),
    )
    .map(completionLearningReference);
  const learning = acceptedLearning.filter((record) =>
    selectedLessons.some((lesson) =>
      Object.entries(lesson).every(([key, value]) => record[key] === value),
    ),
  );
  return {
    editionId: provider.editionId,
    brandId: provider.selection.brand.id,
    campaignIds: provider.selection.edition.campaignIds,
    clears,
    ...(Object.keys(clearAlternatives).length ? { clearAlternatives } : {}),
    learning,
    mastery: acceptedMastery.filter(
      (record) =>
        (provider.rewards ?? []).some((reward) =>
          reward.requirements.mastery.some(
            (requirement) =>
              requirement.id === record.id &&
              requirement.revision === record.revision &&
              requirement.missionId === record.missionId,
          ),
        ) &&
        [clears[record.missionId], ...(clearAlternatives[record.missionId] ?? [])].some(
          (clear) => clear?.runId === record.runId,
        ),
    ),
  };
}
