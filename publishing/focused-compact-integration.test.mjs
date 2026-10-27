import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { POLICY_FILES, validationPolicyDigest } from './admission-binding.mjs';
import { runCompactFocusedCLI } from './focused-compact-cli.mjs';

// Real Git, actual file acquisition, actual existing command runner and strict
// aggregate. The identity's Linux platform is an explicit injected fixture:
// this portable local test does not claim a hosted Linux canary.
for (const count of [0, 1, 5])
  test(`real tiny-repository prepare/execute/aggregate for ${count} commands`, async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'revealline-compact-integration-'));
    const source = path.join(base, 'source'),
      automation = path.join(base, 'automation');
    const git = (...args) => {
      const r = spawnSync('git', ['-C', source, ...args], {
        encoding: 'utf8',
        env: {
          ...process.env,
          GIT_CONFIG_GLOBAL: '/dev/null',
          GIT_CONFIG_NOSYSTEM: '1',
          GIT_CONFIG_COUNT: '0',
        },
      });
      assert.equal(r.status, 0, r.stderr);
      return r.stdout.trim();
    };
    try {
      await fs.mkdir(path.join(source, 'game/test'), { recursive: true });
      await fs.mkdir(path.join(source, 'authoring/fpv-worlds'), { recursive: true });
      await fs.writeFile(
        path.join(source, 'package.json'),
        JSON.stringify({
          scripts: {
            preinstall: "node -e \"require('fs').writeFileSync('MUST_NOT_EXECUTE','bad')\"",
          },
        }),
      );
      for (const p of [
        'package-lock.json',
        'authoring/fpv-worlds/package.json',
        'authoring/fpv-worlds/package-lock.json',
      ])
        await fs.writeFile(path.join(source, p), '{}');
      const commands = [];
      for (let i = 0; i < Math.max(count, 1); i++) {
        const p = `game/test/tiny-${i}.mjs`;
        await fs.writeFile(
          path.join(source, p),
          `import assert from 'node:assert/strict'; assert.equal(${i}+1,${i + 1});\n`,
        );
        commands.push({ id: `tiny-${i}`, command: 'node', args: [p], timeoutMs: 10000 });
      }
      git('init', '--quiet');
      git('config', 'user.name', 'Fixture');
      git('config', 'user.email', 'fixture@example.invalid');
      git('add', '.');
      git('commit', '--quiet', '-m', 'tiny fixture');
      const head = git('rev-parse', 'HEAD'),
        index = await fs.readFile(path.join(source, '.git/index')),
        refs = git('show-ref');
      for (const file of POLICY_FILES) {
        await fs.mkdir(path.dirname(path.join(automation, file)), { recursive: true });
        await fs.writeFile(
          path.join(automation, file),
          '// Exact fixture policy data: ' + file + '\n',
        );
      }
      await fs.writeFile(
        path.join(automation, 'publishing/focused-test-map.json'),
        JSON.stringify({
          format: 'revealline-focused-test-map.v1',
          categories: [{ id: 'example', pathPatterns: ['^game/'], commands }],
          ignoredPathPatterns: ['^docs/'],
          fallbackCommands: [],
        }),
      );
      await fs.writeFile(
        path.join(automation, 'publishing/test-policy.json'),
        JSON.stringify({
          format: 'revealline-release-test-policy.v1',
          authorization: 'explicit-user-request-20261004',
          mode: 'required',
          reason: 'required',
          restoration: 'required',
          scope: 'automated-test-suites',
        }),
      );
      const admission = {
        format: 'revealline-admission.v1',
        headSha: head,
        baseSha: 'b'.repeat(40),
        workflowRevision: 'c'.repeat(40),
        policyDigest: await validationPolicyDigest(automation),
        classification: 'maintenance',
        dependencies: [],
        paths: [count ? 'game/example.mjs' : 'docs/example.md'],
      };
      const event = {
        repository: { full_name: 'mekhovov/revealline' },
        pull_request: {
          number: 7,
          head: { sha: head },
          base: { sha: admission.baseSha, ref: 'main' },
        },
      };
      const admissionFile = path.join(base, 'admission.json'),
        eventFile = path.join(base, 'event.json'),
        packetFile = path.join(base, 'packet.json'),
        outputs = path.join(base, 'outputs'),
        receipts = path.join(base, 'receipts');
      await fs.writeFile(admissionFile, JSON.stringify(admission));
      await fs.writeFile(eventFile, JSON.stringify(event));
      const version = spawnSync('npm', ['--version'], { encoding: 'utf8' });
      assert.equal(version.status, 0);
      const env = {
        GITHUB_EVENT_NAME: 'pull_request',
        GITHUB_EVENT_PATH: eventFile,
        GITHUB_REPOSITORY: 'mekhovov/revealline',
        GITHUB_RUN_ID: '123',
        GITHUB_RUN_ATTEMPT: '1',
        EXPECTED_SOURCE: head,
        EXPECTED_AUTOMATION: admission.workflowRevision,
        GITHUB_OUTPUT: outputs,
        WORKERS_RESULT: count ? 'success' : 'skipped',
      };
      const injected = {
        runtime: {
          nodeVersion: 'v20.19.5',
          platform: 'linux',
          architecture: 'x64',
          npmVersion: version.stdout.trim(),
        },
      };
      const common = [
        '--automation',
        automation,
        '--admission',
        admissionFile,
        '--packet',
        packetFile,
      ];
      const prepared = await runCompactFocusedCLI(
        ['prepare', ...common, '--root', source],
        env,
        injected,
      );
      assert.equal(prepared.shards, Math.min(4, count));
      assert.equal(prepared.commands, count);
      for (let i = 1; i <= prepared.shards; i++) {
        const folder = path.join(receipts, `focused-shard-123-1-${i}`);
        await fs.mkdir(folder, { recursive: true });
        const result = await runCompactFocusedCLI(
          [
            'execute',
            ...common,
            '--root',
            source,
            '--plan-sha256',
            prepared.planSha256,
            '--shard',
            String(i),
            '--receipt',
            path.join(folder, 'receipt.json'),
          ],
          env,
          injected,
        );
        assert.equal(result.exitCode, 0);
        assert.ok(result.executedCommands > 0);
      }
      const result = await runCompactFocusedCLI(
        [
          'verify',
          ...common,
          '--plan-sha256',
          prepared.planSha256,
          '--receipts',
          receipts,
          '--prefix',
          'focused-shard-123-1-',
        ],
        env,
        injected,
      );
      assert.equal(result.executedCommands, count);
      assert.equal(result.status, count ? 'executed-success' : 'not-applicable');
      assert.equal(git('rev-parse', 'HEAD'), head);
      assert.equal(git('show-ref'), refs);
      assert.deepEqual(await fs.readFile(path.join(source, '.git/index')), index);
      assert.equal(git('status', '--porcelain'), '');
      await assert.rejects(fs.stat(path.join(source, 'MUST_NOT_EXECUTE')), { code: 'ENOENT' });
    } finally {
      await fs.rm(base, { recursive: true, force: true });
    }
  });
