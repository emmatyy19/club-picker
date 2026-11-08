# What my practice history can tell me

I want to see whether my distance, consistency and sideways control are changing,
and whether the clubs in my bag cover useful distances. The comparisons
now live beside my shots in the app. They describe practice history without
changing the approach picker or scoring my improvement for me.

## Explore in the app

I want to see patterns beside the shots, without reading a separate report.
These views run in the browser with the library already loaded, including the
synthetic demo and the offline phone app.

- **Trends → Earlier vs recent:** choose a club and measurement. Two bands
  compare the latest three eligible practice dates with the preceding three.
  The dots show medians, and the bands show the middle 80%. Changes in median
  and band width appear below, without an automatic improvement verdict.
- **Distances → Club gaps:** clubs appear in normal bag order. Bands use the
  dates selected in the app. Gap labels compare adjacent clubs on dates when
  both have enough measurements. Overlapping bands make shared distance ranges
  visible. Switch to **Shots** for the original individual-shot chart.
- Existing filters, date shortcuts, playback and units apply. Comparisons never
  reach outside that selection for extra history. Each comparison date needs
  at least five measurements; six eligible dates are needed for two periods.
  Each distance band needs at least one eligible date. Tap a band for sample counts and dates; the info icon explains measurement settings.

Physical sets and recorded measurement contexts stay separate. Trends can
combine the selection explicitly, which describes that mixture. Changes in a
combined view can reflect changes in the mixture, not just changes in my shots.
Missing landing-side data stays missing. For a Toptracer side comparison, use
finishing left/right if landing data is unavailable.

**Over time** remains the per-session view, including sparse sessions. The new
period comparisons and club bands give every eligible practice date equal
weight. More shots on one date cannot overwhelm the other dates.

The normal bag order uses club families and conventional wedge order. It does
not infer my actual equipment lofts. A positive gap means the normally longer
club had a longer median on shared dates. A negative gap reverses that order.
Overlapping bands do not give a probability of one club out-hitting another.
Gap labels can use fewer dates than the displayed bands; their shared-date
count and tooltip make that distinction explicit.

## Optional reference report

The command below remains useful for a reproducible local audit and deeper
readiness, short-tail and recent-window checks. It is not needed to use the
app. Its gap map uses a fixed latest-three-date reference window, while the
interactive band view follows the selected dates. It also exposes a separate
same-date gap calculation.

### Reproduce the reference report

```bash
uv run club-picker insights data/private/explorer/snapshot.json \
  --output runs/practice-insights --unit yd
```

Open `runs/practice-insights/report.html`. The accompanying `results.json`
contains all groups, measurement availability, comparison windows, per-date
values, club bands and same-date gaps. Reusing an output directory replaces
these two files. The input snapshot stays unchanged. The report records the
input's SHA-256 and fixed support rules so a run can be reproduced.

A fresh clone can use invented data:

```bash
uv run club-picker insights data/synthetic/showcase.json \
  --output runs/practice-insights-synthetic
```

Use `--unit m` for a report displayed in metres. JSON measurements always retain
SI units; the unit option only changes the HTML distance display.

## What the calculations mean

Each practice date gets equal weight. Within a date, its weight is divided
among the eligible shots. A long bucket cannot dominate a short bucket. Quantiles
use the same empirical cumulative-mass convention as the reference approach
summary, averaging adjacent values at exact boundaries.

The short-tail comparison uses the **earlier window's carry P10 for both
periods**. It counts shots strictly below that fixed threshold, then averages
rates across dates. Recalculating each period's own lower percentile would hide
the change I want to inspect. This is not a mishit classifier or a calibrated
next-shot probability.

The reference report’s gap map uses the latest three eligible carry dates across a set and
measurement context as a common reference window. A club with fewer supported
dates inside it is marked limited. The report does not reach further back for
that club to manufacture equal support. Adjacent comparisons preserve absent
clubs rather than jumping over them silently.

Providers, physical clubs, intent, normalization, compensation, distance bases
and recorded settings stay separate. Unknown settings do not prove comparable
conditions. Reported total still includes modeled bounce and roll. Missing
landing side stays missing; finishing side cannot replace it. Genuine mishits
remain unless an explicit measurement-error flag excludes them.

## Limits

These are descriptions of recorded practice. Missing swing intent can mix
stock shots with deliberate shorter swings. A wider range or a change in median
can reflect ordinary date-to-date variation or unrecorded conditions. There is
no automatic improvement score, swing diagnosis, significance claim or fitted
model in this report.

The [first practice review](journey/009-looking-for-useful-practice-patterns.md)
records the initial numerical findings. Compact comparisons and distance bands
now live in the app. Practice goals, annotations and clustering remain planned.
Python and browser tests share an invented fixture for quantiles and period
windows. Recommendations and trained models are unchanged.

Reports contain actual practice dates, settings and private local identifiers.
Keep them under ignored storage. They are not public exports and are not copied
into the hosted app. The source code, invented tests and this explanation can be
public under the [data policy](data-policy.md).

