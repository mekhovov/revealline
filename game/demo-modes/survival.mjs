import { survivalDemoInventory, survivalDemoLaunchURL } from './survival-catalog.mjs';
import { prepareSurvivalDemoPlayer, createSurvivalDemoPractice } from './survival-replay.mjs';
import { SURVIVAL_DEMO_RUNTIME_VARIANTS } from './survival-runtime-variants.mjs';
import { demoRuntimeEngineHint, preferDemoRuntimeCandidates } from '../demo-runtime.mjs';

const cancelled = (signal) => {
  if (signal?.aborted) throw signal.reason ?? new DOMException('Cancelled', 'AbortError');
};
const localized = (value, locale) => value?.[locale] ?? value?.en ?? value;
const copy = {
  en: {
    goal: 'Survive the sortie, collect salvage, and choose upgrades to defeat the final target.',
    draft: 'Choose an upgrade',
    reroll: 'Reroll',
    recorded: 'Recorded demo',
    live: 'Practice',
    controls: 'Move: WASD / arrow keys · Boost: Space · Drag to steer on touch screens',
    phases: {
      ready: 'Ready',
      playing: 'Flying',
      paused: 'Paused',
      upgrade: 'Choose an upgrade',
      won: 'Sortie complete',
      lost: 'Sortie ended',
    },
    captions: {
      salvage: 'Collected salvage fills the next upgrade meter.',
      'upgrade-ready': 'A full salvage meter offers a choice of upgrades.',
      upgrade: 'This chosen upgrade changes the drone’s weapons or support systems.',
      evolution: 'The upgraded system has evolved.',
      warning: 'The marked area shows an incoming attack. Move clear before it lands.',
      boost: 'A short boost helps the drone escape danger.',
      elite: 'The elite target is defeated. Keep gathering salvage for the final encounter.',
      final: 'The final target is defeated.',
    },
  },
  uk: {
    goal: 'Виживіть у вильоті, збирайте ресурси та обирайте поліпшення, щоб знищити фінальну ціль.',
    draft: 'Оберіть поліпшення',
    reroll: 'Оновити вибір',
    recorded: 'Записаний показ',
    live: 'Практика',
    controls: 'Рух: WASD / стрілки · Ривок: пробіл · На сенсорному екрані ведіть пальцем',
    phases: {
      ready: 'Готово',
      playing: 'Політ',
      paused: 'Пауза',
      upgrade: 'Оберіть поліпшення',
      won: 'Виліт завершено',
      lost: 'Виліт закінчено',
    },
    captions: {
      salvage: 'Зібрані ресурси заповнюють шкалу наступного поліпшення.',
      'upgrade-ready': 'Повна шкала ресурсів відкриває вибір поліпшень.',
      upgrade: 'Обране поліпшення змінює зброю дрона або системи підтримки.',
      evolution: 'Поліпшена система еволюціонувала.',
      warning: 'Позначена зона показує майбутню атаку. Залиште її до удару.',
      boost: 'Короткий ривок допомагає дрону уникнути небезпеки.',
      elite: 'Елітну ціль знищено. Збирайте ресурси для фінального бою.',
      final: 'Фінальну ціль знищено.',
    },
  },
};

