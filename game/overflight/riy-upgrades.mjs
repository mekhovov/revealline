import { legalOverflightUpgrades, utilityOffers, applyOverflightUpgrade } from './upgrades.mjs';

const local = (en, uk) => ({ en, uk });
const roles = ['sweeper', 'breaker'];
const branches = { sweeper: ['broad', 'trail'], breaker: ['burst', 'chain'] };
const names = {
  broad: local('Wide sweep', 'Широке зачищення'),
  trail: local('Slowing trail', 'Сповільнювальний слід'),
  burst: local('Breaker burst', 'Залп пробійника'),
  chain: local('Linked strikes', 'Ланцюгові удари'),
};
const descriptions = {
  broad: [
    local(
      'Wider rear blasts clear more pursuers',
      'Ширші вибухи позаду знищують більше переслідувачів',
    ),
    local(
      'Stronger rear blasts cover a broader return route',
      'Сильніші вибухи позаду очищують ширший шлях повернення',
    ),
  ],
  trail: [
    local(
      'Trade blast damage for a narrow slowing trail',
      'Замість потужного вибуху — вузький сповільнювальний слід',
    ),
    local(
      'A longer trail buys time to turn and return',
      'Довший слід дає час розвернутися й повернутися',
    ),
  ],
  burst: [
    local(
      'Two concentrated hits commit to one priority target',
      'Два зосереджені удари по одній пріоритетній цілі',
    ),
    local(
      'Stronger paired hits reward a clean approach',
      'Сильніші парні удари винагороджують вдалий захід',
    ),
  ],
  chain: [
    local(
      'Split each shot between up to three nearby enemies',
      'Розподіляйте удар між щонайбільше трьома ворогами поруч',
    ),
    local(
      'Stronger links reach farther without adding victims',
      'Сильніші ланки дістають далі без додаткових цілей',
    ),
  ],
};

export function createOverflightRiyBuild() {
  return roles.map((role) => ({ role, rank: 1, branch: null }));
}

/** One source for gameplay, cards, authoring preview and native coverage cues. */
export function overflightRiyEscortParameters(config, upgrade = null) {
  const rank = upgrade?.rank ?? 1;
  const branch = upgrade?.branch ?? null;
  const settings = {
    ...config,
    rank,
    branch,
    followArc: config.followArc ?? (config.role === 'sweeper' ? 140 : 120),
    attackRange: config.attackRange ?? (config.role === 'sweeper' ? 120 : 180),
    burstCount: 1,
    burstDelay: 0.18,
    chainTargets: 1,
    chainRange: 0,
    trailRadius: 0,
    trailDuration: 0,
    trailSlow: 0.65,
  };
  if (branch === 'broad') {
    settings.radius = config.radius * (rank === 2 ? 1.25 : 1.5);
    settings.damage = config.damage * (rank === 2 ? 1.15 : 1.35);
  } else if (branch === 'trail') {
    settings.radius = config.radius * 0.55;
    settings.damage = config.damage * 0.5;
    settings.trailRadius = rank === 2 ? 22 : 28;
    settings.trailDuration = rank === 2 ? 1.2 : 1.8;
    settings.trailSlow = rank === 2 ? 0.65 : 0.55;
  } else if (branch === 'burst') {
    settings.burstCount = 2;
    settings.damage = config.damage * (rank === 2 ? 0.7 : 0.85);
    settings.interval = config.interval * 1.2;
  } else if (branch === 'chain') {
    settings.chainTargets = 3;
    settings.chainRange = rank === 2 ? 70 : 100;
    // Total damage budget, split over the actual unique victims. Never 3x damage.
    settings.damage = config.damage * (rank === 2 ? 1.1 : 1.3);
  }
  return settings;
}

export function legalOverflightRiyUpgrades(build) {
  const offers = [];
  for (const item of build.escorts ?? []) {
    if (!roles.includes(item.role) || item.rank >= 3) continue;
    for (const branch of item.branch ? [item.branch] : branches[item.role]) {
      const rank = item.rank + 1;
      const next = descriptions[branch][rank - 2];
      offers.push({
        id: `riy-${item.role}:${branch}:${rank}`,
        system: `riy-${item.role}`,
        role: item.role,
        branch,
        rank,
        currentRank: item.rank,
        kind: 'combat',
        title: names[branch],
        description: next,
        next,
        current: item.branch
          ? descriptions[item.branch][0]
          : item.role === 'sweeper'
            ? local('Rear group cover', 'Прикриття груп позаду')
            : local('Forward concentrated hits', 'Зосереджені удари попереду'),
        evolution: null,
      });
    }
  }
  return offers;
}

const leaderModules = (allowed) =>
  allowed.filter((id) => ['primary', 'scanner', 'shield', 'plating'].includes(id));

export function draftOverflightRiyUpgrades(build, allowed, random, previousIds = [], rules = 3) {
  const legal = [
    ...legalOverflightUpgrades(build, leaderModules(allowed), rules),
    ...legalOverflightRiyUpgrades(build),
  ];
  const primary = legal.filter((offer) => offer.system === 'primary');
  const unbranched = build.escorts?.find((item) => !item.branch);
  const branches = unbranched ? legal.filter((offer) => offer.role === unbranched.role) : [];
  // Show the meaningful fork together instead of allowing draft luck to force
  // an unrelated support choice. The first five choices can form a full route:
  // payload branch, both escort branches, stronger payload, then evolution.
  const guaranteed =
    build.primary.rank === 1 || previousIds.length
      ? primary
      : [...primary, ...branches].slice(0, 3);
  // A reroll keeps the payload/evolution opportunity but opens the escort slots
  // to fresh legal alternatives; otherwise three guarantees would waste it.
  const candidates = legal.filter((offer) => !guaranteed.includes(offer));
  for (let index = candidates.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [candidates[index], candidates[other]] = [candidates[other], candidates[index]];
  }
  candidates.sort(
    (a, b) => Number(previousIds.includes(a.id)) - Number(previousIds.includes(b.id)),
  );
  const offers = [...guaranteed, ...candidates].slice(0, 3);
  for (const offer of utilityOffers(build)) {
    if (offers.length === 3) break;
    offers.push(offer);
  }
  return offers;
}

export function applyOverflightRiyUpgrade(build, offer, allowed, rules = 3) {
  if (offer?.system?.startsWith('riy-')) {
    const accepted = legalOverflightRiyUpgrades(build).find((item) => item.id === offer.id);
    if (!accepted) return false;
    Object.assign(
      build.escorts.find((item) => item.role === accepted.role),
      {
        rank: accepted.rank,
        branch: accepted.branch,
      },
    );
    return true;
  }
  return applyOverflightUpgrade(build, offer, leaderModules(allowed), rules);
}

export function overflightRiyBuildItems(build) {
  return (build.escorts ?? []).map((item) => ({
    id: `riy-${item.role}`,
    title: item.branch
      ? names[item.branch]
      : item.role === 'sweeper'
        ? local('Sweeper', 'Зачисник')
        : local('Breaker', 'Пробійник'),
    rank: item.rank,
  }));
}
