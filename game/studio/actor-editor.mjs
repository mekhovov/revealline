import { journeyActors, journeyPreset } from '../content-design/catalogs.mjs';
import { editContentActor } from '../content-design/actors.mjs';
import { missionEditContext } from './edit-context.mjs';

const names = {
  'field-keeper': 'Field keeper',
  'perimeter-patrol': 'Outer-perimeter patrol',
  'frontier-patrol': 'Moving-frontier patrol',
  'reclaimed-roamer': 'Reclaimed-ground roamer',
};

/** Catalog-only controls. Unsaved fields are local; only an explicit validated
 * command reaches the owning draft session and its undo/checkpoint machinery. */
export function createActorEditor({ document, getSource, getMission, getDifficulty, apply }) {
  const $ = (id) => document.getElementById(`actor-${id}`);
  let revision = null,
    removal = null;
  const context = () => missionEditContext(getSource(), getMission(), getDifficulty());
  const catalog = () => journeyActors(getSource().actorCatalogId);
  const hasHeading = (role) => ['field-keeper', 'reclaimed-roamer'].includes(role);
  const options = (element, rows) =>
    element.replaceChildren(
      ...rows.map(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        return option;
      }),
    );
  options(
    $('role'),
    Object.entries(names).filter(([role]) => Object.hasOwn(catalog().roles, role)),
  );
  function cancelRemoval() {
    removal = null;
    $('remove').textContent = 'Remove selected actor';
  }
  function describe() {
    cancelRemoval();
    const role = catalog().roles[$('role').value];
    const tier = $('tier').value;
    options(
      $('tier'),
      Object.entries(role.speeds).map(([id, speed]) => [
        id,
        `${id} · ${Number((speed * journeyPreset(getDifficulty()).enemySpeedFactor).toFixed(3))} cells/s`,
      ]),
    );
    if (Object.hasOwn(role.speeds, tier)) $('tier').value = tier;
    const frontier = $('role').value === 'frontier-patrol';
    $('position-help').textContent = frontier
      ? 'Integer field cell beside reclaimed ground; choose its side facing that ground.'
      : $('role').value === 'reclaimed-roamer'
        ? 'Use cell centres ending in .5. Dormant in field; after its body is reclaimed it warns for 120 actor ticks, then roams reclaimed ground.'
        : 'Board coordinates in cells. Cell centres use .5; outer patrols must start on the perimeter.';
    $('heading-row').hidden = !hasHeading($('role').value);
    $('edge-row').hidden = !frontier;
    $('clockwise-row').hidden = hasHeading($('role').value);
    for (const axis of ['x', 'y']) $(axis).step = frontier ? '1' : '0.5';
    $('description').textContent =
      `${role.domain} · hits ${role.damageTarget} · ${role.retainsField ? 'Retains its field region.' : 'Does not retain field regions.'} ${role.counterplay}`;
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
    $('submit').textContent = actor ? 'Validate & replace actor' : 'Validate & add actor';
    $('remove').disabled = !actor;
    $('result').textContent =
      'Apply fields before selecting another actor or editing the draft. Nothing is published.';
  }
  function sync() {
    const mission = getMission();
    $('tools').disabled = !mission;
    const key = context();
    if (key === revision) return;
    revision = key;
    options(
      $('role'),
      Object.entries(names).filter(
        ([role]) =>
          Object.hasOwn(catalog().roles, role) &&
          (!mission?.modes.includes('team') || role === 'field-keeper'),
      ),
    );
    const selected = $('select').value;
    options($('select'), [
      ['', '+ New actor'],
      ...(mission?.actors ?? []).map((actor) => [actor.id, `${names[actor.role]} · ${actor.id}`]),
    ]);
    if (mission?.actors.some((actor) => actor.id === selected)) $('select').value = selected;
    select();
  }
  function commit(command) {
    try {
      if (revision !== context())
        throw new Error('The draft context changed. Refresh the actor selection before applying.');
      const mission = getMission();
      if (!mission) throw new Error('Choose a mission.');
      const candidate = editContentActor(getSource(), mission.id, command);
      if (apply(candidate) === false) return;
      revision = null;
      sync();
      $('select').value = command.action === 'remove' ? '' : command.id;
      select();
      $('result').textContent =
        `Actor ${command.action === 'remove' ? 'removed' : 'applied'} to the local draft. All supported modes and presets compiled. Undo is available; preview before publishing.`;
    } catch (error) {
      $('result').textContent = `Not applied: ${error.message}`;
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
      $('result').textContent = 'Not applied: enter both coordinates.';
      return;
    }
    if (role === 'frontier-patrol') actor.edge = { x, y, side: $('edge').value };
    else Object.assign(actor, { x, y });
    if (hasHeading(role)) actor.heading = $('heading').value.split(',').map(Number);
    else actor.clockwise = $('clockwise').checked;
    commit({ action: $('select').value ? 'replace' : 'add', id, actor });
  };
  $('remove').onclick = () => {
    const id = $('select').value;
    if (!id) return;
    if (removal !== id) {
      removal = id;
      $('remove').textContent = `Confirm remove ${id}`;
      $('result').textContent =
        'Activate Remove again to remove this actor. Undo remains available.';
      return;
    }
    cancelRemoval();
    commit({ action: 'remove', id });
  };
  return { sync };
}
