# A First Approach Picker

I usually have a rangefinder with me. I want to enter its yardage and compare
that with the clubs I actually hit, instead of remembering approximate gaps.
I normally think about where the ball finishes, then think about carry when
there is something to clear. The interface now follows that distinction.

## Where it lands and where it finishes

The Approach tab starts with a physical club set and **Finish near** distance.
It compares that reference with reported total. Optional rangefinder
**Plays like** yardage replaces the finish reference; the signed slope angle
stays as context. The app does not apply another slope adjustment.

An optional **Must carry** input checks recorded carries strictly beyond that
distance. An optional landing area includes its front and back boundaries.
Those carry constraints need their own level-ground-equivalent distances on a
slope; the app does not derive them from the finish target's plays-like yardage.

The ranking is deliberately explicit:

- Without carry constraints, compare closeness of typical total to the finish target.
- With only Must carry, compare observed clearance first, then finish distance.
- With a landing area, compare the observed share satisfying the landing window
  and any must-carry constraint together, then finish distance.

Up to three cards show typical carry and reported total, observed middle 80%
carry range, shot/session support, and latest practice date. Missing totals
stay missing and have separate support counts. A club can rank highly on carry
constraints and still finish too long. Reported rollout is a provider estimate,
not today's ground conditions.

## What “typical” means here

Each practice session gets equal weight within a club and measurement group.
Its shots divide that weight equally. The weighted empirical median represents
typical distance; the 10th and 90th percentiles give the carry range. At an exact
cumulative-weight boundary, the calculation averages adjacent values. This keeps
one long practice session from taking over and can differ from the explorer's
unweighted summaries. Clearance and landing shares also use equal session weight.

Physical sets, providers, intent, and measurement settings remain separate.
The Practice data selector chooses one compatible context for candidate clubs.
Detailed settings are available underneath. Explorer date and tag filters do
not silently change the recommendation history.

Full and partial swings have separate selections. Unknown-intent practice shots
are included by default and labeled **Full swing · assumed**; I can exclude them
in Practice settings. The original records remain unknown. Partial suggestions
require labeled partial shots, rather than scaling down full swings or treating
a short mishit as a controlled partial shot. Genuine mishits stay in the sample.
Drivers, putters, unrecognized clubs, flagged measurements, and experimental
shots do not enter this comparison.

## What this proves so far

This is a working descriptive baseline, not an evaluated prediction model.
Observed clearance and landing frequencies are not calibrated next-shot
probabilities. The middle 80% describes recorded variation. Small histories are
labeled, but a large history or historical 100% clearance does not establish safety.
A carry inside the distance window could still miss sideways or roll off the green.

Calculations run in the browser against the loaded library. Pure TypeScript
functions are separate from React. Python reference functions and shared invented
fixtures check carry summaries and rangefinder unit handling. Frontend tests
also check finish ranking, carry boundaries, and missing totals. The regular
app build contains no private history; showcase mode bundles invented shots.

Wind, lie, ground-dependent rollout, lateral hazard risk, and recent-form
weighting remain future work. There is no trained model or demonstrated scoring
improvement. A downloadable recommendation profile and an installable offline
phone experience are also planned. Running locally does not mean the page can
reopen on a phone without a connection.
