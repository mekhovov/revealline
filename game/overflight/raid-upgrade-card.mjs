import { localizedOverflight } from './copy.mjs';
import { overflightHuntText } from './raid-copy.mjs';
import { overflightHuntUpgradeParameters, HUNT_UPGRADE_IDS } from './raid-upgrades.mjs';

const palette = {
  ground: '#12241f',
  grid: '#253a30',
  light: '#f1eedb',
  open: '#9aebda',
  gold: '#f4c765',
  danger: '#f9a275',
};
const valueKey = {
  'strike-width': 'strikeWidth',
  'slow-wake': 'wakeDuration',
  'rush-charge': 'rushBonus',
  'boost-cooldown': 'boostCooldown',
  'boost-duration': 'boostDuration',
  'chain-window': 'chainWindow',
  'heavy-exposure': 'heavyExposureBonus',
  'guard-interrupt': 'interruptRadius',
  'recovery-shield': 'shieldCapacity',
  plating: 'armorReduction',
};
export function overflightHuntPreviewModel(
  offer,
  { player, rulesVersion = offer.rulesVersion ?? 1 } = {},
) {
  if (offer.kind === 'field') return { field: offer.system, amount: offer.amount };
  if (offer.kind === 'refit') {
    const model = {
      system: offer.system,
      beforeSystem: offer.fromSystem,
      before: overflightHuntUpgradeParameters(offer.fromSystem, offer.fromRank),
      after: overflightHuntUpgradeParameters(offer.system, offer.rank),
      baseExposure: offer.baseExposure,
    };
    if ([offer.fromSystem, offer.system].includes('recovery-shield')) {
      const capacity = (rank) =>
          overflightHuntUpgradeParameters('recovery-shield', rank).shieldCapacity,
        beforeCapacity = capacity(
          offer.fromSystem === 'recovery-shield' ? offer.fromRank : offer.currentRank,
        ),
        afterCapacity = capacity(
          offer.system === 'recovery-shield' ? offer.rank : offer.fromNextRank,
        ),
        available = Number.isInteger(player?.shield) ? player.shield : null;
      // Native refits keep existing charges, clamped to the new capacity. They
      // do not perform the refill granted by an ordinary combat shield pick.
      model.shieldRefit = {
        before: { capacity: beforeCapacity, available },
        after: {
          capacity: afterCapacity,
          available: available === null ? null : Math.min(available, afterCapacity),
        },
        restoresOne: rulesVersion >= 3,
      };
    }
    return model;
  }
  if (
    !HUNT_UPGRADE_IDS.includes(offer.system) ||
    ![1, 2].includes(offer.rank) ||
    (offer.currentRank ?? offer.rank - 1) !== offer.rank - 1
  )
    throw new RangeError('Raid preview needs a legal next upgrade rank.');
  return {
    system: offer.system,
    baseExposure: offer.baseExposure,
    before: overflightHuntUpgradeParameters(offer.system, offer.rank - 1),
    after: overflightHuntUpgradeParameters(offer.system, offer.rank),
  };
}
export function overflightHuntPreviewCaption(system, parameters, locale = 'en', baseExposure = 3) {
  const uk = locale === 'uk',
    value = parameters[valueKey[system]];
  if (system === 'strike-width')
    return `${Math.round(value * 100)}% · ${uk ? 'ширина удару' : 'strike width'}`;
  if (system === 'rush-charge') return `+${value} · ${uk ? 'за 3 цілі' : 'per 3-target pass'}`;
  if (system === 'heavy-exposure')
    return `${baseExposure + value}s · ${uk ? 'відкрита броня' : 'armor opening'}`;
  if (system === 'guard-interrupt')
    return value
      ? `${value} · ${uk ? 'радіус зриву' : 'interrupt reach'}`
      : uk
        ? 'Без зриву атаки'
        : 'No interruption';
  if (system === 'plating')
    return `${Math.round(value * 100)}% · ${uk ? 'менше шкоди' : 'less hull damage'}`;
  if (system === 'recovery-shield')
    return `${value} · ${uk ? 'захищених ударів' : 'hits absorbed'}`;
  const labels = {
    'slow-wake': uk ? 'слід' : 'slow wake',
    'boost-cooldown': uk ? 'відновлення' : 'recovery',
    'boost-duration': uk ? 'прискорення' : 'boost',
    'chain-window': uk ? 'серія' : 'chain window',
  };
  return `${value}s · ${labels[system]}`;
}

