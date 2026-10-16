import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const [root, baseline, candidate, recordedPath, out] = process.argv.slice(2);
if (
  ![root, recordedPath, out].every((p) => p && path.isAbsolute(p)) ||
  ![baseline, candidate].every((x) => /^[a-f0-9]{40}$/.test(x))
)
  throw Error(
    "ABS_ROOT BASELINE CANDIDATE ABS_RETAINED_NATIVE_RECEIPT ABS_NEW_RECEIPT",
  );
const require = createRequire(path.join(root, "package.json")),
  { parse } = require("acorn"),
  sha = (b) => createHash("sha256").update(b).digest("hex");
const nativeBytes = await fs.readFile(recordedPath),
  native = JSON.parse(nativeBytes),
  baseState = native.hosts[0].windows[0].before.state;
const { STICK_LAYOUTS, neutralFlightInput } = await import(
  pathToFileURL(
    path.join(root, "optional-practice/civilian-fpv/radio-profile.mjs"),
  )
);
const receipt = {
  format: "FPVStickGeometrySourceParity.v1",
  baseline,
  candidate,
  source: {},
  nativeSeed: {
    sha256: sha(nativeBytes),
    course: native.hosts[0].windows[0].before.course,
  },
  checks: [],
  limitations: [
    "Manual exact-source function comparison in NodeVM; no new permanent unit suite, browser mutation or invented flight proof.",
    "Integer width values and synthetic radio/controller inputs exercise nonzero Modes1–4 rendering only. Native geometry/lifecycle comes from separate browser checks.",
    "ResizeObserver delivery is explicitly simulated here to check sizing ownership and fallback; actual native callback timing is not inferred from this adapter.",
  ],
};
function check(ok, name, detail) {
  receipt.checks.push({
    name,
    passed: Boolean(ok),
    ...(detail === undefined ? {} : { detail }),
  });
  if (!ok) throw Error(name);
}
function source(revision) {
  const value = execFileSync(
    "git",
    ["show", revision + ":optional-practice/civilian-fpv/world-app.mjs"],
    {
      cwd: root,
      env: { ...process.env, GIT_NO_LAZY_FETCH: "1" },
      maxBuffer: 2e6,
    },
  ).toString();
  const ast = parse(value, { ecmaVersion: "latest", sourceType: "module" }),
    found = {};
  function visit(n) {
    if (!n || typeof n !== "object") return;
    if (n.type === "FunctionDeclaration" && n.id)
      found[n.id.name] = value.slice(n.start, n.end);
    if (
      n.type === "VariableDeclarator" &&
      n.id?.type === "Identifier" &&
      n.init
    )
      found[n.id.name] =
        "const " +
        n.id.name +
        " = " +
        value.slice(n.init.start, n.init.end) +
        ";";
    for (const [k, v] of Object.entries(n))
      if (k !== "start" && k !== "end") {
        if (Array.isArray(v)) v.forEach(visit);
        else if (v && typeof v === "object") visit(v);
      }
  }
  visit(ast);
  receipt.source[revision] = {
    bytes: Buffer.byteLength(value),
    sha256: sha(value),
  };
  if (value.includes("  const stickViews ="))
    found.sizing = value.slice(
      value.indexOf("  const stickViews ="),
      value.indexOf("  let stickTraceLayout ="),
    );
  return found;
}
const sources = [source(baseline), source(candidate)],
  copy = (x) => structuredClone(x),
  same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function environment(locale, options = {}) {
  const nodes = new Map(),
    events = [];
  function node(id) {
    if (nodes.has(id)) return nodes.get(id);
    let text = "";
    const classes = new Set(),
      dot = {
        style: new Proxy(
          {},
          {
            set(target, key, value) {
              events.push("style:" + id + ":" + key);
              target[key] = value;
              return true;
            },
          },
        ),
      };
    const n = {
      id,
      value: "",
      disabled: false,
      hidden: false,
      dataset: {},
      attrs: {},
      style: {},
      writes: 0,
      classList: {
        toggle(k, v) {
          if (v) classes.add(k);
          else classes.delete(k);
        },
      },
      querySelector() {
        return dot;
      },
      setAttribute(k, v) {
        this.attrs[k] = String(v);
      },
      getAttribute(k) {
        return this.attrs[k] ?? null;
      },
      get textContent() {
        return text;
      },
      set textContent(v) {
        this.writes++;
        text = String(v);
        events.push("write:" + id);
      },
      get clientWidth() {
        events.push("read:" + id);
        return options.width ?? 78;
      },
      dot,
    };
    nodes.set(id, n);
    return n;
  }
  for (const [id, value] of Object.entries({
    "flight-mode": "self-level",
    "flight-source": "keyboard",
    "flight-stick-display": "expanded",
    "sim-motion": "full",
    "flight-keyboard-preset": "two-stick",
    "flight-drone-guide": "off",
    "flight-guide-scale": "1",
  }))
    node(id).value = value;
  node("flight-title").textContent = "Native authored title";
  node("flight-menu-brief").textContent = "Native authored brief";
  events.length = 0;
  const controls = { roll: 0.25, pitch: -0.5, yaw: 0.75, throttle: 0.65 },
    logs = {};
  const env = {
    $: node,
    locale,
    txt: (a, b) => (locale === "uk" ? b : a),
    terminal: (s) =>
      ["complete", "expired", "failed", "destroyed"].includes(s.status),
    playShell: {
      update(p) {
        logs.shell = copy(p);
      },
    },
    audio: { enabled: () => true },
    updateSectorHUD() {},
    updateGhostHUD() {},
    sceneReady: true,
    ghostLookup: null,
    beginnerCoach: { blocksArm: () => false, wantsRadioPreview: () => false },
    demonstrationFor: () => true,
    checkpointSession: null,
    replayProof: null,
    replayKind: "recording",
    finished: false,
    modePractice: false,
    playingPlaylist: null,
    playlistIndex: 0,
    STICK_LAYOUTS,
    neutralFlightInput,
    flightToken: 1,
    stickTraceLayout: "",
    stickSizeLayout: "",
    listeners: [],
    disposed: false,
    stickTraces: [
      {
        reset() {},
        update(v) {
          logs.leftTrace = copy(v);
        },
      },
      {
        reset() {},
        update(v) {
          logs.rightTrace = copy(v);
        },
      },
    ],
    radio: {
      preview: () => ({
        controls: options.unavailable ? null : controls,
        stickMode: options.stickMode ?? 2,
      }),
      status: () => ({ reason: "ready", pickup: null }),
    },
    gamepad: { preview: () => ({ controls }) },
    input: { sample: () => controls },
    win: {
      performance: { now: () => 100 },
      matchMedia: () => ({ matches: false }),
    },
    paintStickDirections() {},
    paintDroneResponse(s, c, o) {
      logs.drone = { controls: copy(c), ...o };
    },
    paintCoach() {},
    keyboardFlightHelp: (preset, lang, o) =>
      JSON.stringify({ preset, lang, ...o }),
    keyboardFlightPreset: () => ({ fire: "Space" }),
  };
  if (options.observed)
    env.win.ResizeObserver = class {
      constructor(callback) {
        this.callback = callback;
        env.observer = this;
        this.targets = [];
        this.disconnected = false;
      }
      observe(node) {
        this.targets.push(node);
      }
      disconnect() {
        this.targets = [];
        this.disconnected = true;
      }
    };
  function snapshot() {
    return {
      nodes: Object.fromEntries(
        [...nodes]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([id, n]) => [
            id,
            {
              text: n.textContent,
              value: n.value,
              disabled: n.disabled,
              hidden: n.hidden,
              dataset: n.dataset,
              attrs: n.attrs,
              transform: n.dot.style.transform ?? null,
            },
          ]),
      ),
      logs,
    };
  }
  return { env, nodes, node, events, snapshot };
}
function compile(source, env) {
  vm.runInNewContext(
    (source.sizing ?? "") +
      "\n" +
      ["radioHelp", "gamepadHelp", "paintText", "paintInput"]
        .map((n) => source[n] ?? "")
        .join("\n") +
      "\nglobalThis.run=paintInput;",
    env,
  );
  return env.run;
}

