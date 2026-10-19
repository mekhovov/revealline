import { localizedOverflight, overflightText } from './copy.mjs';
import { overflightUpgradeConsequences } from './upgrade-consequences.mjs';
import {
  createOverflightUpgradePreviewSprites,
  overflightUpgradePreview,
} from './upgrade-preview.mjs';

/** The native draft and its review sheet share the same card, not a second mock-up. */
export function createOverflightUpgradeCard({
  document,
  offer,
  build,
  compiled,
  player,
  rulesVersion = 2,
  riySettings,
  locale = 'en',
  reducedEffects = false,
  disabled = false,
  moduleIcon,
  paintSprite,
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
  button.dataset.evolution = String(offer.kind === 'evolution');
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
  preview.innerHTML = overflightUpgradePreview(offer, {
    locale,
    build,
    player,
    reducedEffects,
    rulesVersion,
    riySettings,
    sprites: createOverflightUpgradePreviewSprites(document, paintSprite, reducedEffects),
  });
  const next = local(offer.next ?? offer.description);
  const facts = overflightUpgradeConsequences(offer, { build, compiled }),
    consequences = [];
  if (facts?.payloadPath) consequences.push(text('commitmentPayload'));
  if (facts?.combatSlots) {
    const { used, capacity } = facts.combatSlots;
    consequences.push(
      text(used === capacity ? 'commitmentCombatFinal' : 'commitmentCombat')
        .replace('{used}', String(used))
        .replace('{capacity}', String(capacity)),
    );
  }
  if (facts?.supportFamily) consequences.push(text('commitmentSupport'));
  if (facts?.maximumRank) consequences.push(text('commitmentMaximum'));
  const consequence = consequences.join(' ');
  button.append(heading, preview, node('span', next, 'upgrade-description'));
  if (consequence)
    button.append(node('span', consequence, 'upgrade-description upgrade-consequence'));
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
      consequence,
    ]
      .filter(Boolean)
      .join('. '),
  );
  button.addEventListener('click', () => onChoose(offer.id));
  return button;
}
