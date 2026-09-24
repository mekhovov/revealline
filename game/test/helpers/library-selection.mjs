import assert from 'node:assert/strict';

/** Activate the visible menu control and join the real catalogue operation. */
export async function openMissionLibrary(page, openerId) {
  const opener = page.$(openerId),
    handler = opener.onclick;
  let pending;
  opener.onclick = (...args) => (pending = handler.apply(opener, args));
  try {
    opener.focus();
    opener.click();
  } finally {
    opener.onclick = handler;
  }
  assert(pending instanceof Promise, 'The visible Missions action owns preparation.');
  await pending;
  assert.equal(page.$('journey-chooser').open, true);
}

/** Match the exact source/edition, not a suffix of the serialized library key. */
export async function chooseJourneyMission(page, openerId, edition, levelId) {
  await openMissionLibrary(page, openerId);
  const matches = [...page.$('journey-cards').children].filter((card) => {
    const [source, revision, , runtimeId] = JSON.parse(card.dataset.missionId);
    return (
      source === `journey:${edition}` && revision === edition && runtimeId.endsWith(`/${levelId}`)
    );
  });
  assert.equal(matches.length, 1, `One exact ${edition}/${levelId} must be available.`);
  const card = matches[0],
    runtimeId = JSON.parse(card.dataset.missionId)[3];
  card.click();
  return runtimeId;
}
