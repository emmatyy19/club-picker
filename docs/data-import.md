# Local Shot Imports

I can now preview individual shots, keep a private copy of the original file,
and inspect what evidence I have for each club. This first path uses a small
manual CSV format. It has been tested with invented data; Trackman and
Toptracer export mappings still need validation against actual files.

## Try the workflow

Run these commands from the repository root after `uv sync --locked --all-groups`:

```bash
uv run club-picker --data-dir data/private/demo preview data/synthetic/shots.csv
uv run club-picker --data-dir data/private/demo import data/synthetic/shots.csv
uv run club-picker --data-dir data/private/demo import data/synthetic/shots.csv
uv run club-picker --data-dir data/private/demo audit --unit yd
```

The first preview proposes eight shots. The first import adds eight; the second
adds zero and reports eight duplicate rows. The audit describes three clubs
across two invented sessions. These are software checks, not measured golf results.

`python -m club_picker` exposes the same commands as `club-picker`.

## Prepare manual data

Create a file in ignored storage with the supported header:

```bash
mkdir -p data/raw/manual
uv run club-picker template > data/raw/manual/shots.csv
```

Fill in one row per shot. Use UTF-8 CSV and quote values containing commas.
The template prints all supported columns; optional columns can be blank or
omitted. Header names and enumerated values are case-sensitive.

| Required column | Meaning |
| --- | --- |
| `session_id` | Stable session label, reused on repeated exports |
| `shot_id` | Stable identity within that session; do not renumber overlapping exports |
| `club_id` | Physical club/setup identity, such as `iron-7-v1` |
| `club_label` | Display name such as `7 iron` |
| `source` | `manual`, `trackman`, or `toptracer`; origin of measurements, not a provider adapter selector |
| `distance_unit` | `yd` or `m`, applying to all distance fields in that row |
| `carry` | Individual carry distance, finite and nonnegative |

| Optional column | Values and interpretation |
| --- | --- |
| `session_date` | `YYYY-MM-DD`; blank remains undated |
| `shot_intent` | `full`, `partial`, `punch`, `experiment`, or `unknown` |
| `normalization` | `unadjusted`, `normalized`, or `unknown` |
| `ball_compensation` | `on`, `off`, or `unknown` |
| `carry_side` | Signed lateral distance at landing: negative left, positive right |
| `total` | Distance to the reported final resting position |
| `total_side` | Signed lateral distance at rest; requires `total` |
| `carry_basis`, `total_basis` | `measured`, `modeled`, or `unknown` |
| `quality` | `usable` (default), `suspected_error`, or `excluded` |
| `exclusion_reason` | Required for either flagged state; blank for usable shots |
| `session_mode` | Source mode such as `shot_analysis`, or `unknown` |
| `normalization_settings` | Consistent text describing known adjustment settings, or `unknown` |
| `ball_type`, `surface` | Known ball and hitting surface, or `unknown` |

Blank intent, normalization, compensation, basis, and contextual fields become
`unknown`. Blank distances stay missing. A blank lateral measurement never
becomes a straight shot. Curve, launch direction, carry-side distance, and
total-side distance are different measurements; do not substitute one for another.
Keep ordinary mishits usable. Flag tracking errors with reasons instead of
removing inconvenient outcomes. This version requires carry on each imported row;
the intact provider original should retain shots missing that measurement.

Distances are converted to meters in the domain model. The database retains
validated source fields and units, and the byte-for-byte original is archived.
No wind, elevation, or range-ball correction is inferred or applied.

## Preview before importing personal data

```bash
uv run club-picker preview data/raw/manual/shots.csv
uv run club-picker import data/raw/manual/shots.csv
uv run club-picker audit --unit m
```

The default private store is `data/private/club-picker/`, relative to the current
directory. Preview does not create a store. It reports proposed additions,
duplicate rows, flagged rows, errors, and missing-context warnings. Exit status
`2` means the operation failed; `0` means it succeeded. Any validation or identity
conflict prevents the entire file from being imported. `new_shots` is a proposed
count; only `written_shots` confirms additions.

Unknown columns are rejected so that a provider field cannot silently acquire
the wrong meaning. Keep original provider exports intact. Do not delete their
extra columns to make this importer accept them; prepare a separate manual file
only when the mapping is understood. Native provider adapters are still pending.

## Identity and corrections

A shot is identified by source, session ID, shot ID, normalization state, and
ball-compensation state. Reimporting the same records, even under a different
filename or in a different row order, adds no duplicates. Distinct shots with
identical distances are retained. Raw and adjusted variants stay separate.
Audit shot counts count these stored variants, not necessarily unique swings.

Changing an existing record's measurements or metadata is a conflict. Changing
a session's date or a club ID's label is also a conflict. Automatic corrections
and deletions are not implemented. Fix an unimported file before retrying; do not
invent new shot IDs to work around a conflict with stored data. A correction
workflow will need to preserve the original history.

## What the audit means

The JSON audit reports observed minimum, median, and maximum carry, sample and
session counts, and how many shots include carry-side data. It excludes flagged
records from carry summaries but counts them in the inventory.

Groups stay separate by club, source, intent, normalization, compensation,
carry basis, session mode, normalization settings, ball type, and surface.
Context strings must match exactly. Matching `unknown` values do not prove
conditions were comparable. This is an inventory for reviewing data, not a
trained profile, recommendation, or estimate of future hazard probability.

Known dates determine session order, independently of import order. Undated
shots remain unplaced. Sessions sharing a date have no established within-day
chronology. Minimum and maximum are observed values, not worst/best possible
future shots. Chronological model evaluation and recommendation rules come later.

## Private storage and backups

The store contains `shots.sqlite3` and `originals/<sha256>.csv`. The database
records adapter version, import time, input filename, fingerprint, and source-row
links. Database schema version 1 is checked before use; unsupported versions
are rejected. SQLite transactions prevent partially committed shot imports.
A failed database write can leave an unreferenced original archive, which is
safe to retain and can be reused on retry.

New database and archive files are owner-readable/writable (`0600`); new store
and archive directories use `0700`. This is local file protection, not encryption.
Close commands and back up the whole private store together. The default path
is Git-ignored and outside the built package. Custom `--data-dir` paths are your
responsibility to keep private. Audits include private session dates and labels,
so keep redirected output under ignored storage as well.

No network connection or account credentials are used by these commands.
Public datasets require a separate allowlisted transformation under the
[data policy](data-policy.md); there is no automatic public export yet.
