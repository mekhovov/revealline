import { createDemoReward } from '../ui/demo-reward.mjs';
import { createDemoSceneTransition } from '../ui/demo-scene-transition.mjs';
import {
  REWARD_BOARD_SECONDS,
  REWARD_STORY_SECONDS,
  animateRewardArrival,
  advanceRewardAge,
} from '../ui/reward-arrival.mjs';

/** Solo's board, effects and earned-picture presentation. The shared host owns
 * scheduling and passes native state; this view never advances a simulation. */
export function createSoloDemoView({
  document: doc,
  dialog,
  canvas,
  readMedia,
  audioMaster,
  audio,
  getContext,
}) {
  const reward = createDemoReward({ document: doc, canvas, readMedia, audioMaster });
  const transition = createDemoSceneTransition(canvas, doc);
  let rewardAge = 0,
    rewardTail = 0,
    transitionAge = 0,
    context = null,
    lastPaint = null,
    displayRevision = 0,
    displayCSSWidth = null;
  return {
    reward,
    transition,
    invalidate({ context: resetContext = false } = {}) {
      displayRevision++;
      displayCSSWidth = null;
      if (resetContext) context = null;
    },
    reset() {
      rewardAge = rewardTail = transitionAge = 0;
      context = lastPaint = null;
      displayCSSWidth = null;
    },
    events({ seconds, look, state, result, fresh, gameSounds, source }) {
      transitionAge += seconds;
      if (look.classId !== state.activeClassId) {
        look.classId = state.activeClassId;
        void look.painter.setLook(
          look.theme,
          look.theme.classBodies?.[look.classId] || look.theme.player,
          look.overrides,
        );
      }
      if (result?.events?.length && fresh) {
        if (!doc.hidden) look.painter.effectsFor(result.events, state);
        if (gameSounds)
          audio?.events?.(result.events, state, look.theme, {
            bodyId: look.theme.classBodies?.[state.activeClassId] || look.theme.player,
            source,
          });
      }
    },
    complete({ state, seconds, dwell, picture, visibility, interrupted, foreground, gameSounds }) {
      const holding = reward.update({
        won: state.status === 'won',
        age: rewardAge,
        allowed: visibility === 'clear',
        pin: picture?.storyPin,
        paused: interrupted || !foreground,
        reduced: getContext().reduced || (getContext().quality ?? 'full') !== 'full',
        volume: getContext().library.cinematicVolume ?? 0.7,
        muted: !gameSounds,
      });
      if (!holding && (foreground ? rewardAge : dwell) >= REWARD_STORY_SECONDS)
        rewardTail += Math.min(seconds, 0.25);
      else rewardTail = 0;
      return state.status === 'won' ? rewardTail >= 2.2 : dwell >= 4;
    },
    paint({
      seconds,
      state,
      look,
      practice,
      phase,
      interrupted,
      foreground,
      visibility,
      detailsOpen,
    }) {
      const current = getContext(),
        quality = current.quality ?? 'full',
        reduced = current.reduced || quality !== 'full',
        options = current.renderOptions ?? {},
        painter = look.painter,
        paused = practice ? practice.phase !== 'playing' : phase !== 'playing',
        animated =
          !interrupted &&
          (practice ? practice.phase === 'playing' : ['playing', 'complete'].includes(phase));
      if (
        !animated &&
        lastPaint?.state === state &&
        lastPaint.tick === state.tick &&
        lastPaint.painter === painter &&
        lastPaint.generation === painter.preparationGeneration &&
        lastPaint.paintRevision === painter.paintRevision &&
        lastPaint.displayRevision === displayRevision &&
        lastPaint.paused === paused &&
        lastPaint.interrupted === interrupted &&
        lastPaint.detailsOpen === detailsOpen &&
        lastPaint.reduced === current.reduced &&
        lastPaint.quality === quality &&
        lastPaint.visibility === visibility &&
        lastPaint.textFace === options.textFace &&
        lastPaint.showGrid === options.showGrid &&
        lastPaint.showCombatScrap === options.showCombatScrap &&
        lastPaint.brutal === options.brutal &&
        lastPaint.blood === options.blood
      )
        return;
      if (state.status === 'won')
        rewardAge = advanceRewardAge(rewardAge, seconds, interrupted || !foreground);
      const expanded = state.status === 'won' && rewardAge >= REWARD_BOARD_SECONDS && !practice;
      if (expanded && dialog.dataset.reward !== 'expanded') {
        const from = canvas.getBoundingClientRect();
        dialog.dataset.reward = 'expanded';
        animateRewardArrival(canvas, from, reduced);
        displayCSSWidth = null;
      } else if (!expanded && dialog.dataset.reward) {
        delete dialog.dataset.reward;
        displayCSSWidth = null;
      }
      context ??= canvas.getContext('2d');
      if (!context) return;
      if (displayCSSWidth === null) {
        const height = canvas.clientHeight,
          width = canvas.clientWidth;
        displayCSSWidth =
          height > 0 ? Math.min(width, (height * canvas.width) / canvas.height) : width;
      }
      look.painter.draw(context, state, Math.min(seconds, 0.1), {
        ...options,
        actorAppearance: look.actors
          ? { style: look.actors.pin().style, snapshot: look.actors.snapshot }
          : null,
        displayCSSWidth,
        quality,
        paused,
        reduced: current.reduced,
        fullReveal: state.status === 'won',
        backdrop: look.picture?.backdrop,
        pictureVisibility: visibility,
        pictureInterference: true,
        celebrationPaused: interrupted,
        defeatEffectsRunning: !interrupted,
        signalReception:
          state.status === 'won' ? 'off' : state.status === 'lost' ? 'lost' : 'playing',
        signalEffectsRunning:
          !interrupted &&
          (state.status === 'lost' ||
            (practice ? practice.phase === 'playing' : phase === 'playing')),
        demoTransition: reduced ? 0 : Math.max(0, 1 - transitionAge / 0.55),
      });
      lastPaint = {
        state,
        tick: state.tick,
        painter,
        generation: painter.preparationGeneration,
        paintRevision: painter.paintRevision,
        displayRevision,
        paused,
        interrupted,
        detailsOpen,
        reduced: current.reduced,
        quality,
        visibility,
        textFace: options.textFace,
        showGrid: options.showGrid,
        showCombatScrap: options.showCombatScrap,
        brutal: options.brutal,
        blood: options.blood,
      };
    },
    updateAudio({ active, state, look, source }) {
      audio?.update?.({
        active,
        state,
        theme: look?.theme,
        bodyId: look?.theme?.classBodies?.[state?.activeClassId] || look?.theme?.player,
        source,
      });
    },
  };
}
