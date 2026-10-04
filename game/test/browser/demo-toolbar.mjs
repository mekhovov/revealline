import { setLocale, translateDOM, t } from '../../i18n/index.mjs';
import {
  applyResolvedPresentation,
  resolvePresentation,
} from '../../presentation/theme-system.mjs';
import { REACTION_PORTRAITS } from '../../journey/reaction-portraits.mjs';
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
const themeSheet = document.createElement('link');
themeSheet.rel = 'stylesheet';
themeSheet.href = new URL('../../presentation/industrial-workshop.css', location.href);
document.head.append(themeSheet);
applyResolvedPresentation(
  document.documentElement,
  resolvePresentation({
    familyId: new URLSearchParams(location.search).get('theme') || 'industrial-workshop',
    accessibility: { textSize: new URLSearchParams(location.search).get('textSize') || 'standard' },
  }),
);
const dialog = document.importNode(source.getElementById('demo-dialog'), true);
document.body.append(dialog);
const $ = (id) => document.getElementById(id);
setLocale(new URLSearchParams(location.search).get('lang') || 'en', { persist: false });
translateDOM(dialog);
$('demo-level').textContent = 'Stepping stones';
$('demo-source').textContent = 'Layout specimen';
$('demo-fullscreen').hidden = false;
$('demo-practice-controls').hidden = true;
$('demo-caption').textContent = t('demo:tipClose');
$('demo-status').textContent = t('demo:readout', { percent: 32, lives: 3, seconds: 24 });
$('demo-guide-portrait').src = REACTION_PORTRAITS.guide.react;
$('demo-guide-portrait').hidden = false;
$('demo-music-state').textContent = t('common:status.paused');
$('demo-now-playing').textContent = 'Carol of the Bells (Metal Version) · Alexander Nakarada';
for (const button of dialog.querySelectorAll('button[data-icon]')) {
  button.setAttribute('aria-label', button.textContent.trim());
  button.title = button.textContent.trim();
}
$('demo-details-toggle').onclick = () => {
  $('demo-panel').hidden = !$('demo-panel').hidden;
  $('demo-details-toggle').setAttribute('aria-expanded', String(!$('demo-panel').hidden));
  dialog.dataset.details = $('demo-panel').hidden ? 'closed' : 'open';
  if (!$('demo-panel').hidden) $('demo-details-close').focus();
};
$('demo-details-close').onclick = () => {
  $('demo-panel').hidden = true;
  dialog.dataset.details = 'closed';
  $('demo-details-toggle').focus();
};
$('demo-interrupt').onclick = () => {
  $('demo-panel').hidden = false;
  dialog.dataset.details = 'open';
  $('demo-actions').hidden = false;
};
$('demo-resume').onclick = () => {
  $('demo-panel').hidden = true;
  dialog.dataset.details = 'closed';
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
