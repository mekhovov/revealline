/** Standalone read-only controls; the injected reader exposes no write/restore operation. */
export function attachProfileRecoveryView({
  document: doc = globalThis.document,
  reader,
  createURL = (blob) => URL.createObjectURL(blob),
  revokeURL = (url) => URL.revokeObjectURL(url),
  onBack = () => {},
} = {}) {
  const $ = (id) => doc.getElementById(`profile-recovery-${id}`);
  let channels = [],
    review = null,
    active = null,
    serial = 0,
    closed = false,
    url = null;
  const status = (text) => {
    $('status').textContent = text;
  };
  function clearDownload() {
    if (url) revokeURL(url);
    url = null;
    $('download').removeAttribute('href');
    $('download').hidden = true;
  }
  function refresh() {
    $('find').disabled = !!active || closed;
    $('channel').disabled = !!active || closed || !channels.length;
    $('review').disabled = !!active || closed || !channels.length;
    $('export').disabled = !!active || closed || !review;
    $('cancel').disabled = !active;
    $('cancel').hidden = !active;
  }
  async function task(fn) {
    if (active || closed) return;
    const operation = { id: ++serial, controller: new AbortController() };
    active = operation;
    clearDownload();
    refresh();
    const current = () => !closed && active === operation && !operation.controller.signal.aborted;
    try {
      await fn(operation.controller.signal, current);
    } catch (error) {
      if (current()) status(error.message);
    } finally {
      if (active === operation) {
        active = null;
        refresh();
        if (!closed && doc.activeElement === $('cancel'))
          ($('review').disabled ? $('find') : $('review')).focus();
      }
    }
  }
  function cancel() {
    if (!active) return;
    active.controller.abort();
    status('Check cancelled. Stored profiles are unchanged.');
  }
  function showReview(value) {
    const fields = [];
    fields.push(`Exact channel: ${value.channel.id}`);
    if (value.profile.status === 'valid-structure')
      fields.push(
        `${value.profile.completedLevels} completed levels · ${value.profile.pictures} pictures · ${value.profile.scores} scores`,
      );
    else fields.push(`Profile: ${value.profile.status.replaceAll('-', ' ')}`);
    fields.push(
      `Saved flight: ${value.saved.status.replaceAll('-', ' ')}. Flight inspection is unavailable here.`,
    );
    fields.push('Media and original availability have not been inspected.');
    if (value.recoveryPending)
      fields.push('Pending recovery data is preserved. This screen cannot repair it.');
    for (const issue of value.diagnostics) fields.push(`${issue.component}: ${issue.message}`);
    $('summary').textContent = fields.join('\n');
  }
  $('find').onclick = () =>
    task(async (signal, current) => {
      review = null;
      status('Finding exact profile channels…');
      const result = await reader.discover({ signal });
      if (!current()) return;
      channels = result.channels;
      $('channel').replaceChildren();
      for (const [index, channel] of channels.entries()) {
        const option = doc.createElement('option');
        option.value = String(index);
        option.textContent = `${channel.version ?? 'Development'} · ${channel.id}${channel.support === 'protected-unknown' ? ' · unverified channel' : ''}`;
        $('channel').append(option);
      }
      $('channel').value = channels.length ? '0' : '';
      $('summary').textContent = result.diagnostics.map((item) => item.message).join('\n');
      status(
        channels.length
          ? `${channels.length} exact channels found. Choose one and review its stored values.`
          : 'No supported profile channels found on this origin.',
      );
    });
  $('channel').onchange = () => {
    if (active || closed) return;
    review = null;
    clearDownload();
    $('summary').textContent = '';
    status('Choose Review to inspect this channel.');
    refresh();
  };
  $('review').onclick = () =>
    task(async (signal, current) => {
      review = null;
      const selected = channels[Number($('channel').value)];
      if (!selected) throw new Error('Choose an exact profile channel.');
      status('Reviewing stored values…');
      const result = await reader.review(selected, { signal });
      if (!current()) return;
      review = result;
      showReview(result);
      status(
        'Stored values reviewed. Profile structure is checked separately from media and historical execution.',
      );
    });
  $('export').onclick = () =>
    task(async (signal, current) => {
      status('Rechecking the reviewed profile before export…');
      const result = await reader.exportStoredData(review, { signal });
      if (!current()) return;
      url = createURL(result.blob);
      $('download').href = url;
      $('download').download = result.filename;
      $('download').textContent = result.completeStoredSnapshot
        ? 'Download stored profile snapshot'
        : 'Download incomplete diagnostic';
      $('download').hidden = false;
      status(
        result.completeStoredSnapshot
          ? 'Snapshot prepared. It contains stored profile data, without original media or verified flight recovery.'
          : 'Incomplete diagnostic prepared. Unsupported components remain in storage and are not included as values.',
      );
      $('download').focus();
    });
  $('cancel').onclick = cancel;
  const view = {
    cancel,
    async close() {
      if (closed) return;
      closed = true;
      serial++;
      cancel();
      clearDownload();
      refresh();
      await reader.close();
    },
  };
  $('back').onclick = async () => {
    await view.close();
    onBack();
  };
  status('Choose Find profiles to inspect stored channel names.');
  refresh();
  return view;
}
