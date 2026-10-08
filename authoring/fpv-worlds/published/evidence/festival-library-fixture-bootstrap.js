/* Manual pending-catalogue fixture only; production HTML/scripts are ZIP read-through. */
(() => {
  const config = __FIXTURE_CONFIG__;
  const fixture = (window.festivalFixture = {
    provenance: config.provenance,
    workers: [],
    errors: [],
  });
  window.addEventListener('error', (event) => fixture.errors.push(String(event.message)));
  window.addEventListener('unhandledrejection', (event) =>
    fixture.errors.push(String(event.reason)),
  );
  const NativeWorker = window.Worker;
  window.Worker = class extends NativeWorker {
    constructor(input, options) {
      const payload = new URL(input, location.href);
      if (
        payload.origin !== location.origin ||
        payload.pathname !== '/optional-practice/fpv-worlds/worker.js'
      ) {
        super(input, options);
        return;
      }
      super('/fixture-worker.js', options);
      const observation = { payload: payload.href, messages: [], events: [], errors: [] };
      fixture.workers.push(observation);
      this.addEventListener('error', (event) => observation.errors.push(String(event.message)));
      this.addEventListener('message', (event) => {
        if (event.data?.fixtureWorker) {
          event.stopImmediatePropagation();
          observation.events.push(event.data);
          return;
        }
        observation.messages.push({
          type: event.data?.type,
          byteLength: event.data?.bytes?.byteLength,
          error: event.data?.error,
        });
      });
      super.postMessage({
        type: 'festival-fixture-config',
        payload: payload.href,
        indexURL: config.indexURL,
        indexText: config.indexText,
      });
    }
  };
})();
