import { drawCoopCueSymbol } from './coop-cue-symbols.mjs';

// Cosmetic relay selection and a read-only planning surface. Never edits a level or run.
const position = (point, level) => {
  const x = point.x / level.width,
    y = point.y / level.height;
  const horizontal = x < 1 / 3 ? 'left' : x > 2 / 3 ? 'right' : 'center';
  const vertical = y < 1 / 3 ? 'upper' : y > 2 / 3 ? 'lower' : 'middle';
  return horizontal === 'center' && vertical === 'middle'
    ? 'near the center'
    : `in the ${vertical} ${horizontal}`;
};
const relative = (point, core) => {
  const vertical = point.y < core.y ? 'above' : point.y > core.y ? 'below' : '';
  const horizontal = point.x < core.x ? 'left' : point.x > core.x ? 'right' : '';
  return [vertical, horizontal].filter(Boolean).join(' and ') || 'at the core';
};
export function coopObjectivesSnapshot(source, selectedRelayId = null) {
  const level = source?.level || source;
  const relays = (source?.strongholds || []).map((hold, index) => ({
    id: hold.id,
    number: index + 1,
    required: level.goal.cores?.includes(hold.id) === true,
    state: hold.defeated ? 'secured' : hold.shielded === false ? 'exposed' : 'shielded',
    core: { x: hold.core.x, y: hold.core.y },
    anchors: hold.anchors.map((anchor, index) => ({
      letter: index === 0 ? 'A' : 'B',
      x: anchor.x,
      y: anchor.y,
      captured: Boolean(anchor.captured),
      relationship: relative(anchor, hold.core),
    })),
    location: position(hold.core, level),
  }));
  const required = relays.filter((relay) => relay.required);
  const selected =
    relays.find((relay) => relay.id === selectedRelayId) ||
    required.find((relay) => relay.state !== 'secured') ||
    required[0] ||
    relays.find((relay) => relay.state !== 'secured') ||
    relays[0] ||
    null;
  const instruction = !selected
    ? ''
    : selected.state === 'secured'
      ? 'This relay is complete.'
      : selected.state === 'exposed'
        ? 'Capture its core in a new cut.'
        : 'Capture both anchors to expose its core.';
  const summary = selected
    ? `${required.length > 1 ? `${required.filter((r) => r.state === 'secured').length} / ${required.length} secured · ` : ''}${selected.required ? '' : 'Optional '}Relay ${selected.number} ${selected.location} · ${selected.state}. ${instruction}`
    : '';
  const description = selected
    ? `${selected.required ? '' : 'Optional '}Relay ${selected.number} ${selected.location} · ${selected.state}. ${instruction} ${selected.anchors.map((a) => `${a.letter} ${a.captured ? 'captured' : 'available'}, ${a.relationship} of the core`).join('; ')}.`
    : '';
  return {
    width: level?.width || 0,
    height: level?.height || 0,
    relays,
    selected,
    description,
    summary,
  };
}

