import { overflightModuleParameters, overflightPayload } from './upgrades.mjs';

// These are explanatory diagrams, not another game simulation. Weapon geometry
// and timing come from the same parameter functions used by the live run.
const systems = new Set([
  'primary',
  'slow-field',
  'proximity-pulse',
  'side-burst',
  'scanner',
  'shield',
  'reinforce',
  'repair',
  'recovery',
]);
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character],
  );
const number = (value) => Number(Number(value).toFixed(2));
const choose = (locale, en, uk) => (locale === 'uk' ? uk : en);

export function overflightUpgradePreviewModel(offer, { build, player } = {}) {
  if (!systems.has(offer.system)) throw new Error(`Unsupported upgrade preview: ${offer.system}`);
  const rank = Number(offer.rank);
  if (!Number.isInteger(rank) || rank < 1)
    throw new Error('An upgrade preview needs a positive rank.');
  if (
    offer.system === 'primary' &&
    (!['wide', 'double'].includes(offer.branch) || rank < 2 || rank > 4)
  )
    throw new Error('An upgrade preview needs a valid primary branch and rank.');
  if (!['primary', 'reinforce', 'repair', 'recovery'].includes(offer.system) && rank > 3)
    throw new Error('An upgrade preview needs a valid module rank.');
  let before, after;
  if (offer.system === 'primary') {
    const current = build?.primary ?? {
      rank: rank - 1,
      branch: rank === 2 ? null : offer.branch,
      evolved: false,
    };
    before = { ...overflightPayload({ primary: current }), rank: current.rank, delay: 0.45 };
    after = {
      ...overflightPayload({ primary: { rank, branch: offer.branch } }),
      rank,
      delay: 0.45,
    };
  } else if (['reinforce', 'repair', 'recovery'].includes(offer.system)) {
    before = {
      rank: 0,
      hull: player?.hull ?? 65,
      maxHull: player?.maxHull ?? 100,
      boostCooldown: player?.boostCooldown ?? 2.5,
      collectionRadius:
        overflightModuleParameters(
          'scanner',
          build?.support?.id === 'scanner' ? build.support.rank : 0,
        )?.collectionRadius ?? 62,
    };
    after = { ...before, rank };
    if (offer.system === 'reinforce') {
      after.maxHull += 12;
      after.hull = Math.min(after.maxHull, after.hull + 12);
    } else if (offer.system === 'repair') {
      after.hull = Math.min(after.maxHull, after.hull + 35);
      after.radius = 100;
    } else {
      after.boostCooldown = 0;
      after.collectionRadius = 260;
    }
  } else {
    const currentRank = offer.currentRank ?? rank - 1;
    before = { ...overflightModuleParameters(offer.system, currentRank), rank: currentRank };
    after = { ...overflightModuleParameters(offer.system, rank), rank };
  }
  return {
    system: offer.system,
    branch: offer.system === 'primary' ? offer.branch : null,
    before,
    after,
  };
}

