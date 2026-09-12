# Owned offline response verification

Working v0.17.1: the focused worker suite passes **21/21 tests**, including 10 new cases. This is automated source evidence; browser installation, navigation from synthetic cached responses, and offline operation are verified separately by the release owner.

The production change is confined to [the worker template](../../../game/offline/service-worker.template.js). Downloaded responses are read once into storage bounded by the generated inventory, checked for exact byte count and SHA-256, and reconstructed from those verified bytes for both installation and missing-file repair. The template retains ordinary install/activate handlers, complete verification before cache creation, the ready marker as the last write, and cleanup of a failed partial cache. Cached inspection is unchanged. No diagnostic lifecycle bypass is included.

The [test harness](../../../game/test/offline.test.mjs) consumes every body passed to its Cache.put adapter. It uses real Response and ReadableStream objects, plus a local HTTP server with native Node fetch for gzip and Brotli. The additional cases cover:

- Original response consumption without a network clone; decoded Content-Encoding/Content-Length normalization while preserving content type, CSP, cache policy, Vary, status, and other headers.
- Oversized and trailing chunks, truncation, stream errors, invalid chunks, incorrect hashes, and missing bodies. Overrun streams are cancelled and reader locks are released on success and failure.
- Invalid per-file, aggregate-byte, and file-count budgets before download; redirected, opaque, error, partial-content, and Vary-star responses rejected before writes; valid empty 200/204/205 responses retained.
- The actual illustrated Workshop JSON through installation and cache-miss repair, comparing the complete payload hashes both times.
- An incomplete final download delaying all cache creation/writes; failed asset or ready-marker writes removing only the partial current build; failed repair preserving unrelated cached entries.

The activation assertions cover this handler's cleanup/claim guard. A rejected activation waitUntil is **not** a browser rollback guarantee: the [Service Worker activation algorithm](https://w3c.github.io/ServiceWorker/#activation-algorithm) treats activation errors differently from installation failures. Decoded body handling follows the [Fetch HTTP-network-fetch algorithm](https://fetch.spec.whatwg.org/#http-network-fetch); its delivered body need not match the encoded Content-Length header.

## Commands and retained results

Node v22.22.2, invoked through mise:

```sh
mise exec node@22.22.2 -- node --test game/test/offline.test.mjs
mise exec node@22.22.2 -- npx eslint game/test/offline.test.mjs
mise exec node@22.22.2 -- npx prettier --check game/offline/service-worker.template.js game/test/offline.test.mjs
mise exec node@22.22.2 -- node --check game/offline/service-worker.template.js
```

All final commands exited zero. The template also passed a separate ESLint API check with the repository's no-undef/no-unreachable rules, standard service-worker globals, and the generated configuration placeholder declared read-only: zero errors or warnings. This supplied the template's globals without changing the repository lint configuration.

The [first captured run](../../../.cache/round-27-1/offline-focused/attempt-1.tap) had 18 passes and three failures: the old integrity test expected the previous error wording for an oversized response, and two new hash assertions passed ArrayBuffer directly to Node's Hash.update. Test-only corrections addressed those assumptions. The [final captured run](../../../.cache/round-27-1/offline-focused/attempt-2.tap) has 21 passes, zero failures, skips, cancellations, or todos. No worker change was needed after that first captured run. No full source suite was repeated for this report.

## Exact inputs

| File                            | SHA-256                                                            |
| ------------------------------- | ------------------------------------------------------------------ |
| Worker template                 | `9da62506e2b91905594e72195ee3028b514ce3f34ec1b7d56ab8d860ef54d3e3` |
| Offline test file               | `cfed723dd92248ce0edf2d7c6109ca52cdb7193778658abd226baf39492a1589` |
| Workshop JSON, 11,127,024 bytes | `a015f79c47d8bac6cd09ba04e50c0c98d759e523eea7d225edbe62a8a5254054` |
| First captured TAP              | `8bf13265a045306abdef0717f24b6303a04b642bbcef3ac41e6b29e5c5b7ab3f` |
| Final captured TAP              | `d87663c97d52ec8f592147295432332ed6d1f7c79f08ee1d9cccadbaf55e5a6c` |

The earlier public-UI diagnostic observations support this ownership strategy; they do not establish a Chromium, disk-spooling, or quota root cause. No content, gameplay, profile, pack, replay, or frozen-release bytes were changed by this repair.
