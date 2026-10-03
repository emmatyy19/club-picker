# Evaluation Plan

Status: proposed evaluation. No model results or scoring improvement have been
measured for this project.

## Questions

1. Does a distribution profile describe later shots better than one typical
   distance per club?
2. Does recent-session weighting improve predictions on later sessions?
3. Are short, long, and sideways outcome ranges honestly calibrated?
4. Do risk preferences respond appropriately to different hazard layouts?
5. How much do practice predictions transfer to actual course shots?

## Baselines

- Nearest median carry by club, using eligible prior full swings.
- An unweighted empirical carry/lateral profile with explicit session weights.
- A conservatively weighted recent-session profile, evaluated as a candidate.

Use identical eligible records and targets for comparisons. Record the rule,
data cutoff, settings, and exclusions. Complex candidates must justify their
cost against these baselines.

## Chronology

Split by complete session in chronological order. Use earlier sessions to fit
profiles and tune recency on subsequent development sessions. Reserve a later
test period until the candidate and thresholds are frozen. Once a test period
has influenced a decision, it becomes development evidence; collect new data
for another honest final evaluation.

Use rolling-origin evaluation when enough sessions exist. Bootstrap complete
sessions for uncertainty rather than treating neighboring shots as independent.
Report both overall and per-club metrics so common clubs do not hide weak ones.

## Predictive metrics

- Carry error and directional bias on later observations.
- Coverage and width of predicted carry and lateral intervals.
- Two-dimensional target-region coverage when suitable geometry exists.
- Brier score and calibration summaries for declared events, such as failing
  to carry a measured boundary, when actual outcomes can label those events.
- Sample counts, distinct session counts, missing fields, and data freshness.

Good calibration is not enough if intervals are uselessly wide. Narrow
intervals are not useful if they miss real outcomes. Compare both.

## Recommendation checks

Use invented course scenarios to verify the rules, including water short,
water long, a narrow corridor, sideways bias, a supported layup, and all
candidates carrying substantial risk. Missing geometry must suppress precise
hazard probabilities. Include unit conversions and already slope-adjusted
distances to catch double corrections.

Simulation can show that an objective behaves as intended. It cannot prove
that following the recommendation reduces my score. I cannot observe all
alternative clubs for the same actual shot, so counterfactual benefits remain
model estimates rather than direct measurements.

## Course validation

Record the selected club, intent, supplied conditions, recommendation version,
known target/hazard distances, actual lie, and observable outcome before tuning
from the result. Keep a simple workflow so logging does not slow play.

Distinguish measured carry from GPS-estimated total shot distance. Evaluate
practice-to-course differences explicitly. Promote adjustments only after
enough independent rounds support them; do not claim rare-event precision from
one round.

## Experiments and delivery

Record meaningful experiments with the hypothesis, eligible data, chronological
split, baseline, selected settings, results, limitations, and decision. Real
data, fingerprints, and identifying outputs remain in ignored private records;
committed experiment reports use synthetic or explicitly reviewed aggregates.

For the phone and glasses, measure interaction time, latency, dropped
connections, offline behavior, readability, and recovery. A correct statistical
model is not sufficient if entering a shot is impractical on the course.
