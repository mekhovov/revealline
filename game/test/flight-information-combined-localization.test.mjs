import test from 'node:test';
import assert from 'node:assert/strict';
import { flightDetailsModel } from '../ui/flight-information-details.mjs';
import { getLocale, setLocale, t, formatNumber } from '../i18n/index.mjs';

const context = {
  mission: () => t('interface:actorsAndLineDanger'),
  goal: 'Reveal',
  steering: 'Immediate',
  actions: [],
};
const phaseKeys = {
  patrol: 'pressurePatrol',
  warning: 'pressureWarning',
  committed: 'pressureCommitted',
  cooldown: 'pressureCooldown',
};

// A pure accepted-snapshot rendering check. Real benchmark routes remain a
// separate cohort once their authoring dependencies have been reconciled.
test('combined pressure and impact details preserve localized phase clocks and both hazards', () => {
  const previous = getLocale();
  try {
    for (const locale of ['en', 'uk']) {
      setLocale(locale, { persist: false });
      for (const [mode, roleKey] of [
        ['trail-pursuit', 'trailPursuer'],
        ['head-intercept', 'headingInterceptor'],
      ]) {
        for (const [phase, phaseKey] of Object.entries(phaseKeys)) {
          const snapshot = {
            status: 'running',
            paused: true,
            player: { cutting: true },
            objectives: { done: 0, total: 0 },
            classic: {
              enemies: [
                {
                  type: 'bouncer',
                  impactCarrier: true,
                  frozen: true,
                  pressure: { mode, phase, seconds: 1.5 },
                },
              ],
              lineImpacts: [{ direction: 1 }],
              erosion: [],
              effects: [],
              powerups: [],
            },
            laneBosses: [],
            encounter: null,
          };
          const before = structuredClone(snapshot);
          const sections = flightDetailsModel({ snapshot }, context);
          const lines = sections.find((part) => part.id === 'threats').lines;
          const line = lines.find((value) => value.startsWith(t('interface:' + roleKey)));
          const time = t('interface:flightDetails.secondsRemaining', {
            seconds: formatNumber(1.5, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
              useGrouping: false,
            }),
          });
          assert.ok(
            line.startsWith(`${t('interface:' + roleKey)} · ${t('interface:trailImpactCarrier')}:`),
          );
          assert.ok(line.includes(t('interface:flightDetails.' + phaseKey, { time })));
          assert.ok(
            line.includes(
              t('interface:trailContactSendsVisibleFrontsAlongYourUnfinishedLineClose'),
            ),
          );
          assert.ok(line.includes(t('interface:frozenMovementAndAttackCountdownsAreHeld')));
          assert.ok(lines.includes(t('interface:enemyFreezeDoesNotStopTravellingLineImpacts')));
          assert.equal(sections[0].title, t('interface:actorsAndLineDanger'));
          assert.doesNotMatch(line, /flightDetails\.|undefined|NaN/);
          if (locale === 'uk')
            assert.doesNotMatch(
              line,
              /s remaining|preparing a charge|charging toward|recovering from|patrolling hidden/,
            );
          assert.deepEqual(snapshot, before);
        }
      }
    }
  } finally {
    setLocale(previous, { persist: false });
  }
});
