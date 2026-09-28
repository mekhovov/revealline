import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { reviewTarget } from '../docs/verification/company-review-model.mjs';
import {
  validateDiscoveryObservation,
  summarizeDiscoverySession,
  summarizeDiscoveryLifecycle,
} from '../docs/verification/discovery-comparison.mjs';

const runFile = promisify(execFile);
/** Normal public UI automation around an already earned result. This script
 * never imports engine state or constructs completion/progress fixtures. */
export async function runDiscoveryCycles({
  session,
  binding,
  output,
  cycles = 20,
  invoke,
  targets,
  onProgress = () => {},
  waitMs = 20000,
}) {
  if (
    !/^[a-z0-9-]{1,64}$/.test(session ?? '') ||
    !Number.isInteger(cycles) ||
    cycles < 1 ||
    cycles > 20
  )
    throw new TypeError('Use a named browser session and 1–20 cycles.');
  if (!Number.isInteger(waitMs) || waitMs < 1 || waitMs > 20000)
    throw new TypeError('Use a bounded observation wait of at most 20 seconds.');
  const command =
    invoke ??
    (async (args) => {
      const { stdout } = await runFile('agent-browser', ['--session', session, '--json', ...args], {
        timeout: 45000,
        maxBuffer: 4 * 1024 * 1024,
      });
      const value = JSON.parse(stdout);
      if (!value.success) throw new Error(value.error || 'Browser command failed.');
      return value.data?.result ?? value.data;
    });
  const evaluate = (source) => command(['eval', `(async()=>{${source}})()`]);
  const waitFor = async (predicate, label) => {
    const began = performance.now();
    while (performance.now() - began < waitMs) {
      if (await evaluate(`return Boolean(${predicate});`)) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Timed out observing ${label}.`);
  };
  const frames = () =>
    evaluate(
      `await new Promise((resolve,reject)=>{let first,second; const timer=setTimeout(()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);reject(new Error('Visible-frame observation timed out.'));},2000); first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>{clearTimeout(timer);resolve();});});}); return true;`,
    );
  const attach = (value) =>
    evaluate(
      `globalThis.discoveryObservation?.dispose(); const {observeDiscovery}=await import('/docs/verification/discovery-observer.mjs'); globalThis.discoveryObservation=observeDiscovery({binding:${JSON.stringify(value)}}); return true;`,
    );
  const report = async () =>
    validateDiscoveryObservation(await evaluate('return discoveryObservation.exportReport();'));
  let result,
    step = 'initial surface check';
  const observations = [];
  try {
    if (targets) {
      if (!Array.isArray(targets) || targets.length < 2 || targets.length > 8)
        throw new TypeError('Provide 2–8 edition targets.');
      const origin = targets[0].url;
      for (const target of targets) reviewTarget(target.url, origin);
      for (let index = 0; index <= cycles; index++) {
        step = `edition navigation ${index + 1}`;
        const target = targets[index % targets.length],
          began = performance.now();
        await command(['open', target.url]);
        await waitFor('document.documentElement.dataset.bootState === "ready"', 'ready edition');
        await attach(target.binding);
        await frames();
        const actualEdition = await evaluate('return document.body.dataset.editionId;');
        if (actualEdition !== target.binding.editionId)
          throw new Error('The requested edition did not activate.');
        await evaluate(
          `discoveryObservation.checkpoint('edition ready ${index + 1}'); discoveryObservation.dispose('navigation observation complete'); return true;`,
        );
        observations.push({
          ...(await report()),
          navigationCommandWallMs: performance.now() - began,
        });
        onProgress({ navigation: index + 1, total: cycles + 1 });
      }
      result = {
        format: 'revealline-discovery-desktop-cycles.v1',
        qualified: false,
        kind: 'edition-navigation',
        summary: summarizeDiscoverySession(observations),
        observations,
        note: 'Normal URL navigation destroys the old document; this is not same-document switching or installation isolation evidence.',
      };
    } else {
      const ready = await evaluate(
        'return document.getElementById("game-overlay")?.dataset.kind === "won" && !!document.getElementById("completion-reward-result")?.querySelector("[data-reward-surface=result]");',
      );
      if (!ready)
        throw new Error('Earn a normal mission win with a discovery before running result cycles.');
      // Begin with the real picture visible, so every counted result has an
      // observed entry and departure. Existing local progress is left untouched.
      await command(['click', '#view-picture']);
      await frames();
      await attach(binding);
      for (let index = 0; index < cycles; index++) {
        step = `result ${index + 1}: show result`;
        await command(['click', '#show-result']);
        await frames();
        await waitFor(
          'discoveryObservation.inspectCycleSurface().explore.visible && !discoveryObservation.inspectCycleSurface().explore.disabled && discoveryObservation.inspectCycleSurface().openDialogIds.length === 0',
          'visible result Explore control',
        );
        step = `result ${index + 1}: open discovery`;
        await command(['click', '#completion-reward-result [data-reward-surface="result"]']);
        await waitFor(
          'document.getElementById("completion-reward-dialog")?.open === true',
          'open reward viewer',
        );
        step = `result ${index + 1}: load exact image`;
        await waitFor(
          `(()=>{const view=discoveryObservation.inspectCycleSurface(); if(view.brokenVisibleImages) throw new Error('Reward image completed without decoded pixels.'); return view.decodedVisibleImages>0;})()`,
          'decoded exact reward image',
        );
        // Even a cached image may arrive between two observer frames. Observe
        // the open phase before closing, rather than relying on driver latency.
        await frames();
        await evaluate(
          `discoveryObservation.checkpoint('reward viewer ${index + 1}'); return true;`,
        );
        step = `result ${index + 1}: close discovery and result`;
        await command(['click', '#completion-reward-dialog > button']);
        await waitFor(
          'document.getElementById("completion-reward-dialog")?.open === false',
          'closed reward viewer',
        );
        await frames();
        await command(['click', '#view-picture']);
        await frames();
        await evaluate(
          `discoveryObservation.checkpoint('closed result ${index + 1}'); return true;`,
        );
        onProgress({ resultCycle: index + 1, total: cycles });
      }
      await evaluate('discoveryObservation.dispose("result cycles complete"); return true;');
      const observation = await report();
      if (observation.cycles.result !== cycles || observation.cycles.rewardViewer !== cycles)
        throw new Error(
          'Requested transitions were not all observed; do not report the cycle target as passed.',
        );
      result = {
        format: 'revealline-discovery-desktop-cycles.v1',
        kind: 'earned-result',
        qualified: false,
        observation,
        lifecycle: summarizeDiscoveryLifecycle(observation),
        note: 'Repeated viewing of one genuinely earned result, not twenty new wins or pacing evidence.',
      };
    }
  } catch (error) {
    // Preserve failures without turning missing transitions into successful
    // cycles. A disconnected browser can also make diagnostics unavailable.
    let diagnostic = null;
    try {
      diagnostic =
        await evaluate(`const observer=globalThis.discoveryObservation; observer?.dispose('cycle runner failed'); return {
        report: observer?.exportReport() ?? null,
        surface: observer?.inspectCycleSurface() ?? null,
        recentControlEvents: (observer?.exportReport().records ?? []).filter(record=>record.kind==='public-control').slice(-24),
        state: { boot: document.documentElement.dataset.bootState ?? null,
          edition: document.body.dataset.editionId ?? null,
          overlay: document.getElementById('game-overlay')?.dataset.kind ?? null,
          rewardViewerOpen: document.getElementById('completion-reward-dialog')?.open ?? false,
          resultButtons: [...document.querySelectorAll('#completion-reward-result button')].map(b=>({text:b.textContent?.slice(0,120),surface:b.dataset.rewardSurface??null,disabled:b.disabled})).slice(0,8) }
      };`);
    } catch {
      /* The original command failure remains the authority. */
    }
    const failure = {
      format: 'revealline-discovery-desktop-cycle-failure.v1',
      qualified: false,
      kind: targets ? 'edition-navigation' : 'earned-result',
      step,
      error: String(error.message ?? error).slice(0, 2000),
      observations,
      diagnostic,
    };
    error.observation = failure;
    if (output) {
      try {
        await writeFile(output + '.failed.json', JSON.stringify(failure, null, 2) + '\n', {
          flag: 'wx',
        });
      } catch (saveError) {
        error.evidenceSaveError = saveError.message;
      }
    }
    throw error;
  }
  if (output) await writeFile(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [session, bindingFile, output, mode = 'results'] = process.argv.slice(2);
  if (!session || !bindingFile || !output || !['results', 'edition-navigation'].includes(mode))
    throw new Error(
      'Usage: node scripts/observe-discovery-cycles.mjs session binding-or-targets.json new-output.json [results|edition-navigation]',
    );
  const input = JSON.parse(await readFile(bindingFile, 'utf8'));
  const result = await runDiscoveryCycles({
    session,
    output,
    onProgress: (value) => process.stderr.write(JSON.stringify(value) + '\n'),
    ...(mode === 'edition-navigation' ? { targets: input } : { binding: input }),
  });
  process.stdout.write(
    JSON.stringify({
      kind: result.kind,
      qualified: false,
      cycles: result.observation?.cycles,
      summary: result.summary,
    }) + '\n',
  );
}