/** Native simulation and rendering without mounting the persistence-owning game app. */
export function createSurvivalDemoAdapter({
  fetch: fetcher = globalThis.fetch,
  locale = 'en',
  engineHint = demoRuntimeEngineHint(),
} = {}) {
  const language = () => (typeof locale === 'function' ? locale() : locale);
  const text = () => copy[language()] ?? copy.en;
  const variants = preferDemoRuntimeCandidates(
    ['', ...SURVIVAL_DEMO_RUNTIME_VARIANTS],
    engineHint,
    (variant) => variant,
  );
  return {
    modeId: 'survival',
    label: 'FPV Survival',
    enumerateSources() {
      return survivalDemoInventory().map((entry) => ({
        ...entry,
        kind: 'replay',
        label: localized(entry.title, language()),
        goal: text().goal,
        launchURL: survivalDemoLaunchURL(entry),
        async load({ signal, variant = '' } = {}) {
          cancelled(signal);
          const response = await fetcher(
            new URL(
              `../demo-data/survival/${entry.levelId}${variant ? `.${variant}` : ''}.replay.json`,
              import.meta.url,
            ),
            { signal },
          );
          if (!response.ok) {
            const error = new Error('This Survival recording is unavailable.');
            error.code = 'demo-content-unavailable';
            throw error;
          }
          const body = await response.text();
          if (body.length > 2 * 1024 * 1024)
            throw Object.assign(new Error('Survival recording exceeds its byte budget.'), {
              code: 'demo-content-mismatch',
            });
          cancelled(signal);
          return body;
        },
        async create({ signal, payload } = {}) {
          let firstFailure;
          // Native Math implementations differ between engines. Each candidate
          // is a separately authored full performance, and must pass every
          // exact checkpoint plus full terminal verification on this device.
          for (const [index, variant] of variants.entries()) {
            cancelled(signal);
            try {
              return await prepareSurvivalDemoPlayer(
                entry,
                index === 0 && payload !== undefined
                  ? payload
                  : await this.load({ signal, variant }),
                { signal },
              );
            } catch (error) {
              cancelled(signal);
              if (!['demo-content-mismatch', 'demo-content-unavailable'].includes(error.code))
                throw error;
              firstFailure ??= error;
            }
          }
          throw firstFailure;
        },
        loadPayload(options) {
          return this.load({ ...options, variant: variants[0] });
        },
      }));
    },
    presentation(source, player) {
      return {
        title: localized(source.title, language()),
        goal: text().goal,
        status: text().phases[player?.state?.phase ?? 'ready'] ?? text().phases.ready,
        controls: text().controls,
      };
    },
    semanticEvents(events) {
      return (Array.isArray(events) ? events : (events?.events ?? [])).flatMap((event) => {
        const caption = text().captions[event.type];
        return caption
          ? [
              {
                type: event.type,
                caption,
                captionKey: `survival:${event.type}`,
                captionText: () => text().captions[event.type],
                ...(event.type === 'warning' ? { expiresAfter: 6 } : {}),
              },
            ]
          : [];
      });
    },
    createPractice: createSurvivalDemoPractice,
    attachInput: attachSurvivalDemoInput,
    async mountScene({ player, parent, document = parent.ownerDocument, signal, reduced = false }) {
      cancelled(signal);
      const [
        { createOverflightRenderer },
        { createPresentationHost },
        { overflightWorldImageSlots },
      ] = await Promise.all([
        import('../overflight/renderer.mjs'),
        import('../presentation/host.mjs'),
        import('../presentation/overflight-world-slots.mjs'),
      ]);
      cancelled(signal);
      const artwork = createPresentationHost({ profile: 'board', document, fetch: fetcher });
      const controller = new AbortController();
      const abort = () => controller.abort(signal.reason);
      signal?.addEventListener('abort', abort, { once: true });
      const surface = document.createElement('div');
      surface.className = 'demo-survival-surface';
      surface.style.cssText = 'position:relative;width:100%;height:100%;min-height:240px';
      const draft = document.createElement('div');
      draft.className = 'demo-survival-upgrades';
      draft.dataset.demoUi = 'true';
      draft.style.cssText =
        'position:absolute;inset:auto 1rem 1rem;display:flex;flex-wrap:wrap;gap:.5rem;justify-content:center;background:#11251fee;padding:.75rem;border-radius:.5rem;z-index:2';
      draft.hidden = true;
      parent.append(surface);
      let renderer = null,
        appearance = null,
        disposed = false,
        disposal = null,
        failure = null,
        currentPractice = null,
        draftKey = '';
      const dispose = () => {
        if (disposal) return disposal;
        disposed = true;
        disposal = Promise.resolve().then(async () => {
          controller.abort();
          signal?.removeEventListener('abort', abort);
          try {
            await renderer?.destroy();
          } finally {
            artwork.close();
            draft.remove();
            surface.remove();
          }
        });
        return disposal;
      };
      try {
        const compiled = player.state.compiled;
        await artwork.load({
          signal: controller.signal,
          worldImageSlots: overflightWorldImageSlots(compiled.presentation),
        });
        cancelled(controller.signal);
        appearance = {
          snapshot: artwork.current(),
          reducedEffects: reduced,
          artRevision: compiled.resources.actorArtRevision,
          presentation: compiled.presentation,
          arena: compiled.arena,
        };
        renderer = await createOverflightRenderer({
          parent: surface,
          appearance,
          arena: compiled.arena,
          presentation: compiled.presentation,
          // The common demo clock is the only simulation scheduler.
          onFrame() {},
          onContextLost() {
            failure = Object.assign(new Error('Survival graphics context was lost.'), {
              code: 'demo-renderer-unavailable',
              modeId: 'survival',
            });
          },
          onContextRestored() {
            failure = null;
          },
          onError(error) {
            failure = Object.assign(error, {
              code: 'demo-renderer-unavailable',
              modeId: 'survival',
            });
          },
        });
        cancelled(controller.signal);
        parent.append(draft);
      } catch (error) {
        await dispose();
        if (!signal?.aborted) {
          error.code ??= 'demo-renderer-unavailable';
          error.modeId = 'survival';
        }
        throw error;
      }
      const canvas = surface.querySelector('canvas');
      if (canvas) canvas.tabIndex = 0;
      return {
        canvas,
        paint(_seconds, { player: shown = player, practice = null, reduced = false } = {}) {
          if (disposed) return;
          if (failure) throw failure;
          const run = practice?.state ?? shown.state;
          appearance.reducedEffects = reduced;
          currentPractice = practice;
          renderer.present(run);
          const key =
            run.phase === 'upgrade'
              ? `${language()}:${!!practice}:${run.tick}:${run.offers.map((card) => card.id).join(',')}:${run.progression.rerolls}`
              : '';
          if (key === draftKey) return;
          draftKey = key;
          draft.hidden = !key;
          draft.replaceChildren();
          if (!key) return;
          const title = document.createElement('strong');
          title.textContent = text().draft;
          title.style.cssText = 'flex-basis:100%;text-align:center';
          draft.append(title);
          for (const card of run.offers) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = localized(card.title ?? card.name, language()) ?? card.id;
            button.disabled = !practice;
            button.style.minHeight = '44px';
            button.addEventListener('click', () => currentPractice?.chooseUpgrade(card.id));
            draft.append(button);
          }
          if (practice) {
            const reroll = document.createElement('button');
            reroll.type = 'button';
            reroll.textContent = `${text().reroll} (${run.progression.rerolls})`;
            reroll.disabled = run.progression.rerolls <= 0;
            reroll.style.minHeight = '44px';
            reroll.addEventListener('click', () => currentPractice?.rerollUpgrade());
            draft.append(reroll);
          }
        },
        resourceStats: () => renderer.resourceStats(),
        dispose,
      };
    },
  };
}

