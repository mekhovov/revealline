import { createFlightRenderer } from './world-assets.mjs';
import { sharedActorAppearance } from '../../game/hunt/preferences.mjs';
import {
  WORLD_ROUTE_GUIDES_FORMAT,
  admitWorldRouteGuides,
  routeObjectiveSignature,
} from './world-content.mjs';

/** Lightweight spatial authoring view. The host owns validated source, undo/redo,
 * and persistence. This view never creates or steps a simulation. */
export function mountWorldEditor({
  canvas,
  course,
  mode = 'self-level',
  getPresentation = () => ({}),
  rendererFactory = createFlightRenderer,
  onSelect = () => {},
  onPreview = () => {},
  onChange = () => {},
  onError = () => {},
  window: win = canvas.ownerDocument.defaultView,
} = {}) {
  if (!canvas) throw new TypeError('A visible editor canvas is required');
  const renderer = rendererFactory({
    canvas,
    window: win,
    reducedMotion: true,
    onContextLost: () => onError(new Error('Editor graphics context lost. Reload the editor.')),
  });
  let source = course,
    selectedMode = mode,
    sourceOptions = {},
    controls = null,
    disposed = false,
    dirty = true,
    frame = null,
    orbit = null,
    selection = null,
    routeGuide = null,
    sceneRequest = 0;
  const listeners = [];
  const listen = (target, event, callback, options) => {
    target.addEventListener(event, callback, options);
    listeners.push(() => target.removeEventListener(event, callback, options));
  };
  const invalidate = () => {
    dirty = true;
  };
  const releaseActorAppearance = sharedActorAppearance().subscribe(invalidate);
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
        {
          cameraMode: 'editor',
          cameraFov: 55,
          cameraTilt: 0,
          routeGuide,
          routeGuideVisible: Boolean(routeGuide),
        },
      );
      dirty = false;
    }
    frame = win.requestAnimationFrame(render);
  }
  function setCourse(value, nextMode = selectedMode, options = {}) {
    if (disposed || !renderer.available) return;
    renderer.setPresentation?.(options.presentation ?? getPresentation());
    renderer.setCourse(value, nextMode, options);
    sceneRequest++;
    source = value;
    routeGuide = null;
    selectedMode = nextMode;
    sourceOptions = options;
    select(selection);
    invalidate();
  }
  const ready = (async () => {
    if (!renderer.available) throw new Error('WebGL is unavailable for the spatial editor');
    renderer.setQuality('low');
    if (source) setCourse(source, selectedMode);
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
          setCourse(source, selectedMode, sourceOptions);
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
  const changeView = (action, ...values) => {
    if (
      disposed ||
      typeof controls?.[action] !== 'function' ||
      values.some((value) => !Number.isFinite(value))
    )
      return false;
    controls[action](...values);
    invalidate();
    return true;
  };
  return {
    ready,
    setCourse,
    select,
    refresh: invalidate,
    setRouteGuide(value) {
      routeGuide = value ? structuredClone(value) : null;
      invalidate();
    },
    setSnap: (metres) => controls?.setSnap(Number(metres)),
    resetView: () => changeView('home'),
    orbitView: (dx, dy) => changeView('orbit', dx, dy),
    zoomView: (delta) => changeView('zoom', delta),
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
      releaseActorAppearance();
    },
  };
}

/** Form authoring is available to pointer, keyboard and the shared radio navigator.
 * The host owns committed sidecars, Undo/Redo and project import/export. */
