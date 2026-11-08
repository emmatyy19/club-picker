# Direction and Milestones

I want a caddie that understands my consistency and recent form, and a project
that gives me a reason to learn model training. The working app starts with
transparent statistics. More complicated models need to earn their place.

## Working now

| Area | Current behavior |
| --- | --- |
| Data foundation | Validated manual CSV imports, private SQLite storage, duplicate checks, and an audit |
| Trackman | Reusable shared-report importer with preview and repeat-import handling; no account sync |
| Toptracer | Reviewed screenshot extraction into numeric records |
| My Shots | Carry/total charts, overhead view, dispersion, tag filters, recent-date shortcuts, playback, trends, rankings, and shot inspection |
| Club identity | Physical sets remain distinct, with explicit options to combine selected data for exploration |
| Approach picker | Finish target, optional carry/landing constraints, rangefinder inputs, recorded swing intent and observed support; sources combine within each set by default |
| Phone | Static installable app, device-local library import and backups, cached assets, and offline support; device gesture checks remain distinct from browser layout checks |
| Public showcase | Hosted app starts with invented shots; merging to main automatically deploys application changes without publishing the private library |
| Evaluation | Chronological carry backtests, range diagnostics and a completed Ridge experiment; the trained candidate was not adopted |
| Practice insights | Interactive earlier-versus-recent bands in Trends and club-gap bands in Distances; optional reference reports |

The [import guide](data-import.md), [explorer guide](explorer.md),
[phone guide](phone.md), and [practice insights guide](practice-insights.md)
describe these paths. No recommendation has demonstrated on-course scoring
improvement or been established as a calibrated next-shot safety estimate.

## Next: focused practice and clearer context

The first [practice review](journey/009-looking-for-useful-practice-patterns.md)
is complete. Comparisons now live in Trends, and distance bands with shared-date
gaps live in Distances. I can explore these using the same filters and dates as
my shots. Rankings now shows consistency across my bag. I can compare carry spread or
finishing direction with each club’s earlier practice. Goal tracking is deferred.

A bounded shot-pattern experiment can follow: compare simple visual descriptions
with clusters of compatible speed/flight measurements, then check whether the
patterns recur on later practice dates. This is planned. Current-shot launch
measurements can describe a recorded shot but cannot be pre-shot inputs to the
caddie. Training and tuning use earlier dates; any untouched final check needs
newly reserved data. A negative result is still a completed learning exercise.

## From distance to risk

The current carry window is one-dimensional. A future spatial model could compare
paired landing outcomes against a target area, with explicit costs for short,
long, left and right misses. Missing lateral landing measurements limit those
claims. Reported total does not model today's ground conditions.

Course feedback will matter before I trust practice-to-course adjustments or
claim better scoring. Expected strokes requires evidence about shots played
afterward, not just a distance chart.

## Longer-term ideas

Quantile models and Bayesian partial pooling remain possible learning experiments,
subject to chronological evaluation. The [modeling approach](approach.md) records
their intended questions and the completed regression comparison.

Camera input, course geometry, voice and glasses remain future work. They should
reuse calculated recommendation results rather than invent probabilities. Maps,
weather adjustments, accounts and cloud synchronization need a concrete reason
and their own validation before adding infrastructure.