function previewCaption(model, index, locale) {
  const system = index === 0 && model.beforeSystem ? model.beforeSystem : model.system,
    parameters = index ? model.after : model.before,
    shield = model.shieldRefit?.[index ? 'after' : 'before'];
  if (system === 'recovery-shield' && shield)
    return shield.available === null
      ? `${shield.capacity} · ${locale === 'uk' ? 'місткість' : 'capacity'}`
      : `${shield.available}/${shield.capacity} · ${locale === 'uk' ? 'готові' : 'ready'}`;
  return overflightHuntPreviewCaption(system, parameters, locale, model.baseExposure ?? 3);
}

function shieldRefitConsequence(shield, locale) {
  if (!shield) return '';
  const uk = locale === 'uk',
    { before, after } = shield,
    comparison =
      before.available === null
        ? `${uk ? 'Місткість екрана' : 'Shield capacity'}: ${before.capacity} → ${after.capacity}.`
        : `${uk ? 'Готові заряди екрана' : 'Shield charges ready'}: ${before.available}/${before.capacity} → ${after.available}/${after.capacity}.`,
    refill = uk ? 'Перебудова не відновлює заряди.' : 'Refitting does not recharge the shield.',
    objective =
      after.capacity === 0
        ? ''
        : shield.restoresOne
          ? uk
            ? 'Завершення цілі відновлює один заряд у межах місткості.'
            : 'Each objective restores one charge, up to capacity.'
          : uk
            ? 'Завершення цілі повністю відновлює екран.'
            : 'Each objective refills the shield.';
  return [comparison, refill, objective].filter(Boolean).join(' ');
}

/** Native sprite demonstrations, not another combat simulation. Values are the
 * same parameter projection used by Raid. The app drives repaint only while
 * the upgrade modal is visible, so removal needs no animation cleanup. */
