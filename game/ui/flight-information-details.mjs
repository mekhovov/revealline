import { t, localizedText, localizedMessage } from '../i18n/index.mjs';
import { enemyCatalogRecord } from '../enemy-catalog.mjs';

const roleName = (type) => enemyCatalogRecord(type)?.label || t("interface:unfamiliarEnemy");
const sentence = (text) => (/[.!?]$/.test(text) ? text : `${text}.`);
const encounterClock = (phase) =>
  ({
    delay: t("interface:nextLaneWarning"),
    rest: t("interface:nextLaneWarning"),
    transition: t("interface:nextVerticalLaneWarning"),
    warning: t("interface:laneWarningEnds"),
    active: t("interface:activeLaneEnds"),
    open: t("interface:coreOpeningCloses"),
  })[phase] || t("interface:currentEncounterPhase");
const seconds = (n) => (Number.isFinite(n) ? `${n.toFixed(1)}s remaining` : t("interface:timingUnavailable"));
const section = (id, title, lines) => Object.freeze({ id, title, lines: Object.freeze(lines) });
const group = (lines) => {
  const counts = new Map();
  for (const line of lines) counts.set(line, (counts.get(line) || 0) + 1);
  return [...counts].map(([line, count]) => (count > 1 ? `${count} × ${line}` : line));
};
const enemyState = (enemy, snapshot) => {
  if (enemy.type === 'relay-sentinel')
    return snapshot.encounterLane?.id === enemy.id && snapshot.encounter
      ? snapshot.encounter.instruction
      : t("interface:encounterGuidanceIsUnavailableWatchItsVisibleShieldAndLane");
  if (enemy.type === 'contour-patrol') {
    const state =
      {
        patrolling: t("interface:patrollingTheChangingFrontierBetweenUnclaimedFieldAndReclaimedGround"),
        rejoining: t("interface:rejoiningTheChangingFrontierAlongReclaimedGround"),
        idle: t("interface:holdingPositionCapturesMayLeaveItInsideReclaimedGroundAway"),
      }[enemy.mode] || 'watch the changing frontier';
    return `${state}. A capture can change its route; check your next return before departing. ${enemy.frozen ? t("interface:whenFreezeEndsContactWithYourCraftOrUnfinishedLine") : t("interface:contactWithYourCraftOrUnfinishedLineIsStillDangerous")}`;
  }
  if (enemy.impactCarrier)
    return t("interface:trailContactSendsVisibleFrontsAlongYourUnfinishedLineClose");
  if (enemy.pressure)
    return (
      {
        patrol: 'patrolling hidden ground',
        warning: `preparing a charge · ${seconds(enemy.pressure.seconds)}`,
        committed: `charging toward its marked target · ${seconds(enemy.pressure.seconds)}`,
        cooldown: `recovering from its last charge · ${seconds(enemy.pressure.seconds)}`,
      }[enemy.pressure.phase] || t("interface:watchItsMovementInTheField")
    );
  return (
    {
      dormant: t("interface:waitingRevealingItsPositionCanWakeIt"),
      warning: `${enemy.type === 'eroder' ? 'preparing to reopen marked ground' : t("interface:preparingToMoveAcrossRevealedGround")} · ${seconds(enemy.seconds)}`,
      active: 'moving across revealed ground',
    }[enemy.mode] ||
    {
      bouncer: t("interface:threatensYouAndYourUnfinishedLineInHiddenTerritory"),
      'border-patrol': `patrols the fixed outer perimeter, even after captures; leave before it reaches your craft. ${enemy.frozen ? t("interface:whenFreezeEndsReclaimedGroundDoesNotProtectYouFrom") : t("interface:reclaimedGroundDoesNotProtectYouFromContact")}`,
      'lane-boss':
        t("interface:stationaryFieldAnchorWatchTheLockedLaneAndSecureAny"),
      eroder: 'can reopen captured ground',
    }[enemy.type] ||
    t("interface:watchItsMovementInTheField")
  );
};
const laneState = (value) => {
  const direction = value.axis === 'horizontal' ? 'horizontal' : 'vertical';
  return (
    {
      warning: `Leave the highlighted ${direction} lane before the attack · ${seconds(value.seconds)}.`,
      active: `Stay outside the highlighted ${direction} lane · ${seconds(value.seconds)}.`,
      idle: `Waiting for its next lane attack · ${seconds(value.seconds)}.`,
    }[value.phase] || t("interface:watchTheHighlightedLane")
  );
};
/** Full paused player information. Typed diagnostic details remain in the read-only source. */
export function flightDetailsModel(information, context) {
  const s = information?.snapshot,
    parts = [];
  parts.push(section('mission', context.mission, [context.goal, context.steering]));
  if (!s)
    return Object.freeze([
      ...parts,
      section('unavailable', localizedMessage("interface:fieldInformationUnavailable"), [
        t("interface:theExistingFieldCuesRemainAvailableCloseThisViewTo"),
      ]),
    ]);
  parts.push(
    section('state', localizedMessage("interface:flightState"), [
      `${s.status === 'respawning' ? t("interface:recovering2") : s.paused ? t("interface:paused") : { running: t("interface:inFlight"), won: t("interface:missionComplete"), lost: t("interface:flightEnded") }[s.status] || t("interface:stateUnavailable")}. ${s.player.cutting === true ? t("interface:yourUnfinishedLineRemainsExposed") : s.player.cutting === false ? t("interface:noUnfinishedLine") : t("interface:lineStateIsUnavailable")}`,
      ...(s.objectives
        ? s.objectives.total > 0
          ? [
              `${context.objectiveLabel}: ${s.objectives.done} / ${s.objectives.total} required objectives.`,
            ]
          : []
        : [t("interface:requiredObjectiveProgressIsUnavailable")]),
    ]),
  );
  if (information.lastWarning)
    parts.push(section('current-notice', localizedMessage("interface:currentMessage"), [information.lastWarning.fullText]));
  const issues = [...(s.issues || []), ...(information.issue ? [information.issue] : [])];
  if (issues.length)
    parts.push(
      section('issues', localizedMessage("interface:someGuidanceIsUnavailable"), [
        t("interface:someFieldEffectsCannotBeDescribedHereKeepWatchingThe"),
      ]),
    );
  const classic = s.classic;
  if (classic) {
    parts.push(
      section('field', localizedMessage("interface:fieldAndTerrain"), [classic.summary || t("interface:noClassicFieldSummary")]),
    );
    const threats = [];
    for (const front of classic.lineImpacts)
      threats.push(
        front.direction === 1
          ? t("interface:impactTravellingTowardYourCraftCloseTheCutOnRevealed")
          : t("interface:impactTravellingTowardTheStartingPointOfYourUnfinishedLine"),
      );
    if (classic.lineImpacts.length)
      threats.push(t("interface:enemyFreezeDoesNotStopTravellingLineImpacts"));
    for (const enemy of classic.enemies) {
      const effect = enemy.frozen
        ? (" " + t("interface:frozenMovementAndAttackCountdownsAreHeld") + "")
        : enemy.stunned
          ? (" " + t("interface:temporarilyStunnedAttackCountdownsCanContinue") + "")
          : enemy.slowed
            ? (" " + t("interface:movementSlowed") + "")
            : '';
      threats.push(
        `${enemy.impactCarrier ? t("interface:trailImpactCarrier") : enemy.pressure?.mode === 'trail-pursuit' ? t("interface:trailPursuer") : enemy.pressure?.mode === 'head-intercept' ? t("interface:headingInterceptor") : roleName(enemy.type)}: ${sentence(enemyState(enemy, s))}${effect}`,
      );
    }
    for (const mark of classic.erosion)
      threats.push(`Marked ground can reopen · ${seconds(mark.seconds)}.`);
    if (threats.length) parts.push(section('threats', localizedMessage("interface:actorsAndLineDanger"), group(threats)));
    if (classic.effects.length)
      parts.push(
        section(
          'effects',
          localizedMessage("interface:bonuses"),
          classic.effects.map(
            (e) =>
              `${e.label}: ${e.phase === 'active' ? 'active' : 'activates shortly'} · ${seconds(e.seconds)}.`,
          ),
        ),
      );
    if (classic.powerups.length)
      parts.push(
        section(
          'pickups',
          localizedMessage("interface:contactPickups"),
          group(
            classic.powerups.map((p) =>
              p.timed
                ? `${p.label}: touch before the ring expires (${seconds(p.seconds)}). Enclosure does not collect it; missed pickups may return elsewhere.`
                : `${p.label}: collect its symbol to activate the bonus.`,
            ),
          ),
        ),
      );
    const upcoming = classic.timedBonuses?.filter((p) => p.phase === 'announce') ?? [];
    if (upcoming.length)
      parts.push(
        section(
          'timed-pickups',
          localizedMessage("interface:upcomingOptionalPickups"),
          upcoming.map(
            (p) =>
              `${p.label}: solid symbol appears in ${seconds(p.seconds)}. Hollow symbols cannot be collected.`,
          ),
        ),
      );
  } else if (context.actorRoles?.length)
    parts.push(
      section(
        'field',
        localizedMessage("interface:fieldActors"),
        context.actorRoles.map((r) => `${r.count} × ${roleName(r.type)}`),
      ),
    );
  if (s.laneBosses.length)
    parts.push(
      section(
        'lanes',
        localizedMessage("interface:laneAttacks"),
        s.laneBosses.map(
          (p) =>
            `${laneState(p)}${p.clockFrozen ? (" " + t("interface:enemyFreezeHoldsThisCountdown") + "") : p.stunned ? (" " + t("interface:temporarilyStunnedTheCountdownContinues") + "") : ''}`,
        ),
      ),
    );
  if (s.encounter) {
    const e = s.encounter,
      stage =
        s.status === 'lost'
          ? t("interface:flightEnded")
          : e.phase === 'defeated'
            ? t("interface:coreReleased2")
            : e.stage === 'shielded'
              ? e.shields?.total > 1
                ? t("interface:captureAllRemainingShieldRelays")
                : t("interface:captureTheShieldRelay2")
              : { transition: t("interface:shieldOpening2"), exposed: t("interface:releaseTheCore") }[e.stage] ||
                t("interface:encounterInProgress"),
      lines = [
        e.instruction,
        `${stage}.`,
        ...(s.status === 'lost' || e.phase === 'defeated'
          ? []
          : [`${encounterClock(e.phase)} · ${seconds(e.seconds)}.`]),
        `Current cut: ${e.cutCells} / ${e.min} required cells. ${e.remaining} unrevealed cells remain on the board.`,
        ...(e.isolated ? [t("interface:coreIsolated")] : []),
        ...(e.suppressed ? [t("interface:theLaneAttackIsTemporarilySuppressed")] : []),
      ];
    if (s.encounterLane?.marked)
      lines.push(
        `Watch the highlighted ${s.encounterLane.axis === 'horizontal' ? 'horizontal' : 'vertical'} lane.${s.encounterLane.clockFrozen ? (" " + t("interface:enemyFreezeHoldsItsAttackCountdown") + "") : ''}`,
      );
    parts.push(section('encounter', e.title, lines));
  }
  parts.push(
    section(
      'actions',
      localizedMessage("interface:controlsAfterResume"),
      context.actions.length
        ? context.actions.map((a) => `${a.label}: ${a.detail}`)
        : [t("interface:noManualEquipmentActionsBonusesActivateThroughPlay")],
    ),
  );
  if ((information.recentBatches || []).some((b) => b.unknownEvents.length))
    parts.push(
      section('unknown', localizedMessage("interface:additionalFieldEffects"), [
        t("interface:someRecentEffectsAreNotDescribedHereTheirVisibleField"),
      ]),
    );
  const history = [...(information.recentNotices || [])].reverse().map((n) => n.fullText);
  if (information.omittedNotices || information.omittedBatches)
    history.push(
      t("interface:earlierMessagesAreNoLongerShownThisIsRecentContext"),
    );
  if (history.length) parts.push(section('history', localizedMessage("interface:recentMessagesNewestFirst"), history));
  return Object.freeze(parts);
}

