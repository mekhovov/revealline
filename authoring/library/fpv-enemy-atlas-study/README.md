# FPV enemy silhouette study

Seven original mechanical enemy body candidates, generated with the built-in image tool. The immutable source is `originals/seven-enemies-v1.png`; `study.json` records its checksum, actual dimensions, alpha facts and the seven existing core type IDs. This cohort does not modify the runtime registry, collision, controls, animation clocks or core metadata.

Serve this directory over HTTP and open `index.html` to compare exact 16/24/32/64 CSS-pixel frames on three backgrounds and four directions. The preview draws from recorded source rectangles; it does not edit or resave the PNG. Keyboard Tab/Enter reaches both preview controls.

The broad tracked hunter, open quad, thin twin rotor, wheeled rover, pointed drill, wide tripod emitter and finned relay provide different silhouettes. This is a source study, not seven finished presentation sets. The generator delivered 1774×887 rather than 2048×1024, so cell dimensions differ by one pixel. Low-alpha noise violates the strict clear-gutter requirement. All seven visible bodies remain separated at alpha 128, but alpha thresholds are inspection facts, not edits to the source.

Before adoption: regenerate clean individual bodies, inspect on game artwork at measured compact sizes, author independently replaceable body bindings and component anchors, and preserve rotor/tread/drill/radar motion plus warning overlays. Static PNG replacement currently removes those vector interior animations; whole-body rotation is not a substitute. Keep both bosses separate by exact type. Preserve custom role uploads and non-FPV skins.

The [seven-role runtime proposal](SOURCE-PLAN.md) describes independently replaceable bodies and live component layers. No runtime acceptance is implied by this source commit.

The native source preview loaded all seven bodies, changed heading with keyboard Enter and switched the comparison background. At 64 pixels the seven silhouettes are distinct; at 24 pixels they are too dark and detailed, and at 16 pixels the hunter and rover are hard to distinguish. The next compact generation must simplify clusters and strengthen broad highlights. This is a rejected compact-production candidate retained as useful detailed reference, not a visual quality pass. It has no gameplay or physical-device qualification.