// Diagrams disclose only the selected relay's authored positions. No picture, actor,
// simulation, crop, decoder or earned-artwork ownership is involved.
export function paintCoopObjectiveDiagram(canvas, snapshot, overview = false) {
  const ctx = canvas.getContext('2d');
  if (!ctx || !snapshot.selected) return false;
  canvas.width = overview ? 360 : 600;
  canvas.height = overview ? 180 : 300;
  const { selected, width, height } = snapshot;
  const points = [selected.core, ...selected.anchors];
  const bounds = overview
    ? { left: 0, top: 0, right: width, bottom: height }
    : {
        left: Math.max(0, Math.min(...points.map((p) => p.x)) - 1),
        top: Math.max(0, Math.min(...points.map((p) => p.y)) - 1),
        right: Math.min(width, Math.max(...points.map((p) => p.x)) + 1),
        bottom: Math.min(height, Math.max(...points.map((p) => p.y)) + 1),
      };
  const scale = Math.min(
    (canvas.width - 72) / (bounds.right - bounds.left),
    (canvas.height - 72) / (bounds.bottom - bounds.top),
  );
  const point = (p) => ({
    x: canvas.width / 2 + (p.x - (bounds.left + bounds.right) / 2) * scale,
    y: canvas.height / 2 + (p.y - (bounds.top + bounds.bottom) / 2) * scale,
  });
  const style = canvas.ownerDocument?.defaultView?.getComputedStyle?.(canvas);
  const color = (key, fallback) => style?.getPropertyValue?.(key)?.trim() || fallback;
  const ink = color('--fk-bg', '#0b1425'),
    navigation = color('--fk-cyan', '#a7dce8'),
    active = color('--fk-amber', '#ffd766');
  ctx.fillStyle = ink;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = navigation;
  ctx.lineWidth = 2;
  if (overview) {
    const a = point({ x: 0, y: 0 }),
      b = point({ x: width, y: height });
    ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    const core = point(selected.core);
    ctx.fillStyle = active;
    ctx.fillRect(core.x - 6, core.y - 6, 12, 12);
    return true;
  }
  const core = point(selected.core);
  for (const anchor of selected.anchors) {
    const p = point(anchor);
    ctx.beginPath();
    ctx.moveTo(core.x, core.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.fillStyle = anchor.captured ? color('--fk-text', '#f5f1df') : navigation;
    ctx.fillRect(p.x - 20, p.y - 20, 40, 40);
    ctx.fillStyle = ink;
    ctx.font = `600 36px ${color('--fk-font-ui', 'sans-serif')}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(anchor.letter, p.x, p.y);
  }
  ctx.fillStyle = active;
  ctx.fillRect(core.x - 24, core.y - 24, 48, 48);
  ctx.fillStyle = ink;
  ctx.font = `600 36px ${color('--fk-font-ui', 'sans-serif')}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(selected.number), core.x, core.y);
  return true;
}

export function mountCoopObjectives({
  document,
  getState,
  canOpen,
  foreground,
  visible,
  clearInput,
  onSelect = () => {},
  onError = () => {},
}) {
  const $ = (id) => document.getElementById(id);
  const dialog = $('coop-objectives-dialog'),
    opener = $('coop-objectives-open'),
    close = $('coop-objectives-close'),
    list = $('coop-objectives-list');
  let disposed = false,
    owner = null,
    visit = 0,
    source = null,
    generation = null,
    selectedId = null,
    hudKey = null;
  const snapshot = () => {
    const state = getState();
    if (source !== state.source || generation !== state.generation) {
      source = state.source;
      generation = state.generation;
      selectedId = null;
    }
    return coopObjectivesSnapshot(source, selectedId);
  };
  const current = (ticket) =>
    !disposed &&
    owner === ticket &&
    visit === ticket.visit &&
    foreground() &&
    getState().source === ticket.source &&
    getState().generation === ticket.generation;
  function renderDetails() {
    const data = snapshot();
    $('coop-objectives-description').textContent = data.description;
    for (const button of list.querySelectorAll('button'))
      button.setAttribute('aria-pressed', String(button.dataset.relayId === data.selected?.id));
    let available = false;
    try {
      available =
        paintCoopObjectiveDiagram($('coop-objectives-detail'), data) &&
        paintCoopObjectiveDiagram($('coop-objectives-location'), data, true);
    } catch {
      // The equivalent text remains usable if this optional diagram fails.
      $('coop-objectives-detail').width = $('coop-objectives-location').width = 0;
    }
    $('coop-objectives-diagram-status').textContent = available
      ? 'Gold square: core. A and B: its two anchors. The small board locates this core in the arena.'
      : 'Diagram unavailable. Relay position and anchor relationships are described above.';
  }
  function closed() {
    if (dialog.open || !owner) return;
    const ticket = owner,
      restore = ticket.restore && current(ticket);
    owner = null;
    const closedVisit = ++visit;
    const currentReturn = () =>
      !disposed &&
      !dialog.open &&
      !owner &&
      visit === closedVisit &&
      foreground() &&
      getState().source === ticket.source &&
      getState().generation === ticket.generation;
    $('coop-objectives-detail').width = $('coop-objectives-location').width = 0;
    clearInput();
    const active = document.activeElement;
    if (
      restore &&
      !disposed &&
      !dialog.open &&
      !owner &&
      foreground() &&
      getState().source === ticket.source &&
      getState().generation === ticket.generation &&
      visible(opener) &&
      currentReturn() &&
      document.activeElement === active &&
      (!active ||
        active === document.body ||
        active === document.documentElement ||
        dialog.contains(active))
    ) {
      opener.focus({ preventScroll: true });
      if (currentReturn() && document.activeElement === opener)
        opener.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    }
  }
  function closeDialog({ restore = true } = {}) {
    if (!dialog.open) return;
    if (owner) owner.restore = restore && foreground();
    dialog.close();
  }
  function open() {
    if (disposed || owner || dialog.open || !foreground() || !canOpen() || !visible(opener)) return;
    const data = snapshot();
    if (!data.selected) return;
    const ticket = { source, generation, visit: ++visit, restore: true };
    owner = ticket;
    clearInput();
    try {
      list.replaceChildren(
        ...data.relays.map((relay) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.dataset.relayId = relay.id;
          button.textContent = `${relay.required ? '' : 'Optional '}Relay ${relay.number} · ${relay.state} · ${relay.anchors.map((a) => `${a.letter} ${a.captured ? 'captured' : 'available'}`).join(' · ')}`;
          button.onclick = () => {
            if (!current(ticket) || !dialog.open) return;
            selectedId = relay.id;
            renderDetails();
            if (current(ticket) && dialog.open) onSelect(selectedId);
          };
          return button;
        }),
      );
      renderDetails();
      if (!current(ticket) || !canOpen()) {
        owner = null;
        return;
      }
      dialog.showModal();
      const active = document.activeElement;
      if (
        current(ticket) &&
        dialog.open &&
        (!active ||
          active === opener ||
          active === document.body ||
          active === dialog ||
          active === close)
      )
        close.focus({ preventScroll: true });
    } catch {
      if (owner === ticket) {
        owner = null;
        visit++;
        if (dialog.open) dialog.close();
        onError('Objectives view unavailable. Your Team attempt is unchanged.');
      }
    }
  }
  const cancel = (event) => {
    event.preventDefault();
    closeDialog();
  };
  const keydown = (event) => {
    if (event.key === 'Escape') event.stopPropagation();
  };
  opener.onclick = open;
  close.onclick = () => closeDialog();
  dialog.addEventListener('close', closed);
  dialog.addEventListener('cancel', cancel);
  dialog.addEventListener('keydown', keydown);
  return {
    get selectedRelayId() {
      return snapshot().selected?.id ?? null;
    },
    describe() {
      return snapshot().summary;
    },
    // Passive state for the same selected relay as the inspector. The arena's
    // exact-position markers are locators; this strip supplies readable states.
    renderHud({ large = false } = {}) {
      const area = $('coop-objective-area'),
        hud = $('coop-relay-hud'),
        state = disposed ? null : snapshot(),
        selected = state?.selected,
        show = Boolean(large && selected);
      const mode = String(show);
      if (area.dataset.relayHud !== mode) area.dataset.relayHud = mode;
      hud.hidden = !show;
      if (!show) return null;
      const roles = [
        {
          id: 'a',
          mark: 'anchor-a',
          captured: selected.anchors[0].captured,
          text: selected.anchors[0].captured ? 'Captured' : 'Needed',
        },
        {
          id: 'core',
          mark: selected.state,
          captured: false,
          text: selected.state[0].toUpperCase() + selected.state.slice(1),
        },
        {
          id: 'b',
          mark: 'anchor-b',
          captured: selected.anchors[1].captured,
          text: selected.anchors[1].captured ? 'Captured' : 'Needed',
        },
      ];
      const key = JSON.stringify([
        selected.id,
        ...roles.map(({ mark, captured }) => [mark, captured]),
      ]);
      if (key !== hudKey) {
        for (const role of roles) {
          const label = $(`coop-relay-${role.id}-state`),
            canvas = $(`coop-relay-${role.id}-symbol`);
          if (label.textContent !== role.text) label.textContent = role.text;
          // Decorative symbols are supplementary to the complete DOM labels.
          // A missing canvas context must not prevent reading or playing.
          let ctx;
          try {
            ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.save();
              try {
                ctx.setTransform(2, 0, 0, 2, 14, 14);
                ctx.clearRect(-7, -7, 14, 14);
                drawCoopCueSymbol(ctx, { mark: role.mark, captured: role.captured, size: 14 });
              } finally {
                ctx.restore();
              }
            }
            canvas.hidden = !ctx;
          } catch {
            canvas.hidden = true;
          }
        }
        hudKey = key;
      }
      const required = state.relays.filter((relay) => relay.required),
        secured = required.filter((relay) => relay.state === 'secured').length;
      return `${selected.required ? '' : 'Optional '}Relay ${selected.number}${required.length ? ` · ${secured}/${required.length} required secured` : ''}`;
    },
    refresh() {
      if (owner && !current(owner)) closeDialog({ restore: false });
      opener.hidden = !canOpen() || !snapshot().relays.length;
    },
    close: closeDialog,
    suspend() {
      if (owner) owner.restore = false;
      closeDialog({ restore: false });
    },
    dispose() {
      disposed = true;
      owner = null;
      visit++;
      opener.onclick = null;
      close.onclick = null;
      dialog.removeEventListener('close', closed);
      dialog.removeEventListener('cancel', cancel);
      dialog.removeEventListener('keydown', keydown);
      if (dialog.open) dialog.close();
      list.replaceChildren();
      $('coop-objectives-detail').width = $('coop-objectives-location').width = 0;
    },
  };
}
