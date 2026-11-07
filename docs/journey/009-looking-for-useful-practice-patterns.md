# Looking for useful practice patterns

I have enough practice history now that another average-distance chart is not
the main question. I want to know what changed, which clubs overlap, and what
would be useful to practise next.

I built a rerunnable private report with a readiness inventory, recent-versus-
earlier comparisons and a carry-gap map. The first review contains 2,537 shots
across 19 physical clubs. Keeping measurement contexts separate produces 23
club/context groups; 10 have enough carry history for the initial comparison
rule: three recent eligible dates versus the preceding three, with at least
five measurements per date. Each date gets equal weight.

## The useful part is the tradeoff

For one Set A 7-iron Trackman context, typical carry is similar: about 104.4 yd
earlier versus 105.9 yd recently. Its observed middle-range width narrows from
27.3 to 20.1 yd. But its finishing-side median also moves from about 0.4 yd right
to 4.5 yd right. That is a more useful description than one overall improvement
score. It does not establish a swing cause or predict the next shot.

The Set A Driver gives a different example. Typical carry increases from about
147.4 to 150.8 yd, while the carry range widens from 25.4 to 32.6 yd. Longer and
more consistent are separate questions.

These comparisons describe different recorded windows. Three dates per period
provide limited evidence, and all shots in this snapshot have unknown swing
intent. Deliberate shorter shots may be included. I kept ordinary mishits and
did not choose windows to make the differences look better.

## Club gaps need matching practice dates

In the recent Set A Trackman window, the 7- and 8-irons have only about 0.3 yd
between their date-balanced carry medians on the two dates when both were used.
That makes their overlap worth investigating, but two dates and unknown intent
are not enough to declare the clubs redundant.

The Driver and 3-wood also show why date support matters. Their pooled median
gap is about 2.5 yd in the reference window; restricting to their two shared
dates changes the gap to about -0.5 yd. The Driver has an additional recent date
without the 3-wood. The report exposes that difference instead of treating the
two pooled samples as a controlled head-to-head comparison.

## What comes next

The report is implemented and tested with invented cases for equal-date
weighting, chronology, disjoint windows, fixed short-tail thresholds, missing
fields, club identity and sparse support. It also checks the imported distances
against the latest Trackman source payload without changing that library.

I initially built a long separate report, but I want these patterns beside my
shots. Trends now has an earlier-versus-recent band comparison, and Distances
has club bands and gaps on shared practice dates. Both follow the app filters
and work locally without a report-generation step. A focused stock-swing comparison of adjacent irons
is a useful data-collection candidate. Practice goals, annotations and bounded
shot-pattern clustering remain planned. No trained model or recommendation
change was promoted in this step.

The [practice insights guide](../practice-insights.md) explains the command, calculations
and privacy boundary. Exact dates and the generated reports stay private; the
performance summaries here are allowed numerical results under the data policy.
