import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  postgresCommandEnvironment,
  postgresDatabaseName,
} from '../src/postgres-command-environment.mjs';

test('every recovery command runner uses the shared database URL environment boundary', async () => {
  const runners = await Promise.all(
    [
      '../src/recovery-runner.mjs',
      '../src/recovery-rehearsal-runner.mjs',
      '../src/minio-recovery-acceptance-runner.mjs',
    ].map((file) => readFile(new URL(file, import.meta.url), 'utf8')),
  );
  for (const runner of runners) {
    assert.match(runner, /postgresCommandEnvironment\(databaseUrl\)/u);
    assert.doesNotMatch(runner, /PGDATABASE:\s*databaseUrl/u);
  }
});

test('database URLs become isolated libpq process variables without exposing the URL', () => {
  const databaseUrl =
    'postgresql://reveal%40line:p%40ssword@database.example:5544/reveal%2Fline' +
    '?sslmode=verify-full&connect_timeout=8&application_name=recovery';
  const environment = postgresCommandEnvironment(databaseUrl, {
    PATH: '/usr/bin',
    PGHOST: 'stale.example',
    PGSERVICE: 'stale-service',
  });

  assert.deepEqual(environment, {
    PATH: '/usr/bin',
    PGAPPNAME: 'recovery',
    PGCONNECT_TIMEOUT: '8',
    PGDATABASE: 'reveal/line',
    PGHOST: 'database.example',
    PGPASSWORD: 'p@ssword',
    PGPORT: '5544',
    PGSSLMODE: 'verify-full',
    PGUSER: 'reveal@line',
  });
  assert.equal(Object.values(environment).includes(databaseUrl), false);
  assert.equal(postgresDatabaseName(databaseUrl), 'reveal/line');
});

test('database URL parsing supplies the PostgreSQL default port and supports IPv6', () => {
  const environment = postgresCommandEnvironment(
    'postgres://user:secret@[2001:db8::1]/revealline',
    {
      PGPASSFILE: '/stale/passfile',
    },
  );
  assert.equal(environment.PGHOST, '2001:db8::1');
  assert.equal(environment.PGPORT, '5432');
  assert.equal(environment.PGUSER, 'user');
  assert.equal(environment.PGPASSWORD, 'secret');
  assert.equal(environment.PGDATABASE, 'revealline');
  assert.equal('PGPASSFILE' in environment, false);
});

test('invalid or unsupported database URLs fail without echoing their contents', () => {
  const secret = 'must-not-appear';
  for (const databaseUrl of [
    '',
    `https://user:${secret}@database.example/revealline`,
    `postgres://user:${secret}@/revealline`,
    `postgres://user:${secret}@database.example/`,
    `postgres://user:${secret}@database.example/revealline?unsupported=value`,
    `postgres://user:${secret}@database.example/revealline#fragment`,
  ]) {
    assert.throws(
      () => postgresCommandEnvironment(databaseUrl, {}),
      (error) =>
        error.message === 'PostgreSQL database URL is invalid.' && !error.message.includes(secret),
    );
    assert.throws(
      () => postgresDatabaseName(databaseUrl),
      (error) =>
        error.message === 'PostgreSQL database URL is invalid.' && !error.message.includes(secret),
    );
  }
});
