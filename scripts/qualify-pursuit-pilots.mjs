import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { canonicalJSON, dataIdentity } from '../game/data-json.mjs';
import { createPursuitPilotCandidates } from '../game/content-design/pursuit-pilot-candidates.mjs';
import { createContentExecutionCatalog } from '../game/content-design/execution.mjs';
import { compileContentProject } from '../game/content-design/project.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../game/gameplay-tuning.mjs';
import { createRecorder, snapshotReplay, verifyReplay } from '../game/replay.mjs';
import { createCoop } from '../game/coop/core.mjs';
import { UNTIMED_DUEL_PROTOCOL } from '../game/multiplayer.mjs';
import {
  localMatchProvenance,
  snapshotLocalMatchRecording,
  verifyLocalMatchRecordingAsync,
} from '../game/multiplayer-recording.mjs';
import { snapshotReplayPresentation } from '../game/replay-presentation.mjs';
import { CLASSIC_SNAKE_V3_LEVELS } from '../game/snake/classic-catalogue-v3.mjs';
import { prepareClassicSnakeLevel } from '../game/snake/classic-setup.mjs';
import { validateClassicSnakeLevel } from '../game/snake/classic-core.mjs';
import {
  restoreClassicSnakeMatch,
  classicSnakeMatchSummary,
} from '../game/snake/classic-match.mjs';
import {
  CLASSIC_PACKAGE_FORMAT,
  exportClassicSnakePackage,
  importClassicSnakePackage,
} from '../game/snake/classic-community.mjs';
import { EXPRESSIVE_HUNT_COURSES } from '../optional-practice/civilian-fpv/expressive-hunt-courses.mjs';
import {
  validateWorldCourse,
  replayWorldFlight,
} from '../optional-practice/civilian-fpv/world-model.mjs';
import {
  resolveProject,
  preparePack,
  inspectPack,
} from '../optional-practice/civilian-fpv/world-content.mjs';
import {
  exportEditableZip,
  importEditableZip,
} from '../optional-practice/civilian-fpv/world-zip.mjs';
import { importProofPart } from '../optional-practice/civilian-fpv/world-records.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = (value) => createHash('sha256').update(value).digest('hex');
const check = (condition, message) => {
  if (!condition) throw new Error(message);
};
const same = (a, b) => canonicalJSON(a) === canonicalJSON(b);
const snakeIds = ['classic-living-cable-cutoff', 'classic-living-shield-window'];
const simId = 'snake-hunt-ground-routes-low-pass-depot';
const pending = {
  humanPlay: 'pending',
  deviceAndAccessibility: 'pending',
  publicRelease: 'not-qualified',
};
const sourceStamp = () => ({
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  dirty: !!execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim(),
});
const recipe = (level) => ({
  format: level.version ?? level.format,
  identity: dataIdentity(level),
  sha256: hash(canonicalJSON(level)),
});

