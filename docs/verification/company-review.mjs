import { reviewTarget, frameSummary, resourceSummary } from './company-review-model.mjs';

/** This observer reads public DOM and browser timing only. It never supplies
 * input, mutates player state, or produces a qualification approval. */
export function mountCompanyReview({ document, window }) {
  const { performance, location } = window;
  const $ = (id) => document.getElementById(id),
    records = [];
  let dispose = () => {},
    current = null,
    navigation = 0;
  const report = (value) => {
    const entry = { sample: $('label').value.slice(0, 80), navigation, ...value, qualified: false };
    records.push(entry);
    if (records.length > 100) records.shift();
    $('log').textContent = JSON.stringify(records, null, 2);
    $('status').textContent = `${entry.action}: ${entry.outcome}`;
  };
  const visible = (node) =>
    !!node && !node.closest('[hidden], [inert]') && node.getClientRects().length > 0;
  const memory = (win) =>
    Number.isFinite(win.performance.memory?.usedJSHeapSize)
      ? {
          usedJSHeapBytes: win.performance.memory.usedJSHeapSize,
          scope: 'approximate browser-provided heap; shared scope, not per-edition',
        }
      : { usedJSHeapBytes: null, scope: 'browser metric unavailable' };
  const disable = () => {
    current = null;
    $('frames').disabled = $('layout').disabled = true;
  };

  $('load').onclick = () => {
    let target;
    try {
      target = reviewTarget($('target').value, location.href);
    } catch (error) {
      report({ action: 'Load', outcome: error.message });
      return;
    }
    dispose();
    disable();
    $('game').width = $('width').value;
    const label = $('label').value.slice(0, 80),
      frame = $('game');
    let began = performance.now(),
      detached = false,
      observerDispose = () => {},
      loadTimer,
      loadTimedOut = false,
      loadInterrupted = document.hidden;
    const loadingVisibility = () => {
      if (document.hidden) loadInterrupted = true;
    };
    document.addEventListener('visibilitychange', loadingVisibility);
    const armLoad = () => {
      window.clearTimeout(loadTimer);
      loadTimer = window.setTimeout(() => {
        loadTimedOut = true;
        report({
          sample: label,
          action: 'Load',
          outcome: 'Timed out; no readiness timing observation',
        });
      }, 30000);
    };
    armLoad();
    frame.onload = () => {
      if (detached) return;
      observerDispose();
      disable();
      window.clearTimeout(loadTimer);
      const observedNavigation = ++navigation;
      let win, doc, actualTarget;
      try {
        win = frame.contentWindow;
        doc = frame.contentDocument;
        if (!doc || !win) throw new Error('Same-origin document unavailable');
        actualTarget = reviewTarget(win.location.href, location.href);
      } catch (error) {
        report({ sample: label, action: 'Load', outcome: error.message });
        return;
      }
      const emit = (value) =>
        report({ sample: label, navigation: observedNavigation, target: actualTarget, ...value });
      const get = (id) => doc.getElementById(id);
      let raf,
        readyFrames = 0,
        ready = false,
        pending = null,
        sample = null,
        previous = null,
        active = true,
        timingInvalid = loadTimedOut
          ? 'Load timed out'
          : loadInterrupted
            ? 'Load was hidden'
            : null;
      const running = () =>
        visible(get('play-screen')) &&
        get('play-overlay')?.hidden &&
        get('pause-button')?.textContent === 'Pause';
      const stopSample = (reason) => {
        if (sample) emit({ action: 'Frame intervals', outcome: reason });
        sample = null;
        previous = null;
        $('frames').textContent = 'Measure 20 seconds of play';
        $('frames').disabled = !ready;
      };
      const stopPending = (reason) => {
        if (pending) emit({ action: pending.action, outcome: reason });
        pending = null;
      };
      const readyTimer = window.setTimeout(
        () => {
          if (!ready) {
            timingInvalid = 'Menu readiness timed out';
            emit({
              action: 'Load to company menu',
              outcome: 'Timed out; no readiness timing observation',
            });
          }
        },
        Math.max(1, 30000 - (performance.now() - began)),
      );
      const click = (event) => {
        const button = event.target.closest?.('button');
        if (!button || button.disabled) return;
        if (
          ['start-campaign', 'continue-button', 'retry-button', 'next-button'].includes(
            button.id,
          ) ||
          (button.closest('.campaign-card') && button.textContent.includes('Enter journey'))
        ) {
          stopPending('Superseded mission preparation observation discarded');
          pending = {
            began: performance.now(),
            action: button.textContent.trim().slice(0, 120),
            trusted: event.isTrusted,
            entriesBefore: win.performance.getEntriesByType('resource').length,
          };
        }
      };
      const visibility = () => {
        if (document.hidden || doc.hidden) {
          readyFrames = 0;
          if (!ready) timingInvalid = 'Load was hidden';
          stopSample('Hidden sample discarded');
          stopPending('Hidden preparation observation discarded');
        }
      };
      const pagehide = () => {
        observerDispose();
        disable();
        began = performance.now();
        loadTimedOut = false;
        loadInterrupted = document.hidden;
        armLoad();
      };
      doc.addEventListener('click', click, true);
      doc.addEventListener('visibilitychange', visibility);
      document.addEventListener('visibilitychange', visibility);
      win.addEventListener('pagehide', pagehide);
      current = {
        doc,
        win,
        emit,
        start() {
          if (!ready || !running() || document.hidden || doc.hidden) {
            emit({ action: 'Frame intervals', outcome: 'Start or resume a visible mission first' });
            return;
          }
          if (sample) return;
          sample = { began: performance.now(), intervals: [] };
          previous = null;
          $('frames').textContent = 'Measuring…';
          $('frames').disabled = true;
          emit({
            action: 'Frame intervals',
            outcome: '20-second observation started; keep playing',
          });
        },
      };
      const tick = (now) => {
        if (!active) return;
        const resources = !ready || pending ? win.performance.getEntriesByType('resource') : [];
        const visiblePage = !document.hidden && !doc.hidden;
        const state = doc.documentElement.dataset.companyState;
        const menuReady =
          (state === undefined || state === 'ready') &&
          get('campaigns')?.childElementCount > 0 &&
          !get('start-campaign')?.disabled &&
          get('notice')?.dataset.error !== 'true' &&
          !/Preparing|Checking/.test(get('notice')?.textContent ?? '') &&
          visible(get('start-campaign'));
        if (!ready && menuReady && visiblePage) {
          if (++readyFrames >= 2) {
            ready = true;
            window.clearTimeout(readyTimer);
            $('frames').disabled = $('layout').disabled = false;
            if (performance.now() - began > 30000) timingInvalid ??= 'Menu readiness timed out';
            emit({
              action: 'Load to company menu',
              outcome: timingInvalid
                ? `${timingInvalid}; timing discarded, menu now available`
                : 'Two consecutive visible ready-frame observations',
              ms: timingInvalid ? null : performance.now() - began,
              title: doc.title.slice(0, 256),
              ...resourceSummary(resources),
              memory: memory(win),
              viewport: {
                width: win.innerWidth,
                height: win.innerHeight,
                dpr: win.devicePixelRatio,
              },
            });
          }
        } else if (!ready) readyFrames = 0;
        if (!visiblePage) {
          if (!ready) timingInvalid ??= 'Load was hidden';
          stopPending('Hidden preparation observation discarded');
        }
        if (pending) {
          if (performance.now() - pending.began > 30000 || get('notice')?.dataset.error === 'true')
            stopPending('Failed or timed out; no preparation timing observation');
          else if (
            visible(get('play-screen')) &&
            visible(get('resume-button')) &&
            !/Preparing/.test(get('notice')?.textContent ?? '')
          ) {
            emit({
              action: pending.action,
              outcome: 'Mission prepared; explicit start available',
              ms: performance.now() - pending.began,
              mission: get('mission-title').textContent.slice(0, 160),
              newResourceTimingEntries:
                resources.length < pending.entriesBefore
                  ? null
                  : resources.length - pending.entriesBefore,
              ...resourceSummary(resources),
              trustedActivation: pending.trusted,
            });
            pending = null;
          }
        }
        if (sample) {
          if (!running() || !visiblePage) stopSample('Paused or hidden sample discarded');
          else {
            if (previous !== null) {
              if (sample.intervals.length >= 10000)
                stopSample('Frame sample limit reached; sample discarded');
              else sample.intervals.push(now - previous);
            }
            previous = now;
            if (sample && performance.now() - sample.began >= 20000) {
              const summary = frameSummary(sample.intervals);
              if (!summary) stopSample('No valid frame intervals; sample discarded');
              else {
                emit({
                  action: 'Frame intervals',
                  outcome: '20 seconds observed; not device qualification',
                  metric:
                    'requestAnimationFrame intervals including observer overhead; not render duration',
                  elapsedMs: performance.now() - sample.began,
                  mission: get('mission-title').textContent.slice(0, 160),
                  ...summary,
                  memory: memory(win),
                });
                sample = null;
                previous = null;
                $('frames').textContent = 'Measure 20 seconds of play';
                $('frames').disabled = false;
              }
            }
          }
        }
        raf = win.requestAnimationFrame(tick);
      };
      raf = win.requestAnimationFrame(tick);
      observerDispose = () => {
        if (!active) return;
        active = false;
        stopSample('Observer detached; sample discarded');
        stopPending('Navigation interrupted preparation observation');
        window.clearTimeout(readyTimer);
        win.cancelAnimationFrame(raf);
        doc.removeEventListener('click', click, true);
        doc.removeEventListener('visibilitychange', visibility);
        document.removeEventListener('visibilitychange', visibility);
        win.removeEventListener('pagehide', pagehide);
      };
    };
    dispose = () => {
      detached = true;
      window.clearTimeout(loadTimer);
      observerDispose();
      document.removeEventListener('visibilitychange', loadingVisibility);
      disable();
    };
    frame.src = target;
    $('status').textContent = 'Loading the selected game…';
  };
  $('frames').onclick = () => current?.start();
  $('layout').onclick = () => {
    if (!current || $('layout').disabled) return;
    const { doc, win, emit } = current;
    const controls = [...doc.querySelectorAll('button,select,input,a')].filter(visible);
    const clipped = controls.slice(0, 2000).flatMap((node) => {
      const r = node.getBoundingClientRect();
      const clippedBy = [node.parentElement?.closest('#arena'), node.closest('dialog[open]')]
        .filter(Boolean)
        .find((parent) => {
          const p = parent.getBoundingClientRect();
          return r.left < p.left || r.right > p.right || r.top < p.top || r.bottom > p.bottom;
        });
      return r.right > win.innerWidth + 1 || r.left < -1 || clippedBy
        ? [
            {
              label: (node.getAttribute('aria-label') || node.textContent.trim()).slice(0, 80),
              width: r.width,
              height: r.height,
            },
          ]
        : [];
    });
    emit({
      action: 'Visible layout',
      outcome: clipped.length
        ? 'Clipping needs review'
        : 'No clipping detected in inspected controls; manual review still required',
      viewport: { width: win.innerWidth, height: win.innerHeight },
      scrollWidth: doc.documentElement.scrollWidth,
      inspectedControls: Math.min(2000, controls.length),
      controlLimitReached: controls.length > 2000,
      clipped: clipped.slice(0, 100),
      clippedTotal: clipped.length,
      focus: (
        doc.activeElement?.getAttribute('aria-label') ||
        doc.activeElement?.id ||
        doc.activeElement?.tagName ||
        ''
      ).slice(0, 80),
      memory: memory(win),
    });
  };
  $('export').onclick = () => {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { format: 'revealline-company-observations.v1', qualified: false, records },
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      ),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'company-review-observations.json';
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const pagehide = () => dispose();
  window.addEventListener('pagehide', pagehide);
  return () => {
    dispose();
    window.removeEventListener('pagehide', pagehide);
  };
}

if (globalThis.document && globalThis.window)
  mountCompanyReview({ document: globalThis.document, window: globalThis.window });
