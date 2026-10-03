# Shot Data Contract

Status: proposed canonical contract. The first real Trackman export will inform
field mapping before schemas or importers are implemented.

## Initial record

| Field | Meaning | Requirement |
| --- | --- | --- |
| `shot_id` | Stable local identity | Required after import |
| `session_id` | Stable practice-session identity | Required |
| `session_date` | Known calendar date of the session | Required for trends |
| `captured_at` | Source timestamp and timezone if supplied | Optional; never invent precision |
| `club_id` | Stable identity for the physical club/setup | Required |
| `club_label` | Human-readable club name | Required |
| `shot_intent` | Full swing, partial, punch, experiment, or unknown | Required; unknown is allowed |
| `source` | Trackman, Toptracer, or manual input | Required |
| `source_shot_id` | Provider shot identity if available | Optional |
| `source_row` | Row or other origin reference in the retained input | Required when available |
| `carry_m` | Carry in canonical meters | Required for distance recommendations |
| `carry_side_m` | Lateral carry miss; negative left, positive right of target line | Optional; required for lateral risk |
| `total_m` | Reported total distance | Optional |
| `total_side_m` | Reported lateral resting position | Optional |
| `source_unit` | Original distance unit | Required |
| `measurement_mode` | Actual, normalized, simulated, or unknown | Required |
| `conditions` | Known ball, surface, altitude, temperature, compensation, and lie | Optional structured values |
| `quality` | Usable, suspected measurement error, or excluded | Required after review |
| `exclusion_reason` | Reason a row is excluded | Required for exclusions |

Missing lateral data is not a perfectly straight shot. Missing total distance
is not zero rollout. An unknown shot intent must not silently become a full
swing. Keep unknown settings explicit and label their limits.

## Import rules

1. Preserve the original export locally and record its fingerprint, adapter
   version, import time, units, and field mapping.
2. Convert units exactly once. Canonical meters and signed lateral coordinates
   are separate from the user's display preference.
3. Validate finite distances, explicit units, club/session identity, and source
   timestamps. Flag suspicious values rather than imposing one universal club
   yardage limit.
4. Prefer provider shot IDs for deduplication. For exports without IDs, define
   source-row identities and file/session provenance before merging repeated
   imports. Two distinct shots with equal measurements are not duplicates.
5. Report accepted, rejected, and unresolved rows before modifying the usable
   history. Preserve source data and recorded exclusion reasons.
6. Map carry-side and total-side definitions explicitly. Do not mistake curve
   for distance from the target line.
7. Preserve unknown normalization settings and avoid pooling incompatible data
   without an explicit comparison or adjustment.

## Manual input

Support a documented row template with session date, club label, shot intent,
distance unit, carry, and optional signed lateral miss. Its final header names
will be committed alongside the implemented importer and synthetic examples.

Allow a summary-only club profile as a clearly labeled fallback, but do not
fabricate shot rows from averages, best shots, or a consistency percentage.
Summary-only data cannot support the same tail estimates as individual shots.

Screenshot transcription is a proposed adapter, not implemented OCR. It must
retain the screenshot locally and present parsed rows for manual correction.

## Collection guidance

Start with roughly 20 to 30 ordinary full-swing shots per club across several
sessions as a practical initial target, not a guarantee of calibrated risk.
Rare misses need more evidence. Record normal mishits instead of selecting only
good shots. Rotate clubs and note intentional changes to the swing or equipment.

Simulator, range, and course sessions remain identifiable. Keep full and partial
wedge shots separate. Changing a club or its loft creates a new setup identity
or explicit validity period.

## Local storage boundary

Suggested ignored paths:

```text
data/raw/trackman/
data/raw/toptracer/
data/private/
data/interim/
data/processed/
artifacts/
private/
```

Only independently invented examples belong under `data/synthetic/`. Private
data remains excluded even while the repository is private. A database and
backup format will be chosen after the import contract is proven.
