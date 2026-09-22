import {
  journeyActors,
  journeyPreset,
  journeyLaneTiming,
  journeySentinelTiming,
  journeyPressureTiming,
  journeyCombatTiming,
} from '../content-design/catalogs.mjs';
import { editContentActor } from '../content-design/actors.mjs';
import { teamRoleQualified } from '../content-design/team-qualification.mjs';
import { missionEditContext } from './edit-context.mjs';

const names = {
  'field-keeper': 'Field keeper',
  'perimeter-patrol': 'Outer-perimeter patrol',
  'frontier-patrol': 'Moving-frontier patrol',
  'reclaimed-roamer': 'Reclaimed-ground roamer',
  'territory-eroder': 'Territory eroder',
  'impact-carrier': 'Trail-impact carrier',
  'lane-emitter': 'Lane emitter',
  'relay-sentinel': 'Shield-relay Sentinel',
  'trail-pursuer': 'Trail pursuer',
  'heading-interceptor': 'Heading interceptor',
  'optional-scout': 'Optional removable scout',
  'optional-sentry': 'Optional firing sentry',
};

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
        option.textContent = label;
        return option;
      }),
    );
  // Studio creates editors before opening its draft session. Resolve the exact
  // project catalogue only when the owner calls sync after session adoption.
  $('tools').disabled = true;
  function cancelRemoval() {
    removal = null;
    $('remove').textContent = 'Remove selected actor';
  }
  function describe() {
    cancelRemoval();
    const role = catalog().roles[$('role').value];
    const tier = $('tier').value;
    const emitter = role.type === 'lane-boss';
    const sentinel = role.type === 'relay-sentinel';
    const difficultyCatalogId = getSource().difficultyCatalogId;
    const preset = journeyPreset(getDifficulty(), difficultyCatalogId);
    const sentinelTiming = journeySentinelTiming(getDifficulty(), difficultyCatalogId);
    const tiers = sentinel ? { measured: 0 } : emitter ? role.timings : role.speeds;
    $('tier-label').textContent = sentinel
      ? preset.attackRestFactor === undefined
        ? 'Shared Sentinel recipe · fixed cadence'
        : 'Shared Sentinel recipe · selected difficulty, fixed warning'
      : emitter
        ? 'Cadence tier · fixed warning in every difficulty'
        : 'Speed tier · selected difficulty';
    options(
      $('tier'),
      Object.entries(tiers).map(([id, value]) => [
        id,
        sentinel
          ? `measured · shared two-stage recipe · ${sentinelTiming.shielded.warningTicks / 120}s warning / ${sentinelTiming.shielded.restTicks / 120}s rest / ${sentinelTiming.exposed.openTicks / 120}s core open`
          : emitter
            ? `${id} · ${value.warningSeconds}s warning / ${value.activeSeconds}s active / ${Number(journeyLaneTiming(value, getDifficulty(), difficultyCatalogId).period.toFixed(4))}s cycle`
            : `${id} · ${Number((value * preset.enemySpeedFactor).toFixed(3))} cells/s`,
      ]),
    );
    if (Object.hasOwn(tiers, tier)) $('tier').value = tier;
    const frontier = $('role').value === 'frontier-patrol';
    $('position-help').textContent = sentinel
      ? 'The Sentinel must share the core objective cell. Use Stage a Sentinel encounter to move the boss/core binding or replace shield links atomically.'
      : frontier
        ? 'Integer field cell beside reclaimed ground; choose its side facing that ground.'
        : $('role').value === 'reclaimed-roamer'
          ? 'Use cell centres ending in .5. Dormant in field; after its body is reclaimed it warns for 120 actor ticks, then roams reclaimed ground.'
          : $('role').value === 'territory-eroder'
            ? 'Start in unclaimed field. Eligible frontier contact marks one cell for 60 actor ticks before reopening it, followed by a 120 actor-tick cooldown. Foundations are permanent.'
            : $('role').value === 'impact-carrier'
              ? `Start in unclaimed field. Trail impacts travel at the shared ${role.impactSpeed} cells/s in every preset. Only this marked role creates fronts; body contact is still dangerous.`
              : emitter
                ? `Stationary in unclaimed field. First warning starts after 2 actor seconds, then locks a row or column. The ${role.laneWidth}-cell lane does not damage reclaimed ground; this emitter still retains field.`
                : 'Board coordinates in cells. Cell centres use .5; outer patrols must start on the perimeter.';
    $('heading-row').hidden = !hasHeading($('role').value);
    $('edge-row').hidden = !frontier;
    $('clockwise-row').hidden = hasHeading($('role').value) || emitter || sentinel;
    $('axis-row').hidden = !emitter;
    for (const axis of ['x', 'y']) $(axis).step = frontier ? '1' : '0.5';
    $('description').textContent =
      `${role.domain} · hits ${role.damageTarget} · ${role.retainsField ? 'Retains its field region.' : 'Does not retain field regions.'} ${role.counterplay}`;
    if (role.pressureRecipe) {
      const timing = journeyPressureTiming(
        $('role').value,
        getDifficulty(),
        catalog().id,
        difficultyCatalogId,
      );
      $('position-help').textContent =
        `Start in unclaimed field. Locked target: ${timing.warningTicks / 120}s warning / ${timing.commitTicks / 120}s commitment / ${timing.cooldownTicks / 120}s recovery. Sense radius ${timing.senseRadius} cells; no tracking after target lock. Closure cancels the attack. Body and trail contact remain dangerous.`;
    }
    if (role.combatRole) {
      const timing = journeyCombatTiming(
        $('role').value,
        getDifficulty(),
        catalog().id,
        difficultyCatalogId,
      );
      $('position-help').textContent =
        `Use field cell centres ending in .5 with two cells of spawn clearance. ${getMission()?.combat?.enabled ? 'Combat enabled.' : 'Inactive authored actor; combat is disabled.'} Removed by craft contact or capture; never retains field.${role.combatRole === 'sentry' ? ` ${timing.openingTicks / 120}s opening / ${timing.warningTicks / 120}s locked warning / ${timing.recoveryTicks / 120}s recovery / ${timing.restTicks / 120}s rest. Only its projectile harms the craft.` : ' No contact damage.'}`;
    }
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
          (!catalog().roles[role].combatRole || !!mission?.combat) &&
          (role !== 'relay-sentinel' || !!mission?.encounter) &&
          (!mission?.modes.includes('team') || teamRoleQualified(mission.team?.format, role)),
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
    else if (role === 'lane-emitter') actor.axis = $('axis').value;
    else if (role !== 'relay-sentinel') actor.clockwise = $('clockwise').checked;
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