export function paintOverflightHuntPreview(
  context,
  model,
  { time = 0, locale = 'en', reducedEffects = false, paintSprite = () => {} } = {},
) {
  const still = reducedEffects,
    cycle = still ? 0.58 : (time % 3) / 3;
  context.clearRect(0, 0, 320, 154);
  if (model.field) {
    context.fillStyle = palette.ground;
    context.fillRect(0, 0, 320, 154);
    paintSprite(context, 'drone', 160, 64, 56, still ? 0 : time);
    context.fillStyle = palette.open;
    context.font = 'bold 20px system-ui';
    context.textAlign = 'center';
    const uk = locale === 'uk';
    const label =
      model.field === 'field-repair'
        ? uk
          ? 'міцності'
          : 'hull'
        : model.field === 'field-reroll'
          ? uk
            ? 'перевибір'
            : 'reroll'
          : uk
            ? 'очок'
            : 'score';
    context.globalAlpha = still ? 1 : 0.65 + Math.sin(cycle * Math.PI) * 0.35;
    context.fillText(`+${model.amount} ${label}`, 160, 127);
    context.globalAlpha = 1;
    return;
  }
  for (const [index, params] of [model.before, model.after].entries()) {
    const offset = index * 164,
      width = 156;
    context.save();
    context.translate(offset, 0);
    context.fillStyle = palette.ground;
    context.fillRect(0, 0, width, 154);
    context.strokeStyle = palette.grid;
    context.lineWidth = 1;
    for (let at = 16; at < width; at += 20) {
      context.beginPath();
      context.moveTo(at, 30);
      context.lineTo(at, 116);
      context.stroke();
    }
    context.fillStyle = index ? palette.gold : palette.light;
    context.font = 'bold 10px system-ui';
    context.textAlign = 'left';
    context.fillText(locale === 'uk' ? (index ? 'ДАЛІ' : 'ЗАРАЗ') : index ? 'NEXT' : 'NOW', 10, 17);
    const native = (kind, x, y, size) => paintSprite(context, kind, x, y, size, still ? 0 : time);
    const line = (x, y, w, h, color) => {
      context.fillStyle = color;
      context.fillRect(x, y, w, h);
    };
    const bar = (fraction, y = 102, color = palette.open) => {
      line(12, y, 132, 4, palette.grid);
      line(12, y, Math.max(0, Math.min(1, fraction)) * 132, 4, color);
    };
    const spark = (x, y) => {
      line(x - 8, y - 1, 16, 2, palette.gold);
      line(x - 1, y - 8, 2, 16, palette.gold);
    };
    const system = index === 0 && model.beforeSystem ? model.beforeSystem : model.system;
    let x = 24 + cycle * 105;
    if (system === 'strike-width') {
      const half = 12 * params.strikeWidth;
      context.globalAlpha = 0.22;
      line(20, 70 - half, 108, half * 2, palette.open);
      context.globalAlpha = 1;
      for (const y of [53, 70, 87]) {
        if (x < 87 || Math.abs(y - 70) > half) native('enemy', 94, y, 23);
        else spark(94, y);
      }
      line(20, 70 - half, 108, 1, palette.open);
      line(20, 70 + half, 108, 1, palette.open);
      native('drone', x, 70, 43);
    } else if (system === 'slow-wake') {
      const trail = params.wakeDuration * 66;
      context.globalAlpha = 0.25;
      line(Math.max(10, x - trail), 57, Math.min(trail, x - 10), 26, palette.open);
      context.globalAlpha = 1;
      native('enemy', 42 + cycle * (params.wakeDuration ? 14 : 55), 83, 25);
      native('drone', x, 60, 43);
      if (trail) {
        line(46, 88, 3, 8, palette.open);
        line(52, 88, 3, 8, palette.open);
      }
    } else if (system === 'rush-charge') {
      for (const at of [67, 90, 113]) {
        if (x < at) native('enemy', at, 71, 23);
        else spark(at, 71);
      }
      native('drone', x, 70, 43);
      const charge = cycle > 0.83 || still ? 3 + params.rushBonus : Math.floor(cycle * 3);
      for (let at = 0; at < 5; at++)
        line(48 + at * 12, 103, 8, 5, at < charge ? palette.gold : palette.grid);
    } else if (system === 'boost-cooldown' || system === 'boost-duration') {
      const total = system === 'boost-duration' ? params.boostDuration : 0.3;
      const fraction = still ? 1 : Math.min(1, (cycle * 3) / total);
      x = 24 + fraction * total * 235;
      line(22, 68, Math.max(0, x - 22), 4, palette.open);
      native('enemy', 122, 88, 23);
      native('drone', x, 70, 43);
      bar(still ? (3 - params.boostCooldown) / 3 : Math.min(1, (cycle * 3) / params.boostCooldown));
    } else if (system === 'chain-window') {
      native('enemy', 26, 70, 25);
      native('enemy', 128, 70, 25);
      native('drone', 34 + cycle * 84, 70, 43);
      for (let at = 38; at < 125; at += 9) line(at, 73, 4, 1, palette.open);
      bar(Math.max(0, 1 - (still ? 4.5 : cycle * 6) / params.chainWindow));
    } else if (system === 'heavy-exposure') {
      native('machine', 106, 68, 47);
      native('drone', x - 8, 73, 43);
      line(84, 44, 2, 49, palette.open);
      line(129, 44, 2, 49, palette.open);
      bar(
        Math.max(
          0,
          1 - (still ? 2 : cycle * 5) / ((model.baseExposure ?? 3) + params.heavyExposureBonus),
        ),
      );
    } else if (system === 'guard-interrupt') {
      native('enemy', 60, 70, 24);
      native('shield', 117, 59, 28);
      native('drone', Math.min(x, 79), 70, 43);
      const interrupted = params.interruptRadius > 0 && (cycle > 0.35 || still);
      line(103, 48, 3, 24, interrupted ? palette.grid : palette.danger);
      if (interrupted) {
        spark(60, 70);
        for (let at = 70; at < 113; at += 8) line(at, 65, 4, 2, palette.open);
        line(111, 38, 3, 7, palette.open);
        line(119, 38, 3, 7, palette.open);
      }
    } else if (system === 'plating') {
      native('drone', 80, 66, 48);
      const damage = 20 * (1 - params.armorReduction);
      if (params.armorReduction) {
        line(64, 46, 3 + params.armorReduction * 10, 39, palette.gold);
        line(94, 46, 3 + params.armorReduction * 10, 39, palette.gold);
      }
      line(22 + cycle * 50, 63, 5, 5, palette.danger);
      if (cycle > 0.5 || still) {
        context.fillStyle = palette.danger;
        context.textAlign = 'center';
        context.font = 'bold 12px system-ui';
        context.fillText(`−${damage}`, 80, 95);
      }
      bar(cycle > 0.5 || still ? 1 - damage / 100 : 1);
    } else {
      native('drone', 80, 70, 48);
      const shield = model.shieldRefit?.[index ? 'after' : 'before'];
      if (shield) {
        // A refit shows protection available immediately, not a fully charged
        // demonstration. Outlined slots mean capacity without a live player.
        for (let at = 0; at < shield.capacity; at++) {
          if (shield.available === null) {
            context.strokeStyle = palette.light;
            context.strokeRect(65 + at * 15, 103, 11, 5);
          } else
            line(65 + at * 15, 103, 11, 5, at < shield.available ? palette.open : palette.grid);
        }
        if (shield.available > 0) line(60, 49, 3, 43, palette.open);
      } else {
        const hit = cycle > 0.5;
        for (let at = 0; at < params.shieldCapacity; at++)
          line(65 + at * 15, 103, 11, 5, hit && at === 0 && !still ? palette.grid : palette.open);
        line(22 + cycle * 50, 65, 5, 5, palette.danger);
        if (hit || still) {
          if (params.shieldCapacity) line(60, 49, 3, 43, palette.open);
          else spark(78, 70);
        }
      }
    }
    context.fillStyle = palette.light;
    context.textAlign = 'center';
    context.font = '10px system-ui';
    context.fillText(previewCaption(model, index, locale), 78, 139, 144);
    context.restore();
  }
}

