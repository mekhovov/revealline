# Public offline restart setup — prepared, not executed

This is a bounded mechanism for root's later released-game browser check. No browser/profile has been launched, closed, cleared or modified by this setup. Only four local refusal-proxy tests have run. It is not public qualification, physical disconnection, an OS firewall, or proof against all browser network protocols.

Installed `agent-browser 0.27.0` help explicitly supports isolated `--session`, persistent directory `--profile`, `--proxy`, `--proxy-bypass`, `--args`, `--config` and named-session `close`. Installed skill references describe persistent profiles and proxy flags. The application must retain the **same real directory profile** across whole-browser exit and new launch; cookie/localStorage state export or `--session-name` alone is not proof of service-worker/CacheStorage persistence. The raw Chromium `<-loopback>` bypass override and `--disable-quic` are requested below; actual launch arguments and negative probes must confirm the launch behavior. Help support is not a browser qualification result.

## Scope and identity

Root must first verify the actual frozen/public artifact and final URL. Expected template is `https://mekhovov.github.io/revealline/releases/{TAG}/site/game/`; v0.57.0 is a candidate tag, not a publication claim. Worker scope should be that release's `/site/`, with `/site/service-worker.js`. Record the **actual frozen** inventory build ID, version, source SHA, exact scope and controller; never substitute the ordinary build's worker ID.

The public save channel must come from actual `game/build-info.json`, exactly as `app.mjs` does. Ordinary build version `0.57.0` uses `release-0.57.0`; frozen version `v0.57.0` uses `release-v0.57.0`. Do not strip the `v` or infer a key from the visible normalized version label. `observe-solo.js` fetches that actual read-only build record, derives the three keys and returns their raw strings/lengths/SHA plus worker and HUD observations. Run it only on the canonical Solo route; it never seeds storage or registers a worker.

## Isolated command setup

From the repository directory, in root's own command session, define these task-specific values. Substitute the final URL only after publication/identity verification:

```sh
P01_SETUP="$PWD/.cache/cross-mode/p01/public-offline-setup"
P01_RUN="$PWD/.cache/cross-mode/p01/public-offline-run"
P01_PROFILE="$P01_RUN/profile"
P01_URL='https://mekhovov.github.io/revealline/releases/v0.57.0/site/game/'
mkdir -p "$P01_RUN"
p01_browser() {
  env -u AGENT_BROWSER_AUTO_CONNECT -u AGENT_BROWSER_PROVIDER -u AGENT_BROWSER_STATE \
    -u AGENT_BROWSER_SESSION_NAME -u AGENT_BROWSER_EXTENSIONS -u AGENT_BROWSER_INIT_SCRIPTS \
    -u AGENT_BROWSER_ENABLE -u AGENT_BROWSER_PROXY -u AGENT_BROWSER_PROXY_BYPASS \
    -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u NO_PROXY \
    -u http_proxy -u https_proxy -u all_proxy -u no_proxy \
    agent-browser --config "$P01_SETUP/agent-browser.json" --engine chrome \
    --session p01-public-offline-cold --profile "$P01_PROFILE" "$@"
}
```

Use this named session/profile only. Never use auto-connect, first/all CDP targets, `close --all`, state clear, profile deletion, unregister, cache deletion or forced takeover. The empty explicit config avoids project/default configuration; launch arguments are explicit. If this session is already active or its profile is not the fresh task profile root prepared, investigate ownership before a launch. Persistent launch flags are not retroactive to an existing browser.

## Online preparation in that profile

1. Launch online only when root is ready: `p01_browser --args '--disable-quic,--disable-extensions' open "$P01_URL"`. Record actual browser PID, profile path, browser CDP WebSocket/port and target ID. `p01_browser get cdp-url` provides the selected session's endpoint; use read-only `Browser.getBrowserCommandLine` on that exact endpoint or inspect only process arguments containing the exact profile path. Retain the arguments as evidence, not the profile contents.
2. Through visible native UI, open title Settings `#shell-options`, activate `#offline-button` and observe real worker progress. Exercise `#offline-stop` with native keyboard focus, then Check progress/reconnect. Stop detaches this caller; it must not cancel shared install. Wait for real terminal ready and use Verify offline files. Record `#offline-status` state/stage/text, `#offline-details`, actual scope/controller/installing/waiting states and verified count/bytes. No fabricated progress/ready marker or direct cache population.
3. Make a real Solo attempt with the intended exact picture pin, perform a cut, pause and use `#save-attempt-button`. Capture raw storage and pin identity with `p01_browser eval --stdin < "$P01_SETUP/observe-solo.js"` to an attempt-specific output. Preserve screenshots and real input/HUD evidence. A core offline cache does not promise uninstalled optional originals; install any selected optional content ordinarily online first.
4. Record the pre-exit browser PID/CDP endpoint and saved/pinned state. Close **only** this browser with `p01_browser close`. Verify that exact browser PID exits and its CDP endpoint no longer accepts connections; record the finite observation. Do not kill other Chrome processes. If it does not exit, report that new-process coverage is blocked rather than relaunching into the existing process. Retain all profile bytes.

## Start the refusal endpoint

In a separate root-owned tool process/terminal, start the proxy, using new output names for each attempt:

```sh
python3 "$P01_SETUP/refusal_proxy.py" --port 0 \
  --events "$P01_RUN/refusal-attempt-1.jsonl" \
  --ready "$P01_RUN/refusal-attempt-1-ready.json"
```

