# A Small Model That Did Not Win

I wanted this project to include real model training, with a useful question
behind it: can a small model learn something about my recent form that a simple
average misses?

The first Ridge experiment is complete. It learned the deliberately invented
trends in a synthetic exercise, but it did not beat the recent average on my
real practice history. I am keeping it as a learning result, not putting it
into the recommendations.

## What I trained

[Ridge regression](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.Ridge.html)
is a linear model with a penalty that discourages large coefficients. I used
it to predict a correction to each club's historical mean carry. Its four
inputs come entirely from earlier compatible sessions:

- The recent mean minus the historical mean.
- The last session mean minus the historical mean.
- The change between the last two session means.
- The historical spread of individual carries.

Each physical club and measurement context gets its own model. This represents
club identity through separate fits rather than combining clubs in one model.
Providers, normalization settings, sets, and shot intents are not pooled. No
current-shot speed, spin, launch angle, or outcome enters a prediction.

I fit one session-mean residual per date, with equal weight per date. For squared
error, this gives the same fitted coefficients as using every individual shot
with equal total weight per date: the within-session variance adds a constant
to the loss. Evaluation still scores individual shots, including mishits.

## How I kept later shots out of training

The experiment freezes four candidate alpha values: 0.1, 1, 10, and 100.
Before each prediction, it uses the latest three earlier sessions as expanding
validation folds to choose alpha. Every fit requires at least eight training
examples. The feature builder needs two warm-up sessions, so a fitted prediction
requires at least 13 prior compatible dates.

[Feature scaling](https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.StandardScaler.html)
is fitted again inside each training fold. After alpha selection, the model is
refitted on all earlier eligible examples. Nothing from the predicted date is
used to choose alpha, scale features, or fit coefficients. Smaller histories
use the recent mean, explicitly labeled as a fallback.

The feature list, alpha grid, support rules, and synthetic scenarios were fixed
before the real run. This remains development evidence because I already
explored this history. It is not an untouched final test.

## What happened

On an independently invented exercise with steady, improving, and reversing
form, Ridge reduced mean session RMSE from roughly 3.63 m for the recent mean
to 2.94 m. That only establishes that the pipeline can learn the designed signal.

For my real data, five physical clubs had enough history for fitted evaluation:
46 club/context/date predictions across 15 distinct dates, covering 583 shots.
All five were in one physical set and provider context. These results do not
establish performance for the other set or provider. Another 84 eligible
club/context/date predictions used the recent-mean fallback.

The table compares only fitted dates, with the same shots scored for every method.

| Method | Mean session RMSE (m) | MAE (m) | Bias (m) |
| --- | ---: | ---: | ---: |
| Stable mean | 9.07 | 7.42 | -1.77 |
| Stable median | 8.90 | 7.26 | -0.38 |
| Recent mean | **8.76** | **7.18** | -1.34 |
| Ridge | 9.27 | 7.73 | -0.94 |

Ridge's error was about 0.51 m higher than the recent mean. It improved slightly
against that baseline for the 3-wood and 8-iron, but did worse for the 5-hybrid,
6-iron, and 7-iron. The largest regression was the 5-hybrid, about 2.18 m.
The 8-iron has only one fitted evaluation date, so its apparent improvement
has particularly weak support. I have not established the cause of the regressions. Sparse, correlated histories and unstable
relationships are possible explanations, not measured diagnoses.

Metrics average dates within context, contexts within physical club, then clubs
equally. These numbers should not be compared directly with the earlier report's
headline values, which covered a different, larger subset. Reused training
history and shared dates also mean these are not independent shot trials.
There is no confidence claim or model promotion.

## What I learned and what comes next

A more flexible model can learn a synthetic pattern and still lose on real data.
Training successfully is different from earning a place in the app. The recent
average remains a useful benchmark; this experiment does not promote it either.

Ridge produces a point estimate only. I have not assigned it a narrower carry
range, a hazard probability, or a scoring benefit. The earlier range-coverage
problem still needs its own experiment.

Before another model comparison, I want to inspect failure cases and collect
more compatible sessions. Any revised features are a new development experiment.
A candidate needs to be frozen before fresh sessions are scored for final
validation; this command does not automate prospective validation.

## Reproduce the experiment

Development dependencies include scikit-learn; the base package remains light.
The `ml` extra is available for installations without development dependencies.

```bash
uv sync --locked --extra ml
# Independently invented exercise, requiring no private data:
uv run club-picker learn --output runs/ridge-synthetic
# Personal reviewed library:
uv run club-picker learn data/private/explorer/snapshot.json --output runs/ridge-real
```

Each run produces a standalone `report.html`, `results.json` with matched
predictions, tuning diagnostics and numeric model artifacts, and
`manifest.private.json` with input/code fingerprints, dependency versions, and
private context mappings. Keep all three in ignored storage. Rerunning into the
same directory replaces them; choose a new output directory to preserve a run.

Reports omit calendar dates and source identifiers. The private manifest does
not: it contains a local path and raw context mappings and must not be published.
Final numeric fits can reproduce inference without loading a pickle, but are
experimental artifacts, not profiles installed in the app. They are indexed by
run-local context labels, with the mapping kept in the private manifest.

The report includes per-club errors, every fitted/fallback decision, support
bands, coefficients and prediction charts. Support bands compare different dates
and clubs, so they are not controlled learning curves. Coefficients describe
associations between correlated features, not causes of my swing changes.
