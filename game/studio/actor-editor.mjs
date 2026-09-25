import { localizedMessage, localizedText, t } from '../i18n/index.mjs';
import { actorEditorCopy, actorRoleKeys, actorRoleName } from './actor-copy.mjs';
import { editorMessageError, showEditorFailure } from './editor-copy.mjs';
import { journeyActors } from '../content-design/catalogs.mjs';
import { editContentActor } from '../content-design/actors.mjs';
import { teamRoleQualified } from '../content-design/team-qualification.mjs';
import { missionEditContext } from './edit-context.mjs';

/** Catalog-only controls. Unsaved fields are local; only an explicit validated
 * command reaches the owning draft session and its undo/checkpoint machinery. */
export function createActorEditor({ document, getSource, getMission, getDifficulty, apply }) {
  const $ = (id) => document.getElementById(`actor-${id}`);
  let revision = null,
    removal = null;
  const context = () => missionEditContext(getSource(), getMission(), getDifficulty());
  const catalog = () => journeyActors(getSource().actorCatalogId);
  const hasHeading = (role) =>
    ['bouncer', 'claimed-rover', 'eroder', 'combat-patrol'].includes(catalog().roles[role]?.type);
  const options = (element, rows) =>
    element.replaceChildren(
      ...rows.map(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        localizedText(option, label);
        return option;
      }),
    );
  // Studio creates editors before opening its draft session. Resolve the exact
  // project catalogue only when the owner calls sync after session adoption.
  $('tools').disabled = true;
  function cancelRemoval() {
    removal = null;
    localizedText($('remove'), localizedMessage('tools:studio.actorEditor.remove'));
  }
  function describe() {
    cancelRemoval();
    const role = catalog().roles[$('role').value];
    const tier = $('tier').value;
    const emitter = role.type === 'lane-boss';
    const sentinel = role.type === 'relay-sentinel';
    const copy = actorEditorCopy({
      roleId: $('role').value,
      actorCatalogId: catalog().id,
      difficultyCatalogId: getSource().difficultyCatalogId,
      difficulty: getDifficulty(),
      combatEnabled: !!getMission()?.combat?.enabled,
    });
    localizedText($('tier-label'), copy.tierLabel);
    options($('tier'), copy.options);
    if (copy.options.some(([id]) => id === tier)) $('tier').value = tier;
    const frontier = $('role').value === 'frontier-patrol';
    localizedText($('position-help'), copy.positionHelp);
    $('heading-row').hidden = !hasHeading($('role').value);
    $('edge-row').hidden = !frontier;
    $('clockwise-row').hidden = hasHeading($('role').value) || emitter || sentinel;
    $('axis-row').hidden = !emitter;
    for (const axis of ['x', 'y']) $(axis).step = frontier ? '1' : '0.5';
    localizedText($('description'), copy.description);
  }
  function select() {
    cancelRemoval();
    const actor = getMission()?.actors.find((entry) => entry.id === $('select').value);
    $('id').value = actor?.id ?? '';
    $('id').disabled = !!actor;
    $('role').value = actor?.role ?? 'field-keeper';
    describe();
    $('tier').value = actor?.tier ?? 'measured';
    $('x').value = actor?.edge?.x ?? actor?.x ?? '';
    $('y').value = actor?.edge?.y ?? actor?.y ?? '';
    $('heading').value = (actor?.heading ?? [1, 1]).join(',');
    $('edge').value = actor?.edge?.side ?? 'east';
    $('clockwise').checked = actor?.clockwise ?? true;
    $('axis').value = actor?.axis ?? 'horizontal';
    localizedText(
      $('submit'),
      localizedMessage(actor ? 'tools:studio.actorEditor.replace' : 'tools:studio.actorEditor.add'),
    );
    $('remove').disabled = !actor;
    localizedText($('result'), localizedMessage('tools:studio.actorEditor.applyFirst'));
  }
  function sync() {
    const mission = getMission();
    $('tools').disabled = !mission;
    const key = context();
    if (key === revision) return;
    revision = key;
    options(
      $('role'),
      Object.entries(actorRoleKeys)
        .filter(
          ([role]) =>
            Object.hasOwn(catalog().roles, role) &&
            (!catalog().roles[role].combatRole || !!mission?.combat) &&
            (role !== 'relay-sentinel' || !!mission?.encounter) &&
            (!mission?.modes.includes('team') || teamRoleQualified(mission.team?.format, role)),
        )
        .map(([role, key]) => [role, localizedMessage(key)]),
    );
    const selected = $('select').value;
    options($('select'), [
      ['', localizedMessage('tools:studio.actorEditor.new')],
      ...(mission?.actors ?? []).map((actor) => [
        actor.id,
        () =>
          t('tools:studio.item.option', {
            name: actorRoleName(actor.role),
            identity: ` · ${actor.id}`,
          }),
      ]),
    ]);
    if (mission?.actors.some((actor) => actor.id === selected)) $('select').value = selected;
    select();
  }
  function commit(command) {
    try {
      if (revision !== context()) throw editorMessageError('errors:studio.actor.contextChanged');
      const mission = getMission();
      if (!mission) throw editorMessageError('errors:studio.existingMission');
      const candidate = editContentActor(getSource(), mission.id, command);
      if (apply(candidate) === false) return;
      revision = null;
      sync();
      $('select').value = command.action === 'remove' ? '' : command.id;
      select();
      localizedText(
        $('result'),
        localizedMessage(
          command.action === 'remove'
            ? 'tools:studio.actorEditor.removed'
            : 'tools:studio.actorEditor.applied',
        ),
      );
    } catch (error) {
      showEditorFailure($('result'), error);
    }
  }
  $('select').onchange = select;
  $('role').onchange = describe;
  $('form').oninput = cancelRemoval;
  $('form').onsubmit = (event) => {
    event.preventDefault();
    cancelRemoval();
    const id = $('id').value.trim(),
      role = $('role').value;
    const actor = { id, role, tier: $('tier').value };
    const x = Number($('x').value),
      y = Number($('y').value);
    if (!$('x').value.trim() || !$('y').value.trim()) {
      showEditorFailure($('result'), editorMessageError('errors:studio.actor.coordinates'));
      return;
    }
    if (role === 'frontier-patrol') actor.edge = { x, y, side: $('edge').value };
    else Object.assign(actor, { x, y });
    if (hasHeading(role)) actor.heading = $('heading').value.split(',').map(Number);
    else if (role === 'lane-emitter') actor.axis = $('axis').value;
    else if (role !== 'relay-sentinel') actor.clockwise = $('clockwise').checked;
    commit({ action: $('select').value ? 'replace' : 'add', id, actor });
  };
  $('remove').onclick = () => {
    const id = $('select').value;
    if (!id) return;
    if (removal !== id) {
      removal = id;
      localizedText(
        $('remove'),
        localizedMessage('tools:studio.actorEditor.confirmRemove', { id }),
      );
      localizedText($('result'), localizedMessage('tools:studio.actorEditor.removeAgain'));
      return;
    }
    cancelRemoval();
    commit({ action: 'remove', id });
  };
  return { sync };
}