/** The host supplies its real pause, reading/navigation and accepted owner boundary. */
export function attachFlightDetails({
  document: doc = globalThis.document,
  read,
  getContext,
  pause,
  clearInput,
  topDialog,
  onReadingChange,
  canOpen,
}) {
  const byId = (id) => doc.getElementById(id),
    dialog = byId('flight-details-dialog'),
    opener = byId('overlay-field-details'),
    readButton = byId('flight-details-read'),
    content = byId('flight-details-content'),
    back = byId('flight-details-back');
  let disposed = false,
    revision = 0,
    visit = null;
  const ownerIsCurrent = (owner) => {
    const current = read()?.owner;
    return current?.attempt === owner?.attempt && current?.generation === owner?.generation;
  };
  function open() {
    if (
      disposed ||
      doc.hidden ||
      doc.hasFocus?.() === false ||
      dialog.open ||
      !canOpen() ||
      topDialog()
    )
      return false;
    const origin = doc.activeElement,
      initial = read()?.owner;
    if (!initial) return false;
    pause(true);
    clearInput();
    const information = read();
    if (
      !information?.snapshot?.paused ||
      !ownerIsCurrent(initial) ||
      disposed ||
      doc.hidden ||
      doc.hasFocus?.() === false
    )
      return false;
    content.replaceChildren();
    for (const part of flightDetailsModel(information, getContext())) {
      const heading = doc.createElement('h3');
      localizedText(heading, () =>part.title);
      content.append(heading);
      for (const line of part.lines) {
        const p = doc.createElement('p');
        localizedText(p, () =>line);
        content.append(p);
      }
    }
    visit = { revision: ++revision, owner: initial, origin };
    dialog.showModal();
    dialog.scrollTop = 0;
    readButton.focus({ preventScroll: true });
    return true;
  }
  function closed() {
    if (dialog.open || !visit) return;
    const ending = visit;
    visit = null;
    clearInput();
    onReadingChange();
    queueMicrotask(() => {
      if (
        disposed ||
        dialog.open ||
        ending.revision !== revision ||
        !ownerIsCurrent(ending.owner) ||
        doc.hidden ||
        doc.hasFocus?.() === false ||
        topDialog()
      )
        return;
      const active = doc.activeElement;
      if (
        active !== doc.body &&
        active !== dialog &&
        !dialog.contains(active) &&
        active !== ending.origin &&
        active?.isConnected
      )
        return;
      const target =
        ending.origin?.isConnected &&
        !ending.origin.disabled &&
        !ending.origin.closest('[hidden],[inert]')
          ? ending.origin
          : opener;
      if (target?.isConnected && !target.hidden && !target.closest('[hidden],[inert]'))
        target.focus({ preventScroll: true });
    });
  }
  function close() {
    if (dialog.open) dialog.close();
  }
  function cancel(e) {
    e.preventDefault();
    close();
  }
  opener.addEventListener('click', open);
  back.addEventListener('click', close);
  dialog.addEventListener('cancel', cancel);
  dialog.addEventListener('close', closed);
  return Object.freeze({
    reconcile() {
      if (visit && !ownerIsCurrent(visit.owner)) {
        revision++;
        visit = null;
        clearInput();
        close();
      }
    },
    suspend() {
      revision++;
      visit = null;
      close();
    },
    dispose() {
      disposed = true;
      revision++;
      visit = null;
      close();
      opener.removeEventListener('click', open);
      back.removeEventListener('click', close);
      dialog.removeEventListener('cancel', cancel);
      dialog.removeEventListener('close', closed);
    },
  });
}