It binds only `127.0.0.1` and answers all HTTP methods and CONNECT with 502 and `Connection: close`. It has no outgoing connection, DNS or tunnel code. Logs contain bounded timestamps, method, sanitized host and refusal status only; URL/userinfo/query/header/body content is not retained. After 1000 events the log records a cap marker and continues refusing. A capped log limits attribution: retain the attempt and use fresh log names for another attempt; never silently overwrite it. The ready record includes only the owned proxy PID/address and log location. Keep it running throughout the refused launch. The local tests exercise HTTP, CONNECT, HEAD/other methods, Expect 100 behavior, redaction and bounded logging with upstream/DNS helper calls forbidden during requests.

In the browser command session, read its exact endpoint:

```sh
P01_PROXY="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["proxy"])' "$P01_RUN/refusal-attempt-1-ready.json")"
p01_browser --proxy "$P01_PROXY" --proxy-bypass '<-loopback>' \
  --args '--disable-quic,--disable-extensions,--proxy-bypass-list=<-loopback>' open about:blank
```

This must create a **new browser PID and browser CDP WebSocket**, with the **same profile path**. Capture/inspect the actual arguments: expected proxy server, no direct/PAC fallback, no positive bypass entries, and requested QUIC disable. If flags are absent/ignored, stop this attempt. The proxy controls HTTP(S)/CONNECT for this browser's network context, including newly started workers; it does not disconnect the OS. `navigator.onLine` may remain true and is not a test oracle. DNS/background protocol absence is not claimed.

## Prove uncached traffic is refused, then navigate cold

1. Before the game navigation, in this new process, visit a fresh `http://p01-refusal.invalid/<unique-path>` and then `https://p01-refusal.invalid/<different-unique-path>` using the named browser only. They are outside every product worker/cache and must produce a proxy refusal/error. Retain corresponding sanitized-host GET/CONNECT 502 events and timing. Browser HTTPS-first behavior can change the HTTP request into CONNECT; record the observed method, and do not claim an HTTP GET that was not observed. The `.invalid` origin is only a canary: without matching proxy events, a DNS failure is insufficient proof.
2. On the exact page target, root may set `Network.setCacheDisabled({cacheDisabled:true})` through CDP before the product navigation, without clearing HTTP cache or CacheStorage. Record that page-scoped setting; do not set `Network.setBypassServiceWorker(true)`. Retain response events showing actual `fromServiceWorker` for the document/core resources. If CDP response collection is unavailable, scope the conclusion to new-process cached boot + real active controller + UI verification; do not invent worker-response attribution.
3. Navigate normally to the canonical immutable `P01_URL`, not a query-only variation and not a restored loaded tab. Record new time origin/navigation, actual render, controller script/scope, console failures and screenshots. A successful boot must be followed by real cached-file verification; if it fails, retain that failure without clearing or unregistering anything.
4. From the loaded Solo page run `p01_browser eval --stdin < "$P01_SETUP/probe-uncached-same-origin.js"`. It requests a genuinely new root pathname outside `/site/` with `cache: no-store`, omits credentials and rejects redirects. **Query-only cache busting is invalid:** this worker strips search parameters and would serve a listed file from CacheStorage. Expect a rejected fetch plus contemporaneous CONNECT 502 for the actual public host. Any resolved response, including 404, is not a pass. A timeout, CSP block, mixed-content block or unrelated failure without proxy evidence is inconclusive. Repeat once after gameplay to bound the entire measured interval.
5. The command-line evidence + actual canary refusals + worker-served product responses establish this measured HTTP(S) refusal path. They are not a general proof that no browser/OS process can contact any network. The proxy stays present; never test by killing it and assuming a fallback cannot occur.

## Restored saved flight and actual cut

Run `observe-solo.js` immediately after cold boot, before Continue, and retain raw bytes/pins compared with the online saved boundary. Pagehide or legitimate save serialization can change bytes; retain both and identify the exact changed fields/events rather than silently treating all differences as harmless. Unexpected replay/pin/profile changes are failures to investigate. No IndexedDB database should be created by a guessed-name inspector; if root inspects originals, enumerate existing databases and use readonly transactions.

Use visible `#shell-continue` or `#continue-saved`, observe real preparation and require paused state until explicit Resume. Verify the exact saved picture/owner/revision/pin. Take two bounded snapshots while paused to show no progress before input. Activate visible `#start-button` with its Resume label, perform an ordinary cut, observe actual coverage/score/canvas change, pause, and record another snapshot. Use real keyboard/touch input; do not mutate game state or call private simulation functions. Verify offline files through Settings again. A boot screenshot alone is not restored gameplay evidence. If Team is sampled, baseline Solo bytes after Solo exits and compare during Team before returning; scope pagehide and deliberate save writes separately.

## Restore online safely

Close only `p01-public-offline-cold`; verify the refused browser PID/CDP endpoint is gone. Keep the proxy alive until that exit so background workers do not regain network mid-measurement. Then interrupt only the owned proxy process (its recorded PID/command or tool session) and verify its loopback port closes; preserve logs. Relaunch the same profile with the **online** launch command above, which omits proxy flags and scrubs proxy environment variables. Inspect the new actual command line to confirm refusal flags are absent, and record ordinary online behavior. Do not change the machine's proxy settings, clear caches/saves, delete the profile, or use a second empty profile to obtain a pass.

Retain both refusal and restored-online attempts separately. No browser operation described here has been executed by the setup task.
