import { t, localizedText } from '../i18n/index.mjs';

const safeText = (value, limit = 80) =>
  typeof value === 'string' ? value.replace(/[\r\n\t]/g, ' ').slice(0, limit) : value;

/** Opt-in, memory-only diagnostics for physical controller acceptance. */
export function attachControllerConfirmTrace({
  document: doc = globalThis.document,
  enabled = false,
  version = 'dev',
  limit = 160,
} = {}) {
  if (!Number.isInteger(limit) || limit < 16 || limit > 1000)
    throw new RangeError(t('errors:controller.confirmTrace.limit'));
  const entries = [];
  let panel = null,
    output = null;

  const renderOutput = () => {
    if (!output) return;
    localizedText(output, () =>
      entries.length
        ? entries
            .slice(-24)
            .map(
              (item) =>
                `${item.t ?? '-'} gp:${item.gp ?? '-'} [${item.buttons.join(',') || '-'}] ${item.phase || '-'} ${item.event || '-'}${item.native ? ` native:${item.native}` : ''}${item.target ? ` target:${item.target}` : ''}${item.winner ? ` winner:${item.winner}` : ''}${item.reason ? ` reason:${item.reason}` : ''}`,
            )
            .join('\n')
        : t('interface:controller.confirmTrace.waiting'),
    );
  };

  if (enabled && doc?.body) {
    panel = doc.createElement('details');
    panel.id = 'controller-confirm-trace';
    panel.className = 'controller-confirm-trace';
    panel.open = true;
    const summary = doc.createElement('summary');
    localizedText(summary, () => t('interface:controller.confirmTrace.title', { version }));
    output = doc.createElement('pre');
    output.setAttribute('aria-live', 'polite');
    renderOutput();
    panel.append(summary, output);
    doc.body.append(panel);
  }

  function record(value = {}) {
    if (!enabled) return;
    const entry = {
      t: Number.isFinite(value.time) ? Math.round(value.time) : null,
      gp: Number.isFinite(value.gamepadTimestamp) ? Math.round(value.gamepadTimestamp) : null,
      event: safeText(value.event),
      phase: safeText(value.phase),
      buttons: Array.isArray(value.buttons)
        ? value.buttons.filter(Number.isInteger).slice(0, 8)
        : [],
      native: safeText(value.nativeEventType),
      target: safeText(value.targetId),
      winner: safeText(value.winner),
      reason: safeText(value.reason),
    };
    entries.push(entry);
    if (entries.length > limit) entries.splice(0, entries.length - limit);
    renderOutput();
  }

  return {
    enabled,
    record,
    snapshot: () => entries.map((entry) => ({ ...entry, buttons: [...entry.buttons] })),
    destroy() {
      entries.length = 0;
      panel?.remove();
      panel = null;
      output = null;
    },
  };
}
