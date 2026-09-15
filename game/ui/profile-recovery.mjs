import { createOperationStatus } from './operation-status.mjs';

/** Standalone read-only controls; the injected reader exposes no write/restore operation. */
export function attachProfileRecoveryView({
  document: doc = globalThis.document,
  reader,
  createURL = (blob) => URL.createObjectURL(blob),
  revokeURL = (url) => URL.revokeObjectURL(url),
  onBack = () => {},
  supportedChannels = [],
  catalogIssue = '',
  presenter = createOperationStatus(doc.getElementById('profile-recovery-status')),
} = {}) {
  const $ = (id) => doc.getElementById(`profile-recovery-${id}`);
  let channels = [],
    review = null,
    active = null,
    serial = 0,
    closed = false,
    closing = null,
    url = null,
    originals = [],
    verified = null;
  const originalURLs = new Map();
  const supported = new Set(supportedChannels);
  const choice = () =>
    /^\d+$/.test($('original').value) ? originals[Number($('original').value)] : null;
  const status = (message, state = 'ready') => {
    const lease = active?.lease ?? presenter.begin({ message });
    lease.finish({ message, state });
  };
  const phase = (message) => active?.lease.update({ message });
  function clearDownload() {
    if (url) revokeURL(url);
    url = null;
    $('download').removeAttribute('href');
    $('download').hidden = true;
  }
  function clearOriginalDownload(id) {
    const previous = originalURLs.get(id);
    if (previous) revokeURL(previous);
    originalURLs.delete(id);
    $(id).removeAttribute('href');
    $(id).hidden = true;
  }
  function clearVerification() {
    verified = null;
    clearOriginalDownload('original-download');
    clearOriginalDownload('report-download');
    showOriginal();
  }
  function clearOriginals() {
    clearVerification();
    originals = [];
    $('original').replaceChildren();
    $('original').value = '';
    $('original-summary').textContent = '';
  }
  function refresh() {
    $('find').disabled = !!active || closed;
    $('channel').disabled = !!active || closed || !channels.length;
    $('review').disabled = !!active || closed || !channels.length;
    $('export').disabled = !!active || closed || !review;
    $('cancel').disabled = !active;
    $('cancel').hidden = !active;
    $('originals-review').disabled =
      !!active || closed || !review || !supported.has(review.channel.id);
    $('original').disabled = !!active || closed || !originals.length;
    $('original-verify').disabled =
      !!active || closed || choice()?.availability !== 'available-unverified';
    $('original-file').disabled = !!active || closed || !verified;
    $('original-report').disabled = !!active || closed || !verified;
  }
  async function task(fn, { clearRaw = true } = {}) {
    if (active || closed) return;
    const operation = { id: ++serial, controller: new AbortController() };
    active = operation;
    operation.lease = presenter.begin({
      message: 'Checking stored profile data…',
      isCurrent: () => !closed && active === operation,
    });
    if (clearRaw) clearDownload();
    refresh();
    const current = () => !closed && active === operation && !operation.controller.signal.aborted;
    try {
      await fn(operation.controller.signal, current);
    } catch (error) {
      if (current()) status(error.message, 'error');
    } finally {
      if (active === operation) {
        const hadCancelFocus = doc.activeElement === $('cancel');
        active = null;
        refresh();
        if (!closed && !doc.hidden && doc.hasFocus?.() !== false && hadCancelFocus)
          ($('review').disabled ? $('find') : $('review')).focus();
      }
    }
  }
  function cancel() {
    if (!active) return;
    active.controller.abort();
    status('Check cancelled. Stored profiles are unchanged.', 'cancelled');
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
      clearOriginals();
      phase('Finding exact profile channels…');
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
    clearOriginals();
    clearDownload();
    $('summary').textContent = '';
    status('Choose Review to inspect this channel.');
    refresh();
  };
  $('review').onclick = () =>
    task(async (signal, current) => {
      review = null;
      clearOriginals();
      const selected = channels[Number($('channel').value)];
      if (!selected) throw new Error('Choose an exact profile channel.');
      phase('Reviewing stored values…');
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
      phase('Rechecking the reviewed profile before export…');
      const result = await reader.exportStoredData(review, { signal });
      if (!current()) return;
      url = createURL(result.blob);
      if (!current()) {
        clearDownload();
        return;
      }
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
      if (
        !doc.hidden &&
        doc.hasFocus?.() !== false &&
        [$('export'), $('cancel')].includes(doc.activeElement)
      )
        $('download').focus();
    });
  function showOriginal() {
    const selected = choice();
    for (const [index, option] of Array.from($('original').children).entries()) {
      const item = originals[index];
      option.textContent = `${item.asset.id} · ${
        verified && item === selected
          ? 'verified during review'
          : item.availability.replaceAll('-', ' ')
      }`;
    }
    if (!selected) {
      $('original-summary').textContent = '';
      return;
    }
    const { asset } = selected;
    $('original-summary').textContent =
      `${asset.id} · ${asset.width} × ${asset.height} · ${asset.bytes} bytes\n` +
      `SHA-256: ${asset.sha256}\n${selected.references.length} stored presentation references. ` +
      (verified
        ? 'Image bytes and dimensions verified during this review. File preparation rechecks them.'
        : selected.availability === 'available-unverified'
          ? 'Bytes are available but have not been verified.'
          : selected.availability === 'missing'
            ? 'The original file is missing; verification is unavailable.'
            : 'Stored length differs; verification is unavailable.');
  }
  $('originals-review').onclick = () =>
    task(
      async (signal, current) => {
        clearOriginals();
        if (!review || !supported.has(review.channel.id))
          throw new Error(
            'No trusted catalog is packaged for this exact channel. Raw diagnostics remain available.',
          );
        phase('Checking shared original metadata and exact channel identity…');
        const result = await reader.reviewOriginals(review, { signal });
        if (!current()) return;
        originals = result.originals;
        for (const [index, item] of originals.entries()) {
          const option = doc.createElement('option');
          option.value = String(index);
          option.textContent = `${item.asset.id} · ${item.availability.replaceAll('-', ' ')}`;
          $('original').append(option);
        }
        $('original').value = originals.length ? '0' : '';
        showOriginal();
        status(
          `${originals.length} shared originals listed. These are not proof of pictures earned by this profile.` +
            (originals.length === 0
              ? ' Built-in pictures come from game files and are not listed here. Only uploaded or restored shared originals appear. An empty list does not mean your earned pictures were lost.'
              : '') +
            (result.diagnostics.length
              ? ` ${result.diagnostics.length} stored media availability issues remain.`
              : ''),
        );
      },
      { clearRaw: false },
    );
  $('original').onchange = () => {
    if (active || closed) return;
    clearVerification();
    showOriginal();
    refresh();
  };
  $('original-verify').onclick = () =>
    task(
      async (signal, current) => {
        clearVerification();
        const selected = choice();
        if (selected?.availability !== 'available-unverified')
          throw new Error('Choose an available original file.');
        phase('Verifying image: decoding dimensions, hashing bytes and rechecking identity…');
        const result = await reader.verifyOriginal(selected, { signal });
        if (!current()) return;
        verified = result;
        showOriginal();
        status(
          'Selected image verified. Prepare either file, then activate its download link. This is not a complete backup or earned-picture proof.',
        );
      },
      { clearRaw: false },
    );
  function exportOriginal(component, id) {
    return task(
      async (signal, current) => {
        clearOriginalDownload(id);
        if (!verified) throw new Error('Verify the selected original before preparing a file.');
        phase('Rechecking and verifying fresh selected bytes before preparing this file…');
        const result = await reader.exportOriginalComponent(verified, { component, signal });
        if (!current()) return;
        const next = createURL(result.blob);
        if (!current()) {
          revokeURL(next);
          return;
        }
        originalURLs.set(id, next);
        $(id).href = next;
        $(id).download = result.filename;
        $(id).hidden = false;
        status(
          'File prepared. Activate its download link to save it; browser download completion is not checked here.',
        );
        if (
          !doc.hidden &&
          doc.hasFocus?.() !== false &&
          [$('original-file'), $('original-report'), $('cancel')].includes(doc.activeElement)
        )
          $(id).focus();
      },
      { clearRaw: false },
    );
  }
  $('original-file').onclick = () => exportOriginal('original-file', 'original-download');
  $('original-report').onclick = () => exportOriginal('identity-report', 'report-download');
  $('cancel').onclick = cancel;
  const view = {
    cancel,
    close() {
      if (closing) return closing;
      closed = true;
      serial++;
      cancel();
      clearDownload();
      clearOriginals();
      refresh();
      closing = (async () => reader.close())();
      return closing;
    },
  };
  $('back').onclick = async () => {
    const lease = presenter.begin({ message: 'Closing recovery and releasing its reads…' });
    try {
      await view.close();
      await onBack();
    } catch (error) {
      lease.finish({
        message: `Recovery cleanup did not finish: ${error.message}`,
        state: 'error',
      });
    }
  };
  status('Choose Find profiles to inspect stored channel names.');
  $('catalog-status').textContent = catalogIssue
    ? `Original verification unavailable: ${catalogIssue} Raw profile diagnostics remain available.`
    : `Original verification supports ${supportedChannels.join(', ') || 'no channels in this release'}. Other channels retain raw diagnostics only.`;
  refresh();
  return view;
}
