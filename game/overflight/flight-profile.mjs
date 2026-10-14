// Optional horizontal handling tradeoffs. Default/classic behavior is unchanged.
// Every handling option keeps the same collision silhouette.
export const OVERFLIGHT_PLAYER_RADIUS = 9;
export const OVERFLIGHT_FLIGHT_PROFILES = Object.freeze({
  balanced: Object.freeze({ id: 'balanced', speed: 180, boostSpeed: 330, maxHull: 100 }),
  interceptor: Object.freeze({ id: 'interceptor', speed: 198, boostSpeed: 350, maxHull: 80 }),
  carrier: Object.freeze({ id: 'carrier', speed: 162, boostSpeed: 310, maxHull: 120 }),
});
export function overflightFlightProfile(characterId, enabled = false) {
  return enabled === true && ['interceptor', 'carrier'].includes(characterId)
    ? OVERFLIGHT_FLIGHT_PROFILES[characterId]
    : OVERFLIGHT_FLIGHT_PROFILES.balanced;
}
export function overflightFlightProfileHint(characterId, enabled, locale = 'en') {
  const profile = overflightFlightProfile(characterId, enabled);
  const uk = locale === 'uk';
  const name =
    profile.id === 'interceptor'
      ? uk
        ? 'Перехоплювач: швидший, легший корпус'
        : 'Interceptor: faster, lighter hull'
      : profile.id === 'carrier'
        ? uk
          ? 'Носій: міцніший корпус, повільніший'
          : 'Carrier: tougher hull, slower'
        : uk
          ? 'Збалансований політ'
          : 'Balanced flight';
  return `${name} · ${uk ? 'швидкість' : 'speed'} ${profile.speed} · ${uk ? 'ривок' : 'boost'} ${profile.boostSpeed} · ${uk ? 'корпус' : 'hull'} ${profile.maxHull}`;
}
