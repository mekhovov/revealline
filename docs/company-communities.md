# Company communities

The static [public directory](../game/communities/index.html) opens the main game
and all current public community brands without an account or backend request.
The two DroneAid collections share a directory card, but retain separate edition,
save and artwork identities. There are 18 public edition selectors across seven
brand records; aggregate selectors do not create additional campaigns.

Friendly URLs under `game/communities/<slug>/` load the one shared Solo document.
They keep the friendly address visible, rebase resources to `game/index.html`,
and reject foreign/duplicate edition overrides before loading. Coupa, DroneAid
Netherlands and Community Relay retain the original #784 routes. Social Drone UA,
Victory Drones, Ukraine: Living Culture and FPV Learning preserve newer content.
Installed edition identities, public aliases, retained presentations, Studio
preview isolation and the Solo-v2 saved-attempt envelope remain unchanged.

Campaign selection and final navigation remain within the selected brand; asset
URLs must belong to the selected edition closure. This is public navigation and
save isolation, not authentication or access control for private deployments.

`game/community/` redirects to the directory. Its former marketplace is preserved
at `game/community/store.html`, including current input support and account UI.
The marketplace and moderation tools require the existing same-origin community
service; GitHub Pages does not supply its account or catalog API.

Original source lineage: closed PR #784 at
`ff56e0881e7355ebe3e07e0804827dc9b256fb50`. Historical screenshots and test reports
remain at that preserved commit; they do not qualify the current composition.
No historical release, published asset or tag is rewritten by this recovery.
