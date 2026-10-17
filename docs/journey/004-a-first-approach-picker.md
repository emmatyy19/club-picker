# A First Approach Picker

I usually have a rangefinder with me. I want to enter its yardage and compare
that with the clubs I actually hit, instead of remembering approximate gaps.

The local app now has an Approach picker beside My Shots. I choose my physical
set and enter the target distance. If my rangefinder gives a slope-adjusted
“plays like” distance, that becomes the carry target. The optional signed angle
stays as context. The app does not apply a second slope adjustment, or invent
one from an angle alone.

The first suggestion is deliberately simple: the club with the closest typical
carry, followed by up to two alternatives. Each card shows its carry difference,
observed middle 80% range, shot and session counts, and latest practice date.
Drivers, putters, unrecognized club labels, flagged measurements, and
experimental shots do not enter this approach comparison. Full and partial
swings have separate selections; partial suggestions require recorded partial
shots and do not scale down a full-swing distance. Genuine
mishits stay in.

## What “typical” means here

Each practice session gets equal weight within a club and measurement group.
Its shots divide that weight equally. I take the median of that weighted
empirical carry distribution, and its 10th and 90th percentiles for the range.
At an exact cumulative-weight boundary, the calculation averages the two
adjacent values. This prevents one long practice session from taking over the
comparison. It also means these values can differ from the explorer's
unweighted summaries.

Physical sets, providers, intent, and measurement settings remain separate.
The Practice data selector chooses one compatible context for all candidate
clubs. The detailed settings are available underneath. Explorer date and tag
filters do not silently change the recommendation history.

My imports do not label shot intent. Unknown-intent shots are included by
default, so entering a distance produces a comparison immediately. Their cards
say **Full swing · assumed**. I can turn this off in Practice settings. The
original data remains unknown, and confirmed full swings stay in their own group.
Partial-swing advice requires labeled partial practice; a short mishit is not
evidence of a controlled partial swing.

## What this proves so far

This is a working descriptive baseline, not an evaluated prediction model.
The middle 80% is recorded variation, not a calibrated chance of hitting the
green. Small histories are labeled, but a larger history is not a reliability
guarantee. The picker also flags targets outside the candidates' typical carries.

Calculations run in the browser against the locally loaded library. The pure
TypeScript functions are separate from React. Python reference functions and
shared invented fixtures check carry summaries and rangefinder unit handling
against the browser implementation. No private history enters the app build.

Wind, lie, rollout, lateral hazard risk, and recent-form weighting are still
future work. There is no trained model or demonstrated scoring improvement.
A separately versioned downloadable profile and installable offline phone
experience are also still planned. Running locally does not yet mean the page
can reopen on a phone without a connection.

## A carry window

I can now optionally enter front and back carry distances. With a window enabled,
the picker ranks clubs by their observed share inside it, breaking ties by
closeness to the target. Each card shows short, in-range, and long percentages,
with equal session weight and both edges included. With the window off, the
nearest-median baseline remains available.

These are descriptive historical frequencies, not evaluated next-shot
probabilities. A carry in this distance window could still miss sideways or roll
off the green. The fields use level-ground-equivalent carry: if I use plays-like
numbers on a slope, I must provide adjusted distances for both edges. The app
does not infer their slope adjustment from the target's plays-like distance.

## Where it lands and where it finishes

The main input is now **Finish near**, compared with reported total rather than
carry. Cards show both typical carry and reported total, with separate support
counts for missing total measurements. Total measurement bases remain separate.
Reported rollout is a provider estimate, not today's ground conditions.

An optional **Must carry** input checks recorded carries strictly beyond that
distance. With a landing area, the ranking first compares the session-weighted
share that satisfies both carry constraints, then closeness of reported total
to the finish reference. Without a landing area, a supplied must-carry constraint
ranks observed clearance first; without either, finish distance determines order.
This ordering is explicit and has no tuned risk threshold or expected-strokes
claim. A high-ranked club can still finish too long, especially without a landing
area. Small samples and historical 100% clearance do not establish safety.

Plays-like yardage changes the finish comparison reference only. Must-carry and
landing boundaries need their own level-ground-equivalent distances on a slope.
No rollout, terrain, or sideways hazard model is inferred from those inputs.
