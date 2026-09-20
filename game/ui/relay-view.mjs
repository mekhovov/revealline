import { boundedJSON, exactKeys, required, stableId } from '../data-json.mjs';

const own = (value, key) => {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  required(descriptor && Object.hasOwn(descriptor, 'value'), 'Expected own visual data.');
  return descriptor.value;
};

/** Bounded, detached presentation only. Never call getters or rewrite a run. */
export function relayView(run) {
  try {
    if (own(run, 'ruleset') !== 'xonix-core.v7') return null;
    const definition = boundedJSON(own(own(run, 'level'), 'relayGates'), {
      maxBytes: 16384,
      maxNodes: 512,
      maxDepth: 4,
      maxArray: 32,
    });
    const state = boundedJSON(own(run, 'relay'), {
      maxBytes: 65536,
      maxNodes: 4096,
      maxDepth: 5,
      maxArray: 2592,
    });
    exactKeys(definition, ['version', 'gates'], 'relay visual definition');
    exactKeys(state, ['version', 'gates'], 'relay visual state');
    required(
      definition.version === 'relay-gates.v1' && state.version === 'relay-state.v1',
      'Unsupported relay view.',
    );
    required(
      Array.isArray(definition.gates) &&
        Array.isArray(state.gates) &&
        definition.gates.length <= 32 &&
        definition.gates.length === state.gates.length,
      'Invalid relay count.',
    );
    const ids = new Set();
    const gates = definition.gates.map((gate) => {
      exactKeys(gate, ['id', 'x', 'y', 'w', 'h', 'objectiveId'], 'relay visual gate');
      required(
        stableId(gate.id) && !ids.has(gate.id) && stableId(gate.objectiveId),
        'Invalid relay visual identity.',
      );
      ids.add(gate.id);
      required(
        ['x', 'y', 'w', 'h'].every((key) => Number.isInteger(gate[key]) && gate[key] >= 1) &&
          gate.x + gate.w <= 71 &&
          gate.y + gate.h <= 35,
        'Invalid relay visual bounds.',
      );
      const matches = state.gates.filter((entry) => entry.id === gate.id);
      required(matches.length === 1, 'Relay state must match definition.');
      const live = matches[0];
      exactKeys(live, ['id', 'objectiveId', 'cells', 'openedTick'], 'relay visual state gate');
      required(
        live.objectiveId === gate.objectiveId &&
          (live.openedTick === null ||
            (Number.isSafeInteger(live.openedTick) && live.openedTick >= 0)),
        'Invalid relay visual state.',
      );
      required(
        Array.isArray(live.cells) &&
          live.cells.length === gate.w * gate.h &&
          live.cells.every(
            (cell, index) =>
              cell === (gate.y + Math.floor(index / gate.w)) * 72 + gate.x + (index % gate.w),
          ),
        'Relay cells must match authored geometry.',
      );
      return Object.freeze({ ...gate, opened: live.openedTick !== null });
    });
    return Object.freeze({ gates: Object.freeze(gates) });
  } catch {
    return null;
  }
}

/** Exact cell bounds; a latch marks blocked gates, corner brackets open ground.
 * No flashing, motion, audio dependency or fill over an opened return surface. */
export function drawRelayGates(ctx, view, palette, size = 16) {
  if (!view) return;
  ctx.save();
  for (const gate of view.gates) {
    const x = gate.x * size,
      y = gate.y * size,
      w = gate.w * size,
      h = gate.h * size;
    const inset = size * 0.15,
      arm = size * 0.25;
    ctx.strokeStyle = '#10201c';
    ctx.lineWidth = Math.max(3, size * 0.2);
    const outline = () => {
      ctx.beginPath();
      for (const [cx, cy, dx, dy] of [
        [x + inset, y + inset, 1, 1],
        [x + w - inset, y + inset, -1, 1],
        [x + inset, y + h - inset, 1, -1],
        [x + w - inset, y + h - inset, -1, -1],
      ]) {
        ctx.moveTo(cx + dx * arm, cy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx, cy + dy * arm);
      }
      ctx.stroke();
    };
    outline();
    ctx.strokeStyle = palette?.safe ?? '#ccebbc';
    ctx.lineWidth = Math.max(1, size * 0.09);
    outline();
    if (gate.opened) continue;
    // Repeated crossbars distinguish a closed gate from a plain wall at any aspect.
    ctx.strokeStyle = palette?.accent ?? '#ffe8a5';
    ctx.beginPath();
    for (let row = 0; row < gate.h; row++)
      for (let col = 0; col < gate.w; col++) {
        const cx = x + (col + 0.5) * size,
          cy = y + (row + 0.5) * size;
        ctx.moveTo(cx - arm, cy);
        ctx.lineTo(cx + arm, cy);
        ctx.moveTo(cx, cy - arm);
        ctx.lineTo(cx, cy + arm);
      }
    ctx.stroke();
  }
  ctx.restore();
}
