# Controlled feedback comparison

`BoardPainter.draw` accepts an optional developer comparison override:

```js
painter.draw(context, run, deltaSeconds, {
  // All existing host options remain independent.
  feedbackComparison: {
    captureAccent: true,
    eventAccents: true,
  },
});
```

Omit `feedbackComparison` for the accepted presentation. Only an explicit `false` disables one of the two additive decorations. The renderer neither persists these flags nor changes a run, replay, mission definition, saved appearance or active asset binding.

| Control             | Disabled decoration                                               | Information retained                                                                                        |
| ------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Capture pulse       | The brief pulse inside newly secured, still-safe cells            | Actual picture reveal and territory, safe boundaries, exposed trail, capture result and current hazards     |
| Extra event flashes | The additional redeploy expanding ring and loss screen-edge flash | Event-time contact/debris marker, loss label, shield/pickup messages, recovery countdown and current actors |

These are not “all effects” or “actor reactions” switches. Contact radii, live line fronts, threat lanes, pursuit/interception warnings, stun/slow states, actor facing, queued direction and other functional information remain on. An independent actor-reaction switch is deferred until optional motion can be separated from those meanings safely.

Feed the same run, event sequence, delta, pause/recovery policy and accepted art to both painters. Apply overrides only to the comparison view. Effect ages advance and expire normally while decoration is hidden; re-enabling a control never restarts an event. Existing pause ownership and the terminal-loss animation exception remain unchanged. Reduced effects may already suppress these decorations, so the visual difference can intentionally be zero in that mode.

`game/test/feedback-comparison.test.mjs` checks complete Canvas command identity for default options, independent toggles, preserved threat/contact/cut/status cues, effect expiry, pause ownership and simulation checkpoints. This is command and state evidence, not physical-device, raster or public-release acceptance. Actual side-by-side play remains required when choosing the final presentation.
