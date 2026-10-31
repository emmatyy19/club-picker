# My Shots, Together

The local explorer puts reviewed practice shots in one view. I can switch carry
and total, combine club/source/set filters, inspect a shot, and select sessions
or a date range. The Approach tab adds a [first club comparison](journey/004-a-first-approach-picker.md)
using finish distance and optional carry constraints. Phone installation and
offline cold starts remain future work. To try invented shots without a private
library, use the [synthetic demo](demo.md).

## Run locally

Use Node 22.12+ or Node 24 and Python 3.12 with uv. From the repository root:

```bash
uv sync --locked --all-groups
npm ci --prefix web
npm run dev --prefix web
```

Open <http://127.0.0.1:5173>. If using nvm, `nvm use 24` selects a compatible
installed runtime. Keep the development process running while using the app.
The server binds to this computer's loopback address. No account or hosting
service is needed. Initial dependency installation needs internet access;
normal local exploration does not use an external service or CDN.

## Prepare a library

PDFs and screenshots still need extraction and review into the
[manual CSV format](data-import.md). The UI accepts a versioned explorer JSON
snapshot, not original provider exports. Shared Trackman report links can use
the reusable importer in the [import guide](data-import.md); this is a local
command, not a browser upload feature. Here is a complete invented example:

```bash
uv run club-picker snapshot data/synthetic/shots.csv \
  --session-set manual/invented-001=example-bag \
  --session-set manual/invented-002=example-bag \
  --output data/private/example-explorer.json
```

Choose **Data settings → Restore backup**, select that file, review the session-to-set assignments,
and confirm. The importer rejects inconsistent identities, invalid measurements,
unknown fields, and conflicting duplicates. Exact repeats count once. Importing
**replaces** the browser library; it does not append or silently enrich old shots.
Export a backup before replacing a library you want to retain.

Pass multiple reviewed CSV paths to the snapshot command to create a combined
library. Each session needs an explicit `SOURCE/SESSION=SET` assignment. Confirm
the physical set with the owner for every new ongoing session; do not infer it
from Trackman or Toptracer unless the owner has explicitly authorized a standing
default. Club IDs in the CSV must already be set-specific.
Changing a set label in the UI does not create a new physical club identity.

The exporter reads CSVs without changing the main SQLite store. Its snapshot
includes private session dates and context. It is **not a public-data export**.
Keep snapshots under ignored storage, outside `web/`, Git, and published assets.

## Everyday workflow

Put PDFs, screenshots, and report links in a new session folder under
`data/raw/trackman/` or `data/raw/toptracer/`. These folders are ignored by Git.
Confirm which physical club set you used when asking for extraction and review.
Dropping raw files here does not parse them automatically.

After review, regenerate the combined library at
`data/private/explorer/snapshot.json`. The development app reads this file on
every opening, ahead of any old browser backup. **Refresh data** reads it again
while keeping current filters. A failed refresh keeps the displayed library and
shows an error. A missing or unreadable file on opening permits a browser backup
fallback, clearly labeled. This fixed local file is not included in the build.

## Explore

Library totals stay at the top, followed by the visualization. **Filters** and **Dates** are closed by default
below it. The small shortcuts near the chart show the current selection and
open the corresponding section. **Back to chart** returns to the visualization.
Closing a section keeps its selections and the chart viewport.
Filter/date shortcuts, playback steps, session rows, and detail disclosures have
visible button borders or backgrounds. Plain legends and summary values stay
static. Play and Pause use the same space so nearby controls keep their positions.

- **Visible tags:** open Filters to see all available values. Neutral buttons
  select data; colors belong to the plot legend. Click a chip to toggle it;
  all available values remain visible.
  Grouped mode uses OR within each field, AND between fields. All/Any supports
  flat AND/OR across every selected tag. Dates narrow either kind of query.
- **Timeline:** open Dates, then click a session or drag the range handles and selected window.
  Date inputs offer a keyboard alternative. All dates includes undated shots.
  Browse sessions opens a fixed-height list, newest first and grouped by month.
  Rows show date, source, physical set, and the full session's shot count.
  The browse-year selector only changes the list, not the chart selection.
  The selected session stays visible beside All dates when the list is closed.
- **Carry and total:** use the matching lateral measurement. Missing carry-side
  cannot be replaced by final-resting offline. Distances shows shots without side
  measurements; availability counts explain what is absent from the scatter plot.
- **Summaries:** physical clubs and measurement contexts remain separate even
  when their tags are selected together. Genuine mishits stay in the sample.
  Flagged measurement errors remain in the table but are excluded from summaries.
- **Shot details:** click a dot, choose a shot, or select its table button.
  Clear in the inspector header removes the selection. Measurement details
  holds the setup fields and original identifiers.
- **Save filters / Restore filters:** stores one filter/date selection in this browser.
  Units, metric, color dimension, and chart preferences also persist separately.

