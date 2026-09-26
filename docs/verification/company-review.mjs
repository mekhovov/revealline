import {
  reviewTarget,
  reviewViewport,
  reviewPlayerSurface,
  reviewControlViewport,
  frameSummary,
  resourceSummary,
} from './company-review-model.mjs';

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
    let target, viewport;
    try {
      target = reviewTarget($('target').value, location.href);
      viewport = reviewViewport($('width').value, $('height').value);
    } catch (error) {
      report({ action: 'Load', outcome: error.message });
      return;
    }
    dispose();
    disable();
    $('game').width = viewport.width;
    $('game').style.height = `${viewport.height}px`;
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
      let raf,
        readyFrames = 0,
        ready = false,
        pending = null,
        sample = null,
        armed = null,
        previous = null,
        active = true,
        timingInvalid = loadTimedOut
          ? 'Load timed out'
          : loadInterrupted
            ? 'Load was hidden'
            : null;
      const surface = () => reviewPlayerSurface(doc, visible);
      const running = () => surface().running;
      const stopSample = (reason) => {
        if (sample || armed !== null) emit({ action: 'Frame intervals', outcome: reason });
        sample = null;
        armed = null;
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
          [
            'start-campaign',
            'continue-button',
            'retry-button',
            'next-button',
            'shell-continue',
            'shell-featured',
            'start-button',
          ].includes(button.id) ||
          (button.closest('.campaign-card') && button.textContent.includes('Enter journey')) ||
          (button.closest('#journey-chooser') && button.dataset.missionId)
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
      const blur = () => {
        // The host pauses immediately on focus loss. A pause/resume may both
        // occur before the next RAF observation, so retire the active sample
        // at the event boundary rather than including that interruption.
        // An armed observation still waits for the user's explicit Resume.
        if (sample) stopSample('Focus interrupted sample discarded');
      };
      const pagehide = () => {
        observerDispose();
        disable();
        began = performance.now();
        loadTimedOut = false;
        loadInterrupted = document.hidden;
        armLoad();
      };
      const beginSample = () => {
        armed = null;
        sample = { began: performance.now(), intervals: [] };
        previous = null;
        $('frames').textContent = 'Measuring…';
        $('frames').disabled = true;
        emit({ action: 'Frame intervals', outcome: '20-second observation started; keep playing' });
      };
      doc.addEventListener('click', click, true);
      doc.addEventListener('visibilitychange', visibility);
      document.addEventListener('visibilitychange', visibility);
      win.addEventListener('blur', blur);
      win.addEventListener('pagehide', pagehide);
      current = {
        doc,
        win,
        emit,
        start() {
          if (!ready || document.hidden || doc.hidden) {
            emit({ action: 'Frame intervals', outcome: 'Load a visible ready game first' });
            return;
          }
          if (sample || armed !== null) return;
          if (running()) beginSample();
          else {
            // Clicking the observer blurs and pauses the Solo iframe. Arm an
            // observation; only the user's normal Resume may start the game.
            armed = performance.now();
            $('frames').textContent = 'Waiting for play…';
            $('frames').disabled = true;
            emit({
              action: 'Frame intervals',
              outcome: 'Armed; start or resume the game within 30 seconds',
            });
          }
        },
      };
      const tick = (now) => {
        if (!active) return;
        const resources = !ready || pending ? win.performance.getEntriesByType('resource') : [];
        const visiblePage = !document.hidden && !doc.hidden;
        const player = surface();
        const menuReady = player.ready;
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
              host: player.host,
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
          stopSample('Hidden sample discarded');
        }
        if (pending) {
          if (performance.now() - pending.began > 30000 || player.failed)
            stopPending('Failed or timed out; no preparation timing observation');
          else if (player.prepared) {
            emit({
              action: pending.action,
              outcome: player.preparedOutcome,
              host: player.host,
              ms: performance.now() - pending.began,
              mission: player.mission.slice(0, 160),
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
        let beganThisFrame = false;
        if (armed !== null) {
          if (performance.now() - armed > 30000)
            stopSample('No running flight observed; sample discarded');
          else if (player.running && visiblePage) {
            beginSample();
            // All callbacks in a RAF batch share its earlier timestamp. The
            // player may just have finished long preparation in this batch;
            // seed interval timing on the next frame, after sample activation.
            beganThisFrame = true;
          }
        }
        if (sample && !beganThisFrame) {
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
                  mission: player.mission.slice(0, 160),
                  host: player.host,
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
        win.removeEventListener('blur', blur);
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
    let scrollableOffscreen = 0;
    const clipped = controls.slice(0, 2000).flatMap((node) => {
      const r = node.getBoundingClientRect(),
        position = reviewControlViewport(node, win);
      if (position.scrollableOffscreen) scrollableOffscreen++;
      return position.outsideViewport && !position.scrollableOffscreen
        ? [
            {
              label: (node.getAttribute('aria-label') || node.textContent.trim()).slice(0, 80),
              width: r.width,
              height: r.height,
              outsideViewport: true,
            },
          ]
        : [];
    });
    emit({
      action: 'Visible layout',
      outcome: clipped.length
        ? 'Viewport overflow without observed scroll access needs review'
        : 'No unscrollable viewport overflow detected in inspected controls; manual review still required',
      limitation:
        'Does not establish accessibility or detect every ancestor clip, overlap or occlusion.',
      viewport: { width: win.innerWidth, height: win.innerHeight },
      scrollWidth: doc.documentElement.scrollWidth,
      inspectedControls: Math.min(2000, controls.length),
      controlLimitReached: controls.length > 2000,
      scrollableOffscreen,
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
