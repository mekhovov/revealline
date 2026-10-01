import { COMMUNITY_ROUTES } from '../game/community-routes.mjs';
import { editionOfflinePackageId } from '../game/editions/offline-package-id.mjs';

/** Aggregate existing verified owners. Never copy assets or maintain a second SIM list. */
export function addOfflineExperiences(groups, files, bundledPackages = [], corePaths = null) {
  const optionalPaths = new Set(files.map((file) => file.path));
  const byId = new Map(groups.map((group) => [group.id, group]));
  for (const route of COMMUNITY_ROUTES) {
    const owners = route.editionIds.map((id) => byId.get(editionOfflinePackageId(id)));
    // A reduced/branded build must never advertise an absent community.
    if (owners.every((owner) => !owner)) continue;
    if (owners.some((owner) => !owner))
      throw new Error(`Incomplete offline community: ${route.slug}`);
    const modes = [...new Set(owners.flatMap((owner) => owner.modes))];
    // Individual company selections need the same mode closure as the aggregate.
    for (const owner of owners)
      owner.requires = [
        ...new Set([
          ...owner.requires,
          'shared',
          ...owner.modes
            .filter((mode) => mode !== 'solo')
            .map((mode) => `runtime:${mode}`)
            .filter((id) => byId.has(id)),
        ]),
      ];
    groups.push({
      id: `community:${route.slug}`,
      title: byId.get(editionOfflinePackageId(route.editionId)).title,
      kind: 'gameplay',
      category: 'community',
      current: false,
      modes,
      requires: owners.map((owner) => owner.id),
      files: [],
      launchPath: `game/communities/${route.slug}/`,
    });
  }
  for (const { packageId, files: dependencies, workerPath } of bundledPackages) {
    const sim = packageId === 'fpv-worlds';
    const paths = [...new Set([...dependencies.map((file) => file.path), workerPath])];
    if (corePaths && paths.some((name) => !optionalPaths.has(name) && !corePaths.has(name)))
      throw new Error(`Incomplete offline simulator dependencies: ${packageId}`);
    groups.push({
      id: sim ? 'extras:sim-fpv' : `extras:${packageId}`,
      title: sim ? 'SIM FPV · Flight simulator' : 'FPV flight practice',
      titleKey: sim ? 'interface:downloads.simFPV' : 'interface:downloads.fpvPractice',
      kind: 'gameplay',
      category: 'experience',
      current: false,
      modes: [],
      requires: ['shared'],
      // Shared dependencies that are not in core may live outside optional-practice/.
      files: paths.filter((name) => optionalPaths.has(name)),
      launchPath: `optional-practice/${packageId}/`,
    });
  }
  // Keep old selections readable, but expose the complete named packages to new players.
  const legacy = byId.get('extras:practice');
  if (legacy && bundledPackages.length) {
    legacy.hidden = true;
    legacy.requires = [
      ...new Set([
        ...legacy.requires,
        ...groups.filter((group) => group.category === 'experience').map((group) => group.id),
      ]),
    ];
  }
}
