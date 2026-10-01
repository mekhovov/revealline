import { createFlightRenderer } from './world-renderer.mjs';

/** Lightweight spatial authoring view. The host owns validated source, undo/redo,
 * and persistence. This view never creates or steps a simulation. */
export function mountWorldEditor({
  canvas,
  course,
  mode = 'self-level',
  onSelect = () => {},
  onPreview = () => {},
  onChange = () => {},
  onError = () => {},
  window: win = canvas.ownerDocument.defaultView,
} = {}) {
  if (!canvas) throw new TypeError('A visible editor canvas is required');
  const renderer = createFlightRenderer({
    canvas,
    window: win,
    reducedMotion: true,
    onContextLost: () => onError(new Error('Editor graphics context lost. Reload the editor.')),
  });
  let source = course,
    selectedMode = mode,
    controls = null,
    disposed = false,
    dirty = true,
    frame = null,
    orbit = null,
    selection = null,
    sceneRequest = 0;
  const listeners = [];
  const listen = (target, event, callback, options) => {
    target.addEventListener(event, callback, options);
    listeners.push(() => target.removeEventListener(event, callback, options));
  };
  const invalidate = () => {
    dirty = true;
  };
  const select = (value) => {
    selection = value;
    controls?.select(value, false);
    invalidate();
  };
  function render() {
    if (disposed) return;
    if (dirty && source && canvas.getBoundingClientRect().width > 0) {
      renderer.draw(
        {
          position: source.spawn,
          orientation: [0, 0, 0, 1000000],
          step: -1,
          ticks: 0,
          status: 'paused',
          actors: (source.actors ?? []).map((actor) => ({ ...actor, status: 'active' })),
          projectiles: [],
        },
        { cameraMode: 'editor', cameraFov: 55, cameraTilt: 0 },
      );
      dirty = false;
    }
    frame = win.requestAnimationFrame(render);
  }
  function setCourse(value, nextMode = selectedMode) {
    if (disposed) return;
    sceneRequest++;
    source = value;
    selectedMode = nextMode;
    renderer.setCourse(value, nextMode);
    select(selection);
    invalidate();
  }
  const ready = (async () => {
    if (!renderer.available) throw new Error('WebGL is unavailable for the spatial editor');
    renderer.setQuality('low');
    if (source) renderer.setCourse(source, selectedMode);
    controls = await renderer.createEditor({
      onSelect: (value) => {
        selection = value;
        onSelect(value);
        invalidate();
      },
      onPreview,
      onCommit: (value) => {
        try {
          onChange(value);
        } catch (error) {
          setCourse(source, selectedMode);
          onError(error);
        }
        invalidate();
      },
      onRedraw: invalidate,
    });
    if (disposed) return;
    select(selection);
    render();
  })();
  ready.catch(onError);
  listen(canvas, 'pointerdown', (event) => {
    if (!controls || event.button > 1) return;
    canvas.focus();
    if (!controls.pick(event.clientX, event.clientY)) {
      orbit = { pointer: event.pointerId, x: event.clientX, y: event.clientY };
      canvas.setPointerCapture?.(event.pointerId);
    }
    invalidate();
  });
  listen(canvas, 'pointermove', (event) => {
    if (!orbit || orbit.pointer !== event.pointerId || controls?.isDragging()) return;
    controls.orbit(event.clientX - orbit.x, event.clientY - orbit.y);
    orbit.x = event.clientX;
    orbit.y = event.clientY;
  });
  const release = (event) => {
    if (orbit?.pointer !== event.pointerId) return;
    orbit = null;
    if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  listen(canvas, 'pointerup', release);
  listen(canvas, 'pointercancel', release);
  listen(
    canvas,
    'wheel',
    (event) => {
      event.preventDefault();
      controls?.zoom(event.deltaY);
    },
    { passive: false },
  );
  listen(canvas, 'contextmenu', (event) => event.preventDefault());
  listen(win, 'resize', invalidate);
  const observer = win.ResizeObserver ? new win.ResizeObserver(invalidate) : null;
  observer?.observe(canvas);
  return {
    ready,
    setCourse,
    select,
    refresh: invalidate,
    setSnap: (metres) => controls?.setSnap(Number(metres)),
    resetView: () => controls?.home(),
    loadScene: async (input) => {
      const request = ++sceneRequest;
      await ready;
      if (disposed || request !== sceneRequest) return null;
      try {
        const result = await renderer.loadScene(input);
        invalidate();
        return result;
      } catch (error) {
        // Selection and undo can replace a scene while its textures decode.
        // That obsolete render is deliberately discarded, not a user error.
        if (disposed || request !== sceneRequest) return null;
        throw error;
      }
    },
    resources: () => renderer.resources(),
    dispose() {
      if (disposed) return;
      disposed = true;
      sceneRequest++;
      if (frame !== null) win.cancelAnimationFrame(frame);
      for (const remove of listeners) remove();
      observer?.disconnect();
      renderer.dispose();
    },
  };
}