/** Compiler admission only: no input generation or simulation stepping. */
export function pursuitPilotCases() {
  const cases = [];
  for (const team of [false, true]) {
    const source = createPursuitPilotCandidates({ team });
    for (const mode of team ? ['team'] : ['solo', 'versus']) {
      const catalog = createContentExecutionCatalog(source, { mode });
      for (const entry of catalog.entries)
        for (const level of entry.campaign.levels) {
          const accepted = applyGameplayTuning(level, resolveGameplayTuning(entry.difficulty));
          const options = { seed: team ? 17 : 1, classId: 'scout', turnPolicy: 'immediate' };
          const recorder = mode !== 'team' ? createRecorder(accepted, options) : null;
          const teamRun = mode === 'team' ? createCoop(accepted, { seed: options.seed }) : null;
          cases.push({
            pilot: level.id,
            family: 'capture',
            mode,
            pace: entry.difficulty,
            seed: options.seed,
            level: recorder?.level ?? accepted,
            options: recorder?.options ?? {
              seed: teamRun.seed,
              difficulty: teamRun.difficulty,
              ...teamRun.config,
            },
            ...(mode === 'versus' ? { duel: { protocol: UNTIMED_DUEL_PROTOCOL, seconds: 0 } } : {}),
            ...(mode !== 'solo'
              ? {
                  recordingProvenance: localMatchProvenance(
                    level,
                    team ? { packageIdentity: dataIdentity(entry.campaign) } : {},
                  ),
                }
              : {}),
            source: source.id,
            revision: source.revision,
            launch: `/game/${team ? 'couch/relay-rescue.html' : mode === 'versus' ? 'couch/' : ''}?journey=pursuit-pilots-v1&lang=en`,
            launchKind: 'campaign-entry-requires-selection',
            beforeStart: `Select mission ${level.id}, difficulty ${entry.difficulty} and authored encounters. Start a fresh attempt; do not Continue a saved cursor. ${mode === 'team' ? 'Use the Full cooperation configuration and seed 17.' : 'Use Scout with immediate turns and seed 1.'} ${mode === 'versus' ? 'Keep the native untimed authored race; export one finished round.' : ''}`,
            recording: mode === 'solo' ? 'native-solo-replay' : 'native-local-capture-terminal',
          });
        }
    }
  }
  for (const id of snakeIds)
    for (const mode of ['solo', 'versus', 'team'])
      for (const pace of ['slow', 'normal', 'fast']) {
        const entry = CLASSIC_SNAKE_V3_LEVELS.find((item) => item.id === id);
        const level = validateClassicSnakeLevel(
          prepareClassicSnakeLevel(entry, {
            pace,
            format: 'campaign',
            targetRules: 'authored',
            preset: 'classic',
          }),
        );
        cases.push({
          pilot: id,
          family: 'snake',
          mode,
          pace,
          seed: 17,
          level,
          source: entry.chapterId,
          revision: level.revision,
          launch: `/game/snake/play.html?mode=${mode}&level=${id}&activity=campaign&targets=authored&board=retro&pace=${pace}&seed=17&lang=en`,
          launchKind: 'pinned-preparation',
          beforeStart: 'Confirm the shown mission, pace and authored target rules, then Start.',
          recording: 'native-snake-session',
        });
      }
  const course = validateWorldCourse(EXPRESSIVE_HUNT_COURSES.find((item) => item.id === simId));
  for (const mode of ['self-level', 'acro'])
    cases.push({
      pilot: simId,
      family: 'sim',
      mode,
      pace: 'native',
      seed: course.rules.seed,
      level: course,
      source: 'civilian-fpv',
      revision: course.revision,
      launch: `/optional-practice/civilian-fpv/worlds.html?snake-course=${simId}&lang=en`,
      launchKind: 'course-entry-requires-flight-mode',
      beforeStart: `Select ${mode} flight mode and Low Pass Depot, then start a fresh attempt.`,
      recording: 'native-world-proof',
    });
  return cases;
}

