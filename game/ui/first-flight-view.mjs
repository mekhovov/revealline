import { FIRST_FLIGHT_LESSONS, getFirstFlightLesson } from '../first-flight.mjs';

/** Presentation only. The host owns course transitions, focus and every run. */
export function attachFirstFlightView({
  document: doc = globalThis.document,
  onEnter = () => {},
  onCancelEnter = () => {},
  onNext = () => {},
  onSkip = () => {},
  onSelect = () => {},
  onExit = () => {},
  getControlLabels = () => ({}),
} = {}) {
  const ids = [
    'first-flight-enter',
    'first-flight-help-enter',
    'first-flight-entry-status',
    'first-flight-entry-cancel',
    'first-flight-panel',
    'first-flight-title',
    'first-flight-outcome',
    'first-flight-step-list',
    'first-flight-controls',
    'first-flight-select',
    'first-flight-next',
    'first-flight-skip',
    'first-flight-exit',
    'first-flight-error',
    'first-flight-markers',
  ];
  const nodes = Object.fromEntries(ids.map((id) => [id, doc.getElementById(id)]));
  if (Object.values(nodes).some((node) => !node))
    throw new Error('First Flight view is incomplete.');
  const callbacks = { onEnter, onCancelEnter, onNext, onSkip, onSelect, onExit, getControlLabels };
  if (Object.values(callbacks).some((value) => typeof value !== 'function'))
    throw new TypeError('First Flight view requires callback functions.');
  const $ = (name) => nodes[`first-flight-${name}`];
  const listeners = [];
  let destroyed = false,
    currentLesson = null,
    steps = [],
    current = null;
  function listen(name, type, callback) {
    const node = $(name);
    const listener = () => {
      if (['next', 'skip', 'exit', 'select'].includes(name) && !current?.request) return;
      if (!destroyed && !node.disabled && !node.hidden) callback();
    };
    node.addEventListener(type, listener);
    listeners.push(() => node.removeEventListener(type, listener));
  }
  listen('enter', 'click', onEnter);
  listen('help-enter', 'click', onEnter);
  listen('entry-cancel', 'click', onCancelEnter);
  listen('next', 'click', onNext);
  listen('skip', 'click', onSkip);
  listen('exit', 'click', onExit);
  listen('select', 'change', () => {
    const lessonId = $('select').value;
    if (FIRST_FLIGHT_LESSONS.some((lesson) => lesson.id === lessonId)) onSelect(lessonId);
    else $('select').value = current?.request?.lessonId || FIRST_FLIGHT_LESSONS[0].id;
  });
  const options = FIRST_FLIGHT_LESSONS.map((lesson) => {
    const option = doc.createElement('option');
    option.value = lesson.id;
    $('select').append(option);
    return { lesson, option };
  });
  function lessonNodes(lesson) {
    if (currentLesson === lesson.id) return;
    currentLesson = lesson.id;
    steps = lesson.steps.map((step) => {
      const node = doc.createElement('li');
      node.dataset.step = step.id;
      return { step, node };
    });
    $('step-list').replaceChildren(...steps.map(({ node }) => node));
    $('markers').replaceChildren(
      ...lesson.markers.map((marker) => {
        const node = doc.createElement('span');
        node.className = `first-flight-marker first-flight-marker-${marker.kind}`;
        node.dataset.marker = marker.id;
        node.style.left = `${(marker.x / 48) * 100}%`;
        node.style.top = `${(marker.y / 36) * 100}%`;
        node.style.width = `${(marker.w / 48) * 100}%`;
        node.style.height = `${(marker.h / 36) * 100}%`;
        const label = doc.createElement('span');
        label.textContent = marker.label;
        node.append(label);
        return node;
      }),
    );
  }
  function text(name, value) {
    if ($(name).textContent !== value) $(name).textContent = value;
  }
  function render({
    request = null,
    phase = 'ready',
    snapshot = null,
    visit = {},
    error = '',
    entry = {},
    embedded = false,
  } = {}) {
    if (destroyed) return;
    const lesson =
      request && FIRST_FLIGHT_LESSONS.find((item) => item.id === request.lessonId)
        ? getFirstFlightLesson(request.lessonId)
        : null;
    current = { request: lesson ? request : null };
    $('enter').hidden = !!lesson || !entry.available;
    $('help-enter').hidden = !!lesson || !entry.helpAvailable;
    $('enter').disabled = $('help-enter').disabled = !!entry.pending;
    $('entry-cancel').hidden = !entry.pending;
    const entryMessage = typeof entry.message === 'string' ? entry.message : '';
    text('entry-status', entryMessage);
    $('entry-status').hidden = !entryMessage;
    $('panel').hidden = !lesson;
    $('markers').hidden = !lesson || !['playing', 'paused'].includes(phase);
    if (!lesson) return;
    const lessonChanged = currentLesson !== lesson.id;
    lessonNodes(lesson);
    snapshot = snapshot?.lessonId === lesson.id ? snapshot : null;
    text('title', `First Flight · ${lesson.title}`);
    for (const { lesson: item, option } of options) {
      const status = visit && Object.hasOwn(visit, item.id) ? visit[item.id] : null;
      const suffix =
        status === 'complete'
          ? ' · completed this visit'
          : status === 'skipped'
            ? ' · skipped'
            : '';
      const label = `${FIRST_FLIGHT_LESSONS.indexOf(item) + 1}. ${item.title}${suffix}`;
      if (option.textContent !== label) option.textContent = label;
    }
    if (lessonChanged) $('select').value = lesson.id;
    const busy = ['switching', 'leaving', 'ended'].includes(phase);
    $('select').disabled = busy;
    $('skip').disabled = busy;
    $('exit').disabled = ['switching', 'leaving', 'ended'].includes(phase);
    const last = lesson.id === FIRST_FLIGHT_LESSONS.at(-1).id;
    $('next').hidden = phase !== 'review' || snapshot?.outcome !== 'complete' || last;
    $('next').disabled = busy;
    text('exit', embedded ? 'End course' : 'Return to the game');
    for (const { step, node } of steps) {
      const status = snapshot?.steps?.find((item) => item.id === step.id)?.status;
      const prefix =
        status === 'complete' ? '✓ Complete' : status === 'current' ? '→ Now' : '○ Next';
      const label = `${prefix} · ${step.label}`;
      if (node.textContent !== label) node.textContent = label;
      node.dataset.status = status || 'pending';
    }
    const outcome =
      phase === 'ended'
        ? 'Course ended. Use the parent page’s game link to leave practice.'
        : snapshot?.available === false
          ? 'Guidance is unavailable. You can still play, retry, skip or leave.'
          : snapshot?.outcome === 'missed'
            ? 'Picture revealed; the suggested example was not completed. Retry or skip this lesson.'
            : snapshot?.outcome === 'lost'
              ? 'This attempt ended. Retry starts a fresh lesson; earlier course choices are kept.'
              : snapshot?.outcome === 'complete'
                ? last
                  ? 'Lesson complete. Enjoy the picture, then return whenever you are ready.'
                  : 'Lesson complete. Next lesson opens a fresh Ready screen.'
                : 'Your real cuts advance these steps. Reading and course choices never move the craft.';
    text('outcome', outcome);
    const labels = getControlLabels() || {};
    const hints = ['directions', 'stop', 'pause']
      .map((key) => (typeof labels[key] === 'string' ? labels[key] : ''))
      .filter(Boolean);
    text('controls', hints.join(' · '));
    const message = typeof error === 'string' ? error : '';
    text('error', message);
    $('error').hidden = !message;
  }
  return {
    render,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const remove of listeners) remove();
    },
  };
}