export function mountWorldRouteGuideEditor({
  document: doc,
  container,
  locale = () => 'en',
  onChange = () => {},
  onPreview = () => {},
  onError = () => {},
  idFactory = (prefix) => `${prefix}-${globalThis.crypto.randomUUID()}`,
} = {}) {
  const root = doc.createElement('details'),
    summary = doc.createElement('summary'),
    body = doc.createElement('div'),
    status = doc.createElement('p');
  root.dataset.routeGuideEditor = '';
  status.dataset.routeGuideStatus = '';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  root.append(summary, body, status);
  container.append(root);
  let course = null,
    guides = null,
    draft = null,
    selected = '',
    mode = 'self-level',
    objectiveIndex = 0,
    busy = false,
    disposed = false,
    generation = 0;
  const t = (en, uk) => (locale() === 'uk' ? uk : en);
  const node = (tag, text) => {
    const result = doc.createElement(tag);
    if (text) result.textContent = text;
    return result;
  };
  const invalidate = () => {
    generation++;
    onPreview(null);
    status.textContent = '';
  };
  const button = (text, action, run, disabled = false) => {
    const control = node('button', text);
    control.type = 'button';
    control.dataset.routeAction = action;
    control.disabled = busy || disabled;
    control.addEventListener('click', run);
    return control;
  };
  const label = (text, control) => {
    const wrapper = node('label', text);
    wrapper.append(control);
    return wrapper;
  };
  const candidate = () => ({
    format: WORLD_ROUTE_GUIDES_FORMAT,
    courseId: course.id,
    routes: [...guides.routes.filter((route) => route.id !== draft.id), structuredClone(draft)],
  });
  async function commit(preview = false, remove = false) {
    if (busy || !course || !draft || disposed) return;
    busy = true;
    const owner = generation,
      savedCourse = course,
      next = remove
        ? { ...guides, routes: guides.routes.filter((route) => route.id !== draft.id) }
        : candidate();
    paint();
    status.textContent = t('Checking the complete route…', 'Перевірка всього маршруту…');
    try {
      // A reimport may invalidate several independent guides. Validate the
      // selected repair in isolation so another stale guide cannot block it;
      // full-bundle admission still owns every export and flight.
      if (
        next.routes.length > 32 ||
        next.routes.reduce((sum, route) => sum + route.waypoints.length, 0) > 256
      )
        throw new Error(t('Route guide budget exceeded.', 'Перевищено ліміт маршрутів.'));
      if (
        !remove &&
        next.routes.some(
          (route) =>
            route.id !== draft.id &&
            route.mode === draft.mode &&
            route.objectiveIndex === draft.objectiveIndex,
        )
      )
        throw new Error(
          t('Only one route may guide each objective.', 'Кожна ціль може мати лише один маршрут.'),
        );
      const selectedRoute = remove
        ? null
        : (
            await admitWorldRouteGuides(
              {
                format: next.format,
                courseId: next.courseId,
                routes: [draft],
              },
              savedCourse,
            )
          ).routes[0];
      if (disposed || owner !== generation || course !== savedCourse) return;
      if (preview) onPreview(selectedRoute);
      else {
        const repaired = remove
          ? next
          : {
              ...next,
              routes: next.routes.map((route) =>
                route.id === selectedRoute.id ? selectedRoute : route,
              ),
            };
        await onChange(structuredClone(repaired));
        if (disposed || owner !== generation || course !== savedCourse) return;
        guides = repaired;
        if (remove) {
          draft = null;
          selected = '';
          onPreview(null);
        }
      }
      status.textContent = preview
        ? t(
            'Preview: static clearance checked. Moving actors can still cross the route.',
            'Перегляд: перевірено нерухомі перешкоди. Рухомі об’єкти можуть перетинати маршрут.',
          )
        : t(
            'Route edit applied. All guides are checked again before export or flight.',
            'Зміну маршруту застосовано. Усі маршрути повторно перевіряються перед експортом або польотом.',
          );
    } catch (error) {
      if (!disposed && owner === generation) {
        status.textContent = `${t('Route not applied', 'Маршрут не застосовано')}: ${error.message}`;
        onError(error);
      }
    } finally {
      busy = false;
      if (!disposed) paint();
    }
  }
  function paint() {
    if (disposed) return;
    summary.textContent = t('Optional route guide', 'Необов’язкова підказка маршруту');
    body.replaceChildren();
    root.hidden = !course;
    if (!course) return;
    const select = node('select');
    select.dataset.routeField = 'route';
    select.setAttribute('aria-label', t('Authored route', 'Авторський маршрут'));
    const none = node('option', t('Choose a route', 'Виберіть маршрут'));
    none.value = '';
    select.append(none);
    for (const route of guides.routes) {
      const option = node('option', `${route.mode} · ${route.objectiveIndex + 1} · ${route.id}`);
      option.value = route.id;
      select.append(option);
    }
    select.value = selected;
    select.disabled = busy;
    select.addEventListener('change', () => {
      invalidate();
      selected = select.value;
      draft = structuredClone(guides.routes.find((route) => route.id === selected) ?? null);
      paint();
    });
    const supported = ['hold', 'land', 'gate', 'crossing-v1'].includes(
      course.steps?.[mode]?.[objectiveIndex]?.type,
    );
    body.append(
      select,
      button(
        t('New route', 'Новий маршрут'),
        'new',
        () => {
          invalidate();
          selected = '';
          draft = {
            id: idFactory('route'),
            mode,
            objectiveIndex,
            objectiveSignature: routeObjectiveSignature(course.steps[mode][objectiveIndex]),
            clearanceMm: Math.max(250, course.rules?.droneRadius ?? 220),
            waypoints: [],
          };
          paint();
        },
        !supported || guides.routes.length >= 32,
      ),
    );
    body.append(
      node(
        'p',
        t(
          'Define every bend in metres. The last segment must enter the chosen objective. No line is drawn from the aircraft to this route.',
          'Задайте кожен поворот у метрах. Останній відрізок має пройти через вибрану ціль. Лінія від дрона до маршруту не створюється.',
        ),
      ),
    );
    if (!draft) return;
    const objective = node('select');
    objective.dataset.routeField = 'objective';
    for (const [index, step] of course.steps[draft.mode].entries()) {
      const option = node('option', `${index + 1} · ${step.type}`);
      option.value = String(index);
      option.disabled = !['hold', 'land', 'gate', 'crossing-v1'].includes(step.type);
      objective.append(option);
    }
    objective.value = String(draft.objectiveIndex);
    objective.disabled = busy;
    objective.addEventListener('change', () => {
      invalidate();
      draft.objectiveIndex = Number(objective.value);
      draft.objectiveSignature = routeObjectiveSignature(
        course.steps[draft.mode][draft.objectiveIndex],
      );
    });
    const clearance = node('input');
    clearance.type = 'number';
    clearance.min = String((course.rules?.droneRadius ?? 220) / 1000);
    clearance.max = '2';
    clearance.step = '0.01';
    clearance.value = String(draft.clearanceMm / 1000);
    clearance.disabled = busy;
    clearance.dataset.routeField = 'clearance';
    clearance.addEventListener('change', () => {
      invalidate();
      draft.clearanceMm = Math.round(Number(clearance.value) * 1000);
    });
    body.append(
      node('p', `${draft.mode} · ${draft.id}`),
      label(t('Objective', 'Ціль'), objective),
      label(t('Clearance radius · m', 'Радіус вільного простору · м'), clearance),
      button(
        t('Rebind to current objective', 'Прив’язати до поточної цілі'),
        'rebind',
        () => {
          invalidate();
          draft.mode = mode;
          draft.objectiveIndex = objectiveIndex;
          draft.objectiveSignature = routeObjectiveSignature(course.steps[mode][objectiveIndex]);
          paint();
        },
        !supported,
      ),
    );
    for (const [index, point] of draft.waypoints.entries()) {
      const row = node('fieldset');
      row.dataset.routeWaypoint = point.id;
      row.append(node('legend', `${t('Waypoint', 'Точка')} ${index + 1}`));
      for (const axis of ['x', 'y', 'z']) {
        const input = node('input');
        input.type = 'number';
        input.step = '0.1';
        input.value = String(point.position[axis] / 1000);
        input.disabled = busy;
        input.dataset.routeAxis = axis;
        input.addEventListener('change', () => {
          invalidate();
          point.position[axis] = Math.round(Number(input.value) * 1000);
        });
        row.append(label(`${axis.toUpperCase()} · m`, input));
      }
      for (const [offset, text, action] of [
        [-1, t('Earlier', 'Раніше'), 'earlier'],
        [1, t('Later', 'Пізніше'), 'later'],
      ])
        row.append(
          button(
            text,
            action,
            () => {
              invalidate();
              [draft.waypoints[index], draft.waypoints[index + offset]] = [
                draft.waypoints[index + offset],
                draft.waypoints[index],
              ];
              paint();
            },
            index + offset < 0 || index + offset >= draft.waypoints.length,
          ),
        );
      row.append(
        button(t('Remove point', 'Видалити точку'), 'remove-point', () => {
          invalidate();
          draft.waypoints.splice(index, 1);
          paint();
        }),
      );
      body.append(row);
    }
    body.append(
      button(
        t('Add waypoint', 'Додати точку'),
        'add-point',
        () => {
          invalidate();
          draft.waypoints.push({
            id: idFactory('point'),
            position: structuredClone(draft.waypoints.at(-1)?.position ?? course.spawn),
          });
          paint();
        },
        draft.waypoints.length >= 64,
      ),
      button(
        t('Preview checked route', 'Переглянути перевірений маршрут'),
        'preview',
        () => void commit(true),
        draft.waypoints.length < 2,
      ),
      button(
        t('Apply route', 'Застосувати маршрут'),
        'apply',
        () => void commit(),
        draft.waypoints.length < 2,
      ),
      button(
        t('Delete route', 'Видалити маршрут'),
        'delete',
        () => void commit(false, true),
        !guides.routes.some((route) => route.id === draft.id),
      ),
    );
  }
  return {
    root,
    update(value = {}) {
      invalidate();
      course = value.course ?? null;
      mode = value.mode ?? 'self-level';
      objectiveIndex = value.objectiveIndex ?? 0;
      guides = structuredClone(
        value.guides ?? {
          format: WORLD_ROUTE_GUIDES_FORMAT,
          courseId: course?.id,
          routes: [],
        },
      );
      draft = structuredClone(guides.routes.find((route) => route.id === selected) ?? null);
      paint();
    },
    dispose() {
      disposed = true;
      generation++;
      onPreview(null);
      root.remove();
    },
  };
}
