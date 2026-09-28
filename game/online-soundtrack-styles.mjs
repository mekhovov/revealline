import { localizedMessage } from './i18n/index.mjs';

export const ONLINE_SOUNDTRACK_STYLE_CHOICES = Object.freeze([
  ['fpv', localizedMessage('interface:fpvMusic')],
  ['ua', localizedMessage('interface:uaMusic')],
  ['synth', localizedMessage('interface:synthElectronic')],
  ['metal', localizedMessage('interface:metal')],
  ['ukrainian', localizedMessage('interface:ukrainian')],
  ['chiptune', localizedMessage('interface:chiptune8Bit')],
  ['rock', localizedMessage('interface:rock')],
  ['ambient', localizedMessage('interface:ambient')],
  ['fusion', localizedMessage('interface:fusion')],
  ['other', localizedMessage('interface:otherStyles')],
]);

export function onlineSoundtrackMatchesStyle(track, style) {
  const tags = (track?.tags ?? []).map((tag) => tag.toLowerCase()),
    has = (...values) => values.some((value) => tags.some((tag) => tag.includes(value)));
  if (style === 'fpv') return has('фпв', 'fpv');
  if (style === 'ua') return tags.some((tag) => tag === 'ua');
  if (style === 'ukrainian') return has('ukrain') || tags.some((tag) => tag === 'ua');
  if (style === 'metal') return has('metal');
  if (style === 'synth') return has('synth', 'electro', 'tracker', 'fm', 'dance', 'techno');
  if (style === 'chiptune') return has('chiptune', '8-bit', 'fakebit');
  if (style === 'rock') return has('rock', 'punk');
  if (style === 'ambient') return has('ambient', 'atmospher');
  if (style === 'fusion') {
    const families = [
      has('ukrain'),
      has('metal'),
      has('synth', 'electro', 'tracker', 'fm', 'dance', 'techno'),
      has('chiptune', '8-bit', 'fakebit'),
      has('rock', 'punk'),
      has('ambient', 'atmospher'),
    ];
    return has('fusion') || families.filter(Boolean).length > 1;
  }
  return !['ukrainian', 'metal', 'synth', 'chiptune', 'rock', 'ambient', 'fusion'].some((family) =>
    onlineSoundtrackMatchesStyle(track, family),
  );
}

export function onlineSoundtrackMatchesStyles(track, styles) {
  return [...styles].some((style) => onlineSoundtrackMatchesStyle(track, style));
}

export function soundtrackGenresForOnlineStyles(styles) {
  const selected = new Set(styles),
    genres = new Set();
  if (selected.has('synth')) {
    genres.add('synth90s');
    genres.add('electronic');
  }
  if (selected.has('metal')) genres.add('metal');
  if (selected.has('fpv') || selected.has('ua') || selected.has('ukrainian')) {
    genres.add('ukrainian');
  }
  if (selected.has('chiptune')) genres.add('chiptune');
  if (selected.has('rock')) genres.add('rock');
  if (selected.has('ambient')) genres.add('ambient');
  if (selected.has('other')) {
    genres.add('cinematic');
    genres.add('acoustic');
  }
  return Object.freeze([...genres]);
}
