import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runCompactFocusedCLI } from './focused-compact-cli.mjs';

const runtime = {
  nodeVersion: 'v20.19.5',
  platform: 'linux',
  architecture: 'x64',
  npmVersion: '10.8.2',
};
async function fixture(fn) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'revealline-compact-cli-'));
  try {
    const automation = path.join(root, 'automation');
    await fs.mkdir(path.join(automation, 'publishing'), { recursive: true });
    const source = path.join(root, 'source');
    await fs.mkdir(source);
    const admission = {
      format: 'revealline-admission.v1',
      headSha: 'a'.repeat(40),
      baseSha: 'b'.repeat(40),
      workflowRevision: 'c'.repeat(40),
      policyDigest: 'd'.repeat(64),
      classification: 'maintenance',
      dependencies: [],
      paths: ['docs/example.md'],
    };
    const event = {
      repository: { full_name: 'mekhovov/revealline' },
      pull_request: {
        number: 7,
        head: { sha: admission.headSha },
        base: { sha: admission.baseSha, ref: 'main' },
      },
    };
    const manifest = {
      format: 'revealline-focused-test-map.v1',
      categories: [
        {
          id: 'example',
          pathPatterns: ['^game/'],
          commands: [{ id: 'check', command: 'node', args: ['--check', 'example.mjs'] }],
        },
      ],
      ignoredPathPatterns: ['^docs/'],
      fallbackCommands: [],
    };
    const policy = {
      format: 'revealline-release-test-policy.v1',
      authorization: 'explicit-user-request-20261004',
      mode: 'required',
      reason: 'required',
      restoration: 'required',
      scope: 'automated-test-suites',
    };
    const admissionFile = path.join(root, 'admission.json'),
      eventFile = path.join(root, 'event.json'),
      packet = path.join(root, 'packet.json'),
      output = path.join(root, 'output');
    await Promise.all(
      [
        [admissionFile, admission],
        [eventFile, event],
        [path.join(automation, 'publishing/focused-test-map.json'), manifest],
        [path.join(automation, 'publishing/test-policy.json'), policy],
      ].map(([p, v]) => fs.writeFile(p, JSON.stringify(v))),
    );
    const env = {
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_EVENT_PATH: eventFile,
      GITHUB_REPOSITORY: 'mekhovov/revealline',
      GITHUB_RUN_ID: '123',
      GITHUB_RUN_ATTEMPT: '1',
      EXPECTED_SOURCE: admission.headSha,
      EXPECTED_AUTOMATION: admission.workflowRevision,
      GITHUB_OUTPUT: output,
      WORKERS_RESULT: 'skipped',
    };
    const dependencies = {
      runtime,
      policyDigest: async () => admission.policyDigest,
      acquire: async () => ({
        sourceRevision: admission.headSha,
        sourceTree: 'e'.repeat(40),
        setupFiles: [],
        inputs: { packageScripts: {}, repositoryFiles: [], shellSemantics: 'posix' },
      }),
      loadInputs: async () => ({
        packageScripts: {},
        repositoryFiles: [],
        shellSemantics: 'posix',
      }),
      readShellSemantics: () => 'posix',
    };
    await fn({ root, automation, source, admissionFile, packet, env, dependencies, output });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

test('CLI prepares a typed zero-work packet and verifies it with no worker artifacts', () =>
  fixture(async (x) => {
    await runCompactFocusedCLI(
      [
        'prepare',
        '--automation',
        x.automation,
        '--root',
        x.source,
        '--admission',
        x.admissionFile,
        '--packet',
        x.packet,
      ],
      x.env,
      x.dependencies,
    );
    const packet = JSON.parse(await fs.readFile(x.packet));
    assert.equal(packet.plan.shardCount, 0);
    const outputs = await fs.readFile(x.output, 'utf8');
    assert.match(outputs, /focusedShards=0\n/u);
    assert.match(outputs, /focusedDisposition=no-selected-commands/u);
    const proof = await runCompactFocusedCLI(
      [
        'verify',
        '--automation',
        x.automation,
        '--admission',
        x.admissionFile,
        '--packet',
        x.packet,
        '--plan-sha256',
        packet.plan.sha256,
        '--receipts',
        path.join(x.root, 'absent'),
        '--prefix',
        'focused-shard-123-1-',
      ],
      x.env,
      x.dependencies,
    );
    assert.equal(proof.status, 'not-applicable');
  }));

test('CLI rejects duplicate options, missing trusted digest and credential-bearing execution', () =>
  fixture(async (x) => {
    const args = [
      'prepare',
      '--automation',
      x.automation,
      '--root',
      x.source,
      '--admission',
      x.admissionFile,
      '--packet',
      x.packet,
    ];
    await assert.rejects(
      runCompactFocusedCLI([...args, '--root', x.source], x.env, x.dependencies),
      /option/i,
    );
    await assert.rejects(
      runCompactFocusedCLI(
        args,
        { ...x.env, GH_TOKEN: 'fixture-not-a-credential' },
        x.dependencies,
      ),
      /credential/i,
    );
    await assert.rejects(
      runCompactFocusedCLI(
        [
          'verify',
          '--automation',
          x.automation,
          '--admission',
          x.admissionFile,
          '--packet',
          x.packet,
        ],
        x.env,
        x.dependencies,
      ),
      /option|digest/i,
    );
  }));

test('CLI does not overwrite existing packets or accept a foreign event repository', () =>
  fixture(async (x) => {
    const args = [
      'prepare',
      '--automation',
      x.automation,
      '--root',
      x.source,
      '--admission',
      x.admissionFile,
      '--packet',
      x.packet,
    ];
    await fs.writeFile(x.packet, 'preserve');
    await assert.rejects(runCompactFocusedCLI(args, x.env, x.dependencies), /exist/i);
    assert.equal(await fs.readFile(x.packet, 'utf8'), 'preserve');
    await assert.rejects(
      runCompactFocusedCLI(args, { ...x.env, GITHUB_REPOSITORY: 'other/repo' }, x.dependencies),
      /event|repository/i,
    );
  }));
