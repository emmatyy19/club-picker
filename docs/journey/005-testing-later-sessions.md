# Testing Against Later Practice

I can describe my old shots now. The next question is whether those descriptions
help predict a later practice session.

I built a repeatable carry backtest. It predicts a whole date using only earlier
dates for the same physical club and measurement context. Each date gets equal
weight, regardless of how many balls I hit. Full swings and unknown intent stay
separate. Genuine mishits remain in the data.

## The first comparison

I compared a stable mean, the median used by my descriptive baseline, and a
recent mean with a fixed three-session half-life. I did not tune that half-life
against these results. Each group needs two earlier compatible practice dates.

The real-data development run evaluated 1,515 shots across 35 dates and 13
physical approach clubs. Another 513 eligible shots supplied initial history or
had too little earlier history to evaluate. All 2,028 eligible shots have unknown
intent. Drivers account for the other 218 shots outside this approach experiment.

| Method | Mean session RMSE (m) | MAE (m) | Middle 80% coverage | Range width (m) |
| --- | ---: | ---: | ---: | ---: |
| Stable mean | 10.99 | 9.18 | 71.4% | 25.09 |
| Stable median | 11.02 | 9.14 | 71.4% | 25.09 |
| Recent mean | 10.77 | 8.97 | 70.3% | 24.00 |

Metrics average dates within each context, contexts within each physical club,
then clubs equally. The stable mean and median use the same historical range.
The recent method weights both its mean and range toward newer sessions.

Recency reduced error by about 0.22 m, roughly 2%. That is a small descriptive
difference, not a demonstrated improvement I should ship. More importantly,
the historical middle 80% covered only about 71% of later shots. The narrower
recent range covered slightly fewer. A range that describes practice history
is not automatically calibrated for the next shot.

## What this does and does not establish

I already explored this history in the app. This is a development backtest,
not an untouched final test. Folds reuse earlier history, and different clubs
can share a practice date. I have not claimed a confidence interval or scored
these as independent shots. The report exposes individual session results and
support counts so weak groups are visible.

The report also checks clearance beyond the earlier stable median using Brier
score. That moving boundary is a diagnostic shared by the methods, not a real
hazard or a calibrated water-clearance estimate.

The app keeps its existing baseline. Next I can compare a small trained model
against these methods, then reserve newly collected sessions for an honest
final check. Better carry predictions alone would not establish better sideways
misses, rollout predictions, club choices, or scores.

## Run it locally

```bash
uv run club-picker evaluate data/private/explorer/snapshot.json --output runs/carry-baseline
```

Open `runs/carry-baseline/report.html` in a browser. It works without a server or
internet connection. `results.json` contains the configuration, exclusions,
metrics, and individual folds. Regenerating replaces those two report files.
The input library and recommendation settings are unchanged.

For a fresh clone without private data, use the invented showcase library:

```bash
uv run club-picker evaluate data/synthetic/showcase.json --output runs/synthetic-backtest
```

Those outputs are an exercise with generated shots, not evidence about future
real practice. Generated reports stay ignored. Labels retain club type but use
local set/club/context ordinals. Calendar dates, original identifiers, venue
text, and raw settings are omitted. Ordinals are local to each run and should
not be joined across runs as permanent identities.
