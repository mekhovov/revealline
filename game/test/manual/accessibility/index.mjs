const { document: doc, navigator, location, FormData } = globalThis;
const form = doc.getElementById('configuration'),
  pane = doc.getElementById('pane');
let registration;
try {
  registration = await navigator.serviceWorker.register('./font-delay-worker.mjs', {
    type: 'module',
  });
  const worker = registration.installing || registration.waiting || registration.active;
  if (worker.state !== 'activated')
    await new Promise((resolve, reject) => {
      const changed = () => {
        if (worker.state === 'activated') {
          worker.removeEventListener('statechange', changed);
          resolve();
        } else if (worker.state === 'redundant') {
          worker.removeEventListener('statechange', changed);
          reject(new Error('The fixture worker could not activate.'));
        }
      };
      worker.addEventListener('statechange', changed);
      changed();
    });
  doc.getElementById('status').textContent =
    'Ready. The worker controls only this test fixture directory.';
} catch (error) {
  doc.getElementById('status').textContent = `Font response tests unavailable: ${error.message}`;
}
const reports = [];
for (const [name, value] of new URL(location.href).searchParams) {
  const control = form.elements.namedItem(name);
  if (control && [...control.options].some((option) => option.value === value))
    control.value = value;
}
function load(event) {
  event?.preventDefault();
  reports.length = 0;
  const target = new URL('./pane.html', location.href);
  target.search = new URLSearchParams(new FormData(form)).toString();
  // A unique document gives each delayed-font run a separate client lifetime.
  target.searchParams.set('run', String(Date.now()));
  pane.src = target.href;
  doc.getElementById('full-page').href = target.href;
}
globalThis.addEventListener('message', (event) => {
  if (event.source !== pane.contentWindow || event.origin !== location.origin) return;
  if (event.data?.type !== 'menu-accessibility-report') return;
  reports.push(event.data.report);
  if (reports.length > 12) reports.shift();
  doc.getElementById('report').textContent = JSON.stringify(reports, null, 2);
});
form.addEventListener('submit', load);
doc.getElementById('measure').onclick = () =>
  pane.contentWindow.postMessage({ type: 'measure-accessibility' }, location.origin);
doc.getElementById('cleanup').onclick = async () => {
  await registration?.unregister();
  doc.getElementById('status').textContent =
    'Fixture worker unregistered. Close the fixture tabs to release their current worker.';
};
load();
