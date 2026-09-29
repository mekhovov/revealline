import { coopCuePalette } from '../../game/couch/coop-cue-palette.mjs';
import { TEAM_EVENT_SLOTS, teamEventSlot } from '../../game/presentation/team-event-slots.mjs';
import { createCoopEventFeedback } from '../../game/couch/coop-event-feedback.mjs';
import { coopEventCaption, drawCoopEventIcon } from '../../game/couch/coop-event-presentation.mjs';
import { createDuel, resumeDuel, stepDuel } from '../../game/multiplayer.mjs';
import { BoardPainter, boardPaintSizeForRun } from '../../game/ui/render.mjs';
import { createCoopPainter } from '../../game/couch/coop-view.mjs';
import { COOP_PICTURE_BINDINGS } from '../../game/couch/coop-picture-bindings.mjs';
import { canonicalJSON } from '../../game/data-json.mjs';
import { hashPresentationBytes } from '../../game/presentation/bundle.mjs';
import { createStudioTeamFixture } from './team-preview-fixture.mjs';
import { TEAM_THREAT_SLOTS, teamThreatSlot } from '../../game/presentation/team-threat-slots.mjs';
import { coopThreatMarkers } from '../../game/couch/coop-threat-presentation.mjs';
import { TEAM_EFFECT_SLOTS, teamEffectSlot } from '../../game/presentation/team-effect-slots.mjs';
import { coopEffectMarkers } from '../../game/couch/coop-effect-presentation.mjs';
import { TEAM_ANCHOR_SLOTS, teamAnchorSlot } from '../../game/presentation/team-anchor-slots.mjs';
import { TEAM_ACTOR_SLOTS, teamActorSlot } from '../../game/presentation/team-actor-slots.mjs';

const teamRoles = Object.freeze([
  'player.scout.compact',
  'player.scout.detailed',
  'enemy.bouncer',
  'enemy.border-patrol',
]);
const yardRoles = ['enemy.relay-sentinel', 'terrain.wall'];
const element = (tag, value = '', className = '') => {
  const node = document.createElement(tag);
  node.textContent = value;
  node.className = className;
  return node;
};
const note = (value) => {
  const node = element('small', value, 'bounded-label');
  node.dataset.studioHost = 'secondary';
  return node;
};
const requireImage = (assets, id) => {
  if (assets[id]?.kind !== 'image')
    throw new Error(`Team preview needs an image revision for ${id}. No substitute was shown.`);
  return assets[id];
};
export function playerTreatmentNote(slotId, width) {
  const selected =
    teamActorSlot(slotId)?.treatment || /^player\.[^.]+\.(compact|detailed)$/.exec(slotId)?.[1];
  if (!selected) return '';
  const active = width < 480 ? 'compact' : 'detailed';
  return selected === active
    ? `Showing the selected ${selected} body at this width.`
    : `Showing the ${active} body at this width. Selected ${selected} artwork is inactive; resize this view or choose Native size to inspect it.`;
}
export function stageBoardPreviewEffect(painter, slot, run) {
  if (slot.group !== 'effects') return;
  const type = {
    failure: 'player.failed',
    pickup: 'powerup.collected',
    shield: 'shield.absorbed',
    respawn: 'player.respawned',
    pressure: 'lineImpact.seeded',
    capture: 'cells.claimed',
    victory: 'run.completed',
  }[slot.id.slice(7)];
  if (type)
    painter.effectsFor(
      [{ type, tick: run.tick, x: run.player.x, y: run.player.y, kind: 'extra-life' }],
      run,
    );
}
function watchWidths(canvases, redraw, own) {
  if (typeof globalThis.ResizeObserver === 'function') {
    const observer = new ResizeObserver(redraw);
    canvases.forEach((canvas) => observer.observe(canvas));
    own(() => observer.disconnect());
  } else if (globalThis.addEventListener) {
    globalThis.addEventListener('resize', redraw);
    own(() => globalThis.removeEventListener('resize', redraw));
  }
}

