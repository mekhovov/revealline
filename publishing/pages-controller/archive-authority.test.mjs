import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  authorityQuery,
  verifyArchiveAuthorities,
} from "./archive-authority.mjs";

const COMMIT = "a".repeat(40);
const admission = (number, overrides = {}) => ({
  id: `archive-${String(number).padStart(2, "0")}`,
  infrastructureCommit: COMMIT,
  deploymentId: 1000 + number,
  ...overrides,
});

function response(status, value, headers = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: new Headers(headers),
    async json() {
      return value;
    },
    async text() {
      return value === undefined ? "" : JSON.stringify(value);
    },
  };
}

function graphqlData(query, admissions) {
  const repositories = [
    ...query.matchAll(
      /r(\d+):repository\(owner:"mekhovov",name:"revealline-(archive-[0-9]+)"\)/gu,
    ),
  ];
  return Object.fromEntries(
    repositories.map((match) => {
      const item = admissions.find(({ id }) => id === match[2]);
      assert.ok(item, match[2]);
      return [
        `r${match[1]}`,
        {
          defaultBranchRef: { target: { oid: item.infrastructureCommit } },
          deployments: {
            nodes: [
              {
                databaseId: item.deploymentId,
                commitOid: item.infrastructureCommit,
                environment: "github-pages",
                latestStatus: { state: "SUCCESS" },
              },
            ],
          },
        },
      ];
    }),
  );
}

test("authority query batches repository refs and deployments without interpolating unknown ids", () => {
  const query = authorityQuery([
    { id: "archive-01", deploymentId: 10 },
    { id: "archive-58", deploymentId: 20 },
  ]);
  assert.match(
    query,
    /r0:repository\(owner:"mekhovov",name:"revealline-archive-01"\)/u,
  );
  assert.match(
    query,
    /r1:repository\(owner:"mekhovov",name:"revealline-archive-58"\)/u,
  );
  assert.match(query, /defaultBranchRef/u);
  assert.match(query, /latestStatus\{state\}/u);
  assert.throws(() =>
    authorityQuery([{ id: "archive-1) { viewer { login }", deploymentId: 1 }]),
  );
  assert.throws(() => authorityQuery([{ id: "archive-00", deploymentId: 1 }]));
});

test("production authority verification uses about five GraphQL batches", async () => {
  const admissions = Array.from({ length: 96 }, (_, index) =>
    admission(index + 1),
  );
  let requests = 0;
  const result = await verifyArchiveAuthorities({
    admissions,
    token: "test-token",
    fetchImpl: async (url, options) => {
      assert.equal(url, "https://api.github.com/graphql");
      requests++;
      const { query } = JSON.parse(options.body);
      return response(200, { data: graphqlData(query, admissions) });
    },
  });
  assert.equal(requests, 5);
  assert.equal(result.observations.length, 96);
  assert.deepEqual(result.metrics, {
    graphqlRequests: 5,
    restRequests: 0,
    retries: 0,
    cacheHits: 0,
  });
});

test("GraphQL errors fall back to serial REST and persist conditional ETags", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "authority-etag-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const cacheFile = path.join(directory, "authority.json"),
    item = admission(1),
    urls = {
      commit:
        "https://api.github.com/repos/mekhovov/revealline-archive-01/commits/main",
      deployment:
        "https://api.github.com/repos/mekhovov/revealline-archive-01/deployments/1001",
      statuses:
        "https://api.github.com/repos/mekhovov/revealline-archive-01/deployments/1001/statuses",
    },
    values = {
      [urls.commit]: { sha: COMMIT },
      [urls.deployment]: {
        id: item.deploymentId,
        sha: COMMIT,
        environment: "github-pages",
      },
      [urls.statuses]: [{ state: "success" }],
    };
  const first = await verifyArchiveAuthorities({
    admissions: [item],
    token: "test-token",
    cacheFile,
    fetchImpl: async (url) =>
      url.endsWith("/graphql")
        ? response(200, { errors: [{ message: "temporary" }] })
        : response(200, values[url], { etag: `"${url.split("/").at(-1)}"` }),
  });
  assert.equal(first.metrics.restRequests, 3);
  const cached = JSON.parse(await fs.readFile(cacheFile, "utf8"));
  assert.deepEqual(Object.keys(cached).sort(), Object.values(urls).sort());

  const conditionalHeaders = [];
  const second = await verifyArchiveAuthorities({
    admissions: [item],
    token: "test-token",
    cacheFile,
    fetchImpl: async (url, options) => {
      if (url.endsWith("/graphql"))
        return response(200, { errors: [{ message: "temporary" }] });
      conditionalHeaders.push(options.headers["if-none-match"]);
      return response(304);
    },
  });
  assert.equal(second.metrics.cacheHits, 3);
  assert.equal(second.metrics.restRequests, 3);
  assert.ok(conditionalHeaders.every(Boolean));
});

test("conditional REST backs off for 403 and 429 without parallel fan-out", async () => {
  const item = admission(2),
    attempts = new Map(),
    delays = [];
  const result = await verifyArchiveAuthorities({
    admissions: [item],
    token: "test-token",
    sleepImpl: async (milliseconds) => delays.push(milliseconds),
    fetchImpl: async (url) => {
      if (url.endsWith("/graphql")) return response(500, { message: "outage" });
      const count = (attempts.get(url) || 0) + 1;
      attempts.set(url, count);
      if (count === 1 && url.endsWith("/commits/main"))
        return response(
          403,
          { message: "secondary rate limit" },
          { "retry-after": "0" },
        );
      if (count === 1 && url.endsWith("/deployments/1002"))
        return response(429, { message: "rate limit" }, { "retry-after": "0" });
      if (url.endsWith("/commits/main")) return response(200, { sha: COMMIT });
      if (url.endsWith("/statuses"))
        return response(200, [{ state: "success" }]);
      return response(200, {
        id: item.deploymentId,
        sha: COMMIT,
        environment: "github-pages",
      });
    },
  });
  assert.equal(result.metrics.retries, 2);
  assert.equal(result.metrics.restRequests, 5);
  assert.deepEqual(delays, [0, 0]);
});

test("missing deployments and mismatched authority pins fail closed", async () => {
  const item = admission(3);
  await assert.rejects(
    verifyArchiveAuthorities({
      admissions: [item],
      token: "test-token",
      fetchImpl: async (url) => {
        if (url.endsWith("/graphql"))
          return response(200, {
            data: {
              r0: {
                defaultBranchRef: { target: { oid: COMMIT } },
                deployments: { nodes: [] },
              },
            },
          });
        if (url.endsWith("/commits/main"))
          return response(200, { sha: COMMIT });
        return response(404, { message: "not found" });
      },
    }),
    /GitHub authority 404/u,
  );

  await assert.rejects(
    verifyArchiveAuthorities({
      admissions: [item],
      token: "test-token",
      fetchImpl: async (_url, options) => {
        const { query } = JSON.parse(options.body);
        const data = graphqlData(query, [item]);
        data.r0.defaultBranchRef.target.oid = "f".repeat(40);
        return response(200, { data });
      },
    }),
    /Admitted archive changed/u,
  );
});
