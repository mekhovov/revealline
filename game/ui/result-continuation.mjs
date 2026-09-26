function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** Name a result destination only when the host already owns its exact
 * successor. Catalogue-backed continuations stay generic until resolution. */
export function resultContinuationLabel(
  t,
  {
    mission = '',
    campaign = '',
    crossesCampaign = false,
    browse = false,
    browseKey = 'interface:browseMissions',
  } = {},
) {
  if (browse) return t(browseKey);
  const missionName = text(mission);
  if (!missionName) return t('interface:nextMission2');
  const campaignName = text(campaign);
  return crossesCampaign && campaignName
    ? t('interface:nextCampaignNamed', { campaign: campaignName })
    : t('interface:nextMissionNamed', { mission: missionName });
}
