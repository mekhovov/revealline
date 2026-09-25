import { t, formatNumber } from '../i18n/index.mjs';
import { studioContentText } from './preview-copy.mjs';

const kindKeys = {
  mission: 'interface:mission',
  campaign: 'interface:campaign',
  pack: 'interface:pack',
};
const actionKeys = {
  create: 'interface:create',
  duplicate: 'interface:duplicateItemContents',
  rename: 'interface:rename',
  'set-band': 'interface:changeCampaignBand',
  place: 'interface:addToParent',
  detach: 'interface:removeFromParent',
  earlier: 'interface:moveEarlierInParent',
  later: 'interface:moveLaterInParent',
  delete: 'interface:deleteUnreferencedItem',
  archive: 'interface:archiveItem',
  restore: 'interface:restoreArchivedItem',
};

/** One caption is shared by mission, campaign and pack selectors. Values and
 * authored identities stay independent of the localized label. */
export function studioItemCaption(project, item, { identity = true } = {}) {
  return t(item.archived ? 'tools:studio.item.archivedOption' : 'tools:studio.item.option', {
    name: studioContentText(project, item, 'name'),
    identity: identity ? ` · ${item.id}` : '',
  });
}
export function studioStructureSummary(project) {
  return t('tools:studio.structure.summary', {
    packs: project.packs.length,
    campaigns: project.campaigns.length,
    missions: project.missions.length,
    details: project.campaigns
      .map((campaign) =>
        t('tools:studio.structure.campaignCount', {
          name: studioContentText(project, campaign, 'name'),
          count: campaign.missionIds.length,
        }),
      )
      .join(' · '),
  }).trim();
}
export function studioStructureOutline(project) {
  return project.packs
    .map((pack, index) =>
      t('tools:studio.structure.packRow', {
        index: index + 1,
        name: studioItemCaption(project, pack, { identity: false }),
        campaigns:
          pack.campaignIds
            .map((id) => {
              const campaign = project.campaigns.find((entry) => entry.id === id);
              return t('tools:studio.structure.campaignRow', {
                name: studioItemCaption(project, campaign, { identity: false }),
                band: campaign.band,
                missions:
                  campaign.missionIds
                    .map((missionId) =>
                      studioItemCaption(
                        project,
                        project.missions.find((entry) => entry.id === missionId),
                        { identity: false },
                      ),
                    )
                    .join(' → ') || t('interface:empty'),
              });
            })
            .join(' / ') || t('interface:empty'),
      }),
    )
    .join('\n');
}
export function studioRemovalText(project, removal) {
  if (!removal) return t('tools:studio.structure.chooseDependencies');
  const item = project[`${removal.kind}s`].find((entry) => entry.id === removal.id);
  const name = studioContentText(project, item, 'name');
  return removal.deletable
    ? t('tools:studio.structure.deleteNotice', { name, id: removal.id })
    : t('tools:studio.structure.blocked', {
        name,
        dependencies: removal.dependencies
          .map((entry) =>
            t('tools:studio.structure.dependency', {
              kind: t(kindKeys[entry.kind]),
              id: entry.id,
              relation: t(
                entry.relation === 'parent'
                  ? 'tools:studio.structure.parent'
                  : 'tools:studio.structure.member',
              ),
            }),
          )
          .join(', '),
      });
}
export function studioStructureResult(action, kind, id) {
  return t('tools:studio.structure.applied', {
    action: t(actionKeys[action]),
    kind: t(kindKeys[kind]),
    id,
  });
}

const diagnosticKeys = {
  'disconnected-foundations': 'tools:studio.diagnostic.disconnected',
  'remote-chamber': 'tools:studio.diagnostic.remoteChamber',
  'single-departure': 'tools:studio.diagnostic.singleDeparture',
  'candidate-combat-not-presentation-qualified': 'tools:studio.diagnostic.combat',
  'greybox-background': 'tools:studio.diagnostic.greybox',
  'candidate-art-not-visually-qualified': 'tools:studio.diagnostic.art',
  'combat-auto-fill-removal': 'tools:studio.diagnostic.combatRemoval',
  'blocked-relay-dependency': 'tools:studio.diagnostic.blockedRelay',
  'inaccessible-retained-chamber': 'tools:studio.diagnostic.inaccessible',
  'remote-auto-fill': 'tools:studio.diagnostic.autoFill',
  'unoccupied-auto-fill': 'tools:studio.diagnostic.autoFill',
  'unreachable-objective': 'tools:studio.diagnostic.unreachableObjective',
  'remote-objective-auto-fill': 'tools:studio.diagnostic.remoteObjective',
  'unreachable-coverage-quota': 'tools:studio.diagnostic.coverage',
};
export function studioDiagnosticText(item, manifest) {
  const description = diagnosticKeys[item.code]
    ? t(diagnosticKeys[item.code], {
        id: item.objectiveId ?? item.spawnId,
        requirement: t(
          manifest.level.objectives?.find((entry) => entry.id === item.objectiveId)?.required
            ? 'tools:studio.geometry.required'
            : 'tools:studio.geometry.optional',
        ),
        ceiling: formatNumber(manifest.topology.optimisticCoverageCeiling * 100, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }),
        target: formatNumber(manifest.level.goal.coverage * 100, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }),
      })
    : item.message || item.code;
  return t('tools:studio.diagnostic.message', {
    severity: t(
      item.severity === 'error'
        ? 'tools:studio.diagnostic.error'
        : 'tools:studio.diagnostic.warning',
    ),
    code: item.code,
    description,
  });
}
