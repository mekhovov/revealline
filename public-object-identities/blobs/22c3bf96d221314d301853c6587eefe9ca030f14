# Regional ready and paused flight view

Regional free flight previously restored the full navigation bar whenever physics was not active. On a 390 × 844 viewport this wrapped controls into two rows and consumed roughly 140 px above the world; the 844 × 390 layout also retained an unnecessary blank band.

A separate presentation flag now keeps the existing compact Pause/View bar while a regional flight viewport is visible, including preparation, ready and paused states. The existing shared 44 px targets, safe-area offsets, theme isolation and camera action remain. The unused native header is hidden in this presentation state. Opening menus/options restores their normal interface; closing flight clears the flag. Active simulation status, arming, input, physics, HUD progress, World proofs and all package limits are unchanged.

Canonical styling remains in flight-fullscreen.css and is projected into style.css through the existing refresh-fpv-presentation-assets pipeline. Its check verifies byte identity, including original shared font/audio hashes. Scoped JavaScript lint and diff checks pass. No runtime module or source-file budget addition is needed.
