const channel = 'revealline-gameplay-audio-observation.v1';
const frame = document.getElementById('game'),
  target = document.getElementById('target');
const status = document.getElementById('status'),
  output = document.getElementById('result');
const download = document.getElementById('download');
let reportURL = null;
function candidateURL(value) {
  const url = new URL(value, location.href);
  if (
    url.origin !== location.origin ||
    !/\/game\/couch\/(?:index|relay-rescue)\.html$/.test(url.pathname) ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new Error('Choose a same-origin Team or Duel candidate page.');
  return url;
}
function openCandidate(value) {
  const url = candidateURL(value);
  if (reportURL) URL.revokeObjectURL(reportURL);
  reportURL = null;
  download.hidden = true;
  output.textContent = '';
  status.textContent =
    'Waiting for the candidate’s own observer. Use ordinary game controls in the frame.';
  frame.src = url.href;
}
document.getElementById('open').addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    openCandidate(target.value);
  } catch (error) {
    status.textContent = error.message;
  }
});
for (const action of ['snapshot', 'stop'])
  document
    .getElementById(action === 'snapshot' ? 'refresh' : action)
    .addEventListener('click', () => {
      frame.contentWindow?.postMessage({ channel, action }, location.origin);
    });
window.addEventListener('message', (event) => {
  if (
    event.source !== frame.contentWindow ||
    event.origin !== location.origin ||
    event.data?.channel !== channel
  )
    return;
  const report = event.data.report;
  if (report?.format !== channel) return;
  const json = JSON.stringify(report, null, 2);
  if (json.length > 2 * 1024 * 1024) {
    status.textContent = 'Observation exceeds the display bound.';
    return;
  }
  output.textContent = json;
  status.textContent = `${report.lifecycle}: ${report.events.length} retained deliveries/lifecycle notices; ${report.starts.length} native buffer starts; ${report.decodes.length} decoded original identities. Inspect named cue, board and buffer identity before drawing conclusions.`;
  if (reportURL) URL.revokeObjectURL(reportURL);
  reportURL = URL.createObjectURL(new Blob([json + '\n'], { type: 'application/json' }));
  download.href = reportURL;
  download.download = 'native-gameplay-audio-observation.json';
  download.hidden = false;
});
window.addEventListener('pagehide', () => {
  if (reportURL) URL.revokeObjectURL(reportURL);
});
const initial = new URL(location.href).searchParams.get('target');
target.value =
  initial ??
  new URL(
    location.pathname.includes('/game/review-audio/')
      ? '../couch/relay-rescue.html?journey=team-originals'
      : '../../../game/couch/relay-rescue.html?journey=team-originals',
    import.meta.url,
  ).href;
if (initial) {
  try {
    openCandidate(initial);
  } catch (error) {
    status.textContent = error.message;
  }
}
