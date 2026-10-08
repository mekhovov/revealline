import { DIALOGUE_MUSIC_GAIN } from '../audio/dialogue-mix.mjs';
import { attachHuntFeedbackLayout } from './hunt-feedback-layout.mjs';
import {
  journeyOwnsReactionCaption,
  reactionCaptionText,
  renderResultReactionCaption,
} from './reaction-caption.mjs';
import { createReactionVoiceCache } from '../journey/reaction-voice-cache.mjs';
import { getLocale as currentLocale, onLocaleChange } from '../i18n/index.mjs';
import {
  JOURNEY_REACTIONS,
  REACTION_LINES,
  reactionLine,
  journeyResultReaction,
} from '../journey/reactions.mjs';
import { createReactionPreferences } from '../journey/reaction-preferences.mjs';
import { createReactionOptions } from '../journey/reaction-options.mjs';
import { createReactionVoiceLibrary } from '../journey/reaction-voice-library.mjs';
import { REACTION_PORTRAITS } from '../journey/reaction-portraits.mjs';
import { actorDefinition, resolveActorFamily } from '../hunt/actor-catalog.mjs';
import { actorEventReaction } from '../hunt/actor-reactions.mjs';
import { drawHuntActor } from '../hunt/actor-art.mjs';
import { sharedActorAppearance } from '../hunt/preferences.mjs';
import { OVERFLIGHT_REACTION_FAMILIES } from '../overflight/reactions.mjs';

const recentLines = new Map();
const HISTORY_KEY = 'revealline.reaction-recent.v1';
/** Warm the active cast first, then shared pilot lines. Unrelated enemy packs
 * must not displace the current encounter from the bounded decoded cache. */
export function reactionWarmupLineIds({ families = [], originals = [], available = [], locale }) {
  const active = new Set(families.map(resolveActorFamily).filter(Boolean));
  const relevant = (id) => {
    const line = REACTION_LINES.find((entry) => entry.id === id);
    return line && (!actorDefinition(line.speaker) || active.has(line.speaker));
  };
  return [
    ...new Set([
      ...REACTION_LINES.filter((line) => active.has(line.speaker)).map((line) => line.id),
      ...originals
        .filter((line) => line.locale === locale && relevant(line.lineId))
        .map((line) => line.lineId),
      ...available.filter(relevant),
    ]),
  ].slice(0, 24);
}
const lineRepeatKey = (line) =>
  line.family === 'result' || actorDefinition(line.speaker)
    ? line.id
    : `${line.family}/${line.id.split('/').at(-1)}`;
const speakerFor = (context) =>
  Object.hasOwn(JOURNEY_REACTIONS, context.speaker)
    ? context.speaker
    : context.mode === 'versus'
      ? 'rival'
      : context.mode === 'team'
        ? 'engineer'
        : context.encounter
          ? 'sentinel'
          : 'guide';
const familyFor = (event) =>
  ({
    'cells.claimed': 'capture',
    'combat.eliminated': 'elimination',
    'actor.caught': 'elimination',
    'actor.noticed': 'notice',
    'player.respawned': 'recovery',
    'craft.redeployed': 'recovery',
    'player.revived': event.reason === 'reserve' ? 'recovery' : 'rescue',
    'rescue.completed': 'rescue',
    ...OVERFLIGHT_REACTION_FAMILIES,
  })[event.type];
const urgent = (event) =>
  /^(combat.locked|player.failed|player.downed|lineImpact.seeded|impact.launched)$/.test(
    event.type,
  );

