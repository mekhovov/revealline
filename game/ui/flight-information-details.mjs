const roles = {
  bouncer: 'Field hunter',
  'border-patrol': 'Border patrol',
  'lane-boss': 'Lane attacker',
  'relay-sentinel': 'Signal sentinel',
  'contour-patrol': 'Boundary patrol',
  'claimed-rover': 'Ground rover',
  eroder: 'Territory eroder',
};
const seconds = (n) => (Number.isFinite(n) ? `${n.toFixed(1)}s remaining` : 'Timing unavailable');
const section = (id, title, lines) => Object.freeze({ id, title, lines: Object.freeze(lines) });
const group = (lines) => {
  const counts = new Map();
  for (const line of lines) counts.set(line, (counts.get(line) || 0) + 1);
  return [...counts].map(([line, count]) => (count > 1 ? `${count} × ${line}` : line));
};
const enemyState = (enemy) => {
  if (enemy.pressure)
    return (
      {
        patrol: 'patrolling hidden ground',
        warning: `preparing a charge · ${seconds(enemy.pressure.seconds)}`,
        committed: `charging toward its marked target · ${seconds(enemy.pressure.seconds)}`,
        cooldown: `recovering from its last charge · ${seconds(enemy.pressure.seconds)}`,
      }[enemy.pressure.phase] || 'Watch its movement in the field'
    );
  return (
    {
      dormant: 'waiting; revealing its position can wake it',
      warning: `${enemy.type === 'eroder' ? 'preparing to reopen marked ground' : 'preparing to move across revealed ground'} · ${seconds(enemy.seconds)}`,
      active: 'moving across revealed ground',
      patrolling: 'patrolling captured boundaries',
      rejoining: 'returning to a captured boundary',
      idle: 'waiting',
    }[enemy.mode] ||
    {
      bouncer: 'threatens you and your unfinished line in hidden territory',
      'border-patrol': 'patrols the outside border',
      'lane-boss': 'watch the highlighted lane before each attack',
      'relay-sentinel': 'capture its relay to open the shield',
      eroder: 'can reopen captured ground',
    }[enemy.type] ||
    'Watch its movement in the field'
  );
};
const laneState = (value) => {
  const direction = value.axis === 'horizontal' ? 'horizontal' : 'vertical';
  return (
    {
      warning: `Leave the highlighted ${direction} lane before the attack · ${seconds(value.seconds)}.`,
      active: `Stay outside the highlighted ${direction} lane · ${seconds(value.seconds)}.`,
      idle: `Waiting for its next lane attack · ${seconds(value.seconds)}.`,
    }[value.phase] || 'Watch the highlighted lane.'
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
      section('unavailable', 'Field information unavailable', [
        'The existing field cues remain available. Close this view to return to Pause.',
      ]),
    ]);
  parts.push(
    section('state', 'Flight state', [
      `${s.status === 'respawning' ? 'Recovering' : s.paused ? 'Paused' : { running: 'In flight', won: 'Mission complete', lost: 'Flight ended' }[s.status] || 'State unavailable'}. ${s.player.cutting === true ? 'Your unfinished line remains exposed.' : s.player.cutting === false ? 'No unfinished line.' : 'Line state is unavailable.'}`,
      ...(s.objectives
        ? s.objectives.total > 0
          ? [
              `${context.objectiveLabel}: ${s.objectives.done} / ${s.objectives.total} required objectives.`,
            ]
          : []
        : ['Required objective progress is unavailable.']),
    ]),
  );
  if (information.lastWarning)
    parts.push(section('current-notice', 'Current message', [information.lastWarning.fullText]));
  const issues = [...(s.issues || []), ...(information.issue ? [information.issue] : [])];
  if (issues.length)
    parts.push(
      section('issues', 'Some guidance is unavailable', [
        'Some field effects cannot be described here. Keep watching the visible field cues; missing information does not mean the field is safe.',
      ]),
    );
  const classic = s.classic;
  if (classic) {
    parts.push(
      section('field', 'Field and terrain', [classic.summary || 'No classic field summary.']),
    );
    const threats = [];
    for (const front of classic.lineImpacts)
      threats.push(
        front.direction === 1
          ? 'Impact travelling toward your craft. Close the cut on revealed ground before it catches you.'
          : 'Impact travelling toward the starting point of your unfinished line.',
      );
    if (classic.lineImpacts.length)
      threats.push('Enemy freeze does not stop travelling line impacts.');
    for (const enemy of classic.enemies) {
      const effect = enemy.frozen
        ? ' Frozen: movement and attack countdowns are held.'
        : enemy.stunned
          ? ' Temporarily stunned; attack countdowns can continue.'
          : enemy.slowed
            ? ' Movement slowed.'
            : '';
      threats.push(`${roles[enemy.type] || 'Unfamiliar enemy'}: ${enemyState(enemy)}.${effect}`);
    }
    for (const mark of classic.erosion)
      threats.push(`Marked ground can reopen · ${seconds(mark.seconds)}.`);
    if (threats.length) parts.push(section('threats', 'Actors and line danger', group(threats)));
    if (classic.effects.length)
      parts.push(
        section(
          'effects',
          'Bonuses',
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
          'Contact pickups',
          group(
            classic.powerups.map((p) => `${p.label}: collect its symbol to activate the bonus.`),
          ),
        ),
      );
  } else if (context.actorRoles?.length)
    parts.push(
      section(
        'field',
        'Field actors',
        context.actorRoles.map((r) => `${r.count} × ${roles[r.type] || 'Unfamiliar enemy'}`),
      ),
    );
  if (s.laneBosses.length)
    parts.push(
      section(
        'lanes',
        'Lane attacks',
        s.laneBosses.map(
          (p) =>
            `${laneState(p)}${p.clockFrozen ? ' Enemy freeze holds this countdown.' : p.stunned ? ' Temporarily stunned; the countdown continues.' : ''}`,
        ),
      ),
    );
  if (s.encounter) {
    const e = s.encounter,
      lines = [
        e.instruction,
        `${{ shielded: 'Capture the shield relay', transition: 'Shield opening', exposed: 'Release the core' }[e.stage] || 'Encounter in progress'} · ${seconds(e.seconds)}.`,
        `Current cut: ${e.cutCells} / ${e.min} required cells. ${e.remaining} unrevealed cells remain on the board.`,
        ...(e.isolated ? ['Core isolated.'] : []),
        ...(e.suppressed ? ['The lane attack is temporarily suppressed.'] : []),
      ];
    if (s.encounterLane?.marked)
      lines.push(
        `Watch the highlighted ${s.encounterLane.axis === 'horizontal' ? 'horizontal' : 'vertical'} lane.${s.encounterLane.clockFrozen ? ' Enemy freeze holds its attack countdown.' : ''}`,
      );
    parts.push(section('encounter', e.title, lines));
  }
  parts.push(
    section(
      'actions',
      'Controls after Resume',
      context.actions.length
        ? context.actions.map((a) => `${a.label}: ${a.detail}`)
        : ['No manual equipment actions. Bonuses activate through play.'],
    ),
  );
  if ((information.recentBatches || []).some((b) => b.unknownEvents.length))
    parts.push(
      section('unknown', 'Additional field effects', [
        'Some recent effects are not described here. Their visible field cues remain available.',
      ]),
    );
  const history = [...(information.recentNotices || [])].reverse().map((n) => n.fullText);
  if (information.omittedNotices || information.omittedBatches)
    history.push(
      'Earlier messages are no longer shown. This is recent context, not a complete flight history.',
    );
  if (history.length) parts.push(section('history', 'Recent messages — newest first', history));
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
      heading.textContent = part.title;
      content.append(heading);
      for (const line of part.lines) {
        const p = doc.createElement('p');
        p.textContent = line;
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
