/** Opt-in observer instrumentation. Forward native calls and replies unchanged;
 * record only the offline-status protocol, never forms or arbitrary messages. */
export function installOptionalStatusDiagnostics() {
  let remaining = 512;
  const documentId = globalThis.crypto?.randomUUID?.() ?? String(globalThis.performance.timeOrigin);
  const report = (event) => {
    if (remaining-- < 0) return;
    if (remaining === -1) event = { type: 'diagnostic-events-dropped' };
    try {
      void globalThis
        .__optionalStatusDiagnostic?.({
          at: globalThis.performance.now(),
          documentId,
          ...event,
        })
        ?.catch(() => {});
    } catch {
      // Diagnostics must not change the operation being observed.
    }
  };
  const identify = (worker) =>
    worker ? { scriptURL: worker.scriptURL, state: worker.state } : null;
  const NativeChannel = globalThis.MessageChannel;
  const channelIds = new WeakMap();
  let nextId = 0;
  const ObservedChannel = new Proxy(NativeChannel, {
    construct(target, args, newTarget) {
      const channel = Reflect.construct(target, args, newTarget);
      const channelId = ++nextId;
      channelIds.set(channel.port2, channelId);
      // Do not call start(): the caller still owns channel activation/lifetime.
      channel.port1.addEventListener('message', ({ data }) => {
        if (data?.type !== 'practice-status') return;
        report({
          type: 'status-reply',
          channelId,
          scope: typeof data.scope === 'string' ? data.scope.slice(0, 2048) : null,
          ready: typeof data.ready === 'boolean' ? data.ready : null,
          status: ['ready', 'unknown', 'unavailable'].includes(data.status) ? data.status : null,
        });
      });
      channel.port1.addEventListener('messageerror', () =>
        report({ type: 'status-messageerror', channelId }),
      );
      return channel;
    },
  });
  globalThis.MessageChannel = ObservedChannel;

  const prototype = globalThis.ServiceWorker?.prototype;
  if (prototype) {
    const original = prototype.postMessage;
    prototype.postMessage = function (...args) {
      const status = args[0]?.type === 'practice-status';
      const channelId = status ? (channelIds.get(args[1]?.[0]) ?? null) : null;
      if (status) report({ type: 'status-request', channelId, worker: identify(this) });
      try {
        return original.apply(this, args);
      } catch (error) {
        if (status)
          report({
            type: 'status-post-error',
            channelId,
            errorName: String(error.name).slice(0, 80),
          });
        throw error;
      }
    };
  }
  const container = globalThis.ServiceWorkerContainer?.prototype;
  if (container) {
    const original = container.getRegistration;
    container.getRegistration = function (...args) {
      const requested = typeof args[0] === 'string' ? args[0].slice(0, 2048) : null;
      report({ type: 'registration-request', requested });
      const promise = original.apply(this, args);
      void promise
        .then(
          (registration) => {
            report({
              type: 'registration-result',
              requested,
              scope: registration?.scope ?? null,
              active: identify(registration?.active),
              waiting: identify(registration?.waiting),
              installing: identify(registration?.installing),
            });
          },
          (error) => {
            report({
              type: 'registration-error',
              requested,
              errorName: String(error.name).slice(0, 80),
            });
          },
        )
        .catch(() => {});
      return promise;
    };
  }
  for (const type of ['pagehide', 'pageshow'])
    globalThis.addEventListener(type, ({ persisted }) => report({ type, persisted }), {
      passive: true,
    });
}
