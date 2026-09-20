import { boundedJSON, exactKeys, required, stableId, dataIdentity } from '../data-json.mjs';
import { compileContentProject } from './project.mjs';
import { createStarterProject } from './starter.mjs';
import { createTeamOpeningCandidates } from './team-candidates.mjs';

const kinds = Object.freeze({ mission: 'missions', campaign: 'campaigns', pack: 'packs' });
const named = (name) => typeof name === 'string' && name.trim() && name.length <= 160;

function removalDependencies(project, kind, id) {
  const dependencies = [];
  if (kind === 'mission')
    for (const campaign of project.campaigns)
      if (campaign.missionIds.includes(id))
        dependencies.push({ kind: 'campaign', id: campaign.id, relation: 'parent' });
  if (kind === 'campaign') {
    for (const pack of project.packs)
      if (pack.campaignIds.includes(id))
        dependencies.push({ kind: 'pack', id: pack.id, relation: 'parent' });
    for (const missionId of project.campaigns.find((entry) => entry.id === id).missionIds)
      dependencies.push({ kind: 'mission', id: missionId, relation: 'member' });
  }
  if (kind === 'pack')
    for (const campaignId of project.packs.find((entry) => entry.id === id).campaignIds)
      dependencies.push({ kind: 'campaign', id: campaignId, relation: 'member' });
  return dependencies;
}

/** Read-only impact preview. Deletion never cascades through shared membership,
 * maps or assets. Callers must still revalidate when applying the command. */
export function inspectContentRemoval(source, kind, id) {
  const project = compileContentProject(source).source;
  required(
    typeof kind === 'string' && Object.hasOwn(kinds, kind) && stableId(id),
    'Choose an existing content item.',
  );
  const item = project[kinds[kind]].find((entry) => entry.id === id);
  required(item, 'Choose an existing content item.');
  const dependencies = removalDependencies(project, kind, id);
  return Object.freeze({
    kind,
    id,
    name: item.name,
    deletable: dependencies.length === 0,
    dependencies: Object.freeze(dependencies.map(Object.freeze)),
    retainsMapsAndAssets: true,
  });
}

/** Candidate-only structural edits. The same compiler gates every caller.
 * No storage, publication or progress side effects; callers own undo/checkpoints.
 * Duplicated missions share an immutable map pin until forkMissionMap edits it.
 */
