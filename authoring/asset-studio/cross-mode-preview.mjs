import {
  t,
  localizedText,
  localizedAttribute,
  localizedMessage,
  formatNumber,
} from '../../game/i18n/index.mjs';
import { TEAM_OUTCOME_SLOTS } from '../../game/couch/coop-outcome-presentation.mjs';
import { TEAM_ENEMY_SLOTS } from '../../game/couch/coop-enemy-slots.mjs';
import { TEAM_PILOT_SLOTS } from '../../game/couch/coop-pilot-slots.mjs';
import {
  TEAM_RESCUE_SLOTS,
  teamRescueProgress,
} from '../../game/couch/coop-rescue-presentation.mjs';
import { TEAM_EMITTER_SLOTS } from '../../game/couch/coop-emitter-presentation.mjs';
import { TEAM_SUPPORT_SLOTS } from '../../game/couch/coop-support-presentation.mjs';
import { TEAM_CORE_SLOTS, teamCoreState } from '../../game/couch/coop-core-presentation.mjs';
import { TEAM_ANCHOR_SLOTS } from '../../game/couch/coop-anchor-presentation.mjs';
import { createDuel, resumeDuel, stepDuel } from '../../game/multiplayer.mjs';
import { BoardPainter, boardPaintSizeForRun } from '../../game/ui/render.mjs';
import { createCoopPainter } from '../../game/couch/coop-view.mjs';
import { COOP_PICTURE_BINDINGS } from '../../game/couch/coop-picture-bindings.mjs';
import { canonicalJSON } from '../../game/data-json.mjs';
import { hashPresentationBytes } from '../../game/presentation/bundle.mjs';
import { createStudioTeamFixture } from './team-preview-fixture.mjs';

