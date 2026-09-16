import { performance } from 'node:perf_hooks';
import { waitFor } from './wait-for.mjs';

// These hosts validate, store and re-read real ~11 MiB embedded-art chapters.
// Match the existing optional-chapter allowance; ordinary waits remain at 5s.
export async function waitForChapterSelection(t, page, predicate, message) {
  const timeoutMs = 30000,
    started = performance.now();
  try {
    await waitFor(predicate, { message, timeoutMs });
  } catch (error) {
    try {
      t.diagnostic(
        JSON.stringify({
          phase: message,
          timeoutMs,
          elapsedMs: Math.round(performance.now() - started),
          pack: page.$('pack-select')?.value,
          campaign: page.$('campaign-select')?.value,
          level: page.$('level-select')?.value,
          selectorDisabled: page.$('pack-select')?.disabled,
          pictureState: page.doc.body.dataset.pictureState,
          contentStatus: page.$('content-select-status')?.textContent,
          packStatus: page.$('pack-status')?.textContent,
          runMessage: page.$('run-message')?.textContent,
          missionsOpen: page.$('shell-missions')?.open,
          replacementOpen: page.$('mission-replace-dialog')?.open,
          focus: page.doc.activeElement?.id,
          errors: page.errors?.map((value) => String(value?.stack ?? value)),
        }),
      );
    } catch {
      // A diagnostic failure must never replace the original wait assertion.
    }
    throw error;
  }
  t.diagnostic(`${message}: settled in ${Math.round(performance.now() - started)} ms`);
}