export function editContentStructure(source, input) {
  const project = structuredClone(compileContentProject(source).source);
  const command = boundedJSON(input, { maxBytes: 4096, maxNodes: 32, maxDepth: 2 });
  exactKeys(
    command,
    [
      'action',
      'kind',
      'id',
      'name',
      'sourceId',
      'parentId',
      'band',
      'offset',
      'confirmationId',
      'template',
    ],
    'structure command',
  );
  const { action, kind, id, name } = command;
  const actionKeys = {
    create: ['name', 'parentId', 'band', 'template'],
    duplicate: ['name', 'sourceId', 'parentId'],
    rename: ['name'],
    place: ['parentId'],
    reorder: ['parentId', 'offset'],
    detach: ['parentId'],
    delete: ['confirmationId'],
    archive: [],
    restore: [],
  };
  required(Object.hasOwn(actionKeys, action), 'Unsupported structure action.');
  exactKeys(command, ['action', 'kind', 'id', ...actionKeys[action]], 'structure action');
  required(command.band === undefined || kind === 'campaign', 'Only campaigns have a band.');
  required(
    command.template === undefined ||
      (kind === 'mission' && ['solo-island', 'team-islands'].includes(command.template)),
    'Choose a supported mission template.',
  );
  required(command.parentId === undefined || kind !== 'pack', 'Packs belong to the project.');
  required(Object.hasOwn(kinds, kind), 'Choose mission, campaign or pack.');
  required(
    stableId(id),
    'Use a stable item ID (1–80 letters, digits, dots, underscores or hyphens).',
  );
  const entries = project[kinds[kind]],
    existing = entries.find((entry) => entry.id === id),
    changedParents = new Set();
  function parentList() {
    if (kind === 'pack') {
      required(command.parentId === undefined, 'Packs are ordered at project level.');
      return project.packs;
    }
    const parentKind = kind === 'mission' ? 'campaigns' : 'packs';
    const parent = project[parentKind].find((entry) => entry.id === command.parentId);
    required(parent, `Choose an existing ${kind === 'mission' ? 'campaign' : 'pack'}.`);
    changedParents.add(parent);
    return parent[kind === 'mission' ? 'missionIds' : 'campaignIds'];
  }
  function append() {
    if (kind === 'pack' || command.parentId === undefined) return;
    const list = parentList();
    required(!list.includes(id), 'This item is already in the selected parent.');
    list.push(id);
  }
  if (action === 'create' || action === 'duplicate') {
    required(!existing, 'That ID already exists; choose a new one.');
    required(named(name), 'Give the item a name (1–160 characters).');
    if (action === 'duplicate') {
      required(
        kind === 'mission',
        'Duplicate a mission; campaign and pack membership is managed explicitly.',
      );
      const original = entries.find((entry) => entry.id === command.sourceId);
      required(original, 'Choose an existing mission to duplicate.');
      const copy = { ...structuredClone(original), id, name, revision: 'draft-1' };
      delete copy.archived;
      entries.push(copy);
    } else if (kind === 'mission') {
      const starter =
          command.template === 'team-islands'
            ? createTeamOpeningCandidates()
            : createStarterProject(),
        mission = starter.missions[0],
        map = starter.maps[0];
      required(
        !project.maps.some((entry) => entry.id === id),
        'The starter map ID is already used; choose a new ID.',
      );
      map.id = id;
      map.name = name;
      mission.id = id;
      mission.name = name;
      mission.map.id = id;
      project.maps.push(map);
      entries.push(mission);
    } else
      entries.push({
        format: kind === 'campaign' ? 'CampaignDesignV1' : 'PackDesignV1',
        id,
        name,
        revision: 'draft-1',
        ...(kind === 'campaign' ? { band: command.band, missionIds: [] } : { campaignIds: [] }),
      });
    append();
  } else {
    required(existing, 'Choose an existing item.');
    if (action === 'rename') {
      required(named(name), 'Give the item a name (1–160 characters).');
      existing.name = name;
      existing.revision = `draft-${dataIdentity({ id, name, previous: existing.revision })}`;
    } else if (action === 'place') {
      required(kind !== 'pack', 'Packs already belong to this project.');
      required(command.parentId !== undefined, 'Choose the destination parent.');
      append();
    } else if (action === 'reorder') {
      required(
        command.offset === -1 || command.offset === 1,
        'Move one position earlier or later.',
      );
      const list = parentList(),
        index = list.findIndex((entry) => (kind === 'pack' ? entry.id : entry) === id);
      required(index >= 0, 'The item does not belong to this parent.');
      const next = index + command.offset;
      required(next >= 0 && next < list.length, 'Already at the end of this order.');
      [list[index], list[next]] = [list[next], list[index]];
    } else if (action === 'detach') {
      required(kind !== 'pack', 'Packs belong directly to the project.');
      const list = parentList(),
        index = list.indexOf(id);
      required(index >= 0, 'The item does not belong to this parent.');
      list.splice(index, 1);
    } else if (action === 'delete') {
      required(command.confirmationId === id, 'Confirm deletion with the exact item ID.');
      const dependencies = removalDependencies(project, kind, id);
      required(
        !dependencies.length,
        `Remove memberships before deleting: ${dependencies.map((entry) => `${entry.kind} ${entry.id} (${entry.relation})`).join(', ')}.`,
      );
      entries.splice(entries.indexOf(existing), 1);
    } else if (action === 'archive' || action === 'restore') {
      required(
        (existing.archived === true) !== (action === 'archive'),
        action === 'archive' ? 'This item is already archived.' : 'This item is not archived.',
      );
      if (action === 'archive') existing.archived = true;
      else delete existing.archived;
      existing.revision = `draft-${dataIdentity(existing)}`;
    } else throw new TypeError('Unsupported structure action.');
  }
  for (const parent of changedParents) parent.revision = `draft-${dataIdentity(parent)}`;
  project.revision = `draft-${dataIdentity(project)}`;
  return structuredClone(compileContentProject(project).source);
}
