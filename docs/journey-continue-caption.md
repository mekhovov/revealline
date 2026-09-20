# Continue names its actual Journey destination

Home's Continue caption must name the mission that the action will launch. A retained selected cursor names that mission. A completed cursor names its resolved successor, including a successor in the next campaign. The caption uses the existing Journey destination resolver and does not alter progression.

Accepted saved-flight titles keep precedence. An unfinished in-memory flight keeps its current mission name. Legacy routes without a Journey destination keep the existing mission-brief fallback.

`game/test/journey-continue-caption-host.test.mjs` seeds selected/completed progress and compares the visible caption with the mission actually started, including Prologue → Horizon School. It also checks a paused in-memory flight. A first test draft incorrectly assumed that the end of Prologue ended the opening route; inspected authored content establishes Nearby shore as its next mission. Keep that failed test receipt separate from the original, proven First return/Choose your share product defect.

This correction is separate from deciding whether the primary action is Start or Continue, and from Missions return behavior. Compose those changes without overwriting independent skill additions. Final integrated saved-flight, source, browser and public-release gates still apply.