const teamRoles = Object.freeze([
  'player.scout.compact',
  'player.scout.detailed',
  'enemy.bouncer',
  'enemy.border-patrol',
]);
const yardRoles = ['enemy.relay-sentinel', 'terrain.wall'];
const objectiveSlots = [...TEAM_ANCHOR_SLOTS, ...TEAM_CORE_SLOTS];
const element = (tag, value = '', className = '') => {
  const node = document.createElement(tag);
  localizedText(node, typeof value === 'function' ? value : () => value);
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
    throw new Error(t('tools:studio.crossMode.teamPreviewImageRequired', { id }));
  return assets[id];
};
export function teamObjectivePreviewNote(slotId, run) {
  if (!objectiveSlots.includes(slotId)) return null;
  if (run.status === 'won')
    return t('tools:completedArenaShowsTheRevealedPictureObjectiveArtworkIsHidden');
  const state = slotId.split('.').at(-1);
  const count = TEAM_ANCHOR_SLOTS.includes(slotId)
    ? (run.strongholds || [])
        .flatMap((item) => item.anchors)
        .filter((anchor) => anchor.captured === (state === 'captured')).length
    : (run.strongholds || []).filter((item) => teamCoreState(item) === state).length;
  return count
    ? t(
        TEAM_ANCHOR_SLOTS.includes(slotId)
          ? 'tools:studio.crossMode.objectiveAnchorsShown'
          : 'tools:studio.crossMode.objectiveCoresShown',
        { count, state: t(`tools:studio.crossMode.state.${state}`) },
      )
    : t('tools:theSelectedObjectiveStateIsInactiveInThisSceneChoose');
}
export function teamEnemyPreviewNote(slotId, painter, run) {
  if (!TEAM_ENEMY_SLOTS.includes(slotId)) return null;
  if (run.status === 'won')
    return t('tools:completedTeamArtworkHidesEnemyBodiesChooseAnActiveTeam');
  const frames = run.enemies
      .filter((e) => e.active !== false)
      .map((e) => painter.actorFrame('enemy', e.id))
      .filter(Boolean),
    visible = frames.filter((f) => f.sourceSlot === slotId),
    inherited = frames.filter((f) => f.stateSlot === slotId);
  if (visible.length)
    return t('tools:studio.crossMode.enemyBodiesShown', {
      count: visible.length,
      slotId,
    });
  if (inherited.length)
    return t('tools:studio.crossMode.enemySharedBody', { slotId: inherited[0].sourceSlot });
  return t('tools:studio.crossMode.enemyInactive', {
    roles:
      [...new Set(frames.map((f) => f.stateSlot ?? f.sourceSlot))].join(', ') ||
      t('tools:studio.crossMode.none'),
  });
}
export function teamPilotPreviewNote(slotId, painter, run) {
  if (!TEAM_PILOT_SLOTS.includes(slotId)) return null;
  if (run.status === 'won')
    return t('tools:completedArenaHidesPlayerBodiesBehindTheRevealedPictureInspect');
  const seat = Number(slotId.split('.')[2].slice(1)) - 1,
    frame = painter.actorFrame('pilot', seat);
  if (frame?.sourceSlot === slotId)
    return t('tools:studio.crossMode.pilotBodyShown', {
      player: seat + 1,
      state: t(`tools:studio.crossMode.state.${frame.pilotState}`),
    });
  if (frame?.stateSlot === slotId)
    return t('tools:studio.crossMode.pilotSharedBody', { slotId: frame.sourceSlot });
  return t('tools:studio.crossMode.pilotInactive', {
    player: seat + 1,
    state: frame?.pilotState
      ? t(`tools:studio.crossMode.state.${frame.pilotState}`)
      : t('tools:studio.crossMode.unavailable'),
    slotId: frame?.sourceSlot ?? t('tools:studio.crossMode.noBody'),
  });
}
export function teamRescuePreviewNote(run) {
  if (run.status === 'won')
    return t('tools:completedArenaHidesRescueAndRecoveryDecorationBehindTheRevealed');
  const rescues = run.players
    .map((player) => ({ player, rescue: teamRescueProgress(run, player) }))
    .filter((row) => row.rescue);
  const recovering = run.players
    .filter((player) => player.status === 'active' && player.graceUntil > run.time)
    .map((player) => player.id + 1);
  const progress = rescues.length
    ? rescues
        .map(({ player, rescue }) =>
          t('tools:studio.crossMode.rescueProgress', {
            player: player.id + 1,
            target: rescue.target + 1,
            progress: formatNumber(Math.floor(rescue.progress * 100)),
          }),
        )
        .join(' · ')
    : t('tools:noActiveContactRescue');
  const grace = recovering.length
    ? t('tools:studio.crossMode.recoveryGrace', { players: recovering.join(', ') })
    : t('tools:noRecoveryGrace');
  return t('tools:studio.crossMode.rescueSummary', { progress, grace });
}
export function teamEmitterPreviewNote(run) {
  if (run.status === 'won')
    return t('tools:completedArenaHidesEmitterEffectsBehindTheRevealedPicture');
  const warnings = (run.strongholds || []).filter(
    (hold) => hold.emitter?.phase === 'warning' && Number.isInteger(hold.emitter.cellIndex),
  ).length;
  const sparks = (run.impacts || []).length;
  return t('tools:studio.crossMode.emitterSummary', {
    warnings: t('tools:studio.crossMode.emitterWarnings', { count: warnings }),
    sparks: t('tools:studio.crossMode.travellingSparks', { count: sparks }),
  });
}
export function teamSupportPreviewNote(run) {
  if (run.status === 'won')
    return t('tools:completedArenaHidesSupportEffectsBehindTheRevealedPicture');
  const pulses = (run.supportEffects || []).filter((effect) => effect.until > run.time).length;
  const slowed = run.enemies.filter(
    (enemy) => enemy.active !== false && enemy.speedScale < 1 && enemy.slowUntil > run.time,
  ).length;
  return t('tools:studio.crossMode.supportSummary', {
    pulses: t('tools:studio.crossMode.supportPulses', { count: pulses }),
    enemies: t('tools:studio.crossMode.slowedEnemies', { count: slowed }),
  });
}
export function playerTreatmentNote(slotId, width) {
  const selected = /^player\.[^.]+\.(compact|detailed)$/.exec(slotId)?.[1];
  if (!selected) return '';
  const active = width < 480 ? 'compact' : 'detailed';
  return selected === active
    ? t('tools:studio.crossMode.playerBodyShown', {
        treatment: t(`tools:studio.crossMode.treatment.${selected}`),
      })
    : t('tools:studio.crossMode.playerBodyInactive', {
        active: t(`tools:studio.crossMode.treatment.${active}`),
        selected: t(`tools:studio.crossMode.treatment.${selected}`),
      });
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
  if (!binding) throw new Error(t('tools:chooseARegisteredTeamPreviewArena'));
  if (resolved.theme.id !== binding.themeId)
    throw new Error(t('tools:thisEditionHasNoReviewedTeamArenaBindingYetChoose'));
  const roles = [
    ...teamRoles,
    ...(arena === 'relay-yard' ? yardRoles : []),
    ...[
      ...objectiveSlots,
      ...TEAM_SUPPORT_SLOTS,
      ...TEAM_EMITTER_SLOTS,
      ...TEAM_RESCUE_SLOTS,
      ...TEAM_PILOT_SLOTS,
      ...TEAM_ENEMY_SLOTS,
      ...TEAM_OUTCOME_SLOTS,
    ].filter((id) => resolved.assets[id]?.kind === 'image'),
  ];
  const applicable = [
    ...teamRoles,
    ...TEAM_SUPPORT_SLOTS,
    ...TEAM_RESCUE_SLOTS,
    ...TEAM_PILOT_SLOTS,
    ...TEAM_ENEMY_SLOTS,
    ...TEAM_OUTCOME_SLOTS,
    ...(arena === 'relay-yard' ? [...yardRoles, ...objectiveSlots, ...TEAM_EMITTER_SLOTS] : []),
    binding.picture.slot,
  ];
  if (!applicable.includes(slotId))
    throw new Error(t('tools:studio.crossMode.slotNotBound', { slotId, arena }));
  roles.forEach((id) => requireImage(resolved.assets, id));
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
    throw new Error(t('tools:teamArtworkNeedsItsComplete1152576FrameCroppedOr'));
  return { binding, roles, picture };
}

