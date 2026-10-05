# Filtered random flight

The catalogue offers **Random flight** for the selected world's filtered flights.
The action names the world and shows the number of matches, or explains the
single/empty state. It uses the same predicate as the visible catalogue: active
installed and built-in entries, theme, activity, difficulty, completion and
localized search. Eligibility is checked again when the action is activated.

Selection excludes the most recently chosen ordinary flight when another match
exists, including a flight selected manually before returning to the catalogue.
A sole candidate can repeat. The history is transient. A choice enters the usual
scene preparation in the selected flight mode and waits for arming; no course,
physics, seed, proof, playlist or persistent preference is changed by the draw.

Ordinary results also offer **Random next flight**, scoped explicitly to that
result's world and the current catalogue filters. Lesson, playlist, authoring
preview and replay results retain their existing continuation actions. EN/UK
copy and ordinary native buttons use the existing menu/controller navigation.

Source validation against HUD parent `614adef75a6e1cc28ea1d04acf26fa69b507c551`:

- All 19 mounted World UI checks pass with the existing DOM, renderer and
  IndexedDB fixtures. Three new scenarios exercise filter/world scope,
  no-repeat after manual and random selection, a single match, empty matches,
  stale-action rechecking, EN/UK search, mode/unarmed state, unchanged authored
  courses/seeds, retained playlist entries, active versus archived installed
  revisions, result continuation and playlist suppression. Existing replay
  scenarios also assert that random-next is absent.
- Node 22 syntax, scoped ESLint, Prettier and whitespace checks pass.

The [native source review](fpv-filtered-random-flight-native-review.json) separately
records EN empty/single filtering and keyboard Enter choosing **Wide oval** in
the ordinary Ready state, with zero throttle and elapsed time. Menu retained its
exact title and suppressed the HUD. The UK world label **Сонячний дослідний парк**
and random action fit and wrapped cleanly in the 1280×720 mission modal, with no
horizontal overflow or browser warnings/errors. The retained screenshot is
linked in that receipt. This does not claim a phone viewport or physical controller.

Only this child delta was rebased onto final HUD documentation head
`b0f8555a45a41a829e2d81230a0608c72acb6c89`. The host module and tests remain
byte-exact to the native preview's frozen `a72ab6f3d` source; the preview reads
every other player file directly from the admitted `614adef75` ZIP. The runtime
delta is 3,379 bytes in one existing module. No package member, dependency or
limit was added. Fresh package admission, offline qualification and protected
stack delivery remain outstanding for this child.

Reproduce with Node 22:

```sh
node --test game/test/fpv-world-appearance-ui.test.mjs
node --check optional-practice/civilian-fpv/world-app.mjs
node node_modules/eslint/bin/eslint.js optional-practice/civilian-fpv/world-app.mjs game/test/fpv-world-appearance-ui.test.mjs
```
