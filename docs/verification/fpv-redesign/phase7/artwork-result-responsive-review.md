# Responsive result follow-up

The initial artwork-led result exposed two layout issues at Large text:390×844 showed the picture while pushing score/medals below the reading viewport, and844×390 collapsed that viewport to33px. The retained images without `final` show those findings; they are not acceptance screenshots.

`game/ui/field-kit-surfaces.css` now uses a compact picture/title header with full-width score copy and a shared difficulty/medal row on smaller screens. Portrait gives the primary action the whole row. Short landscape places reading and actions in separate columns, each retaining its existing overflow and keyboard owner. Action grid rows use `max-content` so wrapped20px control labels retain their full height instead of being compressed to44px.

Actual source-browser checks at9045, Chromium153, DPR1, Large preference, normal UI and natural victories:

-390×844: first natural First Signal win (52.2%,8,160points,Gold) displays artwork, score, difficulty and medals initially. All five actions fit. Reading content is240px with no inner overflow. `artwork-result-large-portrait-final.png/.txt`.
-844×390: the same first-win result shows the full summary and all five actions; reading content is257px with no inner overflow. `artwork-result-large-short-landscape-final.png/.txt`.
-640×316 stress viewport: independent scrolling remains necessary. The held repeat-win reading area is170px for240px content, and the action area is91px for246px content. Read details→End reveals the full text/medals; Escape returns to actions. Native Tab traversal brings each present result action fully inside the action viewport; these controls are74px high with equal content/client heights, so their wrapped labels are readable. View picture→Results returns focus to View picture. The repeat-win has Next, View picture, Try again and Main menu; the first-win-only Choose appearance action was observed in the390/844 and844/390 first-win checks. `artwork-result-large-640x316-keyboard-final.json`, `*-return-final.txt`, and `*-focused-final.png`.

The640×316 check is responsive viewport emulation at DPR1, not a new native200% zoom claim. The earlier native zoom flight qualification remains separately identified. Content does not all fit simultaneously at this smallest viewport; the explicit reading control and independent action scrolling are required. The earlier `*-keyboard.json` and `*-controls.txt` exposed the compressed-row defect; only the final keyboard receipt qualifies the max-content fix. The desktop two-column result rules are unchanged from the root's separately captured desktop check.

Seven existing Field Kit surface tests pass on the final CSS (`artwork-result-responsive-tests.txt`), and the stylesheet passes Prettier. There are no simulation, profile, storage, unlock or result-handler changes in this responsive follow-up. Existing profile state was used normally; no hidden victory or result state was injected.
