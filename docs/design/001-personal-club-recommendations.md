# Personal Club Recommendations

Status: proposed initial design. No recommendation behavior is implemented.

## Goal

I want a personal caddie that understands how I actually hit each club. The
first useful result is an explainable distance-based choice. Later results
should compare risks, aim points, and layups using my own consistency.

## System boundaries

```text
Trackman CSV / manual rows / reviewed screenshot transcription
  -> source-specific validation and unit conversion
  -> canonical shot history with provenance
  -> eligible sessions and club profiles
  -> candidate clubs and supported shot intents
  -> landing outcomes under supplied conditions
  -> target and hazard scoring
  -> structured recommendation and reasons
  -> local command / phone interface / glasses client
```

Python is the initial environment for ingestion, analysis, and evaluation,
following my other projects. The responsive phone client and glasses are
delivery choices, not separate statistical models.

No production frontend or serving stack is selected yet. A local Python API
alone will not provide offline computation on a phone. Before the phone phase,
choose either browser-local scoring over a versioned profile or an API with a
clearly limited offline fallback. If scoring exists in two languages, shared
contract fixtures must verify equivalent results and units.

## First baseline

For eligible full swings, estimate typical carry by club and rank clubs by
distance from the requested target. Show sample count, dispersion, freshness,
and any missing context. This baseline does not claim a safe club when hazard
geometry is unavailable.

## Distribution model

Preserve the paired carry and lateral outcome for every eligible shot. Sampling
the empirical pairs retains observed bias, skew, and relationships between
short shots and sideways misses better than independently sampling two normal
distributions. Account for unequal session sizes so one long practice session
does not silently dominate the definition of usual performance.

Keep genuine mishits in the relevant distribution. Separate deliberate shot
types and measurement failures. With small samples, report broad uncertainty
and limited tail support rather than precise rare-event probabilities.

Carry describes airborne reach. Total distance includes an estimated resting
position and may depend on simulated ground conditions. Forced carries use
carry; rollout hazards need a separate, explicitly supported total-distance
model. Do not substitute one for the other.

## Risk objectives

Safe, balanced, and aggressive are preferences applied to the same predictive
distribution. They are not three independently invented club distances.

- Safe penalizes severe misses and may favor an aim away from hazards or a layup.
- Balanced minimizes an explicit expected outcome cost.
- Aggressive favors a rewarding target while presenting the added downside.

Begin with transparent region costs, not a claimed personalized strokes-gained
model. Expected strokes require evidence about my next shots from each lie.
If every supported candidate has substantial risk, say so and offer a supported
alternative. Do not promise a safe shot.

Show bad-but-plausible outcomes, such as a tail interval and hazard probability,
rather than a literal worst possible shot. Estimate tail probability cautiously
and propagate uncertainty in hazards and input conditions.

## Context and conditions

Initial input is measured distance, unit, and target type. Optional inputs may
include target front/back limits, hazard regions, lie, and an existing
rangefinder-adjusted distance.

Keep raw distance and an already adjusted distance distinct to prevent double
slope corrections. Target elevation and the slope under my feet are different
inputs. Wind, lie, temperature, and elevation adjustments remain explicit
approximations until calibrated. Do not infer precise corrections from a photo.

An LLM can parse a phrase such as "150 yards, water long" into editable fields
or explain the calculated result. Numerical risk, club ranking, and provenance
remain deterministic domain outputs.

## Recent data

Compare a stable profile with session-aware recency weighting. Tune the recency
rule on chronological development sessions and keep a later test period sealed.
Limit the influence of one session and show whether a trend reflects distance,
dispersion, changed equipment, or changed source settings.

On-course shot logs and simulator shots remain distinct sources. GPS-derived
shot length is not automatically carry distance. New course observations can
eventually calibrate practice-to-course differences when enough evidence exists.

## Proposed response

A response should include the recommended club and shot intent, alternatives,
aim point when supported, expected outcome range, sample support, data cutoff,
profile version, objective, input assumptions, and plain-language reasons.
Hazard probabilities are nullable when geometry or data is insufficient.

The same response contract will support local analysis, a phone client, and a
compact glasses display. It should be readable without exposing model details
that do not help me decide.

## Later vision integration

Start with phone photographs and manual hazard labels. A future glasses capture
can use the same scene-processing boundary. Visible trees, water, and bunkers
are candidate annotations; measured distances and maps anchor their geometry.
Unverified visual geometry must not become a precise hazard boundary silently.

## Deferred choices

Provider account synchronization, database selection, hosting, frontend
framework, trained trend models, map provider, and production glasses delivery
are deferred until the earlier milestones provide evidence for them.
