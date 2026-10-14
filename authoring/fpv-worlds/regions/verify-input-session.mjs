/** Focused host ownership checks with actual production input adapters. No hardware claims. */
import assert from "node:assert/strict";
import { createRegionalInputSession } from "./shared-input-session.mjs";
import { keyboardFlightValues } from "../../../optional-practice/civilian-fpv/input.mjs";
class Events {
  listeners = new Map();
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
  }
  removeEventListener(type, fn) {
    this.listeners.get(type)?.delete(fn);
  }
  emit(type, data = {}) {
    const event = {
      target: { tagName: "CANVAS" },
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      ...data,
    };
    for (const fn of this.listeners.get(type) ?? []) fn(event);
    return event;
  }
  count() {
    return [...this.listeners.values()].reduce(
      (sum, entries) => sum + entries.size,
      0,
    );
  }
}
const pad = () => ({
  id: "Standard fixture",
  index: 0,
  connected: true,
  mapping: "standard",
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 16 }, () => ({ value: 0, pressed: false })),
});
function fixture(authority) {
  const win = new Events(),
    doc = new Events(),
    instances = [],
    errors = [];
  let pads = [],
    now = 0,
    camera = 0;
  doc.hidden = false;
  doc.hasFocus = () => true;
  doc.querySelector = () => null;
  win.navigator = { getGamepads: () => pads };
  const createFlight = (config) => {
    let status = "paused",
      reason = "terrain-required",
      ticks = 0,
      controls = null,
      disposed = false,
      resolve,
      reject;
    const flight = {
      prepares: 0,
      mode: config.mode ?? "self-level",
      crossingAt: config.crossingAt,
      snapshot: () => ({
        status,
        reason,
        ticks,
        controls,
        disposed,
        mode: flight.mode,
      }),
      async prepare() {
        flight.prepares++;
        reason = "preparing-terrain";
        if (config.defer)
          await new Promise((yes, no) => {
            resolve = yes;
            reject = no;
          });
        reason = "prepared";
      },
      resolve: () => resolve?.(),
      arm(input) {
        if (reason !== "prepared" || input.throttle > 0.05) return false;
        status = "active";
        reason = null;
        return true;
      },
      pause() {
        if (status === "active") {
          status = "paused";
          reason = "prepared";
        }
      },
      cancelPreparation() {
        reject?.(new DOMException("Cancelled", "AbortError"));
        status = "paused";
        reason = "terrain-required";
      },
      step(input) {
        if (ticks === flight.crossingAt) {
          flight.crossingAt = null;
          status = "paused";
          reason = "terrain-required";
        } else {
          ticks++;
          controls = { ...input };
        }
        return flight.snapshot();
      },
      setMode(value) {
        flight.mode = value;
      },
      async dispose() {
        disposed = true;
      },
    };
    instances.push(flight);
    return flight;
  };
  const session = createRegionalInputSession({
    window: win,
    document: doc,
    createFlight: authority ?? createFlight,
    onError: (error) => errors.push(error),
    onCamera: () => camera++,
  });
  return {
    win,
    doc,
    session,
    instances,
    errors,
    get camera() {
      return camera;
    },
    set pads(value) {
      pads = value;
    },
    frame(dt = 20) {
      now += dt;
      session.advance(now);
    },
    key(code, type = "keydown", extra = {}) {
      win.emit(type, { code, ...extra });
    },
  };
}
const turn = () => new Promise((resolve) => setImmediate(resolve));
let count = 0;
async function check(label, run) {
  await run();
  count++;
  console.log("PASS " + label);
}
await check(
  "keyboard gains and retained throttle are identical to production; timing stall pauses",
  async () => {
    const f = fixture();
    await f.session.replace({});
    assert(f.session.arm());
    f.frame();
    f.key("KeyW");
    f.key("ArrowRight");
    let expected = 0;
    for (let i = 0; i < 50; i++) {
      f.frame();
      expected = keyboardFlightValues({
        keys: new Set(["KeyW", "ArrowRight"]),
        preset: "two-stick",
        throttle: expected,
        seconds: 0.02,
      }).throttle;
    }
    assert.equal(f.session.flight.snapshot().ticks, 50);
    assert.equal(f.session.flight.snapshot().controls.throttle, expected);
    assert.equal(f.session.flight.snapshot().controls.roll, 0.5);
    f.frame(251);
    assert.equal(f.session.flight.snapshot().status, "paused");
    assert.equal(f.session.flight.snapshot().ticks, 50);
    assert.equal(f.session.status().controls.throttle, 0);
    await f.session.dispose();
    assert.equal(f.win.count() + f.doc.count(), 0);
  },
);
await check(
  "blur and hidden transitions cancel ownership without automatic resume",
  async () => {
    const f = fixture();
    await f.session.replace({});
    f.session.arm();
    f.frame();
    f.key("KeyW");
    f.frame();
    f.win.emit("blur");
    assert.equal(f.session.flight.snapshot().status, "paused");
    f.frame();
    assert.equal(f.session.flight.snapshot().ticks, 1);
    f.session.arm();
    f.frame();
    f.doc.hidden = true;
    f.doc.emit("visibilitychange");
    f.frame();
    assert.equal(f.session.flight.snapshot().status, "paused");
    f.doc.hidden = false;
    f.doc.emit("visibilitychange");
    f.frame();
    assert.equal(f.session.flight.snapshot().status, "paused");
    await f.session.dispose();
  },
);
await check(
  "required terrain prepares automatically but remains paused with zero retained controls",
  async () => {
    const f = fixture();
    await f.session.replace({ crossingAt: 2 });
    f.session.arm();
    f.frame();
    f.key("KeyW");
    f.frame();
    f.frame();
    f.frame();
    await turn();
    assert.equal(f.session.flight.prepares, 2);
    assert.equal(f.session.flight.snapshot().ticks, 2);
    assert.equal(f.session.flight.snapshot().status, "paused");
    assert.equal(f.session.status().controls.throttle, 0);
    f.frame();
    assert.equal(f.session.flight.snapshot().ticks, 2);
    assert(f.session.arm());
    f.frame();
    f.key("KeyW", "keydown", { repeat: true });
    f.frame();
    assert.equal(f.session.flight.snapshot().controls.throttle, 0);
    await f.session.dispose();
  },
);
await check(
  "controller neutral pickup, deliberate arm/reset/camera, disconnect and reacquisition",
  async () => {
    const f = fixture(),
      p = pad();
    f.pads = [p];
    await f.session.replace({});
    f.session.select("controller");
    p.axes[1] = -1;
    f.frame();
    assert.equal(f.session.arm(), false);
    p.axes[1] = 0;
    f.frame();
    p.buttons[0].value = 1;
    f.frame();
    p.buttons[0].value = 0;
    f.frame();
    assert.equal(f.session.flight.snapshot().status, "active");
    p.axes[1] = -1;
    for (let i = 0; i < 30; i++) f.frame();
    assert(f.session.status().controls.throttle > 0.2);
    p.buttons[11].value = 1;
    f.frame();
    p.buttons[11].value = 0;
    f.frame();
    assert.equal(f.camera, 1);
    p.buttons[0].value = p.buttons[3].value = 1;
    f.frame();
    assert.equal(f.session.flight.snapshot().status, "paused");
    assert.equal(f.session.status().controls.throttle, 0);
    p.buttons[0].value = p.buttons[3].value = 0;
    p.axes[1] = 0;
    f.frame();
    assert(f.session.arm());
    f.frame();
    f.pads = [];
    f.frame();
    assert.equal(f.session.flight.snapshot().status, "paused");
    f.pads = [p];
    p.axes[1] = 0;
    f.frame();
    f.frame();
    assert.equal(f.session.flight.snapshot().status, "paused");
    p.buttons[3].value = 1;
    f.frame();
    p.buttons[3].value = 0;
    f.frame();
    await turn();
    assert.equal(f.instances.length, 2);
    assert.equal(f.session.flight.snapshot().ticks, 0);
    assert.equal(f.session.flight.snapshot().status, "paused");
    await f.session.dispose();
  },
);
await check(
  "touch uses production pointer ownership; cancellation disarms and releases captures",
  async () => {
    const f = fixture(),
      stick = new Events();
    Object.assign(stick, {
      dataset: {},
      getBoundingClientRect: () => ({ width: 100, height: 100 }),
      setPointerCapture() {},
      releasePointerCapture() {},
    });
    await f.session.replace({});
    f.session.bindStick(stick, "left");
    f.session.select("touch");
    assert(f.session.arm());
    f.frame();
    stick.emit("pointerdown", {
      pointerId: 1,
      button: 0,
      clientX: 50,
      clientY: 50,
    });
    stick.emit("pointermove", { pointerId: 1, clientX: 50, clientY: 20 });
    f.frame();
    assert(f.session.status().controls.throttle > 0.4);
    stick.emit("pointerup", { pointerId: 1 });
    f.frame();
    assert(f.session.status().controls.throttle > 0.4);
    stick.emit("pointerdown", {
      pointerId: 2,
      button: 0,
      clientX: 50,
      clientY: 50,
    });
    stick.emit("pointercancel", { pointerId: 2 });
    assert.equal(f.session.flight.snapshot().status, "paused");
    assert.equal(f.session.status().controls.throttle, 0);
    await f.session.dispose();
    assert.equal(stick.count(), 0);
  },
);
await check(
  "replacement cancels stale preparation, disposes prior flight, and keeps mode on reset",
  async () => {
    const f = fixture();
    const old = f.session.replace({ defer: true });
    await turn();
    assert(f.session.status().busy);
    const replacement = f.session.replace({});
    await replacement;
    await old;
    assert.equal(f.instances[0].snapshot().disposed, true);
    assert.equal(f.session.flight, f.instances[1]);
    assert.equal(f.errors.length, 0);
    f.session.setMode("acro");
    await f.session.replace();
    assert.equal(f.session.flight.snapshot().mode, "acro");
    assert.equal(f.session.flight.snapshot().status, "paused");
    await f.session.dispose();
  },
);
await check(
  "closing during preparation cancels it and removes every input listener",
  async () => {
    const f = fixture();
    const pending = f.session.replace({ defer: true });
    await turn();
    await f.session.dispose();
    await pending;
    assert.equal(f.instances[0].snapshot().disposed, true);
    assert.equal(f.session.flight, null);
    assert.equal(f.win.count() + f.doc.count(), 0);
    assert.equal(f.errors.length, 0);
  },
);
await check(
  "loading block and text editing cannot arm through keyboard or controller",
  async () => {
    const f = fixture(),
      p = pad();
    f.pads = [p];
    await f.session.replace({});
    f.session.block(true);
    f.key("Space");
    assert.equal(f.session.flight.snapshot().status, "paused");
    f.session.select("controller");
    f.frame();
    assert.equal(f.session.arm(), false);
    f.session.block(false);
    f.doc.activeElement = { tagName: "INPUT" };
    f.frame();
    assert.equal(f.session.arm(), false);
    f.doc.activeElement = null;
    f.frame();
    assert(f.session.arm());
    f.doc.activeElement = { tagName: "SELECT" };
    f.frame();
    assert.equal(f.session.flight.snapshot().status, "paused");
    await f.session.dispose();
  },
);
if (process.argv[2])
  await check(
    "actual Canyon session prepares crossings atomically and requires fresh controller arm",
    async () => {
      const { createRegionalFlightPrototype } = await import(
        "./flight-prototype.mjs"
      );
      const url = new URL(process.argv[2]),
        manifest = await (await fetch(url)).json(),
        f = fixture(createRegionalFlightPrototype),
        p = pad();
      f.pads = [p];
      try {
        await f.session.replace({
          manifest,
          source: { baseURL: new URL(".", url).href },
        });
        f.session.select("controller");
        f.frame();
        assert(f.session.arm());
        let armTicks = 0,
          crossings = 0;
        for (let i = 0; i < 1400; i++) {
          p.axes[1] = armTicks < 60 ? -1 : 0;
          p.axes[2] = armTicks > 90 ? 0.3 : 0;
          f.frame();
          armTicks++;
          if (f.session.status().busy) {
            const before = f.session.flight.snapshot();
            p.axes.fill(0);
            const deadline = Date.now() + 15000;
            while (f.session.status().busy) {
              assert(Date.now() < deadline, "terrain preparation timed out");
              await new Promise((resolve) => setTimeout(resolve, 5));
            }
            const after = f.session.flight.snapshot();
            for (const key of [
              "position",
              "velocity",
              "orientation",
              "angular",
              "ticks",
            ])
              assert.deepEqual(
                after[key],
                before[key],
                key + " changed during preparation",
              );
            assert.equal(after.reason, "prepared");
            assert.equal(after.status, "paused");
            assert.equal(f.session.status().controls.throttle, 0);
            crossings++;
            f.frame();
            assert.equal(f.session.flight.snapshot().status, "paused");
            assert(f.session.arm());
            armTicks = 0;
            if (crossings === 2) break;
          }
        }
        const final = f.session.flight.snapshot();
        assert(crossings >= 1, "must cross an actual verified cell boundary");
        assert.equal(final.playerReady, false);
        assert.equal(final.terrain.flightReady, false);
        console.log(
          JSON.stringify({
            canyonSessionTicks: final.ticks,
            crossings,
            positionMm: final.position,
            recentres: final.recentres,
          }),
        );
      } finally {
        await f.session.dispose();
      }
    },
  );
console.log(
  JSON.stringify({
    checks: count,
    passed: true,
    runtime: process.version,
    hardwareVerified: false,
    playerReady: false,
  }),
);