for (const locale of ["en", "uk"])
  for (const stickMode of [1, 2, 3, 4])
    for (const sourceName of [
      "radio",
      "keyboard",
      "touch",
      "controller",
      "recording",
    ])
      for (const width of [0, 46, 78, 85, 106]) {
        const outputs = [];
        for (const [i, observed] of [
          [0, false],
          [1, false],
          [1, true],
        ]) {
          const options = { stickMode, width, observed },
            e = environment(locale, options);
          e.node("flight-source").value =
            sourceName === "recording" ? "keyboard" : sourceName;
          e.env.replayProof = sourceName === "recording" ? {} : null;
          const state = {
            ...copy(baseState),
            status: "paused",
            lastInput: {
              roll: 250,
              pitch: -500,
              yaw: 750,
              throttle: 650,
              actions: 0,
            },
          };
          const run = compile(sources[i], e.env);
          run(state);
          const right = e.events.indexOf("read:world-right-stick"),
            firstStyle = e.events.findIndex((x) => x.startsWith("style:"));
          check(
            right >= 0 && right < firstStyle,
            "both exact width reads precede knob writes " +
              locale +
              "/" +
              stickMode +
              "/" +
              sourceName +
              "/" +
              width +
              "/" +
              observed,
          );
          outputs.push(e.snapshot());
          e.events.length = 0;
          run(state);
          check(
            observed
              ? !e.events.some((x) => x.startsWith("read:"))
              : e.events.filter((x) => x.startsWith("read:")).length === 2,
            "stable-frame native read ownership " +
              locale +
              "/" +
              stickMode +
              "/" +
              sourceName +
              "/" +
              width +
              "/" +
              observed,
          );
          if (observed) {
            options.width = 63;
            e.events.length = 0;
            e.env.observer.callback();
            const last = e.events.lastIndexOf("read:world-right-stick"),
              write = e.events.findIndex((x) => x.startsWith("style:"));
            check(
              last >= 0 && last < write,
              "observer reads both before latest-axis writes",
            );
            const layout =
                STICK_LAYOUTS[sourceName === "radio" ? stickMode : 2],
              values = { roll: 0.25, pitch: -0.5, yaw: 0.75, throttle: 0.65 };
            for (const [side, index] of [
              ["left", 0],
              ["right", 1],
            ]) {
              const x = values[layout[index * 2]],
                vertical = layout[index * 2 + 1],
                y =
                  vertical === "throttle"
                    ? values[vertical] * 2 - 1
                    : values[vertical];
              check(
                e.node("world-" + side + "-stick").dot.style.transform ===
                  `translate(${x * (63 * 0.34)}px, ${-y * (63 * 0.34)}px)`,
                "resized exact width with retained axes " + side,
              );
            }
            e.env.disposed = true;
            e.events.length = 0;
            e.env.observer.callback();
            check(
              !e.events.length,
              "disposed callback makes no reads or writes",
            );
            e.env.listeners.forEach((f) => f());
            check(
              e.env.observer.disconnected && !e.env.observer.targets.length,
              "owned observer disconnects",
            );
          }
        }
        check(
          same(outputs[0], outputs[1]) && same(outputs[0], outputs[2]),
          "exact displayed values, labels, traces and mappings " +
            locale +
            "/" +
            stickMode +
            "/" +
            sourceName +
            "/" +
            width,
        );
      }
receipt.completed = true;
receipt.inputCases = 2 * 4 * 5 * 5;
await fs.writeFile(out, JSON.stringify(receipt, null, 2) + "\n", {
  flag: "wx",
});
console.log(
  JSON.stringify({
    completed: true,
    checks: receipt.checks.length,
    inputCases: receipt.inputCases,
    out,
  }),
);