function caption(system, state, locale) {
  const word = (en, uk) => choose(locale, en, uk);
  if (!state.rank && !['reinforce', 'repair', 'recovery'].includes(system))
    return [word('Empty slot', 'Вільне місце'), word('No effect yet', 'Ще без ефекту')];
  if (system === 'primary')
    return [
      `${state.count} ${word(state.count === 1 ? 'charge' : 'charges', state.count === 1 ? 'заряд' : state.count === 3 ? 'заряди' : 'зарядів')} · ${1 + state.echoes} ${word('hit', 'удар')}${state.echoes ? word('s', 'и') : ''}`,
      `${word('R', 'Р')} ${state.radius} · ${state.damage} ${word('dmg', 'шк.')} · ${state.cooldown}${word('s', 'с')}`,
    ];
  if (system === 'proximity-pulse')
    return [
      `${state.damage}${state.returnDamage ? `+${state.returnDamage}` : ''} → ${state.chargedDamage ?? state.damage}${state.returnDamage ? `+${state.chargedReturnDamage ?? state.returnDamage}` : ''} ${word('dmg', 'шк.')}`,
      `${word('Fly to charge', 'Політ заряджає')} · ${state.chargedCooldown ?? state.cooldown}${word('s', 'с')}`,
    ];
  if (system === 'slow-field')
    return [
      `${word('R', 'Р')} ${state.radius} · ${state.duration}${word('s field', 'с поле')}`,
      `${Math.round((1 - state.slowMultiplier) * 100)}% ${word('slower', 'повільніше')}`,
    ];
  if (system === 'side-burst')
    return [
      `${state.damage} ${word('dmg / side', 'шк. / бік')}`,
      state.piercing
        ? word('Pierces the whole line', 'Пробиває весь ряд')
        : `${word('Every', 'Кожні')} ${state.cooldown}${word('s', 'с')}`,
    ];
  if (system === 'scanner')
    return [
      `${word('Collect R', 'Збір Р')} ${state.collectionRadius}`,
      state.chainTargets
        ? `${state.chainTargets} ${word('target chain', 'цілі ланцюга')}`
        : `${state.markDuration}${word('s priority mark', 'с позначка')}`,
    ];
  if (system === 'shield')
    return [
      `${state.recharge}${word('s recharge', 'с відновлення')}`,
      state.pulseRadius
        ? word('Boost → pulse', 'Ривок → імпульс')
        : word('Absorbs one hit', 'Поглинає один удар'),
    ];
  if (system === 'recovery')
    return [
      `${word('Collect R', 'Збір Р')} ${state.collectionRadius}`,
      state.boostCooldown
        ? word('Boost recharging', 'Ривок відновлюється')
        : word('Boost ready', 'Ривок готовий'),
    ];
  return [
    `${number(state.hull)} / ${state.maxHull} ${word('hull', 'міцн.')}`,
    state.rank
      ? system === 'repair'
        ? word('Repair + repel', 'Ремонт + поштовх')
        : word('+12 maximum hull', '+12 максимуму')
      : word('Current airframe', 'Поточний дрон'),
  ];
}

const drone = (x, y, extra = '') =>
  `<g transform="translate(${x} ${y})" ${extra}><path d="M-8-7 8 7M-8 7 8-7" stroke="#81938c" stroke-width="3"/><path d="M-11-9h6v4h-6zm16 0h6v4H5zM-11 5h6v4h-6zm16 0h6v4H5z" fill="#98e6d5" stroke="#142c30"/><path d="M-4-5h8V5h-8z" fill="#eef3d8" stroke="#07171c" stroke-width="2"/><path d="m4-3 5 3-5 3" fill="#f4ce70"/></g>`;
// The enemy silhouette has no animation: warnings and geometry remain legible.
const soldier = (x, y) =>
  `<g transform="translate(${x} ${y})"><path d="M-2-6h4v4h3v6H2v3H0V4h-2v3h-2V1h-1v-3h3z" fill="#bd826f" stroke="#292d29" stroke-width="1"/></g>`;
const circle = (x, y, radius, color, extra = '') =>
  `<circle cx="${x}" cy="${y}" r="${number(radius)}" fill="${color}" fill-opacity=".08" stroke="${color}" stroke-width="1.3" ${extra}/>`;
const arrow = (x1, y1, x2, y2, color = '#a0bdb8') =>
  `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${color}" stroke-width="1.4" stroke-dasharray="3 3"/><path d="m${x2 - 4} ${y2 - 3} 4 3-4 3" fill="none" stroke="${color}" stroke-width="1.4"/>`;
const salvage = (x, y, opacity = 1) =>
  `<path d="m${x} ${y - 3} 3 3-3 3-3-3z" fill="#92e4be" opacity="${opacity}"/>`;