/** Inspection compatibility is deliberately narrower than a theme publication claim. */
export function teamPreviewBinding(slotId, resolved, arena) {
  const binding = COOP_PICTURE_BINDINGS.find((row) => row.levelId === arena);
  if (!binding) throw new Error('Choose a registered Team preview arena.');
  if (resolved.theme.id !== binding.themeId)
    throw new Error('This edition has no reviewed Team arena binding yet. Choose the FPV theme.');
  const roles = [...teamRoles, ...(arena === 'relay-yard' ? yardRoles : [])];
  roles.push(
    ...TEAM_ACTOR_SLOTS.filter((row) => roles.includes(row.source) && resolved.assets[row.id]).map(
      (row) => row.id,
    ),
  );
  const anchors = [
    ...TEAM_ANCHOR_SLOTS,
    ...TEAM_EFFECT_SLOTS,
    ...TEAM_THREAT_SLOTS,
    ...TEAM_EVENT_SLOTS,
  ].filter((row) => resolved.assets[row.id]);
  for (const row of anchors) {
    const asset = resolved.assets[row.id];
    if (
      asset.kind !== 'image' &&
      !(
        asset.kind === 'recipe' &&
        asset.recipe.id ===
          (teamEventSlot(row.id)
            ? 'team.event.v1'
            : teamThreatSlot(row.id)
              ? 'team.threat.v1'
              : teamEffectSlot(row.id)
                ? 'team.effect.v1'
                : 'team.anchor.v1')
      )
    )
      throw new Error(`Invalid Team objective or cue: ${row.id}.`);
  }
  if (![...roles, ...anchors.map((row) => row.id), binding.picture.slot].includes(slotId))
    throw new Error(
      `${slotId} is not bound in ${arena}. Choose its compatible arena or inspect it in Solo/Versus. Team objectives and feedback have explicit optional slots with procedural defaults.`,
    );
  roles.forEach((id) => requireImage(resolved.assets, id));
  roles.push(
    ...anchors.filter((row) => resolved.assets[row.id].kind === 'image').map((row) => row.id),
  );
  const picture = requireImage(resolved.assets, binding.picture.slot);
  const frame = picture.geometry?.frame;
  if (
    !frame ||
    frame.x !== 0 ||
    frame.y !== 0 ||
    frame.width !== 1152 ||
    frame.height !== 576 ||
    picture.file.width !== 1152 ||
    picture.file.height !== 576
  )
    throw new Error(
      'Team artwork needs its complete 1152×576 frame; cropped or stretched previews are not supported.',
    );
  return { binding, roles, picture };
}

/** A familiar ID is insufficient: the inspected arena must match the approved authored bytes. */
export async function validateTeamPreviewIdentity(binding, level) {
  if (binding.levelId !== level.id || binding.levelRevision !== level.revision)
    throw new Error('Team preview arena identity or revision does not match its artwork binding.');
  const hash = await hashPresentationBytes(new TextEncoder().encode(canonicalJSON(level)));
  if (hash !== binding.levelSha256)
    throw new Error('Team preview arena content does not match its approved artwork binding.');
}

export function createStudioVersusMatch(level, seed = 42) {
  const match = createDuel(level, { seed });
  resumeDuel(match);
  for (let tick = 0; tick < 12; tick++)
    stepDuel(match, [{ direction: 'down' }, { direction: 'right' }]);
  return match;
}

/** All resources belong to this surface. Stop the last registered animation
 * before releasing decoded images and painters on cancellation or replacement. */