Clubs follow conventional bag order: driver, numbered woods, hybrids, irons,
then wedges by nominal loft (PW, GW/AW, SW, LW). This is display order, not a claim
about measured yardage gaps. Set badges keep their own colors. Legends include
only shots actually drawn in the selected view.

The middle 80% is the linearly interpolated P10–P90 distance range. Ellipses use
sample covariance for orientation and an empirical Mahalanobis-distance cutoff
to include at least the selected share of observed paired shots, including ties.
They are suppressed below 10 paired shots or with singular covariance. This is
a display rule, not calibrated next-shot probability.

**Combine selection** is a checkbox in Stats chart and Overhead. Unchecked, it
draws one ellipse per physical club and measurement context. Two physical clubs
can therefore have three ellipses if one club was measured by both providers.
The dot legend explains colors; the ellipse legend identifies each contour by
club, set, source, and its enclosed/paired shot count. Line patterns distinguish
contexts with the same color; additional settings are available on hover.

Checking **Combine selection** fits a single ellipse to all currently plotted shots,
including selections across sets or sources. It pools individual shots rather
than averaging the separate ellipses. Each shot counts equally, so larger
sessions contribute more. This describes the selected mixture; club identities,
club summaries, trends, and rankings keep their original grouping. Missing or
excluded positions do not enter the pooled ellipse. The grouping preference is
remembered in this browser, and the 10-pair/covariance rules still apply.

**Stats chart** plots reported distance vertically against left/right offset.
It compares yardage and sideways consistency, rather than showing a course map.
Scroll over the plot or use +/− to zoom. Drag to pan; the focused plot also
supports arrow keys. Reset view restores the full extent. Zoom and pan affect
only the viewport, not filters or statistics. Overhead keeps equal axis scales.
Changing metric, unit, or view resets navigation; filtering and point selection
preserve it. Distance-by-club supports vertical navigation.

**Overhead** converts radial distance r and side x to forward distance
sqrt(r² − x²), uses equal axis scales, and draws distance rings from the origin.
Ellipses are recomputed in the displayed coordinates. Distances and summaries
retain the original reported measurements.

The faint dotted overhead edges are a **40-yard fairway reference**, centered
on the target line at 20 yards left and right. They convert to ±18.288 m in
meter mode and move with the chart during pan and zoom. This is a visual guide,
not a measured fairway or a calculated fairway-hit probability.

**Trends** uses the same tag and timeline selection. Choose a metric and either
one physical club or **Combine selection** to include every selected club/set.
Combined mode pools the available measurements per date, across sources and
sessions on that date, with equal weight per shot. It computes daily medians and
P10–P90 bounds from the raw measurements, rather than averaging group summaries.
Changing the mix of clubs or sources can therefore change the combined trend.

Under **Measurement details**, **Separate measurement groups** is checked by default
when multiple setups exist. It displays each compatible context with its own
symbol and legend label. Unchecking it pools that club's measurements by date.
Normalization and other setup details live under **Measurement details** instead
of a required dropdown. Unknown settings remain unknown. Combining does not
rewrite any club identities or source metadata.

Dots show medians, and translucent vertical bars show the observed P10–P90
range. Turn on **Individual shots** to see each measurement and click one to
inspect it. The date slider and scroll zoom change the chart viewport without
changing filters. **Session values** provides counts and exact summaries.
No curve is fitted or interpolated across gaps between sessions.

The chart views sit in their own large row above all other controls. Playback
and **Chart settings** stay above the visualization in every mode. Settings
opens in a scrollable dialog so it stays inside the screen without moving the plot. **Play dates**
steps through dates with available plotted measurements in the current selection,
oldest first. Trends also respects its club and metric choice. Multiple providers on one date form one playback frame. Pause, the previous
and next buttons, and 1/2/4-second speeds control playback. **All dates** in the
playback row restores the full selected sample without changing the filters.
The controls keep their positions during play, pause, and reset. Unavailable
controls stay in place and become disabled.
Stats chart, Overhead, Distances, and Rankings show each date separately. Trends
reveals history up to the current date, with fixed axis bounds and an emphasized
current-date median. Changing filters resets playback; undated and excluded-only
data do not create frames; dates without an eligible chart measurement are skipped. Playing again from the end restarts the sequence.

For **Left / right** and **Sideways spread**, choose Landing or Finishing.
Negative offsets are left and positive offsets are right. Spread is the
session's P90 minus P10 sideways width, requiring at least two measurements.
It describes consistency separately from median left/right bias. It is not a
2D ellipse width or a future-shot interval. Missing side data stays missing.
Single-session views are labeled as snapshots rather than change over time.

**Rankings** orders compatible physical-club groups by a selected measurement
and statistic, using the same tags and date range. Smaller P90–P10 distance width
means more repeatable yardage; smaller sideways width means tighter lateral
grouping. A tight group can still be consistently off target, so **Smallest
typical sideways miss** ranks the median absolute offset instead.