function scene(model, state, id, reducedEffects) {
  const { system } = model;
  let body = '',
    styles = '';
  const animate = (kind, duration, frames) => {
    if (reducedEffects) return '';
    const name = `${id}-${kind}`;
    styles += `@keyframes ${name}{${frames}}`;
    return `class="of-preview-animated" style="animation:${name} ${number(duration)}s linear infinite"`;
  };
  const flash = (x, y, radius, color, delay, cooldown, suffix = '') => {
    const percent = (seconds) => number(Math.min(99, (seconds / cooldown) * 100));
    const animation = animate(
      `hit${suffix}`,
      cooldown,
      `0%,${percent(Math.max(0, delay - 0.02))}%{opacity:0}${percent(delay)}%{opacity:.9}${percent(delay + 0.22)}%,100%{opacity:0}`,
    );
    return circle(x, y, radius, color, `opacity=".28" ${animation}`);
  };
  if (system === 'primary') {
    const scale = 0.2;
    const centre = 62;
    for (let index = 0; index < state.count; index++) {
      const y = 66 + (index - (state.count - 1) / 2) * state.spacing * scale;
      body += circle(centre, y, state.radius * scale, '#efbd70');
      body += `<rect x="${centre - 2}" y="${number(y - 2)}" width="4" height="4" fill="#ffe19a"/>`;
      body += flash(
        centre,
        y,
        state.radius * scale,
        '#ffe19a',
        state.delay,
        state.cooldown,
        String(index),
      );
    }
    for (let index = 1; index <= state.echoes; index++) {
      body += circle(
        centre,
        66,
        (state.radius + index * 27) * scale,
        '#ed9a7c',
        'stroke-dasharray="2 3"',
      );
      body += flash(
        centre,
        66,
        (state.radius + index * 27) * scale,
        '#ffd5ab',
        state.delay + index * 0.2,
        state.cooldown,
        `echo${index}`,
      );
    }
    body += soldier(37, 53) + soldier(41, 79) + arrow(76, 66, 117, 66);
    body += `<g opacity=".3">${drone(67.6, 66)}</g>`;
    body += `<g ${animate('flight', state.cooldown, `0%{transform:translateX(-29.4px)}100%{transform:translateX(${number(-29.4 + 36 * state.cooldown)}px)}`)}>${drone(97, 66)}</g>`;
  } else if (system === 'proximity-pulse' || system === 'slow-field') {
    body += arrow(81, 67, 120, 67) + `<g opacity=".28">${drone(65, 67)}</g>` + drone(109, 67);
    body += soldier(40, 49) + soldier(38, 81) + soldier(72, 95);
    if (state.rank) {
      const radius = (state.chargedRadius ?? state.radius) * 0.29;
      const color = system === 'slow-field' ? '#8fd0a8' : '#8dd8e7';
      body += circle(
        65,
        67,
        radius,
        color,
        system === 'slow-field' ? 'stroke-dasharray="3 2"' : '',
      );
      if (system === 'slow-field') {
        body += `<path d="M45 53h5m-7 5h5M42 83h5m-7 5h5M72 90h5" stroke="${color}" stroke-width="2"/>`;
        body += circle(65, 67, radius * 0.55, color, 'stroke-dasharray="1 4"');
      } else {
        const cooldown = state.chargedCooldown ?? state.cooldown;
        if (state.chargeDistance) {
          body += circle(65, 67, state.radius * 0.29, '#6b929b', 'stroke-dasharray="2 3"');
          body += `<path d="m91 91 6 3-6 3" fill="none" stroke="#edcf82" stroke-width="1.5"/>`;
          const chargePercent = number((state.chargeDistance / 180 / cooldown) * 100);
          for (let cell = 0; cell < 3; cell++) {
            const start = number((chargePercent * cell) / 3);
            const end = number((chargePercent * (cell + 1)) / 3);
            const animation = animate(
              `charge${cell}`,
              cooldown,
              `0%,${start}%{opacity:.2}${end}%,99%{opacity:1}100%{opacity:.2}`,
            );
            body += `<rect x="${100 + cell * 7}" y="91" width="5" height="6" fill="#ead28e" ${animation}/>`;
          }
        }
        const chargeTime = (state.chargeDistance ?? 0) / 180;
        body += flash(65, 67, radius, color, chargeTime + state.delay, cooldown);
        body += `<path d="m34 45-5-3 1 5m1 42-4 4 6-1m46 9 2 6 3-5" fill="none" stroke="${color}" stroke-width="1.5"/>`;
        if (state.returnDamage)
          body += flash(
            65,
            67,
            radius,
            '#e1f5ed',
            chargeTime + state.returnDelay,
            cooldown,
            'return',
          );
        if (state.returnDamage)
          body += `<path d="M84 98a10 10 0 1 0-12 1m-1-5 1 5 5-1" fill="none" stroke="#e1f5ed" stroke-width="1.5"/>`;
      }
    }
  } else if (system === 'side-burst') {
    body += drone(76, 67) + arrow(91, 67, 121, 67) + soldier(76, 35) + soldier(76, 99);
    if (state.rank) {
      const width = 1 + state.radius / 5;
      body += `<path d="M76 55V29M76 79v26" stroke="#f5d189" stroke-width="${number(width)}" opacity=".4"/>`;
      for (const side of [-1, 1]) {
        const distance = state.piercing ? 34 : 18;
        const animation = animate(
          `shot${side + 1}`,
          state.cooldown,
          `0%{transform:translateY(0px);opacity:1}${number((distance / (state.speed * 0.3) / state.cooldown) * 100)}%,100%{transform:translateY(${side * distance}px);opacity:0}`,
        );
        body += `<rect x="73" y="${67 + side * 12}" width="6" height="3" fill="#ffda87" ${animation}/>`;
      }
      if (state.piercing)
        body +=
          soldier(76, 24) +
          soldier(76, 112) +
          `<path d="m72 22 4-4 4 4m-8 90 4 4 4-4" fill="none" stroke="#ffe4ac" stroke-width="2"/>`;
    }
  } else if (system === 'scanner') {
    const radius = (state.collectionRadius ?? 62) * 0.23;
    body += circle(59, 68, radius, '#86cdb6', 'stroke-dasharray="2 3"') + drone(59, 68);
    body +=
      salvage(39, 80) +
      salvage(79, 85) +
      salvage(87, 70) +
      soldier(107, 45) +
      soldier(125, 67) +
      soldier(114, 90);
    if (state.rank) {
      body += `<path d="M99 43v-7h7m5 0h6v7m0 6v7h-6m-5 0h-7v-7" fill="none" stroke="#efda8e" stroke-width="2"/>`;
      body += `<path d="m87 69-11 0m4-3-4 3 4 3M42 81l8-7" fill="none" stroke="#8df1c5" stroke-width="1.5"/>`;
      if (state.chainTargets)
        body += `<path d="m108 48 18 19-11 23" fill="none" stroke="#edc966" stroke-width="2" stroke-dasharray="3 2"/>`;
    }
  } else if (system === 'shield') {
    body += drone(72, 67) + soldier(39, 65) + arrow(44, 67, 53, 67, '#ca826b');
    if (state.rank) {
      body += circle(72, 67, 20, '#9adcf0');
      body += `<circle cx="72" cy="67" r="25" fill="none" stroke="#e0cc8a" stroke-width="2" stroke-dasharray="157.1" transform="rotate(-90 72 67)" ${animate('recharge', state.recharge, '0%{stroke-dashoffset:157.1}100%{stroke-dashoffset:0}')}/>`;
      body += `<path d="m54 63-5-5m5 13-5 5M92 86a25 25 0 0 1-35 0m0-5 0 5 5 0" fill="none" stroke="#93d2e0" stroke-width="1.7"/>`;
      if (state.pulseRadius)
        body +=
          circle(43, 67, 16, '#f4d38e', 'stroke-dasharray="2 3"') +
          arrow(96, 67, 124, 67, '#eed898');
    }
  } else if (system === 'recovery') {
    body +=
      circle(72, 66, state.collectionRadius * 0.145, '#8fdcbd', 'stroke-dasharray="2 3"') +
      drone(72, 66);
    for (const [x, y] of [
      [36, 60],
      [44, 83],
      [107, 53],
      [99, 90],
    ]) {
      body += salvage(x, y);
      if (state.rank)
        body += `<path d="M${x} ${y}L${(x + 72) / 2} ${(y + 66) / 2}" stroke="#9ce6c7" stroke-dasharray="2 2"/>`;
    }
    body += `<path d="m${state.rank ? 97 : 94} 61 7 5-7 5m6-10 7 5-7 5" fill="none" stroke="${state.rank ? '#ffe098' : '#60726d'}" stroke-width="2"/>`;
  } else {
    body += drone(75, 57);
    const fill = Math.max(0, Math.min(1, state.hull / state.maxHull));
    body += `<rect x="40" y="83" width="72" height="9" fill="#15272a" stroke="#70988b"/><rect x="42" y="85" width="${number(68 * fill)}" height="5" fill="#9ad5ac"/>`;
    if (state.rank) body += `<path d="M73 69v10m-5-5h10" stroke="#d3f4bd" stroke-width="3"/>`;
    if (system === 'reinforce' && state.rank)
      body += `<path d="M62 46v22M88 46v22" stroke="#e2bf75" stroke-width="4"/>`;
    if (system === 'repair' && state.rank) body += circle(75, 57, 24, '#9dd9bd');
  }
  return { body, styles };
}

