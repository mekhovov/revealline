import {
  iconForSlot,
  FIELD_KIT_ICON_IDS,
  FIELD_KIT_ICON_SIZES,
  FIELD_KIT_ICON_DESCRIPTIONS,
} from '../../../presentation/icons.mjs';
const node = (tag, text, className) => {
  const el = document.createElement(tag);
  if (text) el.textContent = text;
  if (className) el.className = className;
  return el;
};
const sample = (id, light) => {
  const box = node('div', '', `sample${light ? ' light' : ''}`);
  const art = iconForSlot(id, {
    tokens: light
      ? {
          text: '#182531',
          ink: '#f3f0db',
          cyan: '#245966',
          amber: '#805411',
          muted: '#425563',
          hazard: '#983e45',
          success: '#47662f',
        }
      : {},
  });
  for (const scale of [1, 3]) {
    const canvas = document.createElement('canvas');
    canvas.width = art.width;
    canvas.height = art.height;
    canvas.style.width = `${art.width * scale}px`;
    canvas.style.height = `${art.height * scale}px`;
    canvas.getContext('2d').putImageData(new ImageData(art.rgba, art.width, art.height), 0, 0);
    canvas.setAttribute('role', 'img');
    canvas.setAttribute(
      'aria-label',
      `${id}, ${light ? 'light' : 'dark'} palette, ${scale === 1 ? 'native' : 'three times enlarged'}`,
    );
    box.append(canvas);
  }
  return box;
};
for (const id of FIELD_KIT_ICON_IDS) {
  const size = FIELD_KIT_ICON_SIZES[id],
    article = node('article');
  article.append(node('h2', id));
  const specimens = node('div', '', 'specimens');
  specimens.append(sample(id, false), sample(id, true));
  article.append(
    specimens,
    node('p', `${size} × ${size} native · binary alpha · integer clusters`, 'meta'),
    node('p', FIELD_KIT_ICON_DESCRIPTIONS[id]),
  );
  const details = node('details');
  details.append(node('summary', 'Requirements and AI variation brief'));
  const prompt = `Create one original Field Kit pixel icon for ${id}. Meaning: ${FIELD_KIT_ICON_DESCRIPTIONS[id]} Export exactly ${size} × ${size} pixels as RGBA PNG with transparent background and binary alpha. Draw deliberate integer-aligned square clusters, crisp stepped diagonals and no antialiasing, gradient, blur, shadow or baked text label. Use at most four opaque colors from deep ink #070B12, warm text #F3F0DB, cyan #78DCE8, amber #F4BF62, muted #A5B2BB, hazard #F07879, success #9DBB7A. Preserve clear negative space, at least one transparent pixel of edge clearance and this icon's semantic identity at native size on light and dark surfaces. Rank awards must retain one/two/three distinct cut marks so color is not the only difference. Keep focus frames, key labels, state text and gameplay behavior outside the asset. Save the original, effective prompt, dimensions and provenance. This prompt is a specification, not evidence of review.`;
  const textarea = node('textarea');
  textarea.value = prompt;
  textarea.readOnly = true;
  textarea.setAttribute('aria-label', `AI variation prompt for ${id}`);
  const copy = node('button', 'Copy prompt');
  copy.type = 'button';
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      document.querySelector('#status').textContent = `Copied ${id} prompt.`;
    } catch {
      textarea.focus();
      textarea.select();
      document.querySelector('#status').textContent =
        `Clipboard unavailable. The ${id} prompt is selected for manual copying.`;
    }
  });
  details.append(textarea, copy);
  article.append(details);
  document.querySelector('#inventory').append(article);
}
document.querySelector('#status').textContent =
  `${FIELD_KIT_ICON_IDS.length} produced recipe candidates. This page does not mark them reviewed or change a saved theme.`;