**Relative distance spread** is 100 × (P90 − P10) / median distance. It helps
compare spread relative to club length, since wedges usually have smaller
absolute yardage ranges. A zero median cannot supply this ratio. Highest/lowest
median rankings are also available for distance, speed, spin, and flight metrics.
There is no combined stability score or claim about next-shot reliability.

Rows show measurement counts, dated session counts, the median, and the actual
middle 80% bounds. The default requires 10 measured shots per group; this is a
display threshold rather than proof of statistical reliability. Range rankings
always require at least two shots, even under All samples. Counts with fewer
than 10 shots or two dated sessions have a dotted underline. Hover or focus
these counts for the sample note. An asterisk marks included undated shots.
Measurement Details opens the full setup in a scrollable dialog without expanding a row.
The ranking table scrolls under a fixed header, and the shot inspector stays
beside every view. Undated measured shots can contribute when the date filter
allows them, but do not count as dated sessions. All shots have equal weight;
longer practice sessions therefore contribute more. Exact ties share a rank.
Clubs and measurement contexts stay separate, and cross-provider comparisons
retain their differences; use source tags when a single-provider comparison is
more useful. Rankings describe the selected history, not a trained forecast.

Ball speed appears in mph with yard mode and m/s with meter mode. Spin uses rpm;
angles use degrees and hang time uses seconds. Optional reviewed snapshot fields
are `ball_speed_mps`, `spin_rpm`, `launch_deg`, `apex_m`, `landing_deg`,
`hang_time_s`, and `curve_m`. The browser validates these finite, explicitly
allowed measurements and preserves them in backup round trips. Older snapshots
remain supported; unavailable measurements are shown as missing, never zero.
The CSV snapshot command still exports its existing distance contract. Flight
fields require a reviewed extraction/enrichment step; raw extra columns are
not automatically imported. The local history now includes both providers'
ball speed, Trackman spin, and Toptracer flight measurements where reported.

Trackman explicitly defines [total as straight-line distance](https://support.trackmangolf.com/hc/en-us/articles/39727276786843-Parameters-Total-Tee-to-Green)
and [carry at the launch elevation](https://support.trackmangolf.com/hc/en-us/articles/39726543090971-Parameters-Carry-Tee-to-Green).
The overhead reconstruction assumes flat ground and a forward endpoint; it is
not an actual course map or trajectory.

[Toptracer's parameter guide](https://toptracercoach.helpscoutdocs.com/article/142-shot-parameters)
confirms total includes carry and roll, and offline is final lateral displacement.
It does not explicitly settle radial versus downrange distance. I checked
identifiable dots against the yardage rings in two of my saved Total Distance
overviews. A 175-yard shot with 46 yards right appears about 169 yards forward;
a 154-yard shot with 37 yards right appears about 149 yards forward. Both match
sqrt(total² − offline²), within rounding and screenshot precision.
This is evidence from the captured app format rather than a manufacturer
specification for every setup. Toptracer totals now appear in overhead by default
without an assumption toggle. Carry is not promoted by these total-only checks.
Unknown-provider geometry and impossible pairs
(abs(side) > distance) are omitted, with counts. Missing landing-side data is
never replaced by final offline.

The client uses [Mantine controls](https://mantine.dev/guides/vite/) and
[Apache ECharts](https://echarts.apache.org/handbook/en/how-to/chart-types/scatter/basic-scatter/).
Python validates and exports the data; deterministic browser tests check the
filtering, grouping, units, and descriptive math against known examples.

## Storage and backup

The processed repo file is the main library during local development. Browser
filter and display preferences stay at this exact origin; a different port,
browser, or `localhost` instead of `127.0.0.1` has separate storage.
Save filters has one slot and overwrites the previous saved selection.

Under **Data settings**, **Export backup** downloads the complete displayed
snapshot, including private session dates and measurement context.
**Restore backup** replaces and saves the browser copy after assignment review.
Neither action writes to the repo. Refreshing or reopening uses the repo file
again when available. Without the development file endpoint, the static app uses
the browser copy. View preferences and original source files are not included in
the JSON backup. Clearing site data does not remove repo files.

`npm run build --prefix web` creates a static app in `web/dist/` without private
shot history. `npm run preview --prefix web` serves that build locally after
stopping the development server. Runtime assets are bundled. An installed phone
app, service-worker caching, cloud sync, provider account synchronization, and
trajectory reconstruction are not implemented. A separate [showcase build](demo.md)
bundles invented shots for an interactive demonstration.

## Check changes

```bash
npm run format:check --prefix web
npm test --prefix web
npm run build --prefix web
```

The [development guide](development.md) lists the Python checks. Frontend checks
also run in CI, using invented fixtures with no dependency on private files.


### Explicit total geometry

The snapshot may include `total_distance_geometry: "radial"` when the data's
construction or reviewed source establishes that total is straight-line distance
from the start. The synthetic showcase uses this field. Omitted or `unknown`
geometry does not qualify otherwise unverified manual data for overhead. This
field says nothing about carry geometry. Existing Trackman and reviewed Toptracer
total handling is unchanged.
