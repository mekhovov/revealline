import { required } from '../data-json.mjs';

const aborted = (error) => error?.name === 'AbortError';

/**
 * Opens an optional victory story from the exact receipt returned by the
 * installed Custom runtime. Story preparation deliberately has no progress or
 * navigation callback, so it cannot award again or take ownership of Next.
 */
export function createCreatorPlayerVictoryStory({ runtime, host, nodes } = {}) {
  required(
    runtime?.prepareVictoryStory && host?.show && host?.close,
    'Creator story playback needs its installed runtime and presentation host.',
  );
  required(
    nodes?.surface && nodes?.stage && nodes?.status && nodes?.retry,
    'Creator story playback needs its earned-picture controls.',
  );
  let generation = 0,
    controller = null,
    current = null,
    disposed = false;

  const hideRetry = () => {
    nodes.retry.hidden = true;
    nodes.retry.disabled = false;
  };

  function cancel() {
    generation++;
    controller?.abort();
    controller = null;
  }

  function reset() {
    cancel();
    current = null;
    hideRetry();
    host.close();
  }

  async function show(request) {
    required(!disposed, 'Creator story playback is closed.');
    required(
      request?.receipt && request?.posterElement && request?.posterAsset,
      'Creator story playback needs the earned completion and exact poster.',
    );
    cancel();
    const token = generation,
      active = new AbortController();
    controller = active;
    current = request;
    hideRetry();
    nodes.status.classList.remove('error');
    nodes.status.textContent = 'Checking this mission’s optional victory story…';
    try {
      const result = await runtime.prepareVictoryStory(request.receipt, {
        signal: active.signal,
      });
      if (disposed || token !== generation || active.signal.aborted) return null;
      controller = null;
      if (!result) {
        nodes.status.textContent = '';
        return null;
      }
      required(
        result.poster.id === request.posterAsset.id &&
          result.poster.sha256 === request.posterAsset.sha256,
        'Victory story differs from the exact earned poster.',
      );
      return host.show({
        posterElement: request.posterElement,
        picturePin: result.picturePin,
        prepared: result.prepared,
      });
    } catch (error) {
      if (disposed || token !== generation || active.signal.aborted || aborted(error)) return null;
      controller = null;
      request.posterElement.hidden = false;
      nodes.surface.hidden = false;
      nodes.retry.hidden = false;
      nodes.status.classList.add('error');
      nodes.status.textContent = `Victory video is unavailable. Your earned picture and Next remain available. ${
        error instanceof Error ? error.message : String(error)
      }`;
      return null;
    }
  }

  nodes.retry.addEventListener('click', () => {
    if (!current || disposed) return;
    nodes.retry.disabled = true;
    void show(current);
  });

  return Object.freeze({
    show,
    reset,
    snapshot: () =>
      Object.freeze({
        preparing: !!controller,
        retryAvailable: !nodes.retry.hidden,
      }),
    dispose() {
      if (disposed) return;
      reset();
      disposed = true;
    },
  });
}
