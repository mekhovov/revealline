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
import { createEnemyBodyAssets } from './enemy-body-assets.mjs';
import { attachEnemyWorkshopReturnHost } from './enemy-workshop-return.mjs';

const HANDOFF = 'revealline.playground.current';
// Illustration size only; the sampled pose and its contact radius remain unchanged.
const PREVIEW_BODY_DIAMETER = 56;

/** Player-only guide. The caller owns flight pausing, music and the shared navigation router. */
export function attachEnemyGuide({
  document: doc = globalThis.document,
  window: host = globalThis.window,
  themes,
  getThemeId = () => 'fpv',
  getPresentation = () => null,
  getTurnPolicy = () => 'immediate',
  createBodyAssets = createEnemyBodyAssets,
  loadImpactScenario = async () => {
    const response = await fetch(
      new URL('../content/scenarios/line-impact-demo.json', import.meta.url),
    );
    if (!response.ok)
      throw new Error(t('interface:theImpactLessonIsUnavailableTryAgainWhenItsContent'));
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
    time = 0,
    pageVisible = true,
    previewPose = null,
    previewSettings = { paused: false, reduced: false };
  const poses = createActorPresentation();
  const node = (tag, id, text = '') => {
    const el = doc.createElement(tag);
    if (id) el.id = `enemy-guide-${id}`;
    if (text) localizedText(el, () => text);
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
  const title = node('h2', 'title', localizedMessage('interface:fieldGuide')),
    content = node('div', 'content'),
    status = node('p', 'status'),
    topic = select(
      'topic',
      t('interface:learnAbout'),
      ENEMY_GUIDE_TOPICS.map(({ id, label }) => [id, label]),
    ),
    appearance = select(
      'theme',
      t('interface:appearance'),
      ENEMY_THEMES.map((id) => [id, themes?.find((item) => item.id === id)?.name ?? id]),
    ),
    choices = node('div'),
    canvas = node('canvas', 'preview'),
    previewNote = node('p', 'preview-note'),
    artworkStatus = node('p', 'artwork-status'),
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
  localizedAttribute(canvas, 'aria-label', () =>
    t('interface:illustratedRolePreviewThePracticeLessonUsesActualGameTiming'),
  );
  summary.tabIndex = 0;
  summary.setAttribute('role', 'region');
  localizedAttribute(summary, 'aria-label', () =>
    t('interface:enemyRecognitionAndPracticeInstructions'),
  );
  summary.setAttribute('data-game-reading', '');
  const read = button('read', localizedMessage('interface:readGuide'), () =>
    onRead({ region: summary, origin: read, label: t('interface:fieldGuide') }),
  );
  const exercise = select('exercise', t('interface:impactExercise'), [
    ['observe', '1 · Observe the strike'],
    ['escape', '2 · Escape with Boost'],
  ]);
  const instructions = node('p', 'instructions');
  summary.append(heading, form, spot, risk, action, note, instructions);
  const previous = button('previous', '← Previous', () => changeTopic(-1)),
    next = button('next', localizedMessage('interface:next'), () => changeTopic(1)),
    play = button('play', localizedMessage('interface:playPractice'), launch),
    back = button('back', localizedMessage('common:actions.closeGuide'), close),
    actions = node('div');
  actions.className = 'enemy-guide-actions';
  actions.append(previous, next, play, back);
  artworkStatus.className = 'enemy-guide-status';
  artworkStatus.setAttribute('role', 'status');
  artworkStatus.hidden = true;
  previewNote.className = 'enemy-guide-status';
  content.append(
    choices,
    canvas,
    previewNote,
    artworkStatus,
    read,
    summary,
    exercise.wrap,
    actions,
  );
  const practice = node('div', 'practice'),
    practiceHint = node('p', 'practice-hint'),
    frame = node('iframe', 'frame'),
    returnButton = button(
      'return',
      localizedMessage('interface:returnToFieldGuide'),
      returnFromPractice,
    );
  practice.hidden = true;
  frame.hidden = true;
  localizedAttribute(frame, 'title', () => t('interface:rewardFreeFieldGuidePractice'));
  frame.setAttribute('allow', 'gamepad; autoplay');
  practice.append(practiceHint, frame, returnButton);
  status.setAttribute('role', 'status');
  status.className = 'enemy-guide-status';
  dialog.append(title, content, practice, status);
  doc.body.append(dialog);
  const context = canvas.getContext?.('2d'),
    bodyAssets = createBodyAssets({ changed: () => paintPreview() }),
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
    localizedText(previewNote, () =>
      record.id === 'line-impact'
        ? t('interface:lineImpactDiagramPracticeUsesActualTiming')
        : t('interface:enlargedIllustrationCenterDotMarksContact'),
    );
    canvas.setAttribute('aria-label', previewNote.textContent);
    localizedText(heading, () => record.label);
    localizedText(form, () => record.form);
    localizedText(spot, () => `Spot: ${record.spot}`);
    localizedText(risk, () => `Risk: ${record.risk}`);
    localizedText(action, () => `Try: ${record.try}`);
    localizedText(note, () => record.note);
    exercise.wrap.hidden = record.id !== 'line-impact';
    localizedText(instructions, () => enemyGuidePracticeInstructions(record.id, exercise.el.value));
    for (const el of [topic.el, appearance.el, exercise.el, previous, next, play])
      el.disabled = busy;
    localizedText(play, () =>
      busy ? t('interface:preparingPractice') : t('interface:playPractice'),
    );
    update(0, previewSettings);
  }
  function changeTopic(delta) {
    if (busy || active || disposed) return;
    const index = ENEMY_GUIDE_TOPICS.findIndex(({ id }) => id === topic.el.value);
    topic.el.value =
      ENEMY_GUIDE_TOPICS[
        (index + delta + ENEMY_GUIDE_TOPICS.length) % ENEMY_GUIDE_TOPICS.length
      ].id;
    poses.reset();
    releasePreview();
    refresh();
  }
  topic.el.onchange = () => {
    poses.reset();
    releasePreview();
    refresh();
  };
  appearance.el.onchange = () => {
    poses.reset();
    releasePreview();
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
        failure = t('interface:practiceEndedItsTemporaryHandoffCouldNotBeRestored');
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
    localizedText(
      status,
      () => failure ?? t('interface:practiceEndedYourCampaignRemainsPausedNoProgressWasAwarded'),
    );
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
    localizedText(status, () => t('interface:preparingAnIsolatedLesson'));
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
      localizedText(practiceHint, () =>
        t('gameplay:pauseToRestartOrReturnToFieldGuide', {
          value1: enemyGuidePracticeInstructions(selected, exercise.el.value),
        }),
      );
      frame.src = url;
      frame.hidden = false;
      frame.focus();
      localizedText(status, () =>
        t('interface:practiceOnlyCampaignProgressAndSavedFlightsAreUnchanged'),
      );
      return true;
    } catch (error) {
      if (current()) {
        stopPractice();
        localizedText(status, () => t('gameplay:practiceDidNotOpen', { value1: error.message }));
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
  function previewVisible() {
    return (
      !disposed &&
      dialog.open &&
      !dialog.hidden &&
      !content.hidden &&
      !active &&
      !busy &&
      pageVisible &&
      !doc.hidden &&
      doc.visibilityState !== 'hidden' &&
      !!context
    );
  }
  function releasePreview() {
    bodyAssets.clear();
    previewPose = null;
    localizedText(artworkStatus, () => '');
    artworkStatus.hidden = true;
  }
  function compiledPreview() {
    if (previewPose?.themeId !== 'fpv') return null;
    const snapshot = getPresentation();
    const sprite = snapshot?.image?.(`enemy.${previewPose.type}`);
    return sprite ? { ...sprite, palette: snapshot.canvas.palette } : null;
  }
  function updatePreviewAssets() {
    if (compiledPreview()) bodyAssets.clear();
    else bodyAssets.update([previewPose]);
  }
  // A host snapshot change selects artwork for the existing sampled pose only.
  function refreshPresentation() {
    if (!previewVisible() || !previewPose || topic.el.value === 'line-impact') return;
    updatePreviewAssets();
    paintPreview();
  }
  // A decode completion repaints the sampled frame without advancing either clock.
  function paintPreview() {
    if (!previewVisible()) {
      releasePreview();
      return;
    }
    context.clearRect(0, 0, 192, 112);
    context.fillStyle = '#080d19';
    context.fillRect(0, 0, 192, 112);
    if (topic.el.value === 'line-impact') {
      context.fillStyle = '#56b9c5';
      context.fillRect(20, 51, 152, 2);
      context.fillRect(18, 43, 5, 18);
      context.fillStyle = '#fff0b2';
      context.fillRect(166, 45, 12, 12);
      const travel = previewSettings.reduced ? 20 : (time % 1) * 24;
      for (const x of [85 - travel, 100 + travel]) {
        context.fillStyle = '#ffbb67';
        context.fillRect(x - 3, 47, 6, 10);
        context.fillRect(x - 5, 50, 10, 4);
      }
      return;
    }
    const compiled = compiledPreview(),
      body = compiled ?? bodyAssets.current(previewPose);
    drawPresentedActor(
      context,
      { ...previewPose, diameter: PREVIEW_BODY_DIAMETER },
      compiled?.palette ?? themes.find(({ id }) => id === appearance.el.value).palette,
      body?.image,
      compiled?.geometry,
      compiled ? null : body?.record,
    );
    localizedText(artworkStatus, () => (compiled ? '' : bodyAssets.status()));
    artworkStatus.hidden = !artworkStatus.textContent;
  }
  function update(dt = 0, { paused = false, reduced = false } = {}) {
    if (!previewVisible()) {
      releasePreview();
      return;
    }
    previewSettings = { paused, reduced };
    const snapshot =
      appearance.el.value === 'fpv' && topic.el.value !== 'line-impact' ? getPresentation() : null;
    const motionScale = snapshot?.image?.(`enemy.${topic.el.value}`)
      ? (snapshot.canvas.motionScale ?? 1)
      : 1;
    const motionDt = dt * motionScale;
    reduced = reduced || motionScale === 0;
    if (!paused && !reduced)
      time += Math.max(0, Math.min(0.1, Number.isFinite(motionDt) ? motionDt : 0));
    if (topic.el.value === 'line-impact') {
      releasePreview();
      paintPreview();
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
    previewPose = poses
      .sample([actor], {
        tick: Math.floor(time * 120),
        time,
        dt: motionDt,
        paused,
        reduced,
        themeId: appearance.el.value,
        style: 'hybrid',
        scale: 1.5,
      })
      .get(actor.id);
    updatePreviewAssets();
    paintPreview();
  }
  function open({ topic: selected } = {}) {
    if (disposed || busy || active) return false;
    if (selected) {
      enemyGuideEntry(selected);
      topic.el.value = selected;
    }
    const theme = getThemeId();
    appearance.el.value = ENEMY_THEMES.includes(theme) ? theme : 'fpv';
    releasePreview();
    if (!dialog.open) {
      origin = doc.activeElement;
      dialog.showModal();
    }
    localizedText(status, () =>
      t('interface:recognizeAThreatThenTryItPracticeNeverAwardsCampaign'),
    );
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
    releasePreview();
    dialog.close();
    if (origin?.isConnected && !origin.closest('[hidden]')) origin.focus({ preventScroll: true });
    onClose();
    return true;
  }
  const cancel = (event) => {
    event.preventDefault();
    close();
  };
  const visibility = () => update(0, previewSettings);
  const pageHide = () => {
    pageVisible = false;
    releasePreview();
  };
  const pageShow = () => {
    pageVisible = true;
    visibility();
  };
  const closed = () => {
    if (!dialog.open) releasePreview();
  };
  dialog.addEventListener('cancel', cancel);
  dialog.addEventListener('close', closed);
  doc.addEventListener('visibilitychange', visibility);
  host.addEventListener('pagehide', pageHide);
  host.addEventListener('pageshow', pageShow);
  refresh();
  return {
    dialog,
    frame,
    open,
    close,
    update,
    refreshPresentation,
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
      releasePreview();
      bridge.dispose();
      dialog.removeEventListener('cancel', cancel);
      dialog.removeEventListener('close', closed);
      doc.removeEventListener('visibilitychange', visibility);
      host.removeEventListener('pagehide', pageHide);
      host.removeEventListener('pageshow', pageShow);
      dialog.remove();
    },
  };
}
