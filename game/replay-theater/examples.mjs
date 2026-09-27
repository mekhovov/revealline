import { t } from '../i18n/index.mjs';

export const REPLAY_EXAMPLES = {
  'fieldcraft-01': {
    labelKey: 'interface:copperCrossingFiber',
    file: './data/fieldcraft-01.replay.json',
    get brief() {
      return t('interface:immediateTurnsAFiberCraftCrossesTheInterferenceBandAt');
    },
  },
  'fieldcraft-02': {
    labelKey: 'interface:switchyardCircuitCarrier',
    file: './data/fieldcraft-02.replay.json',
    get brief() {
      return t('interface:gridCenterTurnsCollectSuppliesPlaceTwoSupportFieldsAnd');
    },
  },
  'fieldcraft-03': {
    labelKey: 'interface:pulseRecallImpact',
    file: './data/fieldcraft-03.replay.json',
    get brief() {
      return t('interface:immediateTurnsAPulseAbandonsAThreatenedLiveCutThe');
    },
  },
  'fieldcraft-04': {
    labelKey: 'interface:netLoomTrapper',
    file: './data/fieldcraft-04.replay.json',
    get brief() {
      return t('interface:gridCenterTurnsPickUpANetAndSlowThe');
    },
  },
};
