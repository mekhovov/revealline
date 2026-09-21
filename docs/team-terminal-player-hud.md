# Team terminal feedback

This P08 feedback correction is prepared against `fc847b18817e1cebb1439b3391e1f3d8aa7361fd`. It is a scoped candidate, not a phase or public-release acceptance.

When both craft were down with no reserves, Team ended the attempt but the HUD still offered a free rescue and told each player to crawl. The same render path showed active-flight labels after victory. The Help status paragraphs and footer also retained flight instructions. These defects follow legal imported-arena keyboard routes; no private run fields need modification.

Terminal results now show **Attempt ended** or **Objective complete**, with **Results ready** beside each numbered player. Compact HUD text uses **Ended/Complete** and **Results**. Each Help status identifies its player and names the existing Retry, Change setup, or arena-selection actions. No terminal label offers Support, crawling, or rescue. Existing flight controls remain hidden on Results.

The footer announces **Team attempt ended. Choose Retry or Change setup.** after loss, or **Team objective complete. Your shared result is ready.** after victory. The final step retains every input cleanup and event operation, but it cannot briefly write another flight instruction into the live region before publishing the result. Earlier active capture, rescue and recovery captions remain unchanged.

The change only formats finished-attempt text. A single downed craft with zero reserves still receives free-rescue and safe-ground crawling guidance. Active, exposed, recovery-shield, Support-charge and rescue-progress behavior remains unchanged. Help exits and foreground return cannot resume the simulation; Resume together and Retry remain explicit actions.

## Qualification

The focused host suite uses actual HTML, host handlers, core simulation, pack validation and prepared artwork. It compares both players' full/compact state and charge labels, Help status text, per-frame live-region writes, terminal clock/progress and the painter command stream. It exercises legal self-crossing loss, real First Connection and Relay Yard victories, each seat down alone with zero reserves, actual Relay Yard contact rescue, keyboard Help/Back/Resume and keyboard Retry. DOM, frame delivery and Canvas remain finite test boundaries, not physical-device evidence.

`game/test/fixtures/team-terminal-hud-qa.json` is a small **QA-only** import, not campaign content. Open it through “Play a created co-op pack,” choose **Expert** and **Full teamwork**, then:

- **QA only - terminal loss:** Start, tap **D**, then **Left arrow** within ten seconds. After shared recovery shows zero reserves, release the keys and repeat. Each inward lane has a stationary, valid Drifter. Observe both terminal HUD rows and Help status paragraphs. Retry must restore the same arena and initial one reserve.
- **QA only - terminal victory:** Start and tap **D** once. The empty low-quota arena completes when the cut reaches the opposite safe edge, after about 3.6 seconds. Observe Results and explicitly Retry.

These ordinary imports receive the approved historical-import artwork through the existing resolver. They contain no custom assets, hidden runtime hooks or changes to player saves. They qualify terminal presentation, not production difficulty or campaign quality.

This combined candidate includes the small terminal-message guard already held in `0a54fc85`, adapted to the existing footer element. It adds no event receipts, artwork ownership or asset changes from that wider candidate. The separate earlier HUD-only packet and its evidence remain unchanged.

When later composing the wider held presentation work, keep one terminal guard and retain that candidate's event/asset logic; its remaining player-HUD delta is recorded separately. The packet records exact preimages, byte hashes, RED and corrected runs. This completes a small terminal-cue correction, not P08 qualification. Native browser review, exact committed-source gates, versioning and publication remain coordinator-owned.
