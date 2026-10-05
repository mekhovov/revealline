/** Isolated layout specimen: production markup/styles, no game or access-gate bypass. */
const { document, DOMParser, location } = globalThis;
const source = new DOMParser().parseFromString(
  await (await fetch('../../index.html')).text(),
  'text/html',
);
for (const link of source.querySelectorAll('link[rel="stylesheet"]')) {
  const href = link.dataset.bootHref || link.getAttribute('href');
  const sheet = document.createElement('link');
  sheet.rel = 'stylesheet';
  sheet.href = new URL(href, new URL('../../', location.href));
  document.head.append(sheet);
}
const dialog = document.importNode(source.getElementById('demo-dialog'), true);
document.body.append(dialog);
const $ = (id) => document.getElementById(id);
$('demo-level').textContent = 'Stepping stones';
$('demo-source').textContent = 'Layout specimen';
$('demo-fullscreen').hidden = false;
$('demo-practice-controls').hidden = true;
$('demo-caption').textContent = 'Layout specimen only. No gameplay or protected picture is loaded.';
$('demo-now-playing').textContent = 'Song title · Artist';
for (const button of dialog.querySelectorAll('button[data-icon]')) {
  button.setAttribute('aria-label', button.textContent.trim());
  button.title = button.textContent.trim();
}
$('demo-details-toggle').onclick = () => {
  $('demo-panel').hidden = !$('demo-panel').hidden;
  $('demo-details-toggle').setAttribute('aria-expanded', String(!$('demo-panel').hidden));
};
$('demo-interrupt').onclick = () => {
  $('demo-panel').hidden = false;
  $('demo-actions').hidden = false;
};
$('demo-resume').onclick = () => {
  $('demo-panel').hidden = true;
};
const canvas = $('demo-canvas'),
  ctx = canvas.getContext('2d');
ctx.fillStyle = '#0b141e';
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.strokeStyle = '#28525d';
for (let x = 0; x < canvas.width; x += 48) {
  for (let y = 0; y < canvas.height; y += 48) ctx.strokeRect(x, y, 48, 48);
}
ctx.fillStyle = '#a1d0dd';
ctx.font = '16px sans-serif';
ctx.fillText('Layout preview — no game running', 24, canvas.height / 2);
dialog.showModal();
