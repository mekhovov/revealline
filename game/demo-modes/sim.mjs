const dataRoot = new URL('../../optional-practice/civilian-fpv/demo-data/', import.meta.url);
const failMode = (message, cause) =>
  Object.assign(new Error(message, { cause }), { code: 'demo-mode-unavailable', modeId: 'sim' });

/** Optional SIM code and individual recording bodies are loaded only on demand. */
export function createSimDemoAdapter({
  fetch: fetcher = globalThis.fetch,
  locale = getLocale,
} = {}) {
  let modules, playerRuntime, inputRuntime, latestPlayer;
  const language = () => (typeof locale === 'function' ? locale() : locale);
  const runtime = async () => {
    try {
      modules ??= Promise.all([
        import('../../optional-practice/civilian-fpv/demo-inventory.mjs'),
        import('../../optional-practice/civilian-fpv/demonstration-resolver.mjs'),
      ]);
      return await modules;
    } catch (error) {
      throw failMode('SIM is not available in this installation.', error);
    }
  };
  const read = async (file, signal) => {
    const response = await fetcher(new URL(file, dataRoot), { signal });
    if (!response.ok) throw new Error(`SIM demo payload unavailable (${response.status})`);
    const text = await response.text();
    if (text.length > 2 * 1024 * 1024) throw new Error('SIM demo payload exceeds its byte budget');
    return JSON.parse(text);
  };
  const local = (entry, key) =>
    entry.course.locales?.[language()]?.[key] ?? entry.course.locales?.en?.[key] ?? entry.id;
  return {
    id: 'sim',
    modeId: 'sim',
    title: 'SIM',
    label: 'SIM',
    async inventory() {
      return (await runtime())[0].simDemoInventory();
    },
    async enumerateSources({ signal } = {}) {
      const [{ simDemoInventory }, { resolveFlightDemonstration }] = await runtime();
      signal?.throwIfAborted();
      let catalog;
      try {
        catalog = await read('index.json', signal);
      } catch (error) {
        if (signal?.aborted) throw error;
        throw failMode('SIM demo package is unavailable.', error);
      }
      if (catalog.format !== 'SimDemoCatalog.v1' || !Array.isArray(catalog.entries))
        throw failMode('SIM demo package has invalid metadata.');
      return simDemoInventory().flatMap((required) =>
        catalog.entries
          .filter(
            (row) =>
              row.levelId === required.levelId &&
              row.variantId === required.variantId &&
              resolveFlightDemonstration({
                entry: required.entry,
                mode: row.variantId,
                worldDemonstrations: [row],
                flightDemonstrations: [row.proof],
              }),
          )
          .map((row) => {
            const launch = new URL(
              '../../optional-practice/fpv-worlds/index.html',
              import.meta.url,
            );
            launch.searchParams.set('demo-course', required.levelId);
            launch.searchParams.set('demo-course-identity', required.sourceIdentity);
            launch.searchParams.set('demo-flight-mode', required.variantId);
            launch.searchParams.set('demo-source', `sim:${row.id}`);
            launch.searchParams.set('demo-response-identity', row.proof.responseIdentity);
            launch.searchParams.set('lang', language());
            return {
              id: `sim:${row.id}`,
              modeId: 'sim',
              levelId: required.levelId,
              levelKey: required.levelKey,
              variantId: required.variantId,
              sourceIdentity: required.sourceIdentity,
              responseIdentity: row.proof.responseIdentity,
              demonstratedResponse: structuredClone(row.proof.response),
              kind: 'replay',
              approachable:
                required.entry.difficulty === 'beginner' && required.variantId === 'self-level',
              entry: required.entry,
              title: local(required.entry, 'title'),
              label: local(required.entry, 'title'),
              goal: local(required.entry, 'brief'),
              get launchURL() {
                launch.searchParams.set('lang', language());
                return launch.href;
              },
              loadPayload: ({ signal } = {}) => read(row.file, signal),
              async create({ signal, payload } = {}) {
                try {
                  playerRuntime ??= await import(
                    '../../optional-practice/civilian-fpv/demo-player.mjs'
                  );
                } catch (error) {
                  throw failMode('SIM playback runtime is unavailable.', error);
                }
                signal?.throwIfAborted();
                latestPlayer = await playerRuntime.createSimDemoPlayer(
                  required.entry,
                  payload ?? (await read(row.file, signal)),
                  { signal },
                );
                return latestPlayer;
              },
            };
          }),
      );
    },
    createPractice(fork) {
      // Runtime was admitted before the source could create this fork.
      if (!playerRuntime) throw new Error('SIM practice needs a prepared demo source');
      return playerRuntime.createSimDemoPractice(fork);
    },
    attachInput(options) {
      return inputRuntime.attachSimDemoInput({ ...options, getPlayer: () => latestPlayer });
    },
    async mountScene({ player, parent, document, signal }) {
      const canvas = document.createElement('canvas');
      canvas.className = 'demo-sim-canvas';
      canvas.style.cssText = 'display:block;width:100%;height:100%;min-height:240px';
      parent.append(canvas);
      let renderer, failure;
      const abort = () => {
        renderer?.dispose();
        canvas.remove();
      };
      signal?.addEventListener('abort', abort, { once: true });
      try {
        const { createFlightRenderer, builtinWorldScene } = await import(
          '../../optional-practice/civilian-fpv/world-assets.mjs'
        );
        const { createSnakeHuntPresentation } = await import(
          '../../optional-practice/civilian-fpv/snake-hunt-presentation.mjs'
        );
        inputRuntime ??= await import('../../optional-practice/civilian-fpv/demo-input.mjs');
        signal?.throwIfAborted();
        renderer = createFlightRenderer({
          canvas,
          window: document.defaultView,
          reducedMotion:
            document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
          createHuntPresentation: (options) =>
            createSnakeHuntPresentation({
              ...options,
              preferences: () => ({ brutal: false, blood: false, showRemains: true }),
            }),
          onContextLost() {
            failure = failMode('SIM graphics context was lost.');
          },
        });
        if (!renderer.available) throw failMode('SIM requires an available WebGL renderer.');
        renderer.setCourse(player.entry.course, player.proof.mode);
        const model = builtinWorldScene(player.entry.course);
        if (model) await renderer.loadScene({ data: model, signal });
        signal?.throwIfAborted();
        await renderer.prepare({ signal });
        return {
          canvas,
          paint(_seconds, { practice } = {}) {
            if (failure) throw failure;
            renderer.draw(practice?.state ?? player.state, {
              cameraMode: player.proof.mode === 'acro' ? 'fpv' : 'chase',
            });
          },
          resourceStats: () => renderer.resources(),
          resources: () => renderer.resources(),
          dispose() {
            signal?.removeEventListener('abort', abort);
            renderer.dispose();
            canvas.remove();
          },
        };
      } catch (error) {
        signal?.removeEventListener('abort', abort);
        renderer?.dispose();
        canvas.remove();
        if (signal?.aborted || error.code) throw error;
        throw failMode('SIM renderer could not be prepared.', error);
      }
    },
    presentation(source, player) {
      const uk = language() === 'uk';
      const status =
        player?.phase === 'paused'
          ? uk
            ? 'На паузі'
            : 'Paused'
          : player?.state?.status === 'complete'
            ? uk
              ? 'Ціль виконано'
              : 'Goal completed'
            : ['failed', 'expired'].includes(player?.state?.status)
              ? uk
                ? 'Спробу завершено'
                : 'Attempt ended'
              : uk
                ? 'Політ'
                : 'Flying';
      return { title: local(source.entry, 'title'), goal: local(source.entry, 'brief'), status };
    },
    semanticEvents(events) {
      return events.flatMap((event) => {
        const captionText =
          event.type === 'objective.completed'
            ? () =>
                language() === 'uk'
                  ? `Ціль виконано: ${event.step} із ${event.total}.`
                  : `Objective completed: ${event.step} of ${event.total}.`
            : event.type === 'target.caught'
              ? () =>
                  language() === 'uk'
                    ? 'Ціль спіймано прямим дотиком дрона.'
                    : 'The drone caught a target through direct contact.'
              : null;
        return captionText
          ? [
              {
                captionKey:
                  event.type === 'objective.completed'
                    ? `sim:objective:${event.step}:${event.total}`
                    : 'sim:target',
                captionText,
                caption: captionText(),
              },
            ]
          : [];
      });
    },
  };
}

/** Fresh navigation accepts only the exact current authored catalog entry.
 * The URL carries identities; response settings always come from admitted metadata. */
export async function resolveSimDemoLaunch(url, options = {}) {
  const params = new URL(url).searchParams;
  if (!params.has('demo-source')) return null;
  const sources = await createSimDemoAdapter(options).enumerateSources({ signal: options.signal });
  return (
    sources.find(
      (source) =>
        source.id === params.get('demo-source') &&
        source.levelId === params.get('demo-course') &&
        source.sourceIdentity === params.get('demo-course-identity') &&
        source.variantId === params.get('demo-flight-mode') &&
        source.responseIdentity === params.get('demo-response-identity'),
    ) ?? null
  );
}
import { getLocale } from '../i18n/index.mjs';
