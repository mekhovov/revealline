import { createRun, stepRun, releaseInputs, FIXED_DT } from '../game/core/index.mjs';
import {
  createRecorder,
  recordInput,
  recordRelease,
  exportReplay,
  verifyReplayAsync,
  snapshotReplay,
} from '../game/replay.mjs';
import { loadDemoSources } from '../game/demo-sources.mjs';
const status = document.querySelector('#status');
const runButton = document.querySelector('#run');
const exportButton = document.querySelector('#export');
const verifyButton = document.querySelector('#verify');
const output = document.querySelector('#bundle');
let bundle;
verifyButton.addEventListener('click', async () => {
  verifyButton.disabled = true;
  runButton.disabled = true;
  try {
    const [campaign, classRecipes] = await Promise.all(
      ['campaign', 'classes'].map((name) =>
        fetch(`../game/content/${name}.json`).then((response) => response.json()),
      ),
    );
    campaign.classRecipes = classRecipes;
    const sources = await loadDemoSources({
      entries: [{ campaign, classRecipes }],
      library: { list: async () => [] },
      WorkerClass: null,
    });
    const catalog = await fetch('../game/demo-data/catalog.json').then((response) =>
      response.json(),
    );
    if (!Array.isArray(catalog.clips) || catalog.clips.length === 0)
      throw new Error('The demo catalogue contains no recordings to verify.');
    if (sources.length !== catalog.clips.length)
      throw new Error(`Expected ${catalog.clips.length} sources, found ${sources.length}.`);
    const results = [];
    for (const source of sources) {
      status.textContent = `Preparing and playing shipped ${source.id} (${results.length + 1}/${sources.length})…`;
      const player = await source.create({});
      try {
        player.play();
        let frames = 0;
        while (player.phase === 'playing') {
          player.advance(0.25);
          if (++frames % 16 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
        }
        if (player.phase !== 'complete' || !player.finalCheckpoint?.matched)
          throw new Error(`${source.id} failed complete playback verification.`);
        results.push(
          `${source.id}: ${player.info.totalTicks} ticks, ${player.state.lives} lives, ${player.state.status}, exact ${player.finalCheckpoint.hash}`,
        );
      } finally {
        player.dispose();
      }
    }
    status.textContent = `PASS: all ${sources.length} shipped source adapters strictly prepared and completed exact playback in this browser.\n${results.join('\n')}`;
  } catch (error) {
    status.textContent = `ERROR: ${error.stack}`;
  } finally {
    verifyButton.disabled = false;
    runButton.disabled = false;
  }
});
runButton.addEventListener('click', async () => {
  runButton.disabled = true;
  exportButton.disabled = true;
  try {
    const catalog = await fetch('../game/demo-data/catalog.json').then((response) =>
      response.json(),
    );
    if (!Array.isArray(catalog.clips) || catalog.clips.length === 0)
      throw new Error('The demo catalogue contains no recordings to author.');
    const clips = [];
    for (const clip of catalog.clips) {
      status.textContent = `Recording ${clip.id} (${clips.length + 1}/${catalog.clips.length})…`;
      const source = snapshotReplay(
        await fetch(new URL(clip.replayURL, new URL('../game/', import.meta.url))).then(
          (response) => response.json(),
        ),
      );
      const original = await verifyReplayAsync(source);
      const run = createRun(source.level, source.options);
      const recorder = createRecorder(
        source.level,
        source.options,
        'authored-attract-route.v1-browser',
      );
      let captures = 0;
      for (const segment of source.segments) {
        if (segment.releaseBefore) {
          releaseInputs(run);
          recordRelease(recorder);
        }
        for (let index = 0; index < segment.ticks; index++) {
          if (run.status === 'won' || run.status === 'lost')
            throw new Error(`${clip.id} ended before the original trace.`);
          stepRun(run, segment.input, FIXED_DT);
          recordInput(recorder, segment.input);
          captures += run.events.filter((event) => event.type === 'cut.closed').length;
          if (run.tick % 600 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
      if (source.releaseAfter) {
        releaseInputs(run);
        recordRelease(recorder);
      }
      const replay = exportReplay(recorder, run);
      const verified = await verifyReplayAsync(replay);
      if (!verified.match || run.status !== 'won' || run.lives !== 3)
        throw new Error(
          `${clip.id} browser recording failed its own verification or no-loss winning requirement.`,
        );
      for (const key of [
        'version',
        'ruleset',
        'level',
        'options',
        'segments',
        'ticks',
        'releaseAfter',
      ]) {
        if (JSON.stringify(source[key]) !== JSON.stringify(replay[key]))
          throw new Error(`${clip.id} altered ${key}.`);
      }
      clips.push({
        id: clip.id,
        sourceURL: clip.replayURL,
        sourceCheckpoint: source.checkpoint,
        originalDiagnostics: original.diagnostics,
        actualEnemies: original.state.enemies,
        captures,
        replay,
      });
    }
    bundle = {
      format: 'revealline-demo-browser-authoring.v1',
      createdAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      mathWitness: { sin: Math.sin(0.752335062026564), hypot: Math.hypot(0.3, 0.7) },
      clips,
    };
    output.value = JSON.stringify(bundle);
    exportButton.disabled = false;
    status.textContent = `Verified all ${clips.length} recordings. ${clips.filter((clip) => clip.originalDiagnostics.length).length} differ from the original runtime.\n${clips.map((clip) => `${clip.id}: ${clip.replay.ticks} ticks, ${clip.captures} captures, original mismatches ${clip.originalDiagnostics.map((item) => item.section ?? item.code).join(', ') || 'none'}`).join('\n')}`;
  } catch (error) {
    status.textContent = `ERROR: ${error.stack}`;
  } finally {
    runButton.disabled = false;
  }
});
exportButton.addEventListener('click', () => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(bundle, null, 2) + '\n'], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'demo-browser-recording-variants.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
