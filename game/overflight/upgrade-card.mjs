import { localizedOverflight, overflightText } from './copy.mjs';
import { overflightUpgradePreview } from './upgrade-preview.mjs';

/** The native draft and its review sheet share the same card, not a second mock-up. */
export function createOverflightUpgradeCard({
  document,
  offer,
  build,
  player,
  locale = 'en',
  reducedEffects = false,
  disabled = false,
  moduleIcon,
  onChoose = () => {},
}) {
  const text = (key) => overflightText(locale, key);
  const local = (value) => localizedOverflight(value, locale);
  const node = (tag, content, className) => {
    const element = document.createElement(tag);
    if (content) element.textContent = content;
    if (className) element.className = className;
    return element;
  };
  const button = node('button', '', 'overflight-upgrade-card');
  button.type = 'button';
  button.disabled = disabled;
  button.dataset.upgradeId = offer.id;
  const kind = text(
    offer.kind === 'support'
      ? 'supportModule'
      : offer.kind === 'utility'
        ? 'oneTimeUpgrade'
        : offer.kind === 'evolution'
          ? 'evolution'
          : 'combatModule',
  );
  const rank =
    offer.kind === 'utility' ? '' : `${text('level')} ${offer.currentRank ?? 0} → ${offer.rank}`;
  const heading = node('span', '', 'upgrade-heading');
  if (moduleIcon) heading.append(moduleIcon(offer.system));
  const names = node('span', '', 'upgrade-names');
  names.append(
    node('span', `${kind}${rank ? ` · ${rank}` : ''}`, 'upgrade-kind'),
    node('strong', local(offer.title), 'upgrade-title'),
  );
  heading.append(names);
  const preview = node('span', '', 'upgrade-preview');
  preview.innerHTML = overflightUpgradePreview(offer, { locale, build, player, reducedEffects });
  const next = local(offer.next ?? offer.description);
  button.append(heading, preview, node('span', next, 'upgrade-description'));
  if (offer.evolution) {
    const progress = node('span', '', 'upgrade-evolution');
    const marks = node('span', '', 'upgrade-ranks');
    marks.setAttribute('aria-hidden', 'true');
    for (let index = 1; index <= offer.evolutionRank; index++) {
      const mark = node('span', '', 'upgrade-rank');
      mark.dataset.filled = String(index <= offer.currentRank);
      mark.dataset.next = String(index === offer.rank);
      marks.append(mark);
    }
    progress.append(
      marks,
      node('span', `${local(offer.evolution)} · ${offer.rank}/${offer.evolutionRank}`),
    );
    button.append(progress);
  }
  // Preserve a complete verbal comparison while keeping the visible card concise.
  button.setAttribute(
    'aria-label',
    [
      local(offer.title),
      kind,
      rank,
      `${text('current')}: ${local(offer.current)}`,
      `${text('next')}: ${next}`,
      preview.querySelector('svg')?.getAttribute('aria-label'),
    ]
      .filter(Boolean)
      .join('. '),
  );
  button.addEventListener('click', () => onChoose(offer.id));
  return button;
}
