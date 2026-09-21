const cancelled = () => new DOMException('Craft preparation cancelled.', 'AbortError');
const check = (signal) => {
  if (signal?.aborted) throw cancelled();
};

// Only the attempt owner adopts these decoded pixels. Preparation never changes
// the painter, simulation or a retained picture. Existing decoded images are
// borrowed; this helper creates no object URLs or bitmap handles.
export async function prepareLookImages(
  jobs,
  { signal, onStatus = () => {}, timeoutMs = 15000 } = {},
) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 20000)
    throw new Error('Invalid craft preparation deadline.');
  check(signal);
  const controller = new AbortController(),
    owned = new Set(),
    images = {},
    abort = () => controller.abort();
  let adopted = false,
    disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    controller.abort();
    if (!adopted)
      for (const image of owned) {
        image.onload = image.onerror = null;
        image.removeAttribute?.('src');
      }
    owned.clear();
  };
  const report = (status, message) => {
    check(controller.signal);
    try {
      onStatus({
        status,
        stage: status === 'preparing' ? 'decoding' : status,
        message,
        progress: null,
      });
    } catch {}
    check(controller.signal);
  };
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(
    () => controller.abort(new Error('Craft artwork did not become ready in time.')),
    timeoutMs,
  );
  try {
    if (jobs.some((job) => !job.image))
      report('preparing', 'Preparing the selected craft and scene artwork…');
    await Promise.all(
      jobs.map(async ({ role, src, image: ready }) => {
        check(controller.signal);
        if (ready) {
          images[role] = ready;
          return;
        }
        const image = new Image();
        owned.add(image);
        await new Promise((resolve, reject) => {
          let settled = false;
          const finish = (error) => {
            if (settled) return;
            settled = true;
            controller.signal.removeEventListener('abort', stop);
            image.onload = image.onerror = null;
            error ? reject(error) : resolve();
          };
          const stop = () => finish(controller.signal.reason || cancelled());
          controller.signal.addEventListener('abort', stop, { once: true });
          image.onerror = () =>
            finish(new Error('Selected craft or scene artwork could not be loaded.'));
          image.onload = async () => {
            try {
              await image.decode?.();
              check(controller.signal);
              if (!(image.naturalWidth > 0 && image.naturalHeight > 0))
                throw new Error('Selected artwork has no drawable pixels.');
              finish();
            } catch (error) {
              finish(error);
            }
          };
          if (controller.signal.aborted) return stop();
          try {
            image.src = src;
          } catch (error) {
            finish(error);
          }
        });
        check(controller.signal);
        images[role] = image;
      }),
    );
    report('ready', 'Selected craft and scene artwork are ready.');
    return Object.freeze({
      images,
      current: () => !disposed && !signal?.aborted,
      adopt() {
        if (disposed || signal?.aborted) throw cancelled();
        adopted = true;
      },
      dispose,
    });
  } catch (error) {
    dispose();
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
