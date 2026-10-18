#!/usr/bin/env node
/** Strict browser qualification of newly authored Solo demos. Optional variants
 * record the same public inputs again; no replay compatibility bypass is used. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { snapshotReplay } from '../game/replay.mjs';
import { demoInputTraceIdentity } from '../game/demo-catalog.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')),
);
const runtime = args.runtime ?? 'playwright';
const playwright = await import(runtime.startsWith('/') ? pathToFileURL(runtime).href : runtime);
const engine = args.browser ?? 'chromium';
assert.ok(['chromium', 'firefox', 'webkit'].includes(engine));
const baseURL = args.url ?? 'http://127.0.0.1:8768';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname));
const report = {
  engine,
  sourceRevision: args['source-revision'],
  mainRevision: args['main-revision'],
  started: new Date().toISOString(),
  complete: false,
  verified: [],
  variants: [],
  performances: [],
  failures: [],
};
const reportPath = args.report ?? `.cache/solo-browser-${engine}.json`;
await mkdir(new URL('../.cache/', import.meta.url), { recursive: true });
const persistReport = () => writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
const browser = await playwright[engine].launch({
  headless: true,
  ...(args.executable ? { executablePath: args.executable } : {}),
});
const root = new URL('../game/', import.meta.url);
try {
  const page = await browser.newPage();
  const fixture = `${baseURL}/__solo_demo_qualification__`;
  await page.route(fixture, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }),
  );
  await page.goto(fixture);
  const catalogs = await Promise.all(
    (args.catalog ?? 'demo-data/catalog.json')
      .split(',')
      .map(async (file) => JSON.parse(await readFile(new URL(file, root), 'utf8'))),
  );
  const skipped = new Set();
  for (const file of (args['skip-report'] ?? '').split(',').filter(Boolean)) {
    const previous = JSON.parse(await readFile(file, 'utf8'));
    for (const row of previous.verified ?? []) skipped.add(row.id);
  }
  const clips = catalogs
    .flatMap((catalog) => catalog.clips)
    .filter(
      (clip) =>
        (args.reviewed === 'true'
          ? !clip.id.startsWith('solo-qualified-')
          : clip.id.startsWith('solo-qualified-')) &&
        !skipped.has(clip.id) &&
        (!args.only || clip.id === args.only),
    );
  assert.equal(
    new Set(clips.map((clip) => clip.id)).size,
    clips.length,
    'Duplicate source IDs across catalogs',
  );
  report.catalogs = args.catalog ?? 'demo-data/catalog.json';
  report.required = clips.length;
  report.browserVersion = browser.version();
  if (args.admit === 'true' || args['admission-only'] === 'true') {
    report.admission = await page.evaluate(async (clips) => {
      const [
        { SOLO_BUILTIN_DEMO_INDEX },
        { loadAuthoredJourneyRoute },
        { createSoloRouteHost },
        { resolveDemoCatalog },
        { campaignKey },
        { journeyActorThemeCandidates },
        { authoredJourneyUsesActorMaterials },
        themeResponse,
      ] = await Promise.all([
        import('/game/demo-modes/solo-builtins-index.mjs'),
        import('/game/content-design/route-loader.mjs'),
        import('/game/content-design/solo-route-host.mjs'),
        import('/game/demo-catalog.mjs'),
        import('/game/library.mjs'),
        import('/game/presentation/journey-actor-materials.mjs'),
        import('/game/content-design/mode-href.mjs'),
        fetch('/game/content-design/themes.json'),
      ]);
      if (!themeResponse.ok) throw new Error('Authored themes unavailable');
      const { themes: originals } = await themeResponse.json();
      const groups = new Map();
      for (const clip of clips) {
        const metadata = SOLO_BUILTIN_DEMO_INDEX.find((row) => row.id === clip.id);
        if (!metadata) throw new Error(`Missing native source metadata: ${clip.id}`);
        const group = groups.get(metadata.routeId) ?? [];
        group.push(clip);
        groups.set(metadata.routeId, group);
      }
      const results = [];
      for (const [routeId, clips] of groups) {
        const route = await loadAuthoredJourneyRoute(routeId, { fullSource: true });
        const themes = authoredJourneyUsesActorMaterials(route.id)
          ? journeyActorThemeCandidates(originals, {
              includeOriginals: route.preserveOriginalThemes === true,
            })
          : originals;
        const host = await createSoloRouteHost(route, { themes, buildVersion: 'demo' });
        try {
          for (const clip of clips) {
            const entry = host.entries.find(
              (entry) =>
                entry.difficulty === 'standard' && campaignKey(entry.campaign) === clip.campaignKey,
            );
            const admitted =
              entry &&
              resolveDemoCatalog({ format: 'revealline-demo-catalog.v1', clips: [clip] }, [
                entry,
              ])[0];
            if (!admitted) throw new Error(`Exact native content rejected ${routeId}: ${clip.id}`);
            if (!entry.themes?.length) throw new Error(`No native themes: ${clip.id}`);
            for (const manifest of entry.manifests ?? [])
              if (!entry.themes.some((theme) => theme.id === manifest.presentation.themeId))
                throw new Error(
                  `Missing native presentation: ${clip.id}/${manifest.presentation.themeId}`,
                );
            results.push({
              id: clip.id,
              routeId,
              recordingIdentity: clip.recordingIdentity,
              themes: entry.themes.length,
            });
          }
        } finally {
          host.preparer.dispose();
        }
      }
      return results;
    }, clips);
  }
  if (args['runtime-sources'] === 'true') {
    report.runtimePartial = [];
    await page.exposeFunction('reportDemoQualification', async (result) => {
      report.active = result?.phase ? result : null;
      if (result && !result.phase) report.runtimePartial.push(result);
      await persistReport();
      console.log(JSON.stringify({ engine, runtime: result }));
    });
    report.runtime = await page.evaluate(
      async ({ ids, reviewed }) => {
        let sources;
        if (reviewed) {
          const { loadStandaloneSoloContext } = await import('/game/demo-modes/solo-catalog.mjs');
          const context = await loadStandaloneSoloContext();
          sources = await context.loadSources({});
        } else {
          const { loadBuiltinSoloDemoSources } = await import('/game/demo-modes/solo-builtins.mjs');
          sources = await loadBuiltinSoloDemoSources();
        }
        const results = [];
        for (const id of ids) {
          let player;
          const request = new AbortController();
          const timeout = setTimeout(() => request.abort(), 30000);
          try {
            await globalThis.reportDemoQualification({ id, phase: 'preparing' });
            const source = sources.find((source) => source.id === id);
            if (!source) throw new Error('Runtime source was not enumerated');
            player = await source.create({ signal: request.signal });
            if (!source.entry?.themes?.length)
              throw new Error('Native presentation has no admitted themes');
            for (const manifest of source.entry.manifests ?? [])
              if (!source.entry.themes.some((theme) => theme.id === manifest.presentation.themeId))
                throw new Error(
                  `Native presentation theme is unavailable: ${manifest.presentation.themeId}`,
                );
            const before = player.state.claimedCount;
            let captures = 0;
            player.play();
            let advances = 0;
            const expectedTicks = player.info.totalTicks;
            const maxAdvances = Math.ceil(expectedTicks / 30) + 2;
            while (player.phase === 'playing') {
              const tick = player.state.tick;
              const report = player.advance(0.25);
              captures += report.events.filter((event) => event.type === 'cut.closed').length;
              if (player.state.tick <= tick && player.phase === 'playing')
                throw new Error(`Native playback made no progress at tick ${tick}`);
              if (++advances > maxAdvances || player.state.tick > expectedTicks)
                throw new Error(
                  `Native playback exceeded ${expectedTicks} recorded ticks: tick ${player.state.tick}`,
                );
            }
            if (player.phase !== 'complete')
              throw new Error(
                `Native playback stopped in ${player.phase} at tick ${player.state.tick}`,
              );
            results.push({
              id,
              ok: true,
              outcome: player.state.status,
              tick: player.state.tick,
              themes: source.entry.themes.length,
              captures,
              capturedCells: player.state.claimedCount - before,
            });
          } catch (error) {
            results.push({ id, ok: false, error: String(error.stack ?? error) });
          } finally {
            clearTimeout(timeout);
            player?.dispose();
            await globalThis.reportDemoQualification(results.at(-1));
          }
        }
        return results;
      },
      { ids: clips.map((clip) => clip.id), reviewed: args.reviewed === 'true' },
    );
  }
  for (const clip of args['admission-only'] === 'true' || args['runtime-sources'] === 'true'
    ? []
    : clips) {
    report.active = { id: clip.id, phase: 'verifying' };
    await persistReport();
    try {
      const replayURL =
        args.published === 'true'
          ? (clip.runtimePerformances?.find((candidate) => candidate.engine === engine)
              ?.replayURL ?? clip.replayURL)
          : clip.replayURL;
      const source = snapshotReplay(await readFile(new URL(replayURL, root), 'utf8'));
      const result = await page.evaluate(
        async ({ source, write }) => {
          const { createRun, stepRun, releaseInputs, FIXED_DT } = await import(
            '/game/core/index.mjs'
          );
          const {
            verifyReplay,
            createRecorder,
            recordInput,
            recordRelease,
            exportReplay,
            authoritativeCheckpoint,
          } = await import('/game/replay.mjs');
          const { prepareReplayPlayer } = await import('/game/replay-player.mjs');
          const { demoInputTraceIdentity } = await import('/game/demo-catalog.mjs');
          let initial;
          try {
            initial = verifyReplay(source);
          } catch (error) {
            initial = {
              match: false,
              diagnostics: [{ code: error.code ?? 'verification-failed', message: error.message }],
            };
          }
          let proof = source,
            diagnostics = null;
          if (!initial.match) {
            if (!write) return { ok: false, diagnostics: initial.diagnostics };
            const run = createRun(source.level, source.options);
            const recorder = createRecorder(source.level, source.options, source.build);
            const checkpoints = [];
            let captures = 0;
            trace: for (const segment of source.segments) {
              if (segment.releaseBefore) {
                releaseInputs(run);
                recordRelease(recorder);
              }
              for (let tick = 0; tick < segment.ticks; tick++) {
                if (['won', 'lost'].includes(run.status)) break trace;
                recordInput(recorder, segment.input);
                stepRun(run, segment.input, FIXED_DT);
                captures += run.events.filter((e) => e.type === 'cut.closed').length;
                if (run.tick % 600 === 0)
                  checkpoints.push({ tick: run.tick, ...authoritativeCheckpoint(run) });
              }
            }
            if (source.releaseAfter && run.tick === source.ticks) {
              releaseInputs(run);
              recordRelease(recorder);
            }
            if (!['won', 'lost'].includes(run.status) || !captures)
              throw new Error('Variant lacks terminal goal-related progress.');
            proof = exportReplay(recorder, run);
            diagnostics = {
              format: 'SoloDemoDiagnosticsV1',
              inputTraceIdentity: demoInputTraceIdentity(proof),
              checkpoints,
            };
            const check = verifyReplay(proof);
            if (!check.match)
              throw new Error(`New browser proof failed: ${JSON.stringify(check.diagnostics)}`);
          }
          const player = await prepareReplayPlayer(proof, { chunkTicks: 1200 });
          try {
            const initiallyClaimed = player.state.claimedCount;
            let captures = 0;
            player.play();
            let advances = 0;
            const maxAdvances = Math.ceil(proof.ticks / 30) + 2;
            while (player.phase === 'playing') {
              const tick = player.state.tick;
              captures += player
                .advance(0.25)
                .events.filter((event) => event.type === 'cut.closed').length;
              if (player.state.tick <= tick && player.phase === 'playing')
                throw new Error(`Playback made no progress at tick ${tick}`);
              if (++advances > maxAdvances || player.state.tick > proof.ticks)
                throw new Error(`Playback exceeded ${proof.ticks} recorded ticks`);
            }
            if (player.phase !== 'complete')
              throw new Error(`Playback stopped in ${player.phase} at tick ${player.state.tick}`);
            const capturedCells = player.state.claimedCount - initiallyClaimed;
            if (!captures || capturedCells <= 0)
              throw new Error('Playback lacks meaningful captures.');
            return {
              ok: true,
              proof: initial.match ? null : proof,
              independent:
                JSON.stringify(proof.summary) !== JSON.stringify(source.summary) ||
                demoInputTraceIdentity(proof) !== demoInputTraceIdentity(source),
              diagnostics,
              sourceDiagnostics: initial.diagnostics,
              captures,
              capturedCells,
              ticks: proof.ticks,
              outcome: proof.summary.status,
              checkpoint: proof.checkpoint.hash,
            };
          } finally {
            player.dispose();
          }
        },
        { source, write: args.write === 'true' },
      );
      if (!result.ok) {
        report.failures.push({ id: clip.id, ...result });
        continue;
      }
      if (result.proof) {
        const proof = snapshotReplay(result.proof);
        for (const key of ['version', 'ruleset', 'level', 'options'])
          assert.deepEqual(proof[key], source[key], `${clip.id} changes ${key}`);
        if (!result.independent) {
          for (const key of ['segments', 'ticks', 'releaseAfter', 'summary'])
            assert.deepEqual(proof[key], source[key], `${clip.id} changes ${key}`);
          assert.equal(demoInputTraceIdentity(proof), clip.inputTraceIdentity);
        }
        const suffix = `${engine}${result.independent ? '.performance' : ''}`;
        const replayURL = `./demo-data/${clip.id}.${suffix}.replay.json`;
        await writeFile(new URL(replayURL, root), JSON.stringify(proof) + '\n');
        const diagnosticURL = `./demo-data/${clip.id}.${suffix}.diagnostics.json`;
        await writeFile(new URL(diagnosticURL, root), JSON.stringify(result.diagnostics) + '\n');
        (result.independent ? report.performances : report.variants).push({
          id: clip.id,
          engine,
          outcome: proof.summary.status,
          recordingIdentity: clip.recordingIdentity,
          replayURL,
          diagnosticURL,
          inputTraceIdentity: demoInputTraceIdentity(proof),
          durationSeconds: proof.ticks / 120,
          turnPolicy: proof.options.turnPolicy,
          sourceCheckpoint: source.checkpoint.hash,
          checkpoint: proof.checkpoint.hash,
          sourceDiagnostics: result.sourceDiagnostics,
        });
      }
      report.verified.push({
        id: clip.id,
        captures: result.captures,
        capturedCells: result.capturedCells,
        ticks: result.ticks,
        outcome: result.outcome,
        checkpoint: result.checkpoint,
        variant: !!result.proof,
        independent: result.independent,
      });
    } catch (error) {
      report.failures.push({ id: clip.id, sourceURL: clip.replayURL, error: error.message });
    } finally {
      report.active = null;
      await persistReport();
    }
    if ((report.verified.length + report.failures.length) % 20 === 0)
      console.log(
        JSON.stringify({
          engine,
          verified: report.verified.length,
          failures: report.failures.length,
          required: report.required,
        }),
      );
  }
  report.complete =
    (args['runtime-sources'] === 'true'
      ? report.runtime?.length === report.required && report.runtime.every((row) => row.ok)
      : args['admission-only'] === 'true'
        ? report.admission?.length === report.required
        : report.verified.length === report.required) && !report.failures.length;
} catch (error) {
  report.error = String(error.stack ?? error);
} finally {
  await browser.close();
}
report.finished = new Date().toISOString();
await mkdir(new URL('../.cache/', import.meta.url), { recursive: true });
await writeFile(
  args.report ?? `.cache/solo-browser-${engine}.json`,
  JSON.stringify(report, null, 2) + '\n',
);
console.log(
  JSON.stringify({
    engine,
    complete: report.complete,
    verified: report.verified.length,
    variants: report.variants.length,
    performances: report.performances.length,
    failures: report.failures,
    error: report.error,
  }),
);
process.exitCode = report.complete ? 0 : 1;
