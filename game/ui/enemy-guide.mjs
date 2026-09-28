import { contentText } from '../i18n/content.mjs';
import { localizedMessage, localizedText, t, localizedAttribute } from '../i18n/index.mjs';
import {
  ENEMY_GUIDE_TOPICS,
  enemyGuideEntry,
  enemyGuidePracticeInstructions,
  createEnemyGuideScenario,
} from '../enemy-guide.mjs';
import { ENEMY_THEMES } from '../enemy-catalog.mjs';
import { prepareScenario } from '../imports.mjs';
import { createActorPresentation, drawPresentedActor } from './actor-presentation.mjs';
import { attachEnemyWorkshopReturnHost } from './enemy-workshop-return.mjs';

const HANDOFF = 'revealline.playground.current';

/** Player-only guide. The caller owns flight pausing, music and the shared navigation router. */
export function attachEnemyGuide({
  document: doc = globalThis.document,
  window: host = globalThis.window,
  themes,
  getThemeId = () => 'fpv',
  getTurnPolicy = () => 'immediate',
  loadImpactScenario = async () => {
    const response = await fetch(
      new URL('../content/scenarios/line-impact-demo.json', import.meta.url),
    );
    if (!response.ok)
      throw new Error(t("interface:theImpactLessonIsUnavailableTryAgainWhenItsContent"));
    return response.json();
  },
  onPractice = () => {},
  onReturn = () => {},
  onClose = () => {},
  onRead = ({ region }) => region.focus(),
} = {}) {
  let disposed = false,
    busy = false,
    active = false,
    generation = 0,
    origin = null,
    previousHandoff = null,
    ownedHandoff = null,
    parentSuspended = false,
    suspendedTicket = null,
    launchController = null,
    time = 0;
  const poses = createActorPresentation();
  const node = (tag, id, text = '') => {
    const el = doc.createElement(tag);
    if (id) el.id = `enemy-guide-${id}`;
    if (text) localizedText(el, () =>text);
    return el;
  };
  const button = (id, label, fn) => {
    const el = node('button', id, label);
    el.type = 'button';
    el.className = 'button secondary';
    el.onclick = fn;
    return el;
  };
  const select = (id, label, items) => {
    const wrap = node('label', null, label),
      el = node('select', id);
    for (const [value, text] of items) {
      const option = node('option', null, text);
      option.value = value;
      el.append(option);
    }
    wrap.append(el);
    return { wrap, el };
  };
  const dialog = node('dialog', 'dialog');
  dialog.className = 'enemy-guide-dialog';
  dialog.setAttribute('aria-labelledby', 'enemy-guide-title');
  const title = node('h2', 'title', localizedMessage("interface:fieldGuide")),
    content = node('div', 'content'),
    status = node('p', 'status'),
    topic = select(
      'topic',
      t("interface:learnAbout"),
      ENEMY_GUIDE_TOPICS.map(({ id, label }) => [id, label]),
    ),
    appearance = select(
      'theme',
      t("interface:appearance"),
      ENEMY_THEMES.map((id) => [id, themes?.find((item) => item.id === id)?.name ?? id]),
    ),
    choices = node('div'),
    canvas = node('canvas', 'preview'),
    summary = node('div', 'summary'),
    heading = node('h3', 'heading'),
    form = node('p', 'form'),
    spot = node('p', 'spot'),
    risk = node('p', 'risk'),
    action = node('p', 'try'),
    note = node('p', 'note');
  choices.className = 'enemy-guide-choices';
  choices.append(topic.wrap, appearance.wrap);
  canvas.width = 192;
  canvas.height = 112;
  localizedAttribute(canvas, "aria-label", () => t("interface:illustratedRolePreviewThePracticeLessonUsesActualGameTiming"),
  );
  summary.tabIndex = 0;
  summary.setAttribute('role', 'region');
  localizedAttribute(summary, "aria-label", () => t("interface:enemyRecognitionAndPracticeInstructions"));
  summary.setAttribute('data-game-reading', '');
  const read = button('read', localizedMessage("interface:readGuide"), () =>
    onRead({ region: summary, origin: read, label: t("interface:fieldGuide") }),
  );
  const exercise = select('exercise', t("interface:impactExercise"), [
    ['observe', '1 · Observe the strike'],
    ['escape', '2 · Escape with Boost'],
  ]);
  const instructions = node('p', 'instructions');
  summary.append(heading, form, spot, risk, action, note, instructions);
  const previous = button('previous', '← Previous', () => changeTopic(-1)),
    next = button('next', localizedMessage("interface:next"), () => changeTopic(1)),
    play = button('play', localizedMessage("interface:playPractice"), launch),
    back = button('back', localizedMessage("common:navigation.backToGame"), close),
    actions = node('div');
  actions.className = 'enemy-guide-actions';
  actions.append(previous, next, play, back);
  content.append(choices, canvas, read, summary, exercise.wrap, actions);
  const practice = node('div', 'practice'),
    practiceHint = node('p', 'practice-hint'),
    frame = node('iframe', 'frame'),
    returnButton = button('return', localizedMessage("interface:returnToFieldGuide"), returnFromPractice);
  practice.hidden = true;
  frame.hidden = true;
  localizedAttribute(frame, "title", () => t("interface:rewardFreeFieldGuidePractice"));
  frame.setAttribute('allow', 'gamepad; autoplay');
  practice.append(practiceHint, frame, returnButton);
  status.setAttribute('role', 'status');
  status.className = 'enemy-guide-status';
  dialog.append(title, content, practice, status);
  doc.body.append(dialog);
  const context = canvas.getContext?.('2d'),
    bridge = attachEnemyWorkshopReturnHost({
      window: host,
      frame,
      gameURL: new URL('.', host.location.href).href,
      returnTo: 'enemy-guide',
      onReturn: returnFromPractice,
    });
  function entry() {
    return enemyGuideEntry(topic.el.value, appearance.el.value);
  }
  function refresh() {
    const record = entry();
    localizedText(heading, () =>contentText(record, 'label'));
    localizedText(form, () =>record.form);
    localizedText(spot, () =>t("gameplay:spot", { value1: record.spot }));
    localizedText(risk, () =>t("gameplay:risk", { value1: contentText(record, 'risk') }));
    localizedText(action, () =>t("gameplay:try", { value1: record.try }));
    localizedText(note, () =>record.note);
    exercise.wrap.hidden = record.id !== 'line-impact';
    localizedText(instructions, () =>enemyGuidePracticeInstructions(record.id, exercise.el.value));
    for (const el of [topic.el, appearance.el, exercise.el, previous, next, play])
      el.disabled = busy;
    localizedText(play, () =>busy ? t("interface:preparingPractice") : t("interface:playPractice"));
    update(0);
  }
  function changeTopic(delta) {
    if (busy || active || disposed) return;
    const index = ENEMY_GUIDE_TOPICS.findIndex(({ id }) => id === topic.el.value);
    topic.el.value =
      ENEMY_GUIDE_TOPICS[
        (index + delta + ENEMY_GUIDE_TOPICS.length) % ENEMY_GUIDE_TOPICS.length
      ].id;
    poses.reset();
    refresh();
  }
  topic.el.onchange = () => {
    poses.reset();
    refresh();
  };
  appearance.el.onchange = () => {
    poses.reset();
    refresh();
  };
  exercise.el.onchange = refresh;
  topic.el.value = ENEMY_GUIDE_TOPICS[0].id;
  appearance.el.value = 'fpv';
  exercise.el.value = 'observe';
  function restoreHandoff() {
    let failure = null;
    if (ownedHandoff !== null) {
      try {
        if (host.sessionStorage.getItem(HANDOFF) === ownedHandoff) {
          if (previousHandoff === null) host.sessionStorage.removeItem(HANDOFF);
          else host.sessionStorage.setItem(HANDOFF, previousHandoff);
        }
      } catch {
        failure = t("interface:practiceEndedItsTemporaryHandoffCouldNotBeRestored");
      }
    }
    ownedHandoff = null;
    previousHandoff = null;
    return failure;
  }
  function stopPractice() {
    active = false;
    frame.hidden = true;
    frame.src = 'about:blank';
    practice.hidden = true;
    content.hidden = false;
    const failure = restoreHandoff();
    if (parentSuspended) {
      parentSuspended = false;
      suspendedTicket = null;
      onReturn();
    }
    return failure;
  }
  function returnFromPractice() {
    if (disposed || !active) return;
    generation++;
    const failure = stopPractice();
    localizedText(status, () =>failure ?? t("interface:practiceEndedYourCampaignRemainsPausedNoProgressWasAwarded"));
    play.focus({ preventScroll: true });
    refresh();
  }
  async function launch() {
    if (disposed || busy || active || !dialog.open) return false;
    const ticket = ++generation,
      selected = topic.el.value,
      selectedTheme = appearance.el.value,
      turnPolicy = getTurnPolicy();
    const controller = new AbortController();
    launchController = controller;
    busy = true;
    localizedText(status, () =>t("interface:preparingAnIsolatedLesson"));
    refresh();
    const current = () => !disposed && dialog.open && ticket === generation;
    try {
      const impactScenario = selected === 'line-impact' ? await loadImpactScenario() : null;
      if (!current()) return false;
      const prepared = await prepareScenario(
        createEnemyGuideScenario({
          topic: selected,
          themeId: selectedTheme,
          turnPolicy,
          themes,
          impactScenario,
        }),
      );
      if (!current()) return false;
      parentSuspended = true;
      suspendedTicket = ticket;
      await onPractice({ signal: controller.signal, isCurrent: current });
      if (!current()) {
        if (suspendedTicket === ticket) stopPractice();
        return false;
      }
      previousHandoff = host.sessionStorage.getItem(HANDOFF);
      ownedHandoff = JSON.stringify(prepared.scenario);
      host.sessionStorage.setItem(HANDOFF, ownedHandoff);
      const url = bridge.launchURL();
      active = true;
      content.hidden = true;
      practice.hidden = false;
      localizedText(practiceHint, () =>t("gameplay:pauseToRestartOrReturnToFieldGuide", { value1: enemyGuidePracticeInstructions(selected, exercise.el.value) }));
      frame.src = url;
      frame.hidden = false;
      frame.focus();
      localizedText(status, () =>t("interface:practiceOnlyCampaignProgressAndSavedFlightsAreUnchanged"));
      return true;
    } catch (error) {
      if (current()) {
        stopPractice();
        localizedText(status, () =>t("gameplay:practiceDidNotOpen", { value1: error.message }));
      }
      return false;
    } finally {
      if (launchController === controller) launchController = null;
      if (ticket === generation) {
        busy = false;
        if (!disposed) refresh();
      }
    }
  }
  function update(dt = 0, { paused = false, reduced = false } = {}) {
    if (disposed || !dialog.open || active || !context) return;
    if (!paused && !reduced) time += Math.max(0, Math.min(0.1, Number.isFinite(dt) ? dt : 0));
    context.clearRect(0, 0, 192, 112);
    context.fillStyle = '#080d19';
    context.fillRect(0, 0, 192, 112);
    if (topic.el.value === 'line-impact') {
      context.fillStyle = '#56b9c5';
      context.fillRect(20, 51, 152, 2);
      context.fillRect(18, 43, 5, 18);
      context.fillStyle = '#fff0b2';
      context.fillRect(166, 45, 12, 12);
      const travel = reduced ? 20 : (time % 1) * 24;
      for (const x of [85 - travel, 100 + travel]) {
        context.fillStyle = '#ffbb67';
        context.fillRect(x - 3, 47, 6, 10);
        context.fillRect(x - 5, 50, 10, 4);
      }
      return;
    }
    const actor = {
      id: 'guide-preview',
      type: topic.el.value,
      x: ['lane-boss', 'relay-sentinel'].includes(topic.el.value)
        ? 6
        : 6 + Math.sin(time * 2) * 0.6,
      y: ['lane-boss', 'relay-sentinel'].includes(topic.el.value)
        ? 3.5
        : 3.5 + Math.cos(time * 2) * 0.45,
      vx: 1,
      vy: -1,
      radius: 0.25,
    };
    const pose = poses
      .sample([actor], {
        tick: Math.floor(time * 120),
        time,
        dt,
        paused,
        reduced,
        themeId: appearance.el.value,
        style: 'hybrid',
        scale: 1.5,
      })
      .get(actor.id);
    drawPresentedActor(context, pose, themes.find(({ id }) => id === appearance.el.value).palette);
  }
  function open({ topic: selected } = {}) {
    if (disposed || busy || active) return false;
    if (selected) {
      enemyGuideEntry(selected);
      topic.el.value = selected;
    }
    const theme = getThemeId();
    appearance.el.value = ENEMY_THEMES.includes(theme) ? theme : 'fpv';
    if (!dialog.open) {
      origin = doc.activeElement;
      dialog.showModal();
    }
    localizedText(status, () =>t("interface:recognizeAThreatThenTryItPracticeNeverAwardsCampaign"));
    refresh();
    topic.el.focus({ preventScroll: true });
    return true;
  }
  function close() {
    if (disposed || !dialog.open) return false;
    if (active) {
      returnFromPractice();
      return false;
    }
    generation++;
    busy = false;
    launchController?.abort();
    launchController = null;
    if (parentSuspended) stopPractice();
    dialog.close();
    if (origin?.isConnected && !origin.closest('[hidden]')) origin.focus({ preventScroll: true });
    onClose();
    return true;
  }
  const cancel = (event) => {
    event.preventDefault();
    close();
  };
  dialog.addEventListener('cancel', cancel);
  refresh();
  return {
    dialog,
    frame,
    open,
    close,
    update,
    get practiceActive() {
      return active;
    },
    ownsPracticeFocus: () => active && doc.activeElement === frame,
    dispose() {
      if (disposed) return;
      generation++;
      busy = false;
      launchController?.abort();
      launchController = null;
      stopPractice();
      disposed = true;
      bridge.dispose();
      dialog.removeEventListener('cancel', cancel);
      dialog.remove();
    },
  };
}