export async function crossModeContextPreview(
  surface,
  slot,
  asset,
  resolved,
  blobs,
  options,
  own,
  services,
) {
  const cleanups = [];
  let disposed = false;
  const localOwn = (cleanup) => (disposed ? cleanup() : cleanups.push(cleanup));
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const cleanup of cleanups.reverse()) cleanup();
    cleanups.length = 0;
  };
  own(dispose);
  const current = () => !disposed && options.isCurrent();
  if (!current()) return;
  try {
    const assets = { ...resolved.assets, [slot.id]: asset };
    const inspected = { ...resolved, assets };
    const decoded = new Map();
    localOwn(() => decoded.clear());
    const decode = async (id) => {
      options.onStatus?.(`decoding ${id} for ${options.fieldMode}…`, 'decoding');
      const image = await services.decode(assets[id], blobs, { ...options, isCurrent: current });
      if (!image || !current()) {
        if (image) image.src = '';
        return null;
      }
      localOwn(() => {
        image.src = '';
      });
      decoded.set(id, { asset: assets[id], image });
      return image;
    };

    if (options.fieldMode === 'team') {
      const {
        binding,
        roles,
        picture: pictureAsset,
      } = teamPreviewBinding(slot.id, inspected, options.teamArena || 'first-connection');
      const fixture = createStudioTeamFixture({
        arena: binding.levelId,
        scenario: options.teamScenario || 'initial',
      });
      options.onStatus?.('checking Team arena identity…', 'preparing');
      await validateTeamPreviewIdentity(binding, fixture.level);
      if (!current()) return;
      const declaredTeam = TEAM_ACTOR_SLOTS.filter((row) => inspected.assets[row.id]).map(
        (row) => row.id,
      );
      for (const id of new Set([...roles, ...declaredTeam, binding.picture.slot])) {
        await decode(id);
        if (!current()) return;
      }
      const snapshot = services.presentation(inspected, decoded);
      const canvas = element('canvas');
      canvas.width = 1152;
      canvas.height = 576;
      canvas.setAttribute('aria-label', `Team arena ${fixture.level.name}: ${fixture.label}`);
      const painter = createCoopPainter(canvas);
      const feedback = createCoopEventFeedback();
      feedback.ingest(fixture.run);
      localOwn(() => feedback.reset());
      painter.setPresentation(snapshot);
      localOwn(() => painter.setPresentation(null));
      const picture = {
        snapshot,
        image: decoded.get(binding.picture.slot).image,
        fit: 'contain',
        sampling: 'nearest',
        choice: {
          kind: 'image',
          levelId: fixture.level.id,
          levelRevision: fixture.level.revision,
          slot: binding.picture.slot,
          assetId: pictureAsset.id,
          assetRevision: pictureAsset.revision,
        },
      };
      const frame = element('div', '', 'board-context-frame');
      const hud = element('div', '', 'context-hud');
      const treatment = note('');
      const stateUsage = note('');
      hud.dataset.studioHost = 'secondary';
      const eventStatus = element('p', '', 'context-team-event');
      const eventColours = coopCuePalette(snapshot.canvas.palette);
      eventStatus.style.color = eventColours.text;
      eventStatus.style.backgroundColor = eventColours.back;
      const eventIcon = element('canvas', '', 'context-team-event-icon');
      eventIcon.width = eventIcon.height = 32;
      eventIcon.setAttribute('aria-hidden', 'true');
      eventIcon.hidden = true;
      const eventCaption = element('span');
      eventStatus.append(eventIcon, eventCaption);
      eventStatus.hidden = true;
      frame.append(hud, canvas, eventStatus);
      surface.append(
        frame,
        treatment,
        stateUsage,
        note(
          `Actual Team painter · ${fixture.level.name} · ${fixture.label} · 72 × 36 cells. Picture ${pictureAsset.id}@${pictureAsset.revision}; inspected collection, not publication approval. Relay anchors retain runtime labels and borders; shields and Support use shared procedural cues.`,
        ),
      );
      let lastReduced = true;
      let sampledAttempt = null;
      const render = (dt, reduced) => {
        if (!current()) return;
        lastReduced = reduced;
        const prime = () => {
          if (fixture.scenario.startsWith('crawling-') && sampledAttempt !== fixture.run) {
            fixture.prime((run) => painter.paint(run, { reduced, picture }));
            sampledAttempt = fixture.run;
          }
        };
        prime();
        if (options.motion === 'playing' && !reduced)
          fixture.advance(dt, (run) => feedback.ingest(run));
        prime(); // A bounded motion loop may have restored its selected state.
        const run = fixture.run;
        feedback.ingest(run); // Includes the selected last-tick event after a private loop reset.
        const receipts = feedback.snapshot(run);
        // Terminal simulations keep their last-step events and stop the clock.
        // Retain those facts in feedback, but completion owns the visible guidance.
        const terminal = run.status === 'won' || run.status === 'lost';
        const receipt = terminal ? null : receipts.at(-1);
        eventStatus.hidden = !terminal && !receipt;
        eventCaption.textContent =
          run.status === 'won'
            ? 'Arena complete. Full artwork revealed; choose another preview state to inspect play.'
            : run.status === 'lost'
              ? 'Attempt ended. Choose another preview state to inspect play.'
              : coopEventCaption(receipt);
        drawCoopEventIcon(eventIcon, receipt && painter.eventFrame(receipt.kind), receipt, {
          time: run.time,
          reduced: reduced || snapshot.canvas.motionScale === 0,
        });
        painter.paint(run, { reduced, picture });
        if (teamActorSlot(slot.id)) {
          const shown = [
            ...run.players.map((actor) => painter.actorFrame('pilot', actor.id)),
            ...run.enemies.map((actor) => painter.actorFrame('enemy', actor.id)),
            ...(run.strongholds || []).map((actor) => painter.actorFrame('core', actor.id)),
          ].some((actor) => actor?.sourceSlot === slot.id);
          stateUsage.textContent = shown
            ? 'The selected Team body state is visible in this frame.'
            : 'The selected Team body state is inactive here. Choose its matching scenario or play motion; use Native size to inspect the artwork directly.';
        } else if (teamEventSlot(slot.id)) {
          const active = receipt?.kind === teamEventSlot(slot.id).state;
          stateUsage.textContent = active
            ? 'The selected event is retained from an actual simulation step. Its icon appears beside the authoritative caption, outside playable cells.'
            : 'The selected event is inactive. Choose Joint capture in either arena, or Team reserve recovery in Relay Yard. Personal rescue does not activate shared recovery.';
        } else if (teamThreatSlot(slot.id)) {
          const active = coopThreatMarkers(run).some((marker) => marker.slot === slot.id);
          stateUsage.textContent = active
            ? 'The selected threat state is active at its exact runtime position, beneath functional markers; shield art sits behind its core.'
            : 'The selected threat state is inactive. Choose Relay Yard initial shield, Emitter warning or Travelling spark; First Connection has no strongholds.';
        } else if (teamEffectSlot(slot.id)) {
          const active =
            run.status !== 'won' &&
            coopEffectMarkers(run).some((marker) => marker.slot === slot.id);
          stateUsage.textContent = active
            ? 'The selected feedback state is active. Runtime cues remain authoritative; uploaded badges appear where nearby space permits.'
            : 'The selected feedback state is inactive. Choose Support pulse, Slowed enemies, Rescue or Recovered player; First Connection has no earned rescue/recovery preview yet.';
        } else if (teamAnchorSlot(slot.id)) {
          const captured = teamAnchorSlot(slot.id).state === 'captured';
          const shown =
            run.status !== 'won' &&
            (run.strongholds || []).some((core) =>
              core.anchors.some((anchor) => anchor.captured === captured),
            );
          stateUsage.textContent = shown
            ? 'The selected Team anchor state is visible beneath its runtime label and border.'
            : 'The selected Team anchor state is inactive here. Choose Relay Yard and its initial or captured-anchor scene; First Connection has no anchors.';
        } else stateUsage.hidden = true;
        const players = run.players.map((player, index) => {
          const rescue = player.rescue
            ? `rescuing ${Math.round((run.time - player.rescue.startedAt) * 100)}%`
            : player.status;
          return `P${index + 1} ${rescue}`;
        });
        hud.textContent = `${players.join(' · ')} · ${Math.round(run.coverage * 100)}% · reserves ${run.team.reserves}`;
        treatment.textContent = playerTreatmentNote(slot.id, canvas.clientWidth || 1152);
        treatment.hidden = !treatment.textContent;
      };
      watchWidths([canvas], () => render(0, lastReduced), localOwn);
      services.loop(localOwn, render, options);
      return;
    }

    if (options.fieldMode !== 'versus') throw new Error('Unknown field preview mode.');
    options.onStatus?.('loading both Versus board fixtures…', 'downloading');
    const owner = options.pictureOwner || options.sourcePicture;
    const context = await services.context(slot.id, owner);
    if (!current()) return;
    const match = createStudioVersusMatch(context.level, owner?.descriptor?.seed ?? 42);
    const classId = slot.id.startsWith('player.') ? slot.id.split('.')[1] : 'scout';
    let background = options.sourcePicture?.image || null;
    for (const [id, candidate] of Object.entries(assets)) {
      if (candidate?.kind !== 'image') continue;
      const isBackground = id === slot.id && slot.group === 'pictures';
      if (
        !isBackground &&
        !services.imageRoles[id] &&
        ![`player.${classId}.compact`, `player.${classId}.detailed`].includes(id)
      )
        continue;
      const image = await decode(id);
      if (!current()) return;
      if (isBackground) background = image;
    }
    const snapshot = services.presentation(inspected, decoded);
    const theme = { ...context.theme, palette: snapshot.canvas.palette };
    const grid = element('div', '', 'board-context-versus');
    const boards = [];
    for (let index = 0; index < 2; index++) {
      const painter = new BoardPainter(context.presets);
      localOwn(() => {
        painter.loadToken++;
        painter.enemyBodies.clear();
        painter.setPresentation(null);
        painter.images = {};
        painter.image = null;
      });
      await painter.setLook(theme, services.bodyIds[classId] || services.bodyIds.scout);
      if (!current()) return;
      painter.setLevel(context.level, { seed: owner?.descriptor?.seed ?? 42 });
      painter.setPresentation(snapshot);
      stageBoardPreviewEffect(painter, slot, match.runs[index]);
      if (background) painter.images.background = background;
      const canvas = element('canvas');
      const size = boardPaintSizeForRun(match.runs[index]);
      canvas.width = size.width;
      canvas.height = size.height;
      canvas.setAttribute(
        'aria-label',
        `Versus Player ${index + 1}: independent ${context.level.name} board`,
      );
      const frame = element('div', '', 'board-context-frame');
      const hud = element(
        'div',
        `PLAYER ${index + 1} · ${Math.round(match.runs[index].coverage * 100)}%`,
        'context-hud',
      );
      hud.dataset.studioHost = 'secondary';
      const treatment = note('');
      frame.append(hud, canvas, treatment);
      grid.append(frame);
      boards.push({ painter, canvas, treatment, run: match.runs[index] });
    }
    surface.append(
      grid,
      note(
        `Two independent Versus BoardPainters · ${context.level.name}. Shared inspected artwork and responsive actor roles; isolated held runs, not live controls, results or progression.`,
      ),
    );
    let gallery = false;
    let lastReduced = true;
    const render = (dt, reduced) => {
      if (!current()) return;
      lastReduced = reduced;
      for (const { painter, canvas, treatment, run } of boards) {
        treatment.textContent = playerTreatmentNote(slot.id, Math.max(1, canvas.clientWidth));
        treatment.hidden = !treatment.textContent;
        if (gallery)
          painter.drawGallery(canvas.getContext('2d'), {
            theme,
            level: context.level,
            image: painter.images.background,
            fit: owner?.fit || 'cover',
          });
        else
          painter.draw(canvas.getContext('2d'), run, dt, {
            paused: options.motion !== 'playing',
            reduced,
            showGrid: true,
            displayCSSWidth: Math.max(1, canvas.clientWidth),
            ...(owner
              ? {
                  backdrop: {
                    image: painter.images.background,
                    fit: owner.fit,
                    sampling: owner.sampling,
                  },
                }
              : {}),
          });
      }
    };
    if (slot.group === 'pictures') {
      const button = element('button', 'Show both picture viewers');
      button.type = 'button';
      button.dataset.studioHost = 'control';
      button.onclick = () => {
        gallery = !gallery;
        button.textContent = gallery ? 'Show concealed boards' : 'Show both picture viewers';
        render(0, true);
      };
      surface.append(button);
    }
    watchWidths(
      boards.map(({ canvas }) => canvas),
      () => render(0, lastReduced),
      localOwn,
    );
    services.loop(localOwn, render, options);
  } catch (error) {
    dispose();
    throw error;
  }
}