/** A familiar ID is insufficient: the inspected arena must match the approved authored bytes. */
export async function validateTeamPreviewIdentity(binding, level) {
  if (binding.levelId !== level.id || binding.levelRevision !== level.revision)
    throw new Error(t('tools:teamPreviewArenaIdentityOrRevisionDoesNotMatchIts'));
  const hash = await hashPresentationBytes(new TextEncoder().encode(canonicalJSON(level)));
  if (hash !== binding.levelSha256)
    throw new Error(t('tools:teamPreviewArenaContentDoesNotMatchItsApprovedArtwork'));
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
      options.onStatus?.(
        () => t('tools:studio.crossMode.decodingAsset', { id, mode: options.fieldMode }),
        'decoding',
      );
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
      if (fixture.neutralBackdrop && slot.id === binding.picture.slot)
        throw new Error(t('tools:theTwoRelaySpecimenUsesANeutralBackdropChooseA'));
      options.onStatus?.(() => t('tools:studio.crossMode.checkingTeamIdentity'), 'preparing');
      // The authored two-relay specimen has no registered picture identity. Its
      // valid level is created by the fixture; never lend it the starter binding.
      if (!fixture.neutralBackdrop) await validateTeamPreviewIdentity(binding, fixture.level);
      if (!current()) return;
      for (const id of fixture.neutralBackdrop ? roles : [...roles, binding.picture.slot]) {
        await decode(id);
        if (!current()) return;
      }
      const snapshot = services.presentation(inspected, decoded);
      const canvas = element('canvas');
      canvas.width = 1152;
      canvas.height = 576;
      localizedAttribute(canvas, 'aria-label', () =>
        t('tools:studio.crossMode.teamArenaLabel', {
          arena: fixture.level.name,
          scene: fixture.label,
        }),
      );
      const painter = createCoopPainter(canvas);
      painter.setPresentation(snapshot);
      localOwn(() => painter.setPresentation(null));
      const picture = fixture.neutralBackdrop
        ? null
        : {
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
      let previousRun = null,
        sampledRun = null;
      const rescue = note('');
      rescue.hidden =
        !/^(rescue|recovered)-p[12]$/.test(fixture.scenario) &&
        !TEAM_RESCUE_SLOTS.includes(slot.id);
      const emitter = note('');
      emitter.hidden =
        !fixture.scenario.startsWith('emitter-') && !TEAM_EMITTER_SLOTS.includes(slot.id);
      const support = note('');
      support.hidden = fixture.scenario !== 'support' && !TEAM_SUPPORT_SLOTS.includes(slot.id);
      hud.dataset.studioHost = 'secondary';
      frame.append(hud, canvas);
      surface.append(
        frame,
        treatment,
        support,
        emitter,
        rescue,
        note(() =>
          t('tools:studio.crossMode.teamInspection', {
            level: fixture.level.name,
            scene: fixture.label,
            picture: fixture.neutralBackdrop
              ? t('tools:noArenaPictureAuthoredRoleStateSpecimen')
              : t('tools:studio.crossMode.pictureRevision', {
                  id: pictureAsset.id,
                  revision: pictureAsset.revision,
                }),
          }),
        ),
      );
      if (fixture.neutralBackdrop)
        surface.append(note(t('tools:authoredTwoRelaySpecimenNeutralBackdropOneCoreIsCommand')));
      let lastReduced = true;
      const render = (dt, reduced) => {
        if (!current()) return;
        lastReduced = reduced;
        if (options.motion === 'playing' && !reduced) fixture.advance(dt);
        const run = fixture.run;
        if (sampledRun !== run) {
          previousRun = fixture.previousRun;
          sampledRun = run;
        }
        painter.paint(run, { reduced, picture, previousRun, feedback: fixture.feedback });
        if (!rescue.hidden) localizedText(rescue, () => teamRescuePreviewNote(run));
        if (!emitter.hidden) localizedText(emitter, () => teamEmitterPreviewNote(run));
        if (!support.hidden) localizedText(support, () => teamSupportPreviewNote(run));
        const objectiveNote = teamObjectivePreviewNote(slot.id, run);
        if (objectiveNote !== null) localizedText(treatment, () => objectiveNote);
        const players = run.players.map((player, index) => {
          const progress = teamRescueProgress(run, player);
          const state = progress
            ? t('tools:studio.crossMode.playerRescuing', {
                progress: formatNumber(Math.floor(progress.progress * 100)),
              })
            : t(`tools:studio.crossMode.playerState.${player.status}`);
          return t('tools:studio.crossMode.playerStatus', { player: index + 1, state });
        });
        localizedText(hud, () =>
          t('tools:studio.crossMode.teamHud', {
            players: players.join(' · '),
            coverage: formatNumber(Math.round(run.coverage * 100)),
            reserves: formatNumber(run.team.reserves),
          }),
        );
        if (objectiveNote === null)
          localizedText(
            treatment,
            () =>
              (TEAM_OUTCOME_SLOTS.includes(slot.id)
                ? fixture.feedback.some((record) => record.slot === slot.id)
                  ? t('tools:actualTeamOutcomeActiveBadgeAndPlayerNumbersUseThe')
                  : t('tools:selectedTeamOutcomeIsInactiveChooseJointCaptureOrTeam')
                : null) ??
              teamEnemyPreviewNote(slot.id, painter, run) ??
              teamPilotPreviewNote(slot.id, painter, run) ??
              playerTreatmentNote(slot.id, canvas.clientWidth || 1152),
          );
        treatment.hidden = !treatment.textContent;
      };
      watchWidths([canvas], () => render(0, lastReduced), localOwn);
      services.loop(localOwn, render, options);
      return;
    }

    if (options.fieldMode !== 'versus') throw new Error(t('tools:unknownFieldPreviewMode'));
    options.onStatus?.(() => t('tools:studio.crossMode.loadingVersusFixtures'), 'downloading');
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
      localizedAttribute(canvas, 'aria-label', () =>
        t('tools:studio.crossMode.versusBoardLabel', {
          player: index + 1,
          level: context.level.name,
        }),
      );
      const frame = element('div', '', 'board-context-frame');
      const hud = element(
        'div',
        `PLAYER ${index + 1} · ${Math.round(match.runs[index].coverage * 100)}%`,
        'context-hud',
      );
      hud.dataset.studioHost = 'secondary';
      const treatment = note('');
      let previousRun = null,
        sampledRun = null;
      frame.append(hud, canvas, treatment);
      grid.append(frame);
      boards.push({ painter, canvas, treatment, run: match.runs[index] });
    }
    surface.append(
      grid,
      note(() =>
        t('tools:studio.crossMode.versusInspection', {
          level: context.level.name,
        }),
      ),
    );
    let gallery = false;
    let lastReduced = true;
    const render = (dt, reduced) => {
      if (!current()) return;
      lastReduced = reduced;
      for (const { painter, canvas, treatment, run } of boards) {
        localizedText(treatment, () =>
          playerTreatmentNote(slot.id, Math.max(1, canvas.clientWidth)),
        );
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
      const button = element('button', localizedMessage('tools:showBothPictureViewers'));
      button.type = 'button';
      button.dataset.studioHost = 'control';
      button.onclick = () => {
        gallery = !gallery;
        localizedText(button, () =>
          gallery ? t('tools:showConcealedBoards') : t('tools:showBothPictureViewers'),
        );
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