export function overflightUpgradePreview(
  offer,
  { locale = 'en', build, player, reducedEffects = false } = {},
) {
  const model = overflightUpgradePreviewModel(offer, { build, player });
  const scope = `of-preview-${model.system}-${model.branch ?? 'base'}-${model.after.rank}`;
  let styles = '',
    panels = '';
  const descriptions = [];
  for (const [index, state] of [model.before, model.after].entries()) {
    const label = index ? choose(locale, 'NEXT', 'ДАЛІ') : choose(locale, 'NOW', 'ЗАРАЗ');
    const lines = caption(model.system, state, locale);
    const picture = scene(model, state, `${scope}-${index}`, reducedEffects);
    styles += picture.styles;
    descriptions.push(`${label}: ${lines.join('; ')}`);
    panels += `<g transform="translate(${index * 164} 0)"><rect x="1" y="1" width="154" height="151" rx="3" fill="#111f25" stroke="${index ? '#658b7c' : '#34474b'}"/><path d="M12 43h12m100 53h15M30 102h7M100 29h13" stroke="#22343a" stroke-width="2"/><text x="12" y="18" fill="${index ? '#b9e7bd' : '#b0c5c5'}" font-size="12" font-weight="700">${label}</text>${picture.body}<text x="78" y="130" text-anchor="middle" font-size="12" fill="#edf1d9">${escape(lines[0])}</text><text x="78" y="144" text-anchor="middle" font-size="11.5" fill="#b7ceca">${escape(lines[1])}</text></g>`;
  }
  if (styles)
    styles += `@media(prefers-reduced-motion:reduce){.${scope} .of-preview-animated{animation:none!important}}`;
  const title = `${choose(locale, 'Visual comparison', 'Візуальне порівняння')}. ${descriptions.join('. ')}`;
  return `<svg class="overflight-upgrade-preview ${scope}" viewBox="0 0 320 154" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escape(title)}" focusable="false" style="display:block;width:100%;height:auto;font-family:system-ui,sans-serif;isolation:isolate"><title>${escape(title)}</title>${styles ? `<style>${styles}</style>` : ''}${panels}<path d="m157 72 5 5-5 5" fill="none" stroke="#d6e3d2" stroke-width="2"/></svg>`;
}
