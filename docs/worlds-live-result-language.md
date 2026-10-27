# Worlds retained result language

F59 adds live English/Ukrainian copy updates to the ordinary Worlds result owner.
The current accepted flight facts remain captured by the existing result. Language
changes update the existing connected text nodes and accessible names in place.
They do not finish a flight again, verify a recording again, reconstruct the
result action subtree or write completion records.

The slice covers the checking and verified result headings/notices; time/contact
metrics; medal/score line and star accessible name; both existing action rows;
practice captions; sector-summary headings, units and comparison cells; optional
gate coaching captions; and the result's random-next caption and accessible name.
The existing continuous-play view receives its public `setLocale` call, preserving
its controller and timing. Preview and failed ordinary flights keep their current
verification and award rules. Medal identifiers and score/time facts never change.

Bindings retain their flight token and stop refreshing after another flight
supersedes them. Starting a flight, closing it or disposing the host releases the
result binding owner. Disconnected checking nodes may be replaced by the existing
verification transition, but language changes never replace them. Open sector
and enemy-statistics disclosures and deliberate action focus remain intact.

Standalone practice, checkpoint practice, playback, Regional results and other
screens are separate F59 owners and are not claimed by this slice. Authored error
messages remain their existing diagnostic text. This change does not add or
rearrange navigation, change continuous-play preferences, translate every author
supplied world title or introduce new persistence.

Native-host tests reproduce the previous retained-English heading after a switch
to Ukrainian. They cover switching before asynchronous verification completes,
EN → UK → EN after acceptance, same node/action identity, focus, open sector
summary, stable state/records/non-language storage, and retirement on a new flight.
A separate ordinary preview defeat keeps its no-award state and result actions.
The DOM and renderer are fixtures; browser, physical-device, screen-reader,
acoustic, packaged/offline and public-release qualification remain separate.
