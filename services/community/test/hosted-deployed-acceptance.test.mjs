import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('hosted journey uses an isolated exact-source PostgreSQL and disk deployment', async () => {
  const [compose, baseCompose, productionCompose, dockerfile, workflow] = await Promise.all([
    readFile(new URL('../compose.hosted-acceptance.yaml', import.meta.url), 'utf8'),
    readFile(new URL('../compose.yaml', import.meta.url), 'utf8'),
    readFile(new URL('../compose.production.yaml', import.meta.url), 'utf8'),
    readFile(new URL('../Dockerfile', import.meta.url), 'utf8'),
    readFile(
      new URL('../../../.github/workflows/community-hosted-acceptance.yml', import.meta.url),
      'utf8',
    ),
  ]);

  assert.match(compose, /api:[\s\S]*COMMUNITY_ALLOW_DEV_AUTH: 'true'/u);
  assert.match(compose, /hosted-creator-a-token/u);
  assert.match(compose, /hosted-creator-b-token/u);
  assert.match(compose, /hosted-admin-token/u);
  assert.match(compose, /roles.*admin/u);
  assert.match(compose, /CI-only overlay/u);
  assert.doesNotMatch(compose, /:latest/u);
  assert.doesNotMatch(compose, /AWS_|COMMUNITY_S3_/u);
  assert.match(
    baseCompose,
    /psql --host=postgres --username=revealline --dbname=revealline \\\n+\s+--set=ON_ERROR_STOP=1 --file="\$\$\{file\}"/u,
  );
  assert.match(productionCompose, /COMMUNITY_ALLOW_DEV_AUTH: 'false'/u);
  assert.match(productionCompose, /COMMUNITY_DEV_TOKENS: '\{\}'/u);
  assert.match(dockerfile, /COPY game \/game/u);
  assert.doesNotMatch(dockerfile, /COPY game \/srv\/game/u);

  assert.match(workflow, /runs-on: ubuntu-24\.04/u);
  assert.match(workflow, /COMMUNITY_SOURCE_REVISION: \$\{\{/u);
  assert.match(workflow, /compose\.production\.yaml/u);
  assert.match(workflow, /acceptance:tus-deployed/u);
  assert.match(workflow, /down --remove-orphans/u);
  assert.match(workflow, /acceptance:deployed/u);
  assert.match(workflow, /community-hosted-acceptance-receipts/u);
  assert.match(workflow, /retention-days: 14/u);
  assert.match(workflow, /down --volumes --remove-orphans/u);
});
