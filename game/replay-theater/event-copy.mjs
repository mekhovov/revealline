import { t } from '../i18n/index.mjs';

export function replayEventRecord(event, fallbackTick, clip = String) {
  return {
    tick: event.tick ?? fallbackTick,
    type: clip(event.type),
    classId: event.classId ? clip(event.classId) : '',
    primitive: event.primitive ? clip(event.primitive) : '',
    interferenceResisted:
      event.type === 'signal.changed' && event.resistant && event.zoneIds.length > 0,
    reason: event.reason ? clip(event.reason) : '',
  };
}

export function replayEventText(event) {
  return t('gameplay:tick2', {
    value1: event.tick,
    value2: event.type,
    value3: event.classId ? ` · ${event.classId}` : '',
    value4: event.primitive ? ` · ${event.primitive}` : '',
    value5: event.interferenceResisted ? t('gameplay:interferenceResisted') : '',
    value6: event.reason ? ` · ${event.reason}` : '',
  });
}