/** Presentation history is deliberately separate from rules, saves and simulation RNG. */
export class ContextualReactionDirector {
  constructor({
    now = () => Date.now(),
    present = () => {},
    cancel = () => {},
    getLocale = currentLocale,
  } = {}) {
    this.now = now;
    this.present = present;
    this.cancel = cancel;
    this.getLocale = getLocale;
    this.reset('');
    try {
      const saved = JSON.parse(globalThis.sessionStorage?.getItem(HISTORY_KEY) ?? '[]');
      if (Array.isArray(saved))
        for (const pair of saved.slice(-64))
          if (Array.isArray(pair) && typeof pair[0] === 'string' && Number.isFinite(pair[1]))
            recentLines.set(pair[0], pair[1]);
    } catch {
      /* History is optional presentation state. */
    }
  }
  reset(attemptId) {
    this.cancel();
    this.attemptId = String(attemptId);
    this.seen = new Set();
    this.families = new Set();
    this.count = 0;
    this.quietUntil = 0;
    this.busyUntil = 0;
    this.resultId = null;
    this.suspended = false;
  }
  remember(line) {
    const time = this.now();
    recentLines.set(lineRepeatKey(line), time);
    for (const [id, last] of recentLines) if (time - last >= 300000) recentLines.delete(id);
    try {
      globalThis.sessionStorage?.setItem(HISTORY_KEY, JSON.stringify([...recentLines].slice(-64)));
    } catch {
      /* Optional. */
    }
  }
  events(events, context = {}) {
    if (!Array.isArray(events) || !['solo', 'versus', 'team'].includes(context.mode)) return null;
    if (context.attemptId !== undefined && String(context.attemptId) !== this.attemptId)
      this.reset(context.attemptId);
    const fresh = [];
    for (let index = 0; index < events.length; index++) {
      const event = events[index];
      if (!event || typeof event.type !== 'string') continue;
      const id = `${context.board ?? context.mode}:${event.tick}:${event.time}:${index}:${event.type}:${event.id ?? event.player ?? ''}`;
      if (this.seen.has(id)) continue;
      this.seen.add(id);
      fresh.push(event);
    }
    if (this.seen.size > 4096) this.seen = new Set([...this.seen].slice(-2048));
    const time = this.now();
    if (context.danger === true || fresh.some(urgent)) {
      this.cancel('danger');
      this.quietUntil = Math.max(this.quietUntil, time + 12000);
      return null;
    }
    if (
      this.suspended ||
      context.enabled === false ||
      context.seeking ||
      this.count >= 3 ||
      time < this.quietUntil ||
      time < this.busyUntil
    )
      return null;
    const speaker = speakerFor(context);
    const candidates = fresh
      .map((event) => ({ event, family: familyFor(event) }))
      .filter((item) => item.family && !this.families.has(item.family))
      .sort(
        (a, b) =>
          ['rescue', 'recovery', 'elimination', 'capture', 'notice'].indexOf(a.family) -
          ['rescue', 'recovery', 'elimination', 'capture', 'notice'].indexOf(b.family),
      );
    for (const { event, family } of candidates) {
      const actor = resolveActorFamily(
        event.actorFamily ?? event.kind ?? context.actorFamilyFor?.(event.id),
      );
      const actorLine =
        actor && ['elimination', 'notice'].includes(family)
          ? actorEventReaction(actor, family === 'notice' ? 'notice' : 'caught', this.getLocale())
          : null;
      const line =
        actorLine && time - (recentLines.get(lineRepeatKey(actorLine)) ?? -Infinity) >= 300000
          ? REACTION_LINES.find((entry) => entry.id === actorLine.id)
          : REACTION_LINES.find(
              (entry) =>
                entry.speaker === speaker &&
                entry.family === family &&
                time - (recentLines.get(lineRepeatKey(entry)) ?? -Infinity) >= 300000,
            );
      if (!line) continue;
      const selected = {
        ...reactionLine(line.id, this.getLocale()),
        board: context.mode === 'versus' ? context.board : null,
        player: Number.isInteger(event.player) ? event.player : null,
      };
      this.remember(line);
      this.families.add(family);
      this.count++;
      const duration = Math.max(3000, Math.ceil((selected.text.split(/\s+/u).length / 2.5) * 1000));
      this.busyUntil = time + duration;
      this.quietUntil = this.busyUntil + 12000;
      const presented = this.present(selected, { duration, terminal: false });
      if (Number.isFinite(presented)) {
        this.busyUntil = time + presented;
        this.quietUntil = this.busyUntil + 12000;
      }
      return selected;
    }
    return null;
  }
  result(context) {
    const line = journeyResultReaction(context, this.getLocale());
    if (!line || this.suspended || context.enabled === false) return null;
    const identity = `${this.attemptId}:${context.mode}:${context.missionId}:${context.outcome}`;
    if (identity === this.resultId) return null;
    this.resultId = identity;
    this.cancel('result');
    const original = REACTION_LINES.find((entry) => entry.id === line.id);
    const speak =
      !original || this.now() - (recentLines.get(lineRepeatKey(original)) ?? -Infinity) >= 300000;
    if (original && speak) this.remember(original);
    this.present(
      { ...line, family: 'result', resultContext: context },
      { terminal: true, duration: Infinity, speak },
    );
    return line;
  }
  suspend() {
    this.suspended = true;
    this.cancel('suspend');
  }
  resume() {
    this.suspended = false;
  }
}

