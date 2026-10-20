import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createReadStream } from 'node:fs';
import {
  readFile,
  writeFile,
  open,
  mkdir,
  lstat,
  readdir,
  readlink,
  realpath,
  statfs,
  rm,
} from 'node:fs/promises';
import { dirname, join, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ownedCommand } from './run-solo-remote-correctness.mjs';
import { encodePagesReport, redactPagesText } from './solo-pages-smoke.mjs';
import {
  TARGET,
  assertArtifact,
  assertSignedArtifactURL,
  assertOwner,
  assertBrowserReport,
} from './compiled-menu-browser-contract.mjs';

const MiB = 1024 ** 2,
  GiB = 1024 ** 3;
const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const totalDeadline = Date.now() + 30 * 60000;
const sha = (b) => createHash('sha256').update(b).digest('hex');
const password = process.env.REVEALLINE_PAGES_TEST_PASSWORD;
const cleanEnv = () =>
  Object.fromEntries(
    ['PATH', 'HOME', 'LANG', 'LC_ALL', 'DISPLAY', 'XAUTHORITY', 'LD_LIBRARY_PATH'].flatMap((k) =>
      process.env[k] === undefined ? [] : [[k, process.env[k]]],
    ),
  );
async function digest(file) {
  const h = createHash('sha256');
  let bytes = 0;
  for await (const b of createReadStream(file)) {
    h.update(b);
    bytes += b.length;
    assert(Date.now() < totalDeadline);
  }
  return { bytes, sha256: h.digest('hex') };
}
const git = (...args) =>
  execFileSync('git', ['--no-replace-objects', ...args], {
    cwd: repository,
    env: { ...cleanEnv(), GIT_NO_LAZY_FETCH: '1', GIT_OPTIONAL_LOCKS: '0' },
    timeout: 15000,
    maxBuffer: 16 * MiB,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
async function floor(root) {
  assert(Date.now() < totalDeadline, 'Total consumer deadline');
  const fs = await statfs(root);
  assert(Number(fs.bavail) * Number(fs.bsize) > 2 * GiB, 'Consumer disk reserve');
}
// No links are followed. Dependency link identities/text are bound as well as
// every regular-file byte. Profile sockets/links are tolerated only by the live
// allocation counter, never by an immutable package/dependency inventory.
async function inventory(root, links = false) {
  const rows = [];
  const walk = async (dir) => {
    await floor(root);
    for (const name of (await readdir(dir)).sort()) {
      assert(rows.length < 30000, 'Inventory member cap');
      const p = join(dir, name),
        s = await lstat(p);
      const row = { path: relative(root, p), dev: s.dev, ino: s.ino, mode: s.mode, bytes: s.size };
      if (s.isSymbolicLink()) {
        assert(links);
        row.link = await readlink(p);
      } else if (s.isDirectory()) {
        rows.push(row);
        await walk(p);
        continue;
      } else {
        assert(s.isFile(), 'Immutable inventory regular file');
        row.sha256 = (await digest(p)).sha256;
      }
      const after = await lstat(p);
      assert.equal(after.dev, s.dev);
      assert.equal(after.ino, s.ino);
      assert.equal(after.size, s.size);
      assert.equal(after.mtimeMs, s.mtimeMs);
      rows.push(row);
    }
  };
  await walk(root);
  return rows;
}
async function liveBytes(root) {
  let bytes = 0,
    members = 0;
  const walk = async (dir) => {
    for (const name of await readdir(dir)) {
      assert(++members <= 30000, 'Owned allocation members');
      const p = join(dir, name);
      let s;
      try {
        s = await lstat(p);
      } catch (e) {
        if (e.code === 'ENOENT') continue;
        throw e;
      }
      bytes += Math.max(s.size, s.blocks * 512) + 4096;
      if (s.isDirectory() && !s.isSymbolicLink()) {
        try {
          await walk(p);
        } catch (e) {
          if (e.code !== 'ENOENT') throw e;
        }
      }
    }
  };
  await walk(root);
  assert(bytes <= 8 * GiB, 'Owned allocation cap');
  return { bytes, members };
}
const save = (p, value) =>
  writeFile(p, encodePagesReport(value, password, 4 * MiB), { flag: 'wx', mode: 0o600 });
async function readSmall(p, maximum = 4 * MiB) {
  const s = await lstat(p);
  assert(s.isFile() && !s.isSymbolicLink() && s.size <= maximum);
  return JSON.parse(await readFile(p, 'utf8'));
}
async function metadata(path) {
  assert(path.startsWith('/repos/mekhovov/revealline/'));
  const response = await fetch('https://api.github.com' + path, {
    redirect: 'error',
    signal: AbortSignal.timeout(30000),
    headers: {
      Authorization: 'Bearer ' + process.env.GH_TOKEN,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  assert.equal(response.status, 200, 'GitHub metadata HTTP');
  const reader = response.body.getReader();
  let n = 0;
  const parts = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      n += value.length;
      assert(n <= MiB, 'Metadata byte cap');
      parts.push(Buffer.from(value));
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return JSON.parse(Buffer.concat(parts).toString('utf8'));
}
async function download(file, root) {
  // A read-only API token goes ONLY to api.github.com. The signed blob receives
  // no credential header and its complete query is never retained in evidence.
  const r = await fetch(
    'https://api.github.com/repos/mekhovov/revealline/actions/artifacts/' +
      TARGET.artifact +
      '/zip',
    {
      redirect: 'manual',
      signal: AbortSignal.timeout(30000),
      headers: {
        Authorization: 'Bearer ' + process.env.GH_TOKEN,
        Accept: 'application/vnd.github+json',
      },
    },
  );
  assert.equal(r.status, 302);
  const signed = assertSignedArtifactURL(r.headers.get('location'));
  const body = await fetch(signed, { redirect: 'error', signal: AbortSignal.timeout(300000) });
  assert.equal(body.status, 200);
  assert.equal(Number(body.headers.get('content-length')), TARGET.outerBytes);
  const h = createHash('sha256'),
    f = await open(file, 'wx', 0o600);
  let bytes = 0,
    next = 0;
  try {
    for await (const chunk of body.body) {
      bytes += chunk.length;
      assert(bytes <= TARGET.outerBytes, 'Outer artifact length overflow');
      h.update(chunk);
      await f.writeFile(chunk);
      if (Date.now() >= next) {
        await floor(root);
        next = Date.now() + 1000;
      }
    }
    await f.sync();
  } finally {
    await f.close();
  }
  const result = { bytes, sha256: h.digest('hex') };
  assert.deepEqual(result, { bytes: TARGET.outerBytes, sha256: TARGET.outerSha256 });
  assert.deepEqual(await digest(file), result);
  return result;
}
async function run() {
  assert.equal(process.argv.length, 2, 'No consumer command arguments');
  assert.equal(process.platform, 'linux');
  assert.equal(process.arch, 'x64');
  assert.equal(process.versions.node, '22.22.2');
  assert.equal(process.env.GITHUB_REPOSITORY, TARGET.repository);
  assert.equal(process.env.GITHUB_EVENT_NAME, 'pull_request');
  assert(
    typeof password === 'string' &&
      password.length > 0 &&
      password.length <= 512 &&
      !password.includes('\0'),
    'Existing protected credential required',
  );
  assert(process.env.GH_TOKEN, 'Read-only Actions token required');
  const source = process.env.SOURCE_SHA;
  assert.match(source, /^[a-f0-9]{40}$/);
  assert.equal(git('rev-parse', 'HEAD'), source);
  const event = await readSmall(process.env.GITHUB_EVENT_PATH, MiB);
  assert.equal(event.pull_request.head.sha, source);
  assert.equal(event.pull_request.head.repo.full_name, TARGET.repository);
  assert.equal(event.pull_request.base.ref, 'main');
  const tree = git('rev-parse', 'HEAD^{tree}');
  const temporary = await realpath(process.env.RUNNER_TEMP),
    identity = process.env.GITHUB_RUN_ID + '-' + process.env.GITHUB_RUN_ATTEMPT;
  assert.match(identity, /^[0-9]+-[0-9]+$/);
  const root = join(temporary, 'cmb-' + identity),
    actualRoot = await realpath(root);
  assert.equal(actualRoot, root);
  assert(!isAbsolute(relative(temporary, root)) && relative(temporary, root) === 'cmb-' + identity);
  const rootInfo = await lstat(root);
  assert(rootInfo.isDirectory() && !rootInfo.isSymbolicLink());
  const output = join(temporary, 'cmb-evidence-' + identity);
  await mkdir(output, { mode: 0o700 });
  const privateEvidence = join(root, 'evidence');
  await mkdir(privateEvidence, { mode: 0o700 });
  const report = {
    format: 'RevealLineCompiledMenuConsumerV1',
    status: 'failed',
    target: TARGET,
    tooling: {
      source,
      tree,
      workflowRevision: process.env.GITHUB_WORKFLOW_SHA,
      run: identity,
      imageOS: process.env.ImageOS ?? null,
      imageVersion: process.env.ImageVersion ?? null,
    },
    performanceExcluded: true,
    commands: [],
  };
  let complete = false;
  const childEnv = {
    ...cleanEnv(),
    CI: 'true',
    TMPDIR: join(root, 't'),
    TMP: join(root, 't'),
    TEMP: join(root, 't'),
    PLAYWRIGHT_BROWSERS_PATH: join(root, 'browsers'),
    XDG_CACHE_HOME: join(root, 'cache'),
    XDG_CONFIG_HOME: join(root, 'config'),
    GIT_NO_LAZY_FETCH: '1',
    GIT_OPTIONAL_LOCKS: '0',
    PYTHONDONTWRITEBYTECODE: '1',
  };
  assert(Buffer.byteLength(childEnv.TMPDIR) <= 52, 'Browser socket path budget');
  await mkdir(childEnv.TMPDIR, { mode: 0o700 });
  await mkdir(childEnv.XDG_CACHE_HOME, { mode: 0o700 });
  await mkdir(childEnv.XDG_CONFIG_HOME, { mode: 0o700 });
  let inspected = 0;
  const inspect = async () => {
    await floor(root);
    if (Date.now() - inspected > 2000) {
      await liveBytes(root);
      inspected = Date.now();
    }
  };
  const command = async (name, argv, { browser = false, timeoutMs = 180000 } = {}) => {
    await inspect(); // Fresh post-audit prelaunch reserve.
    const raw = join(privateEvidence, name + '.log'),
      ownerPath = join(privateEvidence, name + '-owner.json');
    const owner = await ownedCommand(argv, {
      cwd: repository,
      env: { ...childEnv, ...(browser ? { REVEALLINE_PAGES_TEST_PASSWORD: password } : {}) },
      log: raw,
      receipt: ownerPath,
      timeoutMs,
      rssBytes: browser ? 6 * GiB : 2 * GiB,
      outputBytes: browser ? MiB : 4 * MiB,
      inspect,
    });
    // Child-terminal facts survive any later full audit or capacity failure.
    await save(join(output, name + '-terminal.json'), { name, owner, raw: await digest(raw) });
    report.commands.push({ name, owner, raw: await digest(raw) });
    assertOwner(owner);
    await inspect();
    return raw;
  };
  const audit = async (name) => {
    const trusted = join(temporary, 'cmb-trusted-' + identity, 'source-audit.mjs');
    assert.deepEqual(await digest(trusted), {
      bytes: 7275,
      sha256: 'a6124736ce13aec52fb26d818e6c2aa6ce83965ccaf92b94c783043d1d150fc4',
    });
    const raw = await command(name, [
      process.execPath,
      '--max-old-space-size=1536',
      trusted,
      '--root',
      repository,
    ]);
    const result = JSON.parse(await readFile(raw, 'utf8'));
    assert.equal(result.sourceRevision, source);
    assert.equal(result.sourceTree, tree);
    assert.equal(result.allTrackedSourceContentsAndModesMatch, true);
    return result;
  };
  try {
    await floor(root);
    const space = await statfs(root);
    assert(
      Number(space.bavail) * Number(space.bsize) > 8 * GiB,
      'Fresh package preparation headroom',
    );
    const plan = await readSmall(
      join(repository, 'docs/verification/compiled-menu-browser-37ec-plan.json'),
    );
    assert.deepEqual(plan.target, TARGET);
    for (const row of plan.reusedSource) {
      const data = await readFile(join(repository, row.path));
      assert.equal(
        createHash('sha1')
          .update('blob ' + data.length + '\0')
          .update(data)
          .digest('hex'),
        row.oid,
      );
    }
    assert.deepEqual(await digest(process.execPath), {
      bytes: 124679552,
      sha256: '81925c0995b5c1427b5d538e6a90ca2fdc4daffb786b09af749beaf7369d4e90',
    });
    report.node = {
      version: process.version,
      path: await realpath(process.execPath),
      ...(await digest(process.execPath)),
    };
    const workflow = await metadata(
      '/repos/mekhovov/revealline/contents/.github/workflows/compiled-menu-browser-37ec.yml?ref=' +
        process.env.GITHUB_WORKFLOW_SHA,
    );
    assert.equal(
      workflow.sha,
      git('rev-parse', 'HEAD:.github/workflows/compiled-menu-browser-37ec.yml'),
    );
    report.executedWorkflowOID = workflow.sha;
    report.sourceBefore = await audit('source-before');
    const tools = join(root, 'tools/node_modules'),
      browsers = join(root, 'browsers');
    for (const name of ['package.json', 'package-lock.json']) {
      assert.deepEqual(
        await digest(join(root, 'tools', name)),
        await digest(join(repository, 'scripts/compiled-menu-browser-tools', name)),
        'Copied browser tooling lock/source binding',
      );
    }
    report.dependenciesBefore = {
      repository: await inventory(join(repository, 'node_modules'), true),
      tools: await inventory(tools, true),
      browsers: await inventory(browsers, true),
    };
    assert.equal((await readSmall(join(tools, 'playwright/package.json'))).version, '1.62.1');
    assert.equal((await readSmall(join(tools, 'playwright-core/package.json'))).version, '1.62.1');
    assert.deepEqual(await digest(join(tools, 'playwright-core/browsers.json')), {
      bytes: 1780,
      sha256: 'f306eed529599b1eaf2f8a85db9de2b23e1a3fe36c2b66434b7c9434fb627a99',
    });
    const artifact = await metadata(
      '/repos/mekhovov/revealline/actions/artifacts/' + TARGET.artifact,
    );
    const producer = await metadata('/repos/mekhovov/revealline/actions/runs/' + TARGET.run);
    assertArtifact(artifact, producer);
    report.artifactMetadata = artifact;
    report.producerMetadata = {
      id: producer.id,
      head: producer.head_sha,
      attempt: producer.run_attempt,
      conclusion: producer.conclusion,
    };
    const outer = join(root, 'artifact.zip');
    report.download = await download(outer, root);
    const outerDir = join(root, 'outer'),
      game = join(root, 'generated');
    await command('archive-outer', [
      '/usr/bin/python3',
      '-B',
      join(repository, 'scripts/solo-remote-archive.py'),
      'outer',
      outer,
      outerDir,
      TARGET.source,
      join(privateEvidence, 'outer-validation.json'),
    ]);
    report.outer = await readSmall(join(privateEvidence, 'outer-validation.json'));
    assert.equal(report.outer.status, 'passed');
    assert.equal(report.outer.producer.sourceRevision, TARGET.source);
    assert.equal(report.outer.producer.sourceTree, TARGET.tree);
    assert.deepEqual(await digest(join(outerDir, 'distribution.zip')), {
      bytes: TARGET.innerBytes,
      sha256: TARGET.innerSha256,
    });
    await command('archive-inner', [
      '/usr/bin/python3',
      '-B',
      join(repository, 'scripts/solo-remote-archive.py'),
      'inner',
      join(outerDir, 'distribution.zip'),
      game,
      TARGET.source,
      join(privateEvidence, 'inner-validation.json'),
    ]);
    report.inner = await readSmall(join(privateEvidence, 'inner-validation.json'));
    assert.equal(report.inner.status, 'passed');
    assert.equal(report.inner.manifestSHA256, TARGET.manifestSha256);
    assert.deepEqual(await digest(join(game, 'manifest.json')), {
      bytes: TARGET.manifestBytes,
      sha256: TARGET.manifestSha256,
    });
    assert.equal(report.inner.markerReconstructed, true);
    assert.equal(report.inner.markerExcludedFromArchive, true);
    const loader = await readFile(join(game, 'game/content-design/route-loader.mjs'), 'utf8');
    assert(
      !loader.includes('const SHIPPED_ROUTE_SNAPSHOT = null;'),
      'Source loader is not compiled navigation',
    );
    const match = /^const CURRENT = (.+);$/m.exec(loader);
    assert(match, 'Exact generated navigation descriptor');
    const descriptor = JSON.parse(match[1]);
    assert.equal(descriptor.id, 'whole-spatial-v25');
    assert.equal(descriptor.path, 'runtime/navigation-whole-spatial-v25.json');
    assert.deepEqual(await digest(join(game, 'game/content-design', descriptor.path)), {
      bytes: descriptor.bytes,
      sha256: descriptor.sha256,
    });
    const navigation = await readSmall(join(game, 'game/content-design', descriptor.path), 8 * MiB);
    assert.equal(navigation.id, 'whole-spatial-v25');
    assert.equal(navigation.navigation.format, 'revealline-journey-navigation.v1');
    const count = navigation.navigation.views.solo.campaigns.reduce(
      (n, x) => n + x.levels.length,
      0,
    );
    assert.equal(count, 91);
    const retained = navigation.navigation.archives.find((x) => x.route.id === 'whole-spatial-v24');
    assert(retained);
    const retainedLevels = retained.views.solo.campaigns
      .flatMap((x) => x.levels.map((level) => level.id))
      .sort();
    assert.deepEqual(retainedLevels, ['crossing-complete', 'home-signal', 'returning-light']);
    report.compiledNavigation = {
      descriptor,
      currentCount: count,
      retainedLevels,
      authority:
        'Exact hash-verified existing generated loader and navigation; no runtime admission or regeneration.',
    };
    report.packageBefore = await inventory(game);
    const browserOutput = join(privateEvidence, 'browser');
    await mkdir(browserOutput, { mode: 0o700 });
    await command(
      'browser',
      [
        process.execPath,
        '--max-old-space-size=1536',
        join(repository, 'scripts/compiled-menu-browser-observer.mjs'),
        game,
        join(tools, 'playwright/index.mjs'),
        browserOutput,
        source,
      ],
      { browser: true, timeoutMs: 600000 },
    );
    const browserReport = await readSmall(join(browserOutput, 'report.json'), 262144);
    assertBrowserReport(browserReport, report.commands.at(-1).owner, source);
    report.browser = browserReport;
    report.packageAfter = await inventory(game);
    assert.deepEqual(report.packageAfter, report.packageBefore);
    report.dependenciesAfter = {
      repository: await inventory(join(repository, 'node_modules'), true),
      tools: await inventory(tools, true),
      browsers: await inventory(browsers, true),
    };
    assert.deepEqual(report.dependenciesAfter, report.dependenciesBefore);
    assert.deepEqual(await digest(process.execPath), {
      bytes: report.node.bytes,
      sha256: report.node.sha256,
    });
    report.sourceAfter = await audit('source-after');
    assert.deepEqual(report.sourceAfter, report.sourceBefore);
    assert.equal(git('rev-parse', 'HEAD'), source);
    assert.equal(git('rev-parse', 'HEAD^{tree}'), tree);
    await floor(root);
    await liveBytes(root);
    await save(join(output, 'browser-report.json'), browserReport);
    for (const name of ['en-home', 'en-missions', 'uk-home', 'uk-missions']) {
      const data = await readFile(join(browserOutput, name + '.jpg'));
      assert(data.length <= 512 * 1024);
      await writeFile(join(output, name + '.jpg'), data, { flag: 'wx', mode: 0o600 });
    }
    complete = true; // Success remains provisional until final public evidence/floor checks.
  } catch (error) {
    report.failure = redactPagesText(error?.message ?? error, password);
    process.exitCode = 1;
  } finally {
    // Keep full byte inventories privately; the small published receipt binds
    // them by digest instead of uploading multi-megabyte environment listings.
    for (const field of [
      'dependenciesBefore',
      'dependenciesAfter',
      'packageBefore',
      'packageAfter',
    ]) {
      if (!report[field]) continue;
      const bytes = Buffer.from(JSON.stringify(report[field]) + '\n');
      await writeFile(join(privateEvidence, field + '.json'), bytes, { flag: 'wx', mode: 0o600 });
      report[field] = { sha256: sha(bytes), bytes: bytes.length };
    }
    await save(join(output, 'summary-provisional.json'), report);
    // Raw browser output never leaves private storage. Redaction is applied to
    // the COMPLETE bounded string, before an encoded sanitized log byte cap.
    for (const row of report.commands) {
      const raw = await readFile(join(privateEvidence, row.name + '.log'), 'utf8');
      await save(join(output, row.name + '-log.json'), { text: raw });
    }
    const info = await lstat(root);
    assert.equal(info.dev, rootInfo.dev);
    assert.equal(info.ino, rootInfo.ino);
    if (complete) {
      assert(
        report.commands.every(
          (x) => x.owner.status === 'closed' && !x.owner.forcedCleanup && !x.owner.survivors.length,
        ),
      );
      // Fresh task root only; fs.rm unlinks symlinks and never follows their
      // targets. Original source, dependencies and unrelated temp paths survive.
      await rm(root, { recursive: true, force: false });
      await save(join(output, 'cleanup.json'), {
        status: 'removed-own-closed-root',
        device: rootInfo.dev,
        inode: rootInfo.ino,
      });
    } else
      await save(join(output, 'cleanup.json'), {
        status: 'retained-failed-private-root',
        path: root,
      });
    const evidence = await inventory(output);
    assert(
      evidence.reduce((n, x) => n + x.bytes, 0) <= 4 * MiB - 262144,
      'Public artifact cap with final receipt reserve',
    );
    await floor(output);
    if (complete) report.status = 'passed-historical-compiled-controls';
    await save(join(output, 'summary.json'), report);
  }
}
await run();
