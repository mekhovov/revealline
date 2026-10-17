import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parse } from 'acorn';
import { fileURLToPath } from 'node:url';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Fixed authority relative to this module, never a plan-controlled path.
export const FPV_REPLAY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FPV_REPLAY_COMMON_INPUTS = Object.freeze([
  'game/data-json.mjs',
  'game/i18n/bootstrap.mjs',
  'game/i18n/catalogs.mjs',
  'game/i18n/index.mjs',
  'game/overflight/terrain.mjs',
  'game/overflight/world-layout-presentation.mjs',
  'game/overflight/worlds.mjs',
  'game/presentation/industrial-environments-data.mjs',
  'game/presentation/industrial-environments.mjs',
  'game/presentation/industrial-materials.mjs',
  'game/presentation/overflight-world-art-v2.mjs',
  'game/presentation/overflight-world-art.mjs',
  'game/presentation/overflight-world-slots.mjs',
  'game/presentation/theme-system.mjs',
  'game/snake/classic-structure-art.mjs',
  'game/vendor/i18next-26.4.2.min.js',
  'optional-practice/civilian-fpv/battlefield-ground.mjs',
  'optional-practice/civilian-fpv/catalogue.mjs',
  'optional-practice/civilian-fpv/flight-sectors.mjs',
  'optional-practice/civilian-fpv/math.mjs',
  'optional-practice/civilian-fpv/model.mjs',
  'optional-practice/civilian-fpv/radio-profile.mjs',
  'optional-practice/civilian-fpv/rotation-table.mjs',
  'optional-practice/civilian-fpv/world-themes.mjs',
]);
export function fpvReplayInputs(packageId) {
  assert(['civilian-fpv', 'fpv-worlds'].includes(packageId), 'Unsupported replay package.');
  return [
    ...FPV_REPLAY_COMMON_INPUTS,
    ...(packageId === 'fpv-worlds' ? ['optional-practice/civilian-fpv/world-records.mjs'] : []),
  ];
}
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const execute = promisify(execFile);
const LOCALE_PREFIX =
  '// Selected optional-practice validator and settings messages.\nglobalThis.RevealLineTranslations=';

export function assertFPVReplayImports(name, bytes, packageId) {
  const admitted = fpvReplayInputs(packageId);
  assert(admitted.includes(name), 'Unknown replay source.');
  const tree = parse(bytes.toString(), {
    ecmaVersion: 'latest',
    sourceType: 'module',
  });
  const pending = [tree];
  while (pending.length) {
    const node = pending.pop();
    assert(node.type !== 'ImportExpression', 'Dynamic replay imports are not admitted.');
    assert(
      !(node.type === 'CallExpression' && node.callee?.name === 'require'),
      'CommonJS replay dependencies are not admitted.',
    );
    if (
      ['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) &&
      node.source
    ) {
      const dependency = node.source.value;
      assert(
        typeof dependency === 'string' && dependency.startsWith('.'),
        'Only explicit relative dependencies are admitted.',
      );
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(name), dependency));
      assert(admitted.includes(resolved), `Unpinned replay dependency: ${resolved}`);
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) pending.push(...value.filter((child) => child?.type));
      else if (value?.type) pending.push(value);
    }
  }
}

const PROGRAM = `
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const [root,packageId,mode]=process.argv.slice(1);
const load=(name)=>import(pathToFileURL(root+'/'+name));
const {boundedJSON,canonicalJSON,dataIdentity,exactKeys}=await load('game/data-json.mjs');
const {FLIGHT_COURSES}=await load('optional-practice/civilian-fpv/catalogue.mjs');
const {replayFlight}=await load('optional-practice/civilian-fpv/model.mjs');
const {readAcademyRecording}=await load('optional-practice/civilian-fpv/world-themes.mjs');
const value=boundedJSON(await readFile(root+'/export.json','utf8'), {maxBytes:2097152,maxNodes:250000,maxArray:36000,maxDepth:16});
const course=FLIGHT_COURSES.find(row=>row.id==='flight-01');
let proof;
if(packageId==='civilian-fpv') {
  exactKeys(value,['format','packageId','attempts'],'native Academy backup');
  assert(['FlightProofBackup.v1','FlightProofBackup.v2'].includes(value.format));
  assert.equal(value.packageId,'civilian-fpv');
  assert(Array.isArray(value.attempts)&&value.attempts.length===1,'Require one newly completed practice attempt.');
  const recording=readAcademyRecording(value.attempts[0]);
  assert(value.format!=='FlightProofBackup.v1'||!recording.presentation,'Legacy backup cannot contain appearance.');
  proof=recording.proof;
} else {
  assert(['FPVProofArchive.v2','FPVProofArchive.v3'].includes(value.format));
  assert.equal(value.part,1); assert.equal(value.parts,1);
  assert(Array.isArray(value.records)&&value.records.length===1,'Require one newly completed Worlds recording.');
  const {importProofPart,exportProofParts}=await load('optional-practice/civilian-fpv/world-records.mjs');
  await importProofPart(value); // Production transport, record identity and appearance validation.
  const reproduced=await exportProofParts(value.records);
  assert.equal(reproduced.length,1);
  assert.deepEqual(value,reproduced[0],'Archive metadata, checksum or archive identity changed.');
  const record=value.records[0];
  assert.equal(record.status,'verified'); assert.equal(record.diagnostic,'complete');
  assert.equal(record.packIdentity,'fpv-academy:'+dataIdentity(FLIGHT_COURSES));
  assert.equal(canonicalJSON(record.course),canonicalJSON(course),'Course snapshot differs from frozen native first course.');
  assert(Number.isSafeInteger(record.byteLength)&&record.byteLength>0,'Invalid recorded byte length.');
  const {byteLength,...withoutLength}=record;
  assert.equal(byteLength,Buffer.byteLength(JSON.stringify(withoutLength))+64,'Invalid recorded byte length.');
  proof=record.proof;
}
assert.equal(proof.format,'FlightAttempt.v1');
assert.equal(proof.session,'practice'); assert.equal(proof.course,'flight-01'); assert.equal(proof.mode,mode);
assert(Array.isArray(proof.frames)&&proof.frames.length>0);
const replay=replayFlight(course,proof,{includeSectors:true});
assert.equal(replay.state.status,'complete','Export did not independently replay to completion.');
assert.equal(replay.state.step,2); assert.equal(replay.state.total,2); assert.equal(replay.state.position.y,0);
assert.deepEqual(replay.sectors.map(row=>row.index),[0,1]);
process.stdout.write(JSON.stringify({format:value.format,identity:replay.identity,state:replay.state,sectors:replay.sectors,frames:proof.frames.length}));
`;