export async function preparePursuitPilotPacket(directory) {
  const cases = pursuitPilotCases(),
    files = [];
  await mkdir(directory, { recursive: true });
  async function save(name, value) {
    const bytes =
      value instanceof Blob
        ? Buffer.from(await value.arrayBuffer())
        : Buffer.from(JSON.stringify(value, null, 2) + '\n');
    await writeFile(path.join(directory, name), bytes);
    files.push({ name, bytes: bytes.length, sha256: hash(bytes) });
  }
  for (const team of [false, true]) {
    const source = createPursuitPilotCandidates({ team });
    check(
      same(
        compileContentProject(JSON.parse(JSON.stringify(source))).source,
        compileContentProject(source).source,
      ),
      'Capture source round-trip differs.',
    );
    await save(`capture-${team ? 'team' : 'solo'}.json`, source);
  }
  const snakeSource = {
    format: CLASSIC_PACKAGE_FORMAT,
    title: { en: 'Living Routes pilots', uk: 'Пілотні Живі маршрути' },
    entries: snakeIds.map((id) => {
      const { title, description, level } = CLASSIC_SNAKE_V3_LEVELS.find(
        (entry) => entry.id === id,
      );
      return { title, description, level };
    }),
  };
  const snake = exportClassicSnakePackage(snakeSource);
  const importedSnake = await importClassicSnakePackage(snake);
  check(
    same(importedSnake, await importClassicSnakePackage(exportClassicSnakePackage(importedSnake))),
    'Snake source identity differs.',
  );
  await save('snake-pilots.rlsnake.json', snake);
  const course = cases.find((item) => item.family === 'sim').level;
  const project = resolveProject({
    format: 'FPVWorldProject.v1',
    id: 'pursuit-pilot-low-pass-depot',
    title: 'Low Pass Depot pilot',
    world: { id: course.world.id, title: 'Low Pass Depot' },
    courses: [course],
  });
  const pack = await preparePack(project),
    zip = await exportEditableZip(project);
  check(same((await inspectPack(pack)).project, project), 'World package round-trip differs.');
  check(
    same((await importEditableZip(zip)).project, project),
    'World editable ZIP round-trip differs.',
  );
  await save('low-pass-depot.rlpack', pack);
  await save('low-pass-depot.zip', zip);
  const manifest = {
    format: 'pursuit-pilot-packet.v1',
    source: sourceStamp(),
    scope:
      'Native source admission and programmatic format round-trips only. No gameplay route or human/device qualification is supplied.',
    files,
    pilots: [...new Set(cases.map((item) => item.pilot))],
    cases: cases.map(({ level, options, ...item }) => ({
      ...item,
      recipe: recipe(level),
      ...(options ? { options } : {}),
      demonstratedCompletionRoute: null,
      ...pending,
    })),
  };
  await writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

/** Verify an actual exported recording. The native validator reconstructs the outcome;
 * imported positions, self-attested clears and packet identities are never authoritative. */
export async function verifyPursuitPilotRecording({ pilot, mode, pace, recording }) {
  const entry = pursuitPilotCases().find(
    (item) => item.pilot === pilot && item.mode === mode && item.pace === pace,
  );
  check(entry, 'Unknown pilot/mode/pace. Prepare the packet for accepted cases.');
  let outcome;
  if (entry.family === 'capture' && mode !== 'solo') {
    const replay = snapshotLocalMatchRecording(recording);
    check(
      replay.recipe.mode === mode && same(replay.recipe.level, entry.level),
      'Recording differs from the pinned Capture recipe or mode.',
    );
    check(
      same(replay.recipe.options, entry.options) && same(replay.recipe.duel, entry.duel ?? null),
      'Recording seed, cooperation or race rules differ from the pinned Capture case.',
    );
    check(
      same(replay.recipe.provenance, entry.recordingProvenance),
      'Recording source ownership or revision differs from the pinned Capture case.',
    );
    const verified = await verifyLocalMatchRecordingAsync(replay);
    check(
      verified.match,
      verified.terminalObservationMatch === null
        ? 'Recording does not match its full native terminal state; completion qualification requires an exact replay match.'
        : 'Recording does not match its declared terminal observations; completion qualification requires an observation match.',
    );
    const completedBoards =
      mode === 'team'
        ? verified.state.status === 'won'
          ? [1]
          : []
        : verified.state.runs.flatMap((run, index) => (run.status === 'won' ? [index + 1] : []));
    check(
      completedBoards.length > 0,
      'No native board completed the mission; timer or collision wins are not completion routes.',
    );
    outcome = {
      summary: verified.actual.summary,
      ticks: verified.ticks,
      recordedBuild: verified.recordedBuild,
      completedBoards,
      recipeSha256: verified.recipeSha256,
      provenance: verified.recipe.provenance,
      authority: verified.authority,
      verificationScope: verified.verificationScope,
      exactStateMatch: verified.exactStateMatch,
      terminalObservationMatch: verified.terminalObservationMatch,
      ...(verified.actual.observationSha256
        ? { observationSha256: verified.actual.observationSha256 }
        : {}),
    };
  } else if (entry.family === 'capture') {
    const source = recording.format?.startsWith('revealline-replay-presentation.')
      ? snapshotReplayPresentation(recording).replay
      : recording;
    const replay = snapshotReplay(source);
    check(same(replay.level, entry.level), 'Recording differs from the pinned Capture recipe.');
    check(
      same(replay.options, entry.options),
      'Recording seed, class or turn policy differs from the pinned Capture case.',
    );
    const verified = verifyReplay(replay);
    check(
      verified.match && verified.state.status === 'won',
      'Recording does not verify a completed mission.',
    );
    outcome = {
      summary: verified.actual.summary,
      ticks: verified.ticks,
      recordedBuild: verified.recordedBuild,
    };
  } else if (entry.family === 'snake') {
    check(
      recording.format === 'revealline-classic-snake-session.v2',
      'Export the native Snake session from Workshop.',
    );
    check(
      recording.levelId === pilot &&
        recording.mode === mode &&
        recording.pace === pace &&
        recording.seed === entry.seed &&
        recording.activity === 'campaign' &&
        recording.targetRules === 'authored' &&
        recording.preset === 'classic',
      'Recording metadata or seed differs from the pinned Snake case.',
    );
    const match = restoreClassicSnakeMatch(recording.match, { level: entry.level });
    check(
      match.options.mode === mode &&
        match.options.seed === entry.seed &&
        match.options.policy === 'mission',
      'Recording match rules differ from the pinned Snake case.',
    );
    const summary = classicSnakeMatchSummary(match);
    const completedBoards = summary.boards.flatMap((board, index) =>
      board.status === 'won' ? [index + 1] : [],
    );
    check(
      match.status !== 'running' && completedBoards.length > 0,
      'No board completed the authored mission; a duel won through a collision is not a completion route.',
    );
    outcome = { summary, completedBoards };
  } else {
    let proof = recording;
    if (recording.format?.startsWith('FPVProofArchive.')) {
      const matching = (await importProofPart(recording)).filter(
        (record) => record.proof.course === pilot && record.proof.mode === mode,
      );
      check(
        matching.length === 1,
        'Export exactly one matching World recording per qualification receipt.',
      );
      proof = matching[0].proof;
    }
    check(
      proof.course === pilot && proof.mode === mode,
      'Recording flight course or mode differs.',
    );
    const verified = await replayWorldFlight(entry.level, proof);
    check(
      verified.state.status === 'complete',
      'Recording does not complete the pinned native course.',
    );
    outcome = {
      identity: verified.identity,
      responseIdentity: proof.responseIdentity,
      finalStateIdentity: proof.finalStateIdentity,
      frames: proof.frames.length,
      status: verified.state.status,
    };
  }
  return {
    format:
      outcome.terminalObservationMatch === true
        ? 'pursuit-pilot-recording-receipt.v2'
        : 'pursuit-pilot-recording-receipt.v1',
    source: sourceStamp(),
    pilot,
    mode,
    pace,
    seed: entry.seed,
    recipe: recipe(entry.level),
    recordingSha256: hash(canonicalJSON(recording)),
    verification:
      outcome.terminalObservationMatch === true
        ? 'native-terminal-observation-completion'
        : 'native-replay-completion',
    outcome,
    ...pending,
    scope:
      (outcome.terminalObservationMatch === true
        ? 'Only declared terminal gameplay observations are required to match; exactStateMatch separately reports the raw state digest. This is not a resumable checkpoint or proof of cross-device deterministic simulation. '
        : '') +
      'Replay integrity is not an author signature, proof of human input, device qualification or release approval.',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'prepare' && args.length === 1) {
    const report = await preparePursuitPilotPacket(path.resolve(args[0]));
    console.log(
      JSON.stringify(
        {
          source: report.source,
          pilots: report.pilots.length,
          cases: report.cases.length,
          files: report.files,
          manifest: path.resolve(args[0], 'manifest.json'),
        },
        null,
        2,
      ),
    );
  } else if (command === 'verify' && args.length === 4) {
    const [pilot, mode, pace, file] = args;
    const size = (await stat(file)).size;
    check(size > 0 && size <= 34 * 1024 * 1024, 'Recording exceeds the input byte bound.');
    const text = await readFile(file, 'utf8');
    check(Buffer.byteLength(text) <= 34 * 1024 * 1024, 'Recording exceeds the input byte bound.');
    console.log(
      JSON.stringify(
        await verifyPursuitPilotRecording({ pilot, mode, pace, recording: JSON.parse(text) }),
        null,
        2,
      ),
    );
  } else
    throw new Error(
      'Use: qualify-pursuit-pilots.mjs prepare <directory> | verify <pilot-id> <mode> <pace> <recording.json>',
    );
}
