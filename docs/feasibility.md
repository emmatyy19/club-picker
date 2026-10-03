# Feasibility Investigation

Research date: October 3, 2026. Vendor capabilities may change. The owner uses
Trackman simulator or coach sessions. No account data, export, or glasses
integration has been tested for this project yet.

## Trackman

Trackman documents individual-shot CSV export from Performance Studio (TPS):
Practice, Shot Analysis, Shot Library, session selection, Table View, export,
and Trackman CSV. This can also be done during a live Shot Analysis session.
See the [official CSV guide](https://support.trackmangolf.com/hc/en-us/articles/12985883274139-Shot-Analysis-How-To-Export-A-CSV-File-From-TPS).

Shot Analysis sessions from TPS and Golf Pro can upload to the player/coach
portal, where Trackman documents viewing and exporting data. Upload allowances
depend on subscription. This does not prove that every simulator mode or phone
app exposes the same export.
See [automatic report sharing](https://support.trackmangolf.com/hc/en-us/articles/41434874801819-Shot-Analysis-Automatic-Report-Sharing).

I will start with one CSV requested from my coach or simulator facility. I have
not established a supported personal account API or automatic synchronization
route. Neither is required for the first application.

## Toptracer

My Practice records club-specific statistics in the player's profile when the
player logs in. Warm Up has different persistence: logged-in sessions appear
in Last Session Recaps rather than as full sessions.
See [official game-mode documentation](https://help.toptracer.com/article/64-game-modes-on-toptracer-range).

I could not verify a standard player-facing CSV export in the documentation
reviewed. Toptracer's CSV/XLSX dashboard downloads concern range operations and
must not be mistaken for a personal shot-data export.
See the [range analytics dashboard](https://help.toptracer.com/article/55-navigate-the-dashboard).

Possible fallback inputs are manual shot entry, screenshots transcribed into
reviewable rows, or a facility-supported export. Any screenshot importer must
show parsed values for correction. Summary statistics cannot reconstruct an
individual-shot distribution. Supported player API access remains an open
question; lack of verified access is not proof that no API exists.

## Comparing practice sources

Trackman normalization can remove wind effects and adjust ball type, altitude,
and temperature. I must preserve those settings instead of treating all
reported distances as interchangeable.
See [normalization instructions](https://support.trackmangolf.com/hc/en-us/articles/22372077711643-Shot-Analysis-How-To-Use-Normalization).

Toptracer also documents facility-configured ball compensation.
See [range settings](https://help.toptracer.com/article/27-range-settings).

Differences between mats and grass, practice and course lies, balls, and device
settings are modeling concerns. The application will keep their provenance and
validate transfer to course play rather than silently pooling everything.

## Recommendation model

Engineering proposal: use club-specific empirical shot distributions before
training a complex model. Paired carry and lateral observations support
simulation of plausible landing outcomes. A distance-only baseline is easy;
hazard-aware advice requires target geometry and miss costs.

Engineering proposal: blend recent sessions with a longer baseline, tune using
chronological development sessions, and evaluate on later sessions. Scarce data
limits tail-risk estimates. A literal worst case is not a useful finite bound.

## Meta Ray-Ban Display

Meta documents standalone glasses Web Apps using HTML, CSS, and JavaScript,
with display, text entry including dictation, location, connectivity, and
audio playback. Personal testing supports adding a hosted URL in Developer
Mode. This is a credible route for a compact recommendation interface.
See [Web Apps](https://developers.meta.com/wearables/web-apps/) and the
[developer FAQ](https://developers.meta.com/wearables/faq/).

Meta's Device Access Toolkit extends iOS and Android apps to glasses and
documents camera, microphone/audio, and display capabilities. Meta says its
supported 1.0 release began rolling out September 30, 2026. Firmware, app
versions, device capability, and regional availability still need checking on
the owner's hardware.
See [Device Access Toolkit](https://developers.meta.com/wearables/device-access-toolkit/)
and the [official display sample](https://github.com/facebook/meta-wearables-dat-ios/blob/main/samples/DisplayAccess/README.md).

For direct glasses-camera access I will prototype the mobile toolkit. I will
not assume the Web App has the same permissions or hardware APIs. Public app
discovery and distribution are separate from personal developer testing.

## Course photographs

Engineering assessment: photographs can help identify visible hazards and a
constrained corridor. A single image does not reliably establish physical
width, hazard distance, hidden terrain, or branch clearance. Measured yardage,
GPS, course maps, and user correction should provide geometric anchors.

Tree clearance requires trajectory information. A landing-distance profile
alone cannot establish whether a shot passes over or under a branch.

## Rules of Golf

Rule 4.3 prohibits measuring elevation changes and location-based electronic
club or line recommendations during rounds played under the Rules of Golf.
Accessing information gathered before the round has different allowances.
The full recommendation mode is intended for practice and informal use; any
future rules mode needs a separate reviewed feature boundary.
See [R&A Rule 4.3](https://www.randa.org/en/rog/the-rules-of-golf/rule-4).

## Unresolved questions

- What exact columns and units does my Trackman export contain?
- Which reported measurements are normalized, actual, or simulated?
- Can my Toptracer account expose individual shots in a supported format?
- How much representative data do I have per club and shot type?
- What phone and software versions will host the glasses integration?
- How will browser calculations work when the course has no connection?
- Can I obtain suitably licensed course geometry, or start with manual hazards?