export async function verifyFrozenFPVExercise(files, json, { packageId, mode } = {}) {
  const names = fpvReplayInputs(packageId);
  assert(['self-level', 'acro'].includes(mode), 'Unsupported replay mode.');
  assert(files instanceof Map, 'Admitted runtime members are required.');
  assert(
    typeof json === 'string' && Buffer.byteLength(json) <= 2 * 1024 * 1024,
    'Native export exceeds 2 MiB.',
  );
  JSON.parse(json);
  const inputs = [];
  const pinned = new Map();
  let total = 0;
  for (const name of names) {
    const member = files.get(name);
    assert(
      Buffer.isBuffer(member) && member.length <= 2 * 1024 * 1024,
      `Missing or excessive replay dependency: ${name}`,
    );
    total += member.length;
    assert(total <= 8 * 1024 * 1024, 'Replay closure exceeds its byte budget.');
    const frozen = Buffer.from(member);
    if (name === 'game/i18n/catalogs.mjs') {
      const text = frozen.toString();
      assert(text.startsWith(LOCALE_PREFIX) && text.endsWith(';\n'), 'Invalid locale projection.');
      const payload = text.slice(LOCALE_PREFIX.length, -2),
        locales = JSON.parse(payload);
      assert.equal(JSON.stringify(locales), payload, 'Locale projection must be JSON only.');
      assert.deepEqual(Object.keys(locales).sort(), ['en', 'uk']);
    } else
      assert.equal(
        sha(await readFile(path.join(FPV_REPLAY_ROOT, name))),
        sha(frozen),
        `Replay dependency differs: ${name}`,
      );
    assertFPVReplayImports(name, frozen, packageId);
    pinned.set(name, frozen);
    inputs.push({ path: name, bytes: frozen.length, sha256: sha(frozen) });
  }
  const work = await mkdtemp(path.join(tmpdir(), 'practice-fpv-exercise-replay-'));
  let replay;
  try {
    for (const name of names) {
      const destination = path.join(work, name);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, pinned.get(name), { flag: 'wx' });
    }
    await writeFile(path.join(work, 'package.json'), '{"type":"module"}', {
      flag: 'wx',
    });
    await writeFile(path.join(work, 'export.json'), json, { flag: 'wx' });
    const { stdout } = await execute(
      process.execPath,
      ['--max-old-space-size=128', '--input-type=module', '-e', PROGRAM, work, packageId, mode],
      {
        env: {},
        timeout: 10000,
        killSignal: 'SIGKILL',
        maxBuffer: 65536,
      },
    );
    replay = JSON.parse(stdout);
    for (const input of inputs)
      assert.equal(sha(await readFile(path.join(work, input.path))), input.sha256);
    assert.equal(sha(await readFile(path.join(work, 'export.json'))), sha(Buffer.from(json)));
  } finally {
    await rm(work, { recursive: true, force: true });
  }
  assert.equal(replay.state.status, 'complete');
  assert.equal(replay.state.step, 2);
  assert.equal(replay.state.total, 2);
  assert.equal(replay.state.position.y, 0);
  return {
    verified: true,
    qualified: false,
    packageId,
    mode,
    method: 'Independent off-browser replay of the actual native UI proof export',
    isolation:
      'Fresh bounded Node child; exact admitted/current executable closure; JSON-only locales; env {}',
    exportSha256: sha(Buffer.from(json)),
    inputs,
    ...replay,
  };
}
