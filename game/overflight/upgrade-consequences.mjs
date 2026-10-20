import { legalOverflightUpgrades, applyOverflightUpgrade } from './upgrades.mjs';
import {
  OVERFLIGHT_PROJECT_FORMAT,
  OVERFLIGHT_PROJECT_FORMAT_V2,
  OVERFLIGHT_PROJECT_FORMAT_V3,
  OVERFLIGHT_PROJECT_FORMAT_V4,
  OVERFLIGHT_COMPILED_FORMAT,
  OVERFLIGHT_COMPILED_FORMAT_V2,
  OVERFLIGHT_COMPILED_FORMAT_V3,
  OVERFLIGHT_COMPILED_FORMAT_V4,
} from './project.mjs';

const nativeFormats = new Map([
  [OVERFLIGHT_COMPILED_FORMAT, OVERFLIGHT_PROJECT_FORMAT],
  [OVERFLIGHT_COMPILED_FORMAT_V2, OVERFLIGHT_PROJECT_FORMAT_V2],
  [OVERFLIGHT_COMPILED_FORMAT_V3, OVERFLIGHT_PROJECT_FORMAT_V3],
  [OVERFLIGHT_COMPILED_FORMAT_V4, OVERFLIGHT_PROJECT_FORMAT_V4],
]);
const newCombatModule = (offer) =>
  offer.kind === 'combat' && offer.system !== 'primary' && offer.currentRank === 0;

/** Read the native legal policy on copies. This does not forecast random drafts,
 * consume a choice, or apply Single Drone slot rules to Riy or Raid. */
export function overflightUpgradeConsequences(offer, { build, compiled } = {}) {
  if (
    !compiled ||
    !nativeFormats.has(compiled.format) ||
    nativeFormats.get(compiled.format) !== compiled.sourceFormat ||
    compiled.riy ||
    build?.escorts ||
    !build?.primary ||
    !Array.isArray(build.combat) ||
    !Array.isArray(compiled.upgrades?.modules)
  )
    return null;
  const allowed = compiled.upgrades.modules,
    rules = compiled.rulesVersion,
    legal = (value) => legalOverflightUpgrades(value, allowed, rules),
    accepted = legal(build).find((candidate) => candidate.id === offer?.id);
  if (!accepted) return null;
  const after = structuredClone(build);
  if (!applyOverflightUpgrade(after, accepted, allowed, rules)) return null;
  const available = legal(after),
    facts = {
      payloadPath: accepted.system === 'primary' && !build.primary.branch,
      supportFamily: accepted.kind === 'support' && !build.support,
      maximumRank:
        accepted.system !== 'primary' &&
        !available.some((candidate) => candidate.system === accepted.system),
      combatSlots: null,
    };
  if (newCombatModule(accepted)) {
    // The authored module set may provide fewer families than the native slot
    // limit. Count only additional modules that the same legal policy can admit.
    const remainingSlots = (value) =>
      Math.max(
        0,
        ...legal(value)
          .filter(newCombatModule)
          .map((candidate) => {
            const next = structuredClone(value);
            if (!applyOverflightUpgrade(next, candidate, allowed, rules)) return 0;
            return 1 + remainingSlots(next);
          }),
      );
    const used = after.combat.length;
    facts.combatSlots = Object.freeze({ used, capacity: used + remainingSlots(after) });
  }
  return Object.freeze(facts);
}
