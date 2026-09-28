import { actionForKey, resolveKeyBindings } from '../key-bindings.mjs';

// Shares the host's one controller sample. It never polls navigator.getGamepads.
export function attachDemoInput({
  root,
  canvas,
  active,
  watching,
  practice,
  getBindings,
  interrupt,
  back,
  steer,
  pause,
  menu,
  onActivity = () => {},
  onHangar = () => {},
}) {
  const view = root.ownerDocument.defaultView;
  const win = typeof view?.addEventListener === 'function' ? view : globalThis.window;
  const held = new Set(),
    actions = new Set(),
    impulses = new Set(),
    removers = [];
  let pad = {},
    lastDirection = null,
    suppressClick = false,
    pointer = null;
  const listen = (target, type, fn, capture = false) => {
    target.addEventListener(type, fn, capture);
    removers.push(() => target.removeEventListener(type, fn, capture));
  };
  const consume = (event) => {
    event.preventDefault();
    event.stopImmediatePropagation?.();
  };
  listen(
    win,
    'keydown',
    (event) => {
      const code = event.code || event.key,
        fresh = !event.repeat && !held.has(code);
      held.add(code);
      if (!active() || event.ctrlKey || event.metaKey || event.altKey) return;
      onActivity();
      if (event.key === 'Escape') {
        consume(event);
        if (fresh) back();
        return;
      }
      if (watching()) {
        consume(event);
        if (fresh) interrupt();
        return;
      }
      if (!practice() || event.target?.closest?.('select,input,textarea')) return;
      const action = actionForKey(resolveKeyBindings(getBindings()), event, { allowRepeat: true });
      if (!action) return;
      consume(event);
      if (!fresh) return;
      if (['up', 'right', 'down', 'left'].includes(action)) steer(action);
      else if (action === 'pause' || action === 'stop') pause();
      else if (action === 'hangar') onHangar();
      else {
        actions.add(action);
        if (['ability', 'pickup'].includes(action)) impulses.add(action);
      }
    },
    true,
  );
  listen(
    win,
    'keyup',
    (event) => {
      held.delete(event.code || event.key);
      const action = actionForKey(resolveKeyBindings(getBindings()), event, { allowRepeat: true });
      actions.delete(action);
    },
    true,
  );
  listen(
    root,
    'pointerdown',
    (event) => {
      suppressClick = false;
      if (!active()) return;
      onActivity();
      if (watching()) {
        suppressClick = true;
        consume(event);
        interrupt();
        return;
      }
      if (!practice() || event.button > 0) return;
      const button = event.target?.closest?.('[data-demo-move]');
      if (button) {
        consume(event);
        steer(button.dataset.demoMove);
        return;
      }
      const action = event.target?.closest?.('[data-demo-action]');
      if (action) {
        consume(event);
        actions.add(action.dataset.demoAction);
        if (['ability', 'pickup'].includes(action.dataset.demoAction))
          impulses.add(action.dataset.demoAction);
        return;
      }
      if (event.target === canvas)
        pointer = { x: event.clientX, y: event.clientY, id: event.pointerId };
    },
    true,
  );
  listen(root, 'pointermove', (event) => {
    if (!pointer || pointer.id !== event.pointerId || !practice()) return;
    const dx = event.clientX - pointer.x,
      dy = event.clientY - pointer.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    consume(event);
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
    pointer = { x: event.clientX, y: event.clientY, id: event.pointerId };
  });
  for (const event of ['pointerup', 'pointercancel'])
    listen(win, event, () => {
      actions.clear();
      pointer = null;
    });
  listen(
    root,
    'click',
    (event) => {
      if (suppressClick) {
        suppressClick = false;
        consume(event);
        return;
      }
      const move = event.target?.closest?.('[data-demo-move]');
      if (move && practice() && event.detail === 0) steer(move.dataset.demoMove);
      const action = event.target?.closest?.('[data-demo-action]');
      if (action && practice() && event.detail === 0) impulses.add(action.dataset.demoAction);
    },
    true,
  );
  return {
    clear() {
      actions.clear();
      impulses.clear();
      pad = {};
      lastDirection = null;
      pointer = null;
    },
    controller(frame) {
      pad = frame.flight ?? {};
      if (frame.disconnected) {
        pause();
        return;
      }
      if (watching()) {
        if (Object.values(frame.ui ?? {}).some(Boolean)) {
          if (frame.ui.back) back();
          else interrupt();
        }
      } else if (practice()) {
        if (pad.pause || pad.stop) {
          pause();
          return;
        }
        if (pad.action) impulses.add('ability');
        if (pad.pickup) impulses.add('pickup');
        if (pad.direction && pad.direction !== lastDirection) steer(pad.direction);
        if (pad.hangar) onHangar();
      } else menu(frame.ui ?? {});
      lastDirection = pad.direction;
    },
    controls() {
      const result = {
        boost: actions.has('boost') || impulses.has('boost') || pad.boost,
        action: actions.has('ability') || impulses.has('ability') || pad.action,
        pickup: actions.has('pickup') || impulses.has('pickup') || pad.pickup,
      };
      impulses.clear();
      return result;
    },
    destroy() {
      for (const remove of removers) remove();
    },
  };
}
