import assert from "node:assert/strict";
import test from "node:test";
import { authorityQuery } from "./archive-authority.mjs";

test("authority query batches repository refs and deployments without interpolating unknown ids", () => {
  const query = authorityQuery([
    { id: "archive-1", deploymentId: 10 },
    { id: "archive-58", deploymentId: 20 },
  ]);
  assert.match(
    query,
    /r0:repository\(owner:"mekhovov",name:"revealline-archive-1"\)/u,
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
});