export function createOverflightHuntUpgradeCard({
  document,
  offer,
  player,
  rulesVersion,
  locale = 'en',
  reducedEffects = false,
  disabled = false,
  moduleIcon,
  paintSprite,
  onChoose = () => {},
}) {
  const local = (value) => localizedOverflight(value, locale);
  const text = (key) => overflightHuntText(locale, key);
  const node = (tag, value = '', className = '') => {
    const element = document.createElement(tag);
    element.textContent = value;
    element.className = className;
    return element;
  };
  const model = overflightHuntPreviewModel(offer, { player, rulesVersion });
  const button = node('button', '', 'overflight-upgrade-card raid-upgrade-card');
  button.type = 'button';
  button.disabled = disabled;
  button.dataset.upgradeId = offer.id;
  const heading = node('span', '', 'upgrade-heading'),
    names = node('span', '', 'upgrade-names');
  if (moduleIcon) heading.append(moduleIcon(offer.system));
  names.append(
    node(
      'span',
      offer.kind === 'refit'
        ? locale === 'uk'
          ? 'Перебудова · ті самі ранги'
          : 'Refit · same rank budget'
        : offer.kind === 'field'
          ? locale === 'uk'
            ? 'Польова винагорода'
            : 'Field reward'
          : `${text('combatModule')} · ${offer.currentRank} → ${offer.rank}`,
      'upgrade-kind',
    ),
    node('strong', local(offer.title), 'upgrade-title'),
  );
  heading.append(names);
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 154;
  canvas.className = 'upgrade-preview raid-upgrade-preview';
  canvas.setAttribute('aria-hidden', 'true');
  const context = canvas.getContext('2d');
  button.paintPreview = (time = 0) =>
    paintOverflightHuntPreview(context, model, {
      time,
      locale,
      reducedEffects,
      paintSprite,
    });
  button.paintPreview();
  const comparison = model.field
    ? `${local(offer.current)} → ${local(offer.next)}`
    : `${text('current')}: ${previewCaption(model, 0, locale)}. ${text('next')}: ${previewCaption(model, 1, locale)}`;
  const consequence = shieldRefitConsequence(model.shieldRefit, locale);
  button.append(heading, canvas, node('span', local(offer.next), 'upgrade-description'));
  if (consequence)
    button.append(node('span', consequence, 'upgrade-description upgrade-consequence'));
  button.setAttribute(
    'aria-label',
    `${local(offer.title)}. ${comparison}. ${local(offer.current)}. ${local(offer.next)}${consequence ? ` ${consequence}` : ''}`,
  );
  button.addEventListener('click', () => onChoose(offer.id));
  return button;
}
