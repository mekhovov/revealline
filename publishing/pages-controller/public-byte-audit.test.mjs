import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import http from "node:http";
import test from "node:test";
import { auditPublicBytes } from "./public-byte-audit.mjs";

const digest = (value) => createHash("sha256").update(value).digest("hex");

async function server(handler) {
  const instance = http.createServer(handler);
  await new Promise((resolve) => instance.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${instance.address().port}/root/`,
    close: () => new Promise((resolve) => instance.close(resolve)),
  };
}

function manifest(files) {
  return {
    publishable: true,
    currentVersion: "v1.2.3",
    controllerCommit: "a".repeat(40),
    gameSourceRevision: "b".repeat(40),
    files: Object.entries(files).map(([path, value]) => ({
      path,
      bytes: value.length,
      sha256: digest(value),
    })),
    totalBytes: Object.values(files).reduce(
      (total, value) => total + value.length,
      0,
    ),
  };
}

test("streams exact public bytes with bounded workers and transient retry", async () => {
  const files = {
      "one.txt": Buffer.from("one"),
      "nested/two.txt": Buffer.from("two"),
      "three.txt": Buffer.from("three"),
    },
    attempts = new Map();
  let active = 0,
    maximum = 0;
  const host = await server((request, response) => {
    active++;
    maximum = Math.max(maximum, active);
    const path = decodeURIComponent(
        new URL(request.url, "http://localhost").pathname.replace("/root/", ""),
      ),
      count = (attempts.get(path) || 0) + 1;
    attempts.set(path, count);
    setTimeout(() => {
      active--;
      if (path === "nested/two.txt" && count === 1) {
        response.writeHead(503).end("retry");
      } else response.writeHead(200).end(files[path]);
    }, 10);
  });
  try {
    const receipt = await auditPublicBytes({
      manifest: manifest(files),
      baseUrl: host.url,
      concurrency: 2,
    });
    assert.equal(receipt.files, 3);
    assert.equal(receipt.bytes, 11);
    assert.equal(receipt.attempts, 4);
    assert.equal(receipt.retries, 1);
    assert.ok(maximum <= 2);
  } finally {
    await host.close();
  }
});

test("fails closed for a changed public body and unsafe manifest", async () => {
  const host = await server((_request, response) =>
    response.writeHead(200).end("changed"),
  );
  try {
    await assert.rejects(
      auditPublicBytes({
        manifest: manifest({ "one.txt": Buffer.from("expected") }),
        baseUrl: host.url,
      }),
      /public bytes changed/u,
    );
    const unsafe = manifest({ "one.txt": Buffer.from("expected") });
    unsafe.files[0].path = "../one.txt";
    await assert.rejects(
      auditPublicBytes({ manifest: unsafe, baseUrl: host.url }),
      /unsafe file row/u,
    );
  } finally {
    await host.close();
  }
});

test("bounds stalled attempts and cancels an oversized body immediately", async () => {
  let stalledAttempts = 0;
  const stalled = await server(() => {
    stalledAttempts++;
  });
  try {
    await assert.rejects(
      auditPublicBytes({
        manifest: manifest({ "one.txt": Buffer.from("expected") }),
        baseUrl: stalled.url,
        requestTimeoutMs: 10,
      }),
      /timeout|aborted/iu,
    );
  } finally {
    await stalled.close();
  }
  assert.equal(stalledAttempts, 4);

  let cancelled = false;
  const oversized = new ReadableStream({
    pull(controller) {
      controller.enqueue(new Uint8Array(64));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    auditPublicBytes({
      manifest: manifest({ "one.txt": Buffer.from("x") }),
      baseUrl: "https://example.invalid/root/",
      fetchImpl: async () => new Response(oversized, { status: 200 }),
    }),
    /exceeds 1 reviewed bytes/u,
  );
  assert.equal(cancelled, true);
});
