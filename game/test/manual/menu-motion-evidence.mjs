/* global document, window, innerWidth, innerHeight, devicePixelRatio, getComputedStyle, Option, requestAnimationFrame */
import { attachMenuScene, getMenuAnimation, setMenuAnimation } from '../../ui/menu-scenes.mjs';
import { MENU_SCENES } from '../../ui/menu-scene-catalog.mjs';

const root = document.querySelector('#scene');
const context = { themeId: 'fpv', mode: 'solo', active: true, reduced: false };
const originalPreference = getMenuAnimation();
const owner = attachMenuScene({ root, getContext: () => context });
const evidence = {
  kind: 'actual-css-scene-sampling',
  started: new Date().toISOString(),
  samples: [],
  events: [],
};
const report = document.querySelector('#report');
const status = document.querySelector('#status');
const render = () => {
  report.textContent = JSON.stringify(evidence, null, 2);
  document.querySelector('#facts').textContent = JSON.stringify({
    samples: evidence.samples.map((row) => ({
      timing: row.frameTiming,
      states: row.snapshots.map((s) => ({
        focused: s.focused,
        hidden: s.hidden,
        running: s.state.running,
        plane: s.layers[0].transform,
        animations: s.layers[0].animations,
      })),
    })),
    visibility: evidence.events
      .filter((row) => row.type === 'visibilitychange')
      .map((s) => ({
        hidden: s.hidden,
        running: s.state.running,
        plane: s.layers[0].transform,
        animations: s.layers[0].animations,
      })),
  });
};
const round = (n) => Math.round(n * 1000) / 1000;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function snapshot() {
  const scene = root.querySelector('.menu-scene');
  const nodes = [...scene.querySelectorAll('*')];
  return {
    at: round(performance.now()),
    focused: document.hasFocus(),
    hidden: document.hidden,
    viewport: [innerWidth, innerHeight, devicePixelRatio],
    context: { ...context },
    state: { ...scene.dataset },
    layers: nodes.map((node, index) => {
      const style = getComputedStyle(node),
        rect = node.getBoundingClientRect();
      return {
        index,
        class: node.className,
        transform: style.transform,
        opacity: style.opacity,
        display: style.display,
        rect: [rect.x, rect.y, rect.width, rect.height].map(round),
        animations: node.getAnimations().map((a) => ({
          name: a.animationName,
          time: round(a.currentTime ?? 0),
          state: a.playState,
        })),
      };
    }),
  };
}

for (const type of ['focus', 'blur', 'visibilitychange']) {
  (type === 'visibilitychange' ? document : window).addEventListener(type, () => {
    evidence.events.push({ type, ...snapshot() });
    render();
  });
}
const theme = document.querySelector('#theme');
for (const id of Object.keys(MENU_SCENES)) theme.add(new Option(id, id));
theme.onchange = () => {
  context.themeId = theme.value;
  owner.update();
};
document.querySelector('#mode').onchange = (event) => {
  context.mode = event.target.value;
  owner.update();
};
document.querySelector('#reduced').onchange = (event) => {
  context.reduced = event.target.checked;
  owner.update();
};
document.querySelector('#enabled').checked = originalPreference;
document.querySelector('#enabled').onchange = (event) => setMenuAnimation(event.target.checked);
document.querySelector('#pause').onclick = (event) => {
  context.active = !context.active;
  owner.update();
  event.target.textContent = context.active ? 'Pause host' : 'Resume host';
};

document.querySelector('#sample').onclick = async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  status.textContent =
    'Sampling for six seconds; focus may move to the address bar or another tab.';
  await root.querySelector('img').decode();
  const row = {
    started: new Date().toISOString(),
    snapshots: [snapshot()],
    frameIntervals: [],
    longTasks: [],
  };
  const observer = PerformanceObserver.supportedEntryTypes.includes('longtask')
    ? new PerformanceObserver((list) =>
        row.longTasks.push(...list.getEntries().map((entry) => round(entry.duration))),
      )
    : null;
  observer?.observe({ type: 'longtask', buffered: false });
  let previous,
    stopped = false;
  const frame = (time) => {
    if (stopped) return;
    if (previous !== undefined) row.frameIntervals.push(time - previous);
    previous = time;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  for (let i = 0; i < 6; i++) {
    await delay(1000);
    row.snapshots.push(snapshot());
  }
  stopped = true;
  observer?.disconnect();
  const frames = row.frameIntervals.sort((a, b) => a - b);
  row.frameTiming = {
    frames: frames.length,
    p50: round(frames[Math.floor(frames.length * 0.5)] ?? 0),
    p95: round(frames[Math.floor(frames.length * 0.95)] ?? 0),
    max: round(frames.at(-1) ?? 0),
    over34ms: frames.filter((n) => n > 34).length,
  };
  delete row.frameIntervals;
  evidence.samples.push(row);
  render();
  status.textContent = 'Complete';
  button.disabled = false;
};
document.querySelector('#all-scenes').onclick = async (event) => {
  const button = event.currentTarget,
    previous = context.themeId;
  button.disabled = true;
  const rows = [];
  for (const id of Object.keys(MENU_SCENES)) {
    context.themeId = id;
    theme.value = id;
    owner.update();
    await root.querySelector('img').decode();
    status.textContent = `Sampling ${id}`;
    const before = snapshot();
    await delay(2000);
    const after = snapshot();
    rows.push({ theme: id, before, after });
  }
  evidence.allScenes = rows;
  context.themeId = previous;
  theme.value = previous;
  owner.update();
  render();
  status.textContent = 'Eighteen scene samples complete';
  button.disabled = false;
};
document.querySelector('#download').onclick = () => {
  const link = document.createElement('a');
  link.download = 'menu-motion-browser-evidence.json';
  link.href = URL.createObjectURL(
    new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' }),
  );
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
};
window.addEventListener(
  'pagehide',
  () => {
    owner.dispose();
    setMenuAnimation(originalPreference);
  },
  { once: true },
);