const labels = {
  title: ['Character reaction sound and captions', 'Звук і субтитри реакцій персонажів'],
  sounds: ['Reaction sounds', 'Звуки реакцій'],
  speech: ['Spoken reactions', 'Озвучені реакції'],
  subtitles: ['Reaction captions', 'Субтитри реакцій'],
  volume: ['Dialogue volume', 'Гучність діалогів'],
  scale: ['Caption size', 'Розмір субтитрів'],
  background: ['Solid caption background', 'Суцільне тло субтитрів'],
  preview: ['Preview caption', 'Переглянути субтитри'],
  retry: ['Retry saving', 'Зберегти повторно'],
  unavailable: [
    'Changes apply to this session; saving is unavailable.',
    'Зміни діють у цьому сеансі; збереження недоступне.',
  ],
  pilot: [
    'Generated voice preview. Missing recordings use captions.',
    'Попередня синтезована озвучка. Відсутні записи замінюються субтитрами.',
  ],
};
export function attachContextualReactions({
  sound,
  container,
  resultContainer = null,
  settingsContainer = null,
  document: doc = container?.ownerDocument ?? globalThis.document,
  window: target = globalThis.window,
  getLocale = currentLocale,
  getReduced = () => doc?.body?.dataset.effects === 'reduced',
  getStorage,
  acquireGain = () => null,
  voiceLibrary = null,
} = {}) {
  if (!sound || !container || !doc)
    throw new TypeError('Reaction sound and caption container are required.');
  const ownLibrary = !voiceLibrary;
  voiceLibrary ??= createReactionVoiceLibrary();
  const tr = (key) => labels[key][getLocale() === 'uk' ? 1 : 0];
  const create = (tag, text = '') => {
    const node = doc.createElement(tag);
    node.textContent = text;
    return node;
  };
  const panel = create('div'),
    portrait = create('img'),
    actorPortrait = create('canvas'),
    caption = create('span');
  panel.dataset.characterReaction = 'true';
  panel.className = 'reaction-live-caption';
  panel.hidden = true;
  panel.style.cssText =
    'display:none;align-items:center;gap:.65rem;max-width:100%;padding:.5rem .7rem;border-radius:.4rem;box-sizing:border-box;pointer-events:none;';
  portrait.setAttribute('aria-hidden', 'true');
  portrait.alt = '';
  portrait.style.cssText =
    'display:block;flex:0 0 var(--reaction-portrait-size,3rem);width:var(--reaction-portrait-size,3rem);height:var(--reaction-portrait-size,3rem);border-radius:.4rem;image-rendering:pixelated;';
  actorPortrait.setAttribute('aria-hidden', 'true');
  actorPortrait.width = actorPortrait.height = 56;
  actorPortrait.style.cssText = portrait.style.cssText;
  actorPortrait.hidden = true;
  caption.style.cssText =
    'font-family:system-ui,sans-serif;line-height:1.45;overflow-wrap:anywhere;min-width:0;';
  panel.append(portrait, actorPortrait, caption);
  container.append(panel);
  const releaseFeedbackLayout = attachHuntFeedbackLayout({ container, window: target });
  const preferences = createReactionPreferences({
    window: target,
    getLocale,
    ...(getStorage ? { getStorage } : {}),
  });
  const options = createReactionOptions({ window: target, ...(getStorage ? { getStorage } : {}) });
  let closed = false,
    current = null,
    timer = null,
    activeVoice = null,
    lease = null,
    generation = 0,
    captionUntil = 0,
    motion = null;
  const cache = createReactionVoiceCache({ sound, library: voiceLibrary });
  const prepared = new Map(),
    controls = new Map(),
    controlLabels = new Map();
  let settings = null,
    actorVoiceControls = null,
    status = null,
    pilot = null,
    previewSample = null,
    previewVisible = false;
  const release = () => {
    try {
      if (typeof lease === 'function') lease();
      else lease?.release?.();
    } catch {
      /* A presentation lease cannot stop play. */
    }
    lease = null;
  };
  function stopSpeech() {
    activeVoice?.stop();
    activeVoice = null;
    release();
  }
  function hide() {
    motion?.cancel();
    motion = null;
    if (current?.terminal && resultContainer && !journeyOwnsReactionCaption(resultContainer))
      renderResultReactionCaption(resultContainer, null, options.snapshot(), false, getLocale());
    current = null;
    panel.hidden = true;
    panel.style.display = 'none';
    caption.textContent = '';
  }
  function cancel(reason) {
    stopSpeech();
    if (reason === 'suspend') {
      generation++;
      prepared.clear();
      void cache.cancel();
    }
    if (reason === 'danger') return; // Preserve readable text even when its audio is interrupted.
    clearTimeout(timer);
    hide();
  }
  function render() {
    if (closed) return;
    const state = options.snapshot(),
      enabled = preferences.snapshot().enabled;
    sound.configureDialogue({ enabled: enabled && state.speech, volume: state.volume });
    if (!enabled || !state.speech) {
      stopSpeech();
      generation++;
      prepared.clear();
      void cache.cancel();
    }
    if (!enabled) {
      clearTimeout(timer);
      // Retain an accepted result so its shared checkbox can hide/show the
      // caption without replaying its voice. Incidental lines still expire.
      if (!current?.terminal) hide();
    }
    for (const [key, control] of controls) {
      if (control.type === 'checkbox') control.checked = state[key];
      else control.value = String(state[key]);
      if (controlLabels.has(key)) controlLabels.get(key).textContent = tr(key);
    }
    if (settings) settings.querySelector('legend').textContent = tr('title');
    if (pilot) pilot.textContent = tr('pilot');
    actorVoiceControls?.refresh();
    if (settings) {
      const preview = settings.querySelector('[data-reaction-preview]');
      preview.textContent = tr('preview');
      preview.disabled = !enabled || !state.subtitles;
      settings.querySelector('[data-reaction-retry]').textContent = tr('retry');
    }
    if (previewVisible && previewSample)
      renderResultReactionCaption(
        previewSample,
        reactionLine('journey-reaction.v1/guide/0', getLocale()),
        state,
        enabled,
        getLocale(),
      );
    if (status) {
      status.textContent = state.durable ? '' : tr('unavailable');
      status.hidden = state.durable;
    }
    panel.style.background = state.background ? 'var(--panel-bg, #172126)' : 'transparent';
    panel.style.color = 'var(--text-color, #fff)';
    caption.style.fontSize = `${state.scale}rem`;
    if (current) {
      const localized =
        (current.line.resultContext
          ? journeyResultReaction(current.line.resultContext, getLocale())
          : reactionLine(current.line.id, getLocale())) ?? current.line;
      caption.textContent = reactionCaptionText(
        { ...localized, board: current.line.board, player: current.line.player },
        getLocale(),
      );
      const visible = enabled && state.subtitles && (!current.terminal || !resultContainer);
      panel.hidden = !visible;
      panel.style.display = visible ? 'flex' : 'none';
      if (current.terminal && resultContainer && !journeyOwnsReactionCaption(resultContainer))
        renderResultReactionCaption(resultContainer, localized, state, enabled, getLocale());
    }
  }
  let voiceFamilies = [],
    warmupRevision = 0;
  function prepare(families) {
    if (Array.isArray(families))
      voiceFamilies = [...new Set(families.map(resolveActorFamily).filter(Boolean))].sort();
    if (
      closed ||
      !preferences.snapshot().enabled ||
      !options.snapshot().speech ||
      !sound.context ||
      doc.hidden
    )
      return;
    const locale = getLocale(),
      context = sound.context,
      revision = generation;
    const previous = prepared.get(locale);
    if (
      previous?.context === context &&
      previous.generation === revision &&
      previous.families === voiceFamilies.join('|') &&
      Date.now() - previous.time < 30000
    )
      return;
    prepared.set(locale, {
      context,
      generation: revision,
      families: voiceFamilies.join('|'),
      time: Date.now(),
    });
    const warmup = ++warmupRevision,
      activeFamilies = [...voiceFamilies];
    // Two bounded asset decoders warm pilot and local recordings before events.
    // Missing recordings never enqueue or replay an already-expired reaction.
    void Promise.resolve(voiceLibrary.available?.(locale) ?? [])
      .then(async (available) => {
        await cache.ready();
        const ids = reactionWarmupLineIds({
          families: activeFamilies,
          originals: voiceLibrary.originals ?? [],
          available,
          locale,
        });
        let index = 0;
        const warm = async () => {
          while (
            index < ids.length &&
            !closed &&
            generation === revision &&
            warmup === warmupRevision &&
            getLocale() === locale &&
            !doc.hidden &&
            sound.context === context
          )
            await cache.load(ids[index++], locale);
        };
        await Promise.all([warm(), warm()]);
      })
      .catch(() => {});
  }
  function present(line, { duration, terminal, speak = true }) {
    if (closed || !preferences.snapshot().enabled) return;
    clearTimeout(timer);
    stopSpeech();
    motion?.cancel();
    motion = null;
    current = { line, terminal };
    const appearance = REACTION_PORTRAITS[line.speaker] ?? REACTION_PORTRAITS.guide;
    portrait.src = getReduced() ? appearance.idle : appearance.react;
    const actor = actorDefinition(line.speaker);
    const painter = actor ? actorPortrait.getContext?.('2d') : null;
    actorPortrait.hidden = !painter;
    actorPortrait.style.display = painter ? 'block' : 'none';
    portrait.hidden = !!painter;
    portrait.style.display = painter ? 'none' : 'block';
    if (painter) {
      const cast = sharedActorAppearance().snapshot().cast;
      painter.clearRect(0, 0, 56, 56);
      drawHuntActor(painter, 0, 0, 56, 0, {
        kind: actor.id,
        cast,
        state: line.family === 'caught' ? 'caught' : 'notice',
      });
    }
    render();
    if (!getReduced())
      motion = (painter ? actorPortrait : portrait).animate?.(
        [{ transform: 'scale(.88)' }, { transform: 'scale(1)' }],
        {
          duration: 180,
          easing: 'ease-out',
        },
      );
    const state = options.snapshot(),
      buffer = cache.get(line.id, getLocale());
    if (state.speech && speak && buffer) {
      activeVoice = sound.playDialogue(buffer, {
        // An accepted result may speak after gameplay SFX are retired. This
        // never bypasses gesture, full lifecycle pause, mute or dialogue prefs.
        ui: terminal === true,
        onended: () => {
          activeVoice = null;
          release();
        },
      });
      if (activeVoice) {
        try {
          lease = acquireGain({ factor: DIALOGUE_MUSIC_GAIN });
        } catch {
          lease = null;
        }
        duration = Math.max(duration, buffer.duration * 1000 + 350);
      }
    } else if (state.sounds && !terminal && line.family === 'capture') {
      sound.feedbackDirector?.play('confirm', { gain: 0.12, priority: 1 });
    }
    if (!buffer && state.speech) void cache.load(line.id, getLocale());
    if (!terminal) {
      captionUntil = Date.now() + duration;
      timer = setTimeout(hide, duration);
    } else if (resultContainer) {
      panel.hidden = true;
      panel.style.display = 'none';
    }
    return duration;
  }
  const director = new ContextualReactionDirector({ present, cancel, getLocale });
  if (settingsContainer) {
    settings = create('fieldset');
    settings.dataset.reactionSettings = 'true';
    settings.append(create('legend', tr('title')));
    for (const key of ['sounds', 'speech', 'subtitles', 'volume', 'scale', 'background']) {
      const label = create('label'),
        text = create('span', tr(key)),
        control = create(key === 'scale' ? 'select' : 'input');
      if (key === 'scale')
        for (const value of [1, 1.5, 2]) {
          const option = create('option', `${value * 100}%`);
          option.value = String(value);
          control.append(option);
        }
      else if (key === 'volume') {
        control.type = 'range';
        control.min = '0';
        control.max = '1';
        control.step = '.05';
      } else control.type = 'checkbox';
      control.dataset.reactionOption = key;
      control.onchange = () => {
        options.choose({
          [key]: control.type === 'checkbox' ? control.checked : Number(control.value),
        });
        prepare();
      };
      label.append(control, text);
      label.style.cssText = 'display:flex;align-items:center;gap:.5rem;margin:.5rem 0;';
      settings.append(label);
      controls.set(key, control);
      controlLabels.set(key, text);
    }
    const preview = create('button', tr('preview'));
    preview.type = 'button';
    preview.dataset.reactionPreview = 'true';
    previewSample = create('p');
    previewSample.dataset.reactionSettingsPreview = 'true';
    previewSample.hidden = true;
    previewSample.setAttribute('role', 'status');
    preview.onclick = () => {
      previewVisible = true;
      render();
    };
    const retry = create('button', tr('retry'));
    retry.type = 'button';
    retry.dataset.reactionRetry = 'true';
    retry.onclick = () => options.retry();
    status = create('p');
    status.setAttribute('role', 'status');
    pilot = create('p', tr('pilot'));
    settings.append(preview, previewSample, retry, status, pilot);
    settingsContainer.append(settings);
    actorVoiceControls =
      voiceLibrary.actorDownloads?.attach({
        container: settings,
        document: doc,
        getLocale,
      }) ?? null;
  }
  const unsubPrefs = preferences.subscribe(render),
    unsubOptions = options.subscribe(render);
  const unsubLibrary = voiceLibrary.subscribe(() => {
    void actorVoiceControls?.synchronize();
    generation++;
    prepared.clear();
    stopSpeech();
    void cache.cancel({ clear: true }).then(prepare);
  });
  const unsubLocale = onLocaleChange(() => {
    stopSpeech();
    render();
    prepare();
    if (current && !current.terminal) {
      clearTimeout(timer);
      timer = setTimeout(hide, Math.max(3000, captionUntil - Date.now()));
    }
  });
  const visibility = () => {
    if (doc.hidden) director.suspend();
    else director.resume();
  };
  doc.addEventListener('visibilitychange', visibility);
  const reducedMedia = target?.matchMedia?.('(prefers-reduced-motion: reduce)');
  const reducedChanged = () => {
    if (!getReduced()) return;
    motion?.cancel();
    motion = null;
    if (current)
      portrait.src = (REACTION_PORTRAITS[current.line.speaker] ?? REACTION_PORTRAITS.guide).idle;
  };
  const reducedObserver = target?.MutationObserver
    ? new target.MutationObserver(reducedChanged)
    : null;
  if (doc.body)
    reducedObserver?.observe(doc.body, { attributes: true, attributeFilter: ['data-effects'] });
  reducedMedia?.addEventListener?.('change', reducedChanged);
  const pagehide = () => director.suspend();
  target?.addEventListener?.('pagehide', pagehide);
  return Object.freeze({
    preferences,
    options,
    voiceLibrary,
    prepare,
    refresh() {
      render();
      prepare();
    },
    diagnostics: () =>
      Object.freeze({
        cache: cache.snapshot(),
        incidents: director.count,
        suspended: director.suspended,
        speaking: !!activeVoice && !activeVoice.ended,
      }),
    events(events, context) {
      const observed = Array.isArray(events)
        ? events
            .map((event) =>
              resolveActorFamily(
                event?.actorFamily ?? event?.kind ?? context?.actorFamilyFor?.(event?.id),
              ),
            )
            .filter(Boolean)
        : [];
      prepare(
        context?.actorFamilies ?? (observed.length ? [...voiceFamilies, ...observed] : undefined),
      );
      return director.events(events, { ...context, enabled: preferences.snapshot().enabled });
    },
    result(context) {
      prepare();
      return director.result({ ...context, enabled: preferences.snapshot().enabled });
    },
    reset: (attemptId) => director.reset(attemptId),
    suspend: () => director.suspend(),
    resume: () => director.resume(),
    dispose() {
      if (closed) return;
      closed = true;
      director.suspend();
      clearTimeout(timer);
      cache.dispose();
      prepared.clear();
      unsubPrefs();
      unsubOptions();
      unsubLocale();
      unsubLibrary();
      preferences.dispose();
      options.dispose();
      if (ownLibrary) voiceLibrary.close();
      doc.removeEventListener('visibilitychange', visibility);
      target?.removeEventListener?.('pagehide', pagehide);
      reducedObserver?.disconnect();
      reducedMedia?.removeEventListener?.('change', reducedChanged);
      for (const control of controls.values()) control.onchange = null;
      settings?.remove();
      actorVoiceControls?.dispose();
      panel.remove();
      releaseFeedbackLayout();
    },
  });
}