## Distance and consistency together

In Trends, **Distance & consistency** plots one point per eligible practice date:
median carry horizontally and P90 minus P10 carry width vertically. Right means
longer carry; lower means less distance variation. This is carry consistency,
not sideways accuracy or a score of overall improvement. At least five usable
shots are required on a date. Same-date restarts combine. Genuine mishits remain.
Select a point or use the date selector to see its measurements and inspect the
shots. Existing club, source, date, unit and explicit combine controls apply.

Date playback keeps all selected dates and measurement groups visible, with fixed
axes. A ring highlights the playing date; light-to-dark green shows older-to-newer
dates. Dates without enough measurements have no highlighted point.

## Miss direction

Overhead includes a target corridor with adjustable width, centered on the aim
line. A selected physical club and measurement context show observed left,
inside and right percentages using matching carry or total sideways data.
Boundary shots count as inside. Missing sideways measurements are counted,
not treated as zero. Earlier versus recent compares the latest three eligible
dates with the preceding three, requiring five measurements per date and giving
each date equal weight. These are practice frequencies, not actual fairways hit
or predictions of future accuracy. Genuine mishits remain.

## Ball speed and carry

Trends also includes Shot relationships: one point per usable shot with recorded
ball speed and carry. Color by practice date, spin or launch angle; unknown color
values remain visible in gray. Physical clubs and measurement contexts remain
separate unless explicitly combined. Select a dot or use the shot selector to
inspect the existing shot details. Playback highlights the active date against
all selected shots without changing the axes. These are within-shot associations,
not pre-shot predictive features or a diagnosis of swing mechanics.

## Practice priorities (provisional screens)

Trends can screen the selected date range for possible practice focuses by club
set. Each physical club and full measurement context stays separate. The latest
three dates with ten usable shots each are checked for: middle-80% carry width
at least 30% of that date's median; at least 20% of shots below 80% of that date's
median carry; or at least 60% finishing more than five yards to the same side.
Direction requires ten measured finishing offsets on each of those dates.
Three crossings are labeled Repeated, two Watch. Results below those thresholds
remain visible as Observed measurements, without a practice recommendation.
Thresholds are provisional engineering choices, not validated coaching standards.
The list orders repeatability, then the 7-iron and club name, not estimated scoring benefit.
It does not infer technique or remove genuine mishits. Unknown intent is called
out because deliberate shorter swings can resemble inconsistency. Club-gap
and same-speed diagnostic screens are not yet included. No qualifying result
is an acceptable outcome and does not establish that a player has no weaknesses.

## Carry and rollout

Distances includes Carry + rollout, grouped by physical club and full measurement
context. Each eligible date needs five usable shots with both carry and total.
The bar connects date-balanced median carry and total; rollout statistics use
per-shot total minus carry, including negative differences. The middle 80% range
shows variation. These different medians need not add exactly. Rollout is a
reported distance difference rather than an exact ground path, and simulator
surface settings affect its interpretation. Clubs can have different practice
dates. Club speed and strike efficiency are available separately in Shot relationships.

## Two clubs on shared dates

Distances → Club gaps → Compare two clubs shows the two median distances and
middle-80% bands on every eligible shared date, newest first. All rows share one
distance scale. Each club needs five usable measurements on that date. The gap
is first-club median minus second-club median, so its sign preserves reversals.
Club sets and measurement contexts stay separate. The initial pair favors set-a
7-iron and 8-iron where shared dates exist. Carry and total follow the distance
control. Filters and date playback apply as they do in the bag overview.

### Club speed and strike efficiency

Shot relationships now starts with club speed versus ball speed. Color by carry
or total to compare outcomes at similar speeds within a physical club and
measurement group. Ball speed versus carry remains available. Club speed and
smash factor also appear in shot details and the trend metric selector.

Smash factor is ball speed divided by club speed, using the same speed units.
A missing or zero club speed leaves the ratio unknown. It is a descriptive
ratio, not a universal contact grade or a swing diagnosis. Report normalization
still applies to the imported measurements; this does not estimate an
unrecorded original speed. Total retains its modeled-roll limitations.

The Trackman importer reads optional `ClubSpeed` from the selected measurement
block in SI units. Reimporting a matching report can fill this previously absent
field without duplicating shots. Every other imported value must still match;
changed existing speeds remain conflicts. Legacy table-only rows cannot be
matched by label or approximate distance and remain unenriched.


## Bag consistency

In Rankings I pick a club set and compare carry distances or signed finishing
offsets. Every row uses one physical club and measurement context. The band
shows its middle 80% and the dot marks its median. Direction uses the aim line
as zero. Rows start in bag order and can also be sorted by width.

The current width uses up to three latest eligible dates within the selection.
Five usable measurements qualify a date. When every date is sparse, the row
shows up to three observed dates with a small-sample label. Six eligible dates
allow a comparison with the preceding three, giving each date equal weight.
Expanding the row shows the windows and lets me inspect the underlying shots.