/** A continuous native movement adapter; all devices need fresh input after ownership changes. */
export function attachSurvivalDemoInput({
  root,
  canvas,
  practice,
  onTakeover,
  onActivity = () => {},
  onBack = () => {},
  onPause = () => {},
  onResume = (intent) => practice()?.start(intent),
  menu = () => {},
}) {
  const document = root.ownerDocument,
    window = document.defaultView;
  const held = new Set(),
    removers = [];
  let pointer = null,
    touch = { x: 0, y: 0 },
    pad = { x: 0, y: 0 },
    padNeutral = false;
  let pending = false,
    invokingTakeover = false,
    handoffIntent = null,
    disposed = false;
  const movements = new Set([
    'ArrowUp',
    'ArrowRight',
    'ArrowDown',
    'ArrowLeft',
    'KeyW',
    'KeyD',
    'KeyS',
    'KeyA',
    'Space',
  ]);
  const listen = (target, name, listener, options) => {
    target.addEventListener(name, listener, options);
    removers.push(() => target.removeEventListener(name, listener, options));
  };
  const vector = (boost = false) => ({
    x:
      Number(held.has('ArrowRight') || held.has('KeyD')) -
        Number(held.has('ArrowLeft') || held.has('KeyA')) ||
      touch.x ||
      pad.x,
    y:
      Number(held.has('ArrowDown') || held.has('KeyS')) -
        Number(held.has('ArrowUp') || held.has('KeyW')) ||
      touch.y ||
      pad.y,
    boost,
  });
  const active = () => !disposed && !document.hidden && document.hasFocus?.() !== false;
  const followMovement = (intent) => {
    // Reconstruction may still be pending when the initiating key or touch is
    // released. Keep its movement current without replaying its action edge.
    if (handoffIntent) Object.assign(handoffIntent, { x: intent.x, y: intent.y });
    practice()?.steer(intent);
  };
  const change = (intent) => {
    onActivity();
    if (handoffIntent) Object.assign(handoffIntent, { x: intent.x, y: intent.y });
    if (practice()?.phase === 'paused') onResume(intent);
    else if (practice()) practice().steer(intent);
    else if (!pending) {
      pending = true;
      handoffIntent = { ...intent };
      // The host synchronously interrupts watching before reconstructing the
      // practice world. That clear transfers ownership of this fresh gesture;
      // it must not discard the physical key or pointer needed for its release.
      invokingTakeover = true;
      try {
        Promise.resolve(onTakeover(handoffIntent))
          .finally(() => {
            pending = false;
            handoffIntent = null;
          })
          .catch(() => {});
      } catch {
        pending = false;
        handoffIntent = null;
      } finally {
        invokingTakeover = false;
      }
    }
  };
  const reset = () => {
    held.clear();
    pointer = null;
    touch = { x: 0, y: 0 };
    pad = { x: 0, y: 0 };
    padNeutral = false;
    if (handoffIntent) Object.assign(handoffIntent, { x: 0, y: 0, boost: false });
    practice()?.steer({});
  };
  const clear = () => {
    if (!invokingTakeover) reset();
  };
  listen(
    window,
    'keydown',
    (event) => {
      if (active() && event.code === 'Escape' && !event.repeat) {
        event.preventDefault();
        event.stopImmediatePropagation?.();
        onBack();
        return;
      }
      if (
        !active() ||
        !movements.has(event.code) ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.target?.closest?.('input,textarea,select,[data-demo-ui]') ||
        (event.code === 'Space' && event.target?.closest?.('button,a'))
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation?.();
      const fresh = !event.repeat && !held.has(event.code);
      if (!fresh) return;
      held.add(event.code);
      change(vector(event.code === 'Space'));
    },
    true,
  );
  listen(
    window,
    'keyup',
    (event) => {
      if (held.delete(event.code)) followMovement(vector());
    },
    true,
  );
  if (canvas) {
    listen(canvas, 'pointerdown', (event) => {
      if (!active() || event.button > 0 || pointer !== null) return;
      event.preventDefault();
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      canvas.setPointerCapture?.(event.pointerId);
      change({});
    });
    listen(window, 'pointermove', (event) => {
      if (!active() || pointer?.id !== event.pointerId) return;
      const x = (event.clientX - pointer.x) / 48,
        y = (event.clientY - pointer.y) / 48;
      const magnitude = Math.max(1, Math.hypot(x, y));
      touch = { x: x / magnitude, y: y / magnitude };
      followMovement(vector());
    });
    const release = (event) => {
      if (pointer?.id !== event.pointerId) return;
      pointer = null;
      touch = { x: 0, y: 0 };
      followMovement(vector());
    };
    listen(window, 'pointerup', release);
    listen(window, 'pointercancel', release);
  }
  listen(window, 'blur', () => {
    reset();
    practice()?.pause();
  });
  listen(document, 'visibilitychange', () => {
    if (document.hidden) {
      reset();
      practice()?.pause();
    }
  });
  const sampleController = (frame = {}) => {
    const sample = frame.flight ?? frame;
    if (!active()) {
      reset();
      return;
    }
    if (frame.ui?.back) {
      onBack();
      return;
    }
    if (frame.ui?.menu || sample.pause || sample.stop) {
      reset();
      onPause();
      return;
    }
    if (root.ownerDocument.activeElement?.closest?.('[data-demo-ui]')) {
      menu(frame.ui ?? {});
      return;
    }
    const directions = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
    const [x, y] = directions[sample.direction] ?? [Number(sample.x) || 0, Number(sample.y) || 0];
    const neutral = Math.hypot(x, y) < 0.25 && !sample.boost;
    if (frame.disconnected) {
      reset();
      practice()?.pause();
      return;
    }
    if (!padNeutral) {
      if (neutral) padNeutral = true;
      return;
    }
    const wasNeutral = Math.hypot(pad.x, pad.y) < 0.25 && !pad.boost;
    pad = { x: Math.abs(x) >= 0.25 ? x : 0, y: Math.abs(y) >= 0.25 ? y : 0, boost: !!sample.boost };
    if (wasNeutral && !neutral) change(vector(pad.boost));
    else if (pending || practice()?.phase === 'playing') followMovement(vector(pad.boost));
  };
  return {
    sample: sampleController,
    controller: sampleController,
    clear,
    dispose() {
      if (disposed) return;
      disposed = true;
      reset();
      for (const remove of removers) remove();
    },
  };
}
