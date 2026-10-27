/** Bounded current-host facts. Save permission is unknown: this host's existing
 * records owner reports each completed write, not a current permission lease. */
export function overflightSupportHost({
  mode,
  run,
  version,
  locale,
  controller,
  offline,
  platform,
  practice = false,
} = {}) {
  const operation = mode?.operationId ?? mode?.id;
  const kind = {
    overflight: 'overflight',
    'overflight-riy': 'overflight-riy',
    'overflight-hunt': 'overflight-hunt',
    'time-attack': 'overflight-time-attack',
    marathon: 'overflight-marathon',
  }[operation];
  const declared = typeof version === 'string' && version !== 'DEV';
  return {
    kind,
    version: declared ? version : null,
    packaged: typeof version === 'string' ? declared : null,
    state:
      !run || run.phase === 'ready'
        ? 'idle'
        : ['paused', 'upgrade'].includes(run.phase)
          ? 'paused'
          : run.phase === 'playing'
            ? 'running'
            : run.phase,
    locale,
    writable: practice ? false : null,
    writerReason: practice ? 'practice' : 'unavailable',
    platform,
    offline: offline?.available ? 'configured' : offline?.messageCode,
    controller: controller?.supportSnapshot(),
  };
}
