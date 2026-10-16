import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
assert(
  args.length === 2 && args[0] === '--out',
  'Usage: node scripts/convert-fpv-adventure-examples.mjs --out NEW_DIRECTORY',
);
const output = path.resolve(args[1]);
const expected = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString().trim();
const sha = (b) => createHash('sha256').update(b).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 16 * 1024 * 1024 });
const checks = [],
  results = [],
  roundTrips = [],
  archives = [];
const receipt = {
  format: 'FPVAdventureOptionalConversion.v1',
  startedAt: new Date().toISOString(),
  output,
  candidate: git('rev-parse', 'HEAD').toString().trim(),
  checks,
  results,
  roundTrips,
  archives,
};
const check = (name, value, details) => {
  checks.push({ name, passed: !!value, ...(details === undefined ? {} : { details }) });
  assert(value, name);
};
await mkdir(output);
try {
  check('expected main source', receipt.candidate === expected);
  const info = JSON.parse(
      await readFile(root + 'docs/evidence/fpv-adventures-proof-archive-20261002.json'),
    ),
    historical = JSON.parse(
      await readFile(root + 'docs/evidence/fpv-adventures-physics-20261002.json'),
    ),
    archive = await readFile(
      root + 'authoring/fpv-worlds/demonstrations/adventures-qualification.zip',
    );
  // This decoder accepts only the hash-pinned retained authoring ZIP, never arbitrary imports.
  assert(
    archive.length === 493982 &&
      sha(archive) === '273a68519c195f8f0ca001ce42497a28e288cf2710cc7fcb84c120003d6a2db2',
    'exact retained authoring ZIP',
  );
  const members = new Map();
  let offset = 0,
    total = 0;
  while (archive.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(archive.readUInt16LE(offset + 6), 0);
    assert.equal(archive.readUInt16LE(offset + 8), 8);
    const compressed = archive.readUInt32LE(offset + 18),
      size = archive.readUInt32LE(offset + 22),
      nameSize = archive.readUInt16LE(offset + 26),
      extra = archive.readUInt16LE(offset + 28),
      name = archive.subarray(offset + 30, offset + 30 + nameSize).toString(),
      start = offset + 30 + nameSize + extra;
    assert(size <= 1024 * 1024 && members.size < 61 && !members.has(name));
    const bytes = inflateRawSync(archive.subarray(start, start + compressed), {
      maxOutputLength: 1024 * 1024,
    });
    assert.equal(bytes.length, size);
    total += size;
    assert(total < 5 * 1024 * 1024);
    members.set(name, bytes);
    offset = start + compressed;
  }
  assert.equal(members.size, 61);
  const manifestBytes = members.get('manifest.json'),
    manifest = JSON.parse(manifestBytes);
  assert.equal(sha(manifestBytes), info.manifestSha256);
  const inputs = {
    archiveSha256: sha(archive),
    manifestSha256: sha(manifestBytes),
    manifest,
    files: manifest.recordings.map((r) => {
      const bytes = members.get(r.file);
      assert(bytes && bytes.length === r.bytes && sha(bytes) === r.sha256);
      return { path: r.file, bytes: bytes.length, sha256: sha(bytes), text: bytes.toString() };
    }),
  };
  check(
    'whole retained authoring ZIP exact',
    archive.length === info.archiveBytes &&
      sha(archive) === info.archiveSha256 &&
      inputs.archiveSha256 === info.archiveSha256,
  );
  check(
    'manifest and all60 member references pinned',
    inputs.manifestSha256 === info.manifestSha256 &&
      inputs.files.length === 60 &&
      inputs.manifest.recordings.length === 60,
  );
  receipt.authoringArchive = {
    bytes: archive.length,
    sha256: sha(archive),
    manifestSha256: info.manifestSha256,
  };
  const sources = {};
  for (const p of [
    ...git('ls-files', 'optional-practice/civilian-fpv').toString().trim().split('\n'),
    'game/data-json.mjs',
    'game/presentation/theme-system.mjs',
  ]) {
    const b = await readFile(root + p);
    check('committed current input ' + p, b.equals(git('show', expected + ':' + p)));
    sources[p] = { bytes: b.length, sha256: sha(b) };
  }
  receipt.sources = sources;
  const { WORLD_CATALOGUE, ADVENTURE_IDENTITY } = await import(
      pathToFileURL(root + 'optional-practice/civilian-fpv/world-catalogue.mjs')
    ),
    { WORLD_DEMONSTRATIONS } = await import(
      pathToFileURL(root + 'optional-practice/civilian-fpv/world-demonstrations.mjs')
    ),
    { FLIGHT_DEMONSTRATIONS } = await import(
      pathToFileURL(root + 'optional-practice/civilian-fpv/demonstrations.mjs')
    ),
    { initWorldRuntime, replayWorldFlight, validateWorldCourse, worldStateIdentity } = await import(
      pathToFileURL(root + 'optional-practice/civilian-fpv/world-model.mjs')
    ),
    { worldRecordIdentity, exportProofParts, importProofPart, WORLD_RECORD_LIMITS } = await import(
      pathToFileURL(root + 'optional-practice/civilian-fpv/world-records.mjs')
    ),
    { dataIdentity } = await import(pathToFileURL(root + 'game/data-json.mjs')),
    { default: RAPIER } = await import(
      pathToFileURL(root + 'optional-practice/civilian-fpv/vendor/rapier/rapier.mjs')
    );
  receipt.bundled = {
    world: WORLD_DEMONSTRATIONS.length,
    legacy: FLIGHT_DEMONSTRATIONS.length,
    total: WORLD_DEMONSTRATIONS.length + FLIGHT_DEMONSTRATIONS.length,
  };
  check(
    'original178 bundled registry entries retained',
    receipt.bundled.world === 154 && receipt.bundled.legacy === 24,
  );
  check(
    'exact Adventure pack identity',
    ADVENTURE_IDENTITY === info.packIdentity && ADVENTURE_IDENTITY === inputs.manifest.packIdentity,
  );
  const courses = WORLD_CATALOGUE.filter((row) => row.packIdentity === ADVENTURE_IDENTITY),
    pairs = new Set(
      inputs.files.map((f) => {
        const r = JSON.parse(f.text);
        return r.id + '/' + r.mode;
      }),
    );
  check(
    'exactly30current courses and both modes',
    courses.length === 30 &&
      pairs.size === 60 &&
      courses.every((e) => ['acro', 'self-level'].every((mode) => pairs.has(e.id + '/' + mode))),
  );
  await initWorldRuntime();
  const worlds = new Map(),
    oldCreate = RAPIER.World.prototype.createCollider,
    oldFree = RAPIER.World.prototype.free;
  let peak = 0;
  RAPIER.World.prototype.createCollider = function (...args) {
    if (!worlds.has(this)) worlds.set(this, { colliders: 0, freeCalls: 0 });
    const value = Reflect.apply(oldCreate, this, args);
    worlds.get(this).colliders++;
    peak = Math.max(peak, [...worlds.values()].filter((r) => !r.freeCalls).length);
    return value;
  };
  RAPIER.World.prototype.free = function (...args) {
    const row = worlds.get(this);
    assert(row, 'known collision owner');
    row.freeCalls++;
    assert.equal(row.freeCalls, 1);
    return Reflect.apply(oldFree, this, args);
  };
  const records = [];
  async function replay(record, label, list) {
    const prior = historical.results.find(
      (r) => r.id === record.course.id && r.mode === record.proof.mode,
    );
    const before = worlds.size,
      proofHash = sha(JSON.stringify(record.proof)),
      run = await replayWorldFlight(record.course, record.proof, {
        sampleEvery: 50,
        yieldControl: async () => {},
      }),
      state = run.state;
    check(
      label + ' complete/exact final identity',
      state.status === 'complete' &&
        state.step === state.total &&
        state.ticks === record.proof.frames.length &&
        worldStateIdentity(state) === record.proof.finalStateIdentity,
    );
    check(
      label + ' exact runtime/world/course/rules/response/conditions identities',
      Object.entries(run.identity).every(([k, v]) => record.proof[k] === v),
    );
    check(
      label + ' original health/contact/weapon outcomes',
      ['contacts', 'health', 'maxHealth', 'shots', 'hits'].every((k) => state[k] === prior[k]),
    );
    check(
      label + ' proof remains byte-identical',
      sha(JSON.stringify(record.proof)) === proofHash && proofHash === prior.proofSha256,
    );
    check(
      label + ' one actual collision world freed once',
      worlds.size === before + 1 && [...worlds.values()].every((r) => r.freeCalls === 1),
    );
    list.push({
      id: record.course.id,
      mode: record.proof.mode,
      ticks: state.ticks,
      proofSha256: proofHash,
      finalStateIdentity: worldStateIdentity(state),
      contacts: state.contacts,
      health: state.health,
      maxHealth: state.maxHealth,
      shots: state.shots,
      hits: state.hits,
      blockedFinalActors: state.actors.filter((a) => a.blocked).length,
      sourceIdentity: dataIdentity(record.course),
      pathSamples: run.path.length,
      pathSampleSha256: sha(JSON.stringify(run.path)),
    });
  }
  try {
    for (const f of inputs.files) {
      const row = JSON.parse(f.text),
        entry = courses.find((e) => e.id === row.id),
        m = inputs.manifest.recordings.find((r) => r.file === f.path),
        b = Buffer.from(f.text),
        label = row.id + '/' + row.mode;
      check(
        label + ' authenticated original bytes',
        !!m &&
          b.length === f.bytes &&
          b.length === m.bytes &&
          sha(b) === f.sha256 &&
          sha(b) === m.sha256,
      );
      check(
        label + ' original demonstration session',
        row.proof.session === 'demonstration' &&
          row.proof.mode === row.mode &&
          row.proof.course === row.id,
      );
      const course = validateWorldCourse(entry.course);
      check(
        label + ' exact normalized source and pack',
        dataIdentity(course) === row.sourceIdentity &&
          row.sourceIdentity === m.sourceIdentity &&
          row.packIdentity === ADVENTURE_IDENTITY,
      );
      const record = {
        id: worldRecordIdentity({ course, proof: row.proof }),
        course,
        proof: row.proof,
        packIdentity: row.packIdentity,
        status: 'verified',
        diagnostic: 'complete',
        savedAt: 0,
        pinned: false,
      };
      await replay(record, label, results);
      records.push(record);
    }
    check(
      'original60 replays total253011ticks',
      results.length === 60 && results.reduce((n, r) => n + r.ticks, 0) === 253011,
    );
    const parts = await exportProofParts(records),
      again = await exportProofParts(records);
    check('optional export deterministic', JSON.stringify(parts) === JSON.stringify(again));
    let importedCount = 0;
    for (let index = 0; index < parts.length; index++) {
      const part = parts[index],
        text = JSON.stringify(part) + '\n',
        name =
          parts.length === 1
            ? 'adventures-v1.json'
            : 'adventures-v1-part-' + String(index + 1).padStart(2, '0') + '.json',
        imported = await importProofPart(text);
      check(
        name + ' resets all verification flags',
        imported.every((r) => r.status === 'missing-dependency'),
      );
      check(
        name + ' byte/record caps intact',
        Buffer.byteLength(text) <= WORLD_RECORD_LIMITS.archiveBytes &&
          imported.length <= WORLD_RECORD_LIMITS.archiveRecords,
      );
      for (const record of imported) {
        check(record.id + ' identity after transport', record.id === worldRecordIdentity(record));
        await replay(record, record.course.id + '/' + record.proof.mode + '/roundtrip', roundTrips);
      }
      await writeFile(output + '/' + name, text, { flag: 'wx' });
      importedCount += imported.length;
      archives.push({
        file: name,
        format: part.format,
        part: part.part,
        parts: part.parts,
        records: part.records.length,
        bytes: Buffer.byteLength(text),
        sha256: sha(text),
        archiveId: part.archiveId,
        payloadSha256: part.sha256,
      });
    }
    check(
      'all60 imported and independently replayed',
      importedCount === 60 &&
        roundTrips.length === 60 &&
        JSON.stringify(results) === JSON.stringify(roundTrips),
    );
    check(
      '120 collision worlds exactly once; peak1',
      worlds.size === 120 && peak === 1 && [...worlds.values()].every((r) => r.freeCalls === 1),
    );
    receipt.physics = {
      created: worlds.size,
      freed: [...worlds.values()].filter((r) => r.freeCalls === 1).length,
      peakLive: peak,
      liveAfter: 0,
    };
  } finally {
    RAPIER.World.prototype.createCollider = oldCreate;
    RAPIER.World.prototype.free = oldFree;
  }
  for (const [p, b] of Object.entries(sources))
    check('unchanged after conversion ' + p, sha(await readFile(root + p)) === b.sha256);
  receipt.passed = true;
  receipt.summary = {
    courses: 30,
    records: records.length,
    parts: archives.length,
    bytes: archives.reduce((n, r) => n + r.bytes, 0),
    firstReplayTicks: 253011,
    roundTripTicks: 253011,
    contacts: results.reduce((n, r) => n + r.contacts, 0),
    fullHealth: results.filter((r) => r.health === r.maxHealth).length,
    partialHealth: results.filter((r) => r.health !== r.maxHealth),
  };
  receipt.limits = WORLD_RECORD_LIMITS;
  receipt.limitations = [
    'Data-only audit on frozen current main. No production/core registry mutation, unit coverage, hardware-performance or public availability claim.',
    'Preserves original completed laser-duel outcomes, including six examples with reduced health; no perfect-run claim.',
    'Every import resets verification status; actual player must independently replay before offering the optional demonstration.',
    'One-second path observations are not continuous swept-clearance evidence. Native browser storage/menu/playback qualification remains pending.',
  ];
} catch (error) {
  receipt.passed = false;
  receipt.error = String(error.stack ?? error);
  process.exitCode = 1;
}
receipt.finishedAt = new Date().toISOString();
receipt.probeSha256 = sha(await readFile(new URL(import.meta.url)));
await writeFile(output + '/conversion-receipt.json', JSON.stringify(receipt, null, 2) + '\n', {
  flag: 'wx',
});
console.log(
  JSON.stringify({
    passed: receipt.passed,
    checks: checks.length,
    summary: receipt.summary,
    physics: receipt.physics,
    archives,
    error: receipt.error,
    receipt: output + '/conversion-receipt.json',
  }),
);
